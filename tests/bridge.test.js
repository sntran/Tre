// The bridge as a task of the fisher (#71): one task at a time, the marks of a ruler, and the
// plank that the child chooses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { getEntity, query } from '../src/core/world/state.js';
import { taskPools } from '../src/world/light.js';
import { leadFocus } from '../src/world/view.js';

const profile = (flags) => ({ name: 'An', grade: 2, lang: 'vi', seed: 7, flags: { 'intro.seen': true, ...flags } });

test('while the trial of the fisher is open, the bridge does not start: no talk, no planks for the guess, and no light of its own (#71)', async () => {
  let s = null;
  const opened = [];
  const failures = await runHeadless({ name: 'bridge-shut', profile: profile({}), clock: 540, at: ['phu-dong', 46, 61], steps: [{ wait: 6 }] }, {
    onSession: (x) => { s = x; x.listen((e) => { if (e.type === 'open') opened.push(e.textKey ?? e.screen); }); },
  });
  assert.deepEqual(failures, []);
  assert.ok(!opened.some((k) => String(k).includes('bridge')), `no line of the bridge: ${opened.join(', ')}`);
  const guesses = query(s.state, 'guess');
  assert.ok(guesses.length && guesses.every((g) => g.hidden), 'the planks for the guess do not show');
  assert.ok(getEntity(s.state, 'zone:bridge-gap').zone.shut);
  const hero = getEntity(s.state, 'hero').position;
  assert.ok(!taskPools(s.state.entities, hero).some((p) => p.task === 'bridge-gap'), 'no light of the bridge');
});

test('after the trial of the fisher, the bridge starts: the planks for the guess show, and the bridge has its light (#71)', async () => {
  let s = null;
  const failures = await runHeadless({ name: 'bridge-open', profile: profile({ 'trial.fisher.done': true }), clock: 540, at: ['phu-dong', 46, 61], steps: [{ until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } }] }, { onSession: (x) => { s = x; } });
  assert.deepEqual(failures, []);
  assert.ok(query(s.state, 'guess').every((g) => !g.hidden));
  const hero = getEntity(s.state, 'hero').position;
  const pool = taskPools(s.state.entities, hero).find((p) => p.task === 'bridge-gap');
  assert.ok(pool, 'the bridge has a pool of light');
  const z = getEntity(s.state, 'zone:bridge-gap').zone;
  assert.ok(Math.hypot(pool.x - z.lane, pool.z - (z.from + z.gap / 2)) <= pool.r, 'the pool holds the gap');
});

test('at night the lines of Nghé turn the view to the planks for the guess, and then to the pile and the gap: each fits on a phone with the hero (#71)', async () => {
  let s = null;
  const views = [];
  const lines = [];
  const failures = await runHeadless({ name: 'bridge-night-view', profile: profile({ 'trial.fisher.done': true }), clock: 1260, at: ['phu-dong', 46, 61], steps: [{ wait: 6 }, { press: { guess: 3 } }, { until: { event: 'guess', timeout: 5 } }, { wait: 2 }] }, {
    onSession: (x) => { s = x; x.listen((e) => { if (e.type === 'workView') views.push({ ...e, hero: { ...getEntity(x.state, 'hero').position }, rows: query(x.state, 'guess').map((g) => ({ id: g.id, ...g.position })) }); if (e.type === 'open') lines.push(e.textKey); }); },
  });
  assert.deepEqual(failures, []);
  assert.ok(lines.includes('mentor.nghe.bridge.guess'), `Nghé says the line of the guess: ${lines.join(', ')}`);
  const view = views.find((v) => v.key === 'bridge');
  assert.ok(view, 'the line comes with a view of the work');
  assert.ok(view.rows.length > 0);
  assert.equal(view.points.length, view.rows.length);
  for (const g of view.rows) assert.ok(view.points.some((p) => p.x === g.x && p.z === g.z), `the view holds ${g.id}`);
  const angles = [0, 1, 2, 3].map((k) => Math.PI / 4 + (k * Math.PI) / 2);
  const fits = (v) => angles.some((az) => leadFocus([v.hero, ...v.points].map((p) => ({ x: p.x / 2, y: p.y / 2, z: p.z / 2 })), { az, width: 390, height: 844 }).fits);
  assert.ok(fits(view), 'the rows and the hero fit on a phone held upright');
  // After the guess, the line of the next step names the pile and the gap: the view leads to them.
  assert.ok(lines.includes('mentor.bridge.next'), `the line of the next step: ${lines.join(', ')}`);
  const next = views.filter((v) => v.key === 'bridge').at(-1);
  assert.notEqual(next, view, 'a second view of the work');
  const pile = getEntity(s.state, 'zone:bridge-pile');
  const z = getEntity(s.state, 'zone:bridge-gap').zone;
  assert.ok(next.points.some((p) => p.x === pile.position.x && p.z === pile.position.z), 'the view holds the pile');
  assert.ok(next.points.some((p) => p.z === z.from) && next.points.some((p) => p.z === z.from + z.gap), 'the view holds both ends of the gap');
  assert.ok(fits(next), 'the pile, the gap, and the hero fit on a phone held upright');
});

test('a press takes a plank of the length of the last pick, and a tap on a plank of the pile chooses another length (#71)', async () => {
  const picks = [];
  const failures = await runHeadless({
    name: 'bridge-choose',
    profile: profile({ 'trial.fisher.done': true }),
    clock: 540,
    at: ['phu-dong', 46, 61],
    steps: [
      { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } },
      { read: true },
      { wait: 1.5 },
      { press: { plank: 5 } },
      { until: { event: 'pick', timeout: 20 } },
      { press: { screenOf: 'bridge-gap' } },
      { until: { event: 'put', timeout: 20 } },
      { wait: 1.5 },
      // A tap on the ground next to the pile, and then only the button: a plank of 5 again.
      { tap: { cell: [47, 62] } },
      { wait: 3 },
      { press: true },
      { until: { event: 'pick', timeout: 20 } },
      { press: { screenOf: 'bridge-gap' } },
      { until: { event: 'put', timeout: 20 } },
      { wait: 1.5 },
      // A tap on a plank of 3 chooses 3.
      { press: { plank: 3 } },
      { until: { event: 'pick', timeout: 20 } },
    ],
  }, { onSession: (x) => { x.listen((e) => { if (e.type === 'pick' && e.id === 'hero') picks.push(getEntity(x.state, e.item)?.item.size); }); } });
  assert.deepEqual(failures, []);
  assert.deepEqual(picks, [5, 5, 3]);
});

test('the looks of the marks: a ruler with a tick for each unit, the glow over the far bank, and the glow of a counted unit (#71)', async () => {
  const { thingLook, figureOf, plank } = await import('../src/world/figures.js');
  const ruler = figureOf(thingLook('ruler-12'));
  assert.equal(ruler.parts.filter((p) => /^t\d+$/.test(p.name ?? p.id)).length, 13, 'a tick at each end of each unit');
  assert.equal(figureOf(thingLook('over-3')).parts.length, 3);
  assert.equal(figureOf(thingLook('unit-glow')).parts.length, 1);
  // A plank of 5 has 5 dots and 4 lines between its units.
  const p = plank(5);
  assert.equal(p.parts.filter((x) => /^tick/.test(x.name ?? x.id)).length, 4);
});
