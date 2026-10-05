// Placement, the core verb: the hero picks up a thing, carries it, puts it in a zone or on the
// ground, and picks it up again. A thing snaps to the half-block grid. Each zone says what fits
// and what a placement means (src/core/world/zones.js and data/world/zones.json).
//
// A span (the broken bridge) is a free place to try: to put planks and to take them back is
// exploration and is never an error. The commit is the step of the hero on the last plank. Then
// the world answers, never with a text:
//   exact: the span becomes solid, a drum sounds, and the fisher gives fish.
//   short: the last plank dips, and the hero falls into the water. The planks and the marks of the
//     empty part of the gap stay for some seconds, so that the child sees how much was missing.
//     Nghé comes to the edge and pulls the hero out. The last plank floats back to the pile.
// A plank that is too long answers at once: it sticks out past the far end and wobbles, the fisher
// calls out, and it slides back into the water and floats back to the pile. Nothing is lost, so
// that the two failures cost the same.
// Before the first commit on a new gap, a row of plank outlines lies on the bank, Nghé looks at the
// hero, and the child taps how many planks the bridge will take (a prediction, no numeral).
// After some failures, or after a commit with the signs of mashing, Nghé stands at the near end
// of the planks and stretches its neck toward the gap. The next round opens at the next dawn;
// after the last round, the rain of a later day breaks one or two planks. Each commit sends skill
// events for the learner (the child never sees them).
export const WRITES = ['hands', 'item', 'zone', 'position', 'hidden', 'look', 'tilt', 'carry', 'fall', 'follow', 'intent', 'route', 'motion', 'riding', 'keep', 'deck', 'guess', 'why', 'events'];

import { query, getEntity, addEntity, removeEntity } from '../state.js';
import { DAY_MINUTES } from '../clock.js';
import { faceOf } from '../move.js';
import {
  REACH, canPut, canTake, spanSlot, packPile, judge, skillEvents, sizesOf, sum, openRound, openGap, reachOf, oldDeck,
} from '../zones.js';
import { isMashing } from '../../learnlog.js';
import { putWork, canTakeWork, toHeap, freeSlot, takeOut } from './work.js';
import { putRaid } from './raid.js';

// The zones of the tasks of the trials: the work system puts the things there.
const WORK = new Set(['heap', 'bundle', 'forge', 'trough', 'line', 'basket', 'woodpile', 'feed', 'hearth', 'share', 'road', 'exact', 'spots']);

const TIP = 0.3; // seconds: the last plank dips under the hero
const DROP = 0.35; // seconds: the hero falls into the water
const PULL = 0.8; // seconds: Nghé pulls the hero to the edge
const SLIDE = 0.8; // seconds: a plank that is too long slides back into the water
const GLANCE = 1.2; // seconds: Nghé glances at the outlines when the child skips the prediction

export function place(world, dt, rng, env) {
  tidy(world, env);
  for (const e of query(world, 'hands', 'position')) if (e.hands.want) act(world, e, env, dt);
  for (const z of query(world, 'zone')) if (z.zone.rule === 'span') tickSpan(world, z, dt, env, rng);
  for (const e of query(world, 'fall', 'position')) tickFall(world, e, dt, env);
}

const defOf = (env, zone) => env.zones?.[zone.task];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const say = (world, type, id, extra = {}) => world.events.push({ type, id, ...extra });

// Hands and things that lost each other (the hero went to another map with a plank): the hands
// are empty, and the thing goes back to the pile of its zone.
function tidy(world, env) {
  for (const e of query(world, 'hands')) {
    if (e.hands.holds && !getEntity(world, e.hands.holds)) {
      e.hands.holds = null;
      delete e.carry;
    }
  }
  for (const t of query(world, 'item')) {
    if (!t.item.held || getEntity(world, t.item.held)?.hands?.holds === t.id) continue;
    t.item.held = null;
    t.hidden = false;
    toPile(world, env, t);
  }
}

// The middle of a thing that lies somewhere (a plank lies along its facing from its position).
function middleOf(e) {
  const f = e.position.facing ?? 0;
  const h = (e.item.size ?? 0) / 2;
  return { x: e.position.x + Math.sin(f) * h, z: e.position.z + Math.cos(f) * h };
}

