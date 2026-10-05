// The folk games of the village children (#30): the court of nhảy lò cò, the throw, the hops (count
// on, over the shard, a line), and the rope of nhảy dây by groups (src/core/folkgames.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courtPlan, courtOf, callSquare, throwPlace, judgeThrow, createHops, hop, saidNumbers, ropePlan, createRope, stepRope, jumpRope, chantOf } from '../src/core/folkgames.js';
import { createRng } from '../src/core/rng.js';
import { load } from './helpers.js';

const data = load('data/world/folkgames.json');
const L = data.loCo;
const R = data.rope;

test('the court: ten squares in the Vietnamese order, 1 to 5 up and 6 to 10 down, and the courts of the other levels', () => {
  const court = courtOf({ start: 1, step: 1, squares: 10 });
  assert.deepEqual(court.map((s) => s.value), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(court.map((s) => [s.side, s.row]), [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [1, 3], [1, 2], [1, 1], [1, 0]]);
  // A start number, and steps of 2, 5, 10, 3, and 4.
  assert.deepEqual(courtOf({ start: 36, step: 1, squares: 10 }).map((s) => s.value).slice(0, 5), [36, 37, 38, 39, 40]);
  assert.deepEqual(courtOf({ start: 10, step: 10, squares: 10 }).map((s) => s.value).at(-1), 100);
  assert.deepEqual(courtOf({ start: 3, step: 3, squares: 12 }).map((s) => s.value).at(-1), 36);
  const steps = new Set();
  for (const [skill, list] of Object.entries(L.levels)) {
    for (const c of list) steps.add(c.step);
    for (let seed = 1; seed < 30; seed++) {
      const plan = courtPlan(L.levels, skill, createRng(seed));
      const top = courtOf(plan).at(-1).value;
      assert.ok(top <= 150, `${skill}: ${top} has a word in num.*`);
    }
  }
  assert.deepEqual([...steps].sort((a, b) => a - b), [1, 2, 3, 4, 5, 10]);
});

test('the throw: the longer the hold, the farther the shard; in the called square, on a line, or out', () => {
  const court = courtOf({ start: 1, step: 1, squares: 10 });
  const at = (sq) => (sq + 0.5) / L.rate;
  assert.deepEqual(judgeThrow(court, 6, throwPlace(at(6), L), L), { result: 'in', square: 6 });
  assert.deepEqual(judgeThrow(court, 6, throwPlace(at(4), L), L), { result: 'other', square: 4 });
  assert.equal(judgeThrow(court, 6, 6.02, L).result, 'line');
  assert.equal(judgeThrow(court, 6, 10.5, L).result, 'out');
  assert.equal(judgeThrow(court, 6, 0, L).result, 'out');
  assert.ok(throwPlace(2, L) > throwPlace(1, L));
  // The called square is never the last one, and "two more than five" names a square before it.
  for (let seed = 1; seed < 40; seed++) {
    const c = callSquare(court, createRng(seed), 3, true);
    assert.ok(c.square < 9 && c.square !== 3);
    if (c.base !== null) assert.equal(c.base + c.more, c.square);
  }
});

// Hops at a calm pace (one each second); long: the presses that are long.
function play(court, shard, presses) {
  const st = createHops(court, shard);
  const events = [];
  presses.forEach((p, i) => events.push(...hop(st, { long: p === 'long', time: typeof p === 'number' ? p : i + 1 }, L)));
  return { st, events };
}

test('the children say the numbers of the squares where the hero lands (count on), and the hero hops over the shard there and back', () => {
  const court = courtOf({ start: 36, step: 1, squares: 10 });
  // The shard on the third square (38): one hop, then a long hop over it.
  const presses = ['hop', 'hop', 'long', ...Array(7).fill('hop')];
  // The way back: down to the square before the shard, a pick, then a long hop over it and home.
  const { st, events } = play(court, 2, [...presses, ...Array(7).fill('hop'), 'long', 'hop', 'hop']);
  assert.equal(st.end, 'home', JSON.stringify(events.slice(-3)));
  assert.deepEqual(saidNumbers(st).slice(0, 4), [36, 37, 39, 40], 'count on past the shard, never from one');
  assert.ok(!saidNumbers(st).includes(38), 'never the square of the shard');
  assert.ok(events.some((e) => e.type === 'rest') && events.some((e) => e.type === 'pick'));
  assert.ok(events.findIndex((e) => e.type === 'pick') < events.findIndex((e) => e.type === 'home'));
  assert.deepEqual(events.filter((e) => e.type === 'land').map((e) => e.value), saidNumbers(st));
});

test('a landing on the shard, a press before the hero stands (a line), or a long hop over a square with no shard ends the turn, with no loss', () => {
  const court = courtOf({ start: 1, step: 1, squares: 10 });
  assert.equal(play(court, 2, ['hop', 'hop', 'hop']).st.end, 'shard');
  assert.equal(play(court, 5, [1, 1.1]).st.end, 'line');
  assert.equal(play(court, 5, ['hop', 'long']).st.end, 'skip');
  const { st } = play(court, 5, ['hop', 'hop', 'hop']);
  assert.equal(st.end, null, 'the turn goes on');
  assert.deepEqual(hop(createHops(court, 0), { long: true, time: 1 }, L)[0], { type: 'land', square: 1, value: 2 }, 'over the first square from the start line');
});

test('the rope: a jump on the beat counts one group, a miss stops the rope and the count stays; the chant goes by groups', () => {
  const plan = { group: 5, to: 10, target: 50 };
  assert.deepEqual(chantOf(plan).slice(0, 4), [5, 10, 15, 20]);
  const st = createRope(plan, 1);
  const run = (seconds) => { const out = []; for (let i = 0; i < Math.round(seconds * 100); i++) out.push(...stepRope(st, 0.01, R)); return out; };
  run(1);
  assert.deepEqual(jumpRope(st, R), [{ type: 'count', count: 5 }]);
  run(1);
  assert.deepEqual(jumpRope(st, R), [{ type: 'count', count: 10 }]);
  // A jump between two beats: a miss; the count stays at ten.
  run(0.5);
  assert.deepEqual(jumpRope(st, R), [{ type: 'miss', count: 10 }]);
  assert.ok(st.period > 1, 'the rope turns a little slower');
  // No jump at a beat with the hero in the rope: a miss too.
  const settle = () => { while (st.wait > 0) stepRope(st, 0.01, R); };
  const toBeat = () => { settle(); const k = Math.floor(st.time / st.period); while (Math.floor(st.time / st.period) === k) stepRope(st, 0.01, R); };
  toBeat();
  assert.deepEqual(jumpRope(st, R), [{ type: 'count', count: 15 }]);
  const missed = run(st.period * 1.5).filter((e) => e.type === 'miss');
  assert.deepEqual(missed, [{ type: 'miss', count: 15 }]);
  assert.equal(st.misses, 2);
  // The rest of the round, on the beat.
  let last = [];
  for (let k = 0; k < 7; k++) { toBeat(); last = jumpRope(st, R); }
  assert.deepEqual(last, [{ type: 'count', count: 50 }, { type: 'done', clean: false }]);
  // The levels: twos, fives, tens, then threes, fours, and more.
  const groups = new Set(Object.values(R.levels).flat().map((r) => r.group));
  assert.deepEqual([...groups].sort((a, b) => a - b), [2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const skill of Object.keys(R.levels)) assert.ok(ropePlan(R.levels, skill, createRng(3)).target <= 150, skill);
});
