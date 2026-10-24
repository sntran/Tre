// Small things after the play test of #105 to #114 (#122): the river after the bridge, the guess of
// the bridge with its answer, the half circle of the hopscotch, the look of Nghé, one name of the
// calf, the hint of the ferry from the banks, no face over a work, and a short line for a new word.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { createWorldState, addEntity, getEntity } from '../src/core/world/state.js';
import { createFolk } from '../src/core/folk-session.js';
import { nextCrossing } from '../src/core/puzzles.js';
import { nghe as ngheFar, buffalo } from '../src/world/figures.js';
import { ngheFine, buffaloFine } from '../src/world/fine.js';
import { C } from '../src/render/palette.js';

const vi = load('i18n/vi.json');
const en = load('i18n/en.json');
const profile = (flags, grade = 2) => ({ name: 'An', grade, lang: 'vi', seed: 7, flags: { 'intro.seen': true, ...flags } });
const open = { 'trial.fisher.done': true };

// A press on the river, away from the bridge: the keys of the lines (not the lines of the ferry
// puzzle, #104, which the traveler may say there on its days). before: a change of the world after
// the start.
async function river(flags, before = () => {}) {
  const said = [];
  let s = null;
  const failures = await runHeadless({ name: 'river-122', profile: profile(flags), clock: 540, at: ['phu-dong', 20, 64], steps: [{ wait: 1 }] }, {
    onSession: (x) => { s = x; x.listen((e) => { if (e.type === 'open' && e.textKey) said.push(e.textKey); }); },
  });
  assert.deepEqual(failures, []);
  before(s);
  for (let i = 0; i < 0.5 / STEP; i++) { s.step(); s.events(); }
  s.command({ type: 'hands', id: s.action()?.id });
  for (let i = 0; i < 1 / STEP; i++) { s.step(); s.events(); }
  return said.filter((k) => !k.startsWith('puzzle.'));
}

test('the river does not say that the bridge is broken, and after the bridge it says the third text', async () => {
  assert.ok(!/gãy/.test(vi['map.river']), vi['map.river']);
  assert.ok(!/broken/.test(en['map.river']), en['map.river']);
  assert.equal(vi['map.river.fixed'], 'Sông Đuống chảy về phía đông. Cây cầu tre cháu sửa đã vững rồi.');
  assert.deepEqual(await river({}), ['map.river']);
  // The bridge done: the gap is solid (the world state that the save keeps).
  const fixed = await river(open, (x) => Object.assign(getEntity(x.state, 'zone:bridge-gap').zone, { set: true, done: true, day: Math.floor(x.state.clock.minutes / 1440) }));
  assert.deepEqual(fixed, ['map.river.fixed']);
});

test('the line of a guess of the bridge says the count that the gap needed, and the row of the guess shows again and glows', async () => {
  for (const k of ['mentor.bridge.guessRight', 'mentor.bridge.guessOff', 'mentor.bridge.guessFar']) assert.ok(vi[k].startsWith('Chỗ gãy cần {m} tấm. Cháu đoán {n} tấm'), k);
  assert.ok(/gần đúng rồi/.test(vi['mentor.bridge.guessOff']));
  const said = [];
  let s = null;
  let row = null;
  const failures = await runHeadless({
    name: 'bridge-guess-122', profile: profile(open), clock: 540, at: ['phu-dong', 46, 61],
    steps: [
      { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } }, { read: true }, { wait: 1 },
      { press: { guess: 2 } }, { until: { event: 'guess', timeout: 3 } }, { wait: 2 },
      ...[4, 4, 4].flatMap((n, i) => [{ press: { plank: n } }, { until: { event: 'pick', timeout: 20 } }, { press: { screenOf: 'bridge-gap' } }, { until: { event: 'put', timeout: 20 } }, { wait: i === 2 ? 1 : 1.5 }]),
      { press: { screenOf: 'bridge-gap' } },
      { until: { event: 'solid', timeout: 20 } },
      { wait: 1 },
    ],
  }, {
    onSession: (x) => {
      s = x;
      x.listen((e) => {
        if (e.type === 'open' && /guess(Right|Off|Far)$/.test(e.textKey ?? '')) said.push({ key: e.textKey, n: e.params.n.key, m: e.params.m.key });
        row ??= getEntity(x.state, 'guessback:zone:bridge-gap') ?? null;
      });
    },
  });
  assert.deepEqual(failures, []);
  assert.deepEqual(said, [{ key: 'mentor.bridge.guessOff', n: 'num.2', m: 'num.3' }]);
  assert.ok(row, 'the row of the guess shows again');
  assert.equal(row.look, 'plank-row-2');
  // Beside the bridge, where the row of the guess lay: not under the deck.
  const gap = getEntity(s.state, 'zone:bridge-gap').zone;
  assert.ok(gap.lane - row.position.x >= 6, `the row is beside the bridge: ${gap.lane - row.position.x}`);
  void s;
});

