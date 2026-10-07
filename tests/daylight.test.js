// The light holds in the story too (#57): while the hero works at the task of a person, the clock
// waits, and the person stays at the task. Before, the trial of the healer went from dusk through
// the night, and at dawn she went out and left the beds and the basket.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { getEntity } from '../src/core/world/state.js';
import { load } from './helpers.js';

test('in the story, the clock waits while the hero works at the trial of the healer, and she stays there (#57)', async () => {
  const story = load('tests/stories/trial-healer.json');
  const first = story.steps.findIndex((s) => s.read === true);
  let session = null;
  const failures = await runHeadless({ ...story, clock: 16 * 60 + 50, steps: story.steps.slice(0, first + 1) }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  assert.equal(session.practice, null, 'the story, not a practice');
  const start = session.state.clock.minutes;
  const healer = () => getEntity(session.state, 'npc:healer');
  const at = { ...healer().position };
  // The child works: a touch of the big button every 20 seconds (a hold with no hold act does no
  // work, so the basket does not fill and the trial goes on).
  for (let k = 0; k < 30 * 60 * 10; k++) {
    if (session.screen === 'dialogue' || session.screen === 'say') session.command({ type: 'next' });
    else if (session.screen) session.command({ type: 'close' });
    else if (k % (30 * 20) === 0) {
      session.command({ type: 'hold', on: true });
      session.command({ type: 'hold', on: false });
    }
    session.step();
    session.events();
  }
  assert.equal(session.state.clock.minutes, start, 'ten minutes at the work: the light holds');
  assert.ok(!healer().hidden && Math.hypot(healer().position.x - at.x, healer().position.z - at.z) < 6, 'the healer stays at her trial');
  // The hero walks away from the work: the days go on again.
  session.command({ type: 'tap', target: { ground: { x: session.heroCell().x, y: session.heroCell().y - 30, h: 3, thing: false, object: null } } });
  for (let k = 0; k < 30 * 20; k++) {
    session.step();
    session.events();
  }
  assert.ok(session.state.clock.minutes > start, 'away from the work, the clock goes on');
});

test('a child who only waits next to the work does not hold the light: the clock goes on (#57)', async () => {
  const story = load('tests/stories/trial-healer.json');
  const first = story.steps.findIndex((s) => s.read === true);
  let session = null;
  await runHeadless({ ...story, clock: 16 * 60 + 50, steps: story.steps.slice(0, first + 1) }, { onSession: (s) => { session = s; } });
  const start = session.state.clock.minutes;
  for (let k = 0; k < 30 * 60; k++) {
    if (session.screen === 'dialogue' || session.screen === 'say') session.command({ type: 'next' });
    else if (session.screen) session.command({ type: 'close' });
    session.step();
    session.events();
  }
  assert.ok(session.state.clock.minutes > start, 'a minute of no press: the day goes on');
});
