// The headless session of the village: the story logic of a map, with no DOM and no WebGL. It
// owns the world state of the current map, the trigger zones, the people, the walks of the taps,
// the talks and their effects, the exits between maps, and what the commits at the placements
// give to the learner. The village scene is a thin view over it: the scene turns the input into
// commands, draws the state, and reacts to the events. The stories (tests/stories/) run the same
// session in node:test.
//
// Commands (command(cmd)):
// - the world commands move, stop, pet, ride, aim, pick, put, drop, guess, and face go to the
//   world state (with id 'hero' when there is no id);
// - tap { target }: the child tapped a thing. target is one of { hero: true }, { guess: { zone, n } },
//   { thing: id } (a plank), { person: entity id }, or { ground: { x, y, h, thing, object } }
//   (a point on the ground in map cells; object: the id of a map object there, or null).
//   targetAt(x, y) gives the target at a map cell, as a tap there;
// - hands: the key of the hands (put the plank in reach, or pick up the nearest plank);
// - talkTo { id }: walk to a person and talk;
// - talk { dialogue }: a talk now; travel: open the country map; refresh: the people again;
// - next, choose { n }: the next line of the open talk, or a choice;
// - closed: the view closed the screen that the session opened.
//
// Events (events()): the events of the world (see src/core/world/), and the events of the
// session: open { screen, ... } (dialogue, say, callout, rest, or a screen of a story effect:
// worldmap, confirmBattle, battle, vanmieu, trial, ...), close { screen }, map { map } (the hero
// went to another map), gift { from, give }, tapfx { x, y, h }, sound { sound }, busy { on }, hud (the
// counts or the goal changed), and halt (a trigger zone stopped the hero: the view drops the input).
import { findPath, pathNextTo, createTileMap } from './tilemap.js';
import { createTriggers } from './triggers.js';
import { currentGoal } from './quests.js';
import { pickTalk, isPresent, applyEffects, conditionState } from './game.js';
import { createDialogue } from './dialogue.js';
import { timeStatus } from './timelimit.js';
import { createWorldState, getEntity, query, command as worldCommand } from './world/state.js';
import { step as worldStep, STEP } from './world/step.js';
import { envFor, placesOf } from './world/env.js';
import { addHero, addFriend, syncPeople, addLifeLayer, addLanterns, addZones } from './world/populate.js';
import { ground } from './world/systems/ground.js';
import { REACH, learnerRecord } from './world/zones.js';
import { loadWorld, saveWorld, heroPlace, setHeroPlace } from './world/save.js';

export { STEP };

const WORLD = new Set(['move', 'stop', 'pet', 'ride', 'aim', 'pick', 'put', 'drop', 'guess', 'face']);
const GREETS = ['world.greet.1', 'world.greet.2', 'world.greet.3'];
const CALM_CELLS = 2; // the hero is on the bridge when nearer than this to a span that is not solid

