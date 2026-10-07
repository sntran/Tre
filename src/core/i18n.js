// Text lookup by key. This module has no DOM code.
// A dictionary is a flat object: { "key.name": "Text with {param}" }.
// A parameter value can be a number, a string, a list (joined with ui.list.sep and ui.list.and), or
// a nested key in the form { key: "other.key", params: {...} }. A key "<key>.one" is the text for
// the param n equal to 1 (the plural of English).
// The text "[[id]]" is a glossary mark. It shows the name "gloss.<id>.name".
// In English mode, the first mark of an id also shows "gloss.<id>.meaning".
// The text "{w:đâu}" in a line of a person is a word that can change: it shows the word of the way
// of speaking of the region (setSpeech; src/core/speech.js), or the word itself.
import { speak as speakWay } from './speech.js';

const PARAM = /\{([a-zA-Z0-9_]+)\}/g;
const GLOSS = /\[\[([a-z0-9_-]+)\]\]/g;

// Show a number in the style of the language.
// Vietnamese uses a comma for decimals and a dot for thousands.
export function formatNumber(value, lang) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);
  const negative = value < 0;
  const text = String(Math.abs(value));
  const [whole, part] = text.split('.');
  const group = lang === 'vi' ? '.' : ',';
  const point = lang === 'vi' ? ',' : '.';
  // Do not group numbers of 4 digits, so that children read "1000" and years easily.
  const grouped = whole.length > 4 ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, group) : whole;
  return (negative ? '-' : '') + grouped + (part ? point + part : '');
}

// Is the text at this offset the start of a sentence?
export function startsSentence(text, offset) {
  const before = text.slice(0, offset).trimEnd();
  return before === '' || /[.!?…]$/.test(before);
}

// The text with a capital first letter. Glossary marks and numbers stay the same.
export function capitalize(text) {
  if (!text || text.startsWith('[[')) return text;
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

export function createI18n(dict, lang, fallback = null) {
  let speech = null; // the words of the way of speaking of the region of the map (null: the whole country)
  function has(key) {
    return Object.prototype.hasOwnProperty.call(dict, key) ||
      (fallback !== null && Object.prototype.hasOwnProperty.call(fallback, key));
  }

  function raw(key) {
    if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    if (fallback && Object.prototype.hasOwnProperty.call(fallback, key)) return fallback[key];
    return null;
  }

  function value(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return formatNumber(v, lang);
    // A list: "3, 4 và 5" ("3, 4, and 5" has no comma before "and" here: "3, 4 and 5").
    if (Array.isArray(v)) {
      const items = v.map(value);
      if (items.length < 2) return items.join('');
      return `${items.slice(0, -1).join(raw('ui.list.sep') ?? ', ')}${raw('ui.list.and') ?? ' & '}${items[items.length - 1]}`;
    }
    if (typeof v === 'object' && typeof v.key === 'string') return t(v.key, v.params);
    return String(v);
  }

  // Translate a key. Return the key itself when the text is missing,
  // so that a missing key is easy to see.
  // A parameter at the start of a sentence (at the start of the text, or after ".", "!",
  // "?", or "…") starts with a capital letter, for example "{name} is calm." -> "The scout is calm."
  // The plural: with the param n equal to 1, the text of "<key>.one" when it is there (English has
  // two forms, Vietnamese has one), so that "1 times" never shows (#42).
  function t(key, params) {
    params = params ?? {};
    const marked = (params.n === 1 && raw(`${key}.one`)) || raw(key);
    if (marked === null) return key;
    const text = speakWay(marked, speech);
    return text.replace(PARAM, (all, name, offset) => {
      if (!Object.prototype.hasOwnProperty.call(params, name)) return all;
      const v = value(params[name]);
      if (startsSentence(text, offset)) return capitalize(v);
      // In the middle of an English sentence, a name with an article has a small article: "Nam
      // likes the drum dance most", not "The drum dance" (#42).
      return lang === 'en' ? v.replace(/^(The|A|An) /, (a) => a.toLowerCase()) : v;
    });
  }

  // The name of a glossary id. names: names that the player chose (for example for a friend).
  const nameOf = (id, names) => names?.[id] || raw(`gloss.${id}.name`) || id;

  // Replace glossary marks. "seen" is a Set of ids that the player saw before.
  // The function adds new ids to "seen".
  function gloss(text, seen = null, names = null) {
    return text.replace(GLOSS, (all, id, offset) => {
      // A name at the start of a sentence starts with a capital letter.
      const own = nameOf(id, names);
      const name = startsSentence(text, offset) ? capitalize(own) : own;
      if (lang !== 'en' || seen === null || seen.has(id)) return name;
      seen.add(id);
      const meaning = raw(`gloss.${id}.meaning`);
      return meaning ? `${name} (${meaning})` : name;
    });
  }

  // Text for the voice: the names only, with no glossary marks.
  function plain(text, names = null) {
    return text.replace(GLOSS, (all, id, offset) => {
      const own = nameOf(id, names);
      return startsSentence(text, offset) ? capitalize(own) : own;
    });
  }

  // The way of speaking of the region of the map: a table of words (null: the whole country).
  const setSpeech = (table) => { speech = table && Object.keys(table).length ? table : null; };

  return { lang, t, has, gloss, plain, raw, setSpeech };
}
