// The dialogue runner: the seal of a line (#57).
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('a node can have its own seal: the help line of grandma has no seal of a legend (#57)', async () => {
  const { createDialogue } = await import('../src/core/dialogue.js');
  const { load } = await import('./helpers.js');
  const def = load('data/dialogue/prologue.json').dialogues.find((d) => d.id === 'grandma.intro');
  const run = createDialogue(def, { flags: {} });
  assert.equal(run.view().mark, 'legend', 'the narrator tells the legend');
  for (let n = 0; n < 10 && run.view()?.textKey !== 'dlg.grandma.intro.n4'; n++) run.next(0);
  assert.equal(run.view().textKey, 'dlg.grandma.intro.n4');
  assert.equal(run.view().mark, null, 'a line about the controls is not a legend');
});
