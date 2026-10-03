// The land of the plane, tile by tile. The plane is one continuous land for the whole country
// (plane.js). The story places are stamps at their real places; around them, rules make the land
// from the real geography and the seed:
//   - the real heights (heights.js) through a concave curve; a stamp on a real hill rises with it;
//   - the real rivers (data/geo/vietnam.json), bent near a stamp to meet the river of the stamp;
//   - roads between the stamps, never steeper than one step for each cell (on a hill they turn
//     back and forth);
//   - rock faces where the land is steeper than one step for each cell;
//   - hamlets, rice paddies on the low wet land (terraces near a hamlet), and the scatter of things.
// A tile is TILE x TILE cells. It is made from a window with PAD cells more on each side, and every
// fact of a cell reads only the land within PAD cells of it, so the same seed and the same tile give
// the same land, whatever tile was made before. The roads and the rivers are lines of the whole
// region (made one time for a seed, from the data only). Pure functions, no DOM.
import { createPlane, frameOrigins } from './plane.js';
import { fbm, hash2 } from './noise.js';
import { stepsOf, tileOf } from './heights.js';
import { distanceField, createHeap, segDist, dense, wind } from './geom.js';
import { hamletOf } from './hamlets.js';
import { hashSeed } from '../rng.js';

export const TILE = 64;
const PAD = 56;
const CAP = 16; // distances are capped (cells): no rule reads farther
const SITE = 32; // one hamlet site at most in each square of SITE cells (two squares in a tile side)
export const HAMLET = Object.freeze({ w: 22, h: 16 });
export const LETTER = Object.freeze({ grass: '.', path: '=', sand: '_', water: '~', field: 'f', dike: 'd', bridge: 'B', rock: 'r', yard: 'y', hedge: 'h', surf: ':', sea: '^', shallow: 's', bamboo: 'k' });
const CODE = Object.fromEntries(Object.entries(LETTER).map(([k, v]) => [k, v.charCodeAt(0)]));
const FIXED = { none: 0, stamp: 1, river: 2, claim: 3, sea: 4 };
const SURF = 3; // cells of shallow sea (to the knee) next to the land; farther, the sea is deep
const SEA_LOW = 5; // meters: a cell out of all rings of the land is sea only when the land there is this low
// Where a road crosses a river: a river this wide or less is a ford (shallow water to walk through),
// a river this wide or more has a ferry (a boat at a landing on each bank), and a river between
// them has a bamboo bridge (cells of water across).
export const CROSSING = Object.freeze({ ford: 6, ferry: 14 });
const crossingOf = (water) => (water >= CROSSING.ferry ? 'ferry' : water <= CROSSING.ford ? 'ford' : 'bamboo');
// A height is one digit of base 36 in the height rows (0 to 9, then a to z).
export const MAX_LEVEL = 35;
export const digit = (ch) => parseInt(ch, 36);
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const smooth = (d, edge) => Math.min(1, Math.max(0, d / edge)) ** 2;

