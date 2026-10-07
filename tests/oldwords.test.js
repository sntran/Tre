// No text names a thing that the game does not have (#50). The battle screen of the old game had
// hearts, attack cards, and number shields; the raids have none. A key on the list ALLOWED uses one
// of these words for a thing that is there, with the reason.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.js';

const OLD = { vi: /\btim\b|thẻ|khiên/i, en: /\bhearts?\b|\bcards?\b|\bshields?\b/i };
const ALLOWED = {
  'q.body.heart.prompt': 'a question of science about the heart of the body',
  'q.body.heart.hint': 'a question of science about the heart of the body',
  'q.body.heart.explain': 'a question of science about the heart of the body',
  'q.body.heart.c1': 'a question of science about the heart of the body',
  'dlg.elder.trials.done.n1': '"a kind heart", a way to say that the child is kind',
  'prob.cards': 'the number cards of a practice with the teacher',
  'hint.cards.add': 'the number cards of a practice with the teacher',
  'hint.cards.sub': 'the number cards of a practice with the teacher',
  'hint.cards.mul': 'the number cards of a practice with the teacher',
  'ex.cards': 'the number cards of a practice with the teacher',
  'raid.tool.fire': 'the soldiers of Ân raise a wet shield when fire comes (src/core/world/raids.js)',
  'parent.week.research': 'a tab (thẻ) of the parent page',
};

test('no text names a heart, a card, or a shield that the game does not have (#50)', () => {
  for (const lang of ['vi', 'en']) {
    const texts = load(`i18n/${lang}.json`);
    const bad = Object.entries(texts).filter(([k, v]) => typeof v === 'string' && OLD[lang].test(v) && !ALLOWED[k]).map(([k, v]) => `${k}: ${v}`);
    assert.deepEqual(bad, [], `${lang}: old words`);
  }
});
