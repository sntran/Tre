// The woodcutter (#80): the chalk goes at the ring of the tap or at the feet of the hero, and its
// ghost is bright; a tap on the middle of the stem does not walk around it; a tap on a mark takes it
// off at once, and after a cut with too many pieces he shows it one time; Nghé never stands on the
// stem or a piece; a right cut is counted; and two waves give one count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity } from '../src/core/world/state.js';

const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
const start = [
  { press: { entity: 'npc:woodcutter' } },
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
  { read: true },
  { until: { event: 'call', with: { key: 'mentor.woodcutter.first' }, timeout: 15 } },
];
async function atStem(steps = [], hook = () => {}) {
  let session = null;
  const failures = await runHeadless({ name: 'stem-80', profile, clock: 540, at: ['phu-dong', 51, 8.5], steps: [...start, ...steps] }, { onSession: (s) => { session = s; hook(s); } });
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
const send = (session, cmd) => {
  session.command(cmd);
  session.events();
};
function calls(session) {
  const out = [];
  session.listen((ev) => { if (ev.type === 'call') out.push({ key: ev.key, params: ev.params ?? {} }); else if (['chop', 'snap'].includes(ev.type)) out.push({ key: ev.type }); });
  return out;
}
const marks = (session) => getEntity(session.state, 'zone:trial-woodcutter').zone.marks;

test('with no tap, the chalk goes at the ring at the feet of the hero, whichever way the hero faces, and its ghost is bright', async () => {
  for (const facing of [Math.PI / 2, -Math.PI / 2]) {
    const session = await atStem();
    const stem = getEntity(session.state, 'stem:woodcutter');
    const hero = getEntity(session.state, 'hero');
    Object.assign(hero.position, { x: stem.position.x + 4, z: stem.position.z - 2, facing });
    delete hero.route;
    run(session, 0.5);
    const a = session.action();
    assert.equal(a?.act, 'mark');
    assert.equal(Math.round(a.ghost.x - stem.position.x), 4, `facing ${facing.toFixed(2)}: the ghost at the feet`);
    assert.ok(a.ghost.bright, 'the ghost is bright');
    send(session, { type: 'hands', id: a.id });
    run(session, 1);
    assert.deepEqual(marks(session), [4]);
  }
});

test('a tap on the middle of the stem walks the hero to that ring on its own side, never around an end', async () => {
  for (const side of [-1, 1]) {
    const session = await atStem();
    const stem = getEntity(session.state, 'stem:woodcutter');
    const hero = getEntity(session.state, 'hero');
    Object.assign(hero.position, { x: stem.position.x + 1, z: stem.position.z + side * 2.5 });
    delete hero.route;
    run(session, 0.5);
    send(session, { type: 'tap', target: { thing: stem.id, along: 4 } });
    run(session, 0.3);
    run(session, 12, () => !hero.route);
    assert.equal(Math.sign(hero.position.z - stem.position.z), side, `the hero stays on its side (${side})`);
    assert.ok(Math.abs(hero.position.x - (stem.position.x + 4)) <= 1.2, `at the ring: ${(hero.position.x - stem.position.x).toFixed(1)}`);
  }
});

test('a tap on a mark takes it off at once; after a cut with too many pieces, the woodcutter shows it one time on a mark', async () => {
  // Marks at 2, 4, and 6 give four pieces, and he needs two.
  const session = await atStem([
    { press: { stem: 2 } }, { until: { event: 'mark', timeout: 10 } },
    { press: { stem: 4 } }, { until: { event: 'mark', timeout: 10 } },
    { press: { stem: 6 } }, { until: { event: 'mark', timeout: 10 } },
  ]);
  const stem = getEntity(session.state, 'stem:woodcutter');
  send(session, { type: 'tap', target: { thing: stem.id, along: 6 } });
  run(session, 0.3);
  assert.deepEqual(marks(session), [2, 4], 'the tap took the mark off');
  send(session, { type: 'tap', target: { thing: stem.id, along: 6 } });
  run(session, 0.3);
  run(session, 10, () => !getEntity(session.state, 'hero').route);
  send(session, { type: 'hands', id: session.action()?.id });
  run(session, 1);
  assert.deepEqual(marks(session), [2, 4, 6]);
  const lines = calls(session);
  send(session, { type: 'tap', target: { person: 'npc:woodcutter' } });
  send(session, { type: 'hands' });
  run(session, 40, () => !getEntity(session.state, 'zone:trial-woodcutter').zone.cut && lines.some((l) => l.key === 'woodcutter.pieces'));
  run(session, 15, () => !getEntity(session.state, 'zone:trial-woodcutter').zone.cut);
  // Too many marks again: he shows the erase on a mark, one time.
  for (const at of [2, 4, 6, 3]) {
    send(session, { type: 'tap', target: { thing: stem.id, along: at } });
    run(session, 0.3);
    run(session, 10, () => !getEntity(session.state, 'hero').route);
    if (!marks(session).includes(at)) send(session, { type: 'hands', id: session.action()?.id });
    run(session, 4);
  }
  assert.equal(lines.filter((l) => l.key === 'mentor.woodcutter.erase').length, 1, lines.map((l) => l.key).join(' '));
});

test('Nghé never stands on the stem', async () => {
  const session = await atStem();
  const stem = getEntity(session.state, 'stem:woodcutter');
  const nghe = getEntity(session.state, 'friend:nghe');
  Object.assign(nghe.position, { x: stem.position.x + 4, z: stem.position.z });
  run(session, 3);
  assert.ok(Math.abs(nghe.position.z - stem.position.z) >= 0.8 + 1.5 || nghe.position.x < stem.position.x - 2 || nghe.position.x > stem.position.x + 10, `Nghé is off the stem: ${(nghe.position.z - stem.position.z).toFixed(2)}`);
});

test('a right cut is counted: he counts the rings of each piece, says that the pieces are equal, and then the sticks come', async () => {
  const session = await atStem([{ press: { stem: 4 } }, { until: { event: 'mark', timeout: 10 } }]);
  const lines = calls(session);
  send(session, { type: 'tap', target: { person: 'npc:woodcutter' } });
  send(session, { type: 'hands' });
  run(session, 40, () => lines.some((l) => l.key === 'chop'));
  const keys = lines.map((l) => l.key);
  assert.equal(keys.filter((k) => k === 'woodcutter.piece').length, 2, keys.join(' '));
  const equal = lines.find((l) => l.key === 'woodcutter.equal');
  assert.equal(equal?.params.n.key, 'num.2', keys.join(' '));
  assert.ok(keys.indexOf('woodcutter.equal') < keys.indexOf('chop'), 'the line before the sticks');
  assert.ok(getEntity(session.state, 'sticks:woodcutter'), 'the sticks');
});

test('waves while he counts give no second count', async () => {
  const session = await atStem([{ press: { stem: 3 } }, { until: { event: 'mark', timeout: 10 } }]);
  const lines = calls(session);
  // The mark of the mentor counts the pieces between the marks; the child waves two times then.
  send(session, { type: 'mentor', key: 'trial-woodcutter', move: 'mark' });
  run(session, 1);
  send(session, { type: 'wave' });
  run(session, 1);
  send(session, { type: 'wave' });
  run(session, 30);
  assert.equal(lines.filter((l) => l.key === 'woodcutter.piece').length, 2, `one count of two pieces: ${lines.map((l) => l.key).join(' ')}`);
});
