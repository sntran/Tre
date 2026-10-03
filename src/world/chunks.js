// The world in chunks: parts of CHUNK × CHUNK ground columns (the pages of src/world/terrain.js).
// Each chunk has its own meshes (the ground, the things, and the ink), so that a change (a dig, a
// felled tree, a house that comes apart) builds only the chunks that it touches, and the chunks come
// and go with the hero. Pure, no WebGL: the meshes are plain arrays, with positions from the corner
// of the chunk (so that a place far out on the plane keeps its precision), and the renderer
// (src/render/voxel.js) puts them in buffers.
//
// No smooth mesh is baked or exists alone: a roof (src/world/roofs.js) or another smooth look
// (src/world/smooth.js) has an owner block, and it draws only while that block is there.
import { meshGrid } from './mesher.js';
import { roofMesh } from './roofs.js';
import { smoothMesh } from './smooth.js';
import { CHUNK, chunkKey, chunkOf, chunkOfFine } from './terrain.js';
import { toneRgb, FACE_TONES } from './voxel.js';

export { CHUNK, chunkKey, chunkOf, chunkOfFine };

// Is the owner of a look there? owner: a fine block [fx, fy, fz] (or a ground block [x, y, z] when
// grid is 'ground'), or null (always there).
export const ownerThere = (terrain, owner, grid = 'fine') => !owner || terrain[grid].get(owner[0], owner[1], owner[2]) > 0;

// Move a mesh of world units to the corner of a chunk.
function shift(m, ox, oz) {
  const move = (list, step) => {
    if (!list) return list;
    const out = list.slice();
    for (let i = 0; i < out.length; i += step) {
      out[i] -= ox;
      out[i + 2] -= oz;
    }
    return out;
  };
  const segs = m.segs ? m.segs.slice() : m.segs;
  if (segs) {
    for (let i = 0; i < segs.length; i += 3) {
      segs[i] -= ox;
      segs[i + 2] -= oz;
    }
  }
  return { ...m, positions: move(m.positions, 3), segs, ...(m.hull ? { hull: { ...m.hull, positions: move(m.hull.positions, 3) } } : {}) };
}

// The meshes of one chunk. Return { origin: [x, 0, z] (the corner of the chunk, world units),
// ground, things, ink, triangles }: ground and things: { positions, colors, owners, indices } (from
// the corner); ink: a list of groups { segs, w, owners, outer, hull } for src/render/voxel.js (hull:
// the triangles of the silhouette of the smooth looks, drawn in ink from the back). coarse: the far
// level (no ink inside the blocks, no flowers, a crown of one blob).
export function chunkMesh(terrain, cx, cz, { coarse = false } = {}) {
  const p = terrain.chunk(cx, cz);
  const ox = p.x0;
  const oz = p.z0;
  // The top of each column has its surface (the kind of the ground and the direction of a road),
  // for the printed texture of the ground.
  const top = terrain.surface ? (x, y, z) => terrain.surface(x - 1 + ox, z - 1 + oz) : null;
  // The strip of a road of the land over a top (see strip in src/world/terrain.js).
  const roadOf = terrain.strip ? (x, z) => terrain.strip(x - 1 + ox, z - 1 + oz) : null;
  const ground = coarse ? coarseGround(p, top, roadOf) : meshGrid(p.ground, { x0: 1, z0: 1, x1: 1 + CHUNK, z1: 1 + CHUNK, scale: 1, origin: [-1, 0, -1], shade: (x, y, z) => terrain.shade(x - 1 + ox, y, z - 1 + oz), top, strip: roadOf });
  // The faces of a fine block that touch the ground are hidden.
  const underGround = (x, y, z) => p.ground.get(((x + p.fx0) >> 1) - ox + 1, (y + p.fy0) >> 1, ((z + p.fz0) >> 1) - oz + 1) > 0;
  const fine = meshGrid(p.fine, { x0: 1, z0: 1, x1: 1 + CHUNK * 2, z1: 1 + CHUNK * 2, scale: 0.5, origin: [-1, p.fy0, -1], other: underGround, ink: !coarse });
  // sway: [weight, layer] for each vertex (src/world/smooth.js); blocks and roofs do not move.
  const things = { positions: [...fine.positions], colors: [...fine.colors], owners: [...fine.owners], indices: [...fine.indices], sway: new Array((fine.positions.length / 3) * 2).fill(0) };
  const ink = coarse ? [] : [
    { segs: ground.segments, w: 0.14, owners: ground.segOwners, outer: ground.segOuter },
    { segs: fine.segments, w: 0.1, owners: fine.segOwners, outer: fine.segOuter },
  ];
  const append = (m) => {
    const base = things.positions.length / 3;
    things.positions.push(...m.positions);
    things.colors.push(...m.colors);
    things.owners.push(...m.owners);
    things.sway.push(...(m.sway ?? new Array((m.positions.length / 3) * 2).fill(0)));
    for (const i of m.indices) things.indices.push(base + i);
  };
  // The roofs whose middle is in this chunk, while their house is there.
  for (const r of p.roofs) {
    if (!ownerThere(terrain, r.owner)) continue;
    const m = shift(roofMesh(r), ox, oz);
    append(m);
    if (!coarse) ink.push({ segs: m.segs, w: 0.11, owners: m.outer.map(() => r.who ?? 0), outer: m.outer });
  }
  // The smooth looks (crowns, culms, leaves, haystacks, flowers) whose owner block is in this chunk.
  // The lines at the edges of a leaf are inner lines: on a thin leaf they are most of the leaf, so
  // they fade with their owner. Only the hull stays as the outline of a faded look.
  for (const s of p.smooth) {
    if ((coarse && (s.kind === 'flower' || s.kind === 'tuft')) || !ownerThere(terrain, s.owner, s.ownerGrid)) continue;
    const m = shift(smoothMesh(s, { coarse }), ox, oz);
    append(m);
    if (!coarse) ink.push({ who: s.who ?? 0, sway: m.segSway, segs: m.segs, w: 0.09, owners: m.segs.length ? Array(m.segs.length / 6).fill(s.who ?? 0) : [], outer: Array(m.segs.length / 6).fill(0), hull: m.hull });
  }
  let triangles = (ground.indices.length + things.indices.length) / 3;
  for (const k of ink) triangles += (k.segs.length / 6) * 2 + (k.hull ? k.hull.indices.length / 3 : 0);
  return { origin: [ox, 0, oz], ground, things, ink, triangles };
}

