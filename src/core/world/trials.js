// The Five Trials as work in the village: the pure rules of each task (data/trials.json). No
// DOM; the work system (systems/work.js) keeps the things of the tasks in the world state.
//
//   bundle (the teacher): rods from a heap go on a mat; ten rods on the mat tie into a bundle.
//   forge (the smith): ore to the forge and water to the trough; then the iron glows and dims,
//     and a tap drops it into the water while it is hot.
//   stakes (the fisher): stakes in a row in the river before the tide, with no space wider than
//     the space that the first two stakes show, to the end mark.
//   basket (the healer): three kinds of herbs, the same number of each, in the basket.
//   cut (the woodcutter): chalk marks on a bamboo stem, then equal sticks at the cut.
//   feed (rice for Gióng): trays of 3 and 5 bowls to the pot; each ten bowls, Gióng grows.
// Each commit is one skill event for the learner (the child never sees it). Units: half blocks
// and seconds.
import { byGrade } from '../grades.js';

// The levels of the tasks: one for each grade from 1 to 5 (#101; Pre-K and K use the first).
export const TOP_LEVEL = 4;
// The level (0 to TOP_LEVEL) of the tasks for a grade.
export function levelFor(trials, grade) {
  const level = byGrade(trials.grades ?? {}, grade) ?? 1;
  return Math.max(0, Math.min(TOP_LEVEL, level - 1));
}

// The level of a task for a child (#101): the level of the grade (base), one step up when P(L)
// of the skill of that level is over up, and one step down when it is under down, as the events of
// a day do. A skill with no evidence yet keeps the level of the grade. entryOf(skill): the entry of
// the learner ({ p, n }), or null. The era of a skill never stops a level.
export function trialLevel(def, base, entryOf, { up = 0.8, down = 0.3, evidence = 3 } = {}) {
  const max = def.levels.length - 1;
  let level = Math.max(0, Math.min(max, base));
  const e = entryOf(taskOf(def, level).skill);
  // Only evidence from the world moves a level: at least `evidence` commits of tasks of the world
  // (#112: three answers in the practice moved the smith one grade up). Answers in the practice and
  // the exams update P(L), but they alone never move the level of a task.
  if (e && (e.world ?? 0) >= evidence) {
    if (e.p > up && level < max) level += 1;
    else if (e.p < down && level > 0) level -= 1;
  }
  return level;
}

// The numbers of a task at a level: the level entry and the rest of the definition.
export function taskOf(def, level) {
  const l = def.levels[Math.max(0, Math.min(def.levels.length - 1, level))];
  return { ...def, ...l, levels: undefined };
}

// The teacher: ten rods tie into a bundle.
export const tieResult = (count, bundle = 10) => count === bundle;

// The rods of a level of the teacher (#101): bundles of ten (grades 1 and 2); equal bundles of g
// with one band for each bundle (groups, grade 3); a number of two digits shared among desks, with
// the rest in a box (share, grade 4); or hundredths: a big bundle of ten bundles is one, a bundle
// one tenth, a rod one hundredth (decimal, grade 5). rng: { int }.
export function rodsPlan(task, rng) {
  if (task.form === 'groups') {
    const g = rng.int(task.group[0], task.group[1]);
    let b = rng.int(task.bundles[0], task.bundles[1]);
    while (g * b > task.most && b > task.bundles[0]) b -= 1;
    return { form: 'groups', g, bundles: b, n: g * b, bands: b + 2 };
  }
  if (task.form === 'share') {
    const n = rng.int(task.rods[0], task.rods[1]);
    const k = rng.int(task.desks[0], task.desks[1]);
    return { form: 'share', n, k, tens: Math.floor(n / 10), ones: n % 10, each: Math.floor(n / k), rest: n % k };
  }
  if (task.form === 'decimal') {
    const x = rng.int(task.hundredths[0], task.hundredths[1]);
    return { form: 'decimal', x, bundles: Math.floor(x / 10) + 3, rods: (x % 10) + 4 };
  }
  return { form: 'tens', n: task.rods };
}

// The glow of the iron at t seconds after it went into the fire: it rises, stays hot (hold),
// dims, stays cold, and rises again. 0 is cold, 1 is white hot.
export function glowAt(t, glow, hold) {
  const cycle = glow.rise + hold + glow.dim + glow.cold;
  const k = ((t % cycle) + cycle) % cycle;
  if (k < glow.rise) return k / glow.rise;
  if (k < glow.rise + hold) return 1;
  if (k < glow.rise + hold + glow.dim) return 1 - (k - glow.rise - hold) / glow.dim;
  return 0;
}
// The iron hardens in the water while it is hot.
export const quenchResult = (value, glow) => value >= glow.hot;

