import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExperiments, variantOf } from '../src/core/experiments.js';
import { load } from './helpers.js';

const config = load('data/config/experiments.json');

test('the experiments file names five experiments and at most one active one', () => {
  assert.deepEqual(Object.keys(config.experiments).sort(), ['explore', 'hints', 'predict', 'review', 'target']);
  assert.ok(config.active === null || config.experiments[config.active]);
  for (const [name, exp] of Object.entries(config.experiments)) assert.ok(exp.variants[exp.default], `${name} has its default`);
});

test('with no active experiment every profile has the defaults and the label base', () => {
  const x = createExperiments({ ...config, active: null }, { seed: 5 });
  assert.equal(x.label, 'base');
  assert.equal(x.value('predict'), true);
  assert.equal(x.value('target'), 0.8);
  assert.deepEqual(x.value('reviewDays'), [1, 2, 4, 8, 16, 32]);
  assert.deepEqual(x.variants, []);
});

test('the variant comes from the seed, is the same each time, and the parent can change it', () => {
  const on = { ...config, active: 'predict' };
  for (let seed = 1; seed < 50; seed++) {
    assert.equal(createExperiments(on, { seed }).label, createExperiments(on, { seed }).label, 'stable');
  }
  const labels = new Set(Array.from({ length: 40 }, (_, seed) => createExperiments(on, { seed }).label));
  assert.deepEqual([...labels].sort(), ['predict:off', 'predict:on'], 'both variants come up');
  const seed = [...Array(40).keys()].find((s) => variantOf(s, 'predict', ['on', 'off']) === 'on');
  const x = createExperiments(on, { seed });
  assert.equal(x.value('predict'), true);
  const chosen = createExperiments(on, { seed, choice: { experiment: 'predict', variant: 'off' } });
  assert.equal(chosen.label, 'predict:off');
  assert.equal(chosen.value('predict'), false);
  // A choice for another experiment, or a variant that does not exist, does not count.
  assert.equal(createExperiments(on, { seed, choice: { experiment: 'target', variant: '85' } }).label, 'predict:on');
  assert.equal(createExperiments(on, { seed, choice: { experiment: 'predict', variant: 'maybe' } }).label, 'predict:on');
});
