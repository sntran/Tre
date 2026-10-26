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
// give(gift, from), skill(ev), log(kind, data), look(points) (the view shows these points with the
// hero, half blocks).
import { getEntity, addEntity, removeEntity } from './world/state.js';
import { hashSeed } from './rng.js';

const CELL = 2; // half blocks in a map cell
const SCENE = 3.5; // seconds: a wrong pair on a bank, before all come back
const POUR = 1; // seconds of a pour
const DEMO_STEP = 1.6; // seconds between the two steps that the healer shows
// Half blocks: the person of a puzzle says it, and a wave gets its hint, only this near, and only
// after the person said the puzzle (#110: a wave 40 half blocks away gave a hint before the puzzle).
export const OFFER_NEAR = 12;
const OFFER_LINE = 3.6; // seconds between the short lines of the offer of the ferry
const WAIT_HINT = 60; // seconds with no crossing after the offer: the next hint of the ferry comes

// Is today a day of the puzzle (one day in `every`, by the seed and the day)?
export const puzzleDay = (def, seed, day) => hashSeed(`${seed}:puzzle:${def.id}:${day}`) % def.every === 0;

// The ferry: the things on a bank with no hero there that cannot stay alone ([eater, eaten, scene]),
// or null. side: { thing: 'a' | 'b' | 'boat' }.
export function wrongPair(def, where, bank) {
  const on = def.things.filter((t) => where[t] === bank);
  return def.pairs.find(([a, b]) => on.includes(a) && on.includes(b)) ?? null;
}

