// The rules of the slingshot battle. Pure functions and a battle state, no DOM.
// The child never types or picks an answer: the distance of the shot is the answer.
import { flight, heightAt } from './physics.js';

export const RULES = Object.freeze({
  hearts: 5,
  hitRadius: 0.5, // a stone that lands this near to an enemy hits it
  enemyHeight: 1.8, // a stone below this height passes through the body of an enemy
  damage: 1,
  comboDamage: 2, // each enemy of a combo (one stone, two enemies or more)
  guardWindow: 1, // a Guard tap in the last second before a throw blocks it
  guardRest: 1.5, // the shield rests this long after a tap
  throwFlight: 0.7, // the seconds that the stone of an enemy flies to the hero
  startDelay: 2.5, // no attack in the first seconds
  markerStep: 5,
  minEnemyX: 4, // an enemy that moves closer stops here
});

// The enemy that the stone hits where it lands, and the enemies that it passes through
// on the way down (a combo). An enemy that the stone passes but does not land near ducks.
// Return { primary, combo: [enemies of the combo, with primary], ducks: [...] }.
export function hitTest(shot, fl, enemies, rules = RULES) {
  const alive = enemies.filter((e) => e.hp > 0);
  const near = alive
    .filter((e) => Math.abs(fl.landX - e.x) <= rules.hitRadius)
    .sort((a, b) => Math.abs(fl.landX - a.x) - Math.abs(fl.landX - b.x));
  const primary = near[0] ?? null;
  const crossed = alive.filter((e) => e !== primary && e.x < fl.landX - rules.hitRadius
    && e.x > 0 && heightAt(shot, e.x) <= rules.enemyHeight);
  if (!primary) return { primary: null, combo: [], ducks: crossed };
  return { primary, combo: crossed.length ? [...crossed, primary] : [], ducks: [] };
}

// The enemy that the child aimed at: the enemy nearest to the landing point.
export function aimedTarget(landX, enemies) {
  const alive = enemies.filter((e) => e.hp > 0);
  if (!alive.length) return null;
  return alive.reduce((a, b) => (Math.abs(b.x - landX) < Math.abs(a.x - landX) ? b : a));
}

// A Guard tap in the last "window" seconds before the throw blocks the throw.
export function isGuarded(guardTimes, throwAt, window = RULES.guardWindow) {
  return guardTimes.some((g) => g <= throwAt && g >= throwAt - window);
}

// Nghé as the hint. After 2 misses on one enemy, Nghé points at the marker nearest to it.
// After 3 misses, Nghé stamps the ground at the exact distance. Nghé never says a number.
export function hintFor(misses, enemyX, markers) {
  if (misses >= 3) return { kind: 'stamp', at: enemyX };
  if (misses >= 2) {
    const at = markers.reduce((a, b) => (Math.abs(b - enemyX) < Math.abs(a - enemyX) ? b : a));
    return { kind: 'point', at };
  }
  return { kind: 'none' };
}

// A shot is a skill event for the learner model.
// The first shot at an enemy finds a number on the number line: "math.count.120".
// A next shot at the same enemy corrects the last landing by the gap: "math.add.20".
// The event is correct when the stone lands within hitRadius of the target.
export function skillEvent({ landX, target, previous = null }, rules = RULES) {
  const correct = Math.abs(landX - target.x) <= rules.hitRadius;
  const landed = Math.round(landX * 10) / 10;
  if (previous === null || previous === undefined) {
    return { skill: 'math.count.120', level: target.x <= 20 ? 1 : 2, correct, target: target.x, landed, previous: null, gap: null };
  }
  const gap = Math.round(target.x - previous);
  const size = Math.abs(gap);
  return { skill: 'math.add.20', level: size <= 5 ? 1 : size <= 10 ? 2 : 3, correct, target: target.x, landed, previous: Math.round(previous * 10) / 10, gap };
}

// The markers of a field: 5, 10, 15, ... up to the field length.
export function markersFor(field, step = RULES.markerStep) {
  const out = [];
  for (let m = step; m <= field; m += step) out.push(m);
  return out;
}

// Place the enemies of a level at whole-number distances, at least 2 apart.
export function makeLevel(def, types, rng, rules = RULES) {
  let xs = [];
  for (let tries = 0; tries < 500; tries++) {
    xs = [];
    for (let i = 0; i < def.kinds.length; i++) xs.push(rng.int(def.min, def.max));
    xs.sort((a, b) => a - b);
    if (xs.every((x, i) => i === 0 || x - xs[i - 1] >= 2)) break;
  }
  const enemies = xs.map((x, i) => {
    const kind = def.kinds[i];
    const hp = types[kind].hp;
    return { id: i, kind, x, hp, maxHp: hp, misses: 0, lastLanding: null, mover: false, nextThrow: 0, retreating: false };
  });
  let wall = null;
  if (def.wall) {
    // The wall stands before the farthest enemy that has no other enemy just in front of it.
    const behind = [...enemies].reverse().find((e, i, list) => e.x >= 9 && !list.some((o) => o !== e && o.x < e.x && o.x >= e.x - def.wall.before - 1));
    const e = behind ?? enemies[enemies.length - 1];
    wall = { x: e.x - def.wall.before, height: def.wall.height, enemy: e.id };
  }
  if (def.mover) enemies[enemies.length - 1].mover = true;
  // The counts start one after the other, so that the enemies do not throw together.
  enemies.forEach((e, i) => { e.nextThrow = rules.startDelay + def.period * (1 + i / enemies.length); });
  return { enemies, wall, markers: markersFor(def.field), field: def.field, period: def.period };
}

