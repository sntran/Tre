// The app: load the data, keep the current profile, switch scenes, and save.
import { setLanguage as loadLanguage, t, useSeenGloss, seenGlossList, setGlobalParams, setChosenNames } from './i18n.js';
import { chosenGlossNames } from '../core/profile.js';
import { loadRecordedKeys, setVoiceEnabled, setVoiceProfiles, speak } from './speak.js';
import { loadData } from './data.js';
import { createSeen } from '../core/fresh.js';
import { saveProfile, loadProfile, isMemoryOnly, getMeta, setMeta } from './storage.js';
import { h, button } from './dom.js';
import { createBus } from '../core/events.js';
import { createMachine } from '../core/fsm.js';
import { createRng } from '../core/rng.js';
import { createSkillGraph } from '../core/skills.js';
import { createLearner } from '../core/learner.js';
import { isDue } from '../core/review.js';
import { createExperiments } from '../core/experiments.js';
import { createLogger } from '../core/logger.js';
import { DAY_MS } from '../core/learnlog.js';
import { mountTitle } from './title.js';
import { connectAudio } from './audio.js';
import { startTimer, isTimeOver } from './rest.js';
import { scenes, modals, registerScene, registerModal } from './registry.js';
import { mountCreate } from './create.js';
import { mountVillage } from './village.js';
import { startStory } from './storybook.js';

// The scenes of play: a session of the learning log is open in them.
const PLAY = new Set(['village', 'vanmieu']);

// Scenes and the scenes that can come after each one.
const SCENES = {
  boot: ['title'],
  title: ['create', 'village', 'title', 'rest'],
  create: ['village', 'title'],
  village: ['vanmieu', 'title', 'rest', 'village'],
  vanmieu: ['village'],
  rest: ['title', 'village', 'rest'],
};

registerScene('title', mountTitle);
registerScene('create', mountCreate);
registerScene('village', mountVillage);
const MOUNT = scenes;

