// The planting of a paddy in Xóm Ruộng: the plots, the memory of the facts, and the judge of a
// commit (data/world/planting.json; docs/PLANTING.md). Pure functions, no DOM.
//
// A plot is an array of seedlings: one seedling on each half block, rows along z and columns along
// x. A fact of the table is a × b; a × b and b × a are one fact (factKey). The memory of the facts
// belongs to the skill, not to the activity: every activity of multiplication reads and writes the
// same memory (profile.facts[<skill>]). The facts come back by a schedule (rule 24): a missed fact
// comes back later in the same set, in another form; a known fact comes back after some days.
// Two plots of the same table never come one after another.

import { createRng, hashSeed } from './rng.js';

export const factKey = (a, b) => `${Math.min(a, b)}x${Math.max(a, b)}`;
const factorsOf = (key) => key.split('x').map(Number);
const hardFact = (key) => Math.max(...factorsOf(key)) >= 6;

// The state of a fact for the parent (rule 27): null (not met yet), exploring, getting, confident.
export function factState(e) {
  if (!e || !e.n) return null;
  if ((e.box ?? 0) >= 3) return 'confident';
  if ((e.box ?? 0) >= 1) return 'getting';
  return 'exploring';
}

// The table of the facts from one to ten, for the parent page: rows[a - 1][b - 1] is the state.
export function factTable(mem = {}) {
  return Array.from({ length: 10 }, (_, i) => Array.from({ length: 10 }, (_, j) => factState(mem[factKey(i + 1, j + 1)])));
}

// Record a commit on a fact. ok: an efficient first-try success. day: the game day. set and
// index: the set and the plot of the set, so that a missed fact comes back in the same set, after
// `again` plots, in another form than `form`.
export function recordFact(mem, key, { ok, day, set, index, form }, data) {
  const e = (mem[key] ??= { box: 0, due: 0, n: 0, miss: 0 });
  e.n += 1;
  e.last = day;
  if (ok) {
    e.box = Math.min((e.box ?? 0) + 1, data.boxes.length);
    e.due = day + data.boxes[e.box - 1];
    delete e.again;
  } else {
    e.miss = (e.miss ?? 0) + 1;
    e.box = 0;
    e.due = day;
    e.again = { set, after: index + data.again, form };
  }
  return e;
}

// The facts of a level: the factor ranges of the level of the skill (data/skills.json).
export function factPool(range) {
  const keys = new Set();
  for (let a = range.minA; a <= range.maxA; a++) for (let b = range.minB; b <= range.maxB; b++) keys.add(factKey(a, b));
  return [...keys];
}

// Rows and columns for a fact in a level: the rows in the range of A, the columns in the range of B.
function orient(key, range, rng) {
  const [p, q] = factorsOf(key);
  const fits = (a, b) => a >= range.minA && a <= range.maxA && b >= range.minB && b <= range.maxB;
  const ways = [[p, q], [q, p]].filter(([a, b]) => fits(a, b));
  if (!ways.length) return [p, q];
  return ways.length === 2 && p !== q ? rng.pick(ways) : ways[0];
}

const shares = (key, prev) => {
  if (!prev) return false;
  const a = factorsOf(key).filter((n) => n > 1);
  return factorsOf(prev).some((n) => n > 1 && a.includes(n));
};

