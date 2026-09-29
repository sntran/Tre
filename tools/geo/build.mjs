// Build data/geo/vietnam.json from the source data in tools/geo/raw/ (see README.md).
// It runs offline, with Node only: node tools/geo/build.mjs
//
// It reads Natural Earth (countries from the point of view of Vietnam, rivers, lakes) and NASA SRTM
// elevation tiles, keeps the part around Vietnam, simplifies the lines, and adds the hand-traced
// rivers and the story places from this folder. Coordinates are [longitude, latitude] in degrees.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const raw = join(here, 'raw');
const out = join(here, '..', '..', 'data', 'geo', 'vietnam.json');

// The part of the world on the country map: Vietnam, the land around it, and the islands.
export const BBOX = { lon0: 100, lat0: 6, lon1: 118, lat1: 24 };
const COUNTRIES = ['VNM', 'CHN', 'LAO', 'KHM', 'THA'];
const LAND_TOLERANCE = 0.02; // degrees, about 2 km
const RIVER_TOLERANCE = 0.015;
// Natural Earth rivers that the map shows, with their Vietnamese names.
const NE_RIVERS = { Hong: { id: 'hong', name: 'Hồng' }, Ca: { id: 'ca', name: 'Cả' }, Mekong: { id: 'mekong', name: 'Mê Kông' } };
// The coarse elevation grid (degrees).
const GRID = { lon0: 101.5, lat0: 8, lon1: 110, lat1: 23.5, step: 0.1 };

const round = (v) => Math.round(v * 1000) / 1000;
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

// Sutherland–Hodgman: clip a ring to the box. The ring can be concave; the box is convex.
export function clipRing(ring, box) {
  const edges = [
    [(p) => p[0] >= box.lon0, (a, b) => cross(a, b, 0, box.lon0)],
    [(p) => p[0] <= box.lon1, (a, b) => cross(a, b, 0, box.lon1)],
    [(p) => p[1] >= box.lat0, (a, b) => cross(a, b, 1, box.lat0)],
    [(p) => p[1] <= box.lat1, (a, b) => cross(a, b, 1, box.lat1)],
  ];
  let pts = ring;
  for (const [inside, at] of edges) {
    const next = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (inside(b)) {
        if (!inside(a)) next.push(at(a, b));
        next.push(b);
      } else if (inside(a)) {
        next.push(at(a, b));
      }
    }
    pts = next;
    if (!pts.length) break;
  }
  return pts;
}

function cross(a, b, axis, value) {
  const t = (value - a[axis]) / (b[axis] - a[axis]);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// Cut a line into the parts that are in the box.
export function clipLine(line, box) {
  const inBox = (p) => p[0] >= box.lon0 && p[0] <= box.lon1 && p[1] >= box.lat0 && p[1] <= box.lat1;
  const parts = [];
  let cur = [];
  for (const p of line) {
    if (inBox(p)) cur.push(p);
    else if (cur.length) {
      parts.push(cur);
      cur = [];
    }
  }
  if (cur.length) parts.push(cur);
  return parts.filter((l) => l.length >= 2);
}

// Douglas–Peucker simplification.
export function simplify(points, tol) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let best = -1;
    let dist = tol;
    for (let k = i + 1; k < j; k++) {
      const d = segDist(points[k], points[i], points[j]);
      if (d > dist) {
        dist = d;
        best = k;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([i, best], [best, j]);
    }
  }
  return points.filter((_, k) => keep[k]);
}

function segDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function area(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

const polygonsOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
const linesOf = (g) => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []);

// The outer rings of a country in the box, simplified. Vietnam keeps every island, even a very small one.
function countryRings(feature, keepSmall) {
  const rings = [];
  for (const poly of polygonsOf(feature.geometry)) {
    const clipped = clipRing(poly[0], BBOX);
    if (clipped.length < 3) continue;
    let ring = simplify([...clipped, clipped[0]], LAND_TOLERANCE).slice(0, -1);
    if (ring.length < 3) ring = clipped.length <= 6 ? clipped : simplify(clipped, LAND_TOLERANCE / 4);
    if (ring.length < 3) continue;
    if (!keepSmall && area(ring) < 0.002) continue;
    rings.push(ring.map((p) => [round(p[0]), round(p[1])]));
  }
  return rings;
}

// SRTM .hgt: 1201 x 1201 big-endian 16-bit heights in meters, from the north-west corner.
// -32768 is a void. A missing tile is sea.
function srtmSampler() {
  const tiles = new Map();
  const tile = (lat, lon) => {
    const key = `${lat},${lon}`;
    if (!tiles.has(key)) {
      const name = `N${String(lat).padStart(2, '0')}E${String(lon).padStart(3, '0')}.hgt`;
      const file = join(raw, 'srtm', name);
      tiles.set(key, existsSync(file) ? readFileSync(file) : null);
    }
    return tiles.get(key);
  };
  return (lon, lat) => {
    const la = Math.floor(lat);
    const lo = Math.floor(lon);
    const buf = tile(la, lo);
    if (!buf) return null;
    const size = Math.round(Math.sqrt(buf.length / 2));
    const row = Math.round((la + 1 - lat) * (size - 1));
    const col = Math.round((lon - lo) * (size - 1));
    const v = buf.readInt16BE((row * size + col) * 2);
    return v === -32768 ? null : v;
  };
}

