// The mentors in the session: the person who gives a task watches the child and answers (docs/
// MENTOR.md). The session sends the commits, the actions of the hands, the checks, the waves, and
// a tick for each step; this module keeps the state of the mentor of each task (src/core/mentor.js),
// logs each move with its outcome, and turns each move into a script that the mentor system of the
// world plays (src/core/world/systems/mentor.js). No DOM.
import { newMentor, newMemory, onCommit, onIdle, onWave, onCheck, onChange, demoTarget, demoParts, shareParts } from './mentor.js';
import { getEntity, query, addEntity } from './world/state.js';
import { endScript } from './world/systems/mentor.js';
import { basketRowAt, matSlot, spareStake, inHands, DESK_COLORS } from './world/systems/work.js';
import { atWork } from './world/systems/schedule.js';
import { STEP } from './world/step.js';
import { allowedSlots, takeBackSlot, stakeResult } from './world/trials.js';
import { UNIT_PACE, COUNT_LEAD, ROW_NAME, EXTRA_LINE, springEnd, layEnd, PIECE_NAME, PIECES_LINE, shortPiece, badPiece, layPlan, LAY_PACE, LAY_LINE, QUICK_PIECE, DIFF_SHOW, REST_LINE } from './world/zones.js';

// The zones where the parts of a try go, in the order of the search.
const PLACES = ['exact', 'bundle', 'basket', 'line', 'forge', 'woodpile', 'spots'];
const NEAR = 28; // half blocks: the hero is at the station when nearer than this to its place
const LEAVE = 40; // half blocks: farther than this soon after a miss, the hero left the station
const LEAVE_TIME = 15; // seconds after a miss
const COUNT_PACE = 0.9; // seconds between two counted parts (counting pace)
const FIRST_DELAY = 0.5; // seconds after the start of a task: the person shows the first step
const WORK_NEAR = 24; // half blocks: a person this near the place of a task stands at the work
const AWAY = 40; // half blocks: a person farther than this from the place of a task is not there (#51)
const AFTER_WAVE = 20; // seconds after a wave: no idle move (the offer never answers a wave, #64)
const PUT_PACE = 1.1; // seconds between two parts that a person puts for the child, counted aloud (#69)
const COUNT_GAP = 0.6; // seconds between the count of the child's work and the move of the mentor

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// data: the data of the game; profile: the profile (profile.mentors keeps the memory); learner():
// the learner or null; log(kind, fields): the learning log; emit(ev): an event of the session;
// world(): the world state; env(): the facts of the map; raise(key): the task asks for a bigger
// task (a move raise), returns nothing; nameOf(id): the name of a person (a text parameter).
const HOLE_MARK = 8; // seconds that the mark of the hole of an escape stays
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
// The moves that play the share of grade 4 on another instance (#116).
const SHARE_SHOWS = new Set(['demo', 'smaller', 'share']);
const ROD_GLOW = 0.35; // seconds between two rods that glow in the hint of a full mat (#96)
const BUNDLE = 10; // rods in a bundle of the teacher
const REST_TIME = 4.4; // seconds that the person and the hero sit in a break
const BALL_UP = 0.1; // half blocks over the ground: the rice ball on its leaf
const BALL_OUT = 1.6; // half blocks from the hero toward the camera
const NGHE_SIDE = 2.2; // half blocks from the rice ball to Nghé, to the side of the view

// A number of hundredths in words, as a text parameter (#101): "một phẩy hai mươi lăm" (1,25),
// "một phẩy không năm" (1,05), "hai" (2,00).
export function decimalWords(h) {
  const a = { key: `num.${Math.floor(h / 100)}` };
  const b = h % 100;
  if (!b) return { key: 'decimal.whole', params: { a } };
  return { key: b < 10 ? 'decimal.small' : 'decimal.words', params: { a, b: { key: `num.${b}` } } };
}

