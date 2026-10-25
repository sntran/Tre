// The hopscotch for the youngest children (#132): a court between 1 to 10 and the forties, a child
// who walks away leaves the game, quick presses wait for the hop, the rounds that are left, and the
// shard picked up with a line of what happened.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFolk } from '../src/core/folk-session.js';
import { createWorldState, addEntity, getEntity } from '../src/core/world/state.js';
import { load } from './helpers.js';

const data = load('data/world/folkgames.json');
const vi = load('i18n/vi.json');
const DT = 1 / 30;

function makeFolk({ level = 1, grade = 0 } = {}) {
  const world = createWorldState({ seed: 1 });
  addEntity(world, { id: 'hero', position: { x: -6, y: 0, z: 0, facing: 0 } });
  const said = [];
  const events = [];
  const folk = createFolk({
    data, profile: { grade }, world: () => world, env: () => ({ places: { hopscotch: { x: 0, z: 0 }, 'hopscotch-to': { x: 10, z: 0 } }, groundY: () => 0 }),
    learner: () => ({ levelFor: () => level, unlocked: () => true, isMastered: () => false }),
    seed: () => 1, emit: (e) => events.push(e), callout: (k, params, id) => said.push({ key: k, params, id }), command: (c) => {
      if (c.type === 'place') Object.assign(getEntity(world, c.id).position, { x: c.x, z: c.z });
    }, goTo: (p) => Object.assign(getEntity(world, 'hero').position, { x: p.x, z: p.z }), skill: () => {},
    feastOn: () => false, practice: () => null, busy: () => false, day: () => 0, view: () => Math.PI / 4,
  });
  folk.mapStart();
  const run = (sec) => { for (let i = 0; i < sec / DT; i++) folk.tick(DT); };
  const act = () => {
    let a = null;
    folk.candidates((x) => { a = x; }, 3);
    return a;
  };
  return { world, folk, said, events, run, act, hero: () => getEntity(world, 'hero') };
}
function atStart(opts) {
  const t = makeFolk(opts);
  assert.ok(t.folk.join('loco'));
  for (let i = 0; i < 12 / DT && t.folk.stateOf().phase !== 'throw'; i++) t.folk.tick(DT);
  assert.equal(t.folk.stateOf().phase, 'throw');
  return t;
}

test('a child who walks away leaves the game with its line, and a press far from the court throws nothing', () => {
  const t = atStart();
  Object.assign(t.hero().position, { x: 0, z: 12 });
  t.run(0.2);
  assert.ok(t.act() === null || t.act().act !== 'throw', 'no throw away from the start line');
  Object.assign(t.hero().position, { x: 6, z: 30 });
  t.run(0.5);
  assert.equal(t.folk.stateOf(), null, 'the game ends');
  assert.ok(t.said.some((l) => l.key === 'loco.leave'));
  assert.equal(vi['loco.leave'], 'Thôi, lúc khác chơi tiếp nhé.');
});

test('the phase of the walk never moves a hero who walks away', () => {
  const t = makeFolk();
  assert.ok(t.folk.join('loco'));
  // The child walks away at once, before the start line.
  Object.assign(t.hero().position, { x: -2, z: 14 });
  t.run(10);
  const p = t.hero().position;
  assert.ok(Math.hypot(p.x + 2, p.z - 14) < 0.01 || t.folk.stateOf() === null, `the hero stays where it walked: ${p.x}, ${p.z}`);
});

test('at grade K a quick press during a hop waits for the hop and does not end the turn', () => {
  const t = atStart({ grade: 0 });
  // A throw into the called square.
  const call = t.folk.stateOf().call;
  const a = t.act();
  a.run();
  t.run((call + 0.5) * data.loCo.rate);
  a.release(t.folk.stateOf()?.phase === 'aim' ? (call + 0.5) * data.loCo.rate : 0);
  t.run(2);
  assert.equal(t.folk.stateOf()?.phase, 'hop', 'the throw is in');
  // Three quick presses.
  for (let i = 0; i < 3; i++) {
    t.folk.jumpUp(0.05);
    t.run(0.05);
  }
  t.run(2);
  const presses = t.events.filter((e) => e.type === 'hopPress');
  assert.ok(presses.length >= 2, `the press that waited acts after the hop: ${presses.length}`);
  assert.ok(!presses.some((e) => e.events.includes('line')), JSON.stringify(presses));
  assert.ok(!t.said.some((l) => /chạm vạch/.test(vi[l.key] ?? '')), t.said.map((l) => l.key).join(', '));
});

test('at grade 3 a quick press is still a press on the line', () => {
  const t = atStart({ grade: 3 });
  const call = t.folk.stateOf().call;
  const a = t.act();
  a.run();
  t.run((call + 0.5) * data.loCo.rate);
  a.release(0);
  t.run(2);
  assert.equal(t.folk.stateOf()?.phase, 'hop', 'the throw is in');
  t.folk.jumpUp(0.05);
  t.run(0.05);
  t.folk.jumpUp(0.05);
  const presses = t.events.filter((e) => e.type === 'hopPress');
  assert.ok(presses.at(-1).events.includes('line'), JSON.stringify(presses));
});

test('after each round a child says how many rounds are left, and the line of the shard says what happened', () => {
  assert.equal(vi['loco.left.one'], 'Còn một lượt nữa là xong.');
  assert.equal(vi['loco.pick'], 'Nhặt được mảnh sành rồi! Giờ nhảy qua ô đó.');
  assert.ok(!/nhặt (nó|mảnh sành) lên/i.test(vi['loco.pick']), 'no act that has no button');
});
