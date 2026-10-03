import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldState, getEntity, query } from '../src/core/world/state.js';
import { step, STEP } from '../src/core/world/step.js';
import { envFor, placesOf } from '../src/core/world/env.js';
import { addHero, syncPeople, addLifeLayer, addLanterns } from '../src/core/world/populate.js';
import { nightAt, rainOf, sky } from '../src/core/world/systems/sky.js';
import { stepAt } from '../src/core/world/systems/schedule.js';
import { load, planeOf } from './helpers.js';

const tiles = load('data/tiles.json').types;
const life = load('data/world/life.json');
const days = load('data/world/people.json');
const dayData = load('data/world/day.json');
const { map, tileMap, terrain, at } = planeOf(1, { places: ['phu-dong', 'soc-son', 'trau-son', 'road-thanglong'] });
const far = at('phu-dong', 78, 1); // a cell far from everybody
const env = envFor(tileMap, { places: placesOf(map, tileMap), homes: terrain.homes, day: dayData });

test('the light of the day: day, dusk, night, and dawn; the rain of some days, from the seed', () => {
  assert.equal(nightAt(12, dayData), 0);
  assert.equal(nightAt(18, dayData), 0.5);
  assert.equal(nightAt(23, dayData), 1);
  assert.equal(nightAt(2, dayData), 1);
  assert.equal(nightAt(6, dayData), 0.5);
  // The rain comes on some days, the same for the same seed.
  const rains = Array.from({ length: 100 }, (_, d) => rainOf(5, d, dayData));
  const n = rains.filter(Boolean).length;
  assert.ok(n > 15 && n < 45, `${n} days of 100 with rain`);
  assert.deepEqual(rains, Array.from({ length: 100 }, (_, d) => rainOf(5, d, dayData)));
  // In the rain the river rises one block; after it, the river goes down again.
  const d = rains.findIndex(Boolean);
  const r = rains[d];
  const w = createWorldState({ seed: 5, clock: { minutes: d * 1440 + r.start * 60 - 30 } });
  const run = (hours) => { for (let i = 0; i < hours * 20; i++) { w.clock.minutes += 3; w.events = []; sky(w, 1, null, env); } };
  run(0.4);
  assert.equal(w.sky.flood, 0);
  run(r.end - r.start);
  assert.ok(w.sky.rain > 0.9 && w.sky.flood > 0.9, 'the river is up in the rain');
  run(4);
  assert.ok(w.sky.rain < 0.1 && w.sky.flood === 0, 'and down after it');
  // A plan wraps around midnight.
  const plan = days.plans.keeper;
  assert.equal(stepAt(plan, 3).at, 'home');
  assert.equal(stepAt(plan, 9).at, 'spot');
  assert.equal(stepAt(plan, 20).at, 'home');
});

// The whole village from 6 in the morning: the hero stands far from everybody.
function village(minutes) {
  const w = createWorldState({ seed: 11, map: map.id, clock: { minutes } });
  addHero(w, env, { x: far[0], y: far[1] });
  syncPeople(w, map, env, () => true, life.people, days);
  addLifeLayer(w, map, env, life);
  addLanterns(w, env);
  return w;
}
const runTo = (w, hour) => {
  const target = Math.floor(w.clock.minutes / 1440) * 1440 + hour * 60;
  const end = target > w.clock.minutes ? target : target + 1440;
  while (w.clock.minutes < end) step(w, STEP, env);
};
const near = (e, p, d) => Math.hypot(e.position.x - p.x, e.position.z - p.z) < d;

