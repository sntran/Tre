// Work: the Five Trials as tasks in the village (the rules are in ../trials.js, the numbers in
// data/trials.json). The talk of a person starts a task (setupTrial): its things lie in the
// world, and the child works with the hands and with taps (the command "work"). The place system
// carries the things; this system puts them in the zones of the tasks, keeps the timed parts (the
// glow of the iron, the tide), and answers each commit with the world, never with a text:
//   bundle: ten rods tie into a bundle; more or fewer, and the band snaps.
//   forge: the iron hisses in the water and becomes hard; too early or too late, it bends.
//   stakes: at the tide, the fish stay in the trap, or they swim out through the widest space.
//   basket: the healer takes the basket; or gives it back, and the extra herbs fly to their beds.
//   cut: equal sticks tie into a bundle; if not, the short stick breaks and a new stem comes.
//   horse (the iron horse): with the lumps that the smith needs in the hearth, the bellows light
//     the fire, and the iron on the anvil becomes the horse in the water; with too few, the fire
//     puffs and dies; with too many, the extra rolls back to the heap.
//   slash (bamboo staffs for the boss): each slash cuts at once; after the last slash, equal pieces
//     tie into a bundle of staffs; if not, the short piece breaks and a new stem comes.
//   share (the loot after a raid): equal coins on the mats make all happy; if not, Nghé sulks.
//   feed (rice for Gióng): each ten bowls in the pot, Gióng eats and grows one head taller.
// When a task is done, the event "trial" goes out (the session sets the flag and gives the reward).
export const WRITES = ['work', 'zone', 'item', 'position', 'hidden', 'look', 'keep', 'glow', 'follow', 'events'];

import { query, getEntity, addEntity, removeEntity } from '../state.js';
import { REACH } from '../zones.js';
import { taskOf, tieResult, glowAt, quenchResult, stakeResult, basketResult, cutResult, trialSkill, feedResult, tenResult, hearthResult, shareResult } from '../trials.js';

const BEND = 1.2; // seconds: the bent iron cools before it goes back into the fire
const TIDE_IN = 2.5; // seconds: the tide stands high over the stakes
const TIDE_OUT = 3; // seconds: the tide goes out and shows the trap
const NEW_STEM = 1.2; // seconds: a new stem comes after sticks that are not equal

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const say = (world, type, id, extra = {}) => world.events.push({ type, id, ...extra });
const trialZone = (world, id) => getEntity(world, `zone:trial-${id}`);
const zoneEnt = (world, id) => getEntity(world, `zone:${id}`);

export function work(world, dt, rng, env) {
  for (const e of query(world, 'work', 'position')) {
    const want = e.work;
    delete e.work;
    if (!e.fall) act(world, e, want, env);
  }
  if (world.paused) return;
  for (const z of query(world, 'zone')) {
    if (z.zone.rule !== 'trial' || z.zone.done) continue;
    if (z.zone.task === 'forge' || z.zone.task === 'horse') tickForge(world, z, dt, env);
    if (z.zone.task === 'stakes') tickTide(world, z, dt, env);
    if (z.zone.task === 'cut') tickStem(world, z, dt);
    if (z.zone.task === 'slash') tickSlash(world, z, dt);
    if (z.zone.task === 'share') tickShare(world, z, dt, env);
  }
}

// The definition of a trial and the numbers of its task at the level of the child.
function taskFor(env, zone) {
  const def = env.trials?.trials.find((t) => t.id === zone.trial);
  return def ? taskOf(def, zone.level) : null;
}

// A commit: one skill event, and the count of commits of the trial.
function commit(world, tz, task, result) {
  tz.zone.commits += 1;
  if (!result.solved) tz.zone.fails += 1;
  // Each ten of the rice is a new try of its own (first); in the other tasks only the first commit is.
  say(world, 'skill', tz.id, trialSkill(task, { ...result, first: result.first ?? tz.zone.commits === 1, resets: tz.zone.resets }));
}

function finish(world, tz) {
  tz.zone.done = true;
  say(world, 'trial', tz.id, { trial: tz.zone.trial, done: true, sound: 'drum' });
}