export async function startApp(root) {
  const ui = root.querySelector('#ui');
  // The canvas of the voxel world (WebGL).
  const voxel = root.querySelector('#voxel');
  ui.replaceChildren(h('div', { class: 'screen loading' }, [h('div', { class: 'progress-bar' }, [h('span', { style: { width: '5%' } })])]));
  const bar = ui.querySelector('.progress-bar span');

  const data = await loadData((f) => { bar.style.width = `${Math.round(5 + f * 90)}%`; });
  setVoiceProfiles(data.game.voices);
  // Load the two fonts before the first screen, so that the Canvas can use them too.
  await Promise.all([
    document.fonts?.load('700 20px Alegreya'),
    document.fonts?.load('400 16px "Be Vietnam Pro"'),
    document.fonts?.load('700 16px "Be Vietnam Pro"'),
  ]).catch(() => {});
  const graph = createSkillGraph(data.skills);
  const bus = createBus();
  connectAudio(bus);

  const machine = createMachine({
    initial: 'boot',
    states: Object.fromEntries(Object.entries(SCENES).map(([name, next]) => [name, { on: Object.fromEntries(next.map((n) => [n, n])) }])),
  });

  let current = null;
  let going = false;
  let saving = Promise.resolve();

  const ctx = {
    data,
    graph,
    ui,
    voxel,
    bus,
    profile: null,
    learner: null,
    rng: createRng(Date.now() >>> 0),
    syncWorld: null, // set by the village: puts the world state into the profile
    experiments: null, // the switches of this profile (src/core/experiments.js)
    logger: null, // the learning log of this profile (src/core/logger.js)

    // The one way to the learning log. kind: attempt, review, exam, prediction (events), action
    // (the first action of a session: walk, place, talk, travel, menu), or questStep.
    log(kind, fields = {}) {
      const l = ctx.logger;
      if (!l) return null;
      if (kind === 'attempt') return l.attempt(fields);
      if (kind === 'action') return l.action(fields.kind);
      if (kind === 'questStep') return l.questStep();
      return l.record(kind, fields);
    },

    async setLanguage(code) {
      await loadLanguage(code);
      await loadRecordedKeys(code);
      if (ctx.profile) ctx.profile.settings.lang = code;
      setMeta('lang', code).catch(() => {});
      bus.emit('lang', code);
    },

    // Change the scene. Unknown changes are errors, so the game never goes to a strange state.
    async go(name, params = {}) {
      // A second change while a scene starts (for example a double tap) does nothing.
      if (going) return null;
      if (!machine.send(name)) throw new Error(`No scene change from ${machine.state} to ${name}`);
      going = true;
      try {
        if (current) current.unmount();
        current = null;
        ui.replaceChildren();
        if (voxel) voxel.hidden = true;
        // A session of play ends at the title (the child left) or at the rest screen (the time
        // limit of the parent), and starts again in a scene of play.
        if (ctx.logger?.open && (name === 'title' || name === 'rest')) {
          ctx.logger.endSession(name === 'rest' ? 'parent' : 'child', ctx.profile?.world?.map ?? null);
          // The title loads the profile again from the store: save the end of the session now.
          ctx.save('session');
        }
        current = await MOUNT[name](ctx, params);
        if (ctx.logger && !ctx.logger.open && PLAY.has(name) && document.visibilityState !== 'hidden') ctx.logger.startSession();
      } finally {
        going = false;
      }
      bus.emit('scene', name);
      return current;
    },

    get scene() {
      return machine.state;
    },

    // Save the profile. Saves run one after the other.
    save(reason = '') {
      if (!ctx.profile) return saving;
      // The open village puts its world state into the profile first.
      ctx.syncWorld?.();
      ctx.logger?.checkQuests();
      ctx.profile.seenGloss = seenGlossList();
      const snapshot = ctx.profile;
      // The save at dawn is also a restore point for the parent.
      saving = saving.then(() => saveProfile(snapshot, { dawn: reason === 'dawn' })).catch((e) => console.error('Save failed', reason, e));
      return saving;
    },

    // Values that all texts can use.
    textParams() {
      const p = ctx.profile;
      if (!p) return {};
      const trials = ['scholar', 'smith', 'fisher', 'healer', 'woodcutter'].filter((c) => p.flags[`trial.${c}.done`]).length;
      return { name: p.hero.name, trials, iron: p.inventory.iron ?? 0 };
    },

    makeLearner() {
      const p = ctx.profile;
      ctx.rng = createRng(`${p.seed}:${Date.now()}`);
      const bank = [...data.questions.questions, ...(p.settings.questions ?? []).map((q) => ({ ...q, level: 1, parent: true }))];
      // The switches of the experiments: the target of the choice of the next task, and the days
      // between reviews.
      const x = ctx.experiments;
      const target = x?.value('target') ?? data.learning.rating.target;
      const config = {
        ...data.learning,
        rating: { ...data.learning.rating, target, targetLow: target - 0.05, targetHigh: target + 0.05 },
        review: { ...data.learning.review, intervalsDays: x?.value('reviewDays') ?? data.learning.review.intervalsDays },
      };
      const learner = createLearner({ graph, config, learning: p.learning, grade: p.grade, rng: ctx.rng, bank, lang: p.settings.lang });
      // A review: an answer for a mastered skill that is due goes into the learning log too.
      const record = learner.record;
      learner.record = (prob, correct) => {
        const e = learner.entry(prob.skill);
        const now = Date.now();
        const review = e.mastered && isDue(e, now) ? { due: e.due, gap: e.last ? (now - e.last) / DAY_MS : 0 } : null;
        const out = record(prob, correct);
        if (review) ctx.log('review', { skill: prob.skill, due: review.due, gap: Math.round(review.gap * 10) / 10, result: Boolean(correct) });
        return out;
      };
      ctx.learner = learner;
    },

    // The experiments and the learning log of the profile. Predictions that an older version kept
    // in the profile go into the log.
    startLog() {
      const p = ctx.profile;
      ctx.logger?.endSession('child', null);
      ctx.experiments = createExperiments(data.experiments, { seed: p.seed, choice: p.experiment ?? null });
      // A story of the storybook, or a scripted play (?harness), is not a child: its events never go into the log.
      const drop = Boolean(ctx.storybook) || new URLSearchParams(location.search).has('harness');
      ctx.logger = createLogger({ profile: p, schema: data.learnlog, label: () => ctx.experiments.label, quests: data.quests.quests, tz: new Date().getTimezoneOffset(), drop });
      for (const x of p.predictions ?? []) ctx.log('prediction', { task: x.task, gap: x.gap, guess: x.guess, used: x.used, solved: x.solved });
      delete p.predictions;
    },

    async startProfile(profile, isNew = false) {
      ctx.profile = profile;
      // The questions of this play session: quizzes and exams avoid repeats.
      ctx.seen = createSeen();
      setGlobalParams({ name: profile.hero.name });
      setChosenNames(chosenGlossNames(profile, data.friends.friends));
      useSeenGloss(profile.seenGloss);
      await ctx.setLanguage(profile.settings.lang);
      setVoiceEnabled(profile.settings.voice);
      bus.emit('settings', profile.settings);
      ctx.startLog();
      ctx.makeLearner();
      if (isNew) await ctx.save('new');
      await ctx.go(isTimeOver(ctx) ? 'rest' : 'village');
      if (isMemoryOnly()) ctx.toast('ui.memory.only');
    },

    async playProfile(id) {
      const profile = await loadProfile(id);
      if (profile) await ctx.startProfile(profile);
    },

    // Open a screen that a story effect asks for. Return true when the village stays.
    async open(cmd, extra = {}) {
      const modal = modals[cmd.open];
      if (modal) {
        await modal(ctx, cmd, extra);
        return ctx.scene === 'village';
      }
      if (MOUNT[cmd.open]) {
        await ctx.go(cmd.open, cmd);
        return false;
      }
      console.warn('Unknown screen', cmd.open);
      return true;
    },

    // The parent area. opts: { tab, profile, action } opens a tab (and an action on a profile).
    openParent(opts = {}) {
      return modals.parent ? modals.parent(ctx, opts) : Promise.resolve();
    },

    openMenu() {
      return modals.menu ? modals.menu(ctx, {}) : Promise.resolve();
    },

    toast(key, params = {}) {
      const el = h('div', { class: 'toast', role: 'status', text: t(key, params) });
      ui.append(el);
      setTimeout(() => el.remove(), 2600);
    },
  };

  // The simple menu of the village.
  registerModal('menu', (c) => new Promise((resolve) => {
    const layer = h('div', { class: 'modal-layer' });
    const close = () => { layer.remove(); resolve(); };
    const panel = h('div', { class: 'panel', style: { width: 'min(460px, 100%)' } }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: t('ui.menu') }), button(null, close, { cls: 'icon-btn', icon: 'ui/close', aria: t('ui.close') })]),
      h('div', { class: 'menu-list' }, [
        button(t('ui.continue'), close, { cls: 'btn big' }),
        button(t('ui.parents'), () => { close(); c.openParent(); }, { cls: 'btn paper', icon: 'ui/lock' }),
        button(t('ui.save.exit'), async () => { close(); await c.save('exit'); c.toast('ui.saved'); c.go('title'); }, { cls: 'btn paper' }),
      ]),
    ]);
    layer.append(panel);
    layer.addEventListener('click', (e) => { if (e.target === layer) close(); });
    ui.append(layer);
  }));

  // Save when the page goes to the background. The session of play ends there (the device), and
  // a new one starts when the page comes back in a scene of play.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      ctx.logger?.endSession('device', ctx.profile?.world?.map ?? null);
      ctx.save('hidden');
    } else if (ctx.logger && !ctx.logger.open && PLAY.has(ctx.scene)) ctx.logger.startSession();
  });

  startTimer(ctx);
  // The game context, for automatic tests of the whole game in a browser.
  window.tre = ctx;
  const saved = await getMeta('lang').catch(() => null);
  const browser = navigator.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
  await ctx.setLanguage(saved ?? browser);
  // ?story=<name> opens a story of the storybook (with &play, the story plays).
  const query = new URLSearchParams(location.search);
  if (query.get('story')) {
    await ctx.go('title');
    await startStory(ctx, query.get('story'), { play: query.has('play'), speed: Number(query.get('speed')) || 1 });
    return ctx;
  }
  await ctx.go('title');
  return ctx;
}

export { speak };
