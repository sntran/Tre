import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, shotFromDrag, positionAt, landingTime, flight, speedFor, previewPoints, heightAt } from '../prototype/slingshot/physics.js';
import { RULES, hitTest, aimedTarget, isGuarded, hintFor, skillEvent, makeLevel, createBattle, markersFor } from '../prototype/slingshot/battle.js';
import { createRng } from '../src/core/rng.js';
import { load } from './helpers.js';

const deg = (d) => (d * Math.PI) / 180;
const shotTo = (distance, angle) => ({ speed: speedFor(distance, deg(angle)), angle: deg(angle) });
const levels = load('prototype/slingshot/levels.json');

// Flight formula

test('flight: with no height, the range is v² sin(2θ) / g', () => {
  const flat = { ...PHYSICS, h0: 0 };
  for (const [v, a] of [[10, 45], [15, 30], [20, 60]]) {
    const shot = { speed: v, angle: deg(a) };
    const expectedRange = (v * v * Math.sin(2 * deg(a))) / flat.g;
    assert.ok(Math.abs(flight(shot, {}, flat).landX - expectedRange) < 1e-9, `${v} at ${a}°`);
  }
});

test('flight: the stone lands where the formula says, from the slingshot height', () => {
  for (const d of [5, 7, 13, 18, 25, 30]) {
    for (const a of [20, 35, 45, 60]) {
      const shot = shotTo(d, a);
      const fl = flight(shot);
      assert.ok(Math.abs(fl.landX - d) < 1e-9, `${d} at ${a}°: ${fl.landX}`);
      assert.ok(Math.abs(positionAt(shot, landingTime(shot)).y) < 1e-9, 'y is 0 at the landing time');
    }
  }
  // A full pull reaches past the last marker of level 3.
  assert.ok(flight({ speed: PHYSICS.vMax, angle: deg(45) }).landX > 30);
});

test('flight: the stone bounces one time and stops a little farther', () => {
  const shot = shotTo(12, 40);
  const fl = flight(shot);
  assert.ok(fl.stopX > fl.landX && fl.stopX < fl.landX + 3, `stop at ${fl.stopX}`);
  assert.ok(fl.stopT > fl.landT);
  const before = fl.at(fl.landT - 1e-6);
  const after = fl.at(fl.landT + 1e-6);
  assert.ok(Math.abs(before.x - after.x) < 1e-3 && Math.abs(before.y - after.y) < 1e-3, 'no jump at the bounce');
  for (let t = 0; t <= fl.stopT + 0.5; t += 0.01) assert.ok(fl.at(t).y >= -1e-9);
  assert.deepEqual(fl.at(fl.stopT + 5), fl.at(fl.stopT));
});

test('flight: a pull back and down shoots up and forward; power follows the pull length', () => {
  const full = shotFromDrag(-Math.SQRT1_2 * 3, -Math.SQRT1_2 * 3, 3);
  assert.ok(Math.abs(full.speed - PHYSICS.vMax) < 1e-9);
  assert.ok(Math.abs(full.angle - deg(45)) < 1e-9);
  const half = shotFromDrag(-1.5, 0, 3);
  assert.ok(Math.abs(half.speed - PHYSICS.vMax / 2) < 1e-9);
  assert.equal(half.angle, PHYSICS.minAngle, 'a flat pull gives the lowest angle');
  assert.equal(shotFromDrag(2, 1, 3).angle, PHYSICS.maxAngle, 'a pull forward gives the steepest angle');
  assert.equal(shotFromDrag(-10, -10, 3).power, 1, 'a long pull is a full pull');
  // The preview shows only the first part of the arc.
  const pts = previewPoints(shotTo(15, 45));
  assert.ok(pts[pts.length - 1].x < 15 / 3);
});

test('flight: a low wall stops a low shot; a high shot goes over it', () => {
  const wall = { x: 11.5, height: levels.levels["2"].wall.height };
  const low = flight(shotTo(13, 12), { wall });
  assert.equal(low.blocked, true);
  assert.ok(low.landX < wall.x);
  const high = flight(shotTo(13, 60), { wall });
  assert.equal(high.blocked, false);
  assert.ok(Math.abs(high.landX - 13) < 1e-9);
  assert.ok(heightAt(shotTo(13, 60), wall.x) > wall.height);
  // A middle arc of 45 degrees does not pass: the wall needs a higher arc.
  assert.equal(flight(shotTo(13, 45), { wall }).blocked, true);
});

// Hit test and combo rule

const enemy = (x, id = x) => ({ id, x, hp: 2 });

