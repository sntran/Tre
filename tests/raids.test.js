import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SLING, raidLevel, flightFor, positionAt, createRaid, stepRaid, along, shoot, predict, barGate,
  callHelper, charge, pour, pullBamboo, setTraps, trapPut, stoneAt,
} from '../src/core/world/raids.js';
import { load } from './helpers.js';

const raids = load('data/raids.json');
const skills = new Set(load('data/skills.json').skills.map((s) => s.id));
const DT = 1 / 30;

// Run the raid for some seconds; return all the events.
function run(raid, seconds, ctx = {}) {
  const out = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) out.push(...stepRaid(raid, DT, typeof ctx === 'function' ? ctx() : ctx));
  return out;
}
// Run until an event comes (or the time is over); return the events up to it.
function until(raid, type, seconds = 60, ctx = {}) {
  const out = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const evs = stepRaid(raid, DT, ctx);
    out.push(...evs);
    if (evs.some((e) => e.type === type)) return out;
  }
  return out;
}
const types = (evs) => evs.map((e) => e.type);
const enemy = (raid, n = 0) => raid.enemies[n];
// A shot from the wall with the pull of a count (the distance along the road, as a whole number).
const shotAt = (raid, e, distance) => shoot(raid, Math.round(distance));

test('the data of the raids: every raid has its places, and every skill is in the skill map', () => {
  for (const [id, r] of Object.entries(raids.raids)) {
    assert.ok(r.map && r.wall && r.gate && r.dir && r.introKey && r.win, id);
    const waves = r.phases ? r.phases.flatMap((p) => p.waves ?? []) : r.waves;
    assert.ok(waves.length > 0, id);
    for (const w of waves) assert.ok(raids.enemies[w.kind], `${id}: ${w.kind}`);
  }
  for (const k of raids.skills.shot) for (const s of Object.values(k)) assert.ok(skills.has(s), s);
  for (const k of ['trap', 'chain']) assert.ok(skills.has(raids.skills[k].skill), k);
  assert.deepEqual(raids.posts, [5, 10, 15, 20]);
  assert.equal(raidLevel(raids, 1), 0, 'grade 1 is the lowest level: a lost raid takes nothing');
  assert.equal(raidLevel(raids, 2), 1);
  assert.equal(raidLevel(raids, 5), 2);
});

test('the slingshot: the pull is a count of half blocks, and the stone lands exactly at the count on a real arc', () => {
  for (let n = 1; n <= SLING.max; n++) {
    const f = flightFor(n);
    assert.equal(f.count, n);
    assert.ok(Math.abs(positionAt(f, f.t).d - n) < 1e-9, `count ${n}`);
    assert.ok(Math.abs(positionAt(f, f.t).h) < 1e-9, `count ${n} lands on the ground`);
  }
  assert.equal(flightFor(7.4).count, 7, 'a count is a whole number');
  assert.equal(flightFor(99).count, SLING.max, 'the longest pull');
  // The arc goes up and comes down; a longer count flies longer.
  const f = flightFor(15);
  assert.ok(positionAt(f, f.t / 2).h > SLING.h0);
  assert.ok(flightFor(20).t > flightFor(10).t);
});

