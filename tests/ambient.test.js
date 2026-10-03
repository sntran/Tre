import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gustAt, gustsAt, mealAt, isTet, dayIndex, rareOn, starOn, windyOn, rainbowAt, DEFAULT_AMBIENT } from '../src/core/world/ambient.js';
import { load } from './helpers.js';

const A = load('data/world/day.json').ambient;

test('a gust crosses the paddies first, then the hedge, then the trees', () => {
  // The first moment that each layer feels the gust: in that order, later each time.
  const first = {};
  for (let t = 0; t < 200 && Object.keys(first).length < 3; t += 0.1) {
    for (const layer of ['paddy', 'hedge', 'tree']) if (first[layer] === undefined && gustAt(7, t, layer, A) > 0.2) first[layer] = t;
  }
  assert.ok(first.paddy < first.hedge && first.hedge < first.tree, JSON.stringify(first));
  assert.ok(Math.abs(first.hedge - first.paddy - A.gust.delays.hedge) < 0.3);
  // A gust comes now and then, not all the time, and it is the same for the same seed.
  let on = 0;
  for (let t = 0; t < 600; t += 1) if (gustsAt(7, t, A).tree > 0.1) on += 1;
  assert.ok(on > 20 && on < 200, `${on} seconds of gust in ten minutes`);
  assert.deepEqual(gustsAt(7, 123.4, A), gustsAt(7, 123.4, A));
  assert.notDeepEqual([...Array(300).keys()].map((t) => gustAt(7, t, 'tree', A)), [...Array(300).keys()].map((t) => gustAt(8, t, 'tree', A)), 'another seed, other gusts');
});

test('the meals, the days of Tết on the calendar, and the rainbow after a rain', () => {
  assert.equal(mealAt(6.5, A), true);
  assert.equal(mealAt(9, A), false);
  assert.equal(mealAt(17.2, A), true);
  const tet = [];
  for (let d = 0; d < 2 * A.year.days; d++) if (isTet(d, A)) tet.push(d);
  assert.deepEqual(tet, [A.year.tet[0], A.year.tet[1], A.year.days + A.year.tet[0], A.year.days + A.year.tet[1]], 'two days, once a year');
  assert.equal(dayIndex(1440 * 20 + 600), 20);
  assert.equal(rainbowAt({ start: 12, end: 14 }, 15, A), true);
  assert.equal(rainbowAt({ start: 12, end: 14 }, 13, A), false, 'not while it rains');
  assert.equal(rainbowAt(null, 15, A), false);
});

test('the rare things and the shooting stars come from the seed: the same seed gives the same days', () => {
  const days = (seed) => [...Array(400).keys()].map((d) => rareOn(seed, d, A).join('+'));
  assert.deepEqual(days(5), days(5));
  assert.notDeepEqual(days(5), days(6));
  for (const kind of A.rare.kinds) {
    const n = [...Array(2000).keys()].filter((d) => rareOn(5, d, A).includes(kind)).length;
    assert.ok(n > 2000 / 40 && n < 2000 / 10, `${kind}: ${n} days in 2000 (about one in twenty)`);
  }
  const nights = [...Array(1000).keys()].map((d) => starOn(5, d, A)).filter((h) => h !== null);
  assert.ok(nights.length > 140 && nights.length < 260, `${nights.length} stars in 1000 nights`);
  for (const h of nights) assert.ok(h >= 21 || h < 3, `at night: ${h}`);
  assert.equal(starOn(5, 7, A), starOn(5, 7, A));
  assert.equal(typeof windyOn(5, 3, A), 'boolean');
  assert.deepEqual(DEFAULT_AMBIENT, A, 'the code default is the data');
});

test('puddles lie on the earth roads from the start of a rain until a game day after its end', async () => {
  const { puddlesAt } = await import('../src/core/world/ambient.js');
  const { rainOf } = await import('../src/core/world/systems/sky.js');
  const seed = 7;
  // A day with a rain and no rain on the day before or after it.
  let d = 1;
  while (!(rainOf(seed, d) && !rainOf(seed, d - 1) && !rainOf(seed, d + 1))) d += 1;
  const rain = rainOf(seed, d);
  const at = (day, hour) => puddlesAt((k) => rainOf(seed, k), day * 1440 + hour * 60);
  assert.equal(at(d, rain.start - 0.5), false, 'no puddles before the rain');
  assert.equal(at(d, rain.start + 0.1), true, 'puddles in the rain');
  assert.equal(at(d, rain.end + 2), true, 'puddles after the rain');
  assert.equal(at(d + 1, rain.end - 0.5), true, 'still the next day, until a game day after the end');
  assert.equal(at(d + 1, rain.end + 0.5), false, 'gone a game day after the end');
  assert.equal(at(d + 2, 12), false);
});
