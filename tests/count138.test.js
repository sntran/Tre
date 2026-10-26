// Counts and places in the small tasks after the play test of #123–#134 (#138): the teacher never
// stands on the mat and the ring of the tie is far from the heap, the fisher says what the row misses
// and that a row with too many stakes was more than enough, the lines of the rice name the true place
// of the trays, the share names the mats and says the counts and the result, a tap on the trough or
// the rack chooses its bar for the pebble, and the lays of grade 5 say what they count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';
import { tapTarget, sessionCamera, sessionScreen } from '../src/world/hit.js';

const vi = load('i18n/vi.json');
const en = load('i18n/en.json');

async function story(s, opts = {}) {
  let session = null;
  const failures = await runHeadless(s, { ...opts, onSession: (x) => { session = x; } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const said = [];
  const events = [];
  session.listen((e) => {
    events.push(e);
    if (e.type === 'open' && e.textKey) said.push(e.textKey);
    if (e.type === 'call') said.push(e.key);
  });
  const run = (sec, until = () => false) => {
    for (let i = 0; i < sec / STEP && !until(); i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const press = () => { session.command({ type: 'hands', id: session.action()?.id }); session.events(); };
  const tap = (target) => { session.command({ type: 'tap', target }); session.events(); };
  return { session, said, events, run, press, tap };
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const inRect = (p, r, m = 0) => p.x > r.x0 - m && p.x < r.x1 + m && p.z > r.z0 - m && p.z < r.z1 + m;

test('grade 1: the teacher never stands on the mat, each rod lies in a place of its own, and the ring of the tie is far from the heap', async () => {
  const s0 = load('tests/stories/trial-scholar.json');
  const h = await story({ ...s0, profile: { ...s0.profile, grade: 1 }, steps: s0.steps.slice(0, 5) });
  const mat = getEntity(h.session.state, 'zone:mat').zone;
  const heap = getEntity(h.session.state, 'zone:rods').zone;
  const teacher = () => getEntity(h.session.state, 'npc:teacher');
  // A child who walks around the mat and puts rods: the teacher steps aside, never onto the mat.
  for (let k = 0; k < 10; k++) {
    h.press();
    h.run(1.4);
    assert.ok(!inRect(teacher().position, mat.rect, 0.5), `the teacher at ${teacher().position.x.toFixed(1)},${teacher().position.z.toFixed(1)} is on the mat`);
  }
  // Each rod lies in a place of its own.
  const at = mat.items.map((id) => getEntity(h.session.state, id).position).map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`);
  assert.equal(new Set(at).size, at.length, `the places of the rods: ${at.join(' ')}`);
  // With ten rods on the mat and the hero by the heap, the step is the ring of the tie, beside the
  // teacher, and far from the heap.
  while (mat.items.length < 10) {
    h.press();
    h.run(1.4);
  }
  h.tap({ thing: heap.items[0] });
  h.run(3);
  h.said.length = 0;
  let ring = null;
  h.session.command({ type: 'wave' });
  h.session.events();
  h.run(4, () => {
    const m = query(h.session.state, 'mentorMark')[0];
    if (m && !ring) ring = { ...m.position };
    return false;
  });
  assert.ok(h.said.includes('mentor.scholar.tieRing'), h.said.join(', '));
  assert.ok(ring, 'the ring glows');
  assert.ok(dist(ring, teacher().position) < 3, 'the ring is beside the teacher');
  for (const id of heap.items) assert.ok(dist(ring, getEntity(h.session.state, id).position) > 6, 'the ring does not touch the heap');
  // At the ring with empty hands, the big button ties.

  h.run(20, () => !query(h.session.state, 'script').length);
  h.tap({ ground: { x: ring.x / 2, y: ring.z / 2 } });
  h.run(6);
  assert.equal(h.session.action()?.act, 'tie', `the button at the ring: ${h.session.action()?.act}`);
});

test('the lines of the rice name the place of the trays, next to the pot, never "bờ ruộng"', () => {
  for (const [k, v] of Object.entries(vi)) {
    if (/^(rice\.|dlg\.giong\.rice)/.test(k)) assert.ok(!/bờ ruộng/.test(v), `${k}: ${v}`);
  }
  assert.match(vi['rice.help.tray'], /cạnh nồi, trong vòng tròn/);
  assert.match(vi['dlg.giong.rice.n2'], /cạnh nồi/);
  assert.ok(!('word.boruong' in vi));
});

test('the share names the mats, a tap on a mat says its count, a share that is not equal says which mat has more, and the end says the result', async () => {
  const s0 = load('tests/stories/raid-soldiers.json');
  const upto = s0.steps.findIndex((x) => x.expect?.some?.((f) => f.text?.shown === 'share.start'));
  const h = await story({ ...s0, steps: s0.steps.slice(0, upto + 1) });
  assert.ok(h.session.state.entities.some((e) => e.id === 'mat:share-nghe'), 'the mats');
  h.run(3);
  // No friend stands on a mat.
  for (const w of ['hero', 'nghe', 'giong']) {
    const r = getEntity(h.session.state, `zone:share-${w}`).zone.rect;
    for (const id of ['by:share-hero', 'by:share-giong', 'friend:nghe']) {
      const e = getEntity(h.session.state, id);
      if (e) assert.ok(!inRect(e.position, r, 0.3), `${id} on the mat of ${w}`);
    }
  }
  const all = [];
  h.session.listen((e) => { if (e.type === 'open' && e.textKey) all.push({ key: e.textKey, params: e.params }); });
  // The line of the mats came with the share.
  h.run(2);
  const story2 = await story({ ...s0, steps: s0.steps.slice(0, upto) });
  const names = [];
  story2.session.listen((e) => { if (e.type === 'open' && e.textKey) names.push(e.textKey); if (e.type === 'glowSeq') names.push(`glow:${e.ids.join(',')}`); });
  story2.run(8);
  assert.ok(names.includes('share.mats'), names.join(', '));
  assert.ok(names.includes('glow:mat:share-hero,mat:share-nghe,mat:share-giong'), names.join(', '));
  // Two sacks on the mat of Nghé: a tap on her mat says it.
  const loot = getEntity(h.session.state, 'zone:loot').zone;
  for (let k = 0; k < 2; k++) {
    h.tap({ thing: loot.items[0] });
    h.run(4);
    h.press();
    h.run(1);
    h.tap({ thing: 'mat:share-nghe' });
    h.run(4);
    h.press();
    h.run(1.5);
  }
  all.length = 0;
  h.tap({ thing: 'mat:share-nghe' });
  h.run(1);
  const count = all.find((l) => l.key === 'share.count');
  assert.ok(count, all.map((l) => l.key).join(', '));
  assert.equal(count.params.n.key, 'num.2');
  assert.equal(count.params.who.key, 'share.who.nghe');
  // A tap on the ground of the mat says it too.
  all.length = 0;
  const nz = getEntity(h.session.state, 'zone:share-nghe').zone;
  h.tap({ ground: { x: nz.x / 2, y: nz.z / 2 } });
  h.run(1);
  assert.ok(all.some((l) => l.key === 'share.count'), all.map((l) => l.key).join(', '));
  assert.equal(vi['share.mats'], 'Chiếu này của cháu, chiếu này của Nghé, chiếu này của Gióng.');
  assert.match(vi['share.result'], /^Mỗi người \{n\} bao\. Còn \{rest\} bao lẻ cho làng\.$/);
  assert.ok(en['share.more'] && vi['share.more']);
});

test('the guess of grade 5: a tap on the trough chooses the bar in the water, a tap on the rack the bar in the air, also at the screen place of each bar', async () => {
  const s0 = load('tests/stories/trial-smith.json');
  const first = s0.steps.findIndex((x) => x.read === true);
  for (const [by, thing] of [['water', 'trough:smith'], ['rack', 'rack:smith']]) {
    const h = await story({ ...s0, profile: { ...s0.profile, grade: 5 }, steps: s0.steps.slice(0, first + 1) });
    const tz = () => getEntity(h.session.state, 'zone:trial-smith').zone;
    h.run(40, () => tz().test && tz().test.check == null);
    h.run(1.2);
    h.press();
    h.run(1);
    h.tap({ thing: 'rack:smith' });
    h.run(3);
    h.press();
    h.run(1);
    h.run(4);
    assert.ok(tz().test?.guessWait, 'the smith waits for the guess');
    h.tap({ thing });
    h.run(3);
    const a = h.session.action();
    assert.equal(a?.act, 'pebble', `a tap on ${thing} chooses its bar`);
    const want = tz().test.tries.find((q) => (by === 'water' ? q.how === 'water' : q.how !== 'water'));
    assert.equal(a.target, want.id);
    // At the screen place of each bar: a finger there through the camera of a phone.
    for (const q of tz().test.tries) {
      const bar = getEntity(h.session.state, q.id);
      const cam = sessionCamera(h.session);
      const p = cam.project(bar.position.x / 2, bar.position.y / 2 + 0.2, bar.position.z / 2);
      const target = tapTarget(p, sessionScreen(h.session, cam));
      h.tap(target);
      h.run(3);
      assert.equal(h.session.action()?.target, q.id, `a finger on the bar ${q.how} chooses it: ${JSON.stringify(target)}`);
    }
  }
});

// A stake from the bank to a point of the row: a press takes it, a tap chooses the point, and a
// press puts it.
function stakeAt(h, line, at) {
  for (let k = 0; k < 4 && !h.session.carried(); k++) {
    h.press();
    h.run(8, () => Boolean(h.session.carried()));
  }
  h.tap({ ground: { x: (line.x + at) / 2, y: line.z / 2 } });
  h.press();
  h.run(8, () => !h.session.carried());
}

test('grade 1: with a stake at the float and a wide space in the row, a wave makes the fisher say the space and mark it; a row with too many stakes ends with the count', async () => {
  const s0 = load('tests/stories/trial-fisher.json');
  const first = s0.steps.findIndex((x) => x.read === true);
  const h = await story({ ...s0, profile: { ...s0.profile, grade: 1 }, steps: s0.steps.slice(0, first + 1) });
  const line = getEntity(h.session.state, 'zone:line').zone;
  h.said.length = 0;
  stakeAt(h, line, line.length);
  h.run(5);
  // By itself, the fisher says the space, points at it, and it glows; the water waits.
  assert.ok(h.said.includes('mentor.fisher.wide'), h.said.join(', '));
  assert.ok(!h.said.includes('fisher.full'), 'no "Đủ hàng rồi"');
  const slots = query(h.session.state, 'item').filter((e) => e.item.zone === 'line' && !e.item.held && e.item.slot != null).map((e) => e.item.slot).sort((a, b) => a - b);
  const inSpace = (x) => slots.some((q, i) => i && q - slots[i - 1] > line.space && x >= slots[i - 1] && x < q);
  const glow = getEntity(h.session.state, 'why:fisher:wide');
  assert.ok(glow && inSpace(glow.position.x - line.x), `the glow of the space in ${slots.join(' ')}`);
  // A wave says it again, with a mark in the space.
  h.said.length = 0;
  let mark = null;
  h.session.command({ type: 'wave' });
  h.session.events();
  h.run(5, () => {
    const m = query(h.session.state, 'mentorMark')[0];
    if (m && !mark) mark = { ...m.position };
    return false;
  });
  assert.ok(h.said.includes('mentor.fisher.wide'), h.said.join(', '));
  assert.ok(mark && inSpace(mark.x - line.x), `the mark in ${slots.join(' ')}`);
  // A stake at each point of the row at half of the space: more stakes than the row needs. The
  // tide comes, the row keeps the fish, and the end line says the count.
  h.said.length = 0;
  for (let q = 1; q < line.length; q++) if (!slots.includes(q) && q % Math.max(1, Math.floor(line.space / 2)) === 0) stakeAt(h, line, q);
  h.run(200, () => getEntity(h.session.state, 'zone:trial-fisher').zone.done);
  h.run(3);
  assert.equal(getEntity(h.session.state, 'zone:trial-fisher').zone.done, true, 'the row keeps the fish');
  assert.ok(h.said.includes('fisher.extra'), h.said.join(', '));
});

test('the lays of grade 5 say what they count, and the fisher says what the row misses', () => {
  assert.equal(vi['woodcutter.part.lays'], 'Khúc này đặt vừa {n} lần dọc cây tre: mỗi khúc là {part} cây tre.');
  assert.equal(vi['mentor.fisher.wide'], 'Chỗ này còn rộng, cá chui qua được.');
  assert.equal(vi['mentor.fisher.toFloat'], 'Hàng phải tới cái phao đỏ.');
  assert.equal(vi['fisher.extra'], 'Hàng có {n} cọc. Các khe đều nhau thì {k} cọc cũng đủ.');
});
