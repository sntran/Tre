// The world in chunks: parts of CHUNK × CHUNK ground columns. Each chunk has its own meshes (the
// ground, the things, and the ink), so that a change (a dig, a felled tree, a house that comes
// apart) rebuilds only the chunks that it touches. Pure, no WebGL: the meshes are plain arrays, and
// the renderer (src/render/voxel.js) puts them in buffers.
//
// No smooth mesh is baked or exists alone: a roof (src/world/roofs.js) or another smooth look
// (src/world/smooth.js) has an owner block, and it draws only while that block is there.
import { meshGrid } from './mesher.js';
import { roofMesh } from './roofs.js';
import { smoothMesh } from './smooth.js';

export const CHUNK = 16; // ground columns along x and z

export const chunkKey = (cx, cz) => `${cx},${cz}`;
// The chunk of a ground column, and of a fine block (half blocks).
export const chunkOf = (x, z) => chunkKey(Math.floor(x / CHUNK), Math.floor(z / CHUNK));
export const chunkOfFine = (fx, fz) => chunkOf(Math.floor(fx / 2), Math.floor(fz / 2));

// All the chunks of a terrain: { key, cx, cz }.
export function chunkList(terrain) {
  const out = [];
  for (let cz = 0; cz * CHUNK < terrain.height; cz++) {
    for (let cx = 0; cx * CHUNK < terrain.width; cx++) out.push({ key: chunkKey(cx, cz), cx, cz });
  }
  return out;
}

// Is the owner of a look there? owner: a fine block [fx, fy, fz], or null (always there).
export const ownerThere = (terrain, owner) => !owner || terrain.fine.get(owner[0], owner[1], owner[2]) > 0;

// The meshes of one chunk. Return { ground, things, ink, triangles }:
// ground and things: { positions, colors, owners, indices } (world units); ink: a list of groups
// { segs, w, owners, outer, hull } for src/render/voxel.js (hull: the triangles of the silhouette of
// the smooth looks, drawn in ink from the back).
export function chunkMesh(terrain, cx, cz) {
  const g = terrain.ground;
  const f = terrain.fine;
  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  const ground = meshGrid(g, { x0, z0, x1: Math.min(g.sx, x0 + CHUNK), z1: Math.min(g.sz, z0 + CHUNK), scale: 1, shade: terrain.shade });
  // The faces of a fine block that touch the ground are hidden.
  const underGround = (x, y, z) => g.get(x >> 1, y >> 1, z >> 1) > 0;
  const fine = meshGrid(f, { x0: x0 * 2, z0: z0 * 2, x1: Math.min(f.sx, (x0 + CHUNK) * 2), z1: Math.min(f.sz, (z0 + CHUNK) * 2), scale: 0.5, other: underGround });
  // sway: [weight, layer] for each vertex (src/world/smooth.js); blocks and roofs do not move.
  const things = { positions: [...fine.positions], colors: [...fine.colors], owners: [...fine.owners], indices: [...fine.indices], sway: new Array((fine.positions.length / 3) * 2).fill(0) };
  const ink = [
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
  const here = (fx, fz) => chunkOfFine(fx, fz) === chunkKey(cx, cz);
  // The roofs whose middle is in this chunk, while their house is there.
  for (const r of terrain.roofs) {
    if (!here(Math.floor((r.x0 + r.x1) / 2), Math.floor((r.z0 + r.z1) / 2)) || !ownerThere(terrain, r.owner)) continue;
    const m = roofMesh(r);
    append(m);
    ink.push({ segs: m.segs, w: 0.11, owners: m.outer.map(() => r.who ?? 0), outer: m.outer });
  }
  // The smooth looks (crowns, culms, leaves, haystacks) whose owner block is in this chunk.
  for (const s of terrain.smooth ?? []) {
    if (!here(s.owner[0], s.owner[2]) || !ownerThere(terrain, s.owner)) continue;
    const m = smoothMesh(s);
    append(m);
    ink.push({ who: s.who ?? 0, sway: m.segSway, segs: m.segs, w: 0.09, owners: m.segs.length ? Array(m.segs.length / 6).fill(s.who ?? 0) : [], outer: Array(m.segs.length / 6).fill(1), hull: m.hull });
  }
  let triangles = (ground.indices.length + things.indices.length) / 3;
  for (const k of ink) triangles += (k.segs.length / 6) * 2 + (k.hull ? k.hull.indices.length / 3 : 0);
  return { ground, things, ink, triangles };
}

// The chunks that a change at a ground column touches: its own chunk, and the chunk next to it when
// the column is at an edge (a face of that chunk can show now).
function touched(x, z) {
  const keys = new Set([chunkOf(x, z)]);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (Math.floor((x + dx) / CHUNK) !== Math.floor(x / CHUNK) || Math.floor((z + dz) / CHUNK) !== Math.floor(z / CHUNK)) {
      if (x + dx >= 0 && z + dz >= 0) keys.add(chunkOf(x + dx, z + dz));
    }
  }
  return [...keys];
}