// def: the land file (data/world/land-<region>.json): { plane, frames, base, relief, blend, road,
// wet, dike, rivers, pins, roads }. places: the map files of the region (stamps and story data in
// the cells of their frames). geo: { rivers (data/geo/vietnam.json), heights (heights.js) }. rules:
// data/world/scatter.json. parts: the parts of the villagers (data/figures.json), or null.
export function createLandPlane(def, places, geo, seed, rules = {}, parts = null) {
  const plane = createPlane(def.plane);
  const origins = frameOrigins(plane, def.frames ?? []);
  const toPlane = ([f, x, y]) => {
    const o = origins.get(f);
    return o ? [x + o[0], y + o[1]] : [x, y];
  };
  const sd = (k) => hashSeed(`${seed}:land:${def.id}:${k}`) & 0x7fffffff;
  const base = def.base ?? 2;
  const relief = def.relief ?? { low: 16, k: 0.8 };
  const blend = def.blend ?? 10;
  // The real height of a cell (meters, 0 where no tile is loaded), and the land there in steps.
  const meters = (x, y) => geo.heights?.at(...plane.toGeo([x + 0.5, y + 0.5])) ?? 0;
  const natural = (x, y) => base + stepsOf(Math.max(0, meters(x, y)), relief);

  // The stamps on the plane. A stamp under a frame anchor with lift rises (all its cells by the
  // same steps) to the height of the real land at the anchor.
  const stamps = [];
  for (const p of places) {
    const o = origins.get(p.id);
    if (!o) continue;
    const frame = (def.frames ?? []).find((f) => f.id === p.id);
    for (const s of p.stamps ?? []) {
      const x = o[0] + s.x;
      const y = o[1] + s.y;
      let lift = 0;
      if (frame?.lift) {
        const [ax, ay] = toPlane([p.id, ...frame.cell]);
        if (ax >= x && ay >= y && ax < x + s.w && ay < y + s.h) lift = Math.max(0, Math.round(natural(ax, ay) - digit(s.height[ay - y][ax - x])));
      }
      stamps.push({ place: p.id, x, y, w: s.w, h: s.h, ground: s.ground, height: s.height, lift });
    }
  }
  const stampDist = (px, py) => {
    let d = Infinity;
    for (const s of stamps) d = Math.min(d, Math.hypot(Math.max(s.x - px, 0, px - s.x - s.w), Math.max(s.y - py, 0, py - s.y - s.h)));
    return d;
  };
  const stampAt = (x, y) => stamps.find((s) => x >= s.x && y >= s.y && x < s.x + s.w && y < s.y + s.h) ?? null;
  const stampLevel = (s, x, y) => Math.min(MAX_LEVEL, digit(s.height[y - s.y][x - s.x]) + s.lift);

  // The coast and the borders: the rings of the land (data/geo/vietnam.json) on the plane, by bands
  // of rows, so that a row finds the edges that cross it fast. Vietnam is the land of the eras; the
  // land of the other countries is the land of no era (mist). The south line of the land of the era
  // (eraLand, a latitude) is a row of the plane (Mercator keeps a latitude on one row).
  const BAND = 16;
  const ringBands = { vn: new Map(), other: new Map() };
  for (const [code, list] of Object.entries(geo.land ?? {})) {
    const bands = code === 'VNM' ? ringBands.vn : ringBands.other;
    for (const ring of list) {
      const pts = ring.map((p) => plane.toCell(p));
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k];
        const b = pts[(k + 1) % pts.length];
        if (a[1] === b[1]) continue;
        for (let band = Math.floor(Math.min(a[1], b[1]) / BAND); band <= Math.floor(Math.max(a[1], b[1]) / BAND); band++) {
          if (!bands.has(band)) bands.set(band, []);
          bands.get(band).push([a[0], a[1], b[0], b[1]]);
        }
      }
    }
  }
  // The x of the edges that cross the middle of a row, in order.
  const crossings = (bands, row) => {
    const yc = row + 0.5;
    const xs = [];
    for (const [ax, ay, bx, by] of bands.get(Math.floor(yc / BAND)) ?? []) if ((ay > yc) !== (by > yc)) xs.push(ax + ((bx - ax) * (yc - ay)) / (by - ay));
    return xs.sort((p, q) => p - q);
  };
  // Is x inside the rings on a row? (an odd count of edges to the east of x)
  const insideRow = (xs, x) => {
    let lo = 0;
    let hi = xs.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (xs[m] <= x) lo = m + 1;
      else hi = m;
    }
    return (xs.length - lo) % 2 === 1;
  };
  // The south line of the land of the era follows the range of mountains near eraLand (the
  // Hoành Sơn at 18° N in Era 1), not a straight row: for each column, the crest of the highest
  // land within ERA.band degrees of the line (a crest nearer the line is better), smoothed over the
  // columns near it. The land of the era ends ERA.before cells before the crest, so that the land
  // rises to the mountains and the mist lies on them and past them. The crests come from the height
  // grid only, so the line is the same for every tile.
  const ERA = { band: 0.35, step: 0.005, median: 15, smooth: 8, before: 6 };
  const era = def.eraLand;
  const crests = new Map(); // a column of the height grid -> the latitude of its crest
  const medians = new Map();
  const crestOf = (k) => {
    if (crests.has(k)) return crests.get(k);
    const lon = k * ERA.step;
    let best = era;
    let score = -Infinity;
    for (let lat = era + ERA.band; lat >= era - ERA.band - 1e-9; lat -= ERA.step) {
      const m = geo.heights?.at(lon, lat) ?? 0;
      const v = m - (300 * Math.abs(lat - era)) / ERA.band;
      if (m > 0 && v > score) {
        score = v;
        best = lat;
      }
    }
    crests.set(k, best);
    return best;
  };
  const eraRows = new Map(); // a column of the plane -> the first row out of the land of the era
  const eraRowOf = (x) => {
    if (era === undefined) return Infinity;
    if (eraRows.has(x)) return eraRows.get(x);
    const lon = plane.toGeo([x + 0.5, 0])[0];
    const f = lon / ERA.step;
    const k0 = Math.floor(f);
    // A median first (a crest that jumps to another ridge for a few columns does not count), then
    // a mean.
    const median = (k) => {
      if (medians.has(k)) return medians.get(k);
      const list = [];
      for (let d = -ERA.median; d <= ERA.median; d++) list.push(crestOf(k + d));
      const m = list.sort((p, q) => p - q)[ERA.median];
      medians.set(k, m);
      return m;
    };
    const smooth = (k) => {
      let sum = 0;
      for (let d = -ERA.smooth; d <= ERA.smooth; d++) sum += median(k + d);
      return sum / (2 * ERA.smooth + 1);
    };
    const lat = smooth(k0) * (1 - (f - k0)) + smooth(k0 + 1) * (f - k0);
    const row = Math.floor(plane.toCell([lon, lat])[1]) - ERA.before;
    eraRows.set(x, row);
    return row;
  };
  // The rows of the band of the crests (with the cells before them), for the height tiles a tile
  // needs.
  const eraBand = era === undefined ? null : [plane.toCell([0, era + ERA.band])[1] - ERA.before - CAP, plane.toCell([0, era - ERA.band])[1] + CAP];
  const BORDER = 12; // cells: near a border, a ridge top of the land of the era is mist too

  // The segments of the lines (rivers, roads) by tile, so that a window finds its segments fast.
  const bucketKey = (bx, by) => `${bx},${by}`;
  const index = (segs, reach) => {
    const map = new Map();
    segs.forEach((g, k) => {
      for (let by = Math.floor((Math.min(g[1], g[3]) - reach) / TILE); by <= Math.floor((Math.max(g[1], g[3]) + reach) / TILE); by++) {
        for (let bx = Math.floor((Math.min(g[0], g[2]) - reach) / TILE); bx <= Math.floor((Math.max(g[0], g[2]) + reach) / TILE); bx++) {
          const key = bucketKey(bx, by);
          if (!map.has(key)) map.set(key, []);
          map.get(key).push(k);
        }
      }
    });
    return map;
  };
  // The segments near a window (the tile and its eight neighbors cover the window).
  const near = (idx, tx, tz) => {
    const out = new Set();
    for (let by = tz - 1; by <= tz + 1; by++) for (let bx = tx - 1; bx <= tx + 1; bx++) for (const k of idx.get(bucketKey(bx, by)) ?? []) out.add(k);
    return [...out];
  };

  // The rivers: the real lines on the plane, pulled through the pins (the ends of the rivers of the
  // stamps), with a small seeded bend away from the stamps.
  const widthOf = (id) => ({ water: 8, bank: 2, bend: 3, ...((def.rivers ?? []).find((r) => r.id === id) ?? {}) });
  // A branch (from: the id of its main river) begins on the line of its main river.
  const rivers = [];
  const lines = new Map();
  const order = [...(geo.rivers ?? [])].sort((a, b) => Number(Boolean(widthOf(a.id).from)) - Number(Boolean(widthOf(b.id).from)));
  for (const data of order) {
    const w = widthOf(data.id);
    const pins = (def.pins ?? []).filter((p) => p.river === data.id).map((p) => toPlane([p.frame, ...p.cell]));
    for (const raw of data.lines) {
      let line = dense(raw, 0.004).map((p) => plane.toCell(p));
      if (pins.length) line = pull(line, pins, 160);
      line = wind(dense(line, 1.5), sd(`river:${data.id}`), w.bend, 40, ([x, y]) => smooth(stampDist(x, y), 16));
      const main = w.from ? lines.get(w.from) : null;
      if (main) {
        let best = main[0];
        for (const q of main) if (Math.hypot(q[0] - line[0][0], q[1] - line[0][1]) < Math.hypot(best[0] - line[0][0], best[1] - line[0][1])) best = q;
        line = [...dense([best, line[0]], 1.5).slice(0, -1), ...line];
      }
      if (!lines.has(data.id)) lines.set(data.id, line);
      const segs = [];
      for (let k = 1; k < line.length; k++) segs.push([line[k - 1][0], line[k - 1][1], line[k][0], line[k][1]]);
      const reach = w.water / 2 + w.bank;
      rivers.push({ id: data.id, ...w, reach, segs, index: index(segs, reach + 1) });
    }
  }

  // The roads (made one time, when a tile first needs them): each part between two points is the
  // cheapest way over the land (A*), near a line that winds by the seed; a climb steeper than
  // `steep` steps for each cell costs much more. The line gets its heights: never more than one
  // step from one cell to the next, with the ends at the land of the ends.
  const roadRules = { steep: 0.7, climb: 40, keep: 0.06, ...(def.road ?? {}) };
  let roads = null;
  const ferries = [];
  // The river of a cell (the nearest line of a river that holds the cell in its water), or null.
  const riverAt = (x, y) => {
    let best = null;
    let bd = Infinity;
    for (const r of rivers) {
      for (const k of near(r.index, Math.floor(x / TILE), Math.floor(y / TILE))) {
        const [ax, ay, bx, by] = r.segs[k];
        const d = segDist(x + 0.5, y + 0.5, ax, ay, bx, by);
        if (d < r.water / 2 && d < bd) {
          bd = d;
          best = r;
        }
      }
    }
    return best;
  };
  // The ferries of a road: for each run of its cells in the water of a river with a ferry, the
  // spots of the boat at both ends of the run (on the water), the cells of the banks where the
  // hero calls the boat (step), and the places where the riders step off (land), a little farther
  // from the water (plane cells, the middle of a cell).
  function ferriesOf(id, way) {
    const out = [];
    let k = 0;
    while (k < way.length) {
      const r = riverAt(way[k][0], way[k][1]);
      if (!r || crossingOf(r.water) !== 'ferry') {
        k += 1;
        continue;
      }
      let e = k;
      while (e + 1 < way.length && riverAt(way[e + 1][0], way[e + 1][1]) === r) e += 1;
      const at = (j) => {
        const q = way[Math.max(0, Math.min(way.length - 1, j))];
        return { x: q[0] + 0.5, y: q[1] + 0.5 };
      };
      if (k > 3 && e < way.length - 4) out.push({ id: `${id}:${r.id}:${k}`, river: r.id, a: at(k + 1), b: at(e - 1), stepA: at(k - 2), stepB: at(e + 2), landA: at(k - 4), landB: at(e + 4) });
      k = e + 1;
    }
    return out;
  }
  const roadTarget = (x, y) => {
    const s = stampAt(x, y);
    return s ? stampLevel(s, x, y) : natural(x, y);
  };
  function makeRoads() {
    roads = [];
    (def.roads ?? []).forEach((rd, ri) => {
      const pts = rd.points.map(toPlane);
      const way = [];
      for (let j = 0; j + 1 < pts.length; j++) {
        const part = routeRoad(pts[j], pts[j + 1], rd, ri);
        way.push(...(way.length ? part.slice(1) : part));
      }
      const want = way.map(([x, y]) => roadTarget(x, y));
      const n = way.length - 1;
      const s = Math.round(want[0]);
      const e = Math.round(want[n]);
      const levels = [s];
      for (let k = 1; k <= n; k++) {
        const lo = Math.max(s - k, e - (n - k), levels[k - 1] - 1);
        const hi = Math.min(s + k, e + (n - k), levels[k - 1] + 1);
        levels.push(Math.max(1, Math.min(MAX_LEVEL, Math.max(lo, Math.min(hi, Math.round(want[k]))))));
      }
      const segs = [];
      for (let k = 0; k < way.length; k++) {
        const b = way[Math.min(way.length - 1, k + 1)];
        segs.push([way[k][0] + 0.5, way[k][1] + 0.5, b[0] + 0.5, b[1] + 0.5]);
      }
      const half = (rd.width ?? 4) / 2;
      const id = rd.id ?? `road${ri}`;
      roads.push({ id, half, line: way.map(([x, y]) => [x + 0.5, y + 0.5]), levels, segs, index: index(segs, half + 3) });
      ferries.push(...ferriesOf(id, way));
    });
  }
  function routeRoad(from, to, rd, ri) {
    const M = 40;
    const bx0 = Math.floor(Math.min(from[0], to[0])) - M;
    const by0 = Math.floor(Math.min(from[1], to[1])) - M;
    const W = Math.ceil(Math.max(from[0], to[0])) + M - bx0;
    const H = Math.ceil(Math.max(from[1], to[1])) + M - by0;
    const N = W * H;
    const target = new Float32Array(N);
    const water = new Uint8Array(N);
    const stamp = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const s = stampAt(x + bx0, y + by0);
      target[y * W + x] = s ? stampLevel(s, x + bx0, y + by0) : natural(x + bx0, y + by0);
      if (s) stamp[y * W + x] = 1;
    }
    for (const r of rivers) {
      for (const [ax, ay, cx, cy] of r.segs) {
        if (Math.max(ax, cx) < bx0 - r.water || Math.min(ax, cx) > bx0 + W + r.water || Math.max(ay, cy) < by0 - r.water || Math.min(ay, cy) > by0 + H + r.water) continue;
        for (let y = Math.max(0, Math.floor(Math.min(ay, cy) - r.water) - by0); y <= Math.min(H - 1, Math.ceil(Math.max(ay, cy) + r.water) - by0); y++) {
          for (let x = Math.max(0, Math.floor(Math.min(ax, cx) - r.water) - bx0); x <= Math.min(W - 1, Math.ceil(Math.max(ax, cx) + r.water) - bx0); x++) {
            if (segDist(x + bx0 + 0.5, y + by0 + 0.5, ax, ay, cx, cy) < r.water / 2) water[y * W + x] = 1;
          }
        }
      }
    }
    // The line of the road winds by the seed between its two points (not at the points).
    const line = dense([from, to], 1);
    const bent = wind(line, sd(`road:${ri}:${from[0]},${from[1]}`), rd.bend ?? 4, 30, (p, i) => Math.sin((Math.PI * i) / Math.max(1, line.length - 1)) * smooth(stampDist(p[0], p[1]), 6));
    const onLine = new Uint8Array(N);
    for (const [px, py] of dense(bent, 0.5)) {
      const x = Math.floor(px) - bx0;
      const y = Math.floor(py) - by0;
      if (x >= 0 && y >= 0 && x < W && y < H) onLine[y * W + x] = 1;
    }
    const keep = distanceField(W, H, (i) => onLine[i] === 1).dist;
    const r = roadRules;
    const clampI = (v, max) => Math.max(0, Math.min(max - 1, v));
    const start = clampI(Math.round(from[1]) - by0, H) * W + clampI(Math.round(from[0]) - bx0, W);
    const goal = clampI(Math.round(to[1]) - by0, H) * W + clampI(Math.round(to[0]) - bx0, W);
    const gx = goal % W;
    const gy = Math.floor(goal / W);
    const g = new Float32Array(N).fill(Infinity);
    const back = new Int32Array(N).fill(-1);
    const done = new Uint8Array(N);
    const heap = createHeap();
    const h = (i) => Math.hypot((i % W) - gx, Math.floor(i / W) - gy);
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
        if (done[j]) continue;
        const len = dx && dy ? Math.SQRT2 : 1;
        const slope = Math.abs(target[j] - target[i]) / len;
        let c = len * (1 + r.climb * Math.max(0, slope - r.steep) ** 2 + r.keep * keep[j]);
        if (stamp[j]) c += len * 8;
        if (water[j]) c += len * 6;
        if (g[i] + c < g[j]) {
          g[j] = g[i] + c;
          back[j] = i;
          heap.push(j, g[j] + h(j));
        }
      }
    }
    const out = [];
    for (let i = goal; i >= 0; i = i === start ? -1 : back[i]) out.push([(i % W) + bx0, Math.floor(i / W) + by0]);
    return out.reverse();
  }

  // The tiles, made when they are first asked for (the last ones stay).
  const cache = new Map();
  const MAX_TILES = 256;
  const keyOf = (tx, tz) => tx * 65536 + tz;
  function tile(tx, tz) {
    const key = keyOf(tx, tz);
    let t = cache.get(key);
    if (t) {
      cache.delete(key);
      cache.set(key, t);
      return t;
    }
    if (!roads) makeRoads();
    t = makeTile(tx, tz);
    cache.set(key, t);
    if (cache.size > MAX_TILES) cache.delete(cache.keys().next().value);
    return t;
  }

  function makeTile(tx, tz) {
    const W = TILE + 2 * PAD;
    const N = W * W;
    const X0 = tx * TILE - PAD;
    const Z0 = tz * TILE - PAD;
    const letter = new Uint8Array(N);
    const level = new Int8Array(N);
    const fixed = new Uint8Array(N);
    const plx = (i) => (i % W) + X0;
    const plz = (i) => Math.floor(i / W) + Z0;

    // The stamps.
    for (const s of stamps) {
      if (s.x >= X0 + W || s.y >= Z0 + W || s.x + s.w <= X0 || s.y + s.h <= Z0) continue;
      for (let y = Math.max(s.y, Z0); y < Math.min(s.y + s.h, Z0 + W); y++) {
        for (let x = Math.max(s.x, X0); x < Math.min(s.x + s.w, X0 + W); x++) {
          const i = (y - Z0) * W + (x - X0);
          letter[i] = s.ground[y - s.y].charCodeAt(x - s.x);
          level[i] = stampLevel(s, x, y);
          fixed[i] = FIXED.stamp;
        }
      }
    }
    const toStamp = distanceField(W, W, (i) => fixed[i] === FIXED.stamp);
    // The sea and the land of no era. A cell is sea when it is out of all rings of the land and low
    // (a small gap between the rings of two countries in the hills stays land); the coast wobbles by
    // the seed. Land of another country, and land south of the line of the era, is mist.
    const SEA = 1;
    const FOREIGN = 2;
    const kindOf = new Uint8Array(N);
    if (geo.land) {
      const rows = new Map();
      const rowOf = (row) => {
        if (!rows.has(row)) rows.set(row, { vn: crossings(ringBands.vn, row), other: crossings(ringBands.other, row) });
        return rows.get(row);
      };
      const wob = sd('coast');
      for (let i = 0; i < N; i++) {
        const x = plx(i);
        const y = plz(i);
        const r = rowOf(Math.round(y + 5 * fbm(wob + 1, x, y, { scale: 24, octaves: 2 })));
        const xx = x + 0.5 + 5 * fbm(wob, x, y, { scale: 24, octaves: 2 });
        const vn = insideRow(r.vn, xx);
        const other = !vn && insideRow(r.other, xx);
        if (!vn && !other && meters(x, y) <= SEA_LOW) kindOf[i] = SEA;
        else if (other) kindOf[i] = FOREIGN;
      }
    }
    const toLand = distanceField(W, W, (i) => kindOf[i] !== SEA);
    const toSea = distanceField(W, W, (i) => kindOf[i] === SEA);
    // Near a border with another country, the mist follows the ridges where it can: a cell of the
    // land of the era within BORDER cells of the border is mist when it is a ridge top (the
    // highest cell within 4 cells of it, and at least 4 steps over the base).
    const toForeign = distanceField(W, W, (i) => kindOf[i] === FOREIGN);
    let ridge = null;
    if (toForeign.dist.some((d) => d > 0 && d <= BORDER)) {
      const nat = new Float32Array(N);
      for (let i = 0; i < N; i++) nat[i] = toForeign.dist[i] <= BORDER + 4 ? natural(plx(i), plz(i)) : 0;
      ridge = new Uint8Array(N);
      for (let i = 0; i < N; i++) {
        if (kindOf[i] || toForeign.dist[i] > BORDER || nat[i] < base + 4) continue;
        const x = i % W;
        const y = Math.floor(i / W);
        let top = true;
        for (let dy = -4; dy <= 4 && top; dy++) for (let dx = -4; dx <= 4; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < W && nat[yy * W + xx] > nat[i]) {
            top = false;
            break;
          }
        }
        if (top) ridge[i] = 1;
      }
    }
    const toEra = distanceField(W, W, (i) => kindOf[i] !== FOREIGN && plz(i) < eraRowOf(plx(i)) && !(ridge && ridge[i]));
    for (let i = 0; i < N; i++) {
      if (kindOf[i] !== SEA || fixed[i]) continue;
      const surf = toLand.dist[i] <= SURF;
      letter[i] = surf ? CODE.surf : CODE.sea;
      level[i] = surf ? 1 : 0;
      fixed[i] = FIXED.sea;
    }

    // The rivers: water, and a bank of sand.
    const riverDist = new Float32Array(N).fill(Infinity);
    const riverOf = new Int16Array(N).fill(-1);
    rivers.forEach((r, ri) => {
      for (const k of near(r.index, tx, tz)) {
        const [ax, ay, bx, by] = r.segs[k];
        for (let y = Math.max(Z0, Math.floor(Math.min(ay, by) - r.reach)); y <= Math.min(Z0 + W - 1, Math.ceil(Math.max(ay, by) + r.reach)); y++) {
          for (let x = Math.max(X0, Math.floor(Math.min(ax, bx) - r.reach)); x <= Math.min(X0 + W - 1, Math.ceil(Math.max(ax, bx) + r.reach)); x++) {
            const i = (y - Z0) * W + (x - X0);
            const d = segDist(x + 0.5, y + 0.5, ax, ay, bx, by);
            if (d < riverDist[i]) {
              riverDist[i] = d;
              riverOf[i] = ri;
            }
          }
        }
      }
    });
    for (let i = 0; i < N; i++) {
      if (fixed[i] || riverOf[i] < 0) continue;
      const r = rivers[riverOf[i]];
      if (riverDist[i] < r.water / 2) {
        letter[i] = CODE.water;
        level[i] = 0;
        fixed[i] = FIXED.river;
      } else if (riverDist[i] < r.water / 2 + r.bank) {
        letter[i] = CODE.sand;
        level[i] = 1;
        fixed[i] = FIXED.river;
      }
    }

    // The height of the free land: the real land through the curve; near a stamp the land comes to
    // the height of the edge of the stamp (over a longer way where they are far apart).
    const target = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      if (fixed[i]) {
        target[i] = level[i];
        continue;
      }
      const g = natural(plx(i), plz(i));
      const s = toStamp.near[i] >= 0 ? level[toStamp.near[i]] : base;
      target[i] = s + (g - s) * smooth(toStamp.dist[i], Math.min(CAP, Math.max(blend, 2.2 * Math.abs(g - s))));
    }
    // Bound the free land near the source cells: at most one step for each cell of distance from
    // them (out to `reach` cells), so that the hero can walk from a source onto the land.
    const bound = (isSource, reach) => {
      const lo = new Float32Array(N).fill(-Infinity);
      const hi = new Float32Array(N).fill(Infinity);
      const dist = new Float32Array(N).fill(Infinity);
      const queue = [];
      for (let i = 0; i < N; i++) if (isSource(i)) {
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
          if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue;
          const j = ny * W + nx;
          if (fixed[j] || isSource(j) || dist[i] + 1 > reach) continue;
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
    const nearFixed = bound((i) => fixed[i] !== FIXED.none, blend);
    for (let i = 0; i < N; i++) if (!fixed[i]) level[i] = Math.max(1, Math.min(MAX_LEVEL, Math.round(nearFixed(i, target[i]))));

    // The roads: their cells take the height of the nearest cell of their line.
    const roadDist = new Float32Array(N).fill(Infinity);
    for (const r of roads) {
      const best = new Float32Array(N).fill(Infinity);
      for (const k of near(r.index, tx, tz)) {
        const [ax, ay, bx, by] = r.segs[k];
        for (let y = Math.max(Z0, Math.floor(Math.min(ay, by) - r.half - 2)); y <= Math.min(Z0 + W - 1, Math.ceil(Math.max(ay, by) + r.half + 2)); y++) {
          for (let x = Math.max(X0, Math.floor(Math.min(ax, bx) - r.half - 2)); x <= Math.min(X0 + W - 1, Math.ceil(Math.max(ax, bx) + r.half + 2)); x++) {
            const i = (y - Z0) * W + (x - X0);
            const d = segDist(x + 0.5, y + 0.5, ax, ay, bx, by);
            if (d < roadDist[i]) roadDist[i] = d;
            if (d >= r.half || fixed[i] === FIXED.stamp || d >= best[i]) continue;
            best[i] = d;
            if (letter[i] === CODE.water || letter[i] === CODE.bridge || letter[i] === CODE.bamboo || letter[i] === CODE.shallow) {
              // A road over a river: a ford, a bamboo bridge, or the water of a ferry.
              const kind = riverOf[i] >= 0 ? crossingOf(rivers[riverOf[i]].water) : 'bamboo';
              if (kind === 'ford') letter[i] = CODE.shallow;
              else if (kind === 'bamboo') {
                // The deck of the bridge is at the height of the road.
                letter[i] = CODE.bamboo;
                level[i] = Math.max(1, r.levels[k]);
              }
            } else {
              letter[i] = CODE.path;
              if (fixed[i] === FIXED.river) fixed[i] = FIXED.none;
              level[i] = r.levels[k];
            }
          }
        }
      }
    }
    // The land beside a road comes to it (a bank of two cells), so that the hero can step off it.
    const isRoad = (i) => letter[i] === CODE.path && fixed[i] !== FIXED.stamp;
    const bank = bound(isRoad, 2);
    for (let i = 0; i < N; i++) if (!fixed[i] && !isRoad(i) && letter[i] !== CODE.bridge && letter[i] !== CODE.bamboo) level[i] = bank(i, level[i]);

    // At the edge of a stamp no cliff: the land next to it (a road too) is one step from it at most
    // for each cell of distance.
    const byStamp = bound((i) => fixed[i] === FIXED.stamp, 4);
    for (let i = 0; i < N; i++) if (!fixed[i] && letter[i] !== CODE.bridge && letter[i] !== CODE.bamboo) level[i] = byStamp(i, level[i]);

    const toWater = distanceField(W, W, (i) => letter[i] === CODE.water);
    const nearRoad = distanceField(W, W, (i) => letter[i] === CODE.path || letter[i] === CODE.bridge || letter[i] === CODE.bamboo);
    const cap = (d) => Math.min(CAP, d);

    // The hamlets: one site at most in each square of SITE cells (at a place of the seed), on free,
    // nearly level land away from water and the stamps, with a road a few cells from the door of
    // the yard. Each site reads only the land around it, so the choice is the same in every window.
    const h = rules.hamlets ?? null;
    const sites = [];
    if (h && parts) {
      const hs = hashSeed(`${seed}:hamlets`) & 0x7fffffff;
      // A site lies inside its square: the sites of a tile are the sites of its own squares, and
      // the squares around them change the land at its edge (all their land is in the window).
      for (let sy = (tz * TILE) / SITE - 1; sy <= ((tz + 1) * TILE) / SITE; sy++) {
        for (let sx = (tx * TILE) / SITE - 1; sx <= ((tx + 1) * TILE) / SITE; sx++) {
          if (hash2(hs + 1, sx, sy) >= (h.chance ?? 1)) continue;
          // A few places of the seed in the square, in turn: the first good one is the site.
          for (let k = 0; k < 6; k++) {
            const x = sx * SITE + 1 + Math.floor(hash2(hs + 2 + k * 7, sx, sy) * (SITE - HAMLET.w - 2));
            const y = sy * SITE + 1 + Math.floor(hash2(hs + 3 + k * 7, sx, sy) * (SITE - HAMLET.h - 3));
            if (good(x, y)) {
              sites.push({ x, y, w: HAMLET.w, h: HAMLET.h, seed: 1 + Math.floor(hash2(hs + 4, sx, sy) * 2147483645) });
              break;
            }
          }
        }
      }
    }
    function good(x, y) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let yy = y - 1; yy <= y + HAMLET.h; yy++) {
        for (let xx = x - 1; xx <= x + HAMLET.w; xx++) {
          const i = (yy - Z0) * W + (xx - X0);
          if (fixed[i] || letter[i] || cap(toWater.dist[i]) < (h.water?.[0] ?? 4) || toStamp.dist[i] < 4) return false;
          lo = Math.min(lo, level[i]);
          hi = Math.max(hi, level[i]);
        }
      }
      const road = cap(nearRoad.dist[(y + HAMLET.h + 1 - Z0) * W + (x + HAMLET.w / 2 - X0)]);
      return hi - lo <= 1 && road >= (h.road?.[0] ?? 2) && road <= (h.road?.[1] ?? 14);
    }
    const hamlets = sites.map((s) => ({ site: s, ...hamletOf(s, parts) }));
    for (const hm of hamlets) {
      for (const c of hm.claims) {
        if (c.x < X0 || c.y < Z0 || c.x >= X0 + W || c.y >= Z0 + W) continue;
        const i = (c.y - Z0) * W + (c.x - X0);
        letter[i] = c.letter.charCodeAt(0);
        level[i] = Math.max(0, level[i] - c.drop);
        fixed[i] = FIXED.claim;
      }
    }
    const toSite = distanceField(W, W, (i) => fixed[i] === FIXED.claim);

    // Rice paddies, in blocks of five cells with a dike around each block: on the low, wet land
    // near water, never on a road or near a stamp; all cells of a block at one level, one step under
    // the dike. Over the low land, paddies are terraces near a hamlet; the hills keep their forest.
    const DIKE = def.dike ?? 5;
    const wet = { scale: 22, near: 14, over: 0.15, terrace: 14, ...(def.wet ?? {}) };
    const blocks = [];
    for (let by = Math.floor(Z0 / DIKE); (by + 1) * DIKE < Z0 + W; by++) {
      for (let bx = Math.floor(X0 / DIKE); (bx + 1) * DIKE < X0 + W; bx++) {
        if (bx * DIKE < X0 || by * DIKE < Z0) continue;
        let lowL = Infinity;
        let highL = -Infinity;
        let ok = true;
        let wetSum = 0;
        for (let y = by * DIKE; y <= by * DIKE + DIKE && ok; y++) {
          for (let x = bx * DIKE; x <= bx * DIKE + DIKE; x++) {
            const i = (y - Z0) * W + (x - X0);
            if (fixed[i] || letter[i] === CODE.path || letter[i] === CODE.bridge || letter[i] === CODE.bamboo || roadDist[i] < 3 || toStamp.dist[i] < 3) {
              ok = false;
              break;
            }
            lowL = Math.min(lowL, level[i]);
            highL = Math.max(highL, level[i]);
            // Water farther than the cap does not make the land wet.
            wetSum += toWater.dist[i] >= CAP ? 0 : Math.exp(-toWater.dist[i] / wet.near);
          }
        }
        if (!ok || highL - lowL > 1 || lowL < 2) continue;
        const cx = bx * DIKE + DIKE / 2;
        const cy = by * DIKE + DIKE / 2;
        const noise = fbm(sd('wet'), cx, cy, { scale: wet.scale, octaves: 2 });
        if (lowL > base + 1) {
          if (cap(toSite.dist[(Math.floor(cy) - Z0) * W + (Math.floor(cx) - X0)]) <= wet.terrace && noise > -0.4) blocks.push([bx, by, lowL]);
          continue;
        }
        const score = noise * 0.8 + (wetSum / (DIKE + 1) ** 2) * 1.2 - Math.max(0, lowL - base) * 0.15;
        if (score > wet.over) blocks.push([bx, by, lowL]);
      }
    }
    const isDike = new Uint8Array(N);
    for (const [bx, by, L] of blocks) {
      for (let y = by * DIKE; y <= by * DIKE + DIKE; y++) for (let x = bx * DIKE; x <= bx * DIKE + DIKE; x++) {
        const i = (y - Z0) * W + (x - X0);
        if (x % DIKE === 0 || y % DIKE === 0) {
          // A dike between two paddies keeps the higher level.
          level[i] = isDike[i] ? Math.max(level[i], L) : L;
          letter[i] = CODE.dike;
          isDike[i] = 1;
        } else {
          letter[i] = CODE.field;
          level[i] = L - 1;
        }
      }
    }
    // A beach of sand along the sea.
    for (let i = 0; i < N; i++) if (!letter[i] && toSea.dist[i] <= 2) letter[i] = CODE.sand;
    for (let i = 0; i < N; i++) if (!letter[i]) letter[i] = CODE.grass;
    // A rock face: free grass that is two steps or more over a cell next to it (a cliff).
    for (let y = 1; y < W - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (fixed[i] || letter[i] !== CODE.grass) continue;
        for (const [dx, dy] of NB) {
          if (level[i + dy * W + dx] <= level[i] - 2) {
            letter[i] = CODE.rock;
            break;
          }
        }
      }
    }
    const toRoad = distanceField(W, W, (i) => letter[i] === CODE.path || letter[i] === CODE.bridge || letter[i] === CODE.bamboo);
    const toField = distanceField(W, W, (i) => letter[i] === CODE.field);

    const things = scatterWindow({ W, X0, Z0, letter, level, fixed, toWater, toRoad, toField, cap, tx, tz }, rules, seed);

    // The tile: the inner cells of the window, and the things whose cell is in it.
    const T = TILE;
    const x0 = tx * T;
    const z0 = tz * T;
    const inTile = (x, y) => x >= x0 && y >= z0 && x < x0 + T && y < z0 + T;
    const out = {
      tx, tz, x0, z0,
      letter: new Uint8Array(T * T),
      level: new Int8Array(T * T),
      fixed: new Uint8Array(T * T),
      water: new Uint8Array(T * T),
      road: new Uint8Array(T * T),
      field: new Uint8Array(T * T),
      nearStamp: new Uint8Array(T * T),
      mist: new Uint8Array(T * T),
      objects: [],
      life: [],
      villagers: [],
      sites: [],
      spots: { road: [], field: [], wetfield: [], yard: [] },
    };
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const i = (y + PAD) * W + (x + PAD);
      const o = y * T + x;
      out.letter[o] = letter[i];
      out.level[o] = level[i];
      out.fixed[o] = fixed[i];
      out.water[o] = cap(toWater.dist[i]);
      out.road[o] = cap(toRoad.dist[i]);
      out.field[o] = cap(toField.dist[i]);
      out.nearStamp[o] = cap(toStamp.dist[i]);
      out.mist[o] = cap(toEra.dist[i]);
    }
    for (const hm of hamlets) {
      if (!inTile(hm.site.x, hm.site.y)) continue;
      out.sites.push(hm.site);
      out.objects.push(...hm.objects.map((o) => ({ ...o, gen: true })));
      out.life.push(...hm.life);
      out.villagers.push(...hm.villagers);
      out.spots.yard.push([hm.site.x + 11, hm.site.y + 12]);
    }
    for (const o of things.objects) if (inTile(o.x, o.y)) out.objects.push(o);
    for (const g of things.life) if (inTile(Math.floor(g.x), Math.floor(g.y))) out.life.push(g);
    // The spots of the small events: points of the roads on the low land (a cart does not climb a
    // hill path), the middles of paddies, and the paddies near water (a flood comes only there).
    for (const r of roads) {
      for (let k = 0; k < r.line.length; k += 9) {
        const x = Math.floor(r.line[k][0]);
        const y = Math.floor(r.line[k][1]);
        if (!inTile(x, y)) continue;
        const i = (y - Z0) * W + (x - X0);
        if (letter[i] === CODE.path && !fixed[i] && toStamp.dist[i] > 8 && level[i] <= base + 1) out.spots.road.push([x, y]);
      }
    }
    for (const [bx, by] of blocks) {
      const x = bx * DIKE + 2;
      const y = by * DIKE + 2;
      if (!inTile(x, y)) continue;
      out.spots.field.push([x, y]);
      if (cap(toWater.dist[(y - Z0) * W + (x - X0)]) <= 12) out.spots.wetfield.push([x, y]);
    }
    return out;
  }

  // The facts of a plane cell (the tile is made when needed).
  function cell(x, y) {
    const tx = Math.floor(x / TILE);
    const tz = Math.floor(y / TILE);
    const t = tile(tx, tz);
    const o = (y - t.z0) * TILE + (x - t.x0);
    return {
      letter: String.fromCharCode(t.letter[o]),
      level: t.level[o],
      stamp: t.fixed[o] === FIXED.stamp,
      taken: t.fixed[o] === FIXED.claim,
      water: t.water[o],
      road: t.road[o],
      field: t.field[o],
      nearStamp: t.nearStamp[o],
      mist: t.mist[o],
    };
  }

  return {
    plane,
    origins,
    toPlane,
    stamps,
    rivers,
    get roads() {
      if (!roads) makeRoads();
      return roads;
    },
    meters,
    natural,
    tile,
    cell,
    // The tile of a plane cell.
    tileOf: (x, y) => [Math.floor(x / TILE), Math.floor(y / TILE)],
    // The height tiles (of the land file) that a tile reads: make the tile only when they are there.
    needs(tx, tz) {
      const [lonA, latA] = plane.toGeo([tx * TILE - PAD, tz * TILE - PAD]);
      const [lonB, latB] = plane.toGeo([(tx + 1) * TILE + PAD, (tz + 1) * TILE + PAD]);
      const out = new Set();
      const add = (lo0, lo1, la0, la1) => {
        for (let la = Math.floor(la0); la <= Math.floor(la1); la++) {
          for (let lo = Math.floor(lo0); lo <= Math.floor(lo1); lo++) {
            const name = tileOf(lo, la);
            if ((def.tiles ?? []).includes(name)) out.add(name);
          }
        }
      };
      add(lonA, lonB, latB, latA);
      // A tile near the line of the era reads the crests of the band (and of the columns near it).
      if (eraBand && (tz + 1) * TILE + PAD >= eraBand[0] && tz * TILE - PAD <= eraBand[1]) {
        const d = (ERA.median + ERA.smooth + 1) * ERA.step;
        add(lonA - d, lonB + d, era - ERA.band, era + ERA.band);
      }
      return [...out];
    },
    // The ferries of the roads over the big rivers (see ferriesOf).
    get ferries() {
      if (!roads) makeRoads();
      return ferries;
    },
    // Is a cell in the land of another country (the rings of the land, with no wobble)?
    foreignAt(x, y) {
      const row = Math.floor(y);
      const xs = crossings(ringBands.vn, row);
      return !insideRow(xs, x + 0.5) && insideRow(crossings(ringBands.other, row), x + 0.5);
    },
    // Forget a tile (a worker gave its arrays away).
    forget: (tx, tz) => cache.delete(keyOf(tx, tz)),
    // Is a tile made (it is in the cache)?
    has: (tx, tz) => cache.has(keyOf(tx, tz)),
    // Put a tile that a worker made into the cache (the same tile as tile(tx, tz) makes).
    put(t) {
      cache.set(keyOf(t.tx, t.tz), t);
      if (cache.size > MAX_TILES) cache.delete(cache.keys().next().value);
    },
  };
}

