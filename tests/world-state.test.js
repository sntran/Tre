import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createTileMap } from '../src/core/tilemap.js';
import { createWorldState, addEntity, removeEntity, getEntity, query, command } from '../src/core/world/state.js';
import { step, SYSTEMS, STEP } from '../src/core/world/step.js';
import { envFor } from '../src/core/world/env.js';
import { addHero, addFriend, syncPeople, addDucks } from '../src/core/world/populate.js';
import { createRng } from '../src/core/rng.js';
import { load } from './helpers.js';

const tiles = load('data/tiles.json').types;
const map = load('data/maps/phu-dong.json');
const env = envFor(createTileMap(map, tiles));

// A world on Phù Đổng: the hero at the spawn point, Nghé, all people and enemies, and the ducks.
function village(seed = 7) {
  const w = createWorldState({ seed, map: map.id, clock: { minutes: 420 } });
  addHero(w, env, map.spawn);
  addFriend(w, env, 'nghe');
  syncPeople(w, map, env, () => true);
  addDucks(w, map, env, load('data/world/life.json'));
  return w;
}

test('entities: add, get, remove, and query by components', () => {
  const w = createWorldState({ seed: 3 });
  const a = addEntity(w, { position: { x: 1, y: 0, z: 1, facing: 0 }, look: 'duck' });
  const b = addEntity(w, { position: { x: 2, y: 0, z: 2, facing: 0 }, flock: { id: 'ducks' } });
  addEntity(w, { id: 'hero', position: { x: 0, y: 0, z: 0, facing: 0 }, look: 'hero' });
  assert.equal(a.id, 1);
  assert.equal(b.id, 2);
  assert.throws(() => addEntity(w, { id: 'hero' }), /already/);
  assert.deepEqual(query(w, 'position').map((e) => e.id), [1, 2, 'hero']);
  assert.deepEqual(query(w, 'position', 'look').map((e) => e.id), [1, 'hero']);
  assert.deepEqual(query(w, 'flock').map((e) => e.id), [2]);
  assert.equal(getEntity(w, 'hero').look, 'hero');
  assert.equal(removeEntity(w, 2).id, 2);
  assert.equal(getEntity(w, 2), null);
  assert.equal(removeEntity(w, 2), null);
  // Components are plain data: the state goes through JSON with no change.
  assert.deepEqual(JSON.parse(JSON.stringify(w)), w);
});

test('the same seed and the same commands give the same world after 1000 steps', () => {
  const run = (seed, turn = 1) => {
    const w = village(seed);
    for (let i = 0; i < 1000; i++) {
      if (i === 10) command(w, { type: 'move', id: 'hero', dx: 1, dz: 0, strength: 1, run: true });
      if (i === 200) command(w, { type: 'move', id: 'hero', dx: 0, dz: turn, strength: 0.6 });
      if (i === 400) command(w, { type: 'stop', id: 'hero' });
      if (i === 450) command(w, { type: 'walk', id: 'hero', points: [{ x: 40, z: 60 }, { x: 44, z: 64 }], token: 'a' });
      if (i === 700) command(w, { type: 'pause', on: true });
      if (i === 800) command(w, { type: 'pause', on: false });
      step(w, STEP, env);
    }
    return w;
  };
  const a = run(7);
  const b = run(7);
  assert.equal(a.tick, 1000);
  assert.deepEqual(a, b);
  // Other commands give another world.
  assert.notDeepEqual(run(7, -1).entities, a.entities);
  // Another seed gives other ducks.
  assert.notDeepEqual(run(8).entities.filter((e) => e.steer), a.entities.filter((e) => e.steer));
});

