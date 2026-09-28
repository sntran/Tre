import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { createSkillGraph } from '../src/core/skills.js';
import { bktUpdate, masteryState, answersToMaster, pCorrect } from '../src/core/mastery.js';
import { expected, updateRatings, chooseLevel, itemStartRating } from '../src/core/rating.js';
import { startReview, recordReview, isDue, DAY_MS } from '../src/core/review.js';
import { createLearner, feedbackFor } from '../src/core/learner.js';
import { createExam, buildLadder, skillsToPractice } from '../src/core/exam.js';
import { skillsData, learningConfig as cfg, bank } from './helpers.js';

const graph = createSkillGraph(skillsData);

function learnerFor(grade, now = { t: 0 }) {
  const learning = { skills: {}, items: {}, exams: [] };
  const learner = createLearner({ graph, config: cfg, learning, grade, rng: createRng(`g${grade}`), bank, clock: () => now.t });
  return { learner, learning, now };
}

// Skill graph

test('a skill is offered only when the skills before it are mastered', () => {
  const mastered = new Set(['math.add.10']);
  assert.equal(graph.isUnlocked('math.add.20', (id) => mastered.has(id)), true);
  assert.equal(graph.isUnlocked('math.sub.20', (id) => mastered.has(id)), false);
  assert.ok(graph.ancestors('math.sub.20').has('math.add.10'));
  assert.ok(graph.dependents('math.add.10').includes('math.add.20'));
});

test('the graph check finds a cycle and a missing skill', () => {
  const bad = createSkillGraph({
    subjects: ['math'],
    skills: [
      { id: 'a', subject: 'math', grade: 1, pre: ['b'], levels: [{}] },
      { id: 'b', subject: 'math', grade: 1, pre: ['a'], levels: [{}] },
      { id: 'c', subject: 'math', grade: 1, pre: ['zzz'], levels: [{}] },
    ],
  });
  const problems = bad.check();
  assert.ok(problems.some((p) => p.startsWith('cycle')));
  assert.ok(problems.some((p) => p.includes('unknown pre zzz')));
});

// Mastery (BKT)

test('BKT: a correct answer raises p and a wrong answer lowers p', () => {
  const m = cfg.mastery;
  const p0 = 0.3;
  const up = bktUpdate(p0, true, m);
  const down = bktUpdate(p0, false, m);
  assert.ok(up > p0);
  assert.ok(down < up);
  // Hand calculation: known = 0.3*0.9 / (0.3*0.9 + 0.7*0.2) = 0.6585; then + (1 - 0.6585) * 0.15.
  const known = (0.3 * 0.9) / (0.3 * 0.9 + 0.7 * 0.2);
  assert.ok(Math.abs(up - (known + (1 - known) * 0.15)) < 1e-9);
  assert.ok(pCorrect(0.9, m) > pCorrect(0.2, m));
});

test('BKT: some correct answers in a row give mastery', () => {
  const m = cfg.mastery;
  const n = answersToMaster(m.priorAtGrade, m);
  assert.ok(n >= 3 && n <= 8, `needs ${n} answers`);
  assert.equal(masteryState(0.96, m), 'mastered');
  assert.equal(masteryState(0.8, m), 'almost');
  assert.equal(masteryState(0.2, m), 'learning');
});

// Difficulty (Elo)

test('Elo: the expected chance and the update', () => {
  assert.equal(expected(1000, 1000), 0.5);
  assert.ok(Math.abs(expected(1240, 1000) - 0.8) < 0.01);
  const r = updateRatings(1000, 1000, true, { kPlayer: 32, kItem: 16 });
  assert.equal(r.player, 1016);
  assert.equal(r.item, 992);
});

test('Elo: the chosen level is the one nearest to 80 percent correct', () => {
  const rc = cfg.rating;
  // Levels at 800, 870, 940. A player at 1110 has 0.83 on level 2.
  assert.equal(chooseLevel(1110, [800, 870, 940], rc), 2);
  assert.equal(chooseLevel(700, [800, 870, 940], rc), 1);
  assert.equal(chooseLevel(1400, [800, 870, 940], rc), 3);
});

test('Elo: a simulated player gets about 75 to 85 percent correct', () => {
  // The true ability of the simulated player is between the levels of "add within 20".
  const { learner } = learnerFor(1);
  const skill = graph.get('math.add.20');
  const truth = [1, 2, 3].map((l) => itemStartRating(skill, l, cfg.rating));
  const trueAbility = truth[1] + 240;
  const rng = createRng('student');
  let correct = 0;
  let total = 0;
  for (let i = 0; i < 600; i++) {
    const pr = learner.problem('math.add.20');
    const ok = rng.chance(expected(trueAbility, truth[pr.level - 1]));
    learner.record(pr, ok);
    if (i >= 100) {
      total++;
      correct += ok ? 1 : 0;
    }
  }
  const rate = correct / total;
  assert.ok(rate >= 0.72 && rate <= 0.88, `rate ${rate.toFixed(2)}`);
});

// Spaced review (Leitner)

test('Leitner: correct reviews move a skill to later boxes, a mistake moves it back', () => {
  const rc = cfg.review;
  const e = { box: 0, due: 0 };
  startReview(e, 0, rc);
  assert.equal(e.box, 1);
  assert.equal(e.due, rc.intervalsDays[0] * DAY_MS);
  assert.equal(isDue(e, 0), false);
  // An early correct answer does not move the box.
  recordReview(e, true, 1000, rc);
  assert.equal(e.box, 1);
  recordReview(e, true, e.due, rc);
  assert.equal(e.box, 2);
  const t = e.due;
  recordReview(e, true, t, rc);
  assert.equal(e.box, 3);
  assert.equal(e.due, t + rc.intervalsDays[2] * DAY_MS);
  recordReview(e, false, e.due, rc);
  assert.equal(e.box, 1);
});

