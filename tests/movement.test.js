import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldFor, screenToMap, faceOf, MOVE, collides, moveCircle, keysToScreenDir, stickToScreenDir, stepBody, inputToward, createFollower, stepFollower } from '../src/world/movement.js';

// A small world: a wall of blocked tiles at x = 5, a gap at y = 3, shallow water at x = 2.
const blocked = new Set(['5,0', '5,1', '5,2', '5,4', '5,5', '5,6']);
const world = {
  isBlocked: (x, y) => x < 0 || y < 0 || x > 9 || y > 9 || blocked.has(`${x},${y}`),
  groundAt: (x) => (x === 2 ? 'shallow' : 'grass'),
};
const run = (body, input, seconds, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) stepBody(body, input, dt, world);
  return body;
};

test('collision: a circle touches a blocked tile only when it overlaps it', () => {
  assert.equal(collides(4.8, 1.5, 0.28, world.isBlocked), true);
  assert.equal(collides(4.6, 1.5, 0.28, world.isBlocked), false);
  assert.equal(collides(5.5, 3.5, 0.28, world.isBlocked), false, 'the gap is free');
  // A corner: the distance to the corner point counts, not the box.
  assert.equal(collides(4.8, 3.1, 0.28, world.isBlocked), true);
  assert.equal(collides(4.75, 3.5, 0.28, world.isBlocked), false);
});

test('movement: the hero stops at a wall and slides along it', () => {
  const R = 0.28;
  const p = moveCircle({ x: 4, y: 1.5 }, 3, 0, R, world.isBlocked);
  assert.ok(p.x <= 5 - R + 1e-6 && p.x > 4.6, `stops at the wall: ${p.x}`);
  const slide = moveCircle({ x: 4.6, y: 1.5 }, 1, 1, R, world.isBlocked);
  assert.ok(slide.y > 2.4 && slide.x < 5 - R + 1e-6, 'slides down the wall');
  // Through a gap of one cell, also with the radius of the hero.
  const through = moveCircle({ x: 4, y: 3.5 }, 3, 0, MOVE.radius, world.isBlocked);
  assert.ok(through.x > 6.9, 'walks through the gap');
  // A fast move does not jump over a thin wall.
  const fast = moveCircle({ x: 4.5, y: 0.5 }, 5, 0, R, world.isBlocked);
  assert.ok(fast.x < 5);
});

test('the screen direction turns with the camera: up on the screen is away from the camera', () => {
  const close = (a, b) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
  // The camera on the +y side (south): up is north (-y), right is east (+x).
  assert.ok(close(screenToMap(0, -1, 0), { x: 0, y: -1 }));
  assert.ok(close(screenToMap(1, 0, 0), { x: 1, y: 0 }));
  // The camera on the +x side (east): up is west (-x).
  assert.ok(close(screenToMap(0, -1, Math.PI / 2), { x: -1, y: 0 }));
  // The camera at the south-east (the start view): up is north-west.
  const d = screenToMap(0, -1, Math.PI / 4);
  assert.ok(close(d, { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }));
  assert.equal(faceOf(0, 1), 0);
});

test('movement: walk, run, stop, and slower in shallow water', () => {
  const walk = run({ x: 7, y: 7.5 }, { dx: 0, dy: -1 }, 0.1);
  assert.ok(walk.moving);
  const a = run({ x: 7.5, y: 9.5 }, { dx: 0, dy: -1, strength: 1 }, 0.5);
  const b = run({ x: 7.5, y: 9.5 }, { dx: 0, dy: -1, strength: 1, run: true }, 0.5);
  assert.ok(9.5 - b.y > (9.5 - a.y) * 1.4, 'running is faster');
  // The input is a map direction; the face turns to the direction of the walk.
  const north = run({ x: 7, y: 7 }, { dx: 0, dy: -1 }, 0.3);
  assert.ok(north.x === 7 && north.y < 7);
  assert.ok(Math.abs(Math.abs(north.facing) - Math.PI) < 1e-6, 'looks north');
  // Let go: the hero stops soon.
  run(north, { dx: 0, dy: 0 }, 0.5);
  assert.equal(north.moving, false);
  // Shallow water: slower.
  const dry = run({ x: 3.5, y: 8.5 }, { dx: 0, dy: -1 }, 0.4);
  const wet = run({ x: 2.5, y: 8.5 }, { dx: 0, dy: -1 }, 0.4);
  assert.ok(Math.hypot(wet.x - 2.5, wet.y - 8.5) < Math.hypot(dry.x - 3.5, dry.y - 8.5) * 0.8);
  assert.equal(wet.shallow, true);
});

