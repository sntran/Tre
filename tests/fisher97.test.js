// The fisher after #92 (#97): the hole of the escape shows, one stake to take back, a new place
// for a stake that comes back, and the float in the frame.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity, query } from '../src/core/world/state.js';
import { load } from './helpers.js';
import { tapTarget } from '../src/core/story.js';
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
  const failures = await runHeadless({ name: 'fisher-97', profile, clock: 540, at: ['phu-dong', ...FISHER], steps: start }, { onSession: (s) => { session = s; hook(s); } });
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

test('after an escape, the mark of the hole lies over the water, the person points at it, and it stays until a stake stands in the hole', async () => {
  const story = load('tests/stories/trial-fisher.json');
  const at = story.steps.findIndex((x) => x.until?.event === 'escape') + 1;
  let s = null;
  const failures = await runHeadless({ ...story, steps: story.steps.slice(0, at) }, { onSession: (x) => { s = x; } });
  assert.deepEqual(failures, []);
  const line = getEntity(s.state, 'zone:line');
  const mark = () => getEntity(s.state, 'why:fisher:space');
  assert.ok(mark() && mark().position.y >= line.zone.y + 1, 'over the water');
  assert.equal(getEntity(s.state, 'npc:fisher').gesture?.act, 'point', 'the fisher points at it');
  run(s, 12);
  assert.ok(mark(), 'it stays after the water goes down');
  send(s, { type: 'tap', target: { thing: getEntity(s.state, 'zone:stakes').zone.items[0] } });
  run(s, 4);
  send(s, { type: 'hands' });
  run(s, 3);
  send(s, { type: 'tap', target: tapTarget(s, { line: 12 }).target });
  run(s, 4);
  send(s, { type: 'hands' });
  run(s, 3);
  assert.ok(slots(s).includes(12), `a stake in the hole: ${slots(s).join(',')}`);
  assert.ok(!mark(), 'the mark goes');
});

test('a stake that comes back does not go into the same hole at once; the person says to walk toward the float, and the next point glows', async () => {
  const seen = [];
  const session = await atRow((s) => s.listen((ev) => { if (ev.type === 'call') seen.push(ev.key); }));
  const line = getEntity(session.state, 'zone:line');
  // A stake at 6.
  send(session, { type: 'tap', target: { thing: getEntity(session.state, 'zone:stakes').zone.items[0] } });
  run(session, 4);
  send(session, { type: 'hands' });
  run(session, 2);
  send(session, { type: 'tap', target: tapTarget(session, { line: 6 }).target });
  run(session, 4);
  send(session, { type: 'hands' });
  run(session, 2);
  assert.ok(slots(session).includes(6), `a stake at 6: ${slots(session).join(',')}`);
  // The take back, and a press at once.
  const stake = query(session.state, 'item').find((e) => e.item.zone === 'line' && e.item.slot === 6);
  send(session, { type: 'tap', target: { thing: stake.id } });
  run(session, 1);
  send(session, { type: 'hands' });
  run(session, 0.4);
  assert.equal(getEntity(session.state, 'hero').hands?.holds, stake.id, 'the stake is in the hands');
  send(session, { type: 'hands' });
  run(session, 0.3);
  assert.equal(getEntity(session.state, 'hero').hands?.holds, stake.id, 'a press at once, with no walk, puts nothing');
  assert.ok(seen.includes('mentor.fisher.back'), `"Đi về phía phao, rồi cắm.": ${seen.join(', ')}`);
  assert.ok(getEntity(session.state, 'why:fisher:next'), 'the next point glows');
});

test('the line of the float frames the float with a margin', async () => {
  const names = [];
  await atRow((s) => s.listen((ev) => { if (ev.type === 'names') names.push(ev); }));
  const ev = names.find((n) => n.bobs?.includes('mark:fisher:end'));
  assert.ok(ev, 'the line names the float');
  const xs = ev.points.map((p) => p.x);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 4, 'a margin around the float');
});
