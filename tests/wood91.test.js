// The woodcutter of the play test of #85 to #89 (#91): a tap and two presses make one mark, the
// line of how to add a mark after too few pieces, the example in view, and help sooner for the
// youngest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity } from '../src/core/world/state.js';

const profile = (grade = 1) => ({ name: 'An', grade, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } });
const start = [
  { press: { entity: 'npc:woodcutter' } },
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
  { read: true },
  { until: { event: 'call', with: { key: 'mentor.woodcutter.first' }, timeout: 15 } },
];
async function atStem(steps = [], hook = () => {}, grade = 1) {
  let session = null;
  const failures = await runHeadless({ name: 'wood-91', profile: profile(grade), clock: 540, at: ['phu-dong', 51, 8.5], steps: [...start, ...steps] }, { onSession: (s) => { session = s; hook(s); } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  return session;
}
function run(session, seconds, until = () => false) {
  for (let i = 0; i < seconds / STEP && !until(); i++) {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
  }
}
const send = (session, cmd) => {
  session.command(cmd);
  session.events();
};
const marks = (session) => getEntity(session.state, 'zone:trial-woodcutter').zone.marks;

test('a tap on the stem and two quick presses make one mark, and then the button is the knife', async () => {
  const session = await atStem();
  const stem = getEntity(session.state, 'stem:woodcutter');
  const hero = getEntity(session.state, 'hero');
  // The hero stands at the stem, near ring 1; the tap is on ring 4, in reach: no walk.
  Object.assign(hero.position, { x: stem.position.x + 1, z: stem.position.z + 2.5 });
  delete hero.route;
  run(session, 0.5);
  send(session, { type: 'tap', target: { thing: stem.id, along: 4 } });
  run(session, 0.3);
  send(session, { type: 'hands' });
  run(session, 0.25);
  send(session, { type: 'hands' });
  run(session, 0.5);
  assert.deepEqual(marks(session), [4], 'one mark, at the ring of the tap');
  run(session, 6, () => !hero.route);
  assert.ok(Math.abs(hero.position.x - (stem.position.x + 4)) <= 1.2, `the hero walked to the ring: ${(hero.position.x - stem.position.x).toFixed(1)}`);
  assert.equal(session.action()?.act, 'cut', 'then the button is the knife');
});
