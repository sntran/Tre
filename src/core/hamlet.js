// The activities of Xóm Ruộng after the planting: feeding the ducks, the fish traps, and the drum
// dance, and the feast of the new rice that links them (data/world/hamlet.json; docs/HAMLET.md).
// Pure functions, no DOM. Each activity takes a fact of the table from the one memory of the facts
// (src/core/planting.js) and shows it in its own picture:
//   ducks: equal groups (each duck eats the same number of scoops);
//   traps: a missing factor (how many traps of a size make the fish of the feast);
//   drum: skip counting (the dancers of a group jump on the multiples of their number).

import { createRng, hashSeed } from './rng.js';
import { factPool, chooseFact, chooseForm, factKey } from './planting.js';

const factorsOf = (key) => key.split('x').map(Number);
export const activityRng = (seed, activity, n, salt = '') => createRng(hashSeed(`${seed}:${activity}:${n}${salt}`));

// The fact and the form of the next task of an activity. ctx: { range (the factor range of the
// level), pool (optional: the facts that the activity can show), forms (of the level), mem, day,
// index (the task of this set), round (the round of all the activities), prev (the key of the last
// task), used (the forms of this set), counts, not (keys to leave out), form (optional: the form,
// when the activity chose it first) }.
export function nextTask(ctx, rng) {
  const pool = ctx.pool ?? factPool(ctx.range);
  const key = chooseFact({ pool, mem: ctx.mem, day: ctx.day, set: null, index: ctx.index ?? 0, round: ctx.round, prev: ctx.prev, hard: ctx.hard ?? 0, not: ctx.not ?? [] }, rng);
  const form = ctx.form ?? ((ctx.used ?? []).length === 0 ? ctx.forms[0] : chooseForm({ forms: ctx.forms, used: ctx.used, counts: ctx.counts ?? {}, avoid: ctx.mem[key]?.again?.form ?? null }, rng));
  return { key, form };
}

// ---------------------------------------------------------------- Feeding the ducks
// A line of ducks along a trough. Each duck eats its share (scoops). Forms:
//   groups: a ducks, b scoops each (a × b);
//   double: big ducks eat twice what a small duck eats (the duck girl shows the small share; at
//     most half a line of ducks);
//   mixed: two kinds of ducks in one line (some eat two, some eat five: the sum of two products).
// Return { form, ducks: [{ share, big }], need, show (the share that the duck girl shows), facts }.
export function duckTask({ key, form, data, rng }) {
  let [a, b] = factorsOf(key);
  if (a > data.maxDucks) [a, b] = [b, a];
  if (form === 'double') {
    // At most half the line of ducks, so that the pour is not too long.
    const n = Math.max(1, Math.min(a, Math.floor(data.maxDucks / 2)));
    const small = Math.max(1, Math.min(b, Math.floor(10 / data.big)));
    const ducks = Array.from({ length: n }, () => ({ share: small * data.big, big: true }));
    return { form, ducks, need: n * small * data.big, show: small, facts: [factKey(n, small * data.big)] };
  }
  if (form === 'mixed') {
    const [s1, s2] = data.mixed.shares;
    const p = Math.max(1, Math.min(data.mixed.most, a));
    const q = Math.max(1, Math.min(data.mixed.most, rng.int(1, Math.max(1, b))));
    const ducks = [...Array.from({ length: p }, () => ({ share: s1, big: false })), ...Array.from({ length: q }, () => ({ share: s2, big: true }))];
    return { form, ducks, need: p * s1 + q * s2, show: s1, facts: [factKey(p, s1), factKey(q, s2)] };
  }
  const ducks = Array.from({ length: a }, () => ({ share: b, big: false }));
  return { form: 'groups', ducks, need: a * b, show: b, facts: [factKey(a, b)] };
}

// The scoops of a pour of so many seconds (one scoop each 1 / rate seconds).
export const scoopsOf = (seconds, rate) => Math.floor(seconds * rate + 1e-9);

// The ducks eat in turn from the feed in the trough. poured: all the scoops of the task so far (a
// pour goes on from where it stopped). Return { result, eaten: [n of each duck], hungry: [index],
// extra }.
export function judgePour(task, poured) {
  let left = poured;
  const eaten = task.ducks.map((d) => {
    const n = Math.min(d.share, left);
    left -= n;
    return n;
  });
  const hungry = eaten.map((n, i) => (n < task.ducks[i].share ? i : -1)).filter((i) => i >= 0);
  const extra = Math.max(0, poured - task.need);
  const result = poured === task.need ? 'exact' : poured < task.need ? 'few' : 'many';
  return { result, eaten, hungry, extra };
}

