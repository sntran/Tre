import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTerrain, kindAt } from '../src/world/terrain.js';
import { createTileMap } from '../src/core/tilemap.js';
import { chunkMesh, chunkList, createChunks, dig, fell, chunkOf, chunkKey, CHUNK } from '../src/world/chunks.js';
import { load, mapOf } from './helpers.js';

const tiles = load('data/tiles.json').types;
const blocks = load('data/world/blocks.json');
const terrainOf = (id) => {
  const map = mapOf(id);
  return buildTerrain(map, tiles, createTileMap(map, tiles), blocks);
};
// A column of land in the middle of a chunk, and its top block.
function landAt(t, cx, cz) {
  for (let z = cz * CHUNK + 4; z < cz * CHUNK + 12; z++) {
    for (let x = cx * CHUNK + 4; x < cx * CHUNK + 12; x++) {
      const y = t.ground.top(x, z);
      if (y >= 1 && !t.fine.get(x * 2, y * 2 + 2, z * 2)) return { x, y, z };
    }
  }
  return null;
}

test('the ground keeps a kind for each block: the surface, soil, clay, rock, and some ore', () => {
  assert.equal(kindAt(blocks, 0, 5), 'surface');
  assert.equal(kindAt(blocks, 1, 999), 'soil');
  assert.equal(kindAt(blocks, 4, 999), 'clay');
  assert.equal(kindAt(blocks, 7, 999), 'rock');
  assert.equal(kindAt(blocks, 7, 10), 'ore', 'a low seed in the rock is ore');
  const t = terrainOf('phu-dong');
  const names = new Set();
  for (let i = 0; i < t.kinds.length; i++) if (t.kinds[i]) names.add(t.kindNames[t.kinds[i] - 1]);
  assert.ok(names.has('surface') && names.has('soil'), [...names].join());
  // The same map gives the same kinds.
  assert.deepEqual(terrainOf('phu-dong').kinds, t.kinds);
  for (const [k, def] of Object.entries(blocks.kinds)) assert.ok(def.hardness > 0 && Object.keys(def.drops).length, k);
});

test('a dig takes one block, gives what it drops, and builds only its chunk again', () => {
  const t = terrainOf('phu-dong');
  const chunks = createChunks(t);
  const spot = landAt(t, 2, 2);
  assert.ok(spot, 'land in the chunk');
  const before = chunkList(t).map((c) => chunkMesh(t, c.cx, c.cz).ground.indices.length);
  const r = dig(t, blocks, spot.x, spot.y, spot.z);
  assert.equal(r.kind, 'surface');
  assert.deepEqual(r.drops, { soil: 1 });
  assert.deepEqual(r.chunks, [chunkOf(spot.x, spot.z)], 'a column inside a chunk touches one chunk');
  assert.equal(t.ground.get(spot.x, spot.y, spot.z), 0);
  chunks.mark(r.chunks);
  const built = [];
  assert.equal(chunks.rebuild((c) => built.push(c.key)), 1);
  assert.deepEqual(built, [chunkKey(2, 2)]);
  const after = chunkList(t).map((c) => chunkMesh(t, c.cx, c.cz).ground.indices.length);
  const changed = after.map((n, i) => (n !== before[i] ? chunkList(t)[i].key : null)).filter(Boolean);
  assert.deepEqual(changed, [chunkKey(2, 2)], 'only that chunk has new faces');
  // A second dig in the same hole goes down to the soil.
  assert.equal(dig(t, blocks, spot.x, spot.y - 1, spot.z).kind, 'soil');
  assert.equal(dig(t, blocks, spot.x, spot.y, spot.z), null, 'nothing more to take there');
  // A column at the edge of a chunk touches the chunk next to it too.
  assert.equal(dig(t, blocks, CHUNK * 2, t.ground.top(CHUNK * 2, CHUNK * 2 + 5), CHUNK * 2 + 5).chunks.length, 2);
});

test('one chunk builds in a few milliseconds', () => {
  const t = terrainOf('phu-dong');
  for (let i = 0; i < 3; i++) chunkMesh(t, 2, 2);
  const start = performance.now();
  for (let i = 0; i < 5; i++) chunkMesh(t, 2, 2);
  const ms = (performance.now() - start) / 5;
  assert.ok(ms < 25, `${ms.toFixed(1)} ms`);
});

test('a roof draws only while its house is there', () => {
  const t = terrainOf('phu-dong');
  const house = t.objects.find((o) => o.kind === 'house');
  const roof = t.roofs.find((r) => r.who === house.who);
  assert.ok(roof.owner && t.fine.ownerAt(...roof.owner) === house.who, 'the owner is a block of the house');
  const key = chunkOf(Math.floor((roof.x0 + roof.x1) / 4), Math.floor((roof.z0 + roof.z1) / 4));
  const [cx, cz] = key.split(',').map(Number);
  const with_ = chunkMesh(t, cx, cz).things.indices.length;
  const r = fell(t, blocks, house.who);
  assert.ok(r.blocks > 50 && r.chunks.includes(key));
  assert.ok(chunkMesh(t, cx, cz).things.indices.length < with_ - 100, 'the roof went with the house');
});

