import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTileMap } from '../src/core/tilemap.js';
import { buildTerrain, pickGround, columnTop, WATER } from '../src/world/terrain.js';
import { colorName } from '../src/world/voxel.js';
import { load } from './helpers.js';

const tiles = load('data/tiles.json').types;

// A small map: grass, a river with a bridge, a paddy, a hedge, and a house.
const small = {
  id: 'small',
  width: 12,
  height: 10,
  legend: { '.': 'grass', '~': 'water', '=': 'bridge', f: 'field', h: 'hedge', ':': 'path' },
  layers: {
    ground: [
      'hh..........',
      'hh..........',
      '............',
      '............',
      '....ffff....',
      '....ffff....',
      '~~~~~=~~~~~~',
      '~~~~~=~~~~~~',
      '............',
      '.....:......',
    ],
    height: [
      '222222222222',
      '222222222222',
      '222222222222',
      '222222222222',
      '222211112222',
      '222211112222',
      '000002000000',
      '000002000000',
      '222222222222',
      '222222222222',
    ],
    objects: [{ id: 'home', prop: 'house', x: 6, y: 0, w: 6, h: 4, seed: 7 }],
    triggers: [],
  },
  npcs: [],
  encounters: [],
};

test('the terrain has a column for each cell, water, paddies, a bridge of planks, and props', () => {
  const map = createTileMap(small, tiles);
  const a = buildTerrain(small, tiles, map);
  assert.equal(a.topAt(0, 3), columnTop(2));
  assert.equal(a.ground.top(0, 3), columnTop(2) - 1, 'the top block of a column');
  assert.equal(colorName(a.ground.get(0, 2, 3)), 'greenPale', 'the top has the color of the ground');
  // The river: water over a low bed, also under the bridge.
  assert.equal(a.water.length, 24, 'the water cells and the cells under the bridge');
  assert.ok(a.water.every((w) => w.y === 1 + WATER.river));
  // The bridge: its bed is low, and planks of half blocks make the deck at the height of the road.
  assert.equal(a.ground.top(5, 6), 0);
  assert.ok(a.fine.get(10, a.topAt(5, 6) * 2 - 1, 12), 'a plank on the bridge');
  // The paddies: still water over the field.
  assert.equal(a.paddies.length, 8);
  assert.ok(a.paddies.every((p) => p.y === columnTop(1) + WATER.paddy));
  // The house is an object with a box of blocks; the hedge grows bamboo.
  const home = a.objects.find((o) => o.id === 'home');
  assert.ok(home && home.solid && home.box.y1 > a.topAt(7, 1) * 2);
  assert.equal(a.roofs.filter((r) => r.who === home.who).length, 1);
  assert.ok(a.objects.some((o) => o.kind === 'bamboo'), 'bamboo on the hedge');
  assert.deepEqual(a.boxOf(home).x0, home.box.x0 / 2);
  // The same map builds the same terrain.
  const b = buildTerrain(small, tiles, createTileMap(small, tiles));
  assert.deepEqual(a.fine.data, b.fine.data);
});

test('a ray from the camera picks the first column that it meets', () => {
  const W = 6;
  const H = 6;
  // Flat ground at 3, and a tall column at (3, 2).
  const topAt = (x, z) => (x === 3 && z === 2 ? 8 : 3);
  // Straight down onto the middle of a cell.
  const down = pickGround({ x: 1.5, y: 50, z: 4.5 }, { x: 0, y: -1, z: 0 }, topAt, W, H, 8);
  assert.deepEqual([down.x, down.y, down.h], [1.5, 4.5, 3]);
  // A ray that goes down to the north (-z) meets the south side of the tall column first.
  const d = { x: 0, y: -Math.SQRT1_2, z: -Math.SQRT1_2 };
  const side = pickGround({ x: 3.5, y: 10, z: 8 }, d, topAt, W, H, 8);
  assert.equal(Math.floor(side.x), 3);
  assert.ok(Math.abs(side.y - 3) < 1e-9, 'the south face of the column (z = 3)');
  assert.ok(side.h > 3 && side.h <= 8);
  // The same ray a little to the east misses the column and meets the ground behind it.
  const past = pickGround({ x: 4.5, y: 10, z: 8 }, d, topAt, W, H, 8);
  assert.ok(Math.abs(past.h - 3) < 1e-9);
  assert.ok(Math.abs(past.y - 1) < 1e-9);
  // Out of the map, or up into the sky: no hit.
  assert.equal(pickGround({ x: -20, y: 10, z: -20 }, { x: 0, y: -1, z: 0 }, topAt, W, H, 8), null);
  assert.equal(pickGround({ x: 1, y: 10, z: 1 }, { x: 0, y: 1, z: 0 }, topAt, W, H, 8), null);
});

test('every map of the game builds its terrain, and each object has blocks', () => {
  const world = load('data/world/regions.json');
  for (const id of world.regions.flatMap((r) => r.maps)) {
    const m = load(`data/maps/${id}.json`);
    const t = buildTerrain(m, tiles, createTileMap(m, tiles));
    const ids = new Set(t.objects.map((o) => o.id));
    for (const o of m.layers.objects) assert.ok(ids.has(o.id), `${id}: ${o.id} has blocks`);
  }
});
