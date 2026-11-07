// Each carry has its next carry on the button (#172): after a lump in the hearth the button is not
// the bellows; a tap on the bellows makes the blow the act; a tap on a star at the hero makes the
// big button glow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';

const vi = load('i18n/vi.json');

async function atForge(grade = 5) {
  const s = load('tests/stories/forge-horse.json');
  let session = null;
  const events = [];
  const failures = await runHeadless({ ...s, profile: { ...s.profile, grade }, steps: s.steps.slice(0, 4) }, { onSession: (x) => { session = x; x.listen((e) => events.push(e)); } });
  assert.deepEqual(failures.map((f) => f.message), []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  return { session, events, run };
}

test('after one lump in the hearth, the button is the next lump, not the bellows; after a tap on the bellows, the blow', async () => {
  const h = await atForge(5);
  const ore = query(h.session.state, 'item').find((e) => e.item.kind === 'ore' && e.item.zone === 'horse-ore');
  h.session.command({ type: 'tap', target: { thing: ore.id } });
  h.run(5);
  h.session.command({ type: 'hands', id: h.session.action()?.id });
  h.run(1);
  h.session.command({ type: 'hands', id: h.session.action()?.id });
  h.run(5);
  assert.equal(getEntity(h.session.state, 'zone:hearth').zone.items.length, 1, 'one lump in the hearth');
  const acts = [];
  for (let i = 0; i < 20; i++) {
    h.run(0.2);
    acts.push(h.session.action()?.act ?? 'none');
  }
  assert.ok(!acts.includes('blow'), acts.join(', '));
  h.session.command({ type: 'tap', target: { thing: 'bellows:horse' } });
  h.run(5);
  assert.equal(h.session.action()?.act, 'blow');
  assert.equal(vi['horse.step.bellows'], 'Đủ sắt thì cháu chạm vào ống bễ, rồi bấm nút lớn.');
});

test('a tap on a star at the hero: the big button glows', async () => {
  const h = await atForge(5);
  const hp = getEntity(h.session.state, 'hero').position;
  const from = h.events.length;
  h.session.command({ type: 'tap', target: { ground: { x: hp.x / 2 + 1, y: hp.z / 2, h: 3, thing: false, object: null, goal: true } } });
  h.run(0.5);
  assert.ok(h.events.slice(from).some((e) => e.type === 'actGlow'));
});
