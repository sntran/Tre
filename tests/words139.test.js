// Words and markers after the play test of #123–#134 (#139): the riddle and the ferry say how, the
// voice says each choice and each choice has its picture, a word comes with its line the first time,
// a side star says its own line, at most three markers stand on the edge, the minimap opens the map
// of the village with its people, and the first square of a court that does not start at one has
// its number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { createRiddles } from '../src/core/riddles.js';
import { createI18n } from '../src/core/i18n.js';
import { spokenOf } from '../src/core/voices.js';
import { wordList, freshWords } from '../src/core/words.js';
import { sideMarks, edgeFew, EDGE_MAX } from '../src/world/marks.js';
import { villageMapItems } from '../src/world/minimap.js';
import { namesOf } from '../src/core/naming.js';

const viDict = load('i18n/vi.json');
const enDict = load('i18n/en.json');
const vi = createI18n(viDict, 'vi');
const en = createI18n(enDict, 'en');

// A small world for the riddles: the hero, Bà, a chicken, and a duck.
function riddleRig() {
  const world = { entities: [
    { id: 'hero', position: { x: 20, z: 20 } },
    { id: 'npc:grandma', position: { x: 22, z: 20 } },
    { id: 'chicken:1', kind: 'chicken', position: { x: 60, z: 40 } },
    { id: 'duck:1', kind: 'duck', position: { x: 70, z: 40 } },
  ] };
  const said = [];
  const profile = {};
  const clock = { day: 0 };
  const r = createRiddles({
    data: load('data/world/riddles.json'), profile, world: () => world, map: () => ({ layers: { objects: [] } }),
    day: () => clock.day, minutes: () => 1030, busy: () => false,
    say: (id, key) => said.push(key), sound: () => {}, point: () => {}, walkTo: () => {}, rng: () => 0,
  });
  return { r, said, clock, world };
}

test('the first riddle says how to answer; after a riddle found alone, the next one does not; a tree has its own line', () => {
  const { r, said, clock, world } = riddleRig();
  r.tick(0.1);
  assert.deepEqual(said, ['riddle.ask.grandma.how']);
  assert.equal(vi.t('riddle.how.animal'), 'Cháu đoán ra thì đi tìm con vật đó, rồi chạm vào nó nhé.');
  // The child finds the chicken alone.
  assert.ok(r.tap(world.entities[2].position));
  said.length = 0;
  clock.day = 1;
  r.tick(0.1);
  assert.ok(said.includes('riddle.ask.grandma') && !said.some((k) => k.startsWith('riddle.how') || k.endsWith('.how')), said.join(', '));
  const riddles = load('data/world/riddles.json').riddles;
  for (const id of ['tre', 'chuoi', 'da']) assert.equal(riddles.find((x) => x.id === id).how, 'tree');
  assert.match(vi.t('riddle.how.tree'), /cây đó/);
});

test('the offer of the ferry ends with how to load, and a thing near the hero is on the button', () => {
  const ferry = load('data/world/puzzles.json').ferry;
  assert.equal(ferry.offer.at(-1), 'puzzle.ferry.how');
  assert.equal(vi.t('puzzle.ferry.how'), 'Cháu đứng cạnh một thứ, rồi bấm nút lớn để đưa nó lên đò. Bấm nút có hình con đò để qua sông.');
  assert.ok(en.has('puzzle.ferry.how'));
});

test('a talk with two choices: the voice says the line and then each choice in the voice of the hero, and the two choices have different pictures', () => {
  const data = { npcs: {}, friends: {}, voices: { speakers: {} } };
  const out = spokenOf({ speaker: 'teacher', textKey: 'dlg.teacher.practice.n1', choices: ['dlg.teacher.practice.n1.c1', 'dlg.teacher.practice.n1.c2'] }, data, { hero: { gender: 'boy' } });
  assert.deepEqual(out.map((x) => [x.key, x.voice, x.choice]), [['dlg.teacher.practice.n1', 'narrator', undefined], ['dlg.teacher.practice.n1.c1', 'boy', 0], ['dlg.teacher.practice.n1.c2', 'boy', 1]]);
  // Every node with two choices or more: a picture for each, all different, and each picture exists.
  const nodes = [];
  const walk = (o) => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') {
      if (Array.isArray(o.choices) && o.choices.length > 1) nodes.push(o.choices);
      Object.values(o).forEach(walk);
    }
  };
  for (const f of ['village', 'giong', 'prologue']) walk(load(`data/dialogue/${f}.json`));
  assert.ok(nodes.length >= 3);
  for (const choices of nodes) {
    const icons = choices.map((c) => c.icon);
    assert.ok(icons.every(Boolean), `${choices.map((c) => c.textKey)}: a picture for each choice`);
    assert.equal(new Set(icons).size, icons.length, `${icons}: different pictures`);
    for (const i of icons) assert.ok(existsSync(new URL(`../art/ui/${i}.svg`, import.meta.url)), `art/ui/${i}.svg`);
  }
});

