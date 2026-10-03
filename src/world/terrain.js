// Build the voxel world of a map: the ground grid (full blocks, one column for each map cell),
// the fine grid (half-size blocks for props), the water, the paddies, and the boxes of the
// objects. Pure, no DOM, no WebGL.
//
// Map cells: x to the east, y (map) to the south = z in the world. A ground column of height h
// fills the blocks 0 to h - 1, so its top is at world y = h. h = the height digit of the map + 1.
import { createGrid, hashSeed, seeded } from './voxel.js';
import { fbm } from '../core/gen/noise.js';
import { buildProp } from './props/index.js';
import { dig, fell } from './chunks.js';

export const WATER = Object.freeze({ river: 0.6, paddy: 0.55 }); // the water over the bed, in blocks

// The top of the ground of a cell (world y), from the height layer.
export const columnTop = (digit) => digit + 1;

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

// blocks: data/world/blocks.json; with it, the ground keeps the kind of each block (kinds), so that a
// dig knows what it takes (src/world/chunks.js).
export function buildTerrain(map, tileTypes, tileMap, blocks = null) {
  const W = map.width;
  const H = map.height;
  const L = map.layers;
  const typeAt = (x, z) => tileMap.type(x, z);
  const topAt = (x, z) => (tileMap.inside(x, z) ? columnTop(tileMap.heightAt(x, z)) : 0);
  let maxTop = 0;
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) maxTop = Math.max(maxTop, topAt(x, z));

  const ground = createGrid(W, maxTop + 1, H);
  // The kind of each ground block: an index into the kinds of blocks.json (+1; 0 is none).
  const kindNames = blocks ? Object.keys(blocks.kinds) : [];
  const kinds = blocks ? new Uint8Array(ground.data.length) : null;
  const fine = createGrid(W * 2, maxTop * 2 + 64, H * 2, { owners: true });
  const shadows = new Set();
  const shadow = (x, z) => shadows.add(z * W + x);

  // Ruts along a road: the second and the second-last row across a road that is long in one way.
  const isRoad = (x, z) => typeAt(x, z) === 'path';
  const run = (x, z, dx, dz) => {
    let back = 0;
    while (isRoad(x - dx * (back + 1), z - dz * (back + 1))) back += 1;
    let n = back + 1;
    while (isRoad(x + dx * (n - back), z + dz * (n - back))) n += 1;
    return { n, i: back };
  };
  const rut = (x, z) => {
    const along = run(x, z, 1, 0);
    const across = run(x, z, 0, 1);
    if (along.n >= 6 && across.n >= 3 && across.n <= 6) return across.i === 1 || across.i === across.n - 2;
    if (across.n >= 6 && along.n >= 3 && along.n <= 6) return along.i === 1 || along.i === along.n - 2;
    return false;
  };

  const water = [];
  const paddies = [];
  const bridges = [];
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const type = typeAt(x, z);
      const def = tileTypes[type] ?? {};
      let h = topAt(x, z);
      if (type === 'bridge') {
        // A bridge is a deck of planks over the water; the ground under it is the river bed.
        bridges.push({ x, z, y: h });
        h = 1;
        water.push({ x, z, y: h + WATER.river });
      }
      const top = type === 'bridge' ? 'yellowPale' : rut(x, z) ? 'ashLight' : def.color ?? 'greenPale';
      const under = def.under ?? 'wood';
      for (let y = 0; y < h; y++) {
        const depth = h - 1 - y;
        const hash = hashSeed(`${map.id}:${x}:${y}:${z}`);
        // A face of stone (a rock face): rock under the top, in the colors of the face by a seeded
        // rule, so that the ink draws the cracks.
        const kind = blocks ? (def.face && depth > 0 ? 'rock' : kindAt(blocks, depth, hash)) : null;
        // The top and the block under it keep the colors of the ground type; deeper blocks show
        // their kind.
        const color = depth === 0 ? top : def.face ? def.face[hash % def.face.length] : depth === 1 ? under : kind ? blocks.kinds[kind].color : 'wood';
        ground.set(x, y, z, color);
        if (kinds) kinds[ground.index(x, y, z)] = kindNames.indexOf(kind) + 1;
      }
      if (type === 'water' || type === 'shallow') water.push({ x, z, y: h + WATER.river, ...(type === 'shallow' ? { ford: true } : {}) });
      if (type === 'field') paddies.push({ x, z, y: h + WATER.paddy });
    }
  }

  const groundTop = (fx, fz) => topAt(Math.floor(fx / 2), Math.floor(fz / 2)) * 2;
  const world = { fine, groundTop, shadow };
  const objects = [];
  const roofs = [];
  const smooth = [];
  const add = (prop, id, solid = true) => {
    const who = objects.length + 1;
    const r = buildProp(world, prop, who);
    if (!r.box) return;
    objects.push({ id, who, kind: prop.kind, box: r.box, solid, ...(r.info?.home ? { home: r.info.home } : {}) });
    roofs.push(...r.roofs);
    smooth.push(...r.smooth);
  };

  // Planks of the bridges. The deck in a placement zone (the broken bridge) comes from the world
  // state, so the terrain leaves it out.
  const spans = (L.zones ?? []).filter((r) => r.task);
  const inSpan = (x, z) => spans.some((r) => x >= r.x && x < r.x + r.w && z >= r.y && z < r.y + r.h);
  for (const b of bridges) {
    if (inSpan(b.x, b.z)) continue;
    const fy = b.y * 2 - 1;
    for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) fine.set(b.x * 2 + dx, fy, b.z * 2 + dz, (b.z * 2 + dz) % 2 ? 'wood' : 'ochre');
  }

  // The objects of the map.
  for (const o of L.objects) {
    add({ ...o, kind: o.prop, fx: o.x * 2, fz: o.y * 2, fw: o.w * 2, fd: o.h * 2, seed: o.seed ?? hashSeed(o.id) }, o.id, o.solid !== false);
  }
  // Plants that grow on the ground: bamboo on the hedge, low bushes on the low hedge. A clump
  // stands on every fourth cell of every third row (the rows move by two in turn), so that the ground shows
  // between the clumps.
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const grows = tileTypes[typeAt(x, z)]?.grows;
      if (!grows || z % 3 || (x + (z % 6 ? 2 : 0)) % 4) continue;
      add({ kind: grows, fx: x * 2, fz: z * 2, fw: 2, fd: 2, seed: hashSeed(`${map.id}:${x}:${z}`) }, null);
    }
  }
  // Flowers on open grass: small patches of three to seven of one color, where a noise lets them
  // grow (never in a grid, never on a road, a dike, or a paddy). They are smooth looks owned by the
  // top block of their ground column (a dig takes them). The flowers are a list too (world units),
  // for the butterflies by day.
  const flowers = [];
  const r = seeded(hashSeed(`${map.id}:flowers`));
  const meadow = hashSeed(`${map.id}:meadow`) & 0x7fffffff;
  const grassy = (x, z) => ['grass', 'flowers'].includes(typeAt(x, z));
  for (let i = 0; i < W * H * 0.0025; i++) {
    const cx = r.int(2, W - 3);
    const cz = r.int(2, H - 3);
    if (!grassy(cx, cz) || fbm(meadow, cx, cz, { scale: 14, octaves: 2 }) < 0) continue;
    const color = r.pick(['vermilion', 'yellow', 'diep']);
    const n = r.int(3, 7);
    for (let k = 0; k < n; k++) {
      const x = cx + r.next() * 3 - 1.5;
      const z = cz + r.next() * 3 - 1.5;
      const tx = Math.floor(x);
      const tz = Math.floor(z);
      if (!grassy(tx, tz) || fine.get(Math.floor(x * 2), groundTop(x * 2, z * 2), Math.floor(z * 2))) continue;
      const y = topAt(tx, tz);
      smooth.push({ kind: 'flower', x, y, z, color, seed: r.int(1, 2147483646), who: 0, owner: [tx, y - 1, tz], ownerGrid: 'ground' });
      flowers.push({ x, y: y + 0.2, z });
    }
  }

  // A shadow makes the top of the ground a little darker.
  const shade = (x, y, z) => (shadows.has(z * W + x) ? 0.8 : 1);
  const terrain = {
    width: W, height: H, ground, fine, shade, objects, roofs, smooth, water, paddies, flowers, kinds, kindNames,
    topAt,
    maxTop,
    // The ways into the houses (fine units = half blocks), by the id of the house.
    homes: Object.fromEntries(objects.filter((o) => o.home && o.id).map((o) => [o.id, o.home])),
    // World units: one ground block is 1 unit; a fine block is 0.5.
    boxOf: (o) => ({ x0: o.box.x0 / 2, y0: o.box.y0 / 2, z0: o.box.z0 / 2, x1: o.box.x1 / 2, y1: o.box.y1 / 2, z1: o.box.z1 / 2 }),
    edited: false,
    // A change of the terrain (src/world/chunks.js), for the stories and the tools of a later era:
    // { type: 'fell', id } takes away an object of the map (a tree and its crown); { type: 'dig',
    // at: [x, z] } takes the top block of a column. Return the result (with the chunks to build
    // again), or null. A changed terrain is marked, so that a cache builds it again for a new start.
    edit(cmd) {
      if (!blocks) return null;
      let r = null;
      if (cmd.type === 'fell') {
        const o = objects.find((x) => x.id === cmd.id && !x.gone);
        r = o ? fell(terrain, blocks, o.who) : null;
      } else if (cmd.type === 'dig') {
        const [x, z] = cmd.at;
        const y = ground.top(x, z);
        r = y >= 0 ? { ...dig(terrain, blocks, x, y, z), at: [x, y, z] } : null;
      }
      if (r) terrain.edited = true;
      return r;
    },
  };
  return terrain;
}
