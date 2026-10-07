import { test } from 'node:test';
import assert from 'node:assert/strict';
import { takesSling, isPull, PULL_MIN } from '../src/world/sling.js';

const box = { x0: 180, y0: 380, x1: 210, y1: 440 };
const hero = { x: 195, y: 410 };
const nghe = { x: 220, y: 420 };

test('a finger takes the slingshot only on the hero, and not when it is nearer to Nghé (#50)', () => {
  assert.equal(takesSling({ x: 195, y: 410 }, box, hero, [nghe]), true);
  assert.equal(takesSling({ x: 220, y: 420 }, box, hero, [nghe]), false, 'on Nghé, out of the box of the hero');
  assert.equal(takesSling({ x: 209, y: 418 }, box, hero, [nghe]), false, 'in the box, but nearer to Nghé');
  assert.equal(takesSling({ x: 185, y: 400 }, box, hero, [nghe]), true);
  assert.equal(takesSling({ x: 250, y: 410 }, box, hero, []), false);
});

test('a touch that does not pull is a tap, never a shot (#50)', () => {
  const step = 9;
  assert.equal(isPull({ x: 100, y: 100 }, { x: 102, y: 103 }, step), false);
  assert.equal(isPull({ x: 100, y: 100 }, { x: 100, y: 100 + step * (PULL_MIN - 0.1) }, step), false);
  assert.equal(isPull({ x: 100, y: 100 }, { x: 100, y: 100 + step * 3 }, step), true);
});