test('every smooth look has an owner block, and a felled tree takes its crown and gives logs', () => {
  const t = terrainOf('phu-dong');
  assert.ok(t.smooth.length > 50, 'the plants of the village are smooth');
  for (const s of t.smooth) {
    // A flower is owned by the top block of its ground column (a dig takes it); the others by a block of their prop.
    if (s.ownerGrid === 'ground') assert.ok(s.kind === 'flower' && t.ground.get(...s.owner) && !t.ground.get(s.owner[0], s.owner[1] + 1, s.owner[2]), `${s.kind} on the top block of its column`);
    else assert.ok(s.owner && t.fine.get(...s.owner) && t.fine.ownerAt(...s.owner) === s.who, `${s.kind} has an owner block of its prop`);
  }
  assert.ok(t.smooth.some((s) => s.kind === 'flower'), 'flowers grow on the grass');
  const tree = t.objects.find((o) => o.kind === 'tree');
  const crown = t.smooth.find((s) => s.who === tree.who && s.kind === 'crown');
  const key = chunkOf(Math.floor(crown.owner[0] / 2), Math.floor(crown.owner[2] / 2));
  const [cx, cz] = key.split(',').map(Number);
  const before = chunkMesh(t, cx, cz);
  const hulls = (m) => m.ink.filter((k) => k.hull).length;
  const chunks = createChunks(t);
  const r = fell(t, blocks, tree.who);
  assert.ok(r.blocks >= 8 && r.drops.log >= 1, JSON.stringify(r));
  assert.ok(r.chunks.includes(key));
  chunks.mark(r.chunks);
  assert.equal(chunks.rebuild(() => {}), r.chunks.length, 'only the chunks of the tree build again');
  const after = chunkMesh(t, cx, cz);
  assert.equal(hulls(after), hulls(before) - 1, 'the crown went with its trunk');
  assert.ok(after.things.indices.length < before.things.indices.length - 300);
  assert.equal(fell(t, blocks, tree.who), null, 'a felled tree is gone');
});

test('the triangles of the world around the start of every map stay under the budget', () => {
  const limit = load('data/config/limits.json').frameTriangles;
  const maps = load('data/world/regions.json').regions.flatMap((r) => r.maps);
  for (const id of maps) {
    const map = mapOf(id);
    const t = buildTerrain(map, tiles, createTileMap(map, tiles), blocks);
    const sx = Math.floor(map.spawn.x / CHUNK);
    const sz = Math.floor(map.spawn.y / CHUNK);
    let tri = 0;
    for (const c of chunkList(t)) if (Math.abs(c.cx - sx) <= 1 && Math.abs(c.cz - sz) <= 1) tri += chunkMesh(t, c.cx, c.cz).triangles;
    assert.ok(tri <= limit, `${id}: ${tri} triangles`);
  }
});

test('flowers grow in small patches on the grass, with no outline, and no decoration looks like a thing to carry', async () => {
  const { smoothMesh } = await import('../src/world/smooth.js');
  for (const id of ['phu-dong', 'trau-son']) {
    const map = mapOf(id);
    const t = terrainOf(id);
    const tm = createTileMap(map, tiles);
    const flowers = t.smooth.filter((s) => s.kind === 'flower');
    assert.ok(flowers.length > 10 && flowers.length < map.width * map.height * 0.008, `${id}: ${flowers.length} flowers`);
    for (const f of flowers) {
      assert.ok(['grass', 'flowers'].includes(tm.groundAt(Math.floor(f.x), Math.floor(f.z))), `${id}: a flower at ${f.x},${f.z} is on the grass`);
      // In a patch: two others of the same color near it.
      const near = flowers.filter((g) => g !== f && g.color === f.color && Math.hypot(g.x - f.x, g.z - f.z) < 3.2);
      assert.ok(near.length >= 2, `${id}: a flower alone at ${f.x},${f.z}`);
      const m = smoothMesh(f);
      assert.equal(m.segs.length + m.hull.indices.length, 0, 'a flower has no ink');
    }
    // No single grey half block lies on the ground (the old small stones looked like the stones of the cart).
    let stones = 0;
    for (let z = 0; z < t.fine.sz; z++) for (let x = 0; x < t.fine.sx; x++) {
      const y = t.topAt(x >> 1, z >> 1) * 2;
      if (t.fine.get(x, y, z) && !t.fine.ownerAt(x, y, z) && !t.fine.get(x, y + 1, z)) stones += 1;
    }
    assert.equal(stones, 0, `${id}: loose blocks on the ground`);
  }
});
