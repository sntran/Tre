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
  const bundle = { repeat: 10, steps: [{ press: { item: 'rod' } }, { until: { event: 'put', timeout: 10 } }] };
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
      { expect: [{ count: { entities: 'rod', min: 36 } }] },
    ],
  });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
});

test('each station says the move "show" with its own words, and each line is in both languages (#45)', () => {
  const mentors = load('data/world/mentors.json').mentors;
  const vi = load('i18n/vi.json');
  const en = load('i18n/en.json');
  const shows = Object.entries(mentors).filter(([k]) => k.startsWith('trial-') || k === 'bridge').map(([k, m]) => [k, m.lines?.show]);
  for (const [k, key] of shows) {
    assert.ok(key && key !== 'mentor.show', `${k}: its own show line`);
    assert.ok(vi[key] && en[key], `${k}: ${key} in both languages`);
  }
  assert.equal(new Set(shows.map(([, key]) => key)).size, shows.length, 'no two stations share a show line');
});

test('each person of a task has an own line for each move that names the things of the work (#48: no line about a heap where there is no heap)', () => {
  const vi = load('i18n/vi.json');
  const en = load('i18n/en.json');
  const mentorsData = load('data/world/mentors.json');
  const THINGS = ['first', 'show', 'mark', 'demo', 'smaller', 'share'];
  for (const [key, m] of Object.entries(mentorsData.mentors)) {
    if (!key.startsWith('trial-') && key !== 'bridge') continue;
    const fam = mentorsData.families[m.family];
    const moves = new Set(['first', 'show', ...Object.values(fam.ladders).flat()]);
    for (const move of THINGS.filter((x) => moves.has(x))) {
      const line = m.lines?.[move];
      assert.ok(line && line !== mentorsData.lines[move], `${key}: an own line for the move ${move}`);
      assert.ok(vi[line] && en[line], `${key}: the line ${line} in the two languages`);
    }
  }
});

test('a line of a break names only a place where the child has something to do: after the trial of the smith, the fisher says only to rest (#57)', async () => {
  for (const [done, line] of [[false, 'mentor.picture.fisher'], [true, 'mentor.break']]) {
    const s = story('trial-fisher');
    const first = s.steps.findIndex((x) => x.read === true);
    const flags = { ...s.profile.flags, ...(done ? { 'trial.smith.done': true } : {}) };
    const failures = await runHeadless({ ...s, profile: { ...s.profile, flags }, steps: [
      ...s.steps.slice(0, first + 1),
      { do: { type: 'mentor', key: 'trial-fisher', move: 'picture' } },
      { until: { event: 'open', with: { textKey: line }, timeout: 10 } },
    ] });
    assert.deepEqual(failures, [], `the smith done: ${done}`);
  }
});
