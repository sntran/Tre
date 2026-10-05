// The save format. Each save has a format name and a version number.
// Old saves go through the migrations, so that they work after updates.
// The export code is compressed text with a checksum. A bad code does not load.
import { isGrade } from './grades.js';
import { newWorldSave } from './world/save.js';
import { compress, decompress, crc32, toBase64Url, fromBase64Url, utf8Encode, utf8Decode } from './codec.js';

export const SAVE_FORMAT = 'tre-save';
export const SAVE_VERSION = 10;
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
  // Version 7: each map is a window on the plane of its region, with generated land around its
  // story places (src/core/gen/). The hand-made part of three maps moved in its window: a place
  // on these maps moves with it (cells).
  6: (profile) => {
    const out = structuredClone(profile);
    const moved = { 'soc-son': [8, 4], 'trau-son': [64, 4], 'road-thanglong': [0, 16] };
    const shift = (entities, by) => {
      for (const e of entities ?? []) {
        if (e?.position && typeof e.position.x === 'number' && typeof e.position.z === 'number') {
          e.position.x += by[0] * 2;
          e.position.z += by[1] * 2;
        }
      }
    };
    const w = out.world;
    if (w && typeof w === 'object') {
      if (moved[w.map]) shift(w.entities, moved[w.map]);
      for (const [map, list] of Object.entries(w.away ?? {})) if (moved[map]) shift(list, moved[map]);
    }
    for (const [map, m] of Object.entries(out.maps ?? {})) {
      if (moved[map] && m?.at && typeof m.at.x === 'number' && typeof m.at.y === 'number') m.at = { x: m.at.x + moved[map][0], y: m.at.y + moved[map][1] };
    }
    return out;
  },
  // Version 8: the world is one plane for the whole country, and the maps of a region are the
  // frames of its story places on it (src/world/regions.js). The game walks one map for a region:
  // a place in the frame of a map moves to its cell of the plane (the frames of Era 1 at the time of
  // this version), and the state of the maps of a region goes into the map of the region. The kept
  // entities (other than the hero and a thing that travels) go into the chunks of the map (16 x 16
  // cells), as the save keeps them now. The felled trees and the dug blocks of the old maps (only
  // from the tools of a later era) do not stay.
  7: (profile) => {
    const out = structuredClone(profile);
    const ORIGIN = { 'phu-dong': [9357, 6246], 'soc-son': [9047, 5658], 'trau-son': [9563, 6027], 'road-thanglong': [9112, 6303] };
    const REGION = 'giong';
    const shift = (list, by) => {
      for (const e of list ?? []) {
        if (e?.position && typeof e.position.x === 'number' && typeof e.position.z === 'number') {
          e.position.x += by[0] * 2;
          e.position.z += by[1] * 2;
        }
      }
    };
    const chunks = {};
    const w = out.world;
    let from = null;
    if (w && typeof w === 'object') {
      from = typeof w.map === 'string' ? w.map : null;
      if (ORIGIN[from]) {
        shift(w.entities, ORIGIN[from]);
        w.map = REGION;
      }
      const kept = [];
      for (const [m, list] of Object.entries(w.away ?? {})) {
        if (!ORIGIN[m] || !Array.isArray(list)) continue;
        shift(list, ORIGIN[m]);
        kept.push(...list);
        delete w.away[m];
      }
      if (w.away && !Object.keys(w.away).length) delete w.away;
      const stay = [];
      for (const e of Array.isArray(w.entities) ? w.entities : []) {
        if (e?.id === 'hero' || e?.item?.travels || !e?.position) stay.push(e);
        else kept.push(e);
      }
      if (Array.isArray(w.entities)) w.entities = stay;
      for (const e of kept) {
        if (!e?.position) continue;
        const k = `${Math.floor(e.position.x / 32)},${Math.floor(e.position.z / 32)}`;
        ((chunks[k] ??= {}).entities ??= []).push(e);
      }
    }
    if (out.maps && typeof out.maps === 'object') {
      const merged = { things: {} };
      let any = false;
      for (const [m, v] of Object.entries(out.maps)) {
        if (!ORIGIN[m] || !v || typeof v !== 'object') continue;
        any = true;
        if (typeof v.first === 'number') merged.first = Math.min(merged.first ?? Infinity, v.first);
        if (typeof v.last === 'number') merged.last = Math.max(merged.last ?? 0, v.last);
        Object.assign(merged.things, v.things ?? {});
        if (m === from && v.at && typeof v.at.x === 'number' && typeof v.at.y === 'number') merged.at = { x: v.at.x + ORIGIN[m][0], y: v.at.y + ORIGIN[m][1] };
        delete out.maps[m];
      }
      if (Object.keys(chunks).length) merged.chunks = chunks;
      if (any) out.maps[REGION] = merged;
    }
    return out;
  },
  // Version 9: Era 1 has no coins (#26). The coins of the household become measures of rice, one
  // for one, and a market day that was not done (the coins on the mat) goes: the market of today
  // comes again as barter.
  8: (profile) => {
    const out = structuredClone(profile);
    const inv = out.inventory;
    if (inv && typeof inv === 'object' && typeof inv.coin === 'number') {
      if (inv.coin > 0) inv.rice = (typeof inv.rice === 'number' ? inv.rice : 0) + inv.coin;
      delete inv.coin;
    }
    const market = (e) => e?.item?.kind === 'coins' || e?.zone?.task === 'trial-event-market' || /^(zone|mark):(trial-)?event-market/.test(String(e?.id ?? ''));
    const drop = (o) => {
      if (o && typeof o === 'object' && Array.isArray(o.entities)) o.entities = o.entities.filter((e) => !market(e));
    };
    drop(out.world);
    for (const m of Object.values(out.maps ?? {})) for (const c of Object.values(m?.chunks ?? {})) drop(c);
    return out;
  },
  // Version 10: Trâu Sơn is the line of low hills near Châu Cầu (#27). Its frame moved from the
  // cell 9563, 6027 of the plane to 9871, 6040 (its size: 200 x 84 cells). A hero or a kept thing in
  // the old frame moves to the same place of the new frame (the save keeps half blocks), and a kept
  // thing goes into the chunk of its new place.
  9: (profile) => {
    const out = structuredClone(profile);
    const OLD = [9563, 6027];
    const BY = [9871 - 9563, 6040 - 6027];
    const SIZE = [200, 84];
    const inOld = (e) => {
      const p = e?.position;
      if (!p || typeof p.x !== 'number' || typeof p.z !== 'number') return false;
      const x = p.x / 2 - OLD[0];
      const y = p.z / 2 - OLD[1];
      return x >= 0 && x < SIZE[0] && y >= 0 && y < SIZE[1];
    };
    const move = (e) => {
      e.position.x += BY[0] * 2;
      e.position.z += BY[1] * 2;
    };
    const w = out.world;
    if (w && typeof w === 'object' && w.map === 'giong' && Array.isArray(w.entities)) for (const e of w.entities) if (inOld(e)) move(e);
    const m = out.maps?.giong;
    if (m && typeof m === 'object') {
      if (m.at && typeof m.at.x === 'number' && typeof m.at.y === 'number' && inOld({ position: { x: m.at.x * 2, z: m.at.y * 2 } })) {
        m.at = { x: m.at.x + BY[0], y: m.at.y + BY[1] };
      }
      if (m.chunks && typeof m.chunks === 'object') {
        const moved = [];
        for (const c of Object.values(m.chunks)) {
          if (!c || !Array.isArray(c.entities)) continue;
          moved.push(...c.entities.filter(inOld));
          c.entities = c.entities.filter((e) => !inOld(e));
        }
        for (const e of moved) {
          move(e);
          const k = `${Math.floor(e.position.x / 32)},${Math.floor(e.position.z / 32)}`;
          ((m.chunks[k] ??= {}).entities ??= []).push(e);
        }
      }
    }
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
const CHUNK_CELLS = 256; // the cells of a chunk of the land (16 x 16)

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
  predictions: 200, // the predictions before a commit that an older profile kept (now in the log)
  logEvents: 2000, // the raw events of one day in the learning log
  logValues: 100000, // all the values in the roll-ups of the learning log
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
  if (profile.log !== undefined) validateLog(profile.log, { fail, num, int, str, list, isObj });
  if (profile.experiment !== undefined) {
    if (!isObj(profile.experiment)) fail('experiment');
    str(profile.experiment.experiment, 'experiment.experiment', LIMITS.idChars, 1);
    str(profile.experiment.variant, 'experiment.variant', LIMITS.idChars, 1);
  }
  // The predictions of an older version (the game moves them into the learning log).
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
        for (const k of ['x', 'y']) num(m.at[k], `maps ${id}.at.${k}`, 0, 70000);
      }
      if (m.things !== undefined) for (const [, x] of entries(m.things, `maps ${id}.things`)) short(x, `maps ${id}.things value`);
      // What the player changed in the land of the map, for each chunk that the player changed
      // (src/world/terrain.js: run lengths of the bits of the chunk), and its kept entities.
      if (m.chunks !== undefined) {
        for (const [k, c] of entries(m.chunks, `maps ${id}.chunks`, 4000)) {
          if (!/^-?\d{1,5},-?\d{1,5}$/.test(k) || !isObj(c)) fail(`maps ${id}.chunks ${k}`);
          const runs = (r, what) => {
            list(r, what, CHUNK_CELLS + 1);
            let sum = 0;
            for (const n of r) {
              int(n, what, 0, CHUNK_CELLS);
              sum += n;
            }
            if (sum > CHUNK_CELLS) fail(what);
          };
          if (c.dug !== undefined) {
            list(c.dug, `maps ${id}.chunks ${k}.dug`, 64);
            for (const r of c.dug) runs(r, `maps ${id}.chunks ${k}.dug`);
          }
          if (c.felled !== undefined) runs(c.felled, `maps ${id}.chunks ${k}.felled`);
          if (c.entities !== undefined) {
            list(c.entities, `maps ${id}.chunks ${k}.entities`, LIMITS.worldEntities);
            const check = entityCheck({ fail, num, str, isObj });
            c.entities.forEach(check);
          }
        }
      }
    }
  }
  if (profile.stats !== undefined) for (const [, v] of entries(profile.stats, 'stats')) int(v, 'stats value', 0, 1e9);
  // The mentors (src/core/mentor.js): for each task, the moves that were tried and that helped
  // this child (by diagnosis), the usual errors, the self-corrections, and the lift of the task.
  if (profile.mentors !== undefined) {
    for (const [key, m] of entries(profile.mentors, 'mentors')) {
      if (!isObj(m)) fail(`mentors ${key}`);
      for (const part of ['worked', 'tried']) {
        for (const [, moves] of entries(m[part] ?? {}, `mentors ${key}.${part}`)) for (const [, n] of entries(moves, `mentors ${key}.${part}`)) int(n, `mentors ${key}.${part}`, 0, 1e9);
      }
      for (const [, n] of entries(m.errors ?? {}, `mentors ${key}.errors`)) int(n, `mentors ${key}.errors`, 0, 1e9);
      int(m.selfFix ?? 0, `mentors ${key}.selfFix`, 0, 1e9);
      int(m.lift ?? 0, `mentors ${key}.lift`, -3, 3);
    }
  }
  // The practice links (src/core/practice.js): the level of the next round and the sets of each
  // activity.
  if (profile.practice !== undefined) {
    for (const [id, r] of entries(profile.practice, 'practice')) {
      if (!isObj(r)) fail(`practice ${id}`);
      int(r.level, `practice ${id}.level`, 0, 10);
      int(r.sets, `practice ${id}.sets`, 0, 1e9);
    }
  }
  // The memory of the facts of each skill (src/core/planting.js): a × b and b × a as one fact.
  if (profile.facts !== undefined) {
    for (const [skill, mem] of entries(profile.facts, 'facts')) {
      for (const [key, e] of entries(mem, `facts ${skill}`)) {
        if (!/^\d{1,2}x\d{1,2}$/.test(key) || !isObj(e)) fail(`facts ${skill}.${key}`);
        for (const k of ['box', 'due', 'n', 'miss', 'last']) if (e[k] !== undefined) int(e[k], `facts ${skill}.${key}.${k}`, 0, 1e9);
        if (e.again !== undefined && (!isObj(e.again) || !Number.isInteger(e.again.set) || !Number.isInteger(e.again.after))) fail(`facts ${skill}.${key}.again`);
        if (e.again?.round !== undefined) int(e.again.round, `facts ${skill}.${key}.again.round`, 0, 1e9);
        if (e.again?.activity !== undefined && !/^[a-z-]{1,24}$/.test(String(e.again.activity))) fail(`facts ${skill}.${key}.again.activity`);
        // The history of the fact (#25): the activity and the week of its first right commit, and the
        // later week when it was still right.
        if (e.from !== undefined && !/^[a-z-]{1,24}$/.test(String(e.from))) fail(`facts ${skill}.${key}.from`);
        for (const k of ['fromWk', 'kept']) if (e[k] !== undefined) int(e[k], `facts ${skill}.${key}.${k}`, 0, 1e9);
      }
    }
  }
  // The tables of the facts of this week and of the week before (src/core/planting.js, snapFacts).
  if (profile.factSnap !== undefined) {
    const f = profile.factSnap;
    if (!isObj(f) || !isObj(f.cur) || !isObj(f.prev)) fail('factSnap');
    int(f.week, 'factSnap.week', 0, 1e9);
    if (f.prevWeek !== null) int(f.prevWeek, 'factSnap.prevWeek', 0, 1e9);
    for (const t of [f.cur, f.prev]) for (const [k, v] of Object.entries(t)) if (!/^[a-z0-9.]{1,40}$/.test(k) || !/^[-egc]{100}$/.test(String(v))) fail(`factSnap.${k}`);
  }
  // The round of all the activities that use the memory of the facts (the commits so far).
  if (profile.factRound !== undefined) int(profile.factRound, 'factRound', 0, 1e9);
  // The planting of Xóm Ruộng (src/core/planting-session.js): the sets, and the set that goes on.
  if (profile.planting !== undefined) {
    const pl = profile.planting;
    if (!isObj(pl)) fail('planting');
    for (const k of ['sets', 'set', 'index']) int(pl[k] ?? 0, `planting.${k}`, 0, 1e9);
    for (const k of ['used', 'done']) list(pl[k] ?? [], `planting.${k}`, 100);
    for (const [, n] of entries(pl.counts ?? {}, 'planting.counts')) int(n, 'planting.counts', 0, 1e9);
  }
  // The ducks, the fish traps, and the drum dance of Xóm Ruộng (src/core/hamlet-session.js): the
  // sets of each activity, the beat of the drummer, and the plays of each activity.
  if (profile.hamlet !== undefined) {
    const hm = profile.hamlet;
    if (!isObj(hm)) fail('hamlet');
    for (const [act, a] of entries(hm.acts ?? {}, 'hamlet.acts')) {
      if (!['ducks', 'traps', 'drum'].includes(act) || !isObj(a)) fail(`hamlet.acts.${act}`);
      for (const k of ['sets', 'set', 'index']) int(a[k] ?? 0, `hamlet.acts.${act}.${k}`, 0, 1e9);
      for (const k of ['used', 'done']) list(a[k] ?? [], `hamlet.acts.${act}.${k}`, 100);
      for (const [, n] of entries(a.counts ?? {}, `hamlet.acts.${act}.counts`)) int(n, `hamlet.acts.${act}.counts`, 0, 1e9);
      if (a.period !== undefined) num(a.period, `hamlet.acts.${act}.period`, 0.1, 10);
    }
    for (const [, n] of entries(hm.plays ?? {}, 'hamlet.plays')) int(n, 'hamlet.plays', 0, 1e9);
    // The feast table: eggs, fish, sheaves, the eggs that the ducks lay at the next dawn, and the
    // day of the last feast.
    if (hm.table !== undefined) {
      const t = hm.table;
      if (!isObj(t)) fail('hamlet.table');
      for (const k of ['eggs', 'fish', 'sheaves']) int(t[k] ?? 0, `hamlet.table.${k}`, 0, 1e6);
      if (t.laying !== null && t.laying !== undefined) {
        if (!isObj(t.laying)) fail('hamlet.table.laying');
        int(t.laying.day, 'hamlet.table.laying.day', 0, 1e9);
        int(t.laying.n, 'hamlet.table.laying.n', 0, 1e6);
      }
      if (t.feast !== null && t.feast !== undefined) int(t.feast, 'hamlet.table.feast', 0, 1e9);
    }
  }
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
  const entity = entityCheck(v);
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

