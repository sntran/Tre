// The leaves of bà lang (#189): the recipe of one pack before the first put, a give that says the
// packs that are done and left and every herb that a pack lacks, a tap on a bed chooses its herb
// (the button shows that herb), and no close view during the task.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';

const vi = load('i18n/vi.json');
const s0 = load('tests/stories/trial-healer.json');
const first = s0.steps.findIndex((x) => x.read === true) + 1;

async function atHealer(grade = 4, until = { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 90 } }) {
  let session = null;
  const said = [];
  const events = [];
  const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade }, steps: [...s0.steps.slice(0, first), until, { wait: 2 }] }, { onSession: (x) => {
    session = x;
    x.listen((e) => {
      events.push(e);
      if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, params: e.params ?? {} });
    });
  } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  return { session, said, events, run };
}

test('the recipe of one pack comes before the first put, and the first pack of the model glows', async () => {
  const h = await atHealer(4);
  const keys = h.said.map((l) => l.key);
  const recipe = h.said.find((l) => l.key === 'healer.recipe');
  assert.ok(recipe, keys.join(', '));
  assert.equal(recipe.params.list.length, 3);
  assert.ok(keys.indexOf('healer.recipe') < keys.findIndex((k) => /mentor\.first\.you/.test(k)), 'before "Giờ đến lượt cháu."');
  const leaf = getEntity(h.session.state, 'zone:leaf-0').zone;
  assert.ok(h.events.some((e) => (e.type === 'glowSeq' || e.type === 'seq') && leaf.items.some((id) => (e.ids ?? []).includes(id))), 'the pack glows');
  assert.equal(vi['healer.recipe'], 'Mỗi thang: {list}.');
  assert.ok(!h.events.some((e) => e.type === 'workView' && e.key === 'packet'), 'no close view');
});

test('a give with one full pack says the packs that are done and left, and the whole pack', async () => {
  const h = await atHealer(4);
  const s = h.session;
  const plan = query(s.state, 'zone').find((z) => z.zone.plan?.recipe)?.zone.plan;
  for (const [k, n] of Object.entries(plan.recipe)) {
    const bed = getEntity(s.state, `zone:bed-${k}`).zone;
    s.command({ type: 'tap', target: { thing: bed.items.find((id) => !getEntity(s.state, id).item.held) } });
    h.run(4);
    for (let i = 0; i < n; i++) {
      s.command({ type: 'hands', id: s.action()?.id });
      h.run(1.5);
    }
  }
  const from = h.said.length;
  s.command({ type: 'tap', target: { person: 'npc:healer' } });
  h.run(3);
  s.command({ type: 'hands', id: s.action()?.id });
  h.run(30);
  const said = h.said.slice(from);
  const done = said.find((l) => l.key === 'healer.dose.done');
  assert.ok(done, said.map((l) => l.key).join(', '));
  assert.equal(done.params.d.key, 'num.1');
  assert.equal(done.params.r.key, `num.${plan.doses - 1}`);
  assert.ok(said.some((l) => l.key === 'healer.recipe'), said.map((l) => l.key).join(', '));
});

test('a tap on a bed (the place) chooses its herb: the button shows that herb', async () => {
  const h = await atHealer(4);
  const s = h.session;
  for (const k of ['tiato', 'rauma', 'ngai']) {
    s.command({ type: 'tap', target: { thing: `zone:bed-${k}` } });
    h.run(4);
    assert.equal(s.buttonThing(), `herb-${k}`, k);
  }
});
