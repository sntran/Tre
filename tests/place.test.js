import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTileMap } from '../src/core/tilemap.js';
import { createWorldState, getEntity, query, command } from '../src/core/world/state.js';
import { step, STEP } from '../src/core/world/step.js';
import { envFor, placesOf } from '../src/core/world/env.js';
import { addHero, addFriend, addZones } from '../src/core/world/populate.js';
import { saveWorld, loadWorld, setHeroPlace } from '../src/core/world/save.js';
import { canMake, skillEvents, judge } from '../src/core/world/zones.js';
import { DAY_MINUTES } from '../src/core/world/clock.js';
import { load } from './helpers.js';

const tiles = load('data/tiles.json').types;
const zones = load('data/world/zones.json');
const legend = load('data/maps/phu-dong.json').legend;

// A small map: grass in the north and the south, a river from row 16 to row 25, and a bridge in
// the columns 10 to 13 with a broken part (the zone).
const W = 30;
const H = 40;
const river = (y) => y >= 16 && y < 26;
const map = {
  id: 'test',
  width: W,
  height: H,
  legend,
  layers: {
    ground: Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (!river(y) ? '.' : x >= 10 && x <= 13 ? 'B' : x >= 2 && x <= 3 ? 's' : '~')).join('')),
    height: Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (!river(y) || (x >= 10 && x <= 13) ? '2' : '0')).join('')),
    objects: [],
    collision: [{ x: 10, y: 16, w: 4, h: 10, block: true }],
    zones: [{ id: 'gap', x: 10, y: 16, w: 4, h: 10, task: 'bridge' }],
    places: { 'bridge-pile': { x: 16, y: 12 }, 'bridge-watch': { x: 9, y: 14 } },
  },
};
const tileMap = createTileMap(map, tiles);
const env = envFor(tileMap, { places: placesOf(map, tileMap), zones });

function world(minutes = 9 * 60) {
  const w = createWorldState({ seed: 3, map: 'test', clock: { minutes } });
  addHero(w, env, { x: 11.5, y: 10, facing: 0 });
  addFriend(w, env, 'nghe');
  addZones(w, map, env);
  step(w, STEP, env);
  return w;
}
const run = (w, seconds) => {
  const events = [];
  for (let i = 0; i < seconds * 30; i++) {
    step(w, STEP, env);
    events.push(...w.events);
  }
  return events;
};
const gap = (w) => getEntity(w, 'zone:gap').zone;
const pile = (w) => getEntity(w, 'zone:bridge-pile').zone;
const hero = (w) => getEntity(w, 'hero');

// The hero takes a plank of a size from the pile and puts it at the end of the planks.
function pickSize(w, size) {
  const id = pile(w).items.find((i) => getEntity(w, i).item.size === size);
  assert.ok(id, `a plank of ${size} on the pile`);
  const p = getEntity(w, id).position;
  command(w, { type: 'place', id: 'hero', x: p.x + 1, z: p.z + 1.5 });
  command(w, { type: 'pick', id: 'hero', item: id });
  step(w, STEP, env);
  return id;
}
function lay(w, size) {
  const id = pickSize(w, size);
  const z = gap(w);
  command(w, { type: 'place', id: 'hero', x: z.lane, z: z.from - 2 });
  command(w, { type: 'put', id: 'hero', zone: 'gap' });
  step(w, STEP, env);
  return { id, events: w.events };
}

test('the zone rules: a sum against the gap, groups of the same plank, and what the rest can make', () => {
  assert.equal(judge(12, 12), 'exact');
  assert.equal(judge(13, 12), 'long');
  assert.equal(judge(8, 12), 'open');
  assert.ok(canMake(12, [5, 4, 3]));
  assert.ok(!canMake(12, [5, 5, 5]));
  const def = zones.bridge;
  assert.deepEqual(skillEvents(def, 0, [3, 4, 5], true).map((e) => e.skill), ['math.add.20']);
  const groups = skillEvents(def, 0, [4, 4, 4], true);
  assert.deepEqual(groups.map((e) => [e.skill, e.level, e.correct, e.target]), [['math.add.20', 1, true, 12], ['math.mul.10', 1, true, 12]]);
  assert.deepEqual(skillEvents(def, 2, [5, 5], false).map((e) => [e.skill, e.level]), [['math.add.20', 3]]);
});

