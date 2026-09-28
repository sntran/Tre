// The save format. Each save has a format name and a version number.
// Old saves go through the migrations, so that they work after updates.
// The export code is compressed text with a checksum. A bad code does not load.
import { compress, decompress, crc32, toBase64Url, fromBase64Url, utf8Encode, utf8Decode } from './codec.js';

export const SAVE_FORMAT = 'tre-save';
export const SAVE_VERSION = 1;
export const CODE_PREFIX = 'TRE1';

// MIGRATIONS[n] changes a save of version n into version n + 1.
// Add a function here each time the profile shape changes. Never remove one.
export const MIGRATIONS = {};

export class SaveError extends Error {
  constructor(reason, message) {
    super(message ?? reason);
    this.reason = reason;
  }
}

export function wrap(profile, now = 0) {
  return { format: SAVE_FORMAT, version: SAVE_VERSION, savedAt: now, profile };
}

// Bring a save of any older version to the current version.
export function migrate(save, { migrations = MIGRATIONS, version = SAVE_VERSION } = {}) {
  if (!save || typeof save !== 'object' || save.format !== SAVE_FORMAT) {
    throw new SaveError('format', 'This is not a Tre save');
  }
  if (!Number.isInteger(save.version) || save.version < 1) throw new SaveError('version', 'Bad version');
  if (save.version > version) throw new SaveError('newer', 'The save is from a newer version of the game');
  let current = structuredClone(save);
  while (current.version < version) {
    const step = migrations[current.version];
    if (!step) throw new SaveError('migration', `No migration from version ${current.version}`);
    current = { ...current, profile: step(current.profile), version: current.version + 1 };
  }
  validate(current.profile);
  return current;
}

// Check the basic shape of a profile.
export function validate(profile) {
  const fail = (what) => { throw new SaveError('shape', `Bad profile: ${what}`); };
  if (!profile || typeof profile !== 'object') fail('not an object');
  if (typeof profile.id !== 'string' || profile.id === '') fail('id');
  if (!profile.hero || typeof profile.hero.name !== 'string') fail('hero');
  if (!Number.isInteger(profile.grade) || profile.grade < 1 || profile.grade > 5) fail('grade');
  for (const key of ['flags', 'quests', 'inventory', 'learning', 'settings', 'time']) {
    if (!profile[key] || typeof profile[key] !== 'object') fail(key);
  }
  for (const key of ['titles', 'friends', 'party', 'stele']) {
    if (!Array.isArray(profile[key])) fail(key);
  }
  return true;
}

export function serialize(profile, now = 0) {
  return JSON.stringify(wrap(profile, now));
}

export function deserialize(text, options) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SaveError('json', 'The save is not valid JSON');
  }
  return migrate(data, options).profile;
}

// Make a text code of a profile: TRE1-<data>-<checksum>.
export function exportCode(profile, now = 0) {
  const packed = compress(utf8Encode(serialize(profile, now)));
  const sum = crc32(packed).toString(16).padStart(8, '0');
  return `${CODE_PREFIX}-${toBase64Url(packed)}-${sum}`;
}

// Read a text code. Throw a SaveError if the code is bad.
export function importCode(code, options) {
  const clean = String(code).replace(/\s+/g, '');
  const parts = clean.split('-');
  // base64url can contain "-", so the data is all parts between the first and the last.
  if (parts.length < 3 || parts[0] !== CODE_PREFIX) throw new SaveError('prefix', 'This is not a Tre code');
  const sum = parts[parts.length - 1];
  const body = parts.slice(1, -1).join('-');
  let packed;
  try {
    packed = fromBase64Url(body);
  } catch {
    throw new SaveError('characters', 'The code has bad characters');
  }
  if (crc32(packed).toString(16).padStart(8, '0') !== sum.toLowerCase()) {
    throw new SaveError('checksum', 'The checksum is not correct');
  }
  let text;
  try {
    text = utf8Decode(decompress(packed));
  } catch {
    throw new SaveError('data', 'The code data is damaged');
  }
  return deserialize(text, options);
}
