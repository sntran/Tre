// The planting of a paddy in Xóm Ruộng (src/core/planting.js; docs/PLANTING.md). The session sets
// up a round (setupPlant): the plots that are ready, each with its stakes (one for each row along
// one edge, one for each column along the other) and its place at the edge on the dike, and the
// bundles of seedlings on the dike by the seedbed. The child carries bundles to the edge of a plot
// (the place system and the place rule "exact" of the work system), and a tap on the planter is
// the commit (the command work, act plant). The planter plants row by row from the bundles at the
// edge: this system adds the rows of seedlings one after another, with a soft sound for each row.
//   exact: the plot is full and no seedling is left.
//   few: the planting stops where the seedlings end; the empty cells show, and the planter waits.
//   many: the plot is full, and the extra seedlings lie on the dike.
// A choose plot: two plots and bundles for one at the edge; a tap on a stake of a plot is the
// commit. A divide plot: the bundles and the columns are fixed; the child puts the row stakes, and
// a tap on the planter plants the rows of the stakes.
// The event "planted" goes out at the end of each planting (the session says the line, records
// the fact, and makes the next round). The rows of a full plot stay as a planted paddy (paddy).
export const WRITES = ['work', 'zone', 'item', 'position', 'look', 'keep', 'paddy', 'plantPlot', 'plotPart', 'gesture', 'events'];

import { query, getEntity, addEntity, removeEntity } from '../state.js';
import { judge, judgeChoice, plantOrder } from '../../planting.js';
import { trialSkill } from '../trials.js';
import { toHeap } from './work.js';

export const ROW_TIME = 0.45; // seconds between two rows of the planting
const OWNER = 'trial-plant';
const say = (world, type, id, extra = {}) => world.events.push({ type, id, ...extra });
const tzOf = (world) => getEntity(world, `zone:${OWNER}`);
// The plots of the round (each one an entity plantplot:<pid>, so that the save keeps it flat).
export const plotsOf = (world) => (tzOf(world)?.zone.round?.pids ?? []).map((pid) => getEntity(world, `plantplot:${pid}`)?.plantPlot).filter(Boolean);

// The point of a seedling cell of a plot (half blocks). Row 0 is at the dike, so that the stakes of
// the columns stand on the dike and the planting goes from the dike into the field.
export function cellPoint(p, x, z) {
  return { x: p.ox + x + 0.5, z: p.oz + p.depth - 1 - z + 0.5 };
}

// The depth of a plot in seedlings (its rows, its parts, and the rows of the stakes of a divide plot).
function depthOf(plot) {
  const rows = [...plot.parts, ...(plot.decoy ? [plot.decoy] : [])].map((r) => r.z + r.rows);
  return Math.max(...rows, plot.form === 'divide' ? Math.max(plot.rowsStart, plot.parts[0].rows) + 1 : 0);
}

