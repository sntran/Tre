import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compress, decompress, crc32, toBase64Url, fromBase64Url, utf8Encode, utf8Decode } from '../src/core/codec.js';
import { createProfile, addItem, takeItems, applyLoss, lossLevel, addFriend, giveTitle, setFriendName, chosenGlossNames } from '../src/core/profile.js';
import {
  serialize, deserialize, exportCode, importCode, migrate, wrap, SaveError, SAVE_VERSION, SAVE_FORMAT, validate, replacedBy, LIMITS,
} from '../src/core/save.js';
import { createRng } from '../src/core/rng.js';
import { readFileSync } from 'node:fs';
import { heroPlace, setHeroPlace, saveWorld, loadWorld } from '../src/core/world/save.js';
import { load } from './helpers.js';

function sample() {
  const p = createProfile({ id: 'p1', name: 'Tí Sún', gender: 'girl', grade: 2, now: 1000 });
  addItem(p, 'coin', 12);
  p.flags['trial.smith.done'] = true;
  p.learning.skills['math.add.20'] = { p: 0.6, r: 1010, n: 5, c: 4 };
  return p;
}

test('compression gives back the same bytes', () => {
  const rng = createRng(42);
  const inputs = [
    new Uint8Array(0),
    utf8Encode('a'),
    utf8Encode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    utf8Encode('Thánh Gióng nhổ tre đánh giặc. '.repeat(200)),
    Uint8Array.from({ length: 5000 }, () => rng.int(0, 255)),
    Uint8Array.from({ length: 200000 }, () => rng.int(97, 100)),
  ];
  for (const input of inputs) assert.deepEqual(decompress(compress(input)), input);
});

test('compression makes repeated text smaller', () => {
  const input = utf8Encode(JSON.stringify(sample()).repeat(5));
  assert.ok(compress(input).length < input.length / 2);
});

test('base64url and CRC-32 work', () => {
  const bytes = Uint8Array.from([0, 1, 2, 250, 251, 252, 253]);
  for (let n = 0; n <= bytes.length; n++) assert.deepEqual(fromBase64Url(toBase64Url(bytes.slice(0, n))), bytes.slice(0, n));
  assert.equal(crc32(utf8Encode('123456789')), 0xcbf43926);
  assert.equal(utf8Decode(utf8Encode('Văn Miếu')), 'Văn Miếu');
});

test('save and load give the same profile', () => {
  const p = sample();
  assert.deepEqual(deserialize(serialize(p, 5)), p);
});

test('a bad save does not load', () => {
  assert.throws(() => deserialize('{nope'), SaveError);
  assert.throws(() => deserialize(JSON.stringify({ format: 'other', version: 1 })), SaveError);
  const newer = wrap(sample());
  newer.version = SAVE_VERSION + 1;
  assert.throws(() => deserialize(JSON.stringify(newer)), (e) => e.reason === 'newer');
  const broken = wrap({ ...sample(), grade: 'nine' });
  assert.throws(() => deserialize(JSON.stringify(broken)), (e) => e.reason === 'shape');
});

test('migrations change an old save into the current version', () => {
  // A test format with 3 versions. Version 1 had "gold". Version 2 calls it "coin".
  // Version 3 adds "machines".
  const migrations = {
    1: (p) => {
      const { gold, ...rest } = p;
      return { ...rest, inventory: { ...p.inventory, coin: gold } };
    },
    2: (p) => ({ ...p, machines: p.machines ?? [] }),
  };
  const v1 = sample();
  delete v1.machines;
  v1.gold = 7;
  const old = { format: SAVE_FORMAT, version: 1, savedAt: 0, profile: v1 };
  const done = migrate(old, { migrations, version: 3 });
  assert.equal(done.version, 3);
  assert.equal(done.profile.inventory.coin, 7);
  assert.equal(done.profile.gold, undefined);
  assert.deepEqual(done.profile.machines, []);
  // The input does not change.
  assert.equal(old.profile.gold, 7);
  // A missing migration is an error.
  assert.throws(() => migrate(old, { migrations: { 1: migrations[1] }, version: 3 }), (e) => e.reason === 'migration');
});

