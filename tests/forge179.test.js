// The dip of the iron horse (#179): the line says when, at the moment ("Chờ…" at the fire, "Đỏ rồi!
// Nhúng ngay!" when the bar turns red); an early dip bends with the reason in colors; after a bend
// the bar goes back into the fire with the smith, the hearth glows (not the pile of ore), and the
// next red waits for the child at the anvil; Nghé stands behind the anvil.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';

const vi = load('i18n/vi.json');

async function atFire() {
  const s0 = load('tests/stories/forge-horse.json');
  const upto = s0.steps.findIndex((x) => x.until?.event === 'fire');
  let session = null;
  const said = [];
  const events = [];
  const failures = await runHeadless({ ...s0, steps: s0.steps.slice(0, upto + 1) }, { onSession: (x) => {
    session = x;
    x.listen((e) => {
      events.push({ ...e, tick: x.state.tick });
      if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, tick: x.state.tick, glow: getEntity(x.state, 'iron:horse')?.glow ?? 0 });
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
  return { session, said, events, run };
}

test('no line says "nhúng ngay" while the bar is not red; at the fire the smith says to wait, and at the red "Đỏ rồi! Nhúng ngay!"', async () => {
  const h = await atFire();
  const tz = getEntity(h.session.state, 'zone:trial-horse').zone;
  const a = tz.anvil;
  Object.assign(getEntity(h.session.state, 'hero').position, { x: a.x + 3, z: a.z + 2 });
  h.run(12);
  const hot = load('data/trials.json').trials.find((t) => t.id === 'horse').glow.hot;
  for (const l of h.said) if (/nhúng ngay/i.test(vi[l.key] ?? '')) assert.ok(l.glow >= hot - 0.05, `${l.key} at the glow ${l.glow}`);
  assert.ok(h.said.some((l) => l.key.startsWith('horse.step.anvil')), h.said.map((l) => l.key).join(', '));
  assert.match(vi['horse.step.anvil'], /Chờ sắt đỏ rực như quả gấc/);
  assert.ok(h.said.some((l) => l.key === 'horse.red'), h.said.map((l) => l.key).join(', '));
  assert.equal(vi['horse.red'], 'Đỏ rồi! Nhúng ngay!');
});

test('an early dip bends with the color as the reason; the bar goes back into the fire, the hearth glows, and the next red waits for the child at the anvil', async () => {
  const h = await atFire();
  const tz = getEntity(h.session.state, 'zone:trial-horse').zone;
  const a = tz.anvil;
  const hero = getEntity(h.session.state, 'hero');
  Object.assign(hero.position, { x: a.x + 3, z: a.z + 2 });
  h.run(0.3);
  h.session.command({ type: 'tap', target: { thing: 'iron:horse' } });
  h.run(0.5);
  const from = h.events.length;
  h.session.command({ type: 'hands', id: h.session.action()?.id });
  h.run(2.4);
  const after = h.events.slice(from);
  assert.ok(after.some((e) => e.type === 'bend'), 'the bar bends');
  const keys = after.filter((e) => e.type === 'open').map((e) => e.textKey);
  assert.ok(keys.includes('horse.bend.early'), keys.join(', '));
  assert.ok(keys.includes('horse.again'), keys.join(', '));
  const hearth = getEntity(h.session.state, 'zone:hearth');
  const iron = getEntity(h.session.state, 'iron:horse');
  assert.ok(Math.hypot(iron.position.x - hearth.zone.x, iron.position.z - hearth.zone.z) < 1, `the bar is in the fire: ${JSON.stringify(iron.position)} ${hearth.zone.x} ${hearth.zone.z} ${tz.bent}`);
  const bend = after.findIndex((e) => e.type === 'bend');
  const glows = after.slice(bend).filter((e) => e.type === 'glowThings' || e.type === 'cue').flatMap((e) => e.ids ?? []);
  assert.ok(glows.includes(hearth.id), glows.join(', '));
  assert.ok(!glows.some((id) => /ore/.test(id)), glows.join(', '));
  // The child walks away: the bar comes back to the anvil and waits, cold, for the child.
  Object.assign(hero.position, { x: a.x + 30, z: a.z + 30 });
  delete hero.route;
  h.run(8);
  assert.ok(Math.hypot(iron.position.x - a.x, iron.position.z - a.z) < 1, 'the bar is on the anvil');
  assert.equal(iron.glow ?? 0, 0, 'the bar waits for the child');
  Object.assign(hero.position, { x: a.x + 3, z: a.z + 2 });
  delete hero.route;
  h.run(8, () => h.said.filter((l) => l.key === 'horse.red').length >= 1 && h.said.at(-1).key === 'horse.red');
  assert.ok(h.said.some((l) => l.key === 'horse.red' && l.tick > h.events[from].tick), 'the red comes with the child there');
});

test('while the bar is on the anvil, Nghé stands behind the anvil', async () => {
  const h = await atFire();
  h.run(6);
  const nghe = query(h.session.state, 'follow').find((f) => f.follow.target === 'hero');
  if (!nghe) return;
  assert.ok(nghe.follow.goal?.anvil, 'the place of Nghé is behind the anvil');
});
