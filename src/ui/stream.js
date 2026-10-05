// The land streams with the hero: the tiles of the land around the hero (and ahead of the walk) are
// made in Web Workers (src/ui/gen-worker.js) before the hero and the view need them, and the height
// tiles that they read are loaded first. A tile from a worker goes into the land of the map; a
// tile that the game needs before a worker sends it is made at once (the generator is pure: it is
// the same tile). Without workers, one tile is made in each frame. The made tiles are kept on the
// device (src/world/tilestore.js): a tile that is in the store is read, not made.
import { landKey } from '../world/tilestore.js';

const RADIUS = 2; // tiles around the tile of the hero (a tile is 64 cells)
const TILE = 64;
// The first view (#36): the drawn ring of chunks around the chunk of the hero (RINGS.draw in
// src/render/voxel.js: 9 x 9 chunks of 16 cells), with the cells around a chunk that its mesh reads.
export const VIEW = Object.freeze({ chunk: 16, ring: 4, pad: 10 });

// The land tiles under the first view around a cell (x, y): [[tx, tz], ...].
export function viewTiles(x, y, view = VIEW) {
  const cx = Math.floor(x / view.chunk);
  const cy = Math.floor(y / view.chunk);
  const x0 = Math.floor(((cx - view.ring) * view.chunk - view.pad) / TILE);
  const x1 = Math.floor(((cx + view.ring + 1) * view.chunk + view.pad - 1) / TILE);
  const y0 = Math.floor(((cy - view.ring) * view.chunk - view.pad) / TILE);
  const y1 = Math.floor(((cy + view.ring + 1) * view.chunk + view.pad - 1) / TILE);
  const out = [];
  for (let tz = y0; tz <= y1; tz++) for (let tx = x0; tx <= x1; tx++) out.push([tx, tz]);
  return out;
}
const RETRY = 5000; // ms: a tile whose height tiles did not load (offline) asks again after this
// The workers that make tiles at the same time: at the start, the tiles around the hero come
// before the world starts (the loading screen waits for them, src/ui/village.js).
const WORKERS = Math.max(1, Math.min(3, ((globalThis.navigator?.hardwareConcurrency ?? 2) - 1)));

