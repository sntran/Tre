import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock, advance, addHours, timeOfDay, rateAt, DAY_MINUTES, CLOCK } from '../src/core/world/clock.js';

test('a game day passes in about 14 minutes of play: 10 minutes of light and 4 of night (#65)', () => {
  const c = createClock();
  assert.deepEqual(timeOfDay(c), { day: 1, hour: 7, minute: 0, part: 'day' });
  advance(c, CLOCK.realSecondsPerDay);
  assert.ok(Math.abs(c.minutes - (7 * 60 + DAY_MINUTES)) < 1e-6);
  assert.equal(timeOfDay(c).day, 2);
  assert.equal(CLOCK.daySeconds + CLOCK.nightSeconds, CLOCK.realSecondsPerDay);
  assert.ok(CLOCK.daySeconds >= 600, 'the light of the day is at least 10 minutes');
  assert.ok(CLOCK.nightSeconds <= 240, 'the night is at most 4 minutes');
  // From 5:00 to 19:00 in the seconds of the day, in small steps over the edges too.
  const d = { minutes: 5 * 60 };
  for (let i = 0; i < CLOCK.daySeconds * 10; i++) advance(d, 0.1);
  assert.ok(Math.abs(d.minutes - 19 * 60) < 1e-6);
  advance(d, CLOCK.nightSeconds);
  assert.ok(Math.abs(d.minutes - (DAY_MINUTES + 5 * 60)) < 1e-6);
  // The night goes faster than the day.
  assert.ok(rateAt(22 * 60) > rateAt(12 * 60));
});

test('travel adds hours, and the parts of the day follow the hour', () => {
  const c = createClock();
  addHours(c, 11);
  assert.equal(timeOfDay(c).hour, 18);
  assert.equal(timeOfDay(c).part, 'dusk');
  addHours(c, 4);
  assert.deepEqual([timeOfDay(c).day, timeOfDay(c).hour, timeOfDay(c).part], [1, 22, 'night']);
  addHours(c, 7.5);
  assert.deepEqual([timeOfDay(c).day, timeOfDay(c).hour, timeOfDay(c).minute, timeOfDay(c).part], [2, 5, 30, 'dawn']);
});