test('a new bridge: a gap of 12 and a pile of planks of 3, 4, and 5 on the bank, in rows on the grid', () => {
  const w = world();
  const z = gap(w);
  assert.equal(z.gap, 12);
  assert.equal(z.from, 36);
  const planks = pile(w).items.map((id) => getEntity(w, id));
  assert.deepEqual(planks.map((p) => p.item.size).sort(), [3, 3, 3, 4, 4, 4, 5, 5, 5]);
  for (const p of planks) {
    assert.ok(Number.isInteger(p.position.x) && Number.isInteger(p.position.z), 'on the grid');
    assert.equal(p.look, `plank-${p.item.size}`);
  }
  // The broken part blocks; the old deck at the near end is open.
  assert.ok(tileMap.isBlocked(11, 19), 'the gap blocks');
  assert.ok(!tileMap.isBlocked(11, 16), 'the old deck is open');
  assert.equal(getEntity(w, 'deck:gap:n').look, 'deck-4');
  assert.equal(getEntity(w, 'deck:gap:s').look, 'deck-4');
});

test('pick up, carry, put down on the grid, and pick up again; too far away, nothing happens', () => {
  const w = world();
  const id = pile(w).items[0];
  command(w, { type: 'pick', id: 'hero', item: id });
  step(w, STEP, env);
  assert.equal(hero(w).hands.holds, null, 'too far from the pile');
  pickSize(w, 4);
  const held = hero(w).hands.holds;
  assert.ok(held);
  assert.equal(hero(w).carry, 'plank-4');
  assert.equal(getEntity(w, held).hidden, true);
  assert.ok(!pile(w).items.includes(held));
  // Walk a little, and put it down in front: whole numbers, square to the grid.
  command(w, { type: 'move', id: 'hero', dx: 0.3, dz: 1, strength: 1 });
  run(w, 0.5);
  command(w, { type: 'move', id: 'hero', dx: 0, dz: 0, strength: 0 });
  command(w, { type: 'drop', id: 'hero' });
  step(w, STEP, env);
  const p = getEntity(w, held);
  assert.equal(hero(w).hands.holds, null);
  assert.equal(p.hidden, false);
  assert.ok(Number.isInteger(p.position.x) && Number.isInteger(p.position.z));
  assert.equal(Math.round(p.position.facing / (Math.PI / 2)) * (Math.PI / 2), p.position.facing);
  // Pick it up again from the ground, and put it back on the pile.
  command(w, { type: 'place', id: 'hero', x: p.position.x, z: p.position.z - 1 });
  command(w, { type: 'pick', id: 'hero', item: held });
  step(w, STEP, env);
  assert.equal(hero(w).hands.holds, held);
  const pz = getEntity(w, 'zone:bridge-pile').position;
  command(w, { type: 'place', id: 'hero', x: pz.x, z: pz.z });
  command(w, { type: 'put', id: 'hero', zone: 'bridge-pile' });
  step(w, STEP, env);
  assert.ok(pile(w).items.includes(held));
});

test('exactly right: three planks of 4 across 12 make the bridge solid, with a drum, coins, and two skill events', () => {
  const w = world();
  lay(w, 4);
  lay(w, 4);
  // Only the last plank can come back.
  const z = gap(w);
  command(w, { type: 'pick', id: 'hero', item: z.items[0] });
  step(w, STEP, env);
  assert.equal(hero(w).hands.holds, null);
  const { events } = lay(w, 4);
  const solid = events.find((e) => e.type === 'solid');
  assert.equal(solid.sound, 'drum');
  assert.deepEqual(solid.give, { coin: 3 });
  const skills = events.filter((e) => e.type === 'skill').map((e) => [e.skill, e.correct]);
  assert.deepEqual(skills, [['math.add.20', true], ['math.mul.10', true]]);
  assert.ok(z.set);
  for (const id of z.items) assert.equal(getEntity(w, id).look, `deck-${getEntity(w, id).item.size}`);
  step(w, STEP, env);
  // The hero walks across the bridge to the far bank.
  command(w, { type: 'place', id: 'hero', x: 23, z: 30 });
  command(w, { type: 'move', id: 'hero', dx: 0, dz: 1, strength: 1 });
  run(w, 3);
  assert.ok(hero(w).position.z > 52, `the hero is on the far bank (${hero(w).position.z.toFixed(1)})`);
  assert.ok(!hero(w).fall);
});