// Set up the things of a trial in the world, at the named places of the map (env.places).
// level: the level of the task (0, 1, or 2). A trial that has its things already stays as it is.
export function setupTrial(world, def, level, env) {
  if (trialZone(world, def.id)) return trialZone(world, def.id);
  const task = taskOf(def, level);
  const P = (name) => env.places[name];
  // The share after a raid has no places of the map: it lies behind the wall of the raid (at).
  const first = def.at ? { ...def.at, y: env.groundY(def.at.x / 2, def.at.z / 2) } : P(Object.values(def.places).flat()[0]);
  const tz = addEntity(world, {
    id: `zone:trial-${def.id}`,
    keep: true,
    zone: { id: `trial-${def.id}`, rule: 'trial', trial: def.id, task: def.task, level, commits: 0, fails: 0, resets: 0, done: false, made: 0 },
    position: { x: first.x, y: first.y, z: first.z, facing: 0 },
  });
  const owner = `trial-${def.id}`;
  const heap = (id, place, accepts, extra = {}) => addEntity(world, {
    id: `zone:${id}`,
    keep: true,
    zone: { id, task: owner, rule: 'heap', accepts, items: [], x: place.x, y: place.y, z: place.z, cols: 4, step: 1, ...extra },
    position: { x: place.x + 1, y: place.y, z: place.z + 1, facing: 0 },
  });
  const things = (zone, kind, n, look = kind) => {
    for (let i = 0; i < n; i++) {
      const id = `${kind}:${def.id}:${tz.zone.made++}`;
      addEntity(world, { id, keep: true, item: { kind, size: 1, task: owner, zone: zone.zone.id, home: zone.zone.id, held: null, set: false }, position: { x: zone.zone.x, y: zone.zone.y, z: zone.zone.z, facing: 0 }, look });
      zone.zone.items.push(id);
    }
    packHeap(world, zone.zone);
  };
  const rect = (p, w, d) => ({ x0: p.x - 1, x1: p.x + w + 1, z0: p.z - 1, z1: p.z + d + 1 });

  if (def.task === 'bundle') {
    const rods = heap('rods', P(def.places.heap), 'rod', { cols: 8, step: 0.7 });
    things(rods, 'rod', task.rods);
    const m = P(def.places.mat);
    addEntity(world, { id: 'zone:mat', keep: true, zone: { id: 'mat', task: owner, rule: 'bundle', accepts: 'rod', items: [], x: m.x, y: m.y, z: m.z, tied: 0, rect: rect(m, 4, 2) }, position: { x: m.x - 1.5, y: m.y, z: m.z + 1, facing: 0 } });
    addEntity(world, { id: 'mat:scholar', keep: true, position: { x: m.x, y: m.y, z: m.z, facing: 0 }, look: 'mat' });
    // A coil of straw rope by the mat: a tap on it ties the rods on the mat.
    addEntity(world, { id: 'band:scholar', keep: true, item: { kind: 'band', size: 1, task: owner, zone: null, held: null, set: true, fixed: true }, position: { x: m.x + 4.6, y: m.y, z: m.z + 1, facing: 0 }, look: 'band' });
  } else if (def.task === 'forge') {
    const ore = heap('ore', P(def.places.ore), 'ore', { cols: 3 });
    things(ore, 'ore', task.ore + 2);
    const f = P(def.places.forge);
    addEntity(world, { id: 'zone:forge', keep: true, zone: { id: 'forge', task: owner, rule: 'forge', accepts: 'ore', items: [], need: task.ore, x: f.x, y: f.y, z: f.z, rect: rect(f, 3, 2) }, position: { x: f.x + 1, y: f.y, z: f.z + 2, facing: 0 } });
    const bucket = heap('bucket', P(def.places.bucket), 'bucket');
    things(bucket, 'bucket', 1);
    const t = P(def.places.trough);
    addEntity(world, { id: 'zone:trough', keep: true, zone: { id: 'trough', task: owner, rule: 'trough', accepts: 'bucket', items: [], full: false, x: t.x, y: t.y, z: t.z, rect: rect(t, 3, 2) }, position: { x: t.x + 1.5, y: t.y, z: t.z + 2, facing: 0 } });
    addEntity(world, { id: 'trough:smith', keep: true, position: { x: t.x, y: t.y, z: t.z, facing: 0 }, look: 'trough' });
    const a = P(def.places.anvil);
    tz.zone.anvil = { x: a.x, y: a.y, z: a.z };
    tz.zone.heat = null;
  } else if (def.task === 'horse') {
    // The done trial of the smith leaves its forge: its ore, its bucket, and its blade go.
    if (def.clears) {
      for (const t of query(world, 'item')) if (t.item.task === `trial-${def.clears}`) removeEntity(world, t.id);
      for (const z of query(world, 'zone')) if (z.zone.task === `trial-${def.clears}`) z.zone.items = [];
    }
    const ore = heap('horse-ore', P(def.places.ore), 'ore', { cols: 3 });
    things(ore, 'ore', task.ore + (def.extra ?? 3));
    const f = P(def.places.forge);
    addEntity(world, { id: 'zone:hearth', keep: true, zone: { id: 'hearth', task: owner, rule: 'hearth', accepts: 'ore', items: [], x: f.x, y: f.y, z: f.z, rect: rect(f, 3, 2) }, position: { x: f.x + 1, y: f.y, z: f.z + 2, facing: 0 } });
    // The bellows by the hearth: a tap on them blows on the fire (the commit of the count).
    addEntity(world, { id: 'bellows:horse', keep: true, item: { kind: 'bellows', size: 1, task: owner, zone: null, held: null, set: true, fixed: true }, position: { x: f.x - 1.2, y: f.y, z: f.z + 1, facing: 0 }, look: 'bellows' });
    const a = P(def.places.anvil);
    Object.assign(tz.zone, { anvil: { x: a.x, y: a.y, z: a.z }, heat: null, iron: 'iron:horse', blows: 0, quenches: 0 });
  } else if (def.task === 'stakes') {
    const stakes = heap('stakes', P(def.places.stakes), 'stake', { cols: 4 });
    const length = task.space * task.gaps;
    things(stakes, 'stake', task.gaps + 1 - 2 + (def.extra ?? 2));
    const l = P(def.places.line);
    const line = addEntity(world, {
      id: 'zone:line',
      keep: true,
      zone: { id: 'line', task: owner, rule: 'line', accepts: 'stake', items: [], x: l.x, y: l.y, z: l.z, length, space: task.space, rect: { x0: l.x - 1, x1: l.x + length + 1, z0: l.z - 2, z1: l.z + 2 } },
      position: { x: l.x + length / 2, y: l.y, z: l.z - 3, facing: 0 },
    });
    // The fisher put the first two stakes: the space between them is the space of the row.
    for (const [n, at] of [['a', 0], ['b', task.space]]) {
      addEntity(world, { id: `stake:fisher:${n}`, keep: true, item: { kind: 'stake', size: 1, task: owner, zone: 'line', held: null, set: true, slot: at }, position: { x: l.x + at, y: l.y, z: l.z, facing: 0 }, look: 'stake-set' });
    }
    addEntity(world, { id: 'mark:fisher:end', keep: true, position: { x: l.x + length, y: l.y, z: l.z, facing: 0 }, look: 'end-mark' });
    addEntity(world, { id: 'tide:fisher', keep: true, position: { x: l.x, y: l.y, z: l.z, facing: 0 }, look: 'tide-0', tide: { length } });
    tz.zone.tide = { t: 0, every: task.tide, phase: 'low' };
    void line;
  } else if (def.task === 'basket') {
    def.kinds.forEach((kind, i) => {
      const bed = heap(`bed-${kind}`, P(def.places.beds[i]), `herb-${kind}`, { cols: 4 });
      things(bed, `herb-${kind}`, def.bed ?? 7);
    });
    const b = P(def.places.basket);
    addEntity(world, { id: 'zone:basket', keep: true, zone: { id: 'basket', task: owner, rule: 'basket', accepts: def.kinds.map((k) => `herb-${k}`), kinds: def.kinds, items: [], x: b.x, y: b.y, z: b.z, rect: rect(b, 3, 1) }, position: { x: b.x + 1.5, y: b.y, z: b.z - 1.5, facing: 0 } });
    addEntity(world, { id: 'basket:healer', keep: true, position: { x: b.x, y: b.y, z: b.z, facing: 0 }, look: 'basket' });
  } else if (def.task === 'feed') {
    // Trays of 3 and 5 bowls on the path of the paddies, and the pot in front of the house of Gióng.
    const trays = heap('trays', P(def.places.trays), 'bowls', { cols: 3, step: 1.6 });
    for (const [size, n] of Object.entries(def.trays)) for (let i = 0; i < n; i++) addTray(world, trays.zone, Number(size), owner, tz);
    packHeap(world, trays.zone);
    const p = P(def.places.pot);
    addEntity(world, { id: 'zone:pot', keep: true, zone: { id: 'pot', task: owner, rule: 'feed', accepts: 'bowls', items: [], x: p.x, y: p.y, z: p.z, rect: rect(p, 2, 2) }, position: { x: p.x + 1, y: p.y, z: p.z + 2.5, facing: 0 } });
    addEntity(world, { id: 'pot:rice', keep: true, position: { x: p.x, y: p.y, z: p.z, facing: 0 }, look: 'rice-pot-0' });
    Object.assign(tz.zone, { ones: 0, heads: 0, group: [], start: 0 });
  } else if (def.task === 'share') {
    // Behind the wall: the pile, and a row of three mats across the road, with the friends
    // behind their mats (the basket of the hero, Nghé, and Gióng).
    const gy = (x, z) => env.groundY(x / 2, z / 2);
    const back = { x: -def.dir.x, z: -def.dir.z };
    const side = { x: -def.dir.z, z: def.dir.x };
    const pt = (b, s) => { const x = def.at.x + back.x * b + side.x * s; const z = def.at.z + back.z * b + side.z * s; return { x, y: gy(x, z), z }; };
    const pile = heap('loot', pt(3, 0), 'coin', { cols: 4, step: 0.7 });
    things(pile, 'coin', def.loot);
    def.who.forEach((who, i) => {
      const m = pt(7, (i - 1) * 3.5);
      addEntity(world, { id: `zone:share-${who}`, keep: true, zone: { id: `share-${who}`, task: owner, rule: 'share', accepts: 'coin', who, items: [], x: m.x, y: m.y, z: m.z, rect: { x0: m.x - 1.4, x1: m.x + 1.4, z0: m.z - 1.4, z1: m.z + 1.4 } }, position: { x: m.x - back.x * 2, y: m.y, z: m.z - back.z * 2, facing: 0 } });
      addEntity(world, { id: `mat:share-${who}`, keep: true, position: { x: m.x, y: m.y, z: m.z, facing: 0 }, look: 'share-mat' });
      // A friend stands behind the mat; where the ground there is not level with the mat (a paddy),
      // in front of it.
      const behind = pt(9, (i - 1) * 3.5);
      const by = Math.abs(behind.y - m.y) < 0.6 ? behind : pt(4.8, (i - 1) * 3.5);
      const face = Math.atan2(-back.x, -back.z) + (by === behind ? 0 : Math.PI);
      if (who === 'hero') addEntity(world, { id: 'by:share-hero', keep: true, position: { ...by, facing: face }, look: 'basket' });
      if (who === 'giong') addEntity(world, { id: 'by:share-giong', keep: true, position: { ...by, facing: face }, look: 'giong-hero' });
      const friend = friendOf(world);
      if (who === 'nghe' && friend) friend.follow.goal = { x: by.x, z: by.z, face };
    });
    Object.assign(tz.zone, { loot: def.loot, who: def.who, settled: null, leave: null, face: Math.atan2(-back.x, -back.z) });
  } else if (def.task === 'slash') {
    const s = P(def.places.stem);
    Object.assign(tz.zone, { stem: { x: s.x, y: s.y, z: s.z, length: task.length }, cuts: [], pieces: [] });
    layPieces(world, tz);
  } else if (def.task === 'cut') {
    const s = P(def.places.stem);
    tz.zone.stem = { x: s.x, y: s.y, z: s.z, length: task.length };
    tz.zone.marks = [];
    addEntity(world, { id: 'stem:woodcutter', keep: true, item: { kind: 'stem', size: task.length, task: owner, zone: null, held: null, set: true, fixed: true }, position: { x: s.x, y: s.y, z: s.z, facing: Math.PI / 2 }, look: `stem-${task.length}` });
    const w = P(def.places.pile);
    addEntity(world, { id: 'zone:woodpile', keep: true, zone: { id: 'woodpile', task: owner, rule: 'woodpile', accepts: 'sticks', items: [], x: w.x, y: w.y, z: w.z, rect: rect(w, 3, 2) }, position: { x: w.x + 1, y: w.y, z: w.z + 2, facing: 0 } });
  }
  return tz;
}

