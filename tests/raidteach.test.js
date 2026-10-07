// The first raid of a tool waits for the child (#50): with a new slingshot, the first enemy stops on
// the road until the first hit; with new traps, no enemy comes until the child has a trap in the
// hands. The big button is the slingshot when nothing else is in reach: hold it, and let go.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRaid, stepRaid, shoot, releaseHold, along, HOLD_AT } from '../src/core/world/raids.js';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';

const raids = load('data/raids.json');
const run = (raid, seconds, ctx = {}) => {
  const out = [];
  for (let t = 0; t < seconds; t += 1 / 30) out.push(...stepRaid(raid, 1 / 30, ctx));
  return out;
};

test('the first raid of the slingshot: the first enemy stops on the road and waits for the first hit; no other wave comes', () => {
  const raid = createRaid(raids, 'river', 0, null, ['sling']);
  assert.deepEqual(raid.hold, { tool: 'sling' });
  const evs = run(raid, 90);
  assert.equal(raid.enemies.length, 1, 'one enemy, no other wave');
  assert.ok(Math.abs(along(raid, raid.enemies[0]) - HOLD_AT) < 1, 'the enemy waits on the road');
  assert.ok(!evs.some((ev) => ev.type === 'gate' || ev.type === 'take'), 'nothing reaches the gate');
  shoot(raid, 4);
  run(raid, 4);
  assert.deepEqual(raid.hold, { tool: 'sling' }, 'a short shot: the enemy still waits');
  shoot(raid, HOLD_AT);
  run(raid, 4);
  assert.equal(raid.hold, null, 'the first hit: the raid goes on');
  run(raid, 20);
  assert.ok(raid.enemies.length >= 2, 'the next wave comes');
  // A raid that the child knew before does not wait.
  const known = createRaid(raids, 'river', 0, null, []);
  assert.equal(known.hold, null);
});

test('the first raid of the traps: no enemy comes until the child has a trap in the hands', () => {
  const raid = createRaid(raids, 'soldier1', 0, null, ['traps', 'helpers', 'nghe']);
  assert.deepEqual(raid.hold, { tool: 'traps' });
  run(raid, 40);
  assert.equal(raid.enemies.length, 0);
  assert.deepEqual(releaseHold(raid, 'sling'), [], 'another tool does not let it go');
  assert.equal(releaseHold(raid, 'traps').length, 1);
  run(raid, 5);
  assert.ok(raid.enemies.length >= 1, 'the soldiers come');
});

test('the big button is the slingshot: a longer hold is a longer pull, and a pull to the waiting serpent hits it', async () => {
  let session = null;
  const events = [];
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'giong.spoke': true } };
  // The serpent waits at HOLD_AT half blocks from the wall: one step at once, and four steps each
  // second of the hold. A hold of (HOLD_AT - 1) / 4 seconds is a pull to the serpent.
  const holdFor = (HOLD_AT - 1) / 4 + 0.1;
  const failures = await runHeadless({ name: 'raid-button', profile, clock: 540, at: ['phu-dong', 14, 61], steps: [
    { press: { entity: 'encounter:river' } },
    { until: { event: 'open', with: { screen: 'say' }, timeout: 20 } },
    { read: true },
    { wait: 2 },
    { expect: [{ raid: { on: true, enemies: 1 } }] },
    // The child waits: the serpent stops on the road and waits.
    { wait: 40 },
    { expect: [{ raid: { on: true, enemies: 1 } }, { event: 'gate', not: true }] },
    // A short hold: a short pull.
    { do: { type: 'hold', on: true } }, { wait: 1 }, { do: { type: 'hold', on: false } },
    { until: { event: 'shoot', timeout: 5 } },
    { wait: 3 },
    // A hold of the right length: the rice ball reaches the serpent.
    { do: { type: 'hold', on: true } }, { wait: holdFor }, { do: { type: 'hold', on: false } },
    { until: { event: 'hit', timeout: 8 } },
  ] }, { onSession: (s) => { session = s; s.listen((ev) => events.push(ev)); } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const shots = events.filter((ev) => ev.type === 'shoot').map((ev) => ev.count);
  assert.equal(shots.length, 2);
  assert.ok(shots[0] < shots[1], `a longer hold is a longer pull: ${shots}`);
  assert.equal(shots[1], HOLD_AT);
  void session;
});
