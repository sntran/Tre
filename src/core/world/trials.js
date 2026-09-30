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

// The level (0, 1, or 2) of the tasks for a grade.
export function levelFor(trials, grade) {
  const level = byGrade(trials.grades ?? {}, grade) ?? 1;
  return Math.max(0, Math.min(2, level - 1));
}

// The numbers of a task at a level: the level entry and the rest of the definition.
export function taskOf(def, level) {
  const l = def.levels[Math.max(0, Math.min(def.levels.length - 1, level))];
  return { ...def, ...l, levels: undefined };
}

// The teacher: ten rods tie into a bundle.
export const tieResult = (count, bundle = 10) => count === bundle;

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

// The fisher: the stakes (offsets along the line from the first stake, in half blocks) against
// the space of the row and the length of the line. solved: no space wider than the space of the
// row, and a stake at the end mark. efficient: solved with the fewest stakes. widest: the start
// of the widest space (where the fish swim out).
export function stakeResult(offsets, length, space) {
  const at = [...new Set([0, ...offsets])].filter((o) => o >= 0 && o <= length).sort((a, b) => a - b);
  let widest = { from: at[at.length - 1], size: length - at[at.length - 1] };
  const gaps = [];
  for (let i = 1; i < at.length; i++) {
    const size = at[i] - at[i - 1];
    gaps.push(size);
    if (size > widest.size) widest = { from: at[i - 1], size };
  }
  const reach = at[at.length - 1] === length;
  const solved = reach && gaps.every((g) => g <= space);
  const fewest = Math.ceil(length / space) + 1;
  return { solved, efficient: solved && at.length === fewest, count: at.length, fewest, gaps, widest };
}

// The healer: the count of each kind in the basket against the number of each.
export function basketResult(counts, kinds, each) {
  const extra = Object.fromEntries(kinds.map((k) => [k, Math.max(0, (counts[k] ?? 0) - each)]));
  const solved = kinds.every((k) => (counts[k] ?? 0) === each) && Object.keys(counts).every((k) => kinds.includes(k) || !counts[k]);
  return { solved, extra, total: kinds.reduce((a, k) => a + (counts[k] ?? 0), 0) };
}

// The woodcutter: the pieces of a stem cut at the marks, and whether they are the equal parts.
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

