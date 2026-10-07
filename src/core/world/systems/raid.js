// Raids in the world: the raid (the rules are in ../raids.js, the numbers in data/raids.json) and
// its figures in the world state. The session starts a raid (setupRaid): the distance posts, the
// pile of traps, the part of the road for traps, the sources of the elements, and the spots for
// the villagers go into the world. Each step, this system gives the raid the orders of the child
// (the command "raid"), the traps on the road, and the places of the hero and Nghé, steps the
// raid, and puts the enemies, the stones, the torches, the fires, the wet ground, and the
// villagers into the world as entities. The raid waits while the world waits (a talk, the map).
// When the raid is over, its things go away after a moment.
export const WRITES = ['raid', 'orders', 'over', 'horns', 'position', 'look', 'act', 'carry', 'item', 'zone', 'follow', 'raider', 'hot', 'source', 'raidTap', 'raidThing', 'fixedThing', 'events'];

import { query, getEntity, addEntity, removeEntity } from '../state.js';
import { stepRaid, shoot, predict, barGate, callHelper, charge, pour, pullBamboo, setTraps, trapPut, stoneAt, torchAt, along, releaseHold } from '../raids.js';
import { packHeap } from './work.js';

const OVER = 2.5; // seconds: the things of the raid stay after the end
const HORNS = 1.6; // seconds: Nghé lowers her horns when the hero is hurt
const LANE = 2; // half blocks: a trap snaps to the middle of the road within this distance

const say = (world, type, id, extra = {}) => world.events.push({ type, id, ...extra });
const raidOf = (world) => getEntity(world, 'raid');
const friendOf = (world) => query(world, 'follow', 'position').find((f) => f.follow.target === 'hero') ?? null;

export function raid(world, dt, rng, env) {
  const r = raidOf(world);
  if (!r) return;
  const hero = getEntity(world, 'hero');
  const friend = friendOf(world);
  for (const o of r.orders ?? []) order(world, r, o, hero, friend);
  delete r.orders;
  if (world.paused) return;
  const raid = r.raid;
  if (raid.result) {
    r.over = (r.over ?? 0) + dt;
    if (r.over >= OVER) endRaid(world, friend);
    else mirror(world, raid, env);
    return;
  }
  // The traps on the road, from the world.
  setTraps(raid, (getEntity(world, 'zone:raid-road')?.zone.items ?? []).map((id) => getEntity(world, id)).filter(Boolean)
    .map((t) => ({ id: t.id, x: t.position.x, z: t.position.z, sprung: t.item.set })));
  const events = stepRaid(raid, dt, { hero: hero?.position, nghe: raid.nghe ? friend?.position : null });
  for (const ev of events) {
    world.events.push(ev);
    react(world, r, ev, hero, friend, env);
  }
  // Nghé runs at the enemy of the charge; after the charge, Nghé follows the hero again.
  if (friend) {
    if (raid.nghe) friend.follow.goal = { x: raid.nghe.to.x, z: raid.nghe.to.z, fast: true, act: 'charge' };
    else if (r.horns > 0) {
      r.horns -= dt;
      friend.follow.goal = { x: friend.position.x, z: friend.position.z, act: 'horns' };
      if (r.horns <= 0) delete friend.follow.goal;
    } else if (friend.follow.goal?.act === 'charge') delete friend.follow.goal;
  }
  mirror(world, raid, env);
}

// The orders of the child: shoot (a count), predict (a post before the first shot), bar (the
// gate), call (a villager to a spot), charge (Nghé), pour (an element from a source to a point),
// and bamboo (the last phase of the boss).
function order(world, r, o, hero, friend) {
  const raid = r.raid;
  let evs = [];
  if (o.act === 'shoot') evs = shoot(raid, o.count);
  else if (o.act === 'release') evs = releaseHold(raid, o.tool);
  else if (o.act === 'predict') evs = predict(raid, o.post);
  else if (o.act === 'bar') evs = barGate(raid);
  else if (o.act === 'call') evs = callHelper(raid, o.spot);
  else if (o.act === 'charge' && friend) evs = charge(raid, friend.position);
  else if (o.act === 'pour') evs = pour(raid, o.source, { x: o.x, z: o.z });
  else if (o.act === 'bamboo') evs = pullBamboo(raid);
  for (const ev of evs) {
    world.events.push(ev);
    react(world, r, ev, hero, friend, null);
  }
}

