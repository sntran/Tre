// The voxel world of a map, in pages: one page for each chunk of CHUNK x CHUNK ground columns. A page
// holds the ground blocks (full blocks, one column for each map cell), the fine blocks (half-size
// blocks for the props), the water, the paddies, the flowers, the roofs and the other smooth looks,
// and the objects whose cell is in the chunk. A page is made when it is first asked for, from the
// map and its land only: the same map and the same chunk give the same page, whatever page was made
// before. A map on the plane has no end: pages come and go with the hero. Pure, no DOM, no WebGL.
//
// Map cells: x to the east, y (map) to the south = z in the world. A ground column of height h
// fills the blocks 0 to h - 1, so its top is at world y = h. h = the height digit of the map + 1.
//
// A page keeps one cell (and one fine block) of the chunks around it (the apron), so that the faces
// and the ink at the edge of a chunk come out right. The props of the objects near a chunk are all
// built into it in one fixed order, and only their blocks in the page stay.
import { createGrid, hashSeed, seeded, colorIndex } from './voxel.js';
import { fbm } from '../core/gen/noise.js';
import { buildProp } from './props/index.js';

export const WATER = Object.freeze({ river: 0.6, paddy: 0.55, sea: 2.5 }); // over the bed (blocks); sea: the surface (world y)
export const CHUNK = 16; // ground columns along x and z
export const chunkKey = (cx, cz) => `${cx},${cz}`;
// The chunk of a ground column, and of a fine block (half blocks).
export const chunkOf = (x, z) => chunkKey(Math.floor(x / CHUNK), Math.floor(z / CHUNK));
export const chunkOfFine = (fx, fz) => chunkOf(Math.floor(fx / 2), Math.floor(fz / 2));

// Cells: how far the blocks of a prop reach out of the cells of its object (its eaves, its crown).
// The props of the objects this near a chunk are built into its page. A test checks the reach.
export const REACH = Object.freeze({ school: 10, tree: 7, banyan: 5, banana: 3, areca: 3, default: 2 });
const MARGIN = Math.max(...Object.values(REACH));
const FINE_Y = 136; // fine blocks: the highest place of a prop
const FINE_UP = 80; // fine blocks over the highest ground of a page
const SEA = new Set(['sea', 'surf']);
const DECKS = new Set(['bridge', 'bamboo']); // the ground types with a deck of planks over the water
// The kinds of the surface of the ground for the printed texture (src/render/voxel.js), and the
// kind of each ground type. A grass cell of the hills is forest floor; a path of a stamp is paved.
export const SURFACE = Object.freeze({ none: 0, grass: 1, packed: 2, paved: 3, sand: 4, dike: 5, forest: 6, rock: 7 });
// The kind of each ground type. A path of a village is packed earth (`village` in data/tiles.json:
// `paved` gives bricks, for a later era); a road of the land is a strip over the ground under it.
const SURFACE_OF = { grass: SURFACE.grass, flowers: SURFACE.grass, hedge: SURFACE.grass, 'hedge-low': SURFACE.grass, sand: SURFACE.sand, dike: SURFACE.dike, rock: SURFACE.rock, yard: SURFACE.packed };

// The top of the ground of a cell (world y), from the height layer.
export const columnTop = (digit) => digit + 1;

// The top of a column for a tap (world y): the ground, or the surface of the water on it, so that
// a tap on the water of a stream or a paddy lands where the child sees it, not on the bed (#47).
// type: the ground type of the cell (data/tiles.json); top: the top of the ground.
export function pickTopOf(type, top) {
  if (type === 'water' || type === 'shallow') return top + WATER.river;
  if (type === 'field' || type === 'ditch') return top + WATER.paddy;
  if (SEA.has(type)) return Math.max(top, WATER.sea);
  return top;
}

// The first ground column that a ray meets (a ray from the camera through a screen point).
// o, d: { x, y, z } in world units (y up, z = map y). topAt(x, z): the top of a column.
// Return { x, y (map), h (the height of the hit), t (the distance along d) }, or null.
export function pickGround(o, d, topAt, W, H, maxTop) {
  if (d.y >= 0) return null;
  let t = Math.max(0, (maxTop + 1 - o.y) / d.y);
  const tEnd = (0 - o.y) / d.y;
  const at = (tt) => ({ x: o.x + d.x * tt, y: o.z + d.z * tt, h: o.y + d.y * tt, t: tt });
  const p = at(t);
  let x = Math.floor(p.x);
  let z = Math.floor(p.y);
  const sx = Math.sign(d.x);
  const sz = Math.sign(d.z);
  const dx = sx ? Math.abs(1 / d.x) : Infinity;
  const dz = sz ? Math.abs(1 / d.z) : Infinity;
  let nx = sx ? t + (sx > 0 ? x + 1 - p.x : p.x - x) * dx : Infinity;
  let nz = sz ? t + (sz > 0 ? z + 1 - p.y : p.y - z) * dz : Infinity;
  while (t <= tEnd) {
    const next = Math.min(nx, nz, tEnd);
    if (x >= 0 && z >= 0 && x < W && z < H) {
      const top = topAt(x, z);
      // The side of a column, or its top.
      if (o.y + d.y * t <= top) return at(t);
      const tTop = (top - o.y) / d.y;
      if (tTop <= next) return at(tTop);
    }
    if (next >= tEnd) break;
    if (nx < nz) {
      x += sx;
      t = nx;
      nx += dx;
    } else {
      z += sz;
      t = nz;
      nz += dz;
    }
  }
  return null;
}

