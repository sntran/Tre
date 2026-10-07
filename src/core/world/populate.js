// Fill a world state with the entities of a map: the hero, the friend, the people, the enemies,
// and the ducks. The map data is in map cells; the entities are on the half-block grid.
import { addEntity, removeEntity, getEntity, query, HALF } from './state.js';
import { createRng, hashSeed } from '../rng.js';
import { makeSpan, makePile, upgradeSpan } from './zones.js';
import { addPlanks } from './systems/place.js';

// The hero, controlled by the player. keep: the save keeps this entity.
export function addHero(world, env, { x, y, facing = 0 }) {
  return addEntity(world, {
    id: 'hero',
    keep: true,
    control: true,
    position: { x: x * HALF, y: env.groundY(x, y), z: y * HALF, facing },
    motion: { vx: 0, vz: 0, speed: 0 },
    hands: { holds: null },
    look: 'hero',
  });
}

// The friend (Nghé) walks behind the target.
export function addFriend(world, env, id, target = 'hero') {
  const t = getEntity(world, target);
  const x = t.position.x - 3.2 * Math.sin(t.position.facing);
  const z = t.position.z - 3.2 * Math.cos(t.position.facing);
  const free = !env.near(x / HALF, z / HALF).isBlocked(Math.floor(x / HALF), Math.floor(z / HALF));
  return addEntity(world, {
    id: `friend:${id}`,
    position: { x: free ? x : t.position.x, y: env.groundY(x / HALF, z / HALF), z: free ? z : t.position.z, facing: t.position.facing },
    motion: { vx: 0, vz: 0, speed: 0 },
    follow: { target, trail: [], idle: 0 },
    look: id,
  });
}

// People and enemies that are present now. present(kind, item): true when the story shows them.
// People that come are added, and people that go are removed. Return true when something changed.
// people: { react, steer } of the people (life.people in data/world/life.json). days: the plans
// and houses of the people (data/world/people.json).
export function syncPeople(world, map, env, present, people = {}, days = null) {
  let changed = false;
  const want = new Set();
  const list = [
    ...map.npcs.map((n) => ({ kind: 'npc', item: n, look: n.id })),
    ...map.encounters.map((e) => ({ kind: 'encounter', item: e, look: e.figure })),
  ];
  for (const { kind, item, look } of list) {
    if (!present(kind, item)) continue;
    const id = `${kind}:${item.id}`;
    want.add(id);
    if (getEntity(world, id)) continue;
    const hero = getEntity(world, 'hero');
    const facing = hero ? Math.atan2(hero.position.x - item.x * HALF, hero.position.z - item.y * HALF) : 0;
    const spot = { x: item.x * HALF, z: item.y * HALF };
    // The people of the village have a day; the enemies stay at their place.
    const day = kind === 'npc' && days ? (days.people[item.id] ?? days.default) : null;
    addEntity(world, {
      id,
      person: { kind, ref: item.id },
      position: { x: spot.x, y: env.groundY(item.x, item.y), z: spot.z, facing },
      motion: { vx: 0, vz: 0, speed: 0 },
      solid: { r: 1.8 },
      // The people of the village greet; the enemies of an encounter do not (#49).
      ...(kind !== 'npc' || !people.react ? {} : { react: structuredClone(people.react) }),
      ...(day && people.steer ? {
        steer: { ...structuredClone(people.steer), goal: null, arrived: false, flee: null, bias: null, wander: null },
        schedule: { plan: structuredClone(days.plans[day.plan]), home: env.homes[day.home] ? day.home : null, spot, offset: offsetOf(id), ...(day.mends ? { mends: true } : {}) },
      } : {}),
      look,
    });
    changed = true;
  }
  for (const e of query(world, 'person')) {
    // The person of a small event of the day and the people of the way of a find (#56) are not
    // people of the map data.
    if (want.has(e.id) || e.person.kind === 'event' || e.person.kind === 'way') continue;
    removeEntity(world, e.id);
    changed = true;
  }
  return changed;
}

