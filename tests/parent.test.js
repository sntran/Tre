import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPlayTime, timeStatus, remainingMs, extendTime, dayKey } from '../src/core/timelimit.js';
import { makeGateQuestion, checkGateAnswer, holdProgress } from '../src/core/parentgate.js';
import { createRng } from '../src/core/rng.js';

const MIN = 60 * 1000;
const day1 = new Date(2026, 8, 28, 10, 0).getTime();
const day2 = new Date(2026, 8, 29, 9, 0).getTime();

test('play time adds up and starts again each day', () => {
  const time = { day: null, usedMs: 0, extraMs: 0 };
  addPlayTime(time, day1, 30 * 1000);
  addPlayTime(time, day1, 30 * 1000);
  assert.equal(time.usedMs, MIN);
  assert.equal(time.day, dayKey(day1));
  addPlayTime(time, day2, 5000);
  assert.equal(time.usedMs, 5000);
  assert.equal(time.day, dayKey(day2));
});

test('a long pause does not count as play time', () => {
  const time = { day: null, usedMs: 0, extraMs: 0 };
  addPlayTime(time, day1, 3 * 60 * MIN);
  assert.equal(time.usedMs, MIN);
});

test('time status: ok, warn, over, and no limit', () => {
  const time = { day: dayKey(day1), usedMs: 20 * MIN, extraMs: 0 };
  assert.equal(timeStatus(time, 30, 5, day1), 'ok');
  time.usedMs = 26 * MIN;
  assert.equal(timeStatus(time, 30, 5, day1), 'warn');
  time.usedMs = 30 * MIN;
  assert.equal(timeStatus(time, 30, 5, day1), 'over');
  assert.equal(timeStatus(time, 0, 5, day1), 'ok');
  assert.equal(remainingMs(time, 0, day1), Infinity);
  // A new day has all the time again.
  assert.equal(timeStatus(time, 30, 5, day2), 'ok');
});

test('the parent can give more time for today', () => {
  const time = { day: dayKey(day1), usedMs: 30 * MIN, extraMs: 0 };
  extendTime(time, 15, day1);
  assert.equal(timeStatus(time, 30, 5, day1), 'ok');
  assert.equal(remainingMs(time, 30, day1), 15 * MIN);
});

test('the parent gate question has an adult answer', () => {
  const rng = createRng('gate');
  for (let i = 0; i < 100; i++) {
    const q = makeGateQuestion(rng, { min: 12, max: 19 });
    assert.ok(q.a >= 12 && q.a <= 19 && q.b >= 12 && q.b <= 19);
    assert.ok(q.answer >= 144);
    assert.equal(checkGateAnswer(q, String(q.answer)), true);
    assert.equal(checkGateAnswer(q, String(q.answer + 1)), false);
  }
  assert.equal(checkGateAnswer({ answer: 156 }, ' 156 '), true);
  assert.equal(checkGateAnswer({ answer: 156 }, 'abc'), false);
});

test('the hold must last the full time', () => {
  assert.equal(holdProgress(null, 5000, 3000), 0);
  assert.equal(holdProgress(1000, 2500, 3000), 0.5);
  assert.equal(holdProgress(1000, 9000, 3000), 1);
});