// The hopscotch on a court at the origin along +x, with a world of its own (as tests/loco114).
const folkData = load('data/world/folkgames.json');
const DT = 1 / 30;
function makeFolk(az = Math.PI / 4) {
  const world = createWorldState({ seed: 1 });
  addEntity(world, { id: 'hero', position: { x: -20, y: 0, z: 0, facing: 0 } });
  const said = [];
  const folk = createFolk({
    data: folkData, profile: {}, world: () => world, env: () => ({ places: { hopscotch: { x: 0, z: 0 }, 'hopscotch-to': { x: 10, z: 0 } }, groundY: () => 0 }),
    learner: () => ({ levelFor: () => 1, unlocked: () => true, isMastered: () => false }),
    seed: () => 1, emit: () => {}, callout: (k, params, id) => said.push({ key: k, params, id }), command: (c) => {
      if (c.type === 'place') Object.assign(getEntity(world, c.id).position, { x: c.x, z: c.z });
    }, goTo: (p) => Object.assign(getEntity(world, 'hero').position, { x: p.x, z: p.z }), skill: () => {},
    feastOn: () => false, practice: () => null, busy: () => false, day: () => 0, view: () => az,
  });
  folk.mapStart();
  const run = (sec) => { for (let i = 0; i < sec / DT; i++) folk.tick(DT); };
  const act = () => {
    let a = null;
    folk.candidates((x) => { a = x; }, 3);
    return a;
  };
  return { world, folk, said, run, act };
}

test('at the half circle a child says the way back and the shard glows; on the way back the numbers are said', () => {
  const t = makeFolk();
  assert.ok(t.folk.join('loco'));
  for (let i = 0; i < 12 / DT && t.folk.stateOf().phase !== 'throw'; i++) t.folk.tick(DT);
  const call = t.folk.stateOf().call;
  const a = t.act();
  a.run();
  t.run((call + 0.5) * folkData.loCo.rate);
  a.release();
  t.run(2);
  assert.equal(t.folk.stateOf().phase, 'hop', t.said.map((l) => l.key).join(', '));
  const court = t.folk.stateOf().court;
  const n = court.length;
  // Hop up and back: a long press over the square of the shard.
  let pos = -1;
  const keysFrom = (k) => t.said.slice(k).map((l) => l.key);
  let atRest = 0;
  while (pos < 2 * n + 1) {
    const sq = (p) => (p >= 0 && p < n ? p : p > n && p <= 2 * n ? 2 * n - p : null);
    const long = sq(pos + 1) === call;
    if (pos + 1 === n) atRest = t.said.length;
    t.folk.jumpUp(long ? folkData.loCo.long + 0.1 : 0.1);
    pos += long ? 2 : 1;
    t.run(folkData.loCo.settle + 0.6);
  }
  const back = keysFrom(atRest);
  assert.ok(back.includes('loco.rest') || back.includes('loco.pick'), back.join(', '));
  if (call !== n - 1) assert.equal(back[0], 'loco.rest', back.join(', '));
  assert.ok(back.filter((k) => k.startsWith('num.')).length >= n - 2, `the numbers on the way back: ${back.join(', ')}`);
});

test('from each of the four angles of the view, no child of the hopscotch stands on a square, with the width of the body', () => {
  for (const az of [1, 3, 5, 7].map((k) => (k * Math.PI) / 4)) {
    const t = makeFolk(az);
    assert.ok(t.folk.join('loco'));
    t.run(1);
    const court = getEntity(t.world, 'folk:court').folkCourt;
    const along = (p, q) => Math.abs((p.x - q.x) * court.dir.x + (p.z - q.z) * court.dir.z);
    const side = (p, q) => Math.abs((p.x - q.x) * -court.dir.z + (p.z - q.z) * court.dir.x);
    for (const id of ['npc:loco-child', 'folk:child:1', 'folk:child:2']) {
      const c = getEntity(t.world, id)?.position;
      if (!c) continue;
      for (const q of court.squares) assert.ok(along(c, q) > court.size / 2 + 1.6 || side(c, q) > court.size / 2 + 1.6, `${id} at ${(az * 4 / Math.PI).toFixed(0)}/4 pi is on a square`);
    }
  }
});

