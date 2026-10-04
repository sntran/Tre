import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextTask, duckTask, scoopsOf, judgePour, trapTask, trapPool, judgeTraps, drumTask, createDance, stepDance, tapDance, newTable, feedDucks, dawnTable, feastReady, feastNow, serveFeast, pointTo, hamletEvent, activityRng } from '../src/core/hamlet.js';
import { factKey, factPool, recordFact } from '../src/core/planting.js';
import { createRng } from '../src/core/rng.js';
import { load } from './helpers.js';

const data = load('data/world/hamlet.json');
const planting = load('data/world/planting.json');
const ranges = load('data/skills.json').skills.find((s) => s.id === 'math.mul.10').levels;

test('the ducks: each duck eats its share in turn; too few leaves the last ducks hungry; too much leaves extra feed', () => {
  const task = duckTask({ key: factKey(3, 4), form: 'groups', data: data.ducks, rng: createRng(1) });
  assert.equal(task.ducks.length, 3);
  assert.equal(task.need, 12);
  assert.equal(task.show, 4);
  assert.deepEqual(judgePour(task, 12), { result: 'exact', eaten: [4, 4, 4], hungry: [], extra: 0 });
  assert.deepEqual(judgePour(task, 9), { result: 'few', eaten: [4, 4, 1], hungry: [2], extra: 0 });
  assert.deepEqual(judgePour(task, 3), { result: 'few', eaten: [3, 0, 0], hungry: [0, 1, 2], extra: 0 });
  assert.deepEqual(judgePour(task, 15), { result: 'many', eaten: [4, 4, 4], hungry: [], extra: 3 });
});

test('the pour goes on from where it stopped: the scoops of two pours add up', () => {
  const task = duckTask({ key: factKey(2, 5), form: 'groups', data: data.ducks, rng: createRng(2) });
  // A scoop for each two fifths of a second while the child holds the jar.
  const first = scoopsOf(2.4, data.ducks.rate);
  assert.equal(first, 6);
  assert.equal(judgePour(task, first).result, 'few');
  const second = scoopsOf(1.6, data.ducks.rate);
  assert.equal(judgePour(task, first + second).result, 'exact');
  assert.equal(scoopsOf(0.39, data.ducks.rate), 0);
});

test('the ducks: big ducks eat twice the share that the duck girl shows; a mixed line is the sum of two products', () => {
  for (let i = 0; i < 30; i++) {
    const rng = createRng(i);
    const key = rng.pick(factPool(ranges[2]));
    const double = duckTask({ key, form: 'double', data: data.ducks, rng });
    assert.ok(double.ducks.every((d) => d.big && d.share === double.show * data.ducks.big));
    assert.equal(double.need, double.ducks.reduce((s, d) => s + d.share, 0));
    assert.ok(double.ducks.length <= data.ducks.maxDucks / 2);
    const mixed = duckTask({ key, form: 'mixed', data: data.ducks, rng });
    const kinds = [...new Set(mixed.ducks.map((d) => d.share))].sort((a, b) => a - b);
    assert.deepEqual(kinds, data.ducks.mixed.shares);
    assert.equal(mixed.need, mixed.ducks.reduce((s, d) => s + d.share, 0));
    assert.equal(mixed.facts.length, 2);
    for (const s of data.ducks.mixed.shares) assert.ok(mixed.ducks.filter((d) => d.share === s).length <= data.ducks.mixed.most);
  }
});

test('the traps: the fish of each trap is its size; the extra fish swim on', () => {
  const task = trapTask({ key: factKey(4, 5), form: 'one', data: data.traps, rng: createRng(3) });
  assert.equal(task.need, 20);
  assert.equal(task.skill, 'math.div.10');
  assert.ok(task.pile.every((s) => s === 5));
  assert.ok(task.pile.length > 4, 'the fisher has more traps than the answer needs');
  assert.deepEqual(judgeTraps(task, [5, 5, 5, 5]), { result: 'exact', caught: [5, 5, 5, 5], total: 20, extra: 0 });
  assert.deepEqual(judgeTraps(task, [5, 5, 5]), { result: 'few', caught: [5, 5, 5], total: 15, extra: 0 });
  assert.deepEqual(judgeTraps(task, [5, 5, 5, 5, 5]), { result: 'many', caught: [5, 5, 5, 5, 5], total: 25, extra: 5 });
});