// A thing goes back to the pile of the zone that owns it (it floats to the bank).
function toPile(world, env, thing) {
  if (thing.item.home) return toHeap(world, thing);
  const task = getEntity(world, `zone:${thing.item.task}`);
  const pile = task ? getEntity(world, `zone:${defOf(env, task.zone)?.pile}`) : null;
  delete thing.tilt;
  thing.item.zone = pile ? pile.zone.id : null;
  if (!pile) return;
  if (!pile.zone.items.includes(thing.id)) pile.zone.items.push(thing.id);
  packPile(world, pile.zone);
}

// The attempt on a gap since the last commit: the think times, the sizes at each place, and the
// pause after a failure (for the signs of mashing). `last` is the step of the last action on the
// gap, or null before the first one (the first choice on a new gap has no think time).
function attemptOf(world, zone) {
  zone.attempt ??= { last: null, thinks: [], tries: [], pause: null, failed: false };
  return zone.attempt;
}

// The wish of the hands of an entity: aim (the child chose a plank; the hero walks to it), pick,
// put, drop, or guess (the prediction).
function act(world, e, env, dt) {
  const want = e.hands.want;
  delete e.hands.want;
  if (e.fall) return;
  if (want.do === 'aim') e.hands.aim = world.tick;
  else if (want.do === 'pick') pick(world, e, getEntity(world, want.item), env, dt);
  else if (want.do === 'put') put(world, e, getEntity(world, `zone:${want.zone}`), env, dt, want.at);
  else if (want.do === 'drop') drop(world, e, env);
  else if (want.do === 'guess') guess(world, getEntity(world, `zone:${want.zone}`), want.n, env);
}

function pick(world, e, thing, env, dt) {
  if (!thing?.item || thing.item.held || thing.item.set || thing.item.fixed || e.hands.holds) return;
  const zoneEnt = thing.item.zone ? getEntity(world, `zone:${thing.item.zone}`) : null;
  const working = zoneEnt && WORK.has(zoneEnt.zone.rule);
  if (working ? !canTakeWork(world, thing) : zoneEnt && !canTake(zoneEnt.zone, thing.id)) return;
  const at = zoneEnt?.zone.rule === 'span' ? zoneEnt.position : middleOf(thing);
  // From a place of a task, the hands take a thing back from where they put it.
  const nearPlace = working && dist(e.position, zoneEnt.position) <= REACH + 2;
  if (dist(e.position, at) > REACH + (thing.item.size ?? 0) / 2 && !nearPlace) return say(world, 'far', e.id);
  // The time that the child took to choose this plank, from the last action on its gap.
  const task = getEntity(world, `zone:${thing.item.task}`);
  if (task?.zone.rule === 'span' && zoneEnt?.zone.rule !== 'span') {
    const a = attemptOf(world, task.zone);
    if (a.last !== null) {
      const think = Math.round(Math.max(0, ((e.hands.aim ?? world.tick) - a.last) * dt) * 100) / 100;
      a.thinks.push(think);
      if (a.failed && a.pause === null) a.pause = think;
    }
  }
  delete e.hands.aim;
  if (zoneEnt) {
    if (working) {
      // A take back from a place of a task (the opposite of a put).
      takeOut(world, thing);
      delete thing.item.slot;
      const tz = zoneEnt.zone.rule === 'heap' ? null : getEntity(world, `zone:${thing.item.task}`);
      if (tz?.zone.rule === 'trial') tz.zone.resets = (tz.zone.resets ?? 0) + 1;
    } else zoneEnt.zone.items = zoneEnt.zone.items.filter((id) => id !== thing.id);
    if (zoneEnt.zone.rule === 'pile') packPile(world, zoneEnt.zone);
    else if (!working) {
      // A plank taken back from the span: a reset of the attempt.
      const a = attemptOf(world, zoneEnt.zone);
      a.last = world.tick;
      a.resets = (a.resets ?? 0) + 1;
    }
  }
  thing.item.zone = null;
  thing.item.held = e.id;
  thing.item.since = world.tick;
  thing.hidden = true;
  delete thing.tilt;
  e.hands.holds = thing.id;
  e.carry = thing.look;
  hintSeen(world, dt);
  stopHint(world);
  say(world, 'pick', e.id, { item: thing.id, sound: 'plank-up' });
}

