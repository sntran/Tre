// The gallery (?gallery=<page>, src/ui/gallery.js): every figure, thing, and ground of the game,
// shown in the game itself on a small flat plot of village ground, so that the owner reviews what
// the child sees. This module is pure (no DOM, no WebGL): it gives the items of a page from the
// data (data/figures.json, the hero options, PROPS, SURFACE), the box of each item from its blocks,
// the places of the items on the plot, and the map of the plot. A new look or prop is in the
// gallery with no change here.
import { PROPS, buildProp } from './props/index.js';
import { figureOf, heroLook } from './figures.js';
import { HATS } from './fine.js';
import { SURFACE, SURFACE_OF } from './terrain.js';

export const GALLERY_PAGES = Object.freeze(['people', 'animals', 'things', 'ground']);
// The kinds of look that are animals. A look with no kind is a person; the other kinds are things.
export const ANIMAL_KINDS = Object.freeze(['nghe', 'duck', 'duckling', 'chicken', 'fish', 'buffalo', 'dog', 'frog', 'kingfisher', 'owl', 'bird', 'serpent']);
// A grown-up for the hats (the looks of the people are in data/figures.json).
const GROWN = Object.freeze({ skin: 'skin2', top: 'indigo', bottom: 'indigo', sash: 'vermilion', topKind: 'shirt', bottomKind: 'trousers', face: 1 });

const GAP = 1.5; // cells between two items
const LABEL = 2; // cells under a row, for the labels
const MARGIN = 3; // cells of ground around the items
const WIDTH = { people: 36, animals: 36, things: 64, ground: 48 }; // the width of the rows (cells)

// The box of a figure on the ground (cells, from its middle; its facing is 0): its parts at rest.
export function figureBox(look) {
  const f = figureOf(look, 'fine');
  const unit = f.scale * (f.grid ?? 0.5);
  const abs = {};
  const box = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const p of f.parts) {
    const base = abs[p.parent] ?? [0, 0, 0];
    const at = [base[0] + p.at[0], base[1] + p.at[1], base[2] + p.at[2]];
    abs[p.name] = at;
    if (!p.size) continue;
    box.x0 = Math.min(box.x0, (at[0] - p.size[0] / 2) * unit);
    box.x1 = Math.max(box.x1, (at[0] + p.size[0] / 2) * unit);
    box.z0 = Math.min(box.z0, (at[2] - p.size[2] / 2) * unit);
    box.z1 = Math.max(box.z1, (at[2] + p.size[2] / 2) * unit);
  }
  return box.x0 === Infinity ? { x0: -0.5, x1: 0.5, z0: -0.5, z1: 0.5 } : box;
}

