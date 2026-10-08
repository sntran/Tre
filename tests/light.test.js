// The light of the work and of the hero at dusk and at night (#65, src/world/light.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { edgeOf, taskPools, POOL } from '../src/world/light.js';
import { runHeadless } from './story-run.js';
import { readFileSync } from 'node:fs';

test('the hero has a light edge at dusk and at night, and nobody else has one; none in the day', () => {
  assert.equal(edgeOf('hero', 0), null);
  assert.equal(edgeOf('hero', 0.1), null);
  const e = edgeOf('hero', 0.6);
  assert.ok(e && e.k > 1 && e.tone === 'yellowPale');
  assert.equal(edgeOf('npc:teacher', 0.9), null);
});

test('each open task near the hero has a pool of light that holds its places, its things, and the stem', () => {
  const ents = [
    { id: 'zone:trial-woodcutter', zone: { id: 'trial-woodcutter', rule: 'trial', done: false }, position: { x: 100, y: 6, z: 100 } },
    { id: 'stem:woodcutter', item: { task: 'trial-woodcutter', size: 8, fixed: true, held: null }, position: { x: 96, y: 6, z: 104 } },
    { id: 'zone:woodpile', zone: { task: 'trial-woodcutter', rect: { x0: 106, x1: 110, z0: 98, z1: 102 } }, position: { x: 108, y: 6, z: 100 } },
    { id: 'zone:trial-smith', zone: { id: 'trial-smith', rule: 'trial', done: true }, position: { x: 110, y: 6, z: 100 } },
    { id: 'zone:trial-fisher', zone: { id: 'trial-fisher', rule: 'trial', done: false }, position: { x: 400, y: 6, z: 400 } },
  ];
  const pools = taskPools(ents, { x: 100, z: 100 });
  assert.deepEqual(pools.map((p) => p.task), ['trial-woodcutter'], 'a done task and a far task have no pool');
  const p = pools[0];
  for (const q of [{ x: 96, z: 104 }, { x: 104, z: 104 }, { x: 110, z: 98 }]) assert.ok(Math.hypot(q.x - p.x, q.z - p.z) <= p.r, `the pool holds ${JSON.stringify(q)}`);
  assert.ok(p.r >= POOL.min && p.r <= POOL.max);
  assert.deepEqual(taskPools(ents, null), []);
});

test('in the story of each trial, the pool holds the person of the task and the hero at the work', async () => {
  for (const [trial, npc] of [['scholar', 'teacher'], ['healer', 'healer'], ['fisher', 'fisher'], ['woodcutter', 'woodcutter'], ['smith', 'smith']]) {
    const story = JSON.parse(readFileSync(new URL(`./stories/trial-${trial}.json`, import.meta.url), 'utf8'));
    let s = null;
    // The steps up to the end of the first talk: the trial is open.
    const upTo = story.steps.findIndex((x) => x.read) + 1;
    await runHeadless({ ...story, steps: [...story.steps.slice(0, upTo), { wait: 1 }] }, { onSession: (x) => { s = x; } });
    const hero = s.state.entities.find((e) => e.id === 'hero').position;
    const pools = taskPools(s.state.entities, hero);
    assert.equal(pools.length, 1, `${trial}: one pool`);
    const person = s.state.entities.find((e) => e.id === `npc:${npc}`).position;
    assert.ok(Math.hypot(person.x - pools[0].x, person.z - pools[0].z) <= pools[0].r, `${trial}: the pool holds the person`);
  }
});
