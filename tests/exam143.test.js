// The test of the messenger and the calling after the play test of #135–#139 (#143): "done well" is
// true, a reason after every answer, no question needs paper, the cards come with the question, and
// each card shows the person of the village.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRng } from '../src/core/rng.js';
import { createSkillGraph } from '../src/core/skills.js';
import { expected, gradeBase } from '../src/core/rating.js';
import { createExam, examLadder, examSkills, strengths } from '../src/core/exam.js';
import { generate } from '../src/core/generators.js';
import { createI18n } from '../src/core/i18n.js';
import { skillsData, learningConfig as cfg, load } from './helpers.js';

const graph = createSkillGraph(skillsData);
const titles = load('data/titles.json');
const skills = examSkills(graph, titles.exams.placement, titles.titles);
const ladder = examLadder(skills, cfg.rating);
const settings = cfg.exam.subject;
const vi = createI18n(load('i18n/vi.json'), 'vi');
const en = createI18n(load('i18n/en.json'), 'en');

// A placement with answers at the level of a grade; each question is a problem of the exam.
function placement(grade, seed) {
  const exam = createExam({ ladder, settings, rng: createRng(`p143:${seed}`), start: gradeBase(grade, cfg.rating) + cfg.exam.placement.startOffset });
  const answers = createRng(`a143:${seed}`);
  const rng = createRng(`q143:${seed}`);
  while (!exam.done) {
    const item = exam.next();
    const problem = generate(graph.get(item.skill), item.level, rng, { exam: true });
    exam.answer(answers.chance(expected(gradeBase(grade, cfg.rating), item.rating)), { what: problem.what });
  }
  return exam.result();
}

test('the result never names as done well a skill with a wrong answer: done well has all its answers right and at least two; else the count of the right answers', () => {
  let well = 0;
  let counted = 0;
  for (const grade of [3, 4, 5]) {
    for (let seed = 0; seed < 60; seed++) {
      const result = placement(grade, `${grade}:${seed}`);
      const s = strengths(result, ladder);
      if (!s.good) continue;
      const mine = result.items.filter((a) => a.skill === s.good);
      if (s.count === null) {
        well += 1;
        assert.ok(mine.every((a) => a.correct) && mine.length >= 2, `${s.good}: ${JSON.stringify(mine)}`);
      } else {
        counted += 1;
        assert.equal(s.count, mine.filter((a) => a.correct).length);
        assert.ok(!result.items.some((a) => {
          const all = result.items.filter((b) => b.skill === a.skill);
          return all.every((b) => b.correct) && all.length >= 2;
        }), 'a skill done well was there');
      }
      // The parts that the test asked: a skill of two parts names only the parts asked.
      for (const w of s.what) assert.ok(mine.some((a) => a.what === w));
    }
  }
  assert.ok(well > 0 && counted > 0, `done well ${well}, counts ${counted}`);
  // Vy (#143): one decimal right and one wrong; the decimals are never done well.
  const vy = { items: [
    { skill: 'math.decimal', rating: 1500, correct: true, what: 'add' },
    { skill: 'math.decimal', rating: 1500, correct: false, what: 'add' },
    { skill: 'math.frac.add', rating: 1400, correct: true },
    { skill: 'math.area', rating: 1300, correct: true, what: 'area' },
    { skill: 'math.area', rating: 1300, correct: true, what: 'area' },
  ] };
  const s = strengths(vy, ladder);
  assert.equal(s.good, 'math.area');
  assert.equal(s.count, null);
  assert.deepEqual(s.what, ['area']);
  // The lines.
  assert.equal(vi.t('exam.messenger.placement.count', { n: { key: 'num.3' }, skill: 'bảng nhân' }), 'Cháu làm đúng ba bài bảng nhân.');
  assert.equal(vi.t('skill.math.decimal.add'), 'Cộng số thập phân');
});

test('every kind of exam question has a reason, in each language, with its numbers', () => {
  for (const skill of skills) {
    const rng = createRng(`why:${skill.id}`);
    for (let i = 0; i < 40; i++) {
      const p = generate(skill, 1, rng, { exam: true });
      assert.ok(p.explain?.key, `${skill.id}: no reason for ${JSON.stringify(p.expr)}`);
      for (const i18n of [vi, en]) {
        assert.ok(i18n.has(p.explain.key), `${p.explain.key} is missing`);
        const text = i18n.t(p.explain.key, p.explain.params);
        assert.ok(!/[{}]/.test(text), `${p.explain.key}: "${text}"`);
      }
    }
  }
  // The examples of the issue.
  const fp = generate({ ...graph.get('math.frac.unlike'), levels: [{ pairs: [[2, 4]] }] }, 1, createRng('frac'));
  assert.equal(fp.explain.key, 'why.frac.unlike.first');
  const dec = generate({ ...graph.get('math.decimal'), levels: [{ places: 1, max: 10 }] }, 1, createRng('dec'));
  assert.match(vi.t(dec.explain.key, dec.explain.params), /phần mười/);
  // The line of the answer says "Đáp án là 6,2." before the reason, so the reason does not say it again.
  assert.equal(vi.t('why.decimal.carry', { x: 3.7, y: 2.5, ta: 7, tb: 5, ts: 12, tr: 2, wa: 3, wb: 2, ws: 6, z: 6.2 }), '3,7 + 2,5: 7 + 5 = 12 phần mười, viết 2, nhớ 1. 3 + 2 + 1 = 6.');
  assert.equal(vi.t('why.frac.unlike.first', { a: 1, d1: 2, b: 3, D: 4, a2: 2, z: 5 }), '1/2 là 2/4. 2/4 + 3/4 = 5/4.');
});

test('no question of the placement needs paper: a product has at most one factor of two digits that is not round', () => {
  for (const skill of skills) {
    const rng = createRng(`paper:${skill.id}`);
    for (let i = 0; i < 200; i++) {
      const p = generate(skill, 1, rng, { exam: true });
      if (p.expr.op !== 'mul') continue;
      const big = [p.expr.a, p.expr.b].filter((n) => n >= 10 && n % 10 !== 0);
      assert.ok(big.length <= 1, `${skill.id}: ${p.expr.a} × ${p.expr.b}`);
    }
  }
});

test('the cards come with the question, and each card shows the person of the village who is the mentor', () => {
  const src = readFileSync(new URL('../src/ui/vanmieu.js', import.meta.url), 'utf8');
  assert.match(src, /chooseCalling\(ctx, false, ex, lineOf\(ex, 'who'\)\)/);
  assert.ok(!/showMessage\([^)]*lineOf\(ex, 'who'\)/.test(src), 'no line of the question with its own button');
  const callings = load('data/callings.json').callings;
  const trials = load('data/trials.json').trials;
  const figures = load('data/figures.json').figures;
  for (const c of callings) {
    const trial = trials.find((x) => x.calling === c.id);
    assert.ok(trial, c.id);
    assert.equal(c.person, trial.npc, `${c.id}: the card shows ${c.person}, the mentor is ${trial.npc}`);
    assert.ok(figures[c.person], `${c.person} has a figure`);
  }
});
