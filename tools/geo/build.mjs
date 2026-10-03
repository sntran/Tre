// Build data/geo/vietnam.json from the source data in tools/geo/raw/ (see README.md).
// It runs offline, with Node only: node tools/geo/build.mjs
//
// It reads Natural Earth (countries from the point of view of Vietnam, rivers, lakes) and NASA SRTM
// elevation tiles, keeps the part around Vietnam, simplifies the lines, and adds the hand-traced
// rivers and the story places from this folder. Coordinates are [longitude, latitude] in degrees.
// It also writes the fine height tiles of the land (data/geo/heights/) that the lands of the
// regions (data/world/land-*.json, tiles) need.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
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
// The coarse elevation grid (degrees), for the country map.
const GRID = { lon0: 101.5, lat0: 8, lon1: 110, lat1: 23.5, step: 0.1 };
// The fine height tiles of the land: 1 x 1 degree, a value every 0.005 degree (about 550 m), with
// both edges, so that a point in a tile needs no other tile.
export const FINE = { step: 0.005, size: 201 };

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

// The name of the tile with this south-west corner, as SRTM names it.
export const tileName = (lat, lon) => `N${String(lat).padStart(2, '0')}E${String(lon).padStart(3, '0')}`;

// The fine height tile with this south-west corner. Each value keeps the tops: the SRTM samples of
// its square (7 x 7, 3 arc-seconds apart) give 0.6 x the highest + 0.4 x the mean, so that a hill
// smaller than the square keeps most of its height. Meters; sea and voids are 0. Return the values
// (row 0 is the north) and the header of the tile file.
export function heightTile(lat, lon, sample = srtmSampler()) {
  const n = FINE.size;
  const half = Math.round(FINE.step * 1200 / 2); // SRTM samples from the middle to the edge of a square
  const data = new Int16Array(n * n);
  for (let r = 0; r < n; r++) {
    const la = lat + 1 - r * FINE.step;
    for (let c = 0; c < n; c++) {
      const lo = lon + c * FINE.step;
      let max = 0;
      let sum = 0;
      let k = 0;
      for (let i = -half; i <= half; i++) {
        for (let j = -half; j <= half; j++) {
          const v = Math.max(0, sample(lo + j / 1200, la + i / 1200) ?? 0);
          max = Math.max(max, v);
          sum += v;
          k += 1;
        }
      }
      data[r * n + c] = Math.round(0.6 * max + 0.4 * (sum / k));
    }
  }
  const header = { tile: tileName(lat, lon), lon0: lon, lat1: lat + 1, step: FINE.step, cols: n, rows: n, unit: 'm', filter: '0.6 max + 0.4 mean of 7 x 7 SRTM samples', source: 'NASA SRTM 3 arc-second, version 2.1' };
  return { header, data };
}

// The bytes of a height tile file: the length of the header (4 bytes, little-endian), the header
// (JSON, with spaces at the end so that the values start at an even byte), and the values (16-bit,
// little-endian, row by row from the north). src/core/gen/heights.js reads it.
export function encodeTile({ header, data }) {
  let json = JSON.stringify(header);
  while ((4 + Buffer.byteLength(json)) % 2) json += ' ';
  const head = Buffer.from(json);
  const out = Buffer.alloc(4 + head.length + data.length * 2);
  out.writeUInt32LE(head.length, 0);
  head.copy(out, 4);
  for (let i = 0; i < data.length; i++) out.writeInt16LE(data[i], 4 + head.length + i * 2);
  return out;
}

// The tiles that the lands of the regions need (tiles in data/world/land-*.json).
function landTiles() {
  const dir = join(here, '..', '..', 'data', 'world');
  const names = new Set();
  for (const f of readdirSync(dir)) if (/^land-.*\.json$/.test(f)) for (const t of readJson(join(dir, f)).tiles ?? []) names.add(t);
  return [...names].sort();
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
  const tiles = join(dirname(out), 'heights');
  mkdirSync(tiles, { recursive: true });
  const sample = srtmSampler();
  for (const name of landTiles()) {
    const [, lat, lon] = name.match(/^N(\d+)E(\d+)$/).map(Number);
    const file = join(tiles, `${name}.bin`);
    writeFileSync(file, encodeTile(heightTile(lat, lon, sample)));
    console.log(`Wrote ${file}`);
  }
}
