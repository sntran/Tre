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
// - tap { target }: the child tapped a thing. A tap only walks: the hero walks there, and a thing,
//   a place, or a person becomes the target of the action button. target is one of
//   { guess: { zone, n } }, { thing: id, along }, { person: entity id }, { sleeper: entity id } (a
//   sleeping animal), or { ground: { x, y, h, thing, object } } (a point on the ground in map
//   cells; object: the id of a map object there, or null);
// - hands: the action button (or E) acts on its target; hold { on }: the button stays down
//   (the jar of feed pours, the mark of a slash goes up a culm) or goes up.
//   targetAt(x, y) gives the target at a map cell, as a tap there;
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
// raid starts or its things went away), and lose { to, take } (the goods that an enemy took fly
// from the counter to it).
import { findPath, pathNextTo, createPlaneTileMap, footprint } from './tilemap.js';
import { check } from './conditions.js';
import { createTriggers } from './triggers.js';
import { currentGoal, doneSteps } from './quests.js';
import { addXp, questSteps } from './growth.js';
import { noteSeen, entriesOfKey } from './notebook.js';
import { offOf, weekOf } from './learnlog.js';
import { snapFacts } from './planting.js';
import { clueLine as clueOf, hiddenAt, areaOf, inArea, openFinds, wayOf, wayPoint } from './clues.js';
import { pickTalk, isPresent, applyEffects, conditionState } from './game.js';
import { createDialogue } from './dialogue.js';
import { timeStatus, addPlayTime, remainingMs } from './timelimit.js';
import { createWorldState, getEntity, query, addEntity, removeEntity, command as worldCommand } from './world/state.js';
import { step as worldStep, STEP } from './world/step.js';
import { envFor, placesOf } from './world/env.js';
import { addHero, addFriend, syncPeople, addLifeGroups, addLanterns, addZones, addVillagers, sleepChunk } from './world/populate.js';
import { placeBySchedule, atWork } from './world/systems/schedule.js';
import { CHUNK, chunkOf, chunkKey } from '../world/terrain.js';
import { ground } from './world/systems/ground.js';
import { rainOf } from './world/systems/sky.js';
import { REACH, learnerRecord, canPut, canTake, spanSlot, nearestPoint } from './world/zones.js';
import { setupTrial, clearTrial, freeSlot, canTakeWork } from './world/systems/work.js';
import { levelFor, taskOf } from './world/trials.js';
import { nextLevel } from './practice.js';
import { createMentoring } from './mentoring.js';
import { playExample, stopExample } from './examples.js';
import { endScript } from './world/systems/mentor.js';
import { namesOf } from './naming.js';
import { createFolk } from './folk-session.js';
import { nearHero as talksNear } from './lines.js';
import { createPlanting } from './planting-session.js';
import { createHamlet } from './hamlet-session.js';
import { plotsOf } from './world/systems/plant.js';
import { jumpLength, planJump } from './world/jump.js';
import { MOVE, inputToward } from './world/move.js';
import { createRaid, raidLevel } from './world/raids.js';
import { setupRaid, roadPoint } from './world/systems/raid.js';
import { lossLevel } from './profile.js';
import { loadWorld, saveWorld, heroPlace, setHeroPlace } from './world/save.js';
import { dayOf, eventsOfDay, isEventDay, notAgain, eventLevel, eventTask, barterTask } from './world/days.js';
import { createRng, hashSeed } from './rng.js';
import { TILE } from './gen/tiles.js';

export { STEP };

