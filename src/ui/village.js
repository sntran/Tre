// The village scene. The world is plain data (src/core/world/): the systems move it in fixed
// steps, the renderer draws it, and the input goes into it as commands. This file connects them
// with the story: trigger zones, people, encounters, the quest goal, and the HUD.
import { createTileMap, findPath, pathNextTo } from '../core/tilemap.js';
import { createTriggers } from '../core/triggers.js';
import { currentGoal } from '../core/quests.js';
import { pickTalk, isPresent, applyEffects, conditionState } from '../core/game.js';
import { edgeMarker } from '../core/hit.js';
import { heroLayers } from '../render/assets.js';
import { keysToScreenDir, stickToScreenDir, screenToMap, inputToward } from '../core/world/move.js';
import { createWorldState, getEntity, query, command } from '../core/world/state.js';
import { step, STEP } from '../core/world/step.js';
import { envFor } from '../core/world/env.js';
import { addHero, addFriend, syncPeople, addLifeLayer } from '../core/world/populate.js';
import { loadWorld, saveWorld, heroPlace, setHeroPlace } from '../core/world/save.js';
import { buildTerrain, columnTop } from '../world/terrain.js';
import { heroLook } from '../world/figures.js';
import { h, img, button } from './dom.js';
import { t, tn } from './i18n.js';
import { speak } from './speak.js';
import { runDialogue, say } from './dialogue.js';

