// The folk games of the village children (#30; data/world/folkgames.json; docs/FOLKGAMES.md):
// nhảy lò cò (hopscotch) in Phù Đổng and nhảy dây (jump rope) at the feast of Xóm Ruộng. Pure
// functions, no DOM. The math is inside the play:
//   the court of nhảy lò cò is a number line: the throw of the shard is an estimate of a place on
//     it, and the children say the number of each square where the hero lands (count on);
//   the rope counts by groups: each jump on the beat is one group ("năm, mười, mười lăm").

// ---------------------------------------------------------------- Nhảy lò cò
// The court of a level: the start number, the step, and the squares. rng picks a court of the
// level and a start among its starts.
export function courtPlan(levels, skill, rng) {
  const list = levels[skill] ?? levels['math.count.120'];
  const c = list.length > 1 ? rng.pick(list) : list[0];
  const start = c.starts ? rng.pick(c.starts) : c.start;
  return { skill, start, step: c.step, squares: c.squares, near: Boolean(c.near) };
}

// The squares of a court in the Vietnamese order: up one side (1 to 5) and back down the other (6
// to 10); the half circle to rest is at the top. Each square: { i (0 is the first), value, side
// (0 up, 1 down), row (0 at the start line) }.
export function courtOf(plan) {
  const half = Math.ceil(plan.squares / 2);
  return Array.from({ length: plan.squares }, (_, i) => ({
    i,
    value: plan.start + i * plan.step,
    side: i < half ? 0 : 1,
    row: i < half ? i : plan.squares - 1 - i,
  }));
}

// The square that the children call for a throw (never the first one twice in a row, and never
// the last one: the hero must have a square after the shard). With near, the call is "two more
// than five": { square, base, more } (the square of base, then more squares).
export function callSquare(court, rng, prev = null, near = false) {
  const options = court.map((s) => s.i).filter((i) => i < court.length - 1 && i !== prev);
  const square = rng.pick(options);
  if (!near || square < 2) return { square, base: null, more: null };
  const more = rng.int(1, Math.min(3, square));
  return { square, base: square - more, more };
}

// The place of the shard after a hold of so many seconds (in squares from the start line; the
// longer the hold, the farther it goes).
export const throwPlace = (seconds, data) => Math.max(0, seconds) * data.rate;

// Where the shard lands. Return { result: 'in' (the called square), 'other' (another square),
// 'line', or 'out', square (the square, or null) }.
export function judgeThrow(court, target, place, data) {
  const i = Math.floor(place);
  if (place <= 0 || i >= court.length) return { result: 'out', square: null };
  const part = place - i;
  if (part < data.line || part > 1 - data.line) return { result: 'line', square: null };
  return { result: i === target ? 'in' : 'other', square: i };
}

// The hops of a turn. The path of the hero: -1 before the start line, 0 to n-1 the squares up and
// down, n the half circle to rest, n+1 to 2n the squares back, 2n+1 home (off the court). The
// hero must never land on the square of the shard: a long press hops over it. On the way back,
// the hero picks up the shard from the place before it.
export function createHops(court, shard) {
  return { court, shard, pos: -1, picked: false, landed: [], last: -Infinity, done: false, end: null };
}

// The square of a place of the path (null: before the court, the half circle, or home).
export function squareAt(st, pos) {
  const n = st.court.length;
  if (pos >= 0 && pos < n) return pos;
  if (pos > n && pos <= 2 * n) return 2 * n - pos;
  return null;
}