// The footprint of a prop (cells): the most common one in the maps, or 2 x 2.
function footprintOf(prop, maps) {
  const count = new Map();
  for (const m of maps) {
    for (const o of m.layers?.objects ?? []) {
      if (o.prop !== prop) continue;
      const k = `${o.w},${o.h}`;
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
  let best = '2,2';
  for (const [k, n] of count) if (n > (count.get(best) ?? 0)) best = k;
  return best.split(',').map(Number);
}

// The box of a prop from its blocks, its roofs, and its smooth looks (cells, from the corner of its
// footprint).
export function propBox(prop, w, h, seed = 1) {
  const fine = { inside: () => true, get: () => 0, set: () => {} };
  const r = buildProp({ fine, groundTop: () => 2, shadow: () => {} }, { kind: prop, fx: 0, fz: 0, fw: w * 2, fd: h * 2, seed }, 1);
  const b = r.box;
  return b ? { x0: Math.min(0, b.x0 / 2), x1: Math.max(w, (b.x1 + 1) / 2), z0: Math.min(0, b.z0 / 2), z1: Math.max(h, (b.z1 + 1) / 2) } : { x0: 0, x1: w, z0: 0, z1: h };
}

// The ground strips of the ground page: one for each kind of surface (a ground type of that kind;
// the forest floor is the grass of the land on high ground), a road on a bank through paddies, a
// road on dry land, paddies, and the edge of a river. Each strip has a slope at its far end.
function groundItems() {
  const out = [];
  for (const [name, kind] of Object.entries(SURFACE)) {
    if (!kind) continue;
    const type = Object.keys(SURFACE_OF).find((t) => SURFACE_OF[t] === kind) ?? 'grass';
    out.push({ id: name, kind: 'ground', surface: name, type, high: kind === SURFACE.forest, box: { x0: 0, x1: 4, z0: 0, z1: 12 } });
  }
  out.push({ id: 'road-bank', kind: 'ground', special: 'road-bank', box: { x0: 0, x1: 16, z0: 0, z1: 16 } });
  out.push({ id: 'road-dry', kind: 'ground', special: 'road-dry', box: { x0: 0, x1: 12, z0: 0, z1: 12 } });
  out.push({ id: 'paddy', kind: 'ground', special: 'paddy', box: { x0: 0, x1: 11, z0: 0, z1: 11 } });
  out.push({ id: 'river', kind: 'ground', special: 'river', box: { x0: 0, x1: 10, z0: 0, z1: 12 } });
  return out;
}

// The items of a page. data: { figures (data/figures.json), maps (the map files, for the
// footprints of the props) }. Each item: { id, kind: 'figure' | 'prop' | 'ground', key (the key of
// a look in data/figures.json), look, prop, w, h, box (cells) }. An unknown page has no items.
export function galleryItems(page, data) {
  const looks = data.figures.figures;
  const hero = data.figures.hero;
  const out = [];
  const figure = (id, look, key = null) => out.push({ id, kind: 'figure', key, look, box: figureBox(look) });
  const kindOf = (look) => (!look.kind ? 'person' : ANIMAL_KINDS.includes(look.kind) ? 'animal' : 'thing');
  if (page === 'people') {
    // The hero (each gender), the hair choices of hero creation, and each hat on a grown-up.
    for (const gender of Object.keys(hero.genders)) figure(`hero-${gender}`, heroLook({ gender, skin: 2, face: 1, hair: 2, clothes: 1 }, hero));
    hero.hairs.forEach((hair, i) => figure(`hair-${hair}`, heroLook({ gender: i % 2 ? 'girl' : 'boy', skin: 2, face: 1, hair: i + 1, clothes: 1 }, hero)));
    HATS.forEach((hat, i) => figure(`hat-${hat}`, { ...GROWN, hat, hair: hero.hairs[i % hero.hairs.length] }));
  }
  if (page === 'people' || page === 'animals' || page === 'things') {
    const want = { people: 'person', animals: 'animal', things: 'thing' }[page];
    for (const [key, look] of Object.entries(looks)) if (kindOf(look) === want) figure(key, look, key);
  }
  if (page === 'things') {
    for (const prop of Object.keys(PROPS)) {
      const [w, h] = footprintOf(prop, data.maps ?? []);
      out.push({ id: `prop-${prop}`, kind: 'prop', prop, w, h, box: propBox(prop, w, h) });
    }
  }
  if (page === 'ground') out.push(...groundItems());
  return out;
}

// The places of the items on the plot (cells): rows from the front to the back, with a gap between
// two items and room for the labels under a row. Each item gets x, z: the origin of its box (the
// middle of a figure, the corner of a prop or a strip), whole cells for a prop and a strip.
export function layout(items, page) {
  const width = WIDTH[page] ?? 40;
  let x = 0;
  let z = 0;
  let depth = 0;
  let right = 0;
  for (const it of items) {
    const w = it.box.x1 - it.box.x0;
    const d = it.box.z1 - it.box.z0;
    if (x > 0 && x + w > width) {
      x = 0;
      z += depth + GAP + LABEL;
      depth = 0;
    }
    const whole = it.kind !== 'figure';
    const ox = MARGIN + x - it.box.x0;
    const oz = MARGIN + z - it.box.z0;
    it.x = whole ? Math.ceil(ox) : ox;
    it.z = whole ? Math.ceil(oz) : oz;
    x += Math.ceil(w) + GAP + (whole ? 1 : 0);
    right = Math.max(right, x);
    depth = Math.max(depth, Math.ceil(d) + (whole ? 1 : 0));
  }
  return { width: Math.ceil(right + MARGIN * 2), height: Math.ceil(z + depth + LABEL + MARGIN * 2) };
}

// The box of a placed item on the plot (cells).
export const placedBox = (it) => ({ x0: it.x + it.box.x0, x1: it.x + it.box.x1, z0: it.z + it.box.z0, z1: it.z + it.box.z1 });

// The map of the plot of a page (src/core/tilemap.js and src/world/terrain.js): flat village ground
// (grass at height 1), the props as objects, and the strips of the ground page, with the facts of
// the land of its roads (land.cell, as src/core/gen/tiles.js gives them).
export const LEGEND = Object.freeze({ '.': 'grass', '=': 'path', b: 'brick', y: 'yard', _: 'sand', d: 'dike', f: 'field', r: 'rock', '~': 'water' });
export function galleryMap(page, items, size) {
  const { width, height } = size;
  const letters = Array.from({ length: height }, () => Array(width).fill('.'));
  const heights = Array.from({ length: height }, () => Array(width).fill(1));
  const cells = new Map(); // the facts of the land of a cell, by `${x},${z}`
  const put = (x, z, letter, h, cell = null) => {
    if (x < 0 || z < 0 || x >= width || z >= height) return;
    letters[z][x] = letter;
    heights[z][x] = h;
    if (cell) cells.set(`${x},${z}`, cell);
  };
  const letterOf = Object.fromEntries(Object.entries(LEGEND).map(([k, v]) => [v, k]));
  for (const it of items) {
    if (it.kind !== 'ground') continue;
    const x0 = it.x;
    const z0 = it.z;
    const w = it.box.x1;
    const d = it.box.z1;
    // The slope at the far end: one step for each two cells.
    const rise = (dz) => Math.max(0, Math.floor((dz - (d - 6)) / 2));
    if (!it.special) {
      for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) put(x0 + dx, z0 + dz, letterOf[it.type], 1 + rise(dz), it.high ? { stamp: false, level: 6, water: 99, field: 99 } : null);
    } else if (it.special === 'paddy') {
      for (let dz = 0; dz < d; dz++) {
        for (let dx = 0; dx < w; dx++) {
          const dike = dx % 5 === 0 || dz % 5 === 0;
          put(x0 + dx, z0 + dz, dike ? 'd' : 'f', dike ? 2 : 1);
        }
      }
    } else if (it.special === 'river') {
      for (let dz = 0; dz < d; dz++) {
        for (let dx = 0; dx < w; dx++) {
          if (dx < 4) put(x0 + dx, z0 + dz, '~', 0);
          else if (dx < 6) put(x0 + dx, z0 + dz, '_', 1);
          else put(x0 + dx, z0 + dz, '.', 1 + rise(dz));
        }
      }
    } else {
      // A road of the land at an angle: its cells within the half width of the line, and the facts
      // of the land (the direction of the line, the distance from it, the half width). On a bank:
      // paddies with dikes, and the road and its shoulder one step over the dikes.
      const bank = it.special === 'road-bank';
      const half = 2;
      const [ax, az, bx, bz] = [x0 + 1, z0 + d - 1, x0 + w - 1, z0 + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const [ux, uz] = [(bx - ax) / len, (bz - az) / len];
      for (let dz = 0; dz < d; dz++) {
        for (let dx = 0; dx < w; dx++) {
          const x = x0 + dx;
          const z = z0 + dz;
          // The signed distance of the middle of the cell from the line (as roadOff of the tiles).
          const off = (x + 0.5 - ax) * uz - (z + 0.5 - az) * ux;
          const near = Math.abs(off) < half + (bank ? 3 : 1);
          const cell = near ? { stamp: false, level: bank ? 3 : 1, water: 99, field: 99, roadDir: [ux, uz], roadOff: off, roadHalf: half, bank: 0 } : null;
          if (Math.abs(off) < half) put(x, z, '=', bank ? 3 : 1, { ...cell, bank: bank ? 1 : 0 });
          else if (bank && Math.abs(off) < half + 2) put(x, z, '.', 3, { ...cell, bank: 2 });
          else if (bank) put(x, z, (x - x0) % 5 === 0 || (z - z0) % 5 === 0 ? 'd' : 'f', (x - x0) % 5 === 0 || (z - z0) % 5 === 0 ? 2 : 1, cell);
          else put(x, z, '.', 1, cell);
        }
      }
    }
  }
  const objects = items.filter((it) => it.kind === 'prop').map((it, i) => ({ id: `gallery:${it.id}`, prop: it.prop, x: it.x, y: it.z, w: it.w, h: it.h, seed: 1 + i }));
  const DEFAULT = Object.freeze({ stamp: true, level: 1, water: 99, field: 99, road: 99, roadDir: null, roadOff: 0, roadHalf: 0, bank: 0 });
  return {
    id: `gallery-${page}`,
    width,
    height,
    legend: LEGEND,
    layers: {
      ground: letters.map((r) => r.join('')),
      height: heights.map((r) => r.map((h) => h.toString(36)).join('')),
      objects,
    },
    land: { cell: (x, z) => cells.get(`${x},${z}`) ?? DEFAULT },
  };
}

// A page of the gallery: its items placed, the size of the plot, and its map; null for a page that
// does not exist.
export function galleryPage(page, data) {
  if (!GALLERY_PAGES.includes(page)) return null;
  const items = galleryItems(page, data);
  const size = layout(items, page);
  return { page, items, size, map: galleryMap(page, items, size) };
}