// The colors of the iron in the fire from grade 3 (#102): dark red, cherry red, orange, and
// yellow, each for its seconds (colors), and then the smith takes it out of the fire to cool (cool),
// again and again. No pulse says when: the child looks at the color. The quench is right at cherry
// red.
export const IRON_COLORS = ['dark', 'cherry', 'orange', 'yellow', 'cool'];
export function colorAt(t, colors) {
  const cycle = IRON_COLORS.reduce((a, c) => a + colors[c], 0);
  let k = ((t % cycle) + cycle) % cycle;
  for (const c of IRON_COLORS) {
    if (k < colors[c]) return c;
    k -= colors[c];
  }
  return 'cool';
}
export const colorRight = (color) => color === 'cherry';
// The fair test of the smith at grade 5 (#102): two pieces from the same fire, one into the water
// and one onto the rack in the air. tries: [{ how: 'water' | 'rack', t }]. compare: the two ways are
// not the same (a test); fair: and only that changed (the two at about the same time, within
// FAIR_TIME seconds).
export const FAIR_TIME = 4;
export function fairResult(tries) {
  const [a, b] = tries;
  const compare = Boolean(a && b && a.how !== b.how);
  return { compare, fair: compare && Math.abs(a.t - b.t) <= FAIR_TIME };
}

// The fisher: the stakes (offsets along the line from the first stake, in half blocks) against
// the space of the row and the length of the line. solved: no space wider than the space of the
// row, and a stake at the end mark. efficient: solved with the fewest stakes. widest: the start
// of the widest space (where the fish swim out).
export function stakeResult(offsets, length, space) {
  const at = [...new Set([0, ...offsets])].filter((o) => o >= 0 && o <= length).sort((a, b) => a - b);
  // A stake next to the float (one half block before it) reaches it (#48).
  if (at[at.length - 1] >= length - 1) at[at.length - 1] = length;
  let widest = { from: at[at.length - 1], size: length - at[at.length - 1] };
  const gaps = [];
  for (let i = 1; i < at.length; i++) {
    const size = at[i] - at[i - 1];
    gaps.push(size);
    if (size > widest.size) widest = { from: at[i - 1], size };
  }
  const reach = at[at.length - 1] === length;
  // A row that does not reach the float: the fish goes out at the end of the row, where the child
  // sees the open water, not at a wide space before it (#48).
  if (!reach) widest = { from: at[at.length - 1], size: length - at[at.length - 1] };
  const solved = reach && gaps.every((g) => g <= space);
  const fewest = Math.ceil(length / space) + 1;
  return { solved, efficient: solved && at.length === fewest, count: at.length, fewest, gaps, widest };
}

// A stake at a point of the row that makes a space narrower than half of the gap of the fisher
// (#109: presses at the pile with no walk squeezed every stake between the first two stakes). A
// stake into a hole (a space wider than the gap) always goes in. slots: the points of the stakes
// (the bank is 0); slot: the point of the new stake; space: the gap of the fisher (half blocks).
export function tightSlot(slots, slot, space) {
  const at = [...new Set([0, ...slots])].sort((a, b) => a - b);
  const lo = Math.max(...at.filter((x) => x < slot));
  const above = at.filter((x) => x > slot);
  const hi = above.length ? Math.min(...above) : null;
  if (hi !== null && hi - lo > space) return false;
  return slot - lo < space / 2 || (hi !== null && hi - slot < space / 2);
}

// The row of a level of the fisher (#102): stakes that the child puts one at a time at the gap of
// the first two stakes (gaps, grades 1 and 2), or a load of a boat that brings the stakes in one
// trip. The gap is one pole (sào): the row is k poles from the stake of the fisher (measure, grade
// 3: k stakes), or k poles from the bank with a stake at each end (trees, grade 4: k + 1 stakes).
// At grade 5 (half) the gap is one pole and a half, and the row is x poles from the bank (x ÷ 1,5 +
// 1 stakes). Units: half blocks; halves: the length of the row in half poles. rng: { int, pick }.
export function rowPlan(task, rng) {
  if (task.form === 'measure' || task.form === 'trees') {
    const k = rng.int(task.poles[0], task.poles[1]);
    const start = task.form === 'measure';
    return { form: task.form, pole: task.pole, space: task.pole, k, length: k * task.pole, start, need: start ? k : k + 1 };
  }
  if (task.form === 'half') {
    const halves = rng.pick(task.halves);
    const space = task.pole * 1.5;
    const length = (halves * task.pole) / 2;
    return { form: 'half', pole: task.pole, space, halves, length, start: false, need: length / space + 1 };
  }
  return { form: 'gaps', space: task.space, length: task.space * task.gaps };
}
// A load of the boat of the fisher (#102) on a row that has `placed` stakes (with the stake of the
// fisher): the stakes that the boat sets at the gap from the last stake (set), the stakes over the
// float (over: they go back), and the stakes that the row still needs (left). Solved: the load is
// the stakes that the row needs.
export function boatResult(load, placed, plan) {
  const need = plan.length / plan.space + 1 - placed;
  const set = Math.min(load, need);
  return { solved: load === need, need, set, over: load - set, left: need - set };
}

