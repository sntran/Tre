// The cut is at the mark on the screen (#168): the cut of a hold is at the ring that the mark of the
// world showed at the release, never at the time of the touch; the voice counts the rings while the
// button is down; a break says where to let go; and the show of the woodcutter cuts at the rings of
// the sample.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';

const s0 = load('tests/stories/staffs-bamboo.json');
const vi = load('i18n/vi.json');

async function atClump(grade = 1) {
  const upto = s0.steps.findIndex((x) => x.read === true);
  let session = null;
  const said = [];
  const events = [];
  const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade }, steps: s0.steps.slice(0, upto + 1) }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => {
        events.push(e);
        if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, id: e.id, params: e.params ?? {} });
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
  const ready = () => {
    session.command({ type: 'tap', target: { thing: 'culm:staffs:0' } });
    run(40, () => said.some((l) => /first\.you$/.test(l.key)));
    run(10, () => !session.state.entities.some((e) => e.script));
  };
  // A hold of sec seconds of the world, and a release that says a much longer time of the touch
  // (a slow phone: the world ran slower than the clock).
  const hold = (culm, sec, held) => {
    session.command({ type: 'tap', target: { thing: `culm:staffs:${culm}` } });
    run(8, () => !getEntity(session.state, 'hero').route);
    run(1.2);
    session.command({ type: 'hold', on: true });
    run(sec);
    session.command({ type: 'hold', on: false, held });
    run(0.5);
  };
  return { session, said, events, run, tz, ready, hold };
}

test('a slow phone: the mark showed four rings at the release, the touch says eight seconds, and the cut is at four rings', async () => {
  const h = await atClump(1);
  h.ready();
  const ringAt = (n) => 0.45 * (n + 0.2);
  let mark = 0;
  h.session.listen((e) => { if (e.type === 'ring') mark = e.at; });
  h.hold(0, ringAt(4), 8);
  const slash = h.events.filter((e) => e.type === 'slash').at(-1);
  assert.ok(slash, 'a cut');
  assert.equal(slash.at, 4);
  assert.equal(h.tz().pieces[0], 4);
});

test('the woodcutter counts the rings while the button is down', async () => {
  const h = await atClump(1);
  h.ready();
  const from = h.said.length;
  h.hold(0, 0.45 * 3.2);
  const counts = h.said.slice(from).filter((l) => /^num\./.test(l.key)).map((l) => l.key);
  assert.deepEqual(counts.slice(0, 3), ['num.1', 'num.2', 'num.3']);
  assert.ok(h.said.slice(from).some((l) => l.id === 'npc:woodcutter' && l.key === 'num.2'));
});

test('a break says where to let go: at the rings of the sample', async () => {
  const h = await atClump(1);
  h.ready();
  const from = h.said.length;
  h.hold(0, 0.6);
  h.hold(1, 0.6);
  h.run(14);
  const l = h.said.slice(from).find((x) => x.key === 'staffs.letgo');
  assert.ok(l, h.said.slice(from).map((x) => x.key).join(', '));
  const n = getEntity(h.session.state, 'sample:staffs')?.item.size;
  assert.equal(l.params.n.key, `num.${n}`);
  assert.equal(vi['staffs.letgo'].replace('{n}', vi['num.4']), 'Em giữ nút lớn, đếm các đốt. Vạch tới đốt bốn thì buông tay.');
});

test('the show of the woodcutter counts up to the rings of the sample', async () => {
  const h = await atClump(1);
  h.session.command({ type: 'tap', target: { thing: 'culm:staffs:0' } });
  h.run(40, () => h.said.some((l) => l.key === 'mentor.staffs.show'));
  const keys = h.said.map((l) => l.key);
  const show = keys.indexOf('mentor.staffs.show');
  const first = keys.indexOf('mentor.staffs.first');
  const counted = keys.slice(first, show).filter((k) => /^num\./.test(k));
  const n = getEntity(h.session.state, 'sample:staffs')?.item.size;
  assert.equal(counted.at(-1), `num.${n}`, counted.join(', '));
});
