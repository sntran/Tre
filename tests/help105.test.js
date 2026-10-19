// The help of #105: the first demonstration fades only by the gestures of Tre, a new form of a level
// shows its new part one time, the help goes on from the world as it is after a load, no line that
// the work makes false, a press that does nothing is a try, and a wave is never silent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';

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
