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
//     round, repair (a gap that the rain made), from, gap, sizes (the pile of this gap), levels
//     (of the skills for this gap), fails (world failures on this gap), commits (steps on the last
//     plank on this gap), guess ('pending', null when skipped, or the number of planks that the
//     child predicted), attempt (the times and sizes since the last commit, for the mashing
//     signs), set (the span is solid), done (the last round is set), day (the day of the last
//     set), effect (a tip, a wobble, a slide), hint (seconds), made (a count for new ids) }
// A thing that the hero can carry is an entity { id, item: { kind, size, task, zone, held, set },
// position, look }. task: the zone that owns it; zone: the zone where it lies now, or null.
// Units: half blocks. A thing snaps to the half-block grid: its position is whole numbers.

import { getEntity } from './state.js';

export const REACH = 5; // half blocks: how near the hero must be to pick up or put down
export const PILE_REACH = 3; // half blocks: a pile is long, and the hands reach this much farther there
// The floor of the basket of the healer over the ground (half blocks): the basket stands on a low
// stand, so that a child finds it (#64). The figure (src/world/figures.js) and the places of the
// bunches in it (src/core/world/systems/work.js) use it.
export const BASKET_FLOOR = 1;
export const PILE_GAP = 1; // half blocks between two things in a row of a pile
export const PILE_ROW = 3; // half blocks from one row of a pile to the next
// The count of a try on the bridge (#71: "ba, tám, mười ba" was the length plank by plank, and no
// child knew why): the person counts the units of the planks one by one, "một, hai, ba, bốn", and
// the mark of each unit lights up at its word. The world keeps the planks of the try until the
// count ends (countTime: the seconds of the count of n units).
export const UNIT_PACE = 0.6; // seconds between two counted units
export const COUNT_LEAD = 1.2; // seconds from the start of the count to its first unit
export const countTime = (units) => COUNT_LEAD + units * UNIT_PACE + 1;
// The times of the count after a wrong tie or a wrong give, for the world and for the person who
// counts (src/core/mentoring.js), so that the things go back after their words (#74).
export const SPRING_TIME = 1.2; // seconds from the commit to the first counted rod or bunch
export const COUNT_TIME = 0.9; // seconds: the count of one rod or bunch aloud
export const ROLL_STEP = 1.2; // seconds between two extra rods that roll back to the heap
export const ROLL_TIME = 1; // seconds of the roll of one rod (#69: slow, so that the child sees it go)
export const LAY_STEP = 0.5; // seconds between two bunches of the healer that go back after a wrong give
export const ROW_NAME = 1.2; // seconds: the name of a row of the healer before its count (#74)
export const EXTRA_LINE = 2.4; // seconds: the line of the extra bunches of one kind (#74)
// The teacher: the extra rods of a tie of n rods start to roll back at springTime(n), and the last
// one is on the heap at springEnd(n, extras).
export const springTime = (n) => SPRING_TIME + n * COUNT_TIME;
export const springEnd = (n, extras) => springTime(n) + Math.max(0, extras - 1) * ROLL_STEP + ROLL_TIME;
// The healer: after a give of n bunches in rows of kinds (extraKinds of them with extra bunches),
// the extra bunches start to go back at layTime, and the last one is back at layEnd.
export const layTime = (n, kinds, extraKinds) => SPRING_TIME + (n + kinds) * COUNT_TIME + kinds * (0.4 + ROW_NAME) + extraKinds * EXTRA_LINE;
export const layEnd = (n, kinds, extraKinds, extras) => layTime(n, kinds, extraKinds) + Math.max(0, extras - 1) * LAY_STEP;
// The woodcutter (#75): after a cut that is not right, the pieces lie side by side, and he counts the
// rings of each piece ("Khúc này: một, hai, ba."), says the number of pieces when it is not the
// number that he asked for, and then the short piece glows and breaks. The pieces stay a little, and
// then the stem is whole again.
export const PIECE_NAME = 1; // seconds: "Khúc này:" before the count of a piece
export const PIECES_LINE = 2.6; // seconds: "Hai khúc. Anh cần ba khúc."
export const SHORT_SHOW = 1.8; // seconds: the short piece glows, and the woodcutter says it, before it breaks
export const CUT_STAY = 3; // seconds: the pieces stay after the count (and after the break)
// The time of the line of the number of pieces is in each count, said or not, so that the time of
// the pieces does not depend on the number of the task (#63: the button is blind to it).
export const cutCount = (pieces) => COUNT_LEAD + pieces.length * (PIECE_NAME + 0.4) + pieces.reduce((a, b) => a + b, 0) * UNIT_PACE + PIECES_LINE;
// The index of the short piece of a cut (shorter than the longest), or null when all are equal.
export const shortPiece = (pieces) => {
  const min = Math.min(...pieces);
  return min < Math.max(...pieces) ? pieces.indexOf(min) : null;
};

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
    repair: false,
    from: 0,
    gap: 0,
    sizes: [],
    levels: {},
    fails: 0,
    commits: 0,
    guess: 'pending',
    attempt: null,
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

