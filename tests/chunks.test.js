import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTerrain, kindAt, REACH } from '../src/world/terrain.js';
import { createPlaneTileMap } from '../src/core/tilemap.js';
import { chunkMesh, chunkCost, blocksCost, chunkOf, chunkKey, CHUNK, WATER_KINDS } from '../src/world/chunks.js';
import { inView, viewSize } from '../src/world/view.js';
import { buildProp } from '../src/world/props/index.js';
import { hashSeed } from '../src/world/voxel.js';
import { load, mapOf, worldOf } from './helpers.js';

const tiles = load('data/tiles.json').types;
const blocks = load('data/world/blocks.json');
// The terrain of the plane, with the pages of the 5 x 5 chunks around a cell of a place.
function terrainAt(place, x, y, seed = 1) {
  const map = mapOf('giong', seed);
  const t = createTerrain(map, tiles, createPlaneTileMap(map, tiles), blocks);
  const [px, py] = worldOf().at(place, x, y);
  const cx = Math.floor(px / CHUNK);
  const cz = Math.floor(py / CHUNK);
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) t.chunk(cx + dx, cz + dz);
  return { t, map, cx, cz, px, py };
}
const spawnOf = (id) => load(`data/maps/${id}.json`).spawn;
const atSpawn = (id, seed = 1) => terrainAt(id, spawnOf(id).x, spawnOf(id).y, seed);
// A column of land in the middle of a chunk, and its top block.
function landAt(t, cx, cz) {
  for (let z = cz * CHUNK + 4; z < cz * CHUNK + 12; z++) {
    for (let x = cx * CHUNK + 4; x < cx * CHUNK + 12; x++) {
      const y = t.ground.top(x, z);
      if (y >= 1 && !t.fine.get(x * 2, y * 2 + 2, z * 2) && !t.fine.get(x * 2 + 1, y * 2 + 2, z * 2 + 1)) return { x, y, z };
    }
  }
  return null;
}
const meshes = (t, cx, cz) => {
  const out = new Map();
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) out.set(chunkKey(cx + dx, cz + dz), chunkMesh(t, cx + dx, cz + dz).ground.indices.length);
  return out;
};

test('the ground keeps a kind for each block: the surface, soil, clay, rock, and some ore', () => {
  assert.equal(kindAt(blocks, 0, 5), 'surface');
  assert.equal(kindAt(blocks, 1, 999), 'soil');
  assert.equal(kindAt(blocks, 4, 999), 'clay');
  assert.equal(kindAt(blocks, 7, 999), 'rock');
  assert.equal(kindAt(blocks, 7, 10), 'ore', 'a low seed in the rock is ore');
  const { t } = atSpawn('phu-dong');
  const names = new Set();
  for (const p of t.pages) for (let i = 0; i < p.kinds.length; i++) if (p.kinds[i]) names.add(t.kindNames[p.kinds[i] - 1]);
  assert.ok(names.has('surface') && names.has('soil'), [...names].join());
  for (const [k, def] of Object.entries(blocks.kinds)) assert.ok(def.hardness > 0 && Object.keys(def.drops).length, k);
});

test('one page alone is the same as the same page in a ring of pages', () => {
  for (const seed of [1, 7]) {
    for (const [place, x, y] of [['phu-dong', 30, 30], ['trau-son', 150, 20], ['soc-son', 40, 40]]) {
      const { t, cx, cz } = terrainAt(place, x, y, seed);
      const ring = t.chunk(cx, cz);
      const map = mapOf('giong', seed);
      const alone = createTerrain(map, tiles, createPlaneTileMap(map, tiles), blocks).chunk(cx, cz);
      for (const k of ['ground', 'fine']) assert.deepEqual([...alone[k].data], [...ring[k].data], `${place}, seed ${seed}: the ${k} blocks`);
      const plain = (p) => p.objects.map(({ who, ...o }) => o);
      assert.deepEqual(plain(alone), plain(ring), `${place}, seed ${seed}: the objects`);
      for (const k of ['water', 'paddies', 'flowers']) assert.deepEqual(alone[k], ring[k], `${place}, seed ${seed}: ${k}`);
      assert.equal(alone.smooth.length, ring.smooth.length);
    }
  }
});

