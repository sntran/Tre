// The save format. Each save has a format name and a version number.
// Old saves go through the migrations, so that they work after updates.
// The export code is compressed text with a checksum. A bad code does not load.
import { isGrade } from './grades.js';
import { newWorldSave } from './world/save.js';
import { compress, decompress, crc32, toBase64Url, fromBase64Url, utf8Encode, utf8Decode } from './codec.js';

export const SAVE_FORMAT = 'tre-save';
export const SAVE_VERSION = 6;
export const CODE_PREFIX = 'TRE1';

// MIGRATIONS[n] changes a save of version n into version n + 1.
// Add a function here each time the profile shape changes. Never remove one.
export const MIGRATIONS = {
  // Version 2: each skill entry keeps a "mastered" state and a count of correct answers
  // at the highest level ("top"), and the results of the last answers ("recent"). The hero has
  // a skin tone apart from the face. Nghé joins the party after the river battle.
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
    // Nghé comes after the river battle. A player who won that battle in version 1 gets Nghé too.
    if (out.flags?.['river.calmed'] && Array.isArray(out.party) && !out.party.includes('nghe')) {
      if (Array.isArray(out.friends) && !out.friends.includes('nghe')) out.friends.unshift('nghe');
      out.party.unshift('nghe');
      out.flags['friend.nghe'] = true;
    }
    return out;
  },
  // Version 3: the village is an isometric map of a new size. A place on the old map does not
  // match the new map, so the hero starts at the home again. Positions can have a fraction.
  2: (profile) => {
    const out = structuredClone(profile);
    if (out.place && typeof out.place === 'object') out.place = { map: out.place.map ?? 'phu-dong', x: null, y: null };
    return out;
  },
  // Version 4: the world has regions of maps. The game has a clock, and the save keeps the
  // state of each map that the hero has visited. The village map changed again, so the hero
  // starts at home.
  3: (profile) => {
    const out = structuredClone(profile);
    out.clock ??= { minutes: 7 * 60 };
    out.maps ??= {};
    if (out.place && typeof out.place === 'object') out.place = { map: 'phu-dong', x: null, y: null };
    return out;
  },
  // Version 5: Nghé is the friend of the hero from the start, in every save.
  4: (profile) => {
    const out = structuredClone(profile);
    if (Array.isArray(out.friends) && !out.friends.includes('nghe')) out.friends.unshift('nghe');
    if (Array.isArray(out.party) && !out.party.includes('nghe')) out.party.unshift('nghe');
    if (out.flags && typeof out.flags === 'object') out.flags['friend.nghe'] = true;
    return out;
  },
  // Version 6: the world is a state of entities (src/core/world/). The save keeps the world:
  // its seed, its map, the clock, and the hero (on the half-block grid, 2 for each map cell).
  // The fields "place" and "clock" go into the world.
  5: (profile) => {
    const out = structuredClone(profile);
    const place = out.place && typeof out.place === 'object' ? out.place : { map: 'phu-dong', x: null, y: null };
    const world = newWorldSave(out.seed ?? 1, typeof place.map === 'string' ? place.map : 'phu-dong');
    if (out.clock && typeof out.clock.minutes === 'number') world.clock = { minutes: out.clock.minutes };
    if (typeof place.x === 'number' && typeof place.y === 'number') {
      world.entities.push({ id: 'hero', keep: true, control: true, position: { x: place.x * 2, y: 0, z: place.y * 2, facing: 0 }, motion: { vx: 0, vz: 0, speed: 0 }, look: 'hero' });
    }
    out.world = world;
    delete out.place;
    delete out.clock;
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

// Limits for a profile from a code. A code from another device is not trusted,
// so each value must have the correct type and a sensible size.
export const LIMITS = Object.freeze({
  codeChars: 600000, // the length of an export code (a full profile has fewer than 100000)
  jsonChars: 2000000, // the length of the save text in the code
  nameChars: 40,
  idChars: 80,
  listItems: 500, // titles, friends, flags, skill entries, and other lists
  questions: 200, // parent questions
  questionChars: 200,
  choiceChars: 80,
  choices: 6,
  recentChars: 32,
  worldEntities: 2000, // kept entities of the world state
  predictions: 200, // the predictions before a commit that the profile keeps
  worldValues: 200000, // all the values in the components of the kept entities
  visual: { groups: 4, dots: 20, arrayCells: 12, rectSide: 20, fractions: 3, denominator: 24 },
});

const SHAPES = ['circle', 'triangle', 'square', 'rectangle', 'pentagon', 'hexagon'];

// Check the shape of a profile. With options.grades, the grade must be in the list.
// Throw a SaveError with the reason "shape" and the first problem.
export function validate(profile, { grades = null } = {}) {
  const fail = (what) => { throw new SaveError('shape', `Bad profile: ${what}`); };
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const num = (v, what, min = -Infinity, max = Infinity) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(what);
  };
  const int = (v, what, min = -Infinity, max = Infinity) => {
    num(v, what, min, max);
    if (!Number.isInteger(v)) fail(what);
  };
  const str = (v, what, max = LIMITS.idChars, min = 0) => {
    if (typeof v !== 'string' || v.length < min || v.length > max) fail(what);
  };
  const bool = (v, what) => { if (typeof v !== 'boolean') fail(what); };
  const list = (v, what, max = LIMITS.listItems) => {
    if (!Array.isArray(v) || v.length > max) fail(what);
  };
  const entries = (v, what, max = LIMITS.listItems) => {
    if (!isObj(v)) fail(what);
    const e = Object.entries(v);
    if (e.length > max) fail(what);
    for (const [k] of e) str(k, `${what} key`);
    return e;
  };

  if (!isObj(profile)) fail('not an object');
  str(profile.id, 'id', LIMITS.idChars, 1);
  // Hero
  if (!isObj(profile.hero)) fail('hero');
  str(profile.hero.name, 'hero.name', LIMITS.nameChars);
  if (!['boy', 'girl'].includes(profile.hero.gender)) fail('hero.gender');
  for (const key of ['skin', 'face', 'hair', 'clothes']) {
    if (profile.hero[key] !== undefined) int(profile.hero[key], `hero.${key}`, 1, 50);
  }
  // Grade
  if (!Number.isInteger(profile.grade)) fail('grade');
  if (grades && !isGrade(profile.grade, grades)) fail('grade');
  for (const key of ['flags', 'quests', 'inventory', 'learning', 'settings', 'time']) {
    if (!isObj(profile[key])) fail(key);
  }
  for (const key of ['titles', 'friends', 'party', 'stele']) list(profile[key], key);
  for (const key of ['titles', 'friends', 'party']) profile[key].forEach((x) => str(x, key));
  for (const st of profile.stele) {
    if (!isObj(st)) fail('stele');
    str(st.title, 'stele.title');
    str(st.name, 'stele.name', LIMITS.nameChars);
    int(st.era, 'stele.era', 0, 100);
  }
  if (profile.era !== undefined) int(profile.era, 'era', 1, 100);
  if (profile.calling !== undefined && profile.calling !== null) str(profile.calling, 'calling');
  // Flags and quest data have short values only: a boolean, a number, or a short text.
  const short = (value, what) => {
    if (typeof value === 'boolean') return;
    if (typeof value === 'number') num(value, what);
    else str(value, what);
  };
  for (const [, x] of entries(profile.flags, 'flags')) short(x, 'flags value');
  for (const [, x] of entries(profile.quests, 'quests')) short(x, 'quests value');
  for (const [, v] of entries(profile.inventory, 'inventory')) int(v, 'inventory count', 0, 1e9);
  if (profile.friendNames !== undefined) {
    for (const [, x] of entries(profile.friendNames, 'friendNames')) str(x, 'friendNames value', LIMITS.nameChars, 1);
  }
  if (profile.machines !== undefined) {
    list(profile.machines, 'machines');
    profile.machines.forEach((x) => str(x, 'machines', LIMITS.idChars, 1));
  }
  if (profile.seenGloss !== undefined) {
    list(profile.seenGloss, 'seenGloss');
    profile.seenGloss.forEach((x) => str(x, 'seenGloss'));
  }
  if (profile.world !== undefined) validateWorld(profile.world, { fail, num, int, str, list, isObj });
  // The predictions before the first commit on a gap, with their results (until the learning log).
  if (profile.predictions !== undefined) {
    list(profile.predictions, 'predictions', LIMITS.predictions);
    for (const p of profile.predictions) {
      if (!isObj(p)) fail('prediction');
      num(p.at, 'prediction.at', 0, 1e9);
      str(p.task, 'prediction.task');
      int(p.gap, 'prediction.gap', 0, 1000);
      if (p.guess !== null) int(p.guess, 'prediction.guess', 0, 100);
      int(p.used, 'prediction.used', 0, 100);
      bool(p.solved, 'prediction.solved');
    }
  }
  if (profile.maps !== undefined) {
    for (const [id, m] of entries(profile.maps, 'maps', 200)) {
      if (!isObj(m)) fail(`maps ${id}`);
      for (const k of ['first', 'last']) if (m[k] !== undefined) num(m[k], `maps ${id}.${k}`, 0, 1e9);
      if (m.at !== undefined) {
        if (!isObj(m.at)) fail(`maps ${id}.at`);
        for (const k of ['x', 'y']) num(m.at[k], `maps ${id}.at.${k}`, 0, 10000);
      }
      if (m.things !== undefined) for (const [, x] of entries(m.things, `maps ${id}.things`)) short(x, `maps ${id}.things value`);
    }
  }
  if (profile.stats !== undefined) for (const [, v] of entries(profile.stats, 'stats')) int(v, 'stats value', 0, 1e9);
  // Time
  const time = profile.time;
  if (time.day !== null && time.day !== undefined) str(time.day, 'time.day', 20);
  num(time.usedMs ?? 0, 'time.usedMs', 0);
  num(time.extraMs ?? 0, 'time.extraMs', 0);
  validateLearning(profile.learning, { fail, num, int, str, bool, list, entries, isObj });
  validateSettings(profile.settings, { fail, num, int, str, bool, list, isObj });
  return true;
}

