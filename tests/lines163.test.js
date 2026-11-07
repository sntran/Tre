// The lines that are true and clear (#163): Gióng says "bạn" and "mình" after the growth and
// baby Gióng calls the hero "anh" or "chị", a talk always talks, a star line names its target one
// time, a word line comes one time, the thuồng luồng is told first, the mother says what is still
// to do, the farmer counts the ducks, the tests turn the answers too, the messenger names each
// kind that went well, and the smith says that steel is iron.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { runHeadless, data } from './story-run.js';
import { questMark } from '../src/core/clues.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';
import { starOf } from '../src/core/quests.js';
import { wordList, freshWords, wordsOfLine } from '../src/core/words.js';
import { strengths } from '../src/core/exam.js';
import { pickTalk } from '../src/core/game.js';

const vi = load('i18n/vi.json');
const raids = load('data/raids.json');
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// The text keys of the lines of a speaker in the dialogue data.
function linesOf(speaker) {
  const out = new Set();
  for (const f of readdirSync(new URL('../data/dialogue/', import.meta.url))) {
    const walk = (o) => {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') {
        if (o.nodes) for (const n of Object.values(o.nodes)) if (speaker.test(n.speaker ?? '')) out.add(n.textKey);
        Object.values(o).forEach(walk);
      }
    };
    walk(JSON.parse(readFileSync(new URL(`../data/dialogue/${f}`, import.meta.url), 'utf8')));
  }
  return [...out];
}

test('no line of Gióng says "cháu" or "ta"; baby Gióng calls the hero "anh" or "chị"', () => {
  const keys = [...linesOf(/^giong/), 'giong.raid.ahead'];
  assert.ok(keys.length > 8);
  for (const k of keys) {
    assert.ok(!/\b[Cc]háu\b/.test(vi[k] ?? ''), `${k}: ${vi[k]}`);
    assert.ok(!/(^|\s)[Tt]a\s/.test((vi[k] ?? '').replace(/[Cc]húng ta/g, '')), `${k}: ${vi[k]}`);
  }
  for (const k of ['dlg.giong.speaks.n3', 'dlg.giong.wait.n1']) assert.match(vi[k], /\{older\}/, k);
  assert.equal(vi['address.older.boy'], 'anh');
  assert.equal(vi['address.older.girl'], 'chị');
  assert.match(src('src/ui/app.js'), /older: \{ key: `address\.older\.\$\{profile\.hero\.gender === 'girl' \? 'girl' : 'boy'\}` \}/);
});