const ZONE_PAD = 2; // half blocks: a place of a task answers a tap this far outside its box
const CUE_IDLE = 6; // seconds with no action in a task before the next thing glows
// The screens of a talk that the child fills in: they open at once, and the talk waits for them.
const INPUT_SCREENS = new Set(['nameFriend']);
// The commands that are an action of the child (they stop the cue).
const CHILD_ACTS = new Set(['tap', 'hands', 'hold', 'wave', 'jump', 'move', 'pet', 'talkTo', 'fire']);
const WORLD = new Set(['move', 'stop', 'pet', 'ride', 'aim', 'pick', 'put', 'drop', 'guess', 'face']);
// The words of a greeting by the age of the person (greet in data/npcs.json, #49): an old person
// says "Cháu ngoan quá!", a child greets a child as a friend, and a person with no greet (Gióng,
// the enemies) does not greet. A person greets one time, and not again for GREET_AGAIN seconds.
const GREETS = {
  elder: ['world.greet.1', 'world.greet.2', 'world.greet.3'],
  grown: ['world.greet.1', 'world.greet.2'],
  young: ['world.greet.1', 'world.greet.young'],
  child: ['world.greet.1', 'world.greet.child'],
};
const GREET_AGAIN = 300;
const CALM_CELLS = 2; // the hero is on the bridge when nearer than this to a span that is not solid
const LIVE = 2; // the live chunks: this many chunks on each side of the chunk of the hero (5 x 5)
const BACK = 1.5; // cells: two steps back from an edge of the world (a step of the hero is about 0.75 of a cell)

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
  // The last work in view (the event workView): the camera of a story tap leads toward it.
  let lastWork = null;
  const emit = (ev) => {
    if (ev.type === 'workView') lastWork = ev;
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
  // The practice of a visit from a practice link (src/core/practice.js), or null: { id, trial,
  // person, set, level, back, round, stayed }.
  let practice = null;
  // The mentors of the tasks: the person who gives a task watches the child and answers (docs/MENTOR.md).
  const mentoring = createMentoring({
    data, profile, learner, log, emit, world: () => state, env: () => env, nameOf: (id) => nameOf(id),
    // A bigger task: the next round of a practice is one level higher. A move never makes the task in
    // progress bigger (its line says "next time"); the memory of the mentor (lift) raises the next
    // small event one level.
    raise: (key) => {
      if (practice && key === `trial-${practice.trial}`) practice.level = Math.min(2, practice.level + 1);
    },
  });

  // The names of the people of the region of the map (src/core/naming.js, #38): id -> a text
  // parameter ("cô Năm" in the north).
  const names = () => namesOf(data, map?.region);
  const nameOf = (id) => names()[id] ?? { key: `npc.${id}.name` };
  // The small example of a station before its first round in this visit (#37; src/core/examples.js).
  const shownExamples = new Set();
  const examples = {
    play: (act, task) => {
      const shows = playExample(state, env, data, act, task, shownExamples);
      // The view turns so that nothing covers the example and its person (#38).
      const sc = shows ? getEntity(state, `script:example-${act}`)?.script : null;
      if (sc) {
        const who = getEntity(state, sc.steps.find((st) => st.say)?.say.id)?.position;
        const pts = [...sc.steps.filter((st) => st.spawn).map((st) => ({ x: st.spawn.x, y: env.groundY(st.spawn.x / 2, st.spawn.z / 2), z: st.spawn.z })), ...(who ? [who] : [])];
        emit({ type: 'workView', key: `example-${act}`, points: pts, sight: pts });
      }
      return shows;
    },
    stop: (act) => stopExample(state, act),
  };
  // The week of the device (src/core/learnlog.js, weekOf), for the history of the facts (#25).
  const week = () => weekOf(now(), profile.log?.tz ?? 0);
  if (profile.facts) snapFacts(profile, week());
  // The planting of Xóm Ruộng (docs/PLANTING.md): its sets, rounds, lines, and paddies.
  const planting = createPlanting({
    data, profile, learner, emit, mentoring, examples, week, world: () => state, env: () => env, map: () => map,
    seed: () => state.seed, clock: () => state.clock.minutes, rain: () => state.sky?.rain ?? 0,
    say: (...a) => say(...a), talk: (id) => talk(id), save: (why) => save(why), busy: () => busy,
    // The planter points to another station at the end of a set.
    point: () => hamlet.point('planting'),
    // A plot is full: a sheaf of the new rice goes to the feast table.
    sheaf: () => hamlet.sheaf(),
    // The end of a set of a practice of the planting: the practice ends there.
    setDone: () => {
      if (practice?.task !== 'planting') return false;
      practiceEnd('planter');
      return true;
    },
  });
  // The ducks, the fish traps, and the drum dance of Xóm Ruộng (docs/HAMLET.md).
  const hamlet = createHamlet({
    data, profile, learner, emit, mentoring, examples, nameOf, week, world: () => state, env: () => env,
    seed: () => state.seed, clock: () => state.clock.minutes, rain: () => state.sky?.rain ?? 0,
    say: (...a) => say(...a), talk: (id) => talk(id), save: (why) => save(why), busy: () => busy,
    grow: (kind) => grow(kind),
    callout: (textKey, params, who) => emit({ type: 'open', screen: 'callout', id: `npc:${who}`, textKey, params }),
    // The end of a set of a practice of an activity: the practice ends there.
    setDone: (act) => {
      if (practice?.task !== act) return false;
      practiceEnd(hamlet.personOf(act));
      return true;
    },
  });

  // The folk games of the village children: nhảy lò cò in Phù Đổng and nhảy dây at the feast of
  // Xóm Ruộng (docs/FOLKGAMES.md).
  const folk = createFolk({
    data: data.folkgames, profile, learner, emit, world: () => state, env: () => env, seed: () => state.seed,
    callout: (textKey, params, id) => emit({ type: 'open', screen: 'callout', id, textKey, params }),
    command: (c) => worldCommand(state, c), goTo: (p) => goTo(p, null), skill: (ev) => skillEvent(ev),
    feastOn: () => Boolean(hamlet.feast), practice: () => practice?.task ?? null, busy: () => busy || Boolean(screen), day: () => today(),
    setDone: (game) => {
      if (practice?.task !== game) return false;
      practiceEnd(practice.person);
      return true;
    },
  });
  const FOLK = new Set(['loco', 'rope']);

  const hero = () => getEntity(state, 'hero');
  const heroCell = () => ({ x: hero().position.x / 2, y: hero().position.z / 2 });
  const groundY = (x, y) => env.groundY(x, y) / 2; // the top of the ground of a cell, in blocks
  const cond = () => conditionState(profile);

  // Start on a map (the map of a region on the plane). mapId: the map (or the map of the save, or
  // the start map; the id of a place of a region is its map). params: at (the hero cell on the
  // plane), facing, after (the ids of talks after the start, for example after a travel), clock
  // (the minute of the game clock at the start), and practice (the practice of a visit from a
  // practice link: practiceStart in src/core/practice.js).
  function start(mapId = null, params = {}) {
    opening = [];
    starting = true;
    if (params.clock !== undefined) profile.world.clock.minutes = params.clock;
    practice = params.practice ? { ...params.practice, round: 0, stayed: false } : null;
    try {
      begin(mapId, params);
    } finally {
      starting = false;
    }
  }
  // The map and the hero cell of a start (before the hero finds a free place near the cell), so
  // that a view can load the height tiles of the land there first.
  function startPlace(mapId = null, params = {}) {
    const worldMap = data.world;
    const savedPlace = heroPlace(profile.world);
    const savedMap = worldMap.map(savedPlace.map) ? savedPlace.map : null;
    // The map with the land of the seed of the world.
    const m = worldMap.map(mapId ?? savedMap ?? worldMap.start.map, profile.world.seed);
    const saved = profile.world.map === m.id && savedPlace.x !== null ? savedPlace : null;
    const at = params.at ?? saved ?? m.spawn;
    return { map: m, x: at.x, y: at.y };
  }
  function begin(mapId, params) {
    const savedPlace = heroPlace(profile.world);
    map = startPlace(mapId, params).map;
    tileMap = createPlaneTileMap(map, data.tiles.types, { gone: (o) => Boolean(terrain?.isFelled?.(o)) });
    triggers = createTriggers(map.layers.triggers);
    terrain = terrainOf(map, tileMap) ?? { homes: {} };
    // The state of this map in the save, and the changes of the player to its land.
    profile.maps ??= {};
    const onThisMap = profile.world.map === map.id;
    visit = (profile.maps[map.id] ??= { first: Math.round(profile.world.clock.minutes), things: {} });
    terrain.loadEdits?.(visit.chunks ?? {});
    env = envFor(tileMap, { places: placesOf(map, tileMap), homes: terrain.homes ?? {}, fords: fordsOf(map), day: data.day, zones: data.zones, trials: data.trials, switches, joys: data.life?.joys ?? null });

    // The world state of this map. The save keeps the hero, and the kept entities of each chunk; the
    // rest comes from the map and the seed.
    state = onThisMap ? loadWorld(profile.world) : createWorldState({ seed: profile.world.seed, map: map.id, clock: profile.world.clock });
    state.clock = profile.world.clock; // one clock: a travel on the country map moves it too
    if (onThisMap) for (const rec of Object.values(visit.chunks ?? {})) for (const e of rec.entities ?? []) if (!getEntity(state, e.id)) addEntity(state, e);
    // The placement zones and their cells, before the hero finds a free place.
    addZones(state, map, env);
    addFerries();
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
    heroTile = { x: Math.floor(at.x), y: Math.floor(at.y) };
    live = new Set();
    liveAt = null;
    turning = null;
    arrivals.clear();
    raidEnc = null; // a raid does not go on in the save (its enemies leave with the map)
    mentoring.reset();
    screen = null;
    busy = false;
    pending = [];
    later = [];
    visit.last = Math.round(state.clock.minutes);
    updateLive(true);
    refreshPeople();
    placeEvents();
    planting.grow();
    hamlet.showTable();
    folk.mapStart();
    // A practice never has the prologue, and it does not set intro.seen (#37): the person of the
    // activity is ready and starts the task; in a practice of a whole place (no person) a person
    // of the place greets the child and points out the stations.
    if (FOLK.has(practice?.task)) folk.join(practice.task);
    else if (practice?.person) talk(`${practice.person}.trial`);
    else if (practice) greetPlace();
    else if (!profile.flags['intro.seen']) talk('grandma.intro');
    for (const id of params.after ?? []) talk(id);
  }

  // The start of a practice of a whole place (#37): the person who greets turns to the child, says
  // in one line that each person here has work, and points at the stations one after the other
  // (a mark on the ground at each one). The script plays in the world (src/core/world/systems/
  // mentor.js); a tap or a walk of the child does not stop it.
  const GREET = { say: 0.6, first: 3.4, each: 3.2 };
  function greetPlace() {
    const greeter = getEntity(state, `npc:${practice.greeter}`);
    if (!greeter) return;
    const hp = hero().position;
    greeter.position.facing = Math.atan2(hp.x - greeter.position.x, hp.z - greeter.position.z);
    const n = names();
    const steps = [{ at: GREET.say, say: { id: greeter.id, key: 'hamlet.greet', params: { planter: n.planter, duckGirl: n['duck-girl'], fisherUncle: n['fisher-uncle'], drummer: n.drummer } } }];
    let t = GREET.first;
    // The work of each station (data/world/hamlet.json stations: the work -> the person).
    const workOf = Object.fromEntries(Object.entries(data.hamlet?.stations ?? {}).map(([act, who]) => [who, act]));
    for (const id of practice.stations ?? []) {
      const p = getEntity(state, `npc:${id}`)?.position;
      if (!p) continue;
      // The head points, a mark lies at the station, the star of the station pulses (the station
      // is often off the screen of a phone), and the head says the name and the work (#45).
      steps.push({ at: t, point: { id: greeter.id, x: p.x, z: p.z, time: 1.5 } }, { at: t, mark: { x: p.x, z: p.z, ttl: 2.5 } }, { at: t, star: `npc:${id}` });
      if (workOf[id]) steps.push({ at: t, say: { id: greeter.id, key: `hamlet.point.${workOf[id]}`, params: { who: nameOf(id) } } });
      t += GREET.each;
    }
    steps.push({ at: t + 0.5, end: true });
    addEntity(state, { id: 'script:greet', script: { key: 'greet', move: 'greet', t: 0, i: 0, steps, spawned: [] } });
  }
  // A person of the practice: the person of the task, the person who greets at a whole place, or
  // the person of a station. The talks of the other people are of the story (#51).
  const ofPractice = (ref) => ref === practice?.person || ref === practice?.greeter || Boolean(practice?.stations?.includes(ref));
  // The persons of the stations of a practice of a whole place (a star over each one).
  const stations = () => (practice && !practice.person ? practice.stations ?? [] : []);

  // The fords of the stamps of a map (the cells of shallow water that people walk through).
  // The stepping stones in a ford (rock with shallow water beside it) close with it.
  function fordsOf(m) {
    const out = [];
    for (const s of m.land?.stamps ?? []) {
      const at = (x, y) => m.legend[s.ground[y]?.[x]];
      s.ground.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const t = m.legend[row[x]];
          const stone = t === 'rock' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === 'shallow');
          if (t === 'shallow' || stone) out.push({ x: s.x + x, y: s.y + y });
        }
      });
    }
    return out;
  }

  // The live chunks: the chunks around the hero, where the entities move and the systems run. When
  // a chunk wakes, its people and animals come (where their day puts them at this hour); when it
  // sleeps, they go, but a kept entity stays. The hero and Nghé never sleep.
  let live = new Set();
  let liveAt = null;
  let woken = new Set(); // the chunks that woke after the start, until the people come
  function updateLive(first = false) {
    const c = heroCell();
    const cx = Math.floor(c.x / CHUNK);
    const cz = Math.floor(c.y / CHUNK);
    const key = chunkKey(cx, cz);
    if (key === liveAt) return false;
    liveAt = key;
    const next = new Set();
    for (let dz = -LIVE; dz <= LIVE; dz++) for (let dx = -LIVE; dx <= LIVE; dx++) next.add(chunkKey(cx + dx, cz + dz));
    const woke = [...next].filter((k) => !live.has(k));
    const slept = [...live].filter((k) => !next.has(k));
    live = next;
    woken = first ? new Set() : new Set(woke);
    // The pages of the live chunks first: the houses of the people are there.
    terrain.hold?.('session', [...live]);
    for (const k of slept) sleepChunk(state, k);
    for (const k of woke) wake(k, first);
    return woke.length > 0 || slept.length > 0;
  }
  const inLive = (x, y) => live.has(chunkOf(Math.floor(x), Math.floor(y)));
  function wake(k, first) {
    const [cx, cz] = k.split(',').map(Number);
    const inK = (x, y) => chunkOf(Math.floor(x), Math.floor(y)) === k;
    const groups = [];
    map.layers.life.forEach((g, gi) => {
      if (inK(g.x, g.y)) groups.push({ ...g, key: gi, place: g.place ?? map.id, index: g.index ?? gi, chunk: k });
    });
    // A chunk lies in one tile of the land.
    const tx = Math.floor((cx * CHUNK) / TILE);
    const tz = Math.floor((cz * CHUNK) / TILE);
    const t = map.ready?.(tx, tz) ? map.land.tile(tx, tz) : null;
    t?.life.forEach((g, i) => {
      const id = `t${tx}_${tz}_${i}`;
      if (inK(g.x, g.y)) groups.push({ ...g, key: id, place: map.id, index: id, chunk: k });
    });
    const before = new Set(state.entities.map((e) => e.id));
    addLifeGroups(state, groups, env, data.life);
    const villagers = (t?.villagers ?? []).filter((v) => inK(v.x, v.y));
    for (const v of villagers) map.looks[v.id] = v.look;
    addVillagers(state, villagers.map((v) => ({ ...v, chunk: k })), env, data.life.people, data.people);
    addLanterns(state, env, { chunkOf: (x, z) => chunkOf(Math.floor(x / 2), Math.floor(z / 2)), only: (home, way) => inK(way.door.x / 2, way.door.z / 2) });
    // After the start, a chunk that wakes has its people where their day puts them now.
    if (!first) {
      const hour = (state.clock.minutes % 1440) / 60;
      for (const e of state.entities) if (!before.has(e.id) && e.schedule) placeBySchedule(e, hour, env);
    }
  }

  // A change of the land: fell a thing of the map, or dig a block. A felled thing opens its cells.
  function editLand(cmd) {
    const o = cmd.type === 'fell' ? terrain.objects?.find((x) => x.id === cmd.id) : null;
    const r = terrain.edit?.(cmd) ?? null;
    if (r && o) for (const [dx, dy] of footprint(o)) tileMap.setSolid(Math.floor(o.x) + dx, Math.floor(o.y) + dy, false);
    return r;
  }

  // Put the world into the save: the hero (and a thing that travels with the hero) in the world, and
  // for each chunk that the player changed, its changed cells and its kept entities. When the hero
  // went to another map, the save has the new place.
  function syncSave() {
    if (!state || profile.world.map !== state.map) return;
    const kept = saveWorld(state).entities;
    const hero = kept.find((e) => e.id === 'hero');
    const travels = kept.filter((e) => e.item?.travels && e.item.held === 'hero');
    profile.world.entities = [...(hero ? [hero] : []), ...travels];
    const chunks = terrain.edits?.() ?? {};
    for (const e of kept) {
      if (e.id === 'hero' || travels.includes(e) || !e.position) continue;
      const k = e.chunk ?? chunkOf(Math.floor(e.position.x / 2), Math.floor(e.position.z / 2));
      ((chunks[k] ??= {}).entities ??= []).push(e);
    }
    visit.chunks = chunks;
    delete visit.edits;
    // A practice does not move the hero of the save, until the child stays: the save keeps the
    // place before the visit (or no place).
    if (practice && !practice.stayed) keepBack();
  }
  function keepBack() {
    const b = practice.back;
    // A thing of the task in the hands stays at the task (a thing that travels goes with the hero).
    const h = profile.world.entities.find((e) => e.id === 'hero');
    if (h?.hands?.holds && !profile.world.entities.some((e) => e.id === h.hands.holds)) {
      h.hands = { holds: null };
      delete h.carry;
    }
    if (b) setHeroPlace(profile.world, b.map, b.x, b.y);
    else setHeroPlace(profile.world, profile.world.map, null, null);
  }

  // The end of the visit of this map (the scene closes, or the hero goes to another map).
  function leave() {
    if (!state) return;
    syncSave();
    const c = practice && !practice.stayed ? (practice.back ?? heroCell()) : heroCell();
    visit.at = { x: Math.round(c.x * 100) / 100, y: Math.round(c.y * 100) / 100 };
    visit.last = Math.round(state.clock.minutes);
  }

  // The farewell of Gióng (#51): Gióng gets on his iron horse and rides up the hill, a cloud comes
  // down over him, and then the horse, Gióng, and the cloud are gone. By day and at night.
  const FAREWELL = { end: 8, cloud: 6, up: 8, away: 4, high: 16 }; // seconds, and half blocks
  let farewell = null;
  function startFarewell() {
    const g = query(state, 'person').find((e) => e.person.ref === 'giong-sky');
    if (!g || farewell) return;
    const from = { ...g.position };
    const seat = data.raids?.raids?.boss?.steed ?? 1.8;
    addEntity(state, { id: 'farewell:steed', position: { ...from }, look: 'iron-steed' });
    addEntity(state, { id: 'farewell:giong', position: { ...from }, look: g.look, riding: seat });
    addEntity(state, { id: 'farewell:cloud', position: { ...from, y: from.y + FAREWELL.high }, look: 'cloud' });
    farewell = { t: 0, from };
    emit({ type: 'farewell', on: true, x: from.x / 2, y: from.z / 2, sound: 'win' });
  }
  function stepFarewell() {
    if (!farewell) return;
    farewell.t += STEP;
    const { from, t } = farewell;
    const k = Math.min(1, t / FAREWELL.end);
    const f = from.facing ?? 0;
    const at = { x: from.x + Math.sin(f) * FAREWELL.away * k, y: from.y + FAREWELL.up * k * k, z: from.z + Math.cos(f) * FAREWELL.away * k };
    for (const id of ['farewell:steed', 'farewell:giong']) {
      const e = getEntity(state, id);
      if (e) Object.assign(e.position, at);
    }
    const cloud = getEntity(state, 'farewell:cloud');
    if (cloud) Object.assign(cloud.position, { x: at.x, z: at.z, y: from.y + FAREWELL.high - (FAREWELL.high - FAREWELL.up + 2) * Math.min(1, t / FAREWELL.cloud) });
    if (t < FAREWELL.end) return;
    for (const id of ['farewell:steed', 'farewell:giong', 'farewell:cloud']) removeEntity(state, id);
    farewell = null;
    emit({ type: 'farewell', on: false });
  }

  // A success in a task (#62): the person of the task jumps (two jumps and a wave at the end of the
  // task), and the view shows a burst of leaves and, at the end, the seal that flies to the goal
  // bar. The jump goes on while a talk box is open (the world waits, the session does not).
  const CHEER = { hop: 0.5, wave: 0.9 };
  function cheer(ev) {
    const id = String(ev.trial ?? '');
    const person = id.startsWith('event-') ? getEntity(state, `event:${id.slice(6)}`) : getEntity(state, `npc:${trialDef(id)?.npc}`);
    if (person) person.cheer = { t: 0, hops: ev.end ? 2 : 1, wave: Boolean(ev.end), hop: CHEER.hop };
    emit({ type: 'cheer', by: person?.id ?? null, at: ev.at, end: Boolean(ev.end), trial: id });
  }
  function stepCheer() {
    for (const e of state.entities) {
      if (!e.cheer) continue;
      e.cheer.t += STEP;
      if (e.cheer.t >= e.cheer.hops * CHEER.hop + (e.cheer.wave ? CHEER.wave : 0)) delete e.cheer;
    }
  }

  // The growth of the hero (#8, src/core/growth.js): experience from a task, a raid, a step of a
  // quest, and a small event; the bamboo of the HUD grows one section for each level.
  function grow(kind, times = 1) {
    const r = addXp(profile, kind, times);
    if (r) emit({ type: 'growth', kind, ...r });
    return r;
  }
  // The notebook (#8, src/core/notebook.js): the things that the child meets. A new print sends the
  // event notebook (the view shows the print for a moment).
  function noteKey(key) {
    if (!data.notebook || !noteSeen(profile, key, state?.clock?.minutes ?? 0)) return;
    for (const e of entriesOfKey(data.notebook, key)) emit({ type: 'notebook', id: e.id, titleKey: e.titleKey, look: e.look ?? null, kind: e.kind });
  }
  const NOTE_NEAR = 20; // half blocks: an animal this near the hero is met
  const creatureKinds = () => new Set((data.notebook?.entries ?? []).filter((e) => e.met.startsWith('creature:')).map((e) => e.met.slice(9)));
  // About each second: the animals near the hero, the enemies of a raid, and the place of the map.
  function checkNotebook() {
    if (state.tick % 30 !== 15 || !data.notebook) return;
    const kinds = creatureKinds();
    const hp = hero()?.position;
    if (!hp) return;
    for (const e of state.entities) {
      if (!e.kind || !kinds.has(e.kind) || !e.position) continue;
      if (Math.hypot(e.position.x - hp.x, e.position.z - hp.z) <= NOTE_NEAR) noteKey(`creature:${e.kind}`);
    }
    for (const en of raidEnt()?.raid.enemies ?? []) if (kinds.has(en.kind)) noteKey(`creature:${en.kind}`);
    // A place: the hero is in the rect of its map on the plane.
    const c = heroCell();
    for (const p of map.source?.places ?? []) {
      const [x0, y0] = data.world.at(p.id, 0, 0);
      if (c.x >= x0 && c.y >= y0 && c.x < x0 + p.width && c.y < y0 + p.height) noteKey(`map:${p.id}`);
    }
  }

  // The done steps of the quests, about each second.
  function checkSteps() {
    if (state.tick % 30 !== 0 || !data.quests) return;
    const r = questSteps(profile, doneSteps(data.quests.quests, cond()));
    if (r) emit({ type: 'growth', kind: 'quest', ...r });
  }

  // The guess at the bridge (#51): when the plank outlines of the guess lie on the bank, a line says
  // what they are, one time in a visit: the fisher says it, or Nghé when the fisher is not there
  // (at home at night).
  let guessTold = false;
  function stepGuessLine() {
    if (guessTold || busy || screen) return;
    const outlines = query(state, 'guess', 'position').filter((g) => g.guess.left === undefined);
    if (!outlines.length) return;
    guessTold = true;
    const at = outlines[0].position;
    const fisher = getEntity(state, 'npc:fisher');
    const nghe = getEntity(state, 'friend:nghe');
    const here = atWork(fisher, state.clock.minutes) && Math.hypot(fisher.position.x - at.x, fisher.position.z - at.z) <= 40;
    if (here) emit({ type: 'open', screen: 'callout', id: fisher.id, textKey: 'mentor.bridge.guess', params: {} });
    else if (nghe && !nghe.hidden) emit({ type: 'open', screen: 'callout', id: nghe.id, textKey: 'mentor.nghe.bridge.guess', params: {} });
  }

  // People and encounters, in map cells. They block their cells for the paths of taps.
  const persons = () => query(state, 'person').map((e) => ({ ...e.person, x: e.position.x / 2, y: e.position.z / 2, entity: e.id }));
  function refreshPeople() {
    const npcs = data.npcs.npcs;
    // An enemy of a lost raid comes again at the next dawn (the flag raid.<id>.back holds the
    // minute of that dawn).
    const back = (item) => profile.flags[`raid.${item.raid}.back`];
    for (const e of map.encounters) if (back(e) !== undefined && back(e) <= state.clock.minutes) delete profile.flags[`raid.${e.raid}.back`];
    // Only the people of the live chunks are in the world.
    const present = (kind, item) => inLive(item.x, item.y) && (kind === 'npc' ? Boolean(npcs[item.id]) && isPresent(npcs[item.id], profile) : isPresent(item, profile) && !(back(item) > state.clock.minutes));
    const before = new Set(state.entities.map((e) => e.id));
    syncPeople(state, map, env, present, data.life.people, data.people);
    wayPeople();
    // A person of a chunk that woke after the start is where the day puts the person now.
    const hour = (state.clock.minutes % 1440) / 60;
    for (const e of query(state, 'person')) {
      if (!before.has(e.id) && e.schedule && woken.has(chunkOf(Math.floor(e.schedule.spot.x / 2), Math.floor(e.schedule.spot.z / 2)))) placeBySchedule(e, hour, env);
    }
    woken = new Set();
    tileMap.clearOccupied();
    for (const p of persons()) tileMap.occupy(Math.floor(p.x), Math.floor(p.y), { kind: p.kind, id: p.ref });
    updateStays();
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
    if (s.named) showNames(s, null, []);
    runPending();
  }

  // A talk: one open event for each line. The effects of a line run when the line shows.
  // The talks that the child heard in this visit (#49): a talk of a goal opens by itself one
  // time; after that, it opens only after a tap on the person (see the candidates of the button).
  const heard = new Set();
  function talk(id) {
    if (!id) return;
    heard.add(id);
    noteKey(`talk:${id}`);
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
    // A task that its line starts at once: the next lines name its things (#62).
    const atOnce = d.opens.filter((c) => c.now && c.open === 'trial');
    if (atOnce.length) {
      d.opens = d.opens.filter((c) => !atOnce.includes(c));
      for (const c of atOnce) openCommand(c);
    }
    // A screen that the child fills in (the name of Nghé) opens at once, and the talk goes on only
    // when the child closes it (#37). The other screens of a talk open at its end.
    const now = view ? d.opens.filter((c) => INPUT_SCREENS.has(c.open)) : [];
    if (now.length) {
      d.opens = d.opens.filter((c) => !INPUT_SCREENS.has(c.open));
      pending.unshift(...now.map((c) => () => openCommand(c)), () => showLine(d, view));
      if (screen === d) closeScreen();
      else runPending();
      return;
    }
    if (!view) {
      // The end of the talk: then the screens that it asked for, one after the other.
      pending.unshift(...d.opens.map((c) => () => openCommand(c)));
      if (screen === d) closeScreen();
      else runPending();
      return;
    }
    openScreen(d, { id: d.id, mark: view.mark, speaker: view.speaker, mood: view.mood ?? 'calm', textKey: view.textKey, params: { ...trialWords(), ...view.params }, choices: view.choices.map((c) => c.textKey), calling: view.calling });
    showNames(d, view.speaker, view.names);
  }
  // The things that a line names (#62): the person points at the first one, the view makes them
  // glow (a place glows as a rim on the ground) and shows them with the person above the talk box.
  // A line with no names after a line with names ends the glow, and so does the end of the talk.
  function showNames(d, speaker, list = []) {
    // The water of the last line goes back down.
    if (d.risen) {
      const water = getEntity(state, d.risen);
      if (water?.look === 'tide-1') water.look = 'tide-0';
      d.risen = null;
    }
    const named = list.map((n) => ({ ...n, e: getEntity(state, n.id) })).filter((n) => n.e?.position);
    const things = named.map((n) => n.e);
    if (!things.length && !d.named) return;
    d.named = things.length > 0;
    if (d.named) setCue([]);
    const rise = named.find((n) => n.act === 'rise' && n.e.look === 'tide-0');
    if (rise) {
      rise.e.look = 'tide-1';
      d.risen = rise.e.id;
    }
    const person = speaker ? getEntity(state, `npc:${speaker}`) : null;
    if (person && things.length) person.gesture = { act: 'point', x: things[0].position.x, z: things[0].position.z, t: 3 };
    // A place: the corners of its rect, so that all of it is in view.
    const pointsOf = (e) => {
      const r = e.zone?.rect;
      if (!r) return [{ ...e.position }];
      return [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]].map(([x, z]) => ({ x, y: e.zone.y, z }));
    };
    const places = things.filter((e) => e.zone);
    emit({
      type: 'names',
      ids: things.filter((e) => !e.zone).map((e) => e.id),
      spots: places.map((e) => spotOf(e.zone)),
      bobs: named.filter((n) => n.act === 'bob').map((n) => n.e.id),
      points: things.length ? [...things.flatMap(pointsOf), ...(person?.position ? [{ ...person.position }] : [])] : [],
    });
  }
  // One line of text (a sign, a ferry, a thing that the hero found, a note with a seal, a line of
  // a person in a raid).
  function say(textKey, params = {}, mark = null, speaker = 'narrator') {
    queue(() => openScreen({ screen: 'say' }, { speaker, textKey, params, ...(mark ? { mark } : {}) }));
  }
  // A screen of a story effect ({ open: 'worldmap' }, Văn Miếu, a trial).
  function openCommand(c) {
    // The farewell of Gióng: a short scene in the world, and no screen opens (#51).
    if (c.open === 'farewell') {
      startFarewell();
      return;
    }
    // A trial is work in the village: its things lie in the world, and no screen opens.
    if (c.open === 'trial') {
      startTrial(c.id);
      return;
    }
    // The planting of Xóm Ruộng: a set of plots (docs/PLANTING.md).
    if (c.open === 'planting') {
      planting.start();
      return;
    }
    // The ducks, the fish traps, or the drum dance (docs/HAMLET.md).
    if (c.open === 'ducks' || c.open === 'traps' || c.open === 'drum') {
      hamlet.start(c.open);
      return;
    }
    // The choice at the end of a set of a practice: stay and play on, or go back.
    if (c.open === 'practice-stay' || c.open === 'practice-back') {
      practiceChoice(c.open === 'practice-stay');
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
      const t = taskOf(def, practice?.trial === def.id ? practice.level : level);
      if (def.task === 'bundle') out.bundle = num(t.bundle);
      if (def.task === 'forge') out.ore = num(t.ore);
      if (def.task === 'basket') out.each = num(t.each);
      if (def.task === 'cut') out.parts = num(t.parts);
      if (def.task === 'slash') out.staffs = num(t.parts);
      if (def.task === 'horse') out.lumps = num(t.ore);
    }
    return out;
  }
  // Start a trial: its things lie at their places on this map, at the level of the grade. The
  // trial of a practice starts again and again (at the level of the practice), with new things.
  function startTrial(id) {
    const def = trialDef(id);
    const practicing = practice?.trial === id;
    if (!def || (!practicing && profile.flags[def.flag])) return;
    const places = Object.values(def.places).flat();
    if (!places.every((p) => env.places[p])) return;
    // The things of a done round (of a practice) go first.
    if (practicing || trialZone(id)?.zone.done) clearTrial(state, id);
    // The things that the child brought go into the task (the iron for the horse).
    if (def.take && !trialZone(id)) applyEffects(profile, [{ take: def.take }, ...(def.startSet ? [{ set: def.startSet }] : [])]);
    // In a later round of a practice, the smith does not show his quench again.
    setupTrial(state, def, practicing ? practice.level : levelFor(data.trials, profile.grade), env, { demo: !(practicing && practice.round > 0), practice: practicing });
    mentoring.start(`trial-${id}`);
    emit({ type: 'hud' });
    // The teacher says how many bundles he needs, while the pips of the goal bar light up one at a
    // time (#61: before, only the pips showed it).
    const need = workCount()?.need ?? 0;
    if (need >= 1 && need <= 4) {
      emit({ type: 'goalShow', n: need });
      emit({ type: 'open', screen: 'callout', id: `npc:${def.npc}`, textKey: `teacher.need.${need}`, params: {} });
    }
  }
  // A trial is done: the flag, the reward that flies to the counters, and the done line.
  function trialDone(id) {
    const def = trialDef(id);
    if (def?.task === 'share') {
      shareDone();
      return;
    }
    if (practice?.trial === id) {
      practiceRound(def);
      return;
    }
    if (!def || profile.flags[def.flag]) return;
    applyEffects(profile, [{ set: def.flag }, { give: def.reward }]);
    grow('task');
    save('trial');
    const from = `npc:${def.npc}`;
    if (Object.keys(def.reward ?? {}).length) emit({ type: 'gift', from: getEntity(state, from) ? from : 'hero', give: def.reward, delay: 0.3 });
    emit({ type: 'hud' });
    // A task of the story may end with its own talk (rice for Gióng: Gióng grows up).
    talk(def.doneTalk ?? `${def.npc}.trial.done`);
  }
  // A round of the practice is done. The level of the next round comes from the commits of this
  // one. After the rounds of a set, the person thanks the child (the reward flies to the counters),
  // and the child chooses to stay or to go back. The flag of the trial of the story stays as it is.
  function practiceRound(def) {
    const z = trialZone(def.id).zone;
    practice.round += 1;
    grow('round');
    practice.level = nextLevel(practice.level, z, def.levels.length - 1);
    const rec = (profile.practice ??= {})[practice.id] ??= { level: practice.level, sets: 0 };
    rec.level = practice.level;
    if (practice.round < practice.set) {
      save('practice');
      say('practiceLink.again', {}, null, def.npc);
      queue(() => startTrial(def.id));
      return;
    }
    practice.round = 0;
    rec.sets += 1;
    applyEffects(profile, [{ give: def.reward }]);
    save('practice');
    const from = `npc:${def.npc}`;
    if (Object.keys(def.reward ?? {}).length) emit({ type: 'gift', from: getEntity(state, from) ? from : 'hero', give: def.reward, delay: 0.3 });
    emit({ type: 'hud' });
    emit({ type: 'practice', id: practice.id, sets: rec.sets, level: practice.level });
    log('set', { activity: practice.id, end: 'done' });
    talk(`${def.npc}.practice.end`);
  }
  // Stay: the position of the profile is here from now on, and a new set starts. Go back: the hero
  // goes to the place before the visit (the view shows a short change), or to the start of the game
  // when the profile had no place.
  function practiceChoice(stay) {
    log('set', { activity: practice.id, end: stay ? 'stay' : 'back' });
    if (stay) {
      practice.stayed = true;
      save('practice');
      if (practice.task === 'planting') planting.start();
      else if (FOLK.has(practice.task)) folk.join(practice.task);
      else if (practice.task) hamlet.start(practice.task);
      else startTrial(practice.trial);
      return;
    }
    syncSave();
    save('practice');
    emit({ type: 'goBack', id: practice.id, to: practice.back });
  }
  // The zone of a task under a point on the ground (half blocks).
  // The zone of a task under a point on the ground (half blocks). A place of a task answers a tap
  // on its whole box with a pad around it (ZONE_PAD), so that a finger near the edge hits it.
  // A place that has the point comes before a place that only has it in its pad (#47).
  const workZoneAt = (x, z, pad = ZONE_PAD) => {
    const off = (e) => {
      const r = e.zone.rect;
      return Math.max(r.x0 - x, x - r.x1, r.z0 - z, z - r.z1, 0);
    };
    const near = query(state, 'zone').filter((e) => e.zone.rect && off(e) <= pad && e.zone.task?.startsWith('trial-') && !trialZone(e.zone.task.slice(6))?.zone.done);
    return near.reduce((a, b) => (!a || off(b) < off(a) ? b : a), null);
  };
  // A chalk mark and a slash are tries of the child in the task, as a put is (#54).
  const work = (trial, act, extra = {}) => {
    if (act === 'mark' || act === 'slash') childPut.add(`trial-${trial}`);
    return worldCommand(state, { type: 'work', id: 'hero', trial, act, ...extra });
  };
  // A tap only walks: on a thing, a place, or a person, the hero walks there and turns to it, and
  // it becomes the target of the action button (docs/TASKS.md). A tap never does a step of a task.
  let chosen = null; // the last tap: { id (an entity), along (a place along a stem or a line) }
  // p: the point of the target (half blocks); stand: where the hero walks to (p when not given).
  // A press while the hero walks to the target of a tap waits for the end of the walk (#47).
  let pressAfterWalk = false;
  function goTo(p, id, along = null, stand = p) {
    chosen = { id, along };
    pressAfterWalk = false;
    const face = () => {
      worldCommand(state, { type: 'face', id: 'hero', x: p.x, z: p.z });
      if (pressAfterWalk) {
        pressAfterWalk = false;
        act(true);
      }
    };
    // Near enough to act there: only a turn to it.
    if (distHb(hero().position, stand) <= REACH - 1) return face();
    walkToThing({ x: stand.x / 2, y: stand.z / 2 }, face);
  }
  // A tap on a place of a task: the hero walks to it, and it is the target. On the line of stakes,
  // the place of the tap along the line is the target place.
  // The point of a place is the middle of its rect; the hero stands at its stand point to work
  // there (src/core/world/systems/work.js).
  const standOf = (wz) => wz.zone.stand ?? wz.position;
  // The point of a place nearest to p (half blocks): in its rect, or its point.
  const nearIn = nearestPoint;
  function tapTaskPlace(hit) {
    const wz = workZoneAt(hit.x * 2, hit.y * 2);
    if (!wz) return false;
    const z = wz.zone;
    if (z.rule === 'line') {
      const along = Math.max(1, Math.min(z.length, Math.round(hit.x * 2 - z.x)));
      goTo({ x: z.x + along, z: z.z }, wz.id, along, { x: z.x + along, z: standOf(wz).z });
    } else if (z.rule === 'spots') {
      // A spot in the stream: the free spot nearest to the tap is the target place.
      const k = freeSlot(state, z, { x: hit.x * 2, z: hit.y * 2 });
      if (k >= 0) goTo(z.slots[k], wz.id, k);
      else goTo(wz.position, wz.id, null, standOf(wz));
    } else goTo(wz.position, wz.id, null, standOf(wz));
    return true;
  }
  // The hold of the action button (the jar of feed, the slash at a culm): the act goes on while the
  // button is down, and its end comes when the button goes up.
  let holdAct = null;
  function hold(on) {
    if (!on) {
      const a = holdAct;
      holdAct = null;
      a?.release?.();
      return;
    }
    const a = pressAct();
    if (!a?.hold || busy) return;
    holdAct = a;
    a.run();
    acted();
    emit({ type: 'pulse', id: a.target });
  }
  // The end of a set of a practice: the reward, and the choice to stay or go back.
  function practiceEnd(person) {
    const rec = (profile.practice ??= {})[practice.id] ??= { level: practice.level ?? 0, sets: 0 };
    rec.sets += 1;
    applyEffects(profile, [{ give: { rice: 3 } }]);
    save('practice');
    emit({ type: 'gift', from: `npc:${person}`, give: { rice: 3 }, delay: 0.3 });
    emit({ type: 'practice', id: practice.id, sets: rec.sets, level: rec.level });
    log('set', { activity: practice.id, end: 'done' });
    talk(`${person}.practice.end`);
  }

  // The small events of each day (data/world/events.json, src/core/world/days.js) -------------

  const eventDef = (id) => data.events?.events.find((d) => d.id === id) ?? null;
  const today = () => dayOf(state.clock.minutes);
  // All the things of an event (its zones, its things, its marks, its person, and its cart).
  function clearEvent(id) {
    const owner = `trial-event-${id}`;
    for (const e of [...state.entities]) {
      const mine = e.id === `zone:${owner}` || e.item?.task === owner || e.zone?.task === owner || e.id === `mark:event-${id}` || e.id === `wares:event-${id}` || e.dayEvent?.id === id;
      if (mine && e.id !== holding()) removeEntity(state, e.id);
    }
  }
  // The events of today on this map: the person (and the cart) at the spot of each one. The events
  // of another day go, with their things; an event that the child did today does not come again.
  function placeEvents(force = null) {
    if (!data.events) return;
    const day = today();
    for (const e of query(state, 'dayEvent')) if (e.dayEvent.day !== day) clearEvent(e.dayEvent.id);
    for (const z of query(state, 'zone')) if (z.zone.event && z.zone.day !== day) clearEvent(z.zone.event);
    // The land is wet after a rain today (when it is over) and on the next day.
    const rain = rainOf(state.seed, day, data.day ?? undefined);
    const hour = (state.clock.minutes % 1440) / 60;
    const wet = Boolean(rainOf(state.seed, day - 1, data.day ?? undefined)) || Boolean(rain && hour >= rain.end);
    // The events of each area near the hero (each place, and each tile of the land of the live
    // chunks), at the spots of the live chunks; of two events of one kind, the nearer one comes.
    const areas = eventAreas();
    const c = heroCell();
    const found = [];
    for (const a of areas) for (const ev of eventsOfDay(data.events, { seed: state.seed, day, map: a.key, spots: a.spots, wet })) found.push({ ...ev, area: a.key, d: Math.hypot(ev.at[0] - c.x, ev.at[1] - c.y) });
    found.sort((p, q) => p.d - q.d);
    const list = found.filter((ev, i) => found.findIndex((x) => x.id === ev.id) === i);
    // A story or the debug panel can bring an event today, at its first spot (of the nearest area).
    const where = eventDef(force)?.where;
    const byPlace = [...areas.filter((a) => map.spotsByPlace?.[a.key]), ...areas.filter((a) => !map.spotsByPlace?.[a.key])];
    const area = where ? byPlace.find((a) => a.spots[where]?.length) : null;
    if (force && !list.some((x) => x.id === force) && area) list.push({ id: force, at: area.spots[where][0], area: area.key });
    // An event (but the market of a hamlet, and an event that a story brings) does not come at the
    // spot of yesterday.
    const kept = notAgain(list, found, day, (id) => visit.things[`event.${id}.spot`], (id) => Boolean(eventDef(id)?.every) || id === force);
    for (const ev of kept) {
      const def = eventDef(ev.id);
      if (!def || visit.things[`event.${ev.id}`] === day || getEntity(state, `event:${ev.id}`)) continue;
      // No market in a practice: it would send the child away from the work (#45).
      if (practice && def.barter && ev.id !== force) continue;
      visit.things[`event.${ev.id}.spot`] = `${day}:${ev.at[0]},${ev.at[1]}`;
      const rng = createRng(hashSeed(`${state.seed}:event-place:${ev.id}:${day}`));
      // The person stands on open ground near the spot (not in a narrow lane), on a cell of her own:
      // never where another person stands (#42).
      const others = peopleCells(null);
      // A seller of a market day sits at her stall from the start, on open ground that the child can
      // walk to (#42): the mat, her seat, and her tray each have open cells all around.
      const open = (q) => [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => tileMap.walkable(Math.floor(q.x) + dx, Math.floor(q.y) + dy))) && !others.some((o) => Math.hypot(o.x - q.x, o.y - q.y) < 1.5);
      const stall = def.barter ? marketStall(ev.at, open) : null;
      const stand = stall?.seat ?? nearFree(ev.at, 2, 5, rng, others, 1) ?? nearFree(ev.at, 1, 6, rng, others) ?? { x: ev.at[0] + 0.5, y: ev.at[1] + 0.5 };
      addEntity(state, {
        id: `event:${ev.id}`,
        chunk: chunkOf(ev.at[0], ev.at[1]),
        dayEvent: { id: ev.id, day, at: ev.at, area: ev.area, ...(stall ? { stall } : {}) },
        person: { kind: 'event', ref: ev.id },
        position: { x: stand.x * 2, y: env.groundY(stand.x, stand.y), z: stand.y * 2, facing: 0 },
        motion: { vx: 0, vz: 0, speed: 0 },
        solid: { r: 1.8 },
        look: def.person,
      });
      if (def.prop === 'cart') {
        addEntity(state, { id: `event:${ev.id}:cart`, chunk: chunkOf(ev.at[0], ev.at[1]), dayEvent: { id: ev.id, day, at: ev.at }, position: { x: ev.at[0] * 2 + 1, y: env.groundY(ev.at[0], ev.at[1]) - 0.5, z: ev.at[1] * 2 + 1, facing: 0.3 }, solid: { r: 2.2 }, look: 'cart' });
      }
    }
  }
  // The people of the way of a find (#56): while the find is open, they stand on its road (in the
  // live chunks) and greet the hero, with the clues of the way. They go when the find is found.
  const WAY_CALL = 24; // half blocks: a person of the way greets the hero this far away
  function wayPeople() {
    if (!data.clues || !data.world?.at) return;
    const want = new Set();
    for (const f of openFinds(data.clues, profile.flags)) {
      const way = wayOf(f, data.world.at);
      for (const w of way ? f.people ?? [] : []) {
        const p = wayPoint(way, w.at);
        if (!inLive(p.x, p.y)) continue;
        const id = `way:${w.id}`;
        want.add(id);
        if (getEntity(state, id)) continue;
        // A free cell of the road near the point.
        let spot = null;
        for (let r = 0; r <= 4 && !spot; r++) {
          for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) if (tileMap.walkable(Math.floor(p.x) + dx, Math.floor(p.y) + dy)) spot = { x: Math.floor(p.x) + dx + 0.5, y: Math.floor(p.y) + dy + 0.5 };
        }
        if (!spot) continue;
        addEntity(state, {
          id,
          chunk: chunkOf(Math.floor(spot.x), Math.floor(spot.y)),
          person: { kind: 'way', ref: w.id },
          position: { x: spot.x * 2, y: env.groundY(spot.x, spot.y), z: spot.y * 2, facing: Math.PI / 2 },
          motion: { vx: 0, vz: 0, speed: 0 },
          solid: { r: 1.8 },
          // A person of the way calls out to a child who walks past on the road: a wider greeting.
          ...(data.life.people?.react ? { react: { ...structuredClone(data.life.people.react), radius: WAY_CALL } } : {}),
          look: w.look,
        });
      }
    }
    for (const e of query(state, 'person')) if (e.person.kind === 'way' && !want.has(e.id)) removeEntity(state, e.id);
  }
  // Find a place by real clues (#27; src/core/clues.js): a person who greets the hero on the way
  // says the next clue, when the quest leads to the place (a target of the step of the quest is in
  // its area); a person at a wrong place says why it is not the place. Return the text key, or null.
  function clueLine(who) {
    if (!data.clues || !data.world?.at) return null;
    const goal = currentGoal(data.quests.quests, cond());
    const targets = goal?.step?.targets ?? [];
    const leads = (find) => {
      const a = areaOf(find, data.world.at);
      return targets.some((tg) => map.encounters.some((e) => e.id === tg.encounter && inArea(a, e.x, e.y)));
    };
    const line = clueOf(data.clues, data.world.at, profile.flags, who, heroCell(), leads);
    if (!line) return null;
    Object.assign(profile.flags, line.set ?? {});
    emit({ type: 'clue', id: who, textKey: line.textKey });
    return line.textKey;
  }
  // The hero stands in the area of a place to find for the first time: the place is found, and the
  // arrow of the quest shows it again.
  function checkFound() {
    if (!data.clues || !data.world?.at) return;
    const c = heroCell();
    const find = hiddenAt(data.clues, data.world.at, profile.flags, c.x, c.y);
    if (!find) return;
    profile.flags[find.flag] = true;
    emit({ type: 'found', id: find.id });
    emit({ type: 'hud' });
  }
  // The market of today near a place: on the market day of a hamlet in the 3 x 3 tiles of the land
  // around the place, the first person of the place who greets the hero says so, once a day, with
  // the way to it (north, south, east, or west). Return the text key, or null.
  function marketLine() {
    const def = eventDef('market');
    if (!def?.every || visit.things['market.told'] === today()) return null;
    const c = heroCell();
    const frame = (map.source?.def?.frames ?? []).map((f) => ({ f, at: data.world.at(f.id, f.cell[0], f.cell[1]) })).find(({ at }) => Math.hypot(at[0] - c.x, at[1] - c.y) < 60);
    if (!frame || !map.land) return null;
    const [px, py] = frame.at;
    const tx0 = Math.floor(px / TILE);
    const tz0 = Math.floor(py / TILE);
    let best = null;
    for (let tz = tz0 - 1; tz <= tz0 + 1; tz++) {
      for (let tx = tx0 - 1; tx <= tx0 + 1; tx++) {
        if (!map.ready(tx, tz)) continue;
        for (const y of map.land.tile(tx, tz).spots.yard ?? []) {
          if (!isEventDay(def, state.seed, today(), y)) continue;
          const d = Math.hypot(y[0] - px, y[1] - py);
          if (!best || d < best.d) best = { at: y, d };
        }
      }
    }
    if (!best) return null;
    visit.things['market.told'] = today();
    const dx = best.at[0] - px;
    const dy = best.at[1] - py;
    const way = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north';
    return `world.market.${way}`;
  }
  // The areas of the small events near the hero: each place of the map, and each tile of the land
  // of the live chunks, with their spots in the live chunks ({ key, spots: { road, field, wetfield,
  // yard } }), the nearest first. The fields of a place near water (12 cells) can flood.
  function eventAreas() {
    const out = [];
    const keep = (list) => (list ?? []).filter(([x, y]) => inLive(x, y));
    const has = (sp) => Object.values(sp).some((l) => l.length);
    for (const [place, sp] of Object.entries(map.spotsByPlace ?? {})) {
      const spots = Object.fromEntries(Object.entries(sp).map(([k, l]) => [k, keep(l)]));
      spots.wetfield = (spots.field ?? []).filter(([x, y]) => (map.land.cell(x, y).water ?? Infinity) <= 12);
      if (has(spots)) out.push({ key: place, spots });
    }
    const tiles = new Set([...live].map((k) => {
      const [cx, cz] = k.split(',').map(Number);
      return `${Math.floor((cx * CHUNK) / TILE)},${Math.floor((cz * CHUNK) / TILE)}`;
    }));
    for (const k of tiles) {
      const [tx, tz] = k.split(',').map(Number);
      if (!map.ready(tx, tz)) continue;
      const t = map.land.tile(tx, tz);
      const spots = Object.fromEntries(Object.entries(t.spots).map(([s2, l]) => [s2, keep(l)]));
      if (has(spots)) out.push({ key: `${map.id}:${k}`, spots });
    }
    const c = heroCell();
    const near = (a) => Math.min(...Object.values(a.spots).flat().map(([x, y]) => Math.hypot(x - c.x, y - c.y)));
    return out.map((a) => ({ ...a, d: near(a) })).sort((p, q) => p.d - q.d);
  }
  // A free cell from min to max cells from a point, in the order of the seed (map cells, the middle).
  // room: the cells around it that must be free too (1: three by three), for a pile of things.
  // The stall of a seller on a market day (#42): the mat of the rice, her seat behind it (-z), and
  // her tray in front of her beside the mat, at the nearest cell to the spot where all three are
  // open (open(q): the ground is open, and no person is near). Null when no cell fits.
  const STALL = { seat: [-1.5, -2], tray: [-3, 0] };
  function marketStall([x, y], open) {
    const cells = [];
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) cells.push([dx, dy, Math.hypot(dx, dy)]);
    cells.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
    for (const [dx, dy] of cells) {
      const mat = { x: Math.floor(x) + dx + 0.5, y: Math.floor(y) + dy + 0.5 };
      const seat = { x: mat.x + STALL.seat[0], y: mat.y + STALL.seat[1] };
      const tray = { x: mat.x + STALL.tray[0], y: mat.y + STALL.tray[1] };
      if (open(mat) && open(seat) && open(tray)) return { mat, seat, tray };
    }
    return null;
  }
  // The cells (x, y in cells) of the people of the map (the people of the village, of the events,
  // the hero, and the friends), but one (but: an id).
  function peopleCells(but) {
    return state.entities.filter((e) => e.id !== but && e.position && (e.person || e.id === 'hero' || e.id.startsWith('friend:'))).map((e) => ({ x: e.position.x / 2, y: e.position.z / 2 }));
  }
  function nearFree([x, y], min, max, rng, taken = [], room = 0) {
    const cells = [];
    const free = (cx, cy) => tileMap.walkable(cx, cy) && tileMap.type(cx, cy) !== 'shallow';
    for (let dy = -max; dy <= max; dy++) for (let dx = -max; dx <= max; dx++) {
      const d = Math.hypot(dx, dy);
      if (d < min || d > max) continue;
      const cx = Math.floor(x) + dx;
      const cy = Math.floor(y) + dy;
      let ok = true;
      for (let ry = -room; ry <= room && ok; ry++) for (let rx = -room; rx <= room; rx++) if (!free(cx + rx, cy + ry)) ok = false;
      if (!ok) continue;
      if (taken.some((t) => Math.hypot(t.x - cx - 0.5, t.y - cy - 0.5) < 2.5)) continue;
      cells.push({ x: cx + 0.5, y: cy + 0.5 });
    }
    return cells.length ? rng.pick(cells) : null;
  }
  // A tap on the person of an event: the work starts (with a line that says the number as a
  // word), or the sum on the place is the commit.
  function tapEvent(id) {
    const tz = trialZone(`event-${id}`);
    if (tz?.zone.done) return;
    // During the task, a tap on the person asks for help (docs/TASKS.md); the action button is the
    // commit, and a tap on the place with empty hands is a check.
    if (tz) {
      const key = `event-${id}`;
      const r = mentoring.wave(key);
      if (!r || r.move === 'wait' || r.move === 'tryFirst') mentoring.move(key, 'show');
      return;
    }
    const def = eventDef(id);
    const ent = getEntity(state, `event:${id}`);
    if (!def || !ent) return;
    const day = ent.dayEvent.day;
    const rng = createRng(hashSeed(`${state.seed}:event-task:${id}:${ent.dayEvent.area ?? map.id}:${day}`));
    // The level: the grade, and P(L) of the skill of the event in the skill model.
    const p = learner()?.entry(def.levelBy)?.p ?? null;
    // A mentor that asked for a bigger task last time (a move raise): one level up, this time.
    const mem = profile.mentors?.[`event-${id}`];
    const lift = mem?.lift ?? 0;
    if (mem) mem.lift = 0;
    const level = Math.max(0, Math.min(def.levels.length - 1, eventLevel(data.events, levelFor(data.trials ?? { grades: {} }, profile.grade), p) + lift));
    // A market day is barter: the rice of the basket of the hero lies by the mat; it leaves the
    // basket only at the end.
    const task = def.barter ? barterTask(def, level, rng, profile.inventory.rice ?? 0) : eventTask(def, level, rng);
    if (!task) {
      say(def.lines.poor, {}, null, def.person);
      return;
    }
    let pile = task.pile;
    // The places: the work at the spot, the pile a few cells away, and each lost duck further. No
    // place of the work lies where another person stands (#42).
    const others = peopleCells(ent.id);
    const target = { x: ent.dayEvent.at[0] + 0.5, y: ent.dayEvent.at[1] + 0.5 };
    const openAt = (q) => tileMap.walkable(Math.floor(q.x), Math.floor(q.y)) && !others.some((o) => Math.hypot(o.x - q.x, o.y - q.y) < 1.5);
    // A market day (#42): the seller sits behind the mat of the rice, and her tray of goods lies in
    // front of her, beside the mat, toward the child, so that the child sees all her goods. The mat
    // goes to the nearest cell where the mat, her seat, and the tray are all free.
    const stall = task.goods ? ent.dayEvent.stall ?? marketStall(ent.dayEvent.at, openAt) : null;
    const placeAt = stall?.mat ?? (openAt(target) ? target : nearFree(ent.dayEvent.at, 1, 4, rng, others) ?? target);
    const trayAt = stall?.tray ?? null;
    if (stall) ent.position = { ...ent.position, x: stall.seat.x * 2, y: env.groundY(stall.seat.x, stall.seat.y), z: stall.seat.y * 2, facing: 0 };
    const taken = [placeAt, { x: ent.position.x / 2, y: ent.position.z / 2 }, ...(trayAt ? [trayAt] : []), ...others];
    // The rice of the basket of a market day lies by the mat (#42), a few steps from it.
    const near = trayAt ? [Math.floor(placeAt.x), Math.floor(placeAt.y)] : ent.dayEvent.at;
    const pileAt = (trayAt ? nearFree(near, 3, 5, rng, taken, 1) : null) ?? nearFree(ent.dayEvent.at, 4, 7, rng, taken, 1) ?? nearFree(ent.dayEvent.at, 2, 10, rng, [], 1) ?? placeAt;
    const lost = [];
    if (task.lost) {
      // Some lost things are near; the others are farther, out of view from the place, so that
      // the child must look for them.
      for (let k = 0; k < pile.length; k++) {
        const q = (k % 2 ? nearFree(ent.dayEvent.at, 13, 19, rng, [...taken, ...lost]) : null) ?? nearFree(ent.dayEvent.at, 7, 12, rng, [...taken, ...lost]);
        if (q) lost.push(q);
      }
      pile = pile.slice(0, lost.length);
    }
    // Things of another owner near their own yard (ducks of another farm), a few cells away.
    const strays = [];
    if (def.strays) {
      const yard = nearFree(ent.dayEvent.at, 8, 12, rng, [...taken, ...lost]);
      const n = rng.int(def.strays[0], def.strays[1]);
      for (let k = 0; yard && k < n; k++) {
        const q = nearFree([Math.floor(yard.x), Math.floor(yard.y)], 0, 4, rng, [...taken, ...lost, ...strays]);
        if (q) strays.push(q);
      }
    }
    const hb = (q) => ({ x: q.x * 2, z: q.y * 2 });
    setupTrial(state, {
      id: `event-${id}`, task: 'exact', thing: def.thing, target: def.target, pile, keep: task.keep, lost: task.lost,
      need: task.need, skill: task.skill, level: task.level, day, event: id, levels: [{}],
      at: { target: hb(placeAt), pile: hb(pileAt), lost: lost.map(hb), strays: strays.map(hb), ...(trayAt ? { wares: hb(trayAt) } : {}) }, strayLook: def.strayLook,
      give: task.goods ? { [task.goods]: task.k } : null,
    }, 0, env);
    mentoring.start(`event-${id}`);
    const num = (n) => ({ key: `num.${n}` });
    if (task.goods) {
      // The seller says the rate and her goods as words: one for one, one for more, or more for more.
      const [a, b] = task.rate;
      const form = b > 1 ? 'many' : a > 1 ? 'one' : 'same';
      say(`${def.lines.start}.${task.goods}.${form}`, { a: num(a), b: num(b), k: num(task.k) }, null, def.person);
    } else say(def.lines.start, { need: num(task.need) }, null, def.person);
    emit({ type: 'hud' });
  }
  // An event is done: the reward flies to the counter, the person says thanks, and the event goes.
  function eventDone(id) {
    const def = eventDef(id);
    const tz = trialZone(`event-${id}`);
    if (!def || !tz) return;
    visit.things[`event.${id}`] = tz.zone.day;
    grow('event');
    const from = `event:${id}`;
    // Barter: the rice on the mat leaves the basket, and the goods of the seller go to it.
    const give = tz.zone.give ?? def.reward;
    if (tz.zone.give) {
      const k = Math.min(profile.inventory.rice ?? 0, tz.zone.need);
      profile.inventory.rice = (profile.inventory.rice ?? 0) - k;
      emit({ type: 'lose', to: from, take: { rice: k } });
    }
    applyEffects(profile, [{ give }]);
    emit({ type: 'gift', from: getEntity(state, from) ? from : 'hero', give, delay: 0.3 });
    emit({ type: 'hud' });
    save('event');
    say(def.lines.done, {}, null, def.person);
    queue(() => clearEvent(id));
  }

  // The ferries of the map (layers.ferries): a boat that waits at the landing of side a. The boat
  // never sleeps (it is not of a chunk), so that it is where it was left.
  function addFerries() {
    for (const f of [...(map.layers.ferries ?? []), ...(map.land?.ferries ?? [])]) {
      const id = `ferry:${f.id}`;
      if (getEntity(state, id)) continue;
      const half = (q) => ({ x: q.x * 2, z: q.y * 2 });
      const a = half(f.a);
      const position = { x: a.x, y: env.groundY(f.a.x, f.a.y) + 1.2, z: a.z, facing: Math.atan2(f.b.x - f.a.x, f.b.y - f.a.y) };
      addEntity(state, {
        id,
        ferry: { a, b: half(f.b), landA: half(f.landA), landB: half(f.landB), side: 'a', state: 'wait', riders: [], from: [], t: 0, man: `ferryman:${f.id}` },
        position,
        look: 'ferry',
      });
      // The ferryman stands at the stern with his pole (the ferry system keeps him there).
      if (!getEntity(state, `ferryman:${f.id}`)) addEntity(state, { id: `ferryman:${f.id}`, position: { ...position }, look: 'ferryman', aboard: id });
    }
  }
  // The ferries of the roads of the land (map.land.ferries) have no trigger zone: the hero calls the
  // boat at the cell of the bank (step), once each time the hero comes there.
  const atLanding = new Set();
  function checkLandFerries() {
    const list = map.land?.ferries;
    if (!list?.length || busy || turning !== null) return;
    const c = heroCell();
    for (const f of list) {
      for (const side of ['A', 'B']) {
        const q = f[`step${side}`];
        const key = `${f.id}:${side}`;
        const d = Math.hypot(q.x - c.x, q.y - c.y);
        if (d > 3) atLanding.delete(key);
        else if (d < 1.2 && !atLanding.has(key) && !hero().aboard) {
          atLanding.add(key);
          startFerry(f.id, 'map.ferry.river');
        }
      }
    }
  }
  // The hero comes to the landing of a ferry: the boat comes (when it waits at the other side),
  // the hero and Nghé (when it is near) step onto it, and it crosses. The line says it first.
  function startFerry(id, textKey) {
    const e = getEntity(state, `ferry:${id}`);
    if (!e || e.ferry.state !== 'wait') return;
    const f = e.ferry;
    const h = hero().position;
    const side = Math.hypot(h.x - f.landA.x, h.z - f.landA.z) <= Math.hypot(h.x - f.landB.x, h.z - f.landB.z) ? 'a' : 'b';
    const riders = ['hero'];
    const nghe = getEntity(state, 'friend:nghe');
    if (nghe && !nghe.hidden && Math.hypot(nghe.position.x - h.x, nghe.position.z - h.z) < 20) riders.push(nghe.id);
    arrivals.clear();
    worldCommand(state, { type: 'stop', id: 'hero' });
    f.riders = riders;
    f.call = side;
    f.t = 0;
    f.from = riders.map((r) => ({ ...getEntity(state, r).position }));
    f.state = f.side === side ? 'board' : 'call';
    emit({ type: 'halt' });
    if (textKey) say(textKey);
  }

  // Actions of trigger zones, people, and encounters -------------------------------

  function doAction(zone) {
    const a = zone.action;
    if (zone.once) profile.flags[`zone.${zone.id}`] = true;
    if (a.talk) {
      walkToPerson(a.talk);
      return;
    }
    if (a.ferry) {
      // A ferry: the boat takes the hero and Nghé to the other side of the river.
      startFerry(a.ferry, a.textKey);
      return;
    }
    if (a.move) {
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
    if (who.kind === 'npc') {
      // The child starts a station while the greeting of the place goes on: the greeting ends at
      // once, with its marks, and only the person of the station talks (#38).
      if (who.id !== practice?.greeter) endScript(state, getEntity(state, 'script:greet'), { early: true });
      // During the task of the person, a tap asks for help: the mentor answers with one move. It
      // never opens the start talk again (docs/TASKS.md).
      const key = mentoring.taskOfPerson(`npc:${who.id}`);
      if (key) {
        // Before a try, or after a right one, the person shows the next step on the real things.
        const r = mentoring.wave(key);
        if (!r || r.move === 'wait' || r.move === 'tryFirst') mentoring.move(key, 'show');
        return;
      }
      // In a practice, a person who is not of the practice only greets the child: no talk of the
      // story opens there (#51).
      if (practice && !ofPractice(who.id)) {
        const words = GREETS[data.npcs.npcs[who.id]?.greet ?? 'grown'];
        if (words) emit({ type: 'open', screen: 'callout', id: at.entity ?? `npc:${who.id}`, textKey: words[state.tick % words.length], params: { name: profile.hero.name } });
        return;
      }
      talk(pickTalk(data.npcs.npcs[who.id], profile));
    }
    else if (who.kind === 'event') tapEvent(who.id);
    else if (who.kind === 'encounter') {
      // No raid of the story starts in a practice (#51).
      if (practice) return;
      const enc = map.encounters.find((e) => e.id === who.id);
      const def = data.raids?.raids[enc.raid];
      if (!def) return;
      // One line, and then the raid starts on this map.
      say(def.introKey);
      queue(() => startRaid(enc.raid, enc.id));
    }
  }

  // Raids (data/raids.json, src/core/world/raids.js, and src/core/world/systems/raid.js) -----

  // Seconds that an enemy stops at each post: in the first two raids of a tool, and after a loss.
  const RAID_STOP = Object.freeze({ first: 4, lost: 6 });
  const raidEnt = () => getEntity(state, 'raid');
  const raidOn = () => Boolean(raidEnt());
  let raidEnc = null; // the encounter of the raid now (its figure hides while the raid goes on)
  // Start a raid on this map: the hero stands at the wall, and the enemies come.
  function startRaid(id, encId = null) {
    const def = data.raids?.raids[id];
    if (!def || def.map !== map.id || raidOn()) return false;
    // The tools that are new to the child: the first raid of the slingshot or of the traps waits
    // for the child (#50).
    const teach = (def.tools ?? ['sling']).filter((tool) => !profile.flags[`raid.tool.${tool}`]);
    // A raid that a child can win (#55): in the first two raids of each tool, and after a loss,
    // each enemy stops at the posts and the enemies come one at a time; after a loss, one enemy
    // less; after two losses, a helper at the wall. One new tool in a raid: no gate in the first
    // raid of the slingshot.
    const lost = Number(profile.flags[`raid.${id}.lost`] ?? 0);
    const used = Math.min(...(def.tools ?? ['sling']).map((t) => Number(profile.flags[`raid.used.${t}`] ?? 0)));
    const easy = {
      stop: lost ? RAID_STOP.lost : used < 2 ? RAID_STOP.first : 0,
      fewer: lost ? 1 : 0,
      help: lost >= 2,
      helper: def.helper ?? 'smith',
      without: teach.includes('sling') ? ['gate'] : [],
    };
    for (const t of def.tools ?? ['sling']) profile.flags[`raid.used.${t}`] = Number(profile.flags[`raid.used.${t}`] ?? 0) + 1;
    const raid = createRaid(data.raids, id, raidLevel(data.raids, profile.grade), lossLevel(profile), teach, easy);
    slingPull = null;
    setupRaid(state, raid, def, env, { helpers: data.raids.helperLooks, companion: data.raids.companions?.[def.companion] });
    placeHero(def.wall[0], def.wall[1]);
    worldCommand(state, { type: 'face', id: 'hero', x: raid.wall.x + raid.dir.x * 10, z: raid.wall.z + raid.dir.z * 10 });
    raidEnc = encId ? persons().find((p) => p.kind === 'encounter' && p.ref === encId)?.entity ?? null : null;
    const fig = raidEnc ? getEntity(state, raidEnc) : null;
    if (fig) fig.hidden = true;
    log('action', { kind: 'raid' });
    // The elder or the smith says one line the first time that a tool comes. One tool at a time
    // (#50): the line of the first new tool now, and the line of each next new tool later, when the
    // raid does not wait and the child had some time with the tool before (see the step).
    const lines = [];
    for (const tool of raid.tools) {
      const line = data.raids.toolLines?.[tool];
      if (!line || profile.flags[`raid.tool.${tool}`]) continue;
      profile.flags[`raid.tool.${tool}`] = true;
      lines.push({ tool, textKey: line.textKey, speaker: line.speaker });
    }
    // A villager names the post for a trap (an ordinal word, no numeral), after the line of the traps.
    if (raid.trapPost !== null) {
      const n = raid.posts.findIndex((q) => q.d === raid.trapPost) + 1;
      const ask = { textKey: 'raid.trap.ask', params: { post: { key: `ord.${n}` } }, speaker: def.trapAsk ?? 'elder' };
      const k = lines.findIndex((l) => l.tool === 'traps');
      if (k >= 0) lines.splice(k + 1, 0, { ...ask, with: true });
      else lines.unshift(ask);
    }
    // Now: the lines up to the first new tool, that line, and the lines that go with it.
    const first = lines.findIndex((l) => l.tool);
    let now = lines.findIndex((l, i) => i > first && l.tool && !l.with);
    if (first < 0 || now < 0) now = lines.length;
    for (const l of lines.slice(0, now)) say(l.textKey, l.params ?? {}, null, l.speaker);
    toolLines = { list: lines.slice(now), t: TOOL_GAP };
    emit({ type: 'raid', on: true, id });
    emit({ type: 'hud' });
    return true;
  }
  const order = (o) => worldCommand(state, { type: 'raid', id: 'raid', ...o });
  // The end of a raid: a win gives its flags, its gifts, and its talks; a loss keeps the raid for
  // another time (the enemies took some rice, and nothing else).
  function raidEnd(ev) {
    const r = raidEnt();
    const def = data.raids.raids[r?.raid.id];
    if (!def) return;
    profile.stats ??= {};
    log('raid', { raid: r.raid.id, won: Boolean(ev.won) });
    if (ev.won) {
      profile.stats.battlesWon = (profile.stats.battlesWon ?? 0) + 1;
      grow('raid');
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
      // The next raid of this kind is easier (#55).
      profile.flags[`raid.${r.raid.id}.lost`] = Number(profile.flags[`raid.${r.raid.id}.lost`] ?? 0) + 1;
      save('raid');
      // The line of the raid says who left and when they come back (#50).
      say(def.lostKey ?? 'raid.lost');
    }
    emit({ type: 'hud' });
  }
  // An enemy at the gate took some goods: they leave the basket (never below nothing).
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
  // The share is fair: the sacks of the hero go to the basket as bowls of rice, the rest stays
  // for the village, and the things of the share go away.
  function shareDone() {
    const sacks = getEntity(state, 'zone:share-hero')?.zone.items.length ?? 0;
    const rest = zoneOf('loot')?.zone.items.length ?? 0;
    if (sacks) {
      applyEffects(profile, [{ give: { rice: sacks } }]);
      emit({ type: 'gift', from: 'hero', give: { rice: sacks }, delay: 0.3 });
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
  // The rest of the loot: a red cloth with the sacks goes into the hands of the hero. The child
  // carries it to one of the people of the rest in the village (giveGift).
  function giveRest(n) {
    const h = hero();
    const id = `gift:${state.tick}`;
    const look = `gift-${Math.min(2, n)}`;
    addEntity(state, { id, keep: true, item: { kind: 'gift', size: 1, task: 'gift', zone: null, held: 'hero', set: false, travels: true }, hidden: true, position: { ...h.position }, look });
    h.hands.holds = id;
    h.carry = look;
    say('share.rest');
  }
  function raidOver() {
    const fig = raidEnc ? getEntity(state, raidEnc) : null;
    if (fig) fig.hidden = false;
    raidEnc = null;
    refreshPeople();
    emit({ type: 'raid', on: false });
  }
  // The slingshot is at the wall: the hero walks back there first when the hero is away.
  // unit: half blocks of one step of the pull (a post for the big button, #55).
  function shootFromWall(count, unit = 1) {
    const wall = raidEnt()?.raid.wall;
    if (!wall) return;
    if (distHb(hero().position, wall) <= 2) order({ act: 'shoot', count, unit });
    else walkTo([{ x: wall.x / 2, y: wall.z / 2 }], () => order({ act: 'shoot', count, unit }));
  }
  // A tap on the road with a trap in the hands: the hero walks there, and the place on the road is
  // the target of the button.
  function tapRaidRoad(hit) {
    const held = getEntity(state, holding());
    if (held?.item.kind !== 'trap') return false;
    const at = roadPoint(state, { x: hit.x * 2, z: hit.y * 2 });
    if (!at) return false;
    // The hero stays at the wall when the place is in reach from there.
    if (distHb(hero().position, at) <= REACH + 2) {
      chosen = { id: 'zone:raid-road', along: { x: at.x, z: at.z } };
      worldCommand(state, { type: 'face', id: 'hero', x: at.x, z: at.z });
    } else goTo(at, 'zone:raid-road', { x: at.x, z: at.z });
    return true;
  }
  // The button in a raid: pick up a trap at the heap of traps; put the trap in the hands on the road
  // (at the place of the tap, or in front of the hero), where a ghost shows it.
  function raidAction() {
    const hp = hero().position;
    const held = getEntity(state, holding());
    if (held?.item.kind === 'trap') {
      const at = chosen?.id === 'zone:raid-road' && chosen.along ? chosen.along : roadPoint(state, frontOf(hp, 3));
      if (!at || distHb(hp, at) > REACH + 2) return null;
      const point = { x: at.x, z: at.z };
      return { act: 'put', icon: 'hand-put', target: 'zone:raid-road', ghost: { look: held.look, x: at.x, y: hp.y, z: at.z, facing: 0 }, run: () => worldCommand(state, { type: 'put', id: 'hero', zone: 'raid-road', at: point }) };
    }
    if (held) return null;
    const traps = query(state, 'item', 'position').filter((e) => e.item.kind === 'trap' && !e.item.set && !e.item.held && !e.hidden && e.item.zone !== 'raid-road' && distHb(hp, e.position) <= REACH);
    const trap = traps.sort((a, b) => distHb(hp, a.position) - distHb(hp, b.position))[0];
    // A trap in the hands: the first raid of the traps goes on (#50). A tap on any free trap
    // chooses this pick: the walk to a far trap stops at the nearest one (#60).
    const free = query(state, 'item').filter((e) => e.item.kind === 'trap' && !e.item.set && e.item.zone !== 'raid-road').map((e) => e.id);
    if (trap) return { act: 'pick', icon: 'hand-pick', target: trap.id, keys: free, run: () => { worldCommand(state, { type: 'pick', id: 'hero', item: trap.id }); order({ act: 'release', tool: 'traps' }); } };
    // Nothing else in reach: the big button is the slingshot (#50, #55). Each press adds one post
    // to the pull (a red band on the band); the stone flies one second after the last press, or at
    // once after a tap on the hero. A child counts the presses, not the time.
    const r = raidEnt()?.raid;
    if (!r || r.result || !r.tools.includes('sling')) return null;
    return { act: 'sling', icon: 'sling', target: 'hero', run: () => {
      const most = Math.floor(r.sling.max / POST_STEP);
      slingPull = { posts: Math.min(most, (slingPull?.posts ?? 0) + 1), t: 0 };
    } };
  }
  // The stone of the pull of the button flies now.
  function fireSling() {
    const count = pullCount();
    slingPull = null;
    if (count >= 1) shootFromWall(count, POST_STEP);
  }
  // One step of the pull of the button: the stone flies one second after the last press.
  function stepSling() {
    const r = raidEnt()?.raid;
    // The posts up to the pull light up, and a ring lies on the road at the count.
    if (r) r.pull = slingPull ? pullCount() : dragPull;
    if (!slingPull) return;
    slingPull.t += STEP;
    if (slingPull.t >= FIRE_WAIT) fireSling();
  }
  // The lines of the new tools that wait (the first raid of more than one tool), and the seconds
  // before the next one.
  let toolLines = { list: [], t: 0 };
  const TOOL_GAP = 6;
  function stepToolLines() {
    const r = raidEnt()?.raid;
    if (!r || r.result || !toolLines.list.length) return;
    if (r.hold || busy || screen) return;
    toolLines.t -= STEP;
    // A tool that the raid needs now comes at once: the gate when a scout lights a torch.
    const now = toolLines.list[0]?.tool === 'gate' && state.events.some((ev) => ev.type === 'light');
    if (toolLines.t > 0 && !now) return;
    // In the raid the line is a bubble of the person: it does not stop the play.
    const bubble = (l) => emit({ type: 'open', screen: 'callout', id: `npc:${l.speaker}`, textKey: l.textKey, params: l.params ?? {} });
    bubble(toolLines.list.shift());
    // The lines that go with it (the post of a trap) come at once.
    while (toolLines.list[0]?.with) bubble(toolLines.list.shift());
    toolLines.t = TOOL_GAP;
  }
  // The pull of the slingshot with the big button: { posts (the count of presses), t (seconds
  // since the last press) }, or null. One press is one post: POST_STEP half blocks, as far as the
  // first post is from the wall.
  let slingPull = null;
  let dragPull = 0; // half blocks: the pull of a drag on the hero now
  const POST_STEP = 5;
  const FIRE_WAIT = 1;
  function pullCount() {
    const r = raidEnt()?.raid;
    if (!slingPull || !r) return 0;
    return Math.min(r.sling.max, slingPull.posts * POST_STEP);
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
  // The tile map for the walks of the hero: the cells under a solid box of a thing of a task (a
  // trough, a heap) are blocked too, so that a walk goes around them.
  function pathMap() {
    const solids = query(state, 'solid', 'position').filter((e) => !e.hidden && e.id !== 'hero');
    const boxes = solids.filter((e) => e.solid.rect).map((e) => e.solid.rect);
    // A person or a solid thing near the hero (a person at work, a pot, a cart): its cells, so
    // that a walk goes around and never pushes into it (#44; a pot in a narrow way stopped a walk,
    // #53). People far away (they move) and Nghé (she steps aside) do not count.
    const hp = hero().position;
    const rounds = solids.filter((e) => !e.solid.rect && e.solid.r && !e.follow && Math.hypot(e.position.x - hp.x, e.position.z - hp.z) < 16)
      .map((e) => ({ x: e.position.x, z: e.position.z, r: e.solid.r, person: Boolean(e.person) }));
    // A narrow gap between a person and a wall is no way: a cell beside a wall where the body of
    // the hero touches the person (the walk cannot step around the person there). #56: the mother
    // of Gióng at the market stood one step from a wall, and each walk from the porch of the đình
    // stopped. A pot in the way still breaks (the walk goes into it).
    const body = MOVE.radius * 2; // half blocks
    const wall = (x, y) => tileMap.isBlocked(x, y) || tileMap.isBlocked(x + 1, y) || tileMap.isBlocked(x - 1, y) || tileMap.isBlocked(x, y + 1) || tileMap.isBlocked(x, y - 1);
    const gap = (x, y) => rounds.some((c) => c.person && Math.hypot((x + 0.5) * 2 - c.x, (y + 0.5) * 2 - c.z) < c.r + body) && wall(x, y);
    // The cell of the hero is never in a box: a hero who stands at the edge of a solid thing (a
    // culm, the mat) can always walk away from it (#44).
    const h = heroFrom();
    const inBox = (x, y) => !(x === h.x && y === h.y) && (boxes.some((b) => (x + 0.5) * 2 > b.x0 - 0.5 && (x + 0.5) * 2 < b.x1 + 0.5 && (y + 0.5) * 2 > b.z0 - 0.5 && (y + 0.5) * 2 < b.z1 + 0.5)
      || rounds.some((c) => Math.hypot((x + 0.5) * 2 - c.x, (y + 0.5) * 2 - c.z) < c.r) || gap(x, y));
    return Object.assign(Object.create(tileMap), {
      // The hero can always start from its own cell (in the water after a jump, at a thing).
      walkable: (x, y) => (x === h.x && y === h.y) || (tileMap.walkable(x, y) && !inBox(x, y)),
      isBlocked: (x, y) => tileMap.isBlocked(x, y) || inBox(x, y),
    });
  }
  function walkToThing(target, onArrive) {
    const tile = { x: Math.floor(target.x), y: Math.floor(target.y) };
    // A large solid thing (the mat, a clump): the free cell nearest to it on the way (#44).
    walkPath(pathToward(pathMap(), heroFrom(), tile), null, onArrive, { x: target.x, y: target.y, d: 2.2 });
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
    const path = findPath(pathMap(), heroFrom(), { x: Math.floor(first.x), y: Math.floor(first.y) });
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
  // A jump of the hero (src/core/world/jump.js), as far as a child of the age of the player. A jump
  // does not interrupt a talk or a task in progress (a thing in the hands, a walk to a thing).
  function jump() {
    const h = hero();
    const cfg = data.hero?.jump;
    if (!cfg || !h || busy || screen || h.fall || h.jump || h.riding || holding() || raidOn() || arrivals.size) return null;
    const run = (h.motion?.speed ?? 0) > MOVE.walk * 2 * 1.1;
    const len = jumpLength(cfg, profile.grade, { run });
    const f = h.position.facing ?? 0;
    const plan = planJump(jumpCtx(), { x: h.position.x, z: h.position.z }, { x: Math.sin(f), z: Math.cos(f) }, len, cfg);
    const cmd = { type: 'jump', id: 'hero', kind: plan.kind, to: plan.to ?? plan.at, top: plan.top ?? len * cfg.arc, time: plan.time ?? Math.max(cfg.time[1], cfg.time[0] * len), splash: Boolean(plan.splash) };
    if (plan.kind === 'fall') {
      // Over the gap of the bridge the jump ends in the water: the same fall as a short plank, and
      // the hero climbs out at the near end.
      const z = plan.gap.zone;
      const def = data.zones?.[z.task] ?? null;
      cmd.fall = { zone: plan.gap.id, out: { x: z.lane, z: z.from - 1.5 }, time: def?.outcomes?.short?.fall ?? 1.2, water: 2 };
    }
    worldCommand(state, cmd);
    return plan;
  }
  // What the jump needs to know of the map around the hero.
  function jumpCtx() {
    const open = spans().filter((s) => !s.zone.set);
    const tasks = query(state, 'zone').filter((z) => z.zone.rect && String(z.zone.task ?? '').startsWith('trial-') && !trialZone(String(z.zone.task).slice(6))?.zone.done);
    return {
      groundY: (cx, cy) => env.groundY(cx + 0.5, cy + 0.5),
      level: (cx, cy) => tileMap.heightAt?.(cx, cy) ?? 0,
      type: (cx, cy) => (tileMap.inside(cx, cy) ? tileMap.type(cx, cy) : null),
      walkable: (cx, cy) => tileMap.inside(cx, cy) && !tileMap.isBlocked(cx, cy),
      objectAt: (cx, cy) => map.objectsNear(cx, cy, cx + 1, cy + 1).find((o) => !terrain?.isFelled?.(o) && footprint(o).some(([dx, dy]) => o.x + dx === cx && o.y + dy === cy)) ?? null,
      gapAt: (x, z) => {
        for (const s of open) {
          const g = s.zone;
          const covered = itemsSum(g);
          if (x >= g.x0 * 2 && x < (g.x1 + 1) * 2 && z >= g.from + covered && z < g.from + g.gap) return s;
        }
        return null;
      },
      taskAt: (x, z) => tasks.some((t) => { const r = t.zone.rect; return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1; }),
    };
  }
  const itemsSum = (zone) => zone.items.reduce((a, id) => a + (getEntity(state, id)?.item?.size ?? 0), 0);
  // The span that has this cell, if it is not solid yet.
  const spanAt = (x, y) => spans().find(({ zone: z }) => !z.set && x >= z.x0 && x <= z.x1 && y >= z.start / 2 && y < z.end / 2);
  const reachCell = (z) => ({ x: z.position.x / 2, y: z.position.z / 2 });
  // Walk out on the planks of a span, to the point `to` (half blocks, along the gap).
  function goOnSpan(z, to) {
    const pts = [reachCell(z)];
    if (to > z.zone.from) pts.push({ x: z.zone.lane / 2, y: to / 2 });
    walkTo(pts, null);
  }
  function tapSpan(z) {
    const covered = z.zone.items.reduce((a, id) => a + (getEntity(state, id)?.item.size ?? 0), 0);
    chosen = { id: z.id, along: null };
    if (holding()) walkTo([reachCell(z)], () => worldCommand(state, { type: 'face', id: 'hero', x: z.zone.lane, z: z.zone.end }));
    else goOnSpan(z, z.zone.from + covered - 0.5);
  }
  // A tap on a thing: the hero walks to it, and it is the target of the button.
  function tapThing(thing, along = null) {
    log('action', { kind: 'place' });
    const m = middleOf(thing);
    emit({ type: 'tapfx', x: m.x / 2, y: m.z / 2, h: thing.position.y / 2 + 0.4 });
    if (thing.item.kind === 'stump') return;
    const zone = zoneOf(thing.item.zone);
    if (zone?.zone.rule === 'span') {
      // A plank on a span: the hero walks out on the planks to it; the last plank is the target.
      const last = zone.zone.items[zone.zone.items.length - 1] === thing.id;
      if (holding()) tapSpan(zone);
      else if (last) goTo(zone.position, thing.id);
      else goOnSpan(zone, thing.position.z + thing.item.size - 0.5);
      return;
    }
    // With a thing in the hands, a tap on a thing on a place of a task (a trap in the stream, a rod
    // on the mat) is a tap on the place: the thing in the hands goes there (#47).
    if (holding() && zone?.zone.rect && zone.zone.rule !== 'heap' && zone.zone.rule !== 'pile' && tapTaskPlace({ x: m.x / 2, y: m.z / 2 })) return;
    // The child chose this plank now (the time to choose is a sign for the model).
    worldCommand(state, { type: 'aim', id: 'hero', item: thing.id });
    if (thing.item.kind === 'stem') return goTo({ x: thing.position.x + (along ?? thing.item.size / 2), z: thing.position.z }, thing.id, along === null ? null : Math.round(along));
    // A standing culm: the hero stands at its side of the road (the clump is dense).
    if (thing.item.kind === 'culm') return goTo(thing.position, thing.id, null, { x: thing.position.x + 2, z: thing.position.z });
    const tz = thing.item.kind === 'iron' ? trialZone(thing.item.task.slice(6)) : null;
    goTo(tz?.zone.anvil ?? m, thing.id);
  }

  // Walk to a person of a task, turn to the person, and do the work (fn).
  function atPerson(ref, fn) {
    const q = persons().find((p) => p.kind === 'npc' && p.ref === ref);
    if (!q) return fn();
    walkToThing(q, () => {
      worldCommand(state, { type: 'face', id: 'hero', x: q.x * 2, z: q.y * 2 });
      fn();
    });
  }

  // The rest of the loot (a small red cloth in the hands) goes to a person who takes it.
  function giveGift(q) {
    const held = getEntity(state, holding());
    const key = held?.item.kind === 'gift' ? trialDef('share')?.rest?.[q.ref] : null;
    if (!key) return;
    const h = hero();
    h.hands.holds = null;
    delete h.carry;
    removeEntity(state, held.id);
    emit({ type: 'sound', sound: 'pickup' });
    emit({ type: 'gave', id: q.entity, to: q.ref });
    emit({ type: 'open', screen: 'callout', id: q.entity, textKey: key, params: { name: profile.hero.name } });
    save('gift');
  }

  // The finish of the task of a person when there is work to check (the person checks it):
  // { act, icon, run }, or null. The work system checks the rest.
  function finishOf(key) {
    const open = (id) => {
      const tz = trialZone(id);
      return tz && !tz.zone.done ? tz : null;
    };
    if (key === 'trial-scholar' && open('scholar') && zoneOf('mat')?.zone.items.length) return { act: 'tie', icon: 'rope', run: () => work('scholar', 'tie') };
    if (key === 'trial-healer' && open('healer') && zoneOf('basket')?.zone.items.length) return { act: 'give', icon: 'basket', run: () => work('healer', 'give') };
    const wood = key === 'trial-woodcutter' ? open('woodcutter') : null;
    if (wood?.zone.marks?.length && !wood.zone.cut) return { act: 'cut', icon: 'knife', run: () => work('woodcutter', 'cut') };
    if (key === 'trial-plant' && planting.ready() === 'commit' && plotsOf(state)[0]?.plot.form !== 'choose') return { act: 'plant', icon: 'seedling', run: () => work('plant', 'plant') };
    if (key === 'trial-traps') {
      const r = hamlet.round('traps');
      const fresh = (zoneOf('traps-stream')?.zone.items ?? []).some((i) => !getEntity(state, i)?.item.set);
      if (r && !r.done && !r.fill && fresh) return { act: 'open', icon: 'weir', run: () => work('traps', 'open') };
    }
    if (key?.startsWith('event-') && open(key)) {
      const place = zoneOf(`${key}-place`);
      if (place?.zone.items.some((i) => !getEntity(state, i)?.item.fixed)) return { act: 'check', icon: 'check', run: () => work(key, 'exact') };
    }
    return null;
  }

  // The place of a one-press move (#61): the mat of the teacher or the basket of the healer that
  // takes the thing, when the hero stands in reach of it. Null: the press only picks.
  const ONE_MOVE = new Set(['bundle', 'basket']);
  function oneMovePlace(thing) {
    const h = hero().position;
    return query(state, 'zone').find((z) => ONE_MOVE.has(z.zone.rule) && z.zone.task === thing.item.task && canPut(z.zone, thing) && distHb(h, nearestPoint(z, h)) <= REACH + 2) ?? null;
  }
  // The tasks where the child put a thing, and the last thing that the child took from a heap
  // ({ task, kind }).
  const childPut = new Set();
  let lastPick = null;
  // A task (its owner, trial-<id>) that is open now.
  const openTask = (task) => {
    if (!task?.startsWith('trial-')) return false;
    const tz = trialZone(task.slice(6));
    return Boolean(tz && !tz.zone.done);
  };
  // The kind of thing that a press takes from a heap now: the kind of the last pick (the child does
  // the same again), or null (any kind). A press never reads a number that the child must find
  // (#63): at the healer, the press takes the same kind again with no limit, and only a tap on
  // another bed changes the kind. The child counts the bunches.
  function wantKind() {
    if (!lastPick || !openTask(lastPick.task)) return null;
    return lastPick.kind;
  }
  // The tasks whose kind of thing only a tap changes: when the bed of that kind is empty, a press
  // takes nothing (#63). At the other tasks, a press takes another kind when the heap has no more.
  const SAME_KIND = new Set(['trial-healer']);
  // The tasks whose finish needs a tap on the person: the give of the basket is a try (#47, #63).
  const TAP_FINISH = new Set(['trial-healer']);
  // The healer says the name of a herb in a bubble (#61): 'bed' after a tap on a bed, 'herb' when
  // the child takes a bunch. A child who cannot read hears it (#60).
  function sayHerb(what, kind) {
    const healer = getEntity(state, 'npc:healer');
    if (!healer || !/^herb-(ngai|tiato|rauma)$/.test(kind)) return;
    emit({ type: 'open', screen: 'callout', id: healer.id, textKey: `healer.${what}.${kind.slice(5)}`, params: {} });
  }
  // A task or a folk game goes on now.
  const taskOn = () => Boolean(mentoring.activeKey() || folk.active() || query(state, 'zone').some((z) => z.zone.rule === 'trial' && !z.zone.done));
  // The acts of the button that are not work: in a task, they never keep a press from the work.
  const WORKLESS = new Set(['talk', 'look', 'ride']);
  // Half blocks: a press walks the hero to the work of the task this far away at most (#54).
  const FAR_WORK = 80;
  // The press walks the hero to a work of the task out of reach, and does its act at the end of
  // the walk (as after a tap on the place).
  function goWork(c) {
    const e = getEntity(state, c.target);
    if (e?.zone?.rule === 'line') goTo(c.at, e.id, Math.round(c.at.x - e.zone.x), { x: c.at.x, z: standOf(e).z });
    else if (e?.zone) goTo(c.at, e.id, null, standOf(e));
    // A standing culm: the hero stands at its side of the road (the clump is dense).
    else if (e?.item?.kind === 'culm') goTo(c.at, e.id, null, { x: c.at.x + 2, z: c.at.z });
    else goTo(c.at, c.target);
    if (hero().route || arrivals.size) pressAfterWalk = true;
  }
  // Has a place of the task of a thing room for it (not its heap)? The row of the fisher up to the
  // float, a free spot, a basket that wants that kind; the other places take any number.
  function roomFor(e) {
    return query(state, 'zone').some((z) => {
      const zone = z.zone;
      if (zone.task !== e.item.task || ['heap', 'pile'].includes(zone.rule) || !canPut(zone, e)) return false;
      if (zone.rule === 'line') return Math.max(0, ...query(state, 'item').filter((x) => x.item.zone === zone.id && x.item.slot != null).map((x) => x.item.slot)) < zone.length;
      if (zone.rule === 'spots') return freeSlot(state, zone) >= 0;
      return true;
    });
  }
  // The places that the hands take a thing back from (the opposite of a put).
  const TAKE_BACK = new Set(['bundle', 'basket', 'line', 'exact', 'share', 'spots', 'hearth']);
  // The point in front of the hero (half blocks), for the places on a line.
  const frontOf = (hp, d = 2) => ({ x: hp.x + Math.sin(hp.facing ?? 0) * d, z: hp.z + Math.cos(hp.facing ?? 0) * d });

  // All that the action button can act on now around the hero, with the distance of each: the
  // finish of a task at its person, the acts of things, the hands (pick up, put, take back), a
  // talk, and Nghé. Each: { act, icon, target (the entity that the outline marks), keys (the ids
  // that a tap makes the target), at (half blocks), d, rank, run, hold, release, ghost }.
  // The work of a task that is out of reach (work: true) is in out.far: with no work in reach, a
  // press walks the hero there, and the act comes at the end of the walk (#54).
  function candidates() {
    const h = hero();
    const hp = h.position;
    const out = [];
    const far = [];
    out.far = far;
    const laterFin = [];
    const add = (c, reach) => {
      const d = distHb(hp, c.at) - (c.size ?? 0);
      if (d <= reach) out.push({ rank: 1, keys: [c.target], ...c, d });
      else if (c.work && d <= FAR_WORK) far.push({ rank: 1, keys: [c.target], ...c, d });
    };
    const open = (id) => {
      const tz = trialZone(id);
      return tz && !tz.zone.done ? tz : null;
    };
    const held = getEntity(state, holding());
    // A heap or a pile of a task in reach (of this task; null: of any open task): a press with
    // empty hands takes from it, and a thing comes back from a place only after a tap on the thing
    // itself (#47). The things of the heap are in reach, not only its point.
    const heapNear = (task) => query(state, 'zone').some((h) => (h.zone.rule === 'heap' || h.zone.rule === 'pile') && (task === null ? h.zone.task?.startsWith('trial-') && !trialZone(h.zone.task.slice(6))?.zone.done : h.zone.task === task)
      && h.zone.items.some((id) => { const t = getEntity(state, id); return t?.position && !t.item.held && distHb(hp, middleOf(t)) <= REACH + 2; }));
    // People: the finish of the task of the person, or a talk (during the task: a call for help).
    for (const q of persons()) {
      const e = getEntity(state, q.entity);
      if (!e || e.hidden || (q.kind === 'encounter' && (raidOn() || practice))) continue;
      const base = { target: q.entity, at: e.position };
      if (held) {
        if (held.item.kind === 'gift' && q.kind === 'npc' && trialDef('share')?.rest?.[q.ref]) add({ ...base, act: 'give', icon: 'hand-give', rank: 0, run: () => giveGift(q) }, REACH + 3);
        continue;
      }
      const fin = finishOf(mentoring.taskOfPerson(q.entity));
      // The finish is a try (a commit): it comes after a tap on the person, or when no heap of the
      // work is in reach. A child who presses again after a put never ties by accident (#47).
      const tapped = chosen?.id === q.entity;
      // With no tap, the finish comes only after a put of the child in the task: the first step
      // that the mentor shows is not a try of the child (#54).
      const task = mentoring.taskOfPerson(q.entity);
      if (fin && (tapped || (!TAP_FINISH.has(task) && !heapNear(null) && childPut.has(task)))) add({ ...base, ...fin, rank: 0, work: true }, REACH + 3);
      // With a heap in reach, the finish waits: it comes only when the press has no other work
      // (#54: the basket of the healer has enough of each kind, and the healer stands at it).
      else if (fin && !tapped) {
        if (childPut.has(task) && !TAP_FINISH.has(task)) laterFin.push({ ...base, ...fin, rank: 0, work: true });
        continue;
      }
      // While the task of the person is open, a talk is a call for help: it needs a tap on the
      // person. A press with no tap does the work (#54).
      else if (task && !tapped) continue;
      // A talk that the child heard comes again only after a tap on the person: a child who
      // presses the button near the forge for other things does not open the same talk (#49).
      // In a practice, a person who is not of the practice greets only after a tap (#51).
      else if (practice && q.kind === 'npc' && !ofPractice(q.ref) && !tapped) continue;
      else if (tapped || q.kind !== 'npc' || !heard.has(pickTalk(data.npcs.npcs[q.ref] ?? {}, profile))) add({ ...base, act: 'talk', icon: 'talk', rank: 3, run: () => interact({ kind: q.kind, id: q.ref }, q) }, REACH + 3);
    }
    if (!held) {
      // The folk games of the children: join them, and the throw of the shard (a hold).
      folk.candidates(add, REACH);
      // The acts of things: the glowing iron (quench), the bellows on the lumps (blow), a bronze
      // drum (a beat), the jar of feed (a scoop for each press).
      for (const id of ['smith', 'horse']) {
        const tz = open(id);
        // While the smith shows the quench on his own piece, the iron is his.
        const iron = tz?.zone.heat !== null && tz?.zone.heat !== undefined && !tz.zone.bent && !tz.zone.demo ? getEntity(state, tz.zone.iron ?? 'iron:smith') : null;
        if (iron) add({ act: 'quench', icon: 'water', target: iron.id, at: tz.zone.anvil, rank: 0, work: true, run: () => work(id, 'quench') }, REACH + 3);
      }
      const hearth = zoneOf('hearth');
      const bellows = query(state, 'item', 'position').find((e) => e.item.kind === 'bellows' && !e.hidden);
      if (open('horse')?.zone.heat === null && hearth?.zone.items.length) add({ act: 'blow', icon: 'fire', target: bellows?.id ?? hearth.id, keys: [bellows?.id, hearth.id], at: bellows?.position ?? hearth.position, rank: 0, work: true, run: () => work('horse', 'blow') }, REACH + 3);
      const drum = hamlet.round('drum');
      if (drum && !drum.done) {
        for (const e of query(state, 'hamletTap', 'position')) if (e.hamletTap.act === 'drum') add({ act: 'drum', icon: 'drum', target: e.id, at: e.position, rank: 0, run: () => work('drum', 'tap', { which: e.hamletTap.which ?? 0 }) }, REACH + 1);
      }
      const ducks = hamlet.round('ducks');
      const jar = getEntity(state, 'hamlet:jar');
      if (ducks && !ducks.done && !ducks.eat && jar) {
        add({ act: 'pour', icon: 'jar', target: jar.id, at: jar.position, rank: 0, run: () => work('ducks', 'pour') }, REACH + 1);
      }
      // A stake of a plot of a choose round of the planting: the choice of that plot.
      const round = getEntity(state, 'zone:trial-plant')?.zone.round;
      if (round && !round.anim && plotsOf(state)[0]?.plot.form === 'choose') {
        for (const e of query(state, 'plotPart', 'position')) {
          if (e.plotPart.which !== 'plot' && e.plotPart.which !== 'decoy') continue;
          add({ act: 'choose', icon: 'check', target: e.id, at: e.position, rank: 0, run: () => work('plant', 'choose', { plot: e.plotPart.plot, which: e.plotPart.which }) }, REACH + 1);
        }
      }
      // The standing culms of the staffs: while the button is down, the mark of the slash goes up
      // the culm; when it goes up, the slash is at the mark.
      const staffs = open('staffs');
      if (staffs && !staffs.zone.cut) {
        for (const e of query(state, 'item', 'position')) {
          if (e.item.kind !== 'culm' || e.hidden) continue;
          const culm = e.item.slot;
          add({ act: 'slash', icon: 'knife', target: e.id, at: e.position, rank: 0, work: true, hold: true, run: () => work('staffs', 'aim', { culm }), release: () => work('staffs', 'slash', { culm }) }, REACH + 2);
        }
      }
      // The stem of the woodcutter: a chalk mark at the place in front of the hero (or at the place
      // of the tap); with a mark there, the mark comes away.
      const wood = open('woodcutter');
      const stem = getEntity(state, 'stem:woodcutter');
      if (wood && stem && !stem.hidden && !wood.zone.cut) {
        const s = wood.zone.stem;
        const tapped = chosen?.id === stem.id && chosen.along !== null ? chosen.along : null;
        const at = Math.max(1, Math.min(s.length - 1, tapped ?? Math.round(frontOf(hp).x - s.x)));
        const point = { x: s.x + at, z: s.z };
        const marked = wood.zone.marks.includes(at);
        // A mark goes away only after a tap on it: a second press never takes away the mark that
        // the child just made (#47).
        if (!(marked && tapped === null)) add({ act: marked ? 'unmark' : 'mark', icon: marked ? 'clear' : 'chalk', target: stem.id, at: point, rank: 0, work: !marked, ghost: marked ? null : { look: 'chalk', x: point.x, y: s.y + 0.6, z: point.z }, run: () => work('woodcutter', 'mark', { at }) }, REACH + 2);
      }
      // The hands: pick up a thing (on a span, only its last plank); take one back from a place.
      const want = wantKind();
      const wantLeft = want && query(state, 'item', 'position').some((e) => e.item.kind === want && !e.item.held && !e.hidden && ['heap', 'pile'].includes(zoneOf(e.item.zone)?.zone.rule));
      for (const e of query(state, 'item', 'position')) {
        if (e.hidden || e.item.held || e.item.set || e.item.fixed) continue;
        const zone = zoneOf(e.item.zone);
        const rule = zone?.zone.rule;
        if (rule === 'span') {
          if (!canTake(zone.zone, e.id)) continue;
          // The last plank comes back only after a tap on it: a press never undoes a put (#47, #54).
          if (chosen?.id !== e.id) continue;
          add({ act: 'pick', icon: 'hand-pick', target: e.id, keys: [e.id, zone.id], at: zone.position, rank: 1, run: () => worldCommand(state, { type: 'pick', id: 'hero', item: e.id }) }, REACH);
          continue;
        }
        if (zone && rule !== 'heap' && rule !== 'pile') continue;
        // Of the things of a task, the kind of the last pick first, while a heap has that kind. A
        // tap on a thing chooses it.
        if (want !== null && chosen?.id !== e.id && e.item.task === lastPick?.task && e.item.kind !== want && (wantLeft || SAME_KIND.has(lastPick.task))) continue;
        // A press picks a thing of a task only when a place of the task has room for it: no stake
        // after the row is at the float (#54: the stake stayed in the hands with no act).
        if (chosen?.id !== e.id && openTask(e.item.task) && !roomFor(e)) continue;
        // A tap on a thing of a heap or a pile chooses the pick of each thing of the same kind and
        // size there: the walk to a thing at the far side of a pile stops at the near side, and the
        // act there is the pick of a near thing like it, which is the act of the tap (not a new
        // picture that waits, #60).
        const like = (id) => { const x = getEntity(state, id)?.item; return x && x.kind === e.item.kind && x.size === e.item.size; };
        const keys = [e.id, ...(zone ? [zone.id, ...zone.zone.items.filter(like)] : [])];
        // One press, one thing (#61): with the mat of the teacher or the basket of the healer in
        // reach too, the press takes one thing from the heap and puts it on the place, in one move,
        // so that a child who counts the presses counts the things. Only with the thing in reach:
        // out of reach, the press walks to the heap (a walk to the place never comes nearer to it).
        const size = (e.item.size ?? 0) / 2;
        const into = openTask(e.item.task) && distHb(hp, middleOf(e)) - size <= REACH ? oneMovePlace(e) : null;
        if (into) {
          const ghost = { look: e.look, x: into.position.x, y: into.position.y, z: into.position.z, facing: 0 };
          add({ act: 'put', icon: 'hand-put', target: into.id, keys: [into.id, ...keys], at: middleOf(e), size, rank: 1, work: true, ghost, run: () => {
            worldCommand(state, { type: 'pick', id: 'hero', item: e.id });
            worldCommand(state, { type: 'put', id: 'hero', zone: into.zone.id });
          } }, REACH);
          continue;
        }
        add({ act: 'pick', icon: 'hand-pick', target: e.id, keys, at: middleOf(e), size, rank: 1, work: openTask(e.item.task), run: () => worldCommand(state, { type: 'pick', id: 'hero', item: e.id }) }, REACH);
      }
      // Take back: the thing that the child tapped on a place (the opposite of a put), from where
      // the hero stands to put. Only after a tap on the thing itself, with the heap in reach or
      // not: a press never undoes what the child just put (#47, #54).
      for (const z of query(state, 'zone')) {
        if (!TAKE_BACK.has(z.zone.rule)) continue;
        const things = z.zone.items.map((id) => getEntity(state, id)).filter((e) => e && !e.hidden && !e.item.held && !e.item.set && !e.item.fixed && canTakeWork(state, e));
        const e = things.find((x) => x.id === chosen?.id);
        if (!e) continue;
        const spread = z.zone.rule === 'line' || z.zone.rule === 'spots';
        add({ act: 'pick', icon: 'hand-pick', target: e.id, keys: [e.id], at: spread ? e.position : nearIn(z, hp), rank: 1.5, run: () => worldCommand(state, { type: 'pick', id: 'hero', item: e.id }) }, REACH + 2);
      }
      // The guess at the bridge: the plank outline in front of the hero (or the outline of the last
      // tap). A press chooses it: the bridge takes that many planks.
      const outlines = query(state, 'guess', 'position').filter((g) => g.guess.left === undefined);
      if (outlines.length) {
        const ahead = frontOf(hp);
        const g = outlines.find((x) => x.id === chosen?.id) ?? outlines.reduce((a, b) => (distHb(ahead, b.position) < distHb(ahead, a.position) ? b : a));
        add({ act: 'guess', icon: 'check', target: g.id, at: g.position, rank: 0.5, run: () => worldCommand(state, { type: 'guess', id: 'hero', zone: g.guess.zone, n: g.guess.n }) }, REACH);
      }
      // A thing of the map with a text or a find (the well, the banyan, a sign, a field, the ore of
      // the forge): the button looks at it when the hero is next to it (#44: a tap only walks).
      const ht = heroFrom();
      for (const z of triggers.list) {
        if (z.on !== 'tap' || (z.once && profile.flags[`zone.${z.id}`]) || !check(z.when, cond())) continue;
        const nx = Math.max(z.x, Math.min(z.x + z.w - 1, ht.x));
        const ny = Math.max(z.y, Math.min(z.y + z.h - 1, ht.y));
        if (Math.max(Math.abs(nx - ht.x), Math.abs(ny - ht.y)) > 2) continue;
        add({ act: 'look', icon: 'look', target: `look:${z.id}`, at: { x: (nx + 0.5) * 2, z: (ny + 0.5) * 2 }, rank: z.action?.pickup ? 1 : 5, run: () => doAction(z) }, REACH + 3);
      }
      // Nghé: get on its back (only when nothing else is in reach), never in a task or a folk game
      // (a press in the middle of the rope must not put the hero on Nghé, #44).
      const nghe = query(state, 'follow', 'position').find((e) => e.follow?.target === 'hero' && !e.hidden);
      if (nghe && !raidOn() && !taskOn()) add({ act: 'ride', icon: 'ride', target: nghe.id, at: nghe.position, rank: 6, run: () => worldCommand(state, { type: 'ride', id: 'hero', mount: nghe.id }) }, REACH + 2);
      if (!out.some((c) => !WORKLESS.has(c.act)) && !far.length) for (const c of laterFin) add(c, REACH + 3);
      return out;
    }
    // A thing in the hands: the places that take it (a ghost shows where it goes on a line).
    const front = frontOf(hp);
    for (const z of query(state, 'zone')) {
      const zone = z.zone;
      if (!canPut(zone, held)) continue;
      // A place of a done task is never a target (#54: the forge of the smith and the hearth of the
      // iron horse are at the same place).
      if (zone.task?.startsWith('trial-') && trialZone(zone.task.slice(6))?.zone.done) continue;
      const work = openTask(zone.task);
      const put = (at, opts = {}) => worldCommand(state, { type: 'put', id: 'hero', zone: zone.id, ...(at ? { at } : {}), ...opts });
      if (zone.rule === 'span') {
        const before = zone.items.reduce((a, id) => a + (getEntity(state, id)?.item.size ?? 0), 0);
        const slot = spanSlot(zone, before, held.item.size);
        add({ act: 'put', icon: 'hand-put', target: z.id, at: z.position, work, rank: 0, ghost: { look: held.look, x: slot.x, y: slot.y, z: slot.z, facing: 0 }, run: () => put(null) }, REACH);
      } else if (zone.rule === 'line') {
        if (trialZone('fisher')?.zone.tide?.phase !== 'low') {
          // The tide is in: the line takes no stake now. The fisher says a short line, and the stake
          // stays in the hands; a press never drops it on the bank (#47).
          const fisher = query(state, 'person').find((e) => e.person.ref === 'fisher') ?? null;
          add({ act: 'wait', icon: 'water', target: z.id, at: nearIn(z, hp), rank: 0, run: () => emit({ type: 'open', screen: 'callout', id: fisher?.id ?? 'npc:fisher', textKey: 'fisher.tide.wait', params: {} }) }, REACH + 3);
          continue;
        }
        const tapped = chosen?.id === z.id && chosen.along !== null ? chosen.along : null;
        // With no tap, the point of the row nearest to the hero; when it has a stake, the next free
        // point after it (one half block). The press never reads the space of the row (#63): the
        // child chooses each space with a tap, and presses alone make a row that is too close.
        const row = query(state, 'item').filter((e) => e.item.zone === zone.id && !e.item.held && e.item.slot != null).map((e) => e.item.slot);
        let slot = Math.max(1, Math.min(zone.length, tapped ?? Math.round(hp.x - zone.x)));
        if (tapped === null) while (row.includes(slot) && slot <= zone.length) slot += 1;
        if (slot > zone.length || row.includes(slot)) continue;
        const at = { x: zone.x + slot, z: zone.z };
        add({ act: 'put', icon: 'hand-put', target: z.id, at, work, rank: 0, ghost: { look: held.look, x: at.x, y: zone.y, z: at.z, facing: 0 }, run: () => put(at) }, REACH + 2);
      } else if (zone.rule === 'spots') {
        const tapped = chosen?.id === z.id && chosen.along !== null && freeSlot(state, zone, zone.slots[chosen.along]) === chosen.along ? chosen.along : null;
        const k = tapped ?? freeSlot(state, zone, front);
        if (k < 0) continue;
        const at = { x: zone.slots[k].x, z: zone.slots[k].z };
        add({ act: 'put', icon: 'hand-put', target: z.id, at, work, rank: 0, ghost: { look: held.look, x: at.x, y: zone.y, z: at.z, facing: 0 }, run: () => put(at) }, REACH + 2);
      } else if (zone.rule === 'pile') {
        // A pile is long: near the pile or near one of its planks.
        // A tap on a plank of the pile makes the pile the target too.
        const near = [z.position, ...zone.items.map((id) => getEntity(state, id)).filter(Boolean).map(middleOf)];
        const at = near.reduce((a, b) => (distHb(hp, b) < distHb(hp, a) ? b : a));
        add({ act: 'put', icon: 'hand-put', target: z.id, keys: [z.id, ...zone.items], at, work, rank: 0.5, run: () => put(null) }, REACH + 3);
      } else if (zone.rule === 'heap') {
        if (held.item.home !== zone.id) continue;
        // Back on its own heap: only after a tap on the heap. A press after a pick never puts the
        // thing back (#44, #54: pick, put back, pick, put back).
        if (!chosen || ![z.id, ...zone.items].includes(chosen.id)) continue;
        add({ act: 'put', icon: 'hand-put', target: z.id, keys: [z.id, ...zone.items], at: z.position, rank: 4, run: () => put(null) }, REACH + 2);
      } else if (zone.rule === 'road') {
        continue;
      } else {
        if (zone.rule === 'hearth' && trialZone('horse')?.zone.heat !== null) continue;
        // A tap on a thing on the place (the sticks on the wood pile) makes the place the target too.
        add({ act: 'put', icon: 'hand-put', target: z.id, keys: [z.id, ...zone.items], at: nearIn(z, hp), work, rank: 0, run: () => put(null) }, REACH + 2);
      }
    }
    // Anywhere else: put it down on the ground in front of the hero. A thing of a task never goes
    // on the ground by the button (#54): it goes to its place, or the button does nothing.
    if (held.item.task?.startsWith('trial-')) return out;
    out.push({ act: 'put', icon: 'hand-put', target: held.id, keys: [], at: hp, d: 0, rank: 10, run: () => worldCommand(state, { type: 'drop', id: 'hero' }) });
    return out;
  }

  // The target of the action button now (docs/TASKS.md): the thing in reach in front of the hero
  // that the button can act on, the target of the last tap first. On Nghé, the only target is
  // the way down. null: the button is dim.
  function action() {
    const h = hero();
    if (screen || busy || h.fall) return null;
    if (raidOn()) return raidAction();
    const getOff = () => worldCommand(state, { type: 'ride', id: 'hero' });
    if (h.riding) {
      // On Nghé, next to a person who can talk: the button shows the talk, and one press gets the
      // hero down and opens the talk (#60).
      const talk = candidates().find((c) => c.act === 'talk' && String(c.target).startsWith('npc:'));
      if (talk) return { ...talk, run: () => { getOff(); talk.run(); } };
      return { act: 'ride-off', icon: 'ride-off', target: h.riding, run: getOff };
    }
    let list = candidates();
    // In a task, with no work in reach, the press walks the hero to the nearest work of the task:
    // the heap, the place for the thing in the hands, the anvil, the culms (#54). A talk, a look,
    // or a ride never comes in place of the work.
    const tapped = (c) => Boolean(chosen && c.keys.includes(chosen.id));
    const tappedNear = list.some(tapped);
    if (taskOn() && !tappedNear && !list.some((c) => c.work || !WORKLESS.has(c.act)) && list.far.length) {
      const c = list.far.reduce((a, b) => (b.d + b.rank * 0.5 < a.d + a.rank * 0.5 ? b : a));
      return { ...c, go: true, hold: false, release: null, run: () => goWork(c) };
    }
    // In a task, a press never looks or talks in place of the work, also while no work is left for
    // a moment (the fisher shows a stake; the tide comes in): the button waits. A tap chooses them:
    // a look or a talk stays only when the child tapped that one (#60: a tap on a stake of the row
    // of the fisher never made the look at the river the act).
    if (taskOn()) list = list.filter((c) => c.work || !WORKLESS.has(c.act) || tapped(c));
    if (!list.length) return null;
    // With a thing in the hands: a place in reach that takes it always comes before the ground,
    // and the hero turns to it (#44). The ground is a target only when no place is in reach.
    const holdsThing = Boolean(holding());
    const places = list.filter((c) => !(c.act === 'put' && c.rank >= 10));
    if (holdsThing && places.length) list = places;
    // With an enemy of an encounter in reach, a look at a field or a sign is never the act (#55).
    if (list.some((c) => c.act === 'talk' && String(c.target).startsWith('encounter:'))) list = list.filter((c) => c.act !== 'look');
    // The ride on Nghé comes only when nothing else is in reach, or after a tap on Nghé (#60).
    const others = list.filter((c) => c.act !== 'ride' || tapped(c));
    if (others.length) list = others;
    const f = h.position.facing ?? 0;
    const score = (c) => {
      const dx = c.at.x - h.position.x;
      const dz = c.at.z - h.position.z;
      const len = Math.hypot(dx, dz);
      // In front of the hero comes first; behind the hero comes last (a place for the thing in the
      // hands: the hero turns to it).
      const front = len < 0.5 ? 1 : (dx * Math.sin(f) + dz * Math.cos(f)) / len;
      const turn = holdsThing && c.act === 'put' ? 0 : front < -0.2 ? 6 : front < 0.4 ? 2 : 0;
      // The thing that the child tapped comes first, then a thing like it in the same pile.
      const tapped = chosen && c.keys.includes(chosen.id) ? (c.target === chosen.id ? 12 : 8) : 0;
      return Math.max(0, c.d) + c.rank * 0.5 + turn - tapped;
    };
    return list.reduce((a, b) => (score(b) < score(a) ? b : a));
  }
  // The picture on the big button (#60): the act that the child sees. A change of the picture that
  // the child did not make (a person or Nghé comes into reach or goes, the hero stops at the end of
  // a walk, the hero turns) starts its act SETTLE seconds after it shows: a child presses about half
  // a second after the child sees a picture. In that time a press does the act of the old picture
  // when it is still possible, or nothing (the button pulses once). A change that comes from a press
  // or a tap of the child is the act at once (after a pick, the next press puts).
  const SETTLE = 0.6;
  const CHILD_CHANGE = 0.4; // seconds after a command of the child: the change is of the child
  let shown = null; // { key, a (the act), t (the tick of the change), prev (the picture before) }
  let lastChild = -Infinity;
  const actKey = (a) => (a ? `${a.act}|${a.target}` : null);
  function watchPicture() {
    const a = action();
    const key = actKey(a);
    if (shown && key === shown.key) {
      shown.a = a;
      return;
    }
    const child = (state.tick - lastChild) * STEP < CHILD_CHANGE || Boolean(a && chosen && (a.keys ?? [a.target]).includes(chosen.id));
    shown = { key, a, t: state.tick, prev: child ? null : shown };
  }
  // The act of a press: the act of the picture, or of the old picture while a new one settles.
  // Null: no act (the button pulses when a new picture took the place of an act that is gone).
  function pressAct() {
    watchPicture();
    const a = shown.a;
    if (!shown.prev || (state.tick - shown.t) * STEP >= SETTLE) return a;
    const old = shown.prev.a;
    const still = old && candidates().find((c) => c.act === old.act && c.target === old.target);
    if (still) return still;
    emit({ type: 'pulse', id: null });
    return null;
  }
  // The action button (or E): do the act of the target, and the target pulses once. An act
  // that goes on while the button is down starts here, and ends with the hold of the button.
  // walked: the press came during the walk to the target. An act that goes on while the button is
  // down (a slash) does not start then: the button is up (#54).
  function act(walked = false) {
    // A press at the end of a walk to a tapped target is the act of the tap (the child chose it).
    const a = walked ? action() : pressAct();
    // The hero still walks to the target of the last tap, and the button has no act on it yet:
    // the press comes at the end of the walk (a child presses at once).
    if (chosen && (hero().route || arrivals.size) && !(a && (a.keys ?? [a.target]).includes(chosen.id))) {
      pressAfterWalk = true;
      return;
    }
    if (!a) return;
    if (a.hold && walked) return;
    if (a.hold) return hold(true);
    // The hero turns to the target of the act (a place behind the hero, #44).
    if (a.at && a.act !== 'ride' && a.act !== 'ride-off') worldCommand(state, { type: 'face', id: 'hero', x: a.at.x, z: a.at.z });
    a.run();
    // The act on the target of the last tap is done: the next press chooses again (#47: the next
    // press never takes back what was just put there).
    if (!a.go && chosen && (a.keys ?? [a.target]).includes(chosen.id)) chosen = null;
    emit({ type: 'pulse', id: a.target });
  }

  // The cue: when the child does nothing for CUE_IDLE seconds in a task, the thing to touch next
  // glows softly (the first rung of help; docs/TASKS.md). It shows how to go on, never how many:
  // the place of the thing in the hands; the glowing iron; the heap of a place that is still
  // empty. It stops when the child acts.
  let idleT = 0;
  let cue = [];
  // ids: the things that glow; a place (a zone) glows as a thin rim on the ground (spots, in half
  // blocks: { x, z, r }).
  // A place on the ground (half blocks: { x, y, z, r }) for the glow of a zone.
  function spotOf(z) {
    const r = z.rect;
    return r ? { x: (r.x0 + r.x1) / 2, y: z.y, z: (r.z0 + r.z1) / 2, r: Math.max(r.x1 - r.x0, r.z1 - r.z0) / 2 } : { x: z.x, y: z.y, z: z.z, r: 2 };
  }
  // rings: the things with a ring of their own. The things of a heap have none; one rim goes
  // around the heap, so that the rings never cover the things (#44).
  function setCue(ids) {
    if (ids.join() === cue.join()) return;
    cue = ids;
    const heapOf = (e) => zoneOf(e?.item?.zone);
    const zones = new Set();
    const rings = [];
    for (const id of ids) {
      const e = getEntity(state, id);
      const heap = heapOf(e);
      if (e?.zone) zones.add(e.id);
      else if (heap?.zone?.rule === 'heap') zones.add(heap.id);
      else rings.push(id);
    }
    // The rim goes around the things of a place too, also when they lie out of its rect.
    const spots = [...zones].map((id) => {
      const z = getEntity(state, id).zone;
      const spot = spotOf(z);
      const far = Math.max(0, ...z.items.map((t) => getEntity(state, t)?.position).filter(Boolean).map((p) => Math.hypot(p.x - spot.x, p.z - spot.z) + 1));
      return { ...spot, r: Math.max(spot.r, far) };
    });
    emit({ type: 'cue', ids, spots, rings });
  }
  function acted() {
    idleT = 0;
    setCue([]);
  }
  function updateCue() {
    if (screen || busy || raidOn() || hero().fall || (hero().motion?.speed ?? 0) > 0.5) {
      acted();
      return;
    }
    idleT += STEP;
    if (idleT >= CUE_IDLE) setCue(cueIds());
  }
  function cueIds() {
    const key = mentoring.activeKey();
    // A practice of a whole place, with no task now: the person of the nearest station glows.
    if (!key && stations().length) {
      const hp = hero().position;
      const near = stations().map((id) => getEntity(state, `npc:${id}`)).filter((e) => e && !e.hidden)
        .reduce((a, b) => (!a || distHb(hp, b.position) < distHb(hp, a.position) ? b : a), null);
      return near ? [near.id] : [];
    }
    if (!key || key === 'bridge') return [];
    const owner = key.startsWith('event-') ? `trial-${key}` : key;
    const zones = query(state, 'zone').filter((z) => z.zone.task === owner);
    const fits = (z, kind) => [].concat(z.zone.accepts ?? []).includes(kind);
    const held = getEntity(state, holding());
    if (held) {
      const z = zones.find((x) => x.zone.rule !== 'heap' && fits(x, held.item.kind));
      return z ? [z.id] : [];
    }
    // The iron while it glows (the smith and the iron horse).
    for (const id of ['smith', 'horse']) {
      const tz = trialZone(id);
      const iron = tz && !tz.zone.done && tz.zone.heat !== null && !tz.zone.bent && !tz.zone.demo ? getEntity(state, tz.zone.iron ?? 'iron:smith') : null;
      if (iron && `trial-${id}` === owner && (iron.glow ?? 0) >= (trialDef(id)?.glow?.hot ?? 1)) return [iron.id];
    }
    // The woodcutter: the stem, before the first chalk mark.
    const wood = owner === 'trial-woodcutter' ? trialZone('woodcutter') : null;
    if (wood && !wood.zone.done && !wood.zone.marks?.length && !wood.zone.cut) return ['stem:woodcutter'];
    // A place that is still empty: its heap.
    const needs = (z) => z.zone.rule !== 'forge' && z.zone.rule !== 'trough' && !z.zone.items.length && !z.zone.set;
    for (const z of zones) {
      if (z.zone.rule === 'heap' || z.zone.rule === 'trial' || !needs(z)) continue;
      const heap = zones.find((h) => h.zone.rule === 'heap' && !h.id.includes('-stray-') && h.zone.items.length && [].concat(h.zone.accepts).some((k) => fits(z, k)));
      if (heap) return [...heap.zone.items];
    }
    // The activities of Xóm Ruộng with no heap: the jar of feed, the bronze drum.
    const act = owner.startsWith('trial-') ? owner.slice(6) : null;
    const r = act && ['ducks', 'drum'].includes(act) ? hamlet.round(act) : null;
    if (r && !r.done && !r.pouring && !r.eat && !r.dance) return query(state, 'hamletTap').filter((e) => e.hamletTap.act === act).map((e) => e.id);
    return [];
  }

  // A tap: the hero, a plank outline, a plank, a person, a thing with a trigger zone, or a place
  // on the ground.
  function tap(target) {
    emit({ type: 'sound', sound: 'tap' });
    if (hero().fall) return;
    // A plank outline of the guess at the bridge: the hero walks to it, and it is the target (the
    // action button chooses it).
    if (target.guess) {
      const g = getEntity(state, `guess:${target.guess.zone}:${target.guess.n}`);
      if (g) {
        emit({ type: 'tapfx', x: g.position.x / 2, y: g.position.z / 2, h: groundY(g.position.x / 2, g.position.z / 2) });
        goTo(g.position, g.id);
      }
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
      // A tap on a bed of the healer: she says the name of its herb (#61).
      if (thing?.item?.kind?.startsWith('herb-') && zoneOf(thing.item.zone)?.zone.rule === 'heap') sayHerb('bed', thing.item.kind);
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
    // A stake of a plot, the jar of feed, a bronze drum, or the weir: the hero walks there.
    const part = target.plotStake ?? target.hamlet;
    if (part) {
      const e = getEntity(state, part.id);
      if (e) goTo(e.position, e.id);
      return;
    }
    if (target.person) {
      const person = persons().find((p) => p.entity === target.person);
      if (!person || (person.kind === 'encounter' && raidOn())) return;
      emit({ type: 'tapfx', x: person.x, y: person.y, h: groundY(person.x, person.y) });
      chosen = { id: person.entity, along: null };
      pressAfterWalk = false;
      // A press while the hero walks to the person (or to the enemies of an encounter) comes at the
      // end of the walk, as at a place of a task (#50: a child presses at once).
      walkToThing(person, () => {
        worldCommand(state, { type: 'face', id: 'hero', x: person.x * 2, z: person.y * 2 });
        if (pressAfterWalk) {
          pressAfterWalk = false;
          act();
        }
      });
      return;
    }
    const hit = target.ground;
    if (!hit) return;
    // With empty hands, a tap at the place of a task is a check (the hero walks there and looks).
    if (!holding()) mentoring.checkAt(hit.x * 2, hit.y * 2);
    if (tapTaskPlace(hit) || (raidOn() && tapRaidRoad(hit))) {
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
    // The ground (or the foot of a thing). A tap always walks (#44): a tap never opens a talk or a
    // text; the big button does that near the thing.
    const tile = { x: Math.floor(hit.x), y: Math.floor(hit.y) };
    // A star can stand on land that is not made yet (far away): its walk goes there all the same.
    if (!hit.goal && !tileMap.inside(tile.x, tile.y)) return;
    emit({ type: 'tapfx', x: hit.x, y: hit.y, h: hit.thing ? groundY(hit.x, hit.y) : hit.h });
    // The broken bridge: put the plank there, or walk out on the planks.
    const span = spanAt(tile.x, tile.y);
    if (span) {
      tapSpan(span);
      return;
    }
    log('action', { kind: 'walk' });
    // A tap on a thing of the map with a text (a field, the river, a sign) chooses it: in a task,
    // its look is a target only after this tap (#60).
    const look = triggers.list.find((z) => z.on === 'tap' && tile.x >= z.x && tile.x < z.x + z.w && tile.y >= z.y && tile.y < z.y + z.h);
    chosen = look ? { id: `look:${look.id}`, along: null } : null;
    // A tap on a star (or on its arrow at the edge of the screen): a walk all the way to the goal
    // along the roads, or to the ferry on the way (#53). A new tap, a talk, or a ferry stops it.
    if (hit.goal && walkFar(hit)) return;
    // A tap past an edge of the world (the deep sea, the mist): the walk stops at the edge.
    if (edgeAt(tile.x, tile.y)) {
      const stop = edgeStop(from, hit);
      if (stop) walkPath(findPath(tileMap, from, stop)?.slice(0, -1), { x: stop.x + 0.5, y: stop.y + 0.5 }, null);
      return;
    }
    const paths = pathMap();
    if (paths.walkable(tile.x, tile.y)) walkPath(findPath(paths, from, tile)?.slice(0, -1), { x: hit.x, y: hit.y }, null);
    else if (hit.under) {
      // A tap on a roof, a wall, or a tree: the hero walks around it to the free cell nearest to
      // the ground under the finger, the side that the child sees past it (#53).
      const path = pathNearest(paths, from, hit.under);
      if (path) walkPath(path, null, null);
      else walkPath(pathToward(paths, from, tile), null, null);
    } else walkPath(pathToward(paths, from, tile), null, null);
  }

  // The count of the work for the goal bar, as things (#48): the bundles of the teacher (the ones
  // tied, of all that the rods make). Null for the other work.
  function workCount() {
    if (mentoring.activeKey() !== 'trial-scholar') return null;
    const mat = zoneOf('mat');
    if (!mat) return null;
    const rods = query(state, 'item').filter((e) => e.item.kind === 'rod' && e.item.task === 'trial-scholar').length;
    const have = mat.zone.tied ?? 0;
    return { pip: 'bundle', have, need: have + Math.floor(rods / (mat.zone.bundle ?? 10)) };
  }

  // A far walk to a goal (map cells), in legs: each leg is a short search that goes to the cell
  // nearest to the goal that it finds, and the next leg starts at its end. When a leg comes no
  // nearer (a river), the walk goes to the landing of the ferry that leads nearer to the goal; the
  // ferry starts there. A new tap, a talk, or the ferry ends the walk (they end the arrival of the
  // leg). True when the hero walks or stands at the goal.
  const LEG = 2500; // the most cells of the search of one leg
  // The ferry that a far walk goes to: { final (the goal), at (the landing) }. A new tap on the same
  // goal keeps the way to that landing (#56: before, each new tap on the way along the bank turned
  // the walk back to the end of the sandbar, nearer to the star in a line). The ferry, or a tap on
  // another goal, ends it.
  let farPlan = null;
  function walkFar(goal, final = goal, waits = 0) {
    const from = heroFrom();
    const here = { x: from.x + 0.5, y: from.y + 0.5 };
    if (goal === final && farPlan && Math.hypot(farPlan.final.x - final.x, farPlan.final.y - final.y) < 2) {
      const landing = landingToward(here, from, final);
      if (landing && !landing.part && Math.hypot(landing.at.x - farPlan.at.x, landing.at.y - farPlan.at.y) < 4) {
        walkPath(landing.way, null, () => walkFar(landing.at, final));
        return true;
      }
    }
    if (goal === final && farPlan && Math.hypot(farPlan.final.x - final.x, farPlan.final.y - final.y) >= 2) farPlan = null;
    const left = Math.hypot(goal.x - here.x, goal.y - here.y);
    if (left < 1.5) {
      // The last step: onto the cell of the goal when the hero can stand there, so that the hero
      // comes into the zone of a place (the gate of Văn Miếu, #51).
      const tile = { x: Math.floor(goal.x), y: Math.floor(goal.y) };
      if ((from.x !== tile.x || from.y !== tile.y) && pathMap().walkable(tile.x, tile.y)) walkPath(findPath(pathMap(), from, tile), { x: goal.x, y: goal.y }, null);
      return true;
    }
    const way = findPath(pathMap(), from, { x: Math.floor(goal.x), y: Math.floor(goal.y) }, { maxNodes: LEG, nearest: true });
    const end = way?.length ? way[way.length - 1] : null;
    if (!end || Math.hypot(goal.x - end.x - 0.5, goal.y - end.y - 0.5) > left - 1) {
      // No nearer because the land ahead is not made yet (the chunks come a little later in the
      // browser): the walk waits for it and goes on (#56; before, each tap on a far star walked
      // 40 to 70 blocks and stopped). A new tap, the stick, or a talk ends the wait.
      if (landAhead(end ?? from, goal) && waits < FAR_WAITS) {
        waitFar(() => walkFar(goal, final, waits + 1));
        return true;
      }
      // No nearer (a river, or the end of a sandbar): the whole way to the landing of a ferry, once.
      const landing = goal === final ? landingToward(here, from, final) : null;
      if (!landing) return false;
      // Part of the way (to the end of the made land): then the walk looks again from there, or
      // waits for the land when it is at that end already.
      if (landing.part) {
        if (landing.way.length) walkPath(landing.way, null, () => walkFar(goal, final));
        else if (waits < FAR_WAITS) waitFar(() => walkFar(goal, final, waits + 1));
        else return false;
        return true;
      }
      farPlan = { final: { x: final.x, y: final.y }, at: landing.at };
      walkPath(landing.way, null, () => walkFar(landing.at, final));
      return true;
    }
    walkPath(way, null, () => walkFar(goal, final));
    return true;
  }
  // Is a cell on the line from a cell toward the goal (a few cells ahead) not made yet?
  function landAhead(c, goal) {
    const dx = goal.x - c.x - 0.5;
    const dy = goal.y - c.y - 0.5;
    const n = Math.hypot(dx, dy) || 1;
    for (let k = 1; k <= 8; k++) {
      if (!tileMap.inside(Math.floor(c.x + 0.5 + (dx / n) * k), Math.floor(c.y + 0.5 + (dy / n) * k))) return true;
    }
    return false;
  }
  // Do fn after a short wait, unless a new walk, the stick, or a screen ends it (they clear the
  // arrivals). The world step calls stepFarWait.
  const FAR_WAIT = 0.5; // seconds
  const FAR_WAITS = 40; // the most waits of one far walk (20 seconds)
  let farWait = null;
  function waitFar(fn) {
    const token = nextToken++;
    arrivals.clear();
    worldCommand(state, { type: 'stop', id: 'hero' });
    arrivals.set(token, fn);
    farWait = { token, t: FAR_WAIT };
  }
  function stepFarWait() {
    if (!farWait) return;
    if (!arrivals.has(farWait.token)) {
      farWait = null;
      return;
    }
    farWait.t -= STEP;
    if (farWait.t > 0) return;
    const fn = arrivals.get(farWait.token);
    arrivals.delete(farWait.token);
    farWait = null;
    fn();
  }
  // The landing of a ferry (map cells) whose other side is nearer to the goal, and the whole way to
  // it from the cell of the hero: { at, way }, or null. A landing is the zone of a ferry of the map,
  // or the step of a ferry of the roads of the land. The nearest landing can be on the other bank
  // (#56): a landing with no way to it does not count.
  const LANDING_FAR = 400; // cells: the farthest landing
  const LANDING_SEARCH = 60000; // the most cells of the search of the way to a landing
  function landingToward(here, from, goal) {
    const sides = [];
    const zones = (map.layers.triggers ?? []).filter((z) => z.action?.ferry);
    for (const z of zones) {
      const other = zones.find((o) => o !== z && o.action.ferry === z.action.ferry);
      if (other) sides.push({ at: { x: z.x + z.w / 2, y: z.y + z.h / 2 }, far: { x: other.x + other.w / 2, y: other.y + other.h / 2 } });
    }
    for (const f of map.land?.ferries ?? []) sides.push({ at: f.stepA, far: f.stepB }, { at: f.stepB, far: f.stepA });
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const near = sides.filter((s) => d(here, s.at) < LANDING_FAR && d(s.far, goal) < d(here, goal) - 4);
    near.sort((a, b) => d(here, a.at) + d(a.far, goal) - (d(here, b.at) + d(b.far, goal)));
    const paths = pathMap();
    for (const s of near.slice(0, 3)) {
      const way = findPath(paths, from, { x: Math.floor(s.at.x), y: Math.floor(s.at.y) }, { maxNodes: LANDING_SEARCH });
      if (way?.length) return { at: s.at, way };
    }
    // No way in the land that is made: a way that goes through the land that is not made yet (the
    // chunks come a little later in the browser). The walk goes to the last cell of the made land
    // on it, and then looks again (#56: at the end of the sandbar of the Red River, three taps did
    // nothing until the land to the east came).
    const open = Object.assign(Object.create(paths), { inside: () => true, walkable: (x, y) => !tileMap.inside(x, y) || paths.walkable(x, y), canStep: (ax, ay, bx, by) => !tileMap.inside(ax, ay) || !tileMap.inside(bx, by) || tileMap.canStep(ax, ay, bx, by) });
    for (const s of near.slice(0, 3)) {
      const way = findPath(open, from, { x: Math.floor(s.at.x), y: Math.floor(s.at.y) }, { maxNodes: LANDING_SEARCH });
      const cut = way ? way.findIndex((c) => !tileMap.inside(c.x, c.y)) : -1;
      if (cut > 0) return { at: s.at, way: way.slice(0, cut), part: true };
      if (cut === 0) return { at: s.at, way: [], part: true };
    }
    return null;
  }

  // A held finger: the move toward a point (map cells) along a path around houses, walls, and
  // steps, as a tap walks (#53). The path comes again when the hero or the finger goes to another
  // cell. Return { dx, dz, strength, run } for a move command, or null at the point.
  let held = null;
  function holdToward(x, y) {
    const from = heroFrom();
    const c = heroCell();
    const key = `${Math.floor(x)},${Math.floor(y)},${from.x},${from.y}`;
    if (held?.key !== key) {
      const paths = pathMap();
      const tile = { x: Math.floor(x), y: Math.floor(y) };
      held = { key, path: paths.walkable(tile.x, tile.y) ? findPath(paths, from, tile, { maxNodes: 8000 }) : pathNearest(paths, from, { x, y }) };
    }
    const path = held.path;
    // The next cell of the path, or the finger itself on the last cell (or with no path).
    const next = path?.length > 1 ? { x: path[0].x + 0.5, y: path[0].y + 0.5 } : { x, y };
    const i = inputToward(c, next, { run: Math.hypot(x - c.x, y - c.y) > 6, stop: path?.length > 1 ? 0.05 : 0.3 });
    return i.strength ? { dx: i.dx, dz: i.dy, strength: i.strength, run: i.run } : null;
  }

  // A path to the free cell nearest to a point (map cells), within some cells of it. Null when
  // no free cell near it has a path; an empty path when the hero stands on that cell.
  function pathNearest(paths, from, point, reach = 8, maxNodes = 8000) {
    const cells = [];
    const cx = Math.floor(point.x);
    const cy = Math.floor(point.y);
    for (let y = cy - reach; y <= cy + reach; y++) {
      for (let x = cx - reach; x <= cx + reach; x++) {
        if (paths.walkable(x, y)) cells.push({ x, y, d: Math.hypot(x + 0.5 - point.x, y + 0.5 - point.y) });
      }
    }
    cells.sort((a, b) => a.d - b.d);
    for (const c of cells.slice(0, 24)) {
      if (c.x === from.x && c.y === from.y) return [];
      const path = findPath(paths, from, c, { maxNodes });
      if (path) return path;
    }
    return null;
  }

  // A path to a blocked cell (a house, water, a paddy, a person): to a free cell next to it, or
  // else to the free cell nearest to it on the line from the hero to it (#44). Never nothing when
  // a free cell is on the way.
  function pathToward(paths, from, tile) {
    const next = pathNextTo(paths, from, tile);
    if (next) return next;
    const n = Math.ceil(Math.hypot(tile.x - from.x, tile.y - from.y) * 2);
    for (let i = 1; i < n; i++) {
      const x = Math.floor(tile.x + 0.5 + ((from.x - tile.x) * i) / n);
      const y = Math.floor(tile.y + 0.5 + ((from.y - tile.y) * i) / n);
      if (!paths.walkable(x, y)) continue;
      if (x === from.x && y === from.y) return null;
      const path = findPath(paths, from, { x, y });
      if (path) return path;
    }
    return null;
  }

  // The last free cell before an edge on the line from the hero to a point (map cells), or null.
  function edgeStop(from, to) {
    const n = Math.ceil(Math.hypot(to.x - from.x - 0.5, to.y - from.y - 0.5) * 2);
    let last = null;
    for (let i = 0; i <= n; i++) {
      const x = Math.floor(from.x + 0.5 + ((to.x - from.x - 0.5) * i) / Math.max(1, n));
      const y = Math.floor(from.y + 0.5 + ((to.y - from.y - 0.5) * i) / Math.max(1, n));
      if (edgeAt(x, y)) break;
      if (tileMap.walkable(x, y)) last = { x, y };
    }
    return last;
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
    // The jar of feed of the ducks, and the bronze drums of the dance.
    for (const e of query(state, 'hamletTap', 'position')) consider({ hamlet: { ...e.hamletTap, id: e.id } }, distHb(p, e.position), 1.6);
    if (best) return best.target;
    for (const e of query(state, 'item', 'position')) {
      // A standing culm needs the height of the finger: only the view (or a story) taps it.
      if (e.hidden || (e.item.set && !e.item.fixed) || e.item.kind === 'culm' || e.item.kind === 'stump') continue;
      const { d, along } = segment(p, e);
      consider(e.item.fixed ? { thing: e.id, along } : { thing: e.id }, d, 1.2);
    }
    // A stake of a plot of a choose round of the planting.
    const plantRound = getEntity(state, 'zone:trial-plant')?.zone.round;
    if (plantRound && !plantRound.anim && plotsOf(state)[0]?.plot.form === 'choose') {
      for (const e of query(state, 'plotPart', 'position')) {
        if (e.plotPart.which === 'plot' || e.plotPart.which === 'decoy') consider({ plotStake: { id: e.id, plot: e.plotPart.plot, which: e.plotPart.which } }, distHb(p, e.position), 1.2);
      }
    }
    if (best) return best.target;
    // During a task, a place of the task comes before a person who stands next to it.
    if (workZoneAt(p.x, p.z)) return { ground: { x, y, h: groundY(x, y), thing: false, object: null } };
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

  // The people who greeted the child: id -> the time of play of the greeting (seconds).
  const greeted = new Map();

  // What the world did in a step, for the story: callouts, gifts, and the skill events.
  // The people at work (#38): the person of a script (an example, a first step, a move of a mentor,
  // the greeting of a place), or of a task that goes on. A person at work says only the lines of
  // the work; the small talk of the day waits until the work ends.
  function workers() {
    const ids = new Set();
    for (const s of query(state, 'script')) for (const st of s.script.steps) for (const id of [st.say?.id, st.point?.id]) if (id) ids.add(id);
    for (const [key, def] of Object.entries(data.mentors?.mentors ?? {})) {
      const tz = getEntity(state, `zone:${key.startsWith('event-') ? `trial-${key}` : key}`);
      if (tz?.zone && !tz.zone.done && def.person) ids.add(def.person);
    }
    return ids;
  }
  // While a person near the hero is at work, the small talk of every person near the hero waits:
  // a line of small talk never takes away a line of the work (src/core/lines.js).
  function quietForWork(id) {
    const at = workers();
    if (at.has(id)) return true;
    const hp = hero().position;
    return [...at].some((w) => talksNear(getEntity(state, w)?.position, hp));
  }

  // A commit at a placement or a turn of a game: a skill event for the learner (see
  // learnerRecord). The commit goes into the learning log too, with P(L) before and after.
  function skillEvent(ev) {
    const l = learner();
    const pBefore = l?.entry(ev.skill).p ?? null;
    const met = (profile.learning?.skills?.[ev.skill]?.n ?? 0) > 0;
    const rec = learnerRecord(ev);
    if (rec) l?.record({ skill: ev.skill, level: rec.level }, rec.correct);
    // The first skill event of a skill of the era: a new print in the notebook (#8).
    if (!met && (profile.learning?.skills?.[ev.skill]?.n ?? 0) > 0 && data.notebook) {
      const skill = data.skills?.skills?.find((s) => s.id === ev.skill);
      if (skill && (skill.era ?? 1) <= (data.notebook.skillEra ?? 1)) emit({ type: 'notebook', id: `skill:${skill.id}`, titleKey: `skill.${skill.id}`, look: null, kind: 'skill', subject: skill.subject });
    }
    const pAfter = l?.entry(ev.skill).p ?? null;
    log('attempt', {
      task: ev.task, skill: ev.skill, phase: 'commit', success: ev.solved, efficient: ev.efficient, first: ev.first, mashing: ev.mashing,
      parts: ev.parts ?? [], resets: ev.resets ?? 0, latencies: ev.latencies ?? [], hint: ev.hint ?? 0, hintSeen: ev.hintSeen ?? null, pBefore, pAfter, retry: false, harder: false, map: map.id,
      off: ev.solved ? 0 : offOf(ev.parts, ev.target),
    });
  }
  // A greeting of a person near the hero (#49). It has words and a sound one time when the child
  // comes near, then not again for some minutes; never during the work of the people near the
  // hero, in a talk, or in a practice (#45); and never from an enemy. A clue of the way comes
  // with the next greeting. A greeting with no words has no sound.
  function greeting(ev) {
    const who = getEntity(state, ev.id)?.person;
    // A person of the map has a greet in data/npcs.json; the villagers of the land and the people of
    // a small event greet as grown people; an enemy (an encounter) does not greet.
    const group = who?.kind === 'npc' ? (data.npcs?.npcs?.[who.ref]?.greet ?? 'grown') : who?.kind === 'encounter' ? null : 'grown';
    const words = GREETS[group];
    const t = state.tick * STEP;
    const last = greeted.get(ev.id);
    if (!words || busy || practice || quietForWork(ev.id)) {
      ev.sound = null;
      return;
    }
    const clue = clueLine(ev.id);
    if (!clue && last !== undefined && t - last < GREET_AGAIN) {
      ev.sound = null;
      return;
    }
    greeted.set(ev.id, t);
    const n = [...String(ev.id)].reduce((a, c) => a + c.charCodeAt(0), 0) + Math.floor(state.clock.minutes / 60);
    const market = group === 'elder' || group === 'grown' ? marketLine() : null;
    emit({ type: 'open', screen: 'callout', id: ev.id, textKey: clue ?? market ?? words[n % words.length], params: { name: profile.hero.name } });
  }
  function worldEvent(ev) {
    // Over the river: the far walk has no ferry to keep any more.
    if (ev.type === 'ferried' && (ev.riders ?? []).includes('hero')) farPlan = null;
    // A person calls out: the fisher when a plank is too long, and the lines of the mentors.
    if (ev.type === 'call' && !busy) emit({ type: 'open', screen: 'callout', id: ev.id, textKey: ev.key, params: ev.params ?? {} });
    // The mentors read the commits (before the learner takes them), the plank too long, and the
    // actions of the hands.
    if (ev.type === 'skill') mentoring.skill(ev);
    if (ev.type === 'long') mentoring.long(ev);
    mentoring.worldEvent(ev);
    if ((ev.type === 'solid' || ev.type === 'break') && ev.give) {
      // The gift flies from the thing to its counter in the HUD; no number is written in the world.
      applyEffects(profile, [{ give: ev.give }]);
      save(ev.type === 'solid' ? 'bridge' : 'pot');
      emit({ type: 'gift', from: ev.type === 'solid' ? ev.at : ev.id, give: ev.give, delay: ev.type === 'solid' ? 0.5 : 0 });
    }
    if (ev.type === 'skill') skillEvent(ev);
    // The count of the bundles on the goal bar (#48).
    if ((ev.type === 'tie' || ev.type === 'snap') && ev.id === 'zone:mat') emit({ type: 'hud' });
    if (ev.type === 'planted') planting.planted(ev);
    if (ev.type === 'success') cheer(ev);
    hamlet.worldEvent(ev);
    if (ev.type === 'trial' && ev.done && String(ev.trial).startsWith('event-')) eventDone(ev.trial.slice(6));
    else if (ev.type === 'trial' && ev.done) trialDone(ev.trial);
    // A small event of the day: too few on the place, or too many (the last things go back).
    if ((ev.type === 'short' || ev.type === 'roll') && String(ev.id).startsWith('zone:event-')) {
      const def = eventDef(String(ev.id).slice(11, -6));
      const key = def?.lines[ev.type === 'short' ? 'short' : 'over'];
      if (key) say(key, {}, null, def.person);
    }
    // The raid: the talks of the phases of the boss, the rice at the gate, and the end.
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

  // The edges of the world: the deep sea, and the mist of the land of a later era. The hero stops,
  // turns, and takes two steps back, with a line once for each edge in a day. Nghé stops at the
  // edge too (the follow system).
  let turning = null; // the token of the walk back from an edge
  const mistWalk = () => map.mist?.walk ?? 4;
  // The edge at a cell: 'sea' (deep water), 'mist' (too deep in the mist), or null.
  function edgeAt(x, y) {
    if (tileMap.type(x, y) === 'sea') return 'sea';
    if ((tileMap.mistAt?.(x, y) ?? 0) > mistWalk()) return 'mist';
    return null;
  }
  // The line of an edge: the sea, the mist of the land of a later era (to the south), or the mist
  // of another land (when the land of another country is ahead of the hero).
  function edgeLine(kind, x, y, f) {
    if (kind === 'sea') return 'edge.sea';
    for (let d = 2; d <= 24; d += 2) if (map.land?.foreignAt?.(x + Math.sin(f) * d, y + Math.cos(f) * d)) return 'edge.mist.far';
    return 'edge.mist';
  }
  function checkEdge() {
    if (busy || turning !== null || hero().fall || raidOn()) return;
    const h = hero();
    const c = heroCell();
    const f = h.position.facing ?? 0;
    const ahead = { x: c.x + Math.sin(f) * 0.9, y: c.y + Math.cos(f) * 0.9 };
    // A walk of a tap stops at the edge by itself (edgeStop); the stick and the keys push on.
    const moving = !h.route && (h.intent?.strength ?? 0) > 0;
    const deep = (tileMap.mistAt?.(Math.floor(c.x), Math.floor(c.y)) ?? 0) >= mistWalk();
    const kind = deep ? 'mist' : moving ? edgeAt(Math.floor(ahead.x), Math.floor(ahead.y)) : null;
    if (kind) turnBack(kind, c, f);
  }
  function turnBack(kind, c, f) {
    arrivals.clear();
    worldCommand(state, { type: 'stop', id: 'hero' });
    const line = edgeLine(kind, c.x, c.y, f);
    emit({ type: 'edge', kind, textKey: line });
    emit({ type: 'halt' });
    // Two steps back, the way the hero came (or the nearest free cell there).
    const back = { x: c.x - Math.sin(f) * BACK, y: c.y - Math.cos(f) * BACK };
    const to = freeSpot(tileMap, back) ?? c;
    const token = nextToken++;
    turning = token;
    const said = visit.things[`edge.${line}`] === today();
    arrivals.set(token, () => {
      if (said) return;
      visit.things[`edge.${line}`] = today();
      say(line);
    });
    worldCommand(state, { type: 'walk', id: 'hero', points: [{ x: to.x * 2, z: to.y * 2 }], token, near: null });
  }

  // Who stays out (at the spot, not in the house): a person of the quest stays out at night, with a
  // lantern; the person of a practice and the person of the task that the hero works on stay at the
  // task until it ends (#57: the healer went out at dawn in the middle of her trial).
  let stayKey = null;
  // The last press or hold of the big button (a tick): the child works at a task only within
  // WORK_HOLD seconds after it. A child who waits next to a plot or a bridge does not work (#57).
  const WORK_HOLD = 30;
  let lastPress = -Infinity;
  // The task of a person that the child works on now (its mentor key), or null. In a visit of a
  // practice, the set is open while the hero is at its place (#45).
  const workKey = () => (practice || (state.tick - lastPress) * STEP < WORK_HOLD ? mentoring.activeKey() : null);
  function updateStays() {
    const goal = currentGoal(data.quests.quests, cond());
    const wanted = new Set((goal?.step.targets ?? (goal?.step.target ? [{ npc: goal.step.target }] : [])).map((tg) => tg.npc).filter(Boolean));
    if (practice) wanted.add(practice.person);
    // The fisher of the bridge goes home at night as before: Nghé helps there (#24).
    const mentor = stayKey && stayKey !== 'bridge' ? mentoring.personOf(stayKey) : null;
    for (const p of persons()) if (p.kind === 'npc') worldCommand(state, { type: 'stay', id: p.entity, on: wanted.has(p.ref) || p.entity === mentor });
  }

  // One step of the world, then the events of the step, the exits, and the trigger zones.
  function step() {
    // The time of play in the village counts here, one step at a time (the app counts it in the
    // other scenes).
    if (profile.time) addPlayTime(profile.time, now(), STEP * 1000);
    // The light holds for the work (#45, #57): while the hero works at the task of a person (a press
    // within WORK_HOLD seconds), plays a folk game, or holds a raid, the clock waits, in a practice
    // and in the story, and the person of the task does not go home while the child works. Between
    // the tasks, and while the child only waits, the days go on (the rice grows, the feast comes at
    // dusk).
    const key = workKey();
    state.clock.hold = Boolean(key || folk.active() || raidOn());
    if (key !== stayKey) {
      stayKey = key;
      updateStays();
    }
    worldStep(state, STEP, env);
    // The picture of the button, as the child sees it (about each 0.1 seconds).
    if (state.tick % 3 === 0 && !screen) watchPicture();
    stepSling();
    stepFarewell();
    stepCheer();
    checkSteps();
    checkNotebook();
    stepGuessLine();
    stepToolLines();
    stepFarWait();
    for (const fn of later.splice(0)) fn();
    const events = state.events;
    for (const ev of events) {
      if (ev.type === 'greet') greeting(ev);
      emit(ev);
      // The kind of the last thing of a task that the child took or put: a press does the same
      // again (#54). The mentor sets it only before the child's first act in the task (the first
      // step); a later move of the mentor never changes the kind of a press (#63).
      if ((ev.type === 'pick' || ev.type === 'put') && ev.item) {
        const it = getEntity(state, ev.item)?.item;
        if (it?.task?.startsWith('trial-') && (ev.id === 'hero' || lastPick?.task !== it.task || !lastPick.child)) lastPick = { task: it.task, kind: it.kind, child: ev.id === 'hero' };
        if (ev.type === 'pick' && ev.id === 'hero' && it?.task === 'trial-healer') sayHerb('herb', it.kind);
      }
      // A wrong bundle: a hero who stands on the mat steps off to the place of the mat, so that the
      // rods show while the teacher counts them (#61: the walk to the teacher crossed the mat).
      if (ev.type === 'snap' && ev.id === 'zone:mat') {
        const mat = getEntity(state, ev.id);
        const r = mat?.zone.rect;
        const hp = hero().position;
        if (r && hp.x > r.x0 + 0.8 && hp.x < r.x1 - 0.8 && hp.z > r.z0 + 0.8 && hp.z < r.z1 - 0.8) {
          const stand = standOf(mat);
          walkTo([{ x: stand.x / 2, y: stand.z / 2 }], () => worldCommand(state, { type: 'face', id: 'hero', x: mat.zone.x + 2, z: mat.zone.z + 1 }));
        }
      }
      if (ev.id === 'sky') {
        // At dawn the enemies of a lost raid come again, and the game saves the start of the day
        // (a restore point for the parent).
        if (ev.type === 'dawn') {
          refreshPeople();
          placeEvents();
          planting.grow();
          hamlet.dawn();
          save('dawn');
        }
        // After a rain, the land is wet: a flood can come.
        if (ev.type === 'dry') placeEvents();
        continue;
      }
      if (ev.id !== 'hero') {
        worldEvent(ev);
        continue;
      }
      mentoring.worldEvent(ev);
      // The tasks where the child put a thing (#54).
      if (ev.type === 'put' && ev.zone) {
        const task = zoneOf(ev.zone)?.zone.task;
        if (task) childPut.add(task);
      }
      if (ev.type === 'arrived' || ev.type === 'stuck') {
        const fn = arrivals.get(ev.token);
        arrivals.delete(ev.token);
        const back = ev.token === turning;
        if (back) turning = null;
        if (ev.type === 'arrived' || back) fn?.();
      }
    }
    mentoring.tick();
    updateCue();
    planting.tick(STEP);
    hamlet.tick(STEP);
    folk.tick(STEP);
    checkFound();
    checkRest();
    checkEdge();
    checkLandFerries();
    // The live chunks follow the hero: the people of the chunks that woke come.
    if (updateLive()) {
      refreshPeople();
      placeEvents();
    }
    if (turning !== null && !arrivals.has(turning)) turning = null;
    const c = heroCell();
    const tx = Math.floor(c.x);
    const ty = Math.floor(c.y);
    if (tx === heroTile.x && ty === heroTile.y) return;
    heroTile = { x: tx, y: ty };
    if (busy) return;
    const zone = triggers.fire('enter', tx, ty, cond());
    if (zone) {
      arrivals.clear();
      worldCommand(state, { type: 'stop', id: 'hero' });
      emit({ type: 'halt' });
      doAction(zone);
    }
  }

  // The time limit: the hero goes home to rest at a calm point: no screen is open, the hands are
  // empty, the hero is not on or next to a bridge that is not solid, and no task of a person goes
  // on, for at most taskGraceMin minutes after the end of the time (#57: the rest came in the
  // middle of the trial of the healer). A raid waits for its end (docs/RAIDS.md).
  function calm() {
    if (screen || busy || holding() || hero().fall || raidOn()) return false;
    const over = -remainingMs(profile.time, profile.settings?.timeLimit, now()) / 60000;
    if (workKey() && over < (data.game.time.taskGraceMin ?? 5)) return false;
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
    if (CHILD_ACTS.has(type)) {
      acted();
      lastChild = state.tick;
    }
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
    // A story or the debug panel brings a small event today (at its first spot on this map).
    if (type === 'event') {
      placeEvents(cmd.id);
      return;
    }
    // A story or the debug panel makes a move of the mentor of a task now (key, move).
    if (type === 'mentor') {
      mentoring.move(cmd.key, cmd.move);
      return;
    }
    if (type === 'fell' || type === 'dig') {
      const r = editLand(cmd);
      if (!r) return;
      // The save keeps the change (the changed cells of its chunk): the land of the map comes from
      // the seed and these changes.
      emit({ type: type === 'fell' ? 'felled' : 'dug', id: cmd.id ?? null, at: r.at ?? null, kind: r.kind ?? null, drops: r.drops, chunks: r.chunks });
      return;
    }
    // The end of a hold of the button: letting go always counts, even while a line shows.
    if (type === 'hold' && !cmd.on) {
      hold(false);
      return;
    }
    if (busy) return;
    if (type === 'hold' || type === 'hands') lastPress = state.tick;
    if (type === 'hold') {
      hold(true);
      return;
    }
    // In a raid, a tap on Nghé is the charge only when Nghé is a tool of this raid.
    const charges = type === 'pet' && raidEnt()?.raid.tools.includes('nghe');
    // The pull of a drag on the hero, for the posts and the ring on the road (no shot), and a tap
    // on the hero that lets the stone of the pull of the button fly at once (#55).
    if (raidOn() && type === 'pullTo') {
      dragPull = Math.max(0, Math.min(raidEnt().raid.sling.max, Number(cmd.count) || 0));
      return;
    }
    if (raidOn() && type === 'fire') {
      fireSling();
      return;
    }
    if (raidOn() && (type === 'shoot' || type === 'pour' || charges)) {
      if (type === 'shoot') {
        slingPull = null;
        dragPull = 0;
        shootFromWall(cmd.count);
      }
      else if (type === 'pour') order({ act: 'pour', source: cmd.source, x: cmd.x * 2, z: cmd.y * 2 });
      else order({ act: 'charge' });
      return;
    }
    if (type === 'tap') tap(cmd.target ?? {});
    else if (type === 'hands') act();
    // A wave: the child calls the person of the task (docs/MENTOR.md).
    else if (type === 'wave') mentoring.wave();
    else if (type === 'jump') { if (!folk.jump()) jump(); }
    // The end of a press of the jump: a hop on the court of nhảy lò cò (a long press hops two squares).
    else if (type === 'jumpUp') folk.jumpUp(Number(cmd.held) || 0);
    else if (type === 'talkTo') walkToPerson(cmd.id);
    // In a raid the map only pauses: it says where the enemies are, and it has no travel.
    else if (type === 'travel') queue(() => openCommand(raidOn() ? { open: 'worldmap', pauseKey: data.raids.raids[raidEnt().raid.id].pauseKey ?? null } : { open: 'worldmap' }));
    else if (WORLD.has(type)) {
      // A tap on Nghé (a pet, with a heart) chooses her: next to the hero, the button shows the
      // ride, also with other things in reach (#60; not in a task, a raid, or a folk game).
      if (type === 'pet' && cmd.id) chosen = { id: cmd.id, along: null };
      // A walk with the stick or the keys ends a walk of a tap.
      if (type === 'move' && cmd.strength) {
        arrivals.clear();
        chosen = null;
        pressAfterWalk = false;
      }
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
    startPlace,
    command,
    step,
    // The folk game that goes on: { kind, phase, rounds, skill, call, count, court }, or null.
    folk: () => folk.stateOf(),
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
    holdToward,
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
    // Is a place of a task at a map point (cells)? With its pad (half blocks; ZONE_PAD when not
    // given): a tap there comes before a person. With no pad: a tap there comes before a thing that
    // only touches the finger with its pad (src/world/hit.js, #47).
    taskPlaceAt: (x, y, pad = ZONE_PAD) => Boolean(workZoneAt(x * 2, y * 2, pad)),
    // A task or a folk game goes on now: a tap on Nghé is a tap on what is under or behind Nghé.
    // Any open task counts (a trial, a station, or a work task such as the rice for Gióng).
    inTask: () => Boolean(mentoring.activeKey() || folk.active() || query(state, 'zone').some((z) => z.zone.rule === 'trial' && !z.zone.done)),
    // The work in view now (the last event workView while its task goes on), or null.
    work: () => (lastWork && (mentoring.activeKey() || folk.active() || String(lastWork.key).startsWith('example-')) ? lastWork : null),
    // The last tap: the id of its target (an entity), or null (#47).
    chosen: () => chosen?.id ?? null,
    // The place of a task that a tap at a map point (cells) chooses: its id, or null.
    taskPlace: (x, y) => workZoneAt(x * 2, y * 2)?.id ?? null,
    // All that the action button can act on now, with the distance of each (for tests and the
    // debug panel): [{ act, icon, target, d, rank }].
    targets: () => (screen || busy ? [] : candidates().map((c) => ({ act: c.act, icon: c.icon, target: c.target, at: c.at ?? null, d: Math.round(c.d * 10) / 10, rank: c.rank }))),
    // The target of the action button now: { act, icon, target, hold, ghost } or null.
    action() {
      const a = action();
      if (!a) return null;
      const zone = getEntity(state, a.target)?.zone;
      return { act: a.act, icon: a.icon, target: a.target, hold: Boolean(a.hold), ghost: a.ghost ?? null, spot: zone && zone.rule !== 'span' ? spotOf(zone) : null };
    },
    // The place of a task under a map point (cells), or null: a tap there chooses the place.
    placeAt: (x, y) => workZoneAt(x * 2, y * 2)?.id ?? null,
    // The look of the thing in the hands of the hero (a small picture of it on the action button,
    // #43), or null when the hands are empty.
    carried() {
      return hero()?.carry ?? null;
    },
    get state() { return state; },
    get map() { return map; },
    get tileMap() { return tileMap; },
    get triggers() { return triggers; },
    get env() { return env; },
    get terrain() { return terrain; },
    // The live chunks around the hero (keys).
    get live() { return [...live]; },
    get screen() { return screen?.screen ?? null; },
    get busy() { return busy; },
    get profile() { return profile; },
    // The task with a mentor that the hero works on now (the view shows the wave), or null.
    get mentorTask() { return mentoring.activeKey(); },
    // The persons of the stations of a practice of a whole place (#37): the view puts a star over each.
    stations: () => [...stations()],
    workCount,
    // The pull of the slingshot with the big button now (steps), or 0 (#50).
    raidPull: () => pullCount(),
    // The mentor of a task (for the tests and the debug panel).
    mentorOf: (key) => mentoring.stateOf(key),
    // The practice of the visit (a copy), or null.
    get practice() { return practice ? { ...practice } : null; },
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
  for (const r of data.world.regions) {
    const door = r.maps.length ? data.world.map(r.id)?.layers.triggers.find((z) => z.id === id) : null;
    if (door) return { map: r.id, at: { x: door.x + door.w + 1.5, y: door.y + door.h / 2 } };
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
