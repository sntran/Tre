// The names of the people by the region, the era, and the age (#38, #41): data/world/naming.json,
// the way of naming of each region, and src/core/naming.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { orderWord, personName, wayOf, namesOf, nameGlosses, talkGloss } from '../src/core/naming.js';
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
  // Every word of kinship has a text in both languages, with the word after it.
  for (const k of Object.keys(naming.kin)) for (const i18n of [vi, en]) assert.match(i18n.raw(`kin.${k}`) ?? '', /\{word\}/, k);
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
  assert.equal(en.t('hamlet.point.ducks', { who: n['duck-girl'] }), 'Chị Hến, the duck girl, needs help to feed the ducks at the pond.');
});

const sayAll = (i18n, names) => Object.fromEntries(Object.entries(names).map(([id, p]) => [id, say(i18n, p)]));

test('Xóm Ruộng in the north: Cô Năm, Chị Hến, Chú Tư, and Ông Dương; in a region of the south the same people are Cô Sáu, Chị Tư, Chú Năm, and Ông Hai', () => {
  const hamlet = ['planter', 'duck-girl', 'fisher-uncle', 'drummer'];
  const only = (all) => Object.fromEntries(hamlet.map((id) => [id, all[id]]));
  const n = namesOf({ npcs: { npcs }, regions, naming }, 'giong');
  assert.deepEqual(sayAll(en, only(n)), { planter: 'Cô Năm', 'duck-girl': 'Chị Hến', 'fisher-uncle': 'Chú Tư', drummer: 'Ông Dương' });
  assert.equal(vi.t('npc.hamlet-head.name'), 'Bà trưởng xóm');
  assert.equal(vi.t('hamlet.greet', { planter: n.planter, duckGirl: n['duck-girl'], fisherUncle: n['fisher-uncle'], drummer: n.drummer }), 'Chào cháu! Ở xóm này ai cũng có việc cần cháu giúp: cô Năm, chị Hến, chú Tư và ông Dương.');
  const s = namesOf({ npcs: { npcs }, regions, naming }, 'gia-dinh');
  assert.deepEqual(sayAll(en, only(s)), { planter: 'Cô Sáu', 'duck-girl': 'Chị Tư', 'fisher-uncle': 'Chú Năm', drummer: 'Ông Hai' });
});

test('a person with no field for the rule of the age gets the order: an elder with no child, a young person with no own name', () => {
  assert.equal(say(vi, personName({ kin: 'ong', order: 2, age: 'elder' }, 'north', naming)), 'ông Hai');
  assert.equal(say(vi, personName({ kin: 'chi', order: 3, age: 'young' }, 'north', naming)), 'chị Ba');
  assert.equal(say(vi, personName({ kin: 'chu', order: 4 }, 'north', naming)), 'chú Tư', 'no age: the order');
  assert.equal(say(vi, personName({ kin: 'ong', order: 2, age: 'elder', child: 'Dương' }, 'north', naming)), 'ông Dương');
  assert.equal(say(vi, personName({ kin: 'chi', order: 3, age: 'young', name: 'Hến' }, 'north', naming)), 'chị Hến');
});

test('no two people of one place have the same name: the south adds the name of the first child after the order, the north uses the name of the first child', () => {
  for (const r of regions.regions) {
    const said = Object.values(namesOf({ npcs: { npcs }, regions, naming }, r.id)).map((p) => say(vi, p));
    assert.equal(new Set(said).size, said.length, `${r.id}: ${said.join(', ')}`);
  }
  const twins = { a: { kin: 'chi', order: 1, age: 'grown', child: 'Tùng' }, b: { kin: 'chi', order: 1, age: 'grown', child: 'Lan' }, c: { kin: 'chu', order: 1, age: 'grown' } };
  assert.deepEqual(sayAll(vi, namesOf({ npcs: { npcs: twins }, regions, naming }, 'gia-dinh')), { a: 'chị Hai Tùng', b: 'chị Hai Lan', c: 'chú Hai' });
  assert.deepEqual(sayAll(vi, namesOf({ npcs: { npcs: twins }, regions, naming }, 'giong')), { a: 'chị Tùng', b: 'chị Lan', c: 'chú Cả' });
});

test('the gloss of a name shows one time, in English only', () => {
  const n = namesOf({ npcs: { npcs }, regions, naming }, 'giong');
  const seen = [];
  const four = [n.planter, n['duck-girl'], n['fisher-uncle'], n.drummer];
  assert.deepEqual(nameGlosses(four, seen, en), [
    'Cô Năm: the fifth child of her family.',
    'Chị Hến: a young person is called by her own small name, Hến.',
    'Chú Tư: the fourth child of his family.',
    'Ông Dương: an old man is called by the name of his first child, Dương.',
  ]);
  assert.deepEqual(nameGlosses(four, seen, en), [], 'one time for each name');
  assert.deepEqual(nameGlosses(four, [], vi), [], 'no gloss in Vietnamese');
  // In the south, the same old man has another name, and so another gloss.
  const s = namesOf({ npcs: { npcs }, regions, naming }, 'gia-dinh');
  assert.deepEqual(nameGlosses([s.drummer], seen, en), ['Ông Hai: the first child of his family.']);
  const twin = personName({ kin: 'chi', order: 'youngest', child: 'Tùng' }, 'south', naming, 'order-child');
  assert.deepEqual(nameGlosses([twin], [], en), ['Chị Út Tùng: the youngest child of her family; her first child is Tùng.']);
  // Every gloss has a text in both languages, and the words of the order go to the tenth child.
  for (const rule of ['order', 'elder', 'child', 'own', 'order-child']) for (const pr of new Set(Object.values(naming.kin))) for (const i18n of [vi, en]) assert.ok(i18n.raw(`name.gloss.${rule}.${pr}`), `${rule}.${pr}`);
  for (const o of [...naming.ways.north.orders.keys()].map((i) => i + 1).concat('youngest')) assert.ok(en.raw(`ord.${o}`), o);
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
  assert.equal(line, 'Chào cháu! Ở xóm này ai cũng có việc cần cháu giúp: cô Năm, chị Hến, chú Tư và ông Dương.');
});

