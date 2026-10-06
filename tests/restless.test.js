// A restless child plays each trial, station, and folk game from its practice link (#44,
// tests/restless.js): seeded random taps, presses, holds, jumps, walks, reads, and waves. The laws
// of tests/restless.js hold for every activity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, data } from './story-run.js';
import { playRestless } from './restless.js';

for (const a of data.practice.activities) {
  test(`a restless child at ${a.id}: no error, no thing on the ground by its place, no line again and again, taps walk, the work on the screen`, async () => {
    let session = null;
    const failures = await runHeadless({ name: `restless-${a.id}`, practice: a.id, profile: { name: 'An', grade: 2, lang: 'vi', seed: 3, flags: {} }, steps: [] }, { onSession: (s) => { session = s; } });
    assert.deepEqual(failures, []);
    const broken = [...playRestless(session, { steps: 260, seed: 1 }), ...playRestless(session, { steps: 260, seed: 2 })];
    assert.deepEqual([...new Set(broken)], []);
  });
}
