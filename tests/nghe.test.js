import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTileMap } from '../src/core/tilemap.js';
import { createWorldState, addEntity, getEntity, command } from '../src/core/world/state.js';
import { step, STEP } from '../src/core/world/step.js';
import { envFor } from '../src/core/world/env.js';
import { addHero, addFriend } from '../src/core/world/populate.js';
import { saveWorld } from '../src/core/world/save.js';
import { load } from './helpers.js';

const tiles = load('data/tiles.json').types;
const open = { width: 30, height: 30, legend: { '.': 'grass' }, layers: { ground: Array(30).fill('.'.repeat(30)), height: Array(30).fill('2'.repeat(30)), objects: [] } };
const env = envFor(createTileMap(open, tiles));

function world(minutes = 600) {
  const w = createWorldState({ seed: 1, clock: { minutes } });
  addHero(w, env, { x: 10, y: 15, facing: Math.PI / 2 });
  addFriend(w, env, 'nghe');
  return w;
}
const run = (w, seconds) => { for (let i = 0; i < seconds * 30; i++) step(w, STEP, env); };

test('a tap pets Nghé: Nghé is happy for a while', () => {
  const w = world();
  command(w, { type: 'pet', id: 'friend:nghe' });
  step(w, STEP, env);
  assert.deepEqual(w.events.map((e) => e.type), ['petted']);
  assert.equal(getEntity(w, 'friend:nghe').act, 'happy');
  run(w, 3);
  assert.equal(getEntity(w, 'friend:nghe').act, undefined);
});

test('on the back of Nghé the hero is faster, and Nghé goes with the hero', () => {
  const walk = world();
  command(walk, { type: 'move', id: 'hero', dx: 0, dz: -1, strength: 1 });
  run(walk, 1);
  const ride = world();
  command(ride, { type: 'ride', id: 'hero', mount: 'friend:nghe' });
  command(ride, { type: 'move', id: 'hero', dx: 0, dz: -1, strength: 1 });
  run(ride, 1);
  const hero = getEntity(ride, 'hero');
  assert.equal(hero.riding, 'friend:nghe');
  assert.ok(30 - hero.position.z > (30 - getEntity(walk, 'hero').position.z) * 1.2, 'faster');
  const nghe = getEntity(ride, 'friend:nghe');
  assert.deepEqual([nghe.position.x, nghe.position.z], [hero.position.x, hero.position.z]);
  // Off again: Nghé walks behind.
  command(ride, { type: 'ride', id: 'hero' });
  command(ride, { type: 'move', id: 'hero', dx: 0, dz: 1, strength: 1 });
  run(ride, 2);
  assert.equal(hero.riding, undefined);
  assert.ok(Math.hypot(nghe.position.x - hero.position.x, nghe.position.z - hero.position.z) > 2, 'Nghé walks behind');
});

test('the hero can push the cart only on the back of Nghé, and the save keeps the moved cart', () => {
  const push = (riding) => {
    const w = world();
    const cart = addEntity(w, { id: 'cart', position: { x: 20, y: 6, z: 20, facing: 0 }, solid: { r: 2.2 }, pushable: { r: 2 }, look: 'cart' });
    if (riding) command(w, { type: 'ride', id: 'hero', mount: 'friend:nghe' });
    command(w, { type: 'place', id: 'hero', x: 20, z: 26 });
    command(w, { type: 'move', id: 'hero', dx: 0, dz: -1, strength: 1 });
    run(w, 1.5);
    return { w, cart };
  };
  const walk = push(false);
  assert.equal(walk.cart.position.z, 20, 'on foot the cart does not move');
  assert.ok(getEntity(walk.w, 'hero').position.z > 21, 'the hero stops at the cart');
  const ride = push(true);
  assert.ok(ride.cart.position.z < 16, 'on Nghé the hero pushes the cart');
  assert.ok(saveWorld(ride.w).entities.some((e) => e.id === 'cart'));
});

test('Nghé steps back from the fire of the forge', () => {
  const w = world();
  addEntity(w, { id: 'heat', position: { x: 30, y: 6, z: 30, facing: 0 }, hot: { r: 7 } });
  command(w, { type: 'place', id: 'hero', x: 30, z: 33 });
  step(w, STEP, env);
  const nghe = getEntity(w, 'friend:nghe');
  Object.assign(nghe.position, { x: 30, z: 31 });
  run(w, 2);
  assert.ok(Math.hypot(nghe.position.x - 30, nghe.position.z - 30) >= 6.5, 'Nghé is out of the heat');
});

test('Nghé lies down beside the hero when the hero rests at night', () => {
  const w = world(22 * 60);
  run(w, 4);
  assert.equal(getEntity(w, 'friend:nghe').act, 'rest');
  const day = world(10 * 60);
  run(day, 4);
  assert.equal(getEntity(day, 'friend:nghe').act, undefined, 'not by day');
});
