// The activities of Xóm Ruộng after the planting (src/core/hamlet.js; docs/HAMLET.md): feeding
// the ducks, the fish traps, and the drum dance. The session sets up a round of an activity
// (setupDucks, setupTraps, setupDrum); this system answers the work of the hands and plays the
// timed parts. Each activity sends one event at the end of a commit (fed, caught, danced), and the
// session says the line, records the facts, and makes the next round.
//   The ducks: while the child holds the jar (act pour), the feed fills the trough one scoop at a
//   time (an event scoop, with a notch for each fifth and tenth scoop). When the child lets go
//   (act stop), the feed runs along the trough and each duck eats its share in turn. Too few: the
//   last ducks are hungry, and the next pour goes on from where it stopped. Too much: the extra
//   feed stays at the end of the trough.
//   The traps: the child carries traps from the pile of the fisher to the spots in the stream (the
//   place system and the zone rule spots). A tap on the fisher (act open) opens the weir: each
//   trap fills with its number of fish, one after another. Too few: the full traps stay, and the
//   fisher waits for more traps. Too many: the extra fish swim on.
//   The drum: the first tap on a bronze drum starts the beat of the drummer. The dancers of a
//   group jump on the multiples of their number when the child taps on those beats; a missed or
//   wrong beat starts again from the last good jump, a little slower.
export const WRITES = ['work', 'zone', 'item', 'position', 'look', 'keep', 'gesture', 'hop', 'hamletPart', 'hamletTap', 'events'];

import { query, getEntity, addEntity, removeEntity } from '../state.js';
import { judgePour, scoopsOf, judgeTraps, createDance, stepDance, tapDance } from '../../hamlet.js';
import { trialSkill } from '../trials.js';
import { factKey } from '../../planting.js';
import { packHeap } from './work.js';

export const EAT_TIME = 0.45; // seconds: each duck eats its share
export const FILL_TIME = 0.5; // seconds: each trap fills with its fish
export const DUCK_STEP = 2; // half blocks between two ducks along the trough
const IDLE_MISSES = 2; // beats missed with no tap after which the drummer stops and waits
export const ACTIVITIES = ['ducks', 'traps', 'drum'];
const say = (world, type, id, extra = {}) => world.events.push({ type, id, ...extra });
export const ownerOf = (act) => `trial-${act}`;
export const tzOf = (world, act) => getEntity(world, `zone:${ownerOf(act)}`);

// Remove all the things of an activity (its zone, its things, its places, its animals).
export function clearActivity(world, act) {
  const owner = ownerOf(act);
  for (const e of [...world.entities]) {
    if (e.id === `zone:${owner}` || e.item?.task === owner || e.zone?.task === owner || e.hamletPart?.act === act) removeEntity(world, e.id);
  }
}

const part = (world, act, id, position, look, extra = {}) => addEntity(world, { id, keep: true, hamletPart: { act }, position: { facing: 0, ...position }, look, ...extra });

// ---------------------------------------------------------------- The ducks

// round: { index, level, skill, key, task (duckTask), rate (scoops a second), trough, jar: { x, y,
// z } (half blocks: the head of the trough, and the jar) }.
export function setupDucks(world, round) {
  clearActivity(world, 'ducks');
  const t = round.task;
  const tz = addEntity(world, {
    id: 'zone:trial-ducks',
    keep: true,
    zone: {
      id: 'trial-ducks', rule: 'trial', trial: 'ducks', task: 'ducks', level: round.level, commits: 0, fails: 0, done: false,
      round: {
        index: round.index, skill: round.skill, key: round.key, form: t.form, shares: t.ducks.map((d) => d.share), big: t.ducks.map((d) => d.big), need: t.need, show: t.show, facts: t.facts.slice(),
        rate: round.rate, poured: 0, base: 0, held: 0, pouring: false, judged: 0, eaten: t.ducks.map(() => 0), commits: 0, eat: null, done: false,
      },
    },
    position: { ...round.jar, facing: 0 },
  });
  const tr = round.trough;
  part(world, 'ducks', 'hamlet:trough', tr, `duck-trough-${t.ducks.length}`);
  part(world, 'ducks', 'hamlet:feed', tr, 'trough-feed-0');
  part(world, 'ducks', 'hamlet:jar', round.jar, 'feed-jar', { hamletTap: { act: 'ducks', what: 'jar' } });
  t.ducks.forEach((d, i) => part(world, 'ducks', `hamlet:duck:${i}`, { x: tr.x + 1 + i * DUCK_STEP, y: tr.y, z: tr.z - 1.4 }, d.big ? (t.form === 'mixed' ? 'duck-brown' : 'duck-big') : 'duck'));
  return tz;
}