test('while a folk game is on, the faces and the stars of the story do not show', async () => {
  const s0 = load('tests/stories/trick-hopscotch.json');
  let session = null;
  const failures = await runHeadless({ ...s0, steps: [{ wait: 1 }] }, { onSession: (x) => { session = x; } });
  assert.deepEqual(failures, []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  session.command({ type: 'tap', target: { person: 'npc:loco-child' } });
  run(3);
  assert.equal(session.action()?.act, 'play');
  session.command({ type: 'hands' });
  run(2);
  assert.ok(session.folk(), 'the game goes on');
  assert.equal(session.taskHere(), 'folk');
  // No child of the game stands on a square, with the width of the body.
  const sq = getEntity(session.state, 'folk:court').folkCourt;
  for (const id of ['npc:loco-child', 'folk:child:1', 'folk:child:2']) {
    const c = getEntity(session.state, id)?.position;
    if (!c) continue;
    for (const q of sq.squares) assert.ok(Math.max(Math.abs(c.x - q.x), Math.abs(c.z - q.z)) > sq.size / 2 + 1.6, `${id} is off the square at ${q.x}, ${q.z}`);
  }
  // Nghé stays off the court (at night it lay down on the squares).
  const court = getEntity(session.state, 'folk:court').folkCourt;
  const nghe = getEntity(session.state, 'friend:nghe');
  let on = 0;
  for (let i = 0; i < 20 / STEP; i++) {
    session.step();
    session.events();
    if (court.squares.some((q) => Math.abs(q.x - nghe.position.x) < court.size / 2 && Math.abs(q.z - nghe.position.z) < court.size / 2)) on += 1;
  }
  assert.equal(on, 0, 'Nghé is never on a square');
});

test('Nghé is a dark buffalo calf with no white horn, and the buffalo keeps its long horns', () => {
  const lum = (name) => {
    const h = C[name].slice(1);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const pale = new Set(['diep', 'paper', 'paperDeep']);
  for (const fig of [ngheFine(), ngheFine({}), ngheFar()]) {
    const trunk = fig.parts.find((p) => p.name === 'trunk' || p.name === 'trunk0' || /^trunk/.test(p.name));
    assert.ok(lum(trunk.color) < lum('ashLight'), `the body ${trunk.color} is darker than the old light grey`);
    const horns = fig.parts.filter((p) => /^horn/.test(p.name));
    assert.ok(horns.length >= 2, 'horns');
    for (const h of horns) assert.ok(!pale.has(h.color), `no white horn part: ${h.name} ${h.color}`);
  }
  // The buds of the calf are short; the horns of the buffalo reach out farther.
  const reach = (fig) => Math.max(...fig.parts.filter((p) => /^horn/.test(p.name)).map((p) => Math.abs(p.at[0]) + p.size[0] / 2));
  assert.ok(reach(ngheFine()) < reach(buffaloFine()), 'the buffalo has the long horns');
  assert.ok(buffalo().parts.some((p) => /^horn/.test(p.name)));
});

test('no line names the calf with both its name and "Nghé"', () => {
  for (const [k, v] of Object.entries(vi)) {
    if (k.startsWith('gloss.')) continue;
    if (v.includes('[[nghecalf]]')) assert.ok(!/Nghé/.test(v.replaceAll('[[nghecalf]]', '')), `${k}: ${v}`);
  }
});

test('the next crossing of the ferry comes from the banks as they are', () => {
  const F = load('data/world/puzzles.json').ferry;
  assert.deepEqual(nextCrossing(F, { dog: 'a', chicken: 'a', rice: 'a' }, 'a'), { thing: 'chicken', to: 'b' });
  // The chicken over, then the dog over: the chicken goes back.
  assert.deepEqual(nextCrossing(F, { dog: 'b', chicken: 'b', rice: 'a' }, 'b'), { thing: 'chicken', to: 'a' });
  assert.deepEqual(nextCrossing(F, { dog: 'a', chicken: 'b', rice: 'a' }, 'b'), { thing: null, to: 'a' });
  assert.equal(nextCrossing(F, { dog: 'b', chicken: 'b', rice: 'b' }, 'b'), null);
});

test('at the ferry, a wave after a wrong crossing with the chicken already over is the next step, not "Con gà đi trước."', async () => {
  const s0 = load('tests/stories/trial-fisher.json');
  let session = null;
  const said = [];
  const failures = await runHeadless({ ...s0, at: ['phu-dong', 3, 62], clock: 9 * 1440 + 700, steps: [{ wait: 1 }] }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => { if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, params: e.params }); });
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
  const boat = () => getEntity(session.state, 'ferry:pz').ferry;
  const ferry = () => session.puzzles.state().ferry;
  const hero = () => getEntity(session.state, 'hero');
  const press = (want) => {
    run(1);
    const a = session.action()?.act;
    assert.equal(a, want, JSON.stringify(session.action()));
    session.command({ type: 'hands' });
    run(1.2);
  };
  const standAt = (id) => {
    const e = getEntity(session.state, id);
    Object.assign(hero().position, { x: e.position.x, z: e.position.z - 1.4, facing: 0 });
    delete hero().route;
    run(1.5);
  };
  const atLanding = () => {
    const f = boat();
    const land = f.side === 'a' ? f.landA : f.landB;
    Object.assign(hero().position, { x: land.x, z: land.z + (f.side === 'a' ? -1 : 0.4) });
    delete hero().route;
    run(1.5);
  };
  const over = (side) => run(40, () => boat().state === 'wait' && boat().side === side && !ferry().scene && !ferry().back);
  run(10);
  // The chicken over, and back with nothing.
  standAt('pz:chicken');
  press('take');
  press('cross');
  over('b');
  atLanding();
  press('cross');
  over('a');
  // The dog over, and back with nothing: the dog chases the chicken; all come back.
  standAt('pz:dog');
  press('take');
  press('cross');
  over('b');
  atLanding();
  press('cross');
  run(40, () => !ferry().scene && !ferry().back && boat().state === 'wait');
  assert.ok(said.some((l) => l.key === 'puzzle.ferry.chase'), said.map((l) => l.key).join(', '));
  assert.deepEqual(ferry().where, { dog: 'b', chicken: 'b', rice: 'a' });
  const hints = [];
  for (let i = 0; i < 2; i++) {
    const k = said.length;
    run(2);
    session.command({ type: 'wave' });
    run(2);
    hints.push(...said.slice(k).filter((l) => /^puzzle\.ferry\.(hint|next)/.test(l.key)));
  }
  assert.ok(!hints.some((l) => l.key === 'puzzle.ferry.hint.2'), hints.map((l) => l.key).join(', '));
  const back = hints.find((l) => l.key === 'puzzle.ferry.next.back');
  assert.ok(back, hints.map((l) => l.key).join(', '));
  assert.equal(back.params.thing.key, 'puzzle.thing.chicken');
  assert.equal(vi['puzzle.ferry.next.back'].replace('{thing}', vi['puzzle.thing.chicken']), 'Mang con gà quay lại.');
});

