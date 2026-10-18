// The hero cannot walk away from the teacher (#95): a tap always walks, and a step aside goes
// only to a point with a way back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity } from '../src/core/world/state.js';

const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
const start = [
  { press: { entity: 'npc:teacher' } },
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
  { read: true },
  { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 30 } },
];
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

test('from the cell next to the teacher with no way out for a plan, a tap on the heap walks the hero', async () => {
  let session = null;
  const failures = await runHeadless({ name: 'walk-95', profile, clock: 540, at: ['phu-dong', 54, 27], steps: start }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  const hero = getEntity(session.state, 'hero');
  Object.assign(hero.position, { x: 9414.5 * 2, z: 6270.9 * 2 });
  delete hero.route;
  run(session, 1);
  const rod = getEntity(session.state, 'zone:rods').zone.items[0];
  const from = { x: hero.position.x, z: hero.position.z };
  send(session, { type: 'tap', target: { thing: rod } });
  run(session, 4);
  const moved = Math.hypot(hero.position.x - from.x, hero.position.z - from.z);
  assert.ok(moved > 1, `the hero walked: ${moved.toFixed(2)} half blocks`);
});

// For each task, with the camera at each of its four angles: the walk to the star of the person,
// the talk, the first demonstration, and then a tap on the heap or the pile: the hero walks there.
const flags = { 'intro.seen': true, 'prologue.started': true, 'giong.spoke': true, 'elder.intro': true };
const cases = [
  { task: 'scholar', person: 'npc:teacher', at: [54, 27] },
  { task: 'smith', person: 'npc:smith', at: [53, 43] },
  { task: 'fisher', person: 'npc:fisher', at: [27, 64.5] },
  { task: 'healer', person: 'npc:healer', at: [33, 44] },
  { task: 'woodcutter', person: 'npc:woodcutter', at: [51, 8.5] },
  { task: 'bridge', at: [46, 61], flags: { 'trial.fisher.done': true } },
  { task: 'cart', event: 'cart', person: 'event:cart', at: [14.5, 80.5] },
  { task: 'duck', event: 'duck', person: 'event:duck', at: [22.5, 28.5] },
];
const near = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function target(s, task) {
  // The heap or the pile of the task (the forge, where the iron of the smith lies).
  const zones = s.state.entities.filter((e) => e.zone && ['heap', 'pile', 'forge'].includes(e.zone.rule) && e.zone.items.length && String(e.zone.task).replace(/^(trial-)?(event-)?/, '').startsWith(task));
  const id = zones.flatMap((z) => z.zone.items).find((i) => !getEntity(s.state, i)?.item?.held);
  if (id) return { thing: id, at: getEntity(s.state, id).position };
  const stem = getEntity(s.state, 'stem:woodcutter');
  return stem ? { thing: stem.id, along: 3, at: { x: stem.position.x + 3, z: stem.position.z } } : null;
}
for (const c of cases) {
  test(`${c.task}: from the end of the walk to the star and after the first demonstration, a tap on the heap walks the hero there, at each angle of the view`, async () => {
    for (const az of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      let s = null;
      const steps = [{ do: { type: 'view', az } }, ...(c.event ? [{ do: { type: 'event', id: c.event } }] : []), { wait: 0.5 }];
      const failures = await runHeadless({ name: `walk-${c.task}`, profile: { ...profile, flags: { ...flags, ...(c.flags ?? {}) } }, clock: 540, at: ['phu-dong', ...c.at], steps }, { onSession: (x) => { s = x; } });
      assert.deepEqual(failures, [], `${c.task} at ${az.toFixed(2)}`);
      const hero = getEntity(s.state, 'hero');
      const person = c.person ? getEntity(s.state, c.person) : null;
      if (person) {
        send(s, { type: 'tap', target: { ground: { x: person.position.x / 2, y: person.position.z / 2, h: 0, thing: false, object: null, goal: true } } });
        run(s, 40, () => !hero.route && near(hero.position, person.position) < 7);
        send(s, { type: 'hands' });
      }
      // The talk and the first demonstration.
      run(s, 25);
      const t = target(s, c.task);
      assert.ok(t, `${c.task}: a heap`);
      const before = near(hero.position, t.at);
      send(s, { type: 'tap', target: { thing: t.thing, ...(t.along ? { along: t.along } : {}) } });
      run(s, 12, () => !hero.route && near(hero.position, t.at) < before - 1);
      run(s, 8, () => !hero.route);
      const after = near(hero.position, t.at);
      assert.ok(after <= Math.max(6, before - 1), `${c.task} at ${az.toFixed(2)}: the hero walks to the heap (${before.toFixed(1)} → ${after.toFixed(1)} half blocks)`);
    }
  });
}

test('a tap on a rod at the end of the talk walks the hero to it: the first step of the teacher takes another rod', async () => {
  let s = null;
  const failures = await runHeadless({ name: 'walk-first', profile, clock: 540, at: ['phu-dong', 54, 27], steps: start.slice(0, 3) }, { onSession: (x) => { s = x; } });
  assert.deepEqual(failures, []);
  const hero = getEntity(s.state, 'hero');
  const heap = getEntity(s.state, 'zone:rods');
  const tapped = heap.zone.items[0];
  const taken = [];
  s.listen((e) => { if (e.type === 'add' && e.by === 'npc:teacher') taken.push(e.item); });
  // The child taps a rod at once, as the teacher starts the first step.
  send(s, { type: 'tap', target: { thing: tapped } });
  run(s, 6, () => taken.length > 0 && !hero.route);
  assert.ok(taken.length, 'the teacher shows the first step');
  assert.ok(!taken.includes(tapped), `the teacher took another rod: ${taken.join(', ')}`);
  const rod = getEntity(s.state, tapped);
  assert.ok(rod.item.zone === 'rods' && near(hero.position, rod.position) < 4, 'the hero is at the rod of the tap');
});
