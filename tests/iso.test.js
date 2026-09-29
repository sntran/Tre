import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toScreen, toMap, pickTile, diamond, spriteBox, screenDirToMap, mapBounds, TILE_W, TILE_H } from '../src/iso/grid.js';
import { depthSort, isBehind } from '../src/iso/depth.js';
import { createIsoCamera } from '../src/iso/camera.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('isometric to screen and back', () => {
  assert.deepEqual(toScreen(0, 0), { x: 0, y: 0 });
  assert.deepEqual(toScreen(1, 0), { x: TILE_W / 2, y: TILE_H / 2 }, 'map x goes right and down');
  assert.deepEqual(toScreen(0, 1), { x: -TILE_W / 2, y: TILE_H / 2 }, 'map y goes left and down');
  assert.deepEqual(toScreen(2, 2, 10), { x: 0, y: 2 * TILE_H - 10 }, 'z lifts the point');
  for (const [x, y] of [[0, 0], [3.25, 7.5], [47.9, 0.1], [12, 40]]) {
    const s = toScreen(x, y);
    const m = toMap(s.x, s.y);
    assert.ok(near(m.x, x) && near(m.y, y), `${x},${y}`);
  }
});

test('tile picking uses the diamond, not the box', () => {
  // The middle of the tile (5, 7) and points near its four corners, inside.
  const c = toScreen(5.5, 7.5);
  assert.deepEqual(pickTile(c.x, c.y), { x: 5, y: 7 });
  const d = diamond(5, 7);
  assert.deepEqual(pickTile(d.north.x, d.north.y + 1), { x: 5, y: 7 });
  assert.deepEqual(pickTile(d.south.x, d.south.y - 1), { x: 5, y: 7 });
  assert.deepEqual(pickTile(d.east.x - 2, d.east.y), { x: 5, y: 7 });
  assert.deepEqual(pickTile(d.west.x + 2, d.west.y), { x: 5, y: 7 });
  // Just outside the north-east edge of the diamond is the tile (5, 6).
  const edge = { x: (d.north.x + d.east.x) / 2, y: (d.north.y + d.east.y) / 2 };
  assert.deepEqual(pickTile(edge.x + 1, edge.y - 1), { x: 5, y: 6 });
  assert.deepEqual(pickTile(edge.x - 1, edge.y + 1), { x: 5, y: 7 });
});

test('a picture on a footprint: the width and the bottom corner', () => {
  const box = spriteBox(10, 4, 3, 3, 210);
  assert.equal(box.width, 6 * TILE_W / 2);
  assert.equal(box.left, diamond(10, 4, 3, 3).west.x);
  assert.equal(box.top + box.height, diamond(10, 4, 3, 3).south.y);
  const b = mapBounds(48, 48);
  assert.equal(b.right - b.left, 48 * TILE_W);
  assert.equal(b.bottom, 48 * TILE_H);
});

test('screen directions become map directions: up is north', () => {
  const up = screenDirToMap(0, -1);
  assert.ok(near(up.x, -Math.SQRT1_2) && near(up.y, -Math.SQRT1_2));
  const right = screenDirToMap(1, 0);
  assert.ok(right.x > 0 && right.y < 0 && near(Math.hypot(right.x, right.y), 1));
  // A move along the map direction goes in the screen direction.
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 1], [0.3, -0.8]]) {
    const m = screenDirToMap(dx, dy);
    const s = toScreen(m.x, m.y);
    const angle = Math.atan2(s.y, s.x) - Math.atan2(dy, dx);
    assert.ok(near(Math.sin(angle), 0, 1e-9) && Math.cos(angle) > 0, `${dx},${dy}`);
  }
  assert.deepEqual(screenDirToMap(0, 0), { x: 0, y: 0 });
});

const box = (id, x, y, w = 1, h = 1) => ({ id, x0: x, y0: y, x1: x + w, y1: y + h });
const order = (items) => depthSort(items).map((i) => i.id);

test('depth order: north is behind south, and a person walks behind and in front of a house', () => {
  assert.deepEqual(order([box('front', 5, 5), box('back', 2, 2)]), ['back', 'front']);
  const house = box('house', 10, 10, 3, 3);
  const person = (x, y) => box('person', x - 0.2, y - 0.2, 0.4, 0.4);
  // North of the house (smaller y): behind it.
  assert.deepEqual(order([house, person(11.5, 9.3)]), ['person', 'house']);
  // West of the house (smaller x): behind it.
  assert.deepEqual(order([house, person(9.3, 11.5)]), ['person', 'house']);
  // South of the house: in front.
  assert.deepEqual(order([person(11.5, 13.6), house]), ['house', 'person']);
  // East of the house: in front.
  assert.deepEqual(order([person(13.6, 11.5), house]), ['house', 'person']);
  // A long row of hedge tiles and a person inside the row's box area.
  const items = [house, box('tree', 13, 9), person(13.6, 11.5), box('well', 9, 13)];
  const o = order(items);
  assert.ok(o.indexOf('house') < o.indexOf('person'));
  assert.ok(o.indexOf('tree') < o.indexOf('person'), 'the tree is north of the person');
  // The rule is consistent for each pair.
  for (const a of items) for (const b of items) if (a !== b) assert.ok(!(isBehind(a, b) && isBehind(b, a)), `${a.id} ${b.id}`);
});

test('camera: a soft lag, two zoom levels, and limits', () => {
  const cam = createIsoCamera({ zooms: [1, 0.5], lag: 0.2 });
  cam.resize(800, 400, 1.5);
  assert.equal(cam.zoom, 1.5);
  cam.follow(100, 0, 0.2);
  assert.ok(cam.x > 60 && cam.x < 66, `after one lag: ${cam.x}`);
  for (let i = 0; i < 100; i++) cam.follow(100, 0, 1 / 60);
  assert.ok(near(cam.x, 100, 0.01));
  cam.setLevel(1);
  assert.equal(cam.zoom, 0.75);
  cam.setLevel(5);
  assert.equal(cam.level, 1);
  // View and world points go back and forth.
  const w = cam.toWorld(123, 45);
  const v = cam.toView(w.x, w.y);
  assert.ok(near(v.x, 123) && near(v.y, 45));
  // The camera stays over the map.
  cam.setLevel(0);
  cam.bounds = mapBounds(48, 48);
  cam.jump(-99999, -99999);
  const view = cam.view();
  assert.ok(near(view.left, cam.bounds.left) && near(view.top, cam.bounds.top));
});

test('a tap on raised ground picks the raised tile in front, not the flat tile under the point', async () => {
  const { pickTileZ, toScreen, STEP } = await import('../src/iso/grid.js');
  // A 4 x 4 map. The tile (2, 2) is 3 steps high.
  const heightAt = (x, y) => (x === 2 && y === 2 ? 3 : 0);
  const top = toScreen(2.5, 2.5, 3 * STEP);
  assert.deepEqual(({ ...pickTileZ(top.x, top.y, heightAt, 4, 4, STEP) }).x, 2);
  assert.equal(pickTileZ(top.x, top.y, heightAt, 4, 4, STEP).y, 2);
  assert.equal(pickTileZ(top.x, top.y, heightAt, 4, 4, STEP).z, 3);
  // A flat tile far from the raised tile.
  const flat = toScreen(0.5, 3.5);
  const hit = pickTileZ(flat.x, flat.y, heightAt, 4, 4, STEP);
  assert.deepEqual([hit.x, hit.y, hit.z], [0, 3, 0]);
  // Outside the map: nothing.
  assert.equal(pickTileZ(-500, -500, heightAt, 4, 4, STEP), null);
});