test('a stone lands at the count and hits the enemy there; short shows on the road, and the next shot is a correction', () => {
  const raid = createRaid(raids, 'scouts', 1);
  run(raid, 0.1);
  const e = enemy(raid);
  e.state = 'wait';
  e.t = 99; // it stands still for the test
  const d = 20; // at the fourth post
  e.x = raid.wall.x + raid.dir.x * d;
  e.z = raid.wall.z + raid.dir.z * d;
  // The prediction: a tap on the post nearest to the scout, before the first shot.
  const pr = predict(raid, 20);
  assert.deepEqual([pr[0].type, pr[0].post, pr[0].gap], ['predict', 20, d]);
  assert.deepEqual(predict(raid, 15), [], 'one prediction');
  const out = shoot(raid, d);
  assert.deepEqual([out[0].type, out[0].count], ['shoot', d]);
  assert.deepEqual(shoot(raid, d), [], 'the slingshot needs a moment to reload');
  const s = raid.stones[0];
  assert.ok(stoneAt(raid, { ...s, t: s.flight.t / 2 }).h > 2, 'the stone is in the air');
  const evs = until(raid, 'land');
  const land = evs.find((x) => x.type === 'land');
  assert.deepEqual([land.count, land.hit, land.off], [d, true, 0]);
  const hit = evs.find((x) => x.type === 'hit');
  assert.deepEqual([hit.id, hit.damage, hit.left], [e.id, 1, 1]);
  const sk = evs.find((x) => x.type === 'skill');
  assert.deepEqual([sk.skill, sk.solved, sk.efficient, sk.first, sk.level, sk.parts, sk.target], ['math.count.120', true, true, true, 1, [d], d]);
  const pl = evs.find((x) => x.type === 'prediction');
  assert.deepEqual([pl.task, pl.gap, pl.guess, pl.used, pl.solved], ['raid-scouts', d, 20, d, true]);
  // Three short: no hit, the stone lies on the road for a moment, and the next shot at the same
  // enemy is the correction (an addition: from the count to the enemy).
  run(raid, 1);
  shoot(raid, d - 3);
  const miss = until(raid, 'land');
  assert.deepEqual([miss.find((x) => x.type === 'land').off, miss.some((x) => x.type === 'hit')], [-3, false]);
  assert.equal(miss.find((x) => x.type === 'skill').solved, false);
  assert.equal(raid.marks.length, 1, 'the stone lies where it landed');
  assert.ok(!miss.some((x) => x.type === 'prediction'), 'only the first shot carries the prediction');
  run(raid, 1);
  shoot(raid, d);
  const fix = until(raid, 'land').find((x) => x.type === 'skill');
  assert.deepEqual([fix.skill, fix.solved, fix.efficient, fix.first, fix.level, fix.parts, fix.target], ['math.add.20', true, false, false, 1, [d - 3, d], d]);
});

test('a first shot with no tap on a post skips the prediction', () => {
  const raid = createRaid(raids, 'scouts', 1);
  run(raid, 0.1);
  shoot(raid, 10);
  const pl = until(raid, 'land').find((x) => x.type === 'prediction');
  assert.equal(pl.guess, null);
  assert.equal(raid.predict.state, 'skipped');
  assert.deepEqual(predict(raid, 10), [], 'too late for a prediction');
});

test('an enemy hit twice retreats and goes away; an enemy at the gate takes a coin and leaves', () => {
  const raid = createRaid(raids, 'scouts', 1);
  run(raid, 0.1);
  const e = enemy(raid);
  e.state = 'wait';
  e.t = 99;
  shotAt(raid, e, along(raid, e));
  until(raid, 'land');
  run(raid, 1);
  shotAt(raid, e, along(raid, e));
  const evs = until(raid, 'land');
  assert.ok(evs.some((x) => x.type === 'retreat' && x.id === e.id));
  const gone = until(raid, 'gone', 60);
  assert.ok(gone.some((x) => x.type === 'gone' && x.id === e.id));
  // The second scout walks to the gate (the gate is open).
  const walk = until(raid, 'take', 60);
  const take = walk.find((x) => x.type === 'take');
  assert.deepEqual(take.take, { coin: 1 });
  assert.equal(raid.losses >= 1, true);
  // At the lowest level the enemy takes nothing.
  const low = createRaid(raids, 'scouts', 0);
  const t0 = until(low, 'take', 60).find((x) => x.type === 'take');
  assert.deepEqual(t0.take, {});
});

test('enemies walk, never run, on a straight path to the gate', () => {
  const raid = createRaid(raids, 'soldier1', 1);
  run(raid, 0.1);
  const e = enemy(raid);
  const a = { x: e.x, z: e.z };
  run(raid, 1);
  const moved = Math.hypot(e.x - a.x, e.z - a.z);
  assert.ok(Math.abs(moved - raids.enemies.soldier.speed) < 0.05);
  assert.ok(Math.abs(e.x - raid.gate.x) < 1e-6, 'on the path');
  assert.ok(along(raid, e) < along(raid, a), 'toward the gate');
});

test('a trap: a scout on a trap sits down; the trap snaps once; the general breaks a trap', () => {
  const raid = createRaid(raids, 'patrol', 1);
  run(raid, 0.1);
  const e = enemy(raid);
  const at = { x: raid.wall.x + raid.dir.x * 22, z: raid.wall.z };
  setTraps(raid, [{ id: 'trap:1', ...at }]);
  const evs = until(raid, 'snap', 30);
  const snap = evs.find((x) => x.type === 'snap');
  assert.equal(snap.id, e.id);
  assert.equal(snap.sound, 'snap');
  assert.equal(e.state, 'sit');
  assert.ok(!evs.some((x) => x.type === 'skill'), 'a snap is no skill event');
  const x = e.x;
  run(raid, raids.enemies.scout.trap - 0.2);
  assert.equal(e.x, x, 'it sits');
  run(raid, 0.5);
  assert.equal(e.state, 'walk');
  // The trap stays snapped when the world gives the traps again.
  setTraps(raid, [{ id: 'trap:1', ...at }]);
  assert.equal(raid.traps[0].sprung, true);
  // The general does not sit: the trap breaks under him.
  const boss = createRaid(raids, 'boss', 1);
  boss.phase = 1;
  boss.phaseT = 5;
  run(boss, 0.1);
  const g = boss.enemies.find((q) => q.kind === 'general');
  setTraps(boss, [{ id: 'trap:9', x: g.x - 3, z: g.z }]);
  const crush = until(boss, 'crush', 10);
  assert.ok(crush.some((q) => q.type === 'crush'));
  assert.equal(g.state, 'walk');
});

