// Pictures and words after the play test of #140–#145 (#154): the print of a skill is a picture of
// the place where the child earned it, a word of a picture comes with its line, the new words have
// their lines, a star of a thing shows the thing, and the reason after "not learned yet" has the
// words of a child and a new picture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { load, skillsData, bank } from './helpers.js';
import { skillPrint } from '../src/core/notebook.js';
import { createI18n } from '../src/core/i18n.js';
import { wordList, freshWords } from '../src/core/words.js';
import { starOf, thingOf } from '../src/core/quests.js';
import { sideMarks } from '../src/world/marks.js';
import { createRng } from '../src/core/rng.js';
import { createSkillGraph } from '../src/core/skills.js';
import { generate } from '../src/core/generators.js';

const notebook = load('data/notebook.json');
const figures = load('data/figures.json').figures;
const viDict = load('i18n/vi.json');
const enDict = load('i18n/en.json');
const vi = createI18n(viDict, 'vi');
const en = createI18n(enDict, 'en');
const skills = load('data/skills.json').skills;
const raids = load('data/raids.json');

// The places that give skill events (the task of the skill event): from the data, and the pairs of
// skill and place of the stories (each first skill event of the stories, tests/stories).
const DATA_SOURCES = [
  ...load('data/trials.json').trials.map((t) => `trial-${t.id}`),
  'trial-ducks', 'trial-traps', 'trial-drum', 'trial-plant',
  ...load('data/world/events.json').events.map((e) => `trial-event-${e.id}`),
  ...Object.keys(raids.raids).map((id) => `raid-${id}`),
  'folk-loco', 'folk-rope',
  ...Object.keys(load('data/world/puzzles.json')).filter((k) => ['pots', 'ferry'].includes(k)).map((k) => `puzzle-${k}`),
  'bridge',
];
const STORY_PAIRS = [
  'math.add.10|trial-rice', 'math.add.20|bridge', 'math.add.20|raid-boss', 'math.add.20|raid-scouts', 'math.add.20|trial-event-cart',
  'math.add.20|trial-fisher', 'math.add.20|trial-woodcutter', 'math.count.120|raid-patrol', 'math.count.120|raid-river',
  'math.count.120|raid-scouts', 'math.count.120|raid-soldier1', 'math.count.120|raid-soldier2', 'math.count.120|trial-event-cart',
  'math.count.120|trial-event-duck', 'math.count.120|trial-event-flood', 'math.count.120|trial-healer', 'math.count.120|trial-horse',
  'math.count.120|trial-scholar', 'math.div.10|trial-scholar', 'math.div.10|trial-share', 'math.div.10|trial-traps',
  'math.mul.10|bridge', 'math.mul.10|trial-drum', 'math.mul.10|trial-ducks', 'math.mul.10|trial-event-market', 'math.mul.10|trial-plant',
  'math.mul.10|trial-scholar', 'math.place.1000|trial-scholar', 'math.shapes|trial-staffs', 'math.share.equal|trial-raid',
  'sci.matter.states|raid-boss', 'sci.matter.states|trial-horse', 'sci.matter.states|trial-smith',
].map((p) => p.split('|')).filter(([, task]) => task !== 'trial-raid');

test('for each place that gives skill events, in the data and in the stories, the print is a picture of that place, not the default of the skill', () => {
  const pairs = [...STORY_PAIRS];
  for (const task of DATA_SOURCES) for (const s of skills) pairs.push([s.id, task]);
  const sources = new Set(DATA_SOURCES);
  for (const [, task] of STORY_PAIRS) assert.ok(sources.has(task), `${task} is a place of the data`);
  for (const [id, task] of pairs) {
    const skill = skills.find((s) => s.id === id);
    assert.ok(skill, id);
    const print = skillPrint(notebook, skill, task);
    const own = notebook.skills[id];
    assert.notEqual(print.titleKey, own?.titleKey ?? `skill.${id}`, `${id} at ${task}: the default print`);
    assert.ok(figures[print.look], `${id} at ${task}: the look ${print.look}`);
    assert.ok(vi.has(print.titleKey) && en.has(print.titleKey), `${id} at ${task}: the title ${print.titleKey}`);
  }
  // The pictures of the play test: stones at the cart, bowls at the rice, stones of the slingshot.
  const sk = (id) => skills.find((s) => s.id === id);
  assert.equal(skillPrint(notebook, sk('math.count.120'), 'trial-event-cart').look, 'stones-5');
  assert.equal(skillPrint(notebook, sk('math.add.20'), 'trial-rice').look, 'bowls-5');
  assert.equal(skillPrint(notebook, sk('math.add.20'), 'raid-scouts').look, 'stones-2');
});

test('a word of the title of a picture that the child did not hear comes with its line', () => {
  const list = wordList(viDict);
  const dang = freshWords(vi.t('print.math.add.20'), list, {}, 'print.math.add.20');
  assert.deepEqual(dang.say.map((w) => w.id), ['dang']);
  const cart = freshWords(vi.t('print.from.trial-event-cart'), list, {}, 'print.from.trial-event-cart');
  assert.deepEqual(cart.say.map((w) => w.id), ['chen']);
  // A word that the child heard: no line again.
  assert.deepEqual(freshWords(vi.t('print.math.add.20'), list, { 'word.dang': true }).say, []);
});

const NEW_WORDS = ['chen', 'bay', 'khay', 'giap', 'roi', 'ongbe', 'dot', 'thuthach', 'sac', 'tau'];

