// The ways of speaking of the people of a region (#39; data/world/speech.json). A line of a person
// marks a word that can change ({w:đâu}); the game puts the word of the way of the region of the
// map ("mô" in the center). The narrator, the screens, the hero, and the words of the math have no
// marks, so that the child learns one word for one idea. Pure: no DOM.

const MARK = /\{w:([^}]+)\}/g;

// The way of speaking of a region (north when the region names none).
export function speechWay(regions, regionId) {
  return regions?.regions?.find((r) => r.id === regionId)?.speech ?? 'north';
}

// The table of the words of a way: a word of the whole country -> the word of the region.
export const speechTable = (speech, way) => speech?.ways?.[way]?.words ?? {};

// The word of the region for a marked word, with the capital letter of the marked word.
export function localWord(table, word) {
  const local = table?.[word.toLocaleLowerCase('vi')];
  if (!local) return word;
  return word[0] !== word[0].toLocaleLowerCase('vi') ? local[0].toLocaleUpperCase('vi') + local.slice(1) : local;
}

// A text with its marks replaced by the words of a way (table null: the words of the whole country).
export const speak = (text, table) => text.replace(MARK, (all, word) => localWord(table, word));

// The marked words of a text.
export const markedWords = (text) => [...String(text).matchAll(MARK)].map((m) => m[1]);

// The words of a region in a text: [{ word, local }] (one for each word, only the words that change).
export function glossesOf(text, table) {
  const out = [];
  for (const word of markedWords(text)) {
    const local = localWord(table, word.toLocaleLowerCase('vi'));
    const base = word.toLocaleLowerCase('vi');
    if (local !== base && !out.some((g) => g.local === local)) out.push({ word: base, local });
  }
  return out;
}

// The glosses that the child did not see yet (seen: the list of the words of a region that the
// child saw, profile.seenGloss). They go into seen, so that each gloss shows one time.
export function newGlosses(glosses, seen) {
  const fresh = glosses.filter((g) => !seen.includes(g.local));
  for (const g of fresh) seen.push(g.local);
  return fresh;
}