// Set up a round. round: { index, level, skill, offers: [{ plot, ox, oz }], seedbed: [{ size,
// bundles, loose }] (the bundles of each size), seedbedAt: { x, z } } (half blocks).
export function setupPlant(world, round, env) {
  for (const e of [...world.entities]) if (e.id === `zone:${OWNER}` || e.item?.task === OWNER || e.zone?.task === OWNER || e.plotPart || e.plantPlot) removeEntity(world, e.id);
  const y = (p) => env.groundY(p.x / 2, p.z / 2);
  const tz = addEntity(world, {
    id: `zone:${OWNER}`,
    keep: true,
    zone: { id: OWNER, rule: 'trial', trial: 'plant', task: 'plant', level: round.level, commits: 0, fails: 0, resets: 0, done: false, made: 0, round: null },
    position: { x: round.seedbedAt.x, y: y(round.seedbedAt), z: round.seedbedAt.z, facing: 0 },
  });
  const thing = (zone, kind, size, look, extra = {}) => {
    const id = `${kind}:plant:${tz.zone.made++}`;
    addEntity(world, { id, keep: true, item: { kind, size, task: OWNER, zone: zone.zone.id, home: zone.zone.id, held: null, set: false, ...extra }, position: { x: zone.zone.x, y: zone.zone.y, z: zone.zone.z, facing: 0 }, look });
    zone.zone.items.push(id);
    return id;
  };
  // The bundles on the dike by the seedbed.
  const bed = round.seedbedAt;
  const heap = addEntity(world, { id: 'zone:plant-seedbed', keep: true, zone: { id: 'plant-seedbed', task: OWNER, rule: 'heap', accepts: 'seedling', items: [], x: bed.x, y: y(bed), z: bed.z, cols: 6, step: 1 }, position: { x: bed.x + 1, y: y(bed), z: bed.z + 1, facing: 0 } });
  for (const s of round.seedbed) {
    for (let i = 0; i < s.bundles; i++) thing(heap, 'seedling', s.size, `bundle-${s.size}`);
    for (let i = 0; i < s.loose; i++) thing(heap, 'seedling', 1, 'bunch-1');
  }
  packLocal(world, heap.zone);
  const plots = round.offers.map((o, i) => {
    const plot = o.plot;
    const p = { pid: `p${i}`, plot, ox: o.ox, oz: o.oz, depth: depthOf(plot), done: 0, commits: 0, bigger: Boolean(plot.bigger) };
    addEntity(world, { id: `plantplot:${p.pid}`, keep: true, plantPlot: p, position: { x: p.ox, y: y({ x: p.ox, z: p.oz }), z: p.oz, facing: 0 } });
    // The place at the edge, on the dike under the stakes of the columns.
    const edge = { x: p.ox + 2, z: p.oz + p.depth + 1.6 };
    addEntity(world, { id: `zone:plant-edge-${p.pid}`, keep: true, zone: { id: `plant-edge-${p.pid}`, task: OWNER, rule: 'exact', accepts: plot.form === 'divide' ? 'none' : 'seedling', items: [], x: edge.x, y: y(edge), z: edge.z, plot: p.pid, rect: { x0: p.ox - 1, x1: p.ox + Math.max(4, plot.size.w), z0: p.oz + p.depth, z1: p.oz + p.depth + 3 } }, position: { x: edge.x, y: y(edge), z: edge.z, facing: 0 } });
    stakes(world, p, plot.parts, 'plot', env, plot.form === 'divide' ? null : undefined);
    if (plot.decoy) stakes(world, p, [plot.decoy], 'decoy', env);
    // The rows that are planted at the start (an example row, or the rows of a neighbor).
    if (plot.pre) {
      rows(world, p, plantOrder(plot).slice(0, plot.pre), env);
    }
    // A choose or a divide plot: the bundles lie at the edge from the start.
    if (plot.form === 'choose' || plot.form === 'divide') {
      const edgeZone = getEntity(world, `zone:plant-edge-${p.pid}`);
      for (let n = plot.given; n > 0; n -= Math.min(10, n)) thing(edgeZone, 'seedling', Math.min(10, n), Math.min(10, n) === 10 ? 'bundle-10' : `bunch-${Math.min(10, n)}`, { set: true, fixed: true });
      packLocal(world, edgeZone.zone);
    }
    if (plot.form === 'divide') {
      // The row stakes: a line along the edge of the plot (the child puts them and takes them), and
      // a few more on the dike.
      const line = { x: p.ox - 0.5, z: p.oz + p.depth - 0.5, dz: -1 };
      const rz = addEntity(world, { id: `zone:plant-rows-${p.pid}`, keep: true, zone: { id: `plant-rows-${p.pid}`, task: OWNER, rule: 'exact', accepts: 'rowstake', items: [], x: line.x, y: y(line), z: line.z, line, rect: { x0: p.ox - 2, x1: p.ox + 1, z0: p.oz - 1, z1: p.oz + p.depth } }, position: { x: line.x, y: y(line), z: line.z, facing: 0 } });
      for (let k = 0; k < plot.rowsStart; k++) thing(rz, 'rowstake', 1, 'plot-stake');
      packLocal(world, rz.zone);
      const spare = { x: p.ox - 3, z: p.oz + p.depth + 1.5 };
      const sh = addEntity(world, { id: `zone:plant-stakes-${p.pid}`, keep: true, zone: { id: `plant-stakes-${p.pid}`, task: OWNER, rule: 'heap', accepts: 'rowstake', items: [], x: spare.x, y: y(spare), z: spare.z, cols: 3, step: 0.8 }, position: { x: spare.x, y: y(spare), z: spare.z, facing: 0 } });
      for (let k = 0; k < 4; k++) thing(sh, 'rowstake', 1, 'plot-stake');
      packLocal(world, sh.zone);
    }
    return p;
  });
  tz.zone.round = { index: round.index, level: round.level, skill: round.skill, pids: plots.map((p) => p.pid), chosen: null, anim: null };
  return tz;
}

