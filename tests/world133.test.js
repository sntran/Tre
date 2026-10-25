// The view and the world after the play test of #115 to #122 (#133): the ride buttons show the
// calf, the view turns by itself at most one time for a task and never twice in half a minute, a
// frame at night has the light of the night from the first frame, and on a day of the pots the
// healer stays at the well with her mark and a star.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { createTurns, TURN_GAP } from '../src/world/turns.js';

test('the ride buttons show the slate calf of #122 with a child, and no arrow', () => {
  for (const f of ['ride', 'ride-off']) {
    const svg = readFileSync(new URL(`../art/ui/${f}.svg`, import.meta.url), 'utf8');
    assert.ok(svg.includes('fill="#6f685d"'), `${f}: the slate calf`);
    assert.ok(!svg.includes('fill="#a79f90"/><path d="M36,22'), `${f}: not the old grey animal`);
    assert.ok(!/stroke="#b3412a"/.test(svg), `${f}: no red arrow`);
    assert.ok(svg.includes('fill="#deb68a"'), `${f}: the child`);
  }
});

test('the view turns one time for a task, never for the hero in a task, and never twice in half a minute', () => {
  const t = createTurns();
  assert.ok(t.work('trial-scholar', 0));
  t.did(0);
  assert.ok(!t.work('trial-scholar', 40000), 'one turn for a task');
  assert.ok(!t.work('trial-healer', 10000), 'not within half a minute of the last turn');
  assert.ok(!t.still(40000, true), 'no turn for the hero in a task');
  assert.ok(t.still(TURN_GAP + 1, false));
  assert.ok(t.work('trial-fisher', TURN_GAP + 1));
});

test('at night the world has the light of the night from the first frame after a load, after a tap on a face, and after the eye', async () => {
  const s = load('tests/stories/trial-fisher.json');
  let first = null;
  let session = null;
  // 4:35 at night.
  const failures = await runHeadless({ ...s, clock: 3 * 1440 + 275, steps: [{ wait: 1 }] }, {
    onSession: (x) => {
      session = x;
      first = x.state.sky ? { ...x.state.sky } : null;
    },
  });
  assert.deepEqual(failures, []);
  assert.ok(first && first.night >= 0.5, `the first frame: ${JSON.stringify(first)}`);
  const run = (sec) => { for (let i = 0; i < sec / STEP; i++) { session.step(); session.events(); } };
  session.command({ type: 'tap', target: { person: 'npc:fisher' } });
  run(1);
  assert.ok(session.state.sky.night >= 0.5);
  session.command({ type: 'hands', id: session.action()?.id });
  run(1);
  assert.ok(session.state.sky.night >= 0.5);
});

test('on a day of the pots the healer stays at the well from 9:00 to 15:00, with her mark', async () => {
  const s = load('tests/stories/trial-fisher.json');
  const DAY = 9; // a day of the pots for this seed (tests/puzzles104.test.js)
  const check = async (minutes) => {
    let session = null;
    const profile = { ...s.profile, flags: { ...s.profile.flags, 'trial.healer.done': true } };
    const failures = await runHeadless({ ...s, profile, clock: DAY * 1440 + minutes, steps: [{ wait: 30 }] }, { onSession: (x) => { session = x; } });
    assert.deepEqual(failures, []);
    const well = session.puzzles.state().pots ? getEntity(session.state, 'pz:well')?.position : null;
    const healer = getEntity(session.state, 'npc:healer');
    return { well, healer, mark: getEntity(session.state, 'pz:mark:pots') };
  };
  // (Thirty seconds of play are about forty minutes of the clock.)
  for (const m of [9 * 60 + 10, 13 * 60 + 30]) {
    const r = await check(m);
    assert.ok(r.well, 'the pots are out');
    const d = Math.hypot(r.healer.position.x - r.well.x, r.healer.position.z - r.well.z);
    assert.ok(d <= 12, `at ${m / 60}: the healer is ${d.toFixed(1)} half blocks from the well`);
    assert.ok(r.mark, 'her mark');
  }
});