// Choose the fact of the next plot. ctx: { pool, mem, day, set, index, prev (the key of the last
// plot), hard (the part of hard facts), not (keys to leave out) }.
export function chooseFact(ctx, rng) {
  const { mem, day, set, index, prev, hard = 0 } = ctx;
  const not = new Set(ctx.not ?? []);
  let pool = ctx.pool.filter((k) => !not.has(k));
  // Never two plots of the same table one after another (interleaved, not blocked).
  const other = pool.filter((k) => k !== prev && !shares(k, prev));
  if (other.length) pool = other;
  else pool = pool.filter((k) => k !== prev).length ? pool.filter((k) => k !== prev) : pool;
  const e = (k) => mem[k];
  const weight = (k) => (hardFact(k) ? 1 + 3 * hard : 1);
  // A missed fact of this set comes back after `again` plots.
  const back = pool.filter((k) => e(k)?.again?.set === set && e(k).again.after <= index).sort((x, y) => e(x).again.after - e(y).again.after);
  if (back.length) return back[0];
  // The first plot of a set: a sure fact (the highest box), else the easiest new fact.
  if (index === 0) {
    const known = pool.filter((k) => (e(k)?.box ?? 0) >= 1);
    if (known.length) {
      const top = Math.max(...known.map((k) => e(k).box));
      return rng.pick(known.filter((k) => e(k).box === top));
    }
    const small = Math.min(...pool.map((k) => factorsOf(k)[0] * factorsOf(k)[1]));
    return rng.pick(pool.filter((k) => factorsOf(k)[0] * factorsOf(k)[1] === small));
  }
  // Then the facts to learn (due, new, or missed) mix with the known ones.
  const learn = pool.filter((k) => !e(k) || !e(k).n || (e(k).box ?? 0) === 0 || e(k).due <= day);
  const known = pool.filter((k) => !learn.includes(k));
  const first = index % 2 === 1 ? learn : known;
  const list = first.length ? first : learn.length ? learn : known.length ? known : pool;
  // A due fact comes before a new one; a missed fact before a due one.
  if (list === learn) {
    const missed = list.filter((k) => e(k)?.n && (e(k).box ?? 0) === 0);
    if (missed.length) return rng.weighted(missed, weight);
    const due = list.filter((k) => e(k)?.n && e(k).due <= day);
    if (due.length) return rng.weighted(due, weight);
  }
  return rng.weighted(list, weight);
}

// Choose the form of a plot. ctx: { forms (of the level), used (the forms of this set, in order),
// counts (how many times the child did each form), avoid (the form of the miss of an again
// fact) }. No form comes three times in a row; a form that the child did many times comes less
// often; from the third plot of a set, a set with fewer than three forms takes a new one.
export function chooseForm(ctx, rng) {
  const { forms, used = [], counts = {}, avoid = null } = ctx;
  let list = forms.slice();
  const n = used.length;
  if (n >= 2 && used[n - 1] === used[n - 2]) list = list.filter((f) => f !== used[n - 1]);
  if (avoid && list.some((f) => f !== avoid)) list = list.filter((f) => f !== avoid);
  const kinds = new Set(used);
  if (n >= 2 && kinds.size < 3) {
    const fresh = list.filter((f) => !kinds.has(f));
    if (fresh.length) list = fresh;
  }
  if (!list.length) list = forms.slice();
  return rng.weighted(list, (f) => 1 / (1 + (counts[f] ?? 0)));
}

// The plot of a fact in a form. Geometry in seedlings (half blocks) from the corner of the plot:
// parts are rectangles { x, z, rows, cols }; pre: the seedlings already planted at the start (the
// first rows); need: the seedlings that the child brings. stakes: one stake for each row along one
// edge, one for each column along the other. Forms:
//   product: rows × columns.            rest: some rows are planted; bring the rest.
//   lshape: two arrays in one.          split: two plots side by side with a path between them.
//   turned: the same fact turned.       choose: two plots and bundles for one; tap the right plot.
//   divide: fixed bundles and columns; move the row stakes so that the bundles fill the plot.
export function makePlot({ key, form, range, levelData, rng, id = 'plot' }) {
  let [a, b] = orient(key, range, rng);
  const plot = { id, key, form, fact: [a, b], parts: [], pre: 0, decoy: null, given: 0 };
  if (form === 'turned') [a, b] = [b, a];
  if (form === 'split' && b < 6 && a >= 6) [a, b] = [b, a];
  if (form === 'split' && b >= 6) {
    plot.parts = [{ x: 0, z: 0, rows: a, cols: 5 }, { x: 6, z: 0, rows: a, cols: b - 5 }];
  } else if (form === 'lshape') {
    const arm = { rows: rng.int(1, 2), cols: Math.max(1, b - rng.int(1, Math.max(1, b - 1))) };
    plot.parts = [{ x: 0, z: 0, rows: a, cols: b }, { x: 0, z: a, rows: arm.rows, cols: arm.cols }];
  } else if (form === 'rest') {
    const k = rng.int(1, 2);
    plot.parts = [{ x: 0, z: 0, rows: a + k, cols: b }];
    plot.pre = k * b;
  } else if (form === 'divide') {
    plot.parts = [{ x: 0, z: 0, rows: a, cols: b }];
    plot.given = a * b;
    // The row stakes start wrong: one or two rows off, never zero rows.
    const off = rng.pick([-2, -1, 1, 2].filter((d) => a + d >= 1));
    plot.rowsStart = a + off;
  } else {
    plot.parts = [{ x: 0, z: 0, rows: a, cols: b }];
  }
  if (form === 'split' && b < 6) plot.form = form = 'product';
  if (form === 'choose') {
    plot.given = a * b;
    const near = [[a, b + 1], [a, b - 1], [a + 1, b], [a - 1, b]].filter(([p, q]) => p >= 1 && q >= 1 && p * q !== a * b);
    const [p, q] = rng.pick(near);
    plot.decoy = { x: b + 3, z: 0, rows: p, cols: q };
  }
  // The first row as an example (the farmer plants it): one more row, planted at the start.
  if (levelData.example && (form === 'product' || form === 'rest')) {
    plot.parts[0].rows += 1;
    plot.pre += plot.parts[0].cols;
    plot.example = true;
  }
  plot.cells = plot.parts.reduce((s, p) => s + p.rows * p.cols, 0);
  plot.need = form === 'divide' || form === 'choose' ? plot.given : plot.cells - plot.pre;
  plot.stakes = stakesOf(plot);
  plot.size = sizeOf(plot);
  return plot;
}

