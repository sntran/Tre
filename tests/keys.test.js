// The keys of the world (src/core/keys.js, docs/TASKS.md): Space jumps, E and Enter act, Z and C
// turn the camera, and Q does nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { keyAct } from '../src/core/keys.js';

test('Space jumps, E and Enter do the act of the target, Z and C turn the camera, and Q does nothing', () => {
  assert.equal(keyAct('Space'), 'jump');
  assert.equal(keyAct('KeyJ'), 'jump', 'J stays as a second key for the jump');
  assert.equal(keyAct('KeyE'), 'act');
  assert.equal(keyAct('Enter'), 'act');
  assert.equal(keyAct('KeyZ'), 'turnLeft');
  assert.equal(keyAct('KeyC'), 'turnRight');
  assert.equal(keyAct('KeyQ'), null);
  for (const code of ['ArrowUp', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) assert.equal(keyAct(code), 'move', code);
  // The village reads the keys only through this table.
  const village = readFileSync('src/ui/village.js', 'utf8');
  assert.match(village, /keyAct\(e\.code\)/);
  assert.doesNotMatch(village, /'Key[QEJZC]'|'Space'/);
});

test('the help of the keys names the keys of the table', () => {
  for (const lang of ['vi', 'en']) {
    const help = JSON.parse(readFileSync(`i18n/${lang}.json`, 'utf8'))['ui.keys'];
    for (const k of ['E', 'Enter', 'Z', 'C', 'J']) assert.match(help, new RegExp(`\\b${k}\\b`), `${lang}: ${k}`);
    assert.doesNotMatch(help, /\bQ\b/, `${lang}: no Q`);
  }
});