// The stakes of a plot: one for each row along the edge at x = -1, one for each column along the
// edge on the dike. rowsOverride: null for no row stakes (a divide plot: the child puts them).
function stakes(world, p, parts, which, env, rowsOverride) {
  const cols = Math.max(...parts.map((r) => r.x + r.cols));
  const x0 = Math.min(...parts.map((r) => r.x));
  const rowsN = Math.max(...parts.map((r) => r.z + r.rows));
  const add = (id, q) => addEntity(world, { id, keep: true, plotPart: { plot: p.pid, which }, position: { x: q.x, y: env.groundY(q.x / 2, q.z / 2), z: q.z, facing: 0 }, look: 'plot-stake' });
  if (rowsOverride !== null) for (let k = 0; k < rowsN; k++) add(`pstake:${p.pid}:${which}:r${k}`, { ...cellPoint(p, x0 - 1, k) });
  for (let k = x0; k < cols; k++) {
    if (!parts.some((r) => k >= r.x && k < r.x + r.cols)) continue;
    add(`pstake:${p.pid}:${which}:c${k}`, cellPoint(p, k, -1));
  }
}

// The rows of seedlings of some cells: one entity for each run of cells in a row (look
// seedlings-<n>-<stage>: n seedlings along +x from its first cell).
function rows(world, p, cells, env) {
  const byRow = new Map();
  for (const c of cells) (byRow.get(c.z) ?? byRow.set(c.z, []).get(c.z)).push(c.x);
  const made = [];
  for (const [z, xs] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
    xs.sort((a, b) => a - b);
    let start = xs[0];
    let prev = xs[0];
    const runs = [];
    for (const x of xs.slice(1)) {
      if (x === prev + 1) prev = x;
      else {
        runs.push([start, prev]);
        start = prev = x;
      }
    }
    runs.push([start, prev]);
    for (const [a, b] of runs) {
      const id = `prow:${p.ox}:${p.oz}:${z}:${a}`;
      if (getEntity(world, id)) continue;
      const q = cellPoint(p, a, z);
      addEntity(world, { id, keep: true, plotPart: { plot: p.pid, which: 'row' }, position: { x: q.x, y: env.groundY(q.x / 2, q.z / 2), z: q.z, facing: 0 }, look: `seedlings-${b - a + 1}-planted` });
      made.push(id);
    }
  }
  return made;
}

// The things on a place of the planting lie close (bundles in rows; row stakes on their line).
export function packLocal(world, zone) {
  zone.items.forEach((id, i) => {
    const e = getEntity(world, id);
    if (!e) return;
    if (zone.line) e.position = { x: zone.line.x, y: zone.y, z: zone.line.z + zone.line.dz * i, facing: 0 };
    else {
      const cols = zone.cols ?? 4;
      const step = zone.step ?? 0.9;
      e.position = { x: zone.x - 1.5 + (i % cols) * step, y: zone.y + 0.1, z: zone.z - 0.6 + Math.floor(i / cols) * step, facing: 0 };
    }
  });
}

