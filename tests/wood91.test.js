// The woodcutter of the play test of #85 to #89 (#91): a tap and two presses make one mark, the
// line of how to add a mark after too few pieces, the example in view, and help sooner for the
// youngest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity } from '../src/core/world/state.js';

const profile = (grade = 1) => ({ name: 'An', grade, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } });
const start = [
  { press: { entity: 'npc:woodcutter' } },
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
  { read: true },
  { until: { event: 'call', with: { key: 'mentor.woodcutter.first' }, timeout: 15 } },
];
async function atStem(steps = [], hook = () => {}, grade = 1) {
  let session = null;
  const failures = await runHeadless({ name: 'wood-91', profile: profile(grade), clock: 540, at: ['phu-dong', 51, 8.5], steps: [...start, ...steps] }, { onSession: (s) => { session = s; hook(s); } });
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
const marks = (session) => getEntity(session.state, 'zone:trial-woodcutter').zone.marks;

test('a tap on the stem and two quick presses make one mark, and then the button is the knife', async () => {
  const session = await atStem();
  const stem = getEntity(session.state, 'stem:woodcutter');
  const hero = getEntity(session.state, 'hero');
  // The hero stands at the stem, near ring 1; the tap is on ring 4, in reach: no walk.
  Object.assign(hero.position, { x: stem.position.x + 1, z: stem.position.z + 2.5 });
  delete hero.route;
  run(session, 0.5);
  send(session, { type: 'tap', target: { thing: stem.id, along: 4 } });
  run(session, 0.3);
  send(session, { type: 'hands' });
  run(session, 0.25);
  send(session, { type: 'hands' });
  run(session, 0.5);
  assert.deepEqual(marks(session), [4], 'one mark, at the ring of the tap');
  run(session, 6, () => !hero.route);
  assert.ok(Math.abs(hero.position.x - (stem.position.x + 4)) <= 1.2, `the hero walked to the ring: ${(hero.position.x - stem.position.x).toFixed(1)}`);
  assert.equal(session.action()?.act, 'cut', 'then the button is the knife');
});

test('after a cut with too few pieces, the woodcutter says how to add a mark, and the free rings glow until the child walks', async () => {
  const keys = [];
  const session = await atStem([], (s) => { s.listen((ev) => { if (ev.type === 'call') keys.push(ev.key); }); });
  const stem = getEntity(session.state, 'stem:woodcutter');
  const hero = getEntity(session.state, 'hero');
  Object.assign(hero.position, { x: stem.position.x + 3, z: stem.position.z + 2.5 });
  delete hero.route;
  run(session, 0.5);
  send(session, { type: 'tap', target: { thing: stem.id, along: 3 } });
  run(session, 0.3);
  send(session, { type: 'hands' });
  run(session, 1.5);
  // One mark gives two pieces; the task of level 1 needs three. With fewer marks than the level
  // needs, the button stays the chalk; a tap on the woodcutter cuts (#118).
  getEntity(session.state, 'zone:trial-woodcutter').zone.level = 1;
  send(session, { type: 'tap', target: { person: 'npc:woodcutter' } });
  run(session, 3);
  send(session, { type: 'hands' });
  run(session, 40, () => keys.includes('woodcutter.addMark'));
  assert.ok(keys.includes('woodcutter.addMark'), `the line of how to add a mark: ${keys.join(', ')}`);
  const glows = () => session.state.entities.filter((e) => String(e.id).startsWith('why:woodcutter:free:'));
  assert.ok(glows().length > 0, 'the free rings glow');
  run(session, 2);
  assert.ok(glows().length > 0, 'they glow while the child waits');
  send(session, { type: 'move', id: 'hero', dx: 1, dz: 0, strength: 1 });
  run(session, 1.5);
  send(session, { type: 'move', id: 'hero', dx: 0, dz: 0, strength: 0 });
  run(session, 0.5);
  assert.equal(glows().length, 0, 'the glow ends when the child walks');
});

test('while the woodcutter is away, Nghé says how to add a mark (#91)', async () => {
  const calls = [];
  const session = await atStem([], (s) => { s.listen((ev) => { if (ev.type === 'call') calls.push(`${ev.id} ${ev.key}`); }); });
  const stem = getEntity(session.state, 'stem:woodcutter');
  const hero = getEntity(session.state, 'hero');
  Object.assign(hero.position, { x: stem.position.x + 3, z: stem.position.z + 2.5 });
  delete hero.route;
  run(session, 0.5);
  send(session, { type: 'tap', target: { thing: stem.id, along: 3 } });
  run(session, 0.3);
  send(session, { type: 'hands' });
  run(session, 1.5);
  getEntity(session.state, 'zone:trial-woodcutter').zone.level = 1;
  send(session, { type: 'tap', target: { person: 'npc:woodcutter' } });
  run(session, 3);
  send(session, { type: 'hands' });
  // He goes away while he counts the pieces.
  const man = getEntity(session.state, 'npc:woodcutter');
  run(session, 40, () => {
    if (calls.some((c) => /woodcutter.pieces/.test(c))) Object.assign(man.position, { x: stem.position.x + 60, z: stem.position.z });
    return calls.some((c) => /addMark/.test(c));
  });
  assert.ok(calls.includes('friend:nghe mentor.nghe.woodcutter.addMark'), calls.join(', '));
});

test('a child of grade K gets the halving on a short stem after two cuts that are not equal; a child of grade 2 does not', async () => {
  for (const grade of [0, 2]) {
    const keys = [];
    const looks = new Set();
    const session = await atStem([], (s) => {
      s.listen((ev) => { if (ev.type === 'open' || ev.type === 'call') keys.push(ev.textKey ?? ev.key); });
      s.listen(() => { for (const e of s.state.entities) if (e.demo) looks.add(e.look); });
    }, grade);
    const stem = getEntity(session.state, 'stem:woodcutter');
    const hero = getEntity(session.state, 'hero');
    const len = getEntity(session.state, 'zone:trial-woodcutter').zone.stem.length;
    for (let k = 0; k < 2; k++) {
      Object.assign(hero.position, { x: stem.position.x + 3, z: stem.position.z + 2.5 });
      delete hero.route;
      run(session, 0.5);
      // A mark off the middle: two pieces that are not equal.
      send(session, { type: 'tap', target: { thing: stem.id, along: len / 2 - 1 } });
      run(session, 0.3);
      send(session, { type: 'hands' });
      run(session, 1.5);
      send(session, { type: 'hands' });
      run(session, 2);
      run(session, 180, () => !stem.hidden && !getEntity(session.state, 'zone:trial-woodcutter').zone.cut);
      run(session, 1);
    }
    run(session, 20);
    if (grade === 0) {
      assert.ok(keys.includes('mentor.woodcutter.demo'), `the line of the demonstration: ${keys.join(', ')}`);
      assert.ok(looks.has('stem-6') && looks.has('chalk-band'), `a short stem with a mark: ${[...looks].join(', ')}`);
    } else {
      assert.ok(!keys.includes('mentor.woodcutter.demo'), 'no demonstration at grade 2 after two cuts');
    }
  }
});
