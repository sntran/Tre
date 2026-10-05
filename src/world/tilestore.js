// The land tiles kept on the device (#36). The land of a seed is the same each time (the generator is
// pure: src/core/gen/tiles.js), so a made tile is saved, and the next start reads it in place of
// making it again. The key of a tile has the version of the land code (LAND_VERSION), the map and
// its seed, and a hash of what the map makes its land from (the stamps, the places, the rules of
// the scatter, the parts of the villagers): a new version or new data makes new keys, and the old
// tiles go. The store keeps the tiles that were used last, up to LIMIT. Pure: the device store is a
// backend (IndexedDB in the browser, src/ui/idb.js; a Map in the tests).
//   backend: { getMany(keys) -> Promise<Map key -> { tile, used }>, putMany([{ key, tile, used }]),
//     touch([{ key, used }]), list() -> Promise<[{ key, used }]>, deleteMany(keys) }.
import { LAND_VERSION } from '../core/gen/tiles.js';

export const LIMIT = 200; // tiles (a tile is about 60 kB)

// FNV-1a, 32 bits, of a string: a short name of the data of a map.
export function hashText(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// The first part of the keys of the tiles of a map: { def, places, seed } (map.source), and the
// rules and parts of the land.
export function landKey(id, source, rules = null, parts = null) {
  const data = hashText(JSON.stringify({ def: source.def, places: source.places, rules, parts }));
  return `v${LAND_VERSION}|${id}|${source.seed}|${data}`;
}

// now: a clock (ms). A store with no backend keeps nothing and never fails.
export function createTileStore(backend, { now = () => Date.now(), limit = LIMIT } = {}) {
  const stats = { read: 0, saved: 0, failed: 0 };
  const safe = async (fn, fallback) => {
    if (!backend) return fallback;
    try {
      return await fn();
    } catch {
      stats.failed += 1;
      return fallback;
    }
  };
  let pruning = null;
  // Drop the keys of an old version, and the tiles used longest ago over the limit.
  async function prune(prefixVersion) {
    const all = await safe(() => backend.list(), []);
    const old = all.filter((e) => !e.key.startsWith(prefixVersion));
    const kept = all.filter((e) => e.key.startsWith(prefixVersion)).sort((a, b) => b.used - a.used);
    const drop = [...old, ...kept.slice(limit)].map((e) => e.key);
    if (drop.length) await safe(() => backend.deleteMany(drop), null);
  }
  return {
    stats,
    // The saved tiles of these keys: a Map key -> tile (the missing ones are not in it).
    async read(keys) {
      const found = await safe(() => backend.getMany(keys), new Map());
      const out = new Map();
      const used = now();
      for (const [key, e] of found) if (e?.tile) out.set(key, e.tile);
      stats.read += out.size;
      if (out.size) safe(() => backend.touch([...out.keys()].map((key) => ({ key, used }))), null);
      return out;
    },
    // Save made tiles: [{ key, tile }]. The store drops old tiles after a save.
    async save(entries) {
      if (!entries.length) return;
      const used = now();
      const ok = await safe(() => backend.putMany(entries.map((e) => ({ ...e, used }))).then(() => true), false);
      if (ok) stats.saved += entries.length;
      pruning ??= prune(`v${LAND_VERSION}|`).finally(() => { pruning = null; });
      await pruning;
    },
  };
}

// A backend in memory (for the tests, and for a device with no IndexedDB in one visit).
export function memoryBackend(map = new Map()) {
  return {
    map,
    async getMany(keys) {
      return new Map(keys.filter((k) => map.has(k)).map((k) => [k, map.get(k)]));
    },
    async putMany(entries) {
      for (const e of entries) map.set(e.key, { tile: e.tile, used: e.used });
    },
    async touch(entries) {
      for (const e of entries) if (map.has(e.key)) map.get(e.key).used = e.used;
    },
    async list() {
      return [...map].map(([key, e]) => ({ key, used: e.used }));
    },
    async deleteMany(keys) {
      for (const k of keys) map.delete(k);
    },
  };
}
