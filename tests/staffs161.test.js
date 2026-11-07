// The bamboo staffs at grade 1 (#161): the woodcutter shows the hold, a quick tap does not cut and
// says to hold, a break has a line with the rings, the staffs have a mentor, the print comes after
// a right staff, the staffs wait for the day, and Gióng waits beside the clump.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { restOf } from '../src/core/quests.js';

const s0 = load('tests/stories/staffs-bamboo.json');
const vi = load('i18n/vi.json');

async function atClump(grade = 1, flags = {}) {
  const upto = s0.steps.findIndex((x) => x.read === true);
  let session = null;
  const said = [];
  const events = [];
  const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade, flags: { ...s0.profile.flags, ...flags } }, steps: s0.steps.slice(0, upto + 1) }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => {
        events.push(e);
        if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, params: e.params ?? {} });
        if (e.type === 'call' && e.key) said.push({ key: e.key, params: e.params ?? {} });
      });
    },
  });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const run = (sec, until = () => false) => {
    for (let i = 0; i < sec / STEP && !until(); i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const tz = () => getEntity(session.state, 'zone:trial-staffs')?.zone;
  // Walk to a culm, and hold the button down for sec seconds.
  const hold = (culm, sec) => {
    session.command({ type: 'tap', target: { thing: `culm:staffs:${culm}` } });
    run(8, () => !getEntity(session.state, 'hero').route);
    run(1.2);
    session.command({ type: 'hold', on: true });
    run(sec);
    session.command({ type: 'hold', on: false });
    run(0.5);
  };
  // The hero walks to the clump, and the woodcutter shows the cut there.
  const ready = () => {
    session.command({ type: 'tap', target: { thing: 'culm:staffs:0' } });
    run(40, () => said.some((l) => /first\.you$/.test(l.key)));
    run(10, () => !session.state.entities.some((e) => e.script));
  };
  return { session, said, events, run, tz, hold, ready };
}

test('at the start, the woodcutter cuts a culm of his own with a hold: the mark goes up ring by ring while he counts, and then he says to hold the button', async () => {
  const h = await atClump(1);
  h.session.command({ type: 'tap', target: { thing: 'culm:staffs:0' } });
  h.run(40, () => h.said.some((l) => l.key === 'mentor.staffs.show'));
  const keys = h.said.map((l) => l.key);
  const show = keys.indexOf('mentor.staffs.show');
  assert.ok(show >= 0, keys.join(', '));
  assert.ok(['num.1', 'num.2', 'num.3'].every((k) => keys.slice(0, show).includes(k)), 'he counts the rings');
  assert.equal(vi['mentor.staffs.show'], 'Em giữ nút lớn, vạch đi lên từng đốt. Buông tay là chặt.');
  h.run(6);
  // His culm and his piece go at the end of the show; the culms of the child all stand.
  assert.ok(!h.session.state.entities.some((e) => e.demo), 'the culm of the show is gone');
  for (let i = 0; i < h.tz().pieces.length; i++) assert.ok(getEntity(h.session.state, `culm:staffs:${i}`), `the culm ${i} stands`);
});

test('at grade 1, a press of 0.1 seconds on a culm does not cut, and the woodcutter says to hold the button longer', async () => {
  const h = await atClump(1);
  h.ready();
  const from = h.said.length;
  h.hold(0, 0.1);
  assert.ok(!h.events.some((e) => e.type === 'slash'), 'no cut');
  assert.ok(getEntity(h.session.state, 'culm:staffs:0'), 'the culm stands');
  assert.ok(h.said.slice(from).some((l) => l.key === 'woodcutter.staffs.hold'), h.said.slice(from).map((l) => l.key).join(', '));
  assert.equal(vi['woodcutter.staffs.hold'], 'Giữ nút lâu hơn nhé, vạch sẽ đi lên.');
});

test('two cuts at the first ring break, and the woodcutter says the rings of the piece and of the sample while the rings of the sample glow; no print at the break, and the print at the first right staffs', async () => {
  const h = await atClump(1);
  h.ready();
  const from = h.said.length;
  // A hold of one step of the mark: the slash at the first ring.
  h.hold(0, 0.6);
  h.hold(1, 0.6);
  h.run(8);
  const snap = h.events.find((e) => e.type === 'snap');
  assert.ok(snap, 'the pieces break');
  assert.deepEqual(snap.pieces, [1, 1]);
  const keys = h.said.slice(from).map((l) => l.key);
  const piece = h.said.slice(from).find((l) => /^staffs\.piece/.test(l.key));
  const sample = h.said.slice(from).find((l) => l.key === 'staffs.sample');
  assert.ok(piece && sample, keys.join(', '));
  assert.equal(sample.params.n.key, `num.${h.tz().pieces.length === 2 ? 4 : 0}`);
  assert.ok(h.events.some((e) => e.type === 'workView' || e.type === 'glowSeq' || e.type === 'call'), 'the count shows');
  const skillPrints = () => h.events.filter((e) => e.type === 'notebook' && e.kind === 'skill');
  assert.deepEqual(skillPrints(), [], 'no print at a break');
  // The right staffs: four rings each.
  h.run(4);
  const ringAt = (n) => 0.45 * (n + 0.2);
  h.hold(0, ringAt(4));
  h.hold(1, ringAt(4));
  h.run(4);
  const skill = h.events.filter((e) => e.type === 'skill').at(-1);
  assert.ok(skill?.solved, JSON.stringify(h.events.filter((e) => e.type === 'slash').map((e) => e.at)));
  assert.equal(skillPrints().length, 1, 'the print after the right staffs');
});

test('a wave at the clump gets a line of the woodcutter', async () => {
  const h = await atClump(1);
  h.ready();
  const from = h.said.length;
  h.session.command({ type: 'wave' });
  h.run(4);
  assert.ok(h.said.slice(from).some((l) => /^mentor\.(staffs|first|show|mark|tryFirst)/.test(l.key) || /^woodcutter\.staffs/.test(l.key)), h.said.slice(from).map((l) => l.key).join(', '));
});

test('at night the staffs wait for the day: the step of the staffs is a rest', () => {
  const step = { targets: [{ npc: 'woodcutter', unless: 'staffs.told' }, { trial: 'staffs', if: 'staffs.told' }] };
  const r = restOf(step, { 'staffs.told': true }, { night: true, dayOnly: (tg) => tg.trial === 'staffs' });
  assert.ok(r?.rest && r.night);
  assert.equal(restOf(step, { 'staffs.told': true }, { night: false, dayOnly: (tg) => tg.trial === 'staffs' }), null);
});

test('Gióng waits beside the clump, never between the camera and the hero at the culms', async () => {
  const h = await atClump(1, { 'giong.follow': true });
  h.ready();
  h.hold(0, 0.1);
  h.run(6);
  const g = h.session.state.entities.find((e) => e.id === 'npc:giong-hero');
  if (!g || g.hidden) return;
  const c = h.tz().clump;
  const d = Math.hypot(g.position.x - c.x, g.position.z - c.z);
  assert.ok(d <= 16, `Gióng is ${d.toFixed(1)} half blocks from the clump`);
  assert.ok(!h.session.seeThrough().has(g.id), 'Gióng is not pale');
});