test('the blocks of every prop stay within its reach of its cells (the pages build the props near them)', () => {
  const fine = { inside: () => true, get: () => 0, set: () => {} };
  const objects = ['phu-dong', 'soc-son', 'trau-son', 'road-thanglong'].flatMap((id) => load(`data/maps/${id}.json`).layers.objects);
  for (const prop of ['tree', 'banyan', 'bamboo', 'banana', 'bush', 'areca', 'rock', 'house', 'hut', 'haystack', 'coop', 'jar']) {
    for (let s = 1; s < 60; s++) objects.push({ id: `${prop}${s}`, prop, x: 0, y: 0, w: prop === 'house' || prop === 'hut' ? 6 : 2, h: prop === 'house' || prop === 'hut' ? 6 : 2, seed: s * 7919 });
  }
  for (const o of objects) {
    const r = buildProp({ fine, groundTop: () => 6, shadow: () => {} }, { ...o, kind: o.prop, fx: o.x * 2, fz: o.y * 2, fw: o.w * 2, fd: o.h * 2, seed: o.seed ?? hashSeed(o.id) }, 1);
    if (!r.box) continue;
    const b = r.box;
    const over = Math.max(o.x * 2 - b.x0, b.x1 - (o.x + o.w) * 2, o.y * 2 - b.z0, b.z1 - (o.y + o.h) * 2) / 2;
    assert.ok(over <= (REACH[o.prop] ?? REACH.default), `${o.id} (${o.prop}) reaches ${over} cells out`);
  }
});

test('a dig takes one block, gives what it drops, and changes only its chunk', () => {
  const { t, cx, cz } = atSpawn('phu-dong');
  const spot = landAt(t, cx, cz);
  assert.ok(spot, 'land in the chunk');
  const before = meshes(t, cx, cz);
  const r = t.edit({ type: 'dig', at: [spot.x, spot.z] });
  assert.equal(r.kind, 'surface');
  assert.deepEqual(r.drops, { soil: 1 });
  assert.deepEqual(r.chunks, [chunkOf(spot.x, spot.z)], 'a column inside a chunk touches one chunk');
  assert.equal(t.ground.get(spot.x, spot.y, spot.z), 0);
  const after = meshes(t, cx, cz);
  const changed = [...after].filter(([k, n]) => n !== before.get(k)).map(([k]) => k);
  assert.deepEqual(changed, [chunkKey(cx, cz)], 'only that chunk has new faces');
  // A second dig in the same hole goes down to the soil.
  assert.equal(t.edit({ type: 'dig', at: [spot.x, spot.z] }).kind, 'soil');
  // A column at the edge of a chunk touches the chunk next to it too.
  assert.equal(t.edit({ type: 'dig', at: [cx * CHUNK, cz * CHUNK + 5] }).chunks.length, 2);
  // The changes go into the save by chunk, and come back.
  const edits = t.edits();
  assert.ok(edits[chunkKey(cx, cz)].dug.length === 2, JSON.stringify(edits));
  const { t: again } = atSpawn('phu-dong');
  again.loadEdits(edits);
  assert.equal(again.ground.top(spot.x, spot.z), spot.y - 2);
});

test('one chunk builds in a few milliseconds', () => {
  const { t, cx, cz } = atSpawn('phu-dong');
  for (let i = 0; i < 3; i++) chunkMesh(t, cx, cz);
  const start = performance.now();
  for (let i = 0; i < 5; i++) chunkMesh(t, cx, cz);
  const ms = (performance.now() - start) / 5;
  assert.ok(ms < 25, `${ms.toFixed(1)} ms`);
});

test('a roof draws only while its house is there', () => {
  const { t } = terrainAt('phu-dong', 30, 20);
  const house = t.objects.find((o) => o.kind === 'house' && o.id);
  const roof = t.roofs.find((r) => r.who === house.who);
  assert.ok(roof.owner && t.fine.ownerAt(...roof.owner) === house.who, 'the owner is a block of the house');
  const key = chunkOf(Math.floor((roof.x0 + roof.x1) / 4), Math.floor((roof.z0 + roof.z1) / 4));
  const [cx, cz] = key.split(',').map(Number);
  const with_ = chunkMesh(t, cx, cz).things.indices.length;
  const r = t.edit({ type: 'fell', id: house.id });
  assert.ok(r.blocks > 50 && r.chunks.includes(key));
  assert.ok(chunkMesh(t, cx, cz).things.indices.length < with_ - 100, 'the roof went with the house');
});

