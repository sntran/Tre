import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, hashSeed } from '../src/core/rng.js';

test('the same seed gives the same numbers', () => {
  const a = createRng('tre');
  const b = createRng('tre');
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
});

test('different seeds give different numbers', () => {
  assert.notEqual(createRng(1).next(), createRng(2).next());
  assert.notEqual(hashSeed('a'), hashSeed('b'));
});

test('int() stays in the range and gives all values', () => {
  const rng = createRng(7);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const v = rng.int(3, 8);
    assert.ok(v >= 3 && v <= 8);
    seen.add(v);
  }
  assert.equal(seen.size, 6);
  assert.throws(() => rng.int(5, 1));
});

test('shuffle() keeps all items and does not change the input', () => {
  const rng = createRng(3);
  const list = [1, 2, 3, 4, 5];
  const out = rng.shuffle(list);
  assert.deepEqual(list, [1, 2, 3, 4, 5]);
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]);
});

test('the state can be saved and set again', () => {
  const rng = createRng(11);
  rng.next();
  const saved = rng.state;
  const x = rng.next();
  rng.state = saved;
  assert.equal(rng.next(), x);
});

test('fork() gives a repeatable separate generator', () => {
  const a = createRng(5).fork('player2');
  const b = createRng(5).fork('player2');
  assert.equal(a.next(), b.next());
});

test('weighted() never picks an item with weight 0', () => {
  const rng = createRng(9);
  for (let i = 0; i < 500; i++) {
    assert.notEqual(rng.weighted(['a', 'b', 'c'], (x) => (x === 'b' ? 0 : 1)), 'b');
  }
});
