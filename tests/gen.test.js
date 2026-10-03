import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash2, valueNoise, fbm } from '../src/core/gen/noise.js';
import { createWarp } from '../src/core/gen/warp.js';
import { localSamples, scatter, fits } from '../src/core/gen/scatter.js';
import { createLand, distanceField } from '../src/core/gen/land.js';
import { stepsOf } from '../src/core/gen/heights.js';
import { createRng } from '../src/core/rng.js';

test('noise: the same seed and point give the same value, in its range', () => {
  for (let i = 0; i < 200; i++) {
    const x = i * 3.7;
    const y = i * 1.3;
    const v = valueNoise(5, x, y, 8);
    assert.ok(v >= 0 && v <= 1);
    assert.equal(v, valueNoise(5, x, y, 8));
    const f = fbm(5, x, y);
    assert.ok(f >= -1 && f <= 1);
  }
  let same = 0;
  for (let i = 0; i < 100; i++) if (hash2(1, i, 2 * i) === hash2(2, i, 2 * i)) same += 1;
  assert.ok(same < 3, 'another seed gives other values');
  // Smooth: near points have near values.
  assert.ok(Math.abs(valueNoise(9, 10, 10, 16) - valueNoise(9, 10.1, 10, 16)) < 0.05);
});

test('the warp goes through its anchors and is smooth between them', () => {
  const anchors = [
    { cell: [0, 0], at: [105.95, 21.06] },
    { cell: [200, -40], at: [106.1, 21.13] },
    { cell: [-20, -150], at: [105.83, 21.27] },
    { cell: [-160, 40], at: [105.84, 21.03] },
    { cell: [40, 30], at: [105.966, 21.054] },
  ];
  const w = createWarp(anchors);
  for (const a of anchors) {
    const c = w.toCell(a.at);
    assert.ok(Math.hypot(c[0] - a.cell[0], c[1] - a.cell[1]) < 1e-6, 'exact at an anchor');
    const g = w.toGeo(a.cell);
    assert.ok(Math.hypot(g[0] - a.at[0], g[1] - a.at[1]) < 1e-9);
  }
  // East is +x and north is -y between the anchors too.
  const p = w.toCell([106.0, 21.1]);
  const q = w.toCell([106.02, 21.1]);
  const r = w.toCell([106.0, 21.12]);
  assert.ok(q[0] > p[0], 'east');
  assert.ok(r[1] < p[1], 'north');
  // There and back comes near the start.
  const back = w.toGeo(w.toCell([106.0, 21.1]));
  assert.ok(Math.hypot(back[0] - 106.0, back[1] - 21.1) < 0.01);
  assert.throws(() => createWarp(anchors.slice(0, 2)));
});

test('local samples: no two nearer than the spacing, seeded, never in a grid, and the same in any part of the land', () => {
  const ok = (x, y) => (x * 7 + y * 3) % 11 !== 0; // a few cells where nothing may stand
  const a = localSamples(120, 90, 6, ok, 3);
  assert.deepEqual(localSamples(120, 90, 6, ok, 3), a, 'the same seed gives the same samples');
  assert.notDeepEqual(localSamples(120, 90, 6, ok, 4), a);
  assert.ok(a.length > 60, `the box is full: ${a.length}`);
  for (const [x, y] of a) assert.ok(ok(x, y));
  let min = Infinity;
  const nearest = [];
  for (const p of a) {
    let n = Infinity;
    for (const q of a) if (p !== q) n = Math.min(n, Math.hypot(p[0] - q[0], p[1] - q[1]));
    min = Math.min(min, n);
    nearest.push(n);
  }
  assert.ok(min >= 6 - 1e-9);
  // Not a grid: the nearest distances vary, and the samples do not line up.
  const mean = nearest.reduce((s, v) => s + v, 0) / nearest.length;
  const sd = Math.sqrt(nearest.reduce((s, v) => s + (v - mean) ** 2, 0) / nearest.length);
  assert.ok(sd / mean > 0.05, 'the spacing varies');
  for (const k of [0, 1]) assert.equal(new Set(a.map((p) => p[k] % 6)).size, 6, 'the samples do not line up');
  // Local: a part of the land made alone (a box at 30, 20 on the plane) has the same samples,
  // away from its edges.
  const part = localSamples(60, 50, 6, (x, y) => ok(x + 30, y + 20), 3, 30, 20).map(([x, y]) => [x + 30, y + 20]);
  const inner = ([x, y]) => x >= 30 + 6 && y >= 20 + 6 && x < 90 - 6 && y < 70 - 6;
  const key = (p) => p.join(',');
  assert.deepEqual(part.filter(inner).map(key).sort(), a.filter(inner).map(key).sort());
  assert.ok(part.filter(inner).length > 10);
});

