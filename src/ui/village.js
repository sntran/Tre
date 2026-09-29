// The village scene: the isometric map on the canvas, free movement (stick, keys, tap and hold),
// trigger zones, people, encounters, the quest goal, and the HUD.
import { createTileMap, findPath, pathNextTo } from '../core/tilemap.js';
import { createTriggers } from '../core/triggers.js';
import { currentGoal } from '../core/quests.js';
import { pickTalk, isPresent, applyEffects, conditionState } from '../core/game.js';
import { createWorldRenderer } from '../render/world.js';
import { bitmap, heroLayers } from '../render/assets.js';
import { createIsoCamera } from '../iso/camera.js';
import { toScreen, toMap, pickTileZ, mapBounds, STEP } from '../iso/grid.js';
import { stepBody, moveCircle, worldFor, keysToScreenDir, stickToScreenDir, inputToward, createFollower, stepFollower, MOVE } from '../world/movement.js';
import { figureScale } from '../core/figures.js';
import { createClock, advance } from '../world/clock.js';
import { h, img, button } from './dom.js';
import { t, tn } from './i18n.js';
import { speak } from './speak.js';
import { runDialogue, say } from './dialogue.js';

const STICK_R = 56; // the radius of the virtual stick, in screen pixels
const HOLD_MS = 220; // a press this long is a hold (walk toward the finger), not a tap
const PERSON_R = 0.5; // the hero keeps this distance (in tiles) from people
const KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight']);

// The ground pieces take some time to make, so the scene keeps the renderer for the next visit.
const rendererCache = new Map();

