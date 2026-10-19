// The help of #105: the first demonstration fades only by the gestures of Tre, a new form of a level
// shows its new part one time, the help goes on from the world as it is after a load, no line that
// the work makes false, a press that does nothing is a try, and a wave is never silent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';
import { spareStake } from '../src/core/world/systems/work.js';

function run(session, seconds) {
  for (let i = 0; i < seconds / STEP; i++) {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
  }
}
// The lines that a child sees and the tides.
function listen(session) {
  const out = [];
  session.listen((e) => {
    if (e.type === 'open' && e.textKey) out.push(e.textKey);
    if (e.type === 'tide') out.push('tide');
  });
  return out;
}

// The start of a task to the end of its first step: the lines of the person and the places of the puts.
async function firstOf(name, grade, flags = {}) {
  const s = load(`tests/stories/${name}.json`);
  const first = s.steps.findIndex((x) => x.read === true) + 1;
  const said = [];
  const puts = [];
  let end = null;
  const failures = await runHeadless({ ...s, profile: { ...s.profile, grade, flags: { ...s.profile.flags, ...flags } }, steps: [
    ...s.steps.slice(0, first), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 60 } },
  ] }, {
    onSession: (x) => x.listen((e) => {
      if (e.type === 'call') said.push(e.key);
      if ((e.type === 'put' && e.id !== 'hero') || (e.type === 'add' && e.by)) puts.push(e.zone ?? e.id);
    }),
    onEnd: (x) => { end = x; },
  });
  assert.deepEqual(failures.map((f) => `${f.step}: ${f.message}`), []);
  return { said, puts, flags: end.profile.flags };
}

test('a new form shows its new part one time, also to a child who knows the gesture: the bands of grade 3', async () => {
  const once = await firstOf('trial-scholar', 3, { 'gesture.carry': true });
  assert.ok(once.said.includes('mentor.show.scholar.groups'), once.said.join(', '));
  assert.ok(once.said.includes('mentor.first.back'), `the band goes to the row and back: ${once.said.join(', ')}`);
  assert.equal(once.flags['form.trial-scholar.groups'], true);
  const again = await firstOf('trial-scholar', 3, { 'gesture.carry': true, 'form.trial-scholar.groups': true });
  assert.ok(!again.said.includes('mentor.first.back'), `no demonstration the second time: ${again.said.join(', ')}`);
});

test('the boat of the fisher is a new gesture: the first step is a stake into the boat, not into the row', async () => {
  const r = await firstOf('trial-fisher', 3, { 'gesture.carry': true });
  assert.ok(r.said.includes('mentor.first.back'), r.said.join(', '));
  assert.ok(r.puts.includes('boat') && !r.puts.includes('line'), `the puts: ${r.puts.join(', ')}`);
});

test('the save of Tí: the fisher goes on from the row as it is, the stake to take back, then the hole, and the task ends', async () => {
  const profile = JSON.parse(readFileSync(new URL('../docs/reference/saves/ti-save.json', import.meta.url), 'utf8'));
  let session = null;
  let said = null;
  const failures = await runHeadless({ name: 'ti-save', steps: [{ wait: 2 }] }, { profile, onSession: (x) => { session = x; said = listen(x); } });
  assert.deepEqual(failures, []);
  const tap = (target) => { session.command({ type: 'tap', target }); run(session, 4); };
  const press = () => { session.command({ type: 'hands', id: session.action()?.id }); run(session, 1.5); };
  session.command({ type: 'wave' });
  run(session, 6);
  assert.deepEqual(said.filter((k) => !k.startsWith('note.')), ['mentor.fisher.tight'], 'the stake to take back, with no start again');
  const line = getEntity(session.state, 'zone:line');
  const spare = spareStake(line, query(session.state, 'item').filter((e) => e.item.zone === 'line' && e.item.slot != null));
  tap({ thing: spare.id });
  press();
  assert.equal(getEntity(session.state, 'hero').hands?.holds, spare.id);
  session.command({ type: 'wave' });
  run(session, 6);
  assert.equal(said.filter((k) => k.startsWith('mentor.')).at(-1), 'mentor.fisher.hole', 'with the stake in the hands, the hole');
  const h = getEntity(session.state, 'zone:trial-fisher').zone.hole;
  tap(session.targetAt((line.zone.x + h.from + h.size / 2) / 2, line.zone.z / 2));
  press();
  run(session, 100);
  assert.ok(getEntity(session.state, 'zone:trial-fisher').zone.done, said.join(', '));
  // "Đủ hàng rồi. Xem nước lên nào!" is true each time: a tide comes after it.
  said.forEach((k, i) => { if (k === 'fisher.full' || k === 'mentor.fisher.full') assert.ok(said.slice(i).includes('tide'), `a tide after ${k}: ${said.join(', ')}`); });
});

test('the fisher after an escape and a reload: a wave gives the hole, not the start', async () => {
  const story = load('tests/stories/trial-fisher.json');
  const at = story.steps.findIndex((x) => x.until?.event === 'escape') + 1;
  let session = null;
  let said = [];
  const failures = await runHeadless({ ...story, steps: [...story.steps.slice(0, at), { wait: 6 }, { reload: true }, { wait: 1 }, { do: { type: 'wave' } }, { wait: 5 }] }, {
    onSession: (x) => { session = x; said = listen(x); },
  });
  assert.deepEqual(failures, []);
  assert.ok(said.includes('mentor.fisher.hole'), said.join(', '));
  for (const k of ['mentor.tryFirst', 'mentor.show.fisher', 'mentor.first.you']) assert.ok(!said.includes(k), `${k}: ${said.join(', ')}`);
  void session;
});
