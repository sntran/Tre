// The teacher at grade 4 after the play test (#116): the last rod on the mat comes with a tap near
// it, the press near the teacher takes a rod (the check needs a tap on the teacher), the help after a
// check reads the desks, a put on a desk says its count, and a handful of rods is dealt one to each
// desk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { tapTarget, sessionCamera, sessionScreen } from '../src/world/hit.js';

const s0 = load('tests/stories/trial-scholar.json');
const first = s0.steps.findIndex((x) => x.read === true) + 1;

async function atTeacher() {
  let session = null;
  const said = [];
  const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade: 4 }, steps: [...s0.steps.slice(0, first), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 80 } }, { wait: 2 }] }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => { if (e.type === 'open' && e.textKey) said.push(e.textKey); });
    },
  });
  assert.deepEqual(failures, []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const press = () => { session.command({ type: 'hands', id: session.action()?.id }); run(1.5); };
  const tapAt = (id) => {
    const e = getEntity(session.state, id);
    session.command({ type: 'tap', target: e.person ? { person: id } : e.zone ? session.targetAt(e.zone.x / 2, e.zone.z / 2) : { thing: id } });
    run(4);
  };
  const zone = (id) => getEntity(session.state, `zone:${id}`)?.zone;
  const held = () => getEntity(session.state, 'hero').hands?.holds ?? null;
  const kind = (id) => getEntity(session.state, id)?.item.kind;
  const sum = (id) => zone(id).items.reduce((a, i) => a + (getEntity(session.state, i)?.item.value ?? getEntity(session.state, i)?.item.size ?? 0), 0);
  // A thing goes to a zone at once (the state of the work, not the walk of the child).
  const place = (id, to) => {
    const e = getEntity(session.state, id);
    const from = zone(e.item.zone);
    if (from) from.items.splice(from.items.indexOf(id), 1);
    e.item.zone = to;
    zone(to).items.push(id);
    e.position = { x: zone(to).x, y: zone(to).y + 0.1, z: zone(to).z, facing: 0 };
  };
  const plan = zone('trial-scholar').plan;
  return { session, said, run, press, tapAt, zone, held, kind, sum, place, plan };
}
// A bundle onto the mat with a tap and a press: it opens into ten rods.
function openBundle(h) {
  const b = h.zone('rods').items.find((i) => h.kind(i) === 'rodbundle');
  h.tapAt(b);
  h.press();
  h.tapAt('zone:mat');
  h.press();
  for (let i = 0; i < 4 && h.held(); i++) h.run(1.5);
  assert.equal(h.zone('mat').items.length, 10, 'ten rods on the mat');
}

test('the last rod on the mat: a finger next to it chooses it, and a press takes it', async () => {
  const h = await atTeacher();
  openBundle(h);
  // Nine rods go to the desks; one rod stays on the mat.
  for (const id of h.zone('mat').items.slice(1)) h.place(id, 'desk-0');
  const rod = h.zone('mat').items[0];
  const e = getEntity(h.session.state, rod);
  const cam = sessionCamera(h.session);
  // The finger a little beside the rod, not on its body.
  const p = cam.project(e.position.x / 2 + 0.35, e.position.y / 2, e.position.z / 2 + 0.35);
  const t = tapTarget(p, sessionScreen(h.session, cam));
  assert.deepEqual(t, { thing: rod });
  h.session.command({ type: 'tap', target: t });
  h.run(4);
  assert.equal(h.session.action()?.act, 'pick');
  h.press();
  assert.equal(h.held(), rod);
});

test('near the teacher, with rods on the mat, the press takes a rod and is not the check', async () => {
  const h = await atTeacher();
  openBundle(h);
  h.tapAt('zone:desk-0');
  h.run(2);
  // A press with no tap, next to the mat: a rod, not the check.
  h.session.command({ type: 'tap', target: { ground: { x: h.zone('mat').x / 2 + 1, y: h.zone('mat').z / 2 - 1.5, h: 0, thing: false, object: null, goal: true } } });
  h.run(4);
  const a = h.session.action();
  assert.notEqual(a?.act, 'tie', JSON.stringify(a));
  assert.equal(a?.act, 'pick', JSON.stringify(a));
  // A tap on the teacher is the check.
  h.tapAt('npc:teacher');
  assert.equal(h.session.action()?.act, 'tie');
});