test('every smooth look has an owner block, and a felled tree takes its crown and gives logs', () => {
  const { t } = terrainAt('phu-dong', 30, 30);
  assert.ok(t.smooth.length > 50, 'the plants of the village are smooth');
  for (const s of t.smooth) {
    // A flower is owned by the top block of its ground column (a dig takes it); the others by a block of their prop.
    if (s.ownerGrid === 'ground') assert.ok(s.kind === 'flower' && t.ground.get(...s.owner) && !t.ground.get(s.owner[0], s.owner[1] + 1, s.owner[2]), `${s.kind} on the top block of its column`);
    else assert.ok(s.owner && t.fine.get(...s.owner) && t.fine.ownerAt(...s.owner) === s.who, `${s.kind} has an owner block of its prop`);
  }
  assert.ok(t.smooth.some((s) => s.kind === 'flower'), 'flowers grow on the grass');
  const tree = t.objects.find((o) => o.kind === 'tree' && o.id);
  const crown = t.smooth.find((s) => s.who === tree.who && s.kind === 'crown');
  const key = chunkOf(Math.floor(crown.owner[0] / 2), Math.floor(crown.owner[2] / 2));
  const [cx, cz] = key.split(',').map(Number);
  const before = chunkMesh(t, cx, cz);
  const hulls = (m) => m.ink.filter((k) => k.hull && k.who === tree.who).length;
  const r = t.edit({ type: 'fell', id: tree.id });
  assert.ok(r.blocks >= 8 && r.drops.log >= 1, JSON.stringify(r));
  assert.ok(r.chunks.includes(key));
  const after = chunkMesh(t, cx, cz);
  assert.ok(hulls(before) >= 1 && hulls(after) === 0, 'the crown went with its trunk');
  assert.ok(after.things.indices.length < before.things.indices.length - 300);
  assert.equal(t.edit({ type: 'fell', id: tree.id }), null, 'a felled tree is gone');
  // The save keeps the tree away (a bit for its cell in its chunk).
  const { t: again } = terrainAt('phu-dong', 30, 30);
  again.loadEdits(t.edits());
  assert.ok(!again.objects.some((o) => o.id === tree.id), 'the tree stays felled after a load');
});

test('the triangles of the 3 x 3 chunks around the start of every place stay under the budget', () => {
  const limit = load('data/config/limits.json').frameTriangles;
  for (const id of ['phu-dong', 'soc-son', 'trau-son', 'road-thanglong']) {
    const { t, cx, cz } = atSpawn(id);
    let tri = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) tri += chunkMesh(t, cx + dx, cz + dz).triangles;
    assert.ok(tri <= limit, `${id}: ${tri} triangles`);
  }
});

// What a frame draws around a focus (cells), as the ?fps line counts it: every mesh of the chunks
// in the view (src/world/view.js), in their blocks of 2 x 2 chunks, plus the figures and the
// sky (limits.viewExtra). The view is the far zoom, on the screen that sees the most.
function frameCost(t, tileMap, x, z) {
  const waterAt = (wx, wz) => WATER_KINDS[tileMap.type(Math.floor(wx), Math.floor(wz))] ?? null;
  const cx = Math.floor(x / CHUNK);
  const cz = Math.floor(z / CHUNK);
  const focus = { x, y: (tileMap.heightAt(Math.floor(x), Math.floor(z)) + 1) * 1, z };
  let worst = { triangles: 0, calls: 0 };
  for (const [w, h] of [[844, 390], [1024, 768]]) {
    const size = viewSize(w, h, 1);
    const list = [];
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      const page = t.chunk(cx + dx, cz + dz);
      const box = { x0: page.x0, x1: page.x0 + CHUNK, y0: 0, y1: page.maxTop + 6, z0: page.z0, z1: page.z0 + CHUNK };
      if (!inView(box, focus, { size })) continue;
      const coarse = Math.max(Math.abs(dx), Math.abs(dz)) > 2;
      list.push({ cx: cx + dx, cz: cz + dz, coarse, cost: chunkCost(t, cx + dx, cz + dz, { coarse, waterAt }) });
    }
    const { triangles, calls } = blocksCost(list);
    if (triangles > worst.triangles || calls > worst.calls) worst = { triangles: Math.max(worst.triangles, triangles), calls: Math.max(worst.calls, calls) };
  }
  return worst;
}

