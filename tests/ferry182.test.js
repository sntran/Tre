// The ferry riddle by the grade (#182): the easy riddle at K and grade 1, the boat button at the
// boat, the fail at the moment of the crossing, hints that are a next move, and no line of wading
// during the riddle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { ferryLevel } from '../src/core/puzzles.js';
import { playScene } from '../tools/robot/robot.mjs';

const data = load('data/world/puzzles.json');
const CLOCK = 9 * 1440 + 700;
const vi = load('i18n/vi.json');

async function at(cell, grade = 2) {
  const s = load('tests/stories/trial-fisher.json');
  s.profile = { ...s.profile, grade };
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

test('at K and grade 1 the riddle has two things that do not fight; from grade 2 the full riddle', () => {
  for (const g of [0, 1]) {
    const F = ferryLevel(data.ferry, g);
    assert.deepEqual(F.things, ['dog', 'rice']);
    assert.deepEqual(F.pairs, []);
  }
  assert.deepEqual(ferryLevel(data.ferry, 2).things, ['dog', 'chicken', 'rice']);
  assert.equal(ferryLevel(data.ferry, 2).pairs.length, 2);
});

test('the robot child at K finishes the riddle of the ferry in 40 commands', async () => {
  const story = load('tests/stories/puzzle-ferry.json');
  const out = await playScene(story, { kind: 'star', commands: 40, grade: 0, scene: 'puzzle-ferry' });
  assert.ok(out.lines.some((l) => l.key === 'puzzle.ferry.easy.done'), out.lines.map((l) => l.key).join(', '));
});

test('on the far bank with nothing in the hands, the button at the boat is the crossing', async () => {
  const p = await at([3, 62], 0);
  p.run(10);
  p.standAt('pz:dog');
  assert.equal(p.press(), 'take');
  assert.equal(p.press(), 'cross');
  p.run(30, () => p.boat().state === 'wait' && p.boat().side === 'b');
  p.run(1);
  assert.equal(p.session.action()?.act, 'cross', JSON.stringify(p.session.action()));
});

test('a crossing that leaves the chicken with the rice fails at that moment, in view, and the boat stays', async () => {
  const p = await at([3, 62], 2);
  p.run(10);
  p.standAt('pz:dog');
  assert.equal(p.press(), 'take');
  const from = p.said.length;
  p.session.command({ type: 'hands' });
  p.run(0.5);
  assert.ok(p.said.slice(from).includes('puzzle.ferry.peck'), p.said.slice(from).join(', '));
  assert.equal(p.boat().side, 'a', 'the boat did not go');
  p.run(12, () => !p.ferry().scene);
  assert.deepEqual(p.ferry().where, { dog: 'a', chicken: 'a', rice: 'a' });
});

test('after a crossing the traveler says the next move, never the list of a bank', async () => {
  const p = await at([3, 62], 2);
  p.run(10);
  p.standAt('pz:chicken');
  assert.equal(p.press(), 'take');
  assert.equal(p.press(), 'cross');
  p.run(30, () => p.boat().state === 'wait' && p.boat().side === 'b');
  p.run(1);
  assert.ok(p.said.includes('puzzle.ferry.next.empty'), p.said.join(', '));
  assert.ok(!p.said.includes('puzzle.ferry.left'), p.said.join(', '));
});

test('during the riddle, the eye at the river says a line of the ferry, never to wade', () => {
  const src = readFileSync(new URL('../src/core/session.js', import.meta.url), 'utf8');
  assert.match(src, /if \(a\.textKey && puzzles\.here\(\) && WADE_KEYS\.test\(String\(textOfAction\(a\)\)\)\) \{\n\s+say\('puzzle\.ferry\.look'\);/);
  assert.ok(/WADE_KEYS = \/river/.test(src));
  assert.ok(!/lội|cạn/.test(vi['puzzle.ferry.look']));
});
