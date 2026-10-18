// The puzzles solved by doing (#104): at the ferry, each wrong pair shows its scene and the things
// come back, and the seven crossings finish the puzzle; at the well, the pours give the right
// levels, the check of the healer says too much or too little, and the level follows the grade; a
// puzzle never blocks a task or the story; and each puzzle in the data has a source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { wrongPair, pourInto, potsLevel, puzzleDay } from '../src/core/puzzles.js';

const data = load('data/world/puzzles.json');
const vi = load('i18n/vi.json');
const en = load('i18n/en.json');
// A day of both puzzles for the world of the stories, at the hour when the healer is at the well.
const DAY = 9;
const CLOCK = DAY * 1440 + 700;

test('each puzzle and tale has a source, its lines in both languages, and a tale is told as a tale, for a later era', () => {
  for (const p of [data.ferry, data.pots, ...data.tales]) {
    const src = data.sources[p.source];
    assert.ok(src && (src.book || src.note), `${p.id}: a source`);
    assert.ok(Number.isInteger(p.era) && typeof p.tale === 'boolean', `${p.id}: era and tale`);
  }
  for (const k of [...data.ferry.hints, ...data.pots.hints, 'puzzle.ferry.start', 'puzzle.ferry.chase', 'puzzle.ferry.peck', 'puzzle.ferry.done', 'puzzle.pots.start', 'puzzle.pots.over', 'puzzle.pots.short', 'puzzle.pots.done']) {
    assert.ok(vi[k] && en[k], k);
    assert.ok(!/[0-9?]/.test(vi[k]), `a hint is never a question, and no digit: ${vi[k]}`);
  }
  const tale = data.tales.find((t) => t.id === 'elephant');
  assert.equal(tale.tale, true);
  assert.ok(tale.era > 1, 'not in the first era');
  assert.match(vi[tale.lines[0]], /^Người ta kể rằng/);
  assert.deepEqual(tale.skills, ['sci.water.float', 'math.addsub.1000']);
});

test('the rules: the pairs that cannot stay alone, a pour, and the level of the grade', () => {
  const F = data.ferry;
  assert.deepEqual(wrongPair(F, { dog: 'a', chicken: 'a', rice: 'b' }, 'a'), ['dog', 'chicken', 'chase']);
  assert.deepEqual(wrongPair(F, { dog: 'b', chicken: 'a', rice: 'a' }, 'a'), ['chicken', 'rice', 'peck']);
  assert.equal(wrongPair(F, { dog: 'a', chicken: 'b', rice: 'a' }, 'a'), null, 'the dog and the rice can stay alone');
  assert.deepEqual(pourInto(5, 0, 3), [2, 3]);
  assert.deepEqual(pourInto(2, 0, 3), [0, 2]);
  assert.deepEqual(pourInto(5, 2, 3), [4, 3]);
  assert.equal(potsLevel(data.pots, 1).need, 2);
  assert.equal(potsLevel(data.pots, 3).need, 4);
  assert.equal(potsLevel(data.pots, 1).skill, 'math.sub.10');
  assert.equal(potsLevel(data.pots, 4).skill, 'math.addsub.100');
});

