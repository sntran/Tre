// What a child sees of the work (#48): each result of an act is on a phone held upright, and it
// looks different from what was there before. The rules of the work are in tests/tasks.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { figureOf, thingLook, CHALK_BAND, FISH_JUMP } from '../src/world/figures.js';
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
// One press at the heap puts one rod on the mat (#61).
const rods = (n) => ({ repeat: n, steps: [{ press: { item: 'rod' } }, { until: { event: 'put', timeout: 10 } }] });
const startTeacher = [
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } },
  { read: true },
  { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 15 } },
];

test('the band of the teacher snaps on nine rods: the rods stay on the mat to be counted, and none goes back on the heap (#48, #61)', async () => {
  const session = await practice('bo-que', [...startTeacher, rods(9), { press: { entity: 'npc:teacher' } }, { until: { event: 'snap', timeout: 10 } }]);
  const onMat = () => getEntity(session.state, 'zone:mat').zone.items.length;
  assert.equal(onMat(), 9, 'the nine rods stay on the mat');
  for (let k = 0; k < 200; k++) { session.step(); session.events(); }
  assert.equal(onMat(), 9, 'no rod is over ten: none rolls back');
  assert.equal(getEntity(session.state, 'zone:rods').zone.items.length, 15, 'the heap keeps the other rods');
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

test('the fish of the trap of the fisher jump over the water, where the ducks swim: the child sees the catch and the escape (#48)', () => {
  const life = JSON.parse(readFileSync('data/world/life.json', 'utf8'));
  const swim = Math.max(...Object.values(life.kinds).map((k) => k.steer?.float ?? 0));
  for (const name of ['fish-in', 'fish-out']) {
    const f = figureOf(JSON.parse(readFileSync('data/figures.json', 'utf8')).figures[name], 'coarse');
    const low = Math.min(...f.parts.map((p) => p.at[1] - p.size[1] / 2));
    assert.ok(low >= swim - 0.1, `${name}: the fish are under the water (${low} < ${swim})`);
  }
  assert.ok(FISH_JUMP > swim);
});

test('the fish that swim out of a row that is too short are over the river, not under the bank (#48)', async () => {
  const session = await practice('cam-coc', [
    { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } },
    { read: true },
    { press: { thing: 'stake:fisher:2' } },
    { until: { event: 'pick', timeout: 15 } },
    { tap: { line: 9 } },
    { wait: 2 },
    { press: true },
    { until: { event: 'put', timeout: 15 } },
    { until: { event: 'escape', timeout: 200 } },
  ]);
  const fish = getEntity(session.state, 'fish:fisher');
  assert.ok(fish, 'the fish swim out');
  const f = figureOf(JSON.parse(readFileSync('data/figures.json', 'utf8')).figures[fish.look], 'coarse');
  for (const p of f.parts) {
    const x = fish.position.x + p.at[0];
    const z = fish.position.z + p.at[2];
    const ground = session.env.groundY(x / 2, z / 2);
    assert.ok(fish.position.y + p.at[1] - p.size[1] / 2 > ground, `${p.name} is under the ground (${ground})`);
  }
});

test('the goal bar says the work of each step: two steps with the same text have the same work, or both are a walk to a place (#48)', () => {
  const quests = JSON.parse(readFileSync(new URL('../data/quests.json', import.meta.url), 'utf8'));
  const vi = JSON.parse(readFileSync(new URL('../i18n/vi.json', import.meta.url), 'utf8'));
  const byText = new Map();
  for (const q of quests.quests) for (const st of q.steps) byText.set(vi[st.goalKey], [...(byText.get(vi[st.goalKey]) ?? []), st]);
  for (const [text, steps] of byText) {
    if (steps.length < 2 || steps.every((st) => st.place)) continue;
    const works = new Set(steps.map((st) => JSON.stringify(st.done)));
    assert.equal(works.size, 1, `"${text}" is the goal of steps with other work: ${steps.map((st) => st.goalKey).join(', ')}`);
  }
});

test('in the practice of the woodcutter the wood pile is next to the stem, on the screen with it (#48: not 55 blocks away by the bridge)', async () => {
  const session = await practice('chat-tre', [
    { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } },
    { read: true },
    { until: { event: 'call', with: { key: 'mentor.woodcutter.first' }, timeout: 15 } },
  ]);
  const stem = getEntity(session.state, 'stem:woodcutter').position;
  const pile = getEntity(session.state, 'zone:woodpile').zone;
  assert.ok(Math.hypot(pile.x - stem.x, pile.z - stem.z) < 20, 'the pile is near the stem');
  assert.ok(ANGLES.some((az) => onPhone(session, pile, az) && onPhone(session, stem, az)), 'the stem and the pile are on one screen');
});