// The world answers some events of the raid.
function react(world, r, ev, hero, friend, env) {
  if (ev.type === 'hurt' && hero) {
    // The blow of the general pushes the hero back (not into a wall), and Nghé lowers her horns.
    const to = { x: hero.position.x + ev.push.x, z: hero.position.z + ev.push.z };
    if (env?.canEnter('land', hero.position, to)) {
      hero.position.x = to.x;
      hero.position.z = to.z;
      hero.position.y = env.groundY(to.x / 2, to.z / 2);
    }
    r.horns = HORNS;
    if (friend) say(world, 'horns', friend.id);
  }
  if (ev.type === 'snap' || ev.type === 'crush') {
    const trap = getEntity(world, ev.trap);
    if (trap) {
      trap.item.set = true;
      trap.look = 'trap-sprung';
    }
  }
}

// Put the raid into the world as entities (half blocks; y is the height).
function mirror(world, raid, env) {
  const gy = (p) => env.groundY(p.x / 2, p.z / 2);
  const keep = new Set();
  const put = (id, fields) => {
    keep.add(id);
    const e = getEntity(world, id) ?? addEntity(world, { id, raidThing: true });
    Object.assign(e, fields);
    return e;
  };
  for (const e of raid.enemies) {
    put(e.id, {
      position: { x: e.x, y: gy(e), z: e.z, facing: e.facing ?? 0 },
      look: e.look,
      act: e.state === 'walk' || e.state === 'back' ? 'walk' : e.state,
      // The lit torch before the throw, and the wet shield after fire.
      carry: e.state === 'torch' ? 'torch' : e.shield > 0 ? 'shield' : null,
      raider: { kind: e.kind, hits: e.hits, max: e.max, shield: e.shield > 0, torch: e.state === 'torch' },
    });
  }
  for (const s of raid.stones) {
    const p = stoneAt(raid, s);
    put(s.id, { position: { x: p.x, y: gy(raid.wall) + p.h, z: p.z, facing: 0 }, look: s.ball ?? 'stone' });
  }
  // A stone that missed lies on the road for a moment, so that short or long shows at the posts.
  for (const m of raid.marks) put(m.id, { position: { x: m.x, y: gy(m), z: m.z, facing: 0 }, look: m.look });
  // Before the first shot, the posts wait for a tap (the prediction): their caps are yellow.
  for (let i = 0; i < raid.posts.length; i++) {
    const post = getEntity(world, `post:${i + 1}`);
    if (!post) continue;
    const waiting = raid.predict.state === 'pending' && raid.enemies.some((e) => e.state !== 'retreat');
    post.look = `post-${i + 1}${waiting ? '-lit' : ''}`;
    if (waiting) post.raidTap = { what: 'post', id: raid.posts[i].d };
    else delete post.raidTap;
  }
  for (const t of raid.torches) {
    const p = torchAt(t);
    put(t.id, { position: { x: p.x, y: gy(t.from) + p.h, z: p.z, facing: 0 }, look: 'torch' });
  }
  // A torch that burns on the road: a source of fire only in a raid with fire.
  const fireTool = raid.tools.includes('fire');
  for (const f of raid.fires) put(f.id, { position: { x: f.x, y: gy(f), z: f.z, facing: 0 }, look: 'fire', hot: { r: 3 }, ...(fireTool ? { source: { id: f.id, kind: 'fire' } } : {}) });
  raid.wet.forEach((w, i) => put(`wet:${i}`, { position: { x: w.x, y: gy(w), z: w.z, facing: 0 }, look: w.r > 2.8 ? 'puddle' : 'puddle-small' }));
  for (const s of raid.spots) {
    if (!s.helper) continue;
    put(`helper:${s.id}`, { position: { x: s.helper.x ?? s.x, y: gy(s.helper.x ? s.helper : s), z: s.helper.z ?? s.z, facing: 0 }, look: s.look ?? 'woodcutter', act: s.helper.state === 'go' ? 'walk' : 'guard' });
  }
  const bar = getEntity(world, 'bar:raid');
  if (bar) bar.look = raid.bar?.down > 0 ? 'bar-down' : 'bar-up';
  if (raid.bamboo) {
    put('bamboo:raid', { position: { x: raid.bamboo.x, y: gy(raid.bamboo), z: raid.bamboo.z, facing: 0 }, look: raid.bamboo.pulled ? 'bamboo-pulled' : 'bamboo-clump', raidTap: { what: 'bamboo' } });
  }
  // The things of the raid that are gone now.
  for (const e of query(world, 'raidThing')) if (!keep.has(e.id) && !e.fixedThing) removeEntity(world, e.id);
}

