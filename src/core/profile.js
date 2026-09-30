// The profile of one child: hero, progress, skills, and settings.
// The profile is a plain data object, so that it is easy to save.
import { newWorldSave } from './world/save.js';

export const GENDERS = ['boy', 'girl'];

export const DEFAULT_SETTINGS = Object.freeze({
  lang: 'vi',
  timeLimit: 30, // minutes for each day. 0 = no limit.
  sound: true,
  music: true,
  voice: true,
  loss: 'auto', // 'auto' | 'none' | 'small' | 'normal'
  questions: [], // questions from the parent editor
});

export function createProfile({ id, name, gender = 'boy', skin = 1, face = 1, hair = 1, clothes = 1, grade = 1, lang = 'vi', now = 0, seed = 1 }) {
  return {
    id,
    createdAt: now,
    updatedAt: now,
    hero: { name, gender, skin, face, hair, clothes },
    grade,
    calling: null,
    titles: [],
    stele: [],
    // Nghé, the buffalo calf, is the friend of the hero from the first minute.
    flags: { 'friend.nghe': true },
    quests: {},
    inventory: {},
    friends: ['nghe'],
    friendNames: {}, // names that the player chose for friends, by friend id
    party: ['nghe'],
    machines: [],
    // The world state (src/core/world/save.js): the seed, the map, the game clock (game minutes
    // from the start), and the entities that the player changed (the hero). The state of each
    // map that the hero has visited: { first, last } (game minutes), at (the last position),
    // things (changes).
    world: newWorldSave(seed),
    maps: {},
    learning: { skills: {}, items: {}, exams: [] },
    settings: { ...DEFAULT_SETTINGS, lang, questions: [] },
    time: { day: null, usedMs: 0, extraMs: 0 },
    seenGloss: [],
    stats: { battlesWon: 0, battlesLost: 0, mistakes: 0, correct: 0 },
    seed,
  };
}

// Inventory

export function itemCount(profile, item) {
  return profile.inventory[item] ?? 0;
}

export function addItem(profile, item, count = 1) {
  const value = itemCount(profile, item) + count;
  if (value < 0) throw new RangeError(`Not enough ${item}`);
  profile.inventory[item] = value;
  return value;
}

export function hasItems(profile, needs) {
  return Object.entries(needs).every(([item, count]) => itemCount(profile, item) >= count);
}

export function takeItems(profile, needs) {
  if (!hasItems(profile, needs)) return false;
  for (const [item, count] of Object.entries(needs)) addItem(profile, item, -count);
  return true;
}

// Flags record story events, for example "trial.smith.done".

export function setFlag(profile, flag, value = true) {
  profile.flags[flag] = value;
}

export function flag(profile, name) {
  return profile.flags[name] ?? false;
}

// Friends. The player never loses a friend.

export function addFriend(profile, friendId, maxParty = 3) {
  if (profile.friends.includes(friendId)) return false;
  profile.friends.push(friendId);
  if (profile.party.length < maxParty) profile.party.push(friendId);
  return true;
}

// A name that the player chose for a friend. An empty name keeps the usual name.
export function setFriendName(profile, id, name, maxChars = 12) {
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, maxChars);
  profile.friendNames ??= {};
  if (clean) profile.friendNames[id] = clean;
  else delete profile.friendNames[id];
  return clean || null;
}

// The chosen names by glossary id, for the texts: { nghecalf: 'Mít' }.
export function chosenGlossNames(profile, friends) {
  const out = {};
  for (const [id, name] of Object.entries(profile.friendNames ?? {})) {
    const gloss = friends[id]?.gloss;
    if (gloss && name) out[gloss] = name;
  }
  return out;
}

export function setParty(profile, ids, maxParty = 3) {
  const valid = ids.filter((id, i) => profile.friends.includes(id) && ids.indexOf(id) === i);
  profile.party = valid.slice(0, maxParty);
  return profile.party;
}

// Titles and the stele.

export function giveTitle(profile, titleId, era, now) {
  if (profile.titles.includes(titleId)) return false;
  profile.titles.push(titleId);
  profile.stele.push({ era, title: titleId, name: profile.hero.name, at: now });
  return true;
}

// "Văn võ song toàn": the scholar title and the win over the boss of an era.
export function eraComplete(profile, era, titleOfEra) {
  return profile.titles.includes(titleOfEra) && flag(profile, `era${era}.boss.won`);
}

// The loss rule for a lost raid. Grade 1 has no item loss unless the parent sets it.
export function lossLevel(profile) {
  const setting = profile.settings.loss;
  if (setting && setting !== 'auto') return setting;
  return profile.grade <= 1 ? 'none' : 'small';
}

// Take some small items after a lost raid. Friends, machines, and titles stay.
// rules: { small: { share: 0.1, max: 3 }, normal: { share: 0.25, max: 10 } }, items: ['coin', ...]
export function applyLoss(profile, level, rules, lossItems) {
  const rule = rules[level];
  const lost = {};
  if (!rule) return lost;
  for (const item of lossItems) {
    const have = itemCount(profile, item);
    if (have <= 0) continue;
    const count = Math.min(rule.max, Math.max(1, Math.floor(have * rule.share)));
    addItem(profile, item, -count);
    lost[item] = count;
  }
  return lost;
}