// The battle state. update(dt) moves the time and returns the events of that time.
export function createBattle({ def, types, rng, rules = RULES }) {
  const level = makeLevel(def, types, rng, rules);
  const s = {
    time: 0,
    hearts: rules.hearts,
    maxHearts: rules.hearts,
    enemies: level.enemies,
    wall: level.wall,
    markers: level.markers,
    field: level.field,
    period: level.period,
    stone: null, // the stone in flight: { shot, fl, t0, landed }
    incoming: [], // throws of enemies: { enemy, throwAt, hitAt, guarded }
    guardTimes: [],
    lastGuard: -Infinity,
    ngheCalled: false,
    phase: 'play',
  };

  const alive = () => s.enemies.filter((e) => e.hp > 0);

  function shoot(shot) {
    if (s.phase !== 'play' || s.stone) return null;
    const fl = flight(shot, { wall: s.wall });
    s.stone = { shot, fl, t0: s.time, landed: false };
    return s.stone;
  }

  function guard() {
    if (s.phase !== 'play' || s.time - s.lastGuard < rules.guardRest) return false;
    s.lastGuard = s.time;
    s.guardTimes.push(s.time);
    return true;
  }

  function knockDown(e, events) {
    e.hp = 0;
    e.retreating = true;
    events.push({ type: 'retreat', enemy: e });
  }

  // Once in a battle: Nghé charges the nearest enemy and knocks it down.
  function callNghe() {
    if (s.phase !== 'play' || s.ngheCalled) return [];
    const target = alive().sort((a, b) => a.x - b.x)[0];
    if (!target) return [];
    s.ngheCalled = true;
    const events = [{ type: 'nghe', enemy: target }];
    knockDown(target, events);
    checkEnd(events);
    return events;
  }

  function land(events) {
    const { shot, fl } = s.stone;
    s.stone.landed = true;
    const target = aimedTarget(fl.landX, s.enemies);
    const hits = hitTest(shot, fl, s.enemies, rules);
    events.push({ type: 'land', x: fl.landX, blocked: fl.blocked, hit: Boolean(hits.primary) });
    for (const e of hits.ducks) events.push({ type: 'duck', enemy: e });
    if (target) {
      const ev = skillEvent({ landX: fl.landX, target, previous: target.lastLanding }, rules);
      target.lastLanding = fl.landX;
      events.push({ type: 'skill', event: ev, enemy: target });
    }
    if (hits.primary) {
      const group = hits.combo.length ? hits.combo : [hits.primary];
      const combo = group.length > 1;
      for (const e of group) {
        const damage = combo ? rules.comboDamage : rules.damage;
        e.hp = Math.max(0, e.hp - damage);
        e.misses = 0;
        events.push({ type: 'hit', enemy: e, damage, combo });
        if (e.hp === 0) knockDown(e, events);
      }
      if (combo) events.push({ type: 'combo', count: group.length });
    } else {
      events.push({ type: 'miss', x: fl.landX, enemy: target });
      if (target) {
        target.misses += 1;
        const hint = hintFor(target.misses, target.x, s.markers);
        if (hint.kind !== 'none') events.push({ type: 'hint', ...hint, enemy: target });
      }
    }
    checkEnd(events);
  }

  function checkEnd(events) {
    if (s.phase === 'play' && alive().length === 0 && s.incoming.length === 0) {
      s.phase = 'won';
      events.push({ type: 'won' });
    }
  }

  function update(dt) {
    const events = [];
    if (s.phase !== 'play') return events;
    s.time += dt;
    if (s.stone) {
      if (!s.stone.landed && s.time >= s.stone.t0 + s.stone.fl.landT) land(events);
      if (s.stone && s.time >= s.stone.t0 + s.stone.fl.stopT) {
        events.push({ type: 'stop', x: s.stone.fl.stopX });
        s.stone = null;
      }
    }
    for (const e of alive()) {
      if (s.time < e.nextThrow) continue;
      const throwAt = e.nextThrow;
      s.incoming.push({ enemy: e, throwAt, hitAt: throwAt + rules.throwFlight, guarded: isGuarded(s.guardTimes, throwAt, rules.guardWindow) });
      events.push({ type: 'throw', enemy: e });
      e.nextThrow += s.period;
      // This enemy moves one step closer after each of its attacks.
      if (e.mover && e.x - 1 >= rules.minEnemyX && !s.enemies.some((o) => o !== e && o.hp > 0 && o.x === e.x - 1)) {
        e.x -= 1;
        events.push({ type: 'step', enemy: e });
      }
    }
    for (const inc of [...s.incoming]) {
      if (s.time < inc.hitAt) continue;
      s.incoming.splice(s.incoming.indexOf(inc), 1);
      if (inc.guarded) events.push({ type: 'blocked', enemy: inc.enemy });
      else {
        s.hearts = Math.max(0, s.hearts - 1);
        events.push({ type: 'hurt', enemy: inc.enemy, hearts: s.hearts });
        if (s.hearts === 0) {
          s.phase = 'lost';
          events.push({ type: 'lost' });
          return events;
        }
      }
    }
    checkEnd(events);
    return events;
  }

  // The count over the head of an enemy: whole seconds to its next throw.
  const countOf = (e) => Math.max(0, Math.ceil(e.nextThrow - s.time));

  return { state: s, shoot, guard, callNghe, update, countOf };
}