// Pull a line through pins: the line moves near each pin (the nearest point of the line goes to the
// pin), less and less out to `radius` cells.
function pull(line, pins, radius) {
  const nearest = pins.map((p) => {
    let best = null;
    let bd = Infinity;
    for (const q of line) {
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return { p, q: best, v: [p[0] - best[0], p[1] - best[1]] };
  });
  return line.map(([x, y]) => {
    let f = 0;
    let wx = 0;
    let wy = 0;
    let wsum = 0;
    for (const n of nearest) {
      const d = Math.hypot(x - n.q[0], y - n.q[1]);
      const k = (1 - Math.min(1, d / radius) ** 2) ** 2;
      f = Math.max(f, k);
      const w = k / (d * d + 1e-6);
      wx += n.v[0] * w;
      wy += n.v[1] * w;
      wsum += w;
    }
    return wsum ? [x + (f * wx) / wsum, y + (f * wy) / wsum] : [x, y];
  });
}

// The scatter of a window: the things of each kind at local samples (a cell where the rules let a
// thing stand, and no other such cell within the spacing has a higher priority), and groups of
// living things on a jittered grid. Two things of two kinds never touch: of two candidates that
// overlap (with one free cell around each), the one of the earlier kind (or of the higher priority)
// stays. Each rule reads only the land near the cell, so the things are the same in every window.
function scatterWindow(w, rules, seed) {
  const { W, X0, Z0, letter, level, fixed, toWater, toRoad, toField, cap, tx, tz } = w;
  const inRange = (v, range) => !range || (v >= range[0] && v <= range[1]);
  const codes = (on) => new Set((on ?? ['.']).map((c) => c.charCodeAt(0)));
  // How many steps a cell is under the highest cell within TOP cells of it (0 at a top), made
  // only when a rule asks for it (a max filter in rows, then in columns).
  const TOP = 6;
  let below = null;
  const belowTop = () => {
    if (below) return below;
    const rows = new Uint8Array(W * W);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      let m = 0;
      for (let d = Math.max(0, x - TOP); d <= Math.min(W - 1, x + TOP); d++) m = Math.max(m, level[y * W + d]);
      rows[y * W + x] = m;
    }
    below = new Uint8Array(W * W);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      let m = 0;
      for (let d = Math.max(0, y - TOP); d <= Math.min(W - 1, y + TOP); d++) m = Math.max(m, rows[d * W + x]);
      below[y * W + x] = m - level[y * W + x];
    }
    return below;
  };
  const fitsAt = (rule, on, i) => !fixed[i] && on.has(letter[i]) && inRange(level[i], rule.level) && inRange(cap(toWater.dist[i]), rule.water) && inRange(cap(toRoad.dist[i]), rule.road) && inRange(cap(toField.dist[i]), rule.field) && (!rule.top || inRange(belowTop()[i], rule.top));
  const roll = (name, x, y) => hash2(hashSeed(`${seed}:${name}`) & 0x7fffffff, x, y);
  const x0 = tx * TILE;
  const z0 = tz * TILE;
  // The candidates near the tile (out to MARGIN cells), of all kinds.
  const MARGIN = 10;
  const cands = [];
  (rules.props ?? []).forEach((rule, ri) => {
    const name = `scatter:${rule.prop}:${ri}`;
    const on = codes(rule.on);
    const patch = rule.patch ? hashSeed(`${seed}:patch:${rule.patch.key ?? rule.prop}`) & 0x7fffffff : 0;
    const [sw, sh] = Array.isArray(rule.size) ? rule.size : [rule.size ?? 2, rule.size ?? 2];
    const R = Math.ceil(rule.spacing);
    const lo = PAD - MARGIN - R;
    const hi = PAD + TILE + MARGIN + R;
    const valid = new Uint8Array(W * W);
    for (let y = lo; y < hi; y++) {
      for (let x = lo; x < hi; x++) {
        const i = y * W + x;
        if (!fitsAt(rule, on, i)) continue;
        if (rule.patch && fbm(patch, x + X0, y + Z0, { scale: rule.patch.scale, octaves: 2 }) < rule.patch.over) continue;
        let ok = true;
        for (let dy = 0; dy < sh && ok; dy++) for (let dx = 0; dx < sw; dx++) if (!fitsAt(rule, on, i + dy * W + dx)) {
          ok = false;
          break;
        }
        if (ok) valid[i] = 1;
      }
    }
    const pseed = hashSeed(`${seed}:${name}`) & 0x7fffffff;
    for (let y = PAD - MARGIN; y < PAD + TILE + MARGIN; y++) {
      for (let x = PAD - MARGIN; x < PAD + TILE + MARGIN; x++) {
        if (!valid[y * W + x]) continue;
        const p = hash2(pseed, x + X0, y + Z0);
        let best = true;
        for (let dy = -R; dy <= R && best; dy++) {
          for (let dx = -R; dx <= R; dx++) {
            if ((!dx && !dy) || dx * dx + dy * dy >= rule.spacing * rule.spacing || !valid[(y + dy) * W + x + dx]) continue;
            const q = hash2(pseed, x + dx + X0, y + dy + Z0);
            if (q > p || (q === p && (dy < 0 || (dy === 0 && dx < 0)))) {
              best = false;
              break;
            }
          }
        }
        if (!best) continue;
        const gx = x + X0;
        const gy = y + Z0;
        if (rule.chance !== undefined && roll(`${name}:chance`, gx, gy) >= rule.chance) continue;
        const crown = rule.crowns ? rule.crowns[Math.floor(roll(`${name}:crown`, gx, gy) * rule.crowns.length)] : undefined;
        cands.push({ prop: rule.prop, kind: ri, x: gx, y: gy, w: sw, h: sh, p, seed: 1 + Math.floor(roll(`${name}:seed`, gx, gy) * 2147483645), ...(crown ? { crown } : {}) });
      }
    }
  });
  // Of two candidates that touch, the earlier kind (then the higher priority) stays.
  const before = (a, b) => a.kind < b.kind || (a.kind === b.kind && (a.p > b.p || (a.p === b.p && (a.y < b.y || (a.y === b.y && a.x < b.x)))));
  const touch = (a, b) => a.x - 1 < b.x + b.w && b.x - 1 < a.x + a.w && a.y - 1 < b.y + b.h && b.y - 1 < a.y + a.h;
  const kept = cands.filter((a) => Math.abs(a.x - x0 - TILE / 2) < TILE / 2 + 4 && Math.abs(a.y - z0 - TILE / 2) < TILE / 2 + 4 && !cands.some((b) => b !== a && touch(a, b) && before(b, a)));
  const objects = kept.map((o) => ({ id: `gen:${o.prop}:${o.x}:${o.y}`, prop: o.prop, x: o.x, y: o.y, w: o.w, h: o.h, seed: o.seed, gen: true, ...(o.crown ? { crown: o.crown } : {}) }));
  const taken = (x, y) => kept.some((o) => x >= o.x && y >= o.y && x < o.x + o.w && y < o.y + o.h);
  // The groups of living things: one candidate in each square of `spacing` cells, at a place of
  // the seed.
  const life = [];
  (rules.life ?? []).forEach((rule, ri) => {
    const name = `life:${rule.kind}:${ri}`;
    const on = codes(rule.on);
    const S = rule.spacing;
    for (let sy = Math.floor(z0 / S); sy * S < z0 + TILE; sy++) {
      for (let sx = Math.floor(x0 / S); sx * S < x0 + TILE; sx++) {
        const gx = sx * S + Math.floor(roll(`${name}:x`, sx, sy) * S);
        const gy = sy * S + Math.floor(roll(`${name}:y`, sx, sy) * S);
        if (gx < x0 || gy < z0 || gx >= x0 + TILE || gy >= z0 + TILE) continue;
        const i = (gy - Z0) * W + (gx - X0);
        if (!fitsAt(rule, on, i) || taken(gx, gy)) continue;
        if (rule.chance !== undefined && roll(`${name}:chance`, gx, gy) >= rule.chance) continue;
        const n = rule.n[0] + Math.floor(roll(`${name}:n`, gx, gy) * (rule.n[1] - rule.n[0] + 1));
        life.push({ kind: rule.kind, n, x: gx + 0.5, y: gy + 0.5, r: rule.r ?? 2 });
      }
    }
  });
  return { objects, life };
}