test('the version 2 migration keeps mastery and gives the hero a skin tone', () => {
  const v1 = sample();
  delete v1.hero.skin;
  v1.hero.face = 3;
  v1.learning.skills['math.add.10'] = { p: 0.97, r: 1100, n: 6, c: 6 };
  const done = migrate({ format: SAVE_FORMAT, version: 1, savedAt: 0, profile: v1 });
  assert.equal(done.version, SAVE_VERSION);
  const skills = done.profile.learning.skills;
  assert.equal(skills['math.add.10'].mastered, true);
  assert.equal(skills['math.add.20'].mastered, false);
  assert.equal(skills['math.add.20'].top, 0);
  assert.equal(skills['math.add.20'].recent, '');
  assert.equal(done.profile.hero.skin, 3);
});

test('the grade of a save comes from the grade configuration', () => {
  const grades = JSON.parse(readFileSync(new URL('../data/config/game.json', import.meta.url), 'utf8')).grades;
  for (const grade of [-1, 0, 1, 12]) {
    const p = createProfile({ id: 'g', name: 'A', grade });
    assert.equal(importCode(exportCode(p), { grades }).grade, grade);
  }
  const bad = createProfile({ id: 'g', name: 'A', grade: 13 });
  assert.throws(() => importCode(exportCode(bad), { grades }), (e) => e.reason === 'shape');
  const half = createProfile({ id: 'g', name: 'A', grade: 2.5 });
  assert.throws(() => importCode(exportCode(half)), (e) => e.reason === 'shape');
});

test('the migrations give Nghé to every player: at version 2 after the river, at version 5 always', () => {
  const v1 = sample();
  v1.flags = { 'river.calmed': true };
  v1.friends = ['song'];
  v1.party = ['song'];
  const done = migrate({ format: SAVE_FORMAT, version: 1, savedAt: 0, profile: v1 }).profile;
  assert.deepEqual(done.party, ['nghe', 'song']);
  assert.deepEqual(done.friends, ['nghe', 'song']);
  assert.equal(done.flags['friend.nghe'], true);
  // A save of version 4 with no Nghé gets Nghé first in the party.
  const v4 = sample();
  v4.flags = {};
  v4.friends = [];
  v4.party = [];
  const now = migrate({ format: SAVE_FORMAT, version: 4, savedAt: 0, profile: v4 }).profile;
  assert.deepEqual(now.party, ['nghe']);
  assert.deepEqual(now.friends, ['nghe']);
  assert.equal(now.flags['friend.nghe'], true);
  // Nghé already in the party: no second copy.
  const has = sample();
  assert.deepEqual(migrate({ format: SAVE_FORMAT, version: 4, savedAt: 0, profile: has }).profile.party, ['nghe']);
});

test('the version 3 migration moves the hero home on the new isometric map', () => {
  const v2 = sample();
  v2.place = { map: 'phu-dong', x: 16, y: 25 };
  const done = migrate({ format: SAVE_FORMAT, version: 2, savedAt: 0, profile: v2 }).profile;
  assert.deepEqual(heroPlace(done.world), { map: 'phu-dong', x: null, y: null });
  assert.equal(done.flags['trial.smith.done'], true, 'the story stays');
  // A place on the new map can have a fraction.
  const p = sample();
  setHeroPlace(p.world, 'phu-dong', 5.5, 13.25);
  assert.deepEqual(heroPlace(importCode(exportCode(p)).world), { map: 'phu-dong', x: 5.5, y: 13.25 });
});

test('the version 4 migration adds the game clock and the state of each map', () => {
  const v3 = sample();
  delete v3.world;
  delete v3.maps;
  v3.place = { map: 'phu-dong', x: 22.5, y: 40.2 };
  const done = migrate({ format: SAVE_FORMAT, version: 3, savedAt: 0, profile: v3 }).profile;
  assert.deepEqual(done.world.clock, { minutes: 420 });
  assert.deepEqual(done.maps, {});
  assert.deepEqual(heroPlace(done.world), { map: 'phu-dong', x: null, y: null });
  // The state of visited maps goes through the export code; bad values do not load.
  const p = sample();
  p.world.clock = { minutes: 5000.5 };
  p.maps = { 'phu-dong': { first: 420, last: 900, at: { x: 5.5, y: 13.3 }, things: { pot1: 'broken', plank: 3 } } };
  assert.deepEqual(importCode(exportCode(p)).maps, p.maps);
  const bad = sample();
  bad.maps = { 'phu-dong': { at: { x: 'far', y: 1 } } };
  assert.throws(() => importCode(exportCode(bad)), (e) => e.reason === 'shape');
  const badClock = sample();
  badClock.world.clock = { minutes: -5 };
  assert.throws(() => importCode(exportCode(badClock)), (e) => e.reason === 'shape');
});

