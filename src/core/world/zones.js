// Placement zones: what fits in a zone, where a thing snaps, and what a placement means. Pure
// functions on plain data, no DOM; the place system (systems/place.js) uses them.
//
// A zone is an entity { id: 'zone:<id>', keep: true, zone, position }. The position is the
// point that the hero must be near to put a thing in the zone (the reach point).
//   zone (all rules): { id, task, rule, accepts, items: [ids of the things in the zone, in order] }
//   pile: things lie in rows, one row for each size: { x, y, z, sizes }.
//   span: things go end to end across a gap, from the near end of the gap. The gap goes to +z.
//     { x0, x1 (the columns of cells), start, end (the zone from north to south), lane (the x of
//     the middle of the things), cx (the x of the middle of the zone), deckY (the top of the deck),
//     round, from, gap (this round), fails (in this round), set (the span is solid), done (the
//     last round is set), day (the day of the last set), effect (a tip, a wobble, a fall into the
//     water), hint (seconds), made (a count for the ids of new things) }
// A thing that the hero can carry is an entity { id, item: { kind, size, task, zone, held, set },
// position, look }. task: the zone that owns it; zone: the zone where it lies now, or null.
// Units: half blocks. A thing snaps to the half-block grid: its position is whole numbers.

import { getEntity } from './state.js';

export const REACH = 5; // half blocks: how near the hero must be to pick up or put down
export const PILE_GAP = 1; // half blocks between two things in a row of a pile
export const PILE_ROW = 3; // half blocks from one row of a pile to the next

// A new zone from the map (a rectangle in map cells) and its kind (data/world/zones.json).
// env: for the height of the ground and the named places.
export function makeSpan(rect, def, task, env) {
  const deckY = env.groundY(rect.x + def.lane + 0.5, rect.y + 0.5);
  const zone = {
    id: rect.id,
    task,
    rule: 'span',
    accepts: def.accepts,
    items: [],
    x0: rect.x,
    x1: rect.x + rect.w - 1,
    start: rect.y * 2,
    end: (rect.y + rect.h) * 2,
    lane: (rect.x + def.lane) * 2 + 1,
    cx: (rect.x + rect.w / 2) * 2,
    deckY,
    round: 0,
    from: 0,
    gap: 0,
    fails: 0,
    set: false,
    done: false,
    day: -1,
    effect: null,
    hint: 0,
    made: 0,
  };
  openRound(zone, def, 0);
  return { id: `zone:${rect.id}`, keep: true, zone, position: reachOf(zone) };
}

export function makePile(id, def, place) {
  const zone = { id, task: id, rule: 'pile', accepts: def.accepts, items: [], x: place.x, y: place.y, z: place.z, sizes: [...def.sizes] };
  return { id: `zone:${id}`, keep: true, zone, position: { x: place.x + 4, y: place.y, z: place.z + PILE_ROW, facing: 0 } };
}

// The numbers of a round of a span.
export function openRound(zone, def, round) {
  const r = def.rounds[round];
  zone.round = round;
  zone.from = zone.start + r.from;
  zone.gap = r.gap;
  zone.fails = 0;
  zone.set = false;
  zone.effect = null;
  zone.hint = 0;
}

// The point near the zone where the hero stands to put a thing (the near end of the gap).
export function reachOf(zone) {
  if (zone.rule === 'span') return { x: zone.lane, y: zone.deckY, z: zone.from - 1, facing: 0 };
  return { x: zone.x, y: zone.y, z: zone.z, facing: 0 };
}

export const sizesOf = (world, ids) => ids.map((id) => getEntity(world, id)?.item.size ?? 0);
export const sum = (list) => list.reduce((a, b) => a + b, 0);

// Can this thing go into the zone now?
export function canPut(zone, item) {
  if (item.item.kind !== zone.accepts) return false;
  if (zone.rule === 'span') return !zone.set && !zone.effect;
  return true;
}

// Can the hero take this thing out of the zone? From a span only the last thing, and not
// while the span is solid or something happens on it.
export function canTake(zone, id) {
  if (zone.rule === 'span') return !zone.set && !zone.effect && zone.items[zone.items.length - 1] === id;
  return true;
}

// The place of a thing in a span: at the end of the things before it, in the lane. A thing that
// is too long lies on the far deck, so it is a little higher.
export function spanSlot(zone, before, size) {
  const long = before + size > zone.gap;
  return { x: zone.lane, y: zone.deckY - (long ? 0 : 0.8), z: zone.from + before, facing: 0 };
}

// The places of all the things of a pile, in rows by size. Things lie along +x.
export function packPile(world, zone) {
  const rows = new Map();
  for (const id of zone.items) {
    const e = getEntity(world, id);
    if (!e) continue;
    const row = Math.max(0, zone.sizes.indexOf(e.item.size));
    const x = rows.get(row) ?? 0;
    rows.set(row, x + e.item.size + PILE_GAP);
    e.position = { x: zone.x + x, y: zone.y, z: zone.z + row * PILE_ROW, facing: Math.PI / 2 };
  }
}

// What the things in a span make against the gap: 'open' (still short, the hero can go on),
// 'exact', or 'long'.
export function judge(total, gap) {
  if (total === gap) return 'exact';
  return total > gap ? 'long' : 'open';
}

// The skill events of one try: the sum of the things against the gap, and, when all the things
// are the same size and there are enough of them, the groups. The child never sees these.
export function skillEvents(def, round, sizes, correct) {
  const levels = def.rounds[round]?.levels ?? {};
  const out = [];
  const s = def.skills ?? {};
  if (s.sum) out.push({ skill: s.sum, level: levels[s.sum] ?? 1, correct, parts: [...sizes], target: def.rounds[round].gap });
  const same = sizes.length >= (s.groupsMin ?? 3) && sizes.every((x) => x === sizes[0]);
  if (s.groups && same) out.push({ skill: s.groups, level: levels[s.groups] ?? 1, correct, parts: [...sizes], target: def.rounds[round].gap });
  return out;
}

// Can some of these sizes make exactly the target? (A small sum over subsets.)
export function canMake(target, sizes) {
  let can = new Set([0]);
  for (const s of sizes) {
    const next = new Set(can);
    for (const v of can) if (v + s <= target) next.add(v + s);
    can = next;
  }
  return can.has(target);
}

// The collision of the cells of a span: the old deck at both ends, the lane where the things
// cover it, or all of it when it is solid. covered: the length that the things cover.
export function spanCells(zone, covered) {
  const out = [];
  const laneCell = Math.floor(zone.lane / 2);
  const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  for (let cz = zone.start / 2; cz < zone.end / 2; cz++) {
    const z0 = cz * 2;
    const z1 = z0 + 2;
    const deck = overlap(z0, z1, zone.start, zone.from) >= 1 || overlap(z0, z1, zone.from + zone.gap, zone.end) >= 1;
    for (let cx = zone.x0; cx <= zone.x1; cx++) {
      const lane = cx === laneCell && overlap(z0, z1, zone.from, zone.from + covered) >= 0.5;
      out.push({ x: cx, y: cz, blocked: !(zone.set || deck || lane) });
    }
  }
  return out;
}

// The old deck of a span at the near end and at the far end of the gap: { n, s } lengths.
export function oldDeck(zone) {
  return { n: zone.from - zone.start, s: zone.end - (zone.from + zone.gap) };
}
