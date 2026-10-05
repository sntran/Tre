// The names of the people by the region and the era (#38): data/world/naming.json, the way of
// naming of each region, and src/core/naming.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { orderWord, personName, wayOf, namesOf } from '../src/core/naming.js';
import { createI18n } from '../src/core/i18n.js';
import { load } from './helpers.js';
import { runHeadless } from './story-run.js';

const naming = load('data/world/naming.json');
const regions = load('data/world/regions.json');
const npcs = load('data/npcs.json').npcs;
const vi = createI18n(load('i18n/vi.json'), 'vi');
const en = createI18n(load('i18n/en.json'), 'en');
const say = (i18n, p) => i18n.t(p.key, p.params);
// A word of kinship and an old name from the work (a name has a capital letter; "cô cấy" is "I plant").
const OLD = /(?<!\p{L})(?:[Cc]ô|[Cc]hị|[Cc]hú|[Ôô]ng|[Bb]à)\s+(?:Cấy|Vịt|Lưới|Trống)(?!\p{L})|(?<!\p{L})[Ôô]ng trống(?!\p{L})/u;

test('every region has a way of naming: north for the north and before the 18th century, south for the center and the south from then on', () => {
  for (const r of regions.regions) assert.ok(naming.ways[r.naming], `${r.id}: ${r.naming}`);
  assert.equal(wayOf(regions, 'giong'), 'north');
  for (const id of ['tay-son', 'gia-dinh']) assert.equal(wayOf(regions, id), 'south');
  for (const r of regions.regions.filter((x) => x.chapter <= 11)) assert.equal(r.naming, 'north', r.id);
  // Every word of kinship has a text in both languages, with the word of the order.
  for (const k of naming.kin) for (const i18n of [vi, en]) assert.match(i18n.raw(`kin.${k}`) ?? '', /\{order\}/, k);
});

test('the same person (ông, the first child) is Ông Cả in a region of the north and Ông Hai in a region of the south', () => {
  const ong = { kin: 'ong', order: 1 };
  assert.equal(vi.t('a', {}), 'a');
  assert.equal(say(vi, personName(ong, wayOf(regions, 'giong'), naming)), 'ông Cả');
  assert.equal(say(vi, personName(ong, wayOf(regions, 'tay-son'), naming)), 'ông Hai');
  assert.equal(say(en, personName(ong, 'north', naming)), 'Ông Cả');
  assert.equal(orderWord(naming, 'north', 'youngest'), 'Út');
  assert.equal(orderWord(naming, 'south', 4), 'Năm');
  // A name at the start of a line starts with a capital letter.
  const n = namesOf({ npcs: { npcs }, regions, naming }, 'giong');
  assert.equal(vi.t('hamlet.point.planting', { who: n.planter }), 'Cô Năm ngoài đồng đang cần người mang mạ đấy.');
  assert.equal(en.t('hamlet.point.ducks', { who: n['duck-girl'] }), 'Chị Ba, the duck girl, needs help to feed the ducks at the pond.');
});

test('Xóm Ruộng: Cô Năm, Chị Ba, Chú Tư, and Ông Cả; the head of the hamlet stays Bà trưởng xóm', () => {
  const n = namesOf({ npcs: { npcs }, regions, naming }, 'giong');
  assert.deepEqual(Object.fromEntries(Object.entries(n).map(([id, p]) => [id, say(vi, p)])), { planter: 'cô Năm', 'duck-girl': 'chị Ba', 'fisher-uncle': 'chú Tư', drummer: 'ông Cả' });
  assert.equal(vi.t('npc.hamlet-head.name'), 'Bà trưởng xóm');
  assert.equal(vi.t('hamlet.greet', { planter: n.planter, duckGirl: n['duck-girl'], fisherUncle: n['fisher-uncle'], drummer: n.drummer }), 'Chào cháu! Ở xóm này ai cũng có việc cần cháu giúp: cô Năm, chị Ba, chú Tư và ông Cả.');
});

test('no text names a person Cấy, Vịt, Lưới, or Trống', () => {
  const files = ['i18n/vi.json', 'i18n/en.json', ...readdirSync('tests/stories').map((f) => `tests/stories/${f}`), ...readdirSync('data/dialogue').map((f) => `data/dialogue/${f}`)];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    assert.doesNotMatch(text, OLD, f);
  }
  for (const id of ['planter', 'duck-girl', 'fisher-uncle', 'drummer']) assert.equal(vi.raw(`npc.${id}.name`), null, `${id}: no name of work`);
});

test('in the game, the greeting of the hamlet names the people by the way of the region', async () => {
  let line = null;
  const story = {
    name: 'names', practice: 'xom-ruong',
    profile: { name: 'An', grade: 2, lang: 'vi', seed: 7, flags: {} },
    steps: [{ until: { event: 'open', with: { screen: 'callout', textKey: 'hamlet.greet' }, timeout: 5 } }],
  };
  const failures = await runHeadless(story, { onSession: (s) => s.listen((ev) => { if (ev.textKey === 'hamlet.greet' && ev.screen === 'callout') line = vi.t(ev.textKey, ev.params); }) });
  assert.deepEqual(failures, []);
  assert.equal(line, 'Chào cháu! Ở xóm này ai cũng có việc cần cháu giúp: cô Năm, chị Ba, chú Tư và ông Cả.');
});
