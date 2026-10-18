// The hero cannot walk away from the teacher (#95): a tap always walks, and a step aside goes
// only to a point with a way back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity } from '../src/core/world/state.js';

const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
const start = [
  { press: { entity: 'npc:teacher' } },
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
  { read: true },
  { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 30 } },
];
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

test('from the cell next to the teacher with no way out for a plan, a tap on the heap walks the hero', async () => {
  let session = null;
  const failures = await runHeadless({ name: 'walk-95', profile, clock: 540, at: ['phu-dong', 54, 27], steps: start }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  const hero = getEntity(session.state, 'hero');
  Object.assign(hero.position, { x: 9414.5 * 2, z: 6270.9 * 2 });
  delete hero.route;
  run(session, 1);
  const rod = getEntity(session.state, 'zone:rods').zone.items[0];
  const from = { x: hero.position.x, z: hero.position.z };
  send(session, { type: 'tap', target: { thing: rod } });
  run(session, 4);
  const moved = Math.hypot(hero.position.x - from.x, hero.position.z - from.z);
  assert.ok(moved > 1, `the hero walked: ${moved.toFixed(2)} half blocks`);
});