function put(world, e, zoneEnt, env, dt, at = null) {
  const thing = getEntity(world, e.hands.holds);
  if (!thing || !zoneEnt) return;
  const zone = zoneEnt.zone;
  if (!canPut(zone, thing)) return;
  if (WORK.has(zone.rule)) {
    // A zone of a trial or a raid: near its reach point, or near the point of the tap on a line of
    // stakes or on the road.
    const slot = zone.rule === 'spots' ? zone.slots[freeSlot(world, zone, at)] : null;
    const target = zone.rule === 'line' && at ? { x: at.x, z: zone.z } : zone.rule === 'road' && at ? at : slot ?? zoneEnt.position;
    if (dist(e.position, target) > REACH + 2) return say(world, 'far', e.id);
    release(e, thing);
    const done = zone.task === 'raid' ? putRaid(world, e, zone, thing, at, env) : putWork(world, e, zone, thing, at, env);
    if (done && zone.task === 'raid') say(world, 'put', e.id, { item: thing.id, zone: zone.id, sound: 'plank-down' });
    if (!done) {
      thing.item.held = e.id;
      thing.hidden = true;
      e.hands.holds = thing.id;
      e.carry = thing.look;
    }
    return;
  }
  // A pile is long: the hero must be near the pile or near one of its planks.
  const near = [zoneEnt.position, ...(zone.rule === 'pile' ? zone.items.map((id) => getEntity(world, id)).filter(Boolean).map(middleOf) : [])];
  if (Math.min(...near.map((q) => dist(e.position, q))) > REACH + (zone.rule === 'pile' ? 3 : 0)) return say(world, 'far', e.id);
  release(e, thing);
  thing.item.zone = zone.id;
  zone.items.push(thing.id);
  hintSeen(world, dt);
  stopHint(world);
  if (zone.rule === 'pile') {
    packPile(world, zone);
    return say(world, 'put', e.id, { item: thing.id, zone: zone.id, sound: 'plank-down' });
  }
  const before = sum(sizesOf(world, zone.items.slice(0, -1)));
  thing.position = spanSlot(zone, before, thing.item.size);
  const a = attemptOf(world, zone);
  a.last = world.tick;
  a.tries.push({ slot: zone.items.length - 1, size: thing.item.size });
  // The first plank on a new gap: the row of outlines for the prediction goes away.
  if (zone.guess === 'pending') endGuess(world, zoneEnt, null);
  if (judge(before + thing.item.size, zone.gap) !== 'long') return say(world, 'put', e.id, { item: thing.id, zone: zone.id, sound: 'plank-down' });
  // Too long: the plank sticks out past the far end and wobbles, and the fisher calls out. The
  // world shows the failure, but it is not a commit: it sends no skill event.
  const out = defOf(env, zone).outcomes.long;
  zone.fails += 1;
  zone.effect = { kind: 'wobble', id: thing.id, t: 0, time: out.wobble };
  say(world, 'long', zoneEnt.id, { item: thing.id, sound: out.sound });
  if (out.call) say(world, 'call', `npc:${out.call.who}`, { key: out.call.key });
}

// Put a thing on the ground in front of the entity, on the half-block grid, square to the grid.
function drop(world, e, env) {
  const thing = getEntity(world, e.hands.holds);
  if (!thing) return;
  const f = e.position.facing ?? 0;
  const facing = (Math.round(f / (Math.PI / 2)) * Math.PI) / 2;
  let x = Math.round(e.position.x + Math.sin(facing) * 1.5);
  let z = Math.round(e.position.z + Math.cos(facing) * 1.5);
  // The far end must be on land too; if not, the thing lies at the feet.
  const end = { x: x + Math.sin(facing) * thing.item.size, z: z + Math.cos(facing) * thing.item.size };
  if (!env.canEnter('land', e.position, { x, z }) || !env.canEnter('land', e.position, end) || env.groundAt(x, z) === 'shallow') {
    x = Math.round(e.position.x);
    z = Math.round(e.position.z);
  }
  release(e, thing);
  thing.position = { x, y: env.groundY(x / 2, z / 2), z, facing };
  say(world, 'drop', e.id, { item: thing.id, sound: 'plank-down' });
}

function release(e, thing) {
  thing.item.held = null;
  thing.hidden = false;
  e.hands.holds = null;
  delete e.carry;
}

