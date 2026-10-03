import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash2, valueNoise, fbm } from '../src/core/gen/noise.js';
import { TILE } from '../src/core/gen/tiles.js';
import { distanceField } from '../src/core/gen/geom.js';
import { stepsOf } from '../src/core/gen/heights.js';
import { createRng } from '../src/core/rng.js';
import { load, mapOf, worldOf } from './helpers.js';

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



test('a distance field gives the distance to the nearest source', () => {
  const w = 20;
  const h = 10;
  const f = distanceField(w, h, (i) => i === 3 * w + 4);
  assert.equal(f.dist[3 * w + 4], 0);
  assert.ok(Math.abs(f.dist[3 * w + 10] - 6) < 1e-6);
  assert.ok(Math.abs(f.dist[7 * w + 7] - 5) < 1e-6);
  assert.equal(f.near[9 * w + 19], 3 * w + 4);
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




// The land of the plane (src/core/gen/tiles.js): the tiles from Phù Đổng to Núi Trâu, and the
// tiles over the hill of Sóc Sơn.
const AREA = { tx: [145, 150], tz: [94, 97] };
const eachTile = (seed, fn) => {
  const m = mapOf('giong', seed);
  for (let tz = AREA.tz[0]; tz <= AREA.tz[1]; tz++) for (let tx = AREA.tx[0]; tx <= AREA.tx[1]; tx++) fn(m.land.tile(tx, tz), m);
};

test('the land keeps the stamps, and is the same for the same seed', () => {
  const m = mapOf('giong', 7);
  for (const s of m.land.stamps) {
    for (let y = 0; y < s.h; y += 3) for (let x = 0; x < s.w; x += 3) {
      const c = m.land.cell(s.x + x, s.y + y);
      assert.equal(c.stamp, true);
      assert.equal(c.letter, s.ground[y][x], `${s.place} at ${x},${y}`);
      assert.equal(c.level, parseInt(s.height[y][x], 36) + s.lift);
    }
  }
  const [px, py] = worldOf().at('trau-son', 100, 40);
  const t = m.land.tile(Math.floor(px / TILE), Math.floor(py / TILE));
  const other = mapOf('giong', 8).land.tile(t.tx, t.tz);
  assert.notDeepEqual([...other.level], [...t.level], 'another seed gives other land');
});

test('where the land is steeper than one step for each cell, it is a rock face; a road never is', () => {
  let rock = 0;
  for (const seed of [1]) {
    eachTile(seed, (t, m) => {
      const at = (x, y) => (x >= 0 && y >= 0 && x < TILE && y < TILE ? y * TILE + x : -1);
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
        const i = at(x, y);
        const ch = String.fromCharCode(t.letter[i]);
        if (ch === 'r') rock += 1;
        if (t.fixed[i] || !'.r'.includes(ch)) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = at(x + dx, y + dy);
          if (j >= 0 && t.level[j] <= t.level[i] - 2) assert.equal(ch, 'r', `seed ${seed}: a cliff at ${t.x0 + x},${t.z0 + y} is rock`);
        }
      }
    });
    // The line of each road goes one step at most from a cell to the next.
    for (const r of mapOf('giong', seed).land.roads) for (let k = 1; k < r.levels.length; k++) assert.ok(Math.abs(r.levels[k] - r.levels[k - 1]) <= 1, `seed ${seed}: road ${r.id} at ${k}`);
  }
  assert.ok(rock > 10, `rock faces on the hills: ${rock}`);
});

