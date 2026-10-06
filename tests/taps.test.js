// What a child hits on a phone (#44): a tap always walks (never a talk or a text in place of a
// walk), the button acts at things with a text or a find, a thing goes to its place and not to the
// ground, and the button never offers a ride in a task.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless, data } from './story-run.js';
import { getEntity } from '../src/core/world/state.js';

const story = (name) => JSON.parse(readFileSync(new URL(`./stories/${name}.json`, import.meta.url), 'utf8'));
const steps = (session, seconds) => {
  for (let k = 0; k < Math.round(seconds * 30); k++) {
    session.step();
    session.events();
  }
};
// A session in Phù Đổng by day, at a cell of the plane (or of the hand-made map: [place, x, y]),
// with flags.
async function phuDong(at = ['phu-dong', 48, 8], flags = {}, clock = 540) {
  let session = null;
  const s = { name: 'taps', profile: { name: 'An', flags: { 'intro.seen': true, 'prologue.started': true, ...flags } }, clock, at, steps: [] };
  const failures = await runHeadless(s, { onSession: (x) => { session = x; } });
  assert.deepEqual(failures, []);
  return session;
}
const heroCell = (session) => {
  const h = getEntity(session.state, 'hero').position;
  return { x: h.x / 2, y: h.z / 2 };
};

test('a tap on a house walks the hero toward it and opens no talk (the đình, the house of Gióng, home, the school, the forge)', async () => {
  const houses = data.world.map('phu-dong').layers.objects.filter((o) => ['dinh', 'giong-house', 'home', 'school', 'forge'].includes(o.id));
  assert.equal(houses.length, 5);
  for (const o of houses) {
    const session = await phuDong();
    const opened = [];
    session.listen((ev) => {
      if (ev.type === 'open') opened.push(ev.screen);
    });
    // The objects and the zones of the world data are in cells of the plane.
    const [px, py] = [o.x + o.w / 2, o.y + o.h / 2];
    const before = heroCell(session);
    const d0 = Math.hypot(before.x - px, before.y - py);
    session.command({ type: 'tap', target: session.targetAt(px, py) });
    steps(session, 12);
    const after = heroCell(session);
    assert.ok(Math.hypot(after.x - px, after.y - py) < d0 - 3, `${o.id}: the hero walks toward it`);
    assert.ok(!opened.includes('dialogue'), `${o.id}: no talk opens`);
  }
});

test('a tap on water or on a field far away walks the hero to a free cell on the way', async () => {
  const zones = data.world.map('phu-dong').layers.triggers.filter((z) => ['river', 'field-home'].includes(z.id));
  for (const z of zones) {
    const session = await phuDong(['phu-dong', 40, 40]);
    const [px, py] = [z.x + z.w / 2, z.y + z.h / 2];
    const before = heroCell(session);
    session.command({ type: 'tap', target: session.targetAt(px, py) });
    steps(session, 10);
    const after = heroCell(session);
    assert.ok(Math.hypot(after.x - before.x, after.y - before.y) > 1, `${z.id}: the hero moves`);
    assert.ok(Math.hypot(after.x - px, after.y - py) < Math.hypot(before.x - px, before.y - py), `${z.id}: toward the tap`);
  }
});

test('next to a thing with a find, the big button looks at it: the ore gives iron', async () => {
  const ore = data.world.map('phu-dong').layers.triggers.find((z) => z.id === 'ore1');
  let profile = null;
  let session = null;
  const s = { name: 'ore', profile: { name: 'An', flags: { 'intro.seen': true, 'prologue.started': true, 'giong.spoke': true } }, clock: 540, at: [ore.x - 1, ore.y + 1], steps: [] };
  await runHeadless(s, { onSession: (x) => { session = x; }, onEnd: (r) => { profile = r.profile; } });
  const a = session.action();
  assert.equal(a?.act, 'look');
  session.command({ type: 'hands' });
  steps(session, 1);
  assert.equal(profile.flags['horse.ore1'], true, 'the ore is found');
  assert.ok(profile.inventory.iron > 0, 'the iron is in the basket');
});

test('a rod taken at the heap goes on the mat at once, also when the hero still faces the heap', async () => {
  const s = story('practice-bo-que');
  // Up to the first pick-up at the heap.
  s.steps = [...s.steps.slice(0, 5), { press: { item: 'rod' } }, { until: { event: 'pick', timeout: 10 } }];
  let session = null;
  await runHeadless(s, { onSession: (x) => { session = x; } });
  steps(session, 0.5);
  assert.ok(session.carried(), 'a rod is in the hands');
  const a = session.action();
  assert.equal(a.act, 'put');
  assert.ok(a.target !== getEntity(session.state, 'hero').hands.holds, 'not on the ground');
  assert.notEqual(a.target, 'zone:teacher-rods', 'not back on the heap');
});

test('a thing of a task left on the ground goes back to its heap after a few seconds', async () => {
  const s = story('practice-bo-que');
  s.steps = [...s.steps.slice(0, 5), { press: { item: 'rod' } }, { until: { event: 'pick', timeout: 10 } }];
  let session = null;
  await runHeadless(s, { onSession: (x) => { session = x; } });
  steps(session, 0.5);
  const id = getEntity(session.state, 'hero').hands.holds;
  session.command({ type: 'drop', id: 'hero' });
  steps(session, 0.2);
  assert.equal(getEntity(session.state, id).item.zone, null, 'on the ground');
  steps(session, 5);
  assert.ok(getEntity(session.state, id).item.zone, 'back on its heap');
});

test('in a task, the big button never offers a ride on Nghé', async () => {
  const s = story('practice-bo-que');
  s.steps = s.steps.slice(0, 6);
  let session = null;
  await runHeadless(s, { onSession: (x) => { session = x; } });
  // Nghé comes next to the hero.
  const hero = getEntity(session.state, 'hero');
  const nghe = session.state.entities.find((e) => e.follow?.target === 'hero');
  if (nghe) Object.assign(nghe.position, { x: hero.position.x + 1, z: hero.position.z });
  for (let k = 0; k < 60; k++) {
    steps(session, 0.1);
    assert.notEqual(session.action()?.act, 'ride');
  }
});
