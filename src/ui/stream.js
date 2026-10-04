// The land streams with the hero: the tiles of the land around the hero (and ahead of the walk) are
// made in Web Workers (src/ui/gen-worker.js) before the hero and the view need them, and the height
// tiles that they read are loaded first. A tile from a worker goes into the land of the map; a
// tile that the game needs before a worker sends it is made at once (the generator is pure: it is
// the same tile). Without workers, one tile is made in each frame.

const RADIUS = 2; // tiles around the tile of the hero (a tile is 64 cells)
const RETRY = 5000; // ms: a tile whose height tiles did not load (offline) asks again after this
// The workers that make tiles at the same time: at the start, the tiles around the hero come
// before the world starts (the loading screen waits for them, src/ui/village.js).
const WORKERS = Math.max(1, Math.min(3, ((globalThis.navigator?.hardwareConcurrency ?? 2) - 1)));

// map: a map on the plane (src/world/regions.js). data: the data of the game (heights, heightBytes,
// moreHeights, geo, scatter, figures).
export function createStream(map, data) {
  const land = map.land;
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
    for (let i = 0; i < WORKERS; i++) {
      const w = { worker: new Worker(new URL('./gen-worker.js', import.meta.url), { type: 'module' }), busy: 0 };
      w.worker.postMessage(init);
      w.worker.onmessage = (e) => {
        const m = e.data;
        if (m.type !== 'tile') return;
        w.busy -= 1;
        if (!land.has(m.tile.tx, m.tile.tz)) land.put(m.tile);
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
  let at = null;
  return {
    // The hero is at a cell (x, y): ask for the tiles around, the nearest first.
    update(x, y, dir = { x: 0, y: 0 }) {
      // Ahead of the walk: the middle of the ring moves a little in the direction of the walk.
      const cx = Math.floor((x + dir.x * 32) / 64);
      const cy = Math.floor((y + dir.y * 32) / 64);
      const key = `${cx},${cy}`;
      if (key !== at) {
        at = key;
        const want = [];
        for (let dz = -RADIUS; dz <= RADIUS; dz++) for (let dx = -RADIUS; dx <= RADIUS; dx++) want.push([cx + dx, cy + dz, dx * dx + dz * dz]);
        want.sort((a, b) => a[2] - b[2]);
        for (const [tx, tz] of want) ask(tx, tz);
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
        land.tile(next[0], next[1]);
        asked.delete(next[2]);
      }
    },
    // The tiles around a cell that are made: { total, ready } (radius in tiles).
    near(x, y, radius = 1) {
      const out = { total: 0, ready: 0 };
      const cx = Math.floor(x / 64);
      const cy = Math.floor(y / 64);
      for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
        out.total += 1;
        if (land.has(cx + dx, cy + dz)) out.ready += 1;
      }
      return out;
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
