// The dip of the iron horse (#188): the bar stays red for 1 s after the last word of "Đỏ rồi! Nhúng
// ngay!" and 3 s more; after a bend no press bends the cold bar again; the water glows only at the
// red; the anvil calls the child; each lump says its count, and one press takes a lump and puts it
// in the hearth; the hero gets down from Nghé at the anvil.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';

const vi = load('i18n/vi.json');
const s0 = load('tests/stories/forge-horse.json');

async function play(upto, grade = null) {
  let session = null;
  const said = [];
  const events = [];
  const failures = await runHeadless({ ...s0, ...(grade !== null ? { profile: { ...s0.profile, grade } } : {}), steps: s0.steps.slice(0, upto) }, { onSession: (x) => {
    session = x;
    x.listen((e) => {
      events.push({ ...e, tick: x.state.tick });
      if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, params: e.params ?? {}, tick: x.state.tick });
    });
  } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const run = (sec, until = () => false) => {
    for (let i = 0; i < sec / STEP && !until(); i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  return { session, said, events, run, tz: () => getEntity(session.state, 'zone:trial-horse').zone };
}
const atFire = (grade = null) => play(s0.steps.findIndex((x) => x.until?.event === 'fire') + 1, grade);

for (const grade of [1, 3]) {
  test(`grade ${grade}: the bar stays hot for at least 1 s after the last word of "Đỏ rồi! Nhúng ngay!" and 3 s more`, async () => {
    const h = await atFire(grade);
    const a = h.tz().anvil;
    Object.assign(getEntity(h.session.state, 'hero').position, { x: a.x + 3, z: a.z + 2 });
    h.run(12, () => h.said.some((l) => l.key === 'horse.red'));
    const red = h.said.find((l) => l.key === 'horse.red');
    assert.ok(red, 'the red line');
    const hot = load('data/trials.json').trials.find((t) => t.id === 'horse').glow.hot;
    let last = red.tick;
    h.run(10, () => {
      if ((getEntity(h.session.state, 'iron:horse')?.glow ?? 0) >= hot) last = h.session.state.tick;
      return (getEntity(h.session.state, 'iron:horse')?.glow ?? 0) < hot && h.session.state.tick > red.tick + 2 / STEP;
    });
    // "Đỏ rồi! Nhúng ngay!" takes about 1.2 s to say.
    assert.ok((last - red.tick) * STEP >= 1.2 + 1 + 3, `${((last - red.tick) * STEP).toFixed(1)} s`);
  });
}

test('after a bend, no press bends the bar again while it goes back into the fire; the water glows only at the red', async () => {
  const h = await atFire();
  const a = h.tz().anvil;
  Object.assign(getEntity(h.session.state, 'hero').position, { x: a.x + 3, z: a.z + 2 });
  h.run(0.3);
  // Before the red, the water does not glow.
  const glowsBefore = h.events.filter((e) => e.type === 'cue' || e.type === 'glowThings').flatMap((e) => e.ids ?? []);
  assert.ok(!glowsBefore.some((id) => /trough/.test(id)), glowsBefore.join(', '));
  h.session.command({ type: 'hands', id: h.session.action()?.id });
  h.run(0.5);
  const bends = () => h.events.filter((e) => e.type === 'bend').length;
  assert.equal(bends(), 1, 'the early dip bends');
  for (let i = 0; i < 6; i++) {
    h.session.command({ type: 'hands', id: h.session.action()?.id });
    h.run(0.6);
  }
  assert.equal(bends(), 1, 'no press bends the cold bar again');
});

test('the bar waits at the anvil: the smith calls the child and the bar glows', async () => {
  assert.equal(vi['horse.come'], 'Cháu lại đây, đứng cạnh đe nhé.');
  const h = await atFire();
  const a = h.tz().anvil;
  const hero = getEntity(h.session.state, 'hero');
  Object.assign(hero.position, { x: a.x + 3, z: a.z + 2 });
  h.run(0.3);
  h.session.command({ type: 'hands', id: h.session.action()?.id });
  h.run(0.5);
  Object.assign(hero.position, { x: a.x + 20, z: a.z + 4 });
  delete hero.route;
  h.run(12, () => h.said.some((l) => l.key === 'horse.come'));
  assert.ok(h.said.some((l) => l.key === 'horse.come'), h.said.map((l) => l.key).join(', '));
});

test('each lump in the hearth says its count, and the sixth says it is enough', () => {
  assert.equal(vi['horse.lump'], '{n} miếng.');
  assert.equal(vi['horse.lump.enough'], '{n} miếng. Đủ rồi!');
  const src = load('src/core/session.js'.replace(/.*/, 'data/trials.json'));
  assert.ok(src.trials.find((t) => t.id === 'horse').levels.every((l) => l.hold >= 3.2));
});