// Learner

test('the learner sets start values from the grade of the player', () => {
  const { learner } = learnerFor(3);
  assert.equal(learner.status('math.add.10'), 'mastered');
  assert.equal(learner.entry('math.mul.10').p, cfg.mastery.priorAtGrade);
  assert.equal(learner.entry('math.decimal').p, cfg.mastery.priorAboveGrade);
  // A skill below the grade goes into review at once.
  assert.equal(learner.entry('math.add.10').box, 1);
});

test('the learner: correct answers give mastery and start the review', () => {
  const { learner, now } = learnerFor(1);
  let newly = false;
  for (let i = 0; i < 12 && !newly; i++) {
    now.t += 1000;
    const pr = learner.problem('math.add.10');
    newly = learner.record(pr, true).newlyMastered;
  }
  assert.ok(newly);
  assert.equal(learner.status('math.add.10'), 'mastered');
  assert.equal(learner.entry('math.add.10').box, 1);
  assert.ok(learner.unlocked('math.add.20'));
});

test('the learner: a grade 1 player starts with open skills only', () => {
  const { learner } = learnerFor(1);
  for (let i = 0; i < 50; i++) {
    const id = learner.pickSkill({ filter: (s) => s.subject === 'math' });
    assert.ok(learner.unlocked(id), `${id} is open`);
    assert.equal(graph.get(id).pre.length, 0);
  }
});

test('the learner: problems with cards come only from skills with cards', () => {
  const { learner } = learnerFor(2);
  for (let i = 0; i < 30; i++) {
    const pr = learner.next({ cards: true, filter: (s) => s.era === 1 });
    assert.equal(pr.kind, 'cards');
  }
});

test('the learner: mixed practice and due reviews come back', () => {
  const { learner, now } = learnerFor(3);
  now.t = 10 * DAY_MS;
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(learner.pickSkill({ filter: (s) => s.subject === 'math' }));
  // Grade 3 players get grade 3 skills and also reviews of lower skills.
  assert.ok([...seen].some((id) => graph.get(id).grade === 3));
  assert.ok([...seen].some((id) => graph.get(id).grade < 3));
});

test('the learner: skills to practice after mistakes', () => {
  const { learner } = learnerFor(1);
  const pr = learner.problem('math.add.10');
  learner.record(pr, false);
  assert.deepEqual(learner.toPractice(), ['math.add.10']);
  const s = learner.summary((x) => x.id === 'math.add.10')[0];
  assert.equal(s.status, 'learning');
  assert.equal(s.answers, 1);
});

test('feedback after mistakes: hint, then example, then a similar problem', () => {
  const f = cfg.feedback;
  assert.equal(feedbackFor(0, f), null);
  assert.equal(feedbackFor(1, f), 'hint');
  assert.equal(feedbackFor(2, f), 'example');
  assert.equal(feedbackFor(3, f), 'similar');
});

test('placement sets the level of each skill from the ability', () => {
  const { learner } = learnerFor(4);
  const ids = graph.filter((s) => s.subject === 'math').map((s) => s.id);
  learner.applyPlacement(1350, ids, cfg.exam.placement);
  assert.equal(learner.status('math.add.10'), 'mastered');
  assert.notEqual(learner.status('math.mul.multi'), 'mastered');
  assert.ok(learner.entry('math.mul.multi').p <= cfg.mastery.priorAtGrade);
});

// Adaptive exam

const era1Ladder = buildLadder(graph.filter((s) => s.era === 1 && s.subject === 'math'), cfg.rating);
const allLadder = buildLadder(graph.filter((s) => s.subject === 'math'), cfg.rating);
const settings = cfg.exam.subject;

function runExam(ladder, answerFn, seed = 'exam') {
  const exam = createExam({ ladder, settings, rng: createRng(seed) });
  const items = [];
  while (!exam.done) {
    const item = exam.next();
    items.push(item);
    exam.answer(answerFn(item));
  }
  return { exam, items, result: exam.result() };
}

test('the exam starts easy and gets harder after correct answers', () => {
  const { items, result } = runExam(allLadder, () => true);
  assert.equal(result.asked, settings.max);
  assert.equal(items[0].rating, allLadder[0].rating);
  assert.ok(items[items.length - 1].rating > items[0].rating + 500);
});

test('the exam ends after a few mistakes, with 10 to 15 questions', () => {
  const { result } = runExam(allLadder, () => false);
  assert.equal(result.asked, settings.min);
  const rng = createRng('mixed');
  for (let i = 0; i < 20; i++) {
    const { result: r } = runExam(allLadder, () => rng.chance(0.7), `m${i}`);
    assert.ok(r.asked >= settings.min && r.asked <= settings.max);
  }
});

test('the exam finds the ability of a simulated player', () => {
  for (const truth of [900, 1150, 1400]) {
    let error = 0;
    const runs = 40;
    for (let i = 0; i < runs; i++) {
      const rng = createRng(`t${truth}:${i}`);
      const { result } = runExam(allLadder, (item) => rng.chance(expected(truth, item.rating)), `e${truth}:${i}`);
      error += Math.abs(result.ability - truth);
    }
    assert.ok(error / runs < 170, `mean error ${Math.round(error / runs)} at ${truth}`);
  }
});

test('the Era 1 exam: a strong player passes and a weak player does not', () => {
  const pass = cfg.exam.era1.pass;
  const strong = runExam(era1Ladder, () => true).result;
  assert.ok(strong.ability >= pass);
  const weak = runExam(era1Ladder, () => false).result;
  assert.ok(weak.ability < pass);
  const practice = skillsToPractice(weak, era1Ladder);
  assert.ok(practice.length > 0);
});
