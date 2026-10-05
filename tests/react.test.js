import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTileMap } from '../src/core/tilemap.js';
import { createWorldState, addEntity, getEntity } from '../src/core/world/state.js';
import { react, RUN_SPEED } from '../src/core/world/systems/react.js';
import { steer } from '../src/core/world/systems/steer.js';
import { envFor } from '../src/core/world/env.js';
import { saveWorld } from '../src/core/world/save.js';
import { createRng } from '../src/core/rng.js';
import { load } from './helpers.js';

const tiles = load('data/tiles.json').types;
const life = load('data/world/life.json');
const open = { width: 20, height: 20, legend: { '.': 'grass' }, layers: { ground: Array(20).fill('.'.repeat(20)), height: Array(20).fill('2'.repeat(20)), objects: [] } };
const env = envFor(createTileMap(open, tiles));

function world(heroAt = { x: 10, z: 10 }, speed = 0) {
  const w = createWorldState({ seed: 1, clock: { minutes: 600 } });
  addEntity(w, { id: 'hero', position: { ...heroAt, y: 6, facing: 0 }, motion: { vx: 0, vz: 0, speed } });
  return w;
}
const thing = (w, id, kind, x, z, extra = {}) => addEntity(w, {
  id,
  position: { x, y: 6, z, facing: 0 },
  motion: { vx: 0, vz: 0, speed: 0 },
  ...(life.kinds[kind].steer ? { steer: { ...structuredClone(life.kinds[kind].steer), goal: null, flee: null, bias: null, wander: null } } : {}),
  react: structuredClone(life.kinds[kind].react),
  range: { x, z, r: 4 },
  look: life.kinds[kind].looks[0],
  ...extra,
});
const step = (w, n = 1) => { for (let i = 0; i < n; i++) { w.events = []; react(w, 1 / 30); steer(w, 1 / 30, createRng(i), env); } };

test('chickens flee only from a hero who runs at them, and cluck', () => {
  const w = world({ x: 10, z: 10 }, 5);
  const hen = thing(w, 'hen', 'chicken', 14, 10);
  step(w);
  assert.equal(hen.steer.flee, null, 'a walk near a chicken does not scare it');
  getEntity(w, 'hero').motion.speed = RUN_SPEED + 2;
  step(w);
  assert.ok(hen.steer.flee, 'a run scares it');
  assert.deepEqual(w.events.map((e) => [e.type, e.sound]), [['flee', 'cluck']]);
  step(w, 20);
  assert.ok(hen.position.x > 15, 'it runs away from the hero');
});

test('ducks swim away from a hero who comes near', () => {
  const w = world({ x: 10, z: 10 }, 0);
  const duck = thing(w, 'duck', 'duck', 16, 10);
  step(w);
  assert.ok(duck.steer.flee);
  assert.ok(life.kinds.duck.react.when === 'near');
});

test('people turn to the hero, wave, and greet once, and greet again only after some time', () => {
  const w = world({ x: 10, z: 10 });
  const elder = addEntity(w, { id: 'npc:elder', position: { x: 14, y: 6, z: 10, facing: 0 }, react: structuredClone(life.people.react) });
  let greets = 0;
  for (let i = 0; i < 30 * 5; i++) {
    step(w);
    greets += w.events.filter((e) => e.type === 'greet').length;
  }
  assert.equal(greets, 1);
  assert.ok(Math.abs(elder.position.facing - -Math.PI / 2) < 0.05, 'the elder looks west, to the hero');
  assert.ok(elder.react.cool > 0);
  // Far away: no greeting.
  const far = world({ x: 30, z: 30 });
  addEntity(far, { id: 'npc:x', position: { x: 2, y: 6, z: 2, facing: 0 }, react: structuredClone(life.people.react) });
  step(far);
  assert.equal(far.events.length, 0);
});

test('the dog follows the hero for a while and then goes home', () => {
  const w = world({ x: 12, z: 12 });
  const dog = thing(w, 'dog', 'dog', 8, 12);
  step(w);
  assert.equal(dog.react.state, 'follow');
  // The hero walks away east; the dog comes after.
  const hero = getEntity(w, 'hero');
  for (let i = 0; i < 30 * 5; i++) {
    hero.position.x = Math.min(34, hero.position.x + 0.1);
    step(w);
  }
  assert.ok(dog.position.x > 20, 'the dog follows');
  step(w, 30 * (life.kinds.dog.react.time + 8));
  assert.equal(dog.react.state, 'home');
  assert.ok(Math.hypot(dog.position.x - 8, dog.position.z - 12) < 5, 'the dog is home again');
});

test('a pot breaks when the hero walks into it, gives nothing, spills grains for the chickens, stays broken in the save, and is whole the next day', () => {
  const w = world({ x: 10, z: 10 });
  const pot = thing(w, 'pot', 'pot', 13, 10, { solid: { r: 1.4 } });
  // A chicken near the pot, and one far away.
  const near = addEntity(w, { id: 'hen-near', kind: 'chicken', position: { x: 20, y: 6, z: 14, facing: 0 }, steer: { goal: null } });
  const far = addEntity(w, { id: 'hen-far', kind: 'chicken', position: { x: 60, y: 6, z: 10, facing: 0 }, steer: { goal: null } });
  step(w);
  assert.equal(pot.broken, undefined);
  getEntity(w, 'hero').position.x = 11.8;
  step(w);
  assert.deepEqual(w.events.map((e) => [e.type, e.give, e.spill]), [['break', undefined, true]]);
  assert.ok(near.steer.goal && Math.hypot(near.steer.goal.x - 13, near.steer.goal.z - 10) < 2, 'the chicken near the pot comes to the grains');
  assert.equal(far.steer.goal, null, 'a chicken far away does not');
  assert.equal(pot.look, 'pot-broken');
  assert.equal(pot.solid, undefined);
  assert.ok(saveWorld(w).entities.some((e) => e.id === 'pot'), 'the save keeps the broken pot');
  step(w, 5);
  assert.equal(w.events.length, 0, 'it breaks once');
  w.clock.minutes += 24 * 60;
  step(w);
  assert.equal(pot.look, 'pot');
  assert.equal(pot.broken, undefined);
  assert.deepEqual(pot.solid, { r: 1.4 });
  assert.ok(!saveWorld(w).entities.some((e) => e.id === 'pot'));
});

test('tall grass bends away from the hero and rustles once when the hero comes in', () => {
  const w = world({ x: 10, z: 10 });
  const tuft = thing(w, 'tuft', 'grass', 11, 10);
  step(w);
  assert.ok(tuft.react.bend.amount > 0.3);
  assert.ok(Math.abs(tuft.react.bend.dir - Math.PI / 2) < 1e-9, 'it bends east, away from the hero');
  assert.deepEqual(w.events.map((e) => e.type), ['rustle']);
  step(w);
  assert.equal(w.events.length, 0);
  getEntity(w, 'hero').position.x = 0;
  step(w, 60);
  assert.equal(tuft.react.bend, undefined, 'it stands up again');
});
