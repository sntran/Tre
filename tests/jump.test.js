import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jumpLength, longestJump, planJump, ageOfGrade, arcAt } from '../src/core/world/jump.js';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';

const cfg = load('data/hero.json').jump;
const zones = load('data/world/zones.json');

// A small flat land for the plans (cells): grass, with things put on it by the test.
function land({ types = {}, levels = {}, objects = {}, gap = null, task = null } = {}) {
  const key = (x, y) => `${x},${y}`;
  return {
    groundY: (x, y) => (levels[key(x, y)] ?? 0) * 2,
    level: (x, y) => levels[key(x, y)] ?? 0,
    type: (x, y) => types[key(x, y)] ?? 'grass',
    walkable: (x, y) => !objects[key(x, y)] && !['water', 'sea', 'ditch', 'field', 'hedge'].includes(types[key(x, y)] ?? 'grass'),
    objectAt: (x, y) => objects[key(x, y)] ?? null,
    gapAt: (x, z) => (gap && x >= gap.x0 && x < gap.x1 && z >= gap.z0 && z < gap.z1 ? { id: 'zone:gap', zone: gap } : null),
    taskAt: (x, z) => Boolean(task && x >= task.x0 && x <= task.x1 && z >= task.z0 && z <= task.z1),
  };
}
const north = { x: 0, z: 1 };
const from = { x: 21, z: 21 }; // the middle of cell 10, 10

test('the jump grows with the age, and is the same for a girl and a boy of a grade', () => {
  const grades = Object.keys(cfg.ages).map(Number).sort((a, b) => a - b);
  for (let i = 1; i < grades.length; i++) assert.ok(jumpLength(cfg, grades[i]) > jumpLength(cfg, grades[i - 1]), `grade ${grades[i]}`);
  assert.equal(ageOfGrade(cfg, -1), 4);
  // A seven-year-old jumps about two blocks at the scale of the figures (113 cm for a child of 122 cm).
  assert.ok(Math.abs(jumpLength(cfg, 2) / 2 - 2.2) < 0.15, `${jumpLength(cfg, 2) / 2} blocks at grade two`);
  assert.ok(jumpLength(cfg, 2, { run: true }) > jumpLength(cfg, 2), 'a run makes it longer');
  // One median for boys and girls (the table has the mean of the two): the jump has no gender.
  assert.equal(jumpLength.length, 2);
  // The top of the arc is at a quarter of its length.
  assert.equal(arcAt(1, 0.5), 1);
});

test('for every round and every repair of the bridge, the longest jump from the near end ends in the water', () => {
  const longest = longestJump(cfg);
  const def = zones.bridge;
  const gaps = [...def.rounds.map((r) => r.gap), ...[3, 4, 5]];
  for (const g of gaps) {
    // The gap lies across the lane from z = 40; the near end is the deck before it.
    const gap = { x0: 18, x1: 24, z0: 40, z1: 40 + g, lane: 21, from: 40 };
    for (let x = 18.5; x < 24; x += 1) {
      for (const z of [38.5, 39, 39.5]) {
        const plan = planJump(land({ gap }), { x, z }, north, longest, cfg);
        assert.equal(plan.kind, 'fall', `gap ${g} from ${x}, ${z}`);
        assert.ok(plan.at.z < 40 + g, 'the hero falls in the gap, never past it');
      }
    }
  }
  assert.ok(longest > 5, `the longest jump is ${longest} half blocks: longer than a repair of the bridge`);
});

test('a jump does not climb or go down a cliff, and does not cross a wall, a house, a hedge, or deep water', () => {
  const len = jumpLength(cfg, 3);
  // A cliff of two steps up, or down, at the landing.
  assert.equal(planJump(land({ levels: { '10,12': 2 } }), from, north, len, cfg).kind, 'hop');
  assert.equal(planJump(land({ levels: { '10,12': -2 } }), from, north, len, cfg).kind, 'hop');
  // One step up is a jump.
  assert.equal(planJump(land({ levels: { '10,12': 1 } }), from, north, len, cfg).kind, 'jump');
  // A wall higher than the arc, a house, a hedge, and the river.
  assert.equal(planJump(land({ levels: { '10,11': 3, '10,12': 0 } }), from, north, len, cfg).kind, 'hop');
  assert.equal(planJump(land({ objects: { '10,11': { kind: 'house' } } }), from, north, len, cfg).kind, 'hop');
  assert.equal(planJump(land({ types: { '10,11': 'hedge' } }), from, north, len, cfg).kind, 'hop');
  assert.equal(planJump(land({ types: { '10,11': 'water' } }), from, north, len, cfg).kind, 'hop');
  // The zone of a task (the row of stakes of the fisher): a hop.
  assert.equal(planJump(land({ task: { x0: 18, x1: 24, z0: 22.5, z1: 30 } }), from, north, len, cfg).kind, 'hop');
  // A landing in the shallow water of a ford: a splash, and the hero walks on.
  const ford = planJump(land({ types: { '10,12': 'shallow' } }), from, north, len, cfg);
  assert.equal(ford.kind, 'jump');
  assert.equal(ford.splash, true);
});

test('a jump over a log or a narrow ditch works at grade one; a ditch wider than the jump of Pre-K is too wide for Pre-K', () => {
  const one = jumpLength(cfg, 1);
  const prek = jumpLength(cfg, -1);
  const edge = { x: 21, z: 21.9 }; // at the north edge of cell 10, 10
  const log = planJump(land({ objects: { '10,11': { kind: 'log' } } }), edge, north, one, cfg);
  assert.equal(log.kind, 'jump', 'over a log');
  assert.ok(log.to.z >= 24, 'past the log');
  assert.equal(planJump(land({ types: { '10,11': 'ditch' }, levels: { '10,11': -1 } }), edge, north, one, cfg).kind, 'jump', 'over a narrow ditch');
  // A ditch of two cells: wider than the jump of Pre-K, so Pre-K lands in it (a hop).
  const wide = land({ types: { '10,11': 'ditch', '10,12': 'ditch' }, levels: { '10,11': -1, '10,12': -1 } });
  assert.ok(prek < 4.1, `the jump of Pre-K (${prek.toFixed(2)} half blocks) is shorter than the wide ditch`);
  assert.equal(planJump(wide, edge, north, prek, cfg).kind, 'hop');
});

test('a jump during a talk or a task in progress does nothing', async () => {
  const jumps = [];
  const story = {
    name: 'x', about: { vi: '-', en: '-' },
    profile: { name: 'An', grade: 2, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'trial.fisher.done': true } },
    clock: 540, at: ['phu-dong', 46, 61],
    steps: [
      { wait: 1 },
      // The fisher starts the bridge with a short talk (#66).
      { read: true },
      // In a talk: no jump.
      { do: { type: 'talk', dialogue: 'teacher.wait' } },
      { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } },
      { do: { type: 'jump' } },
      { wait: 1 },
      { read: true },
      // A plank in the hands is a task in progress: no jump.
      { press: { plank: 4 } },
      { until: { event: 'pick', timeout: 20 } },
      { do: { type: 'jump' } },
      { wait: 1 },
      { expect: [{ hero: { holding: true } }] },
    ],
  };
  const failures = await runHeadless(story, { onSession: (s) => s.listen((ev) => { if (ev.type === 'jump') jumps.push(ev); }) });
  assert.deepEqual(failures, []);
  assert.deepEqual(jumps, []);
});
