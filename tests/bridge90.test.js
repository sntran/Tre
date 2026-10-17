// The bridge of the play test of #85 to #89 (#90): no dead end when no plank fits the rest of the
// gap, a count that counts on, planks on the gap that look like planks, the rows of the guess
// beside the gap, and a demonstration with a gap of its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { getEntity } from '../src/core/world/state.js';

const profile = (flags) => ({ name: 'An', grade: 2, lang: 'vi', seed: 7, flags: { 'intro.seen': true, ...flags } });
const open = { 'trial.fisher.done': true };
const start = [
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } },
  { read: true },
  { wait: 1 },
];
const plank = (size) => [
  { press: { plank: size } },
  { until: { event: 'pick', timeout: 20 } },
  { press: { screenOf: 'bridge-gap' } },
];

test('5 and 5 on a gap of 12: the take-back line at once, the last plank glows, and a press takes it back', async () => {
  let s = null;
  const lines = [];
  const cues = [];
  const picks = [];
  const failures = await runHeadless({
    name: 'bridge-stuck', profile: profile(open), clock: 540, at: ['phu-dong', 46, 61],
    steps: [
      ...start,
      { press: { guess: 3 } },
      { until: { event: 'guess', timeout: 3 } },
      { wait: 2 },
      ...plank(5), { until: { event: 'put', timeout: 20 } }, { wait: 1.5 },
      ...plank(5), { until: { event: 'stuck', timeout: 20 } }, { wait: 2 },
      // With empty hands at the edge, a press takes the last plank back (no tap on it).
      { press: true },
      { until: { event: 'pick', timeout: 10 } },
      { wait: 1 },
      { expect: [{ zone: 'bridge-gap', planks: 1 }] },
      // The plank goes back to the pile; then a 4 and a 3 finish the gap.
      { press: { screenOf: 'bridge-pile' } },
      { until: { event: 'put', timeout: 20 } }, { wait: 1 },
      ...plank(4), { until: { event: 'put', timeout: 20 } }, { wait: 1 },
      ...plank(3), { until: { event: 'put', timeout: 20 } }, { wait: 1 },
      { press: { screenOf: 'bridge-gap' } },
      { until: { event: 'solid', timeout: 20 } },
    ],
  }, {
    onSession: (x) => {
      s = x;
      x.listen((e) => {
        if (e.type === 'open') lines.push(e.textKey);
        if (e.type === 'cue') cues.push(e.ids);
        if (e.type === 'pick') picks.push(e.from);
      });
    },
  });
  assert.deepEqual(failures, []);
  assert.ok(lines.includes('mentor.bridge.stuck'), `the line of the take-back: ${lines.join(', ')}`);
  assert.ok(!lines.includes('mentor.bridge.shorter'), 'no line of a shorter plank');
  assert.ok(cues.some((ids) => ids.length === 1 && /plank/.test(ids[0])), `the last plank glows: ${JSON.stringify(cues)}`);
  assert.equal(picks[2], 'bridge-gap', `the press took the plank back from the gap: ${picks.join(', ')}`);
  assert.ok(!getEntity(s.state, 'zone:bridge-gap').zone.stuck, 'the gap is not stuck after the take-back');
});

test('3, 4, and 4 leave a rest of 1: the line comes at once; a 5 after it gets the same line after the count, and the plank before it glows', async () => {
  let s = null;
  const lines = [];
  const cues = [];
  const failures = await runHeadless({
    name: 'bridge-stuck-long', profile: profile(open), clock: 540, at: ['phu-dong', 46, 61],
    steps: [
      ...start,
      { press: { guess: 3 } },
      { until: { event: 'guess', timeout: 3 } },
      { wait: 2 },
      ...plank(3), { until: { event: 'put', timeout: 20 } }, { wait: 1.5 },
      ...plank(4), { until: { event: 'put', timeout: 20 } }, { wait: 1.5 },
      ...plank(4), { until: { event: 'stuck', timeout: 20 } }, { wait: 3 },
      ...plank(5), { until: { event: 'long', timeout: 20 } },
      { until: { event: 'float', timeout: 20 } },
      { wait: 6 },
    ],
  }, {
    onSession: (x) => {
      s = x;
      x.listen((e) => {
        if (e.type === 'open') lines.push(e.textKey);
        if (e.type === 'cue') cues.push(e.ids);
      });
    },
  });
  assert.deepEqual(failures, []);
  const stuck = lines.filter((k) => k === 'mentor.bridge.stuck').length;
  assert.equal(stuck, 2, `the line at the put and after the count: ${lines.join(', ')}`);
  assert.ok(!lines.includes('mentor.bridge.shorter'), 'no line of a shorter plank');
  const gap = getEntity(s.state, 'zone:bridge-gap').zone;
  assert.equal(gap.items.length, 3);
  assert.equal(gap.stuck, gap.items.at(-1), 'the last plank on the gap is the plank to take back');
  assert.deepEqual(cues.filter((ids) => ids.length).at(-1), [gap.items.at(-1)], 'the last plank glows');
});

test('after a plank that is too long, only the planks that fit the rest glow', async () => {
  let s = null;
  const cues = [];
  const lines = [];
  const failures = await runHeadless({
    name: 'bridge-fit', profile: profile(open), clock: 540, at: ['phu-dong', 46, 61],
    steps: [
      ...start,
      { press: { guess: 3 } },
      { until: { event: 'guess', timeout: 3 } },
      { wait: 2 },
      ...plank(4), { until: { event: 'put', timeout: 20 } }, { wait: 1.5 },
      ...plank(5), { until: { event: 'put', timeout: 20 } }, { wait: 1.5 },
      ...plank(4), { until: { event: 'long', timeout: 20 } },
      { until: { event: 'float', timeout: 20 } },
      { wait: 6 },
    ],
  }, {
    onSession: (x) => {
      s = x;
      x.listen((e) => {
        if (e.type === 'open') lines.push(e.textKey);
        if (e.type === 'cue') cues.push(e.ids);
      });
    },
  });
  assert.deepEqual(failures, []);
  assert.ok(lines.includes('mentor.bridge.shorter'), lines.join(', '));
  const glow = cues.filter((ids) => ids.length).at(-1) ?? [];
  assert.ok(glow.length > 0, 'some planks glow');
  for (const id of glow) assert.equal(getEntity(s.state, id).item.size, 3, `only the planks of 3 fit a rest of 3: ${id}`);
});
