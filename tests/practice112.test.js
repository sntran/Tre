// The practice and the level by evidence (#112): answers in the practice alone never move the level
// of a task, a question of k answers counts with a guess of at least 1 / k, the right answer is not
// the longest one more often than the others, and the answers are spoken before a choice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
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

test('in each bank of questions, the right answer is the longest one alone in at most 40 percent of the questions of text answers', () => {
  const files = readdirSync(new URL('../data/questions/', import.meta.url)).filter((f) => f.endsWith('.json'));
  for (const lang of ['vi', 'en']) {
    const dict = load(`i18n/${lang}.json`);
    for (const f of files) {
      const qs = load(`data/questions/${f}`).questions.filter((q) => q.type === 'choice' && q.choices.every((c) => typeof c === 'string' && dict[c]));
      if (!qs.length) continue;
      const longest = qs.filter((q) => {
        const len = q.choices.map((c) => dict[c].length);
        const m = Math.max(...len);
        return len[q.answer] === m && len.filter((x) => x === m).length === 1;
      });
      assert.ok(longest.length <= 0.4 * qs.length, `${f}, ${lang}: ${longest.length} of ${qs.length}: ${longest.map((q) => q.id).join(', ')}`);
    }
  }
});

// A small stand-in for the DOM and the voice, for the question screen.
class FakeEl {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.listeners = {};
    this.dataset = {};
    this.style = {};
    this.attrs = {};
    this.textContent = '';
    this.className = '';
    const cls = new Set();
    this.classList = { add: (c) => cls.add(c), remove: (c) => cls.delete(c), toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) };
  }
  get isConnected() { return true; }
  append(...c) { this.children.push(...c); }
  addEventListener(k, f) { this.listeners[k] = f; }
  setAttribute(k, v) { this.attrs[k] = v; }
  remove() {}
  click() { this.listeners.click?.({ preventDefault() {}, stopPropagation() {} }); }
}
const spoken = [];
globalThis.Node = FakeEl;
globalThis.HTMLElement = FakeEl;
globalThis.document = { createElement: (t) => new FakeEl(t), createTextNode: (t) => ({ text: t }), createElementNS: (ns, t) => new FakeEl(t), activeElement: null };
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
globalThis.window = { speechSynthesis: { getVoices: () => [], speak: (u) => { spoken.push(u.text); setTimeout(() => u.onend?.(), 0); }, cancel() {}, speaking: false, pending: false }, addEventListener() {}, removeEventListener() {} };

test('the answers of a question are spoken in turn before a choice, and each button glows while it is said', async () => {
  const { renderQuestion } = await import('../src/ui/question.js');
  const problem = { kind: 'choice', prompt: { text: 'the question' }, choices: [{ label: { text: 'answer one' } }, { label: { text: 'answer two' } }, { label: { text: 'answer three' } }], answer: 0 };
  const seen = [];
  const q = renderQuestion(problem, { onAnswer: () => {} });
  const grid = q.el.children.find((c) => c.className === 'choice-grid');
  const buttons = grid.children;
  for (let i = 0; i < 40 && spoken.length < 4; i++) {
    seen.push(buttons.map((b) => b.classList.contains('reading')));
    await new Promise((r) => setTimeout(r, 60));
  }
  seen.push(buttons.map((b) => b.classList.contains('reading')));
  assert.deepEqual(spoken.slice(0, 4), ['the question', 'answer one', 'answer two', 'answer three']);
  for (let k = 0; k < 3; k++) assert.ok(seen.some((s) => s[k]), `button ${k + 1} glows`);
  // The speaker says all again.
  const before = spoken.length;
  q.el.children[0].children[1].click();
  await new Promise((r) => setTimeout(r, 1500));
  assert.deepEqual(spoken.slice(before, before + 4), ['the question', 'answer one', 'answer two', 'answer three']);
  q.destroy();
});
