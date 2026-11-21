// At night with a thing in the hands, the button is still the sleep (#181: with a plank of the
// bridge in the hands, the star of rest led to the place of rest, and the button was empty there).
// A press puts the thing down and sleeps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';

test('at night with a plank in the hands, the button is the sleep, and a press puts the plank down and sleeps', async () => {
  const s = load('tests/stories/raid-river-night.json');
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
  const hero = getEntity(session.state, 'hero');
  const plank = getEntity(session.state, 'plank:bridge-gap:0');
  hero.hands.holds = plank.id;
  plank.item.held = 'hero';
  plank.hidden = true;
  run(1.2);
  assert.equal(session.action()?.act, 'sleep', `the button: ${session.action()?.act}`);
  session.command({ type: 'hands', id: session.action().id });
  run(1);
  assert.ok(events.some((e) => e.type === 'sleep'), 'the hero sleeps');
  assert.ok(!hero.hands.holds, 'the hands are empty');
  assert.ok(!plank.item.held && !plank.hidden, 'the plank is on the ground');
});