function feedLook(world, r) {
  const e = getEntity(world, 'hamlet:feed');
  if (e) e.look = `trough-feed-${Math.min(60, r.poured - r.eaten.reduce((a, b) => a + b, 0))}`;
}

function duckWork(world, e, want) {
  const tz = tzOf(world, 'ducks');
  const r = tz?.zone.round;
  if (!r || r.done || r.eat) return;
  if (want.act === 'pour') {
    if (r.pouring) return;
    r.pouring = true;
    r.base = r.poured;
    r.held = 0;
    say(world, 'pour', tz.id, { sound: 'pour' });
    return;
  }
  if (want.act !== 'stop' || !r.pouring) return;
  r.pouring = false;
  // A tap with no scoop is no commit.
  if (r.poured === r.judged) return;
  r.commits += 1;
  tz.zone.commits += 1;
  const res = judgePour({ ducks: r.shares.map((share) => ({ share })), need: r.need }, r.poured);
  if (res.result !== 'exact') tz.zone.fails += 1;
  const solved = res.result === 'exact';
  say(world, 'skill', tz.id, trialSkill({ id: 'ducks', skill: r.skill, level: tz.zone.level }, { solved, efficient: solved && r.commits === 1, first: r.commits === 1, parts: [r.poured - r.judged], target: r.need - r.judged }));
  r.judged = r.poured;
  // The feed runs along the trough: the ducks eat in turn (only the shares that are new).
  r.eat = { k: 0, t: 0, eaten: res.eaten, result: res.result, hungry: res.hungry.length, extra: res.extra };
}

function ducks(world, dt) {
  const tz = tzOf(world, 'ducks');
  const r = tz?.zone.round;
  if (!r) return;
  if (r.pouring) {
    r.held += dt;
    const n = r.base + scoopsOf(r.held, r.rate);
    while (r.poured < n) {
      r.poured += 1;
      const notch = r.poured % 10 === 0 ? 10 : r.poured % 5 === 0 ? 5 : 0;
      say(world, 'scoop', tz.id, { n: r.poured, notch, sound: notch === 10 ? 'notch-big' : notch === 5 ? 'notch' : 'scoop' });
    }
    feedLook(world, r);
    return;
  }
  const a = r.eat;
  if (!a) return;
  a.t += dt;
  if (a.t < EAT_TIME) return;
  a.t = 0;
  // The next duck with a new share eats it.
  while (a.k < r.shares.length && a.eaten[a.k] === r.eaten[a.k]) a.k += 1;
  if (a.k < r.shares.length) {
    const i = a.k;
    const n = a.eaten[i] - r.eaten[i];
    r.eaten[i] = a.eaten[i];
    const duck = getEntity(world, `hamlet:duck:${i}`);
    if (duck) duck.gesture = { act: 'peck', t: EAT_TIME };
    say(world, 'eat', tz.id, { duck: i, n, full: r.eaten[i] === r.shares[i], sound: 'peck' });
    feedLook(world, r);
    a.k += 1;
    return;
  }
  // All the ducks ate what they could: the hungry ducks look at the child.
  r.eat = null;
  const hero = getEntity(world, 'hero');
  r.eaten.forEach((n, i) => {
    if (n >= r.shares[i] || !hero) return;
    const duck = getEntity(world, `hamlet:duck:${i}`);
    if (duck) duck.gesture = { act: 'look', x: hero.position.x, z: hero.position.z, t: 2.5 };
  });
  const full = a.result !== 'few';
  if (full) {
    r.done = true;
    tz.zone.done = true;
  }
  say(world, 'fed', tz.id, { key: r.key, form: r.form, result: a.result, hungry: a.hungry, extra: a.extra, need: r.need, poured: r.poured, commits: r.commits, full, ate: r.eaten.filter((n, i) => n === r.shares[i]).length, sound: a.result === 'exact' ? 'drum' : 'tap' });
}

