// The app: load the data, keep the current profile, switch scenes, and save.
import { setLanguage as loadLanguage, t, useSeenGloss, seenGlossList, setGlobalParams } from './i18n.js';
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
import { createSurface } from '../render/surface.js';
import { mountTitle } from './title.js';
import { connectAudio } from './audio.js';
import { startTimer, isTimeOver } from './rest.js';
import { scenes, modals, registerScene, registerModal } from './registry.js';
import { mountCreate } from './create.js';
import { mountVillage } from './village.js';

// Scenes and the scenes that can come after each one.
const SCENES = {
  boot: ['title'],
  title: ['create', 'village', 'title', 'rest'],
  create: ['village', 'title'],
  village: ['battle', 'vanmieu', 'title', 'rest', 'village'],
  battle: ['village'],
  vanmieu: ['village'],
  rest: ['title', 'village', 'rest'],
};

registerScene('title', mountTitle);
registerScene('create', mountCreate);
registerScene('village', mountVillage);
const MOUNT = scenes;

export async function startApp(root) {
  const ui = root.querySelector('#ui');
  const canvas = root.querySelector('#world');
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
  const surface = createSurface(canvas);
  window.addEventListener('resize', () => surface.resize());
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
    surface,
    bus,
    profile: null,
    learner: null,
    rng: createRng(Date.now() >>> 0),

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
        current = await MOUNT[name](ctx, params);
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
      ctx.profile.seenGloss = seenGlossList();
      const snapshot = ctx.profile;
      saving = saving.then(() => saveProfile(snapshot)).catch((e) => console.error('Save failed', reason, e));
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
      ctx.learner = createLearner({ graph, config: data.learning, learning: p.learning, grade: p.grade, rng: ctx.rng, bank, lang: p.settings.lang });
    },

    async startProfile(profile, isNew = false) {
      ctx.profile = profile;
      // The questions of this play session: quizzes, battles, and exams avoid repeats.
      ctx.seen = createSeen();
      setGlobalParams({ name: profile.hero.name });
      useSeenGloss(profile.seenGloss);
      await ctx.setLanguage(profile.settings.lang);
      setVoiceEnabled(profile.settings.voice);
      bus.emit('settings', profile.settings);
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

    confirmBattle(id) {
      return modals.confirmBattle ? modals.confirmBattle(ctx, { id }) : Promise.resolve();
    },

    openParent() {
      return modals.parent ? modals.parent(ctx, {}) : Promise.resolve();
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
        button(t('ui.save.exit'), async () => { close(); await c.save('exit'); c.go('title'); }, { cls: 'btn paper' }),
      ]),
    ]);
    layer.append(panel);
    layer.addEventListener('click', (e) => { if (e.target === layer) close(); });
    ui.append(layer);
  }));

  // Save when the page goes to the background.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') ctx.save('hidden');
  });

  startTimer(ctx);
  // The game context, for automatic tests of the whole game in a browser.
  window.tre = ctx;
  const saved = await getMeta('lang').catch(() => null);
  const browser = navigator.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
  await ctx.setLanguage(saved ?? browser);
  await ctx.go('title');
  return ctx;
}

export { speak };
