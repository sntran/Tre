// Saves in IndexedDB. Each profile is saved as the text of the versioned save format.
// If IndexedDB is not available (for example in some private windows), saves stay in memory.
import { serialize, deserialize } from '../core/save.js';
import { addPoint, restorePoint, gameDay } from '../core/restore.js';

const DB_NAME = 'tre';
const DB_VERSION = 1;
let dbPromise = null;
const memory = { profiles: new Map(), meta: new Map() };
let usingMemory = false;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (!('indexedDB' in window)) {
      usingMemory = true;
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      usingMemory = true;
      resolve(null);
    };
  });
  return dbPromise;
}

function run(storeName, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    if (!db) {
      resolve(fn(null));
      return;
    }
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    const req = fn(store);
    if (req) req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export function isMemoryOnly() {
  return usingMemory;
}

const getRecord = (id) => run('profiles', 'readonly', (s) => (s ? s.get(id) : memory.profiles.get(id)));
const putRecord = (record) => run('profiles', 'readwrite', (s) => (s ? s.put(record) : memory.profiles.set(record.id, record)));

// Save a profile. The restore points of the record stay; the save at a dawn (dawn: true) is also
// a restore point (src/core/restore.js).
export async function saveProfile(profile, { dawn = false } = {}) {
  profile.updatedAt = Date.now();
  const old = await getRecord(profile.id);
  let record = { id: profile.id, name: profile.hero.name, text: serialize(profile, profile.updatedAt), updatedAt: profile.updatedAt, points: old?.points ?? [] };
  if (dawn) record = addPoint(record, { text: record.text, day: gameDay(profile), era: profile.era ?? 1, at: profile.updatedAt });
  await putRecord(record);
}

// The restore points of a profile, the newest first: { day, era, at }.
export async function listRestorePoints(id) {
  const record = await getRecord(id);
  return (record?.points ?? []).map(({ day, era, at }) => ({ day, era, at }));
}

// Go back to a restore point. The current save becomes a restore point in its place.
export async function restoreProfile(id, index) {
  const record = await getRecord(id);
  if (!record?.points?.[index]) return false;
  const current = deserialize(record.text);
  await putRecord(restorePoint(record, index, { day: gameDay(current), era: current.era ?? 1 }, Date.now()));
  return true;
}

export async function loadProfile(id) {
  const record = await getRecord(id);
  return record ? deserialize(record.text) : null;
}

// A short list of all profiles: id, name, the hero look, and the number of restore points.
export async function listProfiles() {
  const records = await run('profiles', 'readonly', (s) => (s ? s.getAll() : [...memory.profiles.values()]));
  const out = [];
  for (const r of records ?? []) {
    try {
      const p = deserialize(r.text);
      out.push({ id: p.id, name: p.hero.name, hero: p.hero, updatedAt: r.updatedAt, titles: p.titles, points: (r.points ?? []).length, profile: p });
    } catch {
      // A damaged save does not stop the game. The parent page can delete it.
      out.push({ id: r.id, name: r.name, damaged: true });
    }
  }
  return out.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

// Delete a profile and its restore points (they are in its record).
export async function deleteProfile(id) {
  await run('profiles', 'readwrite', (s) => (s ? s.delete(id) : memory.profiles.delete(id)));
}

export async function getMeta(key) {
  return run('meta', 'readonly', (s) => (s ? s.get(key) : memory.meta.get(key)));
}

export async function setMeta(key, value) {
  await run('meta', 'readwrite', (s) => (s ? s.put(value, key) : memory.meta.set(key, value)));
}