// Dig one ground block (x, y, z: full blocks). blocks: data/world/blocks.json. Return null when
// there is nothing to dig, else { kind, drops, chunks } (the chunks to build again).
export function dig(terrain, blocks, x, y, z) {
  const g = terrain.ground;
  if (!g.get(x, y, z)) return null;
  const i = g.index(x, y, z);
  const kind = terrain.kinds ? terrain.kindNames[terrain.kinds[i] - 1] ?? 'soil' : 'soil';
  g.set(x, y, z, 0);
  if (terrain.kinds) terrain.kinds[i] = 0;
  return { kind, drops: { ...(blocks.kinds[kind]?.drops ?? {}) }, chunks: touched(x, z) };
}

// Fell a tree (or take away another object of the map): its blocks go, and the smooth looks that
// they own go with them. who: the number of the object. Return null for no such object, else
// { blocks (the count), drops, chunks }.
export function fell(terrain, blocks, who) {
  const o = terrain.objects.find((x) => x.who === who && !x.gone);
  if (!o) return null;
  const f = terrain.fine;
  const keys = new Set();
  let count = 0;
  const b = o.box;
  for (let y = b.y0; y < b.y1; y++) {
    for (let z = b.z0; z < b.z1; z++) {
      for (let x = b.x0; x < b.x1; x++) {
        if (f.ownerAt(x, y, z) !== who || !f.get(x, y, z)) continue;
        f.set(x, y, z, 0);
        count += 1;
        for (const k of touched(Math.floor(x / 2), Math.floor(z / 2))) keys.add(k);
      }
    }
  }
  o.gone = true;
  // The smooth looks of the object were in the chunks of their owners.
  for (const s of terrain.smooth ?? []) if (s.who === who) keys.add(chunkOfFine(s.owner[0], s.owner[2]));
  const per = blocks.kinds.trunk?.drops ?? {};
  const drops = Object.fromEntries(Object.entries(per).map(([k, n]) => [k, Math.max(1, Math.round((n * count) / 8))]));
  return { blocks: count, drops, chunks: [...keys] };
}

// The chunks to build again, and the count of the builds (for the tests: a dig builds only its
// chunk). build(chunk): the renderer makes the meshes of one chunk.
export function createChunks(terrain) {
  const list = chunkList(terrain);
  const byKey = new Map(list.map((c) => [c.key, c]));
  const dirty = new Set();
  let builds = 0;
  return {
    list,
    mark(keys) {
      for (const k of keys) if (byKey.has(k)) dirty.add(k);
    },
    get dirty() { return [...dirty]; },
    get builds() { return builds; },
    // Build the chunks that changed. Return how many.
    rebuild(build) {
      const n = dirty.size;
      for (const k of dirty) {
        build(byKey.get(k));
        builds += 1;
      }
      dirty.clear();
      return n;
    },
  };
}
