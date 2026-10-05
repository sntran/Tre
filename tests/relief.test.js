import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { load, heightsOf, worldOf, mapOf, planeOf } from './helpers.js';
import { createHeights, parseHeightTile, stepsOf, tileOf } from '../src/core/gen/heights.js';
import { encodeTile } from '../tools/geo/build.mjs';
import { createPlane } from '../src/core/gen/plane.js';

const def = load('data/world/land-giong.json');
const both = heightsOf(['N21E105', 'N21E106']);
const frame = (id) => def.frames.find((f) => f.id === id);

test('a height tile file: a header and 201 x 201 values, read the same as it was written', () => {
  const data = new Int16Array(201 * 201).map((_, i) => (i * 7) % 900 - 20);
  const header = { tile: 'N10E100', lon0: 100, lat1: 11, step: 0.005, cols: 201, rows: 201, unit: 'm' };
  const t = parseHeightTile(encodeTile({ header, data }));
  assert.deepEqual({ ...t, data: undefined }, { ...header, data: undefined });
  assert.deepEqual([...t.data], [...data]);
  // The tiles of the land are in the repository, with their header.
  for (const name of def.tiles) {
    const file = new URL(`../data/geo/heights/${name}.bin`, import.meta.url);
    assert.ok(existsSync(file), name);
    const tile = parseHeightTile(readFileSync(file));
    assert.equal(tile.tile, name);
    assert.equal(tile.cols, 201);
    assert.equal(tile.step, 0.005);
  }
  assert.equal(tileOf(106.1, 21.13), 'N21E106');
  assert.equal(tileOf(105.95, 21.05), 'N21E105');
});

test('one tile alone gives the same heights as the tiles around it', () => {
  const alone = heightsOf(['N21E106']);
  for (let lat = 21.0; lat <= 21.4; lat += 0.0123) {
    for (let lon = 106.0; lon < 106.3; lon += 0.0137) assert.equal(alone.at(lon, lat), both.at(lon, lat));
    assert.equal(alone.at(105.9, lat), null, 'no tile, no height');
  }
  // The land asks for the height tiles of a land tile before it makes it.
  const land = mapOf('giong', 1).land;
  const [x, y] = worldOf().at('trau-son', 176, 20);
  assert.deepEqual(land.needs(Math.floor(x / 64), Math.floor(y / 64)), ['N21E106']);
});

test('Núi Trâu and the hill of Sóc Sơn rise several steps over Phù Đổng, by the fine data', () => {
  const L = mapOf('giong', 1).land;
  const low = L.cell(...worldOf().at('phu-dong', ...frame('phu-dong').cell)).level;
  for (const id of ['trau-son', 'soc-son']) {
    const f = frame(id);
    // The height that the data gives at the real top, through the curve.
    const want = Math.round(def.base + stepsOf(both.at(...f.at), def.relief));
    const got = L.cell(...worldOf().at(id, ...f.cell)).level;
    assert.ok(Math.abs(got - want) <= 1, `${id}: ${got}, the data gives ${want}`);
    // Trâu Sơn is a line of low hills (#27): its top is 71 m, a few steps over the delta.
    assert.ok(want - low >= (id === 'trau-son' ? 4 : 6), `${id}: ${want - low} steps over Phù Đổng`);
  }
  // The stamp of Sóc Sơn rose with its hill; the fields of Núi Trâu stay low, at the foot.
  assert.deepEqual(L.stamps.filter((s) => s.lift > 0).map((s) => s.place), ['soc-son']);
  const s = L.stamps.find((x) => x.place === 'trau-son');
  assert.equal(L.cell(s.x + 10, s.y + 10).level, parseInt(s.height[10][10], 36));
});