// A commit (the tap on the planter, or on a stake of a choose plot).
export function plantAct(world, e, want, env) {
  const tz = tzOf(world);
  const r = tz?.zone.round;
  if (!r || r.anim) return;
  const plots = plotsOf(world);
  const itemsAt = (zid) => (getEntity(world, `zone:${zid}`)?.zone.items ?? []).map((id) => getEntity(world, id)).filter(Boolean);
  let idx = -1;
  if (want.act === 'choose') idx = plots.findIndex((p) => p.pid === want.plot);
  else {
    // The plot with seedlings at its edge (or the row stakes of a divide plot).
    idx = plots.findIndex((p) => p.plot.form === 'divide' || (p.plot.form !== 'choose' && itemsAt(`plant-edge-${p.pid}`).some((t) => !t.item.fixed)));
  }
  if (idx < 0) return say(world, 'short', tz.id, { sound: 'tap' });
  const p = plots[idx];
  const plot = p.plot;
  if (r.chosen === null) {
    // The other plots go: their stakes, rows, and places; their bundles go back to the seedbed.
    for (const o of plots) if (o !== p) dropPlot(world, o);
    r.pids = [p.pid];
    r.chosen = p.pid;
  }
  p.commits += 1;
  tz.zone.commits += 1;
  let res;
  let parts;
  let target;
  if (plot.form === 'choose') {
    res = judgeChoice(plot, want.which ?? 'plot');
    parts = [plot.given];
    target = plot.given;
  } else if (plot.form === 'divide') {
    const n = itemsAt(`plant-rows-${p.pid}`).length;
    res = judge(plot, n);
    parts = [n];
    target = plot.fact[0];
    p.rows = n;
  } else {
    const things = itemsAt(`plant-edge-${p.pid}`).filter((t) => !t.item.fixed);
    parts = things.map((t) => t.item.size);
    const count = parts.reduce((a, b) => a + b, 0);
    target = plot.need - p.done;
    res = judge({ ...plot, need: target }, count);
    // The bundles at the edge go into the field.
    const edge = getEntity(world, `zone:plant-edge-${p.pid}`);
    for (const t of things) removeEntity(world, t.id);
    edge.zone.items = edge.zone.items.filter((id) => getEntity(world, id));
  }
  const solved = res.result === 'exact';
  if (!solved) tz.zone.fails += 1;
  say(world, 'skill', tz.id, trialSkill({ id: 'plant', skill: r.skill, level: r.level }, { solved, efficient: solved && p.commits === 1, first: p.commits === 1, parts, target, resets: 0 }));
  // The cells that the planter plants now.
  let cells = [];
  if (plot.form === 'choose') {
    if (solved) cells = plantOrder(plot);
  } else if (plot.form === 'divide') {
    if (solved) cells = plantOrder(plot, p.rows);
  } else {
    const start = plot.pre + p.done;
    cells = plantOrder(plot).slice(start, start + res.planted);
    p.done += res.planted;
  }
  if (solved && (plot.form === 'choose' || plot.form === 'divide')) {
    // The bundles at the edge go into the field.
    const edge = getEntity(world, `zone:plant-edge-${p.pid}`);
    for (const id of edge.zone.items) removeEntity(world, id);
    edge.zone.items = [];
  }
  r.anim = { p: p.pid, cells: cells.flatMap((c) => [c.x, c.z]), k: 0, t: 0, result: res.result, empty: res.empty, extra: res.extra, which: want.which ?? 'plot' };
  const planter = getEntity(world, 'npc:planter');
  const mid = cellPoint(p, 1, 1);
  if (planter) planter.gesture = { act: 'point', x: mid.x, z: mid.z, t: 1.5 };
}

