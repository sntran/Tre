// The test of the messenger after the play test of #134 (#136): at most 10 questions that a child
// gets right about seven times in ten, never two of one kind in a row, "not learned yet" as a choice,
// a result in words of the task with no grade, the grade on the parent page only (never above the
// top grade that has tasks), a rectangle that is never shorter than it is wide, and the calling with
// the line of the grade of the child.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { createSkillGraph } from '../src/core/skills.js';
import { expected, gradeBase } from '../src/core/rating.js';
import { gradeIds } from '../src/core/grades.js';
import { createExam, examLadder, examSkills, kindOf, strengths, placedGrade } from '../src/core/exam.js';
import { generate } from '../src/core/generators.js';
import { levelFor } from '../src/core/world/trials.js';
import { createI18n } from '../src/core/i18n.js';
import { skillsData, learningConfig as cfg, load } from './helpers.js';

const graph = createSkillGraph(skillsData);
const titles = load('data/titles.json');
const game = load('data/config/game.json');
const ladder = examLadder(examSkills(graph, titles.exams.placement, titles.titles), cfg.rating);
const settings = cfg.exam.subject;
const vi = createI18n(load('i18n/vi.json'), 'vi');
const en = createI18n(load('i18n/en.json'), 'en');

// A child who answers at the level of grade 3 takes the placement of grade 3 or 4.
function placement(grade, seed, truth = gradeBase(3, cfg.rating)) {
  const start = gradeBase(grade, cfg.rating) + cfg.exam.placement.startOffset;
  const exam = createExam({ ladder, settings, rng: createRng(`p136:${seed}`), start });
  const answers = createRng(`a136:${seed}`);
  const items = [];
  while (!exam.done) {
    const item = exam.next();
    const ok = answers.chance(expected(truth, item.rating));
    items.push({ ...item, ok });
    exam.answer(ok);
  }
  return { items, result: exam.result() };
}

test('a placement at grades 3 and 4 for a child of grade 3: at most 10 questions, about seven right in ten, never two of one kind in a row', () => {
  for (const grade of [3, 4]) {
    let right = 0;
    let asked = 0;
    for (let i = 0; i < 200; i++) {
      const { items } = placement(grade, `${grade}:${i}`);
      assert.ok(items.length <= 10, `${items.length} questions`);
      for (let k = 1; k < items.length; k++) assert.notEqual(kindOf(items[k].skill), kindOf(items[k - 1].skill), `two of one kind: ${items.map((x) => x.skill).join(' ')}`);
      right += items.filter((x) => x.ok).length;
      asked += items.length;
    }
    const share = right / asked;
    assert.ok(share >= 0.6 && share <= 0.8, `grade ${grade}: ${share.toFixed(2)} right`);
  }
});

test('each question uses the first level of its skill: the smallest numbers that still test the skill', () => {
  assert.ok(ladder.every((it) => it.level === 1));
  assert.equal(new Set(ladder.map((it) => it.skill)).size, ladder.length);
});

test('"not learned yet" counts as not known, with no guess, and the next question is easier', () => {
  const exam = createExam({ ladder, settings, rng: createRng('skip'), start: gradeBase(4, cfg.rating) });
  const first = exam.next();
  exam.answer(true, { skipped: true });
  const r = exam.result();
  assert.equal(r.correct, 0);
  assert.equal(r.skipped, 1);
  assert.equal(r.mistakes, 1);
  assert.equal(r.items[0].skipped, true);
  assert.ok(exam.next().rating <= first.rating, 'the next question is not harder');
});

test('after each answer the examiner says if it is right, and if not, the right answer; the button and its line come from the examiner', () => {
  for (const ex of titles.examiners) {
    for (const name of ['right', 'wrong', 'skip.button', 'skip.tell', 'skip.done', 'go', 'rule']) {
      const key = `${ex.lines}.${name}`;
      for (const i of [vi, en]) assert.ok(i.has(key), `${key} is missing`);
    }
    assert.match(vi.t(`${ex.lines}.wrong`, { answer: '42' }), /42/);
  }
  assert.equal(vi.t('exam.messenger.skip.button'), 'Cháu chưa học bài này.');
  assert.match(vi.t('exam.messenger.skip.tell'), /không sao cả/);
});