// The end: the things of the raid go away, and Nghé follows the hero again.
function endRaid(world, friend) {
  for (const e of query(world, 'raidThing')) removeEntity(world, e.id);
  for (const id of ['zone:raid-traps', 'zone:raid-road']) removeEntity(world, id);
  for (const e of query(world, 'item')) if (e.item.task === 'raid') removeEntity(world, e.id);
  // A trap in the hands went away too: the place system empties the hands in the next step.
  if (friend?.follow.goal) delete friend.follow.goal;
  removeEntity(world, 'raid');
  say(world, 'raidover', 'raid');
}

// Set up a raid in the world: the raid (from createRaid), and its fixed things. def: the raid in
// data/raids.json. Units of def: map cells.
export function setupRaid(world, raid, def, env, looks = {}) {
  if (raidOf(world)) return null;
  const gy = (x, z) => env.groundY(x / 2, z / 2);
  const hb = (p) => ({ x: p[0] * 2, z: p[1] * 2 });
  const fixed = (id, p, look, extra = {}) => addEntity(world, { id, raidThing: true, fixedThing: true, position: { x: p.x, y: gy(p.x, p.z), z: p.z, facing: extra.facing ?? 0 }, look, ...extra });
  const r = addEntity(world, { id: 'raid', raid });
  // The distance posts, at the side of the road (a post shows its count as bands, no numeral).
  const side = { x: -raid.dir.z, z: raid.dir.x };
  const has = (t) => raid.tools.includes(t);
  if (has('sling')) raid.posts.forEach((p, i) => fixed(`post:${i + 1}`, { x: p.x + side.x * 2.6, z: p.z + side.z * 2.6 }, `post-${i + 1}`));
  if (raid.bar) fixed('bar:raid', { x: raid.gate.x - raid.dir.x * 1.5, z: raid.gate.z - raid.dir.z * 1.5 }, 'bar-up', { facing: Math.atan2(side.x, side.z), raidTap: { what: 'gate' } });
  for (const s of raid.spots) {
    s.look = looks.helpers?.[raid.spots.indexOf(s) % looks.helpers.length];
    fixed(`spot-mark:${s.id}`, s, 'spot', { raidTap: { what: 'spot', id: s.id } });
  }
  for (const s of raid.sources) fixed(`source:${s.id}`, s, s.kind === 'water' ? 'jar' : s.kind === 'fire' ? 'brazier' : 'forge', { source: { id: s.id, kind: s.kind } });
  if (def.companion) {
    const at = { x: raid.wall.x + side.x * 2.5, z: raid.wall.z + side.z * 2.5 };
    fixed('companion:raid', at, looks.companion ?? def.companion, { facing: Math.atan2(raid.dir.x, raid.dir.z) });
  }
  // The pile of traps by the gate, and the part of the road for traps.
  if (has('traps') && def.pile && def.traps) {
    const p = hb(def.pile);
    addEntity(world, { id: 'zone:raid-traps', zone: { id: 'raid-traps', task: 'raid', rule: 'heap', accepts: 'trap', items: [], x: p.x, y: gy(p.x, p.z), z: p.z, cols: 3, step: 1.4 }, position: { x: p.x + 1, y: gy(p.x, p.z), z: p.z + 2, facing: 0 } });
    const zone = getEntity(world, 'zone:raid-traps').zone;
    for (let i = 0; i < def.traps; i++) {
      addEntity(world, { id: `trap:${i + 1}`, item: { kind: 'trap', size: 1, task: 'raid', zone: 'raid-traps', home: 'raid-traps', held: null, set: false }, position: { x: p.x, y: gy(p.x, p.z), z: p.z, facing: 0 }, look: 'trap' });
      zone.items.push(`trap:${i + 1}`);
    }
    packHeap(world, zone);
    const a = { x: raid.wall.x + raid.dir.x * def.road.from, z: raid.wall.z + raid.dir.z * def.road.from };
    const b = { x: raid.wall.x + raid.dir.x * def.road.to, z: raid.wall.z + raid.dir.z * def.road.to };
    addEntity(world, {
      id: 'zone:raid-road',
      zone: {
        id: 'raid-road', task: 'raid', rule: 'road', accepts: 'trap', items: [], from: def.road.from, to: def.road.to,
        rect: { x0: Math.min(a.x, b.x) - LANE, x1: Math.max(a.x, b.x) + LANE, z0: Math.min(a.z, b.z) - LANE, z1: Math.max(a.z, b.z) + LANE },
      },
      position: { ...a, y: gy(a.x, a.z), facing: 0 },
    });
  }
  return r;
}