// A tray of bowls of rice (3 or 5) in the heap on the path of the paddies.
function addTray(world, zone, size, owner, tz) {
  const id = `bowls:${size}:${tz.zone.made++}`;
  addEntity(world, { id, keep: true, item: { kind: 'bowls', size, task: owner, zone: zone.id, home: zone.id, held: null, set: false }, position: { x: zone.x, y: zone.y, z: zone.z, facing: 0 }, look: `bowls-${size}` });
  zone.items.push(id);
}

// The things of a heap lie close together in a small grid (rods, ore, stakes, herbs).
export function packHeap(world, zone) {
  const step = zone.step ?? 1;
  zone.items.forEach((id, i) => {
    const e = getEntity(world, id);
    if (!e) return;
    const col = i % (zone.cols ?? 4);
    const row = Math.floor(i / (zone.cols ?? 4));
    e.position = { x: zone.x + col * step, y: zone.y, z: zone.z + row * step, facing: e.item.kind === 'rod' ? ((i * 7) % 5) * 0.3 : 0 };
  });
}

// The rods on the mat: two rows, side by side.
function packMat(world, zone) {
  zone.items.forEach((id, i) => {
    const e = getEntity(world, id);
    if (e) e.position = { x: zone.x + 0.3 + (i % 7) * 0.5, y: zone.y + 0.15, z: zone.z + 0.5 + Math.floor(i / 7) * 1.3, facing: 0 };
  });
}