test('a frame stays under the budget of triangles and draw calls on the walk to Sóc Sơn and at the densest places', (c) => {
  // The budget counts what the ?fps line counts: all meshes of the chunks in the view, the ink
  // included, and the figures and the sky. The walk goes on the road to the north (the story
  // walk-soc-son), with a frame each 4 chunks; then the hill forest at the south edge of the land
  // of the era, the mountains of Tam Đảo, and Ba Vì.
  const limits = load('data/config/limits.json');
  const map = mapOf('giong', 1);
  const tileMap = createPlaneTileMap(map, tiles);
  const t = createTerrain(map, tiles, tileMap, blocks);
  const world = worldOf();
  const way = [['phu-dong', 31.5, 27.5], ['phu-dong', 46.5, 1.5], ['soc-son', 39.5, 50.5], ['soc-son', 40.5, 18.5]].map(([p, x, y]) => world.at(p, x, y));
  const spots = [];
  for (let i = 1; i < way.length; i++) {
    const [ax, ay] = way[i - 1];
    const [bx, by] = way[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (CHUNK * 4)));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) spots.push({ name: 'walk', at: [ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n] });
  }
  const plane = map.land.plane;
  spots.push({ name: 'the south edge', at: [9522.5, 14203.5] });
  spots.push({ name: 'Tam Đảo', at: plane.toCell([105.645, 21.455]) });
  spots.push({ name: 'Ba Vì', at: plane.toCell([105.37, 21.07]) });
  const most = { triangles: 0, calls: 0 };
  for (const s of spots) {
    const f = frameCost(t, tileMap, s.at[0], s.at[1]);
    const triangles = f.triangles + limits.viewExtra.triangles;
    const calls = f.calls + limits.viewExtra.calls;
    if (s.name !== 'walk') c.diagnostic(`${s.name}: ${triangles} triangles, ${calls} calls`);
    most.triangles = Math.max(most.triangles, triangles);
    most.calls = Math.max(most.calls, calls);
    assert.ok(triangles <= limits.viewTriangles, `${s.name} at ${s.at.map(Math.round)}: ${triangles} triangles`);
    assert.ok(calls <= limits.viewCalls, `${s.name} at ${s.at.map(Math.round)}: ${calls} draw calls`);
  }
  c.diagnostic(`the most: ${most.triangles} triangles, ${most.calls} calls`);
  assert.ok(spots.length >= 12 && most.triangles > limits.viewTriangles / 4);
});

test('flowers grow in small patches on the grass, with no outline, and no decoration looks like a thing to carry', async () => {
  const { smoothMesh } = await import('../src/world/smooth.js');
  for (const id of ['phu-dong', 'trau-son']) {
    const { t, map } = atSpawn(id);
    const tm = createPlaneTileMap(map, tiles);
    const flowers = t.smooth.filter((s) => s.kind === 'flower');
    assert.ok(flowers.length > 5 && flowers.length < 80 * 80 * 0.008, `${id}: ${flowers.length} flowers`);
    for (const f of flowers) {
      assert.ok(['grass', 'flowers'].includes(tm.groundAt(Math.floor(f.x), Math.floor(f.z))), `${id}: a flower at ${f.x},${f.z} is on the grass`);
      // In a patch: another of the same color near it.
      const near = flowers.filter((g) => g !== f && g.color === f.color && Math.hypot(g.x - f.x, g.z - f.z) < 3.2);
      assert.ok(near.length >= 1, `${id}: a flower alone at ${f.x},${f.z}`);
      const m = smoothMesh(f);
      assert.equal(m.segs.length + m.hull.indices.length, 0, 'a flower has no ink');
    }
    // No single grey half block lies on the ground (the old small stones looked like the stones of the cart).
    let stones = 0;
    for (const p of t.pages) {
      for (let z = p.z0 * 2; z < p.z0 * 2 + CHUNK * 2; z++) {
        for (let x = p.x0 * 2; x < p.x0 * 2 + CHUNK * 2; x++) {
          const y = t.topAt(x >> 1, z >> 1) * 2;
          if (t.fine.get(x, y, z) && !t.fine.ownerAt(x, y, z) && !t.fine.get(x, y + 1, z)) stones += 1;
        }
      }
    }
    assert.equal(stones, 0, `${id}: loose blocks on the ground`);
  }
});
