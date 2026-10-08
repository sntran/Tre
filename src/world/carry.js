// The thing in the hands of a person (#43). The hands draw the thing itself: the same look and
// parts as the thing on the ground (src/world/figures.js), smaller, so that a new thing of a task
// needs no new code for the hands ("one look for each thing", docs/DESIGN.md). How a person holds
// a thing follows its size (data/figures.json, carry), or the look of the thing says it (hold):
// - hand: a small thing (a rod, a shard, a bowl of rice, a herb) in the right hand, at the side;
// - front: a thing for two hands (a bundle of seedlings, a fish trap, stones in a net, a duck) in
//   front of the chest, with both arms forward;
// - shoulder: a long thing (a stake, a plank, a bundle of sticks) on the right shoulder, along the
//   way the person looks;
// - yoke: pails on a carrying pole (đòn gánh) across the right shoulder.
// Pure data, no WebGL.

import { P } from './parts.js';

export const HOLDS = Object.freeze(['hand', 'front', 'shoulder', 'yoke']);

// The rules of the size (half blocks), when data/figures.json has none: a thing with a box of at
// most `hand` (cubic half blocks) is for one hand; a thing at least `long` long and `ratio` times
// longer than wide goes on the shoulder; any other thing is for two hands. size: the thing in the
// hands is this much of its size on the ground.
export const CARRY_RULES = Object.freeze({ hand: 0.8, long: 2.2, ratio: 1.5, size: 0.8 });

// The parts of a figure with their places in the root of the figure (a part in a parent part is at
// the place of the parent plus its own place).
export function flatParts(parts) {
  const byName = new Map(parts.map((p) => [p.name, p]));
  const memo = new Map();
  const abs = (p, depth = 0) => {
    if (memo.has(p.name)) return memo.get(p.name);
    const parent = p.parent && p.parent !== p.name ? byName.get(p.parent) : null;
    const base = parent && depth < 12 ? abs(parent, depth + 1) : [0, 0, 0];
    const at = [base[0] + p.at[0], base[1] + p.at[1], base[2] + p.at[2]];
    memo.set(p.name, at);
    return at;
  };
  return parts.filter((p) => p.color && p.size.every((v) => v > 0)).map((p) => ({ ...p, at: abs(p), parent: 'body' }));
}

// The box of parts (in the units of the parts): { min, max, size }.
export function boxOf(parts) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p.at[k] - p.size[k] / 2);
      max[k] = Math.max(max[k], p.at[k] + p.size[k] / 2);
    }
  }
  if (!parts.length) return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] };
  return { min, max, size: max.map((v, k) => v - min[k]) };
}

// How a person holds a thing (a figure of src/world/figures.js): the hold of its look, or the rule
// of its size in half blocks.
export function holdOf(thing, rules = CARRY_RULES) {
  if (thing.hold) return thing.hold;
  const s = boxOf(flatParts(thing.parts)).size.map((v) => v * (thing.scale ?? 1));
  const [a, b] = [...s].sort((x, y) => y - x);
  if (a >= rules.long && a >= rules.ratio * b) return 'shoulder';
  if (s[0] * s[1] * s[2] <= rules.hand) return 'hand';
  return 'front';
}

// Turn the parts so that an axis of the box goes along z (axis 0: x, 1: y). Turning a part is a
// change of its axes: a part is a box, square to the axes.
function axisToZ(parts, axis) {
  if (axis === 2) return parts;
  const swap = (v) => (axis === 0 ? [v[2], v[1], v[0]] : [v[0], v[2], v[1]]);
  return parts.map((p) => ({ ...p, size: swap(p.size), at: swap(p.at) }));
}

// The parts of a thing in the hands of a person.
// thing: the figure of the thing (its look through figureOf); unit: one half block in the units
// of the person (1 / scale of the person for a coarse person); anchors: the places in the person
// for each hold, { hand: { parent, at }, front, shoulder, yoke } (at: [x, y, z] in the units of
// the person; for hand, the top of the thing hangs there; for the others, the middle of the bottom
// of the thing sits there). Returns { hold, parts }: the parts have names that start with "carry".
export function carriedParts(thing, unit, anchors, rules) {
  rules = { ...CARRY_RULES, ...(rules ?? {}) };
  if (!thing?.parts?.length) return { hold: null, parts: [] };
  const hold = holdOf(thing, rules);
  let parts = flatParts(thing.parts);
  const b0 = boxOf(parts);
  // The long side of the thing: along z (the way the person looks) on the shoulder and the yoke,
  // and across the chest (x) in front.
  const horiz = b0.size[0] >= b0.size[2] ? 0 : 2;
  const longest = b0.size.indexOf(Math.max(...b0.size));
  if (hold === 'shoulder') parts = axisToZ(parts, longest);
  // A thing in one hand stands up in the fist, so that it is seen beside the body (a rod).
  if (hold === 'hand' && longest !== 1) parts = axisToZ(axisToZ(parts, longest), 1);
  if (hold === 'yoke') parts = axisToZ(parts, horiz);
  if (hold === 'front' && horiz === 2) parts = axisToZ(parts, 0);
  const b = boxOf(parts);
  const k = unit * (thing.scale ?? 1) * (rules.size ?? 1);
  const mid = [(b.min[0] + b.max[0]) / 2, b.min[1], (b.min[2] + b.max[2]) / 2];
  const a = anchors[hold] ?? anchors.hand;
  // A thing on the yoke hangs: its top is at the anchor. A thing in one hand has its middle in the
  // hand. A thing in front of the chest is in front of the anchor.
  const dy = hold === 'yoke' ? -b.size[1] * k : hold === 'hand' ? (-b.size[1] * k) / 2 : 0;
  const dz = hold === 'front' ? (b.size[2] * k) / 2 : 0;
  const out = parts.map((p, i) => P(`carry${i}`, p.size.map((v) => v * k), p.color, [
    a.at[0] + (p.at[0] - mid[0]) * k,
    a.at[1] + dy + (p.at[1] - mid[1]) * k,
    a.at[2] + dz + (p.at[2] - mid[2]) * k,
  ], { parent: a.parent, mark: p.mark, noInk: p.noInk }));
  return { hold, parts: out };
}