test('a road up a steep hill turns back and forth, one step at most for each cell', async () => {
  const { createLandPlane } = await import('../src/core/gen/tiles.js');
  const { createPlane, frameOrigins } = await import('../src/core/gen/plane.js');
  // A steep hill of 400 m around the cell 50, 0 of a frame, and a road from 0, 30 to its top.
  const def = {
    id: 'hill', plane: { origin: [102, 23.5], trueLat: 16, scale: 45 }, base: 2, relief: { low: 16, k: 0.8 },
    frames: [{ id: 'a', cell: [0, 0], at: [106.0, 21.05] }],
    roads: [{ id: 'up', width: 2, bend: 0, points: [['a', 0, 30], ['a', 50, 0]] }],
  };
  const plane = createPlane(def.plane);
  const [ox, oy] = frameOrigins(plane, def.frames).get('a');
  const heights = { at(lon, lat) { const [x, y] = plane.toCell([lon, lat]); return 10 + 400 * Math.exp(-((x - ox - 50) ** 2 + (y - oy) ** 2) / 60); } };
  const L = createLandPlane(def, [{ id: 'a', stamps: [] }], { rivers: [], heights }, 5);
  const { line, levels } = L.roads[0];
  const top = levels[levels.length - 1];
  assert.ok(top - levels[0] >= 10, `the road climbs ${top - levels[0]} steps`);
  for (let k = 1; k < levels.length; k++) assert.ok(Math.abs(levels[k] - levels[k - 1]) <= 1);
  let length = 0;
  for (let k = 1; k < line.length; k++) length += Math.hypot(line[k][0] - line[k - 1][0], line[k][1] - line[k - 1][1]);
  const straight = Math.hypot(50, 30);
  // A straight way climbs the last part of the hill faster than one step for each cell. (The line
  // is smooth: the zigzag of the cells of the route does not count in its length.)
  assert.ok(length > straight * 1.05, `the road is ${length.toFixed(0)} cells for ${straight.toFixed(0)}`);
  // The hero can walk the road: each cell of it is at most one step from the next.
  for (let k = 1; k < line.length; k++) {
    const a = L.cell(Math.floor(line[k - 1][0]), Math.floor(line[k - 1][1]));
    const b = L.cell(Math.floor(line[k][0]), Math.floor(line[k][1]));
    if (a.letter === '=' && b.letter === '=') assert.ok(Math.abs(a.level - b.level) <= 1);
  }
});

test('rice paddies lie in blocks of five with dikes, more on the low land near water', () => {
  let fields = 0;
  const near = [0, 0];
  const far = [0, 0];
  eachTile(1, (t) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const i = y * TILE + x;
      const ch = String.fromCharCode(t.letter[i]);
      if (!t.fixed[i] && t.level[i] <= 3 && !'~_'.includes(ch)) {
        const side = t.water[i] < 8 ? near : t.water[i] >= 16 ? far : null;
        if (side) {
          side[0] += ch === 'f' ? 1 : 0;
          side[1] += 1;
        }
      }
      if (ch !== 'f' || t.fixed[i]) continue;
      fields += 1;
      const gx = t.x0 + x;
      const gy = t.z0 + y;
      assert.ok(gx % 5 && gy % 5, 'a paddy is inside a block');
    }
  });
  assert.ok(fields > 500, `paddies: ${fields}`);
  assert.ok(near[0] / near[1] > far[0] / far[1], `more paddies near the water: ${near} ${far}`);
});

test('scatter: things follow their rules, keep a free cell around them, and come from the seed', () => {
  const rules = load('data/world/scatter.json');
  const cells = new Map();
  const objects = [];
  eachTile(3, (t) => objects.push(...t.objects.filter((o) => !o.id.startsWith('hamlet:'))));
  const m = mapOf('giong', 3);
  for (const o of objects) {
    const rule = rules.props.find((r) => r.prop === o.prop);
    assert.ok(rule, o.prop);
    for (let dy = 0; dy < o.h; dy++) for (let dx = 0; dx < o.w; dx++) {
      const c = m.land.cell(o.x + dx, o.y + dy);
      assert.ok((rule.on ?? ['.']).includes(c.letter) && !c.stamp, `${o.prop} at ${o.x + dx},${o.y + dy} on ${c.letter}`);
      cells.set(`${o.x + dx},${o.y + dy}`, o);
    }
  }
  // One free cell between two things.
  for (const o of objects) {
    for (let dy = -1; dy <= o.h; dy++) for (let dx = -1; dx <= o.w; dx++) {
      const other = cells.get(`${o.x + dx},${o.y + dy}`);
      assert.ok(!other || other === o, `${o.id} and ${other?.id}`);
    }
  }
  assert.ok(objects.some((o) => o.prop === 'bamboo') && objects.some((o) => o.prop === 'tree'));
  // Not in a grid: the things do not line up.
  const trees = objects.filter((o) => o.prop === 'tree');
  assert.ok(new Set(trees.map((o) => o.x % 5)).size >= 4 && new Set(trees.map((o) => o.y % 5)).size >= 4);
  // Another seed: other things.
  const others = [];
  eachTile(4, (t) => others.push(...t.objects));
  assert.notDeepEqual(others.slice(0, 20), objects.slice(0, 20));
});