test('3, 4, and 5 across 12 is exact too, and records only the sum', () => {
  const w = world();
  lay(w, 3);
  lay(w, 4);
  const { events } = lay(w, 5);
  assert.deepEqual(events.filter((e) => e.type === 'skill').map((e) => e.skill), ['math.add.20']);
  assert.ok(gap(w).set);
});

test('too long: the last plank sticks out and wobbles, the elder calls out, and the plank is lost', () => {
  const w = world();
  lay(w, 5);
  lay(w, 5);
  const { id, events } = lay(w, 5);
  assert.ok(events.find((e) => e.type === 'long'));
  const call = events.find((e) => e.type === 'call');
  assert.equal(call.id, 'npc:elder');
  assert.equal(call.key, 'world.bridge.wasted');
  assert.deepEqual(events.filter((e) => e.type === 'skill').map((e) => [e.skill, e.correct]), [['math.add.20', false], ['math.mul.10', false]]);
  const plank = getEntity(w, id);
  assert.ok(plank.position.z + 5 > gap(w).from + gap(w).gap, 'it sticks out past the far end');
  const tilts = new Set();
  for (let i = 0; i < 30; i++) {
    step(w, STEP, env);
    tilts.add(Math.sign(getEntity(w, id)?.tilt ?? 0));
  }
  assert.ok(tilts.has(1) && tilts.has(-1), 'it wobbles');
  const later = run(w, 4);
  assert.ok(later.find((e) => e.type === 'wasted'));
  assert.equal(getEntity(w, id), null, 'the plank is gone');
  assert.equal(gap(w).items.length, 2);
  assert.ok(!gap(w).set);
  assert.equal(gap(w).fails, 1);
});

test('too short: the last plank tips, the hero falls into the water, and Nghé pulls the hero out', () => {
  const w = world();
  lay(w, 4);
  const { id } = lay(w, 4);
  // The hero walks out on the planks.
  command(w, { type: 'place', id: 'hero', x: 23, z: 34 });
  command(w, { type: 'move', id: 'hero', dx: 0, dz: 1, strength: 1 });
  const events = run(w, 1.5);
  const tip = events.find((e) => e.type === 'tip');
  assert.ok(tip && tip.item === id, 'the last plank tips');
  assert.deepEqual(events.filter((e) => e.type === 'skill').map((e) => [e.skill, e.correct, e.parts.join('+'), e.target]), [['math.add.20', false, '4+4', 12]]);
  assert.ok(events.find((e) => e.type === 'splash'));
  assert.ok(hero(w).fall, 'the hero is in the water');
  assert.ok(hero(w).position.y < 4);
  const after = run(w, 6);
  assert.ok(after.find((e) => e.type === 'pulled'));
  assert.ok(!hero(w).fall);
  assert.ok(hero(w).position.z < gap(w).from, 'back at the near end');
  assert.equal(hero(w).position.y, 6, 'on the deck');
  const nghe = getEntity(w, 'friend:nghe');
  assert.ok(Math.hypot(nghe.position.x - 23, nghe.position.z - gap(w).from) < 6, 'Nghé is at the edge');
  // The plank floated back to the pile; the first plank is still there.
  assert.ok(pile(w).items.includes(id));
  assert.equal(gap(w).items.length, 1);
  assert.equal(gap(w).fails, 1);
});

test('after two failures Nghé walks to the end of the planks and looks at the gap', () => {
  const w = world();
  lay(w, 5);
  lay(w, 5);
  lay(w, 5); // long: 1
  run(w, 4);
  const { events } = lay(w, 4); // long again: 2
  assert.ok(events.find((e) => e.type === 'long'));
  const later = run(w, 4);
  assert.ok(later.find((e) => e.type === 'hint'));
  run(w, 2);
  const nghe = getEntity(w, 'friend:nghe');
  const z = gap(w);
  assert.ok(Math.abs(nghe.position.x - z.lane) < 1 && Math.abs(nghe.position.z - (z.from + 10 - 1.2)) < 1, `Nghé stands at the end of the planks (${nghe.position.x.toFixed(1)}, ${nghe.position.z.toFixed(1)})`);
  assert.equal(nghe.position.facing, 0, 'and looks at the gap');
  // The hint ends when the hero takes a plank.
  pickSize(w, 3);
  step(w, STEP, env);
  assert.equal(nghe.follow.goal, undefined);
});

