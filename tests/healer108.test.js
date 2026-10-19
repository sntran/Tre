// The healer after the play test (#108): a bunch in the hands goes back to its bed, and a press
// takes from the bed of the last tap.
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
  const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade }, steps: [...s0.steps.slice(0, first), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 90 } }, { wait: 2 }] }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => {
        if (e.type === 'open' && e.textKey) said.push(e.textKey);
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
  return { session, said, puts, run, press, zone, tapThing, bedThing };
}

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