test('hamlets: houses from parts around a yard near a road, a villager for each house, and no name', async () => {
  const { planeOf } = await import('./helpers.js');
  let hamlets = 0;
  const looks = new Set();
  for (const seed of [1]) {
    const { map, terrain } = planeOf(seed, { r: 0 });
    eachTile(seed, (t) => {
      for (const site of t.sites) {
        hamlets += 1;
        // A hamlet is never a historical place: no stamp, no trigger, no name.
        assert.ok(!map.land.cell(site.x, site.y).stamp);
        assert.ok(!map.layers.triggers.some((z) => z.x >= site.x && z.x < site.x + site.w && z.y >= site.y && z.y < site.y + site.h));
      }
      const houses = t.objects.filter((o) => o.id.startsWith('hamlet:') && (o.prop === 'house' || o.prop === 'hut'));
      for (const h of houses) terrain.chunk(Math.floor(h.x / 16), Math.floor(h.y / 16));
      for (const h of houses) assert.ok(terrain.homes[h.id], `${h.id} has a way in`);
      for (const v of t.villagers) {
        assert.ok(houses.some((h) => h.id === v.home), `${v.id}: a house`);
        assert.equal(map.land.cell(Math.floor(v.x), Math.floor(v.y)).letter, 'y', `${v.id} stands in the yard`);
        looks.add(JSON.stringify(v.look));
      }
    });
  }
  assert.ok(hamlets >= 3, `hamlets: ${hamlets}`);
  assert.ok(looks.size >= 8, 'the villagers look different');
});

test('hamlets: some houses have a round roof, and some hamlets a pond with a big jar', async () => {
  const { createGrid } = await import('../src/world/voxel.js');
  const { buildProp } = await import('../src/world/props/index.js');
  const shapes = { round: 0, boat: 0 };
  let ponds = 0;
  for (const seed of [1, 2, 3]) {
    eachTile(seed, (t, m) => {
      for (const h of t.objects.filter((o) => o.id.startsWith('hamlet:') && o.prop === 'house')) {
        const fine = createGrid(40, 64, 40, { owners: true });
        const r = buildProp({ fine, groundTop: () => 0, shadow: () => {} }, { kind: 'house', fx: 8, fz: 8, fw: 12, fd: 12, seed: h.seed, gen: true }, 1);
        shapes[r.roofs[0].shape === 'round' ? 'round' : 'boat'] += 1;
      }
      for (const jar of t.objects.filter((o) => o.id.startsWith('hamlet:') && o.prop === 'jar')) {
        ponds += 1;
        // The pond lies next to the jar, one step under the yard.
        let water = 0;
        for (let y = jar.y - 2; y < jar.y + 5; y++) for (let x = jar.x; x < jar.x + 7; x++) if (m.land.cell(x, y).letter === '~') water += 1;
        assert.ok(water >= 12, `a pond by the jar (${water} cells)`);
      }
    });
  }
  assert.ok(shapes.round >= 2 && shapes.boat >= 2, JSON.stringify(shapes));
  assert.ok(ponds >= 1, `ponds: ${ponds}`);
  // The houses of the stamps keep their look: never a round roof.
  const fine = createGrid(40, 64, 40, { owners: true });
  for (let seed = 1; seed < 20; seed++) assert.notEqual(buildProp({ fine, groundTop: () => 0, shadow: () => {} }, { kind: 'house', fx: 8, fz: 8, fw: 12, fd: 12, seed }, 1).roofs[0].shape, 'round');
});