// The things in the basket, by kind: one part of the basket for each kind.
function packBasket(world, zone) {
  const n = {};
  for (const id of zone.items) {
    const e = getEntity(world, id);
    if (!e) continue;
    const k = zone.kinds.indexOf(e.item.kind.slice(5));
    const i = (n[k] = (n[k] ?? -1) + 1);
    e.position = { x: zone.x + 0.4 + k * 1.1 + (i % 2) * 0.4, y: zone.y + 0.4 + Math.floor(i / 4) * 0.2, z: zone.z + 0.3 + (Math.floor(i / 2) % 2) * 0.5, facing: 0 };
  }
}

// A thing goes back to its heap.
export function toHeap(world, thing) {
  const home = thing.item.home ? zoneEnt(world, thing.item.home) : null;
  if (!home) return;
  thing.item.zone = home.zone.id;
  thing.item.held = null;
  thing.hidden = false;
  if (!home.zone.items.includes(thing.id)) home.zone.items.push(thing.id);
  packHeap(world, home.zone);
}

// Take a thing out of the zone where it lies.
function takeOut(world, thing) {
  const z = thing.item.zone ? zoneEnt(world, thing.item.zone) : null;
  if (!z) return;
  z.zone.items = z.zone.items.filter((i) => i !== thing.id);
  if (z.zone.rule === 'heap') packHeap(world, z.zone);
  if (z.zone.rule === 'bundle') packMat(world, z.zone);
  if (z.zone.rule === 'basket') packBasket(world, z.zone);
  if (z.zone.rule === 'hearth') packHearth(world, z.zone);
  if (z.zone.rule === 'share') packShare(world, z.zone);
}

// The coins on a mat lie in a stack.
function packShare(world, zone) {
  zone.items.forEach((id, i) => {
    const e = getEntity(world, id);
    if (e) e.position = { x: zone.x + (i % 2) * 0.7 - 0.35, y: zone.y + 0.15 + Math.floor(i / 2) * 0.2, z: zone.z, facing: 0 };
  });
}

// The lumps in the hearth lie in rows of four.
function packHearth(world, zone) {
  zone.items.forEach((id, i) => {
    const e = getEntity(world, id);
    if (e) e.position = { x: zone.x + 0.5 + (i % 4) * 0.8, y: zone.y + 1, z: zone.z + 0.6 + Math.floor(i / 4) * 0.8, facing: 0 };
  });
}

// Can the hero take this thing? A thing that is set (the stakes of the fisher, a stem) cannot
// move; the stakes on the line wait for the tide while the tide is in.
export function canTakeWork(world, thing) {
  if (thing.item.fixed || thing.item.set) return false;
  if (thing.item.zone === 'forge') return false;
  if (thing.item.task === 'trial-share' && trialZone(world, 'share')?.zone.leave !== null) return false;
  if (thing.item.zone === 'hearth') return trialZone(world, 'horse')?.zone.heat === null;
  if (thing.item.zone === 'line') {
    const tz = trialZone(world, 'fisher');
    return tz?.zone.tide?.phase === 'low';
  }
  return true;
}

