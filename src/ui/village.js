// The village scene: a thin view over the session of the village (src/core/session.js). The
// session owns the world state and the story logic; this file draws the state, turns the input
// into commands, and reacts to the events: the dialogue box, the screens, the sounds, the HUD,
// and the marks over the world.
import { currentGoal } from '../core/quests.js';
import { conditionState } from '../core/game.js';
import { edgeMarker } from '../core/hit.js';
import { heroLayers } from '../render/assets.js';
import { keysToScreenDir, stickToScreenDir, screenToMap, inputToward } from '../core/world/move.js';
import { getEntity, query } from '../core/world/state.js';
import { STEP } from '../core/world/step.js';
import { createSession, middleOf } from '../core/session.js';
import { buildTerrain, columnTop } from '../world/terrain.js';
import { heroLook } from '../world/figures.js';
import { h, img, button } from './dom.js';
import { t, tn } from './i18n.js';
import { speak } from './speak.js';
import { createDialogueBox } from './dialogue.js';
import { createRaidView } from './raid.js';

const STICK_R = 56; // the radius of the virtual stick, in screen pixels
// The color of the dusk wash at full night: the hue of indigo (#2f4668) in the palette.
const DUSK = Object.freeze({ hue: 215, saturation: 45, lightness: 42 });
const HOLD_MS = 220; // a press this long is a hold (walk toward the finger), not a tap
const KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyE', 'Space']);

// three.js and the drawing code load only when the village opens, so that the other screens
// work without them. The terrain of a map takes some time to make: keep it for the next visit.
let drawing = null;
const terrains = new Map();
const worlds = new Map();

async function loadDrawing() {
  drawing ??= Promise.all([import('../render/voxel.js'), import('../render/figure3d.js')])
    .then(([voxel, figure]) => ({ ...voxel, ...figure }))
    .catch((e) => {
      drawing = null;
      throw e;
    });
  return drawing;
}

// The terrain of a map, made once.
export function terrainOf(map, tileTypes, tileMap) {
  if (!terrains.has(map.id)) terrains.set(map.id, buildTerrain(map, tileTypes, tileMap));
  return terrains.get(map.id);
}

// A clear message when the device cannot draw the world.
function noWorld(ctx) {
  const box = h('div', { class: 'screen no-webgl' }, [
    h('div', { class: 'panel' }, [
      h('p', { text: t('ui.webgl.missing') }),
      button(t('ui.menu'), () => ctx.openMenu(), { cls: 'btn big' }),
    ]),
  ]);
  ctx.ui.append(box);
  return { unmount() { box.remove(); }, api: null };
}

// A new session of the village for the profile of the game.
export function villageSession(ctx) {
  return createSession({
    data: ctx.data,
    profile: ctx.profile,
    learner: () => ctx.learner,
    log: (kind, fields) => ctx.log(kind, fields),
    save: (reason) => ctx.save(reason),
    terrainOf: (map, tileMap) => terrainOf(map, ctx.data.tiles.types, tileMap),
    switches: ctx.experiments?.switches ?? null,
  });
}

