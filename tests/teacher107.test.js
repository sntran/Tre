// The teacher at grade 4 after the play test (#107): a thing in the box comes back, the help of each
// form is the help of that form, a desk says what it has, and the desks stand near the heap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';

const s0 = load('tests/stories/trial-scholar.json');
const first = s0.steps.findIndex((x) => x.read === true) + 1;

async function atTeacher(grade) {
  let session = null;
  const said = [];
  const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade }, steps: [...s0.steps.slice(0, first), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 80 } }, { wait: 2 }] }, {
    onSession: (x) => { session = x; x.listen((e) => { if (e.type === 'open' && e.textKey) said.push(e.textKey); }); },
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
  // A thing of a kind from a zone into another zone (one press when the place is in reach).
  const move = (from, kind, to) => {
    const id = zone(from).items.find((i) => getEntity(session.state, i)?.item.kind === kind);
    if (!id) return false;
    tapAt(id);
    press();
    if (held() === id) {
      tapAt(`zone:${to}`);
      press();
    }
    return zone(to).items.includes(id);
  };
  return { session, said, run, press, tapAt, zone, held, move, plan: zone('trial-scholar').plan };
}

test('a rod in the box comes back with a tap and a press, and goes onto a desk', async () => {
  const h = await atTeacher(4);
  assert.ok(h.move('rods', 'rod', 'box'), 'a rod into the box');
  const rod = h.zone('box').items[0];
  h.tapAt(rod);
  assert.equal(h.session.action()?.act, 'pick');
  assert.equal(h.session.action()?.target, rod, 'the tap chooses the rod in the box');
  h.press();
  assert.equal(h.held(), rod);
  assert.equal(h.zone('box').items.length, 0);
  h.tapAt('zone:desk-0');
  h.press();
  assert.ok(h.zone('desk-0').items.includes(rod));
});

test('a tap on a desk: the teacher says what it has, in the count of grade 4', async () => {
  const h = await atTeacher(4);
  assert.ok(h.move('rods', 'rodbundle', 'desk-0'));
  assert.ok(h.move('rods', 'rod', 'desk-0'));
  const before = h.said.length;
  h.tapAt('zone:desk-0');
  assert.ok(h.said.slice(before).includes('scholar.on.desk'), h.said.slice(before).join(', '));
});

test('the desks stand at most 3 cells from the heap, each with a mat of its own color', async () => {
  for (const seed of [7, 11, 23]) {
    let session = null;
    await runHeadless({ ...s0, profile: { ...s0.profile, grade: 4, seed }, steps: s0.steps.slice(0, first) }, { onSession: (x) => { session = x; } });
    const heap = getEntity(session.state, 'zone:rods').zone;
    const desks = query(session.state, 'zone').filter((z) => /^desk-\d+$/.test(z.zone.id));
    assert.ok(desks.length >= 3);
    for (const d of desks) {
      const dx = Math.max(heap.x - d.zone.x, 0, d.zone.x - (heap.x + 7 * 0.7));
      const dz = Math.abs(d.zone.z - heap.z);
      assert.ok(Math.hypot(dx, dz) <= 6.2, `${d.zone.id} is ${Math.hypot(dx, dz).toFixed(1)} half blocks from the heap`);
    }
    const looks = desks.map((d) => query(session.state, 'position').find((e) => e.id.endsWith(`:scholar:${d.zone.id}`))?.look);
    assert.equal(new Set(looks).size, desks.length, looks.join(', '));
  }
});

// The lines that belong to the mat of grades 1 to 3 only, and the lines of each form.
const MAT_ONLY = ['mentor.scholar.room', 'mentor.scholar.mark', 'mentor.scholar.demo', 'mentor.scholar.demoDone', 'mentor.scholar.smallerPut', 'mentor.scholar.sharePut', 'mentor.scholar.extra', 'mentor.scholar.tie'];
const OF_FORM = (k) => (/\.(groups|share|decimal)$/.exec(k) ?? [])[1] ?? null;

test('at each form of the teacher, each line of help belongs to that form or to all forms', async () => {
  const forms = { 1: 'tens', 3: 'groups', 4: 'share', 5: 'decimal' };
  for (const [grade, form] of Object.entries(forms)) {
    const h = await atTeacher(Number(grade));
    const from = h.said.length;
    // A wave, a wrong try, and three waves after it.
    h.session.command({ type: 'wave' });
    h.run(6);
    if (form === 'share') h.move('rods', 'rodbundle', 'desk-0');
    else if (form === 'decimal') h.move('rods', 'rodbundle', 'table');
    else if (form === 'groups') {
      h.move('bands', 'band', 'bandrow');
      h.move('rods', 'rod', 'mat');
    } else h.move('rods', 'rod', 'mat');
    h.tapAt('npc:teacher');
    h.press();
    h.run(25);
    for (let i = 0; i < 3; i++) {
      h.session.command({ type: 'wave' });
      h.run(30);
    }
    const lines = h.said.slice(from).filter((k) => k.startsWith('mentor.scholar') || k.startsWith('mentor.show.scholar'));
    assert.ok(lines.length >= 3, `${form}: ${lines.join(', ')}`);
    for (const k of lines) {
      const f = OF_FORM(k);
      assert.ok(f === null || f === form, `${form}: a line of ${f}: ${k}`);
      if (form === 'share' || form === 'decimal') assert.ok(!MAT_ONLY.includes(k), `${form}: a line of the mat: ${k} (${lines.join(', ')})`);
    }
  }
});
