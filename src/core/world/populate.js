// Fill a world state with the entities of a map: the hero, the friend, the people, the enemies,
// and the ducks. The map data is in map cells; the entities are on the half-block grid.
import { addEntity, removeEntity, getEntity, query, HALF } from './state.js';

// The hero, controlled by the player. keep: the save keeps this entity.
export function addHero(world, env, { x, y, facing = 0 }) {
  return addEntity(world, {
    id: 'hero',
    keep: true,
    control: true,
    position: { x: x * HALF, y: env.groundY(x, y), z: y * HALF, facing },
    motion: { vx: 0, vz: 0, speed: 0 },
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
export function syncPeople(world, map, env, present) {
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
    addEntity(world, {
      id,
      person: { kind, ref: item.id },
      position: { x: item.x * HALF, y: env.groundY(item.x, item.y), z: item.y * HALF, facing },
      motion: { vx: 0, vz: 0, speed: 0 },
      solid: { r: 1.8 },
      ...(look === 'river-serpent' ? {} : { react: { turn: 8 } }),
      look,
    });
    changed = true;
  }
  for (const e of query(world, 'person')) {
    if (want.has(e.id)) continue;
    removeEntity(world, e.id);
    changed = true;
  }
  return changed;
}

// A living thing of a kind in data/world/life.json at a map point (map cells).
export function addLife(world, env, life, kind, at, id = null) {
  const def = life.kinds[kind];
  const x = at.x * HALF;
  const z = at.y * HALF;
  const ground = env.groundY(at.x, at.y);
  const s = def.steer;
  const y = s?.medium === 'water' ? ground + (s.float ?? 1.1) : s?.medium === 'air' ? ground + (s.altitude ?? 12) : ground;
  return addEntity(world, {
    ...(id ? { id } : {}),
    kind,
    position: { x, y, z, facing: at.facing ?? 0 },
    motion: { vx: 0, vz: 0, speed: 0 },
    ...(s ? { steer: { ...structuredClone(s), goal: null, arrived: false, flee: null, bias: null, wander: null } } : {}),
    look: def.look,
  });
}

// The ducks of the decor layer. The seed of the world gives the start of each wander.
export function addDucks(world, map, env, life) {
  map.layers.decor.forEach((d, i) => {
    if (d.figure !== 'duck') return;
    addLife(world, env, life, 'duck', { x: d.x, y: d.y, facing: d.flip ? Math.PI : 0 }, `decor:${i}`);
  });
}
