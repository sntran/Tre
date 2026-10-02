import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTerrain, kindAt } from '../src/world/terrain.js';
import { createTileMap } from '../src/core/tilemap.js';
import { chunkMesh, chunkList, createChunks, dig, fell, chunkOf, chunkKey, CHUNK } from '../src/world/chunks.js';
import { load } from './helpers.js';

const tiles = load('data/tiles.json').types;
const blocks = load('data/world/blocks.json');
const terrainOf = (id) => {
  const map = load(`data/maps/${id}.json`);
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
