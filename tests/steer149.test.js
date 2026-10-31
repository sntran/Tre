// The view never turns while the child steers, after the play test of #140–#145 (#149): a pause
// between two pushes of the stick is not a stop, the stick keeps its directions over a turn until
// the finger lifts, and the offer of a puzzle does not turn the view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';
import { createStill, stickAngle, STICK_REST, STILL_WAIT } from '../src/world/turns.js';
import { screenToMap } from '../src/core/world/move.js';

const DT = 1 / 30;
function run(still, sec, input) {
  let fired = 0;
  for (let t = 0; t < sec; t += DT) if (still.step(DT, input)) fired += 1;
  return fired;
}

test('push, lift for one second, push the same way, five times: no stop, so no turn; a stop comes two seconds after the last lift', () => {
  const still = createStill();
  let fired = 0;
  for (let k = 0; k < 5; k++) {
    fired += run(still, 1.2, { moving: true, route: false, stick: true });
    fired += run(still, 1, { moving: false, route: false, stick: false });
  }
  assert.equal(fired, 0, 'no turn between two pushes');
  // A finger that rests on the stick with no push: still no stop.
  assert.equal(run(still, 5, { moving: false, route: false, stick: true }), 0, 'no turn while the finger is on the stick');
  // The finger lifts and the child waits: one stop after STICK_REST.
  assert.equal(run(still, STICK_REST - 0.2, { moving: false, route: false, stick: false }), 0);
  assert.equal(run(still, 0.4, { moving: false, route: false, stick: false }), 1);
  assert.equal(run(still, 3, { moving: false, route: false, stick: false }), 0, 'one time');
});

test('the end of a walk from a tap is a stop that the child makes: the turn may come after a moment', () => {
  const still = createStill();
  assert.equal(run(still, 3, { moving: true, route: true, stick: false }), 0);
  assert.equal(run(still, STILL_WAIT + 0.1, { moving: false, route: false, stick: false }), 1);
});

test('with a turn in the middle of a push, the push goes on the same way on the map until the finger lifts; the next touch takes the new view', () => {
  const az0 = Math.PI / 4;
  const az1 = az0 + Math.PI / 2;
  const stick = { active: true, az: az0 };
  const before = screenToMap(1, 0, stickAngle(stick, az0));
  const after = screenToMap(1, 0, stickAngle(stick, az1));
  assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9, 'the same way on the map');
  const next = { active: true, az: az1 };
  const fresh = screenToMap(1, 0, stickAngle(next, az1));
  assert.ok(Math.hypot(fresh.x - before.x, fresh.y - before.y) > 0.5, 'the next touch uses the new view');
  assert.equal(stickAngle({ active: false, az: az0 }, az1), az1);
});

test('the offer of the pots shows the things of the puzzle with no turn of the view; the first move of the child may turn it', async () => {
  const s = load('tests/stories/puzzle-pots.json');
  const views = [];
  await runHeadless({ ...s, steps: s.steps.slice(0, 2) }, { onSession: (x) => {
    x.listen((e) => { if (e.type === 'workView' && e.key === 'puzzle') views.push(e); });
  } });
  assert.ok(views.length >= 1, 'the view of the things');
  assert.equal(views[0].turn, false, 'the offer does not turn the view');
});

test('the offer of the ferry does not turn the view; a talk with the traveler, or the first load, may turn it', async () => {
  const s = load('tests/stories/puzzle-ferry.json');
  const views = [];
  let session = null;
  await runHeadless({ ...s, steps: s.steps.slice(0, 1) }, { onSession: (x) => {
    session = x;
    x.listen((e) => { if (e.type === 'workView' && e.key === 'puzzle') views.push(e); });
  } });
  assert.ok(views.length >= 1);
  assert.equal(views[0].turn, false, 'the offer does not turn the view');
  assert.ok(session);
});