// The ground of a far chunk (the coarse level): the tops of a row of columns of one height and one
// color are one quad, and the step down to a lower column is one quad, in the color under the top.
// No ink. surfaceOf(x, y, z): the surface of a top (see meshGrid); a far top keeps its kind and its
// wetness. stripOf(x, z): the strip of a road over a top (see meshGrid); a top under a strip is one
// quad, with the direction of its road. Return the form of meshGrid (positions from the corner of
// the chunk).
const FLAT = [0, 0, 0, 0, 0, 0];
const NO_STRIP = [0, 0, 0, 0];
export function coarseGround(p, surfaceOf = null, stripOf = null) {
  const g = p.ground;
  const top = (lx, lz) => g.top(lx, lz) + 1; // the top of a column of the page (with the apron)
  const out = { positions: [], colors: [], owners: [], indices: [], segments: [], segOwners: [], segOuter: [], surface: surfaceOf ? [] : null, strip: stripOf ? [] : null };
  let n = 0;
  const quad = (a, b, c, d, rgb, sf = FLAT, st = NO_STRIP) => {
    for (const v of [a, b, c, d]) {
      out.positions.push(v[0], v[1], v[2]);
      out.colors.push(...rgb);
      out.owners.push(0);
      if (out.surface) out.surface.push(sf[0], st[3] ? sf[1] : 0, st[3] ? sf[2] : 0, st[3] ? sf[3] : 0, sf[4], sf[5]);
      if (out.strip) out.strip.push(...st);
    }
    out.indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
    n += 4;
  };
  for (let z = 1; z <= CHUNK; z++) {
    let x = 1;
    while (x <= CHUNK) {
      const h = top(x, z);
      if (h <= 0) {
        x += 1;
        continue;
      }
      const c = g.get(x, h - 1, z);
      const road = stripOf?.(x, z);
      let e = x + 1;
      if (!road) while (e <= CHUNK && top(e, z) === h && g.get(e, h - 1, z) === c && !stripOf?.(e, z)) e += 1;
      const rgb = toneRgb(c, FACE_TONES.py);
      quad([x - 1, h, z], [e - 1, h, z], [e - 1, h, z - 1], [x - 1, h, z - 1], rgb, surfaceOf?.(x, h - 1, z) ?? FLAT, road ? [...toneRgb(road[0], FACE_TONES.py), road[1]] : NO_STRIP);
      x = e;
    }
    for (let x2 = 1; x2 <= CHUNK; x2++) {
      const h = top(x2, z);
      if (h <= 0) continue;
      const side = g.get(x2, Math.max(0, h - 2), z) || g.get(x2, h - 1, z);
      for (const [dx, dz, face] of [[1, 0, 'px'], [-1, 0, 'nx'], [0, 1, 'pz'], [0, -1, 'nz']]) {
        const lo = Math.max(0, top(x2 + dx, z + dz));
        if (lo >= h) continue;
        const rgb = toneRgb(side, FACE_TONES[face]);
        const X = x2 - 1;
        const Z = z - 1;
        if (face === 'px') quad([X + 1, lo, Z], [X + 1, h, Z], [X + 1, h, Z + 1], [X + 1, lo, Z + 1], rgb);
        if (face === 'nx') quad([X, lo, Z + 1], [X, h, Z + 1], [X, h, Z], [X, lo, Z], rgb);
        if (face === 'pz') quad([X + 1, lo, Z + 1], [X + 1, h, Z + 1], [X, h, Z + 1], [X, lo, Z + 1], rgb);
        if (face === 'nz') quad([X, lo, Z], [X, h, Z], [X + 1, h, Z], [X + 1, lo, Z], rgb);
      }
    }
  }
  return out;
}

