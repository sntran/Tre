// Placement, the core verb: the hero picks up a thing, carries it, puts it in a zone or on the
// ground, and picks it up again. A thing snaps to the half-block grid. Each zone says what fits
// and what a placement means (src/core/world/zones.js and data/world/zones.json).
//
// A span (the broken bridge) answers each try with the world, never with a text:
//   exact: the span becomes solid, a drum sounds, and coins come.
//   long: the last thing sticks out past the far end and wobbles, a person calls out, and then it
//     falls into the water and is lost.
//   short: when the hero steps on the last thing, it tips, and the hero falls into the water.
//     The friend (Nghé) comes to the edge and pulls the hero out. The thing floats back to the pile.
// After some failures in a round, Nghé walks to the end of the things and looks at the gap.
// The next round opens at the next dawn; after the last round, the rain of a later day breaks
// the span again. Each try sends skill events for the learner (the child never sees them).
export const WRITES = ['hands', 'item', 'zone', 'position', 'hidden', 'look', 'tilt', 'carry', 'fall', 'follow', 'intent', 'route', 'motion', 'riding', 'keep', 'deck', 'events'];

import { query, getEntity, addEntity, removeEntity } from '../state.js';
import { DAY_MINUTES } from '../clock.js';
import {
  REACH, canPut, canTake, spanSlot, packPile, judge, skillEvents, canMake, sizesOf, sum, openRound, reachOf, oldDeck,
} from '../zones.js';

const TIP = 0.9; // seconds: the last plank tips and falls
const DROP = 0.35; // seconds: the hero falls into the water
const PULL = 0.8; // seconds: Nghé pulls the hero to the edge
const SINK = 0.6; // seconds: a wasted plank sinks

export function place(world, dt, rng, env) {
  tidy(world, env);
  for (const e of query(world, 'hands', 'position')) if (e.hands.want) act(world, e, env);
  for (const z of query(world, 'zone')) if (z.zone.rule === 'span') tickSpan(world, z, dt, env, rng);
  for (const e of query(world, 'fall', 'position')) tickFall(world, e, dt, env);
}

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
    const task = getEntity(world, `zone:${t.item.task}`);
    const pile = task ? getEntity(world, `zone:${defOf(env, task.zone)?.pile}`) : null;
    if (!pile) continue;
    t.item.zone = pile.zone.id;
    pile.zone.items.push(t.id);
    packPile(world, pile.zone);
  }
}

const defOf = (env, zone) => env.zones?.[zone.task];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const say = (world, type, id, extra = {}) => world.events.push({ type, id, ...extra });

// The middle of a thing that lies somewhere (a plank lies along its facing from its position).
function middleOf(e) {
  const f = e.position.facing ?? 0;
  const h = (e.item.size ?? 0) / 2;
  return { x: e.position.x + Math.sin(f) * h, z: e.position.z + Math.cos(f) * h };
}

// The wish of the hands of an entity: pick, put, or drop.
function act(world, e, env) {
  const want = e.hands.want;
  delete e.hands.want;
  if (e.fall) return;
  if (want.do === 'pick') pick(world, e, getEntity(world, want.item), env);
  else if (want.do === 'put') put(world, e, getEntity(world, `zone:${want.zone}`), env);
  else if (want.do === 'drop') drop(world, e, env);
}

function pick(world, e, thing, env) {
  if (!thing?.item || thing.item.held || thing.item.set || e.hands.holds) return;
  const zoneEnt = thing.item.zone ? getEntity(world, `zone:${thing.item.zone}`) : null;
  if (zoneEnt && !canTake(zoneEnt.zone, thing.id)) return;
  const at = zoneEnt?.zone.rule === 'span' ? zoneEnt.position : middleOf(thing);
  if (dist(e.position, at) > REACH + (thing.item.size ?? 0) / 2) return say(world, 'far', e.id);
  if (zoneEnt) {
    zoneEnt.zone.items = zoneEnt.zone.items.filter((id) => id !== thing.id);
    if (zoneEnt.zone.rule === 'pile') packPile(world, zoneEnt.zone);
  }
  thing.item.zone = null;
  thing.item.held = e.id;
  thing.hidden = true;
  delete thing.tilt;
  e.hands.holds = thing.id;
  e.carry = thing.look;
  stopHint(world, env);
  say(world, 'pick', e.id, { item: thing.id, sound: 'plank-up' });
}

