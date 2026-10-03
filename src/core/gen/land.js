// The land of a region: one continuous ground for all its maps. Each map is a window on the region
// plane (cells, x to the east, y to the south). The story places of a map are stamps: hand-made
// ground that stays. Around them, rules make the land from the real geography and the seed:
//   - the warp (warp.js) puts the real rivers of data/geo/vietnam.json into the plane, through
//     the rivers of the stamps;
//   - the real elevation lifts the land, and seeded noise makes the hills;
//   - roads join the roads of the stamps across the edges of the maps;
//   - rice paddies lie on low, wet land, in blocks with dikes; on a slope they are terraces;
//   - the land is gentle: the hero can walk from each cell to the next (one step up or down).
// The same seed gives the same land. Pure functions, no DOM.
import { createWarp } from './warp.js';
import { fbm } from './noise.js';
import { hashSeed } from '../rng.js';

export const LETTER = Object.freeze({ grass: '.', path: '=', sand: '_', water: '~', field: 'f', dike: 'd', bridge: 'B' });
const CODE = Object.fromEntries(Object.entries(LETTER).map(([k, v]) => [k, v.charCodeAt(0)]));
const FIXED = { none: 0, stamp: 1, river: 2 };

// The height of the real land at a coordinate, in steps of the elevation grid (10 m), bilinear.
export function elevationAt(e, [lon, lat]) {
  const fx = (lon - e.lon0) / e.step;
  const fy = (e.lat1 - lat) / e.step;
  const at = (x, y) => e.data[Math.max(0, Math.min(e.rows - 1, y))][Math.max(0, Math.min(e.cols - 1, x))];
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
}

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