// The healer: the count of each kind in the basket against the number of each kind (need: one
// number for all kinds, or a number for each kind).
export function basketResult(counts, kinds, need) {
  const want = (k) => (typeof need === 'number' ? need : need[k] ?? 0);
  const extra = Object.fromEntries(kinds.map((k) => [k, Math.max(0, (counts[k] ?? 0) - want(k))]));
  const solved = kinds.every((k) => (counts[k] ?? 0) === want(k)) && Object.keys(counts).every((k) => kinds.includes(k) || !counts[k]);
  return { solved, extra, total: kinds.reduce((a, k) => a + (counts[k] ?? 0), 0) };
}

// The basket of a level of the healer (#101): the number of bunches of each kind (need), and the
// numbers of its form. The same number of each kind (each, grades 1 and 2); doses of a recipe
// (recipe: a number of each kind for one dose, doses: the doses that she needs, grade 3); the same
// from a model basket of two doses (grade 4); or a number of bunches by fractions: one half rau
// má, one third tía tô, the rest ngải cứu (grade 5). rng: { int, pick }.
export const MODEL_DOSES = 2;
export function basketPlan(task, kinds, rng) {
  if (task.form === 'doses' || task.form === 'model') {
    const recipe = Object.fromEntries(kinds.map((k) => [k, rng.int(task.recipe[0], task.recipe[1])]));
    // Not the same number of each kind: the recipe is seen as a recipe, not as "each".
    if (kinds.every((k) => recipe[k] === recipe[kinds[0]])) recipe[kinds[0]] = recipe[kinds[0]] === task.recipe[1] ? task.recipe[0] : recipe[kinds[0]] + 1;
    let doses = rng.int(task.doses[0], task.doses[1]);
    if (task.form === 'model' && doses === MODEL_DOSES) doses += 1;
    return { form: task.form, recipe, doses, need: Object.fromEntries(kinds.map((k) => [k, recipe[k] * doses])) };
  }
  if (task.form === 'fraction') {
    const n = rng.pick(task.sizes);
    const [rest, third, half] = kinds;
    return { form: 'fraction', n, need: { [half]: n / 2, [third]: n / 3, [rest]: n - n / 2 - n / 3 } };
  }
  return { form: 'each', each: task.each, need: Object.fromEntries(kinds.map((k) => [k, task.each])) };
}

// The woodcutter: the pieces of a stem cut at the marks, and whether they are the equal parts.
// The staffs from the bamboo clump: the length of the piece from each culm (the height of its
// cut). Equal pieces are solved. If not, the pieces of the most common length stay (with a tie, the
// length of the first piece), and the others break (broken: their places in the clump).
export function staffResult(pieces, length = null) {
  const count = new Map();
  for (const p of pieces) count.set(p, (count.get(p) ?? 0) + 1);
  let keep = pieces[0];
  for (const [len, n] of count) if (n > count.get(keep)) keep = len;
  // With a sample staff, each staff must be as long as the sample (#54).
  if (length !== null) keep = length;
  const broken = pieces.flatMap((p, i) => (p === keep ? [] : [i]));
  return { solved: broken.length === 0, keep, broken };
}

