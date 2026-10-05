// The land tiles kept on the device, and the first view (#36): src/world/tilestore.js and
// src/ui/stream.js. The stream runs with no workers here (one tile in each update).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createTileStore, memoryBackend, landKey } from '../src/world/tilestore.js';
import { createStream, viewTiles, VIEW } from '../src/ui/stream.js';
import { LAND_VERSION } from '../src/core/gen/tiles.js';
import { activityOf, practiceStart } from '../src/core/practice.js';
import { createProfile } from '../src/core/profile.js';
import { loadGameData, newWorld, load } from './helpers.js';

const data = await loadGameData();
// The start of the practice link of the smith (a practice link always opens at the same place).
const profile = createProfile({ id: 'p', name: 'An', seed: 7, grade: 1, lang: 'vi', now: 0 });
const start = practiceStart(data, profile, activityOf(data.practice, 'ren-sat'));
const at = data.world.at(start.map, start.at.x, start.at.y);
const [X, Y] = Array.isArray(at) ? at : [at.x, at.y];

// A backend in memory that copies a tile when it saves it, as IndexedDB does.
const copying = () => {
  const b = memoryBackend();
  const put = b.putMany;
  b.putMany = (entries) => put(entries.map((e) => ({ ...e, tile: structuredClone(e.tile) })));
  return b;
};
const tick = () => new Promise((r) => setImmediate(r));
// A start: a new map of the seed (no land made), and the stream, until these tiles are made.
async function startOn(store, tiles) {
  const map = newWorld().map('giong', 1);
  const stream = createStream(map, data, { store, worker: null });
  for (let i = 0; i < 400 && !tiles.every(([tx, tz]) => map.land.has(tx, tz)); i++) {
    stream.update(X, Y);
    await tick();
  }
  assert.ok(tiles.every(([tx, tz]) => map.land.has(tx, tz)), 'the tiles came');
  return { map, stream };
}

