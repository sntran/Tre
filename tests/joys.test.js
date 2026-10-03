import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTileMap } from '../src/core/tilemap.js';
import { createWorldState, getEntity, query, command } from '../src/core/world/state.js';
import { step, STEP } from '../src/core/world/step.js';
import { envFor, placesOf } from '../src/core/world/env.js';
import { addHero, addFriend, addLifeLayer } from '../src/core/world/populate.js';
import { rainOf } from '../src/core/world/systems/sky.js';
import { whenOn, catchAt } from '../src/core/world/systems/joys.js';
import { rareOn } from '../src/core/world/ambient.js';
import { buildTerrain } from '../src/world/terrain.js';
import { load, mapOf } from './helpers.js';

const tiles = load('data/tiles.json').types;
const life = load('data/world/life.json');
const dayData = load('data/world/day.json');
const A = dayData.ambient;
const map = mapOf('phu-dong');
const tileMap = createTileMap(map, tiles);
const terrain = buildTerrain(map, tiles, tileMap);
const env = envFor(tileMap, { places: placesOf(map, tileMap), homes: terrain.homes, day: dayData, joys: life.joys });

// The village with its animals and the small joys; the hero stands at a map cell.
function village(minutes, at = { x: 78, y: 1 }, seed = 11) {
  const w = createWorldState({ seed, map: map.id, clock: { minutes } });
  addHero(w, env, at);
  addLifeLayer(w, map, env, life);
  return w;
}
const kind = (w, k) => query(w, 'kind').filter((e) => e.kind === k);
const run = (w, seconds) => {
  const events = [];
  for (let i = 0; i < seconds / STEP; i++) {
    step(w, STEP, env);
    events.push(...w.events);
  }
  return events;
};
const put = (w, id, x, z) => Object.assign(getEntity(w, id).position, { x, z, y: env.groundY(x / 2, z / 2) });

test('the days and hours of a small joy: rare days from the seed, Tết, an hour, and the wet hours after a rain', () => {
  const rare = (seed) => Array.from({ length: 200 }, (_, d) => whenOn({ rare: 'kingfisher' }, seed, d * 1440 + 600, A));
  const days = rare(11);
  const n = days.filter(Boolean).length;
  assert.ok(n >= 3 && n <= 25, `${n} days of 200 with the kingfisher`);
  assert.deepEqual(rare(11), days, 'the same seed gives the same days');
  assert.notDeepEqual(rare(12), days, 'another seed, other days');
  assert.equal(days[days.indexOf(true)], rareOn(11, days.indexOf(true), A).includes('kingfisher'));
  // Tết: two days of the year; the lion dance only at noon of those days.
  const tet = A.year.tet[0];
  assert.equal(whenOn({ tet: true }, 11, tet * 1440 + 600, A), true);
  assert.equal(whenOn({ tet: true }, 11, (tet + 2) * 1440 + 600, A), false);
  assert.equal(whenOn({ tet: true, hours: [11.5, 13] }, 11, tet * 1440 + 12 * 60, A), true);
  assert.equal(whenOn({ tet: true, hours: [11.5, 13] }, 11, tet * 1440 + 14 * 60, A), false);
  // A puddle: from the start of the rain until some hours after it.
  const d = Array.from({ length: 60 }, (_, i) => i).find((i) => rainOf(11, i, dayData));
  const r = rainOf(11, d, dayData);
  const wet = (hour) => whenOn({ wet: 4 }, 11, d * 1440 + hour * 60, A, dayData);
  assert.equal(wet(r.start - 0.5), false);
  assert.equal(wet((r.start + r.end) / 2), true);
  assert.equal(wet(r.end + 3), true);
  assert.equal(wet(r.end + 4.5), false);
});

test('the net of the fisher comes up with a fish now and then, the same for the same seed', () => {
  const c = life.joys.catch;
  let on = 0;
  for (let s = 0; s < 3600; s += 0.5) if (catchAt(11, s, c)) on += 0.5;
  const share = on / 3600;
  assert.ok(share > 0.01 && share < 0.06, `${share} of the time with a fish`);
  assert.equal(catchAt(11, 1234, c), catchAt(11, 1234, c));
});

test('a rare thing is there only on its day; at Tết the pot of bánh chưng is in the yard of the đình', () => {
  const day = Array.from({ length: 200 }, (_, i) => i).find((i) => rareOn(11, i, A).includes('kingfisher'));
  const plain = Array.from({ length: 200 }, (_, i) => i).find((i) => !rareOn(11, i, A).includes('kingfisher'));
  for (const [d, seen] of [[day, true], [plain, false]]) {
    const w = village(d * 1440 + 600);
    run(w, 0.1);
    assert.equal(!kind(w, 'kingfisher')[0].hidden, seen, `day ${d}`);
  }
  const tet = village(A.year.tet[0] * 1440 + 600);
  run(tet, 0.1);
  assert.equal(kind(tet, 'banh-chung')[0].hidden, undefined);
  assert.equal(kind(tet, 'lion')[0].hidden, true, 'the lion dances only at noon');
  const noon = village(A.year.tet[0] * 1440 + 12 * 60);
  const events = run(noon, 2);
  const lion = kind(noon, 'lion')[0];
  assert.equal(lion.hidden, undefined);
  assert.ok(events.some((e) => e.type === 'beat' && e.sound === 'tom'), 'the drum of the dance');
  const plainDay = village(5 * 1440 + 600);
  run(plainDay, 0.1);
  assert.equal(kind(plainDay, 'banh-chung')[0].hidden, true, 'no pot on another day');
});

