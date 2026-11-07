// The big button stays the work at bà lang (#169): the give of the basket comes only after a tap on
// her, also when the basket is right; with no tap, the button after a put is the next pick.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';

const s0 = load('tests/stories/trial-healer.json');
const first = s0.steps.findIndex((x) => x.read === true) + 1;
const vi = load('i18n/vi.json');

async function atHealer(grade) {
  let session = null;
  const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade }, steps: [...s0.steps.slice(0, first), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 90 } }, { wait: 2 }] }, {
    onSession: (x) => { session = x; },
  });
  assert.deepEqual(failures, []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  return { session, run };
}

for (const grade of [1, 4]) {
  test(`grade ${grade}: ten presses with no tap at the basket never give the basket`, async () => {
    const h = await atHealer(grade);
    const acts = [];
    for (let i = 0; i < 10; i++) {
      const a = h.session.action();
      acts.push(a?.act ?? 'none');
      h.session.command({ type: 'hands', id: a?.id ?? null });
      h.run(2.5);
    }
    assert.ok(!acts.includes('give'), acts.join(', '));
    assert.ok(!getEntity(h.session.state, 'zone:trial-healer')?.zone.commits, 'no try of the basket');
    // A tap on bà lang, and a press: the give.
    const healer = getEntity(h.session.state, 'npc:healer');
    const hp = healer.position;
    Object.assign(getEntity(h.session.state, 'hero').position, { x: hp.x + 2, z: hp.z + 1 });
    h.session.command({ type: 'tap', target: { person: healer.id } });
    h.run(1);
    if (getEntity(h.session.state, 'zone:basket')?.zone.items.length) assert.equal(h.session.action()?.act, 'give');
  });
}

test('the line of the give says the tap', () => {
  assert.equal(vi['mentor.healer.give'], 'Cháu chạm vào bà, rồi bấm nút lớn: bà nhận giỏ.');
  assert.equal(vi['mentor.healer.next'], 'Giỏ đủ rồi. Cháu chạm vào bà để đưa giỏ nhé.');
});
