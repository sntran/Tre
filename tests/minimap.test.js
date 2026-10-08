// The minimap (#8): turned as the view, so that up on the minimap is away from the camera.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMini, miniKind, onMini, MINI } from '../src/world/minimap.js';
import { load } from './helpers.js';
import { C } from '../src/render/palette.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;

test('the hero is in the middle, and a point to the right of the screen is to the right on the minimap', () => {
  for (const az of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    const o = toMini(0, 0, az);
    assert.ok(near(o.x, 0) && near(o.y, 0));
    // The right of the screen on the ground (src/world/view.js): (cos az, -sin az).
    const r = toMini(Math.cos(az), -Math.sin(az), az, 1);
    assert.ok(near(r.x, 1) && near(r.y, 0), 'right');
    // The camera is at (sin az, cos az): a point toward the camera is down on the minimap.
    const c = toMini(Math.sin(az), Math.cos(az), az, 1);
    assert.ok(near(c.x, 0) && near(c.y, 1), 'toward the camera is down');
  }
  // The edge of the round map is at its rim.
  const e = toMini(MINI.radius, 0, 0);
  assert.ok(near(Math.hypot(e.x, e.y), MINI.size / 2));
  assert.equal(onMini(MINI.radius, 0), true);
  assert.equal(onMini(MINI.radius, 1), false);
});

test('each kind of ground has a flat color of the palette, and a house is ink', () => {
  const palette = Object.keys(C);
  for (const id of Object.keys(load('data/tiles.json').types)) assert.ok(palette.includes(miniKind(id)), id);
  assert.equal(miniKind('grass', true), 'ink');
  assert.equal(miniKind('water', true), 'indigoPale');
  assert.equal(miniKind('bamboo', true), 'greenDeep');
});
