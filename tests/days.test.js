import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventsOfDay, eventLevel, eventTask, exactResult, purse, dayOf } from '../src/core/world/days.js';
import { createRng } from '../src/core/rng.js';
import { load, mapOf } from './helpers.js';

const defs = load('data/world/events.json');
const spots = { road: [[10, 10], [20, 20]], field: [[30, 30]], wetfield: [[30, 30]], yard: [[40, 40]] };

test('the events of a day come from the seed and the day; a market comes on the fixed days of its hamlet', () => {
  const days = Array.from({ length: 60 }, (_, day) => eventsOfDay(defs, { seed: 5, day, map: 'trau-son', spots, wet: true }));
  assert.deepEqual(eventsOfDay(defs, { seed: 5, day: 7, map: 'trau-son', spots, wet: true }), days[7], 'the same seed and day');
  // One hamlet: its market comes every fifth day.
  const market = days.map((d) => d.some((e) => e.id === 'market'));
  const every = defs.events.find((d) => d.id === 'market').every;
  assert.equal(every, 5);
  const first = market.indexOf(true);
  market.forEach((m, day) => assert.equal(m, (day - first) % every === 0, `day ${day}`));
  // Two hamlets: each has its own day in the five, from the seed.
  const two = { yard: [[40, 40], [50, 50]] };
  const at = (day) => eventsOfDay(defs, { seed: 9, day, map: 'm', spots: two }).find((e) => e.id === 'market')?.at.join(',') ?? null;
  for (const yard of ['40,40', '50,50']) {
    const ds = Array.from({ length: 40 }, (_, d) => d).filter((d) => at(d) === yard);
    assert.ok(ds.length >= 4, `${yard}: ${ds.length} market days`);
    for (const d of ds) assert.equal((d - ds[0]) % every, 0, `${yard}: day ${d}`);
  }
  for (const id of ['cart', 'flood', 'duck']) {
    const n = days.filter((d) => d.some((e) => e.id === id)).length;
    assert.ok(n > 5 && n < 55, `${id}: on ${n} of 60 days`);
  }
  // A flood only on wet land, and only at a field near water.
  for (let day = 0; day < 60; day++) assert.ok(!eventsOfDay(defs, { seed: 5, day, map: 'trau-son', spots, wet: false }).some((e) => e.id === 'flood'), 'no flood with no rain');
  for (let day = 0; day < 60; day++) assert.ok(!eventsOfDay(defs, { seed: 5, day, map: 'trau-son', spots: { ...spots, wetfield: [] }, wet: true }).some((e) => e.id === 'flood'), 'no flood far from water');
  // Never two events at one spot; an event with no spot of its kind does not come.
  for (const d of days) assert.equal(new Set(d.map((e) => e.at.join(','))).size, d.length);
  for (let day = 0; day < 30; day++) assert.deepEqual(eventsOfDay(defs, { seed: 5, day, map: 'x', spots: { road: [[1, 1]] }, wet: true }).map((e) => e.id).filter((id) => id !== 'cart'), []);
  assert.equal(dayOf(1440 * 3 + 5), 3);
});

test('the level of an event: the grade, one step up for a skill the child knows, one down for a new skill', () => {
  assert.equal(eventLevel(defs, 1, null), 1);
  assert.equal(eventLevel(defs, 1, 0.9), 2);
  assert.equal(eventLevel(defs, 1, 0.1), 0);
  assert.equal(eventLevel(defs, 2, 0.95), 2);
  assert.equal(eventLevel(defs, 0, 0.05), 0);
});

test('the pile of an event can always make the need exactly, and too many too', () => {
  for (const def of defs.events) {
    for (let level = 0; level < 3; level++) {
      for (let s = 1; s <= 40; s++) {
        const t = eventTask(def, level, createRng(s));
        const l = def.levels[level];
        assert.ok(t.need >= l.need[0] && t.need <= l.need[1]);
        assert.ok(t.pile.every((x) => l.sizes.includes(x)));
        // A subset of the pile (with the kept things) makes the need.
        const reach = new Set([t.keep]);
        for (const x of t.pile) for (const v of [...reach]) reach.add(v + x);
        assert.ok(reach.has(t.need), `${def.id} ${level}: ${t.need} from ${t.pile}`);
        if (def.extra) assert.ok(t.keep + t.pile.reduce((a, b) => a + b, 0) > t.need, 'too many is possible');
        assert.equal(t.skill, l.skill);
      }
    }
  }
  assert.deepEqual(exactResult(5, 5), { solved: true, short: false, over: 0 });
  assert.deepEqual(exactResult(3, 5), { solved: false, short: true, over: 0 });
  assert.deepEqual(exactResult(8, 5), { solved: false, short: false, over: 3 });
});

test('the purse for a market: strings and single coins that make any price up to all the coins', () => {
  for (const sizes of [[1], [1, 5], [1, 10]]) {
    for (let coins = 0; coins <= 30; coins++) {
      const p = purse(coins, sizes);
      assert.ok(p.length <= 24);
      assert.equal(p.reduce((a, b) => a + b, 0), Math.min(coins, sizes.length === 1 ? 24 : coins));
      const reach = new Set([0]);
      for (const x of p) for (const v of [...reach]) reach.add(v + x);
      for (let price = 1; price <= Math.min(coins, 24); price++) assert.ok(reach.has(price), `${sizes}: ${price} from ${coins}`);
    }
  }
});

test('the maps have spots for the events: roads, paddies, and the yards of the hamlets', () => {
  for (const seed of [1, 2]) {
    let roads = 0;
    let fields = 0;
    for (const id of ['phu-dong', 'soc-son', 'trau-son', 'road-thanglong']) {
      const m = mapOf(id, seed);
      for (const [x, y] of m.layers.spots.road) assert.equal(m.layers.ground[y][x], '=', `${id}: a road at ${x},${y}`);
      for (const [x, y] of m.layers.spots.field) assert.equal(m.layers.ground[y][x], 'f', `${id}: a paddy at ${x},${y}`);
      for (const [x, y] of m.layers.spots.yard) assert.equal(m.layers.ground[y][x], 'y', `${id}: a yard at ${x},${y}`);
      roads += m.layers.spots.road.length;
      fields += m.layers.spots.field.length;
    }
    assert.ok(roads >= 10 && fields >= 10, `${seed}: ${roads} roads, ${fields} paddies`);
  }
});
