// The folk riddles of the evening and the trick questions of the children (#103; docs/RIDDLES.md,
// data/world/riddles.json). No DOM. A riddle is not a quiz: its answer is a thing of the world that
// the child finds and taps, and nothing is chosen from a list. A trick question is only heard.
//
// The state is in the profile (profile.riddles): open (the riddle that waits: { id, day, clue (the
// day of the clue), told (the day of the answer) }), found ([{ id, how: 'alone' | 'clue' |
// 'answer', day }], for the parent page, not for mastery), last (the day of the last new riddle),
// fit (a riddle found while the teller was away: the teller says how its words fit at the next
// meeting), tricks ({ <child>: <day> }), asked (the trick questions so far, in order).
//
// deps: data, profile, world() (the world state), map() (the map now, with its objects), day(), minutes(), busy() (a
// screen, a task, or a raid), say(id, textKey, params), sound(name), point(person, p), walkTo(p),
// rng() (0 to 1).
import { getEntity } from './world/state.js';

const CELL = 2; // half blocks in a map cell

export const riddleOf = (data, id) => data.riddles.find((r) => r.id === id) ?? null;

// Is the thing at a point (half blocks) the answer of a riddle? An animal of its kinds or an entity
// of its ids near the point, or a map object of its props (object: the id of the object under the
// tap, when the view knows it). Return the place of the thing, or null.
export function answerAt(riddle, p, { world, map, object = null, find = 3.5 }) {
  const a = riddle.answer;
  let best = null;
  for (const e of world.entities) {
    if (!e.position || e.hidden) continue;
    if (!((a.kinds ?? []).includes(e.kind) || (a.ids ?? []).includes(e.id))) continue;
    const d = Math.hypot(e.position.x - p.x, e.position.z - p.z);
    if (d <= find && (!best || d < best.d)) best = { d, at: { x: e.position.x, z: e.position.z }, id: e.id };
  }
  if (best) return best;
  for (const o of map?.layers?.objects ?? []) {
    if (!(a.props ?? []).includes(o.prop)) continue;
    const inside = p.x >= o.x * CELL - 1 && p.x <= (o.x + o.w) * CELL + 1 && p.z >= o.y * CELL - 1 && p.z <= (o.y + o.h) * CELL + 1;
    if (o.id === object || inside) return { d: 0, at: { x: (o.x + o.w / 2) * CELL, z: (o.y + o.h / 2) * CELL }, id: o.id };
  }
  return null;
}

// The nearest thing of the answer of a riddle to a point (for the walk of the answer).
export function nearestAnswer(riddle, p, { world, map }) {
  const a = riddle.answer;
  const all = [
    ...world.entities.filter((e) => e.position && !e.hidden && ((a.kinds ?? []).includes(e.kind) || (a.ids ?? []).includes(e.id))).map((e) => ({ x: e.position.x, z: e.position.z, id: e.id })),
    ...(map?.layers?.objects ?? []).filter((o) => (a.props ?? []).includes(o.prop)).map((o) => ({ x: (o.x + o.w / 2) * CELL, z: (o.y + o.h / 2) * CELL, id: o.id })),
  ];
  return all.sort((u, v) => Math.hypot(u.x - p.x, u.z - p.z) - Math.hypot(v.x - p.x, v.z - p.z))[0] ?? null;
}

// The help of a wave near the teller for an open riddle: the clue first, then on a later day the
// answer. Return 'clue', 'answer', or null (nothing more to say now: the clue was given today).
export function waveStep(open, day) {
  if (!open) return null;
  if (open.clue == null) return 'clue';
  if (open.told == null && day > open.clue) return 'answer';
  return null;
}

