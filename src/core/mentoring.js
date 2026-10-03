// The mentors in the session: the person who gives a task watches the child and answers (docs/
// MENTOR.md). The session sends the commits, the actions of the hands, the checks, the waves, and
// a tick for each step; this module keeps the state of the mentor of each task (src/core/mentor.js),
// logs each move with its outcome, and turns each move into a script that the mentor system of the
// world plays (src/core/world/systems/mentor.js). No DOM.
import { newMentor, newMemory, onCommit, onIdle, onWave, onCheck, onChange, demoTarget, demoParts, shareParts } from './mentor.js';
import { getEntity, query, addEntity } from './world/state.js';
import { endScript } from './world/systems/mentor.js';
import { STEP } from './world/step.js';

// The zones where the parts of a try go, in the order of the search.
const PLACES = ['exact', 'bundle', 'basket', 'line', 'forge', 'woodpile'];
const NEAR = 28; // half blocks: the hero is at the station when nearer than this to its place
const LEAVE = 40; // half blocks: farther than this soon after a miss, the hero left the station
const LEAVE_TIME = 15; // seconds after a miss
const COUNT_PACE = 0.9; // seconds between two counted parts (counting pace)

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// data: the data of the game; profile: the profile (profile.mentors keeps the memory); learner():
// the learner or null; log(kind, fields): the learning log; emit(ev): an event of the session;
// world(): the world state; env(): the facts of the map; raise(key): the task asks for a bigger
// task (a move raise), returns nothing.
export function createMentoring({ data, profile, learner = () => null, log = () => null, emit = () => {}, world, env, raise = () => {} }) {
  const cfg = data.mentors;
  const states = new Map(); // key -> the mentor of the task
  const tracks = new Map(); // key -> { startT, firstAct, lastAct, lastCommit, acted, left, round }
  let delayed = []; // moves that wait: { at, key, move, info }
  let lastSkill = null;
  const now = () => (world()?.tick ?? 0) * STEP;
  const defOf = (key) => cfg?.mentors?.[key] ?? null;
  const famOf = (key) => cfg.families[defOf(key).family];
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
    const at = place?.zone.rect ? { x: (place.zone.rect.x0 + place.zone.rect.x1) / 2, z: (place.zone.rect.z0 + place.zone.rect.z1) / 2 } : { x: p.x, z: p.z };
    return { key, tz, place, piles, person, at, done: false, round: 0 };
  }

  // The things in a zone (entities).
  const itemsOf = (zoneEnt) => (zoneEnt?.zone.items ?? []).map((id) => getEntity(world(), id)).filter(Boolean);
  // The sizes of the things that the child can choose (on the piles and on the place).
  function sizesOf(task) {
    const all = [...task.piles.flatMap(itemsOf), ...itemsOf(task.place)];
    return [...new Set(all.map((e) => e.item.size ?? 1))].sort((a, b) => a - b);
  }

  // A mentor starts again for a task (a new trial, a new event, a new round of the bridge).
  function start(key, round = 0) {
    if (!defOf(key)) return null;
    const st = newMentor(key);
    st.round = round;
    states.set(key, st);
    tracks.set(key, { startT: now(), firstAct: null, lastAct: now(), lastCommit: null, acted: false, left: false });
    delayed = delayed.filter((d) => d.key !== key);
    endScript(world(), getEntity(world(), `script:${key}`));
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
    if (r.move !== 'wait') schedule(key, r.move, { remembered: r.remembered, delay: r.delay, target: input.target, solved: input.solved });
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
    // A change of the try: a part put into the place, or taken back from it.
    const change = ev.type === 'put' || ev.type === 'add' || ev.type === 'back' || ev.type === 'mark' || (ev.type === 'pick' && thing && task?.place && thing.item.zone === null && st.checked);
    if (change && onChange(st, memoryOf(key))) emit({ type: 'selfFix', key });
  }

  // A tap on the ground with empty hands: a check when it is at the place of a task (the child
  // walks to it and looks). A mark that waits for the child to look first does not come.
  function checkAt(x, z) {
    for (const key of states.keys()) {
      const task = taskOf(key);
      if (!task) continue;
      const r = task.place?.zone.rect;
      const inside = r ? x >= r.x0 - 1 && x <= r.x1 + 1 && z >= r.z0 - 1 && z <= r.z1 + 1 : dist({ x, z }, task.at) < 6;
      if (!inside) continue;
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

  // A wave: the child calls the person of the task. A demonstration that showed its key part ends.
  function wave() {
    for (const s of query(world(), 'script')) {
      if (s.script.keyAt !== undefined && s.script.t >= s.script.keyAt) {
        endScript(world(), s);
        return { skipped: s.script.key };
      }
    }
    const key = activeKey();
    if (!key) return null;
    const task = taskOf(key);
    const st = stateOf(key, task);
    const r = onWave(st, memoryOf(key), famOf(key), cfg, null);
    log('ask', { task: key, when: r.when, move: r.move });
    emit({ type: 'mentor', key, diagnosis: r.diagnosis, move: r.move, level: st.level, asked: r.when });
    if (r.move !== 'wait') doMove(key, r.move, {});
    return r;
  }

  // One step: the moves that waited, the idle time (a child who does not know what to do, and a
  // stuck child who does not ask), and a hero who leaves the station soon after a miss.
  function tick() {
    const t = now();
    const due = delayed.filter((d) => d.at <= t);
    delayed = delayed.filter((d) => d.at > t);
    for (const d of due) doMove(d.key, d.move, d.info);
    const hero = getEntity(world(), 'hero');
    if (!hero) return;
    for (const [key, st] of states) {
      const task = taskOf(key);
      if (!task) continue;
      const tr = tracks.get(key);
      const d = dist(hero.position, task.at);
      if (st.lastSolved === false && tr.lastCommit !== null && t - tr.lastCommit < LEAVE_TIME && d > LEAVE) tr.left = true;
      if (d > NEAR || world().paused) continue;
      const seconds = t - Math.max(tr.lastAct, tr.lastCommit ?? tr.startT);
      const r = onIdle(st, { seconds, acted: tr.acted || st.tried }, famOf(key));
      if (!r) continue;
      st.pending = { diagnosis: r.diagnosis ?? 'unsure', move: r.move, pBefore: null };
      emit({ type: 'mentor', key, diagnosis: r.diagnosis, move: r.move, level: st.level, idle: true });
      doMove(key, r.move, {});
    }
  }

  // A move in the world: a script of the person (src/core/world/systems/mentor.js).
  function doMove(key, move, info = {}) {
    const w = world();
    const def = defOf(key);
    const task = taskOf(key);
    if (!w || !def) return;
    const person = task?.person ?? getEntity(w, def.person);
    const who = person?.id ?? null;
    const steps = [];
    let t = 0;
    const say = (at, k, params = {}) => { if (who && k) steps.push({ at, say: { id: who, key: k, params } }); };
    const point = (at, p, time = 1.2) => { if (who) steps.push({ at, point: { id: who, x: p.x, z: p.z, time } }); };
    const mark = (at, p, ttl = 3) => steps.push({ at, mark: { x: p.x, z: p.z, ttl } });
    if (info.remembered && cfg.again[move]) {
      say(0, cfg.again[move]);
      t = 2.2;
    }
    let keyAt;
    const needsPlace = ['show', 'mark', 'cue', 'demo', 'smaller', 'share'].includes(move);
    if (needsPlace && !task) return;
    if (move === 'show') {
      const pile = task.piles[0]?.position ?? task.at;
      say(t, cfg.lines.show);
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
      say(t, def.picture);
      t += 2;
    } else if (move === 'raise') {
      say(t, cfg.lines.raise);
      const mem = memoryOf(key);
      mem.lift = Math.min(2, (mem.lift ?? 0) + 1);
      raise(key);
      t += 2;
    } else {
      say(t, cfg.lines[move]);
      t += 2;
    }
    if (!steps.length) return;
    endScript(w, getEntity(w, `script:${key}`));
    steps.push({ at: t + 0.5, end: true });
    steps.sort((a, b) => a.at - b.at);
    addEntity(w, { id: `script:${key}`, script: { key, move, t: 0, i: 0, steps, spawned: [], ...(keyAt !== undefined ? { keyAt } : {}) } });
  }

  // Mark what matters: count the parts on the place aloud, one at a time (each with the running
  // total as a word), then mark the empty part or the part too many.
  function markSteps(task, fam, info, s, t) {
    s.say(t, cfg.lines.mark);
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
      s.say(t, cfg.lines.mark);
      return { t: t + 2 };
    }
    const sizes = sizesOf(task);
    const target = info.target ?? task.place?.zone.need ?? task.place?.zone.gap ?? 10;
    const other = d.same ? target : demoTarget(target, sizes.length ? sizes : [1]);
    const parts = demoParts(other, sizes.length ? sizes : [1]);
    const spot = demoSpot(task);
    s.say(t, cfg.lines.demo);
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
    for (const r of [5, 4, 6, 3]) {
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
    s.say(t, cfg.lines[move]);
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
    checkAt,
    wave,
    tick,
    activeKey,
    // The mentor of a task (for the tests and the debug panel).
    stateOf: (key) => states.get(key) ?? null,
    reset() {
      states.clear();
      tracks.clear();
      delayed = [];
    },
  };
}
