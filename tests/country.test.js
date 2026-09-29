import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProjection, distanceKm, lineKm, regionAreas, northOf, layoutSeals, clipHalf } from '../src/world/geo.js';
import { load } from './helpers.js';

const geo = load('data/geo/vietnam.json');
const world = load('data/world/regions.json');
const proj = createProjection(geo.bbox);
const place = Object.fromEntries(geo.places.map((p) => [p.id, p.at]));

test('real coordinates go to the country map and back', () => {
  for (const p of geo.places) {
    const m = proj.toMap(p.at);
    assert.ok(m.x >= 0 && m.x <= proj.width && m.y >= 0 && m.y <= proj.height, p.id);
    const back = proj.fromMap(m);
    assert.ok(Math.abs(back[0] - p.at[0]) < 1e-9 && Math.abs(back[1] - p.at[1]) < 1e-9, p.id);
  }
  // North is up and east is right: Sóc Sơn is above Phù Đổng, Núi Trâu is to the right.
  assert.ok(proj.toMap(place['soc-son']).y < proj.toMap(place['phu-dong']).y);
  assert.ok(proj.toMap(place['nui-trau']).x > proj.toMap(place['phu-dong']).x);
});

test('distances on the earth are real', () => {
  // Hà Nội (Văn Miếu) to Huế (Phú Xuân) is about 540 km in a straight line.
  const d = distanceKm(place['van-mieu'], place['phu-xuan']);
  assert.ok(d > 500 && d < 580, `${d}`);
  // Phù Đổng to Văn Miếu is about 15 km.
  const near = distanceKm(place['phu-dong'], place['van-mieu']);
  assert.ok(near > 10 && near < 20, `${near}`);
  assert.equal(lineKm([place['phu-dong'], place['van-mieu']]), near);
});

test('each region has an area of land around its center, and the areas do not overlap', () => {
  const centers = world.regions.map((r) => ({ id: r.id, ...proj.toMap(place[r.place]) }));
  const mainland = geo.land.VNM.map((ring) => ring.map((c) => proj.toMap(c)));
  const { areas, borders } = regionAreas(centers, mainland);
  assert.ok(borders.length > 10, 'borders between regions');
  const size = (ring) => Math.abs(ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
  let total = 0;
  for (const r of world.regions) {
    const a = areas.get(r.id).reduce((s, ring) => s + size(ring), 0);
    assert.ok(a > 0, `${r.id} has land`);
    total += a;
  }
  const land = mainland.reduce((s, ring) => s + size(ring), 0);
  assert.ok(Math.abs(total - land) / land < 0.001, 'the areas cover the land, with no overlap');
  // A region with more points: its cells touch, and the edges between them are not borders.
  const two = regionAreas([{ id: 'a', x: 0, y: 0 }, { id: 'a', x: 10, y: 0 }, { id: 'b', x: 20, y: 0 }], [[{ x: -5, y: -5 }, { x: 25, y: -5 }, { x: 25, y: 5 }, { x: -5, y: 5 }]]);
  assert.equal(two.areas.get('a').length, 2);
  assert.equal(two.borders.length, 1, 'one border, between a and b');
  assert.ok(Math.abs(two.borders[0][0].x - 15) < 1e-9 && Math.abs(two.borders[0][1].x - 15) < 1e-9);
});

test('the land of an era: the part north of a latitude', () => {
  const ring = [[100, 10], [110, 10], [110, 20], [100, 20]];
  const north = northOf(ring, 18);
  assert.ok(north.every(([, lat]) => lat >= 18 - 1e-9));
  assert.equal(north.length, 4);
  assert.deepEqual(clipHalf([{ x: 0, y: 0 }, { x: 1, y: 0 }], () => -1), []);
  // The first era (Văn Lang) is the north only.
  assert.ok(world.eraLand.byChapter['3'] >= 17 && world.eraLand.byChapter['3'] <= 20);
});

test('seals do not cover each other, and each seal stays near its place', () => {
  const anchors = ['phu-dong', 'co-loa', 'thang-long', 'me-linh', 'soc-son'].map((id) => ({ id, ...proj.toMap(place[id]) }));
  const r = 3;
  const seals = layoutSeals(anchors, r);
  for (let i = 0; i < seals.length; i++) {
    for (let j = i + 1; j < seals.length; j++) {
      assert.ok(Math.hypot(seals[i].x - seals[j].x, seals[i].y - seals[j].y) >= r * 2, `${seals[i].id} and ${seals[j].id}`);
    }
    assert.ok(Math.hypot(seals[i].x - seals[i].ax, seals[i].y - seals[i].ay) < r * 6, `${seals[i].id} is near its place`);
  }
});