// The kind of a ground block (data/world/blocks.json) at a depth under the surface of its column:
// the surface, soil, clay, rock, and ore in some of the clay and rock (a seeded rule).
export function kindAt(blocks, depth, seed) {
  if (depth === 0) return 'surface';
  const L = blocks.layers;
  const base = depth >= L.rock ? 'rock' : depth >= L.clay ? 'clay' : 'soil';
  if (blocks.ore && blocks.ore.in.includes(base) && (seed % 1000) / 1000 < blocks.ore.chance) return 'ore';
  return base;
}

// Run lengths of a list of bits (0 or 1), starting with a run of 0s: [3, 2, 5] is 0 0 0 1 1 0 0 0 0 0.
export function runsOf(bits) {
  const out = [];
  let v = 0;
  let n = 0;
  for (const b of bits) {
    if ((b ? 1 : 0) === v) n += 1;
    else {
      out.push(n);
      v = 1 - v;
      n = 1;
    }
  }
  out.push(n);
  return out;
}
// The bits of run lengths (size: the count of bits).
export function bitsOf(runs, size) {
  const out = new Uint8Array(size);
  let i = 0;
  runs.forEach((n, k) => {
    if (k % 2) out.fill(1, i, Math.min(size, i + n));
    i += n;
  });
  return out;
}

