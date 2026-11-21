// A talk on the button always says a line (#174: the robot child pressed the talk of a person and
// nothing came). A talk with no line left gives the greeting of the person; in a practice, bé
// Gióng, who lies still, gives the line of the narrator that says so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';

async function talks(name, who, times) {
  const s = load(`tests/stories/${name}.json`);
  let session = null;
  const events = [];
  const failures = await runHeadless({ ...s, steps: [] }, { onSession: (x) => { session = x; x.listen((e) => events.push(e)); } });
  assert.deepEqual(failures, []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  run(2);
  const said = [];
  for (let k = 0; k < times; k++) {
    session.command({ type: 'tap', target: { person: who } });
    run(4);
    const a = session.action();
    assert.equal(a?.act, 'talk', `talk ${k + 1}: the button ${a?.act}`);
    const from = events.length;
    session.command({ type: 'hands', id: a.id });
    run(12);
    said.push(events.slice(from).filter((e) => e.type === 'open').map((e) => e.textKey));
  }
  return said;
}

test('each talk with Gióng after his first words says a line', async () => {
  const said = await talks('envoy-dinh', 'npc:giong-boy', 3);
  assert.deepEqual(said.filter((x) => !x.length), [], JSON.stringify(said));
});

test('in a practice, a talk with bé Gióng gives the line of the narrator: he lies still', async () => {
  const said = await talks('practice-bo-que', 'npc:giong-boy', 2);
  for (const x of said) assert.ok(x.includes('dlg.giong.silent.n1'), JSON.stringify(said));
});