test('a distance field gives the distance to the nearest source', () => {
  const w = 20;
  const h = 10;
  const f = distanceField(w, h, (i) => i === 3 * w + 4);
  assert.equal(f.dist[3 * w + 4], 0);
  assert.ok(Math.abs(f.dist[3 * w + 10] - 6) < 1e-6);
  assert.ok(Math.abs(f.dist[7 * w + 7] - 5) < 1e-6);
  assert.equal(f.near[9 * w + 19], 3 * w + 4);
});

// A small region for the tests: two maps side by side, a stamp of grass with a pond in the
// first, a river from the real data through the second, a road across the edge, and a steep hill
// of 400 m in the second map (around the cell 115, 12).
const anchors = [{ cell: [16, 16], at: [106.0, 21.05] }, { cell: [100, 0], at: [106.02, 21.1] }, { cell: [100, 50], at: [106.02, 21.0] }];
const hillWarp = createWarp(anchors);
const heights = {
  at(lon, lat) {
    const [x, y] = hillWarp.toCell([lon, lat]);
    return 10 + 400 * Math.exp(-((x - 115) ** 2 + (y - 12) ** 2) / 60);
  },
};
const geo = { heights, rivers: [{ id: 'r', lines: [[[106.02, 21.2], [106.02, 20.9]]] }] };
const stampRows = (w, h) => ({ ground: Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (x > 3 && x < 8 && y > 3 && y < 8 ? '~' : '.')).join('')), height: Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (x > 3 && x < 8 && y > 3 && y < 8 ? '0' : '2')).join('')) });
const maps = [
  { id: 'a', window: { x: 0, y: 0 }, width: 60, height: 50, stamps: [{ x: 10, y: 10, w: 12, h: 12, ...stampRows(12, 12) }], layers: { objects: [] } },
  { id: 'b', window: { x: 60, y: 0 }, width: 70, height: 50, stamps: [], layers: { objects: [] } },
];
const land = {
  id: 't',
  base: 2,
  anchors,
  rivers: [{ id: 'r', water: 6, bank: 2, bend: 2 }],
  roads: [{ id: 'x', width: 4, points: [[22, 16], [60, 20], [85, 30], [125, 30]] }],
  relief: { low: 16, k: 0.8 },
};

test('the land keeps the stamps, follows the real river, and is the same for the same seed', () => {
  const L = createLand(land, maps, geo, 7);
  // The stamp stays.
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    const c = L.cell(10 + x, 10 + y);
    assert.equal(c.stamp, true);
    assert.equal(c.letter, maps[0].stamps[0].ground[y][x]);
    assert.equal(String(c.level), maps[0].stamps[0].height[y][x]);
  }
  // The river from the real line: water near x 100, from the top to the bottom of map b.
  for (let y = 5; y < 45; y += 5) {
    let water = 0;
    for (let x = 60; x < 130; x++) if ('~B'.includes(L.cell(x, y).letter)) water += 1;
    assert.ok(water >= 3 && water <= 9, `a river ${water} cells wide at y ${y}`);
  }
  // The road joins the stamp across the edge between the maps.
  const road = (x, y) => ['=', 'B'].includes(L.cell(x, y).letter);
  assert.ok(road(23, 16) && road(59, 20) && road(60, 20), 'the road crosses the edge');
  const bridge = [];
  for (let y = 20; y < 40; y++) for (let x = 90; x < 110; x++) if (L.cell(x, y).letter === 'B') bridge.push([x, y]);
  assert.ok(bridge.length > 4, 'a road over a river is a bridge');
  // The same seed gives the same land; another seed gives other land.
  const again = createLand(land, maps, geo, 7);
  const other = createLand(land, maps, geo, 8);
  assert.deepEqual(again.rows(maps[1]), L.rows(maps[1]));
  assert.notDeepEqual(other.rows(maps[1]).height, L.rows(maps[1]).height);
});

