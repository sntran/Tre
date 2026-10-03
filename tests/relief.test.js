import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { load, heightsOf, worldOf } from './helpers.js';
import { createHeights, parseHeightTile, stepsOf, tileOf } from '../src/core/gen/heights.js';
import { createLand } from '../src/core/gen/land.js';
import { encodeTile } from '../tools/geo/build.mjs';

const def = load('data/world/land-giong.json');
const regions = load('data/world/regions.json');
const maps = regions.regions.find((r) => r.id === 'giong').maps.map((id) => load(`data/maps/${id}.json`));
const geo = load('data/geo/vietnam.json');
const both = heightsOf(def.tiles);
const landOf = (heights, seed = 1) => createLand(def, maps, { rivers: geo.rivers, heights }, seed, load('data/world/scatter.json').hamlets);
const anchor = (prefix) => def.anchors.find((a) => a.note.startsWith(prefix));

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

test('one tile alone gives the same heights as in the region', () => {
  const alone = heightsOf(['N21E106']);
  for (let lat = 21.0; lat <= 21.4; lat += 0.0123) {
    for (let lon = 106.0; lon < 106.3; lon += 0.0137) assert.equal(alone.at(lon, lat), both.at(lon, lat));
    assert.equal(alone.at(105.9, lat), null, 'no tile, no height');
  }
  // The land of Núi Trâu made with that tile alone is the land of the whole region there (away
  // from the roads, which come from Phù Đổng).
  const a = landOf(alone);
  const b = landOf(both);
  const ts = maps.find((m) => m.id === 'trau-son');
  let n = 0;
  for (let y = ts.window.y; y < ts.window.y + ts.height; y++) {
    for (let x = ts.window.x; x < ts.window.x + ts.width; x++) {
      const [lon] = b.warp.toGeo([x, y]);
      const c = b.cell(x, y);
      if (lon < 106.01 || c.road < 4) continue;
      assert.equal(a.cell(x, y).level, c.level, `${x},${y}`);
      n += 1;
    }
  }
  assert.ok(n > 5000, `${n} cells`);
});

test('Núi Trâu and the hill of Sóc Sơn rise several steps over Phù Đổng, by the fine data', () => {
  const L = landOf(both);
  const pd = anchor('Phù Đổng');
  const low = L.cell(...pd.cell).level;
  for (const a of [anchor('Núi Trâu'), anchor('Sóc Sơn')]) {
    // The height that the data gives at the real top, through the curve.
    const want = Math.round(def.base + stepsOf(both.at(...a.at), def.relief));
    const got = L.cell(...a.cell).level;
    assert.ok(Math.abs(got - want) <= 1, `${a.note}: ${got}, the data gives ${want}`);
    assert.ok(want - low >= 6, `${a.note}: ${want - low} steps over Phù Đổng`);
  }
  // The stamp of Sóc Sơn rose with its hill; the fields of Núi Trâu stay low, at the foot.
  assert.equal(L.lifts.length, 1);
  assert.equal(maps[L.lifts[0].map].id, 'soc-son');
  const ts = maps.find((m) => m.id === 'trau-son');
  const s = ts.stamps[0];
  assert.equal(L.cell(ts.window.x + s.x + 10, ts.window.y + s.y + 10).level, Number(s.height[10][10]));
});

test('slopes read as slopes: rock faces on the steep land, forest on the hills, paddies low or near a hamlet', () => {
  for (const seed of [1, 7]) {
    const L = landOf(both, seed);
    const { x0, y0, w, h } = L.box;
    let rock = 0;
    let terraces = 0;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const c = L.cell(x, y);
        if (!c) continue;
        if (c.letter === 'r') rock += 1;
        if (c.letter === 'f' && !c.stamp && c.level > def.base) {
          // A paddy over the low land is a terrace near a hamlet.
          terraces += 1;
          assert.ok(L.sites.some((s) => Math.hypot(Math.max(s.x - x, 0, x - s.x - s.w), Math.max(s.y - y, 0, y - s.y - s.h)) <= def.wet.terrace + 8), `${seed}: a paddy on the hill at ${x},${y}`);
        }
      }
    }
    assert.ok(rock > 30, `${seed}: ${rock} cells of rock face`);
  }
  // Trees stand close together on the hills.
  const ts = worldOf().map('trau-son', 1);
  const heightAt = (o) => parseInt(ts.layers.height[o.y][o.x], 36);
  const high = ts.layers.objects.filter((o) => o.gen && o.prop === 'tree' && heightAt(o) >= def.base + 3);
  assert.ok(high.length >= 10, `${high.length} trees on Núi Trâu`);
});

test('the soldiers come down a path from the top of Núi Trâu: the hero can walk it from the fields', async () => {
  const { createTileMap, findPath } = await import('../src/core/tilemap.js');
  const tiles = load('data/tiles.json').types;
  const top = anchor('Núi Trâu').cell;
  for (const seed of [1, 2, 3]) {
    const ts = worldOf().map('trau-son', seed);
    const t = createTileMap(ts, tiles);
    const goal = { x: top[0] - ts.window.x, y: top[1] - ts.window.y };
    const wall = load('data/raids.json').raids.boss.wall;
    const path = findPath(t, { x: wall[0], y: wall[1] }, goal, { maxNodes: 80000 });
    assert.ok(path, `${seed}: from the gate of the last raid to the top`);
    assert.ok(t.heightAt(goal.x, goal.y) - t.heightAt(wall[0], wall[1]) >= 6);
  }
});

test('the heights of the fine data keep the tops: the top of Núi Trâu is a hill, the delta is flat', () => {
  const h = createHeights(def.tiles.map((n) => parseHeightTile(readFileSync(new URL(`../data/geo/heights/${n}.bin`, import.meta.url)))));
  assert.ok(h.at(...anchor('Núi Trâu').at) > 90);
  assert.ok(h.at(...anchor('Sóc Sơn').at) > 200);
  assert.ok(stepsOf(h.at(...anchor('Phù Đổng').at), def.relief) < 0.5, 'Phù Đổng is on the flat delta');
});
