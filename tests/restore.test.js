import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPoint, restorePoint, gameDay, newAdventure, KEEP } from '../src/core/restore.js';

const record = (text = 'now') => ({ id: 'p1', name: 'An', text, updatedAt: 0, points: [] });

test('the restore points rotate: three dawns, the oldest out', () => {
  let r = record();
  for (let day = 1; day <= 5; day++) r = addPoint(r, { text: `dawn ${day}`, day, era: 1, at: day * 10 });
  assert.equal(r.points.length, KEEP);
  assert.deepEqual(r.points.map((p) => p.day), [5, 4, 3], 'the newest first');
  r = addPoint(r, { text: 'dawn 5 again', day: 5, era: 1, at: 99 });
  assert.equal(r.points.length, 3, 'a second save of the same dawn takes its place');
  assert.equal(r.points[0].text, 'dawn 5 again');
});

test('a restore swaps the current save with the point and keeps both', () => {
  let r = record('day 6');
  for (let day = 3; day <= 5; day++) r = addPoint(r, { text: `dawn ${day}`, day, era: 1, at: day });
  const back = restorePoint(r, 1, { day: 6, era: 1 }, 1000);
  assert.equal(back.text, 'dawn 4');
  assert.deepEqual(back.points.map((p) => p.text), ['day 6', 'dawn 5', 'dawn 3'], 'the current save is a point now');
  assert.equal(back.points.length, 3);
  assert.equal(back.updatedAt, 1000);
  assert.deepEqual(restorePoint(r, 7, { day: 6, era: 1 }, 1), r, 'no such point: nothing changes');
  const again = restorePoint(back, 0, { day: 4, era: 1 }, 2000);
  assert.equal(again.text, 'day 6', 'a restore can be undone');
});

test('the game day comes from the clock of the world', () => {
  assert.equal(gameDay({ world: { clock: { minutes: 7 * 60 } } }), 0);
  assert.equal(gameDay({ world: { clock: { minutes: 1440 * 2 + 5 } } }), 2);
  assert.equal(gameDay({}), 0);
});

test('the title always shows a new adventure, and full profiles ask for the parent gate', () => {
  assert.deepEqual(newAdventure(0, 4), { show: true, full: false });
  assert.deepEqual(newAdventure(4, 4), { show: true, full: true });
});
