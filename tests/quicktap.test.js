// A quick tap on a button that the child holds down (#46): the press and the release come in one
// step of the world. The stories hold a button for many steps, so they did not find it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { getEntity } from '../src/core/world/state.js';

const story = (name) => JSON.parse(readFileSync(new URL(`./stories/${name}.json`, import.meta.url), 'utf8'));

// The session of a story, played up to (and with) the step that `upTo` finds, then the steps `more`.
async function sessionAt(name, upTo, more = []) {
  const s = story(name);
  const i = s.steps.findIndex(upTo);
  assert.ok(i >= 0, `the story ${name} has the step`);
  s.steps = [...s.steps.slice(0, i), ...more];
  let session = null;
  const failures = await runHeadless(s, { onSession: (x) => { session = x; } });
  assert.deepEqual(failures, []);
  return session;
}

const steps = (session, n) => {
  for (let k = 0; k < n; k++) {
    session.step();
    session.events();
  }
};

test('a quick tap on the knife at the bamboo clump: no error, and the knife slashes at the first ring or waits', async () => {
  const session = await sessionAt('staffs-bamboo', (s) => s.press?.culm !== undefined, [{ press: { culm: 0 } }]);
  const heard = [];
  session.listen((ev) => heard.push(ev));
  session.command({ type: 'hold', on: true });
  session.command({ type: 'hold', on: false });
  assert.doesNotThrow(() => steps(session, 1));
  assert.doesNotThrow(() => steps(session, 300));
  const culm = getEntity(session.state, 'culm:staffs:0');
  const slashed = heard.some((ev) => ev.type === 'slash');
  assert.ok(slashed || culm, 'the culm is cut, or it still stands and waits for the next press');
  // The mark of the slash does not stay up after the button is up.
  assert.equal(getEntity(session.state, 'zone:trial-staffs').zone.aim, undefined);
});

test('a double tap on the knife in one step: no error', async () => {
  const session = await sessionAt('staffs-bamboo', (s) => s.press?.culm !== undefined, [{ press: { culm: 0 } }]);
  for (const on of [true, false, true, false]) session.command({ type: 'hold', on });
  assert.doesNotThrow(() => steps(session, 301));
});

test('a quick hold of the button at the jar of feed: one press at most, and the pour ends (#55)', async () => {
  const first = (s) => s.repeat && s.steps?.[0]?.do?.type === 'hands';
  const session = await sessionAt('practice-cho-vit-an', first);
  const round = () => getEntity(session.state, 'zone:trial-ducks')?.zone.round;
  const before = round().poured;
  session.command({ type: 'hold', on: true });
  session.command({ type: 'hold', on: false });
  assert.doesNotThrow(() => steps(session, 1));
  assert.ok(round().poured - before <= 1, 'one scoop at most');
  steps(session, 300);
  assert.equal(round().pouring, false, 'the pour ends');
  assert.ok(round().poured - before <= 1, 'no more feed after the tap');
});
test('two presses on the jar in one step: two scoops in one pour, and the pour ends one second later (#55)', async () => {
  const first = (s) => s.repeat && s.steps?.[0]?.do?.type === 'hands';
  const session = await sessionAt('practice-cho-vit-an', first);
  const round = () => getEntity(session.state, 'zone:trial-ducks')?.zone.round;
  const before = round().poured;
  for (let k = 0; k < 2; k++) session.command({ type: 'hands' });
  assert.doesNotThrow(() => steps(session, 15));
  assert.equal(round().pouring, true, 'the pour waits for more presses');
  steps(session, 30);
  assert.equal(round().pouring, false, 'one second after the last press, the pour ends');
  assert.equal(round().poured - before, 2);
});