test('the first view is the land under the drawn ring of chunks: fewer tiles than the ring of the stream', () => {
  for (const [x, y] of [[X, Y], [9408, 6272], [9471, 6335], [100, 100]]) {
    const tiles = viewTiles(x, y);
    const has = new Set(tiles.map(([tx, tz]) => `${tx},${tz}`));
    const cx = Math.floor(x / VIEW.chunk);
    const cy = Math.floor(y / VIEW.chunk);
    // Each cell that a chunk of the drawn ring reads is in a tile of the first view.
    for (const dz of [-VIEW.ring, VIEW.ring]) for (const dx of [-VIEW.ring, VIEW.ring]) {
      for (const [ox, oz] of [[-VIEW.pad, -VIEW.pad], [VIEW.chunk + VIEW.pad - 1, VIEW.chunk + VIEW.pad - 1]]) {
        const px = (cx + dx) * VIEW.chunk + ox;
        const pz = (cy + dz) * VIEW.chunk + oz;
        assert.ok(has.has(`${Math.floor(px / 64)},${Math.floor(pz / 64)}`), `${px}, ${pz}`);
      }
    }
    assert.ok(tiles.length <= 16 && tiles.length < 25, `${tiles.length} tiles`);
  }
  // The village waits only for the first view before the first frame.
  const village = readFileSync('src/ui/village.js', 'utf8');
  assert.match(village, /stream\.firstView\(begin\.where\.x, begin\.where\.y\)/);
  assert.doesNotMatch(village, /stream\.near\(/);
});

test('the first view comes first, and the other tiles of the ring come after it', async () => {
  const map = newWorld().map('giong', 1);
  const stream = createStream(map, data, { store: null, worker: null });
  const first = viewTiles(X, Y);
  let n = 0;
  while (stream.firstView(X, Y).ready < first.length && n < 200) {
    stream.update(X, Y);
    await tick();
    n += 1;
  }
  assert.equal(stream.firstView(X, Y).ready, first.length);
  // The first view is all made, and some tiles of the ring are still to come.
  const cx = Math.floor(X / 64);
  const cy = Math.floor(Y / 64);
  let ring = 0;
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (map.land.has(cx + dx, cy + dz)) ring += 1;
  assert.ok(ring < 25, `the rest of the ring comes later (${ring} of 25 now)`);
  assert.equal(stream.stats.made, first.length, 'only the tiles of the first view were made');
});

test('a second start of the same practice reads the land tiles from the store and makes none; the made land and the saved land are the same, cell for cell', async () => {
  const store = createTileStore(copying());
  const first = viewTiles(X, Y);
  const one = await startOn(store, first);
  assert.equal(one.stream.stats.read, 0);
  assert.ok(one.stream.stats.made >= first.length);
  await tick();
  const two = await startOn(store, first);
  assert.equal(two.stream.stats.made, 0, 'no tile of the first view is made again');
  assert.ok(two.stream.stats.read >= first.length);
  // The saved tiles are the made tiles.
  for (const [tx, tz] of first) {
    const saved = two.map.land.tile(tx, tz);
    const made = one.map.land.tile(tx, tz);
    for (const k of Object.keys(made)) assert.deepEqual(saved[k], made[k], `${tx},${tz} ${k}`);
  }
});

test('a new version of the land code makes the tiles again, and the old tiles go; the game starts with no store', async () => {
  const backend = copying();
  const store = createTileStore(backend);
  const first = viewTiles(X, Y);
  await startOn(store, first);
  await tick();
  // The tiles of an older version of the land code.
  for (const [key, e] of [...backend.map]) {
    backend.map.delete(key);
    backend.map.set(key.replace(`v${LAND_VERSION}|`, `v${LAND_VERSION - 1}|`), e);
  }
  const again = await startOn(store, first);
  assert.equal(again.stream.stats.read, 0);
  assert.ok(again.stream.stats.made >= first.length);
  await tick();
  await store.save([]);
  assert.ok([...backend.map.keys()].every((k) => k.startsWith(`v${LAND_VERSION}|`)), 'the tiles of the old version are gone');
  // No store, and a store that fails: the land is made, with no error.
  await startOn(null, first);
  const broken = createTileStore({ getMany: () => Promise.reject(new Error('full')), putMany: () => Promise.reject(new Error('full')), touch: () => Promise.reject(new Error('x')), list: () => Promise.reject(new Error('x')), deleteMany: () => Promise.reject(new Error('x')) });
  await startOn(broken, first);
  assert.ok(broken.stats.failed > 0);
});

test('the store keeps the tiles used last, up to its limit; the key names the version, the map, the seed, and the data of the map', async () => {
  let t = 0;
  const backend = memoryBackend();
  const store = createTileStore(backend, { now: () => ++t, limit: 3 });
  for (const n of [1, 2, 3, 4]) await store.save([{ key: `v${LAND_VERSION}|m|1|x|${n},0`, tile: { n } }]);
  assert.deepEqual([...backend.map.keys()].sort(), [2, 3, 4].map((n) => `v${LAND_VERSION}|m|1|x|${n},0`));
  // A tile that is read is used again, and stays.
  await store.read([`v${LAND_VERSION}|m|1|x|2,0`]);
  await store.save([{ key: `v${LAND_VERSION}|m|1|x|5,0`, tile: { n: 5 } }]);
  assert.ok(backend.map.has(`v${LAND_VERSION}|m|1|x|2,0`));
  assert.ok(!backend.map.has(`v${LAND_VERSION}|m|1|x|3,0`));
  const map = data.world.map('giong', 1);
  const key = landKey(map.id, map.source, data.scatter, data.figures.villagers);
  assert.match(key, new RegExp(`^v${LAND_VERSION}\\|giong\\|1\\|`));
  assert.notEqual(landKey(map.id, { ...map.source, places: [] }, data.scatter, data.figures.villagers), key, 'other data, another key');
});

// The files that make the land, but not the data of a map (it is in the key). When this
// fingerprint changes, make LAND_VERSION in src/core/gen/tiles.js one more, and write the new
// fingerprint and version in tests/land-version.json.
test('the version of the land code changes with the code of the land, the geography, and the height tiles', () => {
  const h = createHash('sha256');
  for (const f of readdirSync('src/core/gen').sort()) {
    const text = readFileSync(`src/core/gen/${f}`, 'utf8').replace(/^export const LAND_VERSION = \d+;$/m, '');
    h.update(`${f}\n${text}`);
  }
  h.update(readFileSync('src/core/rng.js'));
  h.update(readFileSync('data/geo/vietnam.json'));
  for (const f of readdirSync('data/geo/heights').sort()) h.update(`${f}:${statSync(`data/geo/heights/${f}`).size}`);
  const now = h.digest('hex').slice(0, 16);
  const pinned = load('tests/land-version.json');
  assert.equal(now === pinned.fingerprint ? LAND_VERSION : -1, pinned.version, `the land code changed (fingerprint ${now}): make LAND_VERSION one more than ${pinned.version}, and write the new fingerprint and version in tests/land-version.json`);
});
