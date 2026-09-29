import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/world/regions.js';
import { load } from './helpers.js';

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
  assert.equal(w.firstExit('phu-dong', 'road-thanglong').id, 'west-road');
  assert.equal(w.firstExit('phu-dong', 'phu-dong'), null);
});

test('an exit sends the hero to the next map, and keeps the position along the edge', () => {
  const w = createWorld(world, maps);
  const north = w.exitAt('phu-dong', 22, 0, { flags: {} });
  assert.equal(north.to.map, 'soc-son');
  assert.deepEqual(w.arrival(north, 22.5, 0.2), { map: 'soc-son', x: 15.5, y: 29.6 });
  const east = w.exitAt('phu-dong', 39, 14, { flags: {} });
  assert.deepEqual(w.arrival(east, 39.3, 14.6), { map: 'trau-son', x: 1.3, y: 14.6 });
  assert.equal(w.exitAt('phu-dong', 10, 10, { flags: {} }), null);
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
