// The place of a press at the fisher and the woodcutter (#109): the talk names both sides of the
// rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.js';

test('the talk of the fisher names both sides of the rule', () => {
  for (const lang of ['vi', 'en']) {
    const line = load(`i18n/${lang}.json`)['dlg.fisher.trial.n5'];
    assert.match(line, lang === 'vi' ? /rộng quá.*hẹp quá/ : /too wide.*too narrow/, line);
  }
});
