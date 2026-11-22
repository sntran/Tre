// Lines and loops (#191): at the bridge, a press after the take-back of the plank that glows puts
// it on the pile, and the next press takes a plank of another length, so that presses alone fill
// the gap; the farmer counts the ducks by ones up to grade 1 and by twos from grade 2, and each
// duck hops at its word.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('the first card of the notebook is a big open page of the notebook under the goal bar', () => {
  const ui = readFileSync(new URL('../src/ui/village.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
  assert.match(ui, /class: first \? 'print-card first' : 'print-card'/);
  assert.match(css, /\.print-card\.first \{ flex-direction: column;/);
});

// The sleep itself and its clock: tests/rest155.test.js (the child wakes at 7:00).
test('after a sleep, "Sáng rồi!" comes when the sky is the sky of the day', async () => {
  const { nightAt, DEFAULT_DAY } = await import('../src/core/world/systems/sky.js');
  const sleep = readFileSync(new URL('../src/core/session.js', import.meta.url), 'utf8');
  assert.match(sleep, /state\.clock\.minutes = nextDawn\(from, \(env\.day \?\? DEFAULT_DAY\)\.dawn\[1\]\);/);
  assert.equal(nightAt(DEFAULT_DAY.dawn[1]), 0, 'the end of the dawn is the light of the day');
  assert.ok(nightAt(6) >= 0.5, 'at 6:00 the sky is still dark');
});

test('the line of the boss raid does not say that Gióng comes; the first sight of Gióng on his horse names him, and he glows', async () => {
  assert.ok(!/Gióng/.test(vi['raid.boss.intro']), vi['raid.boss.intro']);
  assert.equal(vi['giong.seen.horse'], 'Gióng đây! Gióng cưỡi ngựa sắt đi cùng em.');
  const story = load('tests/stories/raid-boss.json');
  const h = await start(story, { steps: story.steps });
  h.run(20);
  const seen = h.events.find((e) => e.type === 'open' && e.textKey === 'giong.seen.horse');
  assert.ok(seen, 'the line of the first sight');
  const at = h.events.indexOf(seen);
  assert.ok(h.events.slice(at, at + 3).some((e) => e.type === 'glowSeq' && (e.ids.includes('npc:giong-hero') || e.ids.includes('companion:raid'))), 'Gióng glows');
  assert.equal(h.events.filter((e) => e.type === 'open' && e.textKey === 'giong.seen.horse').length, 1, 'one time');
});

test('the title: with a save, the card of the save is the big yellow button, and a new adventure is a small button below it', () => {
  const ui = readFileSync(new URL('../src/ui/title.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
  assert.match(ui, /good\.forEach\(\(p, i\) => list\.append\(profileCard\(ctx, p, i === 0\)\)\);/);
  assert.match(ui, /cls: good\.length \? 'btn small paper' : 'btn big red'/);
  assert.match(css, /\.profile-card\.main \{[^}]*background: var\(--yellow\)/);
  // The list of the saves comes before the button of a new adventure.
  assert.ok(ui.indexOf("text.append(list)") < ui.indexOf("text.append(button(t('title.new')"));
});
