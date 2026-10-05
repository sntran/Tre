// The small example of a station of Xóm Ruộng (#37; docs/HAMLET.md). At the start of the first
// round of a visit, the person of the station does the work one time on a smaller instance next to
// the station, with the button picture of each act over the person, and then the child does the
// own round. Worked examples and guided doing win over discovery with no help (Alfieri et al.
// 2011); rule 9 of docs/research/learning-by-doing.md: show on another instance.
//   planting: a small plot (rows of seedlings, one bundle for each row), the count said as words;
//   ducks: a line of ducks and a small trough of their own, the feed poured scoop by scoop;
//   traps: a small order of traps in the stream, upstream of the spots of the child;
//   drum: one short dance with a small drum and dancers of its own.
// The numbers of the example are never the numbers of the round of the child, and its things are
// never in the places of the child (data/world/hamlet.json "examples": the place of each example).
// The steps are the steps of a mentor script (src/core/world/systems/mentor.js); the script ends
// before the round of the child starts, and its things go with it. Pure: no DOM, no WebGL.
import { factKey } from './planting.js';
import { getEntity, addEntity } from './world/state.js';
import { endScript } from './world/systems/mentor.js';

export const ACTS = ['planting', 'ducks', 'traps', 'drum'];
const PACE = 1.6; // seconds for each part of an example (a row, a trap)
const SCOOP = 0.45; // seconds for each scoop of feed
const BEAT = 0.8; // seconds for each beat of the drum
const ROW = 1; // half blocks between two rows of seedlings
const DUCK_STEP = 2; // half blocks between two ducks (as the ducks of the child)
const TRAP_STEP = 2.4; // half blocks between two traps (as the spots of the child)
const DANCER_STEP = 2.2; // half blocks between two dancers
const JUMPS = 3; // the jumps of the dance of an example
const WATER_UP = 1; // half blocks: a trap floats on the water over the bed of the stream

const num = (n) => ({ key: `num.${Math.max(1, Math.min(150, n))}` });

// The numbers of a round of the child, for the choice of the numbers of the example: { facts (fact
// keys), totals (the things that the round needs), groups (the groups of a dance) }.
export function roundNumbers(act, task) {
  if (act === 'planting') {
    const plots = task.map((o) => o.plot ?? o);
    return { facts: plots.map((p) => p.key), totals: plots.map((p) => p.need ?? p.cells), groups: [] };
  }
  if (act === 'drum') return { facts: task.facts.slice(), totals: [], groups: task.groups.slice() };
  return { facts: task.facts.slice(), totals: [task.need], groups: [] };
}

// The numbers of the example: the first try [a, b] that the round of the child does not have (a
// dance: a group of a and b jumps; else a things of b each). A try is the same when it is a fact of
// the round, or its total is a total of the round (a dance: its group is a group of the round).
// With no such try, other small numbers.
export function exampleNumbers(act, round, tries) {
  const free = ([a, b]) => (act === 'drum'
    ? !round.groups.includes(a)
    : !round.facts.includes(factKey(a, b)) && !round.totals.includes(a * b));
  const found = tries.find(free);
  if (found) return found.slice();
  for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) if (free([a, act === 'drum' ? JUMPS : b])) return [a, act === 'drum' ? JUMPS : b];
  return tries[0].slice();
}