test('the gate bar: a scout lights a torch for two seconds; a barred gate stops it, an open gate lets it in', () => {
  const raid = createRaid(raids, 'scouts', 1);
  const lit = until(raid, 'light', 40);
  const scout = raid.enemies.find((e) => e.id === lit.find((x) => x.type === 'light').id);
  assert.equal(scout.state, 'torch');
  run(raid, 1.9);
  assert.equal(scout.state, 'torch', 'the tell is two seconds');
  // The child bars the gate after the tell: the torch stops on the bar and burns on the road.
  assert.deepEqual(types(barGate(raid)), ['bar']);
  assert.deepEqual(barGate(raid), [], 'the bar is down already');
  const evs = until(raid, 'stop', 5);
  assert.ok(evs.some((x) => x.type === 'throw'));
  const stop = evs.find((x) => x.type === 'stop');
  assert.ok(stop);
  assert.equal(raid.fires.length, 1, 'the torch burns on the road');
  assert.equal(raid.losses, 0);
  assert.ok(!evs.some((x) => x.type === 'skill'), 'the gate is timing: no skill event');
  assert.deepEqual(evs.filter((x) => x.type === 'gated').map((x) => [x.barred, x.afterTell]), [[true, true]]);
  // The bar lifts after some seconds.
  assert.ok(until(raid, 'unbar', 5).some((x) => x.type === 'unbar'));
  // No bar: the torch lands inside, and it costs. With no tap, it is no skill event.
  const open = createRaid(raids, 'scouts', 1);
  const burn = until(open, 'burn', 40);
  assert.ok(burn.some((x) => x.type === 'burn'));
  assert.equal(open.losses, 1);
  assert.ok(!burn.some((x) => x.type === 'skill' || x.type === 'gated'));
});

test('a trap at the post that the villager named is counting; a trap anywhere else is play', () => {
  const raid = createRaid(raids, 'patrol', 1);
  assert.equal(raid.trapPost, 15, 'the third post');
  assert.equal(trapPut(raid, 14), null, 'one step short: play, no event');
  const ev = trapPut(raid, 15);
  assert.deepEqual([ev.type, ev.skill, ev.solved, ev.parts, ev.target, ev.task], ['skill', 'math.count.120', true, [15], 15, 'raid-patrol']);
  assert.equal(trapPut(raid, 15), null, 'once in a raid');
  assert.equal(createRaid(raids, 'scouts', 1).trapPost, null, 'no traps in the first raid');
});

test('the tools come one raid after the other: a tool that is not in the raid is not there', () => {
  const scouts = createRaid(raids, 'scouts', 1);
  assert.deepEqual(scouts.tools, ['sling', 'gate']);
  assert.ok(scouts.bar);
  assert.deepEqual([scouts.spots.length, scouts.helpers, scouts.sources.length, scouts.charge], [0, 0, 0, 'none']);
  run(scouts, 3);
  assert.deepEqual(charge(scouts, scouts.wall), [], 'no charge of Nghé in the first raid');
  assert.deepEqual(pour(scouts, 'jar', scouts.wall), [], 'no water in the first raid');
  const order = ['scouts', 'patrol', 'soldier1', 'soldier2', 'boss'].map((id) => raids.raids[id].tools);
  for (let i = 1; i < order.length; i++) {
    const added = order[i].filter((t) => !order[i - 1].includes(t));
    assert.ok(order[i - 1].every((t) => order[i].includes(t) || t === 'gate'), `raid ${i} keeps the tools before it`);
    assert.ok(added.length >= 1 && added.length <= 2, `raid ${i} adds one or two tools: ${added}`);
  }
  const s2 = createRaid(raids, 'soldier2', 1);
  assert.deepEqual(s2.sources.map((q) => q.kind).sort(), ['fire', 'water'], 'no forge before the boss');
});