// The prediction: the child tapped the n-th outline. The outlines up to n fill, and then the row
// goes away. No numeral is shown.
function guess(world, zoneEnt, n, env) {
  if (!zoneEnt || zoneEnt.zone.guess !== 'pending') return;
  const max = defOf(env, zoneEnt.zone)?.predict?.max ?? 6;
  endGuess(world, zoneEnt, Math.max(1, Math.min(max, Math.round(n))));
  say(world, 'guess', zoneEnt.id, { n: zoneEnt.zone.guess, sound: 'plank-up' });
}

function endGuess(world, zoneEnt, n) {
  zoneEnt.zone.guess = n;
  // A skip: Nghé glances once at the row of outlines, with no text, before it goes.
  const row = query(world, 'guess').filter((g) => g.guess.zone === zoneEnt.zone.id);
  if (n === null && row.length) {
    const mid = row[Math.floor(row.length / 2)].position;
    for (const f of query(world, 'follow')) f.follow.glance = { x: mid.x, z: mid.z + 2, t: GLANCE };
  }
  for (const g of query(world, 'guess')) {
    if (g.guess.zone !== zoneEnt.zone.id) continue;
    if (n !== null && g.guess.n <= n) {
      g.look = 'plank-ghost-on';
      g.guess.left = 1.2;
    } else removeEntity(world, g.id);
  }
  for (const f of query(world, 'follow')) if (f.follow.goal?.guess) delete f.follow.goal;
}

// The commit: the hero steps on the last plank. The span is exact (solid) or short (the plank
// dips). Either way the skill events go out, and the prediction with the result on the first
// commit on a gap.
function commit(world, zoneEnt, def, hero) {
  const zone = zoneEnt.zone;
  const parts = sizesOf(world, zone.items);
  const solved = sum(parts) === zone.gap;
  zone.commits += 1;
  const a = attemptOf(world, zone);
  // The signs of mashing come from the learning log (rule 22).
  const mashing = isMashing({ latencies: a.thinks, tries: a.tries, pause: a.pause }, def.mash);
  if (zone.guess === 'pending') endGuess(world, zoneEnt, null);
  if (zone.commits === 1) say(world, 'prediction', zoneEnt.id, { task: zone.task, gap: zone.gap, guess: zone.guess, used: parts.length, solved });
  const events = skillEvents(zone, def, parts, { solved, mashing, attempt: a });
  zone.attempt = { last: world.tick, thinks: [], tries: [], pause: null, failed: !solved };
  if (solved) setSpan(world, zoneEnt, def);
  else {
    zone.fails += 1;
    tip(world, zoneEnt, def, hero);
  }
  for (const s of events) say(world, 'skill', zoneEnt.id, s);
}

// The span becomes solid: the planks turn into deck, a drum sounds, and the fisher gives fish.
function setSpan(world, zoneEnt, def) {
  const zone = zoneEnt.zone;
  const out = def.outcomes.exact;
  zone.set = true;
  zone.hint = 0;
  zone.day = Math.floor(world.clock.minutes / DAY_MINUTES);
  zone.done = zone.repair || zone.round === def.rounds.length - 1;
  for (const id of zone.items) {
    const p = getEntity(world, id);
    p.item.set = true;
    p.look = `deck-${p.item.size}`;
    p.position = { x: zone.cx, y: zone.deckY - 1, z: p.position.z, facing: 0 };
  }
  stopHint(world);
  say(world, 'solid', zoneEnt.id, { sound: out.sound, give: out.give, at: zone.items[zone.items.length - 1] });
}

// Too short: the last plank dips, and the hero falls into the water. Marks show the empty part.
function tip(world, zoneEnt, def, h) {
  const zone = zoneEnt.zone;
  const lastId = zone.items[zone.items.length - 1];
  const p = h.position;
  const covered = sum(sizesOf(world, zone.items));
  zone.effect = { kind: 'tip', id: lastId, t: 0, time: def.outcomes.short.show ?? 2 };
  delete h.riding;
  delete h.intent;
  delete h.route;
  if (h.motion) Object.assign(h.motion, { vx: 0, vz: 0, speed: 0 });
  h.fall = { t: 0, x: p.x, z: p.z, y: p.y, water: 2, time: def.outcomes.short.fall, out: { x: zone.lane, z: zone.from - 1.5 }, zone: zoneEnt.id };
  const missing = zone.gap - covered;
  const whyId = `why:${zone.id}`;
  if (getEntity(world, whyId)) removeEntity(world, whyId);
  addEntity(world, { id: whyId, why: { zone: zone.id }, position: { x: zone.lane, y: zone.deckY - 0.2, z: zone.from + covered, facing: 0 }, look: `gap-${missing}` });
  say(world, 'tip', zoneEnt.id, { item: lastId, sound: def.outcomes.short.sound });
}

