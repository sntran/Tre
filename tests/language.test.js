// The language of a start (#36): the choice on the title screen (or in hero creation) right before
// a start wins and goes into the profile; with no choice, the profile keeps its own language.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProfile, startLanguage } from '../src/core/profile.js';

test('choose Vietnamese on the title screen, then a profile in English: the game is in Vietnamese; choose nothing: the language of the profile', () => {
  const english = createProfile({ id: 'p', name: 'An', lang: 'en' });
  assert.equal(startLanguage(english, 'vi'), 'vi');
  assert.equal(startLanguage(english, null), 'en');
  assert.equal(startLanguage(createProfile({ id: 'q', name: 'Bình', lang: 'vi' }), null), 'vi');
});

test('the switch of the title screen and the choice of hero creation are a choice; a start uses it once, and the profile saves it', () => {
  for (const f of ['src/ui/title.js', 'src/ui/create.js']) {
    const src = readFileSync(f, 'utf8');
    assert.match(src, /ctx\.chooseLanguage\(code\)/, f);
    assert.doesNotMatch(src, /ctx\.setLanguage\(code\)/, `${f}: a choice of the child, not only a change`);
  }
  const app = readFileSync('src/ui/app.js', 'utf8');
  const i = app.indexOf('async startProfile(');
  const body = app.slice(i, app.indexOf('\n    },', i));
  assert.match(body, /const code = startLanguage\(profile, ctx\.langChosen\);\s*ctx\.langChosen = null;/);
  assert.match(body, /profile\.settings\.lang = code;\s*await ctx\.setLanguage\(code\);/);
  assert.match(body, /else if \(changed\) ctx\.save\('settings'\);/);
});
