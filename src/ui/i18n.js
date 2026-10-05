// Load the language files and put text into the DOM.
import { createI18n } from '../core/i18n.js';
import { glossesOf } from '../core/speech.js';

const dicts = {};
let active = createI18n({}, 'vi');
const seenGloss = new Set();
// Values that all texts can use, for example the name of the hero.
let globals = {};
// The words of the way of speaking of the region of the map (#39): null for the whole country.
let speech = null;

export function setSpeech(table) {
  speech = table ?? null;
  active.setSpeech(speech);
}

// The words of a region in a line (the marks of its text): [{ word, local }], for the gloss.
export function regionalWords(key) {
  return glossesOf(active.raw(key) ?? '', speech);
}

export function setGlobalParams(values) {
  globals = { ...values };
}

async function loadDict(lang) {
  if (!dicts[lang]) {
    const response = await fetch(`i18n/${lang}.json`);
    dicts[lang] = await response.json();
  }
  return dicts[lang];
}

export async function setLanguage(lang) {
  const dict = await loadDict(lang);
  // Use the other language only when a key is missing. A test makes sure this does not occur.
  const other = lang === 'vi' ? 'en' : 'vi';
  active = createI18n(dict, lang, dicts[other] ?? null);
  active.setSpeech(speech);
  document.documentElement.lang = lang;
  applyText(document.body);
  return active;
}

export function lang() {
  return active.lang;
}

export function t(key, params) {
  return active.t(key, { ...globals, ...(params ?? {}) });
}

export function has(key) {
  return active.has(key);
}

// Text with glossary marks. In English, the first mark also shows the meaning.
export function tg(key, params) {
  return active.gloss(t(key, params), seenGloss, chosenNames);
}

// Names that the player chose for friends, by glossary id (for example { nghecalf: 'Mít' }).
let chosenNames = {};
export function setChosenNames(names) {
  chosenNames = { ...(names ?? {}) };
}

// Short text with the glossary names only, with no meaning (for example for the quest bar).
export function tn(key, params) {
  return active.plain(t(key, params), chosenNames);
}

// Text for the voice.
export function say(key, params) {
  const sayKey = `${key}.say`;
  const text = active.has(sayKey) ? t(sayKey, params) : t(key, params);
  return active.plain(text, chosenNames);
}

// Set the glossary ids that the player saw before (from the profile).
export function useSeenGloss(list) {
  seenGloss.clear();
  for (const id of list ?? []) seenGloss.add(id);
}

export function seenGlossList() {
  return [...seenGloss];
}

// Put text into elements that have data-i18n attributes.
export function applyText(root) {
  if (!root) return;
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-label]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nLabel));
    el.setAttribute('title', t(el.dataset.i18nLabel));
  }
}