test('slopes read as slopes: rock faces on the steep land, forest on the hills, paddies low or near a hamlet', () => {
  for (const seed of [1, 7]) {
    const L = mapOf('giong', seed).land;
    let rock = 0;
    let trees = 0;
    // The tiles around Núi Trâu and Sóc Sơn.
    for (const [id, x, y] of [['trau-son', 176, 20], ['soc-son', 38, 20]]) {
      const [px, py] = worldOf().at(id, x, y);
      for (let tz = Math.floor(py / 64) - 1; tz <= Math.floor(py / 64) + 1; tz++) {
        for (let tx = Math.floor(px / 64) - 1; tx <= Math.floor(px / 64) + 1; tx++) {
          const t = L.tile(tx, tz);
          const sites = t.sites;
          for (let i = 0; i < 64 * 64; i++) {
            const ch = String.fromCharCode(t.letter[i]);
            if (ch === 'r') rock += 1;
            if (ch === 'f' && !t.fixed[i] && t.level[i] > def.base + 1) {
              // A paddy over the low land is a terrace near a hamlet.
              const cx = t.x0 + (i % 64);
              const cy = t.z0 + Math.floor(i / 64);
              const near = [...sites, ...L.tile(tx - 1, tz).sites, ...L.tile(tx + 1, tz).sites, ...L.tile(tx, tz - 1).sites, ...L.tile(tx, tz + 1).sites];
              assert.ok(near.some((s) => Math.hypot(Math.max(s.x - cx, 0, cx - s.x - s.w), Math.max(s.y - cy, 0, cy - s.y - s.h)) <= def.wet.terrace + 8), `${seed}: a paddy on the hill at ${cx},${cy}`);
            }
          }
          trees += t.objects.filter((o) => o.prop === 'tree' && L.cell(o.x, o.y).level >= def.base + 3).length;
        }
      }
    }
    assert.ok(rock > 20, `${seed}: ${rock} cells of rock face`);
    // Trees stand close together on the hills.
    assert.ok(trees >= 10, `${seed}: ${trees} trees on the hills`);
  }
});

test('the soldiers come down a path from the top of Núi Trâu: the hero can walk it from the fields', async () => {
  const { findPath } = await import('../src/core/tilemap.js');
  const [gx, gy] = worldOf().at('trau-son', ...frame('trau-son').cell);
  const goal = { x: Math.floor(gx), y: Math.floor(gy) };
  for (const seed of [1, 2, 3]) {
    const { tileMap: t } = planeOf(seed, { r: 0 });
    const [wx, wy] = worldOf().at('trau-son', ...load('data/raids.json').raids.boss.wall);
    const path = findPath(t, { x: Math.floor(wx), y: Math.floor(wy) }, goal, { maxNodes: 80000 });
    assert.ok(path, `${seed}: from the gate of the last raid to the top`);
    assert.ok(t.heightAt(goal.x, goal.y) - t.heightAt(Math.floor(wx), Math.floor(wy)) >= 6);
  }
});

test('the heights of the fine data keep the tops: the top of Núi Trâu is a hill, the delta is flat', () => {
  const h = createHeights(def.startTiles.map((n) => parseHeightTile(readFileSync(new URL(`../data/geo/heights/${n}.bin`, import.meta.url)))));
  // Trâu Sơn is the line of low hills near Châu Cầu (#27): the frame and the place of the country
  // map are less than 1 km from its highest top, and the top is 50 m or more.
  const TOP = [106.23, 21.14];
  const km = ([a, b]) => Math.hypot((a - TOP[0]) * 111.32 * Math.cos((TOP[1] * Math.PI) / 180), (b - TOP[1]) * 110.57);
  assert.ok(km(frame('trau-son').at) < 1, 'the frame');
  assert.ok(km(load('data/geo/vietnam.json').places.find((p) => p.id === 'nui-trau').at) < 1, 'the place nui-trau');
  assert.ok(h.at(...frame('trau-son').at) >= 50);
  // Núi Dạm, the tall hill to the west (130 m), is land with no name, out of the frame of Trâu Sơn.
  const DAM = [106.10, 21.145];
  assert.ok(h.at(...DAM) > 90);
  const plane = createPlane(def.plane);
  const [dx, dy] = plane.toCell(DAM);
  const [x0, y0] = worldOf().at('trau-son', 0, 0);
  const [x1, y1] = worldOf().at('trau-son', 200, 84);
  assert.ok(dx < x0 || dx > x1 || dy < y0 || dy > y1, 'Núi Dạm is not in the frame of Trâu Sơn');
  assert.ok(h.at(...frame('soc-son').at) > 200);
  assert.ok(stepsOf(h.at(...frame('phu-dong').at), def.relief) < 0.5, 'Phù Đổng is on the flat delta');
});
