// The small events of each day: a cart stuck on the road, a flood on a field, a market day, a lost
// duck (data/world/events.json). Pure rules: which events come on a day and where, the level of the
// work from the skill model, the things of the work, and the answer of a commit. The work itself
// is the task "exact" of the work system (systems/work.js).
import { createRng, hashSeed } from '../rng.js';

// The game day of a clock (minutes).
export const dayOf = (minutes) => Math.floor(minutes / 1440);

// The events of a day on a map: [{ id, at: [x, y] (map cells) }]. defs: data/world/events.json.
// spots: the spots of the map by kind ({ road: [[x, y]], field, wetfield, yard }). wet: a rain fell
// today (and it is over) or yesterday. One event of each kind at most, and never two events at one
// spot. An event with `every` comes on fixed days: each spot (each hamlet) gets its day from the
// seed and its cell, one day in `every`, so that a child can learn when its market comes. An event with
// `after: "rain"` comes only when the land is wet.
export function eventsOfDay(defs, { seed, day, map, spots = {}, wet = false }) {
  const out = [];
  const used = new Set();
  for (const def of defs.events) {
    if (def.after === 'rain' && !wet) continue;
    const rng = createRng(hashSeed(`${seed}:event:${def.id}:${map}:${day}`));
    let free = (spots[def.where] ?? []).filter((p) => !used.has(`${p[0]},${p[1]}`));
    if (def.every) free = free.filter((p) => isEventDay(def, seed, day, p));
    else if (!rng.chance(def.chance ?? 0)) continue;
    if (!free.length) continue;
    const at = rng.pick(free);
    used.add(`${at[0]},${at[1]}`);
    out.push({ id: def.id, at: [at[0], at[1]] });
  }
  return out;
}

// Is a day the day of an event with `every` at a spot (a market at the yard of a hamlet)? The day
// comes from the seed and the cell of the spot only, so that a hamlet keeps its market day.
export function isEventDay(def, seed, day, [x, y]) {
  return (day + hashSeed(`${seed}:day:${def.id}:${x},${y}`)) % def.every === 0;
}

// An event does not come at its spot of yesterday: it comes at the next spot of its kind (of the
// other spots that the day found), or not today. list: the events to place ({ id, at }); found: all
// the events of the day near the hero, the nearest first; last(id): the spot of the event on its
// last day ("day:x,y"), or undefined; fixed(id): an event that keeps its spot (a market).
export function notAgain(list, found, day, last, fixed = () => false) {
  const key = (at) => `${at[0]},${at[1]}`;
  const out = [];
  for (const ev of list) {
    const [d, at] = String(last(ev.id) ?? '').split(':');
    if (fixed(ev.id) || Number(d) !== day - 1 || at !== key(ev.at)) {
      out.push(ev);
      continue;
    }
    const other = found.find((x) => x.id === ev.id && key(x.at) !== at);
    if (other) out.push(other);
  }
  return out;
}

// The level of the work (0, 1, or 2): the level of the grade, one step up when the child knows the
// skill of the event well (P(L) over up), one step down when the child does not know it yet (under
// down). p: P(L) of the skill, or null (no learner).
export function eventLevel(defs, gradeLevel, p = null) {
  let level = gradeLevel;
  if (p !== null && p >= (defs.up ?? 0.8)) level += 1;
  if (p !== null && p < (defs.down ?? 0.3)) level -= 1;
  return Math.max(0, Math.min(2, level));
}

// Make a sum with the sizes, as even as can be: the things that the work needs at least.
function makeSum(need, sizes) {
  const big = [...sizes].sort((a, b) => b - a);
  // Try the counts of the biggest size from many to few; the rest with the others (greedy).
  for (let n = Math.floor(need / big[0]); n >= 0; n--) {
    let rest = need - n * big[0];
    const out = Array(n).fill(big[0]);
    for (const s of big.slice(1)) {
      const k = Math.floor(rest / s);
      out.push(...Array(k).fill(s));
      rest -= k * s;
    }
    if (rest === 0) return out;
  }
  return null;
}

// The work of an event at a level: { need, pile: [sizes], skill, level, lost, keep }. The pile can
// always make the need exactly, with `extra` things more (of each size in turn), so that too many
// is possible too. The seed of the day chooses the need.
export function eventTask(def, level, rng) {
  const l = def.levels[Math.max(0, Math.min(def.levels.length - 1, level))];
  for (let tries = 0; tries < 20; tries++) {
    const need = rng.int(l.need[0], l.need[1]);
    const lost = l.lost ?? 0;
    // A lost duck: the pen holds the rest of the flock; the work is to bring the lost ones back.
    const base = lost ? need - lost : 0;
    const sum = makeSum(need - base, l.sizes);
    if (!sum) continue;
    const pile = [...sum];
    for (let i = 0; i < (def.extra ?? 0); i++) pile.push(l.sizes[i % l.sizes.length]);
    return { need, keep: base, pile: rng.shuffle(pile), skill: l.skill, level: l.level ?? 1, lost: Boolean(lost) };
  }
  throw new Error(`No work for the event ${def.id}`);
}

// The answer of a commit: the sum of the sizes on the place against the need.
export function exactResult(sum, need) {
  return { solved: sum === need, short: sum < need, over: Math.max(0, sum - need) };
}

// The work of a market day: barter (#26; Era 1 has no coins). The seller has goods (one of
// def.goods that the level has a rate for) and wants rice for them at a rate of the level and the
// good: [a, b] is a bowls of rice for b goods; a dearer good takes more rice for each one (#42).
// She trades all her goods in lots of the rate: she has k = lots × b goods and needs lots × a
// bowls. rice: the bowls of rice in the basket of the hero. The lots are never more than the rice
// can pay, nor more than def.most bowls, and the pile is the rice of the basket (with extra bowls,
// so that too many is possible). null: the rice cannot pay the fewest lots.
export function barterTask(def, level, rng, rice) {
  const l = def.levels[Math.max(0, Math.min(def.levels.length - 1, level))];
  // The goods that the rice can pay for in the fewest lots (a seller of eggs when the basket has
  // little rice).
  const pays = (r) => r[0] * l.lots[0] <= Math.min(rice, def.most ?? Infinity);
  const can = def.goods.filter((g) => (l.rates[g] ?? []).some(pays));
  if (!can.length) return null;
  const goods = rng.pick(can);
  const [a, b] = rng.pick(l.rates[goods].filter(pays));
  const most = Math.min(l.lots[1], Math.floor(rice / a), Math.floor((def.most ?? Infinity) / a));
  if (most < l.lots[0]) return null;
  const lots = rng.int(l.lots[0], most);
  const need = lots * a;
  const pile = Array(Math.min(rice, need + (def.extra ?? 0))).fill(1);
  return { need, keep: 0, pile, skill: l.skill, level: l.level ?? 1, lost: false, goods, rate: [a, b], lots, k: lots * b };
}
