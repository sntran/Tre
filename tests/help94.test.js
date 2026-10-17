import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newMentor, newMemory, onCommit } from '../src/core/mentor.js';
import { load } from './helpers.js';

const cfg = load('data/world/mentors.json');
const vi = load('i18n/vi.json');
const en = load('i18n/en.json');
const sum = cfg.families.groups;
// A fast try with a high P(L): the diagnosis ready.
const tryOf = (parts, target) => ({ parts, target, solved: parts.reduce((a, b) => a + b, 0) === target, timeS: target * 0.3, sizes: [1, 2, 5], fact: target, pL: 0.9, resets: 0 });

test('a bigger task comes only after a right try that came after no miss, and its line does not praise (#94)', () => {
  assert.equal(onCommit(newMentor('x'), newMemory(), tryOf([5, 2], 7), sum, cfg).move, 'raise');
  // The person fixed the try (the rods over ten went back), and then the child tied ten.
  const st = newMentor('x');
  const mem = newMemory();
  onCommit(st, mem, tryOf([5, 1], 7), sum, cfg);
  const r = onCommit(st, mem, tryOf([5, 2], 7), sum, cfg);
  assert.equal(r.diagnosis, 'ready');
  assert.equal(r.move, 'wait');
  for (const key of ['mentor.raise', 'mentor.nghe.raise']) {
    assert.doesNotMatch(vi[key], /đúng|giỏi|nhanh/i, key);
    assert.doesNotMatch(en[key], /right|good|fast/i, key);
  }
});
