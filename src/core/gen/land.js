// The land of a region: one continuous ground for all its maps. Each map is a window on the region
// plane (cells, x to the east, y to the south). The story places of a map are stamps: hand-made
// ground that stays. Around them, rules make the land from the real geography and the seed:
//   - the warp (warp.js) puts the real rivers of data/geo/vietnam.json into the plane, through
//     the rivers of the stamps;
//   - the real heights (heights.js: SRTM, about 550 m) give the hills, through a concave curve:
//     the low land stays flat, and the hills are real. A stamp on a real hill rises with it;
//   - where the land is steeper than one step for each cell, it is a rock face (a cliff);
//   - roads join the roads of the stamps across the edges of the maps. A road is never steeper
//     than one step for each cell: on a hill it turns back and forth;
//   - rice paddies lie on low, wet land, in blocks with dikes; near a hamlet they are terraces on
//     the gentle slopes. Forest grows on the hills (the scatter rules).
// The same seed gives the same land. Pure functions, no DOM.
import { createWarp } from './warp.js';
import { fbm, hash2 } from './noise.js';
import { stepsOf } from './heights.js';
import { hashSeed } from '../rng.js';

// The size of the site of a hamlet (cells).
export const HAMLET = Object.freeze({ w: 22, h: 16 });

export const LETTER = Object.freeze({ grass: '.', path: '=', sand: '_', water: '~', field: 'f', dike: 'd', bridge: 'B', rock: 'r' });
const CODE = Object.fromEntries(Object.entries(LETTER).map(([k, v]) => [k, v.charCodeAt(0)]));
const FIXED = { none: 0, stamp: 1, river: 2, claim: 3 };
// A height is one digit of base 36 in the height rows (0 to 9, then a to z).
export const MAX_LEVEL = 35;
export const digit = (ch) => parseInt(ch, 36);

// The box of the windows of all maps of a region.
export function regionBox(maps) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const m of maps) {
    x0 = Math.min(x0, m.window.x);
    y0 = Math.min(y0, m.window.y);
    x1 = Math.max(x1, m.window.x + m.width);
    y1 = Math.max(y1, m.window.y + m.height);
  }
  return { x0, y0, w: x1 - x0, h: y1 - y0 };
}

// The distance (cells) from each cell to the nearest source cell, and the index of that source.
// Two passes over the grid with the nearest source of the neighbors (close to the true distance).
export function distanceField(w, h, isSource) {
  const near = new Int32Array(w * h).fill(-1);
  const dist = new Float32Array(w * h).fill(Infinity);
  for (let i = 0; i < w * h; i++) if (isSource(i)) {
    near[i] = i;
    dist[i] = 0;
  }
  const check = (i, j) => {
    const s = near[j];
    if (s < 0) return;
    const dx = (i % w) - (s % w);
    const dy = Math.floor(i / w) - Math.floor(s / w);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < dist[i]) {
      dist[i] = d;
      near[i] = s;
    }
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x > 0) check(i, i - 1);
      if (y > 0) {
        check(i, i - w);
        if (x > 0) check(i, i - w - 1);
        if (x < w - 1) check(i, i - w + 1);
      }
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (x < w - 1) check(i, i + 1);
      if (y < h - 1) {
        check(i, i + w);
        if (x < w - 1) check(i, i + w + 1);
        if (x > 0) check(i, i + w - 1);
      }
    }
  }
  return { dist, near };
}

// A small binary heap of cells by a score, for A*.
function createHeap() {
  const items = [];
  const keys = [];
  const swap = (a, b) => {
    [items[a], items[b]] = [items[b], items[a]];
    [keys[a], keys[b]] = [keys[b], keys[a]];
  };
  return {
    get size() { return items.length; },
    push(item, key) {
      items.push(item);
      keys.push(key);
      for (let i = items.length - 1; i > 0;) {
        const p = (i - 1) >> 1;
        if (keys[p] <= keys[i]) break;
        swap(p, i);
        i = p;
      }
    },
    pop() {
      const top = items[0];
      const lastItem = items.pop();
      const lastKey = keys.pop();
      if (items.length) {
        items[0] = lastItem;
        keys[0] = lastKey;
        for (let i = 0; ;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < items.length && keys[l] < keys[m]) m = l;
          if (r < items.length && keys[r] < keys[m]) m = r;
          if (m === i) break;
          swap(m, i);
          i = m;
        }
      }
      return top;
    },
  };
}

