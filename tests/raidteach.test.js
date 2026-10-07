// The first raid of a tool waits for the child (#50): with a new slingshot, the first enemy stops on
// the road until the first hit; with new traps, no enemy comes until the child has a trap in the
// hands. The big button is the slingshot when nothing else is in reach: hold it, and let go.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRaid, stepRaid, shoot, releaseHold, along, HOLD_AT } from '../src/core/world/raids.js';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';

const raids = load('data/raids.json');
const run = (raid, seconds, ctx = {}) => {
  const out = [];
  for (let t = 0; t < seconds; t += 1 / 30) out.push(...stepRaid(raid, 1 / 30, ctx));
  return out;
};

test('the first raid of the slingshot: the first enemy stops on the road and waits for the first hit; no other wave comes', () => {
  const raid = createRaid(raids, 'river', 0, null, ['sling']);
  assert.deepEqual(raid.hold, { tool: 'sling' });
  const evs = run(raid, 90);
  assert.equal(raid.enemies.length, 1, 'one enemy, no other wave');
  assert.ok(Math.abs(along(raid, raid.enemies[0]) - HOLD_AT) < 1, 'the enemy waits on the road');
  assert.ok(!evs.some((ev) => ev.type === 'gate' || ev.type === 'take'), 'nothing reaches the gate');
  shoot(raid, 4);
  run(raid, 4);
  assert.deepEqual(raid.hold, { tool: 'sling' }, 'a short shot: the enemy still waits');
  shoot(raid, HOLD_AT);
  run(raid, 4);
  assert.equal(raid.hold, null, 'the first hit: the raid goes on');
  run(raid, 20);
  assert.ok(raid.enemies.length >= 2, 'the next wave comes');
  // A raid that the child knew before does not wait.
  const known = createRaid(raids, 'river', 0, null, []);
  assert.equal(known.hold, null);
});

test('the first raid of the traps: no enemy comes until the child has a trap in the hands', () => {
  const raid = createRaid(raids, 'soldier1', 0, null, ['traps', 'helpers', 'nghe']);
  assert.deepEqual(raid.hold, { tool: 'traps' });
  run(raid, 40);
  assert.equal(raid.enemies.length, 0);
  assert.deepEqual(releaseHold(raid, 'sling'), [], 'another tool does not let it go');
  assert.equal(releaseHold(raid, 'traps').length, 1);
  run(raid, 5);
  assert.ok(raid.enemies.length >= 1, 'the soldiers come');
});

test('the big button is the slingshot: each press is one post, the posts up to the pull light up, and the stone flies one second after the last press (#55)', async () => {
  let session = null;
  const events = [];
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'giong.spoke': true } };
  // The serpent waits at HOLD_AT half blocks from the wall: the fourth post. Four presses reach it.
  const posts = HOLD_AT / 5;
  const press = { do: { type: 'hands' } };
  const failures = await runHeadless({ name: 'raid-button', profile, clock: 540, at: ['phu-dong', 14, 61], steps: [
    { press: { entity: 'encounter:river' } },
    { until: { event: 'open', with: { screen: 'say' }, timeout: 20 } },
    { read: true },
    { wait: 2 },
    { expect: [{ raid: { on: true, enemies: 1 } }] },
    // The child waits: the serpent stops on the road and waits.
    { wait: 40 },
    { expect: [{ raid: { on: true, enemies: 1 } }, { event: 'gate', not: true }] },
    // One press: a pull to the first post. No stone flies before one second.
    press, { wait: 0.5 },
    { expect: [{ event: 'shoot', not: true }] },
    { until: { event: 'shoot', timeout: 3 } },
    { wait: 3 },
    // As many presses as the post of the serpent, a little apart: the rice ball reaches it.
    ...Array.from({ length: posts }, () => [press, { wait: 0.6 }]).flat(),
    { until: { event: 'hit', timeout: 8 } },
  ] }, { onSession: (s) => { session = s; s.listen((ev) => events.push(ev)); } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const shots = events.filter((ev) => ev.type === 'shoot').map((ev) => ev.count);
  assert.deepEqual(shots, [5, HOLD_AT], 'one press is one post; four presses are four posts');
  void session;
});

