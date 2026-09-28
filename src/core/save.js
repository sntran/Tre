// The save format. Each save has a format name and a version number.
// Old saves go through the migrations, so that they work after updates.
// The export code is compressed text with a checksum. A bad code does not load.
import { isGrade } from './grades.js';
import { compress, decompress, crc32, toBase64Url, fromBase64Url, utf8Encode, utf8Decode } from './codec.js';

export const SAVE_FORMAT = 'tre-save';
export const SAVE_VERSION = 2;
export const CODE_PREFIX = 'TRE1';

// MIGRATIONS[n] changes a save of version n into version n + 1.
// Add a function here each time the profile shape changes. Never remove one.
export const MIGRATIONS = {
  // Version 2: each skill entry keeps a "mastered" state and a count of correct answers
  // at the highest level ("top"), and the results of the last answers ("recent"). The hero has a skin tone apart from the face.
  1: (profile) => {
    const out = structuredClone(profile);
    for (const e of Object.values(out.learning?.skills ?? {})) {
      if (!e || typeof e !== 'object') continue;
      // 0.95 was the "mastered" value of version 1.
      e.mastered = typeof e.p === 'number' && e.p >= 0.95;
      e.top ??= 0;
      e.recent ??= '';
    }
    if (out.hero && typeof out.hero === 'object') out.hero.skin ??= out.hero.face ?? 1;
    return out;
  },
};

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
// options: { migrations, version, grades } (grades: the grade configuration, to check the grade).
export function migrate(save, options = {}) {
  const { migrations = MIGRATIONS, version = SAVE_VERSION } = options;
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
  validate(current.profile, options);
  return current;
}

// Check the basic shape of a profile. With options.grades, the grade must be in the list.
export function validate(profile, { grades = null } = {}) {
  const fail = (what) => { throw new SaveError('shape', `Bad profile: ${what}`); };
  if (!profile || typeof profile !== 'object') fail('not an object');
  if (typeof profile.id !== 'string' || profile.id === '') fail('id');
  if (!profile.hero || typeof profile.hero.name !== 'string') fail('hero');
  if (!Number.isInteger(profile.grade)) fail('grade');
  if (grades && !isGrade(profile.grade, grades)) fail('grade');
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
