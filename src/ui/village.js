// The village scene: the voxel world in three.js, free movement (stick, keys, tap and hold),
// trigger zones, people, encounters, the quest goal, and the HUD.
import { createTileMap, findPath, pathNextTo } from '../core/tilemap.js';
import { createTriggers } from '../core/triggers.js';
import { currentGoal } from '../core/quests.js';
import { pickTalk, isPresent, applyEffects, conditionState } from '../core/game.js';
import { edgeMarker } from '../core/hit.js';
import { heroLayers } from '../render/assets.js';
import { stepBody, moveCircle, worldFor, keysToScreenDir, stickToScreenDir, screenToMap, inputToward, createFollower, stepFollower, faceOf, MOVE } from '../world/movement.js';
import { buildTerrain, columnTop, WATER } from '../world/terrain.js';
import { figureOf, heroLook } from '../world/figures.js';
import { createAnimator, animate } from '../world/animate.js';
import { createClock, advance } from '../world/clock.js';
import { h, img, button } from './dom.js';
import { t, tn } from './i18n.js';
import { speak } from './speak.js';
import { runDialogue, say } from './dialogue.js';

const STICK_R = 56; // the radius of the virtual stick, in screen pixels
const HOLD_MS = 220; // a press this long is a hold (walk toward the finger), not a tap
const PERSON_R = 0.9; // the hero keeps this distance (in cells) from people
const LOOK_R = 4; // people turn to the hero when the hero is this near (in cells)
const KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyE']);

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