// A span from an older save has no numbers of its gap yet: give it the numbers of its round, as a
// gap with nothing tried on it (the planks on it stay).
export function upgradeSpan(zone, def) {
  if (zone.sizes !== undefined) return false;
  const r = def.rounds[zone.round] ?? def.rounds[0];
  zone.repair = false;
  zone.sizes = [...r.pile];
  zone.levels = { ...r.levels };
  zone.commits = 0;
  zone.guess = zone.items.length ? null : 'pending';
  zone.attempt = null;
  return true;
}

// The numbers of a round of a span.
export function openRound(zone, def, round) {
  const r = def.rounds[round];
  zone.round = round;
  zone.repair = false;
  openGap(zone, zone.start + r.from, r.gap, r.pile, r.levels);
}

// A new gap: from (half blocks along the zone), its length, the sizes of its pile, and the
// levels of its skills. Nothing is tried on it yet.
export function openGap(zone, from, gap, sizes, levels) {
  zone.from = from;
  zone.gap = gap;
  zone.sizes = [...sizes];
  zone.levels = { ...levels };
  zone.fails = 0;
  zone.commits = 0;
  zone.guess = 'pending';
  zone.attempt = null;
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
  const kinds = [].concat(zone.accepts);
  if (!kinds.includes(item.item.kind)) return false;
  if (zone.rule === 'span') return !zone.set && !zone.effect;
  return true;
}

// The point of a zone nearest to p (half blocks): in its rect, or its point. The action button
// and the put of the world measure the reach of a place to this point (#54).
export function nearestPoint(zoneEnt, p) {
  const r = zoneEnt.zone.rect;
  return r ? { x: Math.max(r.x0, Math.min(r.x1, p.x)), z: Math.max(r.z0, Math.min(r.z1, p.z)) } : zoneEnt.position;
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

// What the things in a span make against the gap: 'short', 'exact', or 'long'. A span that is
// short or exact waits for the commit (the hero steps on the last plank); a long one answers at
// once, because the plank sticks out past the far end.
export function judge(total, gap) {
  if (total === gap) return 'exact';
  return total > gap ? 'long' : 'short';
}

// The fewest things from a pile (a list of sizes) that make exactly the target, or Infinity.
export function minParts(target, sizes) {
  let best = new Map([[0, 0]]); // sum -> the fewest things
  for (const s of sizes) {
    const next = new Map(best);
    for (const [v, n] of best) {
      if (v + s > target) continue;
      if (!next.has(v + s) || next.get(v + s) > n + 1) next.set(v + s, n + 1);
    }
    best = next;
  }
  return best.get(target) ?? Infinity;
}

// The skill events of one commit: the sum of the things against the gap, and, when all the things
// are the same size and there are enough of them, the groups. The child never sees these.
//   solved: the span is exact. efficient: solved with the fewest things on the first commit on
//   this gap (this carries most of the evidence). mashing: the signs of guessing without
//   thought; such a commit is no evidence (and never an error).
//   attempt: the attempt since the last commit (for the learning log): latencies (the seconds
//   to choose each plank), resets (planks taken back), hint (the level of the hint that the
//   child saw), and hintSeen (the seconds of the hint before the next action, or null).
export function skillEvents(zone, def, parts, { solved, mashing, attempt = {} }) {
  const s = def.skills ?? {};
  const first = zone.commits === 1;
  const efficient = solved && first && parts.length === minParts(zone.gap, zone.sizes);
  const info = {
    correct: solved, solved, efficient, first, mashing, evidence: !mashing, parts: [...parts], target: zone.gap, task: zone.task,
    latencies: [...(attempt.thinks ?? [])], resets: attempt.resets ?? 0, hint: attempt.hint ?? 0, hintSeen: attempt.hintSeen ?? null,
  };
  const out = [];
  if (s.sum) out.push({ skill: s.sum, level: zone.levels[s.sum] ?? 1, ...info });
  const same = parts.length >= (s.groupsMin ?? 3) && parts.every((x) => x === parts[0]);
  if (s.groups && same) out.push({ skill: s.groups, level: zone.levels[s.groups] ?? 1, ...info });
  return out;
}

// What a skill event gives the learner: { level, correct }, or null when the commit is no
// evidence (the signs of mashing). An efficient success is correct at the level of the gap; a
// success with more planks than needed (or on a later commit) is correct at the lowest level, so
// that a right sum with a long plan is not wrong; a commit that is not solved is not correct at
// the level of the gap.
export function learnerRecord(ev) {
  if (!ev.evidence) return null;
  if (ev.efficient) return { level: ev.level, correct: true };
  if (ev.solved) return { level: 1, correct: true };
  return { level: ev.level, correct: false };
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
