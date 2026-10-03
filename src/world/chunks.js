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
  const ground = coarse ? coarseGround(p) : meshGrid(p.ground, { x0: 1, z0: 1, x1: 1 + CHUNK, z1: 1 + CHUNK, scale: 1, origin: [-1, 0, -1], shade: (x, y, z) => terrain.shade(x - 1 + ox, y, z - 1 + oz) });
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
  for (const s of p.smooth) {
    if ((coarse && s.kind === 'flower') || !ownerThere(terrain, s.owner, s.ownerGrid)) continue;
    const m = shift(smoothMesh(s, { coarse }), ox, oz);
    append(m);
    if (!coarse) ink.push({ who: s.who ?? 0, sway: m.segSway, segs: m.segs, w: 0.09, owners: m.segs.length ? Array(m.segs.length / 6).fill(s.who ?? 0) : [], outer: Array(m.segs.length / 6).fill(1), hull: m.hull });
  }
  let triangles = (ground.indices.length + things.indices.length) / 3;
  for (const k of ink) triangles += (k.segs.length / 6) * 2 + (k.hull ? k.hull.indices.length / 3 : 0);
  return { origin: [ox, 0, oz], ground, things, ink, triangles };
}

// The ground of a far chunk (the coarse level): the tops of a row of columns of one height and one
// color are one quad, and the step down to a lower column is one quad, in the color under the top.
// No ink. Return the form of meshGrid (positions from the corner of the chunk).
export function coarseGround(p) {
  const g = p.ground;
  const top = (lx, lz) => g.top(lx, lz) + 1; // the top of a column of the page (with the apron)
  const out = { positions: [], colors: [], owners: [], indices: [], segments: [], segOwners: [], segOuter: [] };
  let n = 0;
  const quad = (a, b, c, d, rgb) => {
    for (const v of [a, b, c, d]) {
      out.positions.push(v[0], v[1], v[2]);
      out.colors.push(...rgb);
      out.owners.push(0);
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
      let e = x + 1;
      while (e <= CHUNK && top(e, z) === h && g.get(e, h - 1, z) === c) e += 1;
      const rgb = toneRgb(c, FACE_TONES.py);
      quad([x - 1, h, z], [e - 1, h, z], [e - 1, h, z - 1], [x - 1, h, z - 1], rgb);
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