// map: a map (data/maps/ for a small map with all its cells, or a map on the plane from
// src/world/regions.js). tileTypes: data/tiles.json. tileMap: the tile map of the map
// (src/core/tilemap.js). blocks: data/world/blocks.json; with it, the ground keeps the kind of each
// block, so that a dig knows what it takes.
export function createTerrain(map, tileTypes, tileMap, blocks = null) {
  const plane = Boolean(map.plane);
  // The things of the time of the map (data/world/origins.json, #39): a prop shows a thing of a
  // later time only when the map has it.
  const timeThings = new Set(map.things ?? []);
  const W = map.width;
  const H = map.height;
  const id = map.id;
  const kindNames = blocks ? Object.keys(blocks.kinds) : [];
  const typeAt = (x, z) => (tileMap.inside(x, z) ? tileMap.type(x, z) : null);
  // The top of the ground of a cell (the deck of a bridge), with no digs.
  const baseTop = (x, z) => (tileMap.inside(x, z) ? columnTop(tileMap.heightAt(x, z)) : 0);
  const spans = (map.layers.zones ?? []).filter((r) => r.task);
  const inSpan = (x, z) => spans.some((r) => x >= r.x && x < r.x + r.w && z >= r.y && z < r.y + r.h);

  // The changes of the player, for each chunk: dug (the count of blocks dug in each column) and
  // felled (a bit for the cell of each object that was taken away).
  let edits = new Map();
  const recordOf = (x, z, make = false) => {
    const k = chunkOf(x, z);
    if (!edits.has(k) && make) edits.set(k, { dug: new Uint8Array(CHUNK * CHUNK), felled: new Uint8Array(CHUNK * CHUNK) });
    return edits.get(k) ?? null;
  };
  const local = (x, z) => (z - Math.floor(z / CHUNK) * CHUNK) * CHUNK + (x - Math.floor(x / CHUNK) * CHUNK);
  const dugAt = (x, z) => recordOf(x, z)?.dug[local(x, z)] ?? 0;
  const isFelled = (o) => {
    const x = Math.floor(o.x);
    const z = Math.floor(o.y);
    return Boolean(recordOf(x, z)?.felled[local(x, z)]);
  };

  // The number of each object (who) for the fade and the picks: the same number while a page with
  // a block of the object stays.
  const whoOf = new Map();
  const refs = new Map();
  const free = [];
  let next = 1;
  const take = (key) => {
    let w = whoOf.get(key);
    if (!w) {
      w = free.pop() ?? next++;
      whoOf.set(key, w);
      refs.set(w, 0);
    }
    refs.set(w, refs.get(w) + 1);
    return w;
  };
  const release = (key) => {
    const w = whoOf.get(key);
    if (!w) return;
    const n = refs.get(w) - 1;
    if (n > 0) {
      refs.set(w, n);
      return;
    }
    whoOf.delete(key);
    refs.delete(w);
    free.push(w);
  };

  // The objects near a box (cells; x1, z1 not included), in one fixed order.
  const near = map.plane
    ? (x0, z0, x1, z1) => map.objectsNear(x0, z0, x1, z1)
    : (x0, z0, x1, z1) => map.layers.objects.filter((o) => o.x < x1 && o.y < z1 && o.x + o.w > x0 && o.y + o.h > z0);

  const pages = new Map();
  const holds = new Map();
  let version = 0;
  const homes = {};

  function buildPage(cx, cz) {
    const x0 = cx * CHUNK;
    const z0 = cz * CHUNK;
    const GW = CHUNK + 2;
    // The ground columns of the page (with the apron).
    const tops = new Int16Array(GW * GW);
    let maxTop = 0;
    let minTop = Infinity;
    for (let gz = 0; gz < GW; gz++) {
      for (let gx = 0; gx < GW; gx++) {
        const x = x0 - 1 + gx;
        const z = z0 - 1 + gz;
        const type = typeAt(x, z);
        let h = DECKS.has(type) ? 1 : baseTop(x, z);
        h = Math.max(0, h - dugAt(x, z));
        tops[gz * GW + gx] = h;
        maxTop = Math.max(maxTop, baseTop(x, z));
        minTop = Math.min(minTop, h);
      }
    }
    const ground = createGrid(GW, maxTop + 1, GW);
    const kinds = blocks ? new Uint8Array(ground.data.length) : null;
    const water = [];
    const paddies = [];
    const bridges = [];
    const inChunk = (x, z) => x >= x0 && z >= z0 && x < x0 + CHUNK && z < z0 + CHUNK;
    for (let gz = 0; gz < GW; gz++) {
      for (let gx = 0; gx < GW; gx++) {
        const x = x0 - 1 + gx;
        const z = z0 - 1 + gz;
        const type = typeAt(x, z);
        if (!type) continue;
        const def = tileTypes[type] ?? {};
        const h = tops[gz * GW + gx];
        const full = DECKS.has(type) ? 1 : baseTop(x, z);
        // A road of the land is a strip over the ground (strip): its cells have the color of the
        // ground under it, so that no ink line follows the cells.
        const top = DECKS.has(type) ? 'yellowPale' : isLandRoad(x, z) ? tileTypes[underOf(x, z)]?.color ?? 'greenPale' : def.color ?? 'greenPale';
        const under = def.under ?? 'wood';
        for (let y = 0; y < h; y++) {
          // The depth under the first top of the column (a dug column keeps the kinds of its blocks).
          const depth = full - 1 - y;
          const hash = hashSeed(`${id}:${x}:${y}:${z}`);
          // A face of stone (a rock face): rock under the top, in the colors of the face by a seeded
          // rule, so that the ink draws the cracks.
          const kind = blocks ? (def.face && depth > 0 ? 'rock' : kindAt(blocks, depth, hash)) : null;
          // The top and the block under it keep the colors of the ground type; deeper blocks show
          // their kind.
          const color = depth === 0 ? top : def.face ? def.face[hash % def.face.length] : depth === 1 ? under : kind ? blocks.kinds[kind].color : 'wood';
          ground.set(gx, y, gz, color);
          if (kinds) kinds[ground.index(gx, y, gz)] = kindNames.indexOf(kind) + 1;
        }
        if (!inChunk(x, z)) continue;
        if (DECKS.has(type)) {
          // A bridge is a deck of planks over the water (of bamboo on a small river of the land);
          // the ground under it is the river bed.
          bridges.push({ x, z, y: baseTop(x, z), bamboo: type === 'bamboo' });
          water.push({ x, z, y: 1 + WATER.river });
        }
        if (type === 'water' || type === 'shallow') water.push({ x, z, y: baseTop(x, z) + WATER.river, ...(type === 'shallow' ? { ford: true } : {}) });
        if (SEA.has(type)) water.push({ x, z, y: WATER.sea, sea: true });
        if (type === 'field') paddies.push({ x, z, y: baseTop(x, z) + WATER.paddy });
        // A ditch has the still water of a paddy, with no seedlings.
        if (type === 'ditch') paddies.push({ x, z, y: baseTop(x, z) + WATER.paddy, ditch: true });
      }
    }

    // The fine blocks of the page, with one fine block of the apron on each side.
    const FW = CHUNK * 2 + 2;
    const fy0 = Math.max(0, minTop * 2 - 2);
    const fine = createGrid(FW, Math.max(1, Math.min(FINE_Y, maxTop * 2 + FINE_UP) - fy0), FW, { owners: true });
    const fx0 = x0 * 2 - 1;
    const fz0 = z0 * 2 - 1;
    // The props write in fine units of the map; only the blocks of the page stay.
    const writer = {
      inside: (x, y, z) => y >= 0 && y < FINE_Y && (plane || (x >= 0 && z >= 0 && x < W * 2 && z < H * 2)),
      get: (x, y, z) => fine.get(x - fx0, y - fy0, z - fz0),
      set: (x, y, z, color, who) => fine.set(x - fx0, y - fy0, z - fz0, color, who),
    };
    const shadows = new Set();
    const world = {
      fine: writer,
      groundTop: (fx, fz) => baseTop(Math.floor(fx / 2), Math.floor(fz / 2)) * 2,
      shadow: (x, z) => { if (inChunk(x, z)) shadows.add(`${x},${z}`); },
      things: timeThings,
    };
    const page = { cx, cz, key: chunkKey(cx, cz), x0, z0, ground, kinds, fine, fy0, fx0, fz0, objects: [], roofs: [], smooth: [], water, paddies, flowers: [], shadows, used: [], maxTop, partial: !landReady(cx, cz) };
    const here = (fx, fz) => inChunk(Math.floor(fx / 2), Math.floor(fz / 2));
    const add = (prop, key, info) => {
      const who = take(key);
      page.used.push(key);
      const r = buildProp(world, prop, who);
      if (!r.box) return;
      if (info) page.objects.push({ ...info, who, kind: prop.kind, box: r.box, ...(r.info?.home ? { home: r.info.home } : {}) });
      for (const roof of r.roofs) if (here(Math.floor((roof.x0 + roof.x1) / 2), Math.floor((roof.z0 + roof.z1) / 2))) page.roofs.push(roof);
      for (const s of r.smooth) {
        const k = s.ownerGrid === 'ground' ? 2 : 1;
        if (s.owner && here(s.owner[0] * k, s.owner[2] * k)) page.smooth.push(s);
      }
    };

    // Planks of the bridges. The deck in a placement zone (the broken bridge) comes from the world
    // state, so the terrain leaves it out.
    for (const b of bridges) {
      if (inSpan(b.x, b.z)) continue;
      const fy = b.y * 2 - 1;
      const tones = b.bamboo ? ['yellow', 'greenPale'] : ['ochre', 'wood'];
      for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) writer.set(b.x * 2 + dx, fy, b.z * 2 + dz, tones[(b.z * 2 + dz) % 2]);
    }
    // The objects of the map near the chunk.
    for (const o of near(x0 - MARGIN, z0 - MARGIN, x0 + CHUNK + MARGIN, z0 + CHUNK + MARGIN)) {
      const m = REACH[o.prop] ?? REACH.default;
      if (isFelled(o) || o.x - m >= x0 + CHUNK || o.y - m >= z0 + CHUNK || o.x + o.w + m <= x0 || o.y + o.h + m <= z0) continue;
      const mine = inChunk(Math.floor(o.x), Math.floor(o.y));
      add({ ...o, kind: o.prop, fx: o.x * 2, fz: o.y * 2, fw: o.w * 2, fd: o.h * 2, seed: o.seed ?? hashSeed(o.id) }, `o:${o.id}`, mine ? { id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, solid: o.solid !== false, gen: Boolean(o.gen) } : null);
    }
    // Plants that grow on the ground: bamboo on the hedge, low bushes on the low hedge. A clump
    // stands on every fourth cell of every third row (the rows move by two in turn), so that the
    // ground shows between the clumps.
    for (let z = z0 - 2; z < z0 + CHUNK + 2; z++) {
      for (let x = x0 - 2; x < x0 + CHUNK + 2; x++) {
        const grows = tileTypes[typeAt(x, z)]?.grows;
        if (!grows || ((z % 3) + 3) % 3 || (((x + (((z % 6) + 6) % 6 ? 2 : 0)) % 4) + 4) % 4) continue;
        const o = { x, y: z };
        if (isFelled(o)) continue;
        add({ kind: grows, fx: x * 2, fz: z * 2, fw: 2, fd: 2, seed: hashSeed(`${id}:${x}:${z}`) }, `g:${x}:${z}`, inChunk(x, z) ? { id: null, x, y: z, w: 1, h: 1, solid: true, grow: true } : null);
      }
    }
    // Flowers on open grass: small patches of three to seven of one color, where a noise lets them
    // grow (never in a grid, never on a road, a dike, or a paddy). They are smooth looks owned by the
    // top block of their ground column (a dig takes them). The flowers are a list too (world units),
    // for the butterflies by day.
    const r = seeded(hashSeed(`${id}:flowers:${cx}:${cz}`));
    const meadow = hashSeed(`${id}:meadow`) & 0x7fffffff;
    const grassy = (x, z) => ['grass', 'flowers'].includes(typeAt(x, z));
    const edge = (x, z) => !plane && (x < 2 || z < 2 || x > W - 3 || z > H - 3);
    for (let i = 0; i < 2; i++) {
      // The middle of a patch keeps its flowers in the chunk.
      const cxx = x0 + r.int(2, CHUNK - 3);
      const czz = z0 + r.int(2, CHUNK - 3);
      const go = r.next() < 0.32;
      const color = r.pick(['vermilion', 'yellow', 'diep']);
      const n = r.int(3, 7);
      const spots = Array.from({ length: n }, () => [cxx + r.next() * 3 - 1.5, czz + r.next() * 3 - 1.5, r.int(1, 2147483646)]);
      if (!go || edge(cxx, czz) || !grassy(cxx, czz) || fbm(meadow, cxx, czz, { scale: 14, octaves: 2 }) < 0) continue;
      for (const [x, z, seed] of spots) {
        const tx = Math.floor(x);
        const tz = Math.floor(z);
        if (!inChunk(tx, tz) || !grassy(tx, tz) || writer.get(Math.floor(x * 2), world.groundTop(x * 2, z * 2), Math.floor(z * 2))) continue;
        const y = baseTop(tx, tz);
        page.smooth.push({ kind: 'flower', x, y, z, color, seed, who: 0, owner: [tx, y - 1, tz], ownerGrid: 'ground' });
        page.flowers.push({ x, y: y + 0.2, z });
      }
    }
    // Tufts of grass along the edges of the roads and the banks of the fields, and reeds at the
    // water: small smooth looks on grass, or reeds on the sand of a bank (never on a road, a dike,
    // or water), owned by the top block
    // of their ground column (a dig takes them). They lean out from the edge.
    const rt = seeded(hashSeed(`${id}:tufts:${cx}:${cz}`));
    const wetType = (t) => t === 'water' || t === 'shallow' || t === 'sea' || t === 'surf' || t === 'ditch';
    for (let z = z0; z < z0 + CHUNK; z++) {
      for (let x = x0; x < x0 + CHUNK; x++) {
        const roll = rt.next();
        const lean = rt.next();
        const seed = rt.int(1, 2147483646);
        const here = typeAt(x, z);
        if ((here !== 'grass' && here !== 'sand') || edge(x, z)) continue;
        let side = null;
        let reed = false;
        let chance = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const t = typeAt(x + dx, z + dz);
          // Reeds at the water, on grass or on the sand of a bank.
          if (wetType(t)) { side = [dx, dz]; reed = true; chance = 0.6; break; }
          if (here === 'sand') continue;
          if (t === 'path' && chance < 0.5) { side = [dx, dz]; chance = 0.5; }
          if ((t === 'field' || t === 'dike') && chance < 0.35) { side = [dx, dz]; chance = 0.35; }
        }
        if (!side || roll >= chance) continue;
        // Near the edge of the cell on the side of the road, the field, or the water. Beside the
        // strip of a road: just out of its edge, on the side of the line of this cell, so that the
        // tufts cover the seam.
        let tx = x + 0.5 + side[0] * 0.32 + (lean - 0.5) * 0.4 * Math.abs(side[1]);
        let tz = z + 0.5 + side[1] * 0.32 + (lean - 0.5) * 0.4 * Math.abs(side[0]);
        const c = roadCellOf(x, z) && !reed ? map.land.cell(x, z) : null;
        if (c) {
          const [dx, dz] = c.roadDir;
          const at = -c.roadOff;
          const move = Math.sign(at || 1) * (c.roadHalf + STRIP_EDGE + 0.12 + lean * 0.12) - at;
          tx = x + 0.5 - dz * move + dx * (lean - 0.5) * 0.6;
          tz = z + 0.5 + dx * move + dz * (lean - 0.5) * 0.6;
          if (Math.floor(tx) !== x || Math.floor(tz) !== z) continue;
        }
        if (writer.get(Math.floor(tx * 2), world.groundTop(tx * 2, tz * 2), Math.floor(tz * 2)) || roadAt(tx, tz)) continue;
        const y = baseTop(x, z);
        page.smooth.push({ kind: 'tuft', x: tx, y, z: tz, reed, side, seed, who: 0, owner: [x, y - 1, z], ownerGrid: 'ground' });
      }
    }
    for (const o of page.objects) if (o.home && o.id) homes[o.id] = o.home;
    return page;
  }

  // The page of a chunk (made when it is first asked for).
  // Is the land of a page and of the objects near it made? On the plane, the land of a tile can
  // wait for its height tiles (map.ready); a page that was made before that is made again when it
  // is next asked for. The box of a page and its objects is smaller than a tile, so its corners
  // name all its tiles.
  function landReady(cx, cz) {
    if (!map.plane) return true;
    const a = [cx * CHUNK - 1 - MARGIN, cz * CHUNK - 1 - MARGIN];
    const b = [cx * CHUNK + CHUNK + MARGIN, cz * CHUNK + CHUNK + MARGIN];
    return [[a[0], a[1]], [b[0], a[1]], [a[0], b[1]], [b[0], b[1]]].every(([x, z]) => tileMap.inside(x, z));
  }
  function chunk(cx, cz) {
    const k = chunkKey(cx, cz);
    let p = pages.get(k);
    if (p?.partial && landReady(cx, cz)) {
      rebuild(k);
      p = pages.get(k);
    }
    if (!p) {
      p = buildPage(cx, cz);
      pages.set(k, p);
      version += 1;
    }
    return p;
  }
  function drop(k) {
    const p = pages.get(k);
    if (!p) return;
    for (const key of p.used) release(key);
    pages.delete(k);
    version += 1;
  }
  // Build a page again (after a change): the new page first, so that the numbers of its objects stay.
  function rebuild(k) {
    const old = pages.get(k);
    if (!old) return;
    pages.set(k, buildPage(old.cx, old.cz));
    for (const key of old.used) release(key);
    version += 1;
  }
  const pageOf = (x, z) => pages.get(chunkOf(x, z)) ?? null;

  // The ground and the fine blocks of the pages, in map units (0 out of the pages).
  const groundView = {
    get(x, y, z) {
      const p = pageOf(x, z);
      return p ? p.ground.get(x - p.x0 + 1, y, z - p.z0 + 1) : 0;
    },
    top(x, z) {
      const p = pageOf(x, z);
      return p ? p.ground.top(x - p.x0 + 1, z - p.z0 + 1) : -1;
    },
  };
  const fineView = {
    get(x, y, z) {
      const p = pageOf(Math.floor(x / 2), Math.floor(z / 2));
      return p ? p.fine.get(x - p.fx0, y - p.fy0, z - p.fz0) : 0;
    },
    ownerAt(x, y, z) {
      const p = pageOf(Math.floor(x / 2), Math.floor(z / 2));
      return p ? p.fine.ownerAt(x - p.fx0, y - p.fy0, z - p.fz0) : 0;
    },
  };

  // The lists of all pages, made again when the pages change.
  let lists = null;
  let listVersion = -1;
  const all = () => {
    if (listVersion !== version) {
      const ps = [...pages.values()];
      lists = {
        objects: ps.flatMap((p) => p.objects),
        roofs: ps.flatMap((p) => p.roofs),
        smooth: ps.flatMap((p) => p.smooth),
        water: ps.flatMap((p) => p.water),
        paddies: ps.flatMap((p) => p.paddies),
        flowers: ps.flatMap((p) => p.flowers),
      };
      listVersion = version;
    }
    return lists;
  };

  // The chunks that a change at a ground column touches: its own chunk, and the chunk next to it
  // when the column is at an edge (a face of that chunk can show now).
  function touched(x, z) {
    const keys = new Set([chunkOf(x, z)]);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) keys.add(chunkOf(x + dx, z + dz));
    return [...keys].filter((k) => pages.has(k));
  }

  // Dig the top block of a column. Return null when there is nothing to dig, else { kind, drops,
  // at: [x, y, z], chunks } (the chunks to build again).
  function dig(x, z) {
    chunk(Math.floor(x / CHUNK), Math.floor(z / CHUNK));
    const y = groundView.top(x, z);
    if (y < 0) return null;
    const p = pageOf(x, z);
    const i = p.ground.index(x - p.x0 + 1, y, z - p.z0 + 1);
    const kind = p.kinds ? kindNames[p.kinds[i] - 1] ?? 'soil' : 'soil';
    recordOf(x, z, true).dug[local(x, z)] += 1;
    // The block goes from every page that keeps it (its own, and the aprons of the pages around).
    for (const q of pages.values()) {
      const lx = x - q.x0 + 1;
      const lz = z - q.z0 + 1;
      if (lx < 0 || lz < 0 || lx >= CHUNK + 2 || lz >= CHUNK + 2) continue;
      q.ground.set(lx, y, lz, 0);
      if (q.kinds) q.kinds[q.ground.index(lx, y, lz)] = 0;
    }
    return { kind, drops: { ...(blocks.kinds[kind]?.drops ?? {}) }, at: [x, y, z], chunks: touched(x, z) };
  }

  // Fell a tree (or take away another object of the map): its blocks go, and the smooth looks that
  // they own go with them. Return null for no such object, else { blocks (the count), drops, chunks }.
  function fell(objectId) {
    const o = all().objects.find((x) => x.id === objectId);
    if (!o) return null;
    const key = `o:${objectId}`;
    let count = 0;
    const keys = [];
    for (const p of pages.values()) {
      if (!p.used.includes(key)) continue;
      keys.push(p.key);
      // The blocks of the object in the chunk (not in the apron).
      for (let y = 0; y < p.fine.sy; y++) {
        for (let z = 1; z <= CHUNK * 2; z++) for (let x = 1; x <= CHUNK * 2; x++) if (p.fine.ownerAt(x, y, z) === o.who && p.fine.get(x, y, z)) count += 1;
      }
    }
    const fx = Math.floor(o.x);
    const fz = Math.floor(o.y);
    recordOf(fx, fz, true).felled[local(fx, fz)] = 1;
    for (const k of keys) rebuild(k);
    const per = blocks.kinds.trunk?.drops ?? {};
    const drops = Object.fromEntries(Object.entries(per).map(([k, n]) => [k, Math.max(1, Math.round((n * count) / 8))]));
    return { blocks: count, drops, chunks: keys };
  }

  // A shadow makes the top of the ground a little darker.
  const shade = (x, y, z) => (pageOf(x, z)?.shadows.has(`${x},${z}`) ? 0.8 : 1);

  // The roads of the land are strips over the ground (src/render/voxel.js): each top face on or
  // beside a road keeps the direction of the smooth line of the road, the distance of the cell from
  // it, and the half width of the road, and the shader draws the road where a point is within the
  // half width, with a soft edge. So the edge follows the line, with no step from cell to cell. The
  // cells keep their types and their heights for movement.
  const STRIP_TYPES = new Set(['grass', 'flowers', 'sand', 'yard']);
  const NEAR8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const isLandRoad = (x, z) => typeAt(x, z) === 'path' && (map.land?.cell?.(x, z).roadHalf ?? 0) > 0;
  // The ground under a road cell: the most common plain ground type next to it (grass if none).
  function underOf(x, z) {
    const count = new Map();
    for (const [dx, dz] of NEAR8) {
      const t = typeAt(x + dx, z + dz);
      if (STRIP_TYPES.has(t) && t !== 'yard') count.set(t, (count.get(t) ?? 0) + 1);
    }
    let best = 'grass';
    for (const [t, n] of count) if (n > (count.get(best) ?? 0)) best = t;
    return best;
  }
  // The road cell whose strip goes over a cell: the cell itself, or a road cell next to it at the
  // same height (a cell beside the road on plain ground). null for any other cell.
  function roadCellOf(x, z) {
    const c = map.land?.cell?.(x, z);
    if (!c || !c.roadHalf || !c.roadDir || dugAt(x, z)) return null;
    if (isLandRoad(x, z)) return [x, z];
    if (!STRIP_TYPES.has(typeAt(x, z))) return null;
    const h = baseTop(x, z);
    for (const [dx, dz] of NEAR8) if (isLandRoad(x + dx, z + dz) && baseTop(x + dx, z + dz) === h && !dugAt(x + dx, z + dz)) return [x + dx, z + dz];
    return null;
  }
  // A road of the land on dry land lies a little lower than the grass: the strip shows a shadow
  // line along its edges. A road on a bank over the paddies, or next to one, does not.
  function lowRoad(x, z) {
    const c = map.land.cell(x, z);
    if (c.bank) return false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (map.land.cell(x + dx, z + dz).bank === 1) return false;
    return true;
  }
  // The strip over a top: [the color index of the road, its half width (negative on a road that lies
  // lower)], or null.
  const roadColor = colorIndex(tileTypes.path?.color ?? 'paperDeep');
  function strip(x, z) {
    const r = roadCellOf(x, z);
    if (!r) return null;
    const half = map.land.cell(x, z).roadHalf;
    return [roadColor, lowRoad(r[0], r[1]) ? -half : half];
  }
  // The edge of the strip: the soft band where the road goes into the ground (in cells, on each
  // side of the half width).
  const STRIP_EDGE = 0.12;
  // Is a point on the strip of a road (the soft band included)?
  function roadAt(fx, fz) {
    const x = Math.floor(fx);
    const z = Math.floor(fz);
    if (!roadCellOf(x, z)) return false;
    const c = map.land.cell(x, z);
    const [dx, dz] = c.roadDir;
    return Math.abs((fx - x - 0.5) * -dz + (fz - z - 0.5) * dx - c.roadOff) < c.roadHalf + STRIP_EDGE;
  }

  // The surface of the top of a cell, for the printed texture of the ground (src/render/voxel.js):
  // [kind (SURFACE), dx, dz (the direction of a road), off (the signed distance of the cell from
  // the middle line of the road), wet (-1 dry high land to 1 next to water), density (of the
  // strokes of grass)]. A cell under or beside the strip of a road takes the direction from the
  // line of the road; a path of a village takes it from the path cells around it.
  const isPath = (x, z) => typeAt(x, z) === 'path';
  const VILLAGE = SURFACE[tileTypes.path?.village ?? 'packed'] ?? SURFACE.packed;
  function surface(x, z) {
    const type = typeAt(x, z);
    const c = map.land?.cell?.(x, z) ?? null;
    const stamp = c ? c.stamp : true;
    const road = roadCellOf(x, z);
    let kind = type === 'path' ? (road ? SURFACE_OF[underOf(x, z)] : VILLAGE) : SURFACE_OF[type] ?? 0;
    if (kind === SURFACE.grass && c && !stamp && c.level >= 5) kind = SURFACE.forest;
    let dx = 0;
    let dz = 0;
    let off = 0;
    if (road) {
      [dx, dz] = c.roadDir;
      // The across axis is (-dz, dx); the line keeps the distance on the other side.
      off = -c.roadOff;
    } else if (type === 'path') {
      // The main axis of the path cells within two cells, and the middle of them.
      let n = 0;
      let mx = 0;
      let mz = 0;
      const pts = [];
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (isPath(x + i, z + j)) { pts.push([i, j]); mx += i; mz += j; n += 1; }
      mx /= n;
      mz /= n;
      let sxx = 0;
      let szz = 0;
      let sxz = 0;
      for (const [i, j] of pts) {
        sxx += (i - mx) ** 2;
        szz += (j - mz) ** 2;
        sxz += (i - mx) * (j - mz);
      }
      const a = 0.5 * Math.atan2(2 * sxz, sxx - szz);
      dx = Math.cos(a);
      dz = Math.sin(a);
      // The cell is off the middle of the path cells across the axis.
      off = -(mx * -dz + mz * dx);
    }
    let wet = 0;
    let density = 0.75;
    if (c) {
      if (c.water <= 3) wet = 1 - c.water / 4;
      else if (c.level >= 5 && c.water > 8) wet = -0.6;
      if (stamp) density = 0.45;
      else if (c.field <= 1) density = 1;
    }
    return [kind, dx, dz, off, wet, density];
  }
  const topAt = (x, z) => Math.max(0, baseTop(x, z) - dugAt(x, z));
  // The top for a tap: the surface of the water over a bed (pickTopOf).
  const pickTop = (x, z) => pickTopOf(typeAt(x, z), topAt(x, z));

  const terrain = {
    width: W,
    height: H,
    plane,
    ground: groundView,
    fine: fineView,
    shade,
    surface,
    strip,
    roadAt,
    topAt,
    pickTop,
    baseTop,
    // The highest top of the ground (for a ray from the camera).
    get maxTop() { return plane ? 40 : Math.max(0, ...[...pages.values()].map((p) => p.maxTop)); },
    get objects() { return all().objects; },
    get roofs() { return all().roofs; },
    get smooth() { return all().smooth; },
    get water() { return all().water; },
    get paddies() { return all().paddies; },
    get flowers() { return all().flowers; },
    // The ways into the houses (fine units = half blocks), by the id of the house. A house of a
    // chunk that was made once stays here.
    homes,
    kindNames,
    get version() { return version; },
    chunk,
    has: (cx, cz) => pages.has(chunkKey(cx, cz)),
    page: (k) => pages.get(k) ?? null,
    get pages() { return [...pages.values()]; },
    // Hold the pages of these chunks (keys) for a user (the session, the view); a page that no
    // user holds goes.
    hold(user, keys) {
      holds.set(user, new Set(keys));
      for (const k of keys) chunk(...k.split(',').map(Number));
      for (const k of [...pages.keys()]) if (![...holds.values()].some((set) => set.has(k))) drop(k);
    },
    drop,
    isFelled,
    // The object of a number (the owner of a block), or null.
    objectOf: (who) => all().objects.find((o) => o.who === who) ?? null,
    // World units: one ground block is 1 unit; a fine block is 0.5.
    boxOf: (o) => ({ x0: o.box.x0 / 2, y0: o.box.y0 / 2, z0: o.box.z0 / 2, x1: o.box.x1 / 2, y1: o.box.y1 / 2, z1: o.box.z1 / 2 }),
    // A change of the terrain, for the stories and the tools of a later era: { type: 'fell', id }
    // takes away an object of the map (a tree and its crown); { type: 'dig', at: [x, z] } takes the
    // top block of a column. Return the result (with the chunks to build again), or null.
    edit(cmd) {
      if (!blocks) return null;
      if (cmd.type === 'fell') return fell(cmd.id);
      if (cmd.type === 'dig') return dig(cmd.at[0], cmd.at[1]);
      return null;
    },
    // The changes of the player, for the save: { key: { dug: [runs, ...] (a list of bits for each
    // depth: the columns dug at least once, twice, ...), felled: runs } }, only for changed chunks.
    edits() {
      const out = {};
      for (const [k, e] of edits) {
        const most = Math.max(0, ...e.dug);
        const felled = e.felled.some(Boolean);
        if (!most && !felled) continue;
        out[k] = {
          ...(most ? { dug: Array.from({ length: most }, (_, d) => runsOf(e.dug.map((n) => (n > d ? 1 : 0)))) } : {}),
          ...(felled ? { felled: runsOf(e.felled) } : {}),
        };
      }
      return out;
    },
    // Start again from the changes of a save (edits() gives this form). All pages are made again.
    loadEdits(saved = {}) {
      edits = new Map();
      const n = CHUNK * CHUNK;
      for (const [k, e] of Object.entries(saved ?? {})) {
        const dug = new Uint8Array(n);
        for (const runs of e.dug ?? []) bitsOf(runs, n).forEach((b, i) => { dug[i] += b; });
        edits.set(k, { dug, felled: e.felled ? bitsOf(e.felled, n) : new Uint8Array(n) });
      }
      for (const k of [...pages.keys()]) rebuild(k);
    },
  };
  return terrain;
}

// The terrain of a small map with all its cells (data/maps/ form): all its pages are made.
export function buildTerrain(map, tileTypes, tileMap, blocks = null) {
  const t = createTerrain(map, tileTypes, tileMap, blocks);
  for (let cz = 0; cz * CHUNK < map.height; cz++) for (let cx = 0; cx * CHUNK < map.width; cx++) t.chunk(cx, cz);
  return t;
}