// The world state: the seed, the map, the clock, and the kept entities. Components are plain
// data only: numbers, short texts, booleans, lists, and objects, not too deep and not too many.
function validateWorld(world, v) {
  const { fail, num, int, str, list, isObj } = v;
  if (!isObj(world)) fail('world');
  int(world.seed, 'world.seed', 0, 2 ** 32 - 1);
  str(world.map, 'world.map');
  if (!isObj(world.clock)) fail('world.clock');
  num(world.clock.minutes, 'world.clock.minutes', 0, 1e9);
  list(world.entities, 'world.entities', LIMITS.worldEntities);
  let size = 0;
  const plain = (value, what, depth) => {
    size += 1;
    if (size > LIMITS.worldValues || depth > 6) fail(what);
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'number') return num(value, what);
    if (typeof value === 'string') return str(value, what);
    if (Array.isArray(value)) return value.forEach((x) => plain(x, what, depth + 1));
    if (!isObj(value)) fail(what);
    for (const [k, x] of Object.entries(value)) {
      str(k, what);
      plain(x, `${what}.${k}`, depth + 1);
    }
  };
  const entity = (e) => {
    if (!isObj(e) || (typeof e.id !== 'string' && !Number.isInteger(e.id))) fail('world entity');
    plain(e, `world entity ${e.id}`, 0);
    if (e.position !== undefined) {
      if (!isObj(e.position)) fail('world entity position');
      for (const k of ['x', 'y', 'z']) num(e.position[k], `world entity ${e.id} position.${k}`, -1000, 100000);
    }
  };
  world.entities.forEach(entity);
  // The kept entities of the other maps, until the hero comes back there.
  if (world.away !== undefined) {
    if (!isObj(world.away)) fail('world.away');
    for (const [map, kept] of Object.entries(world.away)) {
      str(map, 'world.away map');
      list(kept, `world.away ${map}`, LIMITS.worldEntities);
      kept.forEach(entity);
    }
  }
}