test('each new word has its line and forms, and its line comes the first time that a line of the game has it', () => {
  for (const [dict, i18n] of [[viDict, vi], [enDict, en]]) {
    const list = wordList(dict);
    for (const id of NEW_WORDS) {
      const w = list.find((x) => x.id === id);
      assert.ok(w, `word.${id} in ${i18n.lang ?? 'a language'}`);
      assert.ok(w.forms.length > 0);
    }
  }
  // In Vietnamese, each word comes in a line of the game (a talk, a goal, a raid), and the first of
  // those lines brings the line of the word.
  const list = wordList(viDict);
  for (const id of NEW_WORDS) {
    const w = list.find((x) => x.id === id);
    const line = Object.entries(viDict).find(([key, text]) => !key.startsWith('word.') && !key.startsWith('print.') && typeof text === 'string' && freshWords(text, [w], {}, key).seen.length);
    assert.ok(line, `a line with the word ${id}`);
    const fresh = freshWords(line[1], list, {}, line[0]);
    assert.ok(fresh.say.some((x) => x.id === id) || / là /.test(line[1]), `${line[0]}: the line of ${id}`);
  }
  assert.equal(vi.t('word.tau'), 'Tâu là nói với nhà vua.');
});

test('a star of a thing shows the thing: the ore for a place of iron, the enemy for a raid, the pots for the puzzle of bà lang', () => {
  const encounters = {};
  for (const f of readdirSync(new URL('../data/maps/', import.meta.url))) {
    for (const e of load(`data/maps/${f}`).encounters ?? []) encounters[e.id] = e.raid ?? null;
  }
  const raidOf = (id) => encounters[id] ?? null;
  let things = 0;
  for (const q of load('data/quests.json').quests) {
    for (const step of q.steps ?? []) {
      for (const [i, tg] of (step.targets ?? []).entries()) {
        if (!tg.object && !tg.encounter) continue;
        const star = starOf(tg, i, [], { raids, raidOf });
        if (tg.npc) continue;
        assert.ok(star.thing && figures[star.thing], `${q.id}/${step.id}: the picture of ${tg.object ?? tg.encounter}: ${star.thing}`);
        things += 1;
      }
    }
  }
  assert.ok(things >= 4, `${things} stars of things`);
  assert.equal(thingOf({ object: 'ore1' }, raids, raidOf), 'ore');
  assert.equal(thingOf({ encounter: 'scouts' }, raids, raidOf), 'scout');
  assert.equal(starOf({ npc: 'smith' }).thing, null, 'a person has a face, not a thing');
  const pots = sideMarks([{ id: 'pz:mark:pots', look: 'mark-side', position: { x: 10, y: 4, z: 10 } }])[0];
  assert.equal(pots.thing, 'pot');
  assert.ok(figures[pots.thing]);
});

// The terms of the lessons: no reason after "not learned yet" has them ("cạnh" is in the name of a
// shape, "hình năm cạnh", and "tám phần mười" is a fraction in words, so they are not on the list).
const TERMS = {
  vi: ['tử số', 'mẫu số', 'diện tích', 'chu vi', 'dấu phẩy', 'đơn vị', 'hàng chục', 'hàng trăm', 'chữ số', 'thừa số', 'số bị chia', 'thương', 'tích'],
  en: ['numerator', 'denominator', 'area', 'perimeter', 'decimal point', 'ones', 'tens place', 'digit', 'tenths', 'product', 'quotient', 'factor', 'sides'],
};
const graph = createSkillGraph(skillsData);

test('for each kind of question of the exams, the reason after "not learned yet" has no term of the lesson and changes the picture', () => {
  const kinds = new Set();
  for (const skill of graph.all()) {
    if (skill.generator === 'bank' || !skill.id.startsWith('math.')) continue;
    for (let level = 1; level <= skill.levels.length; level++) {
      for (let run = 0; run < 6; run++) {
        const pr = generate(skill, level, createRng(`new:${skill.id}:${level}:${run}`), { bank, lang: 'vi', exam: true });
        kinds.add(pr.expr.op);
        assert.ok(pr.explainNew, `${skill.id} ${pr.expr.op}: a reason`);
        assert.ok(pr.visualNew, `${skill.id} ${pr.expr.op}: a picture`);
        assert.notDeepEqual(pr.visualNew, pr.visual, `${skill.id} ${pr.expr.op}: the same picture`);
        for (const [lang, i18n] of [['vi', vi], ['en', en]]) {
          const text = i18n.t(pr.explainNew.key, pr.explainNew.params).toLocaleLowerCase();
          assert.ok(!/\{/.test(text), `${skill.id}: ${text}`);
          for (const term of TERMS[lang]) assert.ok(!new RegExp(`(^|[^\\p{L}])${term}([^\\p{L}]|$)`, 'u').test(text), `${skill.id} ${pr.expr.op} (${lang}): "${term}" in "${text}"`);
        }
      }
    }
  }
  assert.ok(kinds.size >= 15, [...kinds].join(', '));
});

test('1/4 = ?/12 after "not learned yet": the bar of four parts is cut into twelfths, and the line says it in words', () => {
  const skill = graph.get('math.frac.equiv');
  let pr = null;
  for (let run = 0; run < 400 && !pr; run++) {
    const p = generate(skill, 2, createRng(`q:${run}`), { lang: 'vi' });
    if (p.expr.n === 1 && p.expr.d === 4 && p.expr.D === 12) pr = p;
  }
  assert.ok(pr, 'a question 1/4 = ?/12');
  assert.deepEqual(pr.visual.values, [[1, 4]]);
  assert.deepEqual(pr.visualNew.values, [[1, 4, 3]]);
  assert.equal(vi.t(pr.explainNew.key, pr.explainNew.params), 'Chia mỗi phần thành ba phần nhỏ: một phần tư là ba phần mười hai.');
  // The terms come only in the reason of a skill that the child learned.
  assert.match(vi.t(pr.explain.key, pr.explain.params), /tử số/);
});
