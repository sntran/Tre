import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.js';
import { addPoint, restorePoint, gameDay, whereOf, newAdventure, KEEP } from '../src/core/restore.js';

const record = (text = 'now') => ({ id: 'p1', name: 'An', text, updatedAt: 0, points: [] });

test('the restore points rotate: three dawns, the oldest out', () => {
  let r = record();
  for (let day = 1; day <= 5; day++) r = addPoint(r, { text: `dawn ${day}`, day, map: 'phu-dong', at: day * 10 });
  assert.equal(r.points.length, KEEP);
  assert.deepEqual(r.points.map((p) => p.day), [5, 4, 3], 'the newest first');
  r = addPoint(r, { text: 'dawn 5 again', day: 5, map: 'phu-dong', at: 99 });
  assert.equal(r.points.length, 3, 'a second save of the same dawn takes its place');
  assert.equal(r.points[0].text, 'dawn 5 again');
});

test('a restore swaps the current save with the point and keeps both', () => {
  let r = record('day 6');
  for (let day = 3; day <= 5; day++) r = addPoint(r, { text: `dawn ${day}`, day, map: 'phu-dong', at: day });
  const back = restorePoint(r, 1, { day: 6, map: 'phu-dong' }, 1000);
  assert.equal(back.text, 'dawn 4');
  assert.deepEqual(back.points.map((p) => p.text), ['day 6', 'dawn 5', 'dawn 3'], 'the current save is a point now');
  assert.equal(back.points.length, 3);
  assert.equal(back.points[0].before, true, 'the save before the restore is marked: it is not a dawn');
  assert.equal(back.updatedAt, 1000);
  assert.deepEqual(restorePoint(r, 7, { day: 6, map: 'phu-dong' }, 1), r, 'no such point: nothing changes');
  const again = restorePoint(back, 0, { day: 4, map: 'phu-dong' }, 2000);
  assert.equal(again.text, 'day 6', 'a restore can be undone');
  const dawn = addPoint(back, { text: 'dawn 6', day: 6, map: 'phu-dong', at: 3000 });
  assert.ok(dawn.points.some((p) => p.before), 'a dawn of the same day keeps the save from before the restore');
});

test('the game day comes from the clock of the world', () => {
  assert.equal(gameDay({ world: { clock: { minutes: 7 * 60 } } }), 0);
  assert.equal(gameDay({ world: { clock: { minutes: 1440 * 2 + 5 } } }), 2);
  assert.equal(gameDay({}), 0);
});

test('a save is where its hero is: the game day and the map', () => {
  assert.deepEqual(whereOf({ world: { map: 'soc-son', clock: { minutes: 1440 + 5 } } }), { day: 1, map: 'soc-son' });
  assert.deepEqual(whereOf({}), { day: 0, map: null });
});

test('the title always shows a new adventure, and full profiles ask for the parent gate', () => {
  assert.deepEqual(newAdventure(0, 4), { show: true, full: false });
  assert.deepEqual(newAdventure(4, 4), { show: true, full: true });
});

test('a restore point has the game day of its morning, never "days ago" (#52)', async () => {
  const { restoreLabel } = await import('../src/core/restore.js');
  assert.deepEqual(restoreLabel({ day: 2 }, 7), { key: 'parent.restore.day', params: { d: 3 } });
  assert.deepEqual(restoreLabel({ day: 7 }, 7), { key: 'parent.restore.day', params: { d: 8 } });
  assert.deepEqual(restoreLabel({ day: 9 }, 7), { key: 'parent.restore.dayLater', params: { d: 10 } });
  assert.equal(restoreLabel({ day: 9, before: true }, 7).key, 'parent.restore.before');
  for (const lang of ['vi', 'en']) {
    const texts = load(`i18n/${lang}.json`);
    for (const k of ['parent.restore.day', 'parent.restore.dayLater', 'parent.restore.before']) assert.ok(texts[k], `${lang}: ${k}`);
    assert.ok(!Object.keys(texts).some((k) => /^parent\.restore\.(today|yesterday|days)$/.test(k)), `${lang}: no text of days ago`);
  }
});
