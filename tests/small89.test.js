// The smaller problems of the play test of #85 (#89).
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { createSkillGraph } from '../src/core/skills.js';
import { generate } from '../src/core/generators.js';
import { createLearner } from '../src/core/learner.js';
import { skillsData, learningConfig as cfg, load } from './helpers.js';

const graph = createSkillGraph(skillsData);

test('"n thêm 10" of grade 1 uses n from 10 to 89, and its example names bundles and sticks', () => {
  const skill = graph.get('math.count.120');
  let tens = 0;
  for (let s = 0; s < 400; s++) {
    const p = generate(skill, 3, createRng(`ten${s}`));
    if (p.expr.op !== 'plus10') continue;
    tens += 1;
    assert.ok(p.expr.n >= 10 && p.expr.n <= 89, `n = ${p.expr.n}`);
    assert.ok(p.example.params.o > 0 && p.example.params.t >= 1, JSON.stringify(p.example));
  }
  assert.ok(tens > 50);
  const vi = load('i18n/vi.json');
  assert.equal(vi['hint.count.plus10'], 'Thêm 10 là thêm một bó mười que.');
  assert.equal(vi['ex.count.ten'], 'Ví dụ: {t} bó và {o} que là {m}. Thêm một bó là {m10}.');
  assert.ok(!/hàng chục|chữ số/.test(vi['hint.count.plus10']));
});

test('two right answers do not take a new skill of grade 1 to its top level', () => {
  const learning = {};
  const learner = createLearner({ graph, config: cfg, learning, grade: 1, rng: createRng('top'), clock: () => 0 });
  for (let i = 0; i < 2; i++) learner.record({ ...learner.problem('math.count.120', { level: 1 }), skill: 'math.count.120', level: 1 }, true);
  const levels = new Set(Array.from({ length: 20 }, () => learner.problem('math.count.120').level));
  assert.ok(!levels.has(3), `the levels after two right answers: ${[...levels].join(', ')}`);
});

test('the line of Gióng says "bụi tre" and shows the card of "quặng sắt"', () => {
  const vi = load('i18n/vi.json');
  assert.ok(vi['dlg.giong.speaks.n3'].includes('bụi tre') && !vi['dlg.giong.speaks.n3'].includes('rặng'));
  const giong = load('data/dialogue/giong.json');
  const node = giong.dialogues.find((d) => d.id === 'giong.speaks').nodes.n3;
  assert.deepEqual(node.word, { nameKey: 'word.ore', textKey: 'word.ore.what' });
  assert.equal(vi['word.ore.what'], 'Quặng sắt là đá có sắt bên trong.');
});

test('the card of a new print says what the voice says, and the practice list is read aloud', () => {
  const vi = load('i18n/vi.json');
  assert.equal(vi['note.new'], undefined);
  assert.equal(vi['note.newName'], 'Tranh mới: {name}.');
  assert.equal(vi['practice.read'], 'Con muốn luyện gì? Bấm nút đỏ, thầy chọn giúp con.');
  const src = readFileSync(new URL('../src/ui/modals.js', import.meta.url), 'utf8');
  assert.ok(src.includes("speak('practice.read'"));
});

test('the basket of the healer is a woven basket on the ground, with three parts and no legs', async () => {
  const { figureOf } = await import('../src/world/figures.js');
  const { BASKET_FLOOR } = await import('../src/core/world/zones.js');
  const parts = figureOf({ kind: 'basket' }, 'coarse').parts.map((p) => p.name);
  assert.ok(!parts.some((n) => /^leg/.test(n)), parts.join(' '));
  assert.ok(parts.filter((n) => /^div/.test(n)).length === 2, 'three parts');
  assert.ok(parts.some((n) => /^band/.test(n)), 'a weave');
  assert.ok(BASKET_FLOOR < 0.5, 'on the ground');
});
