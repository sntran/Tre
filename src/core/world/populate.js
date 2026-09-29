// Fill a world state with the entities of a map: the hero, the friend, the people, the enemies,
// and the ducks. The map data is in map cells; the entities are on the half-block grid.
import { addEntity, removeEntity, getEntity, query, HALF } from './state.js';
import { createRng, hashSeed } from '../rng.js';

const WATER_TOP = 1.2; // half blocks of water over the bed of the river (see src/world/terrain.js)

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

// The ducks of the decor layer: each one swims around its point. The seed of the world gives
// the start of each circle.
export function addDucks(world, map, env) {
  const rng = createRng(hashSeed(`${world.seed}:${map.id}:ducks`));
  map.layers.decor.forEach((d, i) => {
    if (!d.figure) return;
    const cx = d.x * HALF;
    const cz = d.y * HALF;
    addEntity(world, {
      id: `decor:${i}`,
      position: { x: cx, y: env.groundY(d.x, d.y) + WATER_TOP - 0.1, z: cz, facing: 0 },
      motion: { vx: 0, vz: 0, speed: 0 },
      swim: { cx, cz, r: 1.2 + rng.next() * 1.2, a: rng.next() * Math.PI * 2, dir: d.flip ? -1 : 1, speed: 0.35 },
      look: d.figure,
    });
  });
}
