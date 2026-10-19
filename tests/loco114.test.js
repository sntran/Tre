// The hopscotch after the play test (#114): the throw shows where it goes (a see-through shard
// steps along the court while the button is held, and the shard lands there), the court and the
// shard are in the view, no child stands on a square, and the children help a child who misses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aimSquare, throwPlace, judgeThrow, courtOf } from '../src/core/folkgames.js';
import { createFolk } from '../src/core/folk-session.js';
import { createWorldState, addEntity, getEntity } from '../src/core/world/state.js';
import { load } from './helpers.js';

const data = load('data/world/folkgames.json');
const L = data.loCo;
const DT = 1 / 30;

// The game on a court at the origin along +x, with a world of its own.
function makeFolk({ level = 1, az = Math.PI / 4, profile = {} } = {}) {
  const world = createWorldState({ seed: 1 });
  addEntity(world, { id: 'hero', position: { x: -20, y: 0, z: 0, facing: 0 } });
  const said = [];
  const events = [];
  const folk = createFolk({
    data, profile, world: () => world, env: () => ({ places: { hopscotch: { x: 0, z: 0 }, 'hopscotch-to': { x: 10, z: 0 } }, groundY: () => 0 }),
    learner: () => ({ levelFor: () => level, unlocked: () => true, isMastered: () => false }),
    seed: () => 1, emit: (e) => events.push(e), callout: (k, params, id) => said.push({ key: k, params, id }), command: (c) => {
      if (c.type === 'place') Object.assign(getEntity(world, c.id).position, { x: c.x, z: c.z });
    }, goTo: (p) => Object.assign(getEntity(world, 'hero').position, { x: p.x, z: p.z }), skill: () => {},
    feastOn: () => false, practice: () => null, busy: () => false, day: () => 0, view: () => az,
  });
  folk.mapStart();
  const run = (sec) => { for (let i = 0; i < sec / DT; i++) folk.tick(DT); };
  // The act of the big button: the throw (a hold).
  const act = () => {
    let a = null;
    folk.candidates((x) => { a = x; }, 3);
    return a;
  };
  return { world, folk, said, events, run, act };
}

// The hero at the start line, with the call of a child.
function atStart(opts) {
  const t = makeFolk(opts);
  assert.ok(t.folk.join('loco'));
  t.run(4);
  assert.equal(t.folk.stateOf().phase, 'throw', t.said.map((l) => l.key).join(', '));
  return t;
}

test('the see-through shard steps one square at a time, in the order of the squares, and the shard of a throw lands in the middle of that square', () => {
  const n = 10;
  for (let k = 0; k < n; k++) {
    const sec = (k + 0.5) * L.rate;
    assert.equal(aimSquare(sec, L, n), k);
    assert.equal(throwPlace(sec, L, n), k + 0.5);
    assert.notEqual(judgeThrow(courtOf({ start: 1, step: 1, squares: n }), k, throwPlace(sec, L, n), L).result, 'line');
  }
  // A tap: the first square, never out. Past the last square: out.
  assert.equal(aimSquare(0.05, L, n), 0);
  assert.equal(judgeThrow(courtOf({ start: 1, step: 1, squares: n }), 3, throwPlace(n * L.rate + 0.1, L, n), L).result, 'out');
});

test('a hold shows the see-through shard on each square in order, and when the hold ends the shard lands on that square, in the frame of the view', () => {
  const t = atStart();
  const a = t.act();
  assert.equal(a?.act, 'throw');
  a.run();
  const seen = [];
  const aim = getEntity(t.world, 'folk:aim');
  for (let i = 0; i < (3.5 * L.rate) / DT; i++) {
    t.folk.tick(DT);
    if (!aim.hidden && seen.at(-1)?.x !== aim.position.x) seen.push({ ...aim.position });
  }
  const steps = t.events.filter((e) => e.type === 'folkAim').map((e) => e.square);
  assert.deepEqual(steps, [0, 1, 2, 3]);
  assert.equal(seen.length, 4, 'the see-through shard moved three times');
  const last = { ...aim.position };
  a.release();
  assert.ok(aim.hidden, 'the see-through shard goes');
  const shard = getEntity(t.world, 'folk:shard');
  assert.ok(!shard.hidden);
  assert.ok(Math.hypot(shard.position.x - last.x, shard.position.z - last.z) < 1e-9, 'the shard lands where the see-through shard was');
  const thr = t.events.find((e) => e.type === 'throw');
  assert.equal(thr.place, 3.5);
  // The view after the throw frames the court, the start line, and the shard.
  const view = t.events.filter((e) => e.type === 'workView').at(-1);
  assert.ok(view.points.some((p) => Math.hypot(p.x - shard.position.x, p.z - shard.position.z) < 1e-9), 'the shard is a point of the view');
});