// The villagers of the generated hamlets: people with a day and a house, who greet the hero, but
// who are not people of the story (no talk). Their looks are in map.looks, by their ids. list:
// [{ id, home, plan, x, y, chunk? }] (map cells; chunk: the home chunk of the villager).
export function addVillagers(world, list, env, people = {}, days = null) {
  for (const v of list ?? []) {
    if (getEntity(world, v.id)) continue;
    const spot = { x: v.x * HALF, z: v.y * HALF };
    const plan = days?.plans[v.plan] ?? days?.plans.keeper;
    addEntity(world, {
      id: v.id,
      ...(v.chunk ? { chunk: v.chunk } : {}),
      position: { x: spot.x, y: env.groundY(v.x, v.y), z: spot.z, facing: 0 },
      motion: { vx: 0, vz: 0, speed: 0 },
      solid: { r: 1.8 },
      ...(people.react ? { react: structuredClone(people.react) } : {}),
      ...(plan && people.steer ? {
        steer: { ...structuredClone(people.steer), goal: null, arrived: false, flee: null, bias: null, wander: null },
        schedule: { plan: structuredClone(plan), home: env.homes[v.home] ? v.home : null, spot, offset: offsetOf(v.id) },
      } : {}),
      look: v.id,
    });
  }
}

// A small place near a named place, so that two people at the well do not stand on one point.
function offsetOf(id) {
  const a = (hashSeed(String(id)) % 628) / 100;
  return { x: Math.cos(a) * 1.4, z: Math.sin(a) * 1.4 };
}

// The lantern at the door of each house (env.homes). chunkOf(x, z) (half blocks): the home chunk of
// a lantern, when the lanterns come and go with their chunks; only: the homes to light.
export function addLanterns(world, env, { chunkOf = null, only = null } = {}) {
  for (const [home, way] of Object.entries(env.homes)) {
    if (getEntity(world, `lantern:${home}`) || (only && !only(home, way))) continue;
    addEntity(world, {
      id: `lantern:${home}`,
      ...(chunkOf ? { chunk: chunkOf(way.door.x, way.door.z) } : {}),
      lantern: { home, always: home === 'dinh' },
      position: { x: way.door.x, y: way.door.y, z: way.door.z, facing: 0 },
      look: 'lantern',
    });
  }
}

// A living thing of a kind in data/world/life.json at a point (half blocks).
export function addLife(world, env, life, kind, at, extra = {}) {
  const def = life.kinds[kind];
  const s = def.steer;
  const ground = env.groundY(at.x / HALF, at.z / HALF);
  // A swimmer (or a thing on the water that does not swim, such as a lily pad) floats over the bed.
  const y = s?.medium === 'water' ? ground + (s.float ?? 1.1) : s?.medium === 'air' ? ground + (s.altitude ?? 12) : def.float !== undefined ? ground + def.float : ground;
  return addEntity(world, {
    kind,
    position: { x: at.x, y, z: at.z, facing: at.facing ?? 0 },
    motion: { vx: 0, vz: 0, speed: 0 },
    ...(s ? { steer: { ...structuredClone(s), goal: null, arrived: false, flee: null, bias: null, wander: null } } : {}),
    ...(def.looks.length ? { look: def.looks[0] } : {}),
    ...extra,
  });
}

// The groups of animals of the life layer of a map (a small map with all its cells).
export function addLifeLayer(world, map, env, life) {
  addLifeGroups(world, (map.layers.life ?? []).map((g, gi) => ({ ...g, key: gi, place: g.place ?? map.id, index: g.index ?? gi })), env, life);
}