test('desks equal and the rest on the mat: the check says the box, and no share is played', async () => {
  const h = await atTeacher();
  const { plan } = h;
  // The child shares with the hands: the bundles, and then the loose rods dealt one to each desk.
  const move = (from, kind, to) => {
    const id = h.zone(from).items.find((i) => h.kind(i) === kind);
    if (!id) return false;
    h.tapAt(id);
    h.press();
    if (h.held() !== id) return false;
    h.tapAt(`zone:${to}`);
    h.press();
    for (let i = 0; i < 4 && h.held(); i++) h.run(1.5);
    return h.held() === null;
  };
  const looseIn = (id) => h.zone(id).items.filter((i) => h.kind(i) === 'rod');
  for (let i = 0; i < plan.k; i++) for (let need = plan.each; need >= 10; need -= 10) assert.ok(move('rods', 'rodbundle', `desk-${i}`));
  for (let n = 0; h.sum('desk-0') < plan.each && n < 40; n++) {
    if (looseIn('rods').length < plan.k && looseIn('mat').length < plan.k) assert.ok(move('rods', 'rodbundle', 'mat'));
    assert.ok(move(looseIn('rods').length >= plan.k ? 'rods' : 'mat', 'rod', 'desk-0'));
  }
  // The rest lies on the heap or on the mat, fewer than the desks.
  const rest = looseIn('rods').length + looseIn('mat').length;
  assert.ok(rest > 0 && rest < plan.k && !h.zone('rods').items.some((i) => h.kind(i) === 'rodbundle'), `the rest: ${rest}`);
  h.tapAt('npc:teacher');
  h.press();
  h.run(20);
  assert.ok(h.said.includes('mentor.scholar.toBox'), h.said.join(' '));
  assert.ok(!h.said.includes('mentor.scholar.demo.share'), 'no share is played with no wave');
  // A second check: still no share.
  h.tapAt('npc:teacher');
  h.press();
  h.run(20);
  assert.ok(!h.said.includes('mentor.scholar.demo.share'), h.said.join(' '));
});

test('a wave gets the share one time in a task', async () => {
  const h = await atTeacher();
  h.place(h.zone('rods').items.find((i) => h.kind(i) === 'rodbundle'), 'desk-0');
  for (let n = 0; n < 3; n++) {
    h.tapAt('npc:teacher');
    h.press();
    h.run(16);
    h.session.command({ type: 'wave' });
    h.run(30);
  }
  assert.equal(h.said.filter((k) => k === 'mentor.scholar.demo.share').length, 1, h.said.join(' '));
});

test('a put on a desk walks there and says its count; after three puts, one line says the tap', async () => {
  const h = await atTeacher();
  const bundles = h.zone('rods').items.filter((i) => h.kind(i) === 'rodbundle');
  for (let n = 0; n < 4 && bundles.length; n++) {
    const b = bundles.shift();
    h.tapAt(b);
    h.press();
    h.tapAt(`zone:desk-${n % h.plan.k}`);
    h.press();
    for (let i = 0; i < 4 && h.held(); i++) h.run(1.5);
    assert.ok(h.zone(`desk-${n % h.plan.k}`).items.includes(b), `the bundle on desk ${n % h.plan.k}`);
  }
  assert.equal(h.said.filter((k) => k === 'scholar.on.named').length, 3, h.said.join(' '));
  if (h.plan.tens >= 4) assert.ok(h.said.includes('scholar.desk.tap'), h.said.join(' '));
});

test('a press at the heap takes one rod for each desk, and a press at a desk deals them, one to each desk', async () => {
  const h = await atTeacher();
  openBundle(h);
  const before = Array.from({ length: h.plan.k }, (_, i) => h.sum(`desk-${i}`));
  const rod = h.zone('mat').items[0];
  h.tapAt(rod);
  h.press();
  assert.equal(h.held(), rod);
  const e = getEntity(h.session.state, rod);
  assert.equal(e.item.with.length, h.plan.k - 1, 'one rod for each desk');
  assert.equal(e.look, `rod-hand-${h.plan.k}`);
  assert.equal(h.zone('mat').items.length, 10 - h.plan.k);
  h.tapAt('zone:desk-1');
  h.press();
  for (let i = 0; i < 4 && h.held(); i++) h.run(1.5);
  for (let i = 0; i < h.plan.k; i++) assert.equal(h.sum(`desk-${i}`), before[i] + 1, `desk ${i}`);
  assert.ok(h.said.filter((k) => k === 'num.1').length >= h.plan.k, h.said.join(' '));
});
