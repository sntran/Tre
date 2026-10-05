import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';

const story = (name) => load(`tests/stories/${name}.json`);
// The start of the cart event of the stories (grade 3, the sums to twenty not mastered yet).
const cart = (steps) => ({
  name: 'x', about: { vi: '-', en: '-' },
  profile: { name: 'An', grade: 3, lang: 'vi', seed: 7, flags: { 'intro.seen': true }, skills: { 'math.add.20': 0.4 } },
  clock: 540, at: ['phu-dong', 14.5, 80.5],
  steps: [{ do: { type: 'event', id: 'cart' } }, { wait: 0.5 }, { press: { entity: 'event:cart' } }, { until: { event: 'open', with: { screen: 'say' }, timeout: 30 } }, { read: true }, ...steps],
});
const put = [{ press: { item: 'stones' } }, { until: { event: 'pick', timeout: 30 } }, { press: { zone: 'event-cart-place' } }, { until: { event: 'put', timeout: 30 } }];

test('every move is logged with the outcome of the next commit', async () => {
  let end = null;
  const failures = await runHeadless(story('mentor-cart'), { log: true, onEnd: (x) => { end = x; } });
  assert.deepEqual(failures, []);
  const helps = end.profile.log.events.filter((e) => e.type === 'help');
  assert.ok(helps.some((e) => e.task === 'event-cart' && e.diagnosis === 'units' && e.move === 'demo' && e.success === true), JSON.stringify(helps));
  // The memory of the mentor: the demonstration helped this child.
  assert.equal(end.profile.mentors['event-cart'].worked.units.demo, 1);
});

test('a wave before any try gets "try first" and no hint; the ask is logged', async () => {
  let end = null;
  const events = [];
  const failures = await runHeadless(cart([
    { do: { type: 'wave' } },
    { wait: 1 },
    { expect: [{ event: 'mentor', with: { key: 'event-cart', move: 'tryFirst', asked: 'before' } }, { text: { shown: 'mentor.tryFirst' } }, { count: { entities: 'mentor-mark', max: 0 } }] },
  ]), { log: true, onEnd: (x) => { end = x; }, onSession: (s) => s.listen((ev) => events.push(ev)) });
  assert.deepEqual(failures, []);
  assert.ok(end.profile.log.events.some((e) => e.type === 'ask' && e.when === 'before' && e.move === 'tryFirst'));
});

test('a check at the place, then a change before the commit, is a self-correction', async () => {
  let end = null;
  const failures = await runHeadless(cart([
    ...put,
    { tap: { zone: 'event-cart-place' } },
    { until: { event: 'check', timeout: 5 } },
    ...put,
    { expect: [{ event: 'selfFix', with: { key: 'event-cart' } }] },
    // The person of the event checks the place.
    { press: { entity: 'event:cart' } },
    { until: { event: 'open', with: { screen: 'say' }, timeout: 30 } },
    { read: true },
  ]), { log: true, onEnd: (x) => { end = x; } });
  assert.deepEqual(failures, []);
  assert.ok(end.profile.log.events.some((e) => e.type === 'check' && e.task === 'event-cart' && e.changed === true));
  assert.equal(end.profile.mentors['event-cart'].selfFix, 1);
});

test('a raise never makes the round in progress bigger: the heap and the goal stay, and the next round is bigger', async () => {
  const bundle = { repeat: 10, steps: [{ press: { item: 'rod' } }, { until: { event: 'pick', timeout: 10 } }, { press: { zone: 'mat' } }, { until: { event: 'put', timeout: 10 } }] };
  const tie = [{ press: { entity: 'npc:teacher' } }, { until: { event: 'tie', timeout: 10 } }];
  const failures = await runHeadless({
    name: 'x', about: { vi: '-', en: '-' }, practice: 'bo-que',
    profile: { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } },
    clock: 540, at: ['phu-dong', 40, 30],
    steps: [
      { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } },
      { read: true },
      { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 15 } },
      { expect: [{ count: { entities: 'rod', min: 24, max: 24 } }] },
      // The teacher raises in the round: "next time" a bigger task. The heap of this round stays.
      { do: { type: 'mentor', key: 'trial-scholar', move: 'raise' } },
      { wait: 3 },
      { expect: [{ event: 'call', with: { key: 'mentor.raise' } }, { count: { entities: 'rod', min: 24, max: 24 } }] },
      bundle, ...tie, bundle, ...tie,
      // Fewer than ten rods are left: the round ends, and the next round is bigger.
      { until: { event: 'open', with: { screen: 'say', textKey: 'practiceLink.again' }, timeout: 10 } },
      { read: true },
      { expect: [{ count: { entities: 'rod', min: 46 } }] },
    ],
  });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
});