test('with the hero at the open bridge, taskHere() is not null', async () => {
  let s = null;
  const failures = await runHeadless({ name: 'bridge-here-122', profile: profile(open), clock: 540, at: ['phu-dong', 46, 61], steps: [{ until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } }, { read: true }, { wait: 1 }] }, { onSession: (x) => { s = x; } });
  assert.deepEqual(failures, []);
  assert.equal(s.taskHere(), 'bridge');
});

test('each name of a calling has a line of what it is, after the done line', () => {
  const callings = load('data/callings.json').callings;
  const talks = load('data/dialogue/village.json').dialogues;
  const teacher = { scholar: 'teacher' };
  for (const c of callings) {
    assert.ok(c.whoKey && vi[c.whoKey] && en[c.whoKey], `${c.id}: whoKey`);
    const who = teacher[c.id] ?? c.id;
    const done = talks.find((d) => d.id === `${who}.trial.done`);
    assert.equal(done.nodes.n1.next, 'who', `${c.id}: a line after the done line`);
    assert.equal(vi[done.nodes.who.textKey], vi[c.whoKey]);
  }
  assert.equal(vi['calling.fisher.who'], 'Ngư dân là người đánh cá.');
  assert.equal(vi['calling.woodcutter.who'], 'Tiều phu là người đốn củi.');
});

test('at grade 1 the first "khe" of the fisher comes with its line and the stakes glow; at grade 3 it does not', async () => {
  const s0 = load('tests/stories/trial-fisher.json');
  const first = s0.steps.findIndex((x) => x.read === true) + 1;
  const play = async (grade) => {
    const said = [];
    const names = [];
    let s = null;
    const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade }, steps: s0.steps.slice(0, first) }, {
      onSession: (x) => {
        s = x;
        x.listen((e) => {
          if (e.type === 'open' && e.textKey) said.push(e.textKey);
          if (e.type === 'names' && said.at(-1)?.startsWith('word.')) names.push(...e.ids);
        });
      },
    });
    assert.deepEqual(failures, []);
    return { said, names, s };
  };
  const g1 = await play(1);
  const at = g1.said.indexOf('dlg.fisher.trial.n5');
  assert.ok(at >= 0, g1.said.join(', '));
  assert.equal(g1.said[at + 1], 'word.khe', g1.said.join(', '));
  assert.ok(g1.said.includes('word.dang') && g1.said.includes('word.tide'), g1.said.join(', '));
  assert.ok(g1.names.includes('stake:fisher:a'), `the stakes glow: ${g1.names.join(', ')}`);
  assert.ok(g1.s.profile.flags['word.khe'], 'the flag keeps it');
  const g3 = await play(3);
  assert.ok(!g3.said.some((k) => k.startsWith('word.')), g3.said.join(', '));
});
