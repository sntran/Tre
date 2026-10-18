// The help of #96 at each level of #101: a wave gives a step that the child can do at that level,
// with the words of that level; the first step is only a point from grade 3 and for a child who did
// the gesture before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';

async function waves(name, grade, flags = {}) {
  const s = load(`tests/stories/${name}.json`);
  const first = s.steps.findIndex((x) => x.read === true) + 1;
  const said = [];
  const failures = await runHeadless({ ...s, profile: { ...s.profile, grade, flags: { ...s.profile.flags, ...flags } }, steps: [
    ...s.steps.slice(0, first), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 40 } },
    { do: { type: 'wave' } }, { wait: 2 }, { do: { type: 'wave' } }, { wait: 4 },
  ] }, { onSession: (x) => x.listen((e) => { if (e.type === 'open' && e.screen === 'callout' && e.textKey) said.push(e.textKey); }) });
  assert.deepEqual(failures.map((f) => `${f.step}: ${f.message}`), []);
  return said;
}

test('a wave at each level of the teacher gives the step of that level', async () => {
  const want = { 1: 'mentor.show.scholar', 2: 'mentor.show.scholar', 3: 'mentor.show.scholar.groups', 4: 'mentor.show.scholar.share', 5: 'mentor.show.scholar.decimal' };
  for (let grade = 1; grade <= 5; grade++) {
    const said = await waves('trial-scholar', grade);
    assert.ok(said.includes(want[grade]), `grade ${grade}: ${said.join(', ')}`);
    for (const [g, key] of Object.entries(want)) if (key !== want[grade]) assert.ok(!said.includes(key), `grade ${grade}: no line of grade ${g}: ${said.join(', ')}`);
  }
});

test('a wave at each level of the healer never names a thing that is not there', async () => {
  for (let grade = 1; grade <= 5; grade++) {
    const said = await waves('trial-healer', grade);
    assert.ok(said.some((k) => k.startsWith('mentor.show.healer')), `grade ${grade}: ${said.join(', ')}`);
    assert.equal(said.includes('mentor.show.healer.model'), grade === 4, `grade ${grade}: the line of the model`);
  }
});

test('the first step: a demonstration at grades 1 and 2 with no gesture before, only a point from grade 3 or after the gesture', async () => {
  for (const [grade, flags, demo] of [[1, {}, true], [2, {}, true], [3, {}, false], [1, { 'gesture.carry': true }, false]]) {
    const s = load('tests/stories/trial-scholar.json');
    const first = s.steps.findIndex((x) => x.read === true) + 1;
    const said = [];
    await runHeadless({ ...s, profile: { ...s.profile, grade, flags: { ...s.profile.flags, ...flags } }, steps: [...s.steps.slice(0, first), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 40 } }] }, {
      onSession: (x) => x.listen((e) => { if (e.type === 'call') said.push(e.key); }),
    });
    assert.equal(said.includes('mentor.first.back'), demo, `grade ${grade} ${JSON.stringify(flags)}: ${said.join(', ')}`);
  }
});

test('a put of the child into the place of a task keeps the gesture in the profile', async () => {
  const s = load('tests/stories/trial-scholar.json');
  const first = s.steps.findIndex((x) => x.read === true) + 1;
  let end = null;
  await runHeadless({ ...s, steps: [...s.steps.slice(0, first), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 40 } }, { press: { item: 'rod' } }, { until: { event: 'put', with: { id: 'hero' }, timeout: 15 } }] }, { onEnd: (x) => { end = x; } });
  assert.equal(end.profile.flags['gesture.carry'], true);
});