// The pick-up and the put-down show the move (#43): the thing goes in a short arc from the ground
// into the hands, or from the hands to the place where it lands. Never a jump from the ground to
// nothing. Steps of the world (30 a second): about 0.3 seconds.
export const FLIGHT_STEPS = 9;
const ARC = 1.4; // half blocks: the top of the arc over the straight line
const HAND_UP = 2.2; // half blocks: the hands of a person over the ground
const MOVE_REACH = 8; // half blocks: a one move in the reach of the hero (session.js REACH and a step)

// The place of the hands of an entity (in the units of the entities: half blocks).
export function handOf(e) {
  const f = e.position.facing ?? 0;
  return { x: e.position.x + Math.sin(f) * 0.8, y: e.position.y + HAND_UP, z: e.position.z + Math.cos(f) * 0.8 };
}

// The changes of the things in the hands since the last step. holding: a Map from an entity id to
// { carry, thing } (kept by the caller); entities: the entities of the world now; tick: the step
// now. ready: false at the first look at a world (a hero that holds a thing at the load makes no
// flight). Returns the new flights: { by, look, from, to, start, steps, pick, hide }. pick: true
// for a pick-up (the hands show the thing at the end of the flight); hide: the id of the thing that
// the put-down puts, which shows at the end of the flight.
//
// places (a Map from the id of a thing to { zone, position }, kept by the caller): a thing that goes
// from one place to another in one step, with no step in the hands (the one move of a press, #61),
// flies from its old place into the hands of the hero and from there to its new place (#64).
export function trackCarries(holding, entities, tick, ready = true, steps = FLIGHT_STEPS, places = null) {
  const flights = [];
  const byId = new Map(entities.map((e) => [e.id, e]));
  if (places) {
    const hero = byId.get('hero');
    for (const e of entities) {
      if (!e.item) continue;
      if (e.item.held || !e.position || e.hidden) {
        places.delete(e.id);
        continue;
      }
      const was = places.get(e.id);
      places.set(e.id, { zone: e.item.zone ?? null, position: { ...e.position } });
      if (!ready || !was || was.zone === (e.item.zone ?? null) || !hero?.position) continue;
      // Only a move in the reach of the hero (a system that moves things far away flies nothing).
      const near = (q) => Math.hypot(q.x - hero.position.x, q.z - hero.position.z) <= MOVE_REACH;
      if (!near(was.position) || !near(e.position)) continue;
      const hand = handOf(hero);
      const half = Math.ceil(steps / 2);
      flights.push({ by: 'hero', look: e.look, from: was.position, to: hand, start: tick, steps: half, pick: false, hide: e.id });
      flights.push({ by: 'hero', look: e.look, from: hand, to: { ...e.position }, start: tick + half, steps, pick: false, hide: e.id });
    }
    for (const id of [...places.keys()]) if (!byId.has(id)) places.delete(id);
  }
  for (const e of entities) {
    const was = holding.get(e.id);
    if (e.carry && was?.carry !== e.carry) {
      const thing = entities.find((t) => t.item?.held === e.id) ?? null;
      holding.set(e.id, { carry: e.carry, thing: thing?.id ?? null });
      if (ready && thing?.position && e.position) flights.push({ by: e.id, look: e.carry, from: { ...thing.position }, to: handOf(e), start: tick, steps, pick: true, hide: null });
    } else if (!e.carry && was) {
      holding.delete(e.id);
      const thing = was.thing ? byId.get(was.thing) : null;
      if (ready && thing?.position && !thing.hidden && e.position) flights.push({ by: e.id, look: was.carry, from: handOf(e), to: { ...thing.position }, start: tick, steps, pick: false, hide: thing.id });
    }
  }
  for (const id of [...holding.keys()]) if (!byId.has(id)) holding.delete(id);
  return flights;
}

// The place of a thing in flight at a step (a straight line with an arc over it), or null when the
// flight is over.
export function flightAt(fl, tick) {
  const k = (tick - fl.start) / fl.steps;
  if (k >= 1 || k < 0) return null;
  const lerp = (a, b) => a + (b - a) * k;
  return { x: lerp(fl.from.x, fl.to.x), y: lerp(fl.from.y, fl.to.y) + Math.sin(Math.PI * k) * ARC, z: lerp(fl.from.z, fl.to.z), facing: 0 };
}