// The ferry: the next right crossing from the banks as they are (#122: "Con gà đi trước." came after
// the child had taken the chicken over). where: { thing: 'a' | 'b' | 'boat' }; side: the bank of
// the boat and the hero. Return { thing (or null: the boat goes with nothing), to }, or null when
// all things are on the far bank or no way is left. The shortest way, by a search of the states.
export function nextCrossing(def, where, side) {
  const at = Object.fromEntries(def.things.map((t) => [t, where[t] === 'boat' ? side : where[t]]));
  const keyOf = (w, s) => `${def.things.map((t) => w[t]).join('')}${s}`;
  const goal = (w) => def.things.every((t) => w[t] === 'b');
  if (goal(at)) return null;
  const seen = new Set([keyOf(at, side)]);
  let front = [{ w: at, s: side, first: null }];
  while (front.length) {
    const next = [];
    for (const { w, s, first } of front) {
      const to = s === 'a' ? 'b' : 'a';
      for (const thing of [null, ...def.things.filter((t) => w[t] === s)]) {
        const nw = { ...w, ...(thing ? { [thing]: to } : {}) };
        if (wrongPair(def, nw, s)) continue;
        const move = first ?? { thing, to };
        if (goal(nw)) return move;
        const k = keyOf(nw, to);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ w: nw, s: to, first: move });
      }
    }
    front = next;
  }
  return null;
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
    // A puzzle that the child started goes on past midnight, until it is solved (#104: at night the
    // ferry went away in the middle of the crossings).
    if (ferry?.day === day || (ferry?.started && !ferry.solved)) return;
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
    ferry = { day, where: Object.fromEntries(F.things.map((t) => [t, 'a'])), snapshot: null, scene: null, back: false, hint: 0, offered: false, load: null, wrong: 0, idle: 0, demo: null };
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
    ferry.started = true;
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
  // An empty boat from the bank where all three things wait (#110): the traveler says it and points
  // at the things.
  function emptyBoat() {
    deps.say('pz:traveler', 'puzzle.ferry.empty', {});
    const pts = F.things.map((t) => getEntity(w(), thingId(t))?.position).filter(Boolean);
    pts.forEach((p, i) => after(i * 0.8, () => point(p, 1.2)));
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
    if (ferry.demo) {
      if (ferry.demo.step === 'go') {
        ferry.demo.step = 'back';
        after(1, () => { if (ferry?.demo) rideDemo(); });
        return;
      }
      ferry.demo = null;
      pack();
      lookBoth();
      return;
    }
    ferry.idle = 0;
    if (ferry.back) {
      // All come back to where they were before that crossing (a thing that was in the boat goes
      // back onto its bank).
      ferry.back = false;
      ferry.where = { ...ferry.snapshot.where };
      for (const t of F.things) if (ferry.where[t] === 'boat') ferry.where[t] = ferry.snapshot.side;
      ferry.load = null;
      pack();
      lookBoth();
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
      ferry.wrong += 1;
      ferry.scene = { pair, t: 0, bank: left };
      // The view shows the scene on the other bank with the hero (#104: the scene was out of the
      // frame).
      const pts = pair.slice(0, 2).map((t) => ({ ...getEntity(w(), thingId(t)).position }));
      deps.look(pts);
      deps.say('pz:traveler', `puzzle.ferry.${pair[2]}`, {});
      deps.sound(pair[2] === 'chase' ? 'bark' : 'peck');
      return;
    }
    lookBoth();
    if (F.things.every((t) => ferry.where[t] === 'b')) {
      const s = st('ferry');
      s.solved = deps.day();
      ferry.solved = true;
      s.days.push(deps.day());
      s.crossings = s.tries;
      deps.log('puzzle', { id: 'ferry', crossings: s.tries, least: F.least });
      deps.say('pz:traveler', 'puzzle.ferry.done', {});
      // The traveler gives the eggs from his hand to the hero, in view, with a line that names them
      // (#110: the gift came as a small egg under the count of rice).
      const tr = getEntity(w(), 'pz:traveler');
      if (tr) tr.gesture = { act: 'point', x: hero().position.x, z: hero().position.z, t: 2.5 };
      after(OFFER_LINE, () => {
        deps.say('pz:traveler', 'puzzle.ferry.gift', { n: { key: `num.${F.gift.egg ?? 1}` } });
        deps.give(F.gift, 'pz:traveler');
      });
      s.tries = 0;
      return;
    }
    // After a crossing, the traveler says what is on the bank that the hero left (#110).
    const names = namesOn(left);
    if (names.length) deps.say('pz:traveler', 'puzzle.ferry.left', { list: names });
  }
  // The view shows both landings, the boat, the things on each bank, and the traveler (#110: the
  // things on the far bank were out of the view, and a child could not tell who was on which side).
  function lookBoth() {
    const f = boat()?.ferry;
    if (!f) return;
    const pts = F.things.map((t) => ({ ...getEntity(w(), thingId(t)).position }));
    const t = getEntity(w(), 'pz:traveler');
    const y = boat().position.y;
    deps.look([...pts, { ...boat().position }, { ...f.landA, y }, { ...f.landB, y }, ...(t ? [{ ...t.position }] : [])]);
  }
  // The puzzle in short lines, one at a time (#110: three sentences in one bubble).
  function sayOffer() {
    lookBoth();
    // A wave gets a hint only after the last line of the puzzle (#110: in a play, a wave between the
    // lines gave the rule before the puzzle was said).
    F.offer.forEach((key, i) => after(i * OFFER_LINE, () => {
      if (!ferry) return;
      deps.say('pz:traveler', key, {});
      if (i === F.offer.length - 1) ferry.told = true;
    }));
  }
  // The things on a bank, as a list of names ("con chó và bao gạo").
  const namesOn = (bank) => F.things.filter((t) => ferry.where[t] === bank).map((t) => ({ key: `puzzle.thing.${t}` }));
  // The traveler points at a point (half blocks) for a moment.
  function point(at, t = 2) {
    const e = getEntity(w(), 'pz:traveler');
    if (e && at) e.gesture = { act: 'point', x: at.x, z: at.z, t };
  }
  // The last hint of the ferry is a demonstration, as at the well (#110): the traveler takes the
  // chicken across and back in the boat, with no hero, and all is as it was.
  // The line of the next right crossing, for the middle hint of a wave.
  function stepHint() {
    const f = boat()?.ferry;
    const move = f ? nextCrossing(F, ferry.where, f.side) : null;
    if (!move) return null;
    const crossed = F.things.some((t) => ferry.where[t] === 'b');
    if (move.thing === 'chicken' && move.to === 'b' && !crossed) return { key: F.hints[1], params: {}, thing: 'chicken' };
    const params = move.thing ? { thing: { key: `puzzle.thing.${move.thing}` } } : {};
    const key = !move.thing ? 'puzzle.ferry.next.empty' : move.to === 'a' ? 'puzzle.ferry.next.back' : 'puzzle.ferry.next.over';
    return { key, params, thing: move.thing };
  }
  function startDemo() {
    const e = boat();
    const f = e?.ferry;
    const t = 'chicken';
    if (!f || f.state !== 'wait' || ferry.load || ferry.scene || ferry.where[t] !== f.side) return false;
    ferry.demo = { thing: t, step: 'go', side: f.side };
    rideDemo();
    return true;
  }
  function rideDemo() {
    const f = boat().ferry;
    const id = thingId(ferry.demo.thing);
    f.riders = [id];
    f.call = f.side;
    f.t = 0;
    f.from = [{ ...getEntity(w(), id).position }];
    f.state = 'board';
    lookBoth();
    deps.sound('splash');
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
    if (pots?.day === day || (pots?.started && !pots.solved)) return;
    clearPots();
    if (!PZ || !isDay(PZ) || !deps.profile.flags?.[PZ.after] || st('pots').solved === day) return;
    if (!placeOf(PZ, PZ.well)) return;
    const lv = potsLevel(PZ, deps.grade());
    pots = { day, lv, levels: [0, 0], held: null, jar: 0, hint: 0, offered: false, demo: null };
    // The place of each pot: a ring of straw. A tap on it and a press put the pot in the hands back.
    lv.sizes.forEach((cap, i) => addEntity(w(), { keep: true, id: `pz:spot:${i}`, item: { kind: 'pzspot', size: 1, task: null, zone: null, held: null, set: true, fixed: true, covered: true }, position: { ...placeOf(PZ, PZ.spots[i]), facing: 0 }, look: 'band' }));
    lv.sizes.forEach((cap, i) => addEntity(w(), { keep: true, id: `pz:pot:${i}`, item: { kind: 'pzpot', size: 1, task: null, zone: null, held: null, set: true, fixed: true }, position: { ...placeOf(PZ, PZ.spots[i]), facing: 0 }, look: `pzpot-${cap}-0` }));
    addEntity(w(), { keep: true, id: 'pz:jar', item: { kind: 'pzjar', size: 1, task: null, zone: null, held: null, set: true, fixed: true }, position: { ...placeOf(PZ, PZ.jar), facing: 0 }, look: `pzjar-${lv.need}-0` });
    // The bucket of the well: a tap on it and a press fill the pot in the hands.
    addEntity(w(), { keep: true, id: 'pz:well', item: { kind: 'pzwell', size: 1, task: null, zone: null, held: null, set: true, fixed: true }, position: { ...placeOf(PZ, PZ.well), facing: 0 }, look: 'bucket' });
    addEntity(w(), { keep: true, id: 'pz:drain', item: { kind: 'pzdrain', size: 1, task: null, zone: null, held: null, set: true, fixed: true }, position: { ...placeOf(PZ, PZ.drain), facing: 0 }, look: 'drain' });
  }
  function clearPots() {
    for (const id of ['pz:pot:0', 'pz:pot:1', 'pz:spot:0', 'pz:spot:1', 'pz:jar', 'pz:well', 'pz:drain', 'pz:mark:pots']) if (getEntity(w(), id)) removeEntity(w(), id);
    pots = null;
  }
  const potLook = (i) => {
    const e = getEntity(w(), `pz:pot:${i}`);
    if (e) e.look = `pzpot-${pots.lv.sizes[i]}-${pots.levels[i]}`;
  };
  const healer = () => getEntity(w(), 'npc:healer');
  // On a day of the pots the healer stays at the well from 9:00 to 15:00, and while the hero is
  // near the well (#133: her plan put her there for about 43 seconds of play, and no child met the
  // pots in four play tests).
  const WELL_HOURS = [9, 15];
  const WELL_NEAR = 20; // half blocks
  function keepHealer() {
    const h = healer();
    if (!h?.schedule) return;
    const well = pots && !pots.solved && PZ ? placeOf(PZ, PZ.at ?? PZ.well) : null;
    const hour = (w().clock.minutes % 1440) / 60;
    const near = hero() && well && dist(hero().position, well) <= WELL_NEAR;
    const stay = Boolean(well && !h.hidden && ((hour >= WELL_HOURS[0] && hour < WELL_HOURS[1]) || near));
    if (stay && !h.potsWell) {
      h.potsWell = { spot: h.schedule.spot, hold: h.schedule.hold ?? false };
      h.schedule.spot = { x: well.x, z: well.z };
      h.schedule.hold = true;
    } else if (!stay && h.potsWell) {
      h.schedule.spot = h.potsWell.spot;
      if (!h.potsWell.hold) delete h.schedule.hold;
      delete h.potsWell;
    }
  }
  const healerNear = () => {
    const h = healer();
    const well = placeOf(PZ, PZ.well);
    return h && !h.hidden && well && dist(h.position, well) <= 16 ? h : null;
  };
  function potAct(act, i = null) {
    const p = pots;
    if (!p || p.demo) return;
    const caps = p.lv.sizes;
    p.started = true;
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
        p.solved = true;
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
      keepHealer();
      if (ferry?.scene) tickScene(dt);
      const h = hero()?.position;
      // The traveler says the puzzle when the hero comes near, one time each day.
      if (ferry && !ferry.offered && h && !deps.busy()) {
        const t = getEntity(w(), 'pz:traveler');
        if (t && dist(t.position, h) <= OFFER_NEAR) {
          ferry.offered = true;
          sayOffer();
        }
      }
      if (ferry?.offered && !ferry.solved) ferry.idle += dt;
      if (pots && h) {
        // The grade changed (in the parent area) before the first move: the need of the new grade,
        // and the healer says it again.
        const lv = potsLevel(PZ, deps.grade());
        if (!pots.started && lv.need !== pots.lv.need) {
          pots.lv = lv;
          pots.offered = false;
          const jar = getEntity(w(), 'pz:jar');
          if (jar) jar.look = `pzjar-${lv.need}-0`;
        }
        const healerE = healerNear();
        // The mark of a side quest over the healer while she is at the well.
        const mark = getEntity(w(), 'pz:mark:pots');
        if (healerE && !mark) addEntity(w(), { keep: true, id: 'pz:mark:pots', position: { ...healerE.position, y: healerE.position.y + 4.2 }, look: 'mark-side' });
        else if (healerE && mark) mark.position = { ...healerE.position, y: healerE.position.y + 4.2 };
        else if (!healerE && mark) removeEntity(w(), 'pz:mark:pots');
        if (!pots.offered && healerE && !deps.busy() && dist(healerE.position, h) <= OFFER_NEAR) {
          pots.offered = true;
          // The view turns to a side where nothing covers the things of the puzzle.
          deps.look(['pz:pot:0', 'pz:pot:1', 'pz:well', 'pz:jar', 'pz:drain'].map((id) => ({ ...getEntity(w(), id).position })));
          deps.say(healerE.id, pots.lv.need === 4 ? 'puzzle.pots.start' : 'puzzle.pots.start.two', {});
        }
        // The pot in the hands goes with the hero, in front. It takes a tap only on its body
        // (inHands, src/world/hit.js).
        for (const i of [0, 1]) {
          const e = getEntity(w(), `pz:pot:${i}`);
          if (e) e.item.inHands = pots.held === i;
          // A ring of straw with its pot on it takes no tap: the tap is for the pot.
          const r = getEntity(w(), `pz:spot:${i}`);
          if (r) r.item.covered = pots.held !== i;
        }
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
      if (ferry && boat()?.ferry.state === 'wait' && !ferry.scene && !ferry.demo) {
        const f = boat().ferry;
        const side = f.side;
        const land = side === 'a' ? f.landA : f.landB;
        if (heroSide() === side && dist(h, land) <= reach + 8) {
          // A thing of the bank of the hero: the act "take" by nearness, as a pot at the well, or by
          // a tap on it (#110: a thing was an act only after a tap on it, and the button stayed dim).
          // At the landing (nearer to it than to the thing), the act is the crossing: so the boat
          // can go back empty. The button shows the thing that the press takes (#139).
          if (!ferry.load) {
            for (const t of F.things) {
              if (ferry.where[t] !== side) continue;
              const e = getEntity(w(), thingId(t));
              if (chosen !== e.id && dist(h, e.position) >= dist(h, land)) continue;
              add({ act: 'take', icon: 'hand-pick', thing: LOOK[t], target: e.id, at: e.position, rank: chosen === e.id ? -1 : 0, work: chosen === e.id, run: () => load(t) }, reach + 2);
            }
          } else {
            const t = ferry.load;
            if (chosen === thingId(t)) add({ act: 'unload', icon: 'hand-pick', target: thingId(t), at: boat().position, rank: -1, run: () => unload() }, reach + 4);
          }
          // The bank of the boat is one place: a press anywhere on it near the landing crosses. The
          // picture is the boat with what it carries (#110: a child pressed the boat to put the dog
          // in). From the bank where all three things wait, an empty boat does not cross.
          // With the boat empty, a thing nearer than the landing comes first (its "take"); with a
          // thing in the boat, the crossing.
          const full = !ferry.load && F.things.every((t) => ferry.where[t] === side);
          add({ act: 'cross', icon: 'boat', thing: ferry.load ? LOOK[ferry.load] : null, target: 'ferry:pz', at: { x: land.x, y: h.y, z: land.z }, rank: ferry.load ? -1 : 8, run: () => (full ? emptyBoat() : cross()) }, reach + 8);
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
          add({ act: 'fill', icon: 'water', target: 'pz:well', at: at(PZ.well), rank: chosen === 'pz:well' ? -1 : chosen === null ? 1 : 2, run: () => potAct('fill') }, reach + 1);
          if (o) add({ act: 'pour', icon: 'jar', target: o.id, at: o.position, rank: chosen === o.id ? -1 : 1, run: () => potAct('pour', other) }, reach);
          add({ act: 'empty', icon: 'clear', target: 'pz:drain', at: at(PZ.drain), rank: chosen === 'pz:drain' ? -1 : 1, run: () => potAct('empty') }, reach);
          add({ act: 'give', icon: 'hand-give', target: 'pz:jar', at: at(PZ.jar), rank: chosen === 'pz:jar' ? -1 : 1, run: () => potAct('jar') }, reach);
          // A tap on the place of the pot in the hands (its ring of straw), and then a press, puts
          // it back there.
          const spot = getEntity(w(), `pz:spot:${pots.held}`);
          if (spot && chosen === spot.id) add({ act: 'set', icon: 'hand-put', target: spot.id, at: spot.position, rank: -1, run: () => potAct('set') }, reach);
        }
      }
    },
    // An event of the world: the end of a crossing of the boat of the ferry.
    worldEvent(ev) {
      if (ev.type === 'ferried') ferried(ev);
    },
    // A talk with the person of a puzzle: the puzzle again.
    talk(id) {
      if (id === 'ferry' && ferry) {
        ferry.offered = true;
        sayOffer();
      }
    },
    // A puzzle goes on near the hero: the faces of the people of the story do not show on the screen
    // (#110: the rice of the ferry was under the arrows at the edge, and a tap on it walked the hero
    // to the woodcutter), as at a task.
    here: () => Boolean((ferry && ferry.offered && !ferry.solved && (heroNear('pz:traveler', OFFER_NEAR * 2) || heroNear('ferry:pz', OFFER_NEAR))) || (pots && pots.offered && !pots.solved && healerNear() && heroNear(healerNear().id, OFFER_NEAR))),
    canWave: () => Boolean((ferryHint() && !ferry.demo) || (pots && pots.offered && healerNear() && heroNear(healerNear().id, OFFER_NEAR))),
    // A wave: the next hint of the puzzle near the hero, only after the person said the puzzle. The
    // first hint of the ferry is the rule again, with the traveler pointing at each pair; "the
    // chicken first" comes only after a wrong crossing or a long wait; the last is a demonstration
    // (#110). The last hint of the pots shows the first two steps.
    wave() {
      if (ferryHint()) {
        if (ferry.demo) return true;
        const stuck = ferry.wrong > 0 || ferry.idle >= WAIT_HINT;
        const k = ferry.hint === 0 || !stuck ? 0 : Math.min(F.hints.length - 1, ferry.hint);
        ferry.hint = Math.max(ferry.hint, k + 1);
        // The middle hint is the next step from the banks as they are (#122): the traveler says
        // it and points at the thing to take. "The chicken first" only when the chicken has not
        // crossed.
        const step = k > 0 && k < F.hints.length - 1 ? stepHint() : null;
        if (step) {
          deps.say('pz:traveler', step.key, step.params);
          const p = step.thing ? getEntity(w(), thingId(step.thing))?.position : boat()?.position;
          if (p) after(0.4, () => point(p, 2.4));
        } else deps.say('pz:traveler', F.hints[k], {});
        if (k === 0) {
          // The two pairs, one at a time.
          F.pairs.forEach(([a, b], i) => after(i * 2.4, () => {
            const p = getEntity(w(), thingId(a))?.position;
            const q = getEntity(w(), thingId(b))?.position;
            if (p && q) point({ x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 }, 2);
          }));
        }
        if (k === F.hints.length - 1) startDemo();
        ferry.idle = 0;
        return true;
      }
      const hz = pots ? healerNear() : null;
      if (pots && pots.offered && hz && heroNear(hz.id, OFFER_NEAR)) {
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
  // A wave near the traveler, or near the boat on either bank (#122: on the far bank, after the
  // dog chased the chicken, a wave gave no hint).
  function ferryHint() {
    return Boolean(ferry && ferry.told && st('ferry').solved !== deps.day() && (heroNear('pz:traveler', OFFER_NEAR) || heroNear('ferry:pz', OFFER_NEAR)));
  }
  function heroNear(id, r) {
    const e = getEntity(w(), id);
    const h = hero()?.position;
    return Boolean(e && h && dist(e.position, h) <= r);
  }
}