test('the traps of one size use a friendly size (two, five, or ten) at every level', () => {
  for (const range of ranges) {
    const pool = trapPool(factPool(range), data.traps.sizes);
    assert.ok(pool.length);
    for (const key of pool) {
      const task = trapTask({ key, form: 'one', data: data.traps, rng: createRng(4) });
      assert.ok(data.traps.sizes.includes(task.pile[0]), key);
      assert.equal(task.need % task.pile[0], 0);
    }
  }
});

// The ways to make the need from the traps of the pile (counts of each size).
function ways(task) {
  const sizes = [...new Set(task.pile)];
  const have = sizes.map((s) => task.pile.filter((v) => v === s).length);
  let n = 0;
  const go = (i, left) => {
    if (i === sizes.length) { if (left === 0) n++; return; }
    for (let c = 0; c <= have[i] && c * sizes[i] <= left; c++) go(i + 1, left - c * sizes[i]);
  };
  go(0, task.need);
  return n;
}

test('the traps of two sizes: more than one placement is right', () => {
  for (let i = 0; i < 60; i++) {
    const rng = createRng(100 + i);
    const key = rng.pick(factPool(ranges[2]));
    const task = trapTask({ key, form: 'two', data: data.traps, rng });
    assert.equal(new Set(task.pile).size, 2);
    assert.ok(ways(task) >= 2, `${task.need} from ${task.pile}`);
  }
  const task = { need: 27, count: null };
  assert.equal(judgeTraps(task, [5, 5, 5, 5, 5, 2]).result, 'exact');
  assert.equal(judgeTraps(task, [5, 5, 5, 2, 2, 2, 2, 2, 2]).result, 'exact');
});

test('the given traps: the fisher has only so many traps, and the child chooses their sizes', () => {
  for (let i = 0; i < 30; i++) {
    const rng = createRng(200 + i);
    const key = rng.pick(factPool(ranges[2]));
    const task = trapTask({ key, form: 'given', data: data.traps, rng });
    assert.ok(task.count >= 2);
    assert.ok(ways({ ...task, pile: task.pile }) >= 1);
    // The facts are the traps of each size of one right answer.
    const sum = task.facts.reduce((s, k) => s + k.split('x').map(Number).reduce((a, b) => a * b), 0);
    assert.equal(sum, task.need);
  }
  const task = { need: 20, count: 2 };
  assert.equal(judgeTraps(task, [10, 10]).result, 'exact');
  assert.equal(judgeTraps(task, [5, 5, 10]).result, 'many', 'more traps than the fisher has');
});

// Go to a beat of the dance (the drummer beats on).
function to(st, task, beat) {
  const now = st.start + st.time / st.period;
  return stepDance(st, task, (beat - now) * st.period, data.drum);
}

test('the drum: a tap is right only on a multiple of the number of the group', () => {
  const task = drumTask({ key: factKey(2, 3), form: 'one', data: data.drum, rng: createRng(5) });
  assert.deepEqual(task.groups, [3]);
  assert.deepEqual(task.targets, [3, 6, 9, 12, 15, 18, 21, 24, 27, 30]);
  const st = createDance(task, data.drum.period);
  assert.deepEqual(to(st, task, 3).map((e) => e.type), ['beat']);
  assert.equal(tapDance(st, task, 0, data.drum)[0].type, 'jump');
  to(st, task, 4);
  const miss = tapDance(st, task, 0, data.drum);
  assert.equal(miss[0].type, 'miss');
  assert.equal(miss[0].from, 3);
});

test('the drum: a miss starts again from the last good jump, slower', () => {
  const task = drumTask({ key: factKey(3, 4), form: 'one', data: data.drum, rng: createRng(6) });
  assert.deepEqual(task.groups, [4]);
  const st = createDance(task, 1);
  for (const b of [4, 8, 12]) {
    to(st, task, b);
    assert.equal(tapDance(st, task, 0, data.drum)[0].type, 'jump', `beat ${b}`);
  }
  // No tap on sixteen: the beat passes, and the dance starts again from twelve.
  const events = to(st, task, 17);
  const miss = events.find((e) => e.type === 'miss');
  assert.equal(miss.beat, 16);
  assert.equal(miss.from, 12);
  assert.deepEqual(st.hit, [4, 8, 12]);
  assert.ok(Math.abs(st.period - data.drum.slower) < 1e-9);
  assert.equal(st.start, 12);
  // The drummer beats from twelve again; the child taps on sixteen.
  to(st, task, 16);
  assert.equal(tapDance(st, task, 0, data.drum)[0].type, 'jump');
  // A tap a little after the beat, in the window, counts for the beat.
  to(st, task, 20 + data.drum.window / 2);
  assert.equal(tapDance(st, task, 0, data.drum)[0].type, 'jump');
});

