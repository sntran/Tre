// The buttons of hero creation fit their words at a phone width (#37). The choices that are words
// (boy or girl, the grade) are word buttons: as wide as the word needs, on one line. The browser
// check of each screen at 360 px, in both languages, is tools/fit-check.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the choices of boy or girl and of the grade are word buttons, and a word button is as wide as its word, on one line', () => {
  const src = readFileSync('src/ui/create.js', 'utf8');
  for (const key of ['create.gender', 'create.grade.label']) {
    assert.match(src, new RegExp(`'${key.replace('.', '\\.')}', \\{ words: true \\}\\)`), `${key} is a row of word buttons`);
  }
  assert.match(src, /words \? 'tile-btn word' : 'tile-btn'/);
  const css = readFileSync('styles/main.css', 'utf8');
  const rule = css.match(/\.tile-btn\.word\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(rule, /width:\s*auto/, 'no fixed width');
  assert.match(rule, /white-space:\s*nowrap/, 'one line');
  assert.match(rule, /max-width:\s*100%/, 'never wider than the screen');
});
