// Each thing of a task has a look with a figure (#123: the stems of 16 and 24 of the woodcutter had
// no figure, and a girl of grade 5 marked a stem that she could not see), and the whole stem of the
// higher grades is in the frame of the task on a phone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { lookOfKey, figureOf } from '../src/world/figures.js';
import { sessionCamera } from '../src/world/hit.js';

const figures = load('data/figures.json').figures;
// A person (the hero, a villager, a child of a game) is drawn from a figure of a person.
const isPerson = (e) => e.id === 'hero' || e.person || String(e.id).startsWith('villager:') || (figures[e.look] && !figures[e.look].kind);

test('for each task, each grade from K to 5, and two seeds, each thing that the task makes has a look with a figure', async () => {
  const missing = [];
  for (const task of ['scholar', 'smith', 'fisher', 'healer', 'woodcutter']) {
    const s0 = load(`tests/stories/trial-${task}.json`);
    const first = s0.steps.findIndex((x) => x.read === true) + 1;
    for (const grade of [0, 1, 2, 3, 4, 5]) {
      for (const seed of [7, 13]) {
        let s = null;
        await runHeadless({ ...s0, profile: { ...s0.profile, grade, seed }, steps: [...s0.steps.slice(0, first), { wait: 3 }] }, { onSession: (x) => { s = x; } });
        for (const e of s.state.entities) {
          if (typeof e.look !== 'string' || isPerson(e)) continue;
          const look = lookOfKey(e.look, figures, s.map.looks);
          if (!look.kind || !figureOf(look)) missing.push(`${e.look} (${task}, grade ${grade}, seed ${seed}, ${e.id})`);
        }
      }
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});

test('a stem of each length has the figure of a stem of that length', () => {
  for (const n of [6, 8, 12, 16, 24]) {
    const look = lookOfKey(`stem-${n}`, figures);
    assert.equal(look.kind, 'stem');
    assert.equal(look.n, n);
  }
  assert.ok(!Object.keys(figures).some((k) => /^stem-\d+$/.test(k)), 'no fixed stem in data/figures.json');
});

// The stem of the task of a grade, after the talk; and a mark in the middle of it.
async function atStem(grade, seed) {
  let session = null;
  const steps = [
    { press: { entity: 'npc:woodcutter' } },
    { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
    { read: true },
    { until: { event: 'call', with: { key: 'mentor.woodcutter.first' }, timeout: 15 } },
  ];
  const failures = await runHeadless({ name: 'stem-123', profile: { name: 'An', grade, lang: 'vi', seed, flags: { 'intro.seen': true, 'prologue.started': true } }, clock: 540, at: ['phu-dong', 51, 8.5], steps }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  return session;
}

test('at grades 3, 4, and 5, a stem of 16 or 24 is whole in the frame of the task on a phone while the hero marks', async () => {
  const seen = new Set();
  for (const grade of [3, 4, 5]) {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const session = await atStem(grade, seed);
      const stem = getEntity(session.state, 'stem:woodcutter');
      const len = stem.item.size;
      if (len < 16 || seen.has(`${grade}:${len}`)) continue;
      seen.add(`${grade}:${len}`);
      // A mark in the middle, from beside the stem.
      const hero = getEntity(session.state, 'hero');
      Object.assign(hero.position, { x: stem.position.x + len / 2, z: stem.position.z + 2.5 });
      delete hero.route;
      session.command({ type: 'tap', target: { thing: stem.id, along: Math.round(len / 2) } });
      for (let i = 0; i < 3 / STEP; i++) { session.step(); session.events(); }
      const cam = sessionCamera(session);
      for (const j of [0, len]) {
        const q = cam.project((stem.position.x + j) / 2, stem.position.y / 2, stem.position.z / 2);
        assert.ok(q.x >= 0 && q.x <= cam.width && q.y >= 0 && q.y <= cam.height * 0.8, `grade ${grade}, stem ${len}: the end ${j} at ${q.x.toFixed(0)}, ${q.y.toFixed(0)}`);
      }
      // A ring of the stem is at least a few pixels long on the screen (#34).
      const a = cam.project(stem.position.x / 2, stem.position.y / 2, stem.position.z / 2);
      const b = cam.project((stem.position.x + 1) / 2, stem.position.y / 2, stem.position.z / 2);
      assert.ok(Math.hypot(b.x - a.x, b.y - a.y) >= 6, `grade ${grade}, stem ${len}: a ring is ${Math.hypot(b.x - a.x, b.y - a.y).toFixed(1)} px`);
    }
  }
  assert.ok(seen.has('5:24'), `a stem of 24 at grade 5: ${[...seen].join(', ')}`);
  assert.ok([...seen].some((k) => k.endsWith(':16')), `a stem of 16: ${[...seen].join(', ')}`);
});