const STICK_R = 56; // the radius of the virtual stick, in screen pixels
const HOLD_MS = 220; // a press this long is a hold (walk toward the finger), not a tap
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
  const savedPlace = heroPlace(profile.world);
  const savedMap = worldMap.map(savedPlace.map) ? savedPlace.map : null;
  const mapData = worldMap.map(params.map ?? savedMap ?? worldMap.start.map);
  const tileTypes = data.tiles.types;
  const tileMap = createTileMap(mapData, tileTypes);
  const triggers = createTriggers(mapData.layers.triggers);
  const env = envFor(tileMap);
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
  const view = worlds.get(mapData.id);
  const looks = data.figures.figures;
  const figures = D.createFigureLayer(view.scene, (key) => (key === 'hero' ? heroLook(profile.hero) : looks[key] ?? {}));

  // The height of the ground under a map point (world units).
  const groundY = (x, y) => columnTop(tileMap.heightAt(Math.floor(x), Math.floor(y)));

  // The world state of this map. The save keeps the hero; the rest comes from the map and the seed.
  const onThisMap = profile.world.map === mapData.id;
  const state = onThisMap ? loadWorld(profile.world) : createWorldState({ seed: profile.world.seed, map: mapData.id, clock: profile.world.clock });
  state.clock = profile.world.clock; // one clock: a travel on the country map moves it too
  const saved = onThisMap && savedPlace.x !== null ? savedPlace : null;
  const start = freeSpot(tileMap, params.at ?? saved ?? mapData.spawn) ?? mapData.spawn;
  const heroAt = getEntity(state, 'hero');
  if (heroAt && !params.at && saved) {
    heroAt.position.y = env.groundY(start.x, start.y);
  } else {
    if (heroAt) state.entities.splice(state.entities.indexOf(heroAt), 1);
    addHero(state, env, { x: start.x, y: start.y, facing: params.facing ?? 0 });
  }
  addLifeLayer(state, mapData, env, data.life);
  const hero = () => getEntity(state, 'hero');
  const heroCell = () => ({ x: hero().position.x / 2, y: hero().position.z / 2 });

  let heroTile = { x: Math.floor(start.x), y: Math.floor(start.y) };
  let tapFx = null;
  let busy = false; // true while a dialogue or a panel is open
  let alive = true;
  let leaving = false; // true after the hero walks into an exit
  const arrivals = new Map(); // the token of a walk -> what to do at its end
  let nextToken = 1;
  // The state of this map in the save.
  profile.maps ??= {};
  const visit = (profile.maps[mapData.id] ??= { first: Math.round(state.clock.minutes), things: {} });
  visit.last = Math.round(state.clock.minutes);

  // Put the world into the save. When the hero went to another map (an exit, a travel), the save
  // already has the new place.
  function syncSave() {
    if (profile.world.map !== state.map) return;
    profile.world.entities = saveWorld(state).entities;
  }
  ctx.syncWorld = syncSave;

  // People and encounters. They block their cells for the paths of taps.
  const persons = () => query(state, 'person').map((e) => ({ ...e.person, x: e.position.x / 2, y: e.position.z / 2, entity: e.id }));
  function refreshPeople() {
    syncPeople(state, mapData, env, (kind, item) => (kind === 'npc' ? Boolean(data.npcs.npcs[item.id]) && isPresent(data.npcs.npcs[item.id], profile) : isPresent(item, profile)));
    tileMap.clearOccupied();
    for (const p of persons()) tileMap.occupy(Math.floor(p.x), Math.floor(p.y), { kind: p.kind, id: p.ref });
    // The friend walks behind the hero.
    const friendId = profile.party[0];
    for (const f of query(state, 'follow')) if (f.id !== `friend:${friendId}`) state.entities.splice(state.entities.indexOf(f), 1);
    if (friendId && looks[friendId] && !getEntity(state, `friend:${friendId}`)) addFriend(state, env, friendId);
    figures.sync(state);
    updateHud();
  }

  function placeHero(x, y) {
    command(state, { type: 'place', id: 'hero', x: x * 2, z: y * 2 });
    heroTile = { x: Math.floor(x), y: Math.floor(y) };
    arrivals.clear();
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
  turnLeft.addEventListener('click', () => view.turn(-1));
  turnRight.addEventListener('click', () => view.turn(1));
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

  // Walks to a point or a person, on a path of cells around houses and water. The world sends
  // the event "arrived" at the end of the walk.
  function walkPath(path, end, onArrive, near = null) {
    if (!path) return;
    const points = path.map((p) => ({ x: (p.x + 0.5) * 2, z: (p.y + 0.5) * 2 }));
    if (end) points.push({ x: end.x * 2, z: end.y * 2 });
    const token = nextToken++;
    arrivals.clear();
    if (onArrive) arrivals.set(token, onArrive);
    command(state, { type: 'walk', id: 'hero', points, token, near: near ? { x: near.x * 2, z: near.y * 2, d: near.d * 2 } : null });
  }

  function walkToThing(target, onArrive) {
    const c = heroCell();
    const from = { x: Math.floor(c.x), y: Math.floor(c.y) };
    const tile = { x: Math.floor(target.x), y: Math.floor(target.y) };
    walkPath(pathNextTo(tileMap, from, tile), null, onArrive, { x: target.x, y: target.y, d: 2.2 });
  }

  function walkToPerson(id) {
    const p = persons().find((x) => x.kind === 'npc' && x.ref === id);
    if (!p || busy) return;
    walkToThing(p, () => interact({ kind: 'npc', id }, p));
  }

  async function withBusy(fn) {
    busy = true;
    hold = null;
    stick.active = false;
    keys.clear();
    arrivals.clear();
    command(state, { type: 'stop', id: 'hero' });
    command(state, { type: 'pause', on: true });
    try {
      return await fn();
    } finally {
      busy = false;
      if (alive) {
        command(state, { type: 'pause', on: false });
        refreshPeople();
      }
    }
  }

  async function talk(dialogueId) {
    if (!dialogueId) return;
    const commands = await withBusy(() => runDialogue(ctx, dialogueId));
    await handleCommands(commands);
  }

  // Open the screens that a dialogue asks for, one after the other.
  // ctx.open() returns false when the village scene closes (for example for a battle).
  async function handleCommands(commands) {
    for (const c of commands) {
      if (!c.open || !alive) continue;
      syncSave();
      const stay = await withBusy(() => ctx.open(c, { village: api }));
      if (!stay) return;
    }
  }

  async function interact(who, at) {
    command(state, { type: 'face', id: 'hero', x: at.x * 2, z: at.y * 2 });
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
  let size = { width: 1, height: 1 };

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
    if (e.pointerType !== 'mouse' && inStickZone(p)) {
      Object.assign(stick, { active: true, id: e.pointerId, x: p.x, y: p.y, kx: 0, ky: 0, since: performance.now(), far: 0 });
      arrivals.clear();
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
      if (d / pinch.d < 0.75) { view.setZoom(1); pinch.d = d; }
      if (d / pinch.d > 1.33) { view.setZoom(0); pinch.d = d; }
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
    arrivals.clear();
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
      keys.add(e.code);
      arrivals.clear();
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

  // A tap: a person, an enemy, a thing with a trigger zone, or a place on the ground.
  function onTap(p) {
    ctx.bus.emit('sound', 'tap');
    const cond = conditionState(profile);
    const person = personAt(p);
    if (person) {
      showTap(person.x, person.y, groundY(person.x, person.y));
      walkToThing(person, () => interact({ kind: person.kind, id: person.ref }, person));
      return;
    }
    const hit = view.pick(p.x, p.y, { things: true });
    if (!hit) return;
    const c = heroCell();
    const from = { x: Math.floor(c.x), y: Math.floor(c.y) };
    // A thing with a tap zone.
    const thing = hit.who ? terrain.objects.find((o) => o.who === hit.who) : null;
    const o = thing?.id ? mapData.layers.objects.find((x) => x.id === thing.id) : null;
    const zone = o ? triggers.fire('tap', o.x, o.y, cond) : null;
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
    const ground = tileMap.isBlocked(tile.x, tile.y) ? triggers.fire('tap', tile.x, tile.y, cond) : null;
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

  // The input of this frame as a command for the world: a map direction from the stick, the
  // keys, or a held finger. A tap walk goes in as a "walk" command (see walkPath).
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
      const m = hold?.held ? view.pick(hold.vx, hold.vy) : null;
      if (m) {
        const c = heroCell();
        const i = inputToward(c, m, { run: Math.hypot(m.x - c.x, m.y - c.y) > 6, stop: 0.3 });
        dir = i.strength ? { dx: i.dx, dz: i.dy, strength: i.strength, run: i.run } : null;
      }
    }
    if (dir) {
      command(state, { type: 'move', id: 'hero', ...dir });
      moving = true;
    } else if (moving) {
      // The stick, the keys, or the finger stopped: the hero stops too.
      command(state, { type: 'move', id: 'hero', dx: 0, dz: 0, strength: 0 });
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
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    sendInput();
    // The world moves in fixed steps; the drawing is smooth between two steps.
    acc += dt;
    while (acc >= STEP && alive) {
      step(state, STEP, env);
      figures.sync(state);
      afterStep();
      acc -= STEP;
    }
    draw(dt, acc / STEP);
    frames += 1;
    if (meter && now - since > 1000) {
      const s = view.stats();
      meter.textContent = `${Math.round((frames * 1000) / (now - since))} fps · ${s.calls} calls · ${Math.round(s.triangles / 1000)}k triangles`;
      frames = 0;
      since = now;
    }
    requestAnimationFrame(frame);
  }

  // The hero walks into an exit: the screen goes dark, and the next map opens.
  function goThrough(exit) {
    leaving = true;
    hold = null;
    stick.active = false;
    keys.clear();
    arrivals.clear();
    command(state, { type: 'stop', id: 'hero' });
    const c = heroCell();
    const to = worldMap.arrival(exit, c.x, c.y);
    syncSave();
    setHeroPlace(profile.world, to.map, to.x, to.y);
    fade.classList.add('on');
    ctx.save('map');
    setTimeout(() => {
      if (alive) ctx.go('village', { map: to.map, at: { x: to.x, y: to.y }, facing: hero().position.facing, arrive: true });
    }, 260);
  }

  // After each step: the events of the world, the exits, and the trigger zones.
  function afterStep() {
    for (const ev of state.events) {
      if (ev.id !== 'hero') continue;
      if (ev.type === 'placed') view.jump(hero().position.x / 2, hero().position.y / 2 + 1.5, hero().position.z / 2);
      if (ev.type === 'arrived' || ev.type === 'stuck') {
        const fn = arrivals.get(ev.token);
        arrivals.delete(ev.token);
        if (ev.type === 'arrived') fn?.();
      }
    }
    const c = heroCell();
    const tx = Math.floor(c.x);
    const ty = Math.floor(c.y);
    if (tx === heroTile.x && ty === heroTile.y) return;
    heroTile = { x: tx, y: ty };
    if (busy || leaving) return;
    const exit = worldMap.exitAt(mapData.id, tx, ty, conditionState(profile));
    if (exit) {
      goThrough(exit);
      return;
    }
    const zone = triggers.fire('enter', tx, ty, conditionState(profile));
    if (zone) {
      hold = null;
      stick.active = false;
      keys.clear();
      arrivals.clear();
      command(state, { type: 'stop', id: 'hero' });
      doAction(zone);
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

  function draw(dt, between) {
    if (tapFx) tapFx.age += dt;
    const w = canvas.clientWidth || window.innerWidth;
    const hh = canvas.clientHeight || window.innerHeight;
    if (w !== size.width || hh !== size.height) {
      size = { width: w, height: hh };
      view.resize(w, hh);
    }
    figures.draw(between, dt);
    view.render(dt, figures.placeOf('hero'), time);
    drawMarks();
  }

  const api = {
    refresh: () => refreshPeople(),
    talk,
    heroTile: () => ({ x: heroTile.x, y: heroTile.y }),
    placeHero,
    mapId: () => mapData.id,
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
    turn: (n) => view.turn(n),
    stats: () => view.stats(),
    // The world state, for automatic tests (read only).
    state: () => state,
  };
  ctx.activeVillage = api;

  refreshPeople();
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

  // Events after the scene starts (for example the story after a battle).
  queueMicrotask(async () => {
    if (!profile.flags['intro.seen']) await talk('grandma.intro');
    for (const id of params.after ?? []) if (alive) await talk(id);
  });

  return {
    unmount() {
      alive = false;
      if (ctx.activeVillage === api) ctx.activeVillage = null;
      syncSave();
      if (ctx.syncWorld === syncSave) ctx.syncWorld = null;
      const c = heroCell();
      visit.at = { x: Math.round(c.x * 100) / 100, y: Math.round(c.y * 100) / 100 };
      visit.last = Math.round(state.clock.minutes);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      offLang();
      figures.dispose();
      for (const el of [paper, marks, hud, turns, fade, banner, meter]) el?.remove();
    },
    api,
  };
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