test('hit test: a stone that lands within 0.5 of an enemy hits it', () => {
  const es = [enemy(7), enemy(13)];
  for (const [land, hitX] of [[13, 13], [12.6, 13], [13.5, 13], [7.4, 7], [12.4, null], [10, null]]) {
    const shot = shotTo(land, 60);
    const r = hitTest(shot, flight(shot), es);
    assert.equal(r.primary?.x ?? null, hitX, `lands at ${land}`);
  }
  // Two enemies near: the nearer one.
  const close = [enemy(12), enemy(13)];
  const shot = shotTo(12.6, 60);
  assert.equal(hitTest(shot, flight(shot), close).primary.x, 13);
  // A retreating enemy is not hit.
  assert.equal(hitTest(shotTo(13, 60), flight(shotTo(13, 60)), [{ ...enemy(13), hp: 0 }]).primary, null);
});

test('combo: a low stone that passes through one enemy and lands on the next hits both', () => {
  const es = [enemy(12), enemy(14)];
  const low = shotTo(14, 12);
  assert.ok(heightAt(low, 12) <= RULES.enemyHeight, 'the low stone is at body height at 12');
  const r = hitTest(low, flight(low), es);
  assert.equal(r.primary.x, 14);
  assert.deepEqual(r.combo.map((e) => e.x), [12, 14]);
  // A high stone goes over the first enemy: no combo.
  const high = shotTo(14, 60);
  assert.deepEqual(hitTest(high, flight(high), es).combo, []);
  // A low stone that passes an enemy but lands on no one: the enemy ducks, no hit.
  const miss = shotTo(16, 10);
  const m = hitTest(miss, flight(miss), es);
  assert.equal(m.primary, null);
  assert.ok(m.ducks.length > 0);
});

// Skill event rule

test('skill events: the first shot finds the number, the next shot corrects by the gap', () => {
  const target = enemy(13);
  const first = skillEvent({ landX: 11.2, target, previous: null });
  assert.deepEqual(first, { skill: 'math.count.120', level: 1, correct: false, target: 13, landed: 11.2, previous: null, gap: null });
  const second = skillEvent({ landX: 13.3, target, previous: 11.2 });
  assert.equal(second.skill, 'math.add.20');
  assert.equal(second.correct, true);
  assert.equal(second.gap, 2, 'the gap from the last landing to the target');
  assert.equal(skillEvent({ landX: 12.4, target }).correct, false, '0.6 away is not correct');
  assert.equal(skillEvent({ landX: 26, target: enemy(25) }).level, 2, 'a target past 20 is a harder count');
  // The target is the enemy nearest to the landing point.
  assert.equal(aimedTarget(9.9, [enemy(7), enemy(13)]).x, 7);
  assert.equal(aimedTarget(10.1, [enemy(7), enemy(13)]).x, 13);
  // The skills are in the skill graph.
  const skills = load('data/skills.json').skills.map((s) => s.id);
  assert.ok(skills.includes('math.count.120') && skills.includes('math.add.20'));
});

// Guard and hint rules

test('guard: a tap in the last second before the throw blocks it', () => {
  assert.equal(isGuarded([9.2], 10), true);
  assert.equal(isGuarded([9.0], 10), true);
  assert.equal(isGuarded([8.9], 10), false, 'too early');
  assert.equal(isGuarded([10.1], 10), false, 'after the throw');
  assert.equal(isGuarded([], 10), false);
});

test('Nghé points at the nearest marker after 2 misses, and stamps the distance after 3', () => {
  const markers = markersFor(20);
  assert.deepEqual(markers, [5, 10, 15, 20]);
  assert.deepEqual(hintFor(1, 13, markers), { kind: 'none' });
  assert.deepEqual(hintFor(2, 13, markers), { kind: 'point', at: 15 });
  assert.deepEqual(hintFor(2, 7, markers), { kind: 'point', at: 5 });
  assert.deepEqual(hintFor(3, 13, markers), { kind: 'stamp', at: 13 });
});

// Levels and the battle