// The stakes along the two edges: rows (along z, at x = -1) and columns (along x, at z = -1).
export function stakesOf(plot, rows = null) {
  const p = plot.parts[0];
  const nRows = rows ?? (plot.form === 'divide' ? plot.rowsStart : plot.parts.reduce((m, q) => Math.max(m, q.z + q.rows), 0));
  const cols = plot.parts.reduce((m, q) => Math.max(m, q.x + q.cols), 0);
  return { rows: nRows, cols: plot.form === 'divide' ? p.cols : cols };
}

// The size of the plot with its stakes, a margin for the dike, and the decoy (half blocks).
function sizeOf(plot) {
  const rects = [...plot.parts, ...(plot.decoy ? [plot.decoy] : [])];
  const rows = plot.form === 'divide' ? Math.max(plot.rowsStart, plot.parts[0].rows) + 2 : 0;
  const w = Math.max(...rects.map((r) => r.x + r.cols)) + 2;
  const h = Math.max(rows, ...rects.map((r) => r.z + r.rows)) + 2;
  return { w, h };
}

// The cells of a plot in the order of the planting: row by row, part by part, after the cells that
// are planted at the start. rows: the rows of a divide plot.
export function plantOrder(plot, rows = null) {
  const parts = plot.form === 'divide' ? [{ ...plot.parts[0], rows: rows ?? plot.rowsStart }] : plot.parts;
  const all = [];
  const maxRow = Math.max(...parts.map((p) => p.z + p.rows));
  for (let z = 0; z < maxRow; z++) for (const p of parts) if (z >= p.z && z < p.z + p.rows) for (let x = p.x; x < p.x + p.cols; x++) all.push({ x, z });
  return all;
}

// The judge of a commit. count: the seedlings at the edge (or, for a divide plot, the rows of the
// stakes). Return { result: exact | few | many, planted, empty, extra } (cells after the planting:
// planted cells, empty cells, seedlings left on the dike).
export function judge(plot, count) {
  if (plot.form === 'divide') {
    const cells = count * plot.parts[0].cols;
    const n = plot.given;
    if (cells === n) return { result: 'exact', planted: n, empty: 0, extra: 0, cells };
    if (cells > n) return { result: 'few', planted: n, empty: cells - n, extra: 0, cells };
    return { result: 'many', planted: cells, empty: 0, extra: n - cells, cells };
  }
  const cells = plot.need;
  if (count === cells) return { result: 'exact', planted: cells, empty: 0, extra: 0, cells };
  if (count < cells) return { result: 'few', planted: count, empty: cells - count, extra: 0, cells };
  return { result: 'many', planted: cells, empty: 0, extra: count - cells, cells };
}

// The commit of a choose plot: the tap on a plot. Return 'exact' for the plot that the bundles
// fill, else 'few' or 'many' for the decoy.
export function judgeChoice(plot, tapped) {
  if (tapped === 'plot') return { result: 'exact', planted: plot.given, empty: 0, extra: 0 };
  const cells = plot.decoy.rows * plot.decoy.cols;
  return cells > plot.given ? { result: 'few', planted: plot.given, empty: cells - plot.given, extra: 0 } : { result: 'many', planted: cells, empty: 0, extra: plot.given - cells };
}

