import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventsOfDay, isEventDay, notAgain, eventLevel, eventTask, barterTask, exactResult, dayOf } from '../src/core/world/days.js';
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
  for (const def of defs.events.filter((d) => !d.barter)) {
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

test('a market day is barter: the seller trades all her goods at the rate of the level, and the rice of the basket pays', () => {
  const market = defs.events.find((e) => e.id === 'market');
  assert.ok(market.barter && !market.pay && !market.reward, 'no coins and no price');
  for (let level = 0; level < 3; level++) {
    for (let s = 0; s < 40; s++) {
      const t = barterTask(market, level, createRng(s), 40);
      const [a, b] = t.rate;
      assert.ok(market.levels[level].rates.some(([x, y]) => x === a && y === b));
      assert.ok(market.goods.includes(t.goods));
      assert.equal(t.need, t.lots * a, 'the rice for all the lots');
      assert.equal(t.k, t.lots * b, 'all the goods of the seller');
      assert.equal(t.pile.length, t.need + market.extra, 'the measures by the mat, with some more');
      assert.ok(t.pile.every((x) => x === 1));
      assert.ok(t.k <= 20 && t.need <= 20, 'small numbers');
    }
  }
  // One for one (count), two for one (doubles), and rates such as five for two (groups).
  assert.deepEqual(market.levels.map((l) => l.skill), ['math.count.120', 'math.add.20', 'math.mul.10']);
  assert.deepEqual(market.levels[0].rates, [[1, 1]]);
  assert.deepEqual(market.levels[1].rates, [[2, 1]]);
  // Little rice: fewer lots, and only the rice of the basket lies by the mat.
  const few = barterTask(market, 1, createRng(3), 7);
  assert.equal(few.lots, 3);
  assert.equal(few.pile.length, 7);
  assert.equal(barterTask(market, 1, createRng(3), 5), null, 'too little rice: no barter');
});

test('the land has spots for the events: roads, paddies, and the yards of the hamlets', () => {
  for (const seed of [1, 2]) {
    let roads = 0;
    let fields = 0;
    let yards = 0;
    const m = mapOf('giong', seed);
    // The tiles of the land between the four places of Era 1.
    for (let tz = 94; tz <= 97; tz++) {
      for (let tx = 145; tx <= 150; tx++) {
        const t = m.land.tile(tx, tz);
        const letter = ([x, y]) => m.land.cell(x, y).letter;
        for (const p of t.spots.road) assert.equal(letter(p), '=', `a road at ${p}`);
        for (const p of t.spots.field) assert.equal(letter(p), 'f', `a paddy at ${p}`);
        for (const p of t.spots.yard) assert.equal(letter(p), 'y', `a yard at ${p}`);
        roads += t.spots.road.length;
        fields += t.spots.field.length;
        yards += t.spots.yard.length;
      }
    }
    assert.ok(roads >= 10 && fields >= 10 && yards >= 3, `${seed}: ${roads} roads, ${fields} paddies, ${yards} yards`);
    // The spots of the places are on their stamps.
    for (const [x, y] of m.spotsByPlace['phu-dong'].field) assert.equal(m.land.cell(x, y).letter, 'f');
  }
});

test('an event does not come at its spot of yesterday; a market keeps the yard of its hamlet', () => {
  const found = [{ id: 'cart', at: [10, 4] }, { id: 'flood', at: [3, 3] }, { id: 'cart', at: [20, 8] }, { id: 'market', at: [5, 5] }];
  const list = [found[0], found[1], found[3]];
  const last = { cart: '6:10,4', flood: '4:3,3', market: '6:5,5' };
  const out = notAgain(list, found, 7, (id) => last[id], (id) => id === 'market');
  // The cart was at [10, 4] yesterday: it comes at its next spot. The flood was there on another day.
  assert.deepEqual(out.map((e) => [e.id, e.at]), [['cart', [20, 8]], ['flood', [3, 3]], ['market', [5, 5]]]);
  // With no other spot, the cart does not come today.
  assert.deepEqual(notAgain([found[0]], [found[0]], 7, (id) => last[id]).length, 0);
  // The market day of a yard comes from the seed and its cell only: one day in five.
  const def = { id: 'market', every: 5 };
  const days = Array.from({ length: 10 }, (_, d) => isEventDay(def, 7, d, [5, 5]));
  assert.equal(days.filter(Boolean).length, 2);
  assert.equal(days.indexOf(true) + 5, days.lastIndexOf(true));
});