test('where the land is steeper than one step for each cell, it is a rock face; a road never is', () => {
  let rock = 0;
  for (const seed of [1, 2, 3]) {
    const L = createLand(land, maps, geo, seed);
    for (let y = 0; y < 50; y++) for (let x = 0; x < 130; x++) {
      const a = L.cell(x, y);
      if (a.letter === 'r') rock += 1;
      if (a.stamp || a.edge || a.taken || !'.r'.includes(a.letter)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const b = L.cell(x + dx, y + dy);
        if (b && b.level <= a.level - 2) assert.equal(a.letter, 'r', `seed ${seed}: a cliff at ${x},${y} is rock`);
      }
    }
    // The line of each road goes one step at most from a cell to the next.
    for (const r of L.roads) for (let k = 1; k < r.levels.length; k++) assert.ok(Math.abs(r.levels[k] - r.levels[k - 1]) <= 1, `seed ${seed}: road ${r.id} at ${k}`);
  }
  assert.ok(rock > 20, `rock faces on the steep hill: ${rock}`);
});

test('a road up a steep hill turns back and forth, one step at most for each cell', () => {
  const up = { ...land, roads: [{ id: 'up', width: 2, bend: 0, points: [[66, 44], [115, 12]] }] };
  const L = createLand(up, maps, geo, 5);
  const { line, levels } = L.roads[0];
  const top = levels[levels.length - 1];
  assert.ok(top - levels[0] >= 10, `the road climbs ${top - levels[0]} steps`);
  for (let k = 1; k < levels.length; k++) assert.ok(Math.abs(levels[k] - levels[k - 1]) <= 1);
  let length = 0;
  for (let k = 1; k < line.length; k++) length += Math.hypot(line[k][0] - line[k - 1][0], line[k][1] - line[k - 1][1]);
  const straight = Math.hypot(115 - 66, 12 - 44);
  // A straight way climbs the last part of the hill faster than one step for each cell.
  assert.ok(length > straight * 1.15, `the road is ${length.toFixed(0)} cells for ${straight.toFixed(0)}`);
  // The hero can walk the road: each cell of it is at most one step from the next.
  for (let k = 1; k < line.length; k++) {
    const a = L.cell(Math.floor(line[k - 1][0]), Math.floor(line[k - 1][1]));
    const b = L.cell(Math.floor(line[k][0]), Math.floor(line[k][1]));
    if (a.letter === '=' && b.letter === '=') assert.ok(Math.abs(a.level - b.level) <= 1);
  }
});

test('the height curve: the low land is flat, a hill of 100 m is about 8 steps, a mountain of 1,300 m about 29', () => {
  const relief = { low: 16, k: 0.8 };
  assert.equal(stepsOf(5, relief), 0);
  assert.equal(stepsOf(16, relief), 0);
  assert.ok(Math.abs(stepsOf(116, relief) - 8) < 0.01);
  assert.ok(Math.abs(stepsOf(1316, relief) - 29) < 0.2);
  // Concave: each 100 m more gives fewer steps.
  let last = Infinity;
  for (let m = 116; m < 3000; m += 100) {
    const d = stepsOf(m + 100, relief) - stepsOf(m, relief);
    assert.ok(d > 0 && d < last);
    last = d;
  }
});

test('the land rises where the real land is high, and the closed edges of a map rise', () => {
  const L = createLand(land, maps, geo, 7);
  // The top of the hill: its height comes from the real height and the curve.
  const top = L.cell(115, 12);
  assert.equal(top.level, Math.round(2 + stepsOf(heights.at(...L.warp.toGeo([115.5, 12.5])), land.relief)));
  assert.ok(top.level >= 15, `the top is ${top.level}`);
  // The low land stays at the base.
  assert.equal(L.cell(70, 45).level, 2);
  // The north edge of map a is closed (no map there): it is higher than the land inside.
  let up = 0;
  let n = 0;
  for (let x = 25; x < 55; x++) {
    const edge = L.cell(x, 0);
    const inside = L.cell(x, 4);
    if (edge.letter !== '.' || inside.letter !== '.') continue;
    n += 1;
    if (edge.level > inside.level) up += 1;
  }
  assert.ok(n > 5 && up / n > 0.8, `${up} of ${n}`);
  // The edge between a and b is open: no rise there.
  assert.equal(L.cell(59, 40).edge, false);
});