// Is an entity on the span (between the ends of the zone)?
const onSpan = (zone, p) => p.x >= zone.x0 * 2 - 1 && p.x <= (zone.x1 + 1) * 2 + 1 && p.z >= zone.start - 1 && p.z <= zone.end + 1;

function tickSpan(world, zoneEnt, dt, env, rng) {
  const zone = zoneEnt.zone;
  const def = defOf(env, zone);
  if (!def) return;
  decks(world, zoneEnt);
  zoneEnt.position = reachOf(zone);
  for (const g of query(world, 'guess')) {
    if (g.guess.left === undefined) continue;
    g.guess.left -= dt;
    if (g.guess.left <= 0) removeEntity(world, g.id);
  }
  const heroes = query(world, 'control', 'position');
  const today = Math.floor(world.clock.minutes / DAY_MINUTES);
  const clear = heroes.every((h) => !onSpan(zone, h.position));
  // A new day after a set round: the river took the old planks in the night, and a new pile lies
  // on the bank. After the last round, the rain of a later day breaks one or two planks.
  const day = (world.sky?.night ?? 0) < 0.5;
  if (zone.set && !zone.done && today > zone.day && day && clear) return nextRound(world, zoneEnt, def, zone.round + 1);
  if (zone.set && zone.done && def.repair && today > zone.day && (world.sky?.rain ?? 0) > 0.5 && clear) return breakSpan(world, zoneEnt, def, rng);
  const fx = zone.effect;
  if (fx) {
    fx.t += dt;
    const thing = getEntity(world, fx.id);
    if (!thing) zone.effect = null;
    else if (fx.kind === 'wobble') {
      thing.tilt = Math.sin(fx.t * 18) * 0.12 * Math.max(0, 1 - fx.t / fx.time);
      if (fx.t >= fx.time) zone.effect = { kind: 'slide', id: fx.id, t: 0 };
    } else if (fx.kind === 'slide') {
      // The plank slides back and down into the water.
      thing.tilt = -Math.min(0.6, fx.t * 1.5);
      thing.position.z -= dt * 4;
      thing.position.y -= dt * 7;
      if (fx.t >= SLIDE) afterFailure(world, zoneEnt, def, thing, env);
    } else if (fx.kind === 'tip') {
      // The last plank dips under the hero and stays there with the marks of the empty part of
      // the gap, for some seconds. Then it floats back to the pile.
      thing.tilt = Math.min(0.35, (fx.t / TIP) * 0.35);
      if (fx.t >= fx.time) {
        if (getEntity(world, `why:${zone.id}`)) removeEntity(world, `why:${zone.id}`);
        afterFailure(world, zoneEnt, def, thing, env);
      }
    } else zone.effect = null;
    return;
  }
  // The prediction: when the hero comes near a new gap, the plank outlines lie on the bank and
  // Nghé looks at the hero.
  if (zone.guess === 'pending' && !zone.set && def.predict && env.switches?.predict !== false && heroes.some((h) => dist(h.position, zoneEnt.position) < def.predict.near)) showGuess(world, zoneEnt, def, env, heroes[0]);
  // The commit: the hero steps on the last plank.
  if (!zone.set && zone.items.length) {
    const last = getEntity(world, zone.items[zone.items.length - 1]);
    const hero = heroes.find((h) => !h.fall && Math.abs(h.position.x - zone.lane) <= 1.6
      && h.position.z > last.position.z + 0.4 && h.position.z <= last.position.z + last.item.size + 0.5);
    if (hero) return commit(world, zoneEnt, def, hero);
  }
  if (zone.hint > 0) {
    zone.hint -= dt;
    if (zone.hint <= 0) stopHint(world);
  }
}

// After a failure (a plank slid back, or a plank dipped under the hero): the plank floats back to
// the pile, and the hint comes when it is time for it.
function afterFailure(world, zoneEnt, def, thing, env) {
  const zone = zoneEnt.zone;
  const at = { x: thing.position.x, z: thing.position.z + thing.item.size / 2 };
  zone.items = zone.items.filter((id) => id !== thing.id);
  zone.effect = null;
  toPile(world, env, thing);
  const a = attemptOf(world, zone);
  a.last = world.tick;
  a.failed = true;
  say(world, 'float', zoneEnt.id, { item: thing.id, at, sound: 'splash' });
  if (!query(world, 'fall').length) maybeHint(world, zoneEnt, def);
}

