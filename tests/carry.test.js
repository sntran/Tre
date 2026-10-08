// The thing in the hands (#43, src/world/carry.js): the hands draw the thing itself, held by its
// shape; the pick-up and the put-down fly in an arc; the action button shows the thing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { figureOf, heroLook, thingLook } from '../src/world/figures.js';
import { TOOLS } from '../src/world/parts.js';
import { HOLDS, holdOf, trackCarries, flightAt, handOf, FLIGHT_STEPS } from '../src/world/carry.js';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';

const figures = load('data/figures.json');
const lookOf = (key) => figures.figures[key] ?? thingLook(key) ?? null;
const hero = heroLook({ name: 'An', gender: 'boy', look: {} }, figures.hero);
const withCarry = (key, detail) => figureOf({ ...hero, item: key, carried: lookOf(key) ?? {}, carryRules: figures.carry }, detail);
const carryParts = (f) => f.parts.filter((p) => p.name.startsWith('carry'));

// Every look of a thing in the data of the game: the looks of data/figures.json that are not people,
// and every look key in the data files (the tasks, the events, the folk games) that the code makes
// from its key (bundle-5, lo-10, shard). From the data, not a list in the test.
function thingKeys() {
  const keys = new Set();
  const walk = (v) => {
    if (typeof v === 'string') {
      if (thingLook(v) || figures.figures[v]) keys.add(v);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  const files = (dir) => readdirSync(dir).flatMap((f) => {
    const p = `${dir}/${f}`;
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.json') ? [p] : [];
  });
  for (const f of files('data').filter((p) => !p.includes('/maps/') && !p.includes('/geo/') && !p.includes('land-'))) walk(JSON.parse(readFileSync(f, 'utf8')));
  for (const k of Object.keys(figures.figures)) keys.add(k);
  // The looks that the code makes from a size (a bundle of n seedlings, a fish trap of n): all the
  // sizes up to ten.
  for (const family of ['bundle', 'bunch', 'lo']) for (let n = 1; n <= 10; n++) if (thingLook(`${family}-${n}`)) keys.add(`${family}-${n}`);
  // The shard of nhảy lò cò (src/core/folk-session.js).
  keys.add('shard');
  // A tool of a person (a basket, a net) stays a tool in the hand.
  return [...keys].filter((k) => !TOOLS.has(k) && figureOf(lookOf(k), 'coarse').kind !== 'biped');
}

test('every thing of the game shows in the hands of the hero, on the fine and the far figure', () => {
  const keys = thingKeys();
  for (const must of ['rod', 'bundle-2', 'bundle-5', 'rice-1', 'pails-1', 'stones-5', 'duck', 'duck-brown', 'stake', 'plank-4', 'herb-ngai', 'shard']) assert.ok(keys.includes(must), `the data has ${must}`);
  const empty = { fine: figureOf(hero, 'fine').parts.length, coarse: figureOf(hero, 'coarse').parts.length };
  for (const key of keys) {
    for (const detail of ['fine', 'coarse']) {
      const f = withCarry(key, detail);
      assert.ok(f.parts.length > empty[detail], `${key} (${detail}): the hands are not empty`);
      assert.ok(carryParts(f).length > 0, `${key} (${detail}): the parts of the thing`);
      assert.ok(HOLDS.includes(f.hold), `${key} (${detail}): a way to hold it`);
    }
  }
});

test('the way of holding follows the shape: a rod in one hand, a bundle in two, pails on a pole, a stake on the shoulder', () => {
  const fine = (k) => withCarry(k, 'fine');
  assert.equal(fine('rod').hold, 'hand');
  assert.ok(carryParts(fine('rod')).every((p) => p.parent === 'handR'), 'the rod is in the right hand');
  assert.equal(fine('rice-1').hold, 'hand');
  assert.equal(fine('bundle-2').hold, 'front');
  assert.equal(fine('bundle-5').hold, 'front');
  assert.equal(fine('lo-5').hold, 'front');
  assert.equal(fine('stones-5').hold, 'front');
  assert.equal(fine('duck').hold, 'front');
  assert.equal(fine('pails-1').hold, 'yoke');
  assert.equal(fine('stake').hold, 'shoulder');
  assert.equal(fine('plank-4').hold, 'shoulder');
  // The size rule (data/figures.json, carry) with no hold in the look.
  assert.equal(holdOf({ parts: [{ name: 'a', size: [0.2, 0.2, 1], color: 'ink', at: [0, 0, 0], parent: 'body' }] }, figures.carry), 'hand');
  assert.equal(holdOf({ parts: [{ name: 'a', size: [0.3, 3, 0.3], color: 'ink', at: [0, 0, 0], parent: 'body' }] }, figures.carry), 'shoulder');
  assert.equal(holdOf({ parts: [{ name: 'a', size: [1.2, 1, 1.2], color: 'ink', at: [0, 0, 0], parent: 'body' }] }, figures.carry), 'front');
  // A bundle of five is bigger in the hands than a bundle of two: the child sees the size.
  const width = (k) => Math.max(...carryParts(fine(k)).map((p) => p.size[0]));
  assert.ok(width('bundle-5') > width('bundle-2'));
});

test('the tools of the people stay in the hand: a staff, a net, a torch', () => {
  for (const tool of ['staff', 'net', 'torch', 'lantern']) {
    const f = figureOf({ ...hero, item: tool, carried: lookOf(tool) ?? {} }, 'fine');
    assert.equal(f.hold, null, tool);
    assert.ok(f.parts.some((p) => p.name === 'item'), tool);
  }
});

test('a pick-up flies from the ground to the hands, and a put-down flies back to the place', () => {
  const holding = new Map();
  const thing = { id: 'rod:1', look: 'rod', item: { held: null }, position: { x: 10, y: 4, z: 10 } };
  const hero1 = { id: 'hero', position: { x: 12, y: 4, z: 10, facing: 0 } };
  assert.deepEqual(trackCarries(holding, [hero1, thing], 1, false), []);
  // The pick-up.
  thing.item.held = 'hero';
  thing.hidden = true;
  const picked = trackCarries(holding, [{ ...hero1, carry: 'rod' }, thing], 2);
  assert.equal(picked.length, 1);
  assert.deepEqual(picked[0].from, { x: 10, y: 4, z: 10 });
  assert.deepEqual(picked[0].to, handOf(hero1));
  assert.equal(picked[0].pick, true);
  assert.equal(picked[0].steps, FLIGHT_STEPS);
  // The arc: over the straight line in the middle, at the ends at its ends, and over at the end.
  const mid = flightAt(picked[0], 2 + FLIGHT_STEPS / 2);
  assert.ok(mid.y > (4 + handOf(hero1).y) / 2 + 1);
  assert.equal(flightAt(picked[0], 2 + FLIGHT_STEPS), null);
  // The put-down: the thing at its new place shows at the end of the flight.
  thing.item.held = null;
  thing.hidden = false;
  thing.position = { x: 14, y: 4, z: 11 };
  const put = trackCarries(holding, [hero1, thing], 20);
  assert.equal(put.length, 1);
  assert.deepEqual(put[0].to, { x: 14, y: 4, z: 11 });
  assert.equal(put[0].hide, 'rod:1');
  assert.equal(put[0].pick, false);
});

test('the action button knows the thing in the hands, and nothing when the hands are empty', async () => {
  // The story with a rod taken back from the mat into the hands (one press at the heap puts a rod
  // on the mat at once, #61).
  const story = JSON.parse(readFileSync(new URL('./stories/trial-teacher-button.json', import.meta.url), 'utf8'));
  let session = null;
  const seen = [];
  const failures = await runHeadless(story, {
    onSession: (s) => {
      session = s;
      s.listen((ev) => {
        if (ev.type === 'pick' || ev.type === 'put') seen.push([ev.type, s.carried()]);
      });
    },
  });
  assert.deepEqual(failures, []);
  assert.ok(seen.some(([type, carry]) => type === 'pick' && carry === 'rod'), 'after a pick-up the button has the rod');
  assert.ok(seen.some(([type, carry]) => type === 'put' && carry === null), 'after a put-down the button has nothing');
  assert.equal(session.carried(), null);
});