// The place system gives a thing in the hands to a zone of a task. at: the point of the tap (the
// line of stakes). Return true when the thing went in.
export function putWork(world, e, zone, thing, at, env) {
  const tz = trialZone(world, thing.item.task.slice(6));
  if (!tz) return false;
  if (zone.rule === 'heap') {
    thing.item.zone = zone.id;
    zone.items.push(thing.id);
    packHeap(world, zone);
  } else if (zone.rule === 'forge') {
    thing.item.zone = zone.id;
    zone.items.push(thing.id);
    if (zone.items.length > zone.need) {
      // The forge is full: the extra ore rolls back to the heap.
      zone.items.pop();
      toHeap(world, thing);
      say(world, 'roll', `zone:${zone.id}`, { item: thing.id, sound: 'plank-down' });
      return true;
    }
    thing.position = { x: zone.x + 0.5 + (zone.items.length - 1) * 0.8, y: zone.y + 1, z: zone.z + 0.8, facing: 0 };
    thing.look = 'ore-hot';
  } else if (zone.rule === 'hearth') {
    if (tz.zone.heat !== null) return false;
    thing.item.zone = zone.id;
    zone.items.push(thing.id);
    packHearth(world, zone);
  } else if (zone.rule === 'share') {
    if (tz.zone.leave !== null) return false;
    thing.item.zone = zone.id;
    zone.items.push(thing.id);
    packShare(world, zone);
  } else if (zone.rule === 'trough') {
    // The water goes into the trough, and the bucket goes back to the well.
    zone.full = true;
    const trough = getEntity(world, 'trough:smith');
    if (trough) trough.look = 'trough-full';
    toHeap(world, thing);
    say(world, 'pour', `zone:${zone.id}`, { sound: 'splash' });
  } else if (zone.rule === 'line') {
    if (tz.zone.tide?.phase !== 'low') return false;
    const slot = Math.max(1, Math.min(zone.length, Math.round((at?.x ?? zone.x) - zone.x)));
    const taken = query(world, 'item').some((s) => s.item.zone === 'line' && s.item.slot === slot && s.id !== thing.id);
    if (taken) return false;
    thing.item.zone = zone.id;
    thing.item.slot = slot;
    zone.items.push(thing.id);
    thing.position = { x: zone.x + slot, y: zone.y, z: zone.z, facing: 0 };
  } else if (zone.rule === 'basket') {
    thing.item.zone = zone.id;
    zone.items.push(thing.id);
    packBasket(world, zone);
  } else if (zone.rule === 'feed') {
    feed(world, tz, thing, env);
    return true;
  } else if (zone.rule === 'woodpile') {
    thing.item.zone = zone.id;
    thing.item.set = true;
    zone.items.push(thing.id);
    thing.position = { x: zone.x + 0.5, y: zone.y, z: zone.z + 0.5, facing: Math.PI / 2 };
    finish(world, tz);
  } else return false;
  if (tz.zone.task === 'forge') readyIron(world, tz);
  say(world, 'put', e.id, { item: thing.id, zone: zone.id, sound: 'plank-down' });
  return true;
}