// The place system gives a trap in the hands to a zone of the raid: back on the pile, or on the
// road at the point of the tap (it snaps to the middle of the road, on the half-block grid). A
// place that has a trap already takes no other. Return true when the trap went in.
export function putRaid(world, e, zone, thing, at, env) {
  const r = raidOf(world);
  if (!r) return false;
  if (zone.rule === 'heap') {
    thing.item.zone = zone.id;
    zone.items.push(thing.id);
    packHeap(world, zone);
    return true;
  }
  if (zone.rule !== 'road' || r.raid.result) return false;
  const raid = r.raid;
  const d = Math.round(Math.max(zone.from, Math.min(zone.to, along(raid, at ?? e.position))));
  const taken = zone.items.some((id) => getEntity(world, id)?.item.slot === d);
  if (taken) return false;
  thing.item.zone = zone.id;
  thing.item.slot = d;
  zone.items.push(thing.id);
  const x = raid.wall.x + raid.dir.x * d;
  const z = raid.wall.z + raid.dir.z * d;
  thing.position = { x, y: env.groundY(x / 2, z / 2), z, facing: Math.atan2(raid.dir.x, raid.dir.z) };
  const ev = trapPut(raid, d);
  if (ev) world.events.push(ev);
  return true;
}

// The point of a trap on the road for a tap: the snapped point, or null when the tap is not on
// the part of the road for traps.
export function roadPoint(world, p) {
  const r = raidOf(world);
  const zone = getEntity(world, 'zone:raid-road')?.zone;
  if (!r || !zone) return null;
  const raid = r.raid;
  const d = along(raid, p);
  const off = Math.abs((p.x - raid.wall.x) * -raid.dir.z + (p.z - raid.wall.z) * raid.dir.x);
  if (d < zone.from - 1 || d > zone.to + 1 || off > LANE + 1) return null;
  const k = Math.round(Math.max(zone.from, Math.min(zone.to, d)));
  return { x: raid.wall.x + raid.dir.x * k, z: raid.wall.z + raid.dir.z * k, d: k };
}
