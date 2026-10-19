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