// ---------------------------------------------------------------- The fish traps
// The fisher uncle says the fish that the feast needs. Traps of sizes (the rings on a trap: the
// fish that it catches). Forms:
//   one: traps of one size (a missing factor: the feast needs k × s fish, the traps catch s);
//   two: traps of two sizes (more than one placement can be right);
//   given: the fisher has only so many traps, and the child chooses their sizes.
// Return { form, need, pile: [size, ...] (the traps by the fisher), count (given: the traps that
// he has, else null), facts, skill }.
export function trapTask({ key, form, data, rng }) {
  const [a, b] = factorsOf(key);
  const sizes = data.sizes;
  if (form === 'two') {
    // A big and a small size; the need is some big traps and some small ones.
    const [small, big] = rng.pick([[2, 5], [5, 10], [2, 10]]);
    // At least two big traps, so that small traps can take the place of a big one.
    const x = Math.max(2, Math.min(a, 9));
    const y = rng.int(1, Math.max(1, Math.floor(big / small) - 1));
    const need = x * big + y * small;
    const pile = [...Array(x + data.extra).fill(big), ...Array(Math.ceil(need / small) + 1).fill(small)].slice(0, 24);
    return { form, need, pile, count: null, facts: [factKey(x, big)], skill: 'math.mul.10' };
  }
  if (form === 'given') {
    const c = Math.max(2, Math.min(b, 6));
    const chosen = Array.from({ length: c }, () => rng.pick(sizes));
    const need = chosen.reduce((s, v) => s + v, 0);
    const pile = sizes.flatMap((s) => Array(c).fill(s));
    return { form, need, pile, count: c, facts: chosen.filter((v, i, l) => l.indexOf(v) === i).map((v) => factKey(chosen.filter((w) => w === v).length, v)), skill: 'math.mul.10' };
  }
  // One size: a friendly size (two, five, or ten); the other factor is the count of traps.
  const s = sizes.includes(b) ? b : sizes.includes(a) ? a : rng.pick(sizes);
  const k = s === b ? a : s === a ? b : Math.max(2, Math.min(a, 10));
  return { form: 'one', need: k * s, pile: Array(k + data.extra).fill(s), count: null, facts: [factKey(k, s)], skill: 'math.div.10' };
}

// The facts of a pool that the traps of one size can show: a factor is a friendly size (two, five,
// or ten). With no such fact, the facts of the friendly sizes from two to ten.
export function trapPool(pool, sizes) {
  const friendly = pool.filter((k) => factorsOf(k).some((n) => sizes.includes(n)));
  if (friendly.length) return friendly;
  return [...new Set(sizes.flatMap((s) => Array.from({ length: 9 }, (_, i) => factKey(i + 2, s))))];
}

// The fish swim down into the traps. sizes: the sizes of the traps in the stream. Each trap fills
// with its number of fish; the fisher keeps the fish of the feast, and the extra fish swim on.
// Return { result, caught: [n of each trap], total, extra }.
export function judgeTraps(task, sizes) {
  const total = sizes.reduce((s, v) => s + v, 0);
  const over = task.count !== null && sizes.length > task.count;
  const result = total === task.need && !over ? 'exact' : total < task.need ? 'few' : 'many';
  return { result, caught: sizes.slice(), total, extra: Math.max(0, total - task.need) };
}

// ---------------------------------------------------------------- The drum dance
// The dancers of a group jump on the multiples of their number; the child taps the bronze drum on
// those beats. Forms:
//   one: the multiples of one number, from one time to ten times;
//   middle: the multiples from five times the number;
//   two: two groups at once, each with its drum; on a common multiple a tap on either drum makes
//     both groups jump together.
// Return { form, groups: [n] (one or two), from, to (the times), targets: [beat], facts }.
export function drumTask({ key, form, data, rng }) {
  const [a, b] = factorsOf(key);
  const n = Math.max(2, Math.max(a, b) <= 10 ? Math.max(a, b) : a);
  if (form === 'two') {
    const others = [2, 3, 4, 5, 6].filter((m) => m !== n && m !== Math.min(a, b));
    const m = Math.min(a, b) !== n && Math.min(a, b) >= 2 ? Math.min(a, b) : rng.pick(others);
    const top = Math.min(n, m) * data.to;
    const targets = [...new Set([...multiples(n, 1, top), ...multiples(m, 1, top)])].sort((x, y) => x - y);
    return { form, groups: [n, m], from: 1, to: data.to, targets, facts: [factKey(n, m)] };
  }
  const from = form === 'middle' ? data.from : 1;
  const targets = Array.from({ length: data.to - from + 1 }, (_, i) => (from + i) * n);
  return { form, groups: [n], from, to: data.to, targets, facts: targets.map((t) => factKey(t / n, n)) };
}
const multiples = (n, from, top) => Array.from({ length: Math.floor(top / n) - from + 1 }, (_, i) => (from + i) * n);

// The state of a dance: the time from the start (seconds), the period of a beat, the first beat
// (the drummer starts one beat before the first target, or at the last good jump after a miss),
// the targets that the child hit, and the last good jump.
export function createDance(task, period) {
  const first = task.targets[0];
  return { time: 0, period, start: first - 1, hit: [], last: null, misses: 0, run: 0, done: false, jumps: [] };
}
const beatAt = (st, time) => st.start + time / st.period;

