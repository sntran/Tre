import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/world/regions.js';
import { load, worldOf } from './helpers.js';

const world = load('data/world/regions.json');
const maps = new Map(world.regions.flatMap((r) => r.maps).map((id) => [id, load(`data/maps/${id}.json`)]));
const vi = load('i18n/vi.json');
const en = load('i18n/en.json');

test('the world has 13 regions, one for each story chapter, in history order', () => {
  assert.equal(world.regions.length, 13);
  assert.deepEqual(world.regions.map((r) => r.chapter), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  assert.equal(new Set(world.regions.map((r) => r.id)).size, 13);
  for (const r of world.regions) assert.ok(r.nameKey in vi && r.nameKey in en, `${r.id}: name`);
  // Only the region of Thánh Gióng is built now. It has 3 to 6 maps.
  const built = world.regions.filter((r) => r.maps.length);
  assert.deepEqual(built.map((r) => r.id), ['giong']);
  for (const r of built) assert.ok(r.maps.length >= 3 && r.maps.length <= 6, r.id);
});

test('the name of the era comes from the region of the map', () => {
  const w = createWorld(world, maps);
  for (const r of world.regions.filter((x) => x.maps.length)) assert.ok(r.eraKey in vi && r.eraKey in en, `${r.id}: era`);
  assert.equal(w.eraOf('soc-son'), 'era.hung-vuong');
  assert.equal(w.eraOf(undefined), w.region(world.start.region).eraKey, 'an unknown map: the start region');
});

test('each place belongs to its region, and each region with places is open; the others are locked', () => {
  const w = createWorld(world, maps);
  for (const [id, m] of maps) {
    assert.equal(m.region, w.regionOf(id), id);
    assert.ok(m.nameKey in vi && m.nameKey in en, `${id}: name`);
    assert.equal(w.map(id).id, 'giong', `${id}: a place of the map of its region`);
  }
  assert.equal(w.isOpen('giong', { flags: {} }), true);
  for (const r of world.regions.filter((x) => x.id !== 'giong')) assert.equal(w.isOpen(r.id, { flags: {} }), false, r.id);
  assert.equal(w.regionOf(w.start.map), w.start.region);
  // The entry after a travel is a cell of the plane in the frame of a place.
  const [ex, ey] = w.at(...w.region('giong').entry.at);
  assert.deepEqual(w.entryOf('giong'), { map: 'giong', x: ex, y: ey });
});

test('the people, enemies, and things of the story are each in one place, with one id', () => {
  const w = createWorld(world, maps);
  assert.equal(w.whereIs('npc', 'fisher'), 'giong');
  assert.equal(w.whereIs('npc', 'giong-sky'), 'giong');
  assert.equal(w.whereIs('encounter', 'boss'), 'giong');
  assert.equal(w.whereIs('object', 'ore1'), 'giong');
  assert.equal(w.whereIs('npc', 'nobody'), null);
  const seen = new Map();
  for (const [id, m] of maps) {
    for (const x of [...m.npcs, ...m.encounters]) {
      assert.ok(!seen.has(x.id), `${x.id} is in ${seen.get(x.id)} and ${id}`);
      seen.set(x.id, id);
    }
  }
  // An id that two places use gets the id of its place in front in the later place.
  const m = w.map('giong');
  for (const kind of ['objects', 'triggers', 'zones']) {
    const ids = m.layers[kind].map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length, `${kind}: one of each id`);
  }
  assert.ok(m.layers.objects.some((o) => o.id === 'tree1' && o.place === 'phu-dong'));
  assert.ok(m.layers.objects.some((o) => o.id === 'soc-son:tree1' && o.place === 'soc-son'));
});

test('the travel time between regions follows the real roads and rivers', () => {
  const geo = load('data/geo/vietnam.json');
  const routes = load('data/world/routes.json');
  const w = createWorld(world, maps, { routes, places: geo.places });
  assert.equal(w.travelHours('giong', 'giong'), 0);
  // Phù Đổng to Thăng Long is about 15 km on the road: about 4 hours on foot.
  const near = w.travelWay('giong', 'thang-long');
  assert.ok(near.km > 12 && near.km < 25, `${near.km}`);
  assert.ok(w.travelHours('giong', 'thang-long') >= 3 && w.travelHours('giong', 'thang-long') <= 7);
  // To the south, the way is long: many days on the road.
  assert.ok(w.travelHours('giong', 'gia-dinh') > 24 * 20);
  // Each region can be reached, and the time is the same both ways.
  for (const r of world.regions) {
    assert.ok(Number.isFinite(w.travelHours('giong', r.id)), r.id);
    assert.equal(w.travelHours('giong', r.id), w.travelHours(r.id, 'giong'), r.id);
  }
});