function put(world, e, zoneEnt, env) {
  const thing = getEntity(world, e.hands.holds);
  if (!thing || !zoneEnt) return;
  const zone = zoneEnt.zone;
  if (!canPut(zone, thing)) return;
  // A pile is long: the hero must be near the pile or near one of its planks.
  const near = [zoneEnt.position, ...(zone.rule === 'pile' ? zone.items.map((id) => getEntity(world, id)).filter(Boolean).map(middleOf) : [])];
  if (Math.min(...near.map((q) => dist(e.position, q))) > REACH + (zone.rule === 'pile' ? 3 : 0)) return say(world, 'far', e.id);
  release(e, thing);
  thing.item.zone = zone.id;
  zone.items.push(thing.id);
  stopHint(world, env);
  if (zone.rule === 'pile') {
    packPile(world, zone);
    return say(world, 'put', e.id, { item: thing.id, zone: zone.id, sound: 'plank-down' });
  }
  const before = sum(sizesOf(world, zone.items.slice(0, -1)));
  thing.position = spanSlot(zone, before, thing.item.size);
  const def = defOf(env, zone);
  const total = before + thing.item.size;
  const result = judge(total, zone.gap);
  if (result === 'open') return say(world, 'put', e.id, { item: thing.id, zone: zone.id, sound: 'plank-down' });
  const sizes = sizesOf(world, zone.items);
  if (result === 'exact') return setSpan(world, zoneEnt, def, sizes);
  // Too long: the plank sticks out past the far end and wobbles. The person who watches calls out.
  const out = def.outcomes.long;
  zone.fails += 1;
  zone.effect = { kind: 'wobble', id: thing.id, t: 0, time: out.wobble };
  say(world, 'long', zoneEnt.id, { item: thing.id, sound: out.sound });
  if (out.call) say(world, 'call', `npc:${out.call.who}`, { key: out.call.key });
  for (const s of skillEvents(def, zone.round, sizes, false)) say(world, 'skill', zoneEnt.id, s);
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

// The span becomes solid: the planks turn into deck, a drum sounds, and coins come.
function setSpan(world, zoneEnt, def, sizes) {
  const zone = zoneEnt.zone;
  const out = def.outcomes.exact;
  zone.set = true;
  zone.fails = 0;
  zone.hint = 0;
  zone.day = Math.floor(world.clock.minutes / DAY_MINUTES);
  zone.done = zone.round === def.rounds.length - 1;
  for (const id of zone.items) {
    const p = getEntity(world, id);
    p.item.set = true;
    p.look = `deck-${p.item.size}`;
    p.position = { x: zone.cx, y: zone.deckY - 1, z: p.position.z, facing: 0 };
  }
  say(world, 'solid', zoneEnt.id, { sound: out.sound, give: out.give, at: zone.items[zone.items.length - 1] });
  for (const s of skillEvents(def, zone.round, sizes, true)) say(world, 'skill', zoneEnt.id, s);
}

// Is an entity on the span (between the ends of the zone)?
const onSpan = (zone, p) => p.x >= zone.x0 * 2 - 1 && p.x <= (zone.x1 + 1) * 2 + 1 && p.z >= zone.start - 1 && p.z <= zone.end + 1;

function tickSpan(world, zoneEnt, dt, env, rng) {
  const zone = zoneEnt.zone;
  const def = defOf(env, zone);
  if (!def) return;
  decks(world, zoneEnt);
  zoneEnt.position = reachOf(zone);
  const heroes = query(world, 'control', 'position');
  const today = Math.floor(world.clock.minutes / DAY_MINUTES);
  const clear = heroes.every((h) => !onSpan(zone, h.position));
  // A new day after a set round: the river took the old planks in the night, and a new pile lies
  // on the bank. After the last round, the rain of a later day breaks the span.
  const day = (world.sky?.night ?? 0) < 0.5;
  if (zone.set && !zone.done && today > zone.day && day && clear) return nextRound(world, zoneEnt, def, zone.round + 1, 'round');
  if (zone.set && zone.done && today > zone.day && (world.sky?.rain ?? 0) > 0.5 && clear) {
    zone.done = false;
    return nextRound(world, zoneEnt, def, rng.int(0, def.rounds.length - 1), 'crack');
  }
  const fx = zone.effect;
  if (fx) {
    fx.t += dt;
    const thing = getEntity(world, fx.id);
    if (fx.kind === 'wobble' && thing) {
      thing.tilt = Math.sin(fx.t * 18) * 0.12 * Math.max(0, 1 - fx.t / fx.time);
      if (fx.t >= fx.time) zone.effect = { kind: 'sink', id: fx.id, t: 0 };
    } else if (fx.kind === 'sink' && thing) {
      thing.tilt = -Math.min(1, fx.t * 3);
      thing.position.y -= dt * 8;
      if (fx.t >= SINK) {
        // The plank is lost in the river. If the rest cannot make the gap now, new planks come.
        zone.items = zone.items.filter((id) => id !== fx.id);
        removeEntity(world, fx.id);
        zone.effect = null;
        say(world, 'wasted', zoneEnt.id, { sound: 'splash' });
        refill(world, zoneEnt, def);
        maybeHint(world, zoneEnt, def, env);
      }
    } else if (fx.kind === 'tip' && thing) {
      thing.tilt = Math.min(1.3, fx.t * 3);
      if (fx.t > 0.4) thing.position.y -= dt * 10;
      if (fx.t >= TIP) {
        // The plank floats back to the bank, to the pile.
        zone.items = zone.items.filter((id) => id !== fx.id);
        delete thing.tilt;
        const pile = getEntity(world, `zone:${def.pile}`);
        thing.item.zone = pile ? pile.zone.id : null;
        if (pile) {
          pile.zone.items.push(thing.id);
          packPile(world, pile.zone);
        }
        zone.effect = null;
      }
    } else {
      zone.effect = null;
    }
    return;
  }
  // The hero steps on the last plank of a short span: it tips.
  if (zone.set || !zone.items.length) return;
  const lastId = zone.items[zone.items.length - 1];
  const last = getEntity(world, lastId);
  for (const h of heroes) {
    if (h.fall) continue;
    const p = h.position;
    if (Math.abs(p.x - zone.lane) > 1.6 || p.z <= last.position.z + 0.4 || p.z > last.position.z + last.item.size + 0.5) continue;
    const sizes = sizesOf(world, zone.items);
    zone.fails += 1;
    zone.effect = { kind: 'tip', id: lastId, t: 0 };
    delete h.riding;
    delete h.intent;
    delete h.route;
    if (h.motion) Object.assign(h.motion, { vx: 0, vz: 0, speed: 0 });
    h.fall = { t: 0, x: p.x, z: p.z, y: p.y, water: 2, time: def.outcomes.short.fall, out: { x: zone.lane, z: zone.from - 1.5 }, zone: zoneEnt.id };
    say(world, 'tip', zoneEnt.id, { item: lastId, sound: def.outcomes.short.sound });
    for (const s of skillEvents(def, zone.round, sizes, false)) say(world, 'skill', zoneEnt.id, s);
    return;
  }
  if (zone.hint > 0) {
    zone.hint -= dt;
    if (zone.hint <= 0) stopHint(world, env);
  }
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
  if (zoneEnt) maybeHint(world, zoneEnt, env.zones?.[zoneEnt.zone.task], env);
}

// After enough failures in a round, Nghé walks to the end of the planks and looks at the gap.
function maybeHint(world, zoneEnt, def, env) {
  const zone = zoneEnt.zone;
  if (!def?.hint || zone.fails < def.hint.after || zone.set) return;
  const friend = query(world, 'follow')[0];
  if (!friend) return;
  const covered = sum(sizesOf(world, zone.items));
  zone.hint = def.hint.time;
  friend.follow.goal = { x: zone.lane, z: zone.from + Math.max(0, covered - 1.2), face: 0, via: { x: zone.lane, z: zone.from - 1 } };
  say(world, 'hint', friend.id);
}

function stopHint(world, env) {
  for (const z of query(world, 'zone')) if (z.zone.hint > 0) z.zone.hint = 0;
  for (const f of query(world, 'follow')) if (f.follow.goal && !query(world, 'fall').length) delete f.follow.goal;
}

// New planks come when the planks that are left cannot make the gap.
function refill(world, zoneEnt, def) {
  const zone = zoneEnt.zone;
  const mine = query(world, 'item').filter((e) => e.item.task === zone.id && !e.item.set);
  if (canMake(zone.gap, mine.map((e) => e.item.size))) return;
  const want = [...def.rounds[zone.round].pile];
  for (const e of mine) {
    const i = want.indexOf(e.item.size);
    if (i >= 0) want.splice(i, 1);
  }
  addPlanks(world, zoneEnt, def, want);
  say(world, 'refill', zoneEnt.id, { sound: 'clatter' });
}

// A new round: the old planks go, the gap has its new length, and a new pile lies on the bank.
function nextRound(world, zoneEnt, def, round, why) {
  const zone = zoneEnt.zone;
  for (const e of query(world, 'item')) if (e.item.task === zone.id && !e.item.held) removeEntity(world, e.id);
  const pile = getEntity(world, `zone:${def.pile}`);
  if (pile) pile.zone.items = pile.zone.items.filter((id) => getEntity(world, id));
  zone.items = [];
  openRound(zone, def, round);
  zoneEnt.position = reachOf(zone);
  addPlanks(world, zoneEnt, def, def.rounds[round].pile);
  say(world, why, zoneEnt.id, { sound: why === 'crack' ? 'crack' : 'clatter' });
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

// The old deck of the bridge at both ends of the gap, as two things of the world.
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