test('the day of the village: who is where at each hour, and the night routine', () => {
  const w = village(6 * 60);
  const people = query(w, 'schedule', 'person');
  assert.ok(people.length >= 10);
  // 10 in the morning: each person is at the place of the person on the map.
  runTo(w, 10);
  for (const e of people) assert.ok(near(e, e.schedule.spot, 3), `${e.id} is at the spot at 10:00 (${e.position.x.toFixed(1)},${e.position.z.toFixed(1)} spot ${JSON.stringify(e.schedule.spot)} hidden ${e.hidden} climb ${e.climb} down ${e.schedule.down} way ${JSON.stringify(e.schedule.way)})`);
  // Noon: the people of the plan "well" are at the well.
  runTo(w, 12.2);
  const well = env.places.well;
  for (const e of people) {
    const plan = days.people[e.person.ref]?.plan;
    if (plan === 'well') assert.ok(near(e, well, 4), `${e.id} is at the well at noon`);
  }
  // Birds fly at dusk; the owl is not there yet.
  runTo(w, 18);
  const birds = query(w, 'kind').filter((e) => e.kind === 'bird');
  assert.ok(birds.length && birds.every((b) => !b.hidden), 'birds at dusk');
  assert.ok(birds.every((b) => b.position.y > 16), 'birds fly');
  // 22:00: the people with a house are in, and their lanterns burn; the chickens sit in their
  // coop; the ducks sit on the bank; the owl sits in the banyan; the birds are gone.
  runTo(w, 22);
  for (const e of people) {
    if (!e.schedule.home) continue;
    assert.equal(e.hidden, true, `${e.id} is at home at 22:00`);
    assert.equal(getEntity(w, `lantern:${e.schedule.home}`).look, 'lantern-lit', `the lantern of ${e.schedule.home} burns`);
  }
  assert.equal(getEntity(w, 'lantern:dinh').look, 'lantern-lit', 'the lantern of the đình burns all night');
  for (const e of query(w, 'kind')) {
    if (e.kind === 'chicken') {
      assert.ok(near(e, e.schedule.bed, 3), `${e.id} is at the coop (${e.position.x.toFixed(1)},${e.position.z.toFixed(1)} bed ${e.schedule.bed.x},${e.schedule.bed.z}) ${JSON.stringify(e.steer.goal)} ${JSON.stringify(e.schedule.way)}`);
      assert.equal(e.act, 'sit');
    }
    if (e.kind === 'duck') assert.ok(near(e, e.schedule.bank, 3), `${e.id} is at the bank (${e.position.x.toFixed(1)},${e.position.z.toFixed(1)} bed ${JSON.stringify(e.schedule.bed)} goal ${JSON.stringify(e.steer.goal)} way ${JSON.stringify(e.schedule.way)})`);
    if (e.kind === 'owl') assert.ok(!e.hidden && e.position.y > 20, 'the owl sits high in the banyan');
    if (e.kind === 'bird') assert.equal(e.hidden, true);
  }
  // 8 in the morning: everybody is out again, the lanterns are dark, and the owl is gone.
  runTo(w, 8);
  for (const e of people) assert.ok(!e.hidden, `${e.id} is out at 8:00`);
  for (const l of query(w, 'lantern')) assert.equal(l.look, 'lantern');
  assert.ok(query(w, 'kind').filter((e) => e.kind === 'owl').every((o) => o.hidden));
  runTo(w, 10);
  for (const e of people) assert.ok(near(e, e.schedule.spot, 3), `${e.id} is back at the spot the next day`);
});

test('a person of the quest stays out at night with a lantern', () => {
  const w = village(17 * 60);
  const elder = getEntity(w, 'npc:elder');
  elder.schedule.stay = true;
  runTo(w, 22);
  assert.ok(!elder.hidden);
  assert.equal(elder.carry, 'lantern');
  assert.ok(near(elder, elder.schedule.spot, 3));
});

test('a knock at a lit house at night: the lantern flickers and a soft sound comes from inside', async () => {
  const { command } = await import('../src/core/world/state.js');
  const w = village(21 * 60);
  runTo(w, 22);
  command(w, { type: 'knock', home: 'home' });
  step(w, STEP, env);
  const ev = w.events.find((e) => e.type === 'inside');
  assert.ok(ev && ['cough', 'baby', 'clatter'].includes(ev.sound));
  assert.ok(getEntity(w, 'lantern:home').lantern.flicker > 0);
  assert.ok(query(w, 'person').every((p) => p.person.ref !== 'grandma' || p.hidden), 'the house stays closed');
  // By day, or at a dark house, a knock does nothing.
  const day = village(10 * 60);
  command(day, { type: 'knock', home: 'home' });
  step(day, STEP, env);
  assert.equal(day.events.filter((e) => e.type === 'inside').length, 0);
});

test('in the morning grandma sets a new pot for the pot that the hero broke, with a small sigh', () => {
  const w = village(10 * 60);
  const potAt = at('phu-dong', 13.2, 23.2);
  const pot = query(w, 'kind').find((e) => e.kind === 'pot' && Math.hypot(e.position.x - potAt[0] * 2, e.position.z - potAt[1] * 2) < 1);
  const hero = getEntity(w, 'hero');
  Object.assign(hero.position, { x: pot.position.x + 1, z: pot.position.z });
  step(w, STEP, env);
  assert.equal(pot.look, 'pot-broken');
  Object.assign(hero.position, { x: far[0] * 2, z: far[1] * 2 });
  // The same day: still broken.
  runTo(w, 16);
  assert.equal(pot.look, 'pot-broken');
  // The next morning grandma comes and sets a new pot.
  let mend = null;
  const end = w.clock.minutes + 26 * 60;
  while (w.clock.minutes < end && !mend) {
    step(w, STEP, env);
    mend = w.events.find((e) => e.type === 'mend');
  }
  assert.ok(mend, 'a new pot');
  assert.equal(mend.sound, 'sigh');
  assert.equal(pot.look, 'pot');
  const hour = (w.clock.minutes % 1440) / 60;
  assert.ok(hour > 6 && hour < 12, `in the morning (${hour.toFixed(1)})`);
  const grandma = getEntity(w, 'npc:grandma');
  assert.ok(Math.hypot(grandma.position.x - pot.position.x, grandma.position.z - pot.position.z) < 3, 'grandma is at the pot');
});