function validateLearning(learning, v) {
  const { fail, num, int, str, bool, list, entries, isObj } = v;
  for (const [id, e] of entries(learning.skills ?? {}, 'learning.skills')) {
    if (!isObj(e)) fail(`learning ${id}`);
    num(e.p, `learning ${id}.p`, 0, 1);
    num(e.r, `learning ${id}.r`, -100000, 100000);
    for (const k of ['n', 'c', 'streak', 'box']) int(e[k] ?? 0, `learning ${id}.${k}`, 0, 1e9);
    if ((e.c ?? 0) > (e.n ?? 0)) fail(`learning ${id}.c`);
    for (const k of ['due', 'last']) num(e[k] ?? 0, `learning ${id}.${k}`);
    if (e.top !== undefined) int(e.top, `learning ${id}.top`, 0, 1e9);
    if (e.mastered !== undefined) bool(e.mastered, `learning ${id}.mastered`);
    if (e.recent !== undefined) {
      str(e.recent, `learning ${id}.recent`, LIMITS.recentChars);
      if (!/^[01]*$/.test(e.recent)) fail(`learning ${id}.recent`);
    }
  }
  for (const [, r] of entries(learning.items ?? {}, 'learning.items', LIMITS.listItems * 10)) num(r, 'learning item', -100000, 100000);
  if (learning.exams !== undefined) {
    list(learning.exams, 'learning.exams');
    for (const x of learning.exams) {
      if (!isObj(x)) fail('exam');
      str(x.kind, 'exam.kind');
      num(x.ability, 'exam.ability', -100000, 100000);
      int(x.asked, 'exam.asked', 0, 1000);
      int(x.correct, 'exam.correct', 0, 1000);
      if (x.passed !== undefined) bool(x.passed, 'exam.passed');
    }
  }
  if (learning.recent !== undefined) {
    list(learning.recent, 'learning.recent', 100);
    learning.recent.forEach((x) => str(x, 'learning.recent'));
  }
}