// A check of a kept entity: components are plain data only (numbers, short texts, booleans,
// lists, and objects, not too deep and not too many), and the place is on the plane.
function entityCheck(v) {
  const { fail, num, str, isObj } = v;
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
  return (e) => {
    if (!isObj(e) || (typeof e.id !== 'string' && !Number.isInteger(e.id))) fail('world entity');
    plain(e, `world entity ${e.id}`, 0);
    if (e.position !== undefined) {
      if (!isObj(e.position)) fail('world entity position');
      for (const k of ['x', 'y', 'z']) num(e.position[k], `world entity ${e.id} position.${k}`, -1000, 140000);
    }
  };
}

// The learning log (src/core/learnlog.js): numbers, times, short ids, words, and lists of
// numbers only, in the events and in the roll-ups. No free text.
function validateLog(log, v) {
  const { fail, num, int, list, isObj } = v;
  if (!isObj(log)) fail('log');
  int(log.v, 'log.v', 1, 100);
  num(log.tz, 'log.tz', -1000, 1000);
  for (const k of ['first', 'day']) if (log[k] !== null) int(log[k], `log.${k}`, 0, 1e6);
  num(log.playMs, 'log.playMs', 0);
  list(log.events, 'log.events', LIMITS.logEvents);
  const short = (s, what) => { if (typeof s !== 'string' || !/^[a-z0-9][a-zA-Z0-9.:_-]{0,39}$/.test(s)) fail(what); };
  let size = 0;
  const plain = (value, what, depth) => {
    size += 1;
    if (size > LIMITS.logValues || depth > 7) fail(what);
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'number') return num(value, what);
    if (typeof value === 'string') return short(value, what);
    if (Array.isArray(value)) return value.forEach((x) => plain(x, what, depth + 1));
    if (!isObj(value)) fail(what);
    for (const [k, x] of Object.entries(value)) {
      short(k, what);
      plain(x, `${what}.${k}`, depth + 1);
    }
  };
  for (const e of log.events) {
    if (!isObj(e)) fail('log event');
    plain(e, 'log event', 0);
  }
  if (!isObj(log.rollups)) fail('log.rollups');
  plain(log.rollups, 'log.rollups', 0);
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
