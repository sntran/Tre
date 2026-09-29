// Build the voxel world of a map: the ground grid (full blocks, one column for each map cell),
// the fine grid (half-size blocks for props), the water, the paddies, and the boxes of the
// objects. Pure, no DOM, no WebGL.
//
// Map cells: x to the east, y (map) to the south = z in the world. A ground column of height h
// fills the blocks 0 to h - 1, so its top is at world y = h. h = the height digit of the map + 1.
import { createGrid, hashSeed, seeded } from './voxel.js';
import { buildProp } from './props/index.js';

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

export function buildTerrain(map, tileTypes, tileMap) {
  const W = map.width;
  const H = map.height;
  const L = map.layers;
  const typeAt = (x, z) => tileMap.type(x, z);
  const topAt = (x, z) => (tileMap.inside(x, z) ? columnTop(tileMap.heightAt(x, z)) : 0);
  let maxTop = 0;
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) maxTop = Math.max(maxTop, topAt(x, z));

  const ground = createGrid(W, maxTop + 1, H);
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
      for (let y = 0; y < h; y++) ground.set(x, y, z, y === h - 1 ? top : y === h - 2 ? under : 'wood');
      if (type === 'water' || type === 'shallow') water.push({ x, z, y: h + WATER.river });
      if (type === 'field') paddies.push({ x, z, y: h + WATER.paddy });
    }
  }

  const groundTop = (fx, fz) => topAt(Math.floor(fx / 2), Math.floor(fz / 2)) * 2;
  const world = { fine, groundTop, shadow };
  const objects = [];
  const roofs = [];
  const add = (prop, id, solid = true) => {
    const who = objects.length + 1;
    const r = buildProp(world, prop, who);
    if (!r.box) return;
    objects.push({ id, who, kind: prop.kind, box: r.box, solid });
    roofs.push(...r.roofs);
  };

  // Planks of the bridges, and posts at the ends.
  for (const b of bridges) {
    const fy = b.y * 2 - 1;
    for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) fine.set(b.x * 2 + dx, fy, b.z * 2 + dz, (b.z * 2 + dz) % 2 ? 'wood' : 'ochre');
  }

  // The objects of the map.
  for (const o of L.objects) {
    add({ ...o, kind: o.prop, fx: o.x * 2, fz: o.y * 2, fw: o.w * 2, fd: o.h * 2, seed: o.seed ?? hashSeed(o.id) }, o.id, o.solid !== false);
  }
  // Plants that grow on the ground: bamboo on the hedge, low bushes on the low hedge.
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const grows = tileTypes[typeAt(x, z)]?.grows;
      if (!grows || x % 2 || z % 2) continue;
      add({ kind: grows, fx: x * 2 - 1, fz: z * 2 - 1, fw: 4, fd: 4, seed: hashSeed(`${map.id}:${x}:${z}`), stems: 2 }, null);
    }
  }
  // Flowers and small stones on open grass, by a seeded rule (never in a grid).
  const r = seeded(hashSeed(`${map.id}:flowers`));
  for (let i = 0; i < W * H * 0.025; i++) {
    const x = r.int(1, W - 2);
    const z = r.int(1, H - 2);
    const type = typeAt(x, z);
    if (type !== 'grass' && type !== 'flowers') continue;
    const fx = x * 2 + r.int(0, 1);
    const fz = z * 2 + r.int(0, 1);
    const g = groundTop(fx, fz);
    if (fine.get(fx, g, fz)) continue;
    if (r.chance(0.6)) fine.set(fx, g, fz, r.pick(['vermilion', 'yellow', 'diep']));
    else fine.set(fx, g, fz, 'ashLight');
  }

  // A shadow makes the top of the ground a little darker.
  const shade = (x, y, z) => (shadows.has(z * W + x) ? 0.8 : 1);
  return {
    width: W, height: H, ground, fine, shade, objects, roofs, water, paddies,
    topAt,
    maxTop,
    // World units: one ground block is 1 unit; a fine block is 0.5.
    boxOf: (o) => ({ x0: o.box.x0 / 2, y0: o.box.y0 / 2, z0: o.box.z0 / 2, x1: o.box.x1 / 2, y1: o.box.y1 / 2, z1: o.box.z1 / 2 }),
  };
}