test('levels: the world gets harder, not the numbers in a box', () => {
  for (let seed = 0; seed < 50; seed++) {
    for (const [n, def] of Object.entries(levels.levels)) {
      const lv = makeLevel(def, levels.enemyTypes, createRng(`lv${n}:${seed}`));
      assert.equal(lv.enemies.length, def.kinds.length);
      for (const e of lv.enemies) {
        assert.ok(Number.isInteger(e.x) && e.x >= def.min && e.x <= def.max, `level ${n}: ${e.x}`);
      }
      lv.enemies.forEach((e, i) => { if (i) assert.ok(e.x - lv.enemies[i - 1].x >= 2); });
      if (n === '2') assert.ok(lv.wall && lv.wall.x < lv.enemies.find((e) => e.id === lv.wall.enemy).x);
      if (n === '3') assert.ok(lv.enemies.some((e) => e.mover));
    }
  }
  assert.ok(levels.levels['3'].period < levels.levels['1'].period, 'faster counts');
  assert.deepEqual(markersFor(levels.levels['3'].field), [5, 10, 15, 20, 25, 30]);
});

function run(b, seconds, step = 1 / 60) {
  const events = [];
  for (let t = 0; t < seconds; t += step) events.push(...b.update(step));
  return events;
}

test('battle: hits, misses, hints, skill events, and a win', () => {
  const b = createBattle({ def: levels.levels['1'], types: levels.enemyTypes, rng: createRng('b1') });
  const [near, far] = b.state.enemies;
  // A miss short of the near enemy, two times: then Nghé points.
  const events = [];
  for (let i = 0; i < 2; i++) {
    b.shoot(shotTo(near.x - 2, 45));
    events.push(...run(b, 2));
  }
  assert.equal(events.filter((e) => e.type === 'miss').length, 2);
  assert.deepEqual(events.filter((e) => e.type === 'skill').map((e) => e.event.skill), ['math.count.120', 'math.add.20']);
  // A hit after the misses is a correction. The shot after a hit finds the number again.
  b.shoot(shotTo(near.x, 50));
  const hitEvents = run(b, 2);
  assert.equal(hitEvents.find((e) => e.type === 'skill').event.skill, 'math.add.20');
  assert.equal(hitEvents.find((e) => e.type === 'skill').event.correct, true);
  b.shoot(shotTo(near.x, 50));
  const againEvents = run(b, 2);
  assert.equal(againEvents.find((e) => e.type === 'skill').event.skill, 'math.count.120');
  events.push(...hitEvents, ...againEvents);
  assert.equal(events.find((e) => e.type === 'hint').kind, 'point');
  // Hits until both enemies retreat.
  let guard = 0;
  while (b.state.phase === 'play' && guard++ < 20) {
    const target = b.state.enemies.find((e) => e.hp > 0);
    b.shoot(shotTo(target.x, 50));
    events.push(...run(b, 2));
    b.guard();
  }
  assert.equal(b.state.phase, 'won');
  assert.ok(events.some((e) => e.type === 'retreat' && e.enemy === far));
  const hits = events.filter((e) => e.type === 'skill' && e.event.correct);
  assert.ok(hits.length >= 4);
});

test('battle: enemies throw on their count; a guard blocks; 5 hurts lose; Nghé comes once', () => {
  const b = createBattle({ def: levels.levels['1'], types: levels.enemyTypes, rng: createRng('b2') });
  const first = b.state.enemies[0];
  assert.ok(b.countOf(first) > 3, 'a slow count at the start');
  // Guard just before the first throw.
  run(b, first.nextThrow - 0.5);
  assert.equal(b.guard(), true);
  let events = run(b, 1.5);
  assert.ok(events.some((e) => e.type === 'throw'));
  assert.ok(events.some((e) => e.type === 'blocked'));
  assert.equal(b.state.hearts, RULES.hearts);
  // No guard: the hero loses hearts, and the battle is lost at 0.
  events = run(b, 60);
  assert.equal(b.state.phase, 'lost');
  assert.ok(events.some((e) => e.type === 'lost'));
  // Call Nghé: once, the nearest enemy retreats.
  const c = createBattle({ def: levels.levels['2'], types: levels.enemyTypes, rng: createRng('b3') });
  const nearest = [...c.state.enemies].sort((x, y) => x.x - y.x)[0];
  const ev = c.callNghe();
  assert.equal(ev[0].type, 'nghe');
  assert.equal(nearest.hp, 0);
  assert.deepEqual(c.callNghe(), [], 'only once');
});

test('battle: the enemy of level 3 moves one step closer after each attack', () => {
  const b = createBattle({ def: levels.levels['3'], types: levels.enemyTypes, rng: createRng('b4') });
  const mover = b.state.enemies.find((e) => e.mover);
  const x0 = mover.x;
  const events = run(b, mover.nextThrow + 0.1);
  assert.ok(events.some((e) => e.type === 'step' && e.enemy === mover));
  assert.equal(mover.x, x0 - 1);
});