function showGuess(world, zoneEnt, def, env, hero) {
  const zone = zoneEnt.zone;
  const at = env.places[def.predict.at];
  if (!at || query(world, 'guess').some((g) => g.guess.zone === zone.id)) return;
  for (let n = 1; n <= def.predict.max; n++) {
    addEntity(world, {
      id: `guess:${zone.id}:${n}`,
      guess: { zone: zone.id, n },
      position: { x: Math.round(at.x + (n - 1) * 2.5), y: at.y, z: Math.round(at.z), facing: 0 },
      look: 'plank-ghost',
    });
  }
  // Nghé goes beside the outlines and looks at the hero.
  const friend = query(world, 'follow')[0];
  if (friend && !friend.follow.goal && hero) {
    const spot = { x: at.x - 2.5, z: at.z + 2 };
    friend.follow.goal = { x: spot.x, z: spot.z, face: faceOf(hero.position.x - spot.x, hero.position.z - spot.z), guess: true };
  }
  say(world, 'predict', zoneEnt.id);
}

// The hero in the water: down with a splash, a moment in the water, and then Nghé pulls the
// hero out to the edge. No damage.
function tickFall(world, e, dt, env) {
  const f = e.fall;
  const friend = query(world, 'follow').find((x) => x.follow.target === e.id);
  const was = f.t;
  f.t += dt;
  const p = e.position;
  if (f.t < DROP) {
    p.y = f.y + (f.water - f.y) * (f.t / DROP);
    return;
  }
  if (was < DROP) {
    p.y = f.water;
    say(world, 'splash', e.id, { sound: 'splash' });
    if (friend) friend.follow.goal = { x: f.out.x, z: f.out.z - 1.5, face: 0 };
  }
  const ready = !friend || dist(friend.position, { x: f.out.x, z: f.out.z - 1.5 }) < 2 || f.t > DROP + f.time + 3;
  if (f.t < DROP + f.time || (!f.pull && !ready)) return;
  f.pull ??= f.t;
  const k = Math.min(1, (f.t - f.pull) / PULL);
  p.x = f.x + (f.out.x - f.x) * k;
  p.z = f.z + (f.out.z - f.z) * k;
  p.y = f.water + (env.groundY(f.out.x / 2, f.out.z / 2) - f.water) * Math.min(1, k * 1.5);
  p.facing = Math.PI;
  if (k < 1) return;
  delete e.fall;
  if (friend) delete friend.follow.goal;
  say(world, 'pulled', e.id, { sound: 'moo' });
  const zoneEnt = getEntity(world, f.zone);
  if (zoneEnt && !zoneEnt.zone.effect) maybeHint(world, zoneEnt, defOf(env, zoneEnt.zone));
}

// The cue of the mentor of the bridge (src/core/mentor.js, the move cue): Nghé shows the gap. While
// the hero falls or a plank wobbles, the cue waits for the end of it.
export function cueHint(world, zoneEnt, env) {
  const zone = zoneEnt?.zone;
  if (!zone || zone.set) return;
  zone.hintNext = true;
  if (!query(world, 'fall').length && !zone.effect) maybeHint(world, zoneEnt, defOf(env, zone));
}

// When the mentor asks for it (a cue), Nghé stands on the bank at the near end of the planks and
// stretches its neck toward the gap. Nghé never says a number, and never stands on the planks.
function maybeHint(world, zoneEnt, def) {
  const zone = zoneEnt.zone;
  const due = zone.hintNext;
  delete zone.hintNext;
  if (!due || zone.set) return;
  const friend = query(world, 'follow')[0];
  if (!friend) return;
  zone.hint = def?.hint?.time ?? 10;
  zone.hintAt = world.tick;
  // The attempt after this failure saw the hint (level 1: an environmental cue).
  const a = attemptOf(world, zone);
  a.hint = Math.max(a.hint ?? 0, 1);
  friend.follow.goal = { x: zone.lane + 3, z: zone.from - 1.5, face: 0, act: 'stretch' };
  say(world, 'hint', friend.id);
}

