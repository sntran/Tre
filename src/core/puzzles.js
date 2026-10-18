// The puzzles solved by doing (#104; docs/PUZZLES.md, data/world/puzzles.json): side quests that a
// person offers on some days. The answer of each puzzle is an act in the world, never a word, and
// the world shows a wrong try as it shows any other. Nothing in the story waits for a puzzle; it has
// no count of mistakes and no score of mastery of its own. No DOM.
//
//   ferry: a traveler at the river with a dog, a chicken, and a sack of rice. The boat takes the hero
//     and one thing. A dog left alone with the chicken runs after it, and a chicken left alone with
//     the rice pecks at it; then all come back to where they were before that crossing.
//   pots: the healer at the well needs a number of bowls of water, with a pot of 5 and a pot of 3.
//
// deps: data (puzzles), profile, world(), env() (groundY), map() (its objects), day(), seed(),
// grade(), busy(), chosen() (the id of the last tap), say(id, textKey, params), sound(name),
// give(gift, from), skill(ev), log(kind, data).
import { getEntity, addEntity, removeEntity } from './world/state.js';
import { hashSeed } from './rng.js';

const CELL = 2; // half blocks in a map cell
const SCENE = 3.5; // seconds: a wrong pair on a bank, before all come back
const POUR = 1; // seconds of a pour
const DEMO_STEP = 1.6; // seconds between the two steps that the healer shows

// Is today a day of the puzzle (one day in `every`, by the seed and the day)?
export const puzzleDay = (def, seed, day) => hashSeed(`${seed}:puzzle:${def.id}:${day}`) % def.every === 0;

// The ferry: the things on a bank with no hero there that cannot stay alone ([eater, eaten, scene]),
// or null. side: { thing: 'a' | 'b' | 'boat' }.
export function wrongPair(def, where, bank) {
  const on = def.things.filter((t) => where[t] === bank);
  return def.pairs.find(([a, b]) => on.includes(a) && on.includes(b)) ?? null;
}

// The pots: a pour from a pot into another (or into the jar) until the other is full or the first is
// empty. Return the new levels [from, to].
export function pourInto(from, to, cap) {
  const n = Math.min(from, cap - to);
  return [from - n, to + n];
}

// The level of the pots for a grade.
export const potsLevel = (def, grade) => def.levels.find((l) => grade >= l.grades[0] && grade <= l.grades[1]) ?? def.levels[0];

