// The ferry (#190): the things on both banks in the view at each landing, the next move at the
// landing (the boat crosses in about 2 s), the first line after the view frames the river, no walk
// away from the riddle, and at the win the traveler comes over to the bank of the hero, his star
// goes, and he gives the eggs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { drawable } from '../src/world/figures.js';

const s0 = load('tests/stories/ferry-k.json');

async function atFerry() {
  let session = null;
  const said = [];
  const events = [];
  const failures = await runHeadless({ ...s0, steps: [] }, { onSession: (x) => {
    session = x;
    x.listen((e) => {
      events.push({ ...e, tick: x.state.tick });
      if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, tick: x.state.tick });
    });
  } });
  assert.deepEqual(failures, []);
  const run = (sec, until = () => false) => {
    for (let i = 0; i < sec / STEP && !until(); i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const press = () => session.command({ type: 'hands', id: session.action()?.id });
  return { session, said, events, run, press };
}

test('at each landing the next move comes at once, the view frames the things and the hero, and each thing on the bank of the hero is drawn; the button never walks away from the riddle', async () => {
  const h = await atFerry();
  h.run(12);
  for (let crossing = 0; crossing < 3 && !h.said.some((l) => l.key === 'puzzle.ferry.easy.done'); crossing++) {
    // A take (when a thing waits), then the boat.
    for (let k = 0; k < 2; k++) {
      const a = h.session.action();
      assert.ok(!a?.walk || a.act === 'cross' || a.act === 'take', `no walk away: ${JSON.stringify(a)}`);
      if (a?.act === 'cross') break;
      h.press();
      h.run(1.5);
    }
    const start = h.session.state.tick;
    h.press();
    h.run(8, () => h.events.some((e) => e.type === 'ferried' && e.tick > start));
    const landed = h.events.find((e) => e.type === 'ferried' && e.tick > start);
    assert.ok(landed, 'the boat lands');
    assert.ok((landed.tick - start) * STEP <= 4, `${((landed.tick - start) * STEP).toFixed(1)} s from the press to the landing`);
    h.run(0.3);
    const line = h.said.find((l) => l.tick >= landed.tick && /^puzzle\.ferry\.(next|easy\.done|done)/.test(l.key));
    assert.ok(line, h.said.slice(-4).map((l) => l.key).join(', '));
    const view = h.events.filter((e) => e.type === 'workView' && e.tick >= landed.tick - 1).at(-1);
    assert.ok(view, 'the view frames the banks');
    const hero = getEntity(h.session.state, 'hero').position;
    assert.ok(view.points.some((p) => Math.hypot(p.x - hero.x, p.z - hero.z) < 1.5), 'the hero is in the frame');
    for (const id of ['pz:dog', 'pz:rice']) {
      const e = getEntity(h.session.state, id);
      assert.ok(drawable(e), id);
      assert.ok(view.points.some((p) => Math.hypot(p.x - e.position.x, p.z - e.position.z) < 1.5) || e.item?.zone === 'boat', `${id} is in the frame`);
    }
    h.run(1);
  }
});

test('at the win the traveler comes over to the bank of the hero, his star goes, and he gives the eggs', async () => {
  const h = await atFerry();
  h.run(12);
  for (let i = 0; i < 16 && !h.said.some((l) => l.key === 'puzzle.ferry.easy.done'); i++) {
    h.press();
    h.run(4);
  }
  assert.ok(h.said.some((l) => l.key === 'puzzle.ferry.easy.done'), h.said.slice(-6).map((l) => l.key).join(', '));
  h.run(6);
  const tr = getEntity(h.session.state, 'pz:traveler');
  const hero = getEntity(h.session.state, 'hero');
  assert.ok(Math.hypot(tr.position.x - hero.position.x, tr.position.z - hero.position.z) <= 6, 'the traveler is next to the hero');
  assert.ok(getEntity(h.session.state, 'pz:mark:ferry')?.hidden, 'his star goes');
  assert.ok(h.said.some((l) => l.key === 'puzzle.ferry.gift'));
});

test('the first line of the riddle comes after the view frames the river', async () => {
  const h = await atFerry();
  h.run(12);
  const view = h.events.find((e) => e.type === 'workView' && e.key === 'puzzle');
  const first = h.said.find((l) => /^puzzle\.ferry\.(start|easy)/.test(l.key));
  assert.ok(view && first, h.said.map((l) => l.key).join(', '));
  assert.ok((first.tick - view.tick) * STEP >= 1.4, `${((first.tick - view.tick) * STEP).toFixed(1)} s`);
});