// The seconds that the hint showed before the next action of the child (hints seen for less than
// a second are a question of the learning log).
function hintSeen(world, dt) {
  for (const z of query(world, 'zone')) {
    if (!(z.zone.hint > 0) || z.zone.hintAt === undefined) continue;
    const a = attemptOf(world, z.zone);
    a.hintSeen ??= Math.round((world.tick - z.zone.hintAt) * dt * 100) / 100;
  }
}

function stopHint(world) {
  for (const z of query(world, 'zone')) if (z.zone.hint > 0) z.zone.hint = 0;
  if (query(world, 'fall').length) return;
  for (const f of query(world, 'follow')) if (f.follow.goal?.act === 'stretch') delete f.follow.goal;
}

// A new round: the old planks go, the gap has its new length, and a new pile lies on the bank.
function nextRound(world, zoneEnt, def, round) {
  const zone = zoneEnt.zone;
  clearTask(world, zone);
  openRound(zone, def, round);
  zoneEnt.position = reachOf(zone);
  addPlanks(world, zoneEnt, def, def.rounds[round].pile);
  say(world, 'round', zoneEnt.id, { sound: 'clatter' });
}

// The rain breaks one or two planks of the solid bridge, and they fall into the river. The repair
// is a new task: the child sees the gap that is left and finds the missing planks. The rest of
// the bridge stays solid (it is the old deck now).
function breakSpan(world, zoneEnt, def, rng) {
  const zone = zoneEnt.zone;
  const r = def.repair;
  const set = zone.items.map((id) => getEntity(world, id)).filter(Boolean);
  if (!set.length) return;
  const n = Math.min(set.length, rng.int(r.planks[0], r.planks[1]));
  const i = rng.int(0, set.length - n);
  const broken = set.slice(i, i + n);
  const from = broken[0].position.z;
  const gap = sum(broken.map((p) => p.item.size));
  clearTask(world, zone);
  zone.repair = true;
  zone.done = false;
  openGap(zone, from, gap, r.pile, r.levels);
  zoneEnt.position = reachOf(zone);
  addPlanks(world, zoneEnt, def, r.pile);
  say(world, 'crack', zoneEnt.id, { sound: 'crack', at: { x: zone.lane, z: from + gap / 2 } });
}

// Remove the planks of a task (on the span and on the pile; not a plank in the hands).
function clearTask(world, zone) {
  for (const e of query(world, 'item')) if (e.item.task === zone.id && !e.item.held) removeEntity(world, e.id);
  for (const p of query(world, 'zone')) if (p.zone.rule === 'pile') p.zone.items = p.zone.items.filter((id) => getEntity(world, id));
  for (const g of query(world, 'guess')) if (g.guess.zone === zone.id) removeEntity(world, g.id);
  zone.items = [];
}

// New planks of these sizes on the pile of the zone.
export function addPlanks(world, zoneEnt, def, sizes) {
  const zone = zoneEnt.zone;
  const pile = getEntity(world, `zone:${def.pile}`);
  for (const size of sizes) {
    const id = `${def.accepts}:${zone.id}:${zone.made++}`;
    addEntity(world, {
      id,
      keep: true,
      item: { kind: def.accepts, size, task: zone.id, zone: pile ? pile.zone.id : null, held: null, set: false },
      position: { x: pile?.zone.x ?? 0, y: pile?.zone.y ?? 0, z: pile?.zone.z ?? 0, facing: Math.PI / 2 },
      look: `${def.accepts}-${size}`,
    });
    pile?.zone.items.push(id);
  }
  if (pile) packPile(world, pile.zone);
}

// The old deck of the bridge at both ends of the gap, as two things of the world. While the
// span is solid, its set planks fill the gap.
function decks(world, zoneEnt) {
  const zone = zoneEnt.zone;
  const d = oldDeck(zone);
  for (const [side, len, z] of [['n', d.n, zone.start], ['s', d.s, zone.from + zone.gap]]) {
    const id = `deck:${zone.id}:${side}`;
    const e = getEntity(world, id);
    if (len <= 0) {
      if (e) removeEntity(world, id);
      continue;
    }
    const look = `deck-${len}`;
    if (e && e.look === look && e.position.z === z) continue;
    if (e) removeEntity(world, id);
    addEntity(world, { id, deck: { zone: zone.id }, position: { x: zone.cx, y: zone.deckY - 1, z, facing: 0 }, look });
  }
}
