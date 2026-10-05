// Things belong to their time (#39): data/world/origins.json, the year of each region, and the
// things of the world of a region (src/core/origins.js). No corn hangs under the eaves in Era 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { thingIn, thingsOf, wordsBefore } from '../src/core/origins.js';
import { houseVariant, EXTRA_NEEDS } from '../src/world/props/houses.js';
import { seeded } from '../src/world/voxel.js';
import { load, mapOf } from './helpers.js';

const origins = load('data/world/origins.json');
const regions = load('data/world/regions.json').regions;

test('a thing of a known time has its first year and a source; a thing with no year is not in the world yet', () => {
  for (const [id, t] of Object.entries(origins.things)) {
    assert.ok(t.vi?.length && t.en?.length, `${id}: its words`);
    if (t.from !== null) assert.ok(Number.isInteger(t.from) && t.sources.length > 0, `${id}: a year with a source`);
    else assert.equal(thingIn(origins, id, 3000), false, `${id}: no year, not in the world`);
  }
  assert.equal(origins.things.maize.from, 1597);
  for (const r of regions) assert.ok(Number.isInteger(r.year), `${r.id}: the year of its time`);
  const year = (id) => regions.find((r) => r.id === id).year;
  assert.equal(thingIn(origins, 'maize', year('giong')), false, 'no maize in the time of the Hùng Kings');
  assert.equal(thingIn(origins, 'maize', year('thuan-quang')), false, 'no maize in 1497');
  assert.equal(thingIn(origins, 'maize', year('tay-son')), true, 'maize in the time of Tây Sơn');
  assert.deepEqual(thingsOf(origins, year('giong')), []);
});

test('no corn on the houses of Era 1; the corn of a later time comes only with maize', () => {
  const map = mapOf('giong', 1);
  assert.equal(map.year, -258);
  assert.deepEqual(map.things, []);
  const has = (t) => map.things.includes(t);
  const later = (t) => thingsOf(origins, 1789).includes(t);
  let corn = 0;
  for (let s = 1; s <= 400; s++) {
    assert.ok(!houseVariant(seeded(s), has).extras.includes('corn'), `seed ${s}`);
    if (houseVariant(seeded(s), later).extras.includes('corn')) corn += 1;
  }
  assert.ok(corn > 0, 'a house of the time of Tây Sơn can have corn');
  assert.ok(Object.values(EXTRA_NEEDS).every((t) => origins.things[t]), 'each extra of a known time names a thing of the data');
  // A house of Era 1 has sheaves of rice or gourds under the eaves in place of corn.
  const extras = new Set();
  for (let s = 1; s <= 200; s++) for (const e of houseVariant(seeded(s), has).extras) extras.add(e);
  assert.ok(extras.has('sheaves') && extras.has('gourds'));
});

// The words of a text, as whole words (the text is in one Unicode form, so that "ướt" is not "ớt").
const hasWord = (text, word) => new RegExp(`(?<!\\p{L})${word}(?!\\p{L})`, 'iu').test(text.normalize('NFC'));

test('no line of text names a thing before its year: the texts of the game are of Era 1', () => {
  const year = Math.min(...regions.filter((r) => r.maps.length).map((r) => r.year));
  for (const lang of ['vi', 'en']) {
    const texts = Object.values(load(`i18n/${lang}.json`)).join('\n');
    for (const w of wordsBefore(origins, year, lang)) assert.ok(!hasWord(texts, w.normalize('NFC')), `${lang}: ${w}`);
  }
  for (const f of readdirSync('data/dialogue')) {
    const text = readFileSync(`data/dialogue/${f}`, 'utf8');
    for (const w of wordsBefore(origins, year, 'vi')) assert.ok(!hasWord(text, w.normalize('NFC')), `${f}: ${w}`);
  }
  assert.ok(hasWord('Ở ao có ớt.', 'ớt') && !hasWord('Lửa không thích bị ướt.', 'ớt'), 'the check of whole words');
});