// A press of the jump button at a time (seconds). long: a long press (two squares). Return the
// events: { type: 'land', square, value }, { type: 'rest' }, { type: 'pick' }, { type: 'home' },
// or the end of the turn: { type: 'shard', square } (on the shard), { type: 'line' } (a press
// before the hero stands again), { type: 'skip', square } (over a square that has no shard).
export function hop(st, { long = false, time = 0 }, data) {
  if (st.done) return [];
  const n = st.court.length;
  if (time - st.last < data.settle) return end(st, { type: 'line' });
  const to = Math.min(2 * n + 1, st.pos + (long ? 2 : 1));
  if (long) {
    // Over one place: only over the square of the shard (before and after the hero picks it up).
    const over = squareAt(st, st.pos + 1);
    if (over !== st.shard) return end(st, { type: 'skip', square: over });
  }
  const square = squareAt(st, to);
  if (square !== null && square === st.shard) return end(st, { type: 'shard', square });
  st.pos = to;
  st.last = time;
  const out = [];
  if (square !== null) {
    st.landed.push(square);
    out.push({ type: 'land', square, value: st.court[square].value });
  } else if (to === n) out.push({ type: 'rest' });
  // On the way back, the place before the shard: the hero picks it up.
  if (to >= n && !st.picked && squareAt(st, to + 1) === st.shard) {
    st.picked = true;
    out.push({ type: 'pick' });
  }
  if (to === 2 * n + 1) {
    st.done = true;
    st.end = 'home';
    out.push({ type: 'home' });
  }
  return out;
}

function end(st, ev) {
  st.done = true;
  st.end = ev.type;
  return [ev];
}

// The numbers that the children say for the landings of a turn: the number of each square where
// the hero landed (count on), never a count of the hops.
export const saidNumbers = (st) => st.landed.map((i) => st.court[i].value);

// ---------------------------------------------------------------- Nhảy dây
// The rope of a level: the group of one jump and the jumps of a round (the number to reach is
// group × to).
export function ropePlan(levels, skill, rng) {
  const list = levels[skill] ?? levels['math.count.120'];
  const r = list.length > 1 ? rng.pick(list) : list[0];
  return { skill, group: r.group, to: r.to, target: r.group * r.to };
}

// The state of the rope: the time since the rope started (seconds), the period of a turn (the rope
// is at the bottom at each whole turn), the count, the last good jump.
export const createRope = (plan, period) => ({ plan, period, time: 0, count: 0, in: false, jumped: -1, misses: 0, wait: 0, done: false, jumps: 0 });

const turnAt = (st) => st.time / st.period;

// One step of the rope (dt seconds). A beat that passes its window with the hero in the rope and
// no jump is a miss. Return the events: { type: 'beat', k }, { type: 'miss', count }.
export function stepRope(st, dt, data) {
  if (st.done) return [];
  if (st.wait > 0) {
    st.wait = Math.max(0, st.wait - dt);
    return [];
  }
  const before = Math.floor(turnAt(st));
  st.time += dt;
  const now = turnAt(st);
  const out = [];
  for (let k = before + 1; k <= Math.floor(now); k++) out.push({ type: 'beat', k });
  const k = Math.floor(now - data.window / st.period);
  if (st.in && k >= 1 && k > st.jumped) out.push(...missRope(st, data));
  return out;
}

// A press of the jump. Right on a beat (within the window) that the hero did not jump yet: one
// group more. Return { type: 'count', count } (and { type: 'done' } at the number to reach), or a
// miss.
export function jumpRope(st, data) {
  if (st.done || st.wait > 0) return [];
  const t = turnAt(st);
  const k = Math.round(t);
  if (k < 1 || Math.abs(t - k) * st.period > data.window || k <= st.jumped) return missRope(st, data);
  st.jumped = k;
  st.in = true;
  st.jumps += 1;
  st.count += st.plan.group;
  const out = [{ type: 'count', count: st.count }];
  if (st.count >= st.plan.target) {
    st.done = true;
    out.push({ type: 'done', clean: st.misses === 0 });
  }
  return out;
}

// A miss: the rope stops on the feet, then turns again a little slower. The count stays (the chant
// goes on from the last good jump; nothing is lost).
function missRope(st, data) {
  st.misses += 1;
  st.in = false;
  st.period *= data.slower;
  st.time = 0;
  st.jumped = 0;
  st.wait = data.pause;
  return [{ type: 'miss', count: st.count }];
}

// The numbers of the chant of a round: the multiples of the group up to the number to reach.
export const chantOf = (plan) => Array.from({ length: plan.to }, (_, i) => (i + 1) * plan.group);