// The work of the hands: add (a rod from the heap to the mat), back (a rod from the mat to the
// heap), tie (the rods on the mat), quench (the iron into the water), give (the basket to the
// healer), mark (a chalk mark on the stem, or away), and cut (the woodcutter cuts at the marks).
function act(world, e, want, env) {
  const tz = trialZone(world, want.trial);
  if (!tz || tz.zone.done) return;
  const task = taskFor(env, tz.zone);
  if (!task) return;
  const near = (p, r = REACH + 2) => p && dist(e.position, p) <= r;
  if (want.act === 'add' || want.act === 'back') {
    const rod = getEntity(world, want.item);
    const mat = zoneEnt(world, 'mat');
    if (!rod || !mat || !near(mat.position, REACH + 3)) return say(world, 'far', e.id);
    if (want.act === 'add' && rod.item.zone === 'rods' && mat.zone.items.length < 14) {
      takeOut(world, rod);
      rod.item.zone = 'mat';
      mat.zone.items.push(rod.id);
      packMat(world, mat.zone);
      say(world, 'add', mat.id, { item: rod.id, sound: 'tap' });
    } else if (want.act === 'back' && rod.item.zone === 'mat') {
      takeOut(world, rod);
      tz.zone.resets += 1;
      toHeap(world, rod);
      say(world, 'back', mat.id, { item: rod.id, sound: 'tap' });
    }
  } else if (want.act === 'tie') {
    const mat = zoneEnt(world, 'mat');
    if (!mat || !mat.zone.items.length || !near(mat.position, REACH + 3)) return;
    const n = mat.zone.items.length;
    const solved = tieResult(n, task.bundle);
    commit(world, tz, task, { solved, parts: [n], target: task.bundle });
    if (solved) {
      // Ten rods tie into a bundle, and the bundle goes to the row by the teacher.
      for (const id of mat.zone.items) removeEntity(world, id);
      mat.zone.items = [];
      const k = mat.zone.tied++;
      addEntity(world, { id: `bundle:scholar:${k}`, keep: true, position: { x: mat.zone.x + 0.5 + k * 0.9, y: mat.zone.y, z: mat.zone.z - 2.5, facing: 0 }, look: 'rod-bundle' });
      say(world, 'tie', mat.id, { sound: 'plank-up' });
      const heapZone = zoneEnt(world, 'rods');
      if ((heapZone?.zone.items.length ?? 0) < task.bundle) finish(world, tz);
    } else {
      // The band snaps, and the rods fall back on the heap.
      for (const id of mat.zone.items) {
        const rod = getEntity(world, id);
        if (rod) toHeap(world, rod);
      }
      mat.zone.items = [];
      say(world, 'snap', mat.id, { count: n, sound: 'plank-down' });
    }
  } else if (want.act === 'blow') {
    // The bellows: the count of the lumps in the hearth is the commit.
    const hearth = zoneEnt(world, 'hearth');
    if (!hearth || tz.zone.heat !== null || !near(hearth.position, REACH + 3)) return;
    const count = hearth.zone.items.length;
    const r = hearthResult(count, task.ore);
    tz.zone.blows += 1;
    commit(world, tz, { ...task, ...task.count }, { solved: r.solved, first: tz.zone.blows === 1, parts: [count], target: task.ore });
    if (r.solved) {
      // The fire burns high: the lumps melt, and the iron lies on the anvil.
      for (const id of hearth.zone.items) removeEntity(world, id);
      hearth.zone.items = [];
      const a = tz.zone.anvil;
      addEntity(world, { id: tz.zone.iron, keep: true, item: { kind: 'iron', size: 2, task: `trial-${tz.zone.trial}`, zone: null, held: null, set: true, fixed: true }, position: { x: a.x, y: a.y + 1, z: a.z, facing: Math.PI / 2 }, look: 'iron-0' });
      tz.zone.heat = 0;
      say(world, 'fire', tz.id, { sound: 'lantern' });
    } else if (r.short) {
      say(world, 'puff', hearth.id, { sound: 'tap' });
    } else {
      // The fire chokes: the extra lumps roll back to the heap.
      for (let i = 0; i < r.over; i++) {
        const lump = getEntity(world, hearth.zone.items.pop());
        if (lump) toHeap(world, lump);
      }
      packHearth(world, hearth.zone);
      say(world, 'roll', hearth.id, { sound: 'plank-down' });
    }
  } else if (want.act === 'quench') {
    const iron = getEntity(world, tz.zone.iron ?? 'iron:smith');
    if (!iron || tz.zone.heat === null || tz.zone.bent || !near(tz.zone.anvil, REACH + 3)) return;
    const value = glowAt(tz.zone.heat, task.glow, task.hold);
    const solved = quenchResult(value, task.glow);
    if (tz.zone.quenches !== undefined) tz.zone.quenches += 1;
    commit(world, tz, task, { solved, first: tz.zone.quenches === undefined ? undefined : tz.zone.quenches === 1, parts: [Math.round(value * 10)], target: Math.round(task.glow.hot * 10) });
    if (solved) {
      iron.look = task.made ?? 'blade';
      iron.item.set = true;
      tz.zone.heat = null;
      say(world, 'hiss', iron.id, { sound: 'splash', at: iron.position });
      finish(world, tz);
    } else {
      iron.look = 'iron-bent';
      tz.zone.bent = BEND;
      say(world, 'bend', iron.id, { sound: 'plank-down', early: value > 0 && tz.zone.heat % (task.glow.rise + task.hold + task.glow.dim + task.glow.cold) < task.glow.rise });
    }
  } else if (want.act === 'give') {
    const basket = zoneEnt(world, 'basket');
    const healer = query(world, 'person').find((p) => p.person.ref === 'healer');
    if (!basket || !basket.zone.items.length || (healer && !near(healer.position, REACH + 3))) return;
    const counts = {};
    for (const id of basket.zone.items) {
      const k = getEntity(world, id)?.item.kind.slice(5);
      if (k) counts[k] = (counts[k] ?? 0) + 1;
    }
    const result = basketResult(counts, basket.zone.kinds, task.each);
    commit(world, tz, task, { solved: result.solved, parts: basket.zone.kinds.map((k) => counts[k] ?? 0), target: task.each * basket.zone.kinds.length });
    if (result.solved) {
      for (const id of basket.zone.items) removeEntity(world, id);
      basket.zone.items = [];
      const b = getEntity(world, 'basket:healer');
      if (b) b.look = 'basket-full';
      say(world, 'given', basket.id, { sound: 'pickup' });
      finish(world, tz);
    } else {
      // The healer gives the basket back: the herbs over the number fly back to their beds.
      for (const k of basket.zone.kinds) {
        let extra = result.extra[k];
        for (const id of [...basket.zone.items].reverse()) {
          const h = getEntity(world, id);
          if (extra <= 0 || h?.item.kind !== `herb-${k}`) continue;
          takeOut(world, h);
          toHeap(world, h);
          extra -= 1;
        }
      }
      say(world, 'nope', healer?.id ?? basket.id, { sound: 'tap' });
    }
  } else if (want.act === 'mark') {
    const stem = getEntity(world, 'stem:woodcutter');
    const s = tz.zone.stem;
    if (!stem || stem.hidden || tz.zone.cut) return;
    const at = Math.round(want.at);
    if (at <= 0 || at >= s.length) return;
    const id = `chalk:woodcutter:${at}`;
    if (tz.zone.marks.includes(at)) {
      tz.zone.marks = tz.zone.marks.filter((m) => m !== at);
      tz.zone.resets += 1;
      removeEntity(world, id);
    } else {
      tz.zone.marks.push(at);
      addEntity(world, { id, keep: true, position: { x: s.x + at, y: s.y + 0.6, z: s.z, facing: 0 }, look: 'chalk' });
    }
    say(world, 'mark', stem.id, { at, sound: 'tap' });
  } else if (want.act === 'slash') {
    // A slash at the nearest ring of the bamboo stem: it cuts at once.
    const s = tz.zone.stem;
    const at = Math.round(want.at);
    if (!s || tz.zone.cut || at <= 0 || at >= s.length || tz.zone.cuts.includes(at)) return;
    tz.zone.cuts.push(at);
    layPieces(world, tz);
    say(world, 'slash', tz.id, { at, sound: 'plank-up' });
    if (tz.zone.cuts.length < task.parts - 1) return;
    const result = cutResult(tz.zone.cuts, s.length, task.parts);
    commit(world, tz, task, { solved: result.solved, parts: result.pieces, target: s.length });
    if (result.solved) {
      // Equal staffs, tied into a bundle for the men of the village.
      for (const id of tz.zone.pieces) removeEntity(world, id);
      tz.zone.pieces = [];
      addEntity(world, { id: 'staffs:bamboo', keep: true, position: { x: s.x + s.length / 2 - 1, y: s.y, z: s.z, facing: Math.PI / 2 }, look: `staffs-${task.parts}` });
      say(world, 'chop', tz.id, { sound: 'plank-up', pieces: result.pieces });
      finish(world, tz);
    } else {
      // The pieces are not equal: the short one breaks, and a new stem comes.
      const shortest = Math.min(...result.pieces);
      const ends = [0, ...[...tz.zone.cuts].sort((a, b) => a - b)];
      const i = result.pieces.indexOf(shortest);
      removeEntity(world, `stem:staffs:${ends[i]}`);
      tz.zone.cut = NEW_STEM;
      say(world, 'snap', tz.id, { pieces: result.pieces, short: shortest, sound: 'plank-down' });
    }
  } else if (want.act === 'cut') {
    const s = tz.zone.stem;
    const person = query(world, 'person').find((p) => p.person.ref === 'woodcutter');
    if (!s || !tz.zone.marks.length || tz.zone.cut || (person && !near(person.position, REACH + 3))) return;
    const result = cutResult(tz.zone.marks, s.length, task.parts);
    commit(world, tz, task, { solved: result.solved, parts: result.pieces, target: s.length });
    for (const m of tz.zone.marks) removeEntity(world, `chalk:woodcutter:${m}`);
    tz.zone.marks = [];
    const stem = getEntity(world, 'stem:woodcutter');
    if (result.solved) {
      // Equal sticks, tied into a bundle, to carry to the wood pile by the bridge.
      if (stem) removeEntity(world, stem.id);
      addEntity(world, { id: 'sticks:woodcutter', keep: true, item: { kind: 'sticks', size: 2, task: `trial-woodcutter`, zone: null, home: null, held: null, set: false }, position: { x: s.x + s.length / 2 - 1, y: s.y, z: s.z, facing: Math.PI / 2 }, look: `sticks-${task.parts}` });
      say(world, 'chop', `zone:trial-woodcutter`, { sound: 'plank-up', pieces: result.pieces });
    } else {
      // The sticks are not equal: the short one breaks, and a new stem comes.
      const shortest = Math.min(...result.pieces);
      if (stem) stem.hidden = true;
      tz.zone.cut = NEW_STEM;
      say(world, 'snap', `zone:trial-woodcutter`, { pieces: result.pieces, short: shortest, sound: 'plank-down' });
    }
  }
}

