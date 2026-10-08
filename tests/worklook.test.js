// What a child sees of the work (#48): each result of an act is on a phone held upright, and it
// looks different from what was there before. The rules of the work are in tests/tasks.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { figureOf, thingLook, CHALK_BAND, FISH_JUMP } from '../src/world/figures.js';
import { sessionCamera, viewCamera } from '../src/world/hit.js';
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

test('the rods on the mat lie in rows of five with a space between two rods, all on the mat (#61)', async () => {
  const session = await practice('bo-que', [...startTeacher, rods(10)]);
  const mat = getEntity(session.state, 'zone:mat').zone;
  const at = mat.items.map((id) => getEntity(session.state, id).position);
  assert.equal(at.length, 10);
  const xs = [...new Set(at.map((p) => p.x.toFixed(2)))].map(Number).sort((a, b) => a - b);
  const zs = [...new Set(at.map((p) => p.z.toFixed(2)))];
  assert.equal(xs.length, 5, 'five rods in a row');
  assert.equal(zs.length, 2, 'two rows');
  const width = figureOf({ kind: 'rod' }, 'coarse').parts.find((p) => p.name === 'stick' || p.id === 'stick')?.size?.[0] ?? 0.4;
  for (let k = 1; k < xs.length; k++) assert.ok(xs[k] - xs[k - 1] >= width + 0.3, 'a space between two rods');
  // The picture of the mat: 4.4 by 2.6 half blocks from 0.2 before its point.
  for (const p of at) {
    assert.ok(p.x - width / 2 >= mat.x - 0.2 && p.x + width / 2 <= mat.x + 4.2, 'on the mat across');
    assert.ok(p.z - 0.6 >= mat.z - 0.1 && p.z + 0.6 <= mat.z + 2.5, 'on the mat along');
  }
});

test('a rod is more than 4 pixels wide on a phone at the zoom of the start, and the hero stands on the far side of the mat (#61)', async () => {
  const f = figureOf({ kind: 'rod' }, 'coarse');
  const width = Math.min(...f.parts.map((p) => p.size[0]));
  for (const az of ANGLES) {
    const cam = viewCamera({ focus: { x: 0, y: 0, z: 0 }, az, level: 0, width: 390, height: 844 });
    const a = cam.project(0, 0, 0);
    const b = cam.project(width / 2, 0, 0);
    assert.ok(Math.hypot(b.x - a.x, b.y - a.y) > 4, `the width of a rod from ${az.toFixed(2)}: ${Math.hypot(b.x - a.x, b.y - a.y).toFixed(1)} px`);
  }
  // The hero works at the mat from the place of the mat: from the camera of the start, that place
  // is behind the mat (higher on the screen), so the hero does not hide the rods.
  const session = await practice('bo-que', startTeacher);
  const mat = getEntity(session.state, 'zone:mat');
  const stand = mat.zone.stand ?? mat.position;
  const r = mat.zone.rect;
  const cam = viewCamera({ focus: { x: stand.x / 2, y: 0, z: stand.z / 2 }, az: Math.PI / 4, level: 0, width: 390, height: 844 });
  const middle = cam.project((r.x0 + r.x1) / 4, 0, (r.z0 + r.z1) / 4);
  const hero = cam.project(stand.x / 2, 0, stand.z / 2);
  assert.ok(hero.y < middle.y, `the hero is behind the mat: ${hero.y.toFixed(0)} above ${middle.y.toFixed(0)}`);
});

test('the animals stay out of the places of an open task, 2 half blocks around: no chicken walks over the rods (#61)', async () => {
  const { taskPlaces, PLACE_MARGIN } = await import('../src/core/world/systems/steer.js');
  const session = await practice('bo-que', startTeacher);
  const places = taskPlaces(session.state);
  assert.ok(places.length >= 2, 'the mat and the heap');
  const mat = getEntity(session.state, 'zone:mat').position;
  const near = session.state.entities.filter((e) => e.kind && e.position && !e.hidden && Math.hypot(e.position.x - mat.x, e.position.z - mat.z) < 30);
  assert.ok(near.length > 0, 'animals live near the mat');
  let inside = 0;
  for (let i = 0; i < 30 * 90; i++) {
    session.step();
    session.events();
    if (i < 30 * 5) continue;
    for (const e of near) if (places.some((r) => e.position.x > r.x0 + PLACE_MARGIN / 2 && e.position.x < r.x1 - PLACE_MARGIN / 2 && e.position.z > r.z0 + PLACE_MARGIN / 2 && e.position.z < r.z1 - PLACE_MARGIN / 2)) inside++;
  }
  assert.equal(inside, 0, 'no animal in a place');
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

test('perilla is indigo below and green on top, and each bed has a sign with a picture of its herb and no word (#61)', async () => {
  const tiato = figureOf({ kind: 'herb', herb: 'tiato' }, 'coarse').parts;
  const low = tiato.filter((p) => p.color !== 'greenDeep').reduce((a, b) => (b.at[1] < a.at[1] ? b : a));
  const high = tiato.reduce((a, b) => (b.at[1] > a.at[1] ? b : a));
  assert.equal(low.color, 'indigo', 'the leaves below');
  assert.equal(high.color, 'green', 'the leaves on top');
  const seen = [];
  const session = await practice('hai-thuoc', [{ until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } }, { read: true }]);
  for (const k of ['ngai', 'tiato', 'rauma']) {
    const sign = getEntity(session.state, `sign:healer:bed-${k}`);
    assert.ok(sign, `a sign at the bed of ${k}`);
    assert.equal(sign.look, `herb-sign-${k}`);
    const f = figureOf(thingLook(sign.look), 'coarse');
    const herb = figureOf({ kind: 'herb', herb: k }, 'coarse');
    const tones = new Set(herb.parts.map((p) => p.color));
    assert.ok(f.parts.some((p) => tones.has(p.color) && p.name !== 'post'), `the picture of ${k} has its tones`);
    seen.push(k);
  }
  assert.equal(seen.length, 3);
});

test('the healer says the name of the herb when the child takes a bunch, and after a tap on a bed (#61)', async () => {
  const lines = [];
  const failures = await runHeadless({ name: 'herb-names', practice: 'hai-thuoc', profile, steps: [
    { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } },
    { read: true },
    { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 15 } },
    { press: { item: 'herb-tiato' } },
    { until: { event: 'put', timeout: 15 } },
    { tap: { item: 'herb-rauma' } },
    { wait: 1 },
  ] }, { onSession: (s) => s.listen((ev) => ev.type === 'open' && ev.screen === 'callout' && lines.push(ev.textKey)) });
  assert.deepEqual(failures, []);
  assert.ok(lines.includes('healer.herb.tiato'), `the name of the bunch: ${lines.join(', ')}`);
  assert.ok(lines.includes('healer.bed.rauma'), `the name of the bed: ${lines.join(', ')}`);
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