test('the next rounds come at the next dawn: 15 with a new pile, then 18 with two kinds of plank; then rain breaks it', () => {
  const w = world();
  lay(w, 4);
  lay(w, 4);
  lay(w, 4);
  command(w, { type: 'place', id: 'hero', x: 23, z: 20 });
  // The same day: the bridge stays.
  run(w, 5);
  assert.ok(gap(w).set);
  const nextDay = (hour) => {
    const events = [];
    const target = (Math.floor(w.clock.minutes / DAY_MINUTES) + 1) * DAY_MINUTES + hour * 60;
    while (w.clock.minutes < target) {
      step(w, STEP, env);
      events.push(...w.events);
    }
    return events;
  };
  let events = nextDay(8);
  assert.ok(events.find((e) => e.type === 'round'));
  assert.equal(gap(w).gap, 15);
  assert.ok(!gap(w).set);
  assert.equal(pile(w).items.length, 10);
  assert.equal(getEntity(w, 'deck:gap:n').look, 'deck-2');
  lay(w, 5);
  lay(w, 5);
  lay(w, 5);
  assert.ok(gap(w).set);
  // The hero is on the bridge at dawn: the round waits until the hero is off it.
  nextDay(8);
  assert.equal(gap(w).gap, 15);
  command(w, { type: 'place', id: 'hero', x: 23, z: 20 });
  run(w, 1);
  assert.equal(gap(w).gap, 18);
  assert.deepEqual([...new Set(pile(w).items.map((id) => getEntity(w, id).item.size))].sort(), [3, 5]);
  assert.equal(getEntity(w, 'deck:gap:n'), null, 'no old deck at the near end');
  for (const s of [5, 5, 5, 3]) lay(w, s);
  assert.ok(gap(w).set && gap(w).done);
  // Days go by; the bridge stays until a day with rain.
  let broke = null;
  for (let d = 0; d < 30 && !broke; d++) broke = nextDay(23).find((e) => e.type === 'crack');
  assert.ok(broke, 'the rain of a later day breaks the bridge');
  assert.ok(!gap(w).set && !gap(w).done);
  assert.ok([12, 15, 18].includes(gap(w).gap));
  assert.ok(pile(w).items.length >= 9);
});

test('the save keeps the bridge, and keeps it while the hero is on another map', () => {
  const w = world();
  lay(w, 4);
  pickSize(w, 3);
  const saved = saveWorld(w);
  const ids = saved.entities.map((e) => e.id);
  assert.ok(ids.includes('zone:gap') && ids.includes('zone:bridge-pile'));
  assert.equal(saved.entities.filter((e) => e.item).length, 9);
  JSON.parse(JSON.stringify(saved));
  // To another map and back: the zone waits in `away`. The plank in the hands goes back to the pile.
  setHeroPlace(saved, 'other', 5, 5);
  assert.deepEqual(saved.entities.map((e) => e.id), ['hero']);
  assert.ok(saved.away.test.length > 5);
  setHeroPlace(saved, 'test', 11.5, 10);
  assert.equal(saved.away.test, undefined);
  const back = loadWorld({ ...saved, entities: saved.entities.map((e) => (e.id === 'hero' ? { ...e, hands: { holds: null }, carry: undefined } : e)) });
  delete getEntity(back, 'hero').carry;
  addFriend(back, env, 'nghe');
  addZones(back, map, env);
  step(back, STEP, env);
  assert.equal(getEntity(back, 'zone:gap').zone.items.length, 1);
  assert.equal(getEntity(back, 'zone:bridge-pile').zone.items.length, 8);
  assert.equal(query(back, 'item').filter((e) => e.item.held).length, 0);
});

test('the elder watches the bridge while it is open', async () => {
  const { syncPeople } = await import('../src/core/world/populate.js');
  const days = load('data/world/people.json');
  const life = load('data/world/life.json');
  const w = world(8 * 60);
  map.npcs = [{ id: 'elder', x: 20, y: 5 }];
  map.encounters = [];
  syncPeople(w, map, env, () => true, life.people, days);
  run(w, 20);
  const elder = getEntity(w, 'npc:elder');
  assert.ok(Math.hypot(elder.position.x - 18, elder.position.z - 28) < 3, `the elder is at the bridge (${elder.position.x.toFixed(1)}, ${elder.position.z.toFixed(1)})`);
});
