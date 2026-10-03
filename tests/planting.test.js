import { test } from 'node:test';
import assert from 'node:assert/strict';
import { factKey, factState, factTable, recordFact, chooseFact, chooseForm, makePlot, judge, judgeChoice, plantOrder, seedbedFor, nextOffers, eventOf, stageOf, placeIn, factPool } from '../src/core/planting.js';
import { createRng } from '../src/core/rng.js';
import { load } from './helpers.js';

const data = load('data/world/planting.json');
const skills = load('data/skills.json').skills;
const ranges = skills.find((s) => s.id === data.skill).levels;
const levelData = (n) => data.levels[n - 1];

// Play one set: each plot is a success or a miss by `ok(index, plot)`. Return the plots.
function playSet({ mem, set, level, seed = 7, day = 10, counts = {}, ok = () => true, divideOpen = false }) {
  const plots = [];
  const used = [];
  let prev = null;
  for (let index = 0; index < data.set; index++) {
    const { offers } = nextOffers({ data, level, ranges, mem, day, set, index, prev, used, counts, divideOpen, seed });
    const plot = offers[0];
    plots.push(plot);
    recordFact(mem, plot.key, { ok: ok(index, plot), day, set, index, form: plot.form }, data);
    used.push(plot.form);
    counts[plot.form] = (counts[plot.form] ?? 0) + 1;
    prev = plot.key;
  }
  return plots;
}

test('a plot has one stake for each row and one for each column, and its size comes from the level', () => {
  for (let level = 1; level <= 3; level++) {
    const range = ranges[level - 1];
    for (let i = 0; i < 40; i++) {
      const rng = createRng(i + level * 100);
      const key = rng.pick(factPool(range));
      const plot = makePlot({ key, form: 'product', range, levelData: levelData(level), rng });
      const p = plot.parts[0];
      assert.equal(plot.stakes.rows, p.rows);
      assert.equal(plot.stakes.cols, p.cols);
      const [a, b] = plot.fact;
      assert.ok(a >= range.minA && a <= range.maxA && b >= range.minB && b <= range.maxB, `${a} by ${b} in level ${level}`);
      // At the first level, the farmer plants the first row as an example: the child brings the rest.
      if (level === 1) {
        assert.equal(p.rows, a + 1);
        assert.equal(plot.need, a * b);
        assert.equal(seedbedFor(plot, levelData(1), data.extra).size, b, 'a bundle is one row');
      } else {
        assert.equal(plot.need, a * b);
        assert.equal(seedbedFor(plot, levelData(level), data.extra).size, 10);
      }
    }
  }
});

test('the commit: just right fills every cell; too few leaves the empty cells; too many leaves the extra seedlings', () => {
  const rng = createRng(3);
  const plot = makePlot({ key: factKey(4, 6), form: 'product', range: ranges[2], levelData: levelData(3), rng });
  assert.deepEqual(judge(plot, 24), { result: 'exact', planted: 24, empty: 0, extra: 0, cells: 24 });
  assert.deepEqual(judge(plot, 20), { result: 'few', planted: 20, empty: 4, extra: 0, cells: 24 });
  assert.deepEqual(judge(plot, 30), { result: 'many', planted: 24, empty: 0, extra: 6, cells: 24 });
  // The order of the planting goes row by row.
  const order = plantOrder(plot);
  assert.equal(order.length, 24);
  assert.ok(order.every((c, i) => i === 0 || c.z > order[i - 1].z || (c.z === order[i - 1].z && c.x > order[i - 1].x)));
  // A plot with planted rows: the child brings only the rest.
  const rest = makePlot({ key: factKey(3, 5), form: 'rest', range: ranges[2], levelData: levelData(3), rng });
  assert.equal(rest.need, rest.cells - rest.pre);
  assert.equal(rest.need, 15);
  // A choose plot: the tap on the plot that the bundles fill.
  const choose = makePlot({ key: factKey(3, 7), form: 'choose', range: ranges[2], levelData: levelData(3), rng });
  assert.equal(judgeChoice(choose, 'plot').result, 'exact');
  assert.notEqual(judgeChoice(choose, 'decoy').result, 'exact');
});