export function createMentoring({ data, profile, learner = () => null, log = () => null, emit = () => {}, world, env, raise = () => {}, nameOf = () => '', chosen = () => null }) {
  const cfg = data.mentors;
  const states = new Map(); // key -> the mentor of the task
  const tracks = new Map(); // key -> { startT, firstAct, lastAct, lastCommit, acted, left, round }
  let delayed = []; // moves that wait: { at, key, move, info }
  const raises = new Set(); // the tasks with a bigger task for the next time, said at their end (#98)
  const firstShown = new Set(); // the tasks whose first step the person showed in this visit
  let lastSkill = null;
  const now = () => (world()?.tick ?? 0) * STEP;
  const defOf = (key) => cfg?.mentors?.[key] ?? null;
  const famOf = (key) => cfg.families[defOf(key).family];
  // The line of a move: the own line of the mentor of the task, else the common line.
  // A level of a task with a form (#101) can have its own line of a move: <move>.<form>.
  const lineOf = (key, move) => {
    const lines = defOf(key)?.lines ?? {};
    const zone = world()?.entities ? getEntity(world(), `zone:${key}`)?.zone : null;
    const form = zone?.plan?.form ?? null;
    // After the fair test of the smith, the help is the step of the rest (#120: the wave gave the
    // fair test again, after "make the rest the hard way").
    if (zone?.tested && lines[`${move}.rest`]) return lines[`${move}.rest`];
    return (form && lines[`${move}.${form}`]) || lines[move] || cfg.lines[move];
  };
  // The gesture of a task (#105): carry (a thing from a heap to a place), cut, quench, or load (the
  // boat of the fisher from grade 3). A level with a form can have its own gesture (gestures.<form>).
  const gestureOf = (key) => {
    const def = defOf(key);
    const form = world()?.entities ? getEntity(world(), `zone:${key}`)?.zone.plan?.form : null;
    return (form && def?.gestures?.[form]) || def?.gesture || 'carry';
  };
  const knowsGesture = (key) => Boolean(profile?.flags?.[`gesture.${gestureOf(key)}`]);
  const memoryOf = (key) => {
    profile.mentors ??= {};
    return (profile.mentors[key] ??= newMemory());
  };

  // The key of the mentor of a task id (the task of a skill event, of a thing, or of a zone).
  function keyOf(task) {
    if (!task) return null;
    const t = String(task);
    if (t.startsWith('trial-event-')) return t.slice(6);
    const z = getEntity(world(), `zone:${t}`)?.zone;
    if (z?.rule === 'span') return z.task;
    return t;
  }

  // The things of a task in the world: the zone of the trial, the place of the parts, the piles,
  // and the person. Null when the task is not there (or is done).
  function taskOf(key) {
    const w = world();
    if (!w || !defOf(key)) return null;
    const person = getEntity(w, defOf(key).person);
    if (key === 'bridge') {
      const hero = getEntity(w, 'hero');
      const spans = query(w, 'zone').filter((z) => z.zone.rule === 'span' && z.zone.task === 'bridge' && !z.zone.set);
      if (!spans.length) return null;
      const place = hero ? spans.sort((a, b) => dist(a.position, hero.position) - dist(b.position, hero.position))[0] : spans[0];
      const piles = query(w, 'zone').filter((z) => z.zone.rule === 'pile' && z.zone.accepts === place.zone.accepts);
      const at = { x: place.zone.lane, z: place.zone.from + place.zone.gap / 2 };
      return { key, place, piles, person, at, done: false, round: place.zone.round };
    }
    const owner = key.startsWith('event-') ? `trial-${key}` : key;
    const tz = getEntity(w, `zone:${owner}`);
    if (!tz || tz.zone.done) return null;
    const zones = query(w, 'zone').filter((z) => z.zone.task === owner);
    const place = PLACES.map((r) => zones.find((z) => z.zone.rule === r)).find(Boolean) ?? null;
    const piles = zones.filter((z) => z.zone.rule === 'heap' && !z.zone.id.includes('-stray-'));
    const p = place?.zone ?? tz.position;
    // The woodcutter works at the stem (the sticks go to the woodpile after the cut).
    const stem = tz.zone.stem;
    const at = stem ? { x: stem.x + stem.length / 2, z: stem.z } : place?.zone.rect ? { x: (place.zone.rect.x0 + place.zone.rect.x1) / 2, z: (place.zone.rect.z0 + place.zone.rect.z1) / 2 } : { x: p.x, z: p.z };
    return { key, tz, place, piles, person, at, done: false, round: 0 };
  }

  // Does the hero carry a thing of the task, and has the mentor a line for it (lines.carry)?
  function carrying(key, task) {
    if (!defOf(key)?.lines?.carry) return false;
    const held = getEntity(world(), getEntity(world(), 'hero')?.hands?.holds);
    return Boolean(held?.item && (held.item.task === key || held.item.task === task.tz?.zone.task));
  }

  // Has the basket of the healer bunches of each kind (#79)?
  function basketHasEach(key, task) {
    const z = task?.place?.zone;
    if (!defOf(key)?.lines?.give || z?.rule !== 'basket') return false;
    // A need of its own for each kind (#101): the basket has at least that many of each kind (#108:
    // after a wrong basket of doses, a wave said to give it again).
    if (z.need && typeof z.need === 'object' && z.each == null) return (z.kinds ?? []).every((k) => itemsOf(task.place).filter((e) => e.item.kind === `herb-${k}`).length >= z.need[k]);
    const kinds = new Set(itemsOf(task.place).map((e) => e.item.kind));
    return (z.kinds ?? []).every((k) => kinds.has(`herb-${k}`));
  }
  // The hole of the last escape of the fish at the row of the fisher, while no stake stands in it.
  function holeOf(key, task) {
    if (!defOf(key)?.lines?.hole || task?.place?.zone.rule !== 'line') return null;
    return task.tz?.zone.hole ?? null;
  }
  // The lost thing of an event nearest to the hero (a duck that ran away, not a duck of another
  // farm), or null.
  function lostThing(task) {
    const hp = getEntity(world(), 'hero')?.position;
    const lost = query(world(), 'item').filter((e) => keyOf(e.item.task) === task?.key && !e.item.stray && !e.item.held && /-lost-\d+$/.test(e.item.zone ?? '') && e.position && !e.hidden);
    if (!lost.length || !hp) return null;
    return lost.sort((a, b) => Math.hypot(a.position.x - hp.x, a.position.z - hp.z) - Math.hypot(b.position.x - hp.x, b.position.z - hp.z))[0];
  }
  // Has the mat of the teacher a bundle of rods or more (#96)?
  function matFull(key, task) {
    const z = task?.place?.zone;
    if (!defOf(key)?.lines?.tie || z?.rule !== 'bundle' || task.tz?.zone.plan?.form === 'share') return false;
    return itemsOf(task.place).length >= (z.bundle ?? BUNDLE);
  }
  // Is the row of the fisher at the float, with no stake in the hands (#78)?
  function rowFull(key, task) {
    const z = task?.place?.zone;
    if (!defOf(key)?.lines?.full || z?.rule !== 'line') return false;
    return itemsOf(task.place).some((e) => e.item.slot === z.length);
  }
  // Has the row changed since the last tide? Only then a tide comes after the row is at the float,
  // so only then "Đủ hàng rồi. Xem nước lên nào!" is true (#105, rule 34).
  function rowChanged(task) {
    const tide = task.tz?.zone.tide;
    const z = task.place?.zone;
    if (!tide || !z) return true;
    const row = query(world(), 'item').filter((e) => e.item.zone === z.id && !e.item.held && e.item.slot != null);
    return row.map((e) => e.item.slot).sort((a, b) => a - b).join(',') !== tide.last;
  }
  // A stake of the child on the row that the row does not need (its two neighbors are at most the
  // space of the row apart), while the person has not shown the take back yet (#78); or null.
  // again: also after the first time (with an empty pile, #92).
  function tightStake(key, task, again = false) {
    const z = task?.place?.zone;
    if (!defOf(key)?.lines?.tight || z?.rule !== 'line' || (task.tz?.zone.tightShown && !again)) return null;
    // All the stakes of the row (the two of the fisher are not in the items of the place).
    const row = query(world(), 'item').filter((e) => e.item.zone === z.id && !e.item.held && e.item.slot != null);
    // The same stake that glows at the empty pile: the last one that the row does not need (#97).
    return spareStake(task.place, row);
  }

  // When the rule of narrow places allows no free point of the row (#115): the stake of the row to
  // take back ({ at }), or the pile when the row holds the fish already ({ at, pile: true }); else
  // null.
  function noRoomStake(key, task) {
    const z = task?.place?.zone;
    if (!defOf(key)?.lines?.takeback || z?.rule !== 'line') return null;
    const row = query(world(), 'item').filter((e) => e.item.zone === z.id && !e.item.held && e.item.slot != null);
    const slots = row.map((e) => e.item.slot);
    if (allowedSlots(slots, z.length, z.space).length) return null;
    const pile = task.piles?.[0] ?? getEntity(world(), 'zone:stakes');
    if (stakeResult(slots, z.length, z.space).solved) return pile ? { at: pile.position, pile: true } : null;
    const h = getEntity(world(), 'hero');
    const k = takeBackSlot(slots, z.length, z.space, h ? h.position.x - z.x : 0, row.filter((e) => e.item.set).map((e) => e.item.slot));
    const stake = row.find((e) => e.item.slot === k);
    return stake ? { at: stake.position } : null;
  }

  // The piles of a task have no thing that the hands can take.
  const pileEmpty = (task) => task.piles.length > 0 && !task.piles.flatMap(itemsOf).some((e) => !e.item.held);
  // The things in a zone (entities).
  const itemsOf = (zoneEnt) => (zoneEnt?.zone.items ?? []).map((id) => getEntity(world(), id)).filter(Boolean);
  // The sizes of the things that the child can choose (on the piles and on the place).
  function sizesOf(task) {
    const all = [...task.piles.flatMap(itemsOf), ...itemsOf(task.place)];
    return [...new Set(all.map((e) => e.item.size ?? 1))].sort((a, b) => a - b);
  }

  // The points of the work of a task (half blocks): its zones (the corners of a place, both ends
  // of the row of the fisher and of the stem of the woodcutter, #83: the view frames the whole
  // work), its place, and its person when the person stands at the work. The view turns so that
  // nothing covers them, and frames them (the event workView, #38).
  function zonePoints(z) {
    const y = z.position.y;
    const r = z.zone.rect;
    if (z.zone.rule === 'line') return [{ x: z.zone.x, y, z: z.zone.z }, { x: z.zone.x + z.zone.length, y, z: z.zone.z }];
    if (z.zone.stem) return [{ x: z.zone.stem.x, y, z: z.zone.stem.z }, { x: z.zone.stem.x + z.zone.stem.length, y, z: z.zone.stem.z }];
    if (r) return [{ x: r.x0, y, z: r.z0 }, { x: r.x1, y, z: r.z1 }];
    return [z.position];
  }
  function workPoints(key) {
    const task = taskOf(key);
    if (!task) return [];
    const owner = key.startsWith('event-') ? `trial-${key}` : key;
    const pts = [task.at, ...query(world(), 'zone').filter((z) => z.zone.task === owner && z.position).flatMap(zonePoints)];
    // The stem of the woodcutter is on the zone of the trial.
    const trial = getEntity(world(), `zone:${owner}`);
    if (trial?.zone.stem && trial.position) pts.push(...zonePoints(trial));
    const p = task.person?.position;
    if (p && dist(p, task.at) <= WORK_NEAR) pts.push(p);
    return pts.filter(Boolean).map((q) => (q === p ? q : { x: q.x, y: q.y ?? env()?.groundY(q.x / 2, q.z / 2) ?? 0, z: q.z }));
  }

  // A mentor starts again for a task (a new trial, a new event, a new round of the bridge).
  function start(key, round = 0) {
    if (!defOf(key)) return null;
    if (key !== 'bridge') {
      const points = workPoints(key);
      const person = taskOf(key)?.person?.position;
      emit({ type: 'workView', key, points, sight: person && points.includes(person) ? [person] : [], person: taskOf(key)?.person?.id ?? null });
    }
    const st = newMentor(key);
    st.round = round;
    // A task that the child started before a load (#105: a saved game opened at the fisher, and
    // the first wave gave the start demonstration with an empty pile): no start demonstration and
    // no "try first" again; the help reads the work as it is.
    const before = round === 0 ? taskOf(key) : null;
    const underway = Boolean(before && underwayOf(before));
    if (underway) {
      st.tried = (before.tz?.zone.commits ?? 0) > 0;
      st.toldTry = true;
    }
    // The visits of the child to the task, over the games (#73: no picture of another station in
    // the first visit).
    if (round === 0) memoryOf(key).visits = (memoryOf(key).visits ?? 0) + 1;
    states.set(key, st);
    tracks.set(key, { startT: now(), firstAct: null, lastAct: now(), lastCommit: null, acted: underway, left: false });
    delayed = delayed.filter((d) => d.key !== key);
    endScript(world(), getEntity(world(), `script:${key}`));
    // At the start of a task, the person shows the first step one time on the real things.
    // One time in a visit: the rounds of a practice after the first one start with no demonstration.
    if (underway) firstShown.add(key);
    if (round === 0 && key.startsWith('trial-') && defOf(key).first !== false && !firstShown.has(key)) {
      firstShown.add(key);
      delayed.push({ at: now() + FIRST_DELAY, key, move: 'first', info: {} });
    }
    return st;
  }
  // Is the work of a task under way: a commit, a thing on its place, a mark, or a hole of an escape?
  // A fixed thing of the place is not work of the child (the iron in the forge of the smith).
  function underwayOf(task) {
    const z = task.tz?.zone;
    return (z?.commits ?? 0) > 0 || itemsOf(task.place).some((e) => !e.item.fixed) || (z?.marks?.length ?? 0) > 0 || Boolean(z?.hole);
  }
  function stateOf(key, task = null) {
    const st = states.get(key);
    if (st && (!task || st.round === task.round)) return st;
    return start(key, task?.round ?? 0);
  }

  // A commit of a task, before the learner takes it. input: parts, target, solved, efficient,
  // mashing, resets, skill.
  function commit(key, input, task) {
    const def = defOf(key);
    if (!def) return;
    const fam = famOf(key);
    const st = stateOf(key, task);
    const tr = tracks.get(key);
    const t = now();
    const parts = input.parts ?? [];
    const target = fam.reader === 'each' && parts.length ? input.target / parts.length : input.target;
    const r = onCommit(st, memoryOf(key), {
      parts, target, solved: input.solved, efficient: input.efficient, mashing: input.mashing, resets: input.resets ?? 0,
      timeS: t - (tr.firstAct ?? tr.lastCommit ?? tr.startT), sizes: task ? sizesOf(task) : [], fact: String(input.target), left: tr.left,
      allTaken: task ? parts.length >= task.piles.flatMap(itemsOf).filter((e) => !e.item.stray).length + itemsOf(task.place).length : false,
      pL: input.skill ? learner()?.entry(input.skill)?.p ?? null : null,
      firstVisit: (memoryOf(key).visits ?? 1) <= 1,
    }, fam, cfg);
    if (r.help) log('help', r.help);
    for (const c of r.checks) log('check', { task: key, changed: c.changed });
    Object.assign(tr, { firstAct: null, lastCommit: t, lastAct: t, acted: false, left: false, fixed: false, target: input.target });
    emit({ type: 'mentor', key, diagnosis: r.diagnosis, move: r.move, level: r.level, remembered: r.remembered });
    // The answer of the world to a wrong try comes first, at each help level (#64): the person
    // counts the child's own work on the place (the rods on the mat, each row of the basket) and
    // marks what went wrong. The move of the mentor comes after the count; a mark is the count.
    // A right cut of the woodcutter is counted too (#80: the stem went away with no count and no line).
    const count = task && (!input.solved || task.tz?.zone.cutPieces) ? doMove(key, 'count', { target: input.target, solved: Boolean(input.solved) }) : 0;
    // The world fixes the work (the extra rods or bunches go back): the work is right, and no help
    // comes (#74: no demonstration, no smaller, no share, no offer). The record keeps the try as a
    // try with help.
    if (count > 0 && rightAfterExtras(task, input.target)) {
      if (st.pending) st.pending.move = 'fix';
      st.offered = true;
      // Until the child acts again, a wave gets the next step (#79: the give of the basket).
      tr.fixed = true;
      return;
    }
    if (count > 0 && r.move === 'mark') return;
    // The count of the desks of the share says the next step (#116): no move after it.
    if (count > 0 && key === 'trial-scholar' && task?.tz?.zone.plan?.form === 'share' && SHARE_SHOWS.has(r.move)) return;
    if (r.move !== 'wait') schedule(key, r.move, { remembered: r.remembered, delay: (count > 0 ? count + COUNT_GAP : 0) + (r.delay ?? 0), target: input.target, solved: input.solved });
  }

  // The work of a wrong try is right once its extra things are back: more rods than a bundle, or
  // in each row of the basket at least the number, and more in one row.
  function rightAfterExtras(task, target) {
    if (!task?.place || target == null) return false;
    const parts = itemsOf(task.place);
    const z = task.place.zone;
    if (z.rule === 'bundle') return parts.reduce((a, e) => a + (e.item.size ?? 1), 0) > target;
    if (z.kinds) {
      const each = Math.round(target / z.kinds.length);
      const counts = z.kinds.map((k) => parts.filter((e) => e.item.kind === `herb-${k}`).length);
      return counts.every((c) => c >= each) && counts.some((c) => c > each);
    }
    return false;
  }

  function schedule(key, move, info = {}) {
    // A bigger task waits for the end of the task (#98): it is noted at once, so that the end of a
    // task in the same step finds it.
    if (move === 'raise') doMove(key, move, info);
    else if (info.delay > 0) delayed.push({ at: now() + info.delay, key, move, info });
    else doMove(key, move, info);
  }

  // A skill event of the world (the first one of a commit: a commit can send two skills).
  function skill(ev) {
    // A prediction (the bands of the teacher, #101) is a skill of its own, not a try of the work.
    if (ev.predict) return;
    const key = keyOf(ev.task);
    if (!defOf(key)) return;
    const mark = `${ev.id}:${world()?.tick}`;
    if (mark === lastSkill) return;
    lastSkill = mark;
    // A commit of the child is the gesture of the task done in Tre (#105): its first demonstration
    // fades in the next task with the same gesture.
    if (profile?.flags) profile.flags[`gesture.${gestureOf(key)}`] = true;
    commit(key, ev, taskOf(key));
  }

  // A plank too long on the bridge: the world judged the try at once (no skill event); the mentor
  // reads it as a miss.
  function long(ev) {
    const task = taskOf('bridge');
    if (!task || !defOf('bridge')) return;
    const parts = itemsOf(task.place).map((e) => e.item.size);
    commit('bridge', { parts, target: task.place.zone.gap, solved: false, mashing: false, resets: 0, skill: null }, task);
  }

  // An event of the world: the actions of the hands of the hero (a thing taken, put, added, or
  // taken back) for the idle time, and the changes after a check (self-corrections).
  function worldEvent(ev) {
    // The iron of the child turns hot (not the piece that the smith shows first).
    if (ev.type === 'glow' && !String(ev.id).endsWith('-demo')) for (const [key, tr] of tracks) if (defOf(key)?.pictureAfterGlow) tr.sawGlow = true;
    // The bands of the teacher ran out, or one is left at the end (#101): he counts the bundles by g.
    if (ev.type === 'bands') {
      const key = keyOf(getEntity(world(), ev.id)?.zone?.task);
      if (defOf(key)) doMove(key, 'bundles', ev);
      return;
    }
    if (!['pick', 'put', 'add', 'back', 'mark', 'drop'].includes(ev.type) || ev.by) return;
    if ((ev.type === 'pick' || ev.type === 'put' || ev.type === 'drop') && ev.id !== 'hero') return;
    const thing = ev.item ? getEntity(world(), ev.item) : null;
    // The task of the event: of its thing, its place, or the thing that it happened to (a mark on the
    // stem of the woodcutter, #80).
    const key = keyOf(thing?.item?.task ?? (ev.zone ? getEntity(world(), `zone:${ev.zone}`)?.zone.task : null) ?? (String(ev.id).startsWith('zone:') ? getEntity(world(), ev.id)?.zone?.task : getEntity(world(), ev.id)?.item?.task) ?? null);
    if (!defOf(key)) return;
    const task = taskOf(key);
    const st = stateOf(key, task);
    const tr = tracks.get(key);
    const t = now();
    tr.acted = true;
    tr.fixed = false;
    tr.lastAct = t;
    tr.firstAct ??= t;
    // The child did the gesture of a task (a thing from a heap to a place): the first step of a
    // task is not shown again in any task (#101). The flag is in the profile.
    if (ev.type === 'put' && ev.id === 'hero' && task?.place && ev.zone === task.place.zone.id && profile?.flags) profile.flags['gesture.carry'] = true;
    // A self-correction: after a check, the child takes a thing back from the place (#64). A put,
    // or a pick at a heap, is not one.
    const takeBack = ev.type === 'pick' && Boolean(task?.place) && ev.from === task.place.zone.id;
    if (takeBack && onChange(st, memoryOf(key))) emit({ type: 'selfFix', key });
    // Too many marks again after a cut with too many pieces: one time, the woodcutter shows on a mark
    // that a tap takes it off (#80).
    const z = task?.tz?.zone;
    if (ev.type === 'mark' && !ev.off && z?.tooMany && !z.eraseShown && z.marks.length >= z.tooMany && defOf(key).lines?.erase) doMove(key, 'erase');
  }

  // A tap with empty hands on a thing that lies on the place of a task (a rod on the mat, a bunch
  // in the basket): a check (#64). A tap on the place itself, or a put, is not a check (a lost
  // child taps the basket to walk to it). A mark that waits for the child to look first does not
  // come.
  function checkThing(id) {
    const thing = getEntity(world(), id);
    const zone = thing?.item?.zone;
    if (!zone) return null;
    for (const key of states.keys()) {
      const task = taskOf(key);
      if (!task || task.place?.zone.id !== zone) continue;
      const st = stateOf(key, task);
      onCheck(st);
      const before = delayed.length;
      delayed = delayed.filter((d) => !(d.key === key && d.move === 'mark'));
      if (delayed.length < before && st.pending?.move === 'mark') st.pending.move = 'wait';
      emit({ type: 'check', key });
      return key;
    }
    return null;
  }

  // The task that the hero works on now: the nearest task with a mentor, at its station.
  function activeKey() {
    const hero = getEntity(world(), 'hero');
    if (!hero || !cfg) return null;
    let best = null;
    for (const key of Object.keys(cfg.mentors)) {
      const task = taskOf(key);
      if (!task) continue;
      if (key === 'bridge' && !states.has(key)) {
        // The bridge is a task only near its gap.
        if (dist(hero.position, task.at) > NEAR) continue;
      }
      const d = dist(hero.position, task.at);
      if (d <= NEAR && (!best || d < best.d)) best = { key, d };
    }
    return best?.key ?? null;
  }

  // The task of a person that goes on now (its mentor key), or null: a tap on the person during
  // the task asks for help (docs/TASKS.md).
  function taskOfPerson(entityId) {
    if (!cfg) return null;
    return Object.keys(cfg.mentors).find((key) => defOf(key).person === entityId && key !== 'bridge' && taskOf(key)) ?? null;
  }

  // A wave: the child calls the person of the task (key: that task; else the task nearest to the
  // hero). A demonstration that showed its key part ends.
  // While the person counts or shows (a script of the task plays), a wave waits for its end (#64).
  function wave(forKey = null) {
    const key = forKey ?? activeKey();
    if (!key) return null;
    const playing = getEntity(world(), `script:${key}`)?.script;
    if (playing) {
      // The wave waits for the end of the count (#64), and then its answer is never another count
      // (#80: two waves gave two counts of the pieces, one after the other).
      waves.add(key);
      if (playing.steps?.some((st) => /^num\./.test(st.say?.key ?? ''))) afterCount.add(key);
      return { waiting: key };
    }
    return answerWave(key);
  }
  const waves = new Set(); // the tasks with a wave that waits for the end of a script
  const afterCount = new Set(); // the tasks whose waiting wave came during a count
  // The moves that are a count of the work of the child: after a count, a wave gets the next step.
  const COUNTS = new Set(['count', 'mark']);
  function answerWave(key) {
    const task = taskOf(key);
    const st = stateOf(key, task);
    const tr = tracks.get(key);
    const r = onWave(st, memoryOf(key), famOf(key), cfg, null, Boolean(tr?.acted));
    if (tr) tr.lastWave = now();
    log('ask', { task: key, when: r.when, move: r.move });
    emit({ type: 'mentor', key, diagnosis: r.diagnosis, move: r.move, level: st.level, asked: r.when });
    // A wave after a count with no act of the child since then gets the next step too (#79: after
    // the right count of the basket, a wave made the healer count all of it again).
    const counted = afterCount.delete(key) || Boolean(tr && tr.lastCommit !== null && !tr.acted);
    // The count made the work right (the extras went back): the next step is to finish.
    doMove(key, tr?.fixed ? 'show' : r.move, { asked: true, counted });
    return r;
  }

  // One step: the moves that waited, the idle time (a child who does not know what to do, and a
  // stuck child who does not ask), and a hero who leaves the station soon after a miss.
  function tick() {
    const t = now();
    // While a screen is open (a talk box), the world and the scripts wait, and so do the moves that
    // wait. A move that is due while the count of the child's work still plays waits for the end of
    // the count (#69: a talk box stopped the count at four, and then the demo started and ended the
    // count; the child took four as the count of the mat).
    // The idle time of the child waits too: the time of a box is no idle time.
    if (world()?.paused) {
      for (const d of delayed) d.at += STEP;
      for (const tr of tracks.values()) tr.lastAct += STEP;
      return;
    }
    const counting = (key) => getEntity(world(), `script:${key}`)?.script.move === 'count';
    for (const d of delayed) if (d.at <= t && counting(d.key)) d.at = t + STEP;
    const due = delayed.filter((d) => d.at <= t);
    delayed = delayed.filter((d) => d.at > t);
    for (const d of due) doMove(d.key, d.move, d.info);
    for (const key of [...waves]) {
      if (getEntity(world(), `script:${key}`) || delayed.some((d) => d.key === key)) continue;
      waves.delete(key);
      if (taskOf(key)) answerWave(key);
    }
    const hero = getEntity(world(), 'hero');
    if (!hero) return;
    for (const [key, st] of states) {
      const task = taskOf(key);
      if (!task) continue;
      const tr = tracks.get(key);
      const d = dist(hero.position, task.at);
      if (st.lastSolved === false && tr.lastCommit !== null && t - tr.lastCommit < LEAVE_TIME && d > LEAVE) tr.left = true;
      if (d > NEAR || world().paused) continue;
      // No idle move while the person counts or shows, or while a move waits, or soon after a wave
      // (#64: the offer ended a demo in the middle of its count, and answered a wave).
      if (getEntity(world(), `script:${key}`) || delayed.some((x) => x.key === key) || waves.has(key) || t - (tr.lastWave ?? -Infinity) < AFTER_WAVE) continue;
      const seconds = t - Math.max(tr.lastAct, tr.lastCommit ?? tr.startT);
      const r = onIdle(st, { seconds, acted: tr.acted || st.tried }, famOf(key));
      if (!r) continue;
      st.pending = { diagnosis: r.diagnosis ?? 'unsure', move: r.move, pBefore: null };
      emit({ type: 'mentor', key, diagnosis: r.diagnosis, move: r.move, level: st.level, idle: true });
      doMove(key, r.move, {});
    }
  }

  // The moves of each task since the last try of the child, and the move "go and see another
  // station" of this visit (#45): a person never says the same line more than two times in a row.
  // After that, the person waits and nods until the child tries something; and the picture of
  // another station comes at most one time in a visit.
  const said = new Map(); // `${the id of a person}|${move}` -> { at (the last try then), n }
  let pictured = false;
  const asked = new Map(); // the id of a person -> { move, n }: the answers to waves in a row
  // A move in the world: a script of the person (src/core/world/systems/mentor.js).
  function doMove(key, move, info = {}) {
    const w = world();
    const def = defOf(key);
    let task = taskOf(key);
    if (!w || !def) return;
    // No hint after the end of a task (#96): only the count of what happened. A bigger task for
    // the next time is no hint: its line comes at the end (endRaise).
    if (task?.tz?.zone.done && move !== 'count' && move !== 'raise' && move !== 'bundles') return 0;
    // The share of grade 4 (#116: after each check, the teacher played the share on five rods again,
    // also with one rod left for the box): the demonstration comes at most one time in a task, and
    // only after a wave; else the count of the desks with the next step.
    if (key === 'trial-scholar' && task?.tz?.zone.plan?.form === 'share' && SHARE_SHOWS.has(move)) {
      if (!info.asked || task.tz.zone.shareShown) move = 'count';
      else task.tz.zone.shareShown = true;
    }
    // A try is a commit (rule 33: the help goes one level up only after a try). The lines count
    // for each person, so that two tasks of one person count together.
    const whoNow = (task?.person ?? getEntity(w, def.person))?.id ?? key;
    const tried = Math.max(...[...tracks.values()].map((x) => x.lastCommit ?? -1), -1);
    const last = said.get(`${whoNow}|${move}`);
    const n = last && last.at === tried ? last.n + 1 : 1;
    said.set(`${whoNow}|${move}`, { at: tried, n });
    // The count of the child's work is the answer of the world: it always comes. A wave never gets
    // a nod (#64).
    if (move !== 'count' && !info.asked && (n > 2 || (move === 'picture' && pictured))) {
      emit({ type: 'nod', id: whoNow });
      return 0;
    }
    // A wave after the same answer two times in a row: another move that shows the next step, so
    // that the line is not the same again and again.
    const run = asked.get(whoNow);
    // A family with no share in its ladders never puts things into the work of the child (#78:
    // the fisher put two stakes into the row of the child, and they did not close the space).
    const shares = Object.values(famOf(key)?.ladders ?? {}).some((l) => l.includes('share') || l.includes('smaller'));
    if (info.asked && !info.other && move !== 'count' && run?.move === move && run.n >= 2) {
      for (const m of ['show', 'share', 'demo'].filter((x) => x !== move && (shares || x !== 'share'))) {
        const d = doMove(key, m, { ...info, other: true });
        if (d) return d;
      }
    }
    // The demonstration comes at most one time in a task (#69: the children saw it three times and
    // still did not know the count of their own mat); after it, the person puts some parts for the
    // child.
    const trk = tracks.get(key);
    // The help that comes after a break, at once (#94): the demonstration, else a smaller task,
    // else the mark of what went wrong.
    const nextHelp = () => (def.demo && !trk?.demoed ? 'demo' : shares ? 'smaller' : 'mark');
    // A break is a real break (#94: "Nghỉ tay một chút, ăn nắm cơm đã." and no rice ball came): the
    // person and the hero sit, the hero eats a rice ball, Nghé gets a bite, and the next help comes.
    const rest = move === 'break' && Boolean(task);
    if (rest) move = nextHelp();
    // The picture of a station where the child has nothing more to do (pictureUnless): the next
    // help, never a line of a break with no break (#57, #94).
    if (move === 'picture' && def.pictureUnless && profile.flags?.[def.pictureUnless] && task) move = nextHelp();
    if (move === 'demo' && trk?.demoed) move = shares ? 'smaller' : 'mark';
    if ((move === 'smaller' || move === 'share') && !shares) move = 'mark';
    // After a count, a wave gets the next step, never the same count again (#80, #79). With a lost
    // thing and a short place (the ducks), the next step is the lost thing: the person points at it,
    // and never counts the place again or brings one herself (#113).
    if (info.counted && COUNTS.has(move)) move = 'show';
    const brought = task ? itemsOf(task.place).filter((e) => !e.item.fixed).length : 0;
    if (info.asked && (COUNTS.has(move) || move === 'share' || move === 'smaller') && task && lostThing(task) && brought && itemsOf(task.place).length < (task.tz?.zone.need ?? 0)) move = 'show';
    if (move === 'demo' && trk) trk.demoed = true;
    // The picture of another station waits until the child has seen the iron hot one time (#70: the
    // child who waited for red heard "go to the river" after two misses).
    if (move === 'picture' && def.pictureAfterGlow && !trk?.sawGlow) move = 'show';
    if (move === 'picture') pictured = true;
    // The moves of a form of a level (#107): at the share of grade 4 and the big bundle of grade 5,
    // the help of the mat of grade 1 is no help. Each move has the line and the act of its form:
    // the mark counts the desks (or the table), and a demonstration, a smaller task, or a share is
    // a demonstration of the form on another instance.
    const form = key === 'trial-scholar' || key === 'trial-healer' ? task?.tz?.zone.plan?.form ?? null : null;
    const formAct = key === 'trial-scholar' && (form === 'share' || form === 'decimal') ? { mark: 'count', demo: 'show', smaller: 'show', share: 'show' }[move] ?? null
      : key === 'trial-healer' && ['doses', 'model', 'fraction'].includes(form) ? { demo: 'level', smaller: 'level', share: 'level' }[move] ?? null : null;
    if (formAct) info = { ...info, small: move !== 'demo' };
    let person = task?.person ?? getEntity(w, def.person);
    // The person of the task is not there (at home at night, #51): Nghé says the lines, in the
    // words of a friend, and shows the place. Nghé never carries the things of the task.
    const nghe = getEntity(w, 'friend:nghe');
    const away = Boolean(task && nghe && !nghe.hidden && (!atWork(person, w.clock.minutes) || Math.hypot(person.position.x - task.at.x, person.position.z - task.at.z) > AWAY));
    if (away) {
      person = nghe;
      task = { ...task, person: nghe, byNghe: true };
    }
    const who = person?.id ?? null;
    const steps = [];
    let t = 0;
    // The keys of the lines of Nghé: the general line of the move (not the own line of the person),
    // and the words of a friend where the line says cháu.
    const moveOf = Object.fromEntries([...Object.entries(cfg.lines), ...Object.entries(def.lines ?? {})].filter(([, k]) => k).map(([m, k]) => [k, m]));
    const asNghe = (k) => cfg.ngheLines?.[moveOf[k] ?? k] ?? cfg.ngheLines?.[k] ?? (moveOf[k] ? cfg.lines[moveOf[k]] : k);
    // The lines of the count say what happened to the work of the child (#73: such a line is never
    // cut or replaced by a later line).
    const happened = move === 'count';
    // ready: the line says that the work is right now (#74): the next press finishes the task.
    // asked: the line answers a wave; the child asked for it, also when it was said before (#105).
    const say = (at, k, params = {}, { ready = null } = {}) => { if (who && k) steps.push({ at, say: { id: who, key: away ? asNghe(k) : k, params, ...(happened ? { happened } : {}), ...(ready ? { ready } : {}), ...(info.asked ? { asked: true } : {}) } }); };
    const point = (at, p, time = 1.2) => { if (who) steps.push({ at, point: { id: who, x: p.x, z: p.z, time } }); };
    const mark = (at, p, ttl = 3) => steps.push({ at, mark: { x: p.x, z: p.z, ttl } });
    if (info.remembered && cfg.again[move]) {
      say(0, cfg.again[move]);
      t = 2.2;
    }
    if (rest) t = restSteps(key, who, { say, steps }, t);
    let keyAt;
    const needsPlace = ['first', 'show', 'mark', 'count', 'cue', 'demo', 'smaller', 'share'].includes(move);
    if (needsPlace && !task) return 0;
    if (move === 'count') {
      t = countSteps(task, famOf(key), info, { say, point, mark, steps }, t);
    } else if (move === 'first') {
      t = firstSteps(task, def, { say, point, mark, steps }, t);
    } else if ((move === 'show' || move === 'mark') && carrying(key, task)) {
      // The thing of the task is in the hands (the sticks after the right cut): the line is the
      // next step with it, toward its place (#57), not the first step. A stake in the hands with a
      // hole in the row goes into the hole (#105: with the stake in the hands, a wave said to take
      // a stake back).
      const h = holeOf(key, task);
      const place = task.place?.position ?? task.at;
      // No free point of the row that the rule of narrow places allows (#115: a row from before
      // #109 had none, and the wave said to put the stake in the row): the stake to take back.
      const back = noRoomStake(key, task);
      // No place takes the thing now (the tide is in at the row of the fisher): the person says why
      // (#70: with a stake in the hands, the child heard "take a stake from the heap" four times).
      const tide = task.tz?.zone.tide;
      const waits = Boolean(defOf(key).lines.wait && tide && tide.phase !== 'low');
      if (back && !waits) {
        say(t, back.pile ? defOf(key).lines.pile : defOf(key).lines.takeback);
        point(t, back.at, 2);
        mark(t, back.at, HOLE_MARK);
        t += 3;
      } else if (h && !waits) {
        const z = task.place.zone;
        const p = { x: z.x + h.from + h.size / 2, z: z.z };
        say(t, defOf(key).lines.hole);
        point(t, p, 2);
        mark(t, p, HOLE_MARK);
        t += 3;
      } else if (getEntity(world(), 'why:fisher:next') && defOf(key).lines.ring && !waits) {
        // No hole, and the ring of a refused press shows: the wave says to walk to it (#115).
        const r = getEntity(world(), 'why:fisher:next').position;
        say(t, defOf(key).lines.ring);
        point(t, r, 2);
        mark(t, r, HOLE_MARK);
        t += 3;
      } else {
        say(t, waits ? defOf(key).lines.wait : defOf(key).lines.carry);
        point(t, place, 1.4);
        mark(t, place, 2.5);
        t += 2;
      }
    } else if (move === 'erase') {
      const z = task?.tz?.zone;
      const m = z?.marks?.at(-1);
      if (m == null) return 0;
      z.eraseShown = true;
      const p = { x: z.stem.x + m, z: z.stem.z };
      say(t, defOf(key).lines.erase);
      point(t, p, 2);
      mark(t, p, 3);
      t += 3;
    } else if (formAct === 'count') {
      say(t, lineOf(key, 'mark'));
      t = form === 'share' ? deskSteps(task, { say, point, mark, steps }, t + 1.6) : tableSteps(task, { say, point, mark, steps }, t + 1.6);
    } else if (formAct === 'level') {
      t = healerFormSteps(task, form, { say, point, mark, steps }, t);
    } else if (formAct === 'show') {
      const out = formDemoSteps(task, form, info, { say, point, steps }, t);
      t = out.t;
      keyAt = out.keyAt;
    } else if (move === 'show' && form === 'share') {
      // The share: the heap, and then each desk (#107: not the mat).
      say(t, lineOf(key, 'show'));
      const pile = task.piles[0]?.position ?? task.at;
      point(t, pile, 1.4);
      mark(t, pile, 2.5);
      let at = t + 1.6;
      for (const d of query(w, 'zone').filter((z) => z.zone.rule === 'desk' && /^desk-/.test(z.zone.id))) {
        point(at, { x: d.zone.x, z: d.zone.z }, 0.9);
        mark(at, { x: d.zone.x, z: d.zone.z }, 1.2);
        at += 1;
      }
      t = at + 0.5;
    } else if (move === 'show' && matFull(key, task)) {
      // A full mat: the step after the put is the count and the tie (#96: with 10 or 11 rods on the
      // mat, "Lấy một que ở đống kia …" made a child put one more). The rods glow one by one, and
      // then the teacher.
      const rods = itemsOf(task.place);
      say(t, lineOf(key, 'tie'));
      rods.forEach((e, i) => steps.push({ at: t + 0.6 + i * ROD_GLOW, glow: { ids: [e.id] } }));
      const after = t + 0.6 + rods.length * ROD_GLOW;
      if (task.person?.id) steps.push({ at: after, glow: { ids: [task.person.id] } });
      if (task.person?.position) point(after, task.person.position, 1.6);
      t = after + 1.6;
    } else if ((move === 'show' || move === 'mark') && holeOf(key, task) && !(pileEmpty(task) && tightStake(key, task, true))) {
      // After an escape, the next step is the hole (#96, #97): the free point in the middle of the
      // space glows, and the person points at it. Never "Đủ hàng rồi …" with the fish gone. With an
      // empty pile, the stake to take back comes first (below), and then the hole (#105).
      const h = holeOf(key, task);
      const z = task.place.zone;
      const p = { x: z.x + h.from + h.size / 2, z: z.z };
      say(t, defOf(key).lines.hole);
      point(t, p, 2);
      mark(t, p, HOLE_MARK);
      t += 3;
    } else if (move === 'show' && rowFull(key, task) && rowChanged(task)) {
      // The row is at the float and waits for the tide: the hint is to wait and look at the water,
      // never to take a stake (#78: the child heard "Lấy một cái cọc ở đống …" four times with a
      // full row, and with an empty pile).
      say(t, defOf(key).lines.full);
      point(t, task.at, 1.4);
      t += 2.5;
    } else if ((move === 'show' || move === 'mark') && (tightStake(key, task) || (pileEmpty(task) && tightStake(key, task, true)))) {
      // A row that is too tight: one time in the task, the person shows on a stake that a tap and a
      // press take it back (#78: the children never found that a stake of the row comes back). With
      // an empty pile, this is the hint each time: the step that the child can do now, never a
      // stake from the empty pile (#92).
      const stake = tightStake(key, task) ?? tightStake(key, task, true);
      if (task.tz) task.tz.zone.tightShown = true;
      say(t, defOf(key).lines.tight);
      point(t, stake.position, 2);
      mark(t, stake.position, 3);
      // The stake glows with a ring of its own and bobs until the child takes a stake (the play of
      // #92: the frame showed no stake that stood out).
      steps.push({ at: t, glow: { ids: [stake.id] } });
      t += 3;
    } else if (move === 'show' && defOf(key).lines?.cut && task?.tz?.zone.marks?.length && !task.tz.zone.cut) {
      // A stem with a mark and no cut: the hint is the next step, the count and the cut (#89: a wave
      // said "Vạch một dấu phấn …" with a mark on the stem).
      const z = task.tz.zone;
      const p = z.stem ? { x: z.stem.x + z.marks.at(-1), z: z.stem.z } : task.at;
      say(t, defOf(key).lines.cut);
      point(t, p, 2);
      mark(t, p, 3);
      t += 3;
    } else if (move === 'show' && basketHasEach(key, task)) {
      // The basket has bunches of each kind: the hint is the give, never another bunch (#79: "Lấy
      // một bó lá ở luống …" came with two of each in the basket).
      say(t, defOf(key).lines.give);
      point(t, task.place.position, 1.4);
      mark(t, task.place.position, 2.5);
      if (task.person?.position) point(t + 1.6, task.person.position, 1.4);
      t += 3;
    } else if (move === 'show' && lostThing(task)) {
      // The lost ducks: no heap (#96: "Lấy một cái ở đống kia …" sent a child to look for a pile).
      // The nearest lost duck glows, and then the pen.
      const duck = lostThing(task);
      // With ducks in the pen, the line points at the nearest lost duck of her flock, and the view
      // shows it (#113: "Kia, một con vịt trắng của cô.").
      const some = itemsOf(task.place).some((e) => !e.item.fixed) && defOf(key).lines?.lost;
      say(t, some ? defOf(key).lines.lost : lineOf(key, 'show'));
      if (some) steps.push({ at: t, view: { key: `${key}-lost`, points: [{ ...duck.position }, { ...getEntity(w, 'hero').position }] } });
      steps.push({ at: t, glow: { ids: [duck.id] } });
      point(t, duck.position, 1.4);
      mark(t, duck.position, 2.5);
      point(t + 1.6, task.at, 1.4);
      mark(t + 1.6, task.at, 2.5);
      t += 3;
    } else if (move === 'show') {
      const pile = task.piles[0]?.position ?? task.at;
      say(t, lineOf(key, 'show'));
      point(t, pile, 1.4);
      mark(t, pile, 2.5);
      point(t + 1.6, task.at, 1.4);
      mark(t + 1.6, task.at, 2.5);
      t += 3;
    } else if (move === 'mark') {
      t = markSteps(task, famOf(key), info, { say, point, mark, steps }, t);
    } else if (move === 'cue') {
      if (key === 'bridge') steps.push({ at: t, cue: { zone: task.place.id } });
      else {
        steps.push({ at: t, nudge: { x: task.at.x, z: task.at.z, time: 6 } });
        steps.push({ at: t + 6, unnudge: true });
        t += 6;
      }
    } else if (move === 'bundles') {
      t = bundleSteps(task, info, { say, point, mark, steps }, t);
    } else if (move === 'demo') {
      const out = demoSteps(task, def, info, { say, point, steps }, t);
      t = out.t;
      keyAt = out.keyAt;
    } else if (move === 'smaller' || move === 'share') {
      t = shareSteps(task, famOf(key), move, info, { say, point, steps }, t) ?? markSteps(task, famOf(key), info, { say, point, mark, steps }, t);
    } else if (move === 'picture') {
      // The line names the person of another station (pictureWho), by the name of the region. A
      // line that names a place where the child has nothing more to do (the trial there is done:
      // pictureUnless) says only to rest (#57).
      say(t, def.picture, def.pictureWho ? { who: nameOf(def.pictureWho) } : {});
      t += 2;
    } else if (move === 'raise') {
      // The line of a bigger task says "next time" (#98: after the first of three bundles, the
      // child did the same work two more times): it waits for the end of the task (endRaise). The
      // memory of the mentor takes the lift at once.
      const mem = memoryOf(key);
      mem.lift = Math.min(2, (mem.lift ?? 0) + 1);
      raise(key);
      raises.add(key);
      return 0;
    } else {
      say(t, lineOf(key, move));
      t += 2;
    }
    // A wave is never silent (#105): when the help has no new move, the person says the last help
    // again and points, because the child asked for it.
    const line = steps.find((x) => x.say)?.say.key ?? null;
    if (!steps.length) return 0;
    endScript(w, getEntity(w, `script:${key}`));
    steps.push({ at: t + 0.5, end: true });
    steps.sort((a, b) => a.at - b.at);
    addEntity(w, { id: `script:${key}`, script: { key, move, t: 0, i: 0, steps, spawned: [], ...(keyAt !== undefined ? { keyAt } : {}) } });
    if (info.asked) asked.set(whoNow, { move, line, n: run && (run.move === move || (line && run.line === line)) ? run.n + 1 : 1 });
    else asked.delete(whoNow);
    return t + 0.5;
  }

  // The steps of a break (#94): the line, the person and the hero sit, a rice ball comes into the
  // hands of the hero, the hero eats it (about four seconds), and Nghé comes for a bite.
  function restSteps(key, who, s, t) {
    const w = world();
    const hero = getEntity(w, 'hero');
    s.say(t, lineOf(key, 'break'));
    if (!hero?.position) return t + 2;
    const p = hero.position;
    // The rice ball lies on its leaf on the side of the camera, so that the child sees it (the play
    // of #94: in the hands it was behind the body of the hero), and the hero turns to it.
    const az = env()?.view?.();
    const dir = Number.isFinite(az) ? az : (p.facing ?? 0);
    const ball = { x: p.x + Math.sin(dir) * BALL_OUT, z: p.z + Math.cos(dir) * BALL_OUT };
    if (who) s.steps.push({ at: t + 0.2, point: { id: who, x: p.x, z: p.z, time: 0.6 } });
    if (who) s.steps.push({ at: t + 0.8, sit: { ids: [who], time: REST_TIME, apart: 'hero' } });
    s.steps.push({ at: t + 0.8, sit: { ids: ['hero'], time: REST_TIME, act: 'eat', face: ball } });
    // At the height of the feet of the hero (on a deck, the ground is under it).
    s.steps.push({ at: t + 0.8, spawn: { look: 'rice-ball', x: ball.x, z: ball.z, ...(Number.isFinite(p.y) ? { y: p.y + BALL_UP } : { dy: BALL_UP }) } });
    // Nghé comes to the rice ball from the side of the view, never in front of the hero.
    const side = { x: Math.cos(dir) * NGHE_SIDE, z: -Math.sin(dir) * NGHE_SIDE };
    s.steps.push({ at: t + 1.4, nudge: { x: ball.x, z: ball.z, time: REST_TIME, from: side } });
    s.steps.push({ at: t + 2.4, look: { k: 0, look: 'rice-ball-half' }, sound: { sound: 'peck', id: 'hero' } });
    s.steps.push({ at: t + 3.6, look: { k: 0, look: 'rice-ball-bit' }, sound: { sound: 'peck', id: 'friend:nghe' } });
    s.steps.push({ at: t + 4.6, gone: { k: 0 } });
    s.steps.push({ at: t + 4.8, unnudge: true });
    return t + 5;
  }

  // The count of the child's own work after a wrong try (#64), the same at each help level: the
  // parts on the place counted aloud with the mark of what went wrong (the mark), or, at a task with
  // no parts to count, the mark of what went wrong only: the widest gap of the row of the fisher.
  function countSteps(task, fam, info, s, t) {
    if (task.tz?.zone.cutPlan) return laySteps(task, s, t);
    if (task.tz?.zone.cutPieces) return pieceSteps(task, s, t, info);
    // The teacher at grades 4 and 5 (#101): the desks and the box, or the table.
    const form = task.tz?.zone.plan?.form;
    if (form === 'share') return deskSteps(task, s, t);
    if (form === 'decimal' && !itemsOf(task.place).length) return tableSteps(task, s, t);
    if ((form === 'doses' || form === 'model') && task.place?.zone.rule === 'basket' && itemsOf(task.place).length) return doseSteps(task, s, t);
    if (itemsOf(task.place).length && (fam.reader === 'sum' || fam.reader === 'each')) return markSteps(task, fam, info, s, t);
    if (task.place?.zone.rule === 'line') {
      const z = task.place.zone;
      const slots = itemsOf(task.place).map((e) => e.item.slot).filter((v) => v != null).sort((a, b) => a - b);
      const ends = [...new Set([0, ...slots, z.length])].sort((a, b) => a - b);
      let gap = null;
      for (let i = 1; i < ends.length; i++) if (!gap || ends[i] - ends[i - 1] > gap.w) gap = { w: ends[i] - ends[i - 1], at: (ends[i] + ends[i - 1]) / 2 };
      if (!gap) return t;
      const p = { x: z.x + gap.at, z: z.z };
      s.point(t, p, 2.5);
      s.mark(t, p, 5);
      return t + 2.5;
    }
    return t;
  }

  // The mark of the woodcutter (#75: "look at the pieces between the marks" showed no piece): the
  // pieces of the stem between the chalk marks light up one at a time, and he counts the rings of
  // each ("Khúc này: một, hai, ba.").
  function stemSteps(task, s, t) {
    const z = task.tz.zone;
    const st = z.stem;
    const lines = defOf(task.key)?.lines ?? {};
    s.say(t, lineOf(task.key, 'mark'));
    let at = t + 2.2;
    const ends = [0, ...[...new Set(z.marks)].filter((m) => m > 0 && m < st.length).sort((a, b) => a - b), st.length];
    for (let i = 1; i < ends.length; i++) {
      s.say(at, lines.piece ?? 'woodcutter.piece');
      at += PIECE_NAME;
      for (let j = ends[i - 1] + 1; j <= ends[i]; j++) {
        const p = { x: st.x + j - 0.5, z: st.z };
        s.point(at, p, UNIT_PACE);
        s.steps.push({ at, spawn: { look: 'ring-glow', x: p.x, y: st.y, z: p.z, facing: Math.PI / 2 } });
        if (j - ends[i - 1] <= 30) s.say(at + 0.05, `num.${j - ends[i - 1]}`);
        at += UNIT_PACE;
      }
      at += 0.6;
    }
    return at + 0.5;
  }

  // The count of the pieces of a cut of the woodcutter (#75: "Khúc này ngắn quá" came, and nothing
  // showed which piece): each piece lies in its row, and he counts its rings one at a time, each
  // ring lights up at its number ("Khúc này: một, hai, ba."). When the number of pieces is not the
  // number that he asked for, he says it ("Hai khúc. Anh cần ba khúc."). Then the short piece glows,
  // he points at it, and it breaks ("Khúc này ngắn quá."). The times are those of the world
  // (cutCount in src/core/world/zones.js).
  function pieceSteps(task, s, t, info = {}) {
    const z = task.tz.zone;
    const pieces = z.cutPieces;
    const parts = z.cutParts ?? pieces.length;
    const lines = defOf(task.key)?.lines ?? {};
    let at = t + COUNT_LEAD;
    // The count of a child of K and grade 1 (#118): one number for each piece, with the glow of the
    // piece; the count ring by ring comes after a wave.
    const quick = z.cutQuick && !info.asked;
    pieces.forEach((len, i) => {
      const e = getEntity(world(), `piece:woodcutter:${i}`);
      if (!e) return;
      if (quick) {
        s.steps.push({ at, spawn: { look: `piece-glow-${len}`, x: e.position.x, y: e.position.y, z: e.position.z, facing: Math.PI / 2 } });
        s.point(at, { x: e.position.x + len / 2, z: e.position.z }, PIECE_NAME + QUICK_PIECE);
        s.say(at + 0.05, 'woodcutter.pieceN', { n: { key: `num.${Math.min(30, len)}` } });
        at += PIECE_NAME + QUICK_PIECE + 0.4;
        return;
      }
      s.say(at, lines.piece ?? 'woodcutter.piece');
      at += PIECE_NAME;
      for (let j = 1; j <= len; j++) {
        const p = { x: e.position.x + j - 0.5, z: e.position.z };
        s.point(at, p, UNIT_PACE);
        s.steps.push({ at, spawn: { look: 'ring-glow', x: p.x, y: e.position.y, z: p.z, facing: Math.PI / 2 } });
        if (j <= 30) s.say(at + 0.05, `num.${j}`);
        at += UNIT_PACE;
      }
      at += 0.4;
    });
    if (pieces.length !== parts && lines.pieces) s.say(at, lines.pieces, { n: { key: `num.${Math.min(30, pieces.length)}` }, m: { key: `num.${Math.min(30, parts)}` } });
    // A right cut: he says what happened ("Hai khúc dài bằng nhau.", #80).
    else if (lines.equal && shortPiece(pieces) === null) s.say(at, lines.equal, { n: { key: `num.${Math.min(30, pieces.length)}` } });
    at += PIECES_LINE;
    // The levels of grades 1 and 2 (#118): the pieces lie side by side, ends together, and the part
    // of the long piece that sticks out glows: "Khúc này dài hơn."
    if (z.cutDiff) {
      const long = pieces.indexOf(Math.max(...pieces));
      const short = Math.min(...pieces);
      const e = getEntity(world(), `piece:woodcutter:${long}`);
      if (e) {
        const d = pieces[long] - short;
        s.steps.push({ at, spawn: { look: `piece-glow-${d}`, x: e.position.x + short, y: e.position.y, z: e.position.z, facing: Math.PI / 2 } });
        s.point(at, { x: e.position.x + short + d / 2, z: e.position.z }, 1.8);
        s.say(at + 0.1, 'woodcutter.longer');
        return at + DIFF_SHOW;
      }
    }
    // The piece that he names (#98): the short one of a cut with the right number of pieces, or a
    // long one of a cut with a wrong number. A piece of the right length is never short.
    const bad = badPiece(pieces, parts);
    const e = bad === null ? null : getEntity(world(), `piece:woodcutter:${bad.i}`);
    if (e) {
      const len = pieces[bad.i];
      s.steps.push({ at, spawn: { look: `piece-glow-${len}`, x: e.position.x, y: e.position.y, z: e.position.z, facing: Math.PI / 2 } });
      s.point(at, { x: e.position.x + len / 2, z: e.position.z }, 1.6);
      s.say(at + 0.1, bad.long ? lines.long ?? 'woodcutter.long' : lines.short ?? 'woodcutter.short');
      at += 2;
    }
    return at;
  }

  // The check of a cut of parts of a stem (#102): the woodcutter lays a piece along another, one
  // time after another, an outline at each lay, and counts ("một, hai, ba, bốn"), and says the part
  // when the lays fit ("Một phần tư cây tre."). At grade 5 he lays the piece of one third and the
  // piece of one fourth along an outline of the whole stem, and says the rest. Then the piece that
  // is not its length glows, and he says why ("Khúc này dài quá."). The times are those of the world
  // (layCount in src/core/world/zones.js).
  const STEM_ROW = 2; // half blocks: the outline of the whole stem, past the last piece
  function laySteps(task, s, t) {
    const z = task.tz.zone;
    const pieces = z.cutPieces;
    const plan = z.cutPlan;
    const lines = defOf(task.key)?.lines ?? {};
    const pieceAt = (i) => getEntity(world(), `piece:woodcutter:${i}`);
    let at = t + COUNT_LEAD;
    if (pieces.length !== plan.want.length) {
      s.say(at, lines.pieces ?? 'woodcutter.pieces', { n: { key: `num.${Math.min(30, pieces.length)}` }, m: { key: `num.${Math.min(30, plan.want.length)}` } });
      return at + PIECES_LINE;
    }
    // The outline of the whole stem lies on the far side of the pieces.
    const st = z.stem;
    const last = pieceAt(pieces.length - 1)?.position;
    const stem = last ? { x: st.x, y: last.y, z: last.z + STEM_ROW } : null;
    const lay = (x, y, zz, len) => s.steps.push({ at, spawn: { look: `lay-${len}`, x, y, z: zz, facing: Math.PI / 2 } });
    for (const op of layPlan(pieces, plan)) {
      const e = pieceAt(op.piece);
      const onto = op.onto === 'stem' ? stem : pieceAt(op.onto)?.position;
      if (!e || !onto) continue;
      const len = pieces[op.piece];
      s.steps.push({ at, spawn: { look: `piece-glow-${len}`, x: e.position.x, y: e.position.y, z: e.position.z, facing: Math.PI / 2 } });
      if (op.onto === 'stem') lay(stem.x, stem.y, stem.z, st.length);
      if (op.from === 2) {
        s.point(at, { x: e.position.x + len / 2, z: e.position.z }, LAY_PACE);
        s.say(at + 0.05, 'num.1');
        at += LAY_PACE;
      }
      for (let j = 0; j < op.n; j++) {
        const x = onto.x + j * len;
        lay(x, onto.y, onto.z, len);
        s.point(at, { x: x + len / 2, z: onto.z }, LAY_PACE);
        s.say(at + 0.05, `num.${op.from + j}`);
        at += LAY_PACE;
      }
      if (op.part) {
        s.say(at, 'woodcutter.part', { part: { key: `frac.${op.part.a}.${op.part.b}` } });
        at += LAY_LINE;
      }
    }
    const bad = z.cutBad;
    if (!bad && plan.form === 'unlike') {
      const i = pieces.indexOf(plan.want[2]);
      const e = pieceAt(i);
      if (e) s.steps.push({ at, spawn: { look: `piece-glow-${pieces[i]}`, x: e.position.x, y: e.position.y, z: e.position.z, facing: Math.PI / 2 } });
      // The rest as a fraction, and the whole (#118: "He never said the kitchen part is 5/12 or that
      // the parts add to the whole.").
      const rest = plan.want[2];
      const g = gcd(rest, plan.length);
      s.say(at, 'woodcutter.rest', { n: { key: `num.${Math.min(30, rest)}` }, part: { key: `frac.${rest / g}.${plan.length / g}` } });
      at += REST_LINE;
    }
    const e = bad ? pieceAt(bad.i) : null;
    if (e) {
      const len = pieces[bad.i];
      s.steps.push({ at, spawn: { look: `piece-glow-${len}`, x: e.position.x, y: e.position.y, z: e.position.z, facing: Math.PI / 2 } });
      s.point(at, { x: e.position.x + len / 2, z: e.position.z }, 1.6);
      s.say(at + 0.1, bad.long ? lines.long ?? 'woodcutter.long' : lines.short ?? 'woodcutter.short');
      at += 2;
    }
    return at;
  }

  // The first step, one time at the start of a task: the person takes one thing from a heap, puts
  // it into its place, and takes it back to the heap (def.first: [{ from, to }] zone ids; else the
  // first heap and the place of the task). A task with no heap (or def.first []: the smith, who
  // shows the quench on his own piece): the person points at the place and says what to do. A task
  // of exact rounds (def.first 'point'): the person only points, so that each round stays the child's.
  // A new form of a level (def.forms.<form>) shows its new part after it, one time (#105).
  function firstSteps(task, def, s, t) {
    const w = world();
    const form = formNew(task.key);
    // A form that is a new gesture (the boat of the fisher: only) shows its own part in place of
    // the first step of the lower levels.
    if (form?.only) {
      s.say(t, lineOf(task.key, 'show'));
      t = formSteps(task, form, s, t + 0.6);
      s.say(t, 'mentor.first.you');
      return t + 1.5;
    }
    // def.first 'point': the person only points at the heap and at the place (a task of exact rounds).
    // The demonstration fades (rule 31) only for a child who did the gesture of the task in Tre
    // before: that child gets only the point at the heap and at the place, the line of the task,
    // and the first try. The grade never fades it (#105: a girl of grade 4, new to the game, got no
    // demonstration and did not know how to take a bunch).
    // A form that deals the things of a model (the model basket of the healer, #108) shows the take
    // and the put with the model: she never puts a thing into the place of the child, also not for
    // a moment.
    const knows = knowsGesture(task.key);
    const deal = Boolean(form?.steps?.some((x) => x.deal));
    if ((def.first === 'point' || deal || (knows && !Array.isArray(def.first))) && task.piles[0] && task.place) {
      s.say(t, lineOf(task.key, 'show'));
      s.point(t, task.piles[0].position, 1.4);
      s.mark(t, task.piles[0].position, 2.5);
      s.point(t + 1.6, task.at, 1.4);
      s.mark(t + 1.6, task.at, 2.5);
      if (def.first === 'point') return t + 3;
      t = form ? formSteps(task, form, s, t + 3) : t + 3;
      s.say(t, 'mentor.first.you');
      return t + 1.5;
    }
    const pairs = (task.byNghe ? [] : Array.isArray(def.first) ? def.first : task.piles[0] && task.place ? [{ from: task.piles[0].zone.id, to: task.place.zone.id }] : [])
      .map((p) => ({ heap: getEntity(w, `zone:${p.from}`), place: getEntity(w, `zone:${p.to}`) }))
      .filter((p) => p.heap && p.place);
    s.say(t, lineOf(task.key, 'first'));
    if (!pairs.length) {
      s.point(t, task.at, 2);
      s.mark(t, task.at, 3);
      if (!form) return t + 2.5;
      s.say(t + 2.5, lineOf(task.key, 'show'));
      return formSteps(task, form, s, t + 3.1);
    }
    t += 0.6;
    for (const { heap, place } of pairs) t = putBackSteps(task, heap, place, null, s, t);
    if (form) {
      s.say(t, lineOf(task.key, 'show'));
      t = formSteps(task, form, s, t + 0.6);
    }
    s.say(t, 'mentor.first.you');
    return t + 1.5;
  }
  // The new part of a form that the child has not seen in Tre (def.forms.<form>), or null. The flag
  // form.<key>.<form> keeps it in the profile when it is shown.
  function formNew(key) {
    const form = getEntity(world(), `zone:${key}`)?.zone.plan?.form;
    const spec = form ? defOf(key)?.forms?.[form] : null;
    if (!spec || profile?.flags?.[`form.${key}.${form}`]) return null;
    if (profile?.flags) profile.flags[`form.${key}.${form}`] = true;
    return Array.isArray(spec) ? { steps: spec } : spec;
  }
  // The steps of a new form: a thing from a heap into a place and back ({ put: [heap, place, kind] }),
  // or a point at a thing or a place ({ point: id }).
  function formSteps(task, form, s, t) {
    const w = world();
    for (const step of form.steps ?? []) {
      if (step.put) {
        const [from, to, kind] = step.put;
        const heap = getEntity(w, `zone:${from}`);
        const place = getEntity(w, `zone:${to}`);
        if (heap && place) t = putBackSteps(task, heap, place, kind ?? null, s, t);
      } else if (step.deal) {
        t = dealSteps(task, s, t);
      } else if (step.point) {
        const e = getEntity(w, step.point);
        const p = e?.zone ? { x: e.zone.x, z: e.zone.z } : e?.position;
        if (!p) continue;
        s.point(t, p, 1.4);
        s.mark(t, p, 2.5);
        t += 1.8;
      }
    }
    return t;
  }
  // The model basket of the healer dealt onto its two leaves (#108): one dose on each leaf, one
  // bunch at a time, and "Một lá là một thang.". She deals it one time, at the first step, and the
  // leaves keep it (#125: she dealt it again after each wrong basket, six times in a play), so that
  // the child can look at one dose at any time. She never puts a bunch into the basket of the child.
  function dealSteps(task, s, t) {
    const w = world();
    const recipe = task.tz?.zone.plan?.recipe;
    const model = getEntity(w, 'zone:model');
    if (!recipe || !model) return t;
    const left = itemsOf(model).filter((e) => !e.item.held);
    if (!left.length) return leafSteps(s, t);
    for (let j = 0; ; j++) {
      const leaf = getEntity(w, `zone:leaf-${j}`);
      if (!leaf) break;
      s.point(t, { x: leaf.zone.x, z: leaf.zone.z }, 1);
      for (const [k, n] of Object.entries(recipe)) {
        for (let i = 0; i < n; i++) {
          const k2 = left.findIndex((e) => e.item.kind === `herb-${k}`);
          if (k2 < 0) break;
          const thing = left.splice(k2, 1)[0];
          s.steps.push({ at: t, put: { zone: leaf.id, item: thing.id, person: task.person?.id ?? 'hero' } });
          t += 0.45;
        }
      }
      t += 0.4;
    }
    s.say(t, 'healer.model.leaf');
    return t + 2.2;
  }
  // The first leaf of the model: she points at it, and its bunches glow (#125).
  function leafSteps(s, t, key = 'healer.model.leaf') {
    const leaf = getEntity(world(), 'zone:leaf-0');
    s.say(t, key);
    if (leaf) {
      s.point(t, { x: leaf.zone.x, z: leaf.zone.z }, 1.6);
      s.mark(t, { x: leaf.zone.x, z: leaf.zone.z }, 2.5);
    }
    return t + 2.2;
  }
  // The help of a level of the healer with a structure (#108): the moves that put bunches into the
  // basket of the child (half of the shortfall, a smaller task) show the step of the level in their
  // place. Doses: the leaf of one dose and the basket. Model: the model dealt onto its leaves, and
  // the doses that she needs. Fractions: the rows of six of the basket.
  function healerFormSteps(task, form, s, t) {
    const w = world();
    const basket = task.place;
    if (form === 'doses') {
      const leaf = getEntity(w, 'leaf:healer:dose');
      s.say(t, 'healer.dose.like');
      if (leaf) {
        s.point(t, leaf.position, 1.6);
        s.mark(t, leaf.position, 2.5);
      }
      if (basket) s.point(t + 1.8, basket.position, 1.4);
      return t + 3.4;
    }
    if (form === 'model') {
      // The model lies on its leaves from the first step: she points at the leaf of one dose, and
      // never deals it again (#125).
      t = leafSteps(s, t, 'healer.dose.like');
      s.say(t, 'healer.need.doses', { k: { key: `num.${task.tz.zone.plan.doses}` } });
      if (basket) s.point(t, basket.position, 1.4);
      return t + 2.4;
    }
    // Fractions: each row of six places of the basket.
    const r = basket?.zone.rect;
    s.say(t, 'healer.rows');
    if (r) {
      const rows = Math.max(1, Math.ceil((basket.zone.grid ?? 6) / 6));
      for (let i = 0; i < rows; i++) {
        const p = { x: (r.x0 + r.x1) / 2, z: r.z0 + 1 + i * 0.8 };
        s.point(t + 0.4 + i, p, 0.9);
        s.mark(t + 0.4 + i, p, 1.2);
      }
      return t + 1.4 + rows;
    }
    return t + 2;
  }
  // The check of a wrong basket by doses (#108, grades 3 and 4): the healer lays the bunches of the
  // child onto leaves beside the basket, one dose on each leaf, as far as they go, and says what the
  // last dose lacks or what is left over. The leaves and the bunches on them go at the end of the
  // count: the bunches are back in the basket.
  function doseSteps(task, s, t) {
    const plan = task.tz.zone.plan;
    const z = task.place.zone;
    const kinds = z.kinds;
    const pool = Object.fromEntries(kinds.map((k) => [k, itemsOf(task.place).filter((e) => e.item.kind === `herb-${k}`).length]));
    const r = z.rect;
    s.say(t, 'healer.dose.lay');
    t += 1.6;
    for (let d = 0; d < plan.doses; d++) {
      const at = { x: r.x0 + 1.2 + d * 2.6, z: r.z1 + 1.6 };
      const full = kinds.every((k) => pool[k] >= plan.recipe[k]);
      if (!full && kinds.every((k) => pool[k] === 0)) {
        s.point(t, at, 1.2);
        s.mark(t, at, 2);
        s.say(t + 0.1, 'healer.dose.lack', { n: { key: `ord.${Math.min(6, d + 1)}` }, herb: { key: `herb.name.${kinds[0]}` } });
        return t + 2.8;
      }
      s.steps.push({ at: t, spawn: { look: 'herb-leaf', x: at.x, z: at.z, facing: 0 } });
      let i = 0;
      for (const k of kinds) {
        const n = Math.min(pool[k], plan.recipe[k]);
        for (let j = 0; j < n; j++, i++) s.steps.push({ at: t + 0.2 + i * 0.12, spawn: { look: `herb-${k}`, x: at.x - 0.8 + (i % 5) * 0.4, z: at.z - 0.3 + Math.floor(i / 5) * 0.4, facing: 0 } });
        pool[k] -= n;
      }
      s.point(t, at, 1.2);
      if (!full) {
        const lack = kinds.find((k) => itemsOf(task.place).filter((e) => e.item.kind === `herb-${k}`).length < plan.recipe[k] * (d + 1));
        s.say(t + 0.6, 'healer.dose.lack', { n: { key: `ord.${Math.min(6, d + 1)}` }, herb: { key: `herb.name.${lack}` } });
        return t + 3.4;
      }
      s.say(t + 0.5, d === 0 ? 'count.dose.one' : 'count.dose', { n: { key: `num.${d + 1}` } });
      t += 1.6;
    }
    for (const k of kinds) {
      if (pool[k] <= 0) continue;
      s.say(t, 'healer.dose.left', { n: { key: `num.${Math.min(150, pool[k])}` }, herb: { key: `herb.name.${k}` } });
      t += 2.2;
    }
    return t + 0.6;
  }
  // The person takes one thing (of a kind) from a heap, puts it into a place, and takes it back.
  function putBackSteps(task, heap, place, kind, s, t) {
    // Not the thing that the child tapped: the hero walks to it (#95: the teacher took the rod of
    // the tap, and the hero stood).
    const free = itemsOf(heap).filter((e) => !e.item.held && !e.item.set && !e.item.stray && (!kind || e.item.kind === kind));
    const thing = free.find((e) => e.id !== chosen()) ?? free[0];
    if (!thing) return t;
    const to = place.zone.rect ? { x: (place.zone.rect.x0 + place.zone.rect.x1) / 2, z: (place.zone.rect.z0 + place.zone.rect.z1) / 2 } : { x: place.zone.x, z: place.zone.z };
    s.point(t, heap.position, 1);
    s.mark(t, heap.position, 1.6);
    s.point(t + 1, to, 1.2);
    s.steps.push({ at: t + 1, put: { zone: place.id, item: thing.id, person: task.person?.id ?? 'hero' } });
    s.mark(t + 1, to, 1.6);
    t += 2.2;
    // The thing goes back to its heap, so that the place is empty when the child starts: the
    // first step never leaves a part of the answer (rule 25).
    // From the boat of the fisher he says that he puts his stake back (#119: "I could not tell
    // whether his stake counted.").
    s.say(t, place.zone.rule === 'boat' ? 'fisher.boat.back' : 'mentor.first.back');
    s.point(t, heap.position, 1);
    s.steps.push({ at: t + 0.6, back: { item: thing.id } });
    return t + 1.6;
  }

  // The count of the desks of grade 4 (#101): the total of each desk ("mười một"), then the box
  // ("Hộp: thừa hai.", or "Hộp: không có que nào."), and then what the count shows: rods that are not shared yet, desks that are
  // not equal, or enough rods in the box for one more on each desk.
  function deskSteps(task, s, t) {
    const w = world();
    const plan = task.tz.zone.plan;
    const lines = defOf(task.key)?.lines ?? {};
    const total = (z) => (z?.zone.items ?? []).reduce((a, id) => a + (getEntity(w, id)?.item.value ?? getEntity(w, id)?.item.size ?? 0), 0);
    const sums = [];
    for (let i = 0; i < plan.k; i++) {
      const d = getEntity(w, `zone:desk-${i}`);
      const n = total(d);
      sums.push(n);
      s.point(t, d.position, 1.2);
      s.mark(t, { x: d.zone.x, z: d.zone.z }, 1.6);
      s.say(t + 0.1, n ? `num.${Math.min(150, n)}` : 'num.0');
      t += 1.4;
    }
    const box = getEntity(w, 'zone:box');
    const rest = total(box);
    if (box && lines.box) {
      s.point(t, box.position, 1.2);
      // An empty box has its own line: "Hộp: thừa không." is not how a person says it.
      if (!rest && lines.boxNone) s.say(t + 0.1, lines.boxNone);
      else s.say(t + 0.1, lines.box, { n: { key: `num.${Math.min(150, rest)}` } });
      t += 2;
    }
    // From grade 4, the whole after the groups (#101).
    if (lines.whole) {
      s.say(t, lines.whole, { n: { key: `num.${Math.min(150, sums.reduce((a, b) => a + b, 0) + rest)}` } });
      t += 2;
    }
    // The next step from the work as it is (#116: after each check the teacher said "Còn que chưa
    // chia." and played the share again, also with one rod left for the box): the desk with fewer
    // rods and its count; the rods that are left over, and the box; the rods not shared yet; or the
    // box with enough rods for one more on each desk.
    const heap = getEntity(w, 'zone:rods');
    const left = total(heap) + total(task.place) + inHands(w);
    const equal = sums.every((v) => v === sums[0]);
    const loose = [heap, task.place].flatMap((z) => (z?.zone.items ?? []).map((id) => getEntity(w, id))).filter((e) => e && !e.item.held);
    if (!equal && lines.fewer) {
      const i = sums.indexOf(Math.min(...sums));
      const d = getEntity(w, `zone:desk-${i}`);
      s.point(t, d.position, 1.6);
      s.mark(t, { x: d.zone.x, z: d.zone.z }, 2.5);
      s.say(t + 0.1, lines.fewer, { desk: { key: `scholar.desk.${DESK_COLORS[i % DESK_COLORS.length]}` }, n: { key: `num.${Math.min(150, sums[i])}` } });
      t += 2.6;
    } else if (left && left < plan.k && lines.toBox && loose.every((e) => e.item.kind === 'rod')) {
      for (const e of loose) s.steps.push({ at: t, glow: { ids: [e.id] } });
      if (loose[0]) s.point(t, loose[0].position, 1.2);
      if (box) {
        s.point(t + 1.3, box.position, 1.2);
        s.mark(t + 1.3, { x: box.zone.x, z: box.zone.z }, 2.5);
      }
      s.say(t + 0.1, lines.toBox, { n: { key: `num.${left}` } });
      t += 2.8;
    } else {
      const key = left ? lines.shareLeft : rest >= plan.k ? lines.shareMore : null;
      if (key) {
        const at = left ? (loose[0]?.position ?? heap?.position) : box?.position;
        if (at) s.point(t, at, 1.2);
        s.say(t, key);
        t += 2.4;
      }
    }
    return t;
  }
  // The count of the table of grade 5 (#101): the big bundles, the bundles, and the rods, and the
  // number that they make, in words ("Một bó lớn, hai bó, năm que: một phẩy hai mươi lăm."). Then
  // the number that the teacher needs.
  function tableSteps(task, s, t) {
    const w = world();
    const table = getEntity(w, 'zone:table');
    const things = (table?.zone.items ?? []).map((id) => getEntity(w, id)).filter(Boolean);
    const lines = defOf(task.key)?.lines ?? {};
    const of = (size) => things.filter((e) => (e.item.value ?? 1) === size);
    let sum = 0;
    for (const [size, key] of [[100, 'scholar.part.big'], [10, 'scholar.part.ten'], [1, 'scholar.part.rod']]) {
      const list = of(size);
      if (!list.length) continue;
      sum += size * list.length;
      list.forEach((e) => s.mark(t, e.position, 1.6));
      s.point(t, list[0].position, 1.2);
      s.say(t + 0.1, key, { n: { key: `num.${list.length}` } });
      t += 1.6;
    }
    s.say(t, 'scholar.part.value', { x: decimalWords(sum) });
    t += 2.6;
    if (lines.need) {
      s.say(t, lines.need, { x: decimalWords(task.tz.zone.plan.x) });
      t += 2.4;
    }
    return t;
  }

  // The count of the bundles by their size (#101, grade 3): at each bundle the running total
  // ("sáu, mười hai, mười tám"), then the rods that are left and the bands that are left, and the
  // next step when the bands ran out. info: { g, loose, left, end }.
  function bundleSteps(task, info, s, t) {
    const bundles = world().entities.filter((e) => /^bundle:scholar:\d+$/.test(e.id)).sort((a, b) => a.position.x - b.position.x);
    const lines = defOf(task.key)?.lines ?? {};
    bundles.forEach((e, k) => {
      s.point(t, e.position, 1);
      s.mark(t, e.position, 1.4);
      s.say(t + 0.1, `num.${Math.min(150, info.g * (k + 1))}`);
      t += 1;
    });
    t += 0.4;
    if (info.loose > 0 && lines.loose) {
      s.say(t, lines.loose, { n: { key: `num.${Math.min(150, info.loose)}` } });
      t += 2.2;
    }
    if (info.left > 0 && lines.bandLeft) {
      s.say(t, lines.bandLeft, { n: { key: `num.${info.left}` } });
      t += 2.2;
    }
    if (!info.end && lines.bandMore) {
      const bands = getEntity(world(), 'zone:bands');
      if (bands) s.point(t, bands.position, 1.6);
      s.say(t, lines.bandMore);
      t += 2.2;
    }
    return t;
  }

  // Mark what matters: count the parts on the place aloud, one at a time (each with the running
  // total as a word), then mark the empty part or the part too many.
  function markSteps(task, fam, info, s, t) {
    if (task.tz?.zone.stem && task.tz.zone.marks?.length && !task.tz.zone.cut) return stemSteps(task, s, t);
    const parts = itemsOf(task.place);
    if (task.place?.zone.rule === 'span' && parts.length) return unitSteps(task, parts, s, t);
    s.say(t, lineOf(task.key, 'mark'));
    let total = 0;
    // The things of one unit each (the ducks), counted by groups from grade 3 and with the total at
    // once from grade 4, as the people of the tasks count (#113: the farmer counted ten ducks one by
    // one at grade 4). The total says what is still lacking.
    const unitLines = defOf(task.key)?.lines ?? {};
    const grade = profile?.grade ?? 1;
    const units = fam.reader === 'sum' && parts.length > 1 && unitLines.total && parts.every((e) => (e.item.size ?? 1) === 1);
    if (units && grade >= 4) {
      parts.forEach((e) => s.mark(t + 1, e.position, 2.6));
      s.say(t + 1, unitLines.total, { n: { key: `num.${Math.min(150, parts.length)}` } });
      const need = task.tz?.zone.need ?? 0;
      if (unitLines.lack && need > parts.length) s.say(t + 2.8, unitLines.lack, { n: { key: `num.${Math.min(150, need - parts.length)}` } });
      t += 4.4;
    } else if (units && grade >= 3) {
      // By twos ("hai, bốn, sáu"), or by fives for more than twelve, and the rest one by one.
      const g = parts.length > 12 ? 5 : 2;
      let at = t + 1;
      let n = 0;
      while (n < parts.length) {
        const k = parts.length - n >= g ? g : 1;
        const group = parts.slice(n, n + k);
        n += k;
        group.forEach((e) => s.mark(at, e.position, COUNT_PACE + 0.3));
        s.point(at, group.at(-1).position, COUNT_PACE);
        if (n <= 150) s.say(at + 0.1, `num.${n}`);
        at += COUNT_PACE;
      }
      t = at;
    } else if (fam.reader === 'sum' && parts.length) {
      parts.forEach((e, i) => {
        total += e.item.size ?? 1;
        const at = t + 1 + i * COUNT_PACE;
        s.point(at, e.position, COUNT_PACE);
        s.mark(at, e.position, COUNT_PACE + 0.3);
        if (total <= 30) s.say(at + 0.1, `num.${total}`);
      });
      t += 1 + parts.length * COUNT_PACE;
    } else if (fam.reader === 'each' && parts.length && task.place.zone.kinds) {
      // The basket of the healer (#61): after a wrong give the bunches lie in a row for each kind in
      // front of the basket. She counts each row aloud from one, with a point at each bunch, and a
      // short row has the mark at its empty end.
      const kinds = task.place.zone.kinds;
      // The number of the task that the child plays now (#79: a wave after a right count of four of
      // each used two of each, the number of grade 1, and took the right bunches out).
      const each = task.place.zone.each ?? Math.round((info.target ?? kinds.length * 2) / kinds.length);
      // The number of each kind (#101: from grade 3 the kinds have their own numbers).
      const needOf = (k) => (task.place.zone.need && typeof task.place.zone.need === 'object' ? task.place.zone.need[k] : each);
      let at = t + 1;
      const lines = defOf(task.key)?.lines ?? {};
      const none = task.byNghe ? null : lines.none;
      const counts = kinds.map((k) => parts.filter((e) => e.item.kind === `herb-${k}`).length);
      // From grade 3 the count is by groups (#101): by doses at grade 3, and the total of each kind
      // and then the whole from grade 4. No count by ones over ten.
      const level = task.tz?.zone.level ?? 0;
      const plan = task.tz?.zone.plan ?? null;
      const byGroups = level === 2;
      const byTotals = level >= 3;
      kinds.forEach((k, row) => {
        const bunches = parts.filter((e) => e.item.kind === `herb-${k}`);
        // Each row starts with its name (#74: "một, hai, ba, một, hai", and the child guessed which
        // kind was which).
        if (bunches.length && lines.row) {
          s.say(at + 0.1, `${lines.row}.${k}`);
          at += ROW_NAME;
        }
        // An empty row has a word too (#70: the third kind had no bunch, and nobody said it).
        if (!bunches.length && none) s.say(at + 0.1, `${none}.${k}`);
        if (byGroups && plan?.recipe && bunches.length) {
          // Grade 3 (#101): the count by doses. At the last bunch of each dose: "một thang".
          const g = plan.recipe[k];
          bunches.forEach((e, i) => {
            s.mark(at, e.position, COUNT_PACE + 0.3);
            if ((i + 1) % g === 0) {
              s.point(at, e.position, COUNT_PACE);
              const d = (i + 1) / g;
              s.say(at + 0.1, d === 1 ? 'count.dose.one' : 'count.dose', { n: { key: `num.${d}` } });
              at += COUNT_PACE;
            } else at += COUNT_PACE * 0.4;
          });
        } else if (byTotals && bunches.length) {
          // Grade 4 and 5 (#101): the total of each row, then the whole basket at the end.
          bunches.forEach((e) => s.mark(at, e.position, 1.6));
          s.point(at, bunches[bunches.length - 1].position, 1.4);
          s.say(at + 0.1, bunches.length === 1 ? 'count.bunches.one' : 'count.bunches', { n: { key: `num.${Math.min(150, bunches.length)}` } });
          at += 1.8;
        } else {
          bunches.forEach((e, i) => {
            s.point(at, e.position, COUNT_PACE);
            s.mark(at, e.position, COUNT_PACE + 0.3);
            if (i < 30) s.say(at + 0.1, `num.${i + 1}`);
            at += COUNT_PACE;
          });
        }
        if (bunches.length < needOf(k)) {
          const end = basketRowAt(task.place.zone, row, bunches.length);
          s.point(at, end, COUNT_PACE);
          s.mark(at, end, COUNT_PACE + 1);
          at += COUNT_PACE;
        }
        // The extra bunches of the row go back to their bed, and the person says it (#74).
        if (bunches.length > needOf(k)) {
          if (!task.byNghe && lines.extra) s.say(at + 0.1, `${lines.extra}.${k}`, { n: { key: `num.${bunches.length - needOf(k)}` } });
          at += EXTRA_LINE;
        }
        at += 0.4;
      });
      if (byTotals && parts.length) {
        s.say(at, 'count.whole', { n: { key: `num.${Math.min(150, parts.length)}` } });
        at += 2;
      }
      // The work is right when the extra bunches are back: the person says the count of the work
      // now, and the next press gives the basket (#74).
      const over = (c, i) => c > needOf(kinds[i]);
      if (counts.every((c, i) => c >= needOf(kinds[i])) && counts.some(over) && lines.now) {
        const extras = counts.reduce((a, c, i) => a + Math.max(0, c - needOf(kinds[i])), 0);
        const end = layEnd(parts.length, kinds.length, counts.filter(over).length, extras) + 0.6;
        at = Math.max(at, end);
        // With the same number of each kind, the line says it; else the line of the work now.
        const same = kinds.every((k) => needOf(k) === needOf(kinds[0]));
        s.say(at, same ? lines.now : lines.nowEach ?? lines.now, { n: { key: `num.${needOf(kinds[0])}` } }, { ready: task.key });
        at += 2.5;
        // The next step in words, and the big button glows with the give (#89: after the count the
        // healer waited, and the child did not know that a press gives the basket).
        if (lines.next) {
          s.say(at, lines.next, {}, { ready: task.key });
          at += 2.5;
        }
      }
      return at + 1;
    } else t += 1;
    const target = info.target ?? null;
    let end = task.at;
    if (task.key === 'bridge') end = { x: task.place.zone.lane, z: task.place.zone.from + Math.min(total, task.place.zone.gap) + 0.5 };
    else if (target !== null && total > target && parts.length) end = parts[parts.length - 1].position;
    s.point(t, end, 2);
    s.mark(t, end, 4);
    // After the count, the person says what happens next, in words that a child knows (#69): the
    // extra things go back to the pile, or the place still has empty places (they glow). Never the
    // target as a count.
    const lines = task.byNghe ? {} : defOf(task.key)?.lines ?? {};
    if (task.place?.zone.rule === 'bundle' && target !== null && total !== target) {
      if (total > target && lines.extra) s.say(t + 0.3, lines.extra, { n: { key: `num.${total - target}` } });
      // The extra rods are back on the heap: the work is right, and the person says the count of
      // the work now (#74: the demonstration came, and the child took its words for her bundle).
      const now = defOf(task.key)?.lines?.now;
      if (total > target && now) {
        const at = Math.max(t + 3, springEnd(total, total - target) + 0.6);
        s.say(at, now, { n: { key: `num.${target}` } }, { ready: task.key });
        return at + 2.5;
      }
      if (total < target && lines.room) {
        s.say(t + 0.3, lines.room);
        for (let i = total; i < target; i++) {
          const p = matSlot(task.place.zone, i);
          s.steps.push({ at: t, spawn: { look: 'place-glow', x: p.x, z: p.z } });
        }
      }
      return t + 3.5;
    }
    return t + 2;
  }

  // The count of a try on the bridge (#71: the count "ba, tám, mười ba" went plank by plank, and no
  // child knew why): the person counts the units of the planks one by one from the near end,
  // "một, hai, ba, bốn", and the mark of each unit lights up at its word. The count stops at the far
  // bank: the part of a plank that is too long glows there, and the fisher says so (the place
  // system). A short try ends with a point at the empty part of the gap. The world keeps the planks
  // of the try for the time of the count (countTime in src/core/world/zones.js).
  // The planks of the last count of each gap (its round): a later count of the same gap counts on
  // from the planks that stayed (#90: after each plank that was too long, the fisher counted every
  // unit from "một" to "mười hai" again, about 10 seconds, and the children waited).
  const counted = new Map();
  function unitSteps(task, parts, s, t) {
    const z = task.place.zone;
    const long = parts.reduce((a, e) => a + (e.item.size ?? 0), 0) > z.gap;
    // After a plank that is too long, the line of the fisher comes from the world at once.
    if (!long) s.say(t, lineOf(task.key, 'mark'));
    const key = `${task.place.id}:${z.round ?? 0}`;
    const last = counted.get(key) ?? [];
    counted.set(key, parts.map((e) => e.id));
    let stay = 0;
    while (stay < parts.length && parts[stay].id === last[stay]) stay += 1;
    // The planks that stayed: their units glow at once, and the count starts with the last of
    // them ("… mười một, mười hai"). The plank after them is never one that stayed.
    stay = Math.min(stay, parts.length - 1);
    let u = 0;
    let from = 0;
    for (const e of parts.slice(0, stay)) {
      const top = e.position.y + 0.8 + 0.02;
      for (let i = 0; i < (e.item.size ?? 1) && u < z.gap; i++) {
        u += 1;
        s.steps.push({ at: t, spawn: { look: 'unit-glow', x: z.lane, z: z.from + u - 0.5, y: top } });
      }
    }
    if (u > 0) {
      s.point(t + COUNT_LEAD, { x: z.lane, z: z.from + u - 0.5 }, UNIT_PACE);
      if (u <= 30) s.say(t + COUNT_LEAD + 0.05, `num.${u}`);
      from = u - 1;
    }
    for (const e of parts.slice(stay)) {
      if (u >= z.gap) break;
      s.point(t + COUNT_LEAD + (u - from) * UNIT_PACE, { x: z.lane, z: z.from + u + (e.item.size ?? 1) / 2 }, (e.item.size ?? 1) * UNIT_PACE);
      // The top of the plank: a plank on the gap has its top at the deck, and one that is too long
      // lies on the far bank, higher.
      const top = e.position.y + 0.8 + 0.02;
      for (let i = 0; i < (e.item.size ?? 1) && u < z.gap; i++) {
        u += 1;
        const at = t + COUNT_LEAD + (u - 1 - from) * UNIT_PACE;
        s.steps.push({ at, spawn: { look: 'unit-glow', x: z.lane, z: z.from + u - 0.5, y: top } });
        if (u <= 30) s.say(at + 0.05, `num.${u}`);
      }
    }
    t += COUNT_LEAD + (u - from) * UNIT_PACE;
    const end = long ? { x: z.lane, z: z.from + z.gap + 1 } : { x: z.lane, z: z.from + u + 0.5 };
    s.point(t, end, 2);
    s.mark(t, end, 4);
    // A short try: the count ends with what is missing, at the empty part (#130: the count of the
    // deck did not say how much more the next plank must cover).
    if (!long && u < z.gap) {
      const miss = z.gap - u;
      s.say(t + 0.2, miss === 1 ? 'mentor.bridge.missing.one' : 'mentor.bridge.missing', { n: { key: `num.${Math.min(30, miss)}` } });
      t += 1.8;
    }
    if (long) {
      // After the count of a plank that is too long: the next step, and the planks of the pile that
      // fit the rest of the gap glow until the next pick (#85: the child took the same long plank
      // five times, and nothing said what to do next; #90: the planks shorter than the long one
      // glowed, but none of them fitted a rest of 1 or 2). When no plank fits the rest, the person
      // says so, and the last plank that stays glows: the big button takes it back.
      const rest = z.gap - parts.slice(0, -1).reduce((a, e) => a + (e.item.size ?? 0), 0);
      const fit = task.piles.flatMap(itemsOf).filter((e) => !e.item.held && (e.item.size ?? 1) <= rest).map((e) => e.id);
      const stay = parts.at(-2);
      if (!fit.length && stay) {
        s.say(t + 2, lineOf(task.key, 'stuck'));
        s.steps.push({ at: t + 2, glow: { ids: [stay.id] } });
      } else {
        s.say(t + 2, lineOf(task.key, 'shorter'));
        s.steps.push({ at: t + 2, glow: { ids: fit } });
      }
      return t + 4.5;
    }
    return t + 2;
  }

  // A demonstration on another instance, next to the person: the parts of another target, the
  // biggest first and then counting on, at counting pace, each with the running total as a word.
  function demoSteps(task, def, info, s, t) {
    const d = def.demo;
    if (!d) {
      s.say(t, lineOf(task.key, 'mark'));
      return { t: t + 2 };
    }
    // The row of the fisher (#88): his gap on a short row of four stakes next to the child, with no
    // count.
    // The halving of the woodcutter (#91): a short stem next to the child, a mark in the middle,
    // and he counts the rings of each half.
    if (d.thing === 'stem') {
      const len = d.length ?? 6;
      const half = len / 2;
      // Beside the hero, toward the camera, across the view, so that the body of the hero never
      // covers it (#118: the short stem lay at the feet of the hero).
      const lay = stemBeside(task, len);
      const { spot, u } = lay;
      const f = Math.atan2(u.x, u.z);
      const along = (k) => ({ x: spot.x + u.x * k, z: spot.z + u.z * k });
      s.say(t, lineOf(task.key, 'demo'));
      s.steps.push({ at: t + 1, spawn: { look: `stem-${len}`, x: spot.x, z: spot.z, facing: f } });
      s.point(t + 2, along(half), 1.2);
      s.steps.push({ at: t + 2.2, spawn: { look: 'chalk-band', ...along(half), facing: f + Math.PI / 2 } });
      let at = t + 3.4;
      for (let k = 0; k < 2; k++) {
        for (let j = 1; j <= half; j++) {
          const p = along(k * half + j - 0.5);
          s.point(at, p, UNIT_PACE);
          s.steps.push({ at, spawn: { look: 'ring-glow', x: p.x, z: p.z, facing: f } });
          s.say(at + 0.05, `num.${j}`);
          at += UNIT_PACE;
        }
        at += 0.6;
      }
      s.say(at, lineOf(task.key, 'demoDone'), { n: { key: `num.${half}` } });
      return { t: at + 3, keyAt: t + 2.2 };
    }
    if (d.thing === 'stake') {
      const space = task.place?.zone.space ?? 4;
      const spot = demoSpot(task);
      s.say(t, lineOf(task.key, 'fit'));
      for (let k = 0; k < 4; k++) {
        const at = t + 1 + k * 1.3;
        const pos = { x: spot.x - 1.5 * space + k * space, z: spot.z };
        s.point(at, pos, 1.2);
        s.steps.push({ at, spawn: { look: 'stake', x: pos.x, z: pos.z, facing: 0 } });
        // Each gap of the short row glows, as wide as the gap of the fisher.
        if (k > 0) s.steps.push({ at: at + 0.3, spawn: { look: `over-${space}`, x: pos.x - space, z: pos.z, facing: Math.PI / 2 } });
      }
      const last = t + 1 + 4 * 1.3;
      return { t: last + 2.5, keyAt: t + 1 + 2 * 1.3 };
    }
    const sizes = sizesOf(task);
    const target = info.target ?? task.place?.zone.need ?? task.place?.zone.gap ?? 10;
    const other = d.same ? target : demoTarget(target, sizes.length ? sizes : [1]);
    const parts = demoParts(other, sizes.length ? sizes : [1]);
    // The planks of a demonstration lie across a small gap of their own length between two stones
    // (#90: the planks lay on bare ground, and "vừa khít" fitted nothing that the child saw).
    const spot = demoSpot(task, d.thing === 'plank' ? other : 0);
    s.say(t, lineOf(task.key, 'demo'));
    t += 1.2;
    if (d.prop) s.steps.push({ at: t, spawn: { look: d.prop, x: spot.x - 3, z: spot.z, facing: Math.PI / 2 } });
    if (d.target) s.steps.push({ at: t, spawn: { look: d.target === 'gap' ? `demo-gap-${other}` : d.target, x: spot.x, z: spot.z } });
    let along = 0;
    parts.forEach((p, k) => {
      const at = t + 0.8 + k * 1.3;
      const pos = d.thing === 'plank' ? { x: spot.x, z: spot.z + along } : { x: spot.x - 1 + (k % 4) * 0.9, z: spot.z - 0.8 + Math.floor(k / 4) * 0.9 };
      along += p.size;
      s.point(at, spot, 1.3);
      const look = d.thing === 'rod' ? 'rod' : `${d.thing}-${p.size}`;
      s.steps.push({ at, spawn: { look, x: pos.x, z: pos.z, facing: d.thing === 'plank' ? 0 : 0 } });
      if (p.total <= 30) s.say(at + 0.1, `num.${p.total}`);
    });
    const last = t + 0.8 + parts.length * 1.3;
    s.say(last, (!task.byNghe && def.lines?.demoDone) || 'mentor.demo.done', { n: { key: `num.${Math.min(150, other)}` } });
    return { t: last + 3.5, keyAt: t + 0.8 + Math.ceil(parts.length / 2) * 1.3 };
  }

  // A demonstration of a form of the teacher on another instance (#107), at a free place next to
  // the child. The share: he deals a few rods onto small mats, one to each in turn, and puts the
  // rest in a small box ("một, hai, ba … thừa một"); small (a smaller task): fewer rods and mats.
  // The big bundle: ten bundles, counted, and then one big bundle.
  function formDemoSteps(task, form, info, s, t) {
    const spot = demoSpot(task, 4);
    if (form === 'share') {
      const n = info.small ? 5 : 7;
      const k = info.small ? 2 : 3;
      const each = Math.floor(n / k);
      const rest = n - each * k;
      s.say(t, lineOf(task.key, 'demo'), { n: { key: `num.${n}` }, k: { key: `num.${k}` } });
      t += 1.4;
      const mats = Array.from({ length: k }, (_, i) => ({ x: spot.x + (i - (k - 1) / 2) * 2.6, z: spot.z }));
      mats.forEach((p, i) => s.steps.push({ at: t, spawn: { look: `share-mat-${['red', 'blue', 'yellow'][i]}`, x: p.x, z: p.z, facing: 0 } }));
      const box = { x: spot.x, z: spot.z + 2.8 };
      s.steps.push({ at: t, spawn: { look: 'rod-box', x: box.x, z: box.z, facing: 0 } });
      t += 0.6;
      for (let i = 0; i < each * k; i++) {
        const p = mats[i % k];
        const at = { x: p.x - 0.6 + Math.floor(i / k) * 0.4, z: p.z };
        s.point(t, at, 0.9);
        s.steps.push({ at: t, spawn: { look: 'rod', x: at.x, z: at.z, facing: 0 } });
        s.say(t + 0.05, `num.${(i % k) + 1}`);
        t += 0.9;
      }
      for (let i = 0; i < rest; i++) {
        s.point(t, box, 0.9);
        s.steps.push({ at: t, spawn: { look: 'rod', x: box.x - 0.3 + i * 0.3, z: box.z, facing: 0 } });
        t += 0.9;
      }
      s.say(t, lineOf(task.key, 'demoDone'), { e: { key: `num.${each}` }, r: { key: `num.${rest}` } });
      return { t: t + 3, keyAt: t };
    }
    s.say(t, lineOf(task.key, 'demo'));
    t += 1.4;
    for (let i = 0; i < 10; i++) {
      const at = { x: spot.x - 1.8 + (i % 5) * 0.9, z: spot.z + Math.floor(i / 5) * 0.9 };
      s.point(t, at, 0.8);
      s.steps.push({ at: t, spawn: { look: 'rod-bundle', x: at.x, z: at.z, facing: 0 } });
      s.say(t + 0.05, `num.${i + 1}`);
      t += 0.8;
    }
    s.steps.push({ at: t + 0.4, spawn: { look: 'rod-bigbundle', x: spot.x, z: spot.z + 2.6, facing: 0 } });
    s.point(t + 0.4, { x: spot.x, z: spot.z + 2.6 }, 1.4);
    s.say(t + 0.5, lineOf(task.key, 'demoDone'));
    return { t: t + 3.5, keyAt: t + 0.4 };
  }

  // A free place on the ground next to the child, away from the place of the task: a demonstration
  // happens where the child sees it (#85: the fisher showed it 16 blocks from the gap, and the
  // child saw nothing). The view frames it until it ends (workFrame in src/ui/village.js).
  // len: the length of the demonstration along +z (half blocks): all of it must be free land.
  // The place of the short stem of a demonstration (#118): toward the camera from the hero, lying
  // across the view (u: the way along the stem), on free ground; else the place of demoSpot,
  // along +z.
  const STEM_OUT = 3; // half blocks from the hero toward the camera
  function stemBeside(task, len) {
    const e = env();
    const h = getEntity(world(), 'hero')?.position;
    const az = e?.view?.();
    const free = (x, z) => {
      const cx = Math.floor(x / 2);
      const cz = Math.floor(z / 2);
      return e?.near && !e.near(cx, cz).isBlocked(cx, cz) && e.groundAt?.(x, z) !== 'water' && e.groundAt?.(x, z) !== 'shallow';
    };
    if (h && Number.isFinite(az)) {
      const c = { x: Math.sin(az), z: Math.cos(az) };
      const u = { x: Math.cos(az), z: -Math.sin(az) };
      for (const out of [STEM_OUT, STEM_OUT + 1.5, STEM_OUT + 3]) {
        const mid = { x: h.x + c.x * out, z: h.z + c.z * out };
        const spot = { x: mid.x - (u.x * len) / 2, z: mid.z - (u.z * len) / 2 };
        let ok = true;
        for (let k = 0; k <= len && ok; k += 1) ok = free(spot.x + u.x * k, spot.z + u.z * k);
        if (ok) return { spot, u };
      }
    }
    return { spot: demoSpot(task, len), u: { x: 0, z: 1 } };
  }
  function demoSpot(task, len = 0) {
    const e = env();
    const free = (x, z) => {
      const cx = Math.floor(x / 2);
      const cz = Math.floor(z / 2);
      return e?.near && !e.near(cx, cz).isBlocked(cx, cz) && e.groundAt?.(x, z) !== 'water' && e.groundAt?.(x, z) !== 'shallow';
    };
    const room = (q) => {
      for (let z = q.z - 2; z <= q.z + len + 2; z += 2) if (!free(q.x, z)) return false;
      return true;
    };
    const p = getEntity(world(), 'hero')?.position ?? task.person?.position ?? task.at;
    const away = { x: p.x - task.at.x, z: p.z - task.at.z };
    const n = Math.hypot(away.x, away.z) || 1;
    const dirs = [[away.x / n, away.z / n], [-away.z / n, away.x / n], [away.z / n, -away.x / n], [1, 0], [0, 1], [-1, 0], [0, -1]];
    for (const r of [8, 7, 6, 5, 4]) {
      for (const [dx, dz] of dirs) {
        const q = { x: Math.round(p.x + dx * r), z: Math.round(p.z + dz * r) };
        if (room(q)) return q;
      }
    }
    return { x: p.x + 3, z: p.z };
  }

  // The person puts some parts into the place for the child: one part (smaller) or about half
  // (share). Never the whole task.
  function shareSteps(task, fam, move, info, s, t) {
    // A line after the puts (the teacher, #69): the person puts the parts one at a time, counts them
    // aloud, and then says how many the person put, and what the child does next.
    const after = task.byNghe ? null : defOf(task.key)?.lines?.[`${move}Put`];
    const free = task.piles.flatMap(itemsOf).filter((e) => !e.item.held && !e.item.set && !e.item.stray);
    let picks = [];
    if (fam.reader === 'each') {
      // The basket: a part of each kind that is short.
      const kinds = task.place?.zone.kinds ?? [];
      // A move with no try just now (a wave, the debug panel): the target of the last try.
      const each = task.place?.zone.each ?? Math.round((info.target ?? tracks.get(task.key)?.target ?? 0) / Math.max(1, kinds.length));
      const need = task.place?.zone.need;
      const counts = Object.fromEntries(kinds.map((k) => [k, itemsOf(task.place).filter((e) => e.item.kind === `herb-${k}`).length]));
      for (const k of kinds) {
        const short = Math.max(0, (need && typeof need === 'object' ? need[k] : each) - counts[k]);
        const n = move === 'smaller' ? Math.min(1, Math.max(0, short - 1)) : Math.floor(short / 2);
        picks.push(...free.filter((e) => e.item.kind === `herb-${k}`).slice(0, n));
        if (move === 'smaller' && n) break;
      }
    } else {
      const target = info.target ?? task.place?.zone.need ?? 10;
      const have = itemsOf(task.place).reduce((a, e) => a + (e.item.size ?? 1), 0);
      const sizes = shareParts(move, target, have, free.map((e) => e.item.size ?? 1));
      const left = [...free];
      for (const size of sizes) {
        const i = left.findIndex((e) => (e.item.size ?? 1) === size);
        if (i >= 0) picks.push(left.splice(i, 1)[0]);
      }
    }
    // A help that puts nothing says nothing (#74: "Bà bỏ giúp cháu mấy bó trước" came, and the
    // basket already had two of each): the count of the work comes in its place.
    if (!picks.length) return null;
    if (after) {
      const target = info.target ?? task.place?.zone.need ?? 10;
      const have = itemsOf(task.place).reduce((a, e) => a + (e.item.size ?? 1), 0);
      const n = picks.length;
      picks.forEach((e, k) => {
        const at = t + k * PUT_PACE;
        s.point(at, task.at, PUT_PACE);
        s.steps.push({ at: at + 0.3, put: { zone: task.place.id, item: e.id, person: task.person?.id ?? 'hero' } });
        s.say(at + 0.4, `num.${k + 1}`);
      });
      t += n * PUT_PACE;
      if (n) s.say(t, after, { n: { key: `num.${n}` }, m: { key: `num.${Math.max(1, target - have - n)}` } });
      return t + 2.5;
    }
    // Every other help puts as the teacher does (#74): the person puts each thing in view, counts it
    // aloud, and says what was put ("Bà bỏ hai bó rau má."), one kind at a time. No "nốt", and no
    // "một nửa".
    const kindLine = fam.reader === 'each' ? defOf(task.key)?.lines?.putKind : null;
    const groups = [];
    for (const e of picks) {
      const last = groups.at(-1);
      if (kindLine && last && last[0].item.kind === e.item.kind) last.push(e);
      else if (!kindLine && last) last.push(e);
      else groups.push([e]);
    }
    for (const g of groups) {
      g.forEach((e, k) => {
        const at = t + k * PUT_PACE;
        s.point(at, task.at, PUT_PACE);
        s.steps.push({ at: at + 0.3, put: { zone: task.place.id, item: e.id, person: task.person?.id ?? 'hero' } });
        s.say(at + 0.4, `num.${k + 1}`);
      });
      t += g.length * PUT_PACE;
      const n = { n: { key: `num.${g.length}` } };
      // Each line of a help says who put the things (#78: "Đặt hai cái rồi." had no subject, and a
      // child heard "you put two"): the line of the person, or of Nghé.
      if (kindLine) s.say(t, `${kindLine}.${String(g[0].item.kind).replace(/^herb-/, '')}`, n);
      else s.say(t, task.byNghe ? 'mentor.nghe.putDone' : defOf(task.key)?.lines?.putDone, n);
      t += 2;
    }
    return t + 0.5;
  }

  // A press or a tap at the work that does nothing is an act of the child (#105: a child pressed
  // three times, and the wave said "Cháu thử trước đã"): a wave after it shows where to stand and
  // what to tap. id: the thing or the place of the tap (else the task near the hero).
  function touched(id = null) {
    const e = id ? getEntity(world(), id) : null;
    const key = e ? keyOf(e.item?.task ?? e.zone?.task ?? null) : activeKey();
    const task = key && defOf(key) ? taskOf(key) : null;
    if (!task) return;
    stateOf(key, task);
    const tr = tracks.get(key);
    if (tr) tr.acted = true;
  }

  return {
    start,
    skill,
    long,
    touched,
    worldEvent,
    checkThing,
    wave,
    taskOfPerson,
    // A move of the mentor of a task now (for example show: the next step on the real things).
    move: (key, move) => doMove(key, move, {}),
    tick,
    activeKey,
    // The person of a task (an entity id), or null.
    personOf: (key) => defOf(key)?.person ?? null,
    // At the end of a task: the line of a bigger task for the next time, when a move raise came in
    // the task (#98), with the id of its person; else null. It is said one time.
    endRaise(key) {
      if (!raises.delete(key)) return null;
      return { textKey: lineOf(key, 'raise'), person: defOf(key)?.person ?? null };
    },
    // The mentor of a task (for the tests and the debug panel).
    stateOf: (key) => states.get(key) ?? null,
    reset() {
      states.clear();
      tracks.clear();
      delayed = [];
      raises.clear();
    },
  };
}
