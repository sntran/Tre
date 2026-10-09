// The mentors in the session: the person who gives a task watches the child and answers (docs/
// MENTOR.md). The session sends the commits, the actions of the hands, the checks, the waves, and
// a tick for each step; this module keeps the state of the mentor of each task (src/core/mentor.js),
// logs each move with its outcome, and turns each move into a script that the mentor system of the
// world plays (src/core/world/systems/mentor.js). No DOM.
import { newMentor, newMemory, onCommit, onIdle, onWave, onCheck, onChange, demoTarget, demoParts, shareParts } from './mentor.js';
import { getEntity, query, addEntity } from './world/state.js';
import { endScript } from './world/systems/mentor.js';
import { basketRowAt } from './world/systems/work.js';
import { atWork } from './world/systems/schedule.js';
import { STEP } from './world/step.js';

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
const COUNT_GAP = 0.6; // seconds between the count of the child's work and the move of the mentor

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// data: the data of the game; profile: the profile (profile.mentors keeps the memory); learner():
// the learner or null; log(kind, fields): the learning log; emit(ev): an event of the session;
// world(): the world state; env(): the facts of the map; raise(key): the task asks for a bigger
// task (a move raise), returns nothing; nameOf(id): the name of a person (a text parameter).
export function createMentoring({ data, profile, learner = () => null, log = () => null, emit = () => {}, world, env, raise = () => {}, nameOf = () => '' }) {
  const cfg = data.mentors;
  const states = new Map(); // key -> the mentor of the task
  const tracks = new Map(); // key -> { startT, firstAct, lastAct, lastCommit, acted, left, round }
  let delayed = []; // moves that wait: { at, key, move, info }
  const firstShown = new Set(); // the tasks whose first step the person showed in this visit
  let lastSkill = null;
  const now = () => (world()?.tick ?? 0) * STEP;
  const defOf = (key) => cfg?.mentors?.[key] ?? null;
  const famOf = (key) => cfg.families[defOf(key).family];
  // The line of a move: the own line of the mentor of the task, else the common line.
  const lineOf = (key, move) => defOf(key)?.lines?.[move] ?? cfg.lines[move];
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

  // The things in a zone (entities).
  const itemsOf = (zoneEnt) => (zoneEnt?.zone.items ?? []).map((id) => getEntity(world(), id)).filter(Boolean);
  // The sizes of the things that the child can choose (on the piles and on the place).
  function sizesOf(task) {
    const all = [...task.piles.flatMap(itemsOf), ...itemsOf(task.place)];
    return [...new Set(all.map((e) => e.item.size ?? 1))].sort((a, b) => a - b);
  }

  // The points of the work of a task (half blocks): its zones, its place, and its person when the
  // person stands at the work. The view turns so that nothing covers them (the event workView, #38).
  function workPoints(key) {
    const task = taskOf(key);
    if (!task) return [];
    const owner = key.startsWith('event-') ? `trial-${key}` : key;
    const pts = [task.at, ...query(world(), 'zone').filter((z) => z.zone.task === owner && z.position).map((z) => z.position)];
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
      emit({ type: 'workView', key, points, sight: person && points.includes(person) ? [person] : [] });
    }
    const st = newMentor(key);
    st.round = round;
    states.set(key, st);
    tracks.set(key, { startT: now(), firstAct: null, lastAct: now(), lastCommit: null, acted: false, left: false });
    delayed = delayed.filter((d) => d.key !== key);
    endScript(world(), getEntity(world(), `script:${key}`));
    // At the start of a task, the person shows the first step one time on the real things.
    // One time in a visit: the rounds of a practice after the first one start with no demonstration.
    if (round === 0 && key.startsWith('trial-') && defOf(key).first !== false && !firstShown.has(key)) {
      firstShown.add(key);
      delayed.push({ at: now() + FIRST_DELAY, key, move: 'first', info: {} });
    }
    return st;
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
    }, fam, cfg);
    if (r.help) log('help', r.help);
    for (const c of r.checks) log('check', { task: key, changed: c.changed });
    Object.assign(tr, { firstAct: null, lastCommit: t, lastAct: t, acted: false, left: false });
    emit({ type: 'mentor', key, diagnosis: r.diagnosis, move: r.move, level: r.level, remembered: r.remembered });
    // The answer of the world to a wrong try comes first, at each help level (#64): the person
    // counts the child's own work on the place (the rods on the mat, each row of the basket) and
    // marks what went wrong. The move of the mentor comes after the count; a mark is the count.
    const count = !input.solved && task ? doMove(key, 'count', { target: input.target, solved: false }) : 0;
    if (count > 0 && r.move === 'mark') return;
    if (r.move !== 'wait') schedule(key, r.move, { remembered: r.remembered, delay: (count > 0 ? count + COUNT_GAP : 0) + (r.delay ?? 0), target: input.target, solved: input.solved });
  }

  function schedule(key, move, info = {}) {
    if (info.delay > 0) delayed.push({ at: now() + info.delay, key, move, info });
    else doMove(key, move, info);
  }

  // A skill event of the world (the first one of a commit: a commit can send two skills).
  function skill(ev) {
    const key = keyOf(ev.task);
    if (!defOf(key)) return;
    const mark = `${ev.id}:${world()?.tick}`;
    if (mark === lastSkill) return;
    lastSkill = mark;
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
    if (!['pick', 'put', 'add', 'back', 'mark', 'drop'].includes(ev.type) || ev.by) return;
    if ((ev.type === 'pick' || ev.type === 'put' || ev.type === 'drop') && ev.id !== 'hero') return;
    const thing = ev.item ? getEntity(world(), ev.item) : null;
    const key = keyOf(thing?.item?.task ?? (ev.zone ? getEntity(world(), `zone:${ev.zone}`)?.zone.task : null) ?? (String(ev.id).startsWith('zone:') ? getEntity(world(), ev.id)?.zone?.task : null));
    if (!defOf(key)) return;
    const task = taskOf(key);
    const st = stateOf(key, task);
    const tr = tracks.get(key);
    const t = now();
    tr.acted = true;
    tr.lastAct = t;
    tr.firstAct ??= t;
    // A self-correction: after a check, the child takes a thing back from the place (#64). A put,
    // or a pick at a heap, is not one.
    const takeBack = ev.type === 'pick' && Boolean(task?.place) && ev.from === task.place.zone.id;
    if (takeBack && onChange(st, memoryOf(key))) emit({ type: 'selfFix', key });
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
    if (getEntity(world(), `script:${key}`)) {
      waves.add(key);
      return { waiting: key };
    }
    return answerWave(key);
  }
  const waves = new Set(); // the tasks with a wave that waits for the end of a script
  function answerWave(key) {
    const task = taskOf(key);
    const st = stateOf(key, task);
    const tr = tracks.get(key);
    const r = onWave(st, memoryOf(key), famOf(key), cfg, null, Boolean(tr?.acted));
    if (tr) tr.lastWave = now();
    log('ask', { task: key, when: r.when, move: r.move });
    emit({ type: 'mentor', key, diagnosis: r.diagnosis, move: r.move, level: st.level, asked: r.when });
    doMove(key, r.move, { asked: true });
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
    if (info.asked && !info.other && move !== 'count' && run?.move === move && run.n >= 2) {
      for (const m of ['show', 'share', 'demo'].filter((x) => x !== move)) {
        const d = doMove(key, m, { ...info, other: true });
        if (d) return d;
      }
    }
    if (move === 'picture') pictured = true;
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
    const say = (at, k, params = {}) => { if (who && k) steps.push({ at, say: { id: who, key: away ? asNghe(k) : k, params } }); };
    const point = (at, p, time = 1.2) => { if (who) steps.push({ at, point: { id: who, x: p.x, z: p.z, time } }); };
    const mark = (at, p, ttl = 3) => steps.push({ at, mark: { x: p.x, z: p.z, ttl } });
    if (info.remembered && cfg.again[move]) {
      say(0, cfg.again[move]);
      t = 2.2;
    }
    let keyAt;
    const needsPlace = ['first', 'show', 'mark', 'count', 'cue', 'demo', 'smaller', 'share'].includes(move);
    if (needsPlace && !task) return 0;
    if (move === 'count') {
      t = countSteps(task, famOf(key), info, { say, point, mark, steps }, t);
    } else if (move === 'first') {
      t = firstSteps(task, def, { say, point, mark, steps }, t);
    } else if (move === 'show' && carrying(key, task)) {
      // The thing of the task is in the hands (the sticks after the right cut): the line is the
      // next step with it, toward its place (#57), not the first step.
      const place = task.place?.position ?? task.at;
      say(t, defOf(key).lines.carry);
      point(t, place, 1.4);
      mark(t, place, 2.5);
      t += 2;
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
    } else if (move === 'demo') {
      const out = demoSteps(task, def, info, { say, point, steps }, t);
      t = out.t;
      keyAt = out.keyAt;
    } else if (move === 'smaller' || move === 'share') {
      t = shareSteps(task, famOf(key), move, info, { say, point, steps }, t);
    } else if (move === 'picture') {
      // The line names the person of another station (pictureWho), by the name of the region. A
      // line that names a place where the child has nothing more to do (the trial there is done:
      // pictureUnless) says only to rest (#57).
      if (def.pictureUnless && profile.flags?.[def.pictureUnless]) say(t, lineOf(key, 'break'));
      else say(t, def.picture, def.pictureWho ? { who: nameOf(def.pictureWho) } : {});
      t += 2;
    } else if (move === 'raise') {
      say(t, lineOf(key, 'raise'));
      const mem = memoryOf(key);
      mem.lift = Math.min(2, (mem.lift ?? 0) + 1);
      raise(key);
      t += 2;
    } else {
      say(t, lineOf(key, move));
      t += 2;
    }
    if (!steps.length) return 0;
    endScript(w, getEntity(w, `script:${key}`));
    steps.push({ at: t + 0.5, end: true });
    steps.sort((a, b) => a.at - b.at);
    addEntity(w, { id: `script:${key}`, script: { key, move, t: 0, i: 0, steps, spawned: [], ...(keyAt !== undefined ? { keyAt } : {}) } });
    if (info.asked) asked.set(whoNow, { move, n: run?.move === move ? run.n + 1 : 1 });
    else asked.delete(whoNow);
    return t + 0.5;
  }

  // The count of the child's own work after a wrong try (#64), the same at each help level: the
  // parts on the place counted aloud with the mark of what went wrong (the mark), or, at a task with
  // no parts to count, the mark of what went wrong only: the widest gap of the row of the fisher.
  function countSteps(task, fam, info, s, t) {
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

  // The first step, one time at the start of a task: the person takes one thing from a heap, puts
  // it into its place, and takes it back to the heap (def.first: [{ from, to }] zone ids; else the
  // first heap and the place of the task). A task with no heap (or def.first []: the smith, who
  // shows the quench on his own piece): the person points at the place and says what to do. A task
  // of exact rounds (def.first 'point'): the person only points, so that each round stays the child's.
  function firstSteps(task, def, s, t) {
    const w = world();
    // def.first 'point': the person only points at the heap and at the place (a task of exact rounds).
    if (def.first === 'point' && task.piles[0] && task.place) {
      s.say(t, lineOf(task.key, 'show'));
      s.point(t, task.piles[0].position, 1.4);
      s.mark(t, task.piles[0].position, 2.5);
      s.point(t + 1.6, task.at, 1.4);
      s.mark(t + 1.6, task.at, 2.5);
      return t + 3;
    }
    const pairs = (task.byNghe ? [] : Array.isArray(def.first) ? def.first : task.piles[0] && task.place ? [{ from: task.piles[0].zone.id, to: task.place.zone.id }] : [])
      .map((p) => ({ heap: getEntity(w, `zone:${p.from}`), place: getEntity(w, `zone:${p.to}`) }))
      .filter((p) => p.heap && p.place);
    s.say(t, lineOf(task.key, 'first'));
    if (!pairs.length) {
      s.point(t, task.at, 2);
      s.mark(t, task.at, 3);
      return t + 2.5;
    }
    t += 0.6;
    for (const { heap, place } of pairs) {
      const thing = itemsOf(heap).find((e) => !e.item.held && !e.item.set && !e.item.stray);
      if (!thing) continue;
      const to = place.zone.rect ? { x: (place.zone.rect.x0 + place.zone.rect.x1) / 2, z: (place.zone.rect.z0 + place.zone.rect.z1) / 2 } : { x: place.zone.x, z: place.zone.z };
      s.point(t, heap.position, 1);
      s.mark(t, heap.position, 1.6);
      s.point(t + 1, to, 1.2);
      s.steps.push({ at: t + 1, put: { zone: place.id, item: thing.id, person: task.person?.id ?? 'hero' } });
      s.mark(t + 1, to, 1.6);
      t += 2.2;
      // The thing goes back to its heap, so that the place is empty when the child starts: the
      // first step never leaves a part of the answer (rule 25).
      s.say(t, 'mentor.first.back');
      s.point(t, heap.position, 1);
      s.steps.push({ at: t + 0.6, back: { item: thing.id } });
      t += 1.6;
    }
    s.say(t, 'mentor.first.you');
    return t + 1.5;
  }

  // Mark what matters: count the parts on the place aloud, one at a time (each with the running
  // total as a word), then mark the empty part or the part too many.
  function markSteps(task, fam, info, s, t) {
    s.say(t, lineOf(task.key, 'mark'));
    const parts = itemsOf(task.place);
    let total = 0;
    if (fam.reader === 'sum' && parts.length) {
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
      const each = Math.round((info.target ?? kinds.length * 2) / kinds.length);
      let at = t + 1;
      kinds.forEach((k, row) => {
        const bunches = parts.filter((e) => e.item.kind === `herb-${k}`);
        bunches.forEach((e, i) => {
          s.point(at, e.position, COUNT_PACE);
          s.mark(at, e.position, COUNT_PACE + 0.3);
          if (i < 30) s.say(at + 0.1, `num.${i + 1}`);
          at += COUNT_PACE;
        });
        if (bunches.length < each) {
          const end = basketRowAt(task.place.zone, row, bunches.length);
          s.point(at, end, COUNT_PACE);
          s.mark(at, end, COUNT_PACE + 1);
          at += COUNT_PACE;
        }
        at += 0.4;
      });
      return at + 1;
    } else t += 1;
    const target = info.target ?? null;
    let end = task.at;
    if (task.key === 'bridge') end = { x: task.place.zone.lane, z: task.place.zone.from + Math.min(total, task.place.zone.gap) + 0.5 };
    else if (target !== null && total > target && parts.length) end = parts[parts.length - 1].position;
    s.point(t, end, 2);
    s.mark(t, end, 4);
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
    const sizes = sizesOf(task);
    const target = info.target ?? task.place?.zone.need ?? task.place?.zone.gap ?? 10;
    const other = d.same ? target : demoTarget(target, sizes.length ? sizes : [1]);
    const parts = demoParts(other, sizes.length ? sizes : [1]);
    const spot = demoSpot(task);
    s.say(t, lineOf(task.key, 'demo'));
    t += 1.2;
    if (d.prop) s.steps.push({ at: t, spawn: { look: d.prop, x: spot.x - 3, z: spot.z, facing: Math.PI / 2 } });
    if (d.target) s.steps.push({ at: t, spawn: { look: d.target, x: spot.x, z: spot.z } });
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
    s.say(last, 'mentor.demo.done');
    return { t: last + 3.5, keyAt: t + 0.8 + Math.ceil(parts.length / 2) * 1.3 };
  }

  // A free place on the ground next to the person, away from the place of the task.
  function demoSpot(task) {
    const e = env();
    const p = task.person?.position ?? task.at;
    const away = { x: p.x - task.at.x, z: p.z - task.at.z };
    const n = Math.hypot(away.x, away.z) || 1;
    const dirs = [[away.x / n, away.z / n], [-away.z / n, away.x / n], [away.z / n, -away.x / n], [1, 0], [0, 1], [-1, 0], [0, -1]];
    for (const r of [8, 7, 6, 5, 4]) {
      for (const [dx, dz] of dirs) {
        const q = { x: Math.round(p.x + dx * r), z: Math.round(p.z + dz * r) };
        const cx = Math.floor(q.x / 2);
        const cz = Math.floor(q.z / 2);
        if (e?.near && !e.near(cx, cz).isBlocked(cx, cz) && e.groundAt?.(q.x, q.z) !== 'water' && e.groundAt?.(q.x, q.z) !== 'shallow') return q;
      }
    }
    return { x: p.x + 3, z: p.z };
  }

  // The person puts some parts into the place for the child: one part (smaller) or about half
  // (share). Never the whole task.
  function shareSteps(task, fam, move, info, s, t) {
    s.say(t, lineOf(task.key, move));
    t += 1.2;
    const free = task.piles.flatMap(itemsOf).filter((e) => !e.item.held && !e.item.set && !e.item.stray);
    let picks = [];
    if (fam.reader === 'each') {
      // The basket: a part of each kind that is short.
      const kinds = task.place?.zone.kinds ?? [];
      const each = Math.round((info.target ?? 0) / Math.max(1, kinds.length));
      const counts = Object.fromEntries(kinds.map((k) => [k, itemsOf(task.place).filter((e) => e.item.kind === `herb-${k}`).length]));
      for (const k of kinds) {
        const short = Math.max(0, each - counts[k]);
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
    picks.forEach((e, k) => {
      const at = t + k * 0.8;
      s.point(at, task.at, 0.8);
      s.steps.push({ at: at + 0.3, put: { zone: task.place.id, item: e.id, person: task.person?.id ?? 'hero' } });
    });
    return t + picks.length * 0.8 + 0.5;
  }

  return {
    start,
    skill,
    long,
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
    // The mentor of a task (for the tests and the debug panel).
    stateOf: (key) => states.get(key) ?? null,
    reset() {
      states.clear();
      tracks.clear();
      delayed = [];
    },
  };
}