test('rice paddies lie in blocks of five with dikes, on low wet land, as terraces on a slope', () => {
  let fields = 0;
  const near = [0, 0];
  const far = [0, 0];
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    const L = createLand(land, maps, geo, seed);
    for (let y = 0; y < 50; y++) for (let x = 0; x < 130; x++) {
      const c = L.cell(x, y);
      // On the low land west of the river (the hill is east of it): more paddies near the water.
      if (!c.stamp && c.letter !== '~' && c.letter !== '_' && x < 94) {
        const side = c.water < 12 ? near : c.water > 30 ? far : null;
        if (side) {
          side[0] += c.letter === 'f' ? 1 : 0;
          side[1] += 1;
        }
      }
      if (c.letter !== 'f') continue;
      fields += 1;
      assert.ok(x % 5 && y % 5, 'a paddy is inside a block');
      const dike = L.cell(x - (x % 5), y);
      assert.equal(dike.letter, 'd');
      assert.ok(dike.level >= c.level + 1, 'the dike is over the paddy');
    }
  }
  assert.ok(fields > 50, `paddies: ${fields}`);
  assert.ok(near[0] / near[1] > far[0] / far[1], 'more paddies near the water');
});

test('scatter: things follow their rules, keep a free cell around them, and come from the seed', () => {
  const L = createLand(land, maps, geo, 7);
  const rules = {
    margin: 3,
    props: [
      { prop: 'bamboo', spacing: 4, size: 2, on: ['.'], water: [2, 8] },
      { prop: 'tree', spacing: 5, size: 2, on: ['.'], water: [6, 999], road: [2, 999] },
      { prop: 'rock', spacing: 7, size: 2, on: ['.'], level: [3, 9] },
    ],
    life: [{ kind: 'duck', spacing: 10, n: [2, 3], r: 2, on: ['~'] }],
  };
  const a = scatter(L, rules, maps, 7);
  assert.deepEqual(scatter(L, rules, maps, 7), a, 'the same seed');
  assert.notDeepEqual(scatter(L, rules, maps, 8).objects, a.objects, 'another seed');
  assert.ok(a.objects.some((o) => o.prop === 'bamboo') && a.objects.some((o) => o.prop === 'tree'));
  const cells = new Map();
  for (const o of a.objects) {
    const rule = rules.props.find((r) => r.prop === o.prop);
    const m = maps[o.map];
    for (let dy = 0; dy < o.h; dy++) for (let dx = 0; dx < o.w; dx++) {
      const c = L.cell(o.x + dx, o.y + dy);
      assert.ok(fits(rule, c), `${o.prop} at ${o.x + dx},${o.y + dy}`);
      assert.equal(c.map, o.map, 'in one map');
      assert.ok(o.x + dx >= m.window.x + 3 && o.x + dx < m.window.x + m.width - 3, 'off the edge');
      cells.set(`${o.x + dx},${o.y + dy}`, o);
    }
  }
  // One free cell between two things.
  for (const o of a.objects) {
    for (let dy = -1; dy <= o.h; dy++) for (let dx = -1; dx <= o.w; dx++) {
      const other = cells.get(`${o.x + dx},${o.y + dy}`);
      assert.ok(!other || other === o);
    }
  }
  // Bamboo grows near water; ducks swim.
  for (const o of a.objects.filter((x) => x.prop === 'bamboo')) assert.ok(L.cell(o.x, o.y).water <= 8);
  for (const g of a.life) assert.equal(L.cell(Math.floor(g.x), Math.floor(g.y)).letter, '~');
  // Not in a grid: the things do not line up.
  const trees = a.objects.filter((o) => o.prop === 'tree');
  assert.ok(new Set(trees.map((o) => o.x % 5)).size >= 4 && new Set(trees.map((o) => o.y % 5)).size >= 4);
});

