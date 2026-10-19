// The view after the play test (#111): when the hero stands still and a building covers most of the
// hero, the view turns one time to a side where the hero and the person show; a work turns the view
// one time, and a line of a talk that names things never turns it; a turn of the child keeps the
// view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { columnTop } from '../src/world/terrain.js';
import { heroCovered, stillTurn, BUILDINGS } from '../src/world/fade.js';
import { createTurns, HAND_KEEP } from '../src/world/turns.js';
import { load, planeOf } from './helpers.js';

const ELEVATION = Math.atan(0.5); // the camera of src/render/voxel.js (VIEW.elevation)
const { map, tileMap, terrain, at } = planeOf(1, { blocks: load('data/world/blocks.json') });
void map;
const npcs = load('data/maps/phu-dong.json').npcs;

const groundAt = (x, z) => ({ x, y: columnTop(tileMap.heightAt(Math.floor(x), Math.floor(z))), z });
function objectsNear(p) {
  return terrain.objects
    .filter((o) => !o.gone && BUILDINGS.has(o.kind) && Math.abs(o.x + o.w / 2 - p.x) < 20 && Math.abs(o.y + o.h / 2 - p.z) < 20)
    .map((o) => ({ b: terrain.boxOf(o), building: true, hits: (x, y, z) => terrain.hits(o.who, x, y, z) }));
}

test('at the house of the elder, at the healer, and at the teacher, from each of the four angles: when the talk opens, the hero is not covered', () => {
  let turned = 0;
  for (const id of ['elder', 'healer', 'teacher']) {
    const n = npcs.find((x) => x.id === id);
    const [px, pz] = at('phu-dong', n.x, n.y);
    const person = groundAt(px, pz);
    // The hero stands next to the person, on one of four sides.
    for (const [dx, dz] of [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]]) {
      const hero = groundAt(px + dx, pz + dz);
      const objects = objectsNear(hero);
      for (let k = 0; k < 4; k++) {
        const az = Math.PI / 4 + (k * Math.PI) / 2;
        const steps = stillTurn(objects, hero, person, az, ELEVATION);
        if (steps) turned += 1;
        const after = az + (steps * Math.PI) / 2;
        const clearSide = [0, 1, 2, 3].some((s) => !heroCovered(objects, hero, az + (s * Math.PI) / 2, ELEVATION));
        if (clearSide) assert.ok(!heroCovered(objects, hero, after, ELEVATION), `${id}, the hero at ${dx}, ${dz}, angle ${k}: covered after ${steps} steps`);
      }
    }
  }
  assert.ok(turned > 0, 'a building covers the hero from some angle, and the view turns');
});

test('a hero that shows gets no turn', () => {
  const [x, z] = at('phu-dong', 40, 60);
  const hero = groundAt(x, z);
  for (let k = 0; k < 4; k++) assert.equal(stillTurn([], hero, null, (k * Math.PI) / 2, ELEVATION), 0);
});

test('a task turns the view one time: a talk with three lines that name things turns it at most one time', () => {
  const turns = createTurns();
  let n = 0;
  if (turns.work('trial-healer', 0)) n += 1;
  for (let i = 0; i < 3; i++) if (turns.names()) n += 1;
  // The task shows its view again (each step of the help): no new turn.
  for (let i = 0; i < 3; i++) if (turns.work('trial-healer', 1000 + i)) n += 1;
  assert.equal(n, 1);
  // Another work turns one time; after the hero walks away, the same work turns again.
  assert.ok(turns.work('trial-scholar', 2000));
  turns.away();
  assert.ok(turns.work('trial-healer', 3000));
});

test('after a turn of the child, no work and no stop turns the view for HAND_KEEP', () => {
  const turns = createTurns();
  turns.hand(0);
  assert.equal(turns.work('trial-fisher', 1000), false);
  assert.equal(turns.still(1000), false);
  // The work had its time to turn: it does not turn later.
  assert.equal(turns.work('trial-fisher', HAND_KEEP + 1), false);
  assert.ok(turns.still(HAND_KEEP + 1));
  assert.ok(turns.work('trial-smith', HAND_KEEP + 1));
});