// The seedbed for a plot: bundles of one size, and loose bunches of one. Always enough to make the
// answer, and more, so that the child can bring too many.
export function seedbedFor(plot, levelData, extra) {
  if (plot.form === 'choose' || plot.form === 'divide') return { size: 10, bundles: 0, loose: 0 };
  if (levelData.bundle === 'row') {
    const cols = plot.parts[0].cols;
    return { size: cols, bundles: Math.ceil(plot.need / cols) + extra.bundles, loose: 0 };
  }
  const size = levelData.bundle;
  return { size, bundles: Math.floor(plot.need / size) + extra.bundles, loose: extra.loose };
}

// The bundles at the edge of a choose or divide plot: tens and ones of the given number.
export const givenBundles = (n, size = 10) => ({ size, bundles: Math.floor(n / size), loose: n % size });

// The rng of a plot: the same seed, the same set, and the same plot give the same plot.
export const plotRng = (seed, set, index, salt = '') => createRng(hashSeed(`${seed}:plant:${set}:${index}${salt}`));

// The small event of a set (at most one in a set, never the same in two sets in a row), and the
// plot of the set where it comes.
export function eventOf(seed, set, last, data) {
  const rng = createRng(hashSeed(`${seed}:plant-event:${set}`));
  if (!rng.chance(data.chance)) return null;
  const kind = rng.pick(data.events.filter((e) => e !== last));
  return { kind, at: rng.int(1, Math.max(1, data.set - 2)) };
}

// The offers of the next round: the plot of the schedule, and (for the forms where the child
// chooses) another plot of the band, and a bigger plot at some levels. ctx: { data, level (1 to
// the levels of the skill), ranges (the factor ranges of the levels of the skill), mem, day, set,
// index, prev, used, counts, divideOpen, seed }.
export function nextOffers(ctx) {
  const { data, level, ranges, mem, day, set, index, prev, used = [], counts = {}, divideOpen = false, seed } = ctx;
  const levelData = data.levels[Math.min(level, data.levels.length) - 1];
  const range = ranges[Math.min(level, ranges.length) - 1];
  const rng = plotRng(seed, set, index);
  const pool = factPool(range);
  const key = chooseFact({ pool, mem, day, set, index, prev, hard: levelData.hard }, rng);
  const forms = [...levelData.forms, ...(divideOpen && level >= 2 ? ['divide'] : [])];
  // A plot of the first round of a set is a plain plot.
  let form = index === 0 ? forms[0] : chooseForm({ forms, used, counts, avoid: mem[key]?.again?.form ?? null }, rng);
  // A turned plot needs a fact that the child met before.
  if (form === 'turned' && !mem[key]?.n) form = forms[0];
  const main = makePlot({ key, form, range, levelData, rng, id: 'plot' });
  const offers = [main];
  if (main.form === 'product' || main.form === 'rest') {
    for (let i = 1; i < data.offers; i++) {
      const alt = chooseFact({ pool, mem, day, set, index, prev, hard: levelData.hard, not: [key] }, rng);
      offers.push(makePlot({ key: alt, form: main.form, range, levelData, rng, id: `plot-${i}` }));
    }
    if (data.bigger.includes(level)) {
      const top = ranges[Math.min(level, ranges.length - 1)];
      const big = { ...top, minA: Math.max(top.minA, 6), minB: Math.max(top.minB, 6) };
      offers.push({ ...makePlot({ key: rng.pick(factPool(big)), form: 'product', range: big, levelData, rng, id: 'plot-big' }), bigger: true });
    }
  }
  return { offers, levelData };
}

// The stage of a planted plot after some game days.
export function stageOf(plantedDay, day, growth) {
  let stage = growth[0][0];
  for (const [name, after] of growth) if (day - plantedDay >= after) stage = name;
  return stage;
}

// A free place for a plot of w × h half blocks in a field { x0, z0, x1, z1 } (half blocks), away
// from the rects { x, z, w, h } that are there. Return { x, z } or null.
export function placeIn(field, rects, w, h, gap = 1) {
  for (let z = field.z0; z + h <= field.z1; z++) {
    for (let x = field.x0; x + w <= field.x1; x++) {
      const free = rects.every((r) => x + w + gap <= r.x || r.x + r.w + gap <= x || z + h + gap <= r.z || r.z + r.h + gap <= z);
      if (free) return { x, z };
    }
  }
  return null;
}