test('the save keeps the state of every visited map, and the place on the last map', () => {
  const p = sample();
  p.maps = {
    'phu-dong': { first: 420, last: 1300, at: { x: 5.5, y: 13.3 }, things: { pot1: 'broken' } },
    'soc-son': { first: 900, last: 950, at: { x: 16, y: 7.4 }, things: {} },
    'trau-son': { first: 1000, last: 1100, at: { x: 12.5, y: 10.8 }, things: { trap1: 3 } },
    'road-thanglong': { first: 1200, last: 1250, at: { x: 1.5, y: 11.5 }, things: { ferry: true } },
  };
  setHeroPlace(p.world, 'road-thanglong', 1.5, 11.5);
  p.world.clock = { minutes: 1300 };
  const back = importCode(exportCode(p));
  assert.deepEqual(back.maps, p.maps);
  assert.deepEqual(heroPlace(back.world), { map: 'road-thanglong', x: 1.5, y: 11.5 });
  assert.equal(back.world.clock.minutes, 1300);
  // An old save of version 4 keeps its maps, its place, and its clock through the migrations.
  const v4 = structuredClone(p);
  delete v4.world;
  v4.place = { map: 'road-thanglong', x: 1.5, y: 11.5 };
  v4.clock = { minutes: 1300 };
  const old = migrate({ format: SAVE_FORMAT, version: 4, savedAt: 0, profile: v4 }).profile;
  assert.deepEqual(old.maps, p.maps);
  assert.deepEqual(heroPlace(old.world), { map: 'road-thanglong', x: 1.5, y: 11.5 });
  assert.equal(old.world.clock.minutes, 1300);
  assert.equal(old.place, undefined);
  assert.equal(old.clock, undefined);
});

test('the version 6 save keeps the world state: the seed, the map, the clock, and the kept entities', async () => {
  const { createTileMap } = await import('../src/core/tilemap.js');
  const { envFor } = await import('../src/core/world/env.js');
  const { addHero, addFriend, syncPeople, addDucks } = await import('../src/core/world/populate.js');
  const { step, STEP } = await import('../src/core/world/step.js');
  const { command } = await import('../src/core/world/state.js');
  const tiles = load('data/tiles.json').types;
  const map = load('data/maps/phu-dong.json');
  const env = envFor(createTileMap(map, tiles));
  // Build a world, play it, and save it.
  const make = (w) => {
    if (!w.entities.some((e) => e.id === 'hero')) addHero(w, env, map.spawn);
    addFriend(w, env, 'nghe');
    syncPeople(w, map, env, () => true);
    addDucks(w, map, env, load('data/world/life.json'));
    return w;
  };
  const p = sample();
  const world = make(loadWorld(p.world));
  command(world, { type: 'move', id: 'hero', dx: 1, dz: 0.5, strength: 1 });
  for (let i = 0; i < 60; i++) step(world, STEP, env);
  command(world, { type: 'walk', id: 'hero', points: [{ x: 10, z: 10 }], token: 'x' });
  step(world, STEP, env);
  p.world = saveWorld(world);
  assert.deepEqual(p.world.entities.map((e) => e.id), ['hero'], 'only the kept entities');
  assert.equal(p.world.entities[0].route, undefined, 'no route in the save');
  // Load it again (through the export code): the kept entities and the generated ones are the same.
  const back = importCode(exportCode(p));
  const again = make(loadWorld(back.world));
  const kept = (w) => w.entities.filter((e) => e.keep).map((e) => { const x = structuredClone(e); delete x.route; delete x.intent; return x; });
  assert.deepEqual(kept(again), kept(world));
  // The generated entities come again from the map and the seed: the same ids, and the same
  // start each time.
  const made = (w) => w.entities.filter((e) => !e.keep);
  assert.deepEqual(made(again).map((e) => e.id), made(world).map((e) => e.id));
  assert.deepEqual(made(again), made(make(loadWorld(back.world))));
  assert.deepEqual(again.clock, world.clock);
  assert.equal(again.seed, world.seed);
  // A bad entity does not load.
  const bad = sample();
  bad.world.entities.push({ id: 'x', position: { x: 'far', y: 0, z: 0 } });
  assert.throws(() => importCode(exportCode(bad)), (e) => e.reason === 'shape');
  const deep = sample();
  deep.world.entities.push({ id: 'y', a: { b: { c: { d: { e: { f: { g: { h: 1 } } } } } } } });
  assert.throws(() => importCode(exportCode(deep)), (e) => e.reason === 'shape');
});

