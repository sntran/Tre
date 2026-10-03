import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, heightsOf } from './helpers.js';
import { createPlane } from '../src/core/gen/plane.js';
import { createLandPlane, TILE } from '../src/core/gen/tiles.js';
import { stepsOf } from '../src/core/gen/heights.js';

const def = load('data/world/land-giong.json');
const places = ['phu-dong', 'soc-son', 'trau-son', 'road-thanglong'].map((id) => load(`data/maps/${id}.json`));
const world = load('data/geo/vietnam.json');
const geo = { rivers: world.rivers, land: world.land, heights: heightsOf(def.tiles) };
const rules = load('data/world/scatter.json');
const parts = load('data/figures.json').villagers;
const make = (seed) => createLandPlane(def, places, geo, seed, rules, parts);

test('the plane: one scale, the same in both directions, about 45 m for each cell', () => {
  const plane = createPlane(def.plane);
  const [x0, y0] = plane.toCell([105.9, 21.05]);
  const [x1] = plane.toCell([105.9 + 1 / (111.32 * Math.cos((21.05 * Math.PI) / 180)), 21.05]);
  const [, y1] = plane.toCell([105.9, 21.05 + 1 / 110.57]);
  const east = x1 - x0; // cells for one km to the east
  const north = y0 - y1; // cells for one km to the north
  assert.ok(Math.abs(east - north) / east < 0.01, `${east} and ${north} cells for one km`);
  assert.ok(Math.abs(1000 / east - plane.metersAt(21.05)) < 0.5);
  assert.ok(plane.metersAt(21.05) > 42 && plane.metersAt(21.05) < 47);
  const back = plane.toGeo(plane.toCell([106.1, 21.145]));
  assert.ok(Math.abs(back[0] - 106.1) < 1e-9 && Math.abs(back[1] - 21.145) < 1e-9);
});

test('the story places stand at their real places: a walk of one to three minutes between them', () => {
  const L = make(1);
  const at = (f, x, y) => L.toPlane([f, x, y]);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const dinh = at('phu-dong', 32, 20);
  assert.ok(Math.abs(dist(dinh, at('road-thanglong', 0, 40)) - 280) < 30, 'to Văn Miếu');
  assert.ok(Math.abs(dist(dinh, at('trau-son', 176, 20)) - 400) < 40, 'to Núi Trâu');
  assert.ok(Math.abs(dist(dinh, at('soc-son', 38, 20)) - 640) < 50, 'to Sóc Sơn');
});

test('one tile alone gives the same land as the same tile inside a ring', () => {
  for (const seed of [1, 7]) {
    const A = make(seed);
    const spots = [A.toPlane(['phu-dong', 90, 40]), A.toPlane(['trau-son', 180, 20]), A.toPlane(['soc-son', 70, 70])];
    for (const [px, py] of spots) {
      const [tx, tz] = A.tileOf(px, py);
      const alone = make(seed).tile(tx, tz);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (dx || dz) A.tile(tx + dx, tz + dz);
      const ring = A.tile(tx, tz);
      for (const k of ['letter', 'level', 'fixed', 'water', 'road', 'field', 'nearStamp']) assert.deepEqual([...alone[k]], [...ring[k]], `seed ${seed}, tile ${tx},${tz}: ${k}`);
      for (const k of ['objects', 'life', 'villagers', 'sites', 'spots']) assert.deepEqual(alone[k], ring[k], `seed ${seed}, tile ${tx},${tz}: ${k}`);
    }
  }
});

test('the real rivers meet the rivers of the stamps, and the roads join the stamps', () => {
  const L = make(7);
  const letter = (x, y) => L.cell(x, y).letter;
  // The Đuống goes on from both ends of the river of Phù Đổng.
  for (const [x, dir] of [[0, -1], [79, 1]]) {
    const [px, py] = L.toPlane(['phu-dong', x, 71]);
    let water = 0;
    for (let y = py - 8; y <= py + 8; y++) if ('~B'.includes(letter(px + dir * 3, y))) water += 1;
    assert.ok(water >= 6, `the Đuống at ${dir < 0 ? 'west' : 'east'} of Phù Đổng: ${water} cells of water`);
  }
  // Each road goes on, one step at most from a cell of its line to the next.
  for (const r of L.roads) {
    assert.ok(r.line.length > 30, r.id);
    for (let k = 1; k < r.levels.length; k++) assert.ok(Math.abs(r.levels[k] - r.levels[k - 1]) <= 1, `${r.id} at ${k}`);
  }
});

test('the hills on the plane: Sóc Sơn rises with its hill, Núi Trâu is east of its fields', () => {
  const L = make(7);
  const dinh = L.cell(...L.toPlane(['phu-dong', 32, 20]));
  const top = L.toPlane(['soc-son', 38, 20]);
  const want = Math.round(def.base + stepsOf(L.meters(...top), def.relief));
  assert.ok(Math.abs(L.cell(...top).level - want) <= 1, 'the top of Sóc Sơn');
  assert.ok(L.cell(...top).level - dinh.level >= 6);
  const trau = L.toPlane(['trau-son', 176, 20]);
  assert.ok(L.cell(...trau).level - dinh.level >= 5, 'the top of Núi Trâu');
  // The fields of the stamp of Núi Trâu stay low, west of the hill.
  assert.ok(L.cell(...L.toPlane(['trau-son', 80, 30])).level <= 2);
  assert.ok(TILE === 64);
});