test('the first call comes with no press when the hero stands still by the start line; the line names the start line, which glows, and a child points at it', () => {
  const t = makeFolk();
  // The hero does not walk there: the child tapped beside the court.
  const deps = t.folk;
  assert.ok(deps.join('loco'));
  const hero = getEntity(t.world, 'hero');
  const start = getEntity(t.world, 'folk:start').position;
  Object.assign(hero.position, { x: start.x - 5, z: start.z + 3 });
  const join = t.said.find((l) => l.key === 'loco.join');
  assert.ok(join, t.said.map((l) => l.key).join(', '));
  const kid = getEntity(t.world, join.id);
  assert.equal(kid.gesture?.act, 'point');
  assert.ok(Math.hypot(kid.gesture.x - start.x, kid.gesture.z - start.z) < 1e-9, 'the child points at the start line');
  assert.ok(t.events.some((e) => e.type === 'names' && e.ids.includes('folk:start')), 'the start line glows with the line');
  t.run(5);
  assert.ok(t.events.some((e) => e.type === 'folkCall'), 'the call came with no press');
});

test('the first time, a child shows the shard and says what it is, and it glows; a line that says the shard makes it glow', () => {
  const profile = {};
  const t = atStart({ profile });
  const i = t.said.findIndex((l) => l.key === 'loco.shard');
  assert.ok(i >= 0, t.said.map((l) => l.key).join(', '));
  assert.ok(t.said.findIndex((l) => /^loco\.call/.test(l.key)) > i, 'the call after the shard');
  assert.ok(t.events.some((e) => e.type === 'names' && e.ids.includes('folk:shard')));
  // The second game: no line of the shard again.
  const again = atStart({ profile });
  assert.ok(!again.said.some((l) => l.key === 'loco.shard'));
});

test('the first call of a child who did not play before is a near square, and the calls go farther after a throw in the called square', async () => {
  const { callSquare, FIRST_REACH } = await import('../src/core/folkgames.js');
  const { createRng } = await import('../src/core/rng.js');
  const court = courtOf({ start: 1, step: 1, squares: 10 });
  for (let seed = 1; seed < 40; seed++) {
    const c = callSquare(court, createRng(seed), null, false, FIRST_REACH);
    assert.ok(c.square === 1 || c.square === 2, `seed ${seed}: ô ${c.square + 1}`);
  }
  for (const level of [1, 2]) {
    const profile = {};
    const t = atStart({ level, profile });
    assert.ok([1, 2].includes(t.folk.stateOf().call), `level ${level}: the first call ${t.folk.stateOf().call}`);
    // A throw in the called square.
    const a = t.act();
    a.run();
    t.run((t.folk.stateOf().call + 0.5) * L.rate);
    a.release();
    assert.equal(t.events.find((e) => e.type === 'throw').result, 'in');
    assert.ok(profile.folk.reach > FIRST_REACH, 'the calls can go farther');
  }
});

// A throw of the hero with a hold for the square k (k = the number of squares: out).
function throwAt(t, k) {
  const a = t.act();
  assert.equal(a?.act, 'throw');
  a.run();
  t.run((k + 0.5) * L.rate);
  a.release();
}
const KIDS = ['npc:loco-child', 'folk:child:1', 'folk:child:2'];

test('after a miss, the shard lies in its square in the view, a child points at it and at the called square and says both, and no child stands on a square', () => {
  const t = atStart();
  const call = t.folk.stateOf().call;
  const fell = call + 1;
  throwAt(t, fell);
  const line = t.said.at(-1);
  assert.equal(line.key, 'loco.other.near', t.said.map((l) => l.key).join(', '));
  assert.equal(line.params.n.key, `num.${fell + 1}`);
  assert.equal(line.params.m.key, `num.${call + 1}`);
  const kid = getEntity(t.world, line.id);
  const shard = getEntity(t.world, 'folk:shard');
  assert.ok(!shard.hidden);
  assert.ok(Math.hypot(kid.gesture.x - shard.position.x, kid.gesture.z - shard.position.z) < 1e-9, 'the child points at the shard');
  assert.ok(kid.gesture.then, 'and then at the called square');
  const court = getEntity(t.world, 'folk:court').folkCourt;
  const sq = court.squares[call];
  assert.ok(Math.hypot(kid.gesture.then.x - sq.x, kid.gesture.then.z - sq.z) < 1e-9);
  for (const id of KIDS) {
    const p = getEntity(t.world, id).position;
    for (const q of court.squares) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > court.size * 0.75, `${id} is not on a square`);
  }
  // Short of the called square: "còn xa hơn".
  const u = atStart({ profile: { folk: { shardShown: true, reach: 6 } } });
  const c2 = u.folk.stateOf().call;
  throwAt(u, c2 - 1 >= 0 ? c2 - 1 : 10);
  assert.ok(['loco.other.far', 'loco.out'].includes(u.said.at(-1).key), u.said.at(-1).key);
});

