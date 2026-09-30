import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SLING, raidLevel, shotOf, positionAt, landingOf, pullFor, previewOf, createRaid, stepRaid, along, shoot, barGate,
  callHelper, charge, pour, pullBamboo, setTraps, stoneAt,
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
// A shot from the wall at an enemy, with the pull for a distance.
const shotAt = (raid, e, distance) => shoot(raid, raid.wall, { x: e.x - raid.wall.x, z: e.z - raid.wall.z }, pullFor(distance, raid.sling));

test('the data of the raids: every raid has its places, and every skill is in the skill map', () => {
  for (const [id, r] of Object.entries(raids.raids)) {
    assert.ok(r.map && r.wall && r.gate && r.dir && r.introKey && r.win, id);
    const waves = r.phases ? r.phases.flatMap((p) => p.waves ?? []) : r.waves;
    assert.ok(waves.length > 0, id);
    for (const w of waves) assert.ok(raids.enemies[w.kind], `${id}: ${w.kind}`);
  }
  for (const k of raids.skills.shot) for (const s of Object.values(k)) assert.ok(skills.has(s), s);
  for (const k of ['trap', 'gate', 'chain']) assert.ok(skills.has(raids.skills[k].skill), k);
  assert.deepEqual(raids.posts, [5, 10, 15, 20]);
  assert.equal(raidLevel(raids, 1), 0, 'grade 1 is the lowest level: a lost raid takes nothing');
  assert.equal(raidLevel(raids, 2), 1);
  assert.equal(raidLevel(raids, 5), 2);
});

test('the slingshot: a real arc, and the pull for a distance lands the stone there', () => {
  for (const d of [5, 10, 15, 20, 28]) {
    const shot = shotOf(pullFor(d));
    assert.ok(Math.abs(landingOf(shot).d - d) < 1e-6, `distance ${d}`);
  }
  // More pull, farther; the full pull is the longest shot.
  const a = landingOf(shotOf(0.4)).d;
  const b = landingOf(shotOf(0.6)).d;
  const full = landingOf(shotOf(1)).d;
  assert.ok(a < b && b < full);
  assert.equal(landingOf(shotOf(3)).d, full, 'a pull longer than the full pull is a full pull');
  assert.ok(full > 30, 'the full pull goes past the last post');
  // The arc goes up and comes down: the top is over the start, and the end is on the ground.
  const shot = shotOf(pullFor(15));
  const land = landingOf(shot);
  const top = positionAt(shot, land.t / 2);
  assert.ok(top.h > SLING.h0);
  assert.ok(Math.abs(positionAt(shot, land.t).h) < 1e-6);
  // The dotted line shows only the first part of the arc, not the landing point.
  const pts = previewOf(shot);
  assert.ok(pts[pts.length - 1].d < land.d / 2);
});

test('a stone lands where the arc ends and hits the enemy there; a miss by a little hits nothing', () => {
  const raid = createRaid(raids, 'scouts', 1);
  run(raid, 0.1);
  const e = enemy(raid);
  e.state = 'wait';
  e.t = 99; // it stands still for the test
  const d = along(raid, e);
  assert.deepEqual(types(shotAt(raid, e, d)), ['shoot']);
  assert.deepEqual(shotAt(raid, e, d), [], 'the slingshot needs a moment to reload');
  const s = raid.stones[0];
  assert.ok(Math.abs(s.land.x - e.x) < 1e-6 && Math.abs(s.land.z - e.z) < 1e-6);
  const mid = stoneAt(raid, { ...s, t: s.land.t / 2 });
  assert.ok(mid.h > 2, 'the stone is in the air');
  const evs = until(raid, 'land');
  const hit = evs.find((x) => x.type === 'hit');
  assert.equal(hit.id, e.id);
  assert.equal(hit.damage, 1);
  assert.equal(hit.left, 1);
  const sk = evs.find((x) => x.type === 'skill');
  assert.deepEqual([sk.skill, sk.solved, sk.efficient, sk.first, sk.level], ['math.count.120', true, true, true, 2]);
  // Short by three: no hit, and the next shot at the same enemy is a correction.
  run(raid, 1);
  shotAt(raid, e, d - 3);
  const miss = until(raid, 'land');
  assert.ok(!miss.some((x) => x.type === 'hit'));
  assert.equal(miss.find((x) => x.type === 'skill').solved, false);
  run(raid, 1);
  shotAt(raid, e, d);
  const fix = until(raid, 'land').find((x) => x.type === 'skill');
  assert.deepEqual([fix.skill, fix.solved, fix.efficient, fix.first, fix.level], ['math.add.20', true, false, false, 1]);
  assert.deepEqual(fix.parts, [Math.round(d - 3), Math.round(d)]);
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
  const raid = createRaid(raids, 'scouts', 1);
  run(raid, 0.1);
  const e = enemy(raid);
  const at = { x: raid.wall.x + raid.dir.x * 22, z: raid.wall.z };
  setTraps(raid, [{ id: 'trap:1', ...at }]);
  const evs = until(raid, 'snap', 30);
  const snap = evs.find((x) => x.type === 'snap');
  assert.equal(snap.id, e.id);
  assert.equal(snap.sound, 'snap');
  assert.equal(e.state, 'sit');
  const sk = evs.find((x) => x.type === 'skill');
  assert.deepEqual([sk.skill, sk.solved, sk.task], ['math.count.120', true, 'raid-scouts']);
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
  const sk = evs.find((x) => x.type === 'skill');
  assert.deepEqual([sk.skill, sk.solved, sk.efficient], ['math.count.120', true, true]);
  // The bar lifts after some seconds.
  assert.ok(until(raid, 'unbar', 5).some((x) => x.type === 'unbar'));
  // No bar: the torch lands inside, and it costs. With no tap, it is no skill event.
  const open = createRaid(raids, 'scouts', 1);
  const burn = until(open, 'burn', 40);
  assert.ok(burn.some((x) => x.type === 'burn'));
  assert.equal(open.losses, 1);
  assert.ok(!burn.some((x) => x.type === 'skill'));
});

test('a villager at a spot stops each enemy for a moment, once', () => {
  const raid = createRaid(raids, 'scouts', 1);
  const spot = raid.spots[0];
  assert.deepEqual(types(callHelper(raid, spot.id)), ['call']);
  assert.deepEqual(callHelper(raid, spot.id), [], 'one villager at a spot');
  const evs = until(raid, 'pause', 30);
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
  const raid = createRaid(raids, 'soldier1', 1);
  run(raid, 6);
  const [a, b] = raid.enemies;
  for (const e of [a, b]) {
    e.state = 'wait';
    e.t = 99;
  }
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
  const s = createRaid(raids, 'scouts', 1);
  s.fires.push({ id: 'fire:x', x: 140, z: 58, t: 5 });
  const w = pour(s, 'jar', { x: 140, z: 58 });
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
    const e = raid.enemies.find((q) => q.state !== 'retreat' && q.state !== 'stunned' && q.state !== 'gone');
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