test('a villager at a spot stops each enemy for a moment, once', () => {
  const raid = createRaid(raids, 'soldier1', 1);
  const spot = raid.spots[0];
  assert.deepEqual(types(callHelper(raid, spot.id)), ['summon']);
  assert.deepEqual(callHelper(raid, spot.id), [], 'one villager at a spot');
  const evs = until(raid, 'pause', 60);
  assert.ok(evs.some((x) => x.type === 'spot'), 'the villager is at the spot first');
  const e = raid.enemies.find((q) => q.id === evs.find((x) => x.type === 'pause').id);
  assert.equal(e.state, 'wait');
  run(raid, 3);
  assert.equal(e.state, 'walk');
  assert.ok(!run(raid, 2).some((x) => x.type === 'pause' && x.id === e.id), 'once for each spot');
  // No more villagers than the raid has.
  callHelper(raid, raid.spots[1].id);
  assert.equal(raid.helpers, 0);
});

test("Nghé charges once: the first enemy takes a hit and goes back", () => {
  const raid = createRaid(raids, 'soldier1', 1);
  run(raid, 4);
  const first = [...raid.enemies].sort((a, b) => along(raid, a) - along(raid, b))[0];
  const d = along(raid, first);
  assert.deepEqual(types(charge(raid, raid.wall)), ['charge']);
  assert.deepEqual(charge(raid, raid.wall), [], 'once in a raid');
  const evs = run(raid, 1);
  assert.ok(evs.some((x) => x.type === 'butt' && x.id === first.id));
  assert.equal(first.hits, 1);
  run(raid, 3);
  assert.ok(along(raid, first) > d, 'it went back along the road');
});

test('the elements: fire makes a soldier raise his wet shield; lightning into the wet zone shocks them all', () => {
  const raid = createRaid(raids, 'boss', 1);
  run(raid, 6);
  const [a, b] = raid.enemies;
  for (const e of [a, b]) {
    e.state = 'wait';
    e.t = 99;
  }
  // Both stand at the fourth post, in reach of the slingshot.
  a.x = raid.wall.x + raid.dir.x * 20;
  a.z = raid.wall.z + raid.dir.z * 20;
  b.x = a.x;
  b.z = a.z + 1;
  // Fire at the two soldiers: they raise wet shields, and the shields drip.
  const fire = pour(raid, 'brazier', { x: a.x, z: a.z });
  assert.deepEqual(types(fire).filter((t) => t === 'shield').length, 2);
  assert.ok(a.shield > 0 && b.shield > 0);
  assert.equal(raid.wet.length, 2);
  // A stone bounces off a raised shield.
  shotAt(raid, a, along(raid, a));
  const bounce = until(raid, 'land');
  assert.ok(bounce.some((x) => x.type === 'block'));
  assert.equal(a.hits, 0);
  // Lightning on dry ground is only a spark.
  const spark = pour(raid, 'forge', { x: a.x + 20, z: a.z });
  assert.ok(spark.some((x) => x.type === 'spark'));
  assert.equal(spark.find((x) => x.type === 'skill').solved, false);
  run(raid, 7);
  // Lightning into the wet zone: both soldiers are shocked.
  const shock = pour(raid, 'forge', { x: a.x, z: a.z });
  assert.deepEqual(shock.find((x) => x.type === 'shock').shocked.sort(), [a.id, b.id].sort());
  assert.equal(a.hits, 1);
  assert.equal(b.hits, 1);
  const sk = shock.find((x) => x.type === 'skill');
  assert.deepEqual([sk.skill, sk.solved, sk.efficient], ['sci.matter.states', true, true]);
  // Water puts out a fire on the road.
  const s = createRaid(raids, 'soldier2', 1);
  const road = { x: s.wall.x + s.dir.x * 10, z: s.wall.z + s.dir.z * 10 };
  s.fires.push({ id: 'fire:x', ...road, t: 5 });
  const w = pour(s, 'jar', road);
  assert.deepEqual(w.find((x) => x.type === 'water').out, ['fire:x']);
  assert.equal(s.fires.length, 0);
  assert.equal(s.wet.length, 1);
});

