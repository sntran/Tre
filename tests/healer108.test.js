// The healer after the play test (#108): the model basket is a thing of its own, the first step of
// the model deals it onto its leaves, no help puts bunches at a level with a structure, the check of
// a wrong basket is by doses, a bunch in the hands goes back to its bed, a press takes from the
// bed of the last tap, and a line that names a bed makes its sign glow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, command as worldCommand } from '../src/core/world/state.js';

const s0 = load('tests/stories/trial-healer.json');
const first = s0.steps.findIndex((x) => x.read === true) + 1;

async function atHealer(grade) {
  let session = null;
  const said = [];
  const puts = [];
  const names = [];
  const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade }, steps: [...s0.steps.slice(0, first), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 90 } }, { wait: 2 }] }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => {
        if (e.type === 'open' && e.textKey) said.push(e.textKey);
        if (e.type === 'names') names.push(...e.ids);
        if ((e.type === 'put' || e.type === 'add') && e.id !== 'hero') puts.push({ by: e.by ?? e.id, zone: e.zone, item: e.item });
      });
    },
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
  const zone = (id) => getEntity(session.state, `zone:${id}`)?.zone;
  const tapThing = (id) => { session.command({ type: 'tap', target: { thing: id } }); run(4); };
  const bedThing = (k) => zone(`bed-${k}`).items.find((id) => !getEntity(session.state, id)?.item.held);
  return { session, said, puts, names, run, press, zone, tapThing, bedThing };
}

test('the model basket stands away from the basket of the healer and the beds, and its first step deals it onto both leaves', async () => {
  const h = await atHealer(4);
  const r = h.zone('basket').rect;
  // No leaf of the model in front of a bed (#108: the hero could not walk to the bed of ngải cứu).
  for (const k of ['ngai', 'tiato', 'rauma']) {
    const b = h.zone(`bed-${k}`);
    for (const j of [0, 1]) assert.ok(Math.hypot(h.zone(`leaf-${j}`).x - b.x, h.zone(`leaf-${j}`).z - b.z) > 5, `leaf ${j} at the bed of ${k}`);
  }
  const m = h.zone('model');
  const gap = Math.max(r.x0 - (m.x + 3), 0, m.x - r.x1);
  assert.ok(gap >= 2, `the model is ${gap.toFixed(1)} half blocks from the basket`);
  assert.equal(getEntity(h.session.state, 'basket:healer:model').look, 'basket-small');
  assert.ok(getEntity(h.session.state, 'mat:healer:model'), 'the model has a mat of its own');
  assert.ok(h.puts.some((p) => p.zone === 'leaf-0') && h.puts.some((p) => p.zone === 'leaf-1'), JSON.stringify(h.puts));
  // No bunch into the basket of the child, also not for a moment: the deal shows the take and the put.
  assert.ok(!h.puts.some((p) => p.zone === 'basket'), JSON.stringify(h.puts));
  assert.ok(h.said.includes('healer.model.leaf'), h.said.join(', '));
  // A tap on the model: the healer counts it by kinds.
  h.tapThing(h.zone('model').items[0]);
  assert.ok(h.said.includes('healer.model.count'), h.said.join(', '));
});

test('at the levels of doses, the model, and fractions, a wave never puts a bunch into the basket of the child', async () => {
  for (const grade of [3, 4, 5]) {
    const h = await atHealer(grade);
    for (const k of ['ngai', 'rauma']) {
      h.tapThing(h.bedThing(k));
      h.press();
    }
    h.session.command({ type: 'tap', target: { person: 'npc:healer' } });
    h.run(5);
    h.press();
    h.run(25);
    const from = h.puts.length;
    for (let i = 0; i < 3; i++) {
      h.session.command({ type: 'wave' });
      h.run(30);
    }
    assert.ok(!h.puts.slice(from).some((p) => p.zone === 'basket'), `grade ${grade}: ${JSON.stringify(h.puts.slice(from))}`);
  }
});

test('the check of a wrong basket at grade 4 lays it in doses and says what the last dose lacks', async () => {
  const h = await atHealer(4);
  for (const k of ['ngai', 'tiato', 'rauma', 'rauma']) {
    h.tapThing(h.bedThing(k));
    h.press();
  }
  h.session.command({ type: 'tap', target: { person: 'npc:healer' } });
  h.run(5);
  h.press();
  h.run(25);
  assert.ok(h.said.includes('healer.dose.lay'), h.said.join(', '));
  assert.ok(h.said.includes('healer.dose.lack'), h.said.join(', '));
});

test('a tap on another bed with a bunch in the hands puts the bunch back on its own bed', async () => {
  const h = await atHealer(4);
  const tiato = h.bedThing('tiato');
  h.tapThing(tiato);
  worldCommand(h.session.state, { type: 'pick', id: 'hero', item: tiato });
  h.run(1);
  assert.equal(getEntity(h.session.state, 'hero').hands?.holds, tiato);
  h.tapThing(h.bedThing('ngai'));
  h.run(6);
  assert.notEqual(getEntity(h.session.state, 'hero').hands?.holds, tiato);
  assert.ok(h.zone('bed-tiato').items.includes(tiato), 'the bunch is back on its bed');
  assert.ok(h.said.includes('healer.home.tiato'), h.said.join(', '));
});

test('a press at once after a tap on another bed takes from that bed', async () => {
  const h = await atHealer(1);
  h.tapThing(h.bedThing('rauma'));
  h.press();
  const picks = [];
  h.session.listen((e) => { if (e.type === 'pick' && e.id === 'hero') picks.push(e.item); });
  h.session.command({ type: 'tap', target: { thing: h.bedThing('ngai') } });
  h.session.step();
  h.session.events();
  h.session.command({ type: 'hands', id: h.session.action()?.id });
  h.run(6);
  assert.ok(picks.length && picks.every((id) => id.startsWith('herb-ngai')), picks.join(', '));
});

test('a line of the talk that names a bed makes the sign of the bed glow', async () => {
  const h = await atHealer(1);
  for (const k of ['ngai', 'tiato', 'rauma']) assert.ok(h.names.includes(`sign:healer:bed-${k}`), h.names.join(', '));
});