// A tray of bowls goes into the pot of Gióng: each full ten, Gióng eats and grows one head taller;
// the rest stays in the pot. Each ten is a commit. The tray comes back full to the path.
function feed(world, tz, thing, env) {
  const def = env.trials?.trials.find((t) => t.id === tz.zone.trial);
  const task = taskFor(env, tz.zone);
  const size = thing.item.size;
  const home = zoneEnt(world, thing.item.home);
  removeEntity(world, thing.id);
  if (home) {
    addTray(world, home.zone, size, thing.item.task, tz);
    packHeap(world, home.zone);
  }
  tz.zone.group.push(size);
  const r = feedResult(tz.zone.ones, size);
  if (r.grew) {
    const ten = tenResult(tz.zone.group, tz.zone.start, Object.keys(def.trays).map(Number).sort((a, b) => a - b));
    commit(world, tz, task, { solved: ten.solved, efficient: ten.efficient, first: true, parts: [...tz.zone.group], target: 10 - tz.zone.start });
    tz.zone.heads += r.grew;
    tz.zone.group = [];
    tz.zone.start = r.ones;
    const giong = getEntity(world, `npc:${def.grows ?? 'giong-boy'}`);
    if (giong) giong.look = `giong-boy-${Math.min(5, tz.zone.heads)}`;
    say(world, 'grow', tz.id, { heads: tz.zone.heads, sound: 'drum' });
  } else say(world, 'bowls', tz.id, { sound: 'tap' });
  tz.zone.ones = r.ones;
  const pot = getEntity(world, 'pot:rice');
  if (pot) pot.look = `rice-pot-${r.ones}`;
  if (tz.zone.heads >= task.heads) finish(world, tz);
}

// The iron goes into the fire when the forge has its ore and the trough has water.
function readyIron(world, tz) {
  const forge = zoneEnt(world, 'forge');
  const trough = zoneEnt(world, 'trough');
  if (!forge || !trough || forge.zone.items.length < forge.zone.need || !trough.zone.full || getEntity(world, 'iron:smith')) return;
  const a = tz.zone.anvil;
  addEntity(world, { id: 'iron:smith', keep: true, item: { kind: 'iron', size: 2, task: 'trial-smith', zone: null, held: null, set: true, fixed: true }, position: { x: a.x, y: a.y + 1, z: a.z, facing: Math.PI / 2 }, look: 'iron-0' });
  tz.zone.heat = 0;
  say(world, 'fire', tz.id, { sound: 'lantern' });
}

function tickForge(world, tz, dt, env) {
  const iron = getEntity(world, tz.zone.iron ?? 'iron:smith');
  if (!iron || tz.zone.heat === null) return;
  const task = taskFor(env, tz.zone);
  if (tz.zone.bent) {
    tz.zone.bent -= dt;
    if (tz.zone.bent > 0) return;
    delete tz.zone.bent;
    tz.zone.heat = 0;
  }
  tz.zone.heat += dt;
  const value = glowAt(tz.zone.heat, task.glow, task.hold);
  // The iron turns hot: a sound, so that the child hears the moment too.
  if ((iron.glow ?? 0) < task.glow.hot && quenchResult(value, task.glow)) say(world, 'glow', iron.id, { sound: 'lantern' });
  iron.glow = Math.round(value * 100) / 100;
  iron.look = `iron-${Math.round(value * 3)}`;
}