test('a frog on a lily pad jumps into the river when the hero comes near, and comes back after a while', () => {
  const w = village(600);
  const frog = kind(w, 'frog')[0];
  const home = { ...frog.position };
  run(w, 1);
  assert.equal(frog.hidden, undefined, 'the frog sits while the hero is far');
  put(w, 'hero', home.x, home.z - 3.5);
  const events = run(w, 1);
  assert.ok(events.some((e) => e.type === 'hop' && e.id === frog.id));
  assert.ok(events.some((e) => e.type === 'dive' && e.id === frog.id));
  assert.equal(frog.hidden, true, 'under the water');
  put(w, 'hero', 156, 2);
  run(w, life.kinds.frog.react.away + 1);
  assert.equal(frog.hidden, undefined, 'back on the lily pad');
  assert.ok(Math.hypot(frog.position.x - home.x, frog.position.z - home.z) < 0.01);
});

test('the ducklings follow a hero who walks past, not one who runs', () => {
  for (const runs of [true, false]) {
    const w = village(600);
    const ducks = kind(w, 'duckling');
    assert.equal(ducks.length, 4);
    const d = ducks[0].position;
    // The hero comes along the path from the west and goes past.
    put(w, 'hero', d.x - 14, d.z);
    let events = [];
    for (let i = 0; i < 25; i++) {
      command(w, { type: 'move', id: 'hero', dx: 1, dz: 0, strength: 1, run: runs });
      events = events.concat(run(w, 0.1));
    }
    const follow = events.filter((e) => e.type === 'follow' && e.id.startsWith('life:') && getEntity(w, e.id).kind === 'duckling');
    assert.equal(follow.length > 0, !runs, runs ? 'no duckling follows a runner' : 'the ducklings follow');
  }
});

test('a tap on a sleeping buffalo makes it flick an ear, and it sleeps on; an awake one does not', () => {
  const w = village(600);
  const [a, b] = kind(w, 'buffalo');
  a.act = 'sleep';
  command(w, { type: 'poke', id: a.id });
  command(w, { type: 'poke', id: b.id });
  const events = run(w, STEP);
  assert.deepEqual(events.filter((e) => e.type === 'flick').map((e) => e.id), [a.id]);
  assert.ok(a.flick > 0);
  run(w, 1);
  assert.equal(a.flick, undefined, 'the flick is short');
});

test('a puddle on the road after the rain splashes once when the hero walks into it', () => {
  const d = Array.from({ length: 60 }, (_, i) => i).find((i) => rainOf(11, i, dayData));
  const r = rainOf(11, d, dayData);
  const w = village(Math.round(d * 1440 + (r.end + 1) * 60));
  run(w, 0.1);
  const puddle = kind(w, 'puddle')[0];
  assert.equal(puddle.hidden, undefined, 'a puddle after the rain');
  put(w, 'hero', puddle.position.x, puddle.position.z);
  const events = run(w, 1);
  assert.equal(events.filter((e) => e.type === 'splash' && e.id === puddle.id).length, 1);
  const dry = village(Math.round(d * 1440 + (r.end + 6) * 60));
  run(dry, 0.1);
  assert.equal(kind(dry, 'puddle')[0].hidden, true, 'gone when the road is dry');
});

test('Nghé turns its head to a small joy at most once a day', () => {
  const w = village(600);
  addFriend(w, env, 'nghe');
  const nghe = query(w, 'follow')[0];
  const frog = kind(w, 'frog')[0];
  const near = () => {
    put(w, 'hero', frog.position.x - 10, frog.position.z - 6);
    put(w, nghe.id, frog.position.x - 6, frog.position.z - 6);
  };
  near();
  let events = run(w, 0.2);
  assert.equal(events.filter((e) => e.type === 'notice').length, 1);
  assert.equal(events.find((e) => e.type === 'notice').at, frog.id);
  assert.ok(nghe.notice);
  run(w, 3);
  near();
  events = run(w, 1);
  assert.equal(events.filter((e) => e.type === 'notice').length, 0, 'not again on the same day');
  w.clock.minutes += 1440;
  near();
  events = run(w, 0.2);
  assert.equal(events.filter((e) => e.type === 'notice').length, 1, 'again the next day');
});
