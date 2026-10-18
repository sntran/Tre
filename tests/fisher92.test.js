// The fisher after the play test of #85 to #89 (#92): the marks of the narrow gaps show (a frame on
// the water, and the stake bobs), a hint never asks for a stake from an empty pile, after the
// demonstration one bring of stakes is enough for the row, and a row at the float gets no stakes
// and gets the tide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity, query } from '../src/core/world/state.js';
import { tapTarget } from '../src/core/story.js';
import { stakesNeeded } from '../src/core/world/systems/work.js';

const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
const FISHER = [27, 64.5];
const start = [
  { press: { entity: 'npc:fisher' } },
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
  { read: true },
  { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 15 } },
];
async function atRow(hook = () => {}) {
  let session = null;
  const failures = await runHeadless({ name: 'fisher-92', profile, clock: 540, at: ['phu-dong', ...FISHER], steps: start }, { onSession: (s) => { session = s; hook(s); } });
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
const slots = (session) => query(session.state, 'item').filter((e) => e.item.zone === 'line').map((e) => e.item.slot).sort((a, b) => a - b);
const low = (session) => getEntity(session.state, 'zone:trial-fisher')?.zone.tide.phase === 'low';
// Presses only, until a condition (at most k presses).
function pressUntil(session, until, k = 160) {
  for (let i = 0; i < k && !until(); i++) {
    if (!low(session)) {
      run(session, 2);
      continue;
    }
    send(session, { type: 'hands', id: session.action()?.id });
    run(session, 3, until);
  }
}
function lines(session) {
  const out = [];
  session.listen((ev) => {
    if (ev.type === 'call') out.push(ev.key);
    if (ev.type === 'open' && ev.textKey) out.push(ev.textKey);
    if (ev.type === 'empty') out.push(`empty ${ev.n}`);
    if (ev.type === 'more' || ev.type === 'tide') out.push(ev.type);
  });
  return out;
}

test('at the first empty pile, each narrow gap has a frame on the water, and one stake to take back glows and bobs (#92, #97)', async () => {
  const cues = [];
  const session = await atRow((s) => s.listen((ev) => { if (ev.type === 'cue') cues.push(ev); }));
  const seen = lines(session);
  pressUntil(session, () => seen.includes('empty 1'));
  run(session, 1);
  const frames = session.state.entities.filter((e) => String(e.id).startsWith('why:fisher:narrow:'));
  assert.ok(frames.length > 0 && frames.every((e) => /^gap-frame-\d+(-dim)?$/.test(e.look)), `the frames: ${frames.map((e) => e.look).join(', ')}`);
  assert.ok(frames.some((e) => !/-dim$/.test(e.look)), 'the frames next to the stake to take back are bright');
  const bob = cues.filter((c) => c.bobs?.length).at(-1);
  assert.ok(bob && bob.bobs.length === 1 && /^stake:/.test(bob.bobs[0]), `one stake bobs: ${bob?.bobs.join(', ')}`);
  run(session, 6);
  assert.ok(seen.includes('mentor.fisher.tight'), `the hint of the take back: ${seen.join(', ')}`);
});

test('with an empty pile, a wave gives the take back, never a stake from the pile', async () => {
  const session = await atRow();
  const seen = lines(session);
  pressUntil(session, () => seen.includes('empty 1'));
  run(session, 10, () => seen.includes('mentor.fisher.tight'));
  run(session, 3);
  const before = seen.length;
  assert.ok(!getEntity(session.state, 'zone:stakes').zone.items.some((id) => !getEntity(session.state, id)?.item.held), 'the pile is empty');
  send(session, { type: 'wave' });
  run(session, 10, () => seen.slice(before).some((x) => /^mentor\./.test(x)));
  run(session, 1);
  const after = seen.slice(before);
  assert.ok(after.includes('mentor.fisher.tight'), `a wave gives the take back: ${after.join(', ')}`);
  assert.ok(!after.includes('mentor.show.fisher'), 'not "Lấy một cái cọc ở đống …"');
});

test('after the demonstration, one bring of stakes is enough for the row, and a row at the float gets the tide and no stakes', async () => {
  const session = await atRow();
  const seen = lines(session);
  pressUntil(session, () => seen.includes('more'));
  assert.ok(seen.includes('empty 2'), 'the demonstration came first');
  run(session, 2);
  // The new stakes lie next to the row, and the child puts each at the gap of the fisher.
  const z = getEntity(session.state, 'zone:line').zone;
  const pile = getEntity(session.state, 'zone:stakes');
  assert.ok(Math.abs(pile.zone.z - z.z) <= 4, 'the stakes lie next to the row');
  let last = Math.max(...slots(session));
  for (let k = 0; k < 8 && !slots(session).includes(z.length); k++) {
    const id = pile.zone.items.find((x) => !getEntity(session.state, x)?.item.held);
    assert.ok(id, `a stake for the next point (row: ${slots(session).join(',')})`);
    send(session, { type: 'tap', target: { thing: id } });
    run(session, 0.3);
    send(session, { type: 'hands' });
    run(session, 6, () => getEntity(session.state, id)?.item.held === 'hero');
    const at = Math.min(z.length, last + z.space);
    send(session, { type: 'tap', target: tapTarget(session, { line: at }).target });
    run(session, 2);
    send(session, { type: 'hands' });
    run(session, 8, () => slots(session).includes(at));
    last = at;
  }
  assert.ok(slots(session).includes(z.length), `the row reaches the float: ${slots(session).join(',')}`);
  assert.equal(seen.filter((x) => x === 'more').length, 1, `one bring of stakes: ${seen.join(', ')}`);
  const atFloat = seen.length;
  run(session, 30, () => seen.slice(atFloat).includes('tide'));
  const after = seen.slice(atFloat);
  assert.ok(after.includes('tide'), `the tide comes: ${after.join(', ')}`);
  assert.ok(!after.includes('more') && !after.includes('fisher.more'), 'no more stakes at the float');
});

test('the bring counts the rest at the gap that the child uses, when it is narrower than the gap of the fisher', () => {
  const line = { zone: { space: 4, length: 16 } };
  const row = (...slots) => slots.map((slot) => ({ item: { slot } }));
  // At the gap of the fisher: a gap of 8 needs one stake, and the rest from 8 to 16 two stakes.
  assert.equal(stakesNeeded(line, row(4, 12)), 1 + 1);
  assert.equal(stakesNeeded(line, row(4, 8)), 2);
  // A child who only presses puts the stakes one apart: the rest comes at that gap, in one bring.
  assert.equal(stakesNeeded(line, row(1, 2, 3)), 13);
});