test('input: keys, the stick, and a walk toward a point', () => {
  assert.deepEqual(keysToScreenDir(new Set(['ArrowUp', 'KeyD'])), { dx: 1, dy: -1, run: false });
  assert.equal(keysToScreenDir(new Set(['KeyS', 'ShiftLeft'])).run, true);
  assert.equal(stickToScreenDir(2, 1, 60).strength, 0, 'a small push does nothing');
  const s = stickToScreenDir(30, 0, 60);
  assert.ok(Math.abs(s.strength - 0.5) < 1e-9 && s.run === false);
  assert.equal(stickToScreenDir(0, -80, 60).run, true, 'a far push runs');
  // Tap and hold: the hero reaches the point and stops.
  const body = { x: 7.5, y: 8.5 };
  for (let i = 0; i < 300; i++) stepBody(body, inputToward(body, { x: 8.5, y: 7.2 }), 1 / 60, world);
  assert.ok(Math.hypot(body.x - 8.5, body.y - 7.2) < 0.3, `${body.x},${body.y}`);
  assert.equal(inputToward(body, { x: body.x, y: body.y }).strength, 0);
});

test('Nghé follows the hero with a lag, keeps a gap, and jumps when far', () => {
  const hero = { x: 7.5, y: 8.5 };
  const nghe = createFollower(7.5, 8.5);
  for (let i = 0; i < 180; i++) {
    stepBody(hero, { dx: 0, dy: -1 }, 1 / 60, world);
    stepFollower(nghe, hero, 1 / 60, world);
  }
  const d = Math.hypot(hero.x - nghe.x, hero.y - nghe.y);
  assert.ok(d > 1.5 && d < 4.5, `gap ${d}`);
  assert.ok(nghe.y > hero.y, 'Nghé walks behind the hero');
  // The hero stops: Nghé stops too, near the hero, and starts to count idle time.
  for (let i = 0; i < 120; i++) {
    stepBody(hero, { dx: 0, dy: 0 }, 1 / 60, world);
    stepFollower(nghe, hero, 1 / 60, world);
  }
  assert.equal(nghe.moving, false);
  assert.ok(nghe.idle > 0.5);
  // A jump of the hero: Nghé comes to the trail behind the hero.
  hero.x = 1.5;
  hero.y = 1.5;
  stepFollower(nghe, hero, 1 / 60, world);
  assert.ok(Math.hypot(hero.x - nghe.x, hero.y - nghe.y) < 3);
});

test('a body sees a cliff as a wall: a tile two steps higher or lower blocks it', () => {
  const heights = [[2, 2, 4], [2, 3, 2]];
  const tileMap = {
    isBlocked: (x, y) => x < 0 || y < 0 || x > 2 || y > 1,
    heightAt: (x, y) => heights[y]?.[x] ?? 0,
    groundAt: () => 'grass',
  };
  const w = worldFor(tileMap, 0.5, 0.5);
  assert.equal(w.isBlocked(1, 1), false, 'one step up');
  assert.equal(w.isBlocked(2, 0), true, 'two steps up');
  assert.equal(worldFor(tileMap, 1.5, 1.5).isBlocked(2, 0), false, 'from one step higher');
});
