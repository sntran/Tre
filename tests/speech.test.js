// The people speak the words of their region and era (#39): data/world/speech.json, the marks of the
// lines of people ({w:đâu}), and the gloss of a word of a region (src/core/speech.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { speechWay, speechTable, markedWords, glossesOf, newGlosses, localWord } from '../src/core/speech.js';
import { createI18n } from '../src/core/i18n.js';
import { load } from './helpers.js';

const speech = load('data/world/speech.json');
const regions = load('data/world/regions.json');
const vi = load('i18n/vi.json');
const en = load('i18n/en.json');

// The speaker of each line of the dialogues.
const speakers = {};
for (const f of readdirSync('data/dialogue')) {
  const file = load(`data/dialogue/${f}`);
  for (const d of file.dialogues ?? Object.values(file)) for (const n of Object.values(d?.nodes ?? {})) if (n.textKey) speakers[n.textKey] = n.speaker ?? 'narrator';
}
// A line of a person: a key of the list of people, and a dialogue line with a person as its speaker.
const ofPerson = (key) => (key.startsWith('dlg.') ? !['narrator', 'hero', undefined].includes(speakers[key]) : speech.people.some((p) => key.startsWith(p)));

test('each region has a way of speaking and a way of naming for its era; the north and every region before the 18th century speak the words of the whole country', () => {
  for (const r of regions.regions) {
    assert.ok(speech.ways[r.speech], `${r.id}: speech ${r.speech}`);
    assert.ok(r.naming, `${r.id}: naming`);
    if (r.chapter <= 11) assert.equal(r.speech, 'north', r.id);
  }
  assert.deepEqual(speechTable(speech, 'north'), {});
  assert.equal(speechWay(regions, 'tay-son'), 'center');
  assert.equal(speechWay(regions, 'gia-dinh'), 'south');
});

test('the same line of a person: "đâu" in a region of the north, "mô" in a region of the center', () => {
  const i18n = createI18n(vi, 'vi');
  i18n.setSpeech(speechTable(speech, speechWay(regions, 'giong')));
  assert.match(i18n.t('dlg.grandma.intro.nghe1'), /Cháu đi đâu, nghé theo đó\./);
  i18n.setSpeech(speechTable(speech, speechWay(regions, 'tay-son')));
  assert.match(i18n.t('dlg.grandma.intro.nghe1'), /Cháu đi mô, nghé theo đó\./);
  assert.match(i18n.t('dlg.giong.speaks.n2'), /^Mạ ơi, mạ mời/, 'a capital letter stays');
  i18n.setSpeech(speechTable(speech, 'south'));
  assert.match(i18n.t('dlg.giong.speaks.n2'), /^Má ơi, má mời/);
  assert.match(i18n.t('dlg.messenger.call.n4'), /nhà tui/);
  assert.equal(localWord(speechTable(speech, 'center'), 'Này'), 'Ni');
});

test('each marked word is in a table, the marks are only in lines of people, and the narrator, the screens, the hero, the numbers, and English have none', () => {
  const all = new Set(Object.values(speech.ways).flatMap((w) => Object.keys(w.words)));
  let marked = 0;
  for (const [key, text] of Object.entries(vi)) {
    const words = markedWords(text);
    if (!words.length) continue;
    marked += words.length;
    assert.ok(ofPerson(key), `${key}: a mark in a line that is not of a person`);
    for (const w of words) assert.ok(all.has(w.toLocaleLowerCase('vi')), `${key}: ${w}`);
  }
  assert.ok(marked >= 10, 'the lines of people have marks');
  for (const [key, text] of Object.entries(en)) assert.deepEqual(markedWords(text), [], `en ${key}`);
  for (const key of Object.keys(vi).filter((k) => k.startsWith('num.') || k.startsWith('ui.') || k.startsWith('quest.'))) assert.deepEqual(markedWords(vi[key]), [], key);
});

test('the gloss of a word of a region shows one time for each word, and the north has none', () => {
  const center = speechTable(speech, 'center');
  const seen = [];
  const line = vi['plant.choose.no'];
  assert.deepEqual(glossesOf(line, center), [{ word: 'này', local: 'ni' }, { word: 'kia', local: 'tê' }]);
  assert.deepEqual(newGlosses(glossesOf(line, center), seen).map((g) => g.local), ['ni', 'tê']);
  assert.deepEqual(newGlosses(glossesOf(line, center), seen), [], 'not a second time');
  assert.deepEqual(newGlosses(glossesOf(vi['mentor.mark'], center), seen), [], 'ni was seen in another line');
  assert.deepEqual(glossesOf(line, speechTable(speech, 'north')), []);
  const i18n = createI18n(vi, 'vi');
  assert.equal(i18n.t('speech.gloss', { local: 'mô', word: 'đâu' }), '“mô” = “đâu”');
});

test('the words of numbers are the words of the whole country: "linh", not "lẻ"; "nghìn", not "ngàn" (#45)', () => {
  for (const key of Object.keys(vi).filter((k) => k.startsWith('num.'))) {
    assert.ok(!/(^|\s)lẻ(\s|$)/.test(vi[key]) && !vi[key].includes('ngàn'), `${key}: ${vi[key]}`);
  }
  assert.equal(vi['num.105'], 'một trăm linh năm');
});

test('the children of the north say "bọn mình", and the children of the south "tụi mình" (#45)', () => {
  for (const key of ['loco.invite', 'loco.join', 'loco.other', 'loco.line', 'loco.out', 'loco.slow', 'rope.invite', 'rope.slow']) {
    assert.ok(!/tụi/i.test(vi[key]), key);
    assert.deepEqual(markedWords(vi[key]).map((w) => w.toLocaleLowerCase('vi')), ['bọn'], key);
  }
  assert.equal(localWord(speechTable(speech, 'south'), 'bọn'), 'tụi');
  assert.equal(localWord(speechTable(speech, 'south'), 'Bọn'), 'Tụi');
  assert.deepEqual(glossesOf(vi['loco.invite'], speechTable(speech, 'north')), []);
});