test('two plots side by side: the sum of both is the product of the whole', () => {
  for (const [a, b] of [[7, 8], [6, 9], [3, 7], [9, 6]]) {
    const rng = createRng(a * b);
    const plot = makePlot({ key: factKey(a, b), form: 'split', range: ranges[2], levelData: levelData(3), rng });
    assert.equal(plot.parts.length, 2);
    assert.equal(plot.parts[0].cols, 5, 'five columns and the rest');
    assert.equal(plot.parts[0].rows * plot.parts[0].cols + plot.parts[1].rows * plot.parts[1].cols, a * b);
    assert.ok(plot.parts[1].x > plot.parts[0].x + plot.parts[0].cols, 'a path between the plots');
    assert.equal(judge(plot, a * b).result, 'exact');
  }
});

test('the other way: the plot is full only when the row stakes give the bundles divided by the columns', () => {
  const rng = createRng(11);
  const plot = makePlot({ key: factKey(6, 7), form: 'divide', range: ranges[2], levelData: levelData(3), rng });
  const cols = plot.parts[0].cols;
  assert.equal(plot.given, 42);
  assert.notEqual(plot.rowsStart * cols, 42, 'the stakes start wrong');
  for (let rows = 1; rows <= 12; rows++) {
    const r = judge(plot, rows).result;
    assert.equal(r === 'exact', rows * cols === 42, `${rows} rows`);
  }
});

test('a fact and its turned fact are one fact', () => {
  assert.equal(factKey(3, 7), factKey(7, 3));
  const mem = {};
  recordFact(mem, factKey(7, 3), { ok: true, day: 1, set: 1, index: 0, form: 'product' }, data);
  recordFact(mem, factKey(3, 7), { ok: true, day: 2, set: 1, index: 1, form: 'turned' }, data);
  assert.deepEqual(Object.keys(mem), ['3x7']);
  assert.equal(mem['3x7'].n, 2);
  assert.equal(factState(mem['3x7']), 'getting');
  assert.equal(factTable(mem)[6][2], 'getting');
  assert.equal(factTable(mem)[2][6], 'getting');
  assert.equal(factTable(mem)[0][0], null);
});

test('a missed fact comes back sooner than a known one, in another form', () => {
  const mem = {};
  const pool = factPool(ranges[2]);
  // A known fact, due in seven days, and a fact missed at the second plot of the set.
  recordFact(mem, '6x8', { ok: true, day: 10, set: 1, index: 0, form: 'product' }, data);
  recordFact(mem, '6x8', { ok: true, day: 10, set: 1, index: 0, form: 'product' }, data);
  recordFact(mem, '7x9', { ok: false, day: 10, set: 1, index: 1, form: 'product' }, data);
  const rng = createRng(1);
  // At the fourth plot (after two more plots), the missed fact comes back.
  assert.equal(chooseFact({ pool, mem, day: 10, set: 1, index: 3, prev: '2x3' }, rng), '7x9');
  assert.ok(mem['6x8'].due > 10, 'the known fact is due later');
  // Its form is another one.
  const form = chooseForm({ forms: levelData(3).forms, used: ['product', 'rest', 'split'], avoid: mem['7x9'].again.form }, rng);
  assert.notEqual(form, 'product');
  // Over many sets, a missed fact comes back within the set, and a known fact does not come back
  // in the same set.
  for (let seed = 1; seed <= 20; seed++) {
    const m = {};
    let missed = null;
    const plots = playSet({ mem: m, set: 1, level: 3, seed, ok: (i, p) => { if (i === 1) { missed = p.key; return false; } return true; } });
    const later = plots.slice(2).map((p) => p.key);
    assert.ok(later.includes(missed), `seed ${seed}: ${missed} comes back`);
  }
});