test('the turn of another child is in view: a throw at the start line and hops up the court over the shard, then the hero again', () => {
  const t = atStart();
  const call = t.folk.stateOf().call;
  throwAt(t, call + 1);
  const kid = getEntity(t.world, 'folk:child:1');
  const court = getEntity(t.world, 'folk:court').folkCourt;
  const on = new Set();
  for (let i = 0; i < 10 / DT; i++) {
    t.folk.tick(DT);
    court.squares.forEach((q, k) => { if (Math.hypot(kid.position.x - q.x, kid.position.z - q.z) < 0.1) on.add(k); });
    if (t.folk.stateOf().phase === 'throw') break;
  }
  const turn = t.events.find((e) => e.type === 'otherTurn');
  assert.ok(turn, 'the turn of another child');
  assert.deepEqual([...on].sort(), turn.hops, 'the child hops on these squares');
  assert.ok(!turn.hops.includes(turn.shard), 'over the shard');
  assert.equal(t.folk.stateOf().phase, 'throw', 'the hero throws again, in a few seconds');
});

test('after two misses in a row, a child says "Xem tớ ném nhé.", holds, and lets go as the see-through shard comes to the called square; then the same call', () => {
  const t = atStart();
  throwAt(t, t.folk.stateOf().call + 1);
  t.run(12);
  assert.equal(t.folk.stateOf().phase, 'throw');
  const call = t.folk.stateOf().call;
  throwAt(t, 10);
  const from = t.events.length;
  for (let i = 0; i < 14 / DT && t.folk.stateOf().phase !== 'throw'; i++) t.folk.tick(DT);
  assert.ok(t.said.some((l) => l.key === 'loco.throw.demo'), t.said.map((l) => l.key).join(', '));
  const ev = t.events.slice(from);
  const aims = ev.filter((e) => e.type === 'folkAim' && e.by).map((e) => e.square);
  assert.deepEqual(aims, Array.from({ length: call + 1 }, (_, i) => i), 'the see-through shard steps to the called square');
  const thr = ev.find((e) => e.type === 'throw' && e.by);
  assert.equal(thr.square, call);
  assert.equal(t.folk.stateOf().phase, 'throw');
  assert.equal(t.folk.stateOf().call, call, 'the same call again');
});

test('no line of the hopscotch laughs at the hero', () => {
  for (const lang of ['vi', 'en']) {
    const dict = load(`i18n/${lang}.json`);
    for (const [k, v] of Object.entries(dict)) if (k.startsWith('loco.')) assert.ok(!/ha ha/i.test(v), `${lang} ${k}: ${v}`);
  }
});

test('a tap on a child of the game from the back of Nghé: the hero gets off, the child answers, and the button joins the game', async () => {
  const { runHeadless } = await import('./story-run.js');
  const { STEP } = await import('./restless.js');
  const s = load('tests/stories/trick-hopscotch.json');
  let session = null;
  const said = [];
  const failures = await runHeadless({ ...s, steps: [{ wait: 1 }] }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => { if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, id: e.id }); });
    },
  });
  assert.deepEqual(failures, []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const hero = getEntity(session.state, 'hero');
  const nghe = getEntity(session.state, 'friend:nghe');
  assert.ok(nghe, 'Nghé');
  Object.assign(nghe.position, { x: hero.position.x + 1, z: hero.position.z });
  session.command({ type: 'ride', id: 'hero', mount: 'friend:nghe' });
  run(0.5);
  assert.equal(hero.riding, 'friend:nghe');
  const from = said.length;
  session.command({ type: 'tap', target: { person: 'npc:loco-child' } });
  run(3);
  assert.ok(!hero.riding, 'the hero got off');
  assert.ok(said.slice(from).some((l) => l.id === 'npc:loco-child'), `the child answers: ${JSON.stringify(said.slice(from))}`);
  assert.equal(session.action()?.act, 'play');
});
