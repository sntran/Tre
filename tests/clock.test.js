import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock, advance, addHours, timeOfDay, DAY_MINUTES, CLOCK } from '../src/world/clock.js';

test('a game day passes in about 8 minutes of play', () => {
  const c = createClock();
  assert.deepEqual(timeOfDay(c), { day: 1, hour: 7, minute: 0, part: 'day' });
  advance(c, CLOCK.realSecondsPerDay);
  assert.equal(c.minutes, 7 * 60 + DAY_MINUTES);
  assert.equal(timeOfDay(c).day, 2);
  assert.equal(CLOCK.realSecondsPerDay, 480);
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