function validateSettings(settings, v) {
  const { fail, num, str, bool, list, isObj } = v;
  if (!['vi', 'en'].includes(settings.lang)) fail('settings.lang');
  num(settings.timeLimit, 'settings.timeLimit', 0, 24 * 60);
  for (const k of ['sound', 'music', 'voice']) bool(settings[k], `settings.${k}`);
  if (!['auto', 'none', 'small', 'normal'].includes(settings.loss)) fail('settings.loss');
  list(settings.questions, 'settings.questions', LIMITS.questions);
  for (const q of settings.questions) validateQuestion(q, v);
  if (!isObj(settings)) fail('settings');
}

// A question from the parent editor.
function validateQuestion(q, { fail, num, int, str, isObj }) {
  if (!isObj(q)) fail('question');
  str(q.id, 'question.id', LIMITS.idChars, 1);
  str(q.skill, 'question.skill', LIMITS.idChars, 1);
  if (!['vi', 'en'].includes(q.lang)) fail('question.lang');
  str(q.text, 'question.text', LIMITS.questionChars, 1);
  if (q.level !== undefined) int(q.level, 'question.level', 1, 10);
  if (q.type === 'numeric') {
    num(q.answer, 'question.answer');
  } else if (q.type === 'choice') {
    if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > LIMITS.choices) fail('question.choices');
    q.choices.forEach((c) => str(c, 'question.choice', LIMITS.choiceChars, 1));
    int(q.answer, 'question.answer', 0, q.choices.length - 1);
  } else {
    fail('question.type');
  }
  if (q.visual !== undefined && q.visual !== null) validateVisual(q.visual, { fail, int, isObj });
}

// A picture of a question. The limits keep the picture small.
function validateVisual(vis, { fail, int, isObj }) {
  const L = LIMITS.visual;
  if (!isObj(vis)) fail('visual');
  if (vis.type === 'dots') {
    if (!Array.isArray(vis.groups) || vis.groups.length < 1 || vis.groups.length > L.groups) fail('visual.groups');
    vis.groups.forEach((n) => int(n, 'visual.groups', 0, L.dots));
    if (vis.crossed !== undefined) int(vis.crossed, 'visual.crossed', 0, vis.groups.reduce((a, b) => a + b, 0));
  } else if (vis.type === 'array') {
    int(vis.rows, 'visual.rows', 1, L.arrayCells);
    int(vis.cols, 'visual.cols', 1, L.arrayCells);
  } else if (vis.type === 'shape') {
    if (!SHAPES.includes(vis.shape)) fail('visual.shape');
  } else if (vis.type === 'rect') {
    int(vis.w, 'visual.w', 1, L.rectSide);
    int(vis.h, 'visual.h', 1, L.rectSide);
    if (vis.grid !== undefined && typeof vis.grid !== 'boolean') fail('visual.grid');
  } else if (vis.type === 'fractions') {
    if (!Array.isArray(vis.values) || vis.values.length < 1 || vis.values.length > L.fractions) fail('visual.values');
    for (const f of vis.values) {
      if (!Array.isArray(f) || f.length !== 2) fail('visual.values');
      int(f[1], 'visual.denominator', 1, L.denominator);
      int(f[0], 'visual.numerator', 0, f[1]);
    }
  } else {
    fail('visual.type');
  }
}

// When an imported profile has the same id as a profile on this device, the import
// replaces that profile. Return the profile that the import replaces, or null.
export function replacedBy(imported, profiles) {
  return profiles.find((p) => p && p.id === imported.id) ?? null;
}

export function serialize(profile, now = 0) {
  return JSON.stringify(wrap(profile, now));
}

export function deserialize(text, options) {
  if (typeof text !== 'string' || text.length > LIMITS.jsonChars) throw new SaveError('size', 'The save is too long');
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
  if (clean.length > LIMITS.codeChars) throw new SaveError('size', 'The code is too long');
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
    // A UTF-8 character has 4 bytes or fewer.
    text = utf8Decode(decompress(packed, LIMITS.jsonChars * 4));
  } catch {
    throw new SaveError('data', 'The code data is damaged');
  }
  return deserialize(text, options);
}
