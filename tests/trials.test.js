import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelFor, taskOf, tieResult, glowAt, quenchResult, stakeResult, basketResult, cutResult, trialSkill, feedResult, tenResult } from '../src/core/world/trials.js';
import { load } from './helpers.js';

const trials = load('data/trials.json');
const def = (id) => trials.trials.find((t) => t.id === id);
const skills = new Set(load('data/skills.json').skills.map((s) => s.id));

test('the level of the tasks follows the grade that the player gave', () => {
  assert.equal(levelFor(trials, -1), 0);
  assert.equal(levelFor(trials, 1), 0);
  assert.equal(levelFor(trials, 2), 1);
  assert.equal(levelFor(trials, 3), 2);
  assert.equal(levelFor(trials, 5), 2, 'a higher grade uses the nearest grade');
  const t = taskOf(def('scholar'), 1);
  assert.equal(t.rods, 37);
  assert.equal(t.skill, 'math.place.1000');
  // Each trial has three levels, and each level measures a skill of the skill map.
  for (const d of trials.trials) {
    assert.equal(d.levels.length, 3, d.id);
    for (const l of d.levels) assert.ok(skills.has(l.skill), `${d.id}: ${l.skill}`);
    // A trial names its calling; a task of the story (kind: task) has none.
    assert.ok(d.places && d.flag && d.npc && (d.calling || d.kind === 'task'), d.id);
  }
});

test('the teacher: ten rods tie into a bundle, and nothing else', () => {
  assert.ok(tieResult(10));
  assert.ok(!tieResult(9));
  assert.ok(!tieResult(11));
});

test('the smith: the iron glows, stays hot, dims, and stays cold; it hardens only while it is hot', () => {
  const glow = def('smith').glow;
  const hold = 2;
  assert.equal(glowAt(0, glow, hold), 0);
  assert.equal(glowAt(glow.rise / 2, glow, hold), 0.5);
  assert.equal(glowAt(glow.rise + 1, glow, hold), 1);
  assert.ok(glowAt(glow.rise + hold + glow.dim / 2, glow, hold) < 0.6);
  assert.equal(glowAt(glow.rise + hold + glow.dim + 0.5, glow, hold), 0);
  const cycle = glow.rise + hold + glow.dim + glow.cold;
  assert.equal(glowAt(cycle + glow.rise + 1, glow, hold), 1, 'again and again');
  assert.ok(quenchResult(glowAt(glow.rise + 1, glow, hold), glow));
  assert.ok(!quenchResult(glowAt(glow.rise * 0.3, glow, hold), glow), 'too early');
  assert.ok(!quenchResult(glowAt(glow.rise + hold + glow.dim * 0.9, glow, hold), glow), 'too late');
});

test('the fisher: no space wider than the space of the row, and a stake at the end; the fewest stakes is efficient', () => {
  // A line of 16 with a space of 4: the fisher put 0 and 4.
  assert.deepEqual(stakeResult([4, 8, 12, 16], 16, 4), { solved: true, efficient: true, count: 5, fewest: 5, gaps: [4, 4, 4, 4], widest: { from: 0, size: 4 } });
  const close = stakeResult([4, 6, 8, 10, 12, 14, 16], 16, 4);
  assert.ok(close.solved && !close.efficient, 'too close is safe but not the fewest');
  const wide = stakeResult([4, 10, 12, 16], 16, 4);
  assert.ok(!wide.solved);
  assert.deepEqual(wide.widest, { from: 4, size: 6 }, 'the fish swim out here');
  const short = stakeResult([4, 8, 12], 16, 4);
  assert.ok(!short.solved, 'no stake at the end mark');
  assert.deepEqual(short.widest, { from: 12, size: 4 });
  assert.equal(stakeResult([3, 6, 9, 12, 15], 15, 3).solved, true);
});

test('the healer: the same number of each kind, no more and no less', () => {
  const kinds = ['ngai', 'tiato', 'rauma'];
  assert.ok(basketResult({ ngai: 4, tiato: 4, rauma: 4 }, kinds, 4).solved);
  const r = basketResult({ ngai: 5, tiato: 4, rauma: 3 }, kinds, 4);
  assert.ok(!r.solved);
  assert.deepEqual(r.extra, { ngai: 1, tiato: 0, rauma: 0 });
  assert.equal(r.total, 12, 'twelve herbs, but not four of each');
  assert.ok(!basketResult({ ngai: 4, tiato: 4 }, kinds, 4).solved);
});

test('the woodcutter: the marks cut the stem into equal sticks, or not', () => {
  assert.deepEqual(cutResult([4, 8], 12, 3), { solved: true, pieces: [4, 4, 4] });
  assert.deepEqual(cutResult([8, 4], 12, 3), { solved: true, pieces: [4, 4, 4] }, 'the order of the marks does not matter');
  assert.deepEqual(cutResult([5, 8], 12, 3), { solved: false, pieces: [5, 3, 4] });
  assert.equal(cutResult([4], 8, 2).solved, true);
  assert.equal(cutResult([3, 6, 9], 12, 3).solved, false, 'four sticks, not three');
});

test('the stakes of the fisher and the marks of the woodcutter share the number-line skill of the bridge', () => {
  const bridge = load('data/world/zones.json').bridge.skills.sum;
  for (const id of ['fisher', 'woodcutter']) {
    assert.deepEqual(def(id).levels.map((l) => l.skill), [bridge, bridge, bridge], id);
    assert.deepEqual(def(id).levels.map((l) => l.level), [1, 2, 3], `${id}: the level grows with the grade`);
  }
});

test('a commit of a trial is one skill event with the skill of its level', () => {
  const task = taskOf(def('woodcutter'), 1);
  const ev = trialSkill(task, { solved: true, first: true, parts: [4, 4, 4], target: 12 });
  assert.deepEqual([ev.skill, ev.level, ev.task, ev.solved, ev.efficient, ev.first, ev.evidence], ['math.add.20', 2, 'trial-woodcutter', true, true, true, true]);
  assert.equal(trialSkill(task, { solved: true, first: false }).efficient, false, 'a later success is not efficient');
  assert.equal(trialSkill(task, { solved: true, efficient: false, first: true }).efficient, false);
});

test('rice for Gióng: each ten bowls he grows; the rest stays in the pot; a ten made exactly is solved', () => {
  assert.deepEqual(feedResult(0, 5), { grew: 0, ones: 5 });
  assert.deepEqual(feedResult(8, 5), { grew: 1, ones: 3 }, 'eight and five: one ten, three over');
  assert.deepEqual(tenResult([5, 5], 0, [3, 5]), { solved: true, efficient: true, fewest: 2, over: 0 });
  assert.equal(tenResult([3, 3, 3, 3], 0, [3, 5]).solved, false, 'twelve: two over the ten');
  const carry = tenResult([3, 5], 2, [3, 5]);
  assert.ok(carry.solved && carry.efficient, 'two in the pot, then three and five');
  assert.equal(tenResult([3, 3, 3, 3], 1, [3, 5]).efficient, false, 'more trays than needed');
});