// The mean height of each grid cell, from 6 x 6 samples, in steps of 10 m. Sea is 0.
function elevationGrid() {
  const sample = srtmSampler();
  const cols = Math.round((GRID.lon1 - GRID.lon0) / GRID.step);
  const rows = Math.round((GRID.lat1 - GRID.lat0) / GRID.step);
  const data = [];
  for (let r = 0; r < rows; r++) {
    const lat1 = GRID.lat1 - r * GRID.step; // row 0 is the north
    const row = [];
    for (let c = 0; c < cols; c++) {
      const lon0 = GRID.lon0 + c * GRID.step;
      let sum = 0;
      let n = 0;
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          const v = sample(lon0 + ((j + 0.5) / 6) * GRID.step, lat1 - ((i + 0.5) / 6) * GRID.step);
          if (v !== null) {
            sum += Math.max(0, v);
            n += 1;
          }
        }
      }
      row.push(n ? Math.round(sum / n / 10) : 0);
    }
    data.push(row);
  }
  return { lon0: GRID.lon0, lat1: GRID.lat1, step: GRID.step, cols, rows, unit: 10, data };
}

export function build() {
  const countries = readJson(join(raw, 'ne_10m_admin_0_countries_vnm.geojson'));
  const land = {};
  for (const f of countries.features) {
    const code = f.properties.ADM0_A3;
    if (COUNTRIES.includes(code)) land[code] = countryRings(f, code === 'VNM');
  }

  const riversNe = readJson(join(raw, 'ne_10m_rivers_lake_centerlines.geojson'));
  const rivers = new Map();
  for (const f of riversNe.features) {
    const known = NE_RIVERS[f.properties.name];
    if (!known) continue;
    for (const line of linesOf(f.geometry)) {
      for (const part of clipLine(line, BBOX)) {
        if (!rivers.has(known.id)) rivers.set(known.id, { ...known, source: 'natural-earth', lines: [] });
        rivers.get(known.id).lines.push(simplify(part, RIVER_TOLERANCE).map((p) => [round(p[0]), round(p[1])]));
      }
    }
  }
  for (const r of readJson(join(here, 'rivers-extra.json')).rivers) {
    rivers.set(r.id, { id: r.id, name: r.name, source: 'hand-traced', lines: [r.line] });
  }

  const lakesNe = readJson(join(raw, 'ne_10m_lakes.geojson'));
  const lakes = [];
  for (const f of lakesNe.features) {
    for (const poly of polygonsOf(f.geometry)) {
      const ring = clipRing(poly[0], BBOX);
      if (ring.length < 3 || area(ring) < 0.004) continue;
      lakes.push(simplify([...ring, ring[0]], LAND_TOLERANCE).slice(0, -1).map((p) => [round(p[0]), round(p[1])]));
    }
  }

  const places = readJson(join(here, 'places.json')).places;
  return {
    _about: 'The geography of the country map, made by tools/geo/build.mjs. Coordinates are [longitude, latitude] in degrees. land: the outer rings of Vietnam (VNM, from the point of view of Vietnam, with the islands of Hoàng Sa and Trường Sa) and of the land around it. elevation: the mean height of each cell of the grid (row 0 is the north), in steps of 10 m. The sources and licenses are in data/geo/README.md.',
    bbox: BBOX,
    land,
    lakes,
    rivers: [...rivers.values()],
    elevation: elevationGrid(),
    places,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = build();
  mkdirSync(dirname(out), { recursive: true });
  // One line for each ring, river line, and grid row, so that the file is easy to read.
  const text = JSON.stringify(result, null, 1)
    .replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1,$2]')
    .replace(/\[\s+((?:\[-?[\d.]+,-?[\d.]+\],?\s*)+)\]/g, (m, inner) => `[${inner.replace(/\s+/g, '')}]`)
    .replace(/\[\s+((?:-?\d+,\s*)+-?\d+)\s+\]/g, (m, inner) => `[${inner.replace(/\s+/g, '')}]`);
  writeFileSync(out, text + '\n');
  const kb = Math.round(Buffer.byteLength(text) / 1024);
  console.log(`Wrote ${out} (${kb} KB): ${Object.entries(result.land).map(([k, v]) => `${k} ${v.length}`).join(', ')}; rivers ${result.rivers.length}; lakes ${result.lakes.length}; places ${result.places.length}`);
}
