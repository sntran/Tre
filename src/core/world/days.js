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
// seed, one day in `every`, so that a child can learn when its market comes. An event with
// `after: "rain"` comes only when the land is wet.
export function eventsOfDay(defs, { seed, day, map, spots = {}, wet = false }) {
  const out = [];
  const used = new Set();
  for (const def of defs.events) {
    if (def.after === 'rain' && !wet) continue;
    const rng = createRng(hashSeed(`${seed}:event:${def.id}:${map}:${day}`));
    let free = (spots[def.where] ?? []).filter((p) => !used.has(`${p[0]},${p[1]}`));
    if (def.every) free = free.filter((p) => (day + hashSeed(`${seed}:day:${def.id}:${map}:${p[0]},${p[1]}`)) % def.every === 0);
    else if (!rng.chance(def.chance ?? 0)) continue;
    if (!free.length) continue;
    const at = rng.pick(free);
    used.add(`${at[0]},${at[1]}`);
    out.push({ id: def.id, at: [at[0], at[1]] });
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

// The purse of the hero as coins of the sizes of a level (strings of ten or five, and single
// coins): the coins that the child has, for a market. The single coins are always enough to make
// any price up to all the coins (at most one string less), and the purse has at most `most` things.
export function purse(coins, sizes, most = 24) {
  const big = Math.max(...sizes);
  const strings = big > 1 ? Math.floor(Math.max(0, coins - (big - 1)) / big) : 0;
  const singles = Math.min(coins - strings * big, most - strings);
  return [...Array(strings).fill(big), ...Array(Math.max(0, singles)).fill(1)];
}
