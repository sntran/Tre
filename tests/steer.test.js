import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTileMap } from '../src/core/tilemap.js';
import { createWorldState, addEntity, getEntity } from '../src/core/world/state.js';
import { steer } from '../src/core/world/systems/steer.js';
import { envFor } from '../src/core/world/env.js';
import { createRng } from '../src/core/rng.js';
import { load } from './helpers.js';

const tiles = load('data/tiles.json').types;

// A field of grass with a wall (a hedge) and a pond.
const field = {
  width: 16,
  height: 12,
  legend: { '.': 'grass', h: 'hedge', '~': 'water' },
  layers: {
    ground: [
      '................',
      '................',
      '.......h........',
      '.......h........',
      '.......h........',
      '.......h........',
      '................',
      '..........~~~~..',
      '..........~~~~..',
      '..........~~~~..',
      '................',
      '................',
    ],
    height: Array(12).fill('2'.repeat(16)),
    objects: [],
  },
};
const env = envFor(createTileMap(field, tiles));

const walker = (id, x, z, extra = {}) => ({
  id,
  position: { x, y: 6, z, facing: 0 },
  motion: { vx: 0, vz: 0, speed: 0 },
  steer: { speed: 4, accel: 8, medium: 'land', goal: null, flee: null, bias: null, weights: { seek: 1, arrive: 1, separation: 1, avoid: 2 }, slow: 3, radius: 1.6, ...extra },
});

function run(world, seconds, rng = createRng(1)) {
  for (let i = 0; i < seconds * 30; i++) steer(world, 1 / 30, rng, env);
}

test('arrive slows down near the goal and stops at it', () => {
  const w = createWorldState({ seed: 1 });
  const a = addEntity(w, walker('a', 2, 2));
  a.steer.goal = { x: 12, z: 3 };
  run(w, 4);
  assert.ok(Math.hypot(a.position.x - 12, a.position.z - 3) < 0.5, 'at the goal');
  assert.ok(a.motion.speed < 0.2, 'it stands still');
  assert.equal(a.steer.arrived, true);
});

test('separation keeps a minimum distance between two things with the same goal', () => {
  const w = createWorldState({ seed: 1 });
  const a = addEntity(w, walker('a', 2, 20, { radius: 2 }));
  const b = addEntity(w, walker('b', 3, 22, { radius: 2 }));
  a.steer.goal = { x: 8, z: 20 };
  b.steer.goal = { x: 8, z: 20 };
  let min = Infinity;
  for (let i = 0; i < 150; i++) {
    steer(w, 1 / 30, createRng(i), env);
    if (i > 60) min = Math.min(min, Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z));
  }
  assert.ok(min > 1.2, `they stay apart (${min.toFixed(2)})`);
});

test('nothing walks into a wall or deep water, and a swimmer stays in the water', () => {
  const w = createWorldState({ seed: 1 });
  const ids = [];
  for (let i = 0; i < 6; i++) {
    ids.push(addEntity(w, walker(`w${i}`, 2 + i * 2, 21, { weights: { wander: 1, separation: 1, avoid: 2 }, run: [1, 3], pause: [0.2, 0.5] })).id);
  }
  const duck = addEntity(w, walker('duck', 24, 17, { medium: 'water', speed: 2, weights: { wander: 1, avoid: 2 }, run: [2, 4], pause: [0.2, 0.5] }));
  // Something runs at the walkers now and then: they flee toward the wall and the pond.
  const rng = createRng(9);
  for (let i = 0; i < 30 * 60; i++) {
    if (i % 90 === 0) for (const id of ids) getEntity(w, id).steer.flee = { x: 30, z: 4 + (i % 7), time: 1 };
    steer(w, 1 / 30, rng, env);
    for (const id of ids) {
      const p = getEntity(w, id).position;
      const cell = env.groundAt(p.x, p.z);
      assert.ok(cell === 'grass', `${id} is on ${cell} at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
    }
    assert.equal(env.groundAt(duck.position.x, duck.position.z), 'water');
  }
  // They moved.
  assert.ok(ids.some((id) => Math.hypot(getEntity(w, id).position.x - 2, getEntity(w, id).position.z - 21) > 3));
});

test('flee runs away from a point, faster than a walk, and stops after its time', () => {
  const w = createWorldState({ seed: 1 });
  const c = addEntity(w, walker('c', 6, 12, { boost: 2 }));
  c.steer.flee = { x: 4, z: 12, time: 1 };
  run(w, 0.5);
  assert.ok(c.position.x > 7.5, 'it runs away');
  assert.ok(c.motion.speed > 4, 'faster than its walk');
  run(w, 2);
  assert.equal(c.steer.flee, null);
  assert.ok(c.motion.speed < 0.2);
});

test('a flock that the hero scatters comes back together after a few seconds', async () => {
  const { flock } = await import('../src/core/world/systems/flock.js');
  const life = load('data/world/life.json');
  const def = life.kinds.chicken;
  const w = createWorldState({ seed: 1 });
  const hens = [];
  for (let i = 0; i < 6; i++) {
    hens.push(addEntity(w, {
      id: `hen${i}`,
      position: { x: 6 + (i % 3) * 1.5, y: 6, z: 18 + Math.floor(i / 3) * 1.5, facing: 0 },
      motion: { vx: 0, vz: 0, speed: 0 },
      steer: { ...structuredClone(def.steer), goal: null, flee: null, bias: null, wander: null },
      flock: { id: 'yard', ...def.flock },
      range: { x: 8, z: 19, r: 6 },
    }));
  }
  const spread = () => {
    const cx = hens.reduce((s, h) => s + h.position.x, 0) / hens.length;
    const cz = hens.reduce((s, h) => s + h.position.z, 0) / hens.length;
    return Math.max(...hens.map((h) => Math.hypot(h.position.x - cx, h.position.z - cz)));
  };
  const rng = createRng(3);
  const tick = (n) => { for (let i = 0; i < n; i++) { flock(w); steer(w, 1 / 30, rng, env); } };
  tick(30);
  const before = spread();
  // The hero runs into the middle of the flock: each hen flees from it.
  for (const h of hens) h.steer.flee = { x: 8.2, z: 18.9, time: 1.2 };
  tick(36);
  const scattered = spread();
  assert.ok(scattered > before + 2, `the flock scatters (${before.toFixed(1)} -> ${scattered.toFixed(1)})`);
  tick(30 * 8);
  const again = spread();
  assert.ok(again < scattered * 0.7 && again < 7, `the flock comes back together (${scattered.toFixed(1)} -> ${again.toFixed(1)})`);
});
