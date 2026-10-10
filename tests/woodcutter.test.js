// The woodcutter (#75): after a cut the child sees the pieces and hears their count ring by ring,
// a cut with too few marks says the number of pieces, a tap beside the stem walks to that ring, the
// hero stands beside the stem on the side away from the camera, the first lines bring one new word
// each with its thing, and the wave points at the pieces between the marks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity } from '../src/core/world/state.js';
import { load } from './helpers.js';

const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
const start = [
  { press: { entity: 'npc:woodcutter' } },
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
  { read: true },
  { until: { event: 'call', with: { key: 'mentor.woodcutter.first' }, timeout: 15 } },
];
async function atStem(steps = [], hook = () => {}) {
  let session = null;
  const failures = await runHeadless({ name: 'woodcutter-75', profile, clock: 540, at: ['phu-dong', 51, 8.5], steps: [...start, ...steps] }, { onSession: (s) => { session = s; hook(s); } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  return session;
}
function run(session, seconds, until = () => false) {
  for (let i = 0; i < seconds / STEP && !until(); i++) {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
  }
}
function heardOf(session) {
  const calls = [];
  session.listen((ev) => { if (ev.type === 'call') calls.push({ key: ev.key, params: ev.params ?? {}, t: session.state.tick * STEP }); });
  return calls;
}

test('after a cut of 3 and 5 the pieces lie side by side, he counts the rings of each piece, and the short one glows and breaks after its line', async () => {
  const session = await atStem([
    // The stem is 8 long, for 2 equal sticks: a mark at 3 gives 3 and 5.
    { press: { stem: 3 } },
    { until: { event: 'mark', timeout: 10 } },
    { press: { entity: 'npc:woodcutter' } },
    { until: { event: 'snap', timeout: 10 } },
  ]);
  const calls = heardOf(session);
  const glows = [];
  session.listen((ev) => { if (ev.type === 'snap' && String(ev.id).startsWith('piece:woodcutter:')) glows.push('break'); });
  let rings = 0;
  let pieceGlow = false;
  for (let i = 0; i < 20 / STEP && !calls.some((c) => c.key === 'woodcutter.short'); i++) {
    run(session, STEP);
    rings = Math.max(rings, session.state.entities.filter((e) => e.look === 'ring-glow').length);
  }
  pieceGlow = session.state.entities.some((e) => /^piece-glow-3$/.test(e.look ?? ''));
  const keys = calls.map((c) => c.key);
  assert.deepEqual(keys.filter((k) => k === 'woodcutter.piece').length, 2, keys.join(' '));
  const first = keys.indexOf('woodcutter.piece');
  assert.deepEqual(keys.slice(first, first + 4), ['woodcutter.piece', 'num.1', 'num.2', 'num.3'], keys.join(' '));
  const second = keys.indexOf('woodcutter.piece', first + 1);
  assert.deepEqual(keys.slice(second + 1, second + 6), ['num.1', 'num.2', 'num.3', 'num.4', 'num.5'], keys.join(' '));
  assert.equal(rings, 8, 'each ring lights up at its number');
  assert.ok(pieceGlow, 'the short piece glows while he says it');
  assert.equal(session.state.entities.filter((e) => String(e.id).startsWith('piece:woodcutter:')).length, 2, 'both pieces lie there at the line');
  run(session, 2.5);
  assert.equal(session.state.entities.filter((e) => String(e.id).startsWith('piece:woodcutter:')).length, 1, 'then the short one breaks');
  assert.ok(!keys.includes('woodcutter.pieces'), 'two pieces are the number that he asked for');
});

test('a cut with the wrong number of pieces says the number of pieces and the number that he needs; equal pieces have no short one', async () => {
  // The stem is 8 long, for 2 equal sticks: marks at 2, 4, and 6 give four equal pieces.
  const session = await atStem([
    { press: { stem: 2 } },
    { until: { event: 'mark', timeout: 10 } },
    { press: { stem: 4 } },
    { until: { event: 'mark', timeout: 10 } },
    { press: { stem: 6 } },
    { until: { event: 'mark', timeout: 10 } },
  ]);
  const calls = heardOf(session);
  session.command({ type: 'tap', target: { person: 'npc:woodcutter' } });
  session.events();
  session.command({ type: 'hands' });
  session.events();
  run(session, 30, () => calls.some((c) => c.key === 'woodcutter.pieces'));
  const want = calls.find((c) => c.key === 'woodcutter.pieces');
  assert.ok(want, calls.map((c) => c.key).join(' '));
  assert.deepEqual([want.params.n.key, want.params.m.key], ['num.4', 'num.2']);
  assert.equal(session.state.entities.filter((e) => String(e.id).startsWith('piece:woodcutter:')).length, 4, 'the four pieces lie there at the line');
  const snaps = [];
  session.listen((ev) => { if (ev.type === 'snap' && String(ev.id).startsWith('piece:woodcutter:')) snaps.push(ev.id); });
  run(session, 8);
  assert.ok(!calls.some((c) => c.key === 'woodcutter.short'), `no short piece: ${calls.map((c) => c.key).join(' ')}`);
  assert.deepEqual(snaps, [], 'no piece breaks');
});

test('a tap beside the stem walks the hero to that ring, beside the stem on the side away from the camera, never on the stem', async () => {
  const session = await atStem();
  const stem = getEntity(session.state, 'stem:woodcutter');
  const hero = getEntity(session.state, 'hero');
  // A tap on the ground one half block beside ring 5 of the stem.
  const at = 5;
  session.command({ type: 'tap', target: { ground: { x: (stem.position.x + at) / 2, y: (stem.position.z + 1) / 2 } } });
  session.events();
  run(session, 0.3);
  run(session, 12, () => !hero.route);
  run(session, 0.5);
  assert.ok(Math.abs(hero.position.x - (stem.position.x + at)) <= 1.2, `the hero is at the ring: ${(hero.position.x - stem.position.x).toFixed(1)}`);
  assert.ok(Math.abs(hero.position.z - stem.position.z) >= 1, `the hero is beside the stem, not on it: ${(hero.position.z - stem.position.z).toFixed(1)}`);
  // The view looks from the south-east (the angle of the view, Math.PI / 4): the far side is north.
  assert.ok(hero.position.z < stem.position.z, 'the hero stands on the side away from the camera');
  const a = session.action();
  assert.equal(a?.act, 'mark');
  assert.ok(a.ghost && Math.abs(a.ghost.x - (stem.position.x + at)) < 0.01, 'the chalk shows at the ring of the tap');
});

test('the first lines bring one new word each, with its thing', () => {
  const vi = load('i18n/vi.json');
  const talk = load('data/dialogue/village.json').dialogues.find((d) => d.id === 'woodcutter.trial');
  const nodes = ['n1', 'n2', 'n3', 'n4'].map((k) => talk.nodes[k]);
  assert.deepEqual(nodes.map((n) => vi[n.textKey]), ['Đây là cây tre. Gió làm nó đổ.', 'Đây là phấn. Em vạch phấn ở chỗ cần chặt.', 'Anh cần {parts} khúc dài bằng nhau, như thế này.', 'Mang các khúc tre ra đống gỗ này nhé.']);
  assert.deepEqual(nodes[1].names, ['tool:woodcutter:chalk']);
  assert.ok(nodes[2].names.every((n) => n.startsWith('sample:woodcutter:')));
});

test('the chalk and a sample of equal pieces lie at the start of the stem', async () => {
  const session = await atStem();
  assert.ok(getEntity(session.state, 'tool:woodcutter:chalk'), 'the chalk');
  const z = getEntity(session.state, 'zone:trial-woodcutter').zone;
  const samples = session.state.entities.filter((e) => String(e.id).startsWith('sample:woodcutter:'));
  assert.ok(samples.length >= 2 && samples.every((e) => e.look === 'piece-2'), `the sample: ${samples.map((e) => e.look).join(' ')}`);
  void z;
});

test('the wave after a cut points at the pieces between the marks: each lights up and he counts its rings', async () => {
  const session = await atStem([
    { press: { stem: 3 } },
    { until: { event: 'mark', timeout: 10 } },
  ]);
  const calls = heardOf(session);
  session.command({ type: 'mentor', key: 'trial-woodcutter', move: 'mark' });
  session.events();
  let rings = 0;
  for (let i = 0; i < 15 / STEP && getEntity(session.state, 'script:trial-woodcutter') !== undefined; i++) {
    run(session, STEP);
    rings = Math.max(rings, session.state.entities.filter((e) => e.look === 'ring-glow').length);
  }
  const keys = calls.map((c) => c.key);
  assert.equal(keys.filter((k) => k === 'woodcutter.piece').length, 2, keys.join(' '));
  assert.equal(rings, getEntity(session.state, 'zone:trial-woodcutter').zone.stem.length, 'each ring of the stem lights up');
});
