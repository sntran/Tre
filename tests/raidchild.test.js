// A child of six with the big button only wins the first raids of the story (#55): from a new
// profile, the scouts at the gate (the first raid of the slingshot) and then the serpents of the
// river, in the order of the stars. The child presses as many times as the bands of the post
// nearest to the enemy, miscounts by one at times, and rests between shots (playRaid in
// tests/restless.js). Each raid is won in at most two tries: after a loss, the raid comes back
// at the next dawn and is easier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { playRaid, STEP } from './restless.js';

const DAY = 1440;

// Play a raid, and once more at the next dawn after a loss. Return the tries and the profile.
async function raidInTwo(profile, at, encounter, seed) {
  let session = null;
  await runHeadless({ name: 'x', profile, clock: 540, at, steps: [{ wait: 1 }] }, { onSession: (s) => { session = s; } });
  const tries = [];
  for (let k = 0; k < 2; k++) {
    const r = playRaid(session, encounter, { seed: seed * 10 + k });
    tries.push(r);
    if (r.won) break;
    // The next morning: the raid comes back.
    const m = session.state.clock.minutes;
    const dawn = Math.floor(m / DAY) * DAY + DAY + 6.2 * 60;
    for (let i = 0; i < 2 * DAY / STEP && session.state.clock.minutes < dawn; i++) {
      session.step();
      session.events();
      if (session.screen) session.command(session.screen === 'dialogue' || session.screen === 'say' ? { type: 'next' } : { type: 'close' });
    }
  }
  return { tries, profile: session.profile };
}

for (const seed of [1, 2]) {
  test(`a child with the button only wins the scouts and then the river, each in at most two tries (seed ${seed})`, async () => {
    const start = { name: 'An', grade: 1, lang: 'vi', seed: 20 + seed, flags: { 'intro.seen': true, 'giong.spoke': true }, items: { rice: 5 } };
    const scouts = await raidInTwo(start, ['phu-dong', 61, 29], 'encounter:scouts', seed);
    assert.ok(scouts.tries.at(-1).won, `the scouts: ${JSON.stringify(scouts.tries)}`);
    assert.ok(scouts.profile.flags['scouts.won']);
    const next = JSON.parse(JSON.stringify(scouts.profile));
    const river = await raidInTwo(next, ['phu-dong', 14, 62], 'encounter:river', seed);
    assert.ok(river.tries.at(-1).won, `the river: ${JSON.stringify(river.tries)}`);
    assert.ok(river.profile.flags['river.calmed']);
  });
}
