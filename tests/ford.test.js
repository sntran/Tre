import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTileMap } from '../src/core/tilemap.js';
import { createWorldState, getEntity, command } from '../src/core/world/state.js';
import { step, STEP } from '../src/core/world/step.js';
import { envFor } from '../src/core/world/env.js';
import { addHero, addFriend } from '../src/core/world/populate.js';
import { rainOf } from '../src/core/world/systems/sky.js';
import { DAY_MINUTES } from '../src/core/world/clock.js';
import { load } from './helpers.js';

const tiles = load('data/tiles.json').types;
const legend = load('data/maps/phu-dong.json').legend;
const day = load('data/world/day.json');

// A small map: grass in the north and the south, a river from row 16 to row 25, and a ford (shallow
// water) in the columns 2 and 3.
const W = 30;
const H = 40;
const river = (y) => y >= 16 && y < 26;
const map = {
  id: 'test',
  width: W,
  height: H,
  legend,
  layers: {
    ground: Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (!river(y) ? '.' : x >= 2 && x <= 3 ? 's' : '~')).join('')),
    height: Array.from({ length: H }, (_, y) => Array.from({ length: W }, () => (!river(y) ? '2' : '0')).join('')),
    objects: [],
  },
};
const tileMap = createTileMap(map, tiles);
const denv = envFor(tileMap, { day });
const hero = (w) => getEntity(w, 'hero');
let d = 0;
while (!rainOf(3, d, day)) d++;
const r = rainOf(3, d, day);

test('a high river closes the ford for the rain and about one hour after it; Nghé shakes its head at the edge', () => {
  const w = createWorldState({ seed: 3, map: 'test', clock: { minutes: d * DAY_MINUTES + (r.start - 0.5) * 60 } });
  addHero(w, denv, { x: 2.5, y: 13 });
  addFriend(w, denv, 'nghe');
  const runTo = (hour) => { const end = d * DAY_MINUTES + hour * 60; while (w.clock.minutes < end) step(w, STEP, denv); };
  step(w, STEP, denv);
  assert.ok(!tileMap.isBlocked(2, 18), 'the ford is open before the rain');
  runTo(r.start + 0.2);
  assert.ok(w.sky.high && tileMap.isBlocked(2, 18), 'the ford is closed in the rain');
  // The hero walks to the edge of the water and stops there; Nghé shakes its head.
  command(w, { type: 'move', id: 'hero', dx: 0, dz: 1, strength: 1 });
  let shook = false;
  for (let i = 0; i < 90; i++) {
    step(w, STEP, denv);
    shook ||= getEntity(w, 'friend:nghe').act === 'shake';
  }
  assert.ok(hero(w).position.z < 32.1, `the hero stays on the bank (${hero(w).position.z.toFixed(2)})`);
  assert.ok(shook, 'Nghé shakes its head');
  command(w, { type: 'move', id: 'hero', dx: 0, dz: 0, strength: 0 });
  runTo(r.end + 0.5);
  assert.ok(tileMap.isBlocked(2, 18), 'still closed just after the rain');
  runTo(r.end + 1.2);
  assert.ok(!w.sky.high && !tileMap.isBlocked(2, 18), 'open again about one hour after the rain');
});

test('the ford stays open while the hero is in it, so that nobody is caught in the water', () => {
  const w = createWorldState({ seed: 3, map: 'test', clock: { minutes: d * DAY_MINUTES + (r.start - 0.05) * 60 } });
  addHero(w, denv, { x: 2.5, y: 20 });
  for (let i = 0; i < 300; i++) step(w, STEP, denv);
  assert.ok(w.sky.high);
  assert.ok(!tileMap.isBlocked(2, 20), 'open under the hero');
  command(w, { type: 'move', id: 'hero', dx: 0, dz: 1, strength: 1 });
  for (let i = 0; i < 60; i++) step(w, STEP, denv);
  assert.ok(hero(w).position.z > 42, 'the hero walks on in the water');
  // The hero is out (on the bank): the ford closes.
  command(w, { type: 'place', id: 'hero', x: 5, z: 56 });
  step(w, STEP, denv);
  step(w, STEP, denv);
  assert.ok(tileMap.isBlocked(2, 20), 'and then it closes');
});