test('the places are frames on one plane: their stamps do not overlap, and the land goes on at their edges', () => {
  const w = worldOf();
  for (const seed of [1, 99]) {
    const m = w.map('giong', seed);
    const stamps = m.land.stamps;
    for (const a of stamps) {
      for (const b of stamps) {
        if (a === b) continue;
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        assert.ok(apart || a.place === b.place, `${a.place} and ${b.place} overlap`);
      }
      // Along the edge of a stamp, the land outside is one step from the stamp at most, where both
      // are land: no cliff of blocks at an edge.
      const edge = [];
      for (let x = a.x; x < a.x + a.w; x++) edge.push([x, a.y, 0, -1], [x, a.y + a.h - 1, 0, 1]);
      for (let y = a.y; y < a.y + a.h; y++) edge.push([a.x, y, -1, 0], [a.x + a.w - 1, y, 1, 0]);
      let cliffs = 0;
      for (const [x, y, dx, dy] of edge) {
        const inside = m.land.cell(x, y);
        const out = m.land.cell(x + dx, y + dy);
        if (out.stamp || '~fhlBdsr_'.includes(inside.letter) || '~fhlBdsr_'.includes(out.letter)) continue;
        if (Math.abs(inside.level - out.level) > 1) cliffs += 1;
      }
      assert.ok(cliffs <= edge.length * 0.02, `${seed} ${a.place}: ${cliffs} cliffs at the edge of a stamp`);
    }
  }
});

test('the hero can walk from Phù Đổng to Núi Trâu, to Văn Miếu, and to Sóc Sơn on the plane, for any seed', async () => {
  const { findPath, createPlaneTileMap } = await import('../src/core/tilemap.js');
  const tiles = load('data/tiles.json').types;
  const w = worldOf();
  const cell = (p) => ({ x: Math.floor(p[0]), y: Math.floor(p[1]) });
  const zoneCells = (z) => {
    const out = [];
    for (let y = z.y; y < z.y + z.h; y++) for (let x = z.x; x < z.x + z.w; x++) out.push({ x, y });
    return out;
  };
  for (const seed of [1, 7]) {
    const m = w.map('giong', seed);
    const t = createPlaneTileMap(m, tiles);
    const walk = (from, cells) => cells.some((c) => t.walkable(c.x, c.y) && findPath(t, from, c, { maxNodes: 400000 }));
    const start = cell([m.spawn.x, m.spawn.y]);
    // East, through the generated land to the fields of Núi Trâu.
    const wall = load('data/raids.json').raids.soldier1.wall;
    assert.ok(walk(start, [cell(w.at('trau-son', ...wall))]), `${seed}: to the fields of Núi Trâu`);
    // South-west: over the ford, through the land to the ferry; from its landing to Văn Miếu.
    const ferry = m.layers.triggers.find((z) => z.id === 'ferry-east');
    assert.ok(walk(start, zoneCells(ferry)), `${seed}: through the land to the ferry`);
    const gate = m.layers.triggers.find((z) => z.id === 'vanmieu');
    assert.ok(walk(cell([ferry.action.move.x, ferry.action.move.y]), zoneCells(gate)), `${seed}: from the ferry to Văn Miếu`);
    // North: to the hill of Sóc Sơn.
    const sky = m.npcs.find((n) => n.id === 'giong-sky');
    assert.ok(walk(start, [{ x: Math.floor(sky.x), y: Math.floor(sky.y) + 1 }]), `${seed}: through the land to the top of Sóc Sơn`);
  }
});

test('the story places stand at their real places on the plane: the directions from Phù Đổng are the real ones', () => {
  const land = load('data/world/land-giong.json');
  const w = worldOf();
  const [home, ...others] = land.frames;
  const deg = (r) => (r * 180) / Math.PI;
  const h = w.at(home.id, ...home.cell);
  for (const f of others) {
    const p = w.at(f.id, ...f.cell);
    const ex = (f.at[0] - home.at[0]) * 104;
    const ey = (home.at[1] - f.at[1]) * 110.6;
    let diff = Math.abs(deg(Math.atan2(p[1] - h[1], p[0] - h[0])) - deg(Math.atan2(ey, ex)));
    if (diff > 180) diff = 360 - diff;
    assert.ok(diff < 2, `${f.id}: ${diff.toFixed(1)} degrees off`);
  }
});