// Groups of animals: { key (the ids are life:<key>:<n>), place and index (the seed of the group and
// its flock), chunk (the home chunk, when the group comes and goes with it), kind, n, x, y, r, spot,
// bed }. The seed of the world places them in their medium around the point of the group, and each
// group is a flock.
export function addLifeGroups(world, groups, env, life) {
  for (const g of groups) {
    const def = life.kinds[g.kind];
    if (!def) continue;
    const rng = createRng(hashSeed(`${world.seed}:${g.place}:life:${g.index}`));
    const cx = g.x * HALF;
    const cz = g.y * HALF;
    const r = g.r * HALF;
    const medium = def.steer?.medium ?? 'land';
    for (let i = 0; i < g.n; i++) {
      let at = { x: cx, z: cz };
      for (let k = 0; k < 20; k++) {
        const a = rng.next() * Math.PI * 2;
        const d = rng.next() * r;
        const q = { x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d };
        if (env.canEnter(medium, q, q)) {
          at = q;
          break;
        }
      }
      const facing = rng.next() * Math.PI * 2;
      // A thing that the player changed (a broken pot) comes from the save, not from the map.
      if (getEntity(world, `life:${g.key}:${i}`)) continue;
      const place = (name) => (name && env.places[name] ? { ...env.places[name] } : null);
      const spot = place(g.spot) ?? { x: cx, z: cz };
      // A swimmer finds its bank at dusk (see the schedule system); the others have a bed here.
      const bed = medium === 'water' ? null : place(g.bed) ?? { x: cx, z: cz };
      addLife(world, env, life, g.kind, { ...(g.spot ? spot : at), facing }, {
        id: `life:${g.key}:${i}`,
        ...(g.chunk ? { chunk: g.chunk } : {}),
        // At a place of its plan (the shade of a tree), each one of the group has its own spot.
        ...(def.plan ? { schedule: { plan: structuredClone(def.plan), spot, bed: bed ? { x: bed.x + (i % 3) - 1, z: bed.z + Math.floor(i / 3) - 0.5 } : null, offset: { x: ((i % 3) - 1) * 3, z: Math.floor(i / 3) * 3 } } } : {}),
        ...(def.looks.length ? { look: def.looks[i % def.looks.length] } : {}),
        ...(def.flock ? { flock: { id: `${g.place}:${g.index}`, ...def.flock } } : {}),
        ...(def.react ? { react: structuredClone(def.react) } : {}),
        ...(def.solid ? { solid: { r: def.solid } } : {}),
        ...(def.pushable ? { pushable: { r: def.pushable } } : {}),
        ...(def.hot ? { hot: { r: def.hot } } : {}),
        // The small joys: the days and hours of a thing, a dance, and a thing that Nghé may notice.
        ...(def.when ? { when: structuredClone(def.when), hidden: true } : {}),
        ...(def.dance ? { dance: { ...def.dance, x: cx, z: cz } } : {}),
        ...(def.joy ? { joy: true } : {}),
        range: { x: cx, z: cz, r: Math.max(4, r * (def.range ?? 2)) },
      });
    }
  }
}

// The entities of a chunk that sleeps go (an entity with `chunk`, and no `keep`).
export function sleepChunk(world, key) {
  for (const e of [...world.entities]) if (e.chunk === key && !e.keep) removeEntity(world, e.id);
}

// The placement zones of a map (layers.zones with a task in data/world/zones.json), with the pile
// of each span. A zone and its things come from the save when the player changed them (keep);
// a new zone starts at its first round with a new pile.
export function addZones(world, map, env) {
  const defs = env.zones ?? {};
  for (const rect of map.layers.zones ?? []) {
    const def = defs[rect.task];
    if (!def || def.rule !== 'span') continue;
    const pileDef = defs[def.pile];
    const place = env.places[def.pile];
    if (pileDef && place && !getEntity(world, `zone:${def.pile}`)) addEntity(world, makePile(def.pile, pileDef, place));
    const kept = getEntity(world, `zone:${rect.id}`);
    if (kept) {
      upgradeSpan(kept.zone, def);
      continue;
    }
    const zone = addEntity(world, makeSpan(rect, def, rect.task, env));
    addPlanks(world, zone, def, def.rounds[0].pile);
  }
}
