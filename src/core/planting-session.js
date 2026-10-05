// The planting of Xóm Ruộng in the session (docs/PLANTING.md): the sets and the rounds, the place
// of each plot in the field, the lines of the planter, the memory of the facts, the small events
// of a set, the natural end of a set, and the growth of the planted paddies. No DOM, no WebGL.
// The rules of the plots are in src/core/planting.js; the world part is in
// src/core/world/systems/plant.js.
import { getEntity, query, addEntity, removeEntity } from './world/state.js';
import { nextOffers, recordFact, seedbedFor, eventOf, stageOf } from './planting.js';
import { setupPlant, plotsOf } from './world/systems/plant.js';

const NEXT = 2.5; // seconds from the end of a planting to the next round
const DAY = 1440;

// deps: { data, profile, world (fn), env (fn), map (fn), learner (fn), seed (fn), clock (fn: the
// minutes of the game clock), rain (fn: the rain now, 0 to 1), say (key, params, mark, speaker),
// talk (dialogue id), emit, save (reason), mentoring, examples ({ play, stop }: the small example of
// the station, src/core/examples.js), setDone (fn: the set ends, for a practice),
// point (fn: the planter points to another station), sheaf (fn: a plot is full: a sheaf of the new
// rice goes to the feast table) }.
export function createPlanting(deps) {
  const { data, profile } = deps;
  const def = data.planting;
  const skillOf = (id) => data.skills?.skills?.find((s) => s.id === id) ?? null;
  let wait = null; // seconds to the next round
  let decor = []; // the things of the small event of the round

  const state = () => (profile.planting ??= { sets: 0, set: 0, index: 0, prev: null, used: [], done: [], counts: {}, lastEvent: null, event: null, active: false, start: 0 });
  const tz = () => getEntity(deps.world(), 'zone:trial-plant');
  const today = () => Math.floor(deps.clock() / DAY);
  const hour = () => (deps.clock() % DAY) / 60;
  const planter = 'npc:planter';

  // The field of the plots (half blocks) and its two bands, each along a dike.
  function field() {
    const z = deps.map().layers.zones.find((q) => q.task === 'paddy');
    if (!z) return null;
    return { x0: z.x * 2, x1: (z.x + z.w) * 2, bands: def.bands.map((b) => ({ top: (z.y + b.top) * 2, bottom: (z.y + b.dike) * 2 })) };
  }

  // The planted paddies in the world: one rect for each paddy (from its rows).
  function paddies() {
    const out = new Map();
    for (const e of query(deps.world(), 'paddy')) {
      const p = out.get(e.paddy.plot) ?? { id: e.paddy.plot, rect: e.paddy.rect, day: e.paddy.day ?? today(), rows: [] };
      p.rows.push(e.id);
      out.set(e.paddy.plot, p);
    }
    return [...out.values()];
  }

  // The places of the plots of a round: each one on a band, with its bottom on the dike. When the
  // field is full, the oldest paddy goes (the farmer harvests it).
  function placeOffers(offers) {
    const f = field();
    if (!f) return [];
    for (let tries = 0; tries < 12; tries++) {
      const taken = paddies().map((p) => p.rect);
      const placed = [];
      for (const plot of offers) {
        const depth = depthOf(plot);
        const w = plot.size.w;
        let at = null;
        for (const band of [f.bands[1], f.bands[0]]) {
          if (!band || band.bottom - band.top < depth + 1) continue;
          const z = band.bottom - depth;
          for (let x = f.x0 + 1; x + w <= f.x1 && !at; x++) {
            const r = { x: x - 1, z: z - 1, w: w + 1, h: depth + 2 };
            if ([...taken, ...placed.map((p) => p.rect)].every((o) => r.x + r.w <= o.x || o.x + o.w <= r.x || r.z + r.h <= o.z || o.z + o.h <= r.z)) at = { x: x + 1, z, rect: r };
          }
          if (at) break;
        }
        if (!at) break;
        placed.push({ plot, ox: at.x, oz: at.z, rect: at.rect });
      }
      if (placed.length === offers.length) return placed;
      // The main plot first: when only some fit, the field is full enough to clear the oldest paddy.
      const old = paddies().sort((a, b) => a.day - b.day)[0];
      if (!old) return placed;
      for (const id of old.rows) removeEntity(deps.world(), id);
    }
    return [];
  }

  // A new set: the small event of the set, from the seed (never the same in two sets in a row).
  function newSet() {
    const s = state();
    s.set += 1;
    s.index = 0;
    s.prev = null;
    s.used = [];
    s.done = [];
    s.event = eventOf(deps.seed(), s.set, s.lastEvent, def);
    s.lastEvent = s.event?.kind ?? null;
    s.active = true;
    s.start = deps.clock();
  }

  // The plots of the next round.
  function round() {
    const s = state();
    const l = deps.learner();
    const mul = skillOf(def.skill);
    if (!mul) return;
    const level = Math.max(1, Math.min(mul.levels.length, l?.levelFor(def.skill) ?? 1));
    const mem = ((profile.facts ??= {})[def.skill] ??= {});
    const divideOpen = Boolean(skillOf(def.divide) && l?.unlocked?.(def.divide));
    const { offers, levelData } = nextOffers({ data: def, level, ranges: mul.levels, mem, day: today(), set: s.set, index: s.index, prev: s.prev, used: s.used, counts: s.counts, divideOpen, seed: deps.seed(), done: s.done ?? [], round: profile.factRound ?? 0 });
    // The first round of a visit: the planter plants a small example first, and the round of the
    // child comes after it (#37). The offers of the round are the same then (from the seed).
    const shows = deps.examples?.play('planting', offers) ?? 0;
    if (shows > 0) {
      wait = shows;
      return;
    }
    deps.examples?.stop('planting');
    // The neighbor child planted one row yesterday: the plot of the event is a plot with a row in.
    const placed = placeOffers(offers);
    if (!placed.length) return;
    const main = placed[0].plot;
    const bed = deps.env().places['plant-seedbed'];
    // The bundles for all the plots that are ready: of each size, enough for the biggest plot.
    const sizes = new Map();
    for (const { plot } of placed) {
      const b = seedbedFor(plot, levelData, def.extra);
      if (!b.bundles && !b.loose) continue;
      const had = sizes.get(b.size) ?? { size: b.size, bundles: 0, loose: 0 };
      sizes.set(b.size, { size: b.size, bundles: Math.max(had.bundles, b.bundles), loose: Math.max(had.loose, b.loose) });
    }
    setupPlant(deps.world(), {
      index: s.index,
      level: main.form === 'divide' ? Math.max(1, Math.min(skillOf(def.divide).levels.length, l?.levelFor(def.divide) ?? 1)) : level,
      skill: main.form === 'divide' ? def.divide : def.skill,
      offers: placed.map(({ plot, ox, oz }) => ({ plot, ox, oz })),
      seedbed: [...sizes.values()].sort((a, b) => b.size - a.size),
      seedbedAt: { x: bed.x, z: bed.z },
    }, deps.env());
    deps.mentoring?.start('trial-plant', s.index);
    eventOfRound();
    deps.emit({ type: 'hud' });
  }

  // The small event of the set, at its plot: a line of the planter, and a thing for a while.
  function eventOfRound() {
    for (const id of decor) removeEntity(deps.world(), id);
    decor = [];
    const s = state();
    if (!s.event || s.event.at !== s.index) return;
    const ev = def.eventsInfo?.[s.event.kind];
    if (!ev) return;
    const p = plotsOf(deps.world())[0];
    if (ev.look && p) {
      const at = { x: p.ox + (ev.dx ?? 2), z: p.oz + (ev.dz ?? -1) };
      const id = `plant-event:${s.event.kind}`;
      addEntity(deps.world(), { id, keep: false, position: { x: at.x, y: deps.env().groundY(at.x / 2, at.z / 2), z: at.z, facing: 0 }, look: ev.look });
      decor.push(id);
    }
    deps.say(ev.line, {}, null, planter);
  }

  // The talk of the planter opens the planting.
  function start() {
    const s = state();
    if (!s.active) newSet();
    // While the example plays, the round of the child waits for its end.
    if (!tz() && wait === null) round();
  }

  // A tap on the planter while the planting is on: the commit, when there are seedlings at the edge
  // of a plot (or row stakes); else a short line. Return 'commit', 'wait', or null (no planting).
  function ready() {
    const t = tz();
    if (!t || t.zone.done) return null;
    const r = t.zone.round;
    if (!r || r.anim || wait !== null) return 'busy';
    const w = deps.world();
    const ready = plotsOf(w).some((p) => p.plot.form === 'divide' || (p.plot.form !== 'choose' && (getEntity(w, `zone:plant-edge-${p.pid}`)?.zone.items ?? []).some((id) => !getEntity(w, id)?.item.fixed)));
    return ready ? 'commit' : 'wait';
  }

  // The end of a planting (the event planted of the world).
  function planted(ev) {
    const s = state();
    const params = { n: { key: `num.${Math.min(150, ev.total)}` } };
    if (!ev.full) {
      // Too few: the planter waits for the rest. A wrong plot of a choose, or wrong row stakes: the
      // planter says why, and waits too.
      const key = ev.form === 'choose' ? 'plant.choose.no' : ev.form === 'divide' ? (ev.result === 'few' ? 'plant.divide.few' : 'plant.divide.many') : 'plant.few';
      deps.say(key, params, null, planter);
      return;
    }
    // The plot is full: the rows stay as a paddy that grows.
    for (const e of query(deps.world(), 'paddy')) {
      if (e.paddy.day === null) {
        e.paddy.day = today();
        e.paddy.season = def.season;
        e.look = `seedlings-${e.paddy.n}-${stageOf(e.paddy.day, today(), def.growth)}`;
      }
    }
    const mem = ((profile.facts ??= {})[def.skill] ??= {});
    const ok = ev.result === 'exact' && ev.commits === 1;
    recordFact(mem, ev.key, { ok, day: today(), set: s.set, index: s.index, form: ev.form, round: profile.factRound ?? 0, activity: 'planting' }, def);
    profile.factRound = (profile.factRound ?? 0) + 1;
    if (ok) (s.done ??= []).push(ev.key);
    deps.sheaf?.();
    s.used.push(ev.form);
    s.counts[ev.form] = (s.counts[ev.form] ?? 0) + 1;
    s.prev = ev.key;
    s.index += 1;
    if (ev.result === 'many') deps.say('plant.many', params, null, planter);
    else deps.say(ev.form === 'turned' ? 'plant.turned' : 'plant.exact', params, null, planter);
    deps.save('plant');
    wait = NEXT;
  }

  // A set ends at a natural stop: the plots of a set, noon, or the rain.
  function setEnds() {
    const s = state();
    if (s.index >= def.set) return 'field';
    const began = (s.start % DAY) / 60;
    if (began < 12 && hour() >= 12) return 'noon';
    if (deps.rain() > 0.5) return 'rain';
    return null;
  }

  function endSet(why) {
    const s = state();
    s.active = false;
    s.sets += 1;
    const t = tz();
    const w = deps.world();
    if (t) for (const e of [...w.entities]) if (e.id === t.id || e.item?.task === 'trial-plant' || e.zone?.task === 'trial-plant' || e.plotPart || e.plantPlot) removeEntity(w, e.id);
    for (const id of decor) removeEntity(w, id);
    decor = [];
    deps.save('plant');
    if (!deps.setDone?.(why)) {
      deps.talk(`planter.set.${why}`);
      deps.point?.();
    }
  }

  // Each step: the next round after the line of the last planting.
  function tick(dt) {
    if (wait === null) return;
    if (deps.busy?.()) return;
    wait -= dt;
    if (wait > 0) return;
    wait = null;
    const why = setEnds();
    if (why) endSet(why);
    else round();
  }

  // At dawn (and at the start): the planted paddies grow.
  function grow() {
    for (const e of query(deps.world(), 'paddy')) {
      if (e.paddy.day === null) continue;
      const look = `seedlings-${e.paddy.n}-${stageOf(e.paddy.day, today(), def.growth)}`;
      if (e.look !== look) e.look = look;
    }
  }

  return {
    start, ready, planted, tick, grow,
    get active() { return Boolean(tz()); },
    get state() { return { ...state() }; },
  };
}

function depthOf(plot) {
  const rows = [...plot.parts, ...(plot.decoy ? [plot.decoy] : [])].map((r) => r.z + r.rows);
  return Math.max(...rows, plot.form === 'divide' ? Math.max(plot.rowsStart, plot.parts[0].rows) + 1 : 0);
}