test('while the child presses, the posts up to the pull light up and a ring lies on the road at the count (#55)', async () => {
  const { setupRaid } = await import('../src/core/world/systems/raid.js');
  const { raid: raidSystem } = await import('../src/core/world/systems/raid.js');
  const { createWorldState, getEntity, query } = await import('../src/core/world/state.js');
  const r = createRaid(raids, 'river', 0, null, []);
  const w = createWorldState({ seed: 1, map: 'phu-dong', clock: { minutes: 600 } });
  setupRaid(w, r, raids.raids.river, { groundY: () => 0 }, {});
  const live = getEntity(w, 'raid').raid;
  live.predict.state = 'skipped';
  live.pull = 10;
  raidSystem(w, 1 / 30, null, { groundY: () => 0 });
  const looks = query(w, 'raidThing').filter((e) => String(e.id).startsWith('post:')).sort((a, b) => a.id.localeCompare(b.id)).map((e) => e.look);
  assert.deepEqual(looks, ['post-1-on', 'post-2-on', 'post-3', 'post-4']);
  const ring = getEntity(w, 'ring:pull');
  assert.ok(ring && ring.look === 'pull-ring' && Math.abs(ring.position.x - (live.wall.x + live.dir.x * 10)) < 1e-6, 'the ring at the count');
  // Before the first shot the posts wait for a tap (yellow caps); a pull lights them all the same
  // (the play of #55: four presses before the first shot showed no lit post).
  live.predict.state = 'pending';
  live.pull = 15;
  raidSystem(w, 1 / 30, null, { groundY: () => 0 });
  const first = query(w, 'raidThing').filter((e) => String(e.id).startsWith('post:')).sort((a, b) => a.id.localeCompare(b.id)).map((e) => e.look);
  assert.deepEqual(first, ['post-1-on', 'post-2-on', 'post-3-on', 'post-4-lit']);
});

test('in the raid of the general, Gióng rides his iron horse beside the road, away from the jar, the brazier, the forge, and the flags (#50)', async () => {
  const { companionSpot, setupRaid } = await import('../src/core/world/systems/raid.js');
  const { createWorldState, getEntity } = await import('../src/core/world/state.js');
  const { STEED_SEAT } = await import('../src/world/figures.js');
  const def = raids.raids.boss;
  assert.equal(def.steed, STEED_SEAT / 2, 'the seat of Gióng is the top of the back of the horse');
  // The horse is as big as grown Gióng: the seat is near the height of his hips, so his feet hang at
  // the sides of the horse and do not touch the ground (a small horse hides under his legs).
  const { figureOf } = await import('../src/world/figures.js');
  const giong = figureOf(load('data/figures.json').figures['giong-hero'], 'coarse');
  const tall = giong.height * giong.scale * (giong.grid ?? 0.5);
  assert.ok(def.steed >= 0.4 * tall, `the seat ${def.steed} is at the hips of Gióng (${tall.toFixed(2)} tall)`);
  const raid = createRaid(raids, 'boss', 0, null, []);
  const w = createWorldState({ seed: 1, map: 'trau-son', clock: { minutes: 600 } });
  setupRaid(w, raid, def, { groundY: () => 0 }, { companion: 'giong-hero' });
  const g = getEntity(w, 'companion:raid');
  const horse = getEntity(w, 'steed:raid');
  assert.ok(horse && horse.look === 'iron-steed', 'the iron horse is there');
  assert.equal(g.riding, def.steed);
  assert.deepEqual({ x: horse.position.x, z: horse.position.z }, { x: g.position.x, z: g.position.z });
  // Nothing of the raid is under the horse: its head and its tail reach STEED_SEAT * 1.25 from
  // the middle.
  for (const s of [...raid.sources, ...raid.spots]) {
    assert.ok(Math.hypot(s.x - g.position.x, s.z - g.position.z) >= STEED_SEAT * 1.25 + 1, `${s.id} is far from Gióng and his horse`);
  }
  assert.deepEqual(companionSpot(raid), companionSpot(raid), 'the same place each time');
});