// ---------------------------------------------------------------- The fish traps

// round: { index, level, key, task (trapTask), pile: { x, y, z } (the traps of the fisher), spots:
// [{ x, z }] (half blocks, in the stream, upstream first), y (the water), weir: { x, y, z } }.
export function setupTraps(world, round) {
  clearActivity(world, 'traps');
  const t = round.task;
  const tz = addEntity(world, {
    id: 'zone:trial-traps',
    keep: true,
    zone: {
      id: 'trial-traps', rule: 'trial', trial: 'traps', task: 'traps', level: round.level, commits: 0, fails: 0, done: false, made: 0,
      round: { index: round.index, skill: t.skill, key: round.key, form: t.form, need: t.need, count: t.count, facts: t.facts.slice(), caught: 0, commits: 0, fill: null, done: false },
    },
    position: { ...round.pile, facing: 0 },
  });
  const pile = addEntity(world, { id: 'zone:traps-pile', keep: true, zone: { id: 'traps-pile', task: 'trial-traps', rule: 'heap', accepts: 'lo', items: [], x: round.pile.x, y: round.pile.y, z: round.pile.z, cols: 4, step: 1.1 }, position: { ...round.pile, facing: 0 } });
  for (const size of t.pile) {
    const id = `lo:${tz.zone.made++}`;
    addEntity(world, { id, keep: true, item: { kind: 'lo', size, task: 'trial-traps', zone: 'traps-pile', home: 'traps-pile', held: null, set: false }, position: { ...round.pile, facing: 0 }, look: `lo-${size}` });
    pile.zone.items.push(id);
  }
  packHeap(world, pile.zone);
  const xs = round.spots.map((q) => q.x);
  const zs = round.spots.map((q) => q.z);
  const mid = { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
  addEntity(world, {
    id: 'zone:traps-stream',
    keep: true,
    zone: { id: 'traps-stream', task: 'trial-traps', rule: 'spots', accepts: 'lo', items: [], x: mid.x, y: round.y, z: mid.z, slots: round.spots.map((q) => ({ x: q.x, z: q.z })), rect: { x0: Math.min(...xs) - 4, x1: Math.max(...xs) + 2, z0: Math.min(...zs) - 1.2, z1: Math.max(...zs) + 1.2 } },
    position: { x: mid.x, y: round.y, z: mid.z, facing: 0 },
  });
  round.spots.forEach((q, k) => part(world, 'traps', `hamlet:spot:${k}`, { x: q.x, y: round.y, z: q.z }, 'trap-spot'));
  part(world, 'traps', 'hamlet:weir', round.weir, 'weir-shut');
  return tz;
}

const trapsIn = (world) => (getEntity(world, 'zone:traps-stream')?.zone.items ?? []).map((id) => getEntity(world, id)).filter(Boolean);

function trapWork(world) {
  const tz = tzOf(world, 'traps');
  const r = tz?.zone.round;
  if (!r || r.done || r.fill) return;
  // The new traps in the stream (the full traps of a commit before stay set), upstream first.
  const fresh = trapsIn(world).filter((t) => !t.item.set).sort((a, b) => a.position.z - b.position.z);
  if (!fresh.length) return say(world, 'short', tz.id, { sound: 'tap' });
  r.commits += 1;
  tz.zone.commits += 1;
  const set = trapsIn(world).length - fresh.length;
  const res = judgeTraps({ need: r.need - r.caught, count: r.count === null ? null : r.count - set }, fresh.map((t) => t.item.size));
  const solved = res.result === 'exact';
  if (!solved) tz.zone.fails += 1;
  say(world, 'skill', tz.id, trialSkill({ id: 'traps', skill: r.skill, level: tz.zone.level }, { solved, efficient: solved && r.commits === 1, first: r.commits === 1, parts: res.caught, target: r.need - r.caught }));
  for (const t of fresh) t.item.set = true;
  r.fill = { ids: fresh.map((t) => t.id), k: 0, t: 0, result: res.result, total: res.total, extra: res.extra };
  const weir = getEntity(world, 'hamlet:weir');
  if (weir) weir.look = 'weir-open';
  const fisher = getEntity(world, 'npc:fisher-uncle');
  if (fisher && weir) fisher.gesture = { act: 'point', x: weir.position.x, z: weir.position.z, t: 1.5 };
  say(world, 'weir', tz.id, { sound: 'splash' });
}

function traps(world, dt) {
  const tz = tzOf(world, 'traps');
  const r = tz?.zone.round;
  const f = r?.fill;
  if (!f) return;
  f.t += dt;
  if (f.t < FILL_TIME) return;
  f.t = 0;
  if (f.k < f.ids.length) {
    const t = getEntity(world, f.ids[f.k]);
    if (t) t.look = `lo-${t.item.size}-full`;
    say(world, 'fill', tz.id, { trap: f.ids[f.k], n: t?.item.size ?? 0, sound: 'splash' });
    f.k += 1;
    return;
  }
  r.fill = null;
  r.caught = Math.min(r.need, r.caught + f.total);
  const weir = getEntity(world, 'hamlet:weir');
  if (weir) weir.look = 'weir-shut';
  const full = f.result !== 'few';
  if (full) {
    r.done = true;
    tz.zone.done = true;
  }
  say(world, 'caught', tz.id, { key: r.key, form: r.form, result: f.result, need: r.need, total: f.total, extra: f.extra, commits: r.commits, full, sound: f.result === 'exact' ? 'drum' : 'tap' });
}

// ---------------------------------------------------------------- The drum dance

// round: { index, level, skill, key, task (drumTask), period, beat ({ window, slower, faster,
// fastest }), drums: [{ x, y, z }] (one for each group), line: { x, y, z } (the first dancer),
// look: [look of the dancers of each group] }.
export function setupDrum(world, round) {
  clearActivity(world, 'drum');
  const t = round.task;
  const tz = addEntity(world, {
    id: 'zone:trial-drum',
    keep: true,
    zone: {
      id: 'trial-drum', rule: 'trial', trial: 'drum', task: 'drum', level: round.level, commits: 0, fails: 0, done: false,
      round: { index: round.index, skill: round.skill, key: round.key, form: t.form, groups: t.groups.slice(), targets: t.targets.slice(), facts: t.facts.slice(), period: round.period, beat: { ...round.beat }, dance: null, paused: false, idle: 0, missed: [], done: false },
    },
    position: { ...round.drums[0], facing: 0 },
  });
  t.groups.forEach((n, g) => {
    const d = round.drums[g] ?? round.drums[0];
    part(world, 'drum', `hamlet:drum:${g}`, d, 'bronze-drum', { hamletTap: { act: 'drum', what: 'drum', which: g } });
    for (let k = 0; k < n; k++) part(world, 'drum', `hamlet:dancer:${g}:${k}`, { x: round.line.x + k * 1.6, y: round.line.y, z: round.line.z + g * 2.2, facing: Math.PI }, round.looks[g % round.looks.length]);
  });
  return tz;
}

const danceTask = (r) => ({ groups: r.groups, targets: r.targets });
// The fact of a beat: the beat as times of the number of a group (the next target after the last
// good jump, for a wrong beat).
function factOf(r, beat) {
  const n = r.groups.find((m) => beat % m === 0 && r.targets.includes(beat)) ?? r.groups[0];
  return factKey(Math.max(1, Math.round(beat / n)), n);
}

function danceEvents(world, tz, out) {
  const r = tz.zone.round;
  for (const ev of out) {
    if (ev.type === 'beat') say(world, 'beat', tz.id, { beat: ev.beat, target: r.targets.includes(ev.beat), sound: 'drum-small' });
    else if (ev.type === 'jump') {
      for (const g of ev.groups) for (let k = 0; k < r.groups[g]; k++) {
        const d = getEntity(world, `hamlet:dancer:${g}:${k}`);
        if (d) d.hop = { t: 0 };
      }
      say(world, 'jump', tz.id, { beat: ev.beat, groups: ev.groups, sound: 'bronze' });
    } else if (ev.type === 'miss') {
      const next = r.targets.find((t) => t > ev.from) ?? ev.beat;
      r.missed.push(factOf(r, next));
      tz.zone.fails += 1;
      say(world, 'miss', tz.id, { beat: ev.beat, from: ev.from, sound: 'laugh' });
      const drummer = getEntity(world, 'npc:drummer');
      if (drummer) drummer.gesture = { act: 'laugh', t: 1.2 };
    } else if (ev.type === 'done') {
      r.done = true;
      tz.zone.done = true;
      tz.zone.commits += 1;
      const clean = ev.clean;
      say(world, 'skill', tz.id, trialSkill({ id: 'drum', skill: r.skill, level: tz.zone.level }, { solved: true, efficient: clean, first: true, parts: [r.targets.length], target: r.targets.length }));
      say(world, 'danced', tz.id, { key: r.key, form: r.form, clean, misses: r.dance.misses, missed: r.missed.slice(), period: r.dance.period, full: true, sound: 'drum' });
    }
  }
}

function drumWork(world, want) {
  const tz = tzOf(world, 'drum');
  const r = tz?.zone.round;
  if (!r || r.done) return;
  // The first tap (or a tap after the drummer stopped) starts the beat; it is no beat of the dance.
  if (!r.dance || r.paused) {
    if (!r.dance) r.dance = createDance(danceTask(r), r.period);
    else r.dance.time = 0;
    r.paused = false;
    r.idle = 0;
    return say(world, 'dance', tz.id, { sound: 'bronze' });
  }
  r.idle = 0;
  danceEvents(world, tz, tapDance(r.dance, danceTask(r), want.which ?? 0, r.beat));
}

function drum(world, dt) {
  const tz = tzOf(world, 'drum');
  const r = tz?.zone.round;
  for (const d of query(world, 'hop')) {
    d.hop.t += dt;
    if (d.hop.t > 0.5) delete d.hop;
  }
  if (!r?.dance || r.paused || r.done) return;
  const out = stepDance(r.dance, danceTask(r), dt, r.beat);
  for (const ev of out) if (ev.type === 'miss') r.idle += 1;
  danceEvents(world, tz, out);
  // No tap for some targets: the drummer stops and waits for the child.
  if (r.idle >= IDLE_MISSES && !r.done) {
    r.paused = true;
    say(world, 'pause', tz.id, {});
  }
}

// ---------------------------------------------------------------- The system

export function hamlet(world, dt) {
  for (const e of query(world, 'work', 'position')) {
    const act = e.work.trial;
    if (!ACTIVITIES.includes(act)) continue;
    const want = e.work;
    delete e.work;
    if (e.fall) continue;
    if (act === 'ducks') duckWork(world, e, want);
    else if (act === 'traps') trapWork(world);
    else drumWork(world, want);
  }
  if (world.paused) return;
  ducks(world, dt);
  traps(world, dt);
  drum(world, dt);
}
