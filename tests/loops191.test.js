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
  assert.equal(stucks, 1, 'the whole line one time at the gap');
  const again = h.events.filter((e) => e.type === 'open' && e.textKey === 'mentor.bridge.stuck.again').length;
  assert.ok(again < 8, `${again} short lines after it`);
  assert.equal(vi['mentor.bridge.stuck.again'], 'Chưa vừa. Cháu thay tấm khác nhé.');
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

async function eventPresses(name, grade, presses = 14) {
  const story = load(`tests/stories/${name}.json`);
  const h = await start(story, { grade, steps: story.steps.slice(0, 5) });
  for (let c = 0; c < presses; c++) {
    h.session.command({ type: 'hands', id: h.session.action()?.id });
    h.run(2.5);
  }
  return h;
}

test('the stones of the cart go into the pits of one long hole, each put says its count, and the last says enough; then a press asks the carter', async () => {
  assert.equal(vi['event.cart.put'], '{n} hòn.');
  assert.equal(vi['event.cart.put.enough'], '{n} hòn. Đủ rồi!');
  const h = await eventPresses('event-cart', 0);
  const lines = h.events.filter((e) => e.type === 'open' && /^event\.cart\.put/.test(e.textKey ?? ''));
  const need = lines.length;
  assert.ok(need >= 4, `${need} counts`);
  lines.forEach((l, i) => assert.equal(l.params.n.key, `num.${i + 1}`));
  assert.equal(lines.at(-1).textKey, 'event.cart.put.enough');
  assert.ok(h.events.some((e) => e.type === 'open' && e.textKey === 'event.cart.done'), 'the press after the count asks the carter, and the cart is out');
  assert.equal(i18n.t('event.cart.put', { n: { key: 'num.1' } }), 'Một hòn.');
});

test('the hole of the cart has a pit for each stone, at the places of the stones', async () => {
  const { HOLE_ROW } = await import('../src/world/figures.js');
  const { ROW_STEP, ROW_LONG } = await import('../src/core/world/systems/work.js');
  assert.equal(HOLE_ROW.step * 2, ROW_STEP);
  assert.equal(HOLE_ROW.long, ROW_LONG);
  const story = load('tests/stories/event-cart.json');
  const h = await start(story, { grade: 0, steps: story.steps.slice(0, 5) });
  const mark = getEntity(h.session.state, 'mark:event-cart');
  const need = getEntity(h.session.state, 'zone:trial-event-cart').zone.need;
  assert.equal(mark.look, `mud-hole-${need}`);
});

test('each bucket of the flood pours with a splash, the water rises in the ditch, and after the last bucket no press takes a bucket', async () => {
  assert.equal(vi['event.flood.put'], '{n} thùng.');
  const h = await eventPresses('event-flood', 0, 16);
  const puts = h.events.filter((e) => e.type === 'put' && e.zone === 'event-flood-place');
  const need = getEntity(h.session.state, 'zone:trial-event-flood')?.zone.need ?? puts.length;
  assert.equal(puts.length, need, 'no bucket after the last one');
  assert.ok(puts.every((e) => e.sound === 'splash'), 'a splash');
  const lines = h.events.filter((e) => e.type === 'open' && /^event\.flood\.put/.test(e.textKey ?? ''));
  assert.equal(lines.length, need);
  assert.equal(lines.at(-1).textKey, 'event.flood.put.enough');
  assert.ok(h.events.some((e) => e.type === 'open' && e.textKey === 'event.flood.done'), 'the farmer checks');
  assert.equal(getEntity(h.session.state, 'mark:event-flood')?.look ?? 'ditch-4', 'ditch-4', 'the ditch is full');
});

test('the looks of the long hole and of the ditch at each level', async () => {
  const { thingLook, workThing } = await import('../src/world/figures.js');
  assert.deepEqual(thingLook('mud-hole-5'), { kind: 'mud', n: 5 });
  assert.deepEqual(thingLook('ditch-0'), { kind: 'ditch', level: 0 });
  const f = workThing(thingLook('mud-hole-5'));
  assert.equal(f.parts.filter((p) => /^pit/.test(p.name)).length, 5);
});

test('up to grade 2 the rule of the traps comes in short lines, one sentence each, and the pile glows with the first; from grade 3 the long line', () => {
  const raids = load('data/raids.json');
  assert.deepEqual(raids.toolLines.traps.short.map((k) => vi[k]), ['Bẫy ở đống này.', 'Cháu lấy một cái.', 'Bấm một lần, bẫy đi một cột.']);
  for (const [tool, line] of Object.entries(raids.toolLines)) {
    for (const k of line.short ?? []) {
      assert.ok(vi[k], k);
      assert.equal((vi[k].match(/[.!?](\s|$)/g) ?? []).length, 1, `${tool}: one sentence: ${vi[k]}`);
    }
  }
  const src = readFileSync(new URL('../src/core/session.js', import.meta.url), 'utf8');
  assert.match(src, /const SHORT_RULE_GRADE = 2;/);
  assert.match(src, /if \(l\.glowPile\) queue\(\(\) => emit\(\{ type: 'glowSeq', ids: \[\.\.\.\(zoneOf\('raid-traps'\)/);
});