test('a press of the talk at a person of the way who walked out of reach: the person stops, turns to the hero, and says a line', async () => {
  const s = load('tests/stories/way-trau-son.json');
  let session = null;
  const said = [];
  const failures = await runHeadless({ ...s, steps: s.steps }, { onSession: (x) => {
    session = x;
    x.listen((e) => { if (e.type === 'open' && e.textKey) said.push({ id: e.id, key: e.textKey }); });
  } });
  assert.deepEqual(failures.map((f) => f.message), []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const hero = getEntity(session.state, 'hero');
  // The way to the first person of the way (the star of the way).
  const soldier = load('data/maps/trau-son.json').encounters.find((e) => e.id === 'soldier1');
  const [sx, sy] = data.world.at('trau-son', soldier.x, soldier.y);
  const spotOf = (id) => {
    const e = getEntity(session.state, `way:${id}`);
    return e ? { x: e.position.x / 2, y: e.position.z / 2 } : null;
  };
  let way = null;
  for (let k = 0; k < 6 && !way; k++) {
    const c = { x: hero.position.x / 2, y: hero.position.z / 2 };
    const m = questMark(data.clues, data.world.at, session.profile.flags, { x: sx, y: sy, h: 3 }, c, spotOf);
    session.command({ type: 'tap', target: { ground: { x: m.x, y: m.y, h: 3, thing: false, object: null, goal: true } } });
    for (let i = 0; i < 30 * 90 && (hero.route || session.screen); i++) run(STEP);
    run(2);
    way = query(session.state, 'person').find((e) => e.person.kind === 'way' && Math.hypot(e.position.x - hero.position.x, e.position.z - hero.position.z) < 10) ?? null;
  }
  assert.ok(way, 'a person of the way');
  // The hero next to the person, and the button shows the talk.
  Object.assign(hero.position, { x: way.position.x + 3, z: way.position.z });
  delete hero.route;
  session.command({ type: 'tap', target: { person: way.id } });
  run(2);
  const a = session.action();
  assert.equal(a?.act, 'talk');
  // The person walks a little away, out of reach, before the press.
  Object.assign(way.position, { x: way.position.x - 9 });
  run(0.2);
  const from = said.length;
  session.command({ type: 'hands', id: a.id });
  run(1.5);
  assert.ok(said.slice(from).some((l) => l.id === way.id), said.slice(from).map((l) => l.key).join(', '));
  assert.ok((way.talkStop ?? 0) > session.state.tick, 'the person stops');
});

test('the star of a thing names it: the iron ore, the soldiers, the thuồng luồng; a star says its line one time', () => {
  const raidOf = (enc) => ({ soldier1: 'soldier1', river: 'river' }[enc] ?? enc);
  const ore = starOf({ object: 'ore2' }, 0, [], { raids, raidOf });
  assert.equal(ore.key, 'star.go.find');
  assert.equal(vi[ore.key].replace('{thing}', vi[ore.name]), 'Đi tìm quặng sắt.');
  const river = Object.entries(raids.raids).find(([, r]) => r.creature === 'thuongluong')?.[0];
  const serpent = starOf({ encounter: river }, 0, [], { raids, raidOf });
  assert.equal(vi[serpent.key].replace('{thing}', vi[serpent.name]), 'Đi tới chỗ thuồng luồng.');
  const soldiers = Object.entries(raids.raids).find(([, r]) => (r.waves ?? r.phases?.[0]?.waves ?? []).some((w) => w.kind === 'soldier'))?.[0];
  const sold = starOf({ encounter: soldiers }, 0, [], { raids, raidOf });
  assert.equal(vi[sold.key].replace('{thing}', vi[sold.name]), 'Đi tới chỗ lính quân Ân.');
  assert.equal(sold.target, soldiers);
  const say = src('src/ui/village.js');
  const fn = say.slice(say.indexOf('function sayStar'), say.indexOf('function sayStar') + 600);
  assert.match(fn, /if \(starSaid\.has\(once\)\) return;/);
});

test('a word line comes one time: the word of the card of a line is heard with it, and the gloss does not say it again; "tiều phu" is said with words that a child knows', () => {
  const words = wordList(vi);
  const flags = {};
  for (const id of wordsOfLine(words, 'word.ore.what')) flags[`word.${id}`] = true;
  const { say } = freshWords(vi['dlg.giong.speaks.n3'], words, flags, 'dlg.giong.speaks.n3');
  assert.ok(!say.some((w) => w.line === 'word.ore.what'), say.map((w) => w.id).join(', '));
  assert.match(src('src/ui/dialogue.js'), /if \(line\.word\?\.textKey\) markWordLine\(ctx, line\.word\.textKey\);\n\s+const gloss = glossLine/);
  assert.equal(vi['word.tieuphu'], 'Tiều phu là người chặt cây trong rừng.');
});

test('the raid of the river says what a thuồng luồng is at its first intro, at every grade, before "chỗ lội"', async () => {
  for (const grade of [1, 4]) {
    const s = load('tests/stories/raid-river.json');
    const upto = s.steps.findIndex((x) => x.read === true);
    const said = [];
    const failures = await runHeadless({ ...s, profile: { ...s.profile, grade }, steps: s.steps.slice(0, upto + 1) }, { onSession: (x) => {
      x.listen((e) => { if (e.type === 'open' && e.textKey) said.push(e.textKey); });
    } });
    assert.deepEqual(failures.map((f) => f.message), []);
    const t = said.indexOf('word.thuongluong');
    assert.ok(t >= 0, `grade ${grade}: ${said.join(', ')}`);
    const c = said.indexOf('word.choloi');
    assert.ok(c === -1 || c > t, 'before chỗ lội');
  }
  assert.equal(vi['word.thuongluong'], 'Thuồng luồng là con vật sống dưới sông trong truyện xưa.');
});

test('before the iron horse, the mother of Gióng says what is still to do; the thanks come after the forge', () => {
  const npcs = load('data/npcs.json').npcs;
  const before = pickTalk(npcs.mother, { flags: { 'giong.messenger': true, 'giong.spoke': true }, grade: 2 });
  assert.equal(before, 'mother.iron');
  assert.match(vi['dlg.mother.iron.n1'], /Bác thợ rèn còn cần sắt/);
  const after = pickTalk(npcs.mother, { flags: { 'giong.messenger': true, 'giong.spoke': true, 'horse.forged': true, 'giong.grown': true }, grade: 2 });
  assert.equal(after, 'mother.idle');
});

test('each duck in the pen gives a line of the farmer with the count', async () => {
  const s = load('tests/stories/event-duck.json');
  const said = [];
  const failures = await runHeadless(s, { onSession: (x) => {
    x.listen((e) => { if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, params: e.params ?? {} }); });
  } });
  assert.deepEqual(failures.map((f) => f.message), []);
  const counts = said.filter((l) => /^event\.duck\.(count|all)/.test(l.key));
  assert.ok(counts.length >= 2, said.map((l) => l.key).join(', '));
  assert.equal(vi['event.duck.count'], '{n} con rồi. Còn {m} con.');
});

test('the messenger names each kind of question that went well, and the EN button turns the answers too', () => {
  const items = [
    { skill: 'math.frac.unit', correct: true, rating: 900 }, { skill: 'math.frac.unit', correct: true, rating: 910 },
    { skill: 'math.mul.10', correct: true, rating: 800 }, { skill: 'math.mul.10', correct: true, rating: 820 },
    { skill: 'math.dec.add', correct: true, rating: 1000 }, { skill: 'math.dec.add', correct: true, rating: 1010 },
  ];
  const r = strengths({ items }, []);
  assert.deepEqual(new Set(r.goods), new Set(['math.frac.unit', 'math.mul.10', 'math.dec.add']));
  assert.match(src('src/ui/vanmieu.js'), /goods\.length > 1 \? goods\.map\(\(id\) => skillWords\(id\)\)/);
  const q = src('src/ui/question.js');
  assert.match(q, /span\.textContent = choiceOther\(problem\.choices\?\.\[i\]\);/);
});

test('at grade 5 the smith says that the steel is iron, and gives what the counter counts', () => {
  assert.equal(vi['smith.gift.steel'], 'Thép cũng là sắt. Bác cho cháu {n} thanh sắt để làm ngựa sắt.');
  assert.equal(vi['smith.gift'], 'Bác cho cháu {n} thanh sắt để làm ngựa sắt.');
});
