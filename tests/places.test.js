// The places of the tasks (#76): no face of another person on the work, Nghé off the mat, the hero
// behind the anvil and never in a person, a stake for the row after a stake at the float, a tide
// that waits for a stake in the hands, and an evening that waits for the end of a task.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity, query } from '../src/core/world/state.js';

const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
const FIRST = { woodcutter: 'mentor.woodcutter.first', smith: 'smith.quench.watch' };
const start = (npc) => [
  { press: { entity: `npc:${npc}` } },
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
  { read: true },
  { until: { event: 'call', with: { key: FIRST[npc] ?? 'mentor.first.you' }, timeout: 15 } },
];
async function play(at, steps, { clock = 540, hook = () => {} } = {}) {
  let session = null;
  const failures = await runHeadless({ name: 'places-76', profile, clock, at: ['phu-dong', ...at], steps }, { onSession: (s) => { session = s; hook(s); } });
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
const TEACHER = [54, 27];
const SMITH = [53, 43];
const FISHER = [27, 64.5];

test('while the child works at a task, the session names the task of the place (the faces of other people do not show then)', async () => {
  const session = await play(TEACHER, start('teacher'));
  assert.equal(session.taskHere(), 'trial-scholar');
  const hero = getEntity(session.state, 'hero');
  Object.assign(hero.position, { x: hero.position.x + 80, z: hero.position.z + 40 });
  delete hero.route;
  run(session, 0.5);
  assert.equal(session.taskHere(), null, 'away from the place, the faces come back');
});

test('Nghé never lies on the mat: the body of Nghé stays out of the places of the task, also at night', async () => {
  const session = await play(TEACHER, start('teacher'), { clock: 21 * 60 });
  const mat = getEntity(session.state, 'zone:mat').zone.rect;
  const nghe = getEntity(session.state, 'friend:nghe');
  // Nghé at the end of the mat, just out of its rect (its body on the rods).
  Object.assign(nghe.position, { x: mat.x1 + 0.5, z: (mat.z0 + mat.z1) / 2 });
  run(session, 4);
  const out = Math.max(mat.x0 - nghe.position.x, nghe.position.x - mat.x1, mat.z0 - nghe.position.z, nghe.position.z - mat.z1);
  assert.ok(out >= 1.5, `the body of Nghé is off the mat: ${out.toFixed(2)} half blocks out`);
});

test('the hero stands at the anvil on the side away from the camera, for each angle of the view', async () => {
  for (const az of [Math.PI / 4, (5 * Math.PI) / 4]) {
    const session = await play(SMITH, [], { hook: (s) => s.command({ type: 'view', az }) });
    send(session, { type: 'view', az });
    const anvil = getEntity(session.state, 'zone:trial-smith')?.zone.anvil;
    send(session, { type: 'tap', target: { thing: 'iron:smith' } });
    const hero = getEntity(session.state, 'hero');
    const steps = [{ press: { entity: 'npc:smith' } }, { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } }, { read: true }];
    void steps;
    if (!anvil) {
      // The trial opens with the talk of the smith.
      send(session, { type: 'tap', target: { person: 'npc:smith' } });
      send(session, { type: 'hands' });
      run(session, 30, () => Boolean(getEntity(session.state, 'zone:trial-smith')?.zone.anvil) && !session.screen);
    }
    const a = getEntity(session.state, 'zone:trial-smith').zone.anvil;
    run(session, 3);
    send(session, { type: 'tap', target: { thing: 'iron:smith' } });
    run(session, 0.3);
    run(session, 15, () => !hero.route);
    // The camera looks from (sin, cos) of the angle: the hero is on the other side of the anvil.
    const toCam = (hero.position.x - a.x) * Math.sin(az) + (hero.position.z - a.z) * Math.cos(az);
    assert.ok(toCam < 0, `angle ${az.toFixed(2)}: the hero is behind the anvil (${toCam.toFixed(2)})`);
  }
});