test('the export code loads on another device', () => {
  const p = sample();
  const code = exportCode(p, 99);
  assert.match(code, /^TRE1-[A-Za-z0-9_-]+-[0-9a-f]{8}$/);
  assert.deepEqual(importCode(code), p);
  // Spaces and line breaks from a copy are removed.
  assert.deepEqual(importCode(code.replace(/(.{20})/g, '$1\n ')), p);
});

test('a changed export code does not load', () => {
  const code = exportCode(sample());
  const i = 12;
  const changed = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
  assert.throws(() => importCode(changed), (e) => e.reason === 'checksum');
  assert.throws(() => importCode('HELLO-abc-123'), (e) => e.reason === 'prefix');
  assert.throws(() => importCode('TRE1-ab$c-00000000'), SaveError);
});

test('profile items, friends, titles, and loss rules', () => {
  const p = sample();
  assert.equal(takeItems(p, { coin: 20 }), false);
  assert.equal(takeItems(p, { coin: 2 }), true);
  assert.equal(p.inventory.coin, 10);
  assert.equal(addFriend(p, 'song'), true);
  assert.equal(addFriend(p, 'song'), false);
  assert.deepEqual(p.party, ['nghe', 'song'], 'Nghé is always the first friend');
  assert.equal(giveTitle(p, 'tu-tai', 1, 5), true);
  assert.equal(p.stele[0].name, 'Tí Sún');

  const rules = { small: { share: 0.1, max: 3 }, normal: { share: 0.25, max: 10 } };
  assert.equal(lossLevel(p), 'small');
  const lost = applyLoss(p, 'small', rules, ['coin', 'iron']);
  assert.deepEqual(lost, { coin: 1 });
  assert.deepEqual(p.friends, ['nghe', 'song']);
  assert.deepEqual(p.titles, ['tu-tai']);

  const g1 = createProfile({ id: 'g1', name: 'An', grade: 1 });
  assert.equal(lossLevel(g1), 'none');
  g1.settings.loss = 'normal';
  assert.equal(lossLevel(g1), 'normal');
});

// A profile with each kind of data: learning entries, exams, and parent questions with pictures.
function fullProfile() {
  const p = sample();
  p.learning.skills['math.add.10'] = { p: 0.97, r: 1100, n: 12, c: 11, streak: 5, box: 2, due: 5, last: 4, top: 3, recent: '1111101111', mastered: true };
  p.learning.items['math.add.10#3'] = 950.5;
  p.learning.exams.push({ kind: 'era1', at: 3, ability: 1012, asked: 12, correct: 9, passed: true });
  p.learning.recent = ['q.states.boil'];
  p.quests.trials = 'five';
  p.machines = ['iron-horse'];
  p.settings.questions.push(
    { id: 'parent-1', skill: 'math.add.10', lang: 'vi', type: 'numeric', text: '3 + 4 = ?', answer: 7, parent: true, visual: { type: 'dots', groups: [3, 4] } },
    { id: 'parent-2', skill: 'math.shapes', lang: 'en', type: 'choice', text: 'Which one?', choices: ['a', 'b', 'c'], answer: 0, parent: true, visual: { type: 'fractions', values: [[1, 2], [1, 4]] } },
  );
  return p;
}