// The lines of a talk in their order, as texts: [{ key, text }].
async function talkLines(story, grade, steps = null) {
  const s = load(`tests/stories/${story}.json`);
  const first = s.steps.findIndex((x) => x.read === true);
  const lines = [];
  await runHeadless({ ...s, profile: { ...s.profile, grade }, steps: steps ?? s.steps.slice(0, first + 1) }, {
    onSession: (x) => x.listen((e) => {
      if (e.type === 'open' && e.textKey) lines.push({ key: e.textKey, text: vi.t(e.textKey, e.params ?? {}) });
      if (e.type === 'call' && e.key) lines.push({ key: e.key, text: vi.t(e.key, e.params ?? {}) });
    }),
  });
  return lines;
}
// The words that the child hears in a list of lines, as the village shows them: each line, then the
// line of each word that it has for the first time (src/ui/dialogue.js, wordGloss).
function withWords(lines, flags = {}) {
  const list = wordList(viDict);
  const out = [];
  for (const l of lines) {
    const { say, seen } = freshWords(l.text, list, flags, l.key);
    for (const id of seen) flags[`word.${id}`] = true;
    out.push(l.key, ...say.map((w) => w.line));
  }
  return out;
}

test('a word comes with its line the first time: the marker of the woodcutter, the anvil at the level of the colors, and the shield in the raid', async () => {
  const list = wordList(viDict);
  assert.deepEqual(list.find((w) => w.id === 'tieuphu'), { id: 'tieuphu', line: 'word.tieuphu', forms: ['tiều phu'] });
  // The marker of the woodcutter: "Đi tìm anh tiều phu." and then the line of the word.
  const name = namesOf({ naming: load('data/world/naming.json'), npcs: load('data/npcs.json'), regions: load('data/world/regions.json') }, 'giong').woodcutter;
  const who = name ? vi.t(name.key, name.params) : 'anh tiều phu';
  const marker = vi.t('star.go.person', { who: who.charAt(0).toLocaleLowerCase('vi') + who.slice(1) });
  assert.match(marker, /tiều phu/);
  assert.deepEqual(withWords([{ key: 'star.go.person', text: marker }]), ['star.go.person', 'word.tieuphu']);
  // A second time: no line.
  const flags = {};
  withWords([{ key: 'star.go.person', text: marker }], flags);
  assert.deepEqual(withWords([{ key: 'star.go.person', text: marker }], flags), ['star.go.person']);
  // The shield in the raid of the fire.
  assert.deepEqual(withWords([{ key: 'raid.tool.fire', text: vi.t('raid.tool.fire') }]), ['raid.tool.fire', 'word.khien']);
  // The line of a word is the word heard, with no line after it.
  assert.deepEqual(withWords([{ key: 'word.tieuphu', text: vi.t('word.tieuphu') }]), ['word.tieuphu']);
  // In the talk of the smith at each grade, the first line with "đe" says what it is, or the line
  // of the word comes right after it; at the level of the colors the line of the bar says it.
  for (const grade of [1, 2, 3, 4, 5]) {
    const lines = await talkLines('trial-smith', grade);
    const heard = withWords(lines);
    const at = lines.findIndex((l) => /(^|[^\p{L}])đe([^\p{L}]|$)/u.test(l.text.toLocaleLowerCase('vi')));
    if (at < 0) continue;
    const told = / đe là /.test(lines[at].text.toLocaleLowerCase('vi'));
    const i = heard.indexOf(lines[at].key);
    assert.ok(told || heard[i + 1] === 'word.de', `grade ${grade}: ${lines[at].key} "${lines[at].text}" then ${heard[i + 1]}`);
    if (lines.some((l) => l.key === 'dlg.smith.trial.n3.color')) assert.equal(lines[at].key, 'dlg.smith.trial.n3.color', `grade ${grade}`);
    assert.equal(heard.filter((k) => k === 'word.de').length <= 1, true);
  }
  assert.match(vi.t('dlg.smith.trial.n3.color', { pieces: { key: 'num.3' } }), /Sắt nằm trên cái đe: đe là một cục sắt to và nặng\./);
});