export function createRiddles(deps) {
  const data = deps.data;
  const st = () => (deps.profile.riddles ??= { open: null, found: [], last: null, fit: null, tricks: {} });
  // The trick question that waits for its answer: { id, child, t }.
  let trick = null;
  // The walk of the answer: the thing that the hero walks to.
  let walk = null;
  const hero = () => getEntity(deps.world(), 'hero');
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  // The teller near the hero (half blocks: near cells), at its place and not inside its house.
  function tellerNear(r = data.near * CELL) {
    const h = hero()?.position;
    if (!h) return null;
    for (const who of data.tellers) {
      const e = getEntity(deps.world(), `npc:${who}`);
      if (e?.position && !e.hidden && dist(e.position, h) <= r) return { who, e };
    }
    return null;
  }
  const evening = () => deps.minutes() >= data.evening[0] && deps.minutes() <= data.evening[1];
  const nextRiddle = () => data.riddles.find((r) => !st().found.some((f) => f.id === r.id)) ?? null;

  function found(how) {
    const s = st();
    const r = riddleOf(data, s.open.id);
    s.found.push({ id: r.id, how, day: deps.day() });
    s.open = null;
    deps.sound('bell');
    const t = tellerNear(data.near * CELL * 2);
    if (t) {
      deps.say(t.e.id, 'riddle.again', { riddle: { key: `riddle.${r.id}` } });
      deps.say(t.e.id, `riddle.${r.id}.fit`, {});
      deps.sound('laugh');
    } else {
      s.fit = r.id;
      deps.say('hero', 'riddle.later', {});
    }
  }

  return {
    // The state for the notebook: the open riddle and the found ones.
    state: () => st(),
    // Each step: a new riddle in the evening, the line of a found riddle at the next meeting, the
    // answer of a trick question after its wait, and the end of the walk of an answer.
    tick(dt) {
      const s = st();
      if (trick) {
        trick.t -= dt;
        if (trick.t <= 0) {
          deps.say(trick.child, `trick.${trick.id}.answer`, {});
          deps.sound('laugh');
          trick = null;
        }
      }
      if (walk) {
        const h = hero()?.position;
        if (h && dist(h, walk) <= data.find * 2 && s.open) {
          walk = null;
          found('answer');
        }
      }
      if (deps.busy()) return;
      if (s.fit) {
        const t = tellerNear();
        if (t) {
          deps.say(t.e.id, 'riddle.again', { riddle: { key: `riddle.${s.fit}` } });
          deps.say(t.e.id, `riddle.${s.fit}.fit`, {});
          deps.sound('laugh');
          s.fit = null;
        }
        return;
      }
      if (s.open || s.last === deps.day() || !evening()) return;
      const t = tellerNear();
      const r = nextRiddle();
      if (!t || !r) return;
      s.open = { id: r.id, day: deps.day(), clue: null, told: null };
      s.last = deps.day();
      // How to answer (#139: a child knew the rooster and could not give it): with the first riddle,
      // and later until the child finds one alone. The riddle and its "how" are one line (#145: a
      // newer line of the person took the place of the riddle, and only the "how" came).
      const how = !s.found.some((f) => f.how === 'alone');
      deps.say(t.e.id, `riddle.ask.${t.who}${how ? '.how' : ''}`, { riddle: { key: `riddle.${r.id}` }, ...(how ? { how: { key: `riddle.how.${r.how ?? 'animal'}` } } : {}) });
    },
    // A tap of the child at a point (half blocks): the thing of the open riddle there closes it.
    // A tap on another thing is only a tap on that thing.
    tap(p, object = null) {
      const s = st();
      if (!s.open || !p) return false;
      const r = riddleOf(data, s.open.id);
      if (!r || !answerAt(r, p, { world: deps.world(), map: deps.map(), object, find: data.find })) return false;
      walk = null;
      found(s.open.told != null ? 'answer' : s.open.clue != null ? 'clue' : 'alone');
      return true;
    },
    // A wave near the teller with an open riddle: the clue, or on a later day the answer and the
    // walk to the thing. True when the wave was for the riddle.
    canWave: () => Boolean(st().open && tellerNear()),
    wave() {
      const s = st();
      const t = tellerNear();
      if (!s.open || !t) return false;
      const step = waveStep(s.open, deps.day());
      const r = riddleOf(data, s.open.id);
      if (step === 'clue') {
        s.open.clue = deps.day();
        deps.say(t.e.id, `riddle.${r.id}.clue`, {});
      } else if (step === 'answer') {
        s.open.told = deps.day();
        deps.say(t.e.id, `riddle.${r.id}.answer`, {});
        const at = nearestAnswer(r, hero().position, { world: deps.world(), map: deps.map() });
        if (at) {
          deps.point(t.e, at);
          walk = at;
          deps.walkTo(at);
        }
      } else deps.say(t.e.id, `riddle.${r.id}.clue`, {});
      return true;
    },
    // The riddle again (the button of the notebook).
    again: () => (st().open ? `riddle.${st().open.id}` : null),
    // A tap on a child of the village: sometimes a trick question (at most one each day from each
    // child, never in a folk game or a task). True when the child asked one.
    child(ref, id) {
      const s = st();
      if (!data.children.includes(ref) || deps.busy() || trick || s.tricks[ref] === deps.day()) return false;
      if (deps.rng() >= data.chance) return false;
      // Each trick question once, in order; after the last, they come again.
      s.asked ??= [];
      if (s.asked.length >= data.tricks.length) s.asked = [];
      const q = data.tricks.find((x) => !s.asked.includes(x.id));
      s.asked.push(q.id);
      s.tricks[ref] = deps.day();
      trick = { id: q.id, child: id, t: data.wait };
      deps.say(id, `trick.${q.id}`, {});
      return true;
    },
    // The trick question that waits for its answer (for the tests).
    trick: () => trick,
  };
}
