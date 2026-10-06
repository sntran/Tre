// What a child sees of the work (#48): each result of an act is on a phone held upright, and it
// looks different from what was there before. The rules of the work are in tests/tasks.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { figureOf, thingLook, CHALK_BAND } from '../src/world/figures.js';
import { sessionCamera } from '../src/world/hit.js';
import { getEntity } from '../src/core/world/state.js';

const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
const ANGLES = [0, 1, 2, 3].map((k) => Math.PI / 4 + (k * Math.PI) / 2);
// Is a point (half blocks) on a phone held upright, inside the bars and the buttons?
const onPhone = (session, p, az) => {
  const q = sessionCamera(session, { az }).project(p.x / 2, p.y / 2, p.z / 2);
  return q.x > 8 && q.x < 382 && q.y > 140 && q.y < 680;
};
async function practice(id, steps = []) {
  let session = null;
  const failures = await runHeadless({ name: `look-${id}`, practice: id, profile, steps }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  return session;
}

test('a chalk mark is a band around the stem, larger than the stem, and the nodes of the stem are thinner than a mark', () => {
  const band = figureOf(thingLook('chalk-band'), 'coarse');
  const stem = figureOf({ kind: 'stem', n: 8 }, 'coarse');
  const part = (f, name) => f.parts.find((p) => p.name === name);
  const b = part(band, 'band');
  const seg = part(stem, 'seg0');
  const node = part(stem, 'node0');
  assert.ok(b.size[1] >= CHALK_BAND && b.size[2] >= CHALK_BAND && CHALK_BAND > seg.size[1] + 0.2, 'the band goes around the stem and out of it');
  assert.ok(node.size[1] < seg.size[1] + 0.1 && node.size[2] < b.size[0] / 2, 'a node is thin and close to the stem');
  // A cut piece of the stem has a look for each length.
  for (let n = 1; n < 12; n++) assert.equal(figureOf(thingLook(`piece-${n}`), 'coarse').parts.filter((p) => p.name.startsWith('seg')).length, n);
});

test('a chalk mark of the woodcutter is on a phone held upright, from the four angles', async () => {
  const session = await practice('chat-tre', [
    { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } },
    { read: true },
    { until: { event: 'call', with: { key: 'mentor.woodcutter.first' }, timeout: 15 } },
    { press: { stem: 3 } },
    { until: { event: 'mark', timeout: 10 } },
  ]);
  const mark = session.state.entities.find((e) => e.look === 'chalk-band');
  assert.ok(mark, 'a mark');
  const stem = getEntity(session.state, 'stem:woodcutter');
  assert.equal(mark.position.y, stem.position.y, 'the band stands on the ground with the stem');
  for (const az of ANGLES) assert.ok(onPhone(session, mark.position, az), `the mark is on the screen from ${az.toFixed(2)}`);
});
