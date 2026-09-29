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

// A small test world with two open regions and one locked region.
const testWorld = createWorld({
  start: { region: 'a', map: 'a1' },
  regions: [
    { id: 'a', maps: ['a1'], entry: { map: 'a1', x: 1.5, y: 1.5 } },
    { id: 'b', maps: ['b1'], entry: { map: 'b1', x: 2.5, y: 3.5 } },
    { id: 'c', maps: [] },
  ],
  links: [['a', 'b', 13], ['b', 'c', 5]],
}, new Map([['a1', { layers: { exits: [] } }], ['b1', { layers: { exits: [] } }]]));

test('a travel to an open region takes the road hours and has a few road events', () => {
  const plan = planTravel(testWorld, 'a', 'b', { flags: {} }, createRng('t1'), events);
  assert.equal(plan.ok, true);
  assert.ok(plan.events.length >= 2 && plan.events.length <= TRAVEL.maxEvents, `events: ${plan.events.length}`);
  const extra = plan.events.reduce((s, e) => s + (e.hours ?? 0), 0);
  assert.equal(plan.hours, 13 + extra);
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