async function at(cell, grade, flags = {}) {
  const s = load('tests/stories/trial-fisher.json');
  s.profile = { ...s.profile, grade, flags: { ...s.profile.flags, ...flags } };
  let session = null;
  const said = [];
  const events = [];
  const failures = await runHeadless({ ...s, at: ['phu-dong', ...cell], clock: CLOCK, steps: [{ wait: 3 }] }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => {
        if (e.type === 'open' && e.textKey) said.push(e.textKey);
        if (['skill', 'gift', 'ferried'].includes(e.type)) events.push(e);
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
  const still = () => run(8, () => !getEntity(session.state, 'hero').route) && run(1.2);
  // A press after the picture of the button settles, as a child sees it first.
  const press = () => {
    run(1);
    const a = session.action()?.act;
    session.command({ type: 'hands' });
    run(1.2);
    return a;
  };
  const tapThing = (id) => {
    session.command({ type: 'tap', target: { thing: id } });
    still();
  };
  const tapCell = (x, y) => {
    session.command({ type: 'tap', target: { ground: { x, y, h: 3, thing: false, object: null } } });
    still();
  };
  return { session, said, events, run, press, tapThing, tapCell };
}

test('the ferry: a wrong pair shows its scene and all come back; seven crossings bring all three over, and the traveler gives a gift', async () => {
  assert.ok(puzzleDay(data.ferry, 1040020559, DAY));
  const p = await at([11, 63], 1);
  assert.ok(p.said.includes('puzzle.ferry.start'));
  const ferry = () => p.session.puzzles.state().ferry;
  const cross = (thing) => {
    if (thing) {
      p.tapThing(`pz:${thing}`);
      assert.equal(p.press(), 'load', thing);
    }
    assert.equal(p.press(), 'cross');
    p.run(25, () => getEntity(p.session.state, 'ferry:pz').ferry.state === 'wait');
  };
  // The dog first: the chicken pecks at the rice, and the boat brings the dog back.
  cross('dog');
  assert.ok(p.said.includes('puzzle.ferry.peck'));
  p.run(SCENE_END, () => getEntity(p.session.state, 'ferry:pz').ferry.side === 'a' && getEntity(p.session.state, 'ferry:pz').ferry.state === 'wait');
  assert.deepEqual(ferry().where, { dog: 'a', chicken: 'a', rice: 'a' }, 'all come back');
  // A wave gives the hints in order.
  for (const k of data.ferry.hints) {
    p.run(2, () => !p.session.screen && !p.session.busy);
    const n = p.said.length;
    p.session.command({ type: 'wave' });
    p.run(0.5);
    assert.ok(p.said.slice(n).includes(k), `${k}: ${p.said.slice(n).join(', ')} ${p.session.screen} ${p.session.busy} ${p.session.canWave}`);
  }
  for (const t of ['chicken', null, 'dog', 'chicken', 'rice', null, 'chicken']) cross(t);
  assert.deepEqual(ferry().where, { dog: 'b', chicken: 'b', rice: 'b' });
  assert.ok(p.said.includes('puzzle.ferry.done'));
  assert.ok(p.events.some((e) => e.type === 'gift'));
  assert.equal(p.session.profile.puzzles.ferry.crossings, 8, 'the record keeps the crossings (one back, and seven)');
});
const SCENE_END = 30;

test('the pots: grade 1 needs two bowls in one pour; from grade 3, four bowls, with too much and too little first', async () => {
  const flags = { 'trial.healer.done': true };
  const well = (p) => p.session.map.layers.objects.find((o) => o.id === 'well');
  const fill = (p) => { const o = well(p); p.tapCell(o.x + 1.5, o.y + 3.2); assert.equal(p.press(), 'fill'); };
  const g1 = await at([42, 28], 1, flags);
  assert.ok(g1.run(20, () => g1.said.includes('puzzle.pots.start.two')), g1.said.join(', '));
  g1.tapThing('pz:pot:0');
  assert.equal(g1.press(), 'take');
  fill(g1);
  g1.tapThing('pz:pot:1');
  assert.equal(g1.press(), 'pour');
  assert.deepEqual(g1.session.puzzles.state().pots.levels, [2, 3]);
  g1.tapThing('pz:jar');
  assert.equal(g1.press(), 'give');
  const ev = g1.events.find((e) => e.type === 'skill');
  assert.deepEqual([ev.skill, ev.solved, ev.parts[0]], ['math.sub.10', true, 2]);
  assert.ok(g1.said.includes('puzzle.pots.done'));

  const g3 = await at([42, 28], 3, flags);
  assert.ok(g3.run(20, () => g3.said.includes('puzzle.pots.start')), g3.said.join(', '));
  // A full big pot is too much for four.
  g3.tapThing('pz:pot:0');
  g3.press();
  fill(g3);
  g3.tapThing('pz:jar');
  assert.equal(g3.press(), 'give');
  assert.ok(g3.said.includes('puzzle.pots.over'));
  // Two bowls are too little.
  fill(g3);
  g3.tapThing('pz:pot:1');
  g3.press();
  g3.tapThing('pz:jar');
  g3.press();
  assert.ok(g3.said.includes('puzzle.pots.short'));
  assert.deepEqual(g3.events.filter((e) => e.type === 'skill').map((e) => [e.skill, e.solved]), [['math.addsub.100', false], ['math.addsub.100', false]]);
});

test('a puzzle never blocks a task or the story: no act of a puzzle while a task is open, and no flag of the story', async () => {
  const p = await at([11, 63], 1);
  p.session.startTrial('fisher');
  p.run(1);
  const acts = [];
  p.session.puzzles.candidates((c) => acts.push(c.act), 5);
  assert.deepEqual(acts, []);
  assert.ok(!Object.keys(p.session.profile.flags).some((f) => /puzzle/.test(f)));
});

test('Nghé never stands on a thing of a puzzle, so that a tap on the thing is not a tap on Nghé', async () => {
  const p = await at([11, 63], 1);
  const nghe = p.session.state.entities.find((e) => e.follow?.target === 'hero');
  assert.ok(nghe, 'Nghé follows the hero');
  const dog = getEntity(p.session.state, 'pz:dog').position;
  Object.assign(nghe.position, { x: dog.x, z: dog.z });
  p.run(2);
  const off = (q) => Math.max(Math.abs(nghe.position.x - q.x), Math.abs(nghe.position.z - q.z)) > 1;
  for (const t of ['dog', 'chicken', 'rice']) assert.ok(off(getEntity(p.session.state, `pz:${t}`).position), t);
});

test('a tap on a thing of a puzzle with Nghé next to it is a tap on the thing, not a pet of Nghé', async () => {
  const { tapTarget, viewCamera, sessionScreen } = await import('../src/world/hit.js');
  const p = await at([42, 28], 1, { 'trial.healer.done': true });
  assert.ok(p.run(20, () => Boolean(getEntity(p.session.state, 'pz:pot:0'))), 'the pots are there');
  const nghe = p.session.state.entities.find((e) => e.follow?.target === 'hero');
  const pot = getEntity(p.session.state, 'pz:pot:0').position;
  Object.assign(nghe.position, { x: pot.x + 1, z: pot.z + 1 });
  const q = { x: pot.x / 2, y: pot.y / 2, z: pot.z / 2 };
  const cam = viewCamera({ focus: q, width: 390, height: 844 });
  const t = tapTarget(cam.project(q.x, q.y + 0.3, q.z), sessionScreen(p.session, cam));
  assert.equal(t?.thing, 'pz:pot:0', JSON.stringify(t));
});

test('with a pot in the hands, a tap on the well is a tap on the well, not on the pot in the hands', async () => {
  const { tapTarget, viewCamera, sessionScreen } = await import('../src/world/hit.js');
  const p = await at([42, 28], 1, { 'trial.healer.done': true });
  assert.ok(p.run(20, () => p.said.includes('puzzle.pots.start.two')));
  p.tapThing('pz:pot:0');
  assert.equal(p.press(), 'take');
  const o = p.session.map.layers.objects.find((x) => x.id === 'well');
  const q = { x: o.x + 1.5, y: 3, z: o.y + 3.2 };
  const cam = viewCamera({ focus: q, width: 390, height: 844 });
  const t = tapTarget(cam.project(q.x, q.y, q.z), sessionScreen(p.session, cam));
  assert.notEqual(t?.thing, 'pz:pot:0', JSON.stringify(t));
});
