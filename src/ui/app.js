// The app: load the data, keep the current profile, switch scenes, and save.
import { setLanguage as loadLanguage, t, useSeenGloss, seenGlossList, setGlobalParams, setChosenNames } from './i18n.js';
import { chosenGlossNames, startLanguage } from '../core/profile.js';
import { loadRecordedKeys, setVoiceEnabled, setVoiceProfiles, speak } from './speak.js';
import { loadData } from './data.js';
import { createSeen } from '../core/fresh.js';
import { joinSeen } from '../core/speech.js';
import { saveProfile, loadProfile, listProfiles, isMemoryOnly, getMeta, setMeta } from './storage.js';
import { linkIdOf, activityOf } from '../core/practice.js';
import { h, button, img } from './dom.js';
import { createBus } from '../core/events.js';
import { createMachine } from '../core/fsm.js';
import { createRng } from '../core/rng.js';
import { createSkillGraph } from '../core/skills.js';
import { createLearner } from '../core/learner.js';
import { reviewOf } from '../core/review.js';
import { createExperiments } from '../core/experiments.js';
import { createLogger } from '../core/logger.js';
import { mountTitle } from './title.js';
import { connectAudio } from './audio.js';
import { startTimer, isTimeOver } from './rest.js';
import { scenes, modals, registerScene, registerModal } from './registry.js';
import { mountCreate } from './create.js';
import { mountVillage } from './village.js';
import { showLoading } from './loading.js';
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
    practiceLink: null, // the activity of a practice link (?practice=<id>), until a profile plays it
    practiceNote: null, // the line of the title screen for a practice link: { key, params }
    practiceId: null, // the id of the practice of the visit now (for the sessions of the log)

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

    // The child chose a language (the switch of the title screen, or hero creation): the next start
    // of a profile uses it (startLanguage in src/core/profile.js).
    async chooseLanguage(code) {
      ctx.langChosen = code;
      await ctx.setLanguage(code);
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
      // A new world for the village: the loading screen shows at once, until the world is drawn.
      const loading = name === 'village' && !params.session ? ctx.beginLoading({ profile: ctx.profile, map: params.map ?? null, at: params.at ?? null, from: params.from ?? null, practice: params.practice ?? null }) : null;
      try {
        // The screen draws before the work of the load.
        if (loading) await loading.painted;
        if (current) current.unmount();
        current = null;
        ui.replaceChildren();
        if (voxel) voxel.hidden = true;
        // A session of play ends at the title (the child left) or at the rest screen (the time
        // limit of the parent), and starts again in a scene of play.
        if (name === 'title' || name === 'rest') ctx.practiceId = null;
        if (ctx.logger?.open && (name === 'title' || name === 'rest')) {
          ctx.logger.endSession(name === 'rest' ? 'parent' : 'child', ctx.profile?.world?.map ?? null);
          // The title loads the profile again from the store: save the end of the session now.
          ctx.save('session');
        }
        current = await MOUNT[name](ctx, params);
        // Only the village ends the loading screen itself, when its first frame is drawn.
        if (name !== 'village') ctx.endLoading();
        if (ctx.logger && !ctx.logger.open && PLAY.has(name) && document.visibilityState !== 'hidden') ctx.logger.startSession({ practice: ctx.practiceId });
      } catch (e) {
        ctx.endLoading();
        throw e;
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
      ctx.profile.seenGloss = joinSeen(ctx.profile.seenGloss, seenGlossList());
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
        const review = reviewOf(e, now, config.review);
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

    // The loading screen (src/ui/loading.js): it shows at once in the frame of the tap, and the
    // village ends it when the world is drawn with the hero. opts: see showLoading.
    loading: null,
    loadTimes: null, // the times of the steps of the last load (ms), for the ?fps meter
    beginLoading(opts = {}) {
      if (ctx.loading && !ctx.loading.finished) {
        if (opts.profile) ctx.loading.setProfile(opts.profile);
        return ctx.loading;
      }
      ctx.loading = showLoading(ctx, opts);
      return ctx.loading;
    },
    endLoading() {
      const l = ctx.loading;
      if (!l) return;
      ctx.loading = null;
      l.finish();
      ctx.loadTimes = l.times();
    },

    async startProfile(profile, isNew = false) {
      // The loading screen first, in the frame of the tap.
      const practice = ctx.practiceLink;
      const loading = ctx.beginLoading({ profile, practice });
      loading.report('data');
      ctx.profile = profile;
      // The questions of this play session: quizzes and exams avoid repeats.
      ctx.seen = createSeen();
      setGlobalParams({ name: profile.hero.name });
      setChosenNames(chosenGlossNames(profile, data.friends.friends));
      useSeenGloss(profile.seenGloss);
      const code = startLanguage(profile, ctx.langChosen);
      ctx.langChosen = null;
      const changed = code !== profile.settings.lang;
      profile.settings.lang = code;
      await ctx.setLanguage(code);
      setVoiceEnabled(profile.settings.voice);
      bus.emit('settings', profile.settings);
      await loading.painted;
      ctx.startLog();
      ctx.makeLearner();
      // The saves go one after the other, so the world does not wait for the first save.
      if (isNew) ctx.save('new');
      else if (changed) ctx.save('settings');
      // A practice link: the visit goes straight to the activity (the rules of the parent hold).
      ctx.practiceLink = null;
      ctx.practiceNote = null;
      await ctx.go(isTimeOver(ctx) ? 'rest' : 'village', practice ? { practice } : {});
      if (isMemoryOnly()) ctx.toast('ui.memory.only');
    },

    async playProfile(id) {
      // The loading screen shows in the frame of the tap; the profile loads after it.
      ctx.beginLoading({ practice: ctx.practiceLink });
      const profile = await loadProfile(id);
      if (profile) await ctx.startProfile(profile);
      else ctx.endLoading();
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

  // The touch help: a picture of each control and one short line.
  const touchHelp = () => {
    const pic = (cls, child = null) => h('span', { class: `help-pic ${cls}` }, child ? [child] : []);
    const rows = [
      [pic('help-tap'), 'ui.help.tap'],
      [pic('help-icon', img('ui/star', 'btn-icon')), 'ui.help.star'],
      [pic('help-stick', h('span', { class: 'help-knob' })), 'ui.help.stick'],
      [pic('help-btn big', img('ui/hand-pick', 'btn-icon')), 'ui.help.act'],
      [pic('help-btn', img('ui/jump', 'btn-icon')), 'ui.help.jump'],
      [pic('help-btn', h('span', { text: '⟲' })), 'ui.help.turn'],
    ];
    return h('ul', { class: 'menu-help' }, rows.map(([p, key]) => h('li', {}, [p, h('span', { text: t(key) })])));
  };

  // The simple menu of the village.
  registerModal('menu', (c) => new Promise((resolve) => {
    const layer = h('div', { class: 'modal-layer' });
    const close = () => { layer.remove(); resolve(); };
    const panel = h('div', { class: 'panel', style: { width: 'min(460px, 100%)' } }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: t('ui.menu') }), button(null, close, { cls: 'icon-btn', icon: 'ui/close', aria: t('ui.close') })]),
      h('div', { class: 'menu-list' }, [
        button(t('ui.continue'), close, { cls: 'btn big' }),
        // The notebook of prints (#8).
        button(t('note.title'), () => { close(); modals.notebook?.(c); }, { cls: 'btn paper', icon: 'ui/seal' }),
        button(t('ui.parents'), () => { close(); c.openParent(); }, { cls: 'btn paper', icon: 'ui/lock' }),
        button(t('ui.save.exit'), async () => { close(); await c.save('exit'); c.toast('ui.saved'); c.go('title'); }, { cls: 'btn paper' }),
      ]),
      // The help of the controls: on a touch screen the touch help only, with small pictures of
      // the buttons; the keys only with a mouse and a keyboard (#53).
      matchMedia('(pointer: coarse)').matches ? touchHelp() : h('p', { class: 'menu-keys', text: t('ui.keys') }),
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
    } else if (ctx.logger && !ctx.logger.open && PLAY.has(ctx.scene)) ctx.logger.startSession({ practice: ctx.practiceId });
  });

  startTimer(ctx);
  // The game context, for automatic tests of the whole game in a browser.
  window.tre = ctx;
  const saved = await getMeta('lang').catch(() => null);
  const browser = navigator.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
  await ctx.setLanguage(saved ?? browser);
  // ?story=<name> opens a story of the storybook (with &play, the story plays; with
  // &clock=<minutes of the day>, at another hour).
  const query = new URLSearchParams(location.search);
  if (query.get('story')) {
    await ctx.go('title');
    await startStory(ctx, query.get('story'), { play: query.has('play'), speed: Number(query.get('speed')) || 1, clock: query.has('clock') ? Number(query.get('clock')) : null });
    return ctx;
  }
  // ?practice=<id> takes a child to one activity (src/core/practice.js): only the id is read. With
  // profiles, the title screen asks who plays; with none, a short hero creation comes first. An
  // unknown id opens the title screen with a short line.
  const practiceId = linkIdOf(location.search);
  if (practiceId) {
    const activity = activityOf(data.practice, practiceId);
    ctx.practiceLink = activity;
    ctx.practiceNote = activity ? { key: 'practiceLink.pick', params: { title: { key: activity.titleKey } } } : { key: 'practiceLink.unknown', params: {} };
    await ctx.go('title');
    if (activity && !(await listProfiles()).some((p) => !p.damaged)) await ctx.go('create');
    return ctx;
  }
  await ctx.go('title');
  return ctx;
}

export { speak };