// The glosses of names one at a time (#42): the greeting of the hamlet names four people and shows
// no gloss, nor do the lines that point at the stations; the first line of the planter to the child
// has the gloss of Cô Năm, one gloss for the line; her next lines and a second talk have none.
test('the gloss of a name comes with the first line of that person to the child, one at a time; the greeting of the hamlet has none', async () => {
  const story = JSON.parse(readFileSync(new URL('./stories/practice-xom-ruong.json', import.meta.url)));
  const lines = [];
  const failures = await runHeadless(story, { onSession: (s) => s.listen((ev) => ev.type === 'open' && (ev.screen === 'callout' || ev.screen === 'dialogue') && lines.push(ev)) });
  assert.deepEqual(failures, []);
  const n = namesOf({ npcs: { npcs }, regions, naming }, 'giong');
  const speakerOf = (ev) => ev.speaker ?? ev.id?.replace(/^npc:/, '') ?? null;
  const seen = [];
  const glosses = lines.map((ev) => [ev.textKey, talkGloss({ ...ev, speaker: speakerOf(ev) }, n[speakerOf(ev)] ?? null, seen, en)]);
  const greet = glosses.find(([k]) => k === 'hamlet.greet');
  assert.ok(greet, 'the greeting');
  assert.equal(greet[1], null, 'the greeting has no gloss');
  for (const [k, g] of glosses.filter(([k]) => k.startsWith('hamlet.point.'))) assert.equal(g, null, `${k}: a line that names a person has no gloss`);
  // Each line shows at most one gloss, and only the head of the hamlet and the planter talked.
  assert.ok(glosses.filter(([, g]) => g).length <= 2, JSON.stringify(glosses.filter(([, g]) => g)));
  const talk = glosses.filter(([k]) => k.startsWith('dlg.planter.'));
  assert.equal(talk[0][1], 'Cô Năm: the fifth child of her family.', 'the first line of the first talk with the planter');
  assert.ok(talk.slice(1).every(([, g]) => g === null), 'the next lines have none');
  // A second talk with the planter: no gloss again.
  const first = { ...lines.find((ev) => ev.textKey === talk[0][0]), speaker: 'planter' };
  assert.equal(talkGloss(first, n.planter, seen, en), null, 'the second talk has none');
  // In Vietnamese, no gloss of a name.
  assert.equal(talkGloss(first, n.planter, [], vi), null);
  // A bubble of a person is a line to the child too: the first one has the gloss.
  assert.equal(talkGloss({ speaker: 'planter', params: { name: 'An' } }, n.planter, [], en), 'Cô Năm: the fifth child of her family.');
});

// The save keeps the glosses of the lines (the names of people and the words of a region) and the
// glossary names together (#42): before, the save kept only the glossary names, so that the gloss
// of a name came back after each save (a planter who counts aloud showed her gloss at each word).
test('the save keeps the glosses that the child saw in the lines, with the glossary names', async () => {
  const { joinSeen } = await import('../src/core/speech.js');
  const seen = joinSeen(['name:Cô Năm', 'mô'], ['nghecalf', 'mô']);
  assert.deepEqual(seen.sort(), ['mô', 'name:Cô Năm', 'nghecalf']);
  assert.deepEqual(joinSeen(undefined, ['nghecalf']), ['nghecalf']);
});

test('each person who can speak has a name in the two languages: a name of the region, or npc.<id>.name (#57)', () => {
  const speakers = new Set();
  for (const f of readdirSync('data/dialogue')) for (const d of load(`data/dialogue/${f}`).dialogues ?? []) for (const n of Object.values(d.nodes)) if (n.speaker) speakers.add(n.speaker);
  // The people of the small events (the seller of the market showed npc.seller.name, #57).
  for (const e of load('data/world/events.json').events) if (e.person) speakers.add(e.person);
  speakers.delete('hero'); // the name of the child
  const vi = load('i18n/vi.json');
  const en = load('i18n/en.json');
  const data = { regions: load('data/world/regions.json'), naming: load('data/world/naming.json'), npcs: load('data/npcs.json') };
  const named = namesOf(data, 'phu-dong');
  const missing = [...speakers].filter((s) => !named[s] && (!vi[`npc.${s}.name`] || !en[`npc.${s}.name`]));
  assert.deepEqual(missing, []);
});