export function createPuzzles(deps) {
  const data = deps.data;
  const w = () => deps.world();
  const st = (id) => ((deps.profile.puzzles ??= {})[id] ??= { tries: 0, solved: null, days: [] });
  const hero = () => getEntity(w(), 'hero');
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  // A place of a puzzle: cells from the top left corner of its map object, as half blocks.
  function placeOf(def, [dx, dy]) {
    const o = (deps.map()?.layers?.objects ?? []).find((x) => x.id === def.anchor && (!x.place || x.place === def.map));
    if (!o) return null;
    const x = (o.x + dx) * CELL;
    const z = (o.y + dy) * CELL;
    return { x, y: deps.env().groundY((o.x + dx), (o.y + dy)), z };
  }
  let ferry = null; // { where, snapshot, scene, back, hint }
  // A puzzle that a story or the debug panel brings today.
  const forced = new Set();
  const isDay = (def) => forced.has(def.id) || puzzleDay(def, deps.seed(), deps.day());
  let pots = null; // { levels: { pot5, pot3 }, held, jar, need, cap, hint, demo }
  const later = [];
  const after = (t, fn) => later.push({ t, fn });

  // ---- The ferry ------------------------------------------------------------------------------
  const F = data.ferry;
  const thingId = (t) => `pz:${t}`;
  const LOOK = { dog: 'dog', chicken: 'chicken', rice: 'sack' };
  function setFerry() {
    const s = st('ferry');
    const day = deps.day();
    if (ferry?.day === day) return;
    clearFerry();
    if (!F || !isDay(F) || s.solved === day) return;
    const at = placeOf(F, F.at);
    if (!at) return;
    const q = (c) => placeOf(F, c);
    const a = q(F.a);
    const b = q(F.b);
    addEntity(w(), { keep: true, id: 'pz:traveler', person: { kind: 'puzzle', ref: 'ferry' }, position: { ...at, facing: Math.PI }, motion: { vx: 0, vz: 0, speed: 0 }, solid: { r: 1.8 }, look: F.person });
    addEntity(w(), { keep: true, id: 'pz:mark:ferry', position: { x: at.x, y: at.y + 4.2, z: at.z, facing: 0 }, look: 'mark-side' });
    addEntity(w(), { keep: true, id: 'ferry:pz', ferry: { a: { x: a.x, z: a.z }, b: { x: b.x, z: b.z }, landA: q(F.landA), landB: q(F.landB), side: 'a', state: 'wait', riders: [], from: [], t: 0, man: null }, position: { x: a.x, y: a.y + 1.2, z: a.z, facing: Math.atan2(b.x - a.x, b.z - a.z) }, look: 'skiff-mid' });
    ferry = { day, where: Object.fromEntries(F.things.map((t) => [t, 'a'])), snapshot: null, scene: null, back: false, hint: 0, offered: false, load: null };
    F.things.forEach((t) => addEntity(w(), { keep: true, id: thingId(t), item: { kind: 'pz', size: 1, task: null, zone: null, held: null, set: true, fixed: true }, position: { ...spotOf('a', t), facing: 0 }, look: LOOK[t] }));
    pack();
  }
  function clearFerry() {
    for (const id of ['pz:traveler', 'pz:mark:ferry', 'ferry:pz', 'pz:spill', ...(F?.things ?? []).map(thingId)]) if (getEntity(w(), id)) removeEntity(w(), id);
    ferry = null;
  }
  // The spot of a thing on a bank (its own spot, in the order of the data).
  function spotOf(bank, t) {
    const spots = bank === 'a' ? F.spotsA : F.spotsB;
    const p = placeOf(F, spots[F.things.indexOf(t)]);
    return { x: p.x, y: p.y, z: p.z };
  }
  function pack() {
    for (const t of F.things) {
      const e = getEntity(w(), thingId(t));
      if (!e || ferry.where[t] === 'boat') continue;
      e.position = { ...spotOf(ferry.where[t], t), facing: 0 };
    }
  }
  const boat = () => getEntity(w(), 'ferry:pz');
  const heroSide = () => {
    const f = boat()?.ferry;
    const h = hero()?.position;
    if (!f || !h) return null;
    return dist(h, f.landA) < dist(h, f.landB) ? 'a' : 'b';
  };
  function load(t) {
    if (!ferry || ferry.load || ferry.scene || boat().ferry.state !== 'wait') return;
    ferry.load = t;
    ferry.where[t] = 'boat';
    const p = boat().position;
    getEntity(w(), thingId(t)).position = { x: p.x, y: p.y + 0.7, z: p.z, facing: 0 };
    deps.sound(t === 'dog' ? 'bark' : t === 'chicken' ? 'cluck' : 'thud');
  }
  function unload() {
    const t = ferry.load;
    ferry.load = null;
    ferry.where[t] = boat().ferry.side;
    pack();
  }
  function cross() {
    const e = boat();
    const f = e?.ferry;
    if (!ferry || ferry.scene || !f || f.state !== 'wait') return;
    ferry.snapshot = { where: { ...ferry.where }, side: f.side };
    const s = st('ferry');
    s.tries += 1;
    const riders = ['hero', ...(ferry.load ? [thingId(ferry.load)] : [])];
    f.riders = riders;
    f.call = f.side;
    f.t = 0;
    f.from = riders.map((r) => ({ ...getEntity(w(), r).position }));
    f.state = 'board';
    deps.sound('splash');
  }
  // The end of a crossing (the ferry system sends ferried): the thing steps onto the bank, and the
  // bank that the boat left shows a wrong pair at once.
  function ferried(ev) {
    if (!ferry || ev.id !== 'ferry:pz') return;
    const f = boat().ferry;
    if (ferry.back) {
      // All come back to where they were before that crossing (a thing that was in the boat goes
      // back onto its bank).
      ferry.back = false;
      ferry.where = { ...ferry.snapshot.where };
      for (const t of F.things) if (ferry.where[t] === 'boat') ferry.where[t] = ferry.snapshot.side;
      ferry.load = null;
      pack();
      return;
    }
    if (ferry.load) {
      ferry.where[ferry.load] = f.side;
      ferry.load = null;
    }
    pack();
    const left = f.side === 'a' ? 'b' : 'a';
    const pair = wrongPair(F, ferry.where, left);
    if (pair) {
      ferry.scene = { pair, t: 0, bank: left };
      deps.say('pz:traveler', `puzzle.ferry.${pair[2]}`, {});
      deps.sound(pair[2] === 'chase' ? 'bark' : 'peck');
      return;
    }
    if (F.things.every((t) => ferry.where[t] === 'b')) {
      const s = st('ferry');
      s.solved = deps.day();
      s.days.push(deps.day());
      s.crossings = s.tries;
      deps.log('puzzle', { id: 'ferry', crossings: s.tries, least: F.least });
      deps.say('pz:traveler', 'puzzle.ferry.done', {});
      deps.give(F.gift, 'pz:traveler');
      s.tries = 0;
    }
  }
  // The scene of a wrong pair: the dog runs around the chicken, or the chicken pecks and some rice
  // spills. No animal is hurt. Then the boat brings the hero back, and all come back.
  function tickScene(dt) {
    const sc = ferry.scene;
    sc.t += dt;
    const [eater, eaten, kind] = sc.pair;
    const a = getEntity(w(), thingId(eater));
    const b = getEntity(w(), thingId(eaten));
    const home = spotOf(sc.bank, eaten);
    if (kind === 'chase') {
      const k = sc.t * 3;
      b.position = { ...home, x: home.x + Math.cos(k) * 1.6, z: home.z + Math.sin(k) * 1.6, facing: k + Math.PI / 2 };
      a.position = { ...home, x: home.x + Math.cos(k - 0.9) * 1.6, z: home.z + Math.sin(k - 0.9) * 1.6, facing: k - 0.9 + Math.PI / 2 };
    } else {
      a.position = { ...a.position, y: spotOf(sc.bank, eater).y + Math.abs(Math.sin(sc.t * 8)) * 0.3 };
      if (!getEntity(w(), 'pz:spill')) addEntity(w(), { keep: true, id: 'pz:spill', position: { ...home, x: home.x + 0.6 }, look: 'rice-spill' });
    }
    if (sc.t < SCENE) return;
    ferry.scene = null;
    if (getEntity(w(), 'pz:spill')) removeEntity(w(), 'pz:spill');
    pack();
    // The boat comes back with the hero and the thing of that crossing.
    const f = boat().ferry;
    const crossed = Object.keys(ferry.snapshot.where).find((t) => ferry.snapshot.where[t] !== ferry.where[t]) ?? null;
    ferry.back = true;
    ferry.load = crossed;
    if (crossed) ferry.where[crossed] = 'boat';
    const riders = ['hero', ...(crossed ? [thingId(crossed)] : [])];
    f.riders = riders;
    f.call = f.side;
    f.t = 0;
    f.from = riders.map((r) => ({ ...getEntity(w(), r).position }));
    f.state = 'board';
    deps.say('pz:traveler', 'puzzle.ferry.again', {});
  }

  // ---- The pots at the well -------------------------------------------------------------------
  const PZ = data.pots;
  function setPots() {
    const day = deps.day();
    if (pots?.day === day) return;
    clearPots();
    if (!PZ || !isDay(PZ) || !deps.profile.flags?.[PZ.after] || st('pots').solved === day) return;
    if (!placeOf(PZ, PZ.well)) return;
    const lv = potsLevel(PZ, deps.grade());
    pots = { day, lv, levels: [0, 0], held: null, jar: 0, hint: 0, offered: false, demo: null };
    lv.sizes.forEach((cap, i) => addEntity(w(), { keep: true, id: `pz:pot:${i}`, item: { kind: 'pzpot', size: 1, task: null, zone: null, held: null, set: true, fixed: true }, position: { ...placeOf(PZ, PZ.spots[i]), facing: 0 }, look: `pzpot-${cap}-0` }));
    addEntity(w(), { keep: true, id: 'pz:jar', item: { kind: 'pzjar', size: 1, task: null, zone: null, held: null, set: true, fixed: true }, position: { ...placeOf(PZ, PZ.jar), facing: 0 }, look: `pzjar-${lv.need}-0` });
    addEntity(w(), { keep: true, id: 'pz:drain', item: { kind: 'pzdrain', size: 1, task: null, zone: null, held: null, set: true, fixed: true }, position: { ...placeOf(PZ, PZ.drain), facing: 0 }, look: 'drain' });
  }
  function clearPots() {
    for (const id of ['pz:pot:0', 'pz:pot:1', 'pz:jar', 'pz:drain', 'pz:mark:pots']) if (getEntity(w(), id)) removeEntity(w(), id);
    pots = null;
  }
  const potLook = (i) => {
    const e = getEntity(w(), `pz:pot:${i}`);
    if (e) e.look = `pzpot-${pots.lv.sizes[i]}-${pots.levels[i]}`;
  };
  const healer = () => getEntity(w(), 'npc:healer');
  const healerNear = () => {
    const h = healer();
    const well = placeOf(PZ, PZ.well);
    return h && !h.hidden && well && dist(h.position, well) <= 16 ? h : null;
  };
  function potAct(act, i = null) {
    const p = pots;
    if (!p || p.demo) return;
    const caps = p.lv.sizes;
    if (act === 'take') p.held = i;
    else if (act === 'set') {
      getEntity(w(), `pz:pot:${p.held}`).position = { ...placeOf(PZ, PZ.spots[p.held]), facing: 0 };
      p.held = null;
    } else if (act === 'fill') {
      p.levels[p.held] = caps[p.held];
      deps.sound('scoop');
    } else if (act === 'empty') {
      p.levels[p.held] = 0;
      deps.sound('pour');
    } else if (act === 'pour') {
      [p.levels[p.held], p.levels[i]] = pourInto(p.levels[p.held], p.levels[i], caps[i]);
      deps.sound('pour');
    } else if (act === 'jar') {
      // The healer checks: the water of the pot goes into her jar.
      const n = p.levels[p.held];
      p.levels[p.held] = 0;
      deps.sound('pour');
      const solved = n === p.lv.need;
      deps.skill({ skill: p.lv.skill, level: p.lv.level, task: 'puzzle-pots', correct: solved, solved, efficient: false, first: false, mashing: false, evidence: true, parts: [n], target: p.lv.need, latencies: [], resets: 0, hint: p.hint, hintSeen: null });
      const jar = getEntity(w(), 'pz:jar');
      jar.look = `pzjar-${p.lv.need}-${Math.min(n, p.lv.need)}${n > p.lv.need ? '-over' : ''}`;
      const h = healer();
      if (solved) {
        const s = st('pots');
        s.solved = deps.day();
        s.days.push(deps.day());
        deps.log('puzzle', { id: 'pots', need: p.lv.need, hint: p.hint });
        if (h) deps.say(h.id, 'puzzle.pots.done', {});
        deps.give(PZ.gift, h?.id ?? 'hero');
        after(3, () => clearPots());
      } else {
        if (h) deps.say(h.id, n > p.lv.need ? 'puzzle.pots.over' : 'puzzle.pots.short', {});
        // She pours the jar back into the well, and the child can try again.
        after(2.5, () => { if (pots) getEntity(w(), 'pz:jar').look = `pzjar-${p.lv.need}-0`; });
      }
    }
    if (pots) [0, 1].forEach(potLook);
  }

  // ---- The step, the acts of the button, and the wave ------------------------------------------
  return {
    tick(dt) {
      for (const l of [...later]) {
        l.t -= dt;
        if (l.t <= 0) {
          later.splice(later.indexOf(l), 1);
          l.fn();
        }
      }
      setFerry();
      setPots();
      if (ferry?.scene) tickScene(dt);
      const h = hero()?.position;
      // The traveler says the puzzle when the hero comes near, one time each day.
      if (ferry && !ferry.offered && h && !deps.busy()) {
        const t = getEntity(w(), 'pz:traveler');
        if (t && dist(t.position, h) <= 12) {
          ferry.offered = true;
          deps.say(t.id, 'puzzle.ferry.start', {});
        }
      }
      if (pots && h) {
        const healerE = healerNear();
        // The mark of a side quest over the healer while she is at the well.
        const mark = getEntity(w(), 'pz:mark:pots');
        if (healerE && !mark) addEntity(w(), { keep: true, id: 'pz:mark:pots', position: { ...healerE.position, y: healerE.position.y + 4.2 }, look: 'mark-side' });
        else if (healerE && mark) mark.position = { ...healerE.position, y: healerE.position.y + 4.2 };
        else if (!healerE && mark) removeEntity(w(), 'pz:mark:pots');
        if (!pots.offered && healerE && !deps.busy() && dist(healerE.position, h) <= 12) {
          pots.offered = true;
          deps.say(healerE.id, pots.lv.need === 4 ? 'puzzle.pots.start' : 'puzzle.pots.start.two', {});
        }
        // The pot in the hands goes with the hero, in front.
        if (pots.held !== null) {
          const e = getEntity(w(), `pz:pot:${pots.held}`);
          const f = hero().position.facing ?? 0;
          e.position = { x: h.x + Math.sin(f) * 0.9, y: (h.y ?? 0) + 1.1, z: h.z + Math.cos(f) * 0.9, facing: f };
        }
      }
    },
    // The acts of the button near a puzzle (the session adds them to its candidates).
    candidates(add, reach) {
      const h = hero()?.position;
      if (!h || deps.busy()) return;
      const chosen = deps.chosen();
      if (ferry && boat()?.ferry.state === 'wait' && !ferry.scene) {
        const f = boat().ferry;
        const side = f.side;
        const land = side === 'a' ? f.landA : f.landB;
        if (heroSide() === side && dist(h, land) <= reach + 8) {
          const t = F.things.find((x) => thingId(x) === chosen);
          if (t && ferry.where[t] === side && !ferry.load) add({ act: 'load', icon: 'boat', target: thingId(t), at: getEntity(w(), thingId(t)).position, rank: -1, work: true, run: () => load(t) }, reach + 2);
          else if (t && ferry.load === t) add({ act: 'unload', icon: 'hand-pick', target: thingId(t), at: boat().position, rank: -1, run: () => unload() }, reach + 4);
          // The bank of the boat is one place: a press anywhere on it near the landing crosses.
          add({ act: 'cross', icon: 'boat', target: 'ferry:pz', at: { x: h.x, y: h.y, z: h.z }, rank: 1, run: () => cross() }, reach);
        }
      }
      if (pots && !pots.demo) {
        const at = (c) => placeOf(PZ, c);
        if (pots.held === null) {
          for (const i of [0, 1]) {
            const e = getEntity(w(), `pz:pot:${i}`);
            if (e) add({ act: 'take', icon: 'hand-pick', target: e.id, at: e.position, rank: chosen === e.id ? -1 : 1, run: () => potAct('take', i) }, reach);
          }
        } else {
          const other = pots.held === 0 ? 1 : 0;
          const o = getEntity(w(), `pz:pot:${other}`);
          add({ act: 'fill', icon: 'water', target: 'pz:pot:' + pots.held, at: at(PZ.well), rank: chosen === null ? 1 : 2, run: () => potAct('fill') }, reach + 1);
          if (o) add({ act: 'pour', icon: 'jar', target: o.id, at: o.position, rank: chosen === o.id ? -1 : 1, run: () => potAct('pour', other) }, reach);
          add({ act: 'empty', icon: 'clear', target: 'pz:drain', at: at(PZ.drain), rank: chosen === 'pz:drain' ? -1 : 1, run: () => potAct('empty') }, reach);
          add({ act: 'give', icon: 'hand-give', target: 'pz:jar', at: at(PZ.jar), rank: chosen === 'pz:jar' ? -1 : 1, run: () => potAct('jar') }, reach);
          // A tap on the pot in the hands, and then a press, puts it back at its place.
          if (chosen === `pz:pot:${pots.held}`) add({ act: 'set', icon: 'hand-put', target: chosen, at: { x: h.x, y: h.y, z: h.z }, rank: -1, run: () => potAct('set') }, reach);
        }
      }
    },
    // An event of the world: the end of a crossing of the boat of the ferry.
    worldEvent(ev) {
      if (ev.type === 'ferried') ferried(ev);
    },
    // A talk with the person of a puzzle: the puzzle again.
    talk(id) {
      if (id === 'ferry' && ferry) deps.say('pz:traveler', 'puzzle.ferry.start', {});
    },
    canWave: () => Boolean((ferry && st('ferry').solved !== deps.day() && heroNear('pz:traveler', 40)) || (pots && healerNear() && heroNear(healerNear().id, 20))),
    // A wave: the next hint of the puzzle near the hero. The last hint of the pots shows the first
    // two steps.
    wave() {
      if (ferry && heroNear('pz:traveler', 40) && st('ferry').solved !== deps.day()) {
        const k = Math.min(F.hints.length - 1, ferry.hint);
        ferry.hint += 1;
        deps.say('pz:traveler', F.hints[k], {});
        return true;
      }
      const hz = pots ? healerNear() : null;
      if (pots && hz && heroNear(hz.id, 20)) {
        const k = Math.min(PZ.hints.length - 1, pots.hint);
        pots.hint += 1;
        deps.say(hz.id, PZ.hints[k], {});
        if (k === PZ.hints.length - 1 && !pots.demo) {
          // The healer shows the first two steps: the big pot full, then poured into the small one.
          pots.demo = true;
          if (pots.held !== null) getEntity(w(), `pz:pot:${pots.held}`).position = { ...placeOf(PZ, PZ.spots[pots.held]), facing: 0 };
          pots.held = null;
          pots.levels = [0, 0];
          [0, 1].forEach(potLook);
          after(DEMO_STEP, () => { if (!pots) return; pots.levels[0] = pots.lv.sizes[0]; potLook(0); deps.sound('scoop'); });
          after(DEMO_STEP * 2, () => { if (!pots) return; [pots.levels[0], pots.levels[1]] = pourInto(pots.levels[0], 0, pots.lv.sizes[1]); [0, 1].forEach(potLook); deps.sound('pour'); pots.demo = null; });
        }
        return true;
      }
      return false;
    },
    // A story or the debug panel brings a puzzle today.
    force(id) {
      forced.add(id);
      if (id === 'ferry' && ferry) ferry.day = null;
      if (id === 'pots' && pots) pots.day = null;
    },
    // For the tests and the debug panel.
    state: () => ({ ferry, pots }),
  };
  function heroNear(id, r) {
    const e = getEntity(w(), id);
    const h = hero()?.position;
    return Boolean(e && h && dist(e.position, h) <= r);
  }
}

