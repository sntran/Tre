// Fill a world state with the entities of a map: the hero, the friend, the people, the enemies,
// and the ducks. The map data is in map cells; the entities are on the half-block grid.
import { addEntity, removeEntity, getEntity, query, HALF } from './state.js';
import { createRng, hashSeed } from '../rng.js';

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
// react: the reaction of the people (life.people.react in data/world/life.json).
export function syncPeople(world, map, env, present, react = { kind: 'greet', radius: 8, wave: 1.6, cooldown: 25 }) {
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
      ...(look === 'river-serpent' ? {} : { react: structuredClone(react) }),
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

// A living thing of a kind in data/world/life.json at a point (half blocks).
export function addLife(world, env, life, kind, at, extra = {}) {
  const def = life.kinds[kind];
  const s = def.steer;
  const ground = env.groundY(at.x / HALF, at.z / HALF);
  const y = s?.medium === 'water' ? ground + (s.float ?? 1.1) : s?.medium === 'air' ? ground + (s.altitude ?? 12) : ground;
  return addEntity(world, {
    kind,
    position: { x: at.x, y, z: at.z, facing: at.facing ?? 0 },
    motion: { vx: 0, vz: 0, speed: 0 },
    ...(s ? { steer: { ...structuredClone(s), goal: null, arrived: false, flee: null, bias: null, wander: null } } : {}),
    look: def.looks[0],
    ...extra,
  });
}

// The groups of animals of the life layer of a map. The seed of the world places them in their
// medium around the point of the group, and each group is a flock.
export function addLifeLayer(world, map, env, life) {
  (map.layers.life ?? []).forEach((g, gi) => {
    const def = life.kinds[g.kind];
    if (!def) return;
    const rng = createRng(hashSeed(`${world.seed}:${map.id}:life:${gi}`));
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
      if (getEntity(world, `life:${gi}:${i}`)) continue;
      addLife(world, env, life, g.kind, { ...at, facing }, {
        id: `life:${gi}:${i}`,
        look: def.looks[i % def.looks.length],
        ...(def.flock ? { flock: { id: `${map.id}:${gi}`, ...def.flock } } : {}),
        ...(def.react ? { react: structuredClone(def.react) } : {}),
        ...(def.solid ? { solid: { r: def.solid } } : {}),
        range: { x: cx, z: cz, r: Math.max(4, r * (def.range ?? 2)) },
      });
    }
  });
}
