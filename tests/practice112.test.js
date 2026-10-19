// The practice and the level by evidence (#112): answers in the practice alone never move the level
// of a task, and a question of k answers counts with a guess of at least 1 / k.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { createSkillGraph } from '../src/core/skills.js';
import { createLearner } from '../src/core/learner.js';
import { trialLevel, levelFor } from '../src/core/world/trials.js';
import { skillsData, learningConfig as cfg, bank, load } from './helpers.js';

const graph = createSkillGraph(skillsData);
const trials = load('data/trials.json');
const smith = trials.trials.find((t) => t.id === 'smith');

function learnerFor(grade) {
  const learning = { skills: {}, items: {}, exams: [] };
  const learner = createLearner({ graph, config: cfg, learning, grade, rng: createRng(`g${grade}`), bank, clock: () => 0 });
  return { learner, learning };
}

test('three right answers in the practice and no commit in the world do not move the level of a task; three commits of the world do', () => {
  const { learner, learning } = learnerFor(2);
  const base = levelFor(trials, 2);
  const skill = smith.levels[base].skill;
  for (let i = 0; i < 3; i++) learner.record({ skill, level: 1 }, true, { choices: 3 });
  const entryOf = (id) => learning.skills[id];
  assert.equal(trialLevel(smith, base, entryOf, trials), base, `p ${learning.skills[skill].p.toFixed(2)}`);
  for (let i = 0; i < 3; i++) learner.record({ skill, level: 1 }, true, { world: true });
  assert.equal(learning.skills[skill].world, 3);
  assert.equal(trialLevel(smith, base, entryOf, trials), base + 1, 'the evidence of the world moves it');
});

test('the guess of a commit of the world is in the bounds of the design, and a question of k answers counts with a guess of at least 1 / k', () => {
  assert.ok(cfg.mastery.pGuess >= 0.05 && cfg.mastery.pGuess <= 0.15, `pGuess ${cfg.mastery.pGuess}`);
  // The same right answer of a new skill: once as an answer of three, once as a commit.
  const a = learnerFor(2);
  const b = learnerFor(2);
  a.learner.record({ skill: 'sci.matter.states', level: 1 }, true, { choices: 3 });
  b.learner.record({ skill: 'sci.matter.states', level: 1 }, true, { world: true });
  const pa = a.learning.skills['sci.matter.states'].p;
  const pb = b.learning.skills['sci.matter.states'].p;
  assert.ok(pa < pb, `a right answer of three counts less than a commit: ${pa.toFixed(3)} < ${pb.toFixed(3)}`);
});
