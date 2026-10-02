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
//   { thing: id } (a plank), { person: entity id }, { sleeper: entity id } (a sleeping animal), or
//   { ground: { x, y, h, thing, object } }
//   (a point on the ground in map cells; object: the id of a map object there, or null).
//   targetAt(x, y) gives the target at a map cell, as a tap there;
// - hands: the key of the hands (put the plank in reach, or pick up the nearest plank);
// - talkTo { id }: walk to a person and talk;
// - talk { dialogue }: a talk now; travel: open the country map; refresh: the people again;
// - next, choose { n }: the next line of the open talk, or a choice;
// - closed: the view closed the screen that the session opened;
// - in a raid: shoot { count } (the slingshot at the wall: the pull counts half blocks along the
//   road), pour { source, x, y } (a drag of an element from a source to a map point), and pet (Nghé
//   charges). A tap on a post before the first shot is the prediction, a tap on the gate bars it,
//   a tap on a spot calls a villager, and a tap on the bamboo lets Gióng pull it.
//
// Events (events()): the events of the world (see src/core/world/), and the events of the
// session: open { screen, ... } (dialogue, say, callout, rest, or a screen of a story effect:
// worldmap, vanmieu, ...), close { screen }, map { map } (the hero went to another map), gift
// { from, give }, tapfx { x, y, h }, sound { sound }, busy { on }, hud (the counts or the goal
// changed), halt (a trigger zone stopped the hero: the view drops the input), raid { on, id } (a
// raid starts or its things went away), and lose { to, take } (the coins that an enemy took fly
// from the counter to it).
import { findPath, pathNextTo, createTileMap } from './tilemap.js';
import { createTriggers } from './triggers.js';
import { currentGoal } from './quests.js';
import { pickTalk, isPresent, applyEffects, conditionState } from './game.js';
import { createDialogue } from './dialogue.js';
import { timeStatus, addPlayTime } from './timelimit.js';
import { createWorldState, getEntity, query, addEntity, removeEntity, command as worldCommand } from './world/state.js';
import { step as worldStep, STEP } from './world/step.js';
import { envFor, placesOf } from './world/env.js';
import { addHero, addFriend, syncPeople, addLifeLayer, addLanterns, addZones } from './world/populate.js';
import { ground } from './world/systems/ground.js';
import { REACH, learnerRecord, canPut } from './world/zones.js';
import { setupTrial } from './world/systems/work.js';
import { levelFor, taskOf } from './world/trials.js';
import { createRaid, raidLevel } from './world/raids.js';
import { setupRaid, roadPoint } from './world/systems/raid.js';
import { lossLevel } from './profile.js';
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
  const listeners = new Set();
  let opening = []; // the events of the last start
  let starting = false;
  // Every event goes to the queue of the view and to the listeners (the runner of a story).
  const emit = (ev) => {
    out.push(ev);
    if (starting) opening.push(ev);
    for (const fn of listeners) fn(ev);
  };
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
  // hero cell), facing, after (the ids of talks after the start, for example after a travel).
  function start(mapId = null, params = {}) {
    opening = [];
    starting = true;
    try {
      begin(mapId, params);
    } finally {
      starting = false;
    }
  }
  function begin(mapId, params) {
    const worldMap = data.world;
    const savedPlace = heroPlace(profile.world);
    const savedMap = worldMap.map(savedPlace.map) ? savedPlace.map : null;
    map = worldMap.map(mapId ?? savedMap ?? worldMap.start.map);
    tileMap = createTileMap(map, data.tiles.types);
    triggers = createTriggers(map.layers.triggers);
    terrain = terrainOf(map, tileMap) ?? { homes: {} };
    env = envFor(tileMap, { places: placesOf(map, tileMap), homes: terrain.homes ?? {}, day: data.day, zones: data.zones, trials: data.trials, switches, joys: data.life?.joys ?? null });

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
      const h = addHero(state, env, { x: at.x, y: at.y, facing: params.facing ?? 0 });
      // A thing that travels (the rest of the loot) stays in the hands at the arrival.
      if (was?.hands?.holds && getEntity(state, was.hands.holds)) {
        h.hands.holds = was.hands.holds;
        if (was.carry) h.carry = was.carry;
      }
    }
    addLifeLayer(state, map, env, data.life);
    addLanterns(state, env);
    heroTile = { x: Math.floor(at.x), y: Math.floor(at.y) };
    arrivals.clear();
    raidEnc = null; // a raid does not go on in the save (its enemies leave with the map)
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
    // An enemy of a lost raid comes again at the next dawn (the flag raid.<id>.back holds the
    // minute of that dawn).
    const back = (item) => profile.flags[`raid.${item.raid}.back`];
    for (const e of map.encounters) if (back(e) !== undefined && back(e) <= state.clock.minutes) delete profile.flags[`raid.${e.raid}.back`];
    const present = (kind, item) => (kind === 'npc' ? Boolean(npcs[item.id]) && isPresent(npcs[item.id], profile) : isPresent(item, profile) && !(back(item) > state.clock.minutes));
    syncPeople(state, map, env, present, data.life.people, data.people);
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
    const { commands, changes } = applyEffects(profile, d.runner.takeEffects(), { maxParty: data.game.party.max });
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
    openScreen(d, { id: d.id, mark: d.runner.mark, speaker: view.speaker, mood: view.mood ?? 'calm', textKey: view.textKey, params: { ...trialWords(), ...view.params }, choices: view.choices.map((c) => c.textKey) });
  }
  // One line of text (a sign, a ferry, a thing that the hero found, a note with a seal, a line of
  // a person in a raid).
  function say(textKey, params = {}, mark = null, speaker = 'narrator') {
    queue(() => openScreen({ screen: 'say' }, { speaker, textKey, params, ...(mark ? { mark } : {}) }));
  }
  // A screen of a story effect ({ open: 'worldmap' }, Văn Miếu, a trial).
  function openCommand(c) {
    // A trial is work in the village: its things lie in the world, and no screen opens.
    if (c.open === 'trial') {
      startTrial(c.id);
      return;
    }
    syncSave();
    openScreen({ screen: c.open, cmd: c }, { cmd: c });
  }

  // The Five Trials (data/trials.json and src/core/world/systems/work.js) --------------------

  const trialDef = (id) => data.trials?.trials.find((t) => t.id === id) ?? null;
  const trialZone = (id) => getEntity(state, `zone:trial-${id}`);
  // The numbers of the trials at the level of the child, as words for the talks (num.<n>): the
  // rods of a bundle, the ore of the forge, the herbs of each kind, and the sticks of the stem.
  function trialWords() {
    const out = {};
    if (!data.trials) return out;
    const level = levelFor(data.trials, profile.grade);
    const num = (n) => ({ key: `num.${n}` });
    for (const def of data.trials.trials) {
      const t = taskOf(def, level);
      if (def.task === 'bundle') out.bundle = num(t.bundle);
      if (def.task === 'forge') out.ore = num(t.ore);
      if (def.task === 'basket') out.each = num(t.each);
      if (def.task === 'cut') out.parts = num(t.parts);
      if (def.task === 'slash') out.staffs = num(t.parts);
      if (def.task === 'horse') out.lumps = num(t.ore);
    }
    return out;
  }
  // Start a trial: its things lie at their places on this map, at the level of the grade.
  function startTrial(id) {
    const def = trialDef(id);
    if (!def || profile.flags[def.flag]) return;
    const places = Object.values(def.places).flat();
    if (!places.every((p) => env.places[p])) return;
    // The things that the child brought go into the task (the iron for the horse).
    if (def.take && !trialZone(id)) applyEffects(profile, [{ take: def.take }, ...(def.startSet ? [{ set: def.startSet }] : [])]);
    setupTrial(state, def, levelFor(data.trials, profile.grade), env);
    emit({ type: 'hud' });
  }
  // A trial is done: the flag, the reward that flies to the counters, and the done line.
  function trialDone(id) {
    const def = trialDef(id);
    if (def?.task === 'share') {
      shareDone();
      return;
    }
    if (!def || profile.flags[def.flag]) return;
    applyEffects(profile, [{ set: def.flag }, { give: def.reward }]);
    save('trial');
    const from = `npc:${def.npc}`;
    if (Object.keys(def.reward ?? {}).length) emit({ type: 'gift', from: getEntity(state, from) ? from : 'hero', give: def.reward, delay: 0.3 });
    emit({ type: 'hud' });
    // A task of the story may end with its own talk (rice for Gióng: Gióng grows up).
    talk(def.doneTalk ?? `${def.npc}.trial.done`);
  }
  // The zone of a task under a point on the ground (half blocks).
  const workZoneAt = (x, z) => query(state, 'zone').find((e) => {
    const r = e.zone.rect;
    return r && x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 && e.zone.task?.startsWith('trial-') && !trialZone(e.zone.task.slice(6))?.zone.done;
  }) ?? null;
  const work = (trial, act, extra = {}) => worldCommand(state, { type: 'work', id: 'hero', trial, act, ...extra });
  // Walk near a point (half blocks) and then do something.
  const walkNear = (p, fn) => {
    if (distHb(hero().position, p) <= REACH + 1) return fn();
    walkToThing({ x: p.x / 2, y: p.z / 2 }, fn);
  };
  // A tap on a thing of a trial. Return true when the tap was for the trial.
  function tapTrialThing(thing, along = null) {
    const trial = thing.item.task.slice(6);
    const tz = trialZone(trial);
    if (!tz || tz.zone.done) return false;
    if (thing.item.kind === 'rod') {
      // A rod of the heap goes on the mat; a rod on the mat goes back on the heap.
      const mat = zoneOf('mat');
      walkNear(mat.position, () => work(trial, thing.item.zone === 'mat' ? 'back' : 'add', { item: thing.id }));
      return true;
    }
    if (thing.item.kind === 'band') {
      walkNear(zoneOf('mat').position, () => work(trial, 'tie'));
      return true;
    }
    if (thing.item.kind === 'bellows') {
      walkNear(zoneOf('hearth').position, () => work(trial, 'blow'));
      return true;
    }
    if (thing.item.kind === 'iron') {
      walkNear(tz.zone.anvil, () => work(trial, 'quench'));
      return true;
    }
    if (thing.item.kind === 'culm') {
      // A standing culm of the bamboo clump: the hero walks to it and slashes at that height.
      const at = along ?? 1;
      walkNear({ x: thing.position.x + 2, z: thing.position.z }, () => work(trial, 'slash', { culm: thing.item.slot, at }));
      return true;
    }
    // A cut piece stands still in the clump.
    if (thing.item.kind === 'stump') return true;
    if (thing.item.kind === 'stem') {
      // On the stem of the woodcutter a tap puts a chalk mark.
      const at = along ?? thing.item.size / 2;
      walkNear({ x: thing.position.x + at, z: thing.position.z - 2 }, () => work(trial, 'mark', { at }));
      return true;
    }
    return false;
  }
  // A tap on the ground in the zone of a trial: put the thing in the hands there. Return true when
  // the tap was for the trial.
  function tapTrialZone(hit) {
    const wz = workZoneAt(hit.x * 2, hit.y * 2);
    if (!wz) return false;
    const trial = wz.zone.task.slice(6);
    const held = getEntity(state, holding());
    if (held && canPut(wz.zone, held)) {
      const at = { x: Math.round(hit.x * 2), z: Math.round(hit.y * 2) };
      const stand = wz.zone.rule === 'line' ? { x: at.x, z: wz.position.z } : wz.position;
      walkNear(stand, () => worldCommand(state, { type: 'put', id: 'hero', zone: wz.zone.id, at }));
      return true;
    }
    return false;
  }
  // A tap on a person of a trial with work to give: the healer takes the basket; the woodcutter
  // cuts at the marks. Return true when the tap was for the trial.
  function tapTrialPerson(person) {
    const def = data.trials?.trials.find((t) => t.npc === person.ref);
    const tz = def ? trialZone(def.id) : null;
    if (!tz || tz.zone.done) return false;
    const ready = (def.task === 'basket' && zoneOf('basket')?.zone.items.length) || (def.task === 'cut' && tz.zone.marks?.length);
    if (!ready) return false;
    walkToThing(person, () => {
      worldCommand(state, { type: 'face', id: 'hero', x: person.x * 2, z: person.y * 2 });
      work(def.id, def.task === 'basket' ? 'give' : 'cut');
    });
    return true;
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
      // No number in the text: the things fly from the hero to their counter in the HUD.
      const { changes } = applyEffects(profile, [{ give: a.pickup, set: a.set }]);
      emit({ type: 'sound', sound: 'pickup' });
      save('pickup');
      if (Object.keys(changes.items).length) emit({ type: 'gift', from: 'hero', give: changes.items, delay: 0 });
      say(a.textKey);
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
      const def = data.raids?.raids[enc.raid];
      if (!def) return;
      // One line, and then the raid starts on this map.
      say(def.introKey);
      queue(() => startRaid(enc.raid, enc.id));
    }
  }

  // Raids (data/raids.json, src/core/world/raids.js, and src/core/world/systems/raid.js) -----

  const raidEnt = () => getEntity(state, 'raid');
  const raidOn = () => Boolean(raidEnt());
  let raidEnc = null; // the encounter of the raid now (its figure hides while the raid goes on)
  // Start a raid on this map: the hero stands at the wall, and the enemies come.
  function startRaid(id, encId = null) {
    const def = data.raids?.raids[id];
    if (!def || def.map !== map.id || raidOn()) return false;
    const raid = createRaid(data.raids, id, raidLevel(data.raids, profile.grade), lossLevel(profile));
    setupRaid(state, raid, def, env, { helpers: data.raids.helperLooks, companion: data.raids.companions?.[def.companion] });
    placeHero(def.wall[0], def.wall[1]);
    worldCommand(state, { type: 'face', id: 'hero', x: raid.wall.x + raid.dir.x * 10, z: raid.wall.z + raid.dir.z * 10 });
    raidEnc = encId ? persons().find((p) => p.kind === 'encounter' && p.ref === encId)?.entity ?? null : null;
    const fig = raidEnc ? getEntity(state, raidEnc) : null;
    if (fig) fig.hidden = true;
    log('action', { kind: 'raid' });
    // The elder or the smith says one line the first time that a tool comes; the raid waits.
    for (const tool of raid.tools) {
      const line = data.raids.toolLines?.[tool];
      if (!line || profile.flags[`raid.tool.${tool}`]) continue;
      profile.flags[`raid.tool.${tool}`] = true;
      say(line.textKey, {}, null, line.speaker);
    }
    // A villager names the post for a trap (an ordinal word, no numeral).
    if (raid.trapPost !== null) {
      const n = raid.posts.findIndex((q) => q.d === raid.trapPost) + 1;
      say('raid.trap.ask', { post: { key: `ord.${n}` } }, null, def.trapAsk ?? 'elder');
    }
    emit({ type: 'raid', on: true, id });
    emit({ type: 'hud' });
    return true;
  }
  const order = (o) => worldCommand(state, { type: 'raid', id: 'raid', ...o });
  // The end of a raid: a win gives its flags, its gifts, and its talks; a loss keeps the raid for
  // another time (the enemies took some coins, and nothing else).
  function raidEnd(ev) {
    const r = raidEnt();
    const def = data.raids.raids[r?.raid.id];
    if (!def) return;
    profile.stats ??= {};
    if (ev.won) {
      profile.stats.battlesWon = (profile.stats.battlesWon ?? 0) + 1;
      const win = def.win ?? {};
      applyEffects(profile, [...[].concat(win.set ?? []).map((f) => ({ set: f })), ...(win.give ? [{ give: win.give }] : [])]);
      save('raid');
      if (win.give) emit({ type: 'gift', from: 'hero', give: win.give, delay: 0.6 });
      // A short, fair note with its seal (Legend or History), and a fact of history.
      if (def.noteKey) say(def.noteKey, {}, def.mark ?? null);
      if (def.historyKey) say(def.historyKey, {}, 'history');
      // A raid with loot: the share comes when the things of the raid are gone, and the talks
      // after it.
      if (def.loot) pendingShare = { loot: def.loot, wall: r.raid.wall, dir: r.raid.dir, after: win.after ?? [] };
      else for (const id of win.after ?? []) talk(id);
    } else {
      profile.stats.battlesLost = (profile.stats.battlesLost ?? 0) + 1;
      // The enemies come again at the next dawn, so that the child sleeps on it.
      profile.flags[`raid.${r.raid.id}.back`] = nextDawn(state.clock.minutes);
      save('raid');
      say('raid.lost');
    }
    emit({ type: 'hud' });
  }
  // An enemy at the gate took some coins: they leave the counter (never below nothing).
  function raidTake(ev) {
    const took = {};
    for (const [item, n] of Object.entries(ev.take ?? {})) {
      const have = profile.inventory[item] ?? 0;
      const k = Math.min(have, n);
      if (k <= 0) continue;
      profile.inventory[item] = have - k;
      took[item] = k;
    }
    if (Object.keys(took).length) {
      emit({ type: 'lose', to: ev.id, take: took });
      emit({ type: 'hud' });
    }
  }
  // The share of the loot behind the wall (a task of the world: src/core/world/systems/work.js).
  let pendingShare = null;
  function startShare() {
    const p = pendingShare;
    const def = trialDef('share');
    if (!p || !def) return;
    pendingShare = null;
    shareAfter = p.after;
    setupTrial(state, { ...def, at: p.wall, dir: p.dir, loot: p.loot }, levelFor(data.trials, profile.grade), env);
    say('share.start');
    emit({ type: 'hud' });
  }
  let shareAfter = [];
  // The share is fair: the coins of the hero go to the counter, the rest stays for the village,
  // and the things of the share go away.
  function shareDone() {
    const coins = getEntity(state, 'zone:share-hero')?.zone.items.length ?? 0;
    const rest = zoneOf('loot')?.zone.items.length ?? 0;
    if (coins) {
      applyEffects(profile, [{ give: { coin: coins } }]);
      emit({ type: 'gift', from: 'hero', give: { coin: coins }, delay: 0.3 });
    }
    save('share');
    for (const e of [...state.entities]) {
      if (e.item?.task === 'trial-share' || e.zone?.task === 'trial-share' || e.id === 'zone:trial-share' || String(e.id).startsWith('mat:share-') || String(e.id).startsWith('by:share-')) removeEntity(state, e.id);
    }
    const friend = query(state, 'follow').find((f) => f.follow.target === 'hero');
    if (friend) delete friend.follow.goal;
    if (rest) giveRest(rest);
    emit({ type: 'hud' });
    for (const id of shareAfter) talk(id);
    shareAfter = [];
  }
  // The rest of the loot: a red cloth with the coins goes into the hands of the hero. The child
  // carries it to one of the people of the rest in the village (tapGift).
  function giveRest(n) {
    const h = hero();
    const id = `gift:${state.tick}`;
    const look = `gift-${Math.min(2, n)}`;
    addEntity(state, { id, keep: true, item: { kind: 'gift', size: 1, task: 'gift', zone: null, held: 'hero', set: false, travels: true }, hidden: true, position: { ...h.position }, look });
    h.hands.holds = id;
    h.carry = look;
    say('share.rest');
  }
  // A tap on a person of the rest with the cloth in the hands: the person takes it and says one
  // line of thanks. Nothing is scored.
  function tapGift(person) {
    const held = getEntity(state, holding());
    const key = held?.item.kind === 'gift' ? trialDef('share')?.rest?.[person.ref] : null;
    if (!key) return false;
    walkToThing(person, () => {
      worldCommand(state, { type: 'face', id: 'hero', x: person.x * 2, z: person.y * 2 });
      const h = hero();
      if (h.hands.holds !== held.id) return;
      h.hands.holds = null;
      delete h.carry;
      removeEntity(state, held.id);
      emit({ type: 'sound', sound: 'pickup' });
      emit({ type: 'gave', id: person.entity, to: person.ref });
      emit({ type: 'open', screen: 'callout', id: person.entity, textKey: key, params: { name: profile.hero.name } });
      save('gift');
    });
    return true;
  }
  function raidOver() {
    const fig = raidEnc ? getEntity(state, raidEnc) : null;
    if (fig) fig.hidden = false;
    raidEnc = null;
    refreshPeople();
    emit({ type: 'raid', on: false });
  }
  // The slingshot is at the wall: the hero walks back there first when the hero is away.
  function shootFromWall(count) {
    const wall = raidEnt()?.raid.wall;
    if (!wall) return;
    if (distHb(hero().position, wall) <= 2) order({ act: 'shoot', count });
    else walkTo([{ x: wall.x / 2, y: wall.z / 2 }], () => order({ act: 'shoot', count }));
  }
  // A tap on the road with a trap in the hands: the trap goes there (the hero walks near first).
  function tapRaidRoad(hit) {
    const held = getEntity(state, holding());
    if (held?.item.kind !== 'trap') return false;
    const at = roadPoint(state, { x: hit.x * 2, z: hit.y * 2 });
    if (!at) return false;
    walkNear(at, () => worldCommand(state, { type: 'put', id: 'hero', zone: 'raid-road', at: { x: at.x, z: at.z } }));
    return true;
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
  function tapThing(thing, along = null) {
    log('action', { kind: 'place' });
    const m = middleOf(thing);
    emit({ type: 'tapfx', x: m.x / 2, y: m.z / 2, h: thing.position.y / 2 + 0.4 });
    if (thing.item.task?.startsWith('trial-') && tapTrialThing(thing, along)) return;
    if (thing.item.fixed || (thing.item.set && (thing.item.task === 'raid' || !zoneOf(thing.item.zone)))) return;
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
    // The hands are full: put that thing back on its pile (or down), then take this one.
    const pile = zoneOf(held.item.home) ?? pileFor(held);
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
      // A zone of a trial in reach that takes this thing.
      const wz = query(state, 'zone').find((z) => z.zone.rect && canPut(z.zone, held) && distHb(hp, z.position) <= REACH + 2);
      if (wz && wz.zone.rule !== 'line') {
        worldCommand(state, { type: 'put', id: 'hero', zone: wz.zone.id });
        return;
      }
      const span = spans().find((z) => !z.zone.set && distHb(hp, z.position) <= REACH);
      const pile = zoneOf(held.item.home) ?? pileFor(held);
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
      if (e.hidden || e.item.set || e.item.fixed || e.item.kind === 'rod') continue;
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
    if (target.raid) {
      const w = target.raid;
      if (w.what === 'gate') order({ act: 'bar' });
      else if (w.what === 'spot') order({ act: 'call', spot: w.id });
      else if (w.what === 'bamboo') order({ act: 'bamboo' });
      else if (w.what === 'post') order({ act: 'predict', post: w.id });
      return;
    }
    if (target.thing) {
      const thing = getEntity(state, target.thing);
      if (thing?.item) tapThing(thing, target.along ?? null);
      return;
    }
    // A sleeping animal flicks an ear, and sleeps on. Nothing more.
    if (target.sleeper) {
      const e = getEntity(state, target.sleeper);
      if (e?.position) emit({ type: 'tapfx', x: e.position.x / 2, y: e.position.z / 2, h: groundY(e.position.x / 2, e.position.z / 2) });
      worldCommand(state, { type: 'poke', id: target.sleeper });
      return;
    }
    if (target.person) {
      const person = persons().find((p) => p.entity === target.person);
      if (!person || (person.kind === 'encounter' && raidOn())) return;
      emit({ type: 'tapfx', x: person.x, y: person.y, h: groundY(person.x, person.y) });
      if (person.kind === 'npc' && (tapGift(person) || tapTrialPerson(person))) return;
      walkToThing(person, () => interact({ kind: person.kind, id: person.ref }, person));
      return;
    }
    const hit = target.ground;
    if (!hit) return;
    if (tapTrialZone(hit) || (raidOn() && tapRaidRoad(hit))) {
      emit({ type: 'tapfx', x: hit.x, y: hit.y, h: hit.h });
      return;
    }
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
    // The things of a raid that a tap is for: the gate, a spot, the bamboo.
    for (const e of query(state, 'raidTap', 'position')) consider({ raid: e.raidTap }, distHb(p, e.position), 2.2);
    if (best) return best.target;
    for (const e of query(state, 'item', 'position')) {
      // A standing culm needs the height of the finger: only the view (or a story) taps it.
      if (e.hidden || (e.item.set && !e.item.fixed) || e.item.kind === 'culm' || e.item.kind === 'stump') continue;
      const { d, along } = segment(p, e);
      consider(e.item.fixed ? { thing: e.id, along } : { thing: e.id }, d, 1.2);
    }
    for (const q of persons()) if (!getEntity(state, q.entity)?.hidden) consider({ person: q.entity }, Math.hypot(q.x - x, q.y - y) * 2, 1.6);
    if (best) return best.target;
    // A sleeping animal (the buffalo in the shade at noon).
    for (const e of query(state, 'act', 'position')) if (e.act === 'sleep' && !e.hidden) consider({ sleeper: e.id }, distHb(p, e.position), 3);
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
    if (ev.type === 'trial' && ev.done) trialDone(ev.trial);
    // The raid: the talks of the phases of the boss, the coins at the gate, and the end.
    if (ev.type === 'phase' && ev.dialogue) talk(ev.dialogue);
    if (ev.type === 'take') raidTake(ev);
    if (ev.type === 'end' && ev.id === 'raid') raidEnd(ev);
    if (ev.type === 'raidover') {
      raidOver();
      startShare();
    }
    // A load that the child chose and carried (a tray of rice): its size and the time of the walk.
    if (ev.type === 'carry') log('carry', { task: ev.task, size: ev.size, seconds: Math.round(ev.ticks * STEP * 10) / 10 });
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
    // The time of play in the village counts here, one step at a time (the app counts it in the
    // other scenes).
    if (profile.time) addPlayTime(profile.time, now(), STEP * 1000);
    worldStep(state, STEP, env);
    for (const fn of later.splice(0)) fn();
    const events = state.events;
    for (const ev of events) {
      emit(ev);
      if (ev.id === 'sky') {
        // At dawn the enemies of a lost raid come again, and the game saves the start of the day
        // (a restore point for the parent).
        if (ev.type === 'dawn') {
          refreshPeople();
          save('dawn');
        }
        continue;
      }
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
    if (screen || busy || holding() || hero().fall || raidOn()) return false;
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
      if (!screen || screen.screen === 'dialogue' || screen.screen === 'say') return;
      // Back from Văn Miếu: the hero stands next to its gate.
      const door = screen.screen === 'vanmieu' ? doorOf(data, 'vanmieu') : null;
      if (door?.map === map.id) placeHero(door.at.x, door.at.y);
      closeScreen();
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
    // The tools of a later era, for the stories and the debug panel: fell an object of the map, or
    // dig the top block of a column. The view builds the chunks of the change again.
    if (type === 'fell' || type === 'dig') {
      const r = terrain.edit?.(cmd) ?? null;
      if (r) emit({ type: type === 'fell' ? 'felled' : 'dug', id: cmd.id ?? null, at: r.at ?? null, kind: r.kind ?? null, drops: r.drops, chunks: r.chunks });
      return;
    }
    if (busy) return;
    // In a raid, a tap on Nghé is the charge only when Nghé is a tool of this raid.
    const charges = type === 'pet' && raidEnt()?.raid.tools.includes('nghe');
    if (raidOn() && (type === 'shoot' || type === 'pour' || charges)) {
      if (type === 'shoot') shootFromWall(cmd.count);
      else if (type === 'pour') order({ act: 'pour', source: cmd.source, x: cmd.x * 2, z: cmd.y * 2 });
      else order({ act: 'charge' });
      return;
    }
    if (type === 'tap') tap(cmd.target ?? {});
    else if (type === 'hands') handsKey();
    else if (type === 'talkTo') walkToPerson(cmd.id);
    // In a raid the map only pauses: it says where the enemies are, and it has no travel.
    else if (type === 'travel') queue(() => openCommand(raidOn() ? { open: 'worldmap', pauseKey: data.raids.raids[raidEnt().raid.id].pauseKey ?? null } : { open: 'worldmap' }));
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
    // The events of the last start (the intro, the talks after a map change), also when the view
    // took them already.
    opening: () => [...opening],
    // Also send each event to fn (for example the runner of a story). Return a function that stops it.
    listen(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    snapshot,
    targetAt,
    startTrial,
    startRaid,
    raidOn,
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
    // The data of the game (for the stories: the looks of the portraits).
    get data() { return data; },
  };
}

// The minute of the next dawn after a minute of the game clock (the middle of the dawn of the day
// data, 06:00).
export function nextDawn(minutes, dawnHour = 6) {
  const day = Math.floor(minutes / 1440) * 1440 + dawnHour * 60;
  return day > minutes ? day : day + 1440;
}

// The place next to the door of a trigger zone (the gate of Văn Miếu): where the hero stands
// after the screen of the door. { map, at } or null.
export function doorOf(data, id) {
  for (const [map, m] of data.maps) {
    const door = m.layers.triggers.find((z) => z.id === id);
    if (door) return { map, at: { x: door.x + door.w + 1.5, y: door.y + door.h / 2 } };
  }
  return null;
}

// The middle of a thing that lies along its facing from its position (half blocks).
export function middleOf(e) {
  if (e.item.kind === 'culm' || e.item.kind === 'stump') return { x: e.position.x, z: e.position.z };
  return {
    x: e.position.x + Math.sin(e.position.facing ?? 0) * e.item.size / 2,
    z: e.position.z + Math.cos(e.position.facing ?? 0) * e.item.size / 2,
  };
}

// The distance from a point to the line of a thing, and how far along the thing the nearest
// point is (half blocks, whole numbers).
function segment(p, e) {
  const q = e.position;
  const end = { x: q.x + Math.sin(q.facing ?? 0) * e.item.size, z: q.z + Math.cos(q.facing ?? 0) * e.item.size };
  const dx = end.x - q.x;
  const dz = end.z - q.z;
  const k = Math.max(0, Math.min(1, ((p.x - q.x) * dx + (p.z - q.z) * dz) / (dx * dx + dz * dz || 1)));
  return { d: Math.hypot(p.x - (q.x + dx * k), p.z - (q.z + dz * k)), along: Math.round(k * e.item.size) };
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