test('the result says what the child does well and what comes next, with no grade', () => {
  const { result } = placement(4, 'result');
  const { good, next } = strengths(result, ladder);
  assert.ok(good && next && good !== next, `good ${good}, next ${next}`);
  for (const ex of titles.examiners) {
    for (const name of ['placement.good', 'placement.next', 'placement.done']) {
      for (const i of [vi, en]) {
        const text = i.t(`${ex.lines}.${name}`, { skill: 'x' });
        assert.ok(!/lớp|grade|level|trình độ/i.test(text), `${ex.lines}.${name}: "${text}"`);
      }
    }
  }
  // All right: no next skill that was wrong, but the next skill above the hardest right one.
  const all = createExam({ ladder, settings, rng: createRng('all'), start: gradeBase(3, cfg.rating) });
  while (!all.done) {
    all.next();
    all.answer(true);
  }
  const s = strengths(all.result(), ladder);
  assert.ok(s.good, 'a skill done well');
});

test('the grade of a placement goes to the parent page, never above the top grade that has tasks', () => {
  const ids = gradeIds(game.grades);
  const top = cfg.exam.placement.topGrade;
  assert.equal(top, 5);
  // A child of grade 5 with all right: the top of the range.
  const exam = createExam({ ladder, settings, rng: createRng('top'), start: gradeBase(5, cfg.rating) });
  while (!exam.done) {
    exam.next();
    exam.answer(true);
  }
  const placed = placedGrade(exam.result().ability, ids, cfg.rating, top);
  assert.deepEqual(placed, { grade: 5, above: true });
  assert.equal(vi.t('parent.grade.above', { grade: { key: 'grade.name', params: { n: 5 } } }).toLowerCase(), 'lớp 5 trở lên');
  assert.deepEqual(placedGrade(gradeBase(3, cfg.rating) + 10, ids, cfg.rating, top), { grade: 3, above: false });
});

test('a rectangle of the area is never shorter than it is wide', () => {
  const skill = graph.get('math.area');
  for (let level = 1; level <= skill.levels.length; level++) {
    for (let i = 0; i < 300; i++) {
      const p = generate(skill, level, createRng(`area:${level}:${i}`));
      assert.ok(p.visual.w >= p.visual.h, `dài ${p.visual.w}, rộng ${p.visual.h}`);
      assert.equal(p.expr.w, p.visual.w);
    }
  }
});

test('the calling card has the line of the task of the mentor at the grade of the child, and the mentor of the village', () => {
  const callings = load('data/callings.json').callings;
  const trials = load('data/trials.json');
  for (const c of callings) {
    assert.equal(c.lines.length, 5, `${c.id}: a line for each level`);
    for (const key of [...c.lines, c.guideKey]) for (const i of [vi, en]) assert.ok(i.has(key), `${key} is missing`);
    assert.equal(new Set(c.lines.map((k) => vi.t(k))).size, 5, `${c.id}: five different lines`);
  }
  const scholar = callings.find((c) => c.id === 'scholar');
  assert.equal(vi.t(scholar.lines[levelFor(trials, 4)]), 'Học với thầy giáo: chia que đều cho các bàn.');
  assert.equal(vi.t(scholar.lines[levelFor(trials, 1)]), 'Học với thầy giáo: đếm que và bó thành chục.');
  assert.equal(vi.t(callings.find((c) => c.id === 'smith').guideKey), 'Người thầy: bác thợ rèn');
  // The line before the choice ties it to the people of the trials, and the note says "cháu".
  assert.equal(vi.t('exam.messenger.who'), 'Cháu đã giúp năm người tài trong làng. Cháu muốn học với ai?');
  assert.ok(!/\bem\b/.test(vi.t('exam.messenger.calling.note')));
});