// The tide: it comes in after some seconds; the row of stakes is the commit. Then it goes out and
// shows the trap: the fish stay in, or they swim out through the widest space.
function tickTide(world, tz, dt, env) {
  const tide = tz.zone.tide;
  const line = zoneEnt(world, 'line');
  const water = getEntity(world, 'tide:fisher');
  if (!tide || !line) return;
  const task = taskFor(env, tz.zone);
  tide.t += dt;
  if (tide.phase === 'low') {
    // The water rises in the last part of the wait, so that the child sees it come.
    const k = Math.max(0, (tide.t - (tide.every - 10)) / 10);
    if (water) water.look = `tide-${Math.min(2, Math.floor(k * 3))}`;
    if (tide.t < tide.every) return;
    const offsets = query(world, 'item').filter((s) => s.item.zone === 'line').map((s) => s.item.slot);
    const result = stakeResult(offsets, line.zone.length, line.zone.space);
    commit(world, tz, task, { solved: result.solved, efficient: result.efficient, parts: result.gaps, target: line.zone.length });
    tide.phase = 'in';
    tide.t = 0;
    tide.result = { solved: result.solved, widest: result.widest };
    if (water) water.look = 'tide-3';
    say(world, 'tide', tz.id, { sound: 'splash' });
  } else if (tide.phase === 'in' && tide.t >= TIDE_IN) {
    tide.phase = 'out';
    tide.t = 0;
    if (water) water.look = 'tide-0';
    const r = tide.result;
    const fish = r.solved ? 'fish-in' : 'fish-out';
    const at = r.solved ? line.zone.length / 2 : r.widest.from + r.widest.size / 2;
    addEntity(world, { id: 'fish:fisher', keep: true, position: { x: line.zone.x + at, y: line.zone.y, z: line.zone.z + (r.solved ? 1 : -0.5), facing: 0 }, look: fish });
    say(world, r.solved ? 'catch' : 'escape', tz.id, { at: { x: line.zone.x + at, z: line.zone.z }, sound: 'splash' });
  } else if (tide.phase === 'out' && tide.t >= TIDE_OUT) {
    const r = tide.result;
    if (r.solved) {
      finish(world, tz);
      return;
    }
    removeEntity(world, 'fish:fisher');
    tide.phase = 'low';
    tide.t = 0;
    tide.result = null;
  }
}

// A new stem comes after sticks that were not equal.
// The pieces of the bamboo stem between the slashes, with a small space between them. A piece
// knows where it starts on the stem (from), so that a tap on it gives a place on the whole stem.
function layPieces(world, tz) {
  const s = tz.zone.stem;
  for (const id of tz.zone.pieces) removeEntity(world, id);
  const ends = [0, ...[...tz.zone.cuts].sort((a, b) => a - b), s.length];
  tz.zone.pieces = ends.slice(1).map((b, i) => {
    const a = ends[i];
    const id = `stem:staffs:${a}`;
    addEntity(world, { id, keep: true, item: { kind: 'stem', size: b - a, from: a, task: 'trial-staffs', zone: null, held: null, set: true, fixed: true }, position: { x: s.x + a + i * 0.4, y: s.y, z: s.z, facing: Math.PI / 2 }, look: `bamboo-${b - a}` });
    return id;
  });
}

// Nghé follows the hero (the friend of the hero).
const friendOf = (world) => query(world, 'follow', 'position').find((f) => f.follow.target === 'hero') ?? null;

// The share of the loot: when the hands are empty and the pile has fewer coins than friends, the
// share is the commit (once for each new share). Fair: all are happy, and the friends go home
// after a moment. If not, Nghé turns away and shakes her head.
function tickShare(world, tz, dt, env) {
  if (tz.zone.leave !== null) {
    tz.zone.leave -= dt;
    if (tz.zone.leave <= 0) finish(world, tz);
    return;
  }
  if (query(world, 'item').some((t) => t.item.task === 'trial-share' && t.item.held)) return;
  const counts = tz.zone.who.map((w) => zoneEnt(world, `share-${w}`)?.zone.items.length ?? 0);
  const left = zoneEnt(world, 'loot')?.zone.items.length ?? 0;
  const r = shareResult(counts, left);
  const friend = friendOf(world);
  const goal = friend?.follow.goal;
  if (!r.settled) {
    // Coins went back to the pile: Nghé looks at the mats again.
    if (goal && tz.zone.settled) Object.assign(goal, { face: tz.zone.face, act: undefined });
    tz.zone.settled = null;
    return;
  }
  const key = counts.join(',');
  if (key === tz.zone.settled) return;
  tz.zone.settled = key;
  commit(world, tz, taskFor(env, tz.zone), { solved: r.fair, parts: counts, target: tz.zone.loot });
  if (goal) Object.assign(goal, r.fair ? { face: tz.zone.face, act: 'stretch' } : { face: tz.zone.face + Math.PI, act: 'shake' });
  if (r.fair) {
    tz.zone.leave = 2.5;
    say(world, 'happy', tz.id, { counts, sound: 'pickup' });
  } else say(world, 'sulk', friend?.id ?? tz.id, { counts, sound: 'tap' });
}

// After the short piece breaks, a new bamboo stem comes.
function tickSlash(world, tz, dt) {
  if (!tz.zone.cut) return;
  tz.zone.cut -= dt;
  if (tz.zone.cut > 0) return;
  delete tz.zone.cut;
  tz.zone.cuts = [];
  layPieces(world, tz);
  say(world, 'stem', tz.id, { sound: 'plank-down' });
}

function tickStem(world, tz, dt) {
  if (!tz.zone.cut) return;
  tz.zone.cut -= dt;
  if (tz.zone.cut > 0) return;
  delete tz.zone.cut;
  const stem = getEntity(world, 'stem:woodcutter');
  if (stem) stem.hidden = false;
}