export async function mountVillage(ctx, params = {}) {
  const { data, profile } = ctx;
  const worldMap = data.world;
  const savedMap = worldMap.map(profile.place?.map) ? profile.place.map : null;
  const mapData = worldMap.map(params.map ?? savedMap ?? worldMap.start.map);
  const tileTypes = data.tiles.types;
  const tileMap = createTileMap(mapData, tileTypes);
  const triggers = createTriggers(mapData.layers.triggers);
  const canvas = ctx.voxel;
  ctx.surface.canvas.hidden = true;

  let D;
  try {
    D = await loadDrawing();
  } catch (e) {
    console.error('The drawing code did not load', e);
    return noWorld(ctx);
  }
  if (!D.hasWebGL()) return noWorld(ctx);
  canvas.hidden = false;

  if (!terrains.has(mapData.id)) terrains.set(mapData.id, buildTerrain(mapData, tileTypes, tileMap));
  const terrain = terrains.get(mapData.id);
  if (!worlds.has(mapData.id)) worlds.set(mapData.id, D.createVoxelWorld(canvas, terrain));
  const world = worlds.get(mapData.id);
  const looks = data.figures.figures;

  // The height of the ground under a map point (world units).
  const groundY = (x, y) => columnTop(tileMap.heightAt(Math.floor(x), Math.floor(y)));

  // Figures: the hero, the friend, the people, the enemies, and the ducks.
  const figures = [];
  function addFigure(look, at) {
    const f = D.buildFigure(figureOf(look));
    f.anim = createAnimator(f.figure.kind);
    f.at = at;
    f.y = at.float ? at.float : groundY(at.x, at.y);
    world.scene.add(f.root);
    figures.push(f);
    return f;
  }
  function removeFigure(f) {
    world.scene.remove(f.root);
    D.disposeFigure(f);
    figures.splice(figures.indexOf(f), 1);
  }

  const saved = profile.place?.map === mapData.id && profile.place.x !== null ? profile.place : null;
  const start = freeSpot(tileMap, params.at ?? saved ?? mapData.spawn) ?? mapData.spawn;
  const hero = { x: start.x, y: start.y, vx: 0, vy: 0, facing: params.facing ?? 0, moving: false, speed: 0 };
  const heroFig = addFigure(heroLook(profile.hero), hero);
  let nghe = createFollower(hero.x - 1.6, hero.y + 0.6);
  let friendFig = null;
  let heroTile = { x: Math.floor(hero.x), y: Math.floor(hero.y) };
  let route = null; // a walk to a tapped point: { points, onArrive, near }
  let tapFx = null;
  let busy = false; // true while a dialogue or a panel is open
  let alive = true;
  let still = 0; // how long the hero has not moved on a route
  let leaving = false; // true after the hero walks into an exit
  let talkingTo = null; // the person in a dialogue turns to the hero
  // The game clock, and the state of this map in the save.
  profile.clock ??= createClock();
  profile.maps ??= {};
  const visit = (profile.maps[mapData.id] ??= { first: Math.round(profile.clock.minutes), things: {} });
  visit.last = Math.round(profile.clock.minutes);

  // Ducks on the water: each one swims in a small circle around its point.
  for (const d of mapData.layers.decor) {
    if (!d.figure || !looks[d.figure]) continue;
    const at = { x: d.x, y: d.y, float: columnTop(tileMap.heightAt(Math.floor(d.x), Math.floor(d.y))) + WATER.river - 0.05 };
    const f = addFigure(looks[d.figure], at);
    f.swim = { cx: d.x, cy: d.y, r: 0.6 + (d.x % 1) * 0.6, a: d.y * 3, dir: d.flip ? -1 : 1 };
  }

  // People and encounters. They block their cells for the paths of taps.
  let people = [];
  let encounters = [];
  const shown = new Map(); // id -> figure
  function refreshPeople() {
    tileMap.clearOccupied();
    people = mapData.npcs
      .filter((n) => data.npcs.npcs[n.id] && isPresent(data.npcs.npcs[n.id], profile))
      .map((n) => ({ ...n, def: data.npcs.npcs[n.id], kind: 'npc' }));
    encounters = mapData.encounters.filter((e) => isPresent(e, profile)).map((e) => ({ ...e, kind: 'encounter' }));
    const want = new Set();
    for (const p of [...people, ...encounters]) {
      tileMap.occupy(Math.floor(p.x), Math.floor(p.y), { kind: p.kind, id: p.id });
      const key = `${p.kind}:${p.id}`;
      want.add(key);
      if (!shown.has(key)) {
        const look = looks[p.kind === 'npc' ? p.id : p.figure] ?? looks.villager ?? {};
        const f = addFigure(look, p);
        f.person = p;
        f.facing = faceOf(hero.x - p.x, hero.y - p.y);
        shown.set(key, f);
      } else {
        shown.get(key).person = p;
      }
    }
    for (const [key, f] of shown) {
      if (want.has(key)) continue;
      removeFigure(f);
      shown.delete(key);
    }
    // The friend walks behind the hero.
    const friendId = profile.party[0];
    if (friendFig && friendFig.id !== friendId) {
      removeFigure(friendFig);
      friendFig = null;
    }
    if (friendId && !friendFig && looks[friendId]) {
      friendFig = addFigure(looks[friendId], nghe);
      friendFig.id = friendId;
    }
    updateHud();
  }

  function placeHero(x, y) {
    Object.assign(hero, { x, y, vx: 0, vy: 0, moving: false, speed: 0 });
    heroTile = { x: Math.floor(x), y: Math.floor(y) };
    route = null;
    nghe = createFollower(x - 1.6, y + 0.6);
    if (friendFig) friendFig.at = nghe;
    heroFig.y = groundY(x, y);
    world.jump(x, heroFig.y + 1.5, y);
  }

  // HUD
  const hud = h('div', { class: 'hud' });
  const goalBtn = h('button', { class: 'goal', type: 'button' });
  const counts = h('div', { class: 'counts' });
  const heroFace = h('button', { class: 'hud-hero', type: 'button', 'aria-label': t('ui.home') }, [
    h('span', { class: 'mini-portrait' }, heroLayers(profile.hero).map((p) => img(p, 'layer'))),
    h('span', { class: 'hud-name', text: profile.hero.name }),
  ]);
  heroFace.addEventListener('click', () => walkToPerson('grandma'));
  const menuBtn = button(null, () => ctx.openMenu(), { cls: 'icon-btn', icon: 'ui/menu', aria: t('ui.menu') });
  // The country map. The world waits while it is open.
  const mapBtn = button(null, () => {
    if (!busy && !leaving) handleCommands([{ open: 'worldmap' }]);
  }, { cls: 'icon-btn map-btn', icon: 'ui/map', aria: t('ui.worldmap') });
  hud.append(heroFace, goalBtn, counts, mapBtn, menuBtn);
  // Buttons that turn the view in steps of 90°.
  const turnLeft = h('button', { class: 'turn-btn', type: 'button', 'aria-label': t('ui.turn.left'), title: t('ui.turn.left'), text: '⟲' });
  const turnRight = h('button', { class: 'turn-btn', type: 'button', 'aria-label': t('ui.turn.right'), title: t('ui.turn.right'), text: '⟳' });
  turnLeft.addEventListener('click', () => world.turn(-1));
  turnRight.addEventListener('click', () => world.turn(1));
  const turns = h('div', { class: 'turns' }, [turnLeft, turnRight]);
  // The paper of the print over the world: grain and a soft vignette.
  const paper = h('div', { class: 'world-paper' });
  // The layer of the marks on the world: the quest stars, the arrows at the edge, the tap ring.
  const marks = h('div', { class: 'world-marks' });
  const ring = h('div', { class: 'tap-ring', hidden: true });
  const stickEl = h('div', { class: 'stick', hidden: true }, [h('div', { class: 'stick-knob' })]);
  marks.append(ring, stickEl);
  // A dark layer for the change of map, and the name of the new map.
  const fade = h('div', { class: params.arrive ? 'map-fade on' : 'map-fade' });
  const banner = params.arrive ? h('div', { class: 'map-name', text: t(mapData.nameKey) }) : null;
  ctx.ui.append(paper, marks, hud, turns, fade, ...(banner ? [banner] : []));
  if (params.arrive) {
    requestAnimationFrame(() => requestAnimationFrame(() => fade.classList.remove('on')));
    setTimeout(() => banner?.remove(), 2600);
  }

  let goalKey = null;
  let goalParams = {};
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
    counts.replaceChildren(...data.items.hud.map((item) => h('span', { class: 'count' }, [
      img(data.items.items[item].art, 'count-icon'),
      h('span', { text: String(profile.inventory[item] ?? 0) }),
    ])));
  }
  goalBtn.addEventListener('click', () => speak(goalKey, goalParams, { force: true }));

  // The top of a figure or a thing, for its quest star (world units).
  const figureTop = (key) => {
    const f = shown.get(key);
    return f ? f.y + f.height + 0.6 : null;
  };
  const objectOf = (id) => terrain.objects.find((o) => o.id === id);

  // The quest markers: world points { x, y (map), h (height) }.
  function markers() {
    const goal = currentGoal(data.quests.quests, conditionState(profile));
    if (!goal) return [];
    const step = goal.step;
    const out = [];
    const flags = profile.flags;
    const list = step.targets ?? (step.target ? [{ npc: step.target }] : []);
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
      if (tg.npc) {
        const p = people.find((x) => x.id === tg.npc);
        if (p) out.push({ x: p.x, y: p.y, h: figureTop(`npc:${p.id}`) });
      }
      if (tg.encounter) {
        const e = encounters.find((x) => x.id === tg.encounter);
        if (e) out.push({ x: e.x, y: e.y, h: figureTop(`encounter:${e.id}`) });
      }
      if (tg.object) {
        const o = mapData.layers.objects.find((x) => x.id === tg.object);
        const thing = objectOf(tg.object);
        if (o) out.push({ x: o.x + o.w / 2, y: o.y + o.h / 2, h: (thing ? terrain.boxOf(thing).y1 : groundY(o.x, o.y) + 2) + 0.8 });
      }
    }
    if (step.place && (step.place.map ?? mapData.id) === mapData.id) out.push({ x: step.place.x + 1, y: step.place.y + 0.5, h: groundY(step.place.x, step.place.y) + 3 });
    else if (step.place) markExit(step.place.map);
    return out;
  }

  // Walks to a point or a person, on a path of cells around houses and water.
  function walkPath(path, end, onArrive, near = null) {
    if (!path) return;
    const points = path.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
    if (end) points.push(end);
    route = { points, onArrive, near };
    still = 0;
    if (!points.length) arrive();
  }

  function arrive() {
    const fn = route?.onArrive;
    route = null;
    fn?.();
  }

  function walkToThing(target, onArrive) {
    const from = { x: Math.floor(hero.x), y: Math.floor(hero.y) };
    const tile = { x: Math.floor(target.x), y: Math.floor(target.y) };
    walkPath(pathNextTo(tileMap, from, tile), null, onArrive, { x: target.x, y: target.y, d: 2.2 });
  }

  function walkToPerson(id) {
    const p = people.find((x) => x.id === id);
    if (!p || busy) return;
    walkToThing(p, () => interact({ kind: 'npc', id }, p));
  }

  async function withBusy(fn) {
    busy = true;
    route = null;
    hold = null;
    stick.active = false;
    keys.clear();
    try {
      return await fn();
    } finally {
      busy = false;
      talkingTo = null;
      if (alive) refreshPeople();
    }
  }

  async function talk(dialogueId) {
    if (!dialogueId) return;
    const commands = await withBusy(() => runDialogue(ctx, dialogueId));
    await handleCommands(commands);
  }

  const place = () => ({ map: mapData.id, x: Math.round(hero.x * 100) / 100, y: Math.round(hero.y * 100) / 100 });

  // Open the screens that a dialogue asks for, one after the other.
  // ctx.open() returns false when the village scene closes (for example for a battle).
  async function handleCommands(commands) {
    for (const c of commands) {
      if (!c.open || !alive) continue;
      profile.place = place();
      const stay = await withBusy(() => ctx.open(c, { village: api }));
      if (!stay) return;
    }
  }

  async function interact(who, at) {
    if (Math.hypot(at.x - hero.x, at.y - hero.y) > 0.05) hero.facing = faceOf(at.x - hero.x, at.y - hero.y);
    talkingTo = shown.get(`${who.kind}:${who.id}`) ?? null;
    if (who.kind === 'npc') {
      const npc = data.npcs.npcs[who.id];
      await talk(pickTalk(npc, profile));
    } else if (who.kind === 'encounter') {
      const enc = mapData.encounters.find((e) => e.id === who.id);
      await withBusy(() => ctx.confirmBattle(enc.battle));
    }
  }

  async function doAction(zone) {
    const a = zone.action;
    if (zone.once) profile.flags[`zone.${zone.id}`] = true;
    if (a.talk) {
      walkToPerson(a.talk);
      return;
    }
    if (a.move) {
      // A ferry: the hero and Nghé go to the other side of the river.
      await withBusy(() => say(ctx, a.textKey));
      placeHero(a.move.x, a.move.y);
      return;
    }
    if (a.pickup || a.set) {
      const { changes } = applyEffects(profile, [{ give: a.pickup, set: a.set }]);
      ctx.bus.emit('sound', 'pickup');
      ctx.save('pickup');
      await withBusy(() => say(ctx, a.textKey, { n: Object.values(changes.items)[0] ?? 0 }));
      return;
    }
    if (a.textKey) await withBusy(() => say(ctx, a.textKey));
    if (a.open) await handleCommands([{ open: a.open }]);
  }

  // Input ------------------------------------------------------------------

  const keys = new Set();
  const stick = { active: false, id: null, x: 0, y: 0, kx: 0, ky: 0, show: matchMedia('(pointer: coarse)').matches };
  let hold = null; // { id, vx, vy, since, held }
  const pointers = new Map();
  let pinch = null;
  let view = { width: 1, height: 1 };

  const local = (e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const stickHome = () => ({ x: 24 + STICK_R, y: view.height - 24 - STICK_R });
  const inStickZone = (p) => p.x < Math.min(280, view.width * 0.4) && p.y > view.height * 0.45;

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
    if (e.pointerType !== 'mouse' && inStickZone(p)) {
      Object.assign(stick, { active: true, id: e.pointerId, x: p.x, y: p.y, kx: 0, ky: 0, since: performance.now(), far: 0 });
      route = null;
      return;
    }
    hold = { id: e.pointerId, vx: p.x, vy: p.y, sx: p.x, sy: p.y, since: performance.now(), held: false };
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pinch && pointers.size === 2) {
      const [a, c] = [...pointers.values()];
      const d = Math.hypot(a.x - c.x, a.y - c.y);
      if (d / pinch.d < 0.75) { world.setZoom(1); pinch.d = d; }
      if (d / pinch.d > 1.33) { world.setZoom(0); pinch.d = d; }
      return;
    }
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
      hold = null;
      if (!wasHeld && e.type === 'pointerup' && !busy) onTap(p);
    }
  }

  function startHold() {
    hold.held = true;
    route = null;
  }

  function onWheel(e) {
    e.preventDefault();
    world.setZoom(e.deltaY > 0 ? 1 : 0);
  }

  function onKey(e) {
    if (!KEYS.has(e.code)) return;
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
    if (e.type === 'keydown') {
      if (busy) return;
      if (e.code === 'KeyQ' || e.code === 'KeyE') {
        if (!e.repeat) world.turn(e.code === 'KeyQ' ? -1 : 1);
        e.preventDefault();
        return;
      }
      keys.add(e.code);
      route = null;
      e.preventDefault();
    } else {
      keys.delete(e.code);
    }
  }

  // The person or enemy under a screen point: the nearest one to the camera.
  function personAt(p) {
    let best = null;
    for (const f of shown.values()) {
      const q = f.person;
      const b = world.screenBox({ x0: q.x - 0.7, x1: q.x + 0.7, y0: f.y, y1: f.y + f.height + 0.2, z0: q.y - 0.7, z1: q.y + 0.7 });
      const pad = 10;
      if (p.x < b.x0 - pad || p.x > b.x1 + pad || p.y < b.y0 - pad || p.y > b.y1 + pad) continue;
      const near = world.nearness(q.x, f.y, q.y);
      if (!best || near > best.near) best = { f, near };
    }
    return best?.f.person ?? null;
  }

  const showTap = (x, y, hh) => {
    tapFx = { x, y, h: hh, age: 0 };
  };

  // A tap: a person, an enemy, a thing with a trigger zone, or a place on the ground.
  function onTap(p) {
    ctx.bus.emit('sound', 'tap');
    const state = conditionState(profile);
    const person = personAt(p);
    if (person) {
      showTap(person.x, person.y, groundY(person.x, person.y));
      walkToThing(person, () => interact({ kind: person.kind, id: person.id }, person));
      return;
    }
    const hit = world.pick(p.x, p.y, { things: true });
    if (!hit) return;
    const from = { x: Math.floor(hero.x), y: Math.floor(hero.y) };
    // A thing with a tap zone.
    const thing = hit.who ? terrain.objects.find((o) => o.who === hit.who) : null;
    const o = thing?.id ? mapData.layers.objects.find((x) => x.id === thing.id) : null;
    const zone = o ? triggers.fire('tap', o.x, o.y, state) : null;
    if (zone) {
      const at = { x: o.x + o.w / 2, y: o.y + o.h / 2 };
      showTap(at.x, at.y, groundY(at.x, at.y));
      walkPath(pathNextTo(tileMap, from, { x: o.x + Math.floor(o.w / 2), y: o.y + o.h - 1 }) ?? pathNextTo(tileMap, from, o), null, () => doAction(zone),
        { x: at.x, y: at.y, d: Math.max(o.w, o.h) / 2 + 1.5 });
      return;
    }
    // The ground (or the foot of a thing without a zone).
    const tile = { x: Math.floor(hit.x), y: Math.floor(hit.y) };
    if (!tileMap.inside(tile.x, tile.y)) return;
    showTap(hit.x, hit.y, hit.who ? groundY(hit.x, hit.y) : hit.h);
    // A tap zone on the ground is a thing that the hero cannot walk on (water, a field).
    // A tap on a free cell of the zone (the ford, a dike in the field) is a walk.
    const ground = tileMap.isBlocked(tile.x, tile.y) ? triggers.fire('tap', tile.x, tile.y, state) : null;
    if (ground) {
      walkPath(pathNextTo(tileMap, from, tile), null, () => doAction(ground), { x: hit.x, y: hit.y, d: 2.2 });
      return;
    }
    if (tileMap.walkable(tile.x, tile.y)) walkPath(findPath(tileMap, from, tile)?.slice(0, -1), { x: hit.x, y: hit.y }, null);
    else walkPath(pathNextTo(tileMap, from, tile), null, null);
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  // The frame loop -------------------------------------------------------------

  let last = performance.now();
  let time = 0;
  // With ?fps in the address, a small box shows the frames each second and the size of a frame,
  // for tests of the speed on real devices.
  const meter = new URLSearchParams(location.search).has('fps') ? h('div', { class: 'fps-meter' }) : null;
  if (meter) ctx.ui.append(meter);
  let frames = 0;
  let since = last;
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    step(dt);
    draw(dt);
    frames += 1;
    if (meter && now - since > 1000) {
      const s = world.stats();
      meter.textContent = `${Math.round((frames * 1000) / (now - since))} fps · ${s.calls} calls · ${Math.round(s.triangles / 1000)}k triangles`;
      frames = 0;
      since = now;
    }
    requestAnimationFrame(frame);
  }

  // The hero walks into an exit: the screen goes dark, and the next map opens.
  function goThrough(exit) {
    leaving = true;
    route = null;
    hold = null;
    stick.active = false;
    keys.clear();
    const to = worldMap.arrival(exit, hero.x, hero.y);
    profile.place = { map: to.map, x: to.x, y: to.y };
    fade.classList.add('on');
    ctx.save('map');
    setTimeout(() => {
      if (alive) ctx.go('village', { map: to.map, at: { x: to.x, y: to.y }, facing: hero.facing, arrive: true });
    }, 260);
  }

  // A screen direction as a map direction, for the angle of the camera now.
  const toMapInput = (s) => {
    if (!s.dx && !s.dy) return { dx: 0, dy: 0, strength: 0 };
    const m = screenToMap(s.dx, s.dy, world.angle);
    return { dx: m.x, dy: m.y, strength: s.strength ?? 1, run: s.run };
  };

  function currentInput() {
    if (busy || leaving) return { dx: 0, dy: 0, strength: 0 };
    if (stick.active) return toMapInput(stickToScreenDir(stick.kx, stick.ky, STICK_R));
    if (keys.size) {
      const k = keysToScreenDir(keys);
      if (k.dx || k.dy) return toMapInput(k);
    }
    if (hold && !hold.held && performance.now() - hold.since > HOLD_MS) startHold();
    if (hold?.held) {
      const m = world.pick(hold.vx, hold.vy);
      if (!m) return { dx: 0, dy: 0, strength: 0 };
      const far = Math.hypot(m.x - hero.x, m.y - hero.y) > 6;
      return inputToward(hero, m, { run: far, stop: 0.3 });
    }
    if (route) {
      if (route.near && Math.hypot(route.near.x - hero.x, route.near.y - hero.y) <= route.near.d) {
        arrive();
        return { dx: 0, dy: 0, strength: 0 };
      }
      let next = route.points[0];
      while (next && Math.hypot(next.x - hero.x, next.y - hero.y) < 0.3) {
        route.points.shift();
        next = route.points[0];
      }
      if (!next) {
        arrive();
        return { dx: 0, dy: 0, strength: 0 };
      }
      const far = route.points.length > 10;
      return inputToward(hero, next, { run: far, stop: 0.05 });
    }
    return { dx: 0, dy: 0, strength: 0 };
  }

  // The hero keeps a little space from people, like a wall that is round.
  function pushFromPeople() {
    for (const p of [...people, ...encounters]) {
      const dx = hero.x - p.x;
      const dy = hero.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d >= PERSON_R || d < 1e-6) continue;
      const k = (PERSON_R - d) / d;
      const out = moveCircle(hero, dx * k, dy * k, MOVE.radius, worldFor(tileMap, hero.x, hero.y).isBlocked);
      hero.x = out.x;
      hero.y = out.y;
    }
  }

  function step(dt) {
    if (tapFx) tapFx.age += dt;
    if (!busy) advance(profile.clock, dt);
    const before = { x: hero.x, y: hero.y };
    const input = currentInput();
    stepBody(hero, input, dt, worldFor(tileMap, hero.x, hero.y));
    pushFromPeople();
    if (route) {
      still = Math.hypot(hero.x - before.x, hero.y - before.y) < 1e-3 ? still + dt : 0;
      // Stuck (for example behind a person): stop the walk.
      if (still > 0.6) route = null;
    }
    const tx = Math.floor(hero.x);
    const ty = Math.floor(hero.y);
    if (tx !== heroTile.x || ty !== heroTile.y) {
      heroTile = { x: tx, y: ty };
      const exit = busy || leaving ? null : worldMap.exitAt(mapData.id, tx, ty, conditionState(profile));
      if (exit) {
        goThrough(exit);
        return;
      }
      const zone = busy || leaving ? null : triggers.fire('enter', tx, ty, conditionState(profile));
      if (zone) {
        route = null;
        hold = null;
        stick.active = false;
        keys.clear();
        doAction(zone);
      }
    }
    if (friendFig) stepFollower(nghe, hero, dt, worldFor(tileMap, nghe.x, nghe.y));
  }

  // Put each figure on the ground, turn it, and give it its pose.
  function poseFigures(dt) {
    const ease = Math.min(1, dt * 14);
    for (const f of figures) {
      const a = f.at;
      let speed = a.speed ?? 0;
      let facing = a.facing ?? f.facing ?? 0;
      if (f.swim) {
        // A duck swims slowly around its point.
        const s = f.swim;
        s.a += dt * 0.35 * s.dir;
        a.x = s.cx + Math.cos(s.a) * s.r;
        a.y = s.cy + Math.sin(s.a) * s.r;
        facing = faceOf(-Math.sin(s.a) * s.dir, Math.cos(s.a) * s.dir);
        speed = 0.2;
      } else if (f.person) {
        // People and enemies turn to the hero when the hero is near, or in a dialogue.
        const d = Math.hypot(hero.x - a.x, hero.y - a.y);
        if (f === talkingTo || (d < LOOK_R && f.figure.kind !== 'serpent')) f.facing = turnToward(f.facing ?? 0, faceOf(hero.x - a.x, hero.y - a.y), dt * 5);
        facing = f.facing;
      }
      const target = a.float ?? groundY(a.x, a.y);
      f.y += (target - f.y) * ease;
      f.root.position.set(a.x, f.y, a.y);
      f.root.rotation.y = facing;
      D.applyPose(f, animate(f.anim, { speed, dt }));
    }
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
    const screen = { x: 0, y: 0, w: view.width, h: view.height };
    let stars = 0;
    let arrows = 0;
    const edges = [];
    const bob = Math.sin(time * 4) * 4;
    for (const m of busy ? [] : markers()) {
      const p = world.project(m.x, m.h, m.y);
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
    for (let i = arrows; i < arrowPool.length; i++) arrowPool[i].hidden = true;
    if (tapFx && tapFx.age < 0.6) {
      const p = world.project(tapFx.x, tapFx.h + 0.05, tapFx.y);
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

  function draw(dt) {
    const w = canvas.clientWidth || window.innerWidth;
    const hh = canvas.clientHeight || window.innerHeight;
    if (w !== view.width || hh !== view.height) {
      view = { width: w, height: hh };
      world.resize(w, hh);
    }
    poseFigures(dt);
    world.render(dt, { x: hero.x, y: heroFig.y, z: hero.y }, time);
    drawMarks();
  }

  const api = {
    refresh: () => refreshPeople(),
    talk,
    heroTile: () => ({ x: Math.floor(hero.x), y: Math.floor(hero.y) }),
    placeHero,
    mapId: () => mapData.id,
    // Open another map, for automatic tests of the whole game.
    goMap: (id, x, y) => ctx.go('village', { map: id, at: { x, y } }),
    // The screen point of the middle of a cell, for automatic tests of the whole game.
    screenOf: (x, y) => world.project(x + 0.5, groundY(x + 0.5, y + 0.5), y + 0.5),
    // The screen point of a person or an enemy, for automatic tests of the whole game.
    screenOfPerson: (id) => {
      const f = [...shown.values()].find((x) => x.person.id === id);
      return f ? world.project(f.person.x, f.y + f.height * 0.5, f.person.y) : null;
    },
    turn: (n) => world.turn(n),
    stats: () => world.stats(),
  };
  ctx.activeVillage = api;

  refreshPeople();
  view = { width: canvas.clientWidth || window.innerWidth, height: canvas.clientHeight || window.innerHeight };
  world.resize(view.width, view.height);
  heroFig.y = groundY(hero.x, hero.y);
  world.jump(hero.x, heroFig.y + 1.5, hero.y);
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

  // Events after the scene starts (for example the story after a battle).
  queueMicrotask(async () => {
    if (!profile.flags['intro.seen']) await talk('grandma.intro');
    for (const id of params.after ?? []) if (alive) await talk(id);
  });

  return {
    unmount() {
      alive = false;
      if (ctx.activeVillage === api) ctx.activeVillage = null;
      profile.place = place();
      visit.at = { x: profile.place.x, y: profile.place.y };
      visit.last = Math.round(profile.clock.minutes);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      offLang();
      for (const f of [...figures]) removeFigure(f);
      for (const el of [paper, marks, hud, turns, fade, banner, meter]) el?.remove();
    },
    api,
  };
}

// Turn an angle toward another angle by at most `step` (radians), the short way.
function turnToward(from, to, step) {
  let d = ((to - from + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  if (Math.abs(d) > step) d = Math.sign(d) * step;
  return from + d;
}

// The nearest free cell to a point (the point itself when it is free), or null.
function freeSpot(tileMap, p) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  const tx = Math.floor(p.x);
  const ty = Math.floor(p.y);
  if (tileMap.inside(tx, ty) && !tileMap.isBlocked(tx, ty)) return { x: p.x, y: p.y };
  for (let r = 1; r < 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = tx + dx;
        const y = ty + dy;
        if (tileMap.inside(x, y) && !tileMap.isBlocked(x, y)) return { x: x + 0.5, y: y + 0.5 };
      }
    }
  }
  return null;
}
