// Text lookup by key. This module has no DOM code.
// A dictionary is a flat object: { "key.name": "Text with {param}" }.
// A parameter value can be a number, a string, or a nested key
// in the form { key: "other.key", params: {...} }.
// The text "[[id]]" is a glossary mark. It shows the name "gloss.<id>.name".
// In English mode, the first mark of an id also shows "gloss.<id>.meaning".

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

export function createI18n(dict, lang, fallback = null) {
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
    if (typeof v === 'object' && typeof v.key === 'string') return t(v.key, v.params);
    return String(v);
  }

  // Translate a key. Return the key itself when the text is missing,
  // so that a missing key is easy to see.
  function t(key, params) {
    params = params ?? {};
    const text = raw(key);
    if (text === null) return key;
    return text.replace(PARAM, (all, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? value(params[name]) : all);
  }

  // Replace glossary marks. "seen" is a Set of ids that the player saw before.
  // The function adds new ids to "seen".
  function gloss(text, seen = null) {
    return text.replace(GLOSS, (all, id) => {
      const name = raw(`gloss.${id}.name`) ?? id;
      if (lang !== 'en' || seen === null || seen.has(id)) return name;
      seen.add(id);
      const meaning = raw(`gloss.${id}.meaning`);
      return meaning ? `${name} (${meaning})` : name;
    });
  }

  // Text for the voice: the names only, with no glossary marks.
  function plain(text) {
    return text.replace(GLOSS, (all, id) => raw(`gloss.${id}.name`) ?? id);
  }

  return { lang, t, has, gloss, plain, raw };
}