// The steps of the script of an example. at: the place of the example (half blocks); who: the id of
// the person; places: the other places of the station that the person points at ({ seedbed }).
// Return { steps, numbers, end } (end: the seconds of the script).
export function exampleSteps(act, numbers, at, who, places = {}) {
  const [a, b] = numbers;
  const steps = [];
  let k = 0; // the index of the next spawned thing (the mentor system keeps them in order)
  const spawn = (t, look, x, z, extra = {}) => {
    steps.push({ at: t, spawn: { look, x, z, ...extra } });
    return k++;
  };
  const say = (t, key, params = {}) => steps.push({ at: t, say: { id: who, key, params } });
  const shows = (t, icon) => steps.push({ at: t, shows: { id: who, icon } });
  const point = (t, p, time = 1.2) => steps.push({ at: t, point: { id: who, x: p.x, z: p.z, time } });
  let t = 0;
  if (act === 'planting') {
    // a rows of b seedlings: the stakes of the small plot, then one bundle for each row.
    say(t, 'example.planting', { n: num(a), m: num(b) });
    point(t, at, 2);
    for (let r = 0; r < a; r++) spawn(t + 0.6, 'plot-stake', at.x - 1, at.z + r * ROW + 0.5);
    for (let c = 0; c < b; c++) spawn(t + 0.6, 'plot-stake', at.x + c + 0.5, at.z - 1);
    t += 2.4;
    for (let r = 0; r < a; r++) {
      shows(t, 'hand-pick');
      if (places.seedbed) point(t, places.seedbed, 0.6);
      shows(t + 0.6, 'hand-put');
      const bundle = spawn(t + 0.6, `bundle-${b}`, at.x + 0.5, at.z + r * ROW + 0.5);
      point(t + 0.6, at, 0.8);
      shows(t + 1.2, 'seedling');
      steps.push({ at: t + 1.2, look: { k: bundle, look: `seedlings-${b}-planted` } });
      say(t + 1.25, `num.${(r + 1) * b}`);
      t += PACE + 0.4;
    }
  } else if (act === 'ducks') {
    // a ducks at a small trough; b scoops for each duck.
    say(t, 'example.ducks', { n: num(a), m: num(b) });
    point(t, at, 2);
    spawn(t + 0.4, `duck-trough-${a}`, at.x, at.z);
    const feed = spawn(t + 0.4, 'trough-feed-0', at.x, at.z);
    const ducks = Array.from({ length: a }, (_, i) => spawn(t + 0.4, 'duck-feed', at.x + 1 + i * DUCK_STEP, at.z - 1.4, { facing: Math.PI }));
    t += 2.4;
    shows(t, 'jar');
    t += 0.4;
    for (let s = 1; s <= a * b; s++) {
      steps.push({ at: t, look: { k: feed, look: `trough-feed-${s}` }, sound: { id: who, sound: s % 5 === 0 ? 'notch' : 'scoop' } });
      say(t + 0.05, `num.${s}`);
      t += SCOOP;
    }
    t += 0.6;
    // The ducks eat in turn: the feed in the trough goes down by a share for each duck.
    ducks.forEach((d, i) => {
      steps.push({ at: t, gesture: { k: d, act: 'peck', t: 0.8 }, look: { k: feed, look: `trough-feed-${(a - i - 1) * b}` }, sound: { id: who, sound: 'peck' } });
      t += 0.9;
    });
  } else if (act === 'traps') {
    // a traps of b fish each, for an order of a × b fish.
    say(t, 'example.traps', { n: num(a), m: num(b), k: num(a * b) });
    point(t, at, 2);
    t += 2.4;
    const traps = [];
    for (let i = 0; i < a; i++) {
      shows(t, 'hand-put');
      const q = { x: at.x, z: at.z + i * TRAP_STEP };
      point(t, q, 0.8);
      traps.push(spawn(t + 0.3, `lo-${b}`, q.x, q.z, { dy: WATER_UP }));
      t += PACE * 0.7;
    }
    shows(t, 'weir');
    t += 0.8;
    traps.forEach((id, i) => {
      steps.push({ at: t, look: { k: id, look: `lo-${b}-full` }, sound: { id: who, sound: 'splash' } });
      say(t + 0.05, `num.${(i + 1) * b}`);
      t += PACE * 0.6;
    });
  } else if (act === 'drum') {
    // A small drum and a dancers; the dancers jump on each a-th beat, three times.
    say(t, 'example.drum', { n: num(a), m: num(2 * a), k: num(3 * a) });
    point(t, at, 2);
    spawn(t + 0.4, 'bronze-drum', at.x, at.z);
    const dancers = Array.from({ length: a }, (_, i) => spawn(t + 0.4, 'dancer-red', at.x + 2 + i * DANCER_STEP, at.z + 3, { facing: Math.PI }));
    t += 2.8;
    shows(t, 'drum');
    for (let beat = 1; beat <= a * JUMPS; beat++) {
      t += BEAT;
      point(t, at, BEAT * 0.8);
      if (beat % a === 0) {
        steps.push({ at: t, sound: { id: who, sound: 'bronze' } });
        for (const d of dancers) steps.push({ at: t, hop: { k: d } });
        say(t + 0.05, `num.${beat}`);
      } else steps.push({ at: t, sound: { id: who, sound: 'drum-small' } });
    }
  }
  t += 1;
  say(t, 'mentor.first.you');
  t += 1.6;
  steps.push({ at: t, end: true });
  steps.sort((x, y) => x.at - y.at);
  return { steps, numbers: act === 'drum' ? [a, JUMPS] : [a, b], end: t };
}

// Play the example of a station in the world (the script example-<act>), one time in a visit
// (shown: the stations of this visit that showed their example). task: the task of the round of
// the child (planting: the plots of the round). Return the seconds of the example, or 0 (no
// example: shown before, or the station has no place for it).
export function playExample(world, env, data, act, task, shown) {
  if (shown.has(act)) return 0;
  const def = data.hamlet?.examples?.[act];
  const place = def ? env.places[def.at] : null;
  const who = getEntity(world, `npc:${data.hamlet?.stations?.[act]}`);
  if (!place || !who) return 0;
  shown.add(act);
  const numbers = exampleNumbers(act, roundNumbers(act, task), def.tries);
  const seedbed = env.places['plant-seedbed'];
  const { steps, end } = exampleSteps(act, numbers, { x: place.x + def.dx, z: place.z + def.dz }, who.id, { seedbed });
  endScript(world, getEntity(world, `script:example-${act}`));
  addEntity(world, { id: `script:example-${act}`, script: { key: `example-${act}`, move: 'example', numbers, t: 0, i: 0, steps, spawned: [] } });
  return end;
}

// The round of the child starts: the example of the station ends, and its things go.
export const stopExample = (world, act) => endScript(world, getEntity(world, `script:example-${act}`));
