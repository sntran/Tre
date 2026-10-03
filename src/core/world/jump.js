// The jump of the hero: as far as a real child of the age of the player (data/hero.json, jump).
// Pure functions, no DOM. Units: half blocks for the jump and the points; map cells for the
// cells (one cell is 2 half blocks).
//
// A jump goes in the direction of the hero. Its arc has its top at a quarter of its length (a
// throw at 45 degrees), so the hero clears a thing that is lower than the top (a log, a ditch, the
// rim of a puddle). A jump does not climb or go down a cliff, and does not cross a wall, a house, a
// hedge, or deep water: then it is a small hop in place. It never crosses a gap that a task asks
// the child to fill or to measure: over the gap of the bridge it ends in the water (the same fall
// as a short plank), and over the zone of another task it is a hop.

// The typical age of a grade (the nearest grade in the data for a grade that is not there).
export function ageOfGrade(cfg, grade) {
  const ages = cfg.ages ?? {};
  if (ages[String(grade)] !== undefined) return ages[String(grade)];
  const keys = Object.keys(ages).map(Number).sort((a, b) => a - b);
  const near = keys.reduce((best, k) => (Math.abs(k - grade) < Math.abs(best - grade) ? k : best), keys[0] ?? 1);
  return ages[String(near)] ?? 7;
}

// The median standing long jump and height (cm) at an age, between the rows of the table.
export function jumpAtAge(cfg, age) {
  const t = cfg.table;
  if (age <= t[0][0]) return { jump: t[0][1], height: t[0][2] };
  for (let i = 1; i < t.length; i++) {
    if (age > t[i][0]) continue;
    const k = (age - t[i - 1][0]) / (t[i][0] - t[i - 1][0]);
    return { jump: t[i - 1][1] + (t[i][1] - t[i - 1][1]) * k, height: t[i - 1][2] + (t[i][2] - t[i - 1][2]) * k };
  }
  const last = t[t.length - 1];
  return { jump: last[1], height: last[2] };
}

// The length of the jump of a hero of a grade (half blocks): the jump of a child of that age, in
// the size of the hero. run: a jump with a run is a little longer.
export function jumpLength(cfg, grade, { run = false } = {}) {
  const { jump, height } = jumpAtAge(cfg, ageOfGrade(cfg, grade));
  const blocks = (jump / height) * cfg.hero;
  return blocks * 2 * (run ? cfg.run : 1);
}

// The longest jump of any grade, with a run (half blocks).
export function longestJump(cfg) {
  return Math.max(...Object.keys(cfg.ages).map((g) => jumpLength(cfg, Number(g), { run: true })));
}

const hop = (cfg, from) => ({ kind: 'hop', to: { x: from.x, z: from.z }, top: cfg.hop[1], time: cfg.hop[0] });

// Plan a jump. from: the point of the hero (half blocks); dir: the direction ({ x, z }, length 1);
// len: the length (half blocks). ctx (cells, except where it says half blocks):
//   groundY(cx, cy): the top of the ground (half blocks); level(cx, cy): the step of the ground;
//   type(cx, cy): the ground; walkable(cx, cy): a free cell to stand on; objectAt(cx, cy): the map
//   object on the cell, or null; gapAt(x, z): the open gap of a task to fill at a point (half
//   blocks), or null; taskAt(x, z): the point is in the zone of another task.
// Return { kind: 'jump', to, top, time, splash } (splash: the hero lands in shallow water),
// { kind: 'fall', at, gap } (the jump ends in the water of the gap), or { kind: 'hop', ... }.
export function planJump(ctx, from, dir, len, cfg) {
  const cell = (q) => ({ x: Math.floor(q.x / 2), y: Math.floor(q.z / 2) });
  const start = cell(from);
  const startY = ctx.groundY(start.x, start.y);
  const startLevel = ctx.level(start.x, start.y);
  const top = len * cfg.arc;
  const steps = Math.max(1, Math.ceil(len / 0.5));
  const last = cell({ x: from.x + dir.x * len, z: from.z + dir.z * len });
  // A thing is in the way when it is higher than the arc over the higher end of the jump.
  const base = Math.max(startY, ctx.groundY(last.x, last.y));
  let end = from;
  for (let i = 1; i <= steps; i++) {
    const d = (len * i) / steps;
    const q = { x: from.x + dir.x * d, z: from.z + dir.z * d };
    end = q;
    const gap = ctx.gapAt(q.x, q.z);
    if (gap) return { kind: 'fall', at: q, gap };
    if (ctx.taskAt(q.x, q.z)) return hop(cfg, from);
    const c = cell(q);
    if (c.x === start.x && c.y === start.y) continue;
    const t = ctx.type(c.x, c.y);
    // Deep water, a hedge, or a thing that is higher than the arc.
    if (t === 'water' || t === 'sea' || t === 'hedge' || t === null) return hop(cfg, from);
    // A ford that the high river closed is deep water too.
    if ((t === 'shallow' || t === 'surf') && !ctx.walkable(c.x, c.y)) return hop(cfg, from);
    const o = ctx.objectAt(c.x, c.y);
    if (o && !(cfg.low ?? []).includes(o.prop ?? o.kind)) return hop(cfg, from);
    if (ctx.groundY(c.x, c.y) - base > top) return hop(cfg, from);
  }
  const land = cell(end);
  if (land.x === start.x && land.y === start.y) return hop(cfg, from);
  // The landing: a free cell, not a cliff (two steps or more up or down).
  if (!ctx.walkable(land.x, land.y) || Math.abs(ctx.level(land.x, land.y) - startLevel) > 1) return hop(cfg, from);
  const t = ctx.type(land.x, land.y);
  return { kind: 'jump', to: { x: end.x, z: end.z }, top, time: Math.max(cfg.time[1], cfg.time[0] * len), splash: t === 'shallow' || t === 'surf' };
}

// The height of a jump over the line from its start to its end at a part k (0 to 1) of the time
// (half blocks over the line between the two grounds).
export const arcAt = (top, k) => 4 * top * k * (1 - k);
