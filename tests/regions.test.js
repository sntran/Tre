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

test('each map belongs to its region, and each region with maps is open; the others are locked', () => {
  const w = createWorld(world, maps);
  for (const [id, m] of maps) {
    assert.equal(m.region, w.regionOf(id), id);
    assert.ok(m.nameKey in vi && m.nameKey in en, `${id}: name`);
  }
  assert.equal(w.isOpen('giong', { flags: {} }), true);
  for (const r of world.regions.filter((x) => x.id !== 'giong')) assert.equal(w.isOpen(r.id, { flags: {} }), false, r.id);
  assert.equal(w.regionOf(w.start.map), w.start.region);
  const entry = w.region('giong').entry;
  assert.ok(maps.get(entry.map), 'the entry map exists');
});

test('each map of a region can be reached from each other map, through the exits', () => {
  const w = createWorld(world, maps);
  for (const r of world.regions) {
    for (const a of r.maps) {
      for (const b of r.maps) {
        if (a === b) continue;
        assert.ok(w.firstExit(a, b), `${a} to ${b}`);
      }
    }
  }
  // From Sóc Sơn to Núi Trâu, the way goes through the village.
  assert.equal(w.firstExit('soc-son', 'trau-son').to.map, 'phu-dong');
  assert.equal(w.firstExit('phu-dong', 'road-thanglong').id, 'west:road-thanglong');
  assert.equal(w.firstExit('phu-dong', 'phu-dong'), null);
});

test('an exit sends the hero to the next map, and keeps the position along the edge', () => {
  const w = createWorld(world, maps);
  // Sóc Sơn lies over the north edge of Phù Đổng, 56 cells further west on the plane.
  const north = w.exitAt('phu-dong', 45, 0, { flags: {} });
  assert.equal(north.to.map, 'soc-son');
  assert.deepEqual(w.arrival(north, 45, 0.4), { map: 'soc-son', x: 101, y: 117.4 });
  const east = w.exitAt('phu-dong', 79, 28, { flags: {} });
  assert.deepEqual(w.arrival(east, 78.6, 29.2), { map: 'trau-son', x: 2.6, y: 69.2 });
  // The part of the east edge with no map beyond it is no exit.
  assert.equal(w.exitAt('phu-dong', 79, 60, { flags: {} }), null);
  assert.equal(w.exitAt('phu-dong', 20, 20, { flags: {} }), null);
  // An exit with a condition opens only when the condition is true.
  const gated = createWorld(world, new Map([['a', { layers: { exits: [{ id: 'x', x: 0, y: 0, w: 1, h: 1, when: { flags: ['open'] }, to: { map: 'b', x: 1, y: 1 } }] } }]]));
  assert.equal(gated.exitAt('a', 0, 0, { flags: {} }), null);
  assert.equal(gated.exitAt('a', 0, 0, { flags: { open: true } }).id, 'x');
});

test('the people, enemies, and things of the story are each on one map', () => {
  const w = createWorld(world, maps);
  assert.equal(w.whereIs('npc', 'fisher'), 'phu-dong');
  assert.equal(w.whereIs('npc', 'giong-sky'), 'soc-son');
  assert.equal(w.whereIs('encounter', 'boss'), 'trau-son');
  assert.equal(w.whereIs('object', 'ore1'), 'phu-dong');
  assert.equal(w.whereIs('npc', 'nobody'), null);
  const seen = new Map();
  for (const [id, m] of maps) {
    for (const x of [...m.npcs, ...m.encounters]) {
      assert.ok(!seen.has(x.id), `${x.id} is on ${seen.get(x.id)} and ${id}`);
      seen.set(x.id, id);
    }
  }
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

test('the maps of a region are windows that touch: no two overlap, and each edge goes both ways', () => {
  const w = worldOf();
  for (const r of world.regions.filter((x) => x.maps.length)) {
    const list = r.maps.map((id) => w.map(id));
    for (const a of list) {
      assert.ok(a.window, `${a.id}: a window`);
      for (const s of a.stamps) assert.ok(s.x >= 0 && s.y >= 0 && s.x + s.w <= a.width && s.y + s.h <= a.height, `${a.id}: a stamp in the window`);
      for (const b of list) {
        if (a === b) continue;
        const apart = a.window.x + a.width <= b.window.x || b.window.x + b.width <= a.window.x || a.window.y + a.height <= b.window.y || b.window.y + b.height <= a.window.y;
        assert.ok(apart, `${a.id} and ${b.id} overlap`);
      }
      for (const e of a.layers.exits) {
        // The cell next to the exit on the plane is in the other map, and its exit leads back.
        const b = w.map(e.to.map);
        const x = e.x + (e.w > 2 ? e.w / 2 : e.x === 0 ? 0.4 : e.w - 0.4);
        const y = e.y + (e.h > 2 ? e.h / 2 : e.y === 0 ? 0.4 : e.h - 0.4);
        const to = w.arrival(e, x, y);
        assert.equal(to.map, b.id);
        assert.ok(to.x >= 0 && to.y >= 0 && to.x < b.width && to.y < b.height, `${a.id} to ${b.id}: inside`);
        assert.equal(w.exitAt(b.id, Math.floor(to.x), Math.floor(to.y), { flags: {} }), null, 'the arrival is past the exit');
        const back = b.layers.exits.find((x) => x.to.map === a.id);
        assert.ok(back, `${b.id} leads back to ${a.id}`);
        // On the plane, the arrival is a few cells from the place where the hero left.
        const from = [a.window.x + x, a.window.y + y];
        const at = [b.window.x + to.x, b.window.y + to.y];
        assert.ok(Math.hypot(from[0] - at[0], from[1] - at[1]) < 5, `${a.id} to ${b.id}: the same place on the plane`);
      }
    }
  }
});

test('the land goes on across the edge between two maps, and a road crosses each edge', () => {
  const w = worldOf();
  for (const seed of [1, 99]) {
    for (const id of ['phu-dong', 'soc-son', 'trau-son', 'road-thanglong']) {
      const a = w.map(id, seed);
      for (const e of a.layers.exits) {
        const b = w.map(e.to.map, seed);
        assert.ok(e.mark, `${id}: the road marks the exit to ${b.id}`);
        // Along the edge, the cells on the two sides are one step apart at most, where both are land.
        let roads = 0;
        const along = e.w > e.h ? e.w : e.h;
        for (let k = 0; k < along; k++) {
          const ax = e.w > e.h ? e.x + k : e.x === 0 ? 0 : a.width - 1;
          const ay = e.w > e.h ? (e.y === 0 ? 0 : a.height - 1) : e.y + k;
          const gx = a.window.x + ax + (e.w > e.h ? 0 : e.x === 0 ? -1 : 1);
          const gy = a.window.y + ay + (e.w > e.h ? (e.y === 0 ? -1 : 1) : 0);
          const bx = gx - b.window.x;
          const by = gy - b.window.y;
          const ga = a.layers.ground[ay][ax];
          const gb = b.layers.ground[by][bx];
          if (ga === '=' && gb === '=') roads += 1;
          if ('~fhlB_s'.includes(ga) || '~fhlB_s'.includes(gb)) continue;
          assert.ok(Math.abs(Number(a.layers.height[ay][ax]) - Number(b.layers.height[by][bx])) <= 1, `${seed} ${id} to ${b.id}: a cliff at the edge (${ax}, ${ay})`);
        }
        assert.ok(roads >= 2, `${seed} ${id} to ${b.id}: the road goes on`);
      }
    }
  }
});
