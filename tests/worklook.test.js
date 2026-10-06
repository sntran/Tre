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

// The steps of a child at the teacher: n rods from the heap to the mat, and a tap on the teacher.
const rods = (n) => ({ repeat: n, steps: [{ press: { item: 'rod' } }, { until: { event: 'pick', timeout: 10 } }, { press: { screenOf: 'mat' } }, { until: { event: 'put', timeout: 10 } }] });
const startTeacher = [
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } },
  { read: true },
  { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 15 } },
];

test('the band of the teacher snaps: the rods spring apart off the mat with a puff, take no tap, and go back on the heap (#48)', async () => {
  const session = await practice('bo-que', [...startTeacher, rods(9), { press: { entity: 'npc:teacher' } }, { until: { event: 'snap', timeout: 10 } }]);
  const mat = getEntity(session.state, 'zone:mat');
  const loose = session.state.entities.filter((e) => e.item?.kind === 'rod' && e.item.zone === null && !e.item.held);
  assert.equal(loose.length, 9, 'nine rods lie apart');
  const r = mat.zone.rect;
  for (const e of loose) assert.ok(e.position.x < r.x0 || e.position.x > r.x1 || e.position.z < r.z0 || e.position.z > r.z1, 'off the mat');
  assert.ok(loose.every((e) => e.item.set), 'a tap does not take a rod that springs');
  for (let k = 0; k < 60; k++) { session.step(); session.events(); }
  assert.equal(getEntity(session.state, 'zone:rods').zone.items.length, 24, 'all the rods are back on the heap');
});

test('the bundles of the teacher stand in a row beside the mat, on a phone held upright, and the goal bar counts them as bundles (#48)', async () => {
  const session = await practice('bo-que', [...startTeacher, rods(10), { press: { entity: 'npc:teacher' } }, { until: { event: 'tie', timeout: 10 } }]);
  const bundle = getEntity(session.state, 'bundle:scholar:0');
  const r = getEntity(session.state, 'zone:mat').zone.rect;
  assert.ok(bundle.position.z > r.z1, 'beside the mat, on the side away from the teacher');
  for (const az of ANGLES) assert.ok(onPhone(session, bundle.position, az), `the bundle is on the screen from ${az.toFixed(2)}`);
  assert.deepEqual(session.workCount(), { pip: 'bundle', have: 1, need: 2 });
});

test('the three herbs of the healer have shapes that differ, not only colors: tall, wide, and low (#48)', () => {
  const box = (herb) => {
    const f = figureOf({ kind: 'herb', herb }, 'coarse');
    const top = Math.max(...f.parts.map((p) => p.at[1] + p.size[1] / 2));
    const wide = Math.max(...f.parts.map((p) => Math.max(p.size[0], p.size[2])));
    return { top, wide };
  };
  const [ngai, tiato, rauma] = ['ngai', 'tiato', 'rauma'].map(box);
  assert.ok(ngai.top > tiato.top + 0.4 && tiato.top > rauma.top + 0.3, 'the heights differ');
  assert.ok(tiato.wide > ngai.wide + 0.4 && tiato.wide > rauma.wide + 0.4, 'perilla is the wide one');
});
