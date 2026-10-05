// The land tiles kept on the device: the IndexedDB backend of src/world/tilestore.js, in a database
// of its own (the saves stay in the database 'tre', src/ui/storage.js). With no IndexedDB, or when
// the store is full or blocked, the game makes the land as before, with no error.
import { createTileStore } from '../world/tilestore.js';

const DB_NAME = 'tre-land';
// Two stores: the tiles, and the time of the last use of each tile (small, so that the walk over
// the keys to drop the old tiles never reads a tile).
const TILES = 'tiles';
const USED = 'used';

function openDb() {
  return new Promise((resolve) => {
    try {
      if (!globalThis.indexedDB) return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        for (const name of [TILES, USED]) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// One transaction over both stores; fn(tiles, used) asks, and the promise gives what fn returns
// when the transaction ends.
function run(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([TILES, USED], mode);
    const out = fn(tx.objectStore(TILES), tx.objectStore(USED));
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function idbBackend(dbPromise) {
  const withDb = async (fn) => {
    const db = await dbPromise;
    if (!db) throw new Error('no store');
    return fn(db);
  };
  return {
    getMany: (keys) => withDb((db) => run(db, 'readonly', (s) => {
      const out = new Map();
      for (const k of keys) {
        const req = s.get(k);
        req.onsuccess = () => { if (req.result) out.set(k, { tile: req.result }); };
      }
      return out;
    })),
    putMany: (entries) => withDb((db) => run(db, 'readwrite', (tiles, used) => {
      for (const e of entries) {
        tiles.put(e.tile, e.key);
        used.put(e.used, e.key);
      }
    })),
    touch: (entries) => withDb((db) => run(db, 'readwrite', (tiles, used) => {
      for (const e of entries) used.put(e.used, e.key);
    })),
    // The keys and the time of the last use of each (from the small store).
    list: () => withDb((db) => run(db, 'readonly', (tiles, used) => {
      const out = [];
      const req = used.openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        out.push({ key: c.key, used: c.value ?? 0 });
        c.continue();
      };
      return out;
    })),
    deleteMany: (keys) => withDb((db) => run(db, 'readwrite', (tiles, used) => {
      for (const k of keys) {
        tiles.delete(k);
        used.delete(k);
      }
    })),
  };
}

let store = null;
// The one store of the land tiles of this device.
export function landStore() {
  store ??= createTileStore(idbBackend(openDb()));
  return store;
}
