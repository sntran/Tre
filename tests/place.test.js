import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTileMap } from '../src/core/tilemap.js';
import { createWorldState, getEntity, query, command } from '../src/core/world/state.js';
import { step, STEP } from '../src/core/world/step.js';
import { envFor, placesOf } from '../src/core/world/env.js';
import { addHero, addFriend, addZones } from '../src/core/world/populate.js';
import { saveWorld, loadWorld, setHeroPlace } from '../src/core/world/save.js';
import { skillEvents, judge, minParts, isMashing, hasSweep } from '../src/core/world/zones.js';
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
    places: { 'bridge-pile': { x: 16, y: 12 }, 'bridge-guess': { x: 3, y: 13 } },
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
// think: the seconds that the child looks before the choice of the next plank.
function lay(w, size, think = 2) {
  run(w, think);
  const id = pickSize(w, size);
  const z = gap(w);
  command(w, { type: 'place', id: 'hero', x: z.lane, z: z.from - 2 });
  command(w, { type: 'put', id: 'hero', zone: 'gap' });
  step(w, STEP, env);
  return { id, events: w.events };
}

// The hero walks out on the planks from the near end (a commit when the hero steps on the last).
function cross(w, seconds = 3) {
  const z = gap(w);
  command(w, { type: 'place', id: 'hero', x: z.lane, z: z.from - 2 });
  command(w, { type: 'move', id: 'hero', dx: 0, dz: 1, strength: 1 });
  const events = run(w, seconds);
  command(w, { type: 'move', id: 'hero', dx: 0, dz: 0, strength: 0 });
  return events;
}
const skills = (events) => events.filter((e) => e.type === 'skill');

test('the zone rules: a sum against the gap, the fewest planks, and the flags of a commit', () => {
  assert.equal(judge(12, 12), 'exact');
  assert.equal(judge(13, 12), 'long');
  assert.equal(judge(8, 12), 'short');
  assert.equal(minParts(12, [3, 3, 3, 4, 4, 4, 5, 5, 5]), 3);
  assert.equal(minParts(18, [3, 3, 3, 3, 3, 3, 5, 5, 5, 5]), 4);
  assert.equal(minParts(12, [5, 5, 5]), Infinity);
  const def = zones.bridge;
  const zone = { gap: 12, sizes: def.rounds[0].pile, levels: def.rounds[0].levels, commits: 1 };
  const one = skillEvents(zone, def, [3, 4, 5], { solved: true, mashing: false });
  assert.deepEqual(one.map((e) => [e.skill, e.solved, e.efficient, e.first, e.evidence]), [['math.add.20', true, true, true, true]]);
  const groups = skillEvents(zone, def, [4, 4, 4], { solved: true, mashing: false });
  assert.deepEqual(groups.map((e) => [e.skill, e.level, e.efficient, e.target]), [['math.add.20', 1, true, 12], ['math.mul.10', 1, true, 12]]);
  // Solved with more planks than needed, or on a later commit: solved, but not efficient.
  assert.equal(skillEvents({ ...zone, gap: 12, sizes: [3, 3, 3, 3, 4, 4, 4] }, def, [3, 3, 3, 3], { solved: true, mashing: false })[0].efficient, false);
  assert.equal(skillEvents({ ...zone, commits: 2 }, def, [4, 4, 4], { solved: true, mashing: false })[0].efficient, false);
  // Mashing: no evidence.
  assert.equal(skillEvents(zone, def, [4, 4], { solved: false, mashing: true })[0].evidence, false);
});