test('two plots of the same table never come one after another', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (const level of [1, 2, 3]) {
      const mem = {};
      for (let set = 1; set <= 3; set++) {
        const plots = playSet({ mem, set, level, seed, day: set * 2, ok: (i) => (i + seed) % 3 !== 0 });
        for (let i = 1; i < plots.length; i++) {
          const a = plots[i - 1].key.split('x').map(Number).filter((n) => n > 1);
          const b = plots[i].key.split('x').map(Number).filter((n) => n > 1);
          assert.ok(!a.some((n) => b.includes(n)), `seed ${seed} level ${level}: ${plots[i - 1].key} then ${plots[i].key}`);
        }
      }
    }
  }
});

test('over a set at a high level, at least three forms come, and no form comes three times in a row', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const mem = {};
    // A child who met many facts before, so that turned plots can come.
    for (const k of factPool(ranges[2])) recordFact(mem, k, { ok: true, day: 1, set: 0, index: 0, form: 'product' }, data);
    const plots = playSet({ mem, set: 1, level: 3, seed, day: 2, divideOpen: true });
    const forms = plots.map((p) => p.form);
    assert.ok(new Set(forms).size >= 3, `seed ${seed}: ${forms}`);
    for (let i = 2; i < forms.length; i++) assert.ok(!(forms[i] === forms[i - 1] && forms[i] === forms[i - 2]), `seed ${seed}: ${forms}`);
  }
});

test('a set starts with a sure fact, and the child chooses between plots of the band', () => {
  const mem = {};
  recordFact(mem, '2x5', { ok: true, day: 1, set: 0, index: 0, form: 'product' }, data);
  recordFact(mem, '2x5', { ok: true, day: 1, set: 0, index: 0, form: 'product' }, data);
  recordFact(mem, '3x4', { ok: false, day: 1, set: 0, index: 0, form: 'product' }, data);
  const { offers } = nextOffers({ data, level: 2, ranges, mem, day: 3, set: 1, index: 0, prev: null, seed: 5 });
  assert.equal(offers[0].key, '2x5', 'the first plot is the surest fact');
  assert.ok(offers.length >= 2, 'more than one plot is ready');
  const big = offers.find((p) => p.bigger);
  assert.ok(big, 'a bigger plot is on offer at level two');
  assert.ok(big.need > 30);
});

test('at most one event in a set, never the same in two sets in a row', () => {
  let last = null;
  let some = 0;
  for (let set = 1; set <= 200; set++) {
    const ev = eventOf(9, set, last, data);
    if (ev) {
      some += 1;
      assert.notEqual(ev.kind, last, `set ${set}`);
      assert.ok(ev.at >= 1 && ev.at < data.set);
    }
    last = ev?.kind ?? null;
  }
  assert.ok(some > 50 && some < 200, `${some} sets with an event`);
});

test('everything is the same for the same seed and the same history', () => {
  const a = playSet({ mem: {}, set: 1, level: 3, seed: 21, ok: (i) => i !== 2 });
  const b = playSet({ mem: {}, set: 1, level: 3, seed: 21, ok: (i) => i !== 2 });
  assert.deepEqual(a, b);
  const c = playSet({ mem: {}, set: 1, level: 3, seed: 22, ok: (i) => i !== 2 });
  assert.notDeepEqual(a.map((p) => p.key), c.map((p) => p.key));
  assert.deepEqual(eventOf(4, 3, null, data), eventOf(4, 3, null, data));
});

test('a planted plot grows on the next days, and a new plot finds a free place in the field', () => {
  assert.equal(stageOf(5, 5, data.growth), 'planted');
  assert.equal(stageOf(5, 6, data.growth), 'green');
  assert.equal(stageOf(5, 9, data.growth), 'tall');
  assert.equal(stageOf(5, 12, data.growth), 'gold');
  const field = { x0: 0, z0: 0, x1: 30, z1: 20 };
  const first = placeIn(field, [], 8, 6);
  assert.deepEqual(first, { x: 0, z: 0 });
  const second = placeIn(field, [{ ...first, w: 8, h: 6 }], 8, 6);
  assert.ok(second.x >= 9 || second.z >= 7);
  assert.equal(placeIn(field, [{ x: 0, z: 0, w: 30, h: 20 }], 8, 6), null);
});