test('the hero never stands in a person: when the teacher walks into a hero who stands still, the hero steps out', async () => {
  const session = await play(TEACHER, start('teacher'));
  const teacher = getEntity(session.state, 'npc:teacher');
  const hero = getEntity(session.state, 'hero');
  // The teacher stands where the hero stands (he walked into the hero at his mat), and stays there.
  const at = { x: hero.position.x + 0.2, z: hero.position.z + 0.1 };
  for (let i = 0; i < 3 / STEP; i++) {
    Object.assign(teacher.position, at);
    session.step();
    session.events();
  }
  const d = Math.hypot(hero.position.x - teacher.position.x, hero.position.z - teacher.position.z);
  assert.ok(d >= 1.8, `the hero is out of the teacher: ${d.toFixed(2)} half blocks`);
});

test('after a wrong row with a stake at the float, a press at the pile takes a stake, and a press at the row puts it at a free point', async () => {
  const line = (n) => [{ press: { thing: `stake:fisher:${n}` } }, { until: { event: 'pick', timeout: 15 } }];
  const put = (at) => [{ tap: { line: at } }, { wait: 2 }, { press: true }, { until: { event: 'put', timeout: 15 } }];
  const session = await play(FISHER, [...start('fisher'), ...line(2), ...put(8), ...line(3), ...put(16)]);
  const z = getEntity(session.state, 'zone:line').zone;
  const slots = query(session.state, 'item').filter((e) => e.item.zone === 'line').map((e) => e.item.slot).sort((a, b) => a - b);
  assert.ok(slots.includes(z.length), `a stake at the float: ${slots.join(',')}`);
  // The hero at the pile: the button picks a stake.
  const pile = getEntity(session.state, 'zone:stakes');
  const hero = getEntity(session.state, 'hero');
  Object.assign(hero.position, { x: pile.position.x + 1.5, z: pile.position.z });
  delete hero.route;
  run(session, 1.5);
  assert.equal(session.action()?.act, 'pick', 'the pile gives a stake');
  send(session, { type: 'hands', id: session.action().id });
  run(session, 3);
  assert.ok(session.carried(), 'a stake in the hands');
  // At the float, a press puts it at the free point nearest to the hero.
  Object.assign(hero.position, { x: z.x + z.length - 0.5, z: z.z - 2 });
  delete hero.route;
  run(session, 1.5);
  const a = session.action();
  assert.equal(a?.act, 'put', `the button puts it on the row: ${a?.act}`);
  assert.ok(a.ghost && !slots.includes(Math.round(a.ghost.x - z.x)), 'at a free point');
});

test('the tide waits while the child carries a stake to the row', async () => {
  const events = [];
  const session = await play(FISHER, [...start('fisher'), { press: { thing: 'stake:fisher:2' } }, { until: { event: 'pick', timeout: 15 } }, { tap: { line: 8 } }, { wait: 2 }, { press: true }, { until: { event: 'put', timeout: 15 } }, { press: { thing: 'stake:fisher:3' } }, { until: { event: 'pick', timeout: 15 } }], { hook: (s) => s.listen((ev) => events.push(ev.type)) });
  assert.ok(session.carried(), 'a stake in the hands');
  run(session, 120);
  assert.ok(!events.includes('tide'), 'no tide while the stake is in the hands');
  send(session, { type: 'tap', target: { line: 12 } });
  run(session, 2);
  send(session, { type: 'hands' });
  run(session, 3);
  assert.ok(!session.carried(), 'the stake is on the row');
  run(session, 20, () => events.includes('tide'));
  assert.ok(events.includes('tide'), 'then the tide comes');
});

test('the evening waits for the end of a task: at the place of an open task the clock stays in the late afternoon', async () => {
  const session = await play(TEACHER, start('teacher'), { clock: 16 * 60 + 20 });
  // The child thinks and does nothing for a long time.
  run(session, 150);
  const day = session.state.clock.minutes % 1440;
  assert.ok(day < 16.5 * 60 + 1, `the evening waits: ${Math.floor(day / 60)}:${String(Math.floor(day % 60)).padStart(2, '0')}`);
  assert.ok(day >= 16.5 * 60 - 1, 'the clock goes up to the late afternoon');
  // The child leaves the place of the task: the evening comes.
  const hero = getEntity(session.state, 'hero');
  Object.assign(hero.position, { x: hero.position.x + 80, z: hero.position.z + 40 });
  delete hero.route;
  run(session, 40);
  assert.ok(session.state.clock.minutes % 1440 > day + 20, `away from the task the clock goes on: ${session.state.clock.minutes % 1440} (screen ${session.screen})`);
});