test('the signs of mashing: choices too fast to count, a sweep of sizes, no pause after a failure', () => {
  const limits = zones.bridge.mash;
  assert.ok(!isMashing({ thinks: [2, 3, 2.5], tries: [], pause: null }, limits));
  assert.ok(isMashing({ thinks: [0.3, 0.4, 2], tries: [], pause: null }, limits), 'too fast');
  assert.ok(isMashing({ thinks: [3, 3], tries: [], pause: 0.4 }, limits), 'no pause after a fall');
  assert.ok(hasSweep([{ slot: 2, size: 3 }, { slot: 2, size: 4 }, { slot: 2, size: 5 }]), 'three sizes in turn at one place');
  assert.ok(!hasSweep([{ slot: 0, size: 3 }, { slot: 1, size: 4 }, { slot: 2, size: 5 }]), 'three places is a bridge, not a sweep');
  assert.ok(!hasSweep([{ slot: 1, size: 5 }, { slot: 1, size: 3 }, { slot: 1, size: 4 }]));
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

test('to put planks and take them back is free: no skill event until the hero steps on the bridge', () => {
  const w = world();
  const events = [];
  events.push(...lay(w, 5).events, ...lay(w, 4).events);
  // Take the last plank back from the near end, and put a 3 there.
  command(w, { type: 'pick', id: 'hero', item: gap(w).items[1] });
  events.push(...run(w, 0.1));
  assert.ok(hero(w).hands.holds, 'the last plank comes back');
  command(w, { type: 'put', id: 'hero', zone: 'gap' });
  events.push(...run(w, 0.1));
  events.push(...lay(w, 3).events, ...lay(w, 4).events);
  assert.equal(skills(events).length, 0);
  assert.ok(!gap(w).set, 'exact, but not solid before the commit');
  // Only the last plank can come back.
  command(w, { type: 'pick', id: 'hero', item: gap(w).items[0] });
  step(w, STEP, env);
  assert.equal(hero(w).hands.holds, null);
});

test('exactly right: at the commit the bridge becomes solid, with a drum, coins, and an efficient first success', () => {
  const w = world();
  lay(w, 4);
  lay(w, 4);
  lay(w, 4);
  const events = cross(w);
  const solid = events.find((e) => e.type === 'solid');
  assert.equal(solid.sound, 'drum');
  assert.deepEqual(solid.give, { coin: 3 });
  assert.deepEqual(skills(events).map((e) => [e.skill, e.solved, e.efficient, e.first, e.evidence]), [['math.add.20', true, true, true, true], ['math.mul.10', true, true, true, true]]);
  const z = gap(w);
  assert.ok(z.set);
  for (const id of z.items) assert.equal(getEntity(w, id).look, `deck-${getEntity(w, id).item.size}`);
  // The hero walks on across the bridge to the far bank.
  command(w, { type: 'move', id: 'hero', dx: 0, dz: 1, strength: 1 });
  run(w, 3);
  assert.ok(hero(w).position.z > 52, `the hero is on the far bank (${hero(w).position.z.toFixed(1)})`);
  assert.ok(!hero(w).fall);
});

test('too long: the plank wobbles, the fisher calls out, and it floats back to the pile; nothing is lost', () => {
  const w = world();
  lay(w, 5);
  lay(w, 5);
  const { id, events } = lay(w, 5);
  assert.ok(events.find((e) => e.type === 'long'));
  const call = events.find((e) => e.type === 'call');
  assert.equal(call.id, 'npc:fisher');
  assert.equal(call.key, 'world.bridge.long');
  assert.equal(skills(events).length, 0, 'a long plank is not a commit');
  const plank = getEntity(w, id);
  assert.ok(plank.position.z + 5 > gap(w).from + gap(w).gap, 'it sticks out past the far end');
  const tilts = new Set();
  for (let i = 0; i < 30; i++) {
    step(w, STEP, env);
    tilts.add(Math.sign(getEntity(w, id)?.tilt ?? 0));
  }
  assert.ok(tilts.has(1) && tilts.has(-1), 'it wobbles');
  const later = run(w, 4);
  assert.ok(later.find((e) => e.type === 'float'));
  assert.ok(getEntity(w, id), 'the plank is not lost');
  assert.ok(pile(w).items.includes(id), 'it is back on the pile');
  assert.equal(query(w, 'item').length, 9, 'all nine planks are still there');
  assert.equal(gap(w).items.length, 2);
  assert.equal(gap(w).fails, 1);
});

test('too short: the plank dips, the hero falls, the empty part of the gap shows for two seconds, and Nghé pulls the hero out', () => {
  const w = world();
  lay(w, 4);
  const { id } = lay(w, 4);
  const events = cross(w, 1);
  const tip = events.find((e) => e.type === 'tip');
  assert.ok(tip && tip.item === id, 'the last plank dips');
  assert.deepEqual(skills(events).map((e) => [e.skill, e.solved, e.first, e.parts.join('+'), e.target]), [['math.add.20', false, true, '4+4', 12]]);
  // The planks stay on their marks, and the marks of the empty part show 4 units.
  const why = getEntity(w, 'why:gap');
  assert.equal(why.look, 'gap-4');
  assert.equal(why.position.z, gap(w).from + 8);
  assert.ok(gap(w).items.includes(id), 'the dipped plank is still in its place');
  run(w, 0.8);
  assert.ok(getEntity(w, 'why:gap') && gap(w).items.includes(id), 'still there after nearly two seconds');
  const after = run(w, 6);
  assert.equal(getEntity(w, 'why:gap'), null);
  assert.ok(after.find((e) => e.type === 'pulled'));
  assert.ok(!hero(w).fall);
  assert.ok(hero(w).position.z < gap(w).from, 'back at the near end');
  assert.equal(hero(w).position.y, 6, 'on the deck');
  assert.ok(pile(w).items.includes(id), 'the plank floated back to the pile');
  assert.equal(gap(w).items.length, 1);
  assert.equal(gap(w).fails, 1);
  // The next commit on this gap is not the first one.
  lay(w, 4, 3);
  lay(w, 4);
  const again = cross(w);
  assert.deepEqual(skills(again).map((e) => [e.solved, e.first, e.efficient]), [[true, false, false], [true, false, false]]);
});

test('after two failures Nghé stands on the bank at the near end and stretches its neck toward the gap', () => {
  const w = world();
  lay(w, 5);
  lay(w, 5);
  lay(w, 5); // long: 1
  run(w, 4);
  lay(w, 4, 3); // long again: 2
  const later = run(w, 4);
  assert.ok(later.find((e) => e.type === 'hint'));
  run(w, 3);
  const nghe = getEntity(w, 'friend:nghe');
  const z = gap(w);
  assert.ok(Math.hypot(nghe.position.x - (z.lane + 3), nghe.position.z - (z.from - 1.5)) < 1, `Nghé is at the near end (${nghe.position.x.toFixed(1)}, ${nghe.position.z.toFixed(1)})`);
  assert.ok(nghe.position.z < z.from, 'not on the planks');
  assert.equal(nghe.act, 'stretch');
  assert.equal(nghe.position.facing, 0, 'toward the gap');
  pickSize(w, 3);
  step(w, STEP, env);
  assert.equal(nghe.follow.goal, undefined, 'the hint ends when the hero takes a plank');
});

test('a commit with the signs of mashing is no evidence and no error, and Nghé shows the gap', () => {
  const w = world();
  lay(w, 3, 0);
  lay(w, 3, 0);
  lay(w, 3, 0);
  const events = cross(w, 1);
  const [ev] = skills(events);
  assert.equal(ev.mashing, true);
  assert.equal(ev.evidence, false);
  const later = run(w, 8);
  assert.ok(later.find((e) => e.type === 'hint'), 'the hint comes at once');
});

test('a child who thinks before each plank is not mashing, and the first choice on a gap has no think time', () => {
  const w = world();
  // The first choice comes at once (the child looked at the gap before); then the child looks.
  lay(w, 4, 0);
  lay(w, 4, 2);
  lay(w, 4, 2);
  assert.deepEqual(gap(w).attempt.thinks.length, 2);
  const [ev] = skills(cross(w));
  assert.equal(ev.mashing, false);
  assert.equal(ev.efficient, true);
});

test('predict, then commit: the plank outlines lie on the bank, Nghé looks at the hero, and the child taps how many', () => {
  const w = world();
  const z = gap(w);
  command(w, { type: 'place', id: 'hero', x: z.lane, z: z.from - 6 });
  run(w, 0.2);
  const ghosts = query(w, 'guess');
  assert.equal(ghosts.length, 6);
  assert.ok(ghosts.every((g) => g.look === 'plank-ghost'));
  assert.ok(getEntity(w, 'friend:nghe').follow.goal?.guess, 'Nghé goes to the outlines and looks at the hero');
  command(w, { type: 'guess', id: 'hero', zone: 'gap', n: 3 });
  step(w, STEP, env);
  assert.equal(gap(w).guess, 3);
  assert.deepEqual(query(w, 'guess').map((g) => [g.guess.n, g.look]), [[1, 'plank-ghost-on'], [2, 'plank-ghost-on'], [3, 'plank-ghost-on']]);
  run(w, 1.5);
  assert.equal(query(w, 'guess').length, 0, 'then the row goes away');
  lay(w, 3);
  lay(w, 4);
  lay(w, 5);
  const events = cross(w);
  const pr = events.find((e) => e.type === 'prediction');
  assert.deepEqual([pr.guess, pr.used, pr.solved, pr.gap], [3, 3, true, 12]);
});

test('a child who builds before the prediction skips it', () => {
  const w = world();
  lay(w, 4);
  assert.equal(gap(w).guess, null);
  assert.equal(query(w, 'guess').length, 0);
  lay(w, 4);
  const pr = cross(w, 1).find((e) => e.type === 'prediction');
  assert.deepEqual([pr.guess, pr.used, pr.solved], [null, 2, false]);
});

test('the next rounds come at the next dawn: 15 with a new pile, then 18 with two kinds of plank; then the rain breaks one or two planks', () => {
  const w = world();
  lay(w, 4);
  lay(w, 4);
  lay(w, 4);
  cross(w);
  assert.ok(gap(w).set);
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
  assert.equal(gap(w).guess, 'pending', 'a new gap: a new prediction');
  assert.equal(pile(w).items.length, 10);
  assert.equal(getEntity(w, 'deck:gap:n').look, 'deck-2');
  lay(w, 5);
  lay(w, 5);
  lay(w, 5);
  cross(w);
  assert.ok(gap(w).set);
  // The hero is on the bridge at dawn: the round waits until the hero is off it.
  command(w, { type: 'place', id: 'hero', x: 23, z: 40 });
  nextDay(8);
  assert.equal(gap(w).gap, 15);
  command(w, { type: 'place', id: 'hero', x: 23, z: 20 });
  run(w, 1);
  assert.equal(gap(w).gap, 18);
  assert.deepEqual([...new Set(pile(w).items.map((id) => getEntity(w, id).item.size))].sort(), [3, 5]);
  assert.equal(getEntity(w, 'deck:gap:n'), null, 'no old deck at the near end');
  for (const s of [5, 5, 5, 3]) lay(w, s);
  cross(w, 4);
  assert.ok(gap(w).set && gap(w).done);
  command(w, { type: 'place', id: 'hero', x: 23, z: 20 });
  // Days go by; the bridge stays until a day with rain. Then one or two planks break.
  let broke = null;
  for (let d = 0; d < 30 && !broke; d++) broke = nextDay(23).find((e) => e.type === 'crack');
  assert.ok(broke, 'the rain of a later day breaks the bridge');
  const z = gap(w);
  assert.ok(!z.set && !z.done && z.repair);
  assert.ok([3, 5, 6, 8, 10].includes(z.gap), `the gap is one or two planks (${z.gap})`);
  assert.deepEqual(pile(w).items.map((id) => getEntity(w, id).item.size).sort(), [3, 3, 4, 4, 5, 5]);
  // The rest of the bridge stays: the old deck at both ends of the new gap.
  assert.equal(z.from - z.start + z.gap + (z.end - z.from - z.gap), 20);
  if (z.from - z.start >= 2) assert.ok(!tileMap.isBlocked(12, Math.floor((z.from - 1) / 2)), 'the deck before the new gap is open');
  if (z.end - z.from - z.gap >= 2) assert.ok(!tileMap.isBlocked(12, Math.floor((z.from + z.gap + 1) / 2)), 'the deck after the new gap is open');
  // The repair: find the missing planks.
  const parts = z.gap === 3 ? [3] : z.gap === 5 ? [5] : z.gap === 6 ? [3, 3] : z.gap === 8 ? [4, 4] : [5, 5];
  for (const s of parts) lay(w, s);
  const done = cross(w, 4);
  assert.ok(done.find((e) => e.type === 'solid'));
  assert.ok(gap(w).done);
});

test('the save keeps the bridge, and keeps it while the hero is on another map', () => {
  const w = world();
  lay(w, 4);
  pickSize(w, 3);
  const saved = saveWorld(w);
  const ids = saved.entities.map((e) => e.id);
  assert.ok(ids.includes('zone:gap') && ids.includes('zone:bridge-pile'));
  assert.equal(saved.entities.filter((e) => e.item).length, 9);
  assert.ok(!ids.some((id) => String(id).startsWith('guess:') || String(id).startsWith('why:')), 'the outlines and the marks come again from the state');
  JSON.parse(JSON.stringify(saved));
  setHeroPlace(saved, 'other', 5, 5);
  assert.deepEqual(saved.entities.map((e) => e.id), ['hero']);
  assert.ok(saved.away.test.length > 5);
  setHeroPlace(saved, 'test', 11.5, 10);
  assert.equal(saved.away.test, undefined);
  const back = loadWorld(saved);
  addFriend(back, env, 'nghe');
  addZones(back, map, env);
  step(back, STEP, env);
  assert.equal(getEntity(back, 'zone:gap').zone.items.length, 1);
  assert.equal(getEntity(back, 'zone:bridge-pile').zone.items.length, 8);
  assert.equal(query(back, 'item').filter((e) => e.item.held).length, 0);
});

test('each plank, each part of the old deck, and each mark of a gap of the bridge in the map has a look', () => {
  const looks = load('data/figures.json').figures;
  const phu = load('data/maps/phu-dong.json');
  for (const rect of phu.layers.zones.filter((r) => r.task)) {
    const def = zones[rect.task];
    const length = rect.h * 2;
    for (let n = 1; n <= length; n++) assert.ok(looks[`deck-${n}`], `deck-${n}`);
    for (const r of def.rounds) {
      for (let n = 1; n <= r.gap; n++) assert.ok(looks[`gap-${n}`], `gap-${n}`);
      for (const n of r.pile) assert.ok(looks[`plank-${n}`] && looks[`deck-${n}`], `plank-${n}`);
      assert.ok(r.from + r.gap <= length, 'the gap is in the zone');
    }
    assert.ok(looks['plank-ghost'] && looks['plank-ghost-on']);
  }
});

test('a bridge from an older save gets the numbers of its gap, and the prediction when nothing lies on it', () => {
  const w = world();
  const z = gap(w);
  for (const k of ['repair', 'sizes', 'levels', 'commits', 'guess', 'attempt']) delete z[k];
  addZones(w, map, env);
  assert.deepEqual([z.sizes.length, z.levels['math.add.20'], z.commits, z.guess], [9, 1, 0, 'pending']);
});
