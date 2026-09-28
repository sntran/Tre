import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { createSkillGraph } from '../src/core/skills.js';
import { bktUpdate, masteryState, answersToMaster, pCorrect, decideMastery } from '../src/core/mastery.js';
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
  // Hand calculation: known = p (1 - slip) / (p (1 - slip) + (1 - p) guess); then + (1 - known) transit.
  const known = (p0 * (1 - m.pSlip)) / (p0 * (1 - m.pSlip) + (1 - p0) * m.pGuess);
  assert.ok(Math.abs(up - (known + (1 - known) * m.pTransit)) < 1e-9);
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

// Answers to mastery of a simulated learner who is right with a fixed chance.
// The learner practices one skill with the normal choice of levels.
function answersToMastery(rate, runs, skillId = 'math.add.10', max = 400) {
  const counts = [];
  for (let s = 0; s < runs; s++) {
    const learning = { skills: {}, items: {}, exams: [] };
    const learner = createLearner({ graph, config: cfg, learning, grade: 1, rng: createRng(`sim${s}`), clock: () => 0 });
    const rng = createRng(`answers${s}`);
    let n = 0;
    let done = false;
    while (!done && n < max) {
      n += 1;
      done = learner.record(learner.problem(skillId), rng.chance(rate)).newlyMastered;
    }
    counts.push(done ? n : Infinity);
  }
  counts.sort((a, b) => a - b);
  return { counts, median: counts[Math.floor(runs / 2)], within: (k) => counts.filter((c) => c <= k).length / runs };
}

test('mastery: simulated learners who are right 100, 80, and 60 percent of the time', () => {
  // Expected (from 400 runs): 100% -> 8 answers; 80% -> median about 14; 60% -> median about 60.
  const all = answersToMastery(1, 50);
  assert.ok(all.counts.every((c) => c === cfg.mastery.minAnswers), 'a learner who is always right needs exactly minAnswers');
  const good = answersToMastery(0.8, 400);
  assert.ok(good.median >= 10 && good.median <= 20, `80%: median ${good.median}`);
  assert.ok(good.within(40) >= 0.9, '80%: most learners get mastery in 40 answers');
  const weak = answersToMastery(0.6, 400);
  assert.ok(weak.median >= 40, `60%: median ${weak.median}`);
  assert.ok(weak.within(20) <= 0.2, `60%: ${weak.within(20)} get mastery in 20 answers`);
});

test('mastery needs 8 answers and 2 correct answers at the highest level', () => {
  const { learner } = learnerFor(1);
  const skill = graph.get('math.add.10');
  // Correct answers at level 1 only: p is high, but the skill is not mastered.
  for (let i = 0; i < 12; i++) learner.record({ skill: skill.id, level: 1 }, true);
  assert.ok(learner.entry(skill.id).p >= cfg.mastery.mastered);
  assert.equal(learner.status(skill.id), 'almost');
  // Near mastery, the next problem uses the highest level.
  assert.equal(learner.levelFor(skill.id), skill.levels.length);
  learner.record({ skill: skill.id, level: skill.levels.length }, true);
  assert.equal(learner.status(skill.id), 'almost');
  assert.equal(learner.record({ skill: skill.id, level: skill.levels.length }, true).newlyMastered, true);
  // Fewer than 8 answers never give mastery.
  const e = { p: 0.99, n: 7, top: 5, recent: '1111111', mastered: false };
  assert.equal(decideMastery(e, cfg.mastery), 'almost');
});

test('mastery does not flap: one mistake keeps a mastered skill, a fall below "almost" removes it', () => {
  const m = cfg.mastery;
  const e = { p: 0.97, n: 20, top: 4, recent: '1111111111', mastered: true };
  e.p = bktUpdate(e.p, false, m);
  assert.ok(e.p < m.mastered && e.p >= m.almost, `p ${e.p}`);
  assert.equal(decideMastery(e, m), 'mastered');
  e.p = bktUpdate(e.p, false, m);
  assert.ok(e.p < m.almost);
  assert.equal(decideMastery(e, m), 'learning');
  // It comes back only with the full rule.
  e.p = 0.96;
  e.recent = '0011111111';
  assert.equal(decideMastery(e, m), 'almost');
});

// Difficulty (Elo)

test('Elo: the expected chance and the update', () => {
  assert.equal(expected(1000, 1000), 0.5);
  assert.ok(Math.abs(expected(1240, 1000) - 0.8) < 0.01);
  const r = updateRatings(1000, 1000, true, { kPlayer: 32, kItem: 16 });
  assert.equal(r.player, 1016);
  assert.equal(r.item, 992);
});

test('Elo: the chosen level has an expected success from targetLow to targetHigh', () => {
  const rc = cfg.rating;
  const levels = [800, 870, 940];
  const chances = (p) => levels.map((r) => expected(p, r, rc.scale));
  // A player at 1110: 0.86, 0.80, 0.72. Only level 2 is in the range.
  assert.equal(chooseLevel(1110, levels, rc), 2);
  // A player at 1150: 0.89, 0.84, 0.77. Levels 2 and 3 are in the range. The harder one wins.
  assert.deepEqual(chances(1150).map((c) => c >= rc.targetLow && c <= rc.targetHigh), [false, true, true]);
  assert.equal(chooseLevel(1150, levels, rc), 3);
  // No level is in the range: the nearest level.
  assert.equal(chooseLevel(700, levels, rc), 1);
  assert.equal(chooseLevel(1400, levels, rc), 3);
  // The range comes from the configuration.
  assert.equal(chooseLevel(1110, levels, { ...rc, targetLow: 0.6, targetHigh: 0.75 }), 3);
  assert.equal(chooseLevel(1110, levels, { ...rc, targetLow: 0.85, targetHigh: 0.95 }), 1);
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

test('parent questions come up for their skill and language', () => {
  const learning = { skills: {}, items: {}, exams: [] };
  const parentQ = { id: 'parent-1', skill: 'math.add.10', lang: 'en', type: 'numeric', text: '2 + 2 on the school sheet?', answer: 4, level: 1, parent: true };
  const learner = createLearner({ graph, config: cfg, learning, grade: 1, rng: createRng('pq'), bank: [...bank, parentQ], lang: 'en' });
  let seen = 0;
  for (let i = 0; i < 40; i++) if (learner.problem('math.add.10').source === 'parent-1') seen++;
  assert.ok(seen > 5 && seen < 35, `seen ${seen}`);
  const vietnamese = createLearner({ graph, config: cfg, learning: { skills: {}, items: {} }, grade: 1, rng: createRng('pq'), bank: [...bank, parentQ], lang: 'vi' });
  for (let i = 0; i < 20; i++) assert.notEqual(vietnamese.problem('math.add.10').source, 'parent-1');
});
