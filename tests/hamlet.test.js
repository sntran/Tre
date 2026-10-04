import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepAt } from '../src/core/world/systems/schedule.js';
import { load, worldOf } from './helpers.js';

// Xóm Ruộng, the quiet hamlet of the activities of multiplication (docs/PLANTING.md).
const map = load('data/maps/xom-ruong.json');
const people = load('data/world/people.json');
const npcs = load('data/npcs.json').npcs;
const legend = map.legend;
const STATIONS = ['planter', 'duck-girl', 'fisher-uncle', 'drummer'];
const yard = map.layers.places.yard;

// The ground of a cell of the hamlet (the stamp covers the whole frame).
const ground = (x, y) => {
  const s = map.stamps.find((t) => x >= t.x && y >= t.y && x < t.x + t.w && y < t.y + t.h);
  return s ? legend[s.ground[y - s.y][x - s.x]] : null;
};
const blocked = (x, y) => map.layers.objects.some((o) => x >= o.x && y >= o.y && x < o.x + o.w && y < o.y + o.h);
const walkable = (x, y) => !['water', 'field', 'ditch', 'hedge', 'hedge-low', null, undefined].includes(ground(x, y)) && !blocked(x, y);

test('each station is 8 to 12 cells from the middle of the yard, on a straight path with no prop in the way', () => {
  for (const id of STATIONS) {
    const p = map.npcs.find((n) => n.id === id);
    assert.ok(p, id);
    const d = Math.hypot(p.x - yard.x, p.y - yard.y);
    assert.ok(d >= 8 && d <= 12.5, `${id}: ${d.toFixed(1)} cells from the yard`);
    // A straight line from the yard to the station: every cell on it is free ground.
    const n = Math.ceil(d * 4);
    for (let i = 0; i <= n; i++) {
      const x = Math.floor(yard.x + ((p.x - yard.x) * i) / n);
      const y = Math.floor(yard.y + ((p.y - yard.y) * i) / n);
      assert.ok(walkable(x, y), `${id}: the cell ${x}, ${y} (${ground(x, y)}) is in the way`);
    }
  }
});

test('the hamlet has houses on stilts, a paddy with a seedbed, a duck pond, a stream with a bridge, and a đình with a drum', () => {
  const props = map.layers.objects.map((o) => o.prop);
  assert.ok(props.filter((p) => p === 'house').length >= 3);
  for (const p of ['dinh', 'drum']) assert.ok(props.includes(p), p);
  const kinds = new Set();
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) kinds.add(ground(x, y));
  for (const k of ['field', 'ditch', 'dike', 'water', 'bridge', 'yard', 'path']) assert.ok(kinds.has(k), k);
  assert.ok(map.layers.zones.some((z) => z.task === 'paddy'), 'the field of the plots');
  assert.ok(map.layers.places['plant-seedbed'], 'the bundles of the seedbed');
});

test('only the people of the stations live in the hamlet, and each stays at the station by day', () => {
  const w = worldOf();
  const [x0, y0] = w.at('xom-ruong', 0, 0);
  const inHamlet = ([x, y]) => x >= x0 && y >= y0 && x < x0 + map.width && y < y0 + map.height;
  const region = load('data/world/regions.json').regions.find((r) => r.id === 'giong');
  for (const id of region.maps.filter((m) => m !== 'xom-ruong')) {
    const other = load(`data/maps/${id}.json`);
    // No person of another place has the spot of the day, or a place of the plans, in the hamlet.
    for (const n of other.npcs) assert.ok(!inHamlet(w.at(id, n.x, n.y)), `${n.id} of ${id}`);
    for (const [name, p] of Object.entries(other.layers.places ?? {})) assert.ok(!inHamlet(w.at(id, p.x, p.y)), `the place ${name} of ${id}`);
  }
  assert.deepEqual(map.npcs.map((n) => n.id).sort(), [...STATIONS].sort());
  for (const id of STATIONS) {
    assert.ok(npcs[id], `${id} talks`);
    const plan = people.plans[people.people[id].plan];
    for (let hour = 7; hour <= 17; hour += 0.5) assert.equal(stepAt(plan, hour).at, 'spot', `${id} at ${hour}`);
    assert.ok(map.layers.objects.some((o) => o.id === people.people[id].home), `${id} has a home in the hamlet`);
  }
});