test('villagers come from parts: valid looks, each seed its own people', async () => {
  const { villagerLook } = await import('../src/core/gen/people.js');
  const { load } = await import('./helpers.js');
  const { colorIndex } = await import('../src/world/voxel.js');
  const parts = load('data/figures.json').villagers;
  const seen = new Set();
  for (let s = 1; s <= 60; s++) {
    const look = villagerLook(createRng(s), parts);
    for (const k of ['skin', 'top', 'bottom', 'sash']) assert.ok(colorIndex(look[k]) > 0, `${k} ${look[k]}`);
    assert.ok(['shirt'].includes(look.topKind));
    assert.ok(Object.values(parts.bodies).some((b) => b.hairs.includes(look.hair)) || look.hair === 'grey');
    if (look.child) assert.equal(look.item, undefined, 'a child carries nothing');
    seen.add(JSON.stringify(look));
  }
  assert.ok(seen.size > 50, `${seen.size} different villagers in 60`);
  assert.deepEqual(villagerLook(createRng(9), parts), villagerLook(createRng(9), parts));
});

test('hamlets: houses from parts around a yard near a road, a villager for each house, and no name', async () => {
  const { mapOf } = await import('./helpers.js');
  const { createTileMap } = await import('../src/core/tilemap.js');
  const { buildTerrain } = await import('../src/world/terrain.js');
  const { load } = await import('./helpers.js');
  const tiles = load('data/tiles.json').types;
  let hamlets = 0;
  const looks = new Set();
  for (const seed of [1, 2, 3]) {
    for (const id of ['phu-dong', 'soc-son', 'trau-son', 'road-thanglong']) {
      const m = mapOf(id, seed);
      const def = load(`data/maps/${id}.json`);
      const houses = m.layers.objects.filter((o) => o.id.startsWith('hamlet:') && (o.prop === 'house' || o.prop === 'hut'));
      if (!houses.length) continue;
      hamlets += 1;
      const terrain = buildTerrain(m, tiles, createTileMap(m, tiles));
      // A generated place has no name, no talk, and no trigger: it is never a historical place.
      assert.deepEqual(m.layers.triggers, def.layers.triggers);
      assert.deepEqual(m.layers.places, def.layers.places);
      assert.equal(m.nameKey, def.nameKey);
      for (const h of houses) {
        assert.ok(terrain.homes[h.id], `${id}: ${h.id} has a way in`);
        for (const s of def.stamps) assert.ok(h.x + h.w <= s.x || h.x >= s.x + s.w || h.y + h.h <= s.y || h.y >= s.y + s.h, 'not on a stamp');
      }
      for (const v of m.layers.villagers) {
        assert.ok(terrain.homes[v.home], `${v.id}: a house`);
        assert.equal(m.layers.ground[Math.floor(v.y)][Math.floor(v.x)], 'y', `${v.id} stands in the yard`);
        looks.add(JSON.stringify(m.looks[v.id]));
      }
    }
  }
  assert.ok(hamlets >= 4, `hamlets: ${hamlets}`);
  assert.ok(looks.size >= 8, 'the villagers look different');
});

test('a house from parts: the seed changes its colors and things, never its size or its way in', async () => {
  const { createGrid } = await import('../src/world/voxel.js');
  const { buildProp } = await import('../src/world/props/index.js');
  const build = (seed) => {
    const fine = createGrid(40, 64, 40, { owners: true });
    const r = buildProp({ fine, groundTop: () => 0, shadow: () => {} }, { kind: 'house', fx: 8, fz: 8, fw: 12, fd: 12, seed }, 1);
    return { r, colors: new Set(Array.from(fine.data).filter(Boolean)).size, data: Array.from(fine.data).join(',') };
  };
  const a = build(1);
  assert.equal(build(1).data, a.data, 'the same seed builds the same house');
  const ways = new Set();
  const looks = new Set();
  for (let s = 1; s <= 12; s++) {
    const b = build(s);
    ways.add(JSON.stringify(b.r.info.home));
    looks.add(b.data);
  }
  assert.ok(looks.size >= 10, 'the houses differ');
  assert.ok(ways.size <= 2, 'the way in stays (the posts are 6 or 7 high)');
});