test('the star of the pots says its own line and has no face of a person of the story', () => {
  const [m] = sideMarks([{ id: 'pz:mark:pots', look: 'mark-side', position: { x: 10, y: 4, z: 20 } }]);
  assert.notEqual(m.key, 'star.go.person');
  assert.equal(m.key, 'star.side.pots');
  assert.equal(m.who, null);
  assert.equal(m.by, 'healer');
  assert.equal(vi.t('star.side.pots', { who: 'bà lang' }), 'Bà lang ở giếng có một câu đố.');
});

test('at most three markers on the edge: the step of the story first, then the nearest', () => {
  const hero = { x: 0, y: 0 };
  const items = [3, 9, 1, 7, 2, 30].map((d, i) => ({ m: { x: d, y: 0, main: i === 5, id: `m${i}` } }));
  const few = edgeFew(items, hero);
  assert.equal(EDGE_MAX, 3);
  assert.deepEqual(few.map((x) => x.m.id), ['m5', 'm2', 'm4']);
});

test('a tap on the minimap opens the map of the village: the faces of the people, the stars, and the hero', async () => {
  const s = load('tests/stories/trial-scholar.json');
  let session = null;
  await runHeadless({ ...s, steps: [{ wait: 1 }] }, { onSession: (x) => { session = x; } });
  const hp = getEntity(session.state, 'hero').position;
  const hero = { x: hp.x / 2, y: hp.z / 2 };
  const people = session.persons().filter((p) => !getEntity(session.state, p.entity)?.hidden);
  const items = villageMapItems(hero, people, [{ x: hero.x + 5, y: hero.y - 3, id: 'star:1', who: 'teacher' }]);
  const faces = items.filter((i) => i.kind === 'person');
  assert.ok(faces.length >= 3, `the people: ${faces.map((f) => f.who).join(' ')}`);
  assert.ok(faces.some((f) => f.who === 'teacher'));
  assert.ok(!items.some((i) => i.kind === 'person' && people.find((p) => p.entity === i.id)?.kind !== 'npc'), 'only the people, not the enemies');
  assert.deepEqual(items.filter((i) => i.kind === 'hero').map((i) => [i.u, i.v]), [[0.5, 0.5]]);
  assert.equal(items.filter((i) => i.kind === 'star').length, 1);
  for (const i of items) assert.ok(i.u >= 0 && i.u <= 1 && i.v >= 0 && i.v <= 1);
  assert.ok(vi.has('ui.villageMap') && en.has('ui.villageMap'));
});

test('the first square of a court that starts above one has its number, the others have none, and the line says it', async () => {
  const { createFolk } = await import('../src/core/folk-session.js');
  const { createWorldState, addEntity } = await import('../src/core/world/state.js');
  const data = load('data/world/folkgames.json');
  for (const level of [1, 2]) {
    const world = createWorldState({ seed: 1 });
    addEntity(world, { id: 'hero', position: { x: -20, y: 0, z: 0, facing: 0 } });
    const said = [];
    const folk = createFolk({
      data, profile: {}, world: () => world, env: () => ({ places: { hopscotch: { x: 0, z: 0 }, 'hopscotch-to': { x: 10, z: 0 } }, groundY: () => 0 }),
      learner: () => ({ levelFor: () => level, unlocked: () => true, isMastered: () => false }),
      seed: () => 1, emit: () => {}, callout: (k, p) => said.push({ k, p }), command: () => {}, goTo: () => {}, skill: () => {},
      feastOn: () => false, practice: () => null, busy: () => false, day: () => 0, view: () => 0,
    });
    folk.mapStart();
    assert.ok(folk.join('loco'));
    for (let k = 0; k < 60; k++) folk.tick(0.1);
    const start = folk.stateOf().court[0];
    const court = getEntity(world, 'folk:court').folkCourt;
    if (start === 1) {
      assert.equal(court.first, null, 'a court from one has no number');
      assert.ok(!said.some((x) => x.k === 'loco.first'));
    } else {
      assert.equal(court.first, start, 'the number of the first square');
      assert.ok(court.squares.every((q) => !('label' in q) && !('n' in q)), 'the other squares have no number');
      const line = said.find((x) => x.k === 'loco.first');
      assert.ok(line, said.map((x) => x.k).join(', '));
      assert.equal(vi.t('loco.first', line.p), `Ô đầu tiên này là ô ${vi.t(`num.${start}`)}.`);
    }
  }
});