// The stem of a level of the woodcutter (#102): equal pieces (equal, grades 1 and 2); one part of
// the stem for the bridge, and the rest stays (unit, grade 3: one half, one third, one fourth, or
// one sixth, as the rings allow); a/b of the stem for the bridge, and the rest for stakes (equiv,
// grade 4); or one third for the bridge, one fourth for the fence, and the rest for the kitchen
// (unlike, grade 5: 12 or 24 rings, a common part of thirds and fourths). want: the lengths of the
// pieces that the task asks for (the first is the piece for the bridge). Units: rings (half blocks).
export function stemPlan(task, rng) {
  if (task.form === 'unit') {
    const length = rng.pick(task.stems);
    const d = rng.pick(task.parts.filter((n) => length % n === 0));
    return { form: 'unit', length, a: 1, b: d, want: [length / d, length - length / d] };
  }
  if (task.form === 'equiv') {
    const length = rng.pick(task.stems);
    const [a, b] = rng.pick(task.fracs.filter(([, n]) => length % n === 0));
    return { form: 'equiv', length, a, b, want: [(a * length) / b, length - (a * length) / b] };
  }
  if (task.form === 'unlike') {
    const length = rng.pick(task.stems);
    return { form: 'unlike', length, want: [length / 3, length / 4, length - length / 3 - length / 4] };
  }
  return { form: 'equal', length: task.length, parts: task.parts };
}
// The pieces of a cut of a level with parts of the stem (#102) against the pieces that the task
// asks for. Each piece is compared with a length that the task asks for, never only with the other
// pieces: the pieces and the lengths in order of size, side by side, and the first piece that is not
// its length is named (bad: { i, long }), with the length that it should be (want). With a wrong
// number of pieces, no piece is named.
export function fracCut(pieces, plan) {
  const want = [...plan.want];
  if (pieces.length !== want.length) return { solved: false, bad: null, count: true };
  const order = pieces.map((p, i) => ({ p, i })).sort((x, y) => x.p - y.p);
  const sorted = [...want].sort((x, y) => x - y);
  // A stem of two parts: the piece for the bridge is the part that the task names.
  const pairs = order.map((o, k) => ({ ...o, w: sorted[k] }));
  const first = want.length === 2 ? pairs.find((q) => q.w === want[0]) ?? pairs[0] : null;
  const wrong = first ? (first.p === first.w ? null : first) : pairs.find((q) => q.p !== q.w) ?? null;
  return { solved: !wrong, bad: wrong ? { i: wrong.i, long: wrong.p > wrong.w, want: wrong.w } : null, count: false };
}

export function cutResult(marks, length, parts) {
  const at = [...new Set(marks)].filter((m) => m > 0 && m < length).sort((a, b) => a - b);
  const ends = [0, ...at, length];
  const pieces = ends.slice(1).map((x, i) => x - ends[i]);
  const solved = pieces.length === parts && pieces.every((p) => p === pieces[0]);
  return { solved, pieces };
}

// The skill event of a commit of a trial. task: the numbers of the task (taskOf). The first
// commit of a trial carries the efficient mark (the fewest parts on the first try).
export function trialSkill(task, { solved, efficient = solved, first, parts = [], target = 0, resets = 0 }) {
  return {
    skill: task.skill,
    level: task.level ?? 1,
    task: `trial-${task.id}`,
    correct: solved,
    solved,
    efficient: Boolean(solved && efficient && first),
    first,
    mashing: false,
    evidence: true,
    parts: parts.slice(0, 50),
    target,
    latencies: [],
    resets,
    hint: 0,
    hintSeen: null,
  };
}

// The iron horse: the bellows blow on the lumps in the hearth. Solved: the lumps that the smith
// needs. Short: too few (the fire puffs and dies). Over: the lumps too many (they roll back).
export function hearthResult(count, need) {
  return { solved: count === need, short: count < need, over: Math.max(0, count - need) };
}

// The loot after a raid: the coins on the mats (counts, one for each friend) and the coins left
// in the pile. Fair: each friend has the same, and the pile has fewer coins than friends (no one
// more coin for each). Settled: fair, or the pile has too few coins to even out the mats (short:
// the coins that the smaller mats need to come up to the biggest), so that only a coin taken back
// can make it fair.
export function shareResult(counts, left) {
  const top = Math.max(...counts);
  const short = counts.reduce((sum, c) => sum + top - c, 0);
  const fair = short === 0 && left < counts.length;
  return { settled: left < counts.length && (fair || left < short), fair, short };
}

// Rice for Gióng: a tray of `size` bowls goes into the pot, which had `ones` bowls. Gióng eats each
// full ten and grows one head (grew); the rest stays in the pot.
export function feedResult(ones, size) {
  const total = ones + size;
  return { grew: Math.floor(total / 10), ones: total % 10 };
}

// The commit of one ten: the trays (parts) that went in after the last ten, and the bowls that
// were in the pot then (start). Solved: the pot came to exactly ten. Efficient: solved with the
// fewest trays of these sizes.
export function tenResult(parts, start, sizes) {
  const total = start + parts.reduce((a, b) => a + b, 0);
  const solved = total === 10;
  let fewest = Infinity;
  const need = 10 - start;
  for (let a = 0; a * sizes[0] <= need; a++) {
    const rest = need - a * sizes[0];
    if (sizes[1] && rest % sizes[1] === 0) fewest = Math.min(fewest, a + rest / sizes[1]);
    if (!sizes[1] && rest === 0) fewest = Math.min(fewest, a);
  }
  return { solved, efficient: solved && parts.length === fewest, fewest, over: total - 10 };
}

