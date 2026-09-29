import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipRing, clipLine, simplify, area } from '../tools/geo/build.mjs';
import { load } from './helpers.js';

const geo = load('data/geo/vietnam.json');
const inBox = ([lon, lat], b) => lon >= b.lon0 && lon <= b.lon1 && lat >= b.lat0 && lat <= b.lat1;
const ringsIn = (rings, box) => rings.filter((r) => r.every((p) => inBox(p, box)));

test('the build script clips and simplifies lines and rings', () => {
  const box = { lon0: 0, lat0: 0, lon1: 10, lat1: 10 };
  const square = [[-5, -5], [5, -5], [5, 5], [-5, 5]];
  const clipped = clipRing(square, box);
  assert.equal(area(clipped), 25, 'a quarter of the square is in the box');
  assert.deepEqual(clipLine([[-1, 1], [1, 1], [2, 2], [20, 2], [3, 3], [4, 4]], box), [[[1, 1], [2, 2]], [[3, 3], [4, 4]]]);
  const line = [[0, 0], [1, 0.001], [2, 0], [3, 5]];
  assert.deepEqual(simplify(line, 0.01), [[0, 0], [2, 0], [3, 5]]);
});

test('the map data has Vietnam, the land around it, the main rivers, and the heights', () => {
  assert.ok(geo.land.VNM.length > 5);
  for (const code of ['CHN', 'LAO', 'KHM', 'THA']) assert.ok(geo.land[code]?.length, code);
  const ids = geo.rivers.map((r) => r.id).sort();
  assert.deepEqual(ids, ['bach-dang', 'ca', 'dong-nai', 'duong', 'hong', 'huong', 'ma', 'mekong', 'thai-binh', 'thu-bon']);
  for (const r of geo.rivers) for (const l of r.lines) for (const p of l) assert.ok(inBox(p, geo.bbox), `${r.id} is in the box`);
  // The heights: the Hoàng Liên Sơn mountains are high, the delta near Hà Nội is low, the sea is 0.
  const e = geo.elevation;
  const at = (lon, lat) => e.data[Math.floor((e.lat1 - lat) / e.step)][Math.floor((lon - e.lon0) / e.step)] * e.unit;
  assert.ok(at(103.8, 22.3) > 1200, `mountains ${at(103.8, 22.3)}`);
  assert.ok(at(105.9, 21.0) < 50, `delta ${at(105.9, 21.0)}`);
  assert.equal(at(108.5, 18.0), 0, 'the sea');
  assert.ok(JSON.stringify(geo).length < 200000, 'the file is small');
});

test('the islands of Hoàng Sa and Trường Sa are part of Vietnam on the map, with their names', () => {
  const hoangSa = ringsIn(geo.land.VNM, { lon0: 111, lat0: 15.5, lon1: 113, lat1: 17.3 });
  const truongSa = ringsIn(geo.land.VNM, { lon0: 111.5, lat0: 7, lon1: 117, lat1: 12 });
  assert.ok(hoangSa.length >= 3, 'Hoàng Sa');
  assert.ok(truongSa.length >= 3, 'Trường Sa');
  const names = geo.places.filter((p) => p.kind === 'islands').map((p) => p.name).sort();
  assert.deepEqual(names, ['Hoàng Sa', 'Trường Sa']);
});

test('every story place has real coordinates, and every region has a center place', () => {
  const world = load('data/world/regions.json');
  for (const p of geo.places) assert.ok(inBox(p.at, geo.bbox) && p.name, p.id);
  const centers = new Map(geo.places.filter((p) => p.region).map((p) => [p.region, p]));
  for (const r of world.regions) assert.ok(centers.has(r.id), `a center for ${r.id}`);
  // Era 1 is real: Sóc Sơn is north of Phù Đổng, Núi Trâu is east, and Văn Miếu is south-west.
  const at = Object.fromEntries(geo.places.map((p) => [p.id, p.at]));
  assert.ok(at['soc-son'][1] > at['phu-dong'][1]);
  assert.ok(at['nui-trau'][0] > at['phu-dong'][0]);
  assert.ok(at['van-mieu'][0] < at['phu-dong'][0] && at['van-mieu'][1] < at['phu-dong'][1]);
});