test('the drum: a clean run ends a little faster, never faster than the fastest', () => {
  const task = drumTask({ key: factKey(2, 2), form: 'middle', data: data.drum, rng: createRng(7) });
  assert.equal(task.targets[0], data.drum.from * 2);
  const st = createDance(task, data.drum.fastest);
  let last = [];
  for (const b of task.targets) {
    to(st, task, b);
    last = tapDance(st, task, 0, data.drum);
  }
  assert.deepEqual(last.map((e) => e.type), ['jump', 'done']);
  assert.equal(last[1].clean, true);
  assert.equal(st.period, data.drum.fastest);
  const slow = createDance(task, 1);
  for (const b of task.targets) { to(slow, task, b); tapDance(slow, task, 0, data.drum); }
  assert.ok(Math.abs(slow.period - data.drum.faster) < 1e-9);
  assert.deepEqual(stepDance(slow, task, 1, data.drum), []);
});

test('the drum: two groups jump together on the common multiples', () => {
  const task = drumTask({ key: factKey(3, 4), form: 'two', data: data.drum, rng: createRng(8) });
  assert.deepEqual(task.groups, [4, 3]);
  assert.deepEqual(task.targets, [3, 4, 6, 8, 9, 12, 15, 16, 18, 20, 21, 24, 27, 28, 30]);
  const st = createDance(task, 1);
  to(st, task, 3);
  // Three is the beat of the second group: the first drum is wrong.
  assert.equal(tapDance(st, task, 0, data.drum)[0].type, 'miss');
  to(st, task, 3);
  assert.equal(tapDance(st, task, 1, data.drum)[0].type, 'jump');
  for (const [b, drum] of [[4, 0], [6, 1], [8, 0], [9, 1]]) {
    to(st, task, b);
    assert.equal(tapDance(st, task, drum, data.drum)[0].type, 'jump', `beat ${b}`);
  }
  to(st, task, 12);
  const both = tapDance(st, task, 0, data.drum)[0];
  assert.equal(both.type, 'jump');
  assert.deepEqual(both.groups, [0, 1]);
});

test('the feast: the eggs come the morning after a feeding, and the feast comes only at dusk of a day with all three', () => {
  const table = newTable();
  feedDucks(table, 3, 5);
  feedDucks(table, 2, 5);
  dawnTable(table, 5);
  assert.equal(table.eggs, 0, 'no eggs on the day of the feeding');
  dawnTable(table, 6);
  assert.equal(table.eggs, 5);
  assert.equal(feastReady(table), false);
  table.fish += 20;
  assert.equal(feastNow(table, 19, 6, data.feast), false, 'no new rice');
  table.sheaves += 2;
  assert.equal(feastNow(table, 12, 6, data.feast), false, 'not at noon');
  assert.equal(feastNow(table, data.feast.hour, 6, data.feast), true);
  serveFeast(table, 6);
  assert.deepEqual([table.eggs, table.fish, table.sheaves], [0, 0, 0]);
  assert.equal(feastNow(table, 19, 6, data.feast), false);
});

test('one memory: a fact missed in the planting comes back soon in the ducks, and the people point away from the planting', () => {
  const mem = {};
  const key = factKey(3, 7);
  recordFact(mem, key, { ok: false, day: 4, set: 0, index: 1, form: 'product', round: 10, activity: 'planting' }, planting);
  const range = ranges[2];
  let found = -1;
  for (let i = 0; i < 4; i++) {
    const t = nextTask({ range, forms: data.ducks.levels[0].forms, mem, day: 4, index: i, round: 11 + i, prev: null, used: [] }, activityRng(9, 'ducks', i));
    if (t.key === key) { found = i; break; }
  }
  assert.ok(found >= 0 && found <= planting.again, `the fact came back at ${found}`);
  const to = pointTo(mem, {}, 'drum', ['planting', 'ducks', 'traps', 'drum']);
  assert.ok(to !== 'planting' && to !== 'drum');
  // With no missed fact, the people point to the station that the child played least.
  assert.equal(pointTo({}, { planting: 3, ducks: 1, traps: 0, drum: 2 }, 'ducks', ['planting', 'ducks', 'traps', 'drum']), 'traps');
});

test('a small event: at most one in a set, never the same in two sets in a row', () => {
  for (const activity of ['ducks', 'traps', 'drum']) {
    let last = null;
    for (let set = 0; set < 20; set++) {
      const e = hamletEvent(1, activity, set, last, data);
      if (e) assert.notEqual(e, last);
      last = e;
    }
  }
});
