// The activities of Xóm Ruộng after the planting in the session (docs/HAMLET.md): feeding the
// ducks, the fish traps, and the drum dance. For each activity: its sets and rounds, the lines of
// its person, the one memory of the facts (src/core/planting.js), the small events of a set, and
// the natural end of a set. No DOM, no WebGL. The rules are in src/core/hamlet.js; the world part
// is in src/core/world/systems/hamlet.js.
import { getEntity, addEntity, removeEntity } from './world/state.js';
import { recordFact, factPool, chooseForm } from './planting.js';
import { nextTask, duckTask, trapTask, trapPool, drumTask, activityRng, hamletEvent, newTable, feedDucks, dawnTable, feastNow, serveFeast, pointTo } from './hamlet.js';
import { setupDucks, setupTraps, setupDrum, clearActivity, tzOf, ACTIVITIES } from './world/systems/hamlet.js';

const NEXT = 2.5; // seconds from the end of a commit to the next round
const DAY = 1440;
const TASKS = { ducks: duckTask, traps: trapTask, drum: drumTask };
const WATER_UP = 1; // half blocks: the surface of the stream over its bed (WATER.river in src/world/terrain.js)

// deps: { data, profile, world (fn), env (fn), learner (fn), seed (fn), clock (fn: the minutes of
// the game clock), rain (fn: the rain now, 0 to 1), say (key, params, mark, speaker), talk
// (dialogue id), callout (key, params, speaker: a line in a bubble), emit, save (reason),
// mentoring, busy (fn), setDone (fn (act, why): the set ends,
// for a practice; true when the practice takes the end) }.
export function createHamlet(deps) {
  const { data, profile } = deps;
  const def = data.hamlet;
  const memDef = data.planting; // the boxes of the memory of the facts, and the plots to a missed fact
  const skillOf = (id) => data.skills?.skills?.find((s) => s.id === id) ?? null;
  const waits = {}; // activity -> seconds to the next round
  const decor = {}; // activity -> the things of the small event of the round
  let feast = null; // the feast that goes on: { until (minute of the clock), beat (seconds), k }

  const root = () => (profile.hamlet ??= { acts: {} });
  const table = () => (root().table ??= newTable());
  const state = (act) => (root().acts[act] ??= { sets: 0, set: 0, index: 0, prev: null, used: [], done: [], counts: {}, lastEvent: null, event: null, active: false, start: 0, ...(act === 'drum' ? { period: def.drum.period } : {}) });
  const today = () => Math.floor(deps.clock() / DAY);
  const hour = () => (deps.clock() % DAY) / 60;
  const personOf = (act) => def.stations[act];
  const place = (name) => deps.env().places[name] ?? null;
  const groundAt = (p) => deps.env().groundY(p.x / 2, p.z / 2);

  function newSet(act) {
    const s = state(act);
    s.set += 1;
    s.index = 0;
    s.prev = null;
    s.used = [];
    s.done = [];
    const kind = hamletEvent(deps.seed(), act, s.set, s.lastEvent, def);
    // The event comes in one round of the set, never the first.
    s.event = kind ? { kind, at: 1 + (s.set % Math.max(1, def[act].set - 1)) } : null;
    s.lastEvent = kind;
    s.active = true;
    s.start = deps.clock();
  }

  // The level of the activity: the level of the learner in math.mul.10, in the levels of the
  // activity.
  function levelOf(act) {
    const mul = skillOf(memDef.skill);
    const l = deps.learner();
    return Math.max(1, Math.min(def[act].levels.length, mul?.levels.length ?? 1, l?.levelFor(memDef.skill) ?? 1));
  }

  // The task of the next round of an activity.
  function taskOf(act) {
    const s = state(act);
    const mul = skillOf(memDef.skill);
    const level = levelOf(act);
    const range = mul.levels[Math.min(level, mul.levels.length) - 1];
    const forms = def[act].levels[level - 1].forms;
    const mem = ((profile.facts ??= {})[memDef.skill] ??= {});
    const rng = activityRng(deps.seed(), act, `${s.set}:${s.index}`);
    // The traps of one size show only the facts with a friendly size (two, five, or ten).
    const form = s.index === 0 ? forms[0] : chooseForm({ forms, used: s.used, counts: s.counts }, rng);
    const pool = act === 'traps' && form === 'one' ? trapPool(factPool(range), def.traps.sizes) : factPool(range);
    const { key } = nextTask({ range, pool, forms, form, mem, day: today(), index: s.index, round: profile.factRound ?? 0, prev: s.prev, used: s.used, counts: s.counts, not: s.done }, rng);
    return { level, key, task: TASKS[act]({ key, form, data: def[act], rng }) };
  }

  // The places of an activity in the world (half blocks).
  function round(act) {
    const s = state(act);
    const { level, key, task } = taskOf(act);
    const at = (name, dx = 0, dz = 0) => {
      const p = place(name);
      if (!p) return null;
      const q = { x: p.x + dx, z: p.z + dz };
      return { ...q, y: groundAt(q) };
    };
    if (act === 'ducks') {
      const trough = at('duck-trough');
      const jar = at('duck-jar');
      if (!trough || !jar) return;
      setupDucks(deps.world(), { index: s.index, level, skill: memDef.skill, key, task, rate: def.ducks.rate, trough, jar });
    } else if (act === 'traps') {
      const first = at('trap-spots');
      const pile = at('trap-pile');
      const weir = at('weir');
      if (!first || !pile || !weir) return;
      const spots = Array.from({ length: def.traps.spots }, (_, k) => ({ x: first.x, z: first.z + k * def.traps.step }));
      // The traps float at the surface of the stream (the water stands over the bed).
      setupTraps(deps.world(), { index: s.index, level, key, task, pile, spots, y: first.y + WATER_UP, weir: { ...weir, y: weir.y + WATER_UP } });
    } else {
      const drums = [at('drum-bronze'), at('drum-bronze-2')].filter(Boolean);
      const line = at('dancers');
      if (!drums.length || !line) return;
      setupDrum(deps.world(), { index: s.index, level, skill: memDef.skill, key, task, period: s.period ?? def.drum.period, beat: { window: def.drum.window, slower: def.drum.slower, faster: def.drum.faster, fastest: def.drum.fastest }, drums, line, looks: def.drum.looks });
    }
    deps.mentoring?.start(`trial-${act}`, s.index);
    // The person says the task of the round in a bubble: the share of a duck, the fish of the feast,
    // or the dancers of the group.
    const word = (n) => ({ key: `num.${Math.max(1, Math.min(150, n))}` });
    if (act === 'ducks') deps.callout(`ducks.show.${task.form}`, { n: word(task.show) }, personOf(act));
    else if (act === 'traps') deps.callout(task.form === 'given' ? 'traps.need.given' : 'traps.need', { n: word(task.need), c: word(task.count ?? 1) }, personOf(act));
    else deps.callout(`drum.show.${task.form}`, { n: word(task.groups[0]), m: word(task.form === 'two' ? task.groups[1] : task.targets[0]) }, personOf(act));
    eventOfRound(act);
    deps.emit({ type: 'hud' });
  }

  // The small event of the set, in its round: a line of the person in a bubble, and a thing for a
// while.
  function eventOfRound(act) {
    for (const id of decor[act] ?? []) removeEntity(deps.world(), id);
    decor[act] = [];
    const s = state(act);
    if (!s.event || s.event.at !== s.index) return;
    const ev = def.eventsInfo?.[s.event.kind];
    if (!ev) return;
    const p = place(ev.at);
    if (ev.look && p) {
      const q = { x: p.x + (ev.dx ?? 0), z: p.z + (ev.dz ?? 0) };
      const id = `hamlet-event:${s.event.kind}`;
      addEntity(deps.world(), { id, keep: false, position: { ...q, y: groundAt(q), facing: 0 }, look: ev.look });
      decor[act].push(id);
    }
    deps.callout(ev.line, {}, personOf(act));
  }

  // The talk of the person of an activity opens it.
  function start(act) {
    const s = state(act);
    if (!s.active) newSet(act);
    if (!tzOf(deps.world(), act)) round(act);
  }

  // The end of a commit of an activity (the events fed, caught, and danced of the world).
  function commit(act, ev) {
    const s = state(act);
    const who = personOf(act);
    const tz = tzOf(deps.world(), act);
    const r = tz?.zone.round;
    if (!r) return;
    const words = (n) => ({ n: { key: `num.${Math.max(1, Math.min(150, n))}` } });
    if (!ev.full) {
      // Too few: the person waits for the rest.
      deps.say(`${act}.few`, words(r.need), null, who);
      return;
    }
    const mem = ((profile.facts ??= {})[memDef.skill] ??= {});
    const record = (key, ok) => {
      recordFact(mem, key, { ok, day: today(), set: s.set, index: s.index, form: ev.form, round: profile.factRound ?? 0, activity: act }, memDef);
      profile.factRound = (profile.factRound ?? 0) + 1;
    };
    if (act === 'drum') {
      // The dance: the fact of the group, and the fact of each beat that the child missed.
      for (const k of new Set(ev.missed ?? [])) record(k, false);
      record(ev.key, ev.clean);
      s.period = Math.max(def.drum.fastest, ev.period);
    } else {
      const ok = ev.result === 'exact' && ev.commits === 1;
      for (const k of r.facts) record(k, ok);
    }
    if (ev.result === 'exact' || ev.clean) (s.done ??= []).push(ev.key);
    s.used.push(ev.form);
    s.counts[ev.form] = (s.counts[ev.form] ?? 0) + 1;
    s.prev = ev.key;
    s.index += 1;
    const plays = (root().plays ??= {});
    plays[act] = (plays[act] ?? 0) + 1;
    // What the activity gives to the feast table: the ducks that ate lay eggs the next morning,
    // and the fish of the feast go to the rack by the kitchen.
    if (act === 'ducks') feedDucks(table(), ev.ate, today());
    if (act === 'traps') table().fish += r.need;
    showTable();
    const line = act === 'drum' ? (ev.clean ? 'drum.clean' : 'drum.done') : `${act}.${ev.result}`;
    deps.say(line, words(act === 'traps' ? r.need : act === 'ducks' ? r.need : r.targets[r.targets.length - 1]), null, who);
    deps.save(act);
    waits[act] = NEXT;
  }

  // A set ends at a natural stop: the rounds of a set, noon, or the rain.
  function setEnds(act) {
    const s = state(act);
    if (s.index >= def[act].set) return 'done';
    const began = (s.start % DAY) / 60;
    if (began < 12 && hour() >= 12) return 'noon';
    if (deps.rain() > 0.5) return 'rain';
    return null;
  }

  function endSet(act, why) {
    const s = state(act);
    s.active = false;
    s.sets += 1;
    clearActivity(deps.world(), act);
    for (const id of decor[act] ?? []) removeEntity(deps.world(), id);
    decor[act] = [];
    deps.save(act);
    if (!deps.setDone?.(act, why)) {
      deps.talk(`${personOf(act)}.set.${why === 'done' ? 'done' : 'stop'}`);
      point(act);
    }
  }

  // The person of a station points to another station in one line: most often the station whose
  // picture the memory of the facts wants next, else the one that the child played least.
  function point(here) {
    const plays = { ...(root().plays ?? {}), planting: profile.planting?.sets ?? 0 };
    const to = pointTo(profile.facts?.[memDef.skill] ?? {}, plays, here, ['planting', ...ACTIVITIES]);
    const who = here === 'planting' ? def.stations.planting : personOf(here);
    if (to) deps.callout(`hamlet.point.${to}`, {}, who);
  }

  // ------------------------------------------------------------ The feast of the new rice

  // The feast table in the yard shows what the activities gave (a look with the counts).
  function showTable() {
    const yard = place('yard');
    if (!yard) return;
    const t = table();
    const look = `feast-table-${Math.min(9, t.eggs)}-${Math.min(9, Math.ceil(t.fish / 5))}-${Math.min(6, t.sheaves)}`;
    const e = getEntity(deps.world(), 'hamlet:table');
    if (e) e.look = look;
    else {
      const q = { x: yard.x + def.feast.table[0], z: yard.z + def.feast.table[1] };
      addEntity(deps.world(), { id: 'hamlet:table', keep: false, position: { ...q, y: groundAt(q), facing: 0 }, look });
    }
  }

  // A plot of the field is full: a sheaf of the new rice goes to the table.
  function sheaf() {
    table().sheaves += 1;
    showTable();
  }

  // At dawn: the eggs of the ducks of yesterday go to the table.
  function dawn() {
    const t = table();
    const before = t.eggs;
    dawnTable(t, today());
    if (t.eggs > before) deps.emit({ type: 'eggs', n: t.eggs - before });
    showTable();
  }

  // At dusk of a day when the table has eggs, fish, and new rice, and the child is in the hamlet:
  // the people come to the yard, and all dance to the drum. After the feast the table is empty.
  function feastTick(dt) {
    const yard = place('yard');
    const hero = getEntity(deps.world(), 'hero');
    if (!yard || !hero) return;
    if (feast) {
      feast.beat += dt;
      if (feast.beat >= def.drum.period) {
        feast.beat = 0;
        feast.k += 1;
        // The two rings of dancers jump in turn on the beats of the drum.
        for (const e of deps.world().entities) if (e.feastDancer !== undefined && e.feastDancer % 2 === feast.k % 2) e.hop = { t: 0 };
        deps.emit({ type: 'beat', id: 'feast', beat: feast.k, sound: 'drum-small' });
      }
      if (deps.clock() >= feast.until) endFeast();
      return;
    }
    const near = Math.hypot(hero.position.x - yard.x, hero.position.z - yard.z) <= def.feast.near;
    if (!near || !feastNow(table(), hour(), today(), def.feast) || hour() >= def.feast.hour + def.feast.hours) return;
    feast = { until: deps.clock() + def.feast.hours * 60, beat: 0, k: 0 };
    table().feast = today();
    def.feast.dancers.forEach((look, k) => {
      const a = (k / def.feast.dancers.length) * Math.PI * 2;
      const r = k % 2 ? def.feast.ring : def.feast.ring + 2;
      const q = { x: yard.x + def.feast.table[0] + Math.cos(a) * r, z: yard.z + def.feast.table[1] + Math.sin(a) * r };
      addEntity(deps.world(), { id: `feast:dancer:${k}`, keep: false, feastDancer: k, position: { ...q, y: groundAt(q), facing: Math.atan2(-Math.cos(a), -Math.sin(a)) }, look });
    });
    deps.emit({ type: 'feast', on: true, eggs: table().eggs, fish: table().fish, sheaves: table().sheaves });
    deps.say('hamlet.feast', {}, null, def.stations.drum);
    deps.save('feast');
  }

  function endFeast() {
    feast = null;
    for (const e of [...deps.world().entities]) if (e.feastDancer !== undefined) removeEntity(deps.world(), e.id);
    serveFeast(table(), today());
    showTable();
    deps.emit({ type: 'feast', on: false });
    deps.save('feast');
  }

  // Each step: the next round after the line of the last commit.
  function tick(dt) {
    if (deps.busy?.()) return;
    feastTick(dt);
    for (const act of ACTIVITIES) {
      if (waits[act] === undefined) continue;
      waits[act] -= dt;
      if (waits[act] > 0) continue;
      delete waits[act];
      const why = setEnds(act);
      if (why) endSet(act, why);
      else round(act);
    }
  }

  // The events of the world for the activities.
  function worldEvent(ev) {
    if (ev.type === 'fed') commit('ducks', ev);
    else if (ev.type === 'caught') commit('traps', ev);
    else if (ev.type === 'danced') commit('drum', ev);
    else if (ev.type === 'pause' && ev.id === 'zone:trial-drum') deps.say('drum.wait', {}, null, personOf('drum'));
  }

  // The activity of a person of a station, or null.
  const actOf = (person) => ACTIVITIES.find((a) => personOf(a) === person) ?? null;

  return {
    start, tick, worldEvent, actOf, sheaf, dawn, point, showTable,
    get feast() { return feast ? { ...feast } : null; },
    active: (act) => Boolean(tzOf(deps.world(), act)),
    round: (act) => tzOf(deps.world(), act)?.zone.round ?? null,
    stateOf: (act) => ({ ...state(act) }),
    personOf,
    entity: (id) => getEntity(deps.world(), id),
  };
}