test('the hero walks with a command, follows a route to its end, and waits in a dialogue', () => {
  const w = village();
  const hero = getEntity(w, 'hero');
  const x0 = hero.position.x;
  command(w, { type: 'move', id: 'hero', dx: 1, dz: 0, strength: 1 });
  for (let i = 0; i < 15; i++) step(w, STEP, env);
  assert.ok(hero.position.x > x0 + 2, 'the hero walks east');
  assert.ok(hero.motion.speed > 0);
  // A route ends with the event "arrived" and its token.
  const target = { x: hero.position.x, z: hero.position.z + 6 };
  command(w, { type: 'walk', id: 'hero', points: [target], token: 't1' });
  let arrived = null;
  for (let i = 0; i < 90 && !arrived; i++) {
    step(w, STEP, env);
    arrived = w.events.find((e) => e.type === 'arrived');
  }
  assert.equal(arrived?.token, 't1');
  assert.equal(hero.route, undefined);
  // In a dialogue the clock stops and the hero does not walk.
  command(w, { type: 'pause', on: true });
  command(w, { type: 'move', id: 'hero', dx: 1, dz: 0, strength: 1 });
  step(w, STEP, env);
  const at = { ...hero.position };
  const minutes = w.clock.minutes;
  for (let i = 0; i < 10; i++) step(w, STEP, env);
  assert.equal(w.clock.minutes, minutes);
  assert.ok(Math.abs(hero.position.x - at.x) < 0.05);
  // A place command puts the hero at a point, and Nghé comes behind.
  command(w, { type: 'pause', on: false });
  command(w, { type: 'place', id: 'hero', x: 40, z: 60 });
  step(w, STEP, env);
  assert.deepEqual([hero.position.x, hero.position.z], [40, 60]);
  assert.ok(w.events.some((e) => e.type === 'placed' && e.id === 'hero'));
  const nghe = getEntity(w, 'friend:nghe');
  assert.ok(Math.hypot(nghe.position.x - 40, nghe.position.z - 60) < 8);
});

test('people come and go with the story, and turn to the hero when the hero is near', () => {
  const w = village();
  const count = query(w, 'person').length;
  assert.equal(count, map.npcs.length + map.encounters.length);
  assert.equal(syncPeople(w, map, env, (kind) => kind === 'npc'), true);
  assert.equal(query(w, 'person').length, map.npcs.length);
  assert.equal(syncPeople(w, map, env, (kind) => kind === 'npc'), false, 'no change');
  const elder = getEntity(w, 'npc:elder');
  elder.position.facing = Math.PI;
  command(w, { type: 'place', id: 'hero', x: elder.position.x, z: elder.position.z + 4 });
  for (let i = 0; i < 30; i++) step(w, STEP, env);
  assert.ok(Math.abs(elder.position.facing) < 0.1, 'the elder looks south, to the hero');
});

test('a system changes only the components that it names', () => {
  const dir = new URL('../src/core/world/systems/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  assert.equal(files.length, SYSTEMS.length, 'each system is in the ordered list');
  for (const file of files) {
    const text = readFileSync(new URL(file, dir), 'utf8');
    const writes = text.indexOf('export const WRITES = [');
    assert.ok(writes >= 0 && writes < text.indexOf('import '), `${file} names what it writes at the top, before the imports`);
  }
  return Promise.all(files.map(async (file) => {
    const mod = await import(new URL(file, dir));
    const system = Object.values(mod).find((v) => typeof v === 'function' && SYSTEMS.includes(v));
    assert.ok(system, `${file} has a system of the list`);
    const w = village();
    // Give the world some work: commands, a route, and some steps before.
    command(w, { type: 'move', id: 'hero', dx: 1, dz: 1, strength: 1 });
    for (let i = 0; i < 5; i++) step(w, STEP, env);
    command(w, { type: 'walk', id: 'hero', points: [{ x: 30, z: 60 }], token: 'x' });
    command(w, { type: 'pause', on: true });
    const before = structuredClone(w);
    system(w, STEP, createRng(1), env);
    const allowed = new Set(mod.WRITES);
    for (const key of Object.keys(before)) {
      if (key === 'entities' || allowed.has(key)) continue;
      assert.deepEqual(w[key], before[key], `${file} changes the world key ${key}`);
    }
    for (const e of before.entities) {
      const now = getEntity(w, e.id);
      for (const key of new Set([...Object.keys(e), ...Object.keys(now)])) {
        if (allowed.has(key)) continue;
        assert.deepEqual(now[key], e[key], `${file} changes ${key} of ${e.id}`);
      }
    }
  }));
});