// data: the data of the game (src/ui/data.js). profile: the profile of the player. learner():
// the learner of the profile, or null. log(kind, fields): the learning log (ctx.log). save(reason):
// save the profile. now(): the time in milliseconds (for the time limit). terrainOf(map, tileMap):
// the terrain of a map (for the homes of the people). switches: the switches of the experiments.
export function createSession({ data, profile, learner = () => null, log = () => null, save = () => {}, now = () => Date.now(), terrainOf = () => ({ homes: {} }), switches = null }) {
  const out = [];
  const emit = (ev) => out.push(ev);
  const arrivals = new Map(); // the token of a walk -> what to do at its end
  let nextToken = 1;
  let map = null;
  let tileMap = null;
  let triggers = null;
  let terrain = null;
  let env = null;
  let state = null;
  let heroTile = null;
  let visit = null;
  let screen = null; // the screen that is open now, or null
  let busy = false; // true while the world waits for a screen
  let pending = []; // what to do when the screen closes, one after the other
  let later = []; // what to do after the next step of the world (a second command for the hands)
  let resting = false;

  const hero = () => getEntity(state, 'hero');
  const heroCell = () => ({ x: hero().position.x / 2, y: hero().position.z / 2 });
  const groundY = (x, y) => env.groundY(x, y) / 2; // the top of the ground of a cell, in blocks
  const cond = () => conditionState(profile);

  // Start on a map. mapId: the map (or the map of the save, or the start map). params: at (the
  // hero cell), facing, after (the ids of talks after the start, for example after a battle).
  function start(mapId = null, params = {}) {
    const worldMap = data.world;
    const savedPlace = heroPlace(profile.world);
    const savedMap = worldMap.map(savedPlace.map) ? savedPlace.map : null;
    map = worldMap.map(mapId ?? savedMap ?? worldMap.start.map);
    tileMap = createTileMap(map, data.tiles.types);
    triggers = createTriggers(map.layers.triggers);
    terrain = terrainOf(map, tileMap) ?? { homes: {} };
    env = envFor(tileMap, { places: placesOf(map, tileMap), homes: terrain.homes ?? {}, day: data.day, zones: data.zones, switches });

    // The world state of this map. The save keeps the hero; the rest comes from the map and the seed.
    const onThisMap = profile.world.map === map.id;
    state = onThisMap ? loadWorld(profile.world) : createWorldState({ seed: profile.world.seed, map: map.id, clock: profile.world.clock });
    state.clock = profile.world.clock; // one clock: a travel on the country map moves it too
    // The placement zones and their cells, before the hero finds a free place.
    addZones(state, map, env);
    ground(state, 0, null, env);
    const saved = onThisMap && savedPlace.x !== null ? savedPlace : null;
    const at = freeSpot(tileMap, params.at ?? saved ?? map.spawn) ?? map.spawn;
    const was = getEntity(state, 'hero');
    if (was && !params.at && saved) {
      was.position.y = env.groundY(at.x, at.y);
    } else {
      if (was) state.entities.splice(state.entities.indexOf(was), 1);
      addHero(state, env, { x: at.x, y: at.y, facing: params.facing ?? 0 });
    }
    addLifeLayer(state, map, env, data.life);
    addLanterns(state, env);
    heroTile = { x: Math.floor(at.x), y: Math.floor(at.y) };
    arrivals.clear();
    screen = null;
    busy = false;
    pending = [];
    later = [];
    // The state of this map in the save.
    profile.maps ??= {};
    visit = (profile.maps[map.id] ??= { first: Math.round(state.clock.minutes), things: {} });
    visit.last = Math.round(state.clock.minutes);
    refreshPeople();
    if (!profile.flags['intro.seen']) talk('grandma.intro');
    for (const id of params.after ?? []) talk(id);
  }

  // Put the world into the save. When the hero went to another map, the save has the new place.
  function syncSave() {
    if (!state || profile.world.map !== state.map) return;
    profile.world.entities = saveWorld(state).entities;
  }

  // The end of the visit of this map (the scene closes, or the hero goes to another map).
  function leave() {
    if (!state) return;
    syncSave();
    const c = heroCell();
    visit.at = { x: Math.round(c.x * 100) / 100, y: Math.round(c.y * 100) / 100 };
    visit.last = Math.round(state.clock.minutes);
  }

  // People and encounters, in map cells. They block their cells for the paths of taps.
  const persons = () => query(state, 'person').map((e) => ({ ...e.person, x: e.position.x / 2, y: e.position.z / 2, entity: e.id }));
  function refreshPeople() {
    const npcs = data.npcs.npcs;
    syncPeople(state, map, env, (kind, item) => (kind === 'npc' ? Boolean(npcs[item.id]) && isPresent(npcs[item.id], profile) : isPresent(item, profile)), data.life.people, data.people);
    tileMap.clearOccupied();
    for (const p of persons()) tileMap.occupy(Math.floor(p.x), Math.floor(p.y), { kind: p.kind, id: p.ref });
    // A person of the quest stays out at night, with a lantern.
    const goal = currentGoal(data.quests.quests, cond());
    const wanted = new Set((goal?.step.targets ?? (goal?.step.target ? [{ npc: goal.step.target }] : [])).map((tg) => tg.npc).filter(Boolean));
    for (const p of persons()) if (p.kind === 'npc') worldCommand(state, { type: 'stay', id: p.entity, on: wanted.has(p.ref) });
    // The friend walks behind the hero.
    const friendId = profile.party[0];
    for (const f of query(state, 'follow')) if (f.id !== `friend:${friendId}`) state.entities.splice(state.entities.indexOf(f), 1);
    if (friendId && data.figures.figures[friendId] && !getEntity(state, `friend:${friendId}`)) addFriend(state, env, friendId);
    emit({ type: 'hud' });
  }

  function placeHero(x, y) {
    worldCommand(state, { type: 'place', id: 'hero', x: x * 2, z: y * 2 });
    heroTile = { x: Math.floor(x), y: Math.floor(y) };
    arrivals.clear();
  }

  // Screens --------------------------------------------------------------------

  // Do this now, or when the open screen closes.
  function queue(fn) {
    pending.push(fn);
    runPending();
  }
  function runPending() {
    while (!screen && pending.length) pending.shift()();
    if (!screen && busy) {
      busy = false;
      worldCommand(state, { type: 'pause', on: false });
      refreshPeople();
      emit({ type: 'busy', on: false });
    }
  }
  // Open a screen: the world waits until the view closes it.
  function openScreen(s, ev) {
    if (!busy) {
      busy = true;
      arrivals.clear();
      worldCommand(state, { type: 'stop', id: 'hero' });
      worldCommand(state, { type: 'pause', on: true });
      emit({ type: 'busy', on: true });
    }
    screen = s;
    emit({ type: 'open', screen: s.screen, ...ev });
  }
  function closeScreen() {
    if (!screen) return;
    const s = screen;
    screen = null;
    emit({ type: 'close', screen: s.screen });
    runPending();
  }

  // A talk: one open event for each line. The effects of a line run when the line shows.
  function talk(id) {
    if (!id) return;
    queue(() => {
      const def = data.dialogues.get(id);
      if (!def) return;
      const d = { screen: 'dialogue', id, runner: createDialogue(def, cond()), opens: [] };
      showLine(d, d.runner.view());
    });
  }
  function takeEffects(d) {
    const { commands, changes } = applyEffects(profile, d.runner.takeEffects(), { maxParty: data.game.battle.maxParty });
    for (const c of commands) {
      if (c.sound) emit({ type: 'sound', sound: c.sound });
      if (c.open) d.opens.push(c);
    }
    if (changes.flags.length || Object.keys(changes.items).length || changes.friends.length) save('dialogue');
  }
  function showLine(d, view) {
    takeEffects(d);
    if (!view) {
      // The end of the talk: then the screens that it asked for, one after the other.
      pending.unshift(...d.opens.map((c) => () => openCommand(c)));
      if (screen === d) closeScreen();
      else runPending();
      return;
    }
    openScreen(d, { id: d.id, mark: d.runner.mark, speaker: view.speaker, textKey: view.textKey, params: view.params, choices: view.choices.map((c) => c.textKey) });
  }
  // One line of text (a sign, a ferry, a thing that the hero found).
  function say(textKey, params = {}) {
    queue(() => openScreen({ screen: 'say' }, { speaker: 'narrator', textKey, params }));
  }
  // A screen of a story effect ({ open: 'worldmap' }, a battle, a trial).
  function openCommand(c) {
    syncSave();
    openScreen({ screen: c.open, cmd: c }, { cmd: c });
  }

  // Actions of trigger zones, people, and encounters -------------------------------

  function doAction(zone) {
    const a = zone.action;
    if (zone.once) profile.flags[`zone.${zone.id}`] = true;
    if (a.talk) {
      walkToPerson(a.talk);
      return;
    }
    if (a.move) {
      // A ferry: the hero and Nghé go to the other side of the river.
      say(a.textKey);
      queue(() => placeHero(a.move.x, a.move.y));
      return;
    }
    if (a.pickup || a.set) {
      const { changes } = applyEffects(profile, [{ give: a.pickup, set: a.set }]);
      emit({ type: 'sound', sound: 'pickup' });
      save('pickup');
      say(a.textKey, { n: Object.values(changes.items)[0] ?? 0 });
      return;
    }
    if (a.textKey) say(a.textKey);
    if (a.open) queue(() => openCommand({ open: a.open }));
  }

  function interact(who, at) {
    log('action', { kind: 'talk' });
    worldCommand(state, { type: 'face', id: 'hero', x: at.x * 2, z: at.y * 2 });
    if (who.kind === 'npc') talk(pickTalk(data.npcs.npcs[who.id], profile));
    else if (who.kind === 'encounter') {
      const enc = map.encounters.find((e) => e.id === who.id);
      queue(() => openCommand({ open: 'confirmBattle', id: enc.battle }));
    }
  }

  // Walks -------------------------------------------------------------------------

  // A walk on a path of cells around houses and water. The world sends the event "arrived" at
  // the end of the walk.
  function walkPath(path, end, onArrive, near = null) {
    if (!path) return;
    const points = path.map((p) => ({ x: (p.x + 0.5) * 2, z: (p.y + 0.5) * 2 }));
    for (const e of end ? [].concat(end) : []) points.push({ x: e.x * 2, z: e.y * 2 });
    const token = nextToken++;
    arrivals.clear();
    if (onArrive) arrivals.set(token, onArrive);
    worldCommand(state, { type: 'walk', id: 'hero', points, token, near: near ? { x: near.x * 2, z: near.y * 2, d: near.d * 2 } : null });
  }
  const heroFrom = () => {
    const c = heroCell();
    return { x: Math.floor(c.x), y: Math.floor(c.y) };
  };
  function walkToThing(target, onArrive) {
    const tile = { x: Math.floor(target.x), y: Math.floor(target.y) };
    walkPath(pathNextTo(tileMap, heroFrom(), tile), null, onArrive, { x: target.x, y: target.y, d: 2.2 });
  }
  function walkToPerson(id) {
    const p = persons().find((x) => x.kind === 'npc' && x.ref === id);
    // A person who sleeps in the house is not there to talk to.
    if (!p || screen || getEntity(state, p.entity)?.hidden) return;
    walkToThing(p, () => interact({ kind: 'npc', id }, p));
  }
  // Walk to a point (map cells) and then along more points, and then do something.
  function walkTo(points, onArrive) {
    const [first] = points;
    const path = findPath(tileMap, heroFrom(), { x: Math.floor(first.x), y: Math.floor(first.y) });
    if (!path) return false;
    walkPath(path.slice(0, -1), points, onArrive);
    return true;
  }

  // Placement: the planks that the hero can carry, the pile, and the broken bridge (a span).
  // The state is in half blocks; the taps and the paths are in map cells.
  const holding = () => hero().hands?.holds ?? null;
  const zoneOf = (id) => (id ? getEntity(state, `zone:${id}`) : null);
  const spans = () => query(state, 'zone').filter((z) => z.zone.rule === 'span');
  const distHb = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  // The span that has this cell, if it is not solid yet.
  const spanAt = (x, y) => spans().find(({ zone: z }) => !z.set && x >= z.x0 && x <= z.x1 && y >= z.start / 2 && y < z.end / 2);
  // The pile of the task of a thing.
  const pileFor = (thing) => zoneOf(data.zones[zoneOf(thing?.item.task)?.zone.task]?.pile);
  const reachCell = (z) => ({ x: z.position.x / 2, y: z.position.z / 2 });
  // Put the plank in the hands at the end of the planks of a span.
  function goPut(z) {
    walkTo([reachCell(z)], () => {
      worldCommand(state, { type: 'face', id: 'hero', x: z.zone.lane, z: z.zone.end });
      worldCommand(state, { type: 'put', id: 'hero', zone: z.zone.id });
    });
  }
  // Walk out on the planks of a span, to the point `to` (half blocks, along the gap).
  function goOnSpan(z, to) {
    const pts = [reachCell(z)];
    if (to > z.zone.from) pts.push({ x: z.zone.lane / 2, y: to / 2 });
    walkTo(pts, null);
  }
  function tapSpan(z) {
    const covered = z.zone.items.reduce((a, id) => a + (getEntity(state, id)?.item.size ?? 0), 0);
    if (holding()) goPut(z);
    else goOnSpan(z, z.zone.from + covered - 0.5);
  }
  function tapThing(thing) {
    log('action', { kind: 'place' });
    const m = middleOf(thing);
    emit({ type: 'tapfx', x: m.x / 2, y: m.z / 2, h: thing.position.y / 2 + 0.4 });
    const zone = zoneOf(thing.item.zone);
    if (zone?.zone.rule === 'span') {
      const last = zone.zone.items[zone.zone.items.length - 1] === thing.id;
      // At the edge, a tap on the last plank takes it back; from elsewhere the hero walks on it.
      if (!holding() && last && distHb(hero().position, zone.position) <= REACH) worldCommand(state, { type: 'pick', id: 'hero', item: thing.id });
      else if (holding()) goPut(zone);
      else goOnSpan(zone, thing.position.z + thing.item.size - 0.5);
      return;
    }
    const pick = () => worldCommand(state, { type: 'pick', id: 'hero', item: thing.id });
    const target = { x: m.x / 2, y: m.z / 2 };
    const held = getEntity(state, holding());
    // The child chose this plank now (the time to choose is a sign for the model); the hero walks.
    worldCommand(state, { type: 'aim', id: 'hero', item: thing.id });
    if (!held) return walkToThing(target, pick);
    if (held.id === thing.id) return;
    // The hands are full: put that plank back on its pile (or down), then take this one.
    const pile = pileFor(held);
    walkToThing(target, () => {
      if (pile && thing.item.zone === pile.zone.id) worldCommand(state, { type: 'put', id: 'hero', zone: pile.zone.id });
      else worldCommand(state, { type: 'drop', id: 'hero' });
      later.push(pick);
    });
  }
  // The key of the hands (Space): put the plank in reach, or pick up the nearest plank in reach.
  function handsKey() {
    if (hero().fall) return;
    const hp = hero().position;
    const held = getEntity(state, holding());
    if (held) {
      const span = spans().find((z) => !z.zone.set && distHb(hp, z.position) <= REACH);
      const pile = pileFor(held);
      const nearPile = pile && pile.zone.items.some((id) => {
        const e = getEntity(state, id);
        return e && distHb(hp, middleOf(e)) <= REACH + 3;
      });
      if (span) worldCommand(state, { type: 'put', id: 'hero', zone: span.zone.id });
      else if (nearPile) worldCommand(state, { type: 'put', id: 'hero', zone: pile.zone.id });
      else worldCommand(state, { type: 'drop', id: 'hero' });
      return;
    }
    let best = null;
    for (const e of query(state, 'item', 'position')) {
      if (e.hidden || e.item.set) continue;
      const zone = zoneOf(e.item.zone);
      const inSpan = zone?.zone.rule === 'span';
      if (inSpan && zone.zone.items[zone.zone.items.length - 1] !== e.id) continue;
      const d = inSpan ? distHb(hp, zone.position) : distHb(hp, middleOf(e)) - e.item.size / 2;
      if (d <= REACH && (!best || d < best.d)) best = { e, d };
    }
    if (best) worldCommand(state, { type: 'pick', id: 'hero', item: best.e.id });
  }

  // A tap: the hero, a plank outline, a plank, a person, a thing with a trigger zone, or a place
  // on the ground.
  function tap(target) {
    emit({ type: 'sound', sound: 'tap' });
    if (hero().fall) return;
    if (target.hero) {
      if (holding()) worldCommand(state, { type: 'drop', id: 'hero' });
      return;
    }
    // The prediction: a tap on the n-th plank outline says that the bridge takes n planks.
    if (target.guess) {
      worldCommand(state, { type: 'guess', id: 'hero', zone: target.guess.zone, n: target.guess.n });
      return;
    }
    if (target.thing) {
      const thing = getEntity(state, target.thing);
      if (thing?.item) tapThing(thing);
      return;
    }
    if (target.person) {
      const person = persons().find((p) => p.entity === target.person);
      if (!person) return;
      emit({ type: 'tapfx', x: person.x, y: person.y, h: groundY(person.x, person.y) });
      walkToThing(person, () => interact({ kind: person.kind, id: person.ref }, person));
      return;
    }
    const hit = target.ground;
    if (!hit) return;
    const from = heroFrom();
    // A house at night, with its family in: a knock. The lantern flickers and a soft sound comes
    // from inside; the house does not open (the village sleeps).
    if (hit.object && getEntity(state, `lantern:${hit.object}`)?.look === 'lantern-lit') {
      emit({ type: 'tapfx', x: hit.x, y: hit.y, h: hit.h });
      worldCommand(state, { type: 'knock', home: hit.object });
      return;
    }
    // A thing with a tap zone.
    const o = hit.object ? map.layers.objects.find((x) => x.id === hit.object) : null;
    const zone = o ? triggers.fire('tap', o.x, o.y, cond()) : null;
    if (zone) {
      const at = { x: o.x + o.w / 2, y: o.y + o.h / 2 };
      emit({ type: 'tapfx', x: at.x, y: at.y, h: groundY(at.x, at.y) });
      walkPath(pathNextTo(tileMap, from, { x: o.x + Math.floor(o.w / 2), y: o.y + o.h - 1 }) ?? pathNextTo(tileMap, from, o), null, () => doAction(zone),
        { x: at.x, y: at.y, d: Math.max(o.w, o.h) / 2 + 1.5 });
      return;
    }
    // The ground (or the foot of a thing without a zone).
    const tile = { x: Math.floor(hit.x), y: Math.floor(hit.y) };
    if (!tileMap.inside(tile.x, tile.y)) return;
    emit({ type: 'tapfx', x: hit.x, y: hit.y, h: hit.thing ? groundY(hit.x, hit.y) : hit.h });
    // The broken bridge: put the plank there, or walk out on the planks.
    const span = spanAt(tile.x, tile.y);
    if (span) {
      tapSpan(span);
      return;
    }
    // A tap zone on the ground is a thing that the hero cannot walk on (water, a field).
    // A tap on a free cell of the zone (the ford, a dike in the field) is a walk.
    const onGround = tileMap.isBlocked(tile.x, tile.y) ? triggers.fire('tap', tile.x, tile.y, cond()) : null;
    if (onGround) {
      walkPath(pathNextTo(tileMap, from, tile), null, () => doAction(onGround), { x: hit.x, y: hit.y, d: 2.2 });
      return;
    }
    log('action', { kind: 'walk' });
    if (tileMap.walkable(tile.x, tile.y)) walkPath(findPath(tileMap, from, tile)?.slice(0, -1), { x: hit.x, y: hit.y }, null);
    else walkPath(pathNextTo(tileMap, from, tile), null, null);
  }

  // The target of a tap at a map cell (x, y may have a fraction): what the scene finds under a
  // finger there. For the stories, and for tests.
  function targetAt(x, y) {
    const p = { x: x * 2, z: y * 2 };
    let best = null;
    const consider = (target, d, limit) => {
      if (d <= limit && (!best || d < best.d)) best = { target, d };
    };
    for (const g of query(state, 'guess', 'position')) {
      if (g.guess.left !== undefined) continue;
      consider({ guess: { zone: g.guess.zone, n: g.guess.n } }, distHb(p, { x: g.position.x, z: g.position.z + 2 }), 1.2);
    }
    if (best) return best.target;
    for (const e of query(state, 'item', 'position')) {
      if (e.hidden || e.item.set) continue;
      consider({ thing: e.id }, segmentDistance(p, e), 1.2);
    }
    for (const q of persons()) consider({ person: q.entity }, Math.hypot(q.x - x, q.y - y) * 2, 1.6);
    if (best) return best.target;
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    const o = map.layers.objects.find((b) => tx >= b.x && ty >= b.y && tx < b.x + b.w && ty < b.y + b.h);
    return { ground: { x, y, h: groundY(x, y), thing: Boolean(o), object: o?.id ?? null } };
  }

  // Events of a step ------------------------------------------------------------------

  // What the world did in a step, for the story: callouts, gifts, and the skill events.
  function worldEvent(ev) {
    if (ev.type === 'greet' && !busy) {
      const n = [...String(ev.id)].reduce((a, c) => a + c.charCodeAt(0), 0) + Math.floor(state.clock.minutes / 60);
      emit({ type: 'open', screen: 'callout', id: ev.id, textKey: GREETS[n % GREETS.length], params: { name: profile.hero.name } });
    }
    // The fisher calls out when a plank is too long.
    if (ev.type === 'call' && !busy) emit({ type: 'open', screen: 'callout', id: ev.id, textKey: ev.key, params: {} });
    if ((ev.type === 'solid' || ev.type === 'break') && ev.give) {
      // The gift flies from the thing to its counter in the HUD; no number is written in the world.
      applyEffects(profile, [{ give: ev.give }]);
      save(ev.type === 'solid' ? 'bridge' : 'pot');
      emit({ type: 'gift', from: ev.type === 'solid' ? ev.at : ev.id, give: ev.give, delay: ev.type === 'solid' ? 0.5 : 0 });
    }
    // A commit at a placement: a skill event for the learner (see learnerRecord). The commit goes
    // into the learning log too, with P(L) before and after.
    if (ev.type === 'skill') {
      const l = learner();
      const pBefore = l?.entry(ev.skill).p ?? null;
      const rec = learnerRecord(ev);
      if (rec) l?.record({ skill: ev.skill, level: rec.level }, rec.correct);
      const pAfter = l?.entry(ev.skill).p ?? null;
      log('attempt', {
        task: ev.task, skill: ev.skill, phase: 'commit', success: ev.solved, efficient: ev.efficient, first: ev.first, mashing: ev.mashing,
        parts: ev.parts, resets: ev.resets, latencies: ev.latencies, hint: ev.hint, hintSeen: ev.hintSeen, pBefore, pAfter, retry: false, harder: false, map: map.id,
      });
    }
    // The prediction before the first commit on a gap, and the result.
    if (ev.type === 'prediction') {
      log('prediction', { task: ev.task, gap: ev.gap, guess: ev.guess, used: ev.used, solved: ev.solved });
      save('prediction');
    }
  }

  // The hero walks into an exit: the next map starts.
  function goThrough(exit) {
    arrivals.clear();
    worldCommand(state, { type: 'stop', id: 'hero' });
    const c = heroCell();
    const to = data.world.arrival(exit, c.x, c.y);
    const facing = hero().position.facing;
    leave();
    setHeroPlace(profile.world, to.map, to.x, to.y);
    save('map');
    start(to.map, { at: { x: to.x, y: to.y }, facing });
    emit({ type: 'map', map: to.map });
  }

  // One step of the world, then the events of the step, the exits, and the trigger zones.
  function step() {
    worldStep(state, STEP, env);
    for (const fn of later.splice(0)) fn();
    const events = state.events;
    for (const ev of events) {
      out.push(ev);
      if (ev.id === 'sky') continue;
      if (ev.id !== 'hero') {
        worldEvent(ev);
        continue;
      }
      if (ev.type === 'arrived' || ev.type === 'stuck') {
        const fn = arrivals.get(ev.token);
        arrivals.delete(ev.token);
        if (ev.type === 'arrived') fn?.();
      }
    }
    checkRest();
    const c = heroCell();
    const tx = Math.floor(c.x);
    const ty = Math.floor(c.y);
    if (tx === heroTile.x && ty === heroTile.y) return;
    heroTile = { x: tx, y: ty };
    if (busy) return;
    const exit = data.world.exitAt(map.id, tx, ty, cond());
    if (exit) {
      goThrough(exit);
      return;
    }
    const zone = triggers.fire('enter', tx, ty, cond());
    if (zone) {
      arrivals.clear();
      worldCommand(state, { type: 'stop', id: 'hero' });
      emit({ type: 'halt' });
      doAction(zone);
    }
  }

  // The time limit: the hero goes home to rest at a calm point: no screen is open, the hands are
  // empty, and the hero is not on or next to a bridge that is not solid.
  function calm() {
    if (screen || busy || holding() || hero().fall) return false;
    const c = heroCell();
    return !spans().some(({ zone: z }) => !z.set && c.x >= z.x0 - CALM_CELLS && c.x <= z.x1 + CALM_CELLS && c.y >= z.start / 2 - CALM_CELLS && c.y < z.end / 2 + CALM_CELLS);
  }
  function timeOver() {
    const limit = profile.settings?.timeLimit;
    return Boolean(limit) && timeStatus(profile.time, limit, data.game.time.warnBeforeMin, now()) === 'over';
  }
  function checkRest() {
    if (resting || !timeOver() || !calm()) return;
    resting = true;
    save('time');
    openScreen({ screen: 'rest' }, {});
  }

  // Commands ---------------------------------------------------------------------------

  function command(cmd) {
    const type = cmd.type;
    if (type === 'next' || type === 'choose') {
      if (screen?.screen === 'dialogue') showLine(screen, screen.runner.next(type === 'choose' ? cmd.n : null));
      else if (screen?.screen === 'say') closeScreen();
      return;
    }
    if (type === 'closed') {
      if (screen && screen.screen !== 'dialogue' && screen.screen !== 'say') closeScreen();
      return;
    }
    if (type === 'refresh') {
      refreshPeople();
      return;
    }
    if (type === 'talk') {
      talk(cmd.dialogue);
      return;
    }
    if (busy) return;
    if (type === 'tap') tap(cmd.target ?? {});
    else if (type === 'hands') handsKey();
    else if (type === 'talkTo') walkToPerson(cmd.id);
    else if (type === 'travel') queue(() => openCommand({ open: 'worldmap' }));
    else if (WORLD.has(type)) {
      // A walk with the stick or the keys ends a walk of a tap.
      if (type === 'move' && cmd.strength) arrivals.clear();
      worldCommand(state, { id: 'hero', ...cmd });
    }
  }

  // The state as plain data: the map, the clock, the open screen, the kept entities (as in the
  // save), and the story state of the profile.
  function snapshot() {
    return structuredClone({
      map: map.id,
      minutes: state.clock.minutes,
      screen: screen?.screen ?? null,
      world: saveWorld(state),
      flags: profile.flags,
      inventory: profile.inventory,
      party: profile.party,
    });
  }

  return {
    start,
    command,
    step,
    // The events since the last call.
    events: () => out.splice(0),
    snapshot,
    targetAt,
    syncSave,
    leave,
    calm,
    persons,
    heroCell,
    holding,
    middleOf,
    get state() { return state; },
    get map() { return map; },
    get tileMap() { return tileMap; },
    get triggers() { return triggers; },
    get env() { return env; },
    get terrain() { return terrain; },
    get screen() { return screen?.screen ?? null; },
    get busy() { return busy; },
    get profile() { return profile; },
  };
}

// The middle of a thing that lies along its facing from its position (half blocks).
export function middleOf(e) {
  return {
    x: e.position.x + Math.sin(e.position.facing ?? 0) * e.item.size / 2,
    z: e.position.z + Math.cos(e.position.facing ?? 0) * e.item.size / 2,
  };
}

// The distance from a point to the line of a thing (half blocks).
function segmentDistance(p, e) {
  const q = e.position;
  const end = { x: q.x + Math.sin(q.facing ?? 0) * e.item.size, z: q.z + Math.cos(q.facing ?? 0) * e.item.size };
  const dx = end.x - q.x;
  const dz = end.z - q.z;
  const k = Math.max(0, Math.min(1, ((p.x - q.x) * dx + (p.z - q.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - (q.x + dx * k), p.z - (q.z + dz * k));
}

// The nearest free cell to a point (the point itself when it is free), or null.
export function freeSpot(tileMap, p) {
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