test('a raid is won when the enemies are turned back, and lost when too many reach the gate', () => {
  // Every scout is hit twice as it comes.
  const raid = createRaid(raids, 'scouts', 1);
  const all = [];
  for (let i = 0; i < 120 * 30 && !raid.result; i++) {
    all.push(...stepRaid(raid, DT));
    const e = raid.enemies.find((q) => q.state === 'walk' && along(raid, q) < 26);
    if (e && raid.reload <= 0 && !raid.stones.length) shotAt(raid, e, along(raid, e) - raids.enemies.scout.speed * 0.9);
  }
  const end = all.find((x) => x.type === 'end');
  assert.equal(end.won, true);
  assert.equal(raid.result, 'won');
  // Nobody stops them: they reach the gate, and the raid is lost.
  const lost = createRaid(raids, 'scouts', 1);
  const evs = run(lost, 150);
  assert.equal(evs.find((x) => x.type === 'end').won, false);
  assert.ok(lost.taken.coin >= 2);
  assert.deepEqual(run(lost, 1), [], 'a raid that is over does not go on');
});

test('the boss: soldiers, then the general, then the iron staff breaks, and the bamboo ends the raid', () => {
  const raid = createRaid(raids, 'boss', 2);
  const hero = { x: raid.wall.x, z: raid.wall.z };
  const hitAll = () => {
    const e = raid.enemies.find((q) => q.state !== 'retreat' && q.state !== 'stunned' && q.state !== 'gone' && along(raid, q) <= 28);
    if (e && raid.reload <= 0 && !raid.stones.length) {
      e.state = 'wait';
      e.t = 5;
      shotAt(raid, e, along(raid, e));
    }
  };
  const evs = [];
  const tick = () => {
    evs.push(...stepRaid(raid, DT, { hero }));
    hitAll();
  };
  for (let i = 0; i < 90 * 30 && raid.phases[raid.phase].id === 'soldiers'; i++) tick();
  assert.equal(raid.phases[raid.phase].id, 'general');
  assert.ok(evs.some((x) => x.type === 'phase' && x.phase === 'general'));
  for (let i = 0; i < 90 * 30 && raid.phases[raid.phase].id === 'general'; i++) tick();
  const g = raid.enemies.find((q) => q.kind === 'general');
  assert.equal(g.state, 'stunned', 'the general stands after his last hit');
  const staff = evs.find((x) => x.type === 'phase' && x.phase === 'staff');
  assert.equal(staff.dialogue, 'staff.breaks');
  assert.ok(raid.bamboo && !raid.bamboo.pulled);
  // The raid waits for the bamboo.
  assert.equal(raid.result, null);
  run(raid, 5, { hero });
  assert.equal(raid.result, null);
  const pulled = pullBamboo(raid);
  assert.equal(pulled.find((x) => x.type === 'phase').dialogue, 'bamboo.found');
  assert.ok(pulled.some((x) => x.type === 'strike'));
  assert.ok(pulled.some((x) => x.type === 'retreat' && x.id === g.id));
  assert.equal(pulled.find((x) => x.type === 'end').won, true);
  assert.deepEqual(pullBamboo(raid), [], 'once');
});

test('the general lifts his sword before a big blow; the hero in reach is pushed back', () => {
  const raid = createRaid(raids, 'boss', 1);
  raid.phase = 1;
  const hero = { x: raid.wall.x, z: raid.wall.z };
  const evs = until(raid, 'sword', 90, { hero });
  const g = raid.enemies.find((q) => q.kind === 'general');
  assert.equal(g.state, 'sword');
  assert.ok(evs.some((x) => x.type === 'sword'));
  const blow = until(raid, 'hurt', 3, { hero });
  const hurt = blow.find((x) => x.type === 'hurt');
  assert.equal(hurt.id, 'hero');
  assert.ok(Math.hypot(hurt.push.x, hurt.push.z) > 2);
});

test('a lost raid comes again at the next dawn; the river serpents eat rice balls', async () => {
  const { nextDawn } = await import('../src/core/session.js');
  assert.equal(nextDawn(600), 1440 + 360, 'a loss at 10:00: the dawn of the next day');
  assert.equal(nextDawn(300), 360, 'a loss at 05:00: the dawn of the same day');
  assert.equal(nextDawn(360), 1440 + 360, 'at dawn itself: the next one');
  const river = createRaid(raids, 'river', 1);
  assert.equal(river.ball, 'riceball');
  run(river, 0.1);
  const e = enemy(river);
  e.state = 'wait';
  e.t = 99;
  e.x = river.wall.x + river.dir.x * 10;
  e.z = river.wall.z + river.dir.z * 10;
  shoot(river, 10);
  const hit = until(river, 'land').find((x) => x.type === 'hit');
  assert.deepEqual([hit.by, hit.sound], ['riceball', 'pickup']);
});
