import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSway, swayStep, targetOf, airOf, NOTCH } from '../src/world/sway.js';
import { breezeAt } from '../src/core/world/systems/sky.js';
import { createWorldState } from '../src/core/world/state.js';
import { step, STEP } from '../src/core/world/step.js';
import { createTileMap } from '../src/core/tilemap.js';
import { envFor } from '../src/core/world/env.js';
import { personFine, ngheFine, chickenFine } from '../src/world/fine.js';
import { load } from './helpers.js';

const DT = 1 / 60;
const still = { x: 0, z: 0, strength: 0 };
// A figure that faces +z walks (or runs) at a speed for some seconds, then stands for some more.
function run(s, { speed, walk = 1.5, stand = 0, wind = still, facing = 0 }) {
  const frames = [];
  let phase = 0;
  for (let t = 0; t < walk + stand; t += DT) {
    const moving = t < walk;
    const v = moving ? speed : 0;
    phase += DT * v * 2 * 1.9;
    frames.push(swayStep(s, { vel: { x: Math.sin(facing) * v, z: Math.cos(facing) * v }, facing, wind, phase, stride: Math.min(1, v / 4.5), dt: DT }));
  }
  return frames;
}

test('a step swings a tail of hair, and it settles when the figure stops', () => {
  const s = createSway();
  const frames = run(s, { speed: 3, walk: 1.5, stand: 2 });
  const walking = frames.slice(30, 90);
  assert.ok(walking.some((f) => Math.abs(f.hang[2]) > 0.05), 'the step swings it to the side');
  assert.ok(walking.every((f) => f.hang[0] > 0.2), 'the walk streams it back');
  const last = frames.at(-1).hang;
  assert.ok(Math.abs(last[0]) < 0.02 && Math.abs(last[2]) < 0.02, `it settles: ${last}`);
});

test('a run streams the tail back farther than a walk', () => {
  const walk = run(createSway(), { speed: 3, walk: 2 }).at(-1).hang[0];
  const runs = run(createSway(), { speed: 8, walk: 2 }).at(-1).hang[0];
  assert.ok(walk > 0 && runs > walk + NOTCH / 2, `walk ${walk}, run ${runs}`);
});

test('the wind lifts the fringe from the front, and not from the back', () => {
  const into = { x: 0, z: -1, strength: 1 };
  const front = run(createSway(), { speed: 0, walk: 0, stand: 2, wind: into }).at(-1);
  assert.ok(front.lift[0] < -0.2, `the fringe lifts: ${front.lift[0]}`);
  assert.ok(front.hang[0] > 0.2, 'and the hair streams back');
  const back = run(createSway(), { speed: 0, walk: 0, stand: 2, wind: { x: 0, z: 1, strength: 1 } }).at(-1);
  assert.equal(Math.abs(back.lift[0]) < 1e-9, true, 'a wind from behind does not lift it');
  // A wind to the side of the figure moves the hair to that side.
  const side = run(createSway(), { speed: 0, walk: 0, stand: 2, wind: { x: 1, z: 0, strength: 1 } }).at(-1);
  assert.ok(side.hang[2] > 0.2);
});

test('the same wind and the same walk give the same angles, and the targets are a few positions', () => {
  const wind = breezeAt(4);
  const a = run(createSway(), { speed: 3, walk: 1, stand: 1, wind, facing: 0.7 });
  const b = run(createSway(), { speed: 3, walk: 1, stand: 1, wind, facing: 0.7 });
  assert.deepEqual(a, b);
  const t = targetOf('hang', airOf({ x: 1, z: 2 }, 0.3, wind), 1.2, 0.6);
  for (const v of t.map((x) => Math.round(x / NOTCH) * NOTCH)) assert.ok(Math.abs(v / NOTCH - Math.round(v / NOTCH)) < 1e-9);
});

test('the world has a soft breeze with a slow swell and gusts, from the sky system', () => {
  const tiles = load('data/tiles.json').types;
  const map = { width: 4, height: 4, legend: { '.': 'grass' }, layers: { ground: Array(4).fill('....'), height: Array(4).fill('2222'), objects: [] } };
  const env = envFor(createTileMap(map, tiles));
  const w = createWorldState({ seed: 1, clock: { minutes: 600 } });
  const seen = [];
  for (let i = 0; i < 30 * 30; i++) {
    step(w, STEP, env);
    seen.push(w.wind.strength);
  }
  assert.ok(Math.min(...seen) >= 0.2 && Math.max(...seen) <= 0.95, 'soft, and a gust is a little more');
  // Without gusts (no seed), the breeze stays soft.
  for (let t = 0; t < 60; t += 0.5) assert.ok(breezeAt(t).strength <= 0.5);
  assert.ok(Math.max(...seen) - Math.min(...seen) > 0.1, 'it swells slowly');
  assert.ok(Math.abs(Math.hypot(w.wind.x, w.wind.z) - 1) < 1e-9, 'a direction');
});

test('the parts that hang have a kind and one pivot, and stay one part', () => {
  const look = { skin: 'skin2', top: 'indigo', bottom: 'ink', bottomKind: 'skirt', topKind: 'shirt', sash: 'vermilion', hair: 'braids', hat: 'non' };
  const kinds = (fig) => Object.fromEntries(fig.parts.filter((p) => p.hang).map((p) => [p.name, p.hang]));
  const girl = kinds(personFine(look));
  assert.deepEqual(girl, { skirt: 'cloth', sashTail: 'hang', cuffL: 'cloth', cuffR: 'cloth', 'braid-1': 'hang', braid1: 'hang', stringL: 'hang', stringR: 'hang' });
  for (const p of personFine(look).parts.filter((x) => x.hang && x.hang !== 'bob')) assert.ok(p.pivotTop, `${p.name} hangs from its top`);
  assert.deepEqual(kinds(ngheFine()), { earL: 'ear', earR: 'ear', tail: 'tail' });
  assert.equal(chickenFine().parts.find((p) => p.name === 'tailF').pivotBottom, true, 'the tail of a rooster stands up from its base');
  assert.equal(personFine({ ...look, hair: 'topknot', hat: null }).parts.find((p) => p.name === 'knot').hang, 'bob');
});