// def: the land of the region ({ anchors, rivers, roads, base, hills, wet, blend }). maps: the map
// definitions with their window and stamps. geo: { rivers, elevation } of data/geo/vietnam.json.
// seed: the seed of the world.
export function createLand(def, maps, geo, seed) {
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

  // The windows and the stamps.
  maps.forEach((m, mi) => {
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) owner[at(m.window.x + x, m.window.y + y)] = mi;
    for (const s of m.stamps ?? []) {
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
        const i = at(m.window.x + s.x + x, m.window.y + s.y + y);
        letter[i] = s.ground[y].charCodeAt(x);
        level[i] = Number(s.height[y][x]);
        fixed[i] = FIXED.stamp;
      }
    }
  });
  const toStamp = distanceField(W, H, (i) => fixed[i] === FIXED.stamp);
  const nearStamp = (x, y) => (inBox(x, y) ? toStamp.dist[at(x, y)] : Infinity);
  const smooth = (d, edge) => Math.min(1, Math.max(0, d / edge)) ** 2;

  // The rivers: the real lines, through the warp, with a small seeded bend away from the stamps.
  const warp = createWarp(def.anchors);
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

  // The roads: lines through their points, with a seeded bend between the points.
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
    roads.push({ id: rd.id ?? `road${ri}`, line: bent });
    const half = (rd.width ?? 4) / 2;
    for (let j = 1; j < bent.length; j++) {
      const [ax, ay] = bent[j - 1];
      const [bx, by] = bent[j];
      for (let y = Math.floor(Math.min(ay, by) - half - 2); y <= Math.ceil(Math.max(ay, by) + half + 2); y++) {
        for (let x = Math.floor(Math.min(ax, bx) - half - 2); x <= Math.ceil(Math.max(ax, bx) + half + 2); x++) {
          if (!inBox(x, y)) continue;
          const i = at(x, y);
          const d = segDist(x + 0.5, y + 0.5, ax, ay, bx, by);
          if (d < roadDist[i]) roadDist[i] = d;
          if (d < half && fixed[i] !== FIXED.stamp) {
            if (letter[i] === CODE.water) letter[i] = CODE.bridge;
            else if (letter[i] !== CODE.bridge) {
              letter[i] = CODE.path;
              if (fixed[i] === FIXED.river) fixed[i] = FIXED.none;
            }
          }
        }
      }
    }
  });

  // The height of the free land: the real elevation, and hills from the noise. Near a stamp the
  // land comes to the height of the edge of the stamp.
  const base = def.base ?? 2;
  const ref = elevationAt(geo.elevation, def.anchors[0].at);
  const hills = def.hills ?? { scale: 40, amp: 1.2, rise: 1, more: 0.8 };
  const target = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (owner[i] < 0 || fixed[i]) continue;
    const gx = x + x0;
    const gy = y + y0;
    const e = elevationAt(geo.elevation, warp.toGeo([gx + 0.5, gy + 0.5])) - ref;
    const amp = hills.amp * (1 + Math.max(0, e) * hills.more);
    let g = base + Math.max(0, e) * hills.rise + Math.max(0, fbm(sd('hills'), gx, gy, { scale: hills.scale, octaves: 3 })) * amp * 2;
    const s = toStamp.near[i] >= 0 ? level[toStamp.near[i]] : base;
    g = s + (g - s) * smooth(toStamp.dist[i], def.blend ?? 10);
    target[i] = g;
  }

  // The land is gentle. A cell of free land is at most one step from the fixed cells near it
  // (stamps, water, banks) for each cell of distance, and from its neighbors.
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const lo = new Float32Array(N).fill(-Infinity);
  const hi = new Float32Array(N).fill(Infinity);
  const queue = [];
  for (let i = 0; i < N; i++) if (fixed[i] && owner[i] >= 0) {
    lo[i] = level[i];
    hi[i] = level[i];
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
      if (fixed[j] || owner[j] < 0) continue;
      let changed = false;
      if (lo[i] - 1 > lo[j]) {
        lo[j] = lo[i] - 1;
        changed = true;
      }
      if (hi[i] + 1 < hi[j]) {
        hi[j] = hi[i] + 1;
        changed = true;
      }
      if (changed) queue.push(j);
    }
  }
  for (let i = 0; i < N; i++) {
    if (owner[i] < 0 || fixed[i]) continue;
    level[i] = Math.max(1, Math.min(8, Math.round(Math.max(lo[i], Math.min(hi[i], target[i])))));
  }
  // Lower each free cell until no neighbor is more than one step under it. A paddy is water: it
  // does not count.
  const relax = (free) => {
    for (let changed = true; changed;) {
      changed = false;
      for (let i = 0; i < N; i++) {
        if (owner[i] < 0 || !free(i)) continue;
        const x = i % W;
        const y = Math.floor(i / W);
        let min = Infinity;
        for (const [dx, dy] of NB) {
          const nx = x + dx;
          const ny = y + dy;
          const j = ny * W + nx;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || owner[j] < 0 || letter[j] === CODE.field) continue;
          min = Math.min(min, level[j]);
        }
        if (level[i] > min + 1) {
          level[i] = min + 1;
          changed = true;
        }
      }
    }
  };
  relax((i) => !fixed[i]);

  // The edge of a map that no other map continues rises in two steps (as the old terraces).
  const closed = (i) => {
    const x = i % W;
    const y = Math.floor(i / W);
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

  // Rice paddies, in blocks of five cells with a dike around each block: on low, wet land near
  // water, never on a road or near a stamp. All cells of a block lie at one level, one step under
  // the dike; blocks on a slope make terraces.
  const DIKE = def.dike ?? 5;
  const wet = def.wet ?? { scale: 22, near: 14, over: 0.15 };
  const toWater = distanceField(W, H, (i) => letter[i] === CODE.water);
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
      // Wet: the noise, more near water, less on high land.
      const score = fbm(sd('wet'), cx, cy, { scale: wet.scale, octaves: 2 }) * 0.8 + (wetSum / (DIKE + 1) ** 2) * 1.2 - Math.max(0, lowL - base) * 0.15;
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
  // A dike can be lower than the land next to it: that land comes down to it.
  relax((i) => !fixed[i] && !isDike[i] && letter[i] !== CODE.field);
  for (let i = 0; i < N; i++) {
    if (owner[i] < 0) continue;
    if (!letter[i]) letter[i] = CODE.grass;
    if (edge[i] >= 0 && letter[i] !== CODE.path && letter[i] !== CODE.water && letter[i] !== CODE.bridge && letter[i] !== CODE.field) level[i] = Math.min(9, level[i] + 2 - edge[i]);
  }

  const toRoad = distanceField(W, H, (i) => letter[i] === CODE.path || letter[i] === CODE.bridge);
  const toField = distanceField(W, H, (i) => letter[i] === CODE.field);
  return {
    box,
    warp,
    rivers,
    roads,
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
        edge: edge[i] >= 0,
        water: toWater.dist[i],
        road: toRoad.dist[i],
        field: toField.dist[i],
        nearStamp: toStamp.dist[i],
      };
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
          hgt += String(Math.max(0, Math.min(9, level[i])));
        }
        ground.push(g);
        height.push(hgt);
      }
      return { ground, height };
    },
  };
}
