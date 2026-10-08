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

// The name of a calling comes with its picture (#62): the done talk of each of the Five Trials
// names the calling of the trial, and the card of the calling shows next to the talk box. The line
// names what the child did first, then the word of the calling.
test('the done talk of each trial names its calling, with the card of the calling, after what the child did', async () => {
  const { createDialogue } = await import('../src/core/dialogue.js');
  const { load } = await import('./helpers.js');
  const talks = load('data/dialogue/village.json').dialogues;
  const callings = load('data/callings.json').callings;
  const trials = load('data/trials.json').trials.filter((t) => t.calling);
  assert.equal(trials.length, 5);
  for (const lang of ['vi', 'en']) {
    const text = load(`i18n/${lang}.json`);
    for (const trial of trials) {
      const def = talks.find((d) => d.id === `${trial.npc}.trial.done`);
      const view = createDialogue(def, { flags: {} }).view();
      assert.equal(view.calling, trial.calling, `${trial.id}: the card of its calling`);
      const name = text[callings.find((c) => c.id === trial.calling).nameKey];
      const line = text[view.textKey];
      assert.ok(line.includes(name), `${lang} ${trial.id}: the line names the calling`);
      // The last sentence names what the child did, and the word of the calling comes at its end.
      const last = line.split(/(?<=[.!?])\s+/).at(-1);
      assert.ok(last.startsWith(lang === 'vi' ? 'C' : 'You') || last.startsWith('Em'), `${lang} ${trial.id}: the child first ("${last}")`);
      assert.ok(last.includes(name) && last.indexOf(name) > last.length / 2, `${lang} ${trial.id}: then the word`);
    }
  }
});