// map: a map on the plane (src/world/regions.js). data: the data of the game (heights, heightBytes,
// moreHeights, geo, scatter, figures). store: the land tiles kept on the device (null: none).
// worker: make a Worker (null: no workers, one tile in each frame).
export function createStream(map, data, { store = null, worker = defaultWorker } = {}) {
  const land = map.land;
  const prefix = landKey(map.id, map.source, data.scatter ?? {}, data.figures?.villagers ?? null);
  const keyOf = (tx, tz) => `${prefix}|${tx},${tz}`;
  const stats = { read: 0, made: 0 };
  // Keep a made tile on the device (a copy goes into the store at once).
  const keep = (tile) => {
    if (store) store.save([{ key: keyOf(tile.tx, tile.tz), tile }]);
  };
  const asked = new Set();
  const queue = [];
  // The tiles whose height tiles did not load: they show the paper of the mist until they load.
  const waiting = new Map();
  // The workers, and the tiles that each one makes now.
  let workers = [];
  const init = {
    type: 'init',
    def: map.source.def,
    places: map.source.places,
    seed: map.source.seed,
    rivers: data.geo.rivers,
    land: data.geo.land,
    rules: data.scatter ?? {},
    parts: data.figures.villagers ?? null,
    heights: [...data.heightBytes.values()],
  };
  try {
    for (let i = 0; i < (worker ? WORKERS : 0); i++) {
      const w = { worker: worker(), busy: 0 };
      w.worker.postMessage(init);
      w.worker.onmessage = (e) => {
        const m = e.data;
        if (m.type !== 'tile') return;
        w.busy -= 1;
        if (!land.has(m.tile.tx, m.tile.tz)) {
          land.put(m.tile);
          stats.made += 1;
          keep(m.tile);
        }
        asked.delete(m.key);
      };
      w.worker.onerror = () => {
        w.worker.terminate();
        workers = workers.filter((x) => x !== w);
        asked.clear();
      };
      workers.push(w);
    }
  } catch {
    for (const w of workers) w.worker.terminate();
    workers = [];
  }
  const sent = new Set(data.heightBytes.keys());
  // Send the new height tiles to the workers.
  const share = () => {
    if (!workers.length) return;
    const tiles = [...data.heightBytes.entries()].filter(([n]) => !sent.has(n));
    if (!tiles.length) return;
    for (const [n] of tiles) sent.add(n);
    for (const w of workers) w.worker.postMessage({ type: 'heights', tiles: tiles.map(([, b]) => b) });
  };
  async function ask(tx, tz) {
    const key = `${tx},${tz}`;
    if (asked.has(key) || land.has(tx, tz)) return;
    asked.add(key);
    const need = land.needs(tx, tz).filter((n) => !data.heights.has(n));
    if (need.length) await data.moreHeights(need);
    if (need.some((n) => !data.heights.has(n))) {
      asked.delete(key);
      waiting.set(key, [tx, tz, Date.now() + RETRY]);
      return;
    }
    waiting.delete(key);
    share();
    if (land.has(tx, tz)) {
      asked.delete(key);
      return;
    }
    // The worker with the fewest tiles to make.
    const w = workers.reduce((a, b) => (b.busy < a.busy ? b : a), workers[0] ?? null);
    if (w) {
      w.busy += 1;
      w.worker.postMessage({ type: 'tile', tx, tz, key });
    } else queue.push([tx, tz, key]);
  }
  // Read the tiles of a list from the store in one go; ask for the ones that are not there.
  async function fill(list) {
    const want = list.filter(([tx, tz]) => !land.has(tx, tz) && !asked.has(`${tx},${tz}`));
    if (!want.length) return;
    for (const [tx, tz] of want) asked.add(`${tx},${tz}`);
    const found = store ? await store.read(want.map(([tx, tz]) => keyOf(tx, tz))) : new Map();
    for (const [tx, tz] of want) {
      asked.delete(`${tx},${tz}`);
      const tile = found.get(keyOf(tx, tz));
      if (tile && !land.has(tx, tz)) {
        land.put(tile);
        stats.read += 1;
      }
    }
    for (const [tx, tz] of want) ask(tx, tz);
  }
  let at = null;
  return {
    stats,
    // The hero is at a cell (x, y): ask for the tiles around, the nearest first.
    update(x, y, dir = { x: 0, y: 0 }) {
      // Ahead of the walk: the middle of the ring moves a little in the direction of the walk.
      const cx = Math.floor((x + dir.x * 32) / 64);
      const cy = Math.floor((y + dir.y * 32) / 64);
      const key = `${cx},${cy}`;
      if (key !== at) {
        at = key;
        // The tiles of the first view of the hero first, then the rest of the ring, the nearest first.
        const first = viewTiles(x, y);
        const inFirst = new Set(first.map(([tx, tz]) => `${tx},${tz}`));
        const rest = [];
        for (let dz = -RADIUS; dz <= RADIUS; dz++) for (let dx = -RADIUS; dx <= RADIUS; dx++) if (!inFirst.has(`${cx + dx},${cy + dz}`)) rest.push([cx + dx, cy + dz, dx * dx + dz * dz]);
        rest.sort((a, b) => a[2] - b[2]);
        fill(first).then(() => fill(rest));
      }
      // Ask again for the tiles whose height tiles did not load.
      const now = Date.now();
      for (const [k, [tx, tz, when]] of waiting) {
        if (when > now) continue;
        waiting.delete(k);
        ask(tx, tz);
      }
      // Without workers: one tile in each frame.
      const next = queue.shift();
      if (next) {
        keep(land.tile(next[0], next[1]));
        stats.made += 1;
        asked.delete(next[2]);
      }
    },
    // The tiles of the first view around a cell that are made: { total, ready }.
    firstView(x, y) {
      const tiles = viewTiles(x, y);
      return { total: tiles.length, ready: tiles.filter(([tx, tz]) => land.has(tx, tz)).length };
    },
    // Are the tiles of a box of cells made?
    ready(x0, y0, x1, y1) {
      for (let tz = Math.floor(y0 / 64); tz <= Math.floor((y1 - 1) / 64); tz++) for (let tx = Math.floor(x0 / 64); tx <= Math.floor((x1 - 1) / 64); tx++) if (!land.has(tx, tz)) return false;
      return true;
    },
    dispose() {
      for (const w of workers) w.worker.terminate();
      workers = [];
    },
  };
}

function defaultWorker() {
  return new Worker(new URL('./gen-worker.js', import.meta.url), { type: 'module' });
}
