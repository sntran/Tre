// The ferry after the play test (#110): no hint before the puzzle, the puzzle in short lines, the
// things taken by nearness, an empty boat does not cross from the full bank, both banks in the view
// with the line of the bank that the hero left, the first hint is the rule, no ford in the frame of
// the puzzle, and a traveler who does not look like the fisher.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { OFFER_NEAR } from '../src/core/puzzles.js';

const data = load('data/world/puzzles.json');
const F = data.ferry;
const CLOCK = 9 * 1440 + 700;

async function at(cell) {
  const s = load('tests/stories/trial-fisher.json');
  let session = null;
  const said = [];
  const views = [];
  const failures = await runHeadless({ ...s, at: ['phu-dong', ...cell], clock: CLOCK, steps: [{ wait: 1 }] }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => {
        if (e.type === 'open' && e.textKey) said.push(e.textKey);
        if (e.type === 'workView' && e.key === 'puzzle') views.push(e.points);
      });
    },
  });
  assert.deepEqual(failures, []);
  const run = (sec, stop) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: 'close' });
      session.step();
      session.events();
      if (stop?.()) return true;
    }
    return false;
  };
  const press = () => {
    run(1);
    const a = session.action()?.act;
    session.command({ type: 'hands' });
    run(1.2);
    return a;
  };
  const ferry = () => session.puzzles.state().ferry;
  const boat = () => getEntity(session.state, 'ferry:pz').ferry;
  const standAt = (id) => {
    const e = getEntity(session.state, id);
    const h = getEntity(session.state, 'hero');
    // In front of the thing, facing it.
    Object.assign(h.position, { x: e.position.x, z: e.position.z - 1.4, facing: 0 });
    delete h.route;
    run(1.5);
  };
  return { session, said, views, run, press, ferry, boat, standAt };
}

test('a wave near the traveler before the puzzle gives no hint; the first wave after the puzzle gives the rule, again until a wrong crossing', async () => {
  // Far enough that the traveler does not say the puzzle, but near (the old wave worked 40 half
  // blocks away).
  const p = await at([12, 62]);
  const tr = getEntity(p.session.state, 'pz:traveler');
  const h = getEntity(p.session.state, 'hero');
  assert.ok(Math.hypot(tr.position.x - h.position.x, tr.position.z - h.position.z) > OFFER_NEAR);
  assert.ok(!p.ferry().offered);
  p.session.command({ type: 'wave' });
  p.run(3);
  assert.ok(!p.said.some((k) => /^puzzle\.ferry\.hint/.test(k)), p.said.join(', '));
  // Near: the puzzle in short lines, one at a time.
  Object.assign(h.position, { x: tr.position.x - 3, z: tr.position.z - 1 });
  delete h.route;
  p.run(12);
  assert.deepEqual(p.said.filter((k) => /^puzzle\.ferry\.start/.test(k)), F.offer);
  for (let i = 0; i < 2; i++) {
    const n = p.said.length;
    p.session.command({ type: 'wave' });
    p.run(3);
    assert.ok(p.said.slice(n).includes('puzzle.ferry.hint.1'), `wave ${i + 1}: ${p.said.slice(n).join(', ')}`);
  }
});

test('next to a thing, the button takes it with no tap; an empty boat does not cross from the full bank', async () => {
  const p = await at([3, 62]);
  p.run(10);
  p.standAt('pz:dog');
  const a = p.session.action();
  assert.equal(a?.act, 'take');
  assert.equal(a.target, 'pz:dog');
  // At the landing with empty hands and all three things on the bank: no crossing.
  const h = getEntity(p.session.state, 'hero');
  Object.assign(h.position, { x: p.boat().landA.x, z: p.boat().landA.z - 1 });
  delete h.route;
  p.run(1.5);
  assert.equal(p.press(), 'cross');
  p.run(3);
  assert.equal(p.boat().side, 'a');
  assert.equal(p.boat().state, 'wait');
  assert.ok(p.said.includes('puzzle.ferry.empty'), p.said.join(', '));
});

test('after a crossing, the view frames the things of both banks, and the traveler says what is on the bank that the hero left', async () => {
  const p = await at([3, 62]);
  p.run(10);
  p.standAt('pz:chicken');
  assert.equal(p.press(), 'take');
  // The picture of the button is the boat with the chicken in it.
  p.run(0.5);
  assert.equal(p.session.buttonThing(), 'chicken');
  assert.equal(p.press(), 'cross');
  p.run(30, () => p.boat().state === 'wait' && p.boat().side === 'b');
  p.run(0.5);
  const pts = p.views.at(-1);
  const near = (id) => {
    const e = getEntity(p.session.state, id).position;
    return pts.some((q) => Math.hypot(q.x - e.x, q.z - e.z) < 1);
  };
  assert.ok(near('pz:chicken') && near('pz:dog') && near('pz:rice'), 'the things of both banks are points of the view');
  assert.ok(p.said.includes('puzzle.ferry.left'), p.said.join(', '));
});

test('no ford and no stepping stones within the frame of the puzzle', () => {
  const map = load('data/maps/phu-dong.json');
  const o = map.layers.objects.find((x) => x.id === F.anchor);
  const cells = [F.at, F.a, F.b, F.landA, F.landB, ...F.spotsA, ...F.spotsB].map(([dx, dy]) => [o.x + dx, o.y + dy]);
  const MARGIN = 6;
  const x0 = Math.min(...cells.map((c) => c[0])) - MARGIN;
  const x1 = Math.max(...cells.map((c) => c[0])) + MARGIN;
  const y0 = Math.min(...cells.map((c) => c[1])) - MARGIN;
  const y1 = Math.max(...cells.map((c) => c[1])) + MARGIN;
  const shallow = Object.entries(map.legend).filter(([, v]) => v === 'shallow').map(([k]) => k);
  for (const s of map.stamps) {
    (s.ground ?? []).forEach((row, j) => [...row].forEach((ch, i) => {
      const x = s.x + i;
      const y = s.y + j;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) assert.ok(!shallow.includes(ch), `a ford at ${x}, ${y}`);
    }));
  }
});

test('the traveler wears a khăn and carries a bundle on a pole, not the nón and the top of the fisher', () => {
  const figs = load('data/figures.json').figures;
  const t = figs.traveler;
  assert.equal(t.hat, 'khan');
  assert.equal(t.carried?.kind, 'bundle-pole');
  assert.notEqual(t.top, figs.fisher.top);
  assert.notEqual(t.top, 'indigoPale');
});

test('the last hint is a demonstration: the traveler takes the chicken across and back, and all is as before', async () => {
  const p = await at([3, 62]);
  p.run(10);
  // A wrong crossing first: the dog, and the chicken pecks at the rice.
  p.standAt('pz:dog');
  assert.equal(p.press(), 'take');
  assert.equal(p.press(), 'cross');
  p.run(40, () => p.boat().state === 'wait' && p.boat().side === 'a' && !p.ferry().scene && !p.ferry().back);
  for (let i = 0; i < 3; i++) {
    p.run(2);
    p.session.command({ type: 'wave' });
    p.run(1);
  }
  assert.ok(p.said.includes('puzzle.ferry.hint.3'));
  assert.ok(p.ferry().demo, 'the demonstration');
  let across = false;
  p.run(40, () => {
    if (p.boat().side === 'b') across = true;
    return !p.ferry().demo;
  });
  assert.ok(across, 'the boat went across with the chicken');
  assert.deepEqual(p.ferry().where, { dog: 'a', chicken: 'a', rice: 'a' });
  assert.equal(p.boat().side, 'a');
});