// The kind of water of each ground type, as the view draws it.
export const WATER_KINDS = Object.freeze({ water: 'river', bridge: 'river', bamboo: 'river', shallow: 'ford', sea: 'sea', surf: 'surf' });

// The water of a far chunk in runs along x: one flat quad for each run of one kind of water at one
// height. waterAt(x, z): the kind of water of a cell ('river', 'ford', 'sea', 'surf', or null).
// Return [{ x0, x1, z, y, kind }] (cells).
export function waterRuns(page, waterAt) {
  const ox = page.x0;
  const oz = page.z0;
  const cells = new Map(page.water.filter((w) => w.x >= ox && w.z >= oz && w.x < ox + CHUNK && w.z < oz + CHUNK).map((w) => [`${w.x},${w.z}`, w]));
  const out = [];
  for (let z = oz; z < oz + CHUNK; z++) {
    let run = null;
    for (let x = ox; x <= ox + CHUNK; x++) {
      const w = x < ox + CHUNK ? cells.get(`${x},${z}`) : null;
      const kind = w ? waterAt(x, z) ?? (w.sea ? 'sea' : 'river') : null;
      if (run && (!w || w.y !== run.y || kind !== run.kind)) {
        out.push(run);
        run = null;
      }
      if (!w) continue;
      if (run) run.x1 = x + 1;
      else run = { x0: x, x1: x + 1, z, y: w.y, kind };
    }
  }
  return out;
}

// The edges of the foam: a cell of land of the chunk next to a cell of surf, and the direction of
// the surf (dx, dz). Return [{ x, z, dx, dz }].
export function foamEdges(page, waterAt) {
  const out = [];
  if (!page.water.some((w) => w.sea)) return out;
  for (let z = page.z0; z < page.z0 + CHUNK; z++) {
    for (let x = page.x0; x < page.x0 + CHUNK; x++) {
      if (waterAt(x, z)) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (waterAt(x + dx, z + dz) === 'surf') out.push({ x, z, dx, dz });
    }
  }
  return out;
}

// What the view (src/render/voxel.js) draws for a chunk: { triangles, kinds, water } with all its
// meshes, the ink included, as the frame counts them. A near chunk: the ground and the things, the
// lines, the hulls, a plane for each kind of water, the paddies and their seedlings (two boxes of 12
// triangles in each paddy), and the foam. A far chunk: one mesh with flat water and paddies. kinds:
// the kinds of meshes that the chunk puts into its block (one draw call for each kind in a block of
// 2 x 2 chunks); water: the water planes of the chunk (one draw call each). The mask of the faded
// objects is not counted (it draws only while a thing of the block fades). mesh: the chunkMesh,
// when it is made already.
export function chunkCost(terrain, cx, cz, { coarse = false, waterAt = () => null, mesh = null } = {}) {
  const m = mesh ?? chunkMesh(terrain, cx, cz, { coarse });
  const page = terrain.chunk(cx, cz);
  if (coarse) return { triangles: m.triangles + waterRuns(page, waterAt).length * 2 + page.paddies.length * 2, kinds: ['world'], water: 0 };
  const kinds = [];
  if (m.ground.indices.length || m.things.indices.length) kinds.push('world');
  if (m.ink.some((k) => k.segs.length)) kinds.push('ink');
  if (m.ink.some((k) => k.hull?.indices.length)) kinds.push('hull');
  if (page.paddies.length) kinds.push('paddy');
  if (page.paddies.some((p) => !p.ditch)) kinds.push('seeds');
  const foam = foamEdges(page, waterAt).length;
  if (foam) kinds.push('foam');
  const water = new Set(page.water.map((w) => (w.sea ? 'sea' : 'river'))).size;
  const seeded = page.paddies.filter((p) => !p.ditch).length;
  return { triangles: m.triangles + water * 2 + page.paddies.length * 2 + seeded * 24 + foam * 2, kinds, water };
}

// The draw calls of some chunks (each { cx, cz, coarse, cost } with its chunkCost) in their blocks
// of 2 x 2 chunks of one level: one call for each kind of mesh in each block, and one for each
// water plane.
export function blocksCost(list) {
  const blocks = new Map();
  let calls = 0;
  let triangles = 0;
  for (const { cx, cz, coarse, cost } of list) {
    const key = `${coarse ? 'far' : 'near'}:${Math.floor(cx / 2)},${Math.floor(cz / 2)}`;
    if (!blocks.has(key)) blocks.set(key, new Set());
    for (const k of cost.kinds) blocks.get(key).add(k);
    calls += cost.water;
    triangles += cost.triangles;
  }
  for (const kinds of blocks.values()) calls += kinds.size;
  return { triangles, calls };
}
