// At night the bed is the next step (#164): the star of rest shows for every step, also a step
// with a person; the sleep is the first act of the button, also on Nghé; a tap on a person still
// talks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';
import { restOf } from '../src/core/quests.js';

test('at night a step with a person has the rest too', () => {
  const step = { targets: [{ npc: 'elder' }, { encounter: 'river' }] };
  assert.ok(restOf(step, {}, { night: true })?.rest);
  assert.equal(restOf(step, {}, { night: false }), null);
});

async function atNight() {
  const s = load('tests/stories/raid-river-night.json');
  let session = null;
  const events = [];
  const failures = await runHeadless({ ...s, steps: [] }, { onSession: (x) => { session = x; x.listen((e) => events.push(e)); } });
  assert.deepEqual(failures, []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  run(2);
  return { session, events, run };
}

test('at night the button is the sleep where the hero stands, and a press sleeps until the dawn', async () => {
  const h = await atNight();
  assert.ok(h.session.restNow()?.rest, 'the step is the rest');
  assert.equal(h.session.action()?.act, 'sleep');
  h.run(1.2);
  h.session.command({ type: 'hands', id: h.session.action().id });
  h.run(1);
  assert.ok(h.events.some((e) => e.type === 'sleep'), 'the hero sleeps');
});

test('at night on Nghé the button is the sleep, and a press gets the hero down and sleeps', async () => {
  const h = await atNight();
  const nghe = query(h.session.state, 'follow')[0];
  const hero = getEntity(h.session.state, 'hero');
  Object.assign(nghe.position, { x: hero.position.x + 1, z: hero.position.z });
  h.session.command({ type: 'ride', mount: nghe.id });
  h.run(1);
  if (!hero.riding) hero.riding = nghe.id;
  h.run(0.5);
  assert.equal(h.session.action()?.act, 'sleep', 'the sleep on Nghé');
  h.run(1.2);
  h.session.command({ type: 'hands', id: h.session.action().id });
  h.run(1);
  assert.ok(h.events.some((e) => e.type === 'sleep'), 'the hero sleeps');
  assert.ok(!hero.riding, 'down from Nghé');
});

test('at night a tap on a person still gives the talk, not the sleep', async () => {
  const h = await atNight();
  const p = query(h.session.state, 'person').find((e) => e.person.kind === 'encounter' && !e.hidden);
  assert.ok(p, 'the enemy of the river');
  h.session.command({ type: 'tap', target: { person: p.id } });
  h.run(6);
  assert.notEqual(h.session.action()?.act, 'sleep', h.session.action()?.act);
});

test('at night a tap on Nghé gives the ride, and on her back the button is the sleep', async () => {
  const h = await atNight();
  const nghe = query(h.session.state, 'follow')[0];
  const hero = getEntity(h.session.state, 'hero');
  Object.assign(nghe.position, { x: hero.position.x + 2, z: hero.position.z });
  h.session.command({ type: 'pet', id: nghe.id });
  h.run(1.5);
  assert.equal(h.session.action()?.act, 'ride');
  h.session.command({ type: 'hands', id: h.session.action().id });
  h.run(1);
  assert.equal(hero.riding, nghe.id, 'on Nghé');
  assert.equal(h.session.action()?.act, 'sleep');
});