// params: map, at, facing, after (talks after the start), arrive (the map name shows), and
// session (a session that already started, after an exit to this map).
export async function mountVillage(ctx, params = {}) {
  const { data, profile } = ctx;
  const worldMap = data.world;
  const canvas = ctx.voxel;

  let D;
  try {
    D = await loadDrawing();
  } catch (e) {
    console.error('The drawing code did not load', e);
    return noWorld(ctx);
  }
  if (!D.hasWebGL()) return noWorld(ctx);
  canvas.hidden = false;

  const session = params.session ?? villageSession(ctx);
  if (!params.session) session.start(params.map ?? null, { at: params.at, facing: params.facing, after: params.after });
  const mapData = session.map;
  const tileMap = session.tileMap;
  const terrain = session.terrain;
  const state = session.state;
  if (!worlds.has(mapData.id)) worlds.set(mapData.id, D.createVoxelWorld(canvas, terrain));
  const view = worlds.get(mapData.id);
  const looks = data.figures.figures;
  const figures = D.createFigureLayer(view.scene, (key, carry) => ({ ...(key === 'hero' ? heroLook(profile.hero) : looks[key] ?? {}), ...(carry ? { item: carry } : {}) }), { camera: view.camera, zoom: () => view.state.level });

  // The height of the ground under a map point (world units).
  const groundY = (x, y) => columnTop(tileMap.heightAt(Math.floor(x), Math.floor(y)));
  const hero = () => getEntity(state, 'hero');
  const heroCell = () => session.heroCell();
  const persons = () => session.persons();
  const send = (cmd) => {
    session.command(cmd);
    flush();
  };

  let tapFx = null;
  let busy = session.busy; // true while a dialogue or a panel is open
  let alive = true;
  let leaving = false; // true after the hero walks into an exit
  ctx.syncWorld = session.syncSave;

  // HUD
  const hud = h('div', { class: 'hud' });
  const goalBtn = h('button', { class: 'goal', type: 'button' });
  const counts = h('div', { class: 'counts' });
  const heroFace = h('button', { class: 'hud-hero', type: 'button', 'aria-label': t('ui.home') }, [
    h('span', { class: 'mini-portrait' }, heroLayers(profile.hero).map((p) => img(p, 'layer'))),
    h('span', { class: 'hud-name', text: profile.hero.name }),
  ]);
  heroFace.addEventListener('click', () => send({ type: 'talkTo', id: 'grandma' }));
  const menuBtn = button(null, () => { ctx.log('action', { kind: 'menu' }); ctx.openMenu(); }, { cls: 'icon-btn', icon: 'ui/menu', aria: t('ui.menu') });
  // The country map. The world waits while it is open.
  const mapBtn = button(null, () => {
    ctx.log('action', { kind: 'travel' });
    if (!busy && !leaving) send({ type: 'travel' });
  }, { cls: 'icon-btn map-btn', icon: 'ui/map', aria: t('ui.worldmap') });
  hud.append(heroFace, goalBtn, counts, mapBtn, menuBtn);
  // Buttons that turn the view in steps of 90°.
  const turnLeft = h('button', { class: 'turn-btn', type: 'button', 'aria-label': t('ui.turn.left'), title: t('ui.turn.left'), text: '⟲' });
  const turnRight = h('button', { class: 'turn-btn', type: 'button', 'aria-label': t('ui.turn.right'), title: t('ui.turn.right'), text: '⟳' });
  turnLeft.addEventListener('click', () => view.turn(-1));
  turnRight.addEventListener('click', () => view.turn(1));
  const turns = h('div', { class: 'turns' }, [turnLeft, turnRight]);
  // The paper of the print over the world: grain and a soft vignette.
  const paper = h('div', { class: 'world-paper' });
  // The dusk over the world: an indigo wash with warm pools around the lanterns, and the rain.
  const duskLayer = h('canvas', { class: 'world-dusk' });
  // The hue of the dusk: a layer in the indigo of the palette with the blend mode "color", so that
  // the yellow paper turns blue as the light goes (a multiply alone makes it gray on the way).
  const duskTint = h('div', { class: 'world-dusk-tint' });
  // The warm light of the lanterns on top (blend mode "screen": it adds light to the indigo).
  const glowLayer = h('canvas', { class: 'world-glow' });
  const glow = glowLayer.getContext('2d');
  const dusk = duskLayer.getContext('2d');
  const drops = Array.from({ length: 140 }, (_, i) => ({ x: (i * 97) % 1000 / 1000, y: (i * 61) % 1000 / 1000, s: 0.7 + ((i * 13) % 10) / 20 }));
  // The marks of a raid: the dotted arc of the slingshot, the flow of an element, the dots over
  // the enemies (src/ui/raid.js).
  const raidLayer = h('canvas', { class: 'world-raid', hidden: true });
  const raidView = createRaidView({ view, figures, session, layer: raidLayer, send });
  // The layer of the marks on the world: the quest stars, the arrows at the edge, the tap ring.
  const marks = h('div', { class: 'world-marks' });
  const ring = h('div', { class: 'tap-ring', hidden: true });
  const stickEl = h('div', { class: 'stick', hidden: true }, [h('div', { class: 'stick-knob' })]);
  marks.append(ring, stickEl);
  // A dark layer for the change of map, and the name of the new map.
  const fade = h('div', { class: params.arrive ? 'map-fade on' : 'map-fade' });
  const banner = params.arrive ? h('div', { class: 'map-name', text: t(mapData.nameKey) }) : null;
  ctx.ui.append(duskTint, duskLayer, glowLayer, paper, raidLayer, marks, hud, turns, fade, ...(banner ? [banner] : []));
  if (params.arrive) {
    requestAnimationFrame(() => requestAnimationFrame(() => fade.classList.remove('on')));
    setTimeout(() => banner?.remove(), 2600);
  }

  let goalKey = null;
  let goalParams = {};
  const flying = {}; // items on their way to the counters of the HUD
  function updateHud() {
    const goal = currentGoal(data.quests.quests, conditionState(profile));
    if (goal) {
      goalKey = goal.step.goalKey;
      goalParams = goal.progress ?? {};
    } else {
      goalKey = 'quest.free';
      goalParams = {};
    }
    // The quest bar has short text only. The dialogues give the long explanations.
    goalBtn.replaceChildren(img('ui/quest', 'btn-icon'), h('span', { class: 'goal-text', text: tn(goalKey, goalParams) }));
    // A coin on its way to the bag is not in the count yet: the count ticks up when it lands.
    counts.replaceChildren(...data.items.hud.map((item) => h('span', { class: 'count', dataset: { item } }, [
      img(data.items.items[item].art, 'count-icon'),
      h('span', { text: String((profile.inventory[item] ?? 0) - (flying[item] ?? 0)) }),
    ])));
  }
  goalBtn.addEventListener('click', () => speak(goalKey, goalParams, { force: true }));

  // The top of a figure, for its quest star (world units).
  const figureTop = (id) => {
    const f = figures.placeOf(id);
    return f ? f.y + f.height + 0.6 : null;
  };
  const objectOf = (id) => terrain.objects.find((o) => o.id === id);

  // The quest markers: world points { x, y (map), h (height) }.
  function markers() {
    const goal = currentGoal(data.quests.quests, conditionState(profile));
    if (!goal) return [];
    const stepGoal = goal.step;
    const out = [];
    const flags = profile.flags;
    const list = stepGoal.targets ?? (stepGoal.target ? [{ npc: stepGoal.target }] : []);
    const here = persons();
    // A target on another map: the marker is on the exit that leads there.
    const markExit = (mapId) => {
      const exit = mapId && mapId !== mapData.id ? worldMap.firstExit(mapData.id, mapId) : null;
      if (exit && !out.some((m) => m.exit === exit.id)) {
        const x = exit.x + exit.w / 2;
        const y = exit.y + exit.h / 2;
        out.push({ exit: exit.id, x, y, h: groundY(Math.min(x, mapData.width - 1), Math.min(y, mapData.height - 1)) + 3 });
      }
    };
    for (const tg of list) {
      if (tg.unless && flags[tg.unless]) continue;
      if (tg.if && !flags[tg.if]) continue;
      for (const kind of ['npc', 'encounter', 'object']) {
        if (tg[kind]) markExit(worldMap.whereIs(kind, tg[kind]));
      }
      for (const kind of ['npc', 'encounter']) {
        const p = tg[kind] ? here.find((x) => x.kind === kind && x.ref === tg[kind]) : null;
        const top = p ? figureTop(p.entity) : null;
        if (top !== null) out.push({ x: p.x, y: p.y, h: top });
      }
      if (tg.object) {
        const o = mapData.layers.objects.find((x) => x.id === tg.object);
        const thing = objectOf(tg.object);
        if (o) out.push({ x: o.x + o.w / 2, y: o.y + o.h / 2, h: (thing ? terrain.boxOf(thing).y1 : groundY(o.x, o.y) + 2) + 0.8 });
      }
    }
    if (stepGoal.place && (stepGoal.place.map ?? mapData.id) === mapData.id) out.push({ x: stepGoal.place.x + 1, y: stepGoal.place.y + 0.5, h: groundY(stepGoal.place.x, stepGoal.place.y) + 3 });
    else if (stepGoal.place) markExit(stepGoal.place.map);
    return out;
  }

  // Screens: the session opens them, the view shows them and tells the session when they close.
  let box = null;
  const book = ctx.storybook ?? null; // a story of the storybook (src/ui/storybook.js)
  let bookScreen = null;
  function openScreen(ev) {
    if (ev.screen === 'dialogue' || ev.screen === 'say') {
      box ??= createDialogueBox(ctx, { next: () => send({ type: 'next' }), choose: (n) => send({ type: 'choose', n }) });
      box.show(ev);
      return;
    }
    if (ev.screen === 'callout') {
      showBubble(ev.id, t(ev.textKey, ev.params));
      return;
    }
    // A story that plays in the storybook stays in the village: the other screens show as a
    // card with their name, until the story closes them.
    if (book?.playing) {
      bookScreen?.remove();
      bookScreen = h('div', { class: 'story-screen', text: ev.screen });
      ctx.ui.append(bookScreen);
      return;
    }
    if (ev.screen === 'rest') {
      // The time is over: the hero goes home to rest. A panel of the parent waits first.
      const goRest = () => {
        if (!alive) return;
        if (ctx.ui.querySelector('.modal-layer')) setTimeout(goRest, 1000);
        else ctx.go('rest');
      };
      goRest();
      return;
    }
    // A screen of a story effect. ctx.open() returns false when the village scene closes (for
    // example for Văn Miếu).
    ctx.open(ev.cmd, { village: api }).then((stay) => {
      if (stay && alive) send({ type: 'closed' });
    });
  }

  // Input ------------------------------------------------------------------

  const keys = new Set();
  const stick = { active: false, id: null, x: 0, y: 0, kx: 0, ky: 0, show: matchMedia('(pointer: coarse)').matches };
  let hold = null; // { id, vx, vy, since, held }
  const pointers = new Map();
  let pinch = null;
  let size = { width: 1, height: 1 };

  // A dialogue, a panel, or a trigger zone stops the hero: drop the input that is held.
  function dropInput() {
    raidView.cancel();
    hold = null;
    stick.active = false;
    keys.clear();
  }

  const local = (e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const stickHome = () => ({ x: 24 + STICK_R, y: size.height - 24 - STICK_R });
  const inStickZone = (p) => p.x < Math.min(280, size.width * 0.4) && p.y > size.height * 0.45;

  function onDown(e) {
    if (busy || !alive) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // A pointer that the browser does not know (for example from a test) has no capture.
    }
    if (pointers.size === 2) {
      // Two fingers: a pinch changes the zoom. Stop the other controls.
      const [a, c] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - c.x, a.y - c.y) };
      hold = null;
      stick.active = false;
      return;
    }
    if (e.pointerType !== 'mouse') stick.show = true;
    // In a raid: a finger on the hero pulls the slingshot; a finger on a source drags an element.
    if (raidView.down(p, e.pointerId)) return;
    if (e.pointerType !== 'mouse' && inStickZone(p)) {
      Object.assign(stick, { active: true, id: e.pointerId, x: p.x, y: p.y, kx: 0, ky: 0, since: performance.now(), far: 0 });
      return;
    }
    // A thing under the finger (a plank, a rod, the stem) wins over Nghé beside it.
    hold = { id: e.pointerId, vx: p.x, vy: p.y, sx: p.x, sy: p.y, since: performance.now(), held: false, friend: thingAt(p) || guessAt(p) ? null : friendAt(p) };
  }

  // Nghé (or the hero on the back of Nghé) under a screen point: a tap pets, a hold rides.
  function friendAt(p) {
    const friend = query(state, 'follow')[0];
    if (!friend) return null;
    for (const id of [friend.id, ...(hero().riding ? ['hero'] : [])]) {
      const f = figures.placeOf(id);
      if (!f) continue;
      const b = view.screenBox({ x0: f.x - 0.8, x1: f.x + 0.8, y0: f.y, y1: f.y + f.height + 0.2, z0: f.z - 0.8, z1: f.z + 0.8 });
      if (p.x >= b.x0 - 8 && p.x <= b.x1 + 8 && p.y >= b.y0 - 8 && p.y <= b.y1 + 8) return friend.id;
    }
    return null;
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pinch && pointers.size === 2) {
      const [a, c] = [...pointers.values()];
      const d = Math.hypot(a.x - c.x, a.y - c.y);
      if (d / pinch.d < 0.75) { view.setZoom(1); pinch.d = d; }
      if (d / pinch.d > 1.33) { view.setZoom(0); pinch.d = d; }
      return;
    }
    if (raidView.move(p, e.pointerId)) return;
    if (stick.active && stick.id === e.pointerId) {
      let kx = p.x - stick.x;
      let ky = p.y - stick.y;
      const len = Math.hypot(kx, ky);
      if (len > STICK_R) { kx *= STICK_R / len; ky *= STICK_R / len; }
      stick.kx = kx;
      stick.ky = ky;
      stick.far = Math.max(stick.far, Math.hypot(kx, ky));
      return;
    }
    if (hold && hold.id === e.pointerId) {
      hold.vx = p.x;
      hold.vy = p.y;
      if (!hold.held && Math.hypot(p.x - hold.sx, p.y - hold.sy) > 14) startHold();
    }
  }

  function onUp(e) {
    const p = local(e);
    pointers.delete(e.pointerId);
    if (pinch) {
      if (pointers.size === 0) pinch = null;
      hold = null;
      return;
    }
    if (raidView.up(p, e.pointerId)) return;
    if (stick.active && stick.id === e.pointerId) {
      stick.active = false;
      stick.kx = 0;
      stick.ky = 0;
      // A short tap with no push in the stick area is a tap on the world there.
      if (e.type === 'pointerup' && !busy && stick.far < 12 && performance.now() - stick.since < HOLD_MS) onTap(p);
      return;
    }
    if (hold && hold.id === e.pointerId) {
      const wasHeld = hold.held;
      const friend = hold.friend;
      hold = null;
      if (wasHeld || e.type !== 'pointerup' || busy) return;
      if (friend) {
        ctx.bus.emit('sound', 'tap');
        send({ type: 'pet', id: friend });
      } else onTap(p);
    }
  }

  function startHold() {
    hold.held = true;
    // A hold on Nghé: get on its back, or get off.
    if (hold.friend) {
      send({ type: 'ride', mount: hold.friend });
      hold.friend = null;
      hold.done = true;
    }
  }

  function onWheel(e) {
    e.preventDefault();
    view.setZoom(e.deltaY > 0 ? 1 : 0);
  }

  function onKey(e) {
    if (!KEYS.has(e.code)) return;
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
    if (e.type === 'keydown') {
      if (busy) return;
      if (e.code === 'KeyQ' || e.code === 'KeyE') {
        if (!e.repeat) view.turn(e.code === 'KeyQ' ? -1 : 1);
        e.preventDefault();
        return;
      }
      if (e.code === 'Space') {
        if (!e.repeat) send({ type: 'hands' });
        e.preventDefault();
        return;
      }
      keys.add(e.code);
      e.preventDefault();
    } else {
      keys.delete(e.code);
    }
  }

  // The person or enemy under a screen point: the nearest one to the camera.
  function personAt(p) {
    let best = null;
    for (const q of persons()) {
      const f = figures.placeOf(q.entity);
      if (!f) continue;
      const b = view.screenBox({ x0: f.x - 0.7, x1: f.x + 0.7, y0: f.y, y1: f.y + f.height + 0.2, z0: f.z - 0.7, z1: f.z + 0.7 });
      const pad = 10;
      if (p.x < b.x0 - pad || p.x > b.x1 + pad || p.y < b.y0 - pad || p.y > b.y1 + pad) continue;
      const near = view.nearness(f.x, f.y, f.z);
      if (!best || near > best.near) best = { q, near };
    }
    return best?.q ?? null;
  }

  const showTap = (x, y, hh) => {
    tapFx = { x, y, h: hh, age: 0 };
  };

  // The plank under a screen point: the nearest one to the camera.
  function thingAt(p) {
    let best = null;
    for (const e of query(state, 'item', 'position')) {
      // A thing that is set does not move, but a fixed thing of a trial (a stem, the iron, the
      // straw rope) answers a tap.
      if (e.hidden || (e.item.set && !e.item.fixed)) continue;
      const q = e.position;
      const end = { x: q.x + Math.sin(q.facing ?? 0) * e.item.size, z: q.z + Math.cos(q.facing ?? 0) * e.item.size };
      const b = view.screenBox({
        x0: Math.min(q.x, end.x) / 2 - 0.5, x1: Math.max(q.x, end.x) / 2 + 0.5,
        y0: q.y / 2, y1: q.y / 2 + 0.5,
        z0: Math.min(q.z, end.z) / 2 - 0.5, z1: Math.max(q.z, end.z) / 2 + 0.5,
      });
      const pad = 6;
      if (p.x < b.x0 - pad || p.x > b.x1 + pad || p.y < b.y0 - pad || p.y > b.y1 + pad) continue;
      // The plank whose middle line on the screen is nearest to the finger.
      const a = view.project(q.x / 2, q.y / 2 + 0.4, q.z / 2);
      const c = view.project(end.x / 2, q.y / 2 + 0.4, end.z / 2);
      const dx = c.x - a.x;
      const dy = c.y - a.y;
      const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(p.x - (a.x + dx * k), p.y - (a.y + dy * k));
      if (!best || d < best.d) best = { e, d, along: Math.round(k * e.item.size) };
    }
    return best ? { ...best.e, along: best.along } : null;
  }
  // The plank outline of the prediction under a screen point (the row lies on the bank).
  function guessAt(p) {
    let best = null;
    for (const g of query(state, 'guess', 'position')) {
      if (g.guess.left !== undefined) continue;
      const q = g.position;
      const b = view.screenBox({ x0: q.x / 2 - 0.6, x1: q.x / 2 + 0.6, y0: q.y / 2, y1: q.y / 2 + 0.3, z0: q.z / 2, z1: q.z / 2 + 2 });
      if (p.x < b.x0 - 4 || p.x > b.x1 + 4 || p.y < b.y0 - 4 || p.y > b.y1 + 4) continue;
      // The outlines stand close together: the one whose middle is nearest to the finger.
      const c = view.project(q.x / 2, q.y / 2 + 0.1, q.z / 2 + 1);
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (!best || d < best.d) best = { g, d };
    }
    return best?.g ?? null;
  }
  // Is the hero under a screen point? (A tap on the hero puts the plank down.)
  function heroUnder(p) {
    const f = figures.placeOf('hero');
    if (!f) return false;
    const b = view.screenBox({ x0: f.x - 0.6, x1: f.x + 0.6, y0: f.y, y1: f.y + f.height, z0: f.z - 0.6, z1: f.z + 0.6 });
    return p.x >= b.x0 - 4 && p.x <= b.x1 + 4 && p.y >= b.y0 - 4 && p.y <= b.y1 + 4;
  }

  // What is under a screen point, as the target of a tap for the session: the hero (with a plank
  // in the hands), a plank outline, a plank, a person, or a point on the ground or a thing.
  function targetUnder(p) {
    if (session.holding() && heroUnder(p)) return { hero: true };
    const ghost = guessAt(p);
    if (ghost) return { guess: { zone: ghost.guess.zone, n: ghost.guess.n } };
    const raidTap = raidView.targetAt(p);
    if (raidTap) return raidTap;
    const plank = thingAt(p);
    if (plank) return plank.item.fixed ? { thing: plank.id, along: plank.along } : { thing: plank.id };
    const person = personAt(p);
    if (person) return { person: person.entity };
    const hit = view.pick(p.x, p.y, { things: true });
    if (!hit) return null;
    const thing = hit.who ? terrain.objects.find((o) => o.who === hit.who) : null;
    return { ground: { x: hit.x, y: hit.y, h: hit.h, thing: Boolean(hit.who), object: thing?.id ?? null } };
  }

  function onTap(p) {
    const target = targetUnder(p);
    if (target) send({ type: 'tap', target });
    else ctx.bus.emit('sound', 'tap');
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  // The input of this frame as a command for the world: a map direction from the stick, the
  // keys, or a held finger. A tap walk goes in as a "walk" command (in the session).
  let moving = false;
  function sendInput() {
    if (busy || leaving) return;
    const toMap = (s) => {
      if (!s.dx && !s.dy) return null;
      const m = screenToMap(s.dx, s.dy, view.angle);
      return { dx: m.x, dz: m.y, strength: s.strength ?? 1, run: Boolean(s.run) };
    };
    let dir = null;
    if (stick.active) dir = toMap(stickToScreenDir(stick.kx, stick.ky, STICK_R));
    else if (keys.size) dir = toMap(keysToScreenDir(keys));
    else {
      if (hold && !hold.held && performance.now() - hold.since > HOLD_MS) startHold();
      const m = hold?.held && !hold.done ? view.pick(hold.vx, hold.vy) : null;
      if (m) {
        const c = heroCell();
        const i = inputToward(c, m, { run: Math.hypot(m.x - c.x, m.y - c.y) > 6, stop: 0.3 });
        dir = i.strength ? { dx: i.dx, dz: i.dy, strength: i.strength, run: i.run } : null;
      }
    }
    if (dir) {
      if (!moving) ctx.log('action', { kind: 'walk' });
      session.command({ type: 'move', ...dir });
      moving = true;
    } else if (moving) {
      // The stick, the keys, or the finger stopped: the hero stops too.
      session.command({ type: 'move', dx: 0, dz: 0, strength: 0 });
      moving = false;
    }
  }

  // The frame loop -------------------------------------------------------------

  let last = performance.now();
  let time = 0;
  let acc = 0;
  // With ?fps in the address, a small box shows the frames each second and the size of a frame,
  // for tests of the speed on real devices.
  const meter = new URLSearchParams(location.search).has('fps') ? h('div', { class: 'fps-meter' }) : null;
  if (meter) ctx.ui.append(meter);
  let frames = 0;
  let since = last;
  // With ?debug=1 in the address, a small panel shows the skill events of the placements.
  const debugPanel = new URLSearchParams(location.search).get('debug') === '1' ? h('div', { class: 'debug-events' }) : null;
  const skillLog = [];
  function logSkill(ev) {
    if (!debugPanel) return;
    const flags = [ev.solved ? 'solved' : 'not solved', ev.efficient ? 'efficient' : null, ev.first ? 'first' : null, ev.mashing ? 'mashing: no evidence' : null].filter(Boolean);
    skillLog.unshift(`${ev.skill} · L${ev.level} · ${flags.join(', ')} · ${ev.parts.join(' ')} / ${ev.target}`);
    skillLog.length = Math.min(skillLog.length, 8);
    debugPanel.replaceChildren(h('b', { text: 'skill events' }), ...skillLog.map((line) => h('div', { text: line })));
  }
  if (debugPanel) {
    ctx.ui.append(debugPanel);
    debugPanel.replaceChildren(h('b', { text: 'skill events' }));
  }
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    sendInput();
    // The world moves in fixed steps; the drawing is smooth between two steps. A story of the
    // storybook can play faster (&speed=4).
    acc += dt * (book?.speed ?? 1);
    // The finger of the storybook moves to a tap: the world waits for it.
    if (book?.hold) acc = 0;
    while (acc >= STEP && alive && !leaving) {
      session.step();
      figures.sync(state);
      flush();
      acc -= STEP;
    }
    draw(dt, acc / STEP);
    frames += 1;
    // The sound of the place changes with the light and the rain.
    if (frames % 30 === 0) {
      const sk = state.sky ?? { night: 0, rain: 0 };
      ctx.bus.emit('ambience', busy ? null : { day: 1 - sk.night, night: sk.night, rain: sk.rain });
    }
    if (meter && now - since > 1000) {
      const s = view.stats();
      meter.textContent = `${Math.round((frames * 1000) / (now - since))} fps · ${s.calls} calls · ${Math.round(s.triangles / 1000)}k triangles`;
      frames = 0;
      since = now;
    }
    requestAnimationFrame(frame);
  }

  // The hero walked into an exit, and the session is on the next map now: the screen goes dark,
  // and the scene of the next map opens with the same session.
  function goThrough() {
    leaving = true;
    dropInput();
    fade.classList.add('on');
    setTimeout(() => {
      if (alive) ctx.go('village', { session, facing: hero().position.facing, arrive: true });
    }, 260);
  }

  // A coin that an enemy took at the gate: it flies from its counter in the HUD to the enemy.
  function flyFromCounter(toId, item, delay) {
    const f = figures.placeOf(toId);
    const counter = counts.querySelector(`[data-item="${item}"] .count-icon`);
    updateHud();
    if (!f || !counter || !data.items.items[item]) return;
    const box = counter.getBoundingClientRect();
    const base = canvas.getBoundingClientRect();
    const start = { x: box.left + box.width / 2 - base.left, y: box.top + box.height / 2 - base.top };
    const el = img(data.items.items[item].art, 'flying-item');
    marks.append(el);
    const t0 = performance.now() + delay * 1000;
    const tick = (now) => {
      const end = view.project(f.x, f.y + f.height, f.z);
      const k = Math.max(0, Math.min(1, (now - t0) / 700));
      const e = k * k * (3 - 2 * k);
      el.style.transform = `translate(${start.x + (end.x - start.x) * e}px, ${start.y + (end.y - start.y) * e - Math.sin(k * Math.PI) * 60}px) translate(-50%, -50%) scale(${1 - k * 0.4})`;
      if (k < 1 && alive) requestAnimationFrame(tick);
      else el.remove();
    };
    requestAnimationFrame(tick);
  }

  // Greetings over the heads of the people, and the coins of broken pots.
  const bubbles = [];
  function showBubble(id, text) {
    const el = h('div', { class: 'world-bubble', text });
    marks.append(el);
    bubbles.push({ id, el, age: 0 });
  }
  // A thing (a coin) flies in an arc from an entity to its counter in the HUD. The counter ticks
  // up when it lands.
  function flyToCounter(fromId, item, delay) {
    // A figure that is new in this step (a plank that became deck) has no drawn place yet: use
    // the place of its entity.
    const q = getEntity(state, fromId)?.position;
    const f = figures.placeOf(fromId) ?? (q ? { x: q.x / 2, y: q.y / 2, z: q.z / 2 } : null);
    const counter = counts.querySelector(`[data-item="${item}"]`);
    if (!f || !counter || !data.items.items[item]) {
      updateHud();
      return;
    }
    flying[item] = (flying[item] ?? 0) + 1;
    updateHud();
    const start = view.project(f.x, f.y + 1.2, f.z);
    const el = img(data.items.items[item].art, 'flying-item');
    marks.append(el);
    const t0 = performance.now() + delay * 1000;
    const tick = (now) => {
      const box = counts.querySelector(`[data-item="${item}"] .count-icon`)?.getBoundingClientRect();
      const base = canvas.getBoundingClientRect();
      const end = box ? { x: box.left + box.width / 2 - base.left, y: box.top + box.height / 2 - base.top } : { x: start.x, y: 0 };
      const k = Math.max(0, Math.min(1, (now - t0) / 700));
      const e = k * k * (3 - 2 * k);
      const x = start.x + (end.x - start.x) * e;
      const y = start.y + (end.y - start.y) * e - Math.sin(k * Math.PI) * 80;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1 - k * 0.3})`;
      if (k < 1 && alive) {
        requestAnimationFrame(tick);
        return;
      }
      el.remove();
      flying[item] = Math.max(0, (flying[item] ?? 1) - 1);
      if (!alive) return;
      updateHud();
      ctx.bus.emit('sound', 'pickup');
      const c = counts.querySelector(`[data-item="${item}"]`);
      c?.classList.add('tick');
      setTimeout(() => c?.classList.remove('tick'), 300);
    };
    requestAnimationFrame(tick);
  }

  // The events of the session and of the world: the screens, the sounds, the HUD, and the
  // bursts of the world.
  function flush() {
    for (const ev of session.events()) {
      if (leaving) return;
      handle(ev);
    }
  }
  function handle(ev) {
    switch (ev.type) {
      case 'open': openScreen(ev); return;
      case 'close':
        if (ev.screen === 'dialogue' || ev.screen === 'say') {
          box?.close();
          box = null;
        } else {
          bookScreen?.remove();
          bookScreen = null;
        }
        return;
      case 'busy':
        busy = ev.on;
        if (busy) dropInput();
        return;
      case 'halt': dropInput(); return;
      case 'hud': updateHud(); return;
      case 'sound': ctx.bus.emit('sound', ev.sound); return;
      case 'tapfx': showTap(ev.x, ev.y, ev.h); return;
      case 'gift':
        for (const [item, n] of Object.entries(ev.give)) {
          for (let i = 0; i < n; i++) flyToCounter(ev.from, item, ev.delay + i * 0.15);
        }
        return;
      case 'map': goThrough(); return;
      case 'raid':
        ctx.bus.emit('raid', ev.on);
        raidView.event(ev);
        return;
      case 'lose':
        for (const [item, n] of Object.entries(ev.take)) for (let i = 0; i < n; i++) flyFromCounter(ev.to, item, i * 0.15);
        return;
      default: worldEvent(ev);
    }
  }
  // What the world did in a step: sounds, hearts, splashes, and dust.
  function worldEvent(ev) {
    if (ev.id === 'sky') {
      // The drum of the đình at dawn, and the lanterns at dusk.
      ctx.bus.emit('sound', ev.type === 'dawn' ? 'drum' : 'lantern');
      return;
    }
    if (ev.sound) ctx.bus.emit('sound', ev.sound);
    if (ev.type === 'petted') showBubble(ev.id, '♥');
    raidView.event(ev);
    // A raid: dust where a stone lands, a trap snaps, or Gióng strikes; water and lightning splash.
    if (ev.type === 'land' || ev.type === 'water' || ev.type === 'shock' || ev.type === 'spark' || ev.type === 'flame') {
      const q = ev.at;
      if (q) figures.burst(q.x / 2, session.env.groundY(q.x / 2, q.z / 2) / 2 + 0.2, q.z / 2, ev.type === 'water' || ev.type === 'shock' ? 'splash' : 'dust', ev.type === 'land' ? 5 : 12);
    }
    if (ev.type === 'snap' || ev.type === 'strike' || ev.type === 'butt') {
      const f = figures.placeOf(ev.type === 'snap' ? ev.trap : ev.id);
      if (f) figures.burst(f.x, f.y + 0.3, f.z, 'dust', 10);
    }
    // A plank falls into the river: a splash. The bridge takes solid form: dust along the deck.
    if (ev.type === 'float' || ev.type === 'crack') {
      const q = ev.at ?? getEntity(state, ev.id)?.position;
      if (q) figures.burst(q.x / 2, 1.6, q.z / 2, 'splash', 12);
    }
    if (ev.type === 'solid') {
      const z = getEntity(state, ev.id)?.zone;
      if (z) for (let k = z.from; k < z.from + z.gap; k += 2) figures.burst(z.cx / 2, z.deckY / 2, k / 2, 'dust', 4);
    }
    // A commit at a placement: the child never sees the skill event; with ?debug=1 in the
    // address, a small panel shows it.
    if (ev.type === 'skill') logSkill(ev);
    if (ev.id === 'hero' && ev.type === 'splash') {
      const q = hero().position;
      figures.burst(q.x / 2, q.y / 2 + 0.6, q.z / 2, 'splash', 18);
    }
    if (ev.id === 'hero' && ev.type === 'placed') view.jump(hero().position.x / 2, hero().position.y / 2 + 1.5, hero().position.z / 2);
  }

  // The marks on the world: quest stars over the targets, arrows at the edge for targets out of
  // view, the ring of a tap, and the stick.
  const starPool = [];
  const arrowPool = [];
  function pooled(pool, make) {
    return (i) => {
      if (!pool[i]) {
        pool[i] = make();
        marks.append(pool[i]);
      }
      pool[i].hidden = false;
      return pool[i];
    };
  }
  const starAt = pooled(starPool, () => img('ui/star', 'world-star'));
  const arrowAt = pooled(arrowPool, () => h('div', { class: 'edge-arrow' }, [img('ui/star', 'edge-star')]));
  function drawMarks() {
    const hudRect = hud.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const inset = { top: Math.max(0, hudRect.bottom - canvasRect.top) + 8, right: 12, bottom: 12, left: 12 };
    const screen = { x: 0, y: 0, w: size.width, h: size.height };
    let stars = 0;
    let arrows = 0;
    const edges = [];
    const bob = Math.sin(time * 4) * 4;
    for (const m of busy ? [] : markers()) {
      const p = view.project(m.x, m.h, m.y);
      const edge = edgeMarker(screen, p, inset);
      if (!edge) {
        const el = starAt(stars++);
        el.style.transform = `translate(${p.x - 15}px, ${p.y - 30 + bob}px)`;
        continue;
      }
      // Targets in about the same direction share one arrow.
      if (edges.some((q) => Math.hypot(q.x - edge.x, q.y - edge.y) < 56)) continue;
      edges.push(edge);
      const el = arrowAt(arrows++);
      const pulse = Math.sin(time * 5) * 3;
      el.style.transform = `translate(${edge.x}px, ${edge.y}px) rotate(${edge.angle}rad) translate(${-22 + pulse}px, 0)`;
      el.firstChild.style.transform = `rotate(${-edge.angle}rad)`;
    }
    for (let i = stars; i < starPool.length; i++) starPool[i].hidden = true;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.age += 1 / 60;
      const f = figures.placeOf(b.id);
      if (!f || b.age > 2.2) {
        b.el.remove();
        bubbles.splice(i, 1);
        continue;
      }
      const q = view.project(f.x, f.y + f.height + 0.4, f.z);
      b.el.style.transform = `translate(${q.x}px, ${q.y - b.age * 10}px) translate(-50%, -100%)`;
      b.el.style.opacity = String(Math.min(1, (2.2 - b.age) * 2));
    }
    for (let i = arrows; i < arrowPool.length; i++) arrowPool[i].hidden = true;
    if (tapFx && tapFx.age < 0.6) {
      const p = view.project(tapFx.x, tapFx.h + 0.05, tapFx.y);
      ring.hidden = false;
      const k = 0.6 + tapFx.age * 1.2;
      ring.style.transform = `translate(${p.x}px, ${p.y}px) scale(${k}, ${k * 0.5})`;
      ring.style.opacity = String(1 - tapFx.age / 0.6);
    } else {
      ring.hidden = true;
    }
    const s = stick.show && !busy ? (stick.active ? stick : { ...stickHome(), kx: 0, ky: 0 }) : null;
    stickEl.hidden = !s;
    if (s) {
      stickEl.classList.toggle('on', stick.active);
      stickEl.style.transform = `translate(${s.x - STICK_R}px, ${s.y - STICK_R}px)`;
      stickEl.firstChild.style.transform = `translate(${s.kx}px, ${s.ky}px)`;
    }
  }

  // The wash of the dusk (multiply), holes of warm light at the lanterns, and the lines of the rain.
  function drawSky() {
    const night = state.sky?.night ?? 0;
    const rain = state.sky?.rain ?? 0;
    const w = size.width;
    const hh = size.height;
    for (const c of [duskLayer, glowLayer]) {
      if (c.width !== w || c.height !== hh) {
        c.width = w;
        c.height = hh;
      }
    }
    dusk.clearRect(0, 0, w, hh);
    glow.clearRect(0, 0, w, hh);
    duskLayer.hidden = night < 0.01 && rain < 0.01;
    glowLayer.hidden = night < 0.05;
    duskTint.style.opacity = String(Math.min(0.5, Math.sqrt(night) * 0.5 + rain * 0.15));
    if (duskLayer.hidden) return;
    // The multiply layer in the indigo of the palette makes the frame darker as the light goes.
    const k = Math.min(1, night * 0.9 + rain * 0.25);
    dusk.globalCompositeOperation = 'source-over';
    dusk.fillStyle = `hsl(${DUSK.hue}, ${DUSK.saturation}%, ${100 - (100 - DUSK.lightness) * k}%)`;
    dusk.fillRect(0, 0, w, hh);
    if (night > 0.05) {
      // Each lit lantern: a hole in the wash (lighter), and a warm pool on the glow layer.
      dusk.globalCompositeOperation = 'lighter';
      const lights = state.entities.filter((e) => e.look === 'lantern-lit' || e.carry === 'lantern');
      for (const e of lights) {
        const f = figures.placeOf(e.id);
        if (!f) continue;
        const q = view.project(f.x + (e.lantern ? 0.8 : 0), f.y + (e.lantern ? 1 : 0.6), f.z);
        const flicker = e.lantern?.flicker ? 0.7 + Math.abs(Math.sin(time * 40)) * 0.5 : 1;
        const r = (view.state.level ? 70 : 100) * (0.95 + Math.sin(time * 6 + q.x) * 0.05) * flicker;
        const hole = dusk.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
        hole.addColorStop(0, `rgba(160, 140, 110, ${0.8 * night})`);
        hole.addColorStop(1, 'rgba(0, 0, 0, 0)');
        dusk.fillStyle = hole;
        dusk.fillRect(q.x - r, q.y - r, r * 2, r * 2);
        const warm = glow.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 0.8);
        warm.addColorStop(0, `rgba(222, 150, 60, ${0.55 * night * flicker})`);
        warm.addColorStop(0.6, `rgba(170, 100, 40, ${0.25 * night})`);
        warm.addColorStop(1, 'rgba(0, 0, 0, 0)');
        glow.fillStyle = warm;
        glow.fillRect(q.x - r, q.y - r, r * 2, r * 2);
      }
    }
    if (rain > 0.01) {
      // Rain: short slanted lines, in the ink of the print.
      dusk.globalCompositeOperation = 'source-over';
      dusk.strokeStyle = `rgba(47, 70, 104, ${0.75 * rain})`;
      dusk.lineWidth = 2;
      dusk.beginPath();
      for (const d of drops) {
        const x = ((d.x * w + time * 60 * d.s) % (w + 40)) - 20;
        const y = ((d.y * hh + time * 520 * d.s) % (hh + 40)) - 20;
        dusk.moveTo(x, y);
        dusk.lineTo(x - 5, y + 16);
      }
      dusk.stroke();
    }
  }

  function draw(dt, between) {
    if (tapFx) tapFx.age += dt;
    const w = canvas.clientWidth || window.innerWidth;
    const hh = canvas.clientHeight || window.innerHeight;
    if (w !== size.width || hh !== size.height) {
      size = { width: w, height: hh };
      view.resize(w, hh);
    }
    figures.draw(between, dt);
    // The light of the hour: the world dims to a cool dusk (softer at 0.8 so that the night stays readable).
    D.night.value = (state.sky?.night ?? 0) * 0.8;
    view.render(dt, raidView.focus(figures.placeOf('hero')), time, state.sky);
    drawSky();
    raidView.draw(dt, w, hh);
    drawMarks();
  }

  const api = {
    refresh: () => send({ type: 'refresh' }),
    talk: (id) => send({ type: 'talk', dialogue: id }),
    heroTile: () => {
      const c = heroCell();
      return { x: Math.floor(c.x), y: Math.floor(c.y) };
    },
    mapId: () => mapData.id,
    // The session of the village, for the storybook and for automatic tests of the whole game.
    session,
    // Send a command to the session and show its events (the storybook).
    send,
    // The screen point of a map point on the ground (the finger of the storybook).
    pointOf: (x, y) => view.project(x, groundY(x, y) + 0.2, y),
    // The debug panel (with ?debug=1), where the storybook shows the step of a story.
    debugPanel,
    // Open another map, for automatic tests of the whole game.
    goMap: (id, x, y) => ctx.go('village', { map: id, at: { x, y } }),
    // The screen point of the middle of a cell, for automatic tests of the whole game.
    screenOf: (x, y) => view.project(x + 0.5, groundY(x + 0.5, y + 0.5), y + 0.5),
    // The screen point of a person or an enemy, for automatic tests of the whole game.
    screenOfPerson: (id) => {
      const q = persons().find((x) => x.ref === id);
      const f = q ? figures.placeOf(q.entity) : null;
      return f ? view.project(f.x, f.y + f.height * 0.5, f.z) : null;
    },
    // The screen point of the middle of an entity (a plank), for automatic tests.
    screenOfThing: (id) => {
      const e = getEntity(state, id);
      if (!e?.position) return null;
      const m = e.item ? middleOf(e) : e.position;
      return view.project(m.x / 2, e.position.y / 2 + 0.3, m.z / 2);
    },
    // The screen point of the n-th plank outline of the prediction, for automatic tests.
    screenOfGuess: (n) => {
      const g = query(state, 'guess').find((x) => x.guess.n === n);
      return g ? view.project(g.position.x / 2, g.position.y / 2 + 0.1, g.position.z / 2 + 1) : null;
    },
    // The plank under a screen point, for automatic tests.
    thingAt: (x, y) => thingAt({ x, y })?.id ?? null,
    turn: (n) => view.turn(n),
    stats: () => view.stats(),
    // The world state, for automatic tests (read only).
    state: () => state,
  };
  ctx.activeVillage = api;

  updateHud();
  figures.sync(state);
  size = { width: canvas.clientWidth || window.innerWidth, height: canvas.clientHeight || window.innerHeight };
  view.resize(size.width, size.height);
  figures.draw(1, 0);
  const h0 = hero().position;
  view.jump(h0.x / 2, h0.y / 2 + 1.5, h0.z / 2);
  requestAnimationFrame(frame);
  // Show the new language in the top bar after a change in the parent area.
  const offLang = ctx.bus.on('lang', () => {
    heroFace.setAttribute('aria-label', t('ui.home'));
    menuBtn.setAttribute('aria-label', t('ui.menu'));
    mapBtn.setAttribute('aria-label', t('ui.worldmap'));
    turnLeft.setAttribute('aria-label', t('ui.turn.left'));
    turnRight.setAttribute('aria-label', t('ui.turn.right'));
    updateHud();
  });
  // The events of the start (the intro, the talks after a map change).
  queueMicrotask(() => {
    if (alive) flush();
  });

  return {
    unmount() {
      alive = false;
      if (ctx.activeVillage === api) ctx.activeVillage = null;
      box?.close();
      if (!leaving) session.leave();
      if (ctx.syncWorld === session.syncSave) ctx.syncWorld = null;
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      offLang();
      figures.dispose();
      for (const el of [duskTint, duskLayer, glowLayer, paper, raidLayer, marks, hud, turns, fade, banner, meter, debugPanel, bookScreen]) el?.remove();
    },
    api,
  };
}