test('the import checks the type of each value of the profile', () => {
  assert.equal(validate(fullProfile()), true);
  assert.deepEqual(importCode(exportCode(fullProfile())), fullProfile());
  const bad = [
    (p) => { p.learning.skills['math.add.10'].p = 'high'; },
    (p) => { p.learning.skills['math.add.10'].p = 2; },
    (p) => { p.learning.skills['math.add.10'].n = -1; },
    (p) => { p.learning.skills['math.add.10'].c = 99; },
    (p) => { p.learning.skills['math.add.10'].recent = '11x'; },
    (p) => { p.learning.skills['math.add.10'].mastered = 'yes'; },
    (p) => { p.learning.items['math.add.10#3'] = 'x'; },
    (p) => { p.learning.exams[0].ability = null; },
    (p) => { p.settings.lang = 'fr'; },
    (p) => { p.settings.timeLimit = -5; },
    (p) => { p.settings.sound = 'on'; },
    (p) => { p.settings.loss = 'all'; },
    (p) => { p.settings.questions = 'none'; },
    (p) => { p.settings.questions[0].text = ''; },
    (p) => { p.settings.questions[0].text = 'x'.repeat(LIMITS.questionChars + 1); },
    (p) => { p.settings.questions[0].answer = 'seven'; },
    (p) => { p.settings.questions[1].choices = ['only one']; },
    (p) => { p.settings.questions[1].answer = 5; },
    (p) => { p.settings.questions[1].type = 'essay'; },
    (p) => { p.settings.questions[0].lang = 'xx'; },
    (p) => { p.hero.gender = 'dragon'; },
    (p) => { p.hero.name = 'x'.repeat(LIMITS.nameChars + 1); },
    (p) => { p.inventory.coin = -3; },
    (p) => { p.inventory.coin = 1.5; },
    (p) => { p.flags.x = { deep: true }; },
    (p) => { p.titles = [42]; },
    (p) => { p.time.usedMs = 'long'; },
    (p) => { p.quests.trials = { step: 2 }; },
    (p) => { p.quests.trials = 'x'.repeat(LIMITS.idChars + 1); },
    (p) => { p.quests.trials = Infinity; },
    (p) => { p.quests = []; },
    (p) => { p.machines = 'horse'; },
    (p) => { p.machines = [7]; },
    (p) => { p.machines = ['']; },
    (p) => { p.machines = Array(LIMITS.listItems + 1).fill('horse'); },
  ];
  bad.forEach((change, i) => {
    const p = fullProfile();
    change(p);
    assert.throws(() => validate(p), (e) => e.reason === 'shape', `case ${i}`);
  });
});

test('the pictures of parent questions have a size limit', () => {
  const tooBig = [
    { type: 'array', rows: 1000, cols: 1000 },
    { type: 'dots', groups: [500] },
    { type: 'dots', groups: [1, 1, 1, 1, 1] },
    { type: 'rect', w: 5, h: 999 },
    { type: 'rect', w: '<b>5</b>', h: 2 },
    { type: 'fractions', values: [[1, 1000]] },
    { type: 'fractions', values: [[3, 2]] },
    { type: 'shape', shape: 'star' },
    { type: 'image', src: 'x.png' },
  ];
  for (const visual of tooBig) {
    const p = fullProfile();
    p.settings.questions[0].visual = visual;
    assert.throws(() => validate(p), (e) => e.reason === 'shape', JSON.stringify(visual));
  }
  const ok = fullProfile();
  ok.settings.questions[0].visual = { type: 'array', rows: LIMITS.visual.arrayCells, cols: 3 };
  assert.equal(validate(ok), true);
});

test('a code that is too long does not load', () => {
  assert.throws(() => importCode(`TRE1-${'A'.repeat(LIMITS.codeChars)}-00000000`), (e) => e.reason === 'size');
  assert.throws(() => deserialize('x'.repeat(LIMITS.jsonChars + 1)), (e) => e.reason === 'size');
});

test('the import finds the profile on this device that it replaces', () => {
  const here = [{ id: 'p1', name: 'Tí' }, { id: 'p2', name: 'Tèo' }];
  assert.equal(replacedBy({ id: 'p2' }, here).name, 'Tèo');
  assert.equal(replacedBy({ id: 'p3' }, here), null);
});

test('the decompressed data has a size limit', () => {
  const packed = compress(utf8Encode('a'.repeat(5000)));
  assert.equal(decompress(packed).length, 5000);
  assert.throws(() => decompress(packed, 1000));
});

test('the player names a friend; the texts use the chosen name', () => {
  const p = createProfile({ id: 'n', name: 'Mai' });
  const friends = { nghe: { gloss: 'nghecalf' }, song: { gloss: 'song' } };
  assert.equal(setFriendName(p, 'nghe', '  Mít   con  ', 12), 'Mít con');
  assert.equal(setFriendName(p, 'song', 'x'.repeat(30), 12), 'x'.repeat(12));
  assert.deepEqual(chosenGlossNames(p, friends), { nghecalf: 'Mít con', song: 'x'.repeat(12) });
  // An empty name keeps the usual name.
  assert.equal(setFriendName(p, 'song', '   '), null);
  assert.deepEqual(chosenGlossNames(p, friends), { nghecalf: 'Mít con' });
  assert.equal(importCode(exportCode(p)).friendNames.nghe, 'Mít con');
  const bad = createProfile({ id: 'n', name: 'Mai' });
  bad.friendNames = { nghe: 42 };
  assert.throws(() => importCode(exportCode(bad)), (e) => e.reason === 'shape');
});