// One step of the dance: a target beat that passes its window with no tap is a miss. Return the
// events: { type: 'beat', beat }, { type: 'miss', beat }, and { type: 'done' }.
export function stepDance(st, task, dt, data) {
  if (st.done) return [];
  const out = [];
  const before = Math.floor(beatAt(st, st.time));
  st.time += dt;
  const now = beatAt(st, st.time);
  for (let k = before + 1; k <= Math.floor(now); k++) out.push({ type: 'beat', beat: k });
  const missed = task.targets.find((t) => !st.hit.includes(t) && now > t + data.window);
  if (missed !== undefined) out.push(...miss(st, task, missed, data));
  return out;
}

// A tap on a drum (0 or 1). Right only on a beat (within the window) that is a target of the group
// of that drum and that the child did not hit yet. Return the events: { type: 'jump', beat, groups }
// or { type: 'miss', beat }, and { type: 'done' } at the end.
export function tapDance(st, task, drum, data) {
  if (st.done) return [];
  const b = beatAt(st, st.time);
  const k = Math.round(b);
  const groups = task.groups.map((n, i) => (k % n === 0 ? i : -1)).filter((i) => i >= 0);
  const mine = task.groups.length === 1 ? groups.includes(0) : groups.includes(drum) || (groups.length === 2);
  const ok = Math.abs(b - k) <= data.window && task.targets.includes(k) && !st.hit.includes(k) && mine
    && task.targets.filter((t) => t < k).every((t) => st.hit.includes(t));
  if (!ok) return miss(st, task, k, data);
  st.hit.push(k);
  st.last = k;
  st.run += 1;
  st.jumps.push(k);
  const out = [{ type: 'jump', beat: k, groups }];
  if (task.targets.every((t) => st.hit.includes(t))) {
    st.done = true;
    // A clean run: the next dance is a little faster, but never faster than the fastest.
    if (st.misses === 0) st.period = Math.max(data.fastest, st.period * data.faster);
    out.push({ type: 'done', clean: st.misses === 0 });
  }
  return out;
}

// A miss: the dancers stop with a laugh, and the drummer starts again from the last good jump, a
// little slower. The hits up to the last good jump stay.
function miss(st, task, beat, data) {
  st.misses += 1;
  st.run = 0;
  st.period *= data.slower;
  const from = st.last ?? task.targets[0] - 1;
  st.hit = st.hit.filter((t) => t <= from);
  st.start = from;
  st.time = 0;
  return [{ type: 'miss', beat, from }];
}

// ---------------------------------------------------------------- The feast of the new rice
// The table of the feast: eggs (the ducks lay them the morning after a feeding), fish (the traps),
// and sheaves of the new rice (one for each plot that the child planted).
export const newTable = () => ({ eggs: 0, fish: 0, sheaves: 0, laying: null, feast: null });

// The ducks that ate lay their eggs at the next dawn.
export function feedDucks(table, n, day) {
  table.laying = { day, n: (table.laying?.day === day ? table.laying.n : 0) + n };
  return table;
}

// At dawn: the eggs of the ducks of yesterday go to the table.
export function dawnTable(table, day) {
  if (table.laying && day > table.laying.day) {
    table.eggs += table.laying.n;
    table.laying = null;
  }
  return table;
}

// The feast comes at dusk of a day when the table has eggs, fish, and new rice.
export const feastReady = (table) => table.eggs > 0 && table.fish > 0 && table.sheaves > 0;
export const feastNow = (table, hour, day, data) => feastReady(table) && hour >= data.hour && table.feast !== day;

// After a feast the table is empty again.
export function serveFeast(table, day) {
  Object.assign(table, { eggs: 0, fish: 0, sheaves: 0, feast: day });
  return table;
}

// ---------------------------------------------------------------- The people point to each other
// The station that a person points to: the one whose picture the memory of the facts wants next (a
// fact missed in one activity comes back in another one), else the one that the child played least,
// and never the station of the person who speaks. Return an activity id.
export function pointTo(mem, plays, here, activities) {
  const others = activities.filter((a) => a !== here);
  const missed = Object.values(mem).filter((e) => e.again?.activity).sort((x, y) => (x.again.round ?? 0) - (y.again.round ?? 0));
  if (missed.length) {
    const from = missed[0].again.activity;
    const pick = others.find((a) => a !== from);
    if (pick) return pick;
  }
  return others.slice().sort((x, y) => (plays[x] ?? 0) - (plays[y] ?? 0))[0];
}

// The small event of a set of an activity (at most one in a set, never the same in two sets in a row).
export function hamletEvent(seed, activity, set, last, data) {
  const rng = createRng(hashSeed(`${seed}:hamlet-event:${activity}:${set}`));
  const kinds = (data.events[activity] ?? []).filter((e) => e !== last);
  if (!kinds.length || !rng.chance(data.chance)) return null;
  return rng.pick(kinds);
}