// A plot that the child did not choose goes: its stakes, its rows, its places (its bundles go
// back to the seedbed).
function dropPlot(world, o) {
  for (const zid of [`plant-edge-${o.pid}`, `plant-rows-${o.pid}`, `plant-stakes-${o.pid}`]) {
    const z = getEntity(world, `zone:${zid}`);
    if (!z) continue;
    for (const id of z.zone.items) {
      const t = getEntity(world, id);
      if (t && !t.item.fixed && t.item.kind === 'seedling') toHeap(world, t);
      else if (t) removeEntity(world, id);
    }
    removeEntity(world, z.id);
  }
  for (const e of [...world.entities]) if (e.plotPart?.plot === o.pid) removeEntity(world, e.id);
  removeEntity(world, `plantplot:${o.pid}`);
  const heap = getEntity(world, 'zone:plant-seedbed');
  if (heap) packLocal(world, heap.zone);
}

// The planting: one row after another; then the event planted.
export function plant(world, dt, rng, env) {
  for (const e of query(world, 'work', 'position')) {
    if (e.work.trial !== 'plant') continue;
    const want = e.work;
    delete e.work;
    if (!e.fall) plantAct(world, e, want, env);
  }
  if (world.paused) return;
  const tz = tzOf(world);
  const r = tz?.zone.round;
  // The things that the hands put on the places of the planting lie close.
  for (const z of query(world, 'zone')) if (z.zone.task === OWNER && (z.zone.rule === 'exact' || z.zone.rule === 'heap')) packLocal(world, z.zone);
  if (!r?.anim) return;
  const a = r.anim;
  const p = getEntity(world, `plantplot:${a.p}`)?.plantPlot;
  if (!p) {
    r.anim = null;
    return;
  }
  a.t += dt;
  const n = a.cells.length / 2;
  if (a.k < n && a.t >= ROW_TIME) {
    a.t = 0;
    // The next row (the cells with the same row as the next cell).
    const z = a.cells[a.k * 2 + 1];
    const row = [];
    while (a.k < n && a.cells[a.k * 2 + 1] === z) {
      row.push({ x: a.cells[a.k * 2], z });
      a.k += 1;
    }
    rows(world, p, row, env);
    say(world, 'plantRow', tz.id, { plot: p.pid, row: z, sound: 'seed' });
    return;
  }
  if (a.k < n || a.t < ROW_TIME) return;
  // The end of the planting.
  r.anim = null;
  const full = a.result === 'exact' || (a.result === 'many' && p.plot.form !== 'choose' && p.plot.form !== 'divide');
  if (a.extra && full) {
    // The extra seedlings lie on the dike.
    const q = { x: p.ox + 4, z: p.oz + p.depth + 1.6 };
    addEntity(world, { id: `pextra:${p.pid}`, keep: true, plotPart: { plot: p.pid, which: 'extra' }, position: { x: q.x, y: env.groundY(q.x / 2, q.z / 2), z: q.z, facing: 0 }, look: a.extra >= 10 ? 'bundle-10' : `bunch-${a.extra}` });
  }
  if (full) {
    // The plot is planted: its rows stay as a paddy; the stakes go.
    for (const e of [...world.entities]) {
      if (e.plotPart?.plot !== p.pid) continue;
      if (e.plotPart.which === 'row') {
        e.paddy = { plot: `${p.plot.key}:${p.ox}:${p.oz}`, rect: { x: p.ox - 1, z: p.oz, w: p.plot.size.w, h: p.depth + 1 }, n: Number(e.look.split('-')[1]), day: null };
        delete e.plotPart;
      } else if (e.plotPart.which !== 'extra') removeEntity(world, e.id);
    }
  }
  say(world, 'planted', tz.id, { plot: p.pid, key: p.plot.key, form: p.plot.form, result: a.result, empty: a.empty, extra: a.extra, full, total: p.plot.form === 'divide' || p.plot.form === 'choose' ? p.plot.given : p.plot.cells, commits: p.commits, which: a.which, sound: a.result === 'exact' ? 'drum' : 'tap' });
}