test('villagers come from parts: valid looks, each seed its own people', async () => {
  const { villagerLook } = await import('../src/core/gen/people.js');
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

test('the south edge of the land of the era follows the Hoành Sơn range: not a straight row, and the land rises to it', () => {
  const m = mapOf('giong', 1);
  const plane = m.land.plane;
  const cellOf = (x, y) => {
    const t = m.land.tile(Math.floor(x / TILE), Math.floor(y / TILE));
    const i = (y - t.z0) * TILE + (x - t.x0);
    return { mist: t.mist[i], level: t.level[i], letter: String.fromCharCode(t.letter[i]) };
  };
  const rows = [];
  for (const lon of [106.0, 106.2, 106.35]) {
    const [x, y0] = plane.toCell([lon, 18.4]).map(Math.floor);
    let y = y0;
    while (cellOf(x, y).mist === 0 && y < y0 + 2000) y++;
    const lat = plane.toGeo([x, y])[1];
    assert.ok(lat > 17.6 && lat < 18.3, `the mist at ${lon} E starts at ${lat.toFixed(2)} N`);
    // The land rises to the mountains: the edge is higher than the land a little to the north.
    const north = cellOf(x, y - 40).level;
    const edge = Math.max(...[0, 2, 4, 6].map((d) => cellOf(x, y + d).level));
    rows.push({ lon, y, north, edge });
  }
  const ys = rows.map((r) => r.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 10, `the edge is not one row: ${ys.join(', ')}`);
  assert.ok(rows.filter((r) => r.edge > r.north).length >= 2, `the land rises to the edge: ${JSON.stringify(rows)}`);
});

test('the land knows the land of another country (for the line at the mist of another land)', () => {
  const m = mapOf('giong', 1);
  const at = (lon, lat) => m.land.plane.toCell([lon, lat]);
  assert.equal(m.land.foreignAt(...at(103.2, 19.4)), true, 'Laos');
  assert.equal(m.land.foreignAt(...at(105.0, 23.2)), true, 'China');
  assert.equal(m.land.foreignAt(...at(105.85, 21.03)), false, 'Hà Nội');
  assert.equal(m.land.foreignAt(...at(107.5, 20.0)), false, 'the sea');
});

test('a road over a river: a ford over a small river, a bamboo bridge over a middle one, and a ferry over a big one', async () => {
  const { createLandPlane, CROSSING } = await import('../src/core/gen/tiles.js');
  const { createPlane } = await import('../src/core/gen/plane.js');
  const planeDef = { origin: [102, 23.5], trueLat: 16, scale: 45 };
  const plane = createPlane(planeDef);
  const lons = [105.0, 105.03, 105.07];
  const widths = [CROSSING.ford - 2, CROSSING.ford + 4, CROSSING.ferry + 6];
  const rivers = lons.map((lon, i) => ({ id: `r${i}`, lines: [[[lon, 21.15], [lon, 20.85]]] }));
  const [x0, y] = plane.toCell([104.97, 21.0]).map(Math.round);
  const [x1] = plane.toCell([105.1, 21.0]).map(Math.round);
  const def = {
    id: 'test',
    plane: planeDef,
    rivers: widths.map((w, i) => ({ id: `r${i}`, water: w, bank: 2, bend: 0 })),
    roads: [{ id: 'x', width: 4, bend: 0, points: [[null, x0, y], [null, x1, y]] }],
  };
  const land = createLandPlane(def, [], { rivers, heights: null }, 1);
  const letterAt = (x, yy) => {
    const t = land.tile(Math.floor(x / TILE), Math.floor(yy / TILE));
    return String.fromCharCode(t.letter[(yy - t.z0) * TILE + (x - t.x0)]);
  };
  // The cells of the road over each river.
  const road = land.roads[0].line.map(([x, yy]) => [Math.floor(x), Math.floor(yy)]);
  const over = lons.map((lon) => {
    const rx = Math.round(plane.toCell([lon, 21.0])[0]);
    return road.filter(([x]) => Math.abs(x - rx) <= 1).map(([x, yy]) => letterAt(x, yy));
  });
  assert.ok(over[0].length && over[0].every((c) => c === 's'), `a ford: ${over[0].join('')}`);
  assert.ok(over[1].length && over[1].every((c) => c === 'k'), `a bamboo bridge: ${over[1].join('')}`);
  assert.ok(over[2].length && over[2].every((c) => c === '~'), `the water of a ferry: ${over[2].join('')}`);
  // One ferry, over the big river: its boat on the water, the landings on the land beside it.
  assert.equal(land.ferries.length, 1);
  const f = land.ferries[0];
  assert.equal(f.river, 'r2');
  assert.equal(letterAt(Math.floor(f.a.x), Math.floor(f.a.y)), '~');
  assert.equal(letterAt(Math.floor(f.b.x), Math.floor(f.b.y)), '~');
  for (const q of [f.landA, f.landB, f.stepA, f.stepB]) assert.notEqual(letterAt(Math.floor(q.x), Math.floor(q.y)), '~');
});
