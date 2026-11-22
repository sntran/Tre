// Lines and loops (#191): at the bridge, a press after the take-back of the plank that glows puts
// it on the pile, and the next press takes a plank of another length, so that presses alone fill
// the gap; the farmer counts the ducks by ones up to grade 1 and by twos from grade 2, and each
// duck hops at its word.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { createI18n } from '../src/core/i18n.js';
import { getEntity, query } from '../src/core/world/state.js';

const vi = load('i18n/vi.json');
const i18n = createI18n(vi, 'vi');

async function start(story, { grade = null, steps = [], onEvent = null } = {}) {
  let session = null;
  const events = [];
  const failures = await runHeadless({ ...story, ...(grade !== null ? { profile: { ...story.profile, grade } } : {}), steps }, { onSession: (x) => {
    session = x;
    x.listen((e) => {
      events.push({ ...e, tick: x.state.tick });
      onEvent?.(e, x);
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
  return { session, events, run };
}

test('the bridge: presses alone fill the gap, and the plank that did not fit goes on the pile, not on the same gap again', async () => {
  const h = await start(load('tests/stories/bridge-mashing.json'));
  h.run(3);
  const gap = () => getEntity(h.session.state, 'zone:bridge-gap').zone;
  const puts = [];
  for (let c = 0; c < 60 && !gap().set && gap().items.reduce((a, id) => a + getEntity(h.session.state, id).item.size, 0) < gap().gap; c++) {
    const from = h.events.length;
    h.session.command({ type: 'hands', id: h.session.action()?.id });
    h.run(1.5);
    for (const e of h.events.slice(from)) if (e.type === 'put') puts.push({ item: e.item, zone: e.zone ?? getEntity(h.session.state, e.item)?.item.zone });
  }
  const sizes = gap().items.map((id) => getEntity(h.session.state, id).item.size);
  assert.equal(sizes.reduce((a, b) => a + b, 0), gap().gap, `the gap is full: ${sizes.join(' + ')}`);
  // After each take-back, the plank goes on the pile, and the next put on the gap is another length.
  const stucks = h.events.filter((e) => e.type === 'open' && e.textKey === 'mentor.bridge.stuck').length;
  assert.ok(stucks >= 1 && stucks < 8, `${stucks} lines of the stuck gap`);
  for (let i = 1; i < puts.length; i++) {
    if (puts[i].zone !== 'bridge-pile') continue;
    const next = puts.slice(i + 1).find((p) => p.zone === 'bridge-gap');
    if (next) assert.notEqual(next.item, puts[i].item, 'the next put on the gap is not the plank that went back');
  }
});

for (const [grade, words] of [[1, 'Một, hai, ba, bốn. Đủ đàn rồi!'], [2, 'Hai, bốn. Đủ đàn rồi!']]) {
  test(`grade ${grade}: the farmer counts the four ducks "${words}", and the ducks hop at the words`, async () => {
    // The story fills a flock of four at grade 1; the grade of the count changes before the last
    // tap on the farmer.
    const steps = load('tests/stories/event-duck.json').steps.slice(0, 19);
    const h = await start(load('tests/stories/event-duck.json'), { steps, onEvent: (e, x) => {
      if (e.type === 'open' && e.textKey === 'event.duck.short') x.profile.grade = grade;
    } });
    const said = h.events.find((e) => e.type === 'open' && e.textKey === 'event.duck.counted');
    assert.ok(said, 'the count');
    assert.equal(i18n.t(said.textKey, said.params), words);
    assert.equal(said.hops.length, grade === 1 ? 4 : 2);
    assert.ok(said.hops.every((g) => g.length === (grade === 1 ? 1 : 2)));
    const place = query(h.session.state, 'zone').find((z) => z.id === 'zone:event-duck-place')?.zone;
    assert.ok(said.hops.flat().every((id) => place.items.includes(id)), 'the hops are the ducks of the pen');
  });
}

test('an odd flock by twos ends with one more', () => {
  const list = { key: 'count.oddLast', params: { a: { key: 'count.next', params: { a: { key: 'num.2' }, b: { key: 'num.4' } } }, n: { key: 'num.5' } } };
  assert.equal(i18n.t('event.duck.counted', { list }), 'Hai, bốn, và một nữa là năm. Đủ đàn rồi!');
});