// The distance from a point to a segment, and the place along it (0 to 1).
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

// Put a point on a line of coordinates (where it is nearest), so that the line goes through it.
function withPoint(line, p) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const d = segDist(p[0], p[1], ...line[i], ...line[i + 1]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return [...line.slice(0, best + 1), p, ...line.slice(best + 1)];
}

// More points on a line, so that no part is longer than `step`.
function dense(line, step) {
  const out = [line[0]];
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

// A line that winds: each point moves to the side by the noise at its place along the line,
// times the weight of the point (0: the point stays).
function wind(line, seed, amp, scale, weight) {
  let s = 0;
  return line.map((p, i) => {
    if (i > 0) s += Math.hypot(p[0] - line[i - 1][0], p[1] - line[i - 1][1]);
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(line.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const off = fbm(seed, s, 0, { scale, octaves: 2 }) * amp * weight(p, i);
    return [p[0] - ((b[1] - a[1]) / len) * off, p[1] + ((b[0] - a[0]) / len) * off];
  });
}

// def: the land of the region ({ anchors, rivers, roads, base, relief, road, wet, blend }). maps:
// the map definitions with their window and stamps. geo: { rivers } of data/geo/vietnam.json and
// heights (heights.js). seed: the seed of the world. hamlets: the rules of the hamlets
// (data/world/scatter.json), or null: their sites are chosen before the paddies
// (src/core/gen/hamlets.js builds them).
export function createLand(def, maps, geo, seed, hamlets = null) {
  const box = regionBox(maps);
  const { x0, y0, w: W, h: H } = box;
  const N = W * H;
  const at = (x, y) => (y - y0) * W + (x - x0);
  const inBox = (x, y) => x >= x0 && y >= y0 && x < x0 + W && y < y0 + H;
  const letter = new Uint8Array(N); // the ground letter of each cell (0: in no map)
  const level = new Int8Array(N); // the height digit
  const fixed = new Uint8Array(N);
  const owner = new Int16Array(N).fill(-1); // the map of each cell
  const sd = (k) => hashSeed(`${seed}:land:${def.id}:${k}`) & 0x7fffffff;
  const warp = createWarp(def.anchors);
  const base = def.base ?? 2;
  const relief = def.relief ?? { low: 16, k: 0.8 };
  // The real height of a cell (meters, 0 where no tile is loaded), and the height of the land
  // there in steps. Each comes from the cell alone.
  const meters = (gx, gy) => geo.heights?.at(...warp.toGeo([gx + 0.5, gy + 0.5])) ?? 0;
  const natural = (gx, gy) => base + stepsOf(meters(gx, gy), relief);

  // The windows and the stamps. A stamp under an anchor with lift rises (all its cells by the same
  // steps) to the height of the real land at the anchor: a story place on a real hill.
  const lifts = [];
  maps.forEach((m, mi) => {
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) owner[at(m.window.x + x, m.window.y + y)] = mi;
    for (const s of m.stamps ?? []) {
      const sx = m.window.x + s.x;
      const sy = m.window.y + s.y;
      const top = def.anchors.find((a) => a.lift && a.cell[0] >= sx && a.cell[1] >= sy && a.cell[0] < sx + s.w && a.cell[1] < sy + s.h);
      const lift = top ? Math.max(0, Math.round(natural(...top.cell) - digit(s.height[top.cell[1] - sy][top.cell[0] - sx]))) : 0;
      if (lift) lifts.push({ map: mi, x: sx, y: sy, w: s.w, h: s.h, lift });
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
        const i = at(sx + x, sy + y);
        letter[i] = s.ground[y].charCodeAt(x);
        level[i] = Math.min(MAX_LEVEL, digit(s.height[y][x]) + lift);
        fixed[i] = FIXED.stamp;
      }
    }
  });
  const toStamp = distanceField(W, H, (i) => fixed[i] === FIXED.stamp);
  const nearStamp = (x, y) => (inBox(x, y) ? toStamp.dist[at(x, y)] : Infinity);
  const smooth = (d, edge) => Math.min(1, Math.max(0, d / edge)) ** 2;

  // The rivers: the real lines, through the warp, with a small seeded bend away from the stamps.
  const riverDist = new Float32Array(N).fill(Infinity);
  const riverOf = new Int8Array(N).fill(-1);
  const rivers = [];
  (def.rivers ?? []).forEach((rv, ri) => {
    const data = geo.rivers.find((r) => r.id === rv.id);
    if (!data) return;
    for (const raw of data.lines) {
      let line = raw;
      for (const a of def.anchors) if (a.river === rv.id) line = withPoint(line, a.at);
      const cells = dense(line, 0.002).map((p) => warp.toCell(p)).filter(([x, y]) => x > x0 - 60 && y > y0 - 60 && x < x0 + W + 60 && y < y0 + H + 60);
      if (cells.length < 2) continue;
      const bent = wind(dense(cells, 1.5), sd(`river:${rv.id}`), rv.bend ?? 3, 40, ([x, y]) => smooth(nearStamp(Math.round(x), Math.round(y)), 16));
      rivers.push({ id: rv.id, line: bent });
      const reach = rv.water / 2 + (rv.bank ?? 2);
      for (let k = 1; k < bent.length; k++) {
        const [ax, ay] = bent[k - 1];
        const [bx, by] = bent[k];
        for (let y = Math.floor(Math.min(ay, by) - reach); y <= Math.ceil(Math.max(ay, by) + reach); y++) {
          for (let x = Math.floor(Math.min(ax, bx) - reach); x <= Math.ceil(Math.max(ax, bx) + reach); x++) {
            if (!inBox(x, y)) continue;
            const i = at(x, y);
            const d = segDist(x + 0.5, y + 0.5, ax, ay, bx, by);
            if (d < riverDist[i]) {
              riverDist[i] = d;
              riverOf[i] = ri;
            }
          }
        }
      }
    }
  });
  for (let i = 0; i < N; i++) {
    if (fixed[i] || riverOf[i] < 0) continue;
    const rv = def.rivers[riverOf[i]];
    if (riverDist[i] < rv.water / 2) {
      letter[i] = CODE.water;
      level[i] = 0;
      fixed[i] = FIXED.river;
    } else if (riverDist[i] < rv.water / 2 + (rv.bank ?? 2)) {
      letter[i] = CODE.sand;
      level[i] = 1;
      fixed[i] = FIXED.river;
    }
  }

  // The height of the free land: the real height, through the curve. Near a stamp the land comes to
  // the height of the edge of the stamp.
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const target = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (owner[i] < 0) continue;
    if (fixed[i]) {
      target[i] = level[i];
      continue;
    }
    const g = natural(x + x0, y + y0);
    const s = toStamp.near[i] >= 0 ? level[toStamp.near[i]] : base;
    // The blend is longer where the land is far from the height of the stamp, so that it is never
    // steeper than about one step for each cell.
    target[i] = s + (g - s) * smooth(toStamp.dist[i], Math.max(def.blend ?? 10, 2.2 * Math.abs(g - s)));
  }
  // Bound the free land near the source cells (the stamps, the water and its banks): at most one
  // step for each cell of distance from them (out to `reach` cells), so that the hero can walk from
  // a source onto the land. Farther away, the land is the real land.
  const bound = (isSource, reach = Infinity) => {
    const lo = new Float32Array(N).fill(-Infinity);
    const hi = new Float32Array(N).fill(Infinity);
    const dist = new Float32Array(N).fill(Infinity);
    const queue = [];
    for (let i = 0; i < N; i++) if (owner[i] >= 0 && isSource(i)) {
      lo[i] = level[i];
      hi[i] = level[i];
      dist[i] = 0;
      queue.push(i);
    }
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      const x = i % W;
      const y = Math.floor(i / W);
      for (const [dx, dy] of NB) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (fixed[j] || owner[j] < 0 || isSource(j) || dist[i] + 1 > reach) continue;
        let changed = false;
        if (lo[i] - 1 > lo[j]) {
          lo[j] = lo[i] - 1;
          changed = true;
        }
        if (hi[i] + 1 < hi[j]) {
          hi[j] = hi[i] + 1;
          changed = true;
        }
        if (dist[i] + 1 < dist[j]) {
          dist[j] = dist[i] + 1;
          changed = true;
        }
        if (changed) queue.push(j);
      }
    }
    return (i, v) => Math.max(lo[i], Math.min(hi[i], v));
  };
  const nearFixed = bound((i) => fixed[i] !== FIXED.none, def.blend ?? 10);
  for (let i = 0; i < N; i++) {
    if (owner[i] < 0 || fixed[i]) continue;
    level[i] = Math.max(1, Math.min(MAX_LEVEL, Math.round(nearFixed(i, target[i]))));
  }

  // The roads: each part between two points of a road is the cheapest way over the land (A*). The
  // way keeps near a line that winds by the seed between the points, and a climb steeper than
  // `steep` steps for each cell costs much more: on a hill the road turns back and forth. Then the
  // road gets its heights: never more than one step from one cell of its line to the next.
  const rules = { steep: 0.7, climb: 40, keep: 0.06, ...(def.road ?? {}) };
  const roadDist = new Float32Array(N).fill(Infinity);
  const roads = [];
  (def.roads ?? []).forEach((rd, ri) => {
    const pts = rd.points;
    const line = dense(pts, 1);
    // The weight of the bend: 0 at each point of the road, 1 halfway to the next.
    const t = (p) => {
      let best = 0;
      for (let j = 0; j + 1 < pts.length; j++) {
        const [ax, ay] = pts[j];
        const [bx, by] = pts[j + 1];
        const l2 = (bx - ax) ** 2 + (by - ay) ** 2;
        const u = l2 ? Math.max(0, Math.min(1, ((p[0] - ax) * (bx - ax) + (p[1] - ay) * (by - ay)) / l2)) : 0;
        if (segDist(p[0], p[1], ax, ay, bx, by) < 1e-3) best = Math.max(best, Math.sin(Math.PI * u));
      }
      return best;
    };
    const bent = wind(line, sd(`road:${ri}`), rd.bend ?? 4, 30, (p) => t(p) * smooth(nearStamp(Math.round(p[0]), Math.round(p[1])), 6));
    // The distance of each cell to the line, in a box around the road (the way stays in it).
    const M = 40;
    const kx0 = Math.max(x0, Math.floor(Math.min(...pts.map((p) => p[0]))) - M);
    const ky0 = Math.max(y0, Math.floor(Math.min(...pts.map((p) => p[1]))) - M);
    const kw = Math.min(x0 + W, Math.ceil(Math.max(...pts.map((p) => p[0]))) + M) - kx0;
    const kh = Math.min(y0 + H, Math.ceil(Math.max(...pts.map((p) => p[1]))) + M) - ky0;
    const onLine = new Uint8Array(kw * kh);
    for (const [px, py] of dense(bent, 0.5)) {
      const kx = Math.floor(px) - kx0;
      const ky = Math.floor(py) - ky0;
      if (kx >= 0 && ky >= 0 && kx < kw && ky < kh) onLine[ky * kw + kx] = 1;
    }
    const near = distanceField(kw, kh, (k) => onLine[k] === 1).dist;
    const keep = (gx, gy) => (gx >= kx0 && gy >= ky0 && gx < kx0 + kw && gy < ky0 + kh ? near[(gy - ky0) * kw + gx - kx0] : Infinity);
    const way = [];
    for (let j = 0; j + 1 < pts.length; j++) {
      const part = route(pts[j], pts[j + 1], keep, rules);
      way.push(...(way.length ? part.slice(1) : part));
    }
    const levels = grade(way);
    roads.push({ id: rd.id ?? `road${ri}`, line: way.map(([x, y]) => [x + 0.5, y + 0.5]), levels });
    // The cells of the road take the height of the nearest cell of its line.
    const half = (rd.width ?? 4) / 2;
    const best = new Float32Array(N).fill(Infinity);
    for (let j = 0; j < way.length; j++) {
      const [ax, ay] = way[j];
      const [bx, by] = way[Math.min(way.length - 1, j + 1)];
      for (let y = Math.floor(Math.min(ay, by) - half - 2); y <= Math.ceil(Math.max(ay, by) + half + 2); y++) {
        for (let x = Math.floor(Math.min(ax, bx) - half - 2); x <= Math.ceil(Math.max(ax, bx) + half + 2); x++) {
          if (!inBox(x, y)) continue;
          const i = at(x, y);
          const d = segDist(x + 0.5, y + 0.5, ax + 0.5, ay + 0.5, bx + 0.5, by + 0.5);
          if (d < roadDist[i]) roadDist[i] = d;
          if (d >= half || fixed[i] === FIXED.stamp || owner[i] < 0 || d >= best[i]) continue;
          best[i] = d;
          if (letter[i] === CODE.water || letter[i] === CODE.bridge) letter[i] = CODE.bridge;
          else {
            letter[i] = CODE.path;
            if (fixed[i] === FIXED.river) fixed[i] = FIXED.none;
            level[i] = levels[j];
          }
        }
      }
    }
  });
  // The land beside a road comes to it (a bank of two cells), so that the hero can step off it.
  const isRoad = (i) => letter[i] === CODE.path && fixed[i] !== FIXED.stamp;
  const bank = bound(isRoad, 2);
  for (let i = 0; i < N; i++) if (owner[i] >= 0 && !fixed[i] && !isRoad(i) && letter[i] !== CODE.bridge) level[i] = bank(i, level[i]);

  // The cheapest way between two cells (eight neighbors). keep(x, y): the distance of a region cell
  // to the line of the road (Infinity: the way does not go there).
  function route(from, to, keep, r) {
    const [fx, fy] = [Math.round(from[0]) - x0, Math.round(from[1]) - y0].map((v, k) => Math.max(0, Math.min((k ? H : W) - 1, v)));
    const [tx, ty] = [Math.round(to[0]) - x0, Math.round(to[1]) - y0].map((v, k) => Math.max(0, Math.min((k ? H : W) - 1, v)));
    const start = fy * W + fx;
    const goal = ty * W + tx;
    const g = new Float32Array(N).fill(Infinity);
    const from_ = new Int32Array(N).fill(-1);
    const done = new Uint8Array(N);
    const heap = createHeap();
    const h = (i) => Math.hypot((i % W) - tx, Math.floor(i / W) - ty);
    g[start] = 0;
    heap.push(start, h(start));
    while (heap.size) {
      const i = heap.pop();
      if (done[i]) continue;
      done[i] = 1;
      if (i === goal) break;
      const x = i % W;
      const y = Math.floor(i / W);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        const k = keep(nx + x0, ny + y0);
        if (owner[j] < 0 || done[j] || k === Infinity) continue;
        const len = dx && dy ? Math.SQRT2 : 1;
        const slope = Math.abs(target[j] - target[i]) / len;
        let c = len * (1 + r.climb * Math.max(0, slope - r.steep) ** 2 + r.keep * k);
        if (fixed[j] === FIXED.stamp) c += len * 8;
        if (letter[j] === CODE.water) c += len * 6;
        if (g[i] + c < g[j]) {
          g[j] = g[i] + c;
          from_[j] = i;
          heap.push(j, g[j] + h(j));
        }
      }
    }
    const out = [];
    for (let i = goal; i >= 0; i = i === start ? -1 : from_[i]) out.push([(i % W) + x0, Math.floor(i / W) + y0]);
    return out.reverse();
  }

  // The heights of the line of a road: near the land under it, with the ends at the land of the
  // ends, and never more than one step from one cell to the next.
  function grade(way) {
    const n = way.length - 1;
    const want = way.map(([x, y]) => (inBox(x, y) ? (fixed[at(x, y)] ? level[at(x, y)] : target[at(x, y)]) : base));
    const s = Math.round(want[0]);
    const e = Math.round(want[n]);
    const out = [s];
    for (let k = 1; k <= n; k++) {
      const lo = Math.max(s - k, e - (n - k), out[k - 1] - 1);
      const hi = Math.min(s + k, e + (n - k), out[k - 1] + 1);
      out.push(Math.max(1, Math.min(MAX_LEVEL, Math.max(lo, Math.min(hi, Math.round(want[k]))))));
    }
    return out;
  }

  // The edge of a map that no other map continues rises in two steps (as the old terraces).
  const closed = (i) => {
    const x = i % W;
    const y = Math.floor(i / W);
    // Near another map (a corner where the edges meet), the land stays level with it.
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && owner[ny * W + nx] >= 0 && owner[ny * W + nx] !== owner[i]) return Infinity;
    }
    let d = Infinity;
    for (const [dx, dy] of NB) {
      for (let k = 1; k <= 2; k++) {
        const nx = x + dx * k;
        const ny = y + dy * k;
        const out = nx < 0 || ny < 0 || nx >= W || ny >= H || owner[ny * W + nx] < 0;
        if (out) {
          d = Math.min(d, k - 1);
          break;
        }
        if (owner[ny * W + nx] !== owner[i]) break;
      }
    }
    return d;
  };
  const edge = new Int8Array(N).fill(-1);
  for (let i = 0; i < N; i++) if (owner[i] >= 0 && !fixed[i]) {
    const d = closed(i);
    if (d <= 1) edge[i] = d;
  }

  const toWater = distanceField(W, H, (i) => letter[i] === CODE.water);

  // The sites of the hamlets: free, nearly level land of one map, away from water, with a road a
  // few cells from the south side (the way into the yard). The choice is local: a candidate every
  // few cells (moved by the seed), and a site where no other good candidate within `spacing` has a
  // higher priority. A site takes its cells first.
  const sites = [];
  if (hamlets) {
    const nearRoad = distanceField(W, H, (i) => letter[i] === CODE.path || letter[i] === CODE.bridge);
    const margin = hamlets.margin ?? 3;
    const hs = hashSeed(`${seed}:hamlets`) & 0x7fffffff;
    const free = (i) => owner[i] >= 0 && !fixed[i] && edge[i] < 0 && !letter[i];
    const good = (sx, sy) => {
      if (sx < 1 || sy < 1 || sx + HAMLET.w + 1 >= W || sy + HAMLET.h + 2 >= H) return false;
      const mi = owner[sy * W + sx];
      if (mi < 0) return false;
      const m = maps[mi];
      const gx = sx + x0;
      const gy = sy + y0;
      if (gx < m.window.x + margin || gy < m.window.y + margin || gx + HAMLET.w > m.window.x + m.width - margin || gy + HAMLET.h > m.window.y + m.height - margin) return false;
      let lo = Infinity;
      let hi = -Infinity;
      for (let y = sy - 1; y <= sy + HAMLET.h; y++) {
        for (let x = sx - 1; x <= sx + HAMLET.w; x++) {
          const i = y * W + x;
          if (owner[i] !== mi || !free(i) || toWater.dist[i] < (hamlets.water?.[0] ?? 4) || toStamp.dist[i] < 4) return false;
          lo = Math.min(lo, level[i]);
          hi = Math.max(hi, level[i]);
        }
      }
      const road = nearRoad.dist[(sy + HAMLET.h + 1) * W + sx + HAMLET.w / 2];
      return hi - lo <= 1 && road >= (hamlets.road?.[0] ?? 2) && road <= (hamlets.road?.[1] ?? 14) && hash2(hs + 1, sx + x0, sy + y0) < (hamlets.chance ?? 1);
    };
    // The candidates: one in each square of four cells, at a place of the seed (region cells).
    const cands = [];
    for (let gy = Math.floor(y0 / 4) * 4; gy < y0 + H; gy += 4) {
      for (let gx = Math.floor(x0 / 4) * 4; gx < x0 + W; gx += 4) {
        const cx = gx + Math.floor(hash2(hs + 2, gx, gy) * 4);
        const cy = gy + Math.floor(hash2(hs + 3, gx, gy) * 4);
        if (good(cx - x0, cy - y0)) cands.push({ x: cx, y: cy, p: hash2(hs, cx, cy) });
      }
    }
    const spacing = hamlets.spacing ?? 30;
    for (const c of cands) {
      if (cands.some((d) => d !== c && Math.hypot(d.x - c.x, d.y - c.y) < spacing && (d.p > c.p || (d.p === c.p && (d.y < c.y || (d.y === c.y && d.x < c.x)))))) continue;
      const mi = owner[(c.y - y0) * W + (c.x - x0)];
      sites.push({ map: mi, x: c.x, y: c.y, w: HAMLET.w, h: HAMLET.h, seed: 1 + Math.floor(hash2(hs + 4, c.x, c.y) * 2147483645) });
    }
    for (const t of sites) for (let y = t.y - y0; y < t.y - y0 + HAMLET.h; y++) for (let x = t.x - x0; x < t.x - x0 + HAMLET.w; x++) fixed[y * W + x] = FIXED.claim;
  }

  // Rice paddies, in blocks of five cells with a dike around each block: on low, wet land near
  // water, never on a road or near a stamp. All cells of a block lie at one level, one step under
  // the dike. Over the low land, paddies are terraces cut into the gentle slopes near a hamlet
  // (wet.terrace: cells from the yard), and the hills keep their forest.
  const DIKE = def.dike ?? 5;
  const wet = { scale: 22, near: 14, over: 0.15, terrace: 18, ...(def.wet ?? {}) };
  const toSite = distanceField(W, H, (i) => fixed[i] === FIXED.claim);
  const fieldBlock = new Map();
  for (let by = Math.floor(y0 / DIKE); by <= Math.floor((y0 + H) / DIKE); by++) {
    for (let bx = Math.floor(x0 / DIKE); bx <= Math.floor((x0 + W) / DIKE); bx++) {
      let lowL = Infinity;
      let highL = -Infinity;
      let ok = true;
      let wetSum = 0;
      for (let y = by * DIKE; y <= by * DIKE + DIKE && ok; y++) {
        for (let x = bx * DIKE; x <= bx * DIKE + DIKE; x++) {
          if (!inBox(x, y)) { ok = false; break; }
          const i = at(x, y);
          if (owner[i] < 0 || fixed[i] || edge[i] >= 0 || letter[i] === CODE.path || letter[i] === CODE.bridge || roadDist[i] < 3 || toStamp.dist[i] < 3) { ok = false; break; }
          lowL = Math.min(lowL, level[i]);
          highL = Math.max(highL, level[i]);
          wetSum += Math.exp(-toWater.dist[i] / wet.near);
        }
      }
      if (!ok || highL - lowL > 1 || lowL < 2) continue;
      const cx = bx * DIKE + DIKE / 2;
      const cy = by * DIKE + DIKE / 2;
      const noise = fbm(sd('wet'), cx, cy, { scale: wet.scale, octaves: 2 });
      if (lowL > base + 1) {
        // A terrace: only near a hamlet.
        if (toSite.dist[at(Math.floor(cx), Math.floor(cy))] <= wet.terrace && noise > -0.4) fieldBlock.set(`${bx},${by}`, lowL);
        continue;
      }
      // Wet: the noise, more near water.
      const score = noise * 0.8 + (wetSum / (DIKE + 1) ** 2) * 1.2 - Math.max(0, lowL - base) * 0.15;
      if (score > wet.over) fieldBlock.set(`${bx},${by}`, lowL);
    }
  }
  const isDike = new Uint8Array(N);
  for (const [key, L] of fieldBlock) {
    const [bx, by] = key.split(',').map(Number);
    for (let y = by * DIKE; y <= by * DIKE + DIKE; y++) for (let x = bx * DIKE; x <= bx * DIKE + DIKE; x++) {
      const i = at(x, y);
      const ring = x % DIKE === 0 || y % DIKE === 0;
      // A dike between two paddies keeps the higher level.
      if (ring) {
        level[i] = isDike[i] ? Math.max(level[i], L) : L;
        letter[i] = CODE.dike;
        isDike[i] = 1;
      } else {
        letter[i] = CODE.field;
        level[i] = L - 1;
      }
    }
  }
  for (let i = 0; i < N; i++) {
    if (owner[i] < 0) continue;
    if (!letter[i]) letter[i] = CODE.grass;
    if (edge[i] >= 0 && letter[i] !== CODE.path && letter[i] !== CODE.water && letter[i] !== CODE.bridge && letter[i] !== CODE.field) level[i] = Math.min(MAX_LEVEL, level[i] + 2 - edge[i]);
  }
  // A rock face: free grass that is two steps or more over a cell next to it (a cliff).
  for (let i = 0; i < N; i++) {
    if (owner[i] < 0 || fixed[i] || edge[i] >= 0 || letter[i] !== CODE.grass) continue;
    const x = i % W;
    const y = Math.floor(i / W);
    for (const [dx, dy] of NB) {
      const nx = x + dx;
      const ny = y + dy;
      const j = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || owner[j] < 0) continue;
      if (level[j] <= level[i] - 2) {
        letter[i] = CODE.rock;
        break;
      }
    }
  }

  const toRoad = distanceField(W, H, (i) => letter[i] === CODE.path || letter[i] === CODE.bridge);
  const toField = distanceField(W, H, (i) => letter[i] === CODE.field);
  return {
    box,
    warp,
    rivers,
    roads,
    // The sites of the hamlets (region cells), with their maps.
    sites,
    // The stamps that rise with a real hill (region cells, and the steps).
    lifts,
    // The real height of a region cell (meters), and the height of the land there before the
    // stamps, the rivers, and the roads change it (steps).
    meters,
    natural,
    // The facts of a region cell, for the scatter rules.
    cell(x, y) {
      if (!inBox(x, y)) return null;
      const i = at(x, y);
      if (owner[i] < 0) return null;
      return {
        letter: String.fromCharCode(letter[i]),
        level: level[i],
        map: owner[i],
        stamp: fixed[i] === FIXED.stamp,
        taken: fixed[i] === FIXED.claim,
        edge: edge[i] >= 0,
        water: toWater.dist[i],
        road: toRoad.dist[i],
        field: toField.dist[i],
        nearStamp: toStamp.dist[i],
      };
    },
    // Claim a free cell for a generated place (a hamlet): it gets this ground letter (and a lower
    // height: drop steps, for a pond), and the scatter leaves it. Return false for a cell that is
    // not free.
    claim(x, y, ground, drop = 0) {
      if (!inBox(x, y)) return false;
      const i = at(x, y);
      if (owner[i] < 0 || fixed[i] === FIXED.stamp) return false;
      letter[i] = ground.charCodeAt(0);
      level[i] = Math.max(0, level[i] - drop);
      fixed[i] = FIXED.claim;
      return true;
    },
    // The ground and the height rows of a map (its window).
    rows(m) {
      const ground = [];
      const height = [];
      for (let y = 0; y < m.height; y++) {
        let g = '';
        let hgt = '';
        for (let x = 0; x < m.width; x++) {
          const i = at(m.window.x + x, m.window.y + y);
          g += String.fromCharCode(letter[i]);
          hgt += Math.max(0, Math.min(MAX_LEVEL, level[i])).toString(36);
        }
        ground.push(g);
        height.push(hgt);
      }
      return { ground, height };
    },
  };
}