export async function mountVillage(ctx, params = {}) {
  const { data, profile } = ctx;
  const worldMap = data.world;
  const savedMap = worldMap.map(profile.place?.map) ? profile.place.map : null;
  const mapData = worldMap.map(params.map ?? savedMap ?? worldMap.start.map);
  const tileTypes = data.tiles.types;
  const tileMap = createTileMap(mapData, tileTypes);
  const triggers = createTriggers(mapData.layers.triggers);
  if (!rendererCache.has(mapData.id)) rendererCache.set(mapData.id, createWorldRenderer(mapData, tileMap, tileTypes));
  const renderer = await rendererCache.get(mapData.id);
  const camera = createIsoCamera({ zooms: [1, 0.62] });
  const b = mapBounds(mapData.width, mapData.height);
  camera.bounds = { left: b.left, right: b.right, top: b.top - 120 - 6 * STEP, bottom: b.bottom + 16 };
  const surface = ctx.surface;
  surface.canvas.hidden = false;

  const heroBmp = await bitmap(heroLayers(profile.hero), 2);
  const npcBmps = new Map();
  for (const [id, npc] of Object.entries(data.npcs.npcs)) npcBmps.set(id, await bitmap(npc.art, 2));
  const encBmps = new Map();
  for (const e of mapData.encounters) encBmps.set(e.id, await bitmap(e.art, 2));
  const friendBmps = new Map();
  for (const [id, f] of Object.entries(data.friends?.friends ?? {})) friendBmps.set(id, await bitmap(f.art, 2));

  // The sizes of people. A child is smaller than an adult.
  const fig = data.game.figures;
  const grow = fig.world / fig.map;
  const personScale = (def) => figureScale(def, 'map', fig) * grow;
  const encounterScale = (e) => (e.art.includes('serpent') || e.art.includes('general') ? 0.96 : 1) * fig.world;
  const heroScale = figureScale({ child: true }, 'map', fig) * grow;
  const friendScale = 0.36 * grow;

  // The hero.
  // The height of the ground under a map point, in screen units.
  const groundZ = (x, y) => tileMap.heightAt(Math.floor(x), Math.floor(y)) * STEP;
  // The map point under a screen point of the world, on the ground with its heights.
  const pickGround = (w) => {
    const hit = pickTileZ(w.x, w.y, tileMap.heightAt, mapData.width, mapData.height, STEP);
    return hit ? { x: hit.mx, y: hit.my, z: hit.z * STEP } : { ...toMap(w.x, w.y), z: 0 };
  };
  const saved = profile.place?.map === mapData.id && profile.place.x !== null ? profile.place : null;
  const start = freeSpot(tileMap, params.at ?? saved ?? mapData.spawn) ?? mapData.spawn;
  const hero = { x: start.x, y: start.y, vx: 0, vy: 0, facing: params.facing ?? 1, moving: false };
  hero.z = groundZ(hero.x, hero.y);
  let nghe = createFollower(hero.x - 0.8, hero.y + 0.3);
  let heroTile = { x: Math.floor(hero.x), y: Math.floor(hero.y) };
  let route = null; // a walk to a tapped point: { points, onArrive, near }
  let tapFx = null;
  let busy = false; // true while a dialogue or a panel is open
  let alive = true;
  let still = 0; // how long the hero has not moved on a route
  let leaving = false; // true after the hero walks into an exit
  // The game clock, and the state of this map in the save.
  profile.clock ??= createClock();
  profile.maps ??= {};
  const visit = (profile.maps[mapData.id] ??= { first: Math.round(profile.clock.minutes), things: {} });
  visit.last = Math.round(profile.clock.minutes);

  // People and encounters. They block their tiles for the paths of taps.
  let people = [];
  let encounters = [];
  function refreshPeople() {
    tileMap.clearOccupied();
    people = mapData.npcs
      .filter((n) => data.npcs.npcs[n.id] && isPresent(data.npcs.npcs[n.id], profile))
      .map((n) => ({ ...n, def: data.npcs.npcs[n.id] }));
    encounters = mapData.encounters.filter((e) => isPresent(e, profile));
    for (const p of people) tileMap.occupy(Math.floor(p.x), Math.floor(p.y), { kind: 'npc', id: p.id });
    for (const e of encounters) tileMap.occupy(Math.floor(e.x), Math.floor(e.y), { kind: 'encounter', id: e.id });
    updateHud();
  }

  function placeHero(x, y) {
    Object.assign(hero, { x, y, vx: 0, vy: 0, moving: false });
    heroTile = { x: Math.floor(x), y: Math.floor(y) };
    route = null;
    nghe = createFollower(x - 0.8, y + 0.3);
    hero.z = groundZ(x, y);
    const p = toScreen(x, y, hero.z + 40);
    camera.jump(p.x, p.y);
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
  // A dark layer for the change of map, and the name of the new map.
  const fade = h('div', { class: params.arrive ? 'map-fade on' : 'map-fade' });
  const banner = params.arrive ? h('div', { class: 'map-name', text: t(mapData.nameKey) }) : null;
  ctx.ui.append(hud, fade, ...(banner ? [banner] : []));
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

  // The quest markers: map points with a height (z) over the ground.
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
      if (exit && !out.some((m) => m.exit === exit.id)) out.push({ exit: exit.id, x: exit.x + exit.w / 2, y: exit.y + exit.h / 2, z: 30 + groundZ(exit.x, exit.y) });
    };
    for (const tg of list) {
      if (tg.unless && flags[tg.unless]) continue;
      if (tg.if && !flags[tg.if]) continue;
      for (const kind of ['npc', 'encounter', 'object']) {
        if (tg[kind]) markExit(worldMap.whereIs(kind, tg[kind]));
      }
      if (tg.npc) {
        const p = people.find((x) => x.id === tg.npc);
        if (p) out.push({ x: p.x, y: p.y, z: npcBmps.get(p.id).unitH * personScale(p.def) + 14 + groundZ(p.x, p.y) });
      }
      if (tg.encounter) {
        const e = encounters.find((x) => x.id === tg.encounter);
        if (e) out.push({ x: e.x, y: e.y, z: encBmps.get(e.id).unitH * encounterScale(e) + 14 + groundZ(e.x, e.y) });
      }
      if (tg.object) {
        const o = mapData.layers.objects.find((x) => x.id === tg.object);
        const s = renderer.statics.find((x) => x.id === tg.object);
        if (o) out.push({ x: o.x + o.w / 2, y: o.y + o.h / 2, z: (s?.rect.height ?? 60) * 0.8 + groundZ(o.x, o.y) });
      }
    }
    if (step.place && (step.place.map ?? mapData.id) === mapData.id) out.push({ x: step.place.x + 1, y: step.place.y + 0.5, z: 40 + groundZ(step.place.x, step.place.y) });
    else if (step.place) markExit(step.place.map);
    return out;
  }

  // Walks to a point or a person, on a path of tiles around houses and water.
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
    walkPath(pathNextTo(tileMap, from, tile), null, onArrive, { x: target.x, y: target.y, d: 1.3 });
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
    const dx = (at.x - at.y) - (hero.x - hero.y);
    if (Math.abs(dx) > 0.05) hero.facing = dx > 0 ? 1 : -1;
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
  const stick = { active: false, id: null, x: 0, y: 0, kx: 0, ky: 0, r: STICK_R, show: matchMedia('(pointer: coarse)').matches };
  let hold = null; // { id, vx, vy, since, held }
  const pointers = new Map();
  let pinch = null;
  let lastOrder = [];

  const local = (e) => {
    const rect = surface.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const stickHome = () => ({ x: 24 + STICK_R, y: surface.height - 24 - STICK_R });
  const inStickZone = (p) => p.x < Math.min(280, surface.width * 0.4) && p.y > surface.height * 0.45;

  function onDown(e) {
    if (busy || !alive) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    try {
      surface.canvas.setPointerCapture(e.pointerId);
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
      if (d / pinch.d < 0.75) { camera.setLevel(1); pinch.d = d; }
      if (d / pinch.d > 1.33) { camera.setLevel(0); pinch.d = d; }
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
    camera.setLevel(e.deltaY > 0 ? 1 : 0);
  }

  function onKey(e) {
    if (!KEYS.has(e.code)) return;
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
    if (e.type === 'keydown') {
      if (busy) return;
      keys.add(e.code);
      route = null;
      e.preventDefault();
    } else {
      keys.delete(e.code);
    }
  }

  // A tap: a person, an enemy, a thing with a trigger zone, or a place on the ground.
  function onTap(p) {
    const w = camera.toWorld(p.x, p.y);
    ctx.bus.emit('sound', 'tap');
    const state = conditionState(profile);
    // From front to back: the first picture under the finger.
    for (let i = lastOrder.length - 1; i >= 0; i--) {
      const it = lastOrder[i];
      const r = it.rect;
      const pad = it.kind ? 8 : 0;
      if (w.x < r.left - pad || w.x > r.left + r.width + pad || w.y < r.top - pad || w.y > r.top + r.height + pad) continue;
      if (it.kind === 'npc') {
        const person = people.find((x) => x.id === it.id);
        tapFx = { x: person.x, y: person.y, z: groundZ(person.x, person.y), age: 0 };
        walkToThing(person, () => interact({ kind: 'npc', id: person.id }, person));
        return;
      }
      if (it.kind === 'encounter') {
        const enc = encounters.find((x) => x.id === it.id);
        tapFx = { x: enc.x, y: enc.y, z: groundZ(enc.x, enc.y), age: 0 };
        walkToThing(enc, () => interact({ kind: 'encounter', id: enc.id }, enc));
        return;
      }
      if (it.id && !it.kind) {
        const o = mapData.layers.objects.find((x) => x.id === it.id);
        const zone = triggers.fire('tap', o.x, o.y, state);
        if (zone) {
          const at = { x: o.x + o.w / 2, y: o.y + o.h / 2 };
          tapFx = { ...at, z: groundZ(at.x, at.y), age: 0 };
          const from = { x: Math.floor(hero.x), y: Math.floor(hero.y) };
          walkPath(pathNextTo(tileMap, from, { x: o.x + Math.floor(o.w / 2), y: o.y + o.h - 1 }) ?? pathNextTo(tileMap, from, o), null, () => doAction(zone),
            { x: at.x, y: at.y, d: Math.max(o.w, o.h) / 2 + 1 });
          return;
        }
      }
    }
    // The ground.
    const m = pickGround(w);
    const tile = { x: Math.floor(m.x), y: Math.floor(m.y) };
    if (!tileMap.inside(tile.x, tile.y)) return;
    tapFx = { x: m.x, y: m.y, z: m.z, age: 0 };
    const from = { x: Math.floor(hero.x), y: Math.floor(hero.y) };
    // A tap zone on the ground is a thing that the hero cannot walk on (water, a field).
    // A tap on a free tile of the zone (the ford, a path in the field) is a walk.
    const zone = tileMap.isBlocked(tile.x, tile.y) ? triggers.fire('tap', tile.x, tile.y, state) : null;
    if (zone) {
      walkPath(pathNextTo(tileMap, from, tile), null, () => doAction(zone), { x: m.x, y: m.y, d: 1.3 });
      return;
    }
    if (tileMap.walkable(tile.x, tile.y)) walkPath(findPath(tileMap, from, tile)?.slice(0, -1), { x: m.x, y: m.y }, null);
    else walkPath(pathNextTo(tileMap, from, tile), null, null);
  }

  const canvas = surface.canvas;
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
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    step(dt);
    draw();
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

  function currentInput() {
    if (busy || leaving) return { dx: 0, dy: 0, strength: 0 };
    if (stick.active) return stickToScreenDir(stick.kx, stick.ky, STICK_R);
    if (keys.size) {
      const k = keysToScreenDir(keys);
      if (k.dx || k.dy) return k;
    }
    if (hold && !hold.held && performance.now() - hold.since > HOLD_MS) startHold();
    if (hold?.held) {
      const w = camera.toWorld(hold.vx, hold.vy);
      const m = pickGround(w);
      const far = Math.hypot(m.x - hero.x, m.y - hero.y) > 4;
      return inputToward(hero, m, { run: far, stop: 0.3 });
    }
    if (route) {
      if (route.near && Math.hypot(route.near.x - hero.x, route.near.y - hero.y) <= route.near.d) {
        arrive();
        return { dx: 0, dy: 0, strength: 0 };
      }
      let next = route.points[0];
      while (next && Math.hypot(next.x - hero.x, next.y - hero.y) < 0.2) {
        route.points.shift();
        next = route.points[0];
      }
      if (!next) {
        arrive();
        return { dx: 0, dy: 0, strength: 0 };
      }
      const far = route.points.length > 6;
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
    if (profile.party[0]) stepFollower(nghe, hero, dt, worldFor(tileMap, nghe.x, nghe.y));
    // A step up or down is smooth.
    const ease = Math.min(1, dt * 14);
    hero.z += (groundZ(hero.x, hero.y) - hero.z) * ease;
    nghe.z = (nghe.z ?? groundZ(nghe.x, nghe.y)) + (groundZ(nghe.x, nghe.y) - (nghe.z ?? 0)) * ease;
    const head = toScreen(hero.x, hero.y, 40 + hero.z);
    camera.follow(head.x, head.y, dt);
  }

  function draw() {
    camera.resize(surface.width, surface.height, Math.max(0.75, Math.min(1.6, surface.height / 560)));
    const list = [];
    for (const p of people) {
      const sx = p.x - p.y;
      list.push({ id: p.id, kind: 'npc', bmp: npcBmps.get(p.id), x: p.x, y: p.y, z: groundZ(p.x, p.y), scale: personScale(p.def), flip: sx > hero.x - hero.y });
    }
    for (const e of encounters) {
      list.push({ id: e.id, kind: 'encounter', bmp: encBmps.get(e.id), x: e.x, y: e.y, z: groundZ(e.x, e.y), scale: encounterScale(e), flip: true });
    }
    const friendId = profile.party[0];
    if (friendId && friendBmps.has(friendId)) {
      const sink = tileMap.groundAt(Math.floor(nghe.x), Math.floor(nghe.y)) === 'shallow' ? 10 : 0;
      list.push({ id: friendId, kind: 'friend', bmp: friendBmps.get(friendId), x: nghe.x, y: nghe.y, z: nghe.z ?? 0, scale: friendScale, flip: nghe.facing < 0, walking: nghe.moving, sink });
    }
    list.push({ id: 'hero', kind: 'hero', bmp: heroBmp, x: hero.x, y: hero.y, z: hero.z, scale: heroScale, flip: hero.facing < 0, walking: hero.moving, sink: hero.shallow ? 12 : 0 });
    // Keep the edge arrows away from the top bar.
    const hudRect = hud.getBoundingClientRect();
    const canvasRect = surface.canvas.getBoundingClientRect();
    const inset = { top: Math.max(0, hudRect.bottom - canvasRect.top) + 8, right: 12, bottom: 12, left: 12 };
    const home = stickHome();
    const stickView = stick.show && !busy ? (stick.active ? stick : { ...home, kx: 0, ky: 0, r: STICK_R }) : null;
    lastOrder = renderer.draw(surface, { camera, people: list, markers: markers(), tap: tapFx, inset, stick: stickView }, time);
  }

  const api = {
    refresh: () => refreshPeople(),
    talk,
    heroTile: () => ({ x: Math.floor(hero.x), y: Math.floor(hero.y) }),
    placeHero,
    mapId: () => mapData.id,
    // Open another map, for automatic tests of the whole game.
    goMap: (id, x, y) => ctx.go('village', { map: id, at: { x, y } }),
    // The screen point of the middle of a tile, for automatic tests of the whole game.
    screenOf: (x, y) => {
      const p = toScreen(x + 0.5, y + 0.5, groundZ(x + 0.5, y + 0.5));
      return camera.toView(p.x, p.y);
    },
  };
  ctx.activeVillage = api;

  refreshPeople();
  camera.resize(surface.width, surface.height, Math.max(0.75, Math.min(1.6, surface.height / 560)));
  const head0 = toScreen(hero.x, hero.y, hero.z + 40);
  camera.jump(head0.x, head0.y);
  requestAnimationFrame(frame);
  // Show the new language in the top bar after a change in the parent area.
  const offLang = ctx.bus.on('lang', () => {
    heroFace.setAttribute('aria-label', t('ui.home'));
    menuBtn.setAttribute('aria-label', t('ui.menu'));
    mapBtn.setAttribute('aria-label', t('ui.worldmap'));
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
      hud.remove();
      fade.remove();
      banner?.remove();
    },
    api,
  };
}

// The nearest free tile to a point (the point itself when it is free), or null.
function freeSpot(tileMap, p) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  const tx = Math.floor(p.x);
  const ty = Math.floor(p.y);
  if (tileMap.inside(tx, ty) && !tileMap.isBlocked(tx, ty)) return { x: p.x, y: p.y };
  for (let r = 1; r < 6; r++) {
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
