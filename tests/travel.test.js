import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/world/regions.js';
import { planTravel, applyTravel, TRAVEL } from '../src/world/travel.js';
import { createClock } from '../src/world/clock.js';
import { createRng } from '../src/core/rng.js';
import { load } from './helpers.js';

const events = load('data/world/road-events.json').events;
const vi = load('i18n/vi.json');
const en = load('i18n/en.json');

// A small test world with two open regions and one locked region, one degree of longitude apart.
const testWorld = createWorld({
  start: { region: 'a', map: 'a1' },
  regions: [
    { id: 'a', place: 'pa', maps: ['a1'], entry: { map: 'a1', x: 1.5, y: 1.5 } },
    { id: 'b', place: 'pb', maps: ['b1'], entry: { map: 'b1', x: 2.5, y: 3.5 } },
    { id: 'c', place: 'pc', maps: [] },
  ],
}, new Map([['a1', { layers: { exits: [] } }], ['b1', { layers: { exits: [] } }]]), {
  places: [{ id: 'pa', at: [105, 21] }, { id: 'pb', at: [106, 21] }, { id: 'pc', at: [106, 20] }],
  routes: { speeds: { road: 4, river: 6 }, walkHours: 8, routes: [{ from: 'pa', to: 'pb', mode: 'road' }, { from: 'pb', to: 'pc', mode: 'river' }] },
});

test('the travel time follows the real distance on the roads, with a rest each night', () => {
  // One degree of longitude at 21° north is about 104 km: 26 hours on foot, and 3 nights of rest.
  const way = testWorld.travelWay('a', 'b');
  assert.ok(way.km > 100 && way.km < 106, `${way.km}`);
  assert.equal(way.legs[0].mode, 'road');
  assert.equal(testWorld.travelHours('a', 'b'), Math.ceil(way.hours + 3 * 16));
  assert.equal(testWorld.travelHours('a', 'b'), testWorld.travelHours('b', 'a'), 'the same both ways');
  // By boat on the river is faster than on foot for the same distance.
  const river = testWorld.travelWay('b', 'c');
  assert.ok(river.hours < (river.km / 4));
  assert.equal(testWorld.travelHours('a', 'a'), 0);
});

test('a travel to an open region takes the road hours and has a few road events', () => {
  const plan = planTravel(testWorld, 'a', 'b', { flags: {} }, createRng('t1'), events);
  assert.equal(plan.ok, true);
  assert.ok(plan.events.length >= 1 && plan.events.length <= TRAVEL.maxEvents, `events: ${plan.events.length}`);
  const extra = plan.events.reduce((s, e) => s + (e.hours ?? 0), 0);
  assert.equal(plan.hours, testWorld.travelHours('a', 'b') + extra);
  assert.ok(plan.legs.length === 1 && plan.legs[0].line.length >= 2, 'the way to draw on the map');
  assert.equal(new Set(plan.events.map((e) => e.id)).size, plan.events.length, 'no event twice');
  // The same seed gives the same travel.
  assert.deepEqual(planTravel(testWorld, 'a', 'b', { flags: {} }, createRng('t1'), events), plan);
});

test('a locked region, or the region of the hero, is not a travel', () => {
  assert.deepEqual(planTravel(testWorld, 'a', 'c', { flags: {} }, createRng(1), events), { ok: false, reason: 'locked' });
  assert.deepEqual(planTravel(testWorld, 'a', 'a', { flags: {} }, createRng(1), events), { ok: false, reason: 'here' });
});

test('after a travel, the clock moved on, the gifts are in the bag, and the hero is at the entry', () => {
  const profile = { clock: createClock(), inventory: { rice: 1 }, place: { map: 'a1', x: 1, y: 1 } };
  const plan = { ok: true, to: 'b', hours: 14, events: [events.find((e) => e.id === 'merchant')], entry: { map: 'b1', x: 2.5, y: 3.5 } };
  applyTravel(profile, plan);
  assert.equal(profile.clock.minutes, 7 * 60 + 14 * 60);
  assert.equal(profile.inventory.rice, 2);
  assert.deepEqual(profile.place, { map: 'b1', x: 2.5, y: 3.5 });
});

test('each road event has a text in both languages', () => {
  for (const e of events) assert.ok(e.textKey in vi && e.textKey in en, e.id);
});
