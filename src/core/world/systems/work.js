// Work: the Five Trials as tasks in the village (the rules are in ../trials.js, the numbers in
// data/trials.json). The talk of a person starts a task (setupTrial): its things lie in the
// world, and the child works with the hands and with taps (the command "work"). The place system
// carries the things; this system puts them in the zones of the tasks, keeps the timed parts (the
// glow of the iron, the tide), and answers each commit with the world, never with a text:
//   bundle: ten rods tie into a bundle; more or fewer, and the band snaps.
//   forge: the iron hisses in the water and becomes hard; too early or too late, it bends.
//   stakes: at the tide, the fish stay in the trap, or they swim out through the widest space.
//   basket: the healer takes the basket; or gives it back, and the extra herbs fly to their beds.
//   cut: equal sticks tie into a bundle; if not, the short stick breaks and a new stem comes.
//   horse (the iron horse): with the lumps that the smith needs in the hearth, the bellows light
//     the fire, and the iron on the anvil becomes the horse in the water; with too few, the fire
//     puffs and dies; with too many, the extra rolls back to the heap.
//   slash (bamboo staffs for the boss): the child slashes each standing culm of a clump at the
//     height of the hand; the piece is as long as the height of the cut. Equal pieces tie into a
//     bundle of staffs; if not, the pieces that are not equal break, and their culms grow again.
//   share (the loot after a raid): equal sacks of rice on the mats make all happy; if not, Nghé sulks.
//   feed (rice for Gióng): each ten bowls in the pot, Gióng eats and grows one head taller.
//   exact (a small event of the day, ../days.js): things of sizes go on a place (stones under the
//     wheel of a cart, pails of water into the ditch, goods on the mat of a seller, lost ducks into
//     the pen); the action button is the commit of the sum (a tap on the person asks for help). Exact: done. Too few: the person
//     waits. Too many: the last things go back to the pile.
// When a task is done, the event "trial" goes out (the session sets the flag and gives the reward).
export const WRITES = ['work', 'zone', 'item', 'position', 'hidden', 'look', 'keep', 'glow', 'follow', 'solid', 'slide', 'events'];

import { query, getEntity, addEntity, removeEntity, takeWork } from '../state.js';
import { REACH, BASKET_FLOOR, ROLL_STEP, ROLL_TIME, LAY_STEP, springTime, layTime, cutCount, badPiece, SHORT_SHOW, CUT_STAY, CUT_STAY_RIGHT } from '../zones.js';
import { taskOf, basketPlan, MODEL_DOSES, tieResult, glowAt, quenchResult, stakeResult, basketResult, cutResult, staffResult, trialSkill, feedResult, tenResult, hearthResult, shareResult } from '../trials.js';
import { exactResult } from '../days.js';
import { createRng, hashSeed } from '../../rng.js';
import { STEP } from '../step.js';
import { atWork } from './schedule.js';

const BEND = 1.2; // seconds: the bent iron cools before it goes back into the fire
const TIDE_IN = 2.5; // seconds: the tide stands high over the stakes
const TIDE_OUT = 3; // seconds: the tide goes out and shows the trap
const NEW_STEM = 1.2; // seconds: a new culm comes after staffs that are not equal
// The cut of the woodcutter that is not right (#48, #75): the pieces lie side by side while the
// woodcutter counts them (cutCount in src/core/world/zones.js). PIECE_ROW: the space between the
// rows of the pieces (half blocks).
const PILE_GAP = 4; // half blocks from the end of the stem to the wood pile of a practice
// The two stakes that the fisher put himself (the space of the row): not a try of the child.
const FISHER_STAKES = new Set(['stake:fisher:a', 'stake:fisher:b']);
// The row of the fisher at the float (#78): this many seconds with no put or pick, and then the
// water rises, FLOAT_RISE seconds before the tide.
const FLOAT_WAIT = 4;
const FLOAT_RISE = 3;
// The stakes that the fisher brings to an empty pile (#78).
const EMPTY_IDLE = 20; // seconds with an empty pile after the marks of the narrow gaps: then the help (#88)
const NARROW_MARKS = 12; // seconds that the marks of the narrow gaps show
const HELP_WAIT = 1.5; // seconds after the end of the demonstration, before the new stakes
// The band of the teacher that snaps (#48): the rods lie this far from the middle of the mat (half
// blocks) for SPRING_TIME seconds. BUNDLE_STEP: the space of the bundles in their row.
const BUNDLE_STEP = 1.3;
const PIECE_ROW = 2;
const CULM_STEP = 2.5; // half blocks between two culms of the bamboo clump (a row along -z)
const AIM_RISE = 0.45; // seconds: the mark of a slash goes up one half block of the culm in this time
const MAT_MAX = 14; // the most rods on the mat of the teacher
const DEMO_WAIT = 0.8; // seconds: the smith quenches his demo piece this long after it turns hot
const DEMO_NEXT = 1.6; // seconds: then the iron of the child comes on the anvil

const BACK_AGAIN = 1; // seconds: a stake that came back does not go into the same hole with no walk (#97)
const WATER_UP = 1.3; // half blocks over the bed of the river: just over its surface (WATER.river of src/world/terrain.js)
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const PERSON_AWAY = 40; // half blocks: a person farther than this from the hero is not at the task (#51)
const say = (world, type, id, extra = {}) => world.events.push({ type, id, ...extra });
const trialZone = (world, id) => getEntity(world, `zone:trial-${id}`);
const zoneEnt = (world, id) => getEntity(world, `zone:${id}`);

export function work(world, dt, rng, env) {
  for (const e of query(world, 'work', 'position')) {
    for (const want of takeWork(e, () => true)) if (!e.fall) act(world, e, want, env);
  }
  if (world.paused) return;
  for (const e of query(world, 'slide', 'position')) tickSlide(e, dt);
  for (const z of query(world, 'zone')) {
    if (z.zone.rule !== 'trial' || z.zone.done) continue;
    if (z.zone.task === 'forge' || z.zone.task === 'horse') tickForge(world, z, dt, env);
    if (z.zone.task === 'stakes') tickTide(world, z, dt, env);
    if (z.zone.task === 'cut') tickStem(world, z, dt);
    if (z.zone.task === 'bundle') tickSpring(world, z, dt);
    if (z.zone.task === 'basket') tickLay(world, z, dt);
    if (z.zone.task === 'slash') tickSlash(world, z, dt, env);
    if (z.zone.task === 'share') tickShare(world, z, dt, env);
  }
}

// The definition of a trial and the numbers of its task at the level of the child.
function taskFor(env, zone) {
  // A small event of the day keeps its work in its zone.
  if (zone.work) return zone.work;
  const def = env.trials?.trials.find((t) => t.id === zone.trial);
  return def ? taskOf(def, zone.level) : null;
}

// A commit: one skill event, and the count of commits of the trial.
function commit(world, tz, task, result) {
  tz.zone.commits += 1;
  if (!result.solved) tz.zone.fails += 1;
  // Each ten of the rice is a new try of its own (first); in the other tasks only the first commit is.
  say(world, 'skill', tz.id, trialSkill(task, { ...result, first: result.first ?? tz.zone.commits === 1, resets: tz.zone.resets }));
}

// A success that a child sees with the sound off (#62): the person of the task jumps (the session),
// and a small burst of leaves comes from the thing (the view). at: the place of the thing (half
// blocks); end: the end of the task.
function success(world, tz, at = null, end = false) {
  const p = at ?? tz.position;
  say(world, 'success', tz.id, { trial: tz.zone.trial, end, at: { x: p.x, y: p.y, z: p.z } });
}

function finish(world, tz, at = null) {
  tz.zone.done = true;
  success(world, tz, at, true);
  say(world, 'trial', tz.id, { trial: tz.zone.trial, done: true, sound: 'drum' });
}

// The lamp of the work of each kind of task (#65); null: the task has a light of its own.
const LAMPS = Object.freeze({ bundle: 'oil-lamp', stakes: 'work-torch', basket: null, forge: null });

// Set up the things of a trial in the world, at the named places of the map (env.places).
// level: the level of the task (0, 1, or 2). A trial that has its things already stays as it is.
// opts: demo (false: the smith does not show his quench again, in a later round of a practice),
// practice (a visit from a practice link: the places of the task are close together).
export function setupTrial(world, def, level, env, opts = {}) {
  if (trialZone(world, def.id)) return trialZone(world, def.id);
  const task = taskOf(def, level);
  const P = (name) => env.places[name];
  // The share after a raid has no places of the map: it lies behind the wall of the raid (at).
  // A small event of the day has its places in def.at too: the zone of the task is at its place.
  const spot = def.at?.target ?? def.at;
  const first = spot ? { x: spot.x, y: env.groundY(spot.x / 2, spot.z / 2), z: spot.z } : P(Object.values(def.places).flat()[0]);
  const tz = addEntity(world, {
    id: `zone:trial-${def.id}`,
    keep: true,
    zone: { id: `trial-${def.id}`, rule: 'trial', trial: def.id, task: def.task, level, commits: 0, fails: 0, resets: 0, done: false, made: 0 },
    position: { x: first.x, y: first.y, z: first.z, facing: 0 },
  });
  const owner = `trial-${def.id}`;
  // The light of the work at dusk and at night (#65): a lamp at the edge of the work. The healer
  // has the lamp of her basket, and the smith the fire of his forge.
  const lamp = LAMPS[def.task] === undefined ? 'work-lamp' : LAMPS[def.task];
  if (lamp && !def.at) addEntity(world, { id: `lamp:${def.id}`, keep: true, position: { x: first.x - 2.5, y: first.y, z: first.z - 2.5, facing: 0 }, look: lamp });
  const heap = (id, place, accepts, extra = {}) => addEntity(world, {
    id: `zone:${id}`,
    keep: true,
    zone: { id, task: owner, rule: 'heap', accepts, items: [], x: place.x, y: place.y, z: place.z, cols: 4, step: 1, ...extra },
    position: { x: place.x + 1, y: place.y, z: place.z + 1, facing: 0 },
  });
  const things = (zone, kind, n, look = kind) => {
    for (let i = 0; i < n; i++) {
      const id = `${kind}:${def.id}:${tz.zone.made++}`;
      addEntity(world, { id, keep: true, item: { kind, size: 1, task: owner, zone: zone.zone.id, home: zone.zone.id, held: null, set: false }, position: { x: zone.zone.x, y: zone.zone.y, z: zone.zone.z, facing: 0 }, look });
      zone.zone.items.push(id);
    }
    packHeap(world, zone.zone);
    // A heap of a trial is solid: the hero stands next to it, never in it (the box of its full rows).
    if (def.kind === 'task') return;
    const z = zone.zone;
    const step = z.step ?? 1;
    const cols = Math.min(z.cols ?? 4, z.items.length);
    const rows = Math.ceil(z.items.length / (z.cols ?? 4));
    zone.solid = { rect: { x0: z.x - 0.25, x1: z.x + (cols - 1) * step + 0.25, z0: z.z - 0.25, z1: z.z + (rows - 1) * step + 0.25 } };
  };
  const rect = (p, w, d) => ({ x0: p.x - 1, x1: p.x + w + 1, z0: p.z - 1, z1: p.z + d + 1 });

  if (def.task === 'bundle') {
    const m = P(def.places.mat);
    // The heap ends a step before the rect of the mat, so that no rod lies on the mat and a tap on
    // the mat chooses the mat (#47): 8 columns 0.7 apart, a rod as long as about one half block.
    const h = P(def.places.heap);
    const rods = heap('rods', { ...h, x: Math.min(h.x, m.x - 1 - 1 - 1 - 7 * 0.7) }, 'rod', { cols: 8, step: 0.7 });
    things(rods, 'rod', task.rods);
    addEntity(world, { id: 'zone:mat', keep: true, zone: { id: 'mat', task: owner, rule: 'bundle', accepts: 'rod', items: [], x: m.x, y: m.y, z: m.z, tied: 0, rect: rect(m, 7.5, 3) }, position: { x: m.x - 1.5, y: m.y, z: m.z + 1.6, facing: 0 } });
    // For grade 1 and below (level 0), the mat shows the places of a frame of ten; for the grades
    // above it fades, as the representation fades inside a skill (#69).
    // The mat is solid: the hero stands beside it, not on the rods (#69).
    addEntity(world, { id: 'mat:scholar', keep: true, position: { x: m.x, y: m.y, z: m.z, facing: 0 }, look: level <= 0 ? 'mat-frame' : 'mat', solid: { rect: { x0: m.x + 0.1, x1: m.x + 7.1, z0: m.z + 0.2, z1: m.z + 2.8 } } });
    // A coil of straw rope by the mat: only a picture. The tie is at the teacher (the finish of the
    // task), so the coil is no target of a tap (#47).
    addEntity(world, { id: 'band:scholar', keep: true, position: { x: m.x + 8.3, y: m.y, z: m.z + 1.5, facing: 0 }, look: 'band' });
  } else if (def.task === 'forge') {
    // The quench is the skill of this trial (#34): the fire burns when the child comes. The ore is
    // in the forge and the water is in the trough. The smith quenches one piece himself first (the
    // demo), and then the iron of the child goes on the anvil.
    const f = P(def.places.forge);
    const forge = addEntity(world, { id: 'zone:forge', keep: true, zone: { id: 'forge', task: owner, rule: 'forge', accepts: 'ore', items: [], need: task.ore, x: f.x, y: f.y, z: f.z, rect: rect(f, 3, 2) }, position: { x: f.x + 1, y: f.y, z: f.z + 2, facing: 0 } });
    for (let i = 0; i < task.ore; i++) {
      const id = `ore:${def.id}:${tz.zone.made++}`;
      addEntity(world, { id, keep: true, item: { kind: 'ore', size: 1, task: owner, zone: 'forge', held: null, set: true, fixed: true }, position: { x: f.x + 0.5 + i * 0.8, y: f.y + 1, z: f.z + 0.8, facing: 0 }, look: 'ore-hot' });
      forge.zone.items.push(id);
    }
    const t = P(def.places.trough);
    addEntity(world, { id: 'zone:trough', keep: true, zone: { id: 'trough', task: owner, rule: 'trough', accepts: 'bucket', items: [], full: true, x: t.x, y: t.y, z: t.z, rect: rect(t, 3, 2) }, position: { x: t.x + 1.5, y: t.y, z: t.z + 2, facing: 0 } });
    addEntity(world, { id: 'trough:smith', keep: true, position: { x: t.x, y: t.y, z: t.z, facing: 0 }, look: 'trough-full', solid: { rect: { x0: t.x - 0.2, x1: t.x + 3.4, z0: t.z, z1: t.z + 2 } } });
    const a = P(def.places.anvil);
    Object.assign(tz.zone, { anvil: { x: a.x, y: a.y, z: a.z }, heat: 0 });
    if (opts.demo === false) addIron(world, tz, 'iron:smith');
    else {
      Object.assign(tz.zone, { demo: true, iron: 'iron:smith-demo' });
      addIron(world, tz, 'iron:smith-demo');
    }
  } else if (def.task === 'horse') {
    // The done trial of the smith leaves its forge: its ore, its bucket, and its blade go.
    if (def.clears) {
      for (const t of query(world, 'item')) if (t.item.task === `trial-${def.clears}`) removeEntity(world, t.id);
      for (const z of query(world, 'zone')) if (z.zone.task === `trial-${def.clears}`) z.zone.items = [];
    }
    const ore = heap('horse-ore', P(def.places.ore), 'ore', { cols: 3 });
    things(ore, 'ore', task.ore + (def.extra ?? 3));
    const f = P(def.places.forge);
    addEntity(world, { id: 'zone:hearth', keep: true, zone: { id: 'hearth', task: owner, rule: 'hearth', accepts: 'ore', items: [], x: f.x, y: f.y, z: f.z, rect: rect(f, 3, 2) }, position: { x: f.x + 1, y: f.y, z: f.z + 2, facing: 0 } });
    // The bellows by the hearth: a tap on them blows on the fire (the commit of the count).
    addEntity(world, { id: 'bellows:horse', keep: true, item: { kind: 'bellows', size: 1, task: owner, zone: null, held: null, set: true, fixed: true }, position: { x: f.x - 1.2, y: f.y, z: f.z + 1, facing: 0 }, look: 'bellows' });
    const a = P(def.places.anvil);
    Object.assign(tz.zone, { anvil: { x: a.x, y: a.y, z: a.z }, heat: null, iron: 'iron:horse', blows: 0, quenches: 0 });
  } else if (def.task === 'stakes') {
    const stakes = heap('stakes', P(def.places.stakes), 'stake', { cols: 4 });
    const length = task.space * task.gaps;
    things(stakes, 'stake', task.gaps + 1 - 2 + (def.extra ?? 2));
    const l = P(def.places.line);
    const line = addEntity(world, {
      id: 'zone:line',
      keep: true,
      zone: { id: 'line', task: owner, rule: 'line', accepts: 'stake', items: [], x: l.x, y: l.y, z: l.z, length, space: task.space, rect: { x0: l.x - 1, x1: l.x + length + 1, z0: l.z - 2, z1: l.z + 2 } },
      position: { x: l.x + length / 2, y: l.y, z: l.z - 3, facing: 0 },
    });
    // The fisher put the first two stakes: the space between them is the space of the row.
    for (const [n, at] of [['a', 0], ['b', task.space]]) {
      addEntity(world, { id: `stake:fisher:${n}`, keep: true, item: { kind: 'stake', size: 1, task: owner, zone: 'line', held: null, set: true, slot: at }, position: { x: l.x + at, y: l.y, z: l.z, facing: 0 }, look: 'stake-set' });
    }
    addEntity(world, { id: 'mark:fisher:end', keep: true, position: { x: l.x + length, y: l.y, z: l.z, facing: 0 }, look: 'end-mark' });
    addEntity(world, { id: 'tide:fisher', keep: true, position: { x: l.x, y: l.y, z: l.z, facing: 0 }, look: 'tide-0', tide: { length } });
    tz.zone.tide = { t: 0, every: task.tide, phase: 'low' };
    void line;
  } else if (def.task === 'basket') {
    // The basket of the level (#101): the number of each kind, and the numbers of its form.
    const plan = basketPlan(task, def.kinds, createRng(hashSeed(`${world.seed}:${def.id}:${level}:${world.tick}`)));
    tz.zone.plan = plan;
    def.kinds.forEach((kind, i) => {
      const at = P(def.places.beds[i]);
      const bed = heap(`bed-${kind}`, at, `herb-${kind}`, { cols: 4 });
      things(bed, `herb-${kind}`, Math.max(def.bed ?? 7, plan.need[kind] + 3));
      // A small sign with a picture of the herb at the far corner of the bed (#61).
      addEntity(world, { id: `sign:${def.id}:bed-${kind}`, keep: true, position: { x: at.x - 1, y: at.y, z: at.z - 1, facing: 0 }, look: `herb-sign-${kind}` });
    });
    const b = P(def.places.basket);
    // A basket of a number of bunches by fractions (grade 5) has a place for each bunch, in rows of
    // six, so that one half and one third are rows (GRID_ROW).
    const grid = plan.form === 'fraction' ? plan.n : null;
    const depth = grid ? Math.ceil(grid / GRID_ROW) * GRID_STEP : 1.6;
    addEntity(world, { id: 'zone:basket', keep: true, zone: { id: 'basket', task: owner, rule: 'basket', accepts: def.kinds.map((k) => `herb-${k}`), kinds: def.kinds, each: plan.each ?? null, need: plan.need, grid, items: [], x: b.x, y: b.y, z: b.z, rect: rect(b, 3 * BASKET_PART, depth) }, position: { x: b.x + 1.5 * BASKET_PART, y: b.y, z: b.z - 1.5, facing: 0 } });
    addEntity(world, { id: 'basket:healer', keep: true, position: { x: b.x, y: b.y, z: b.z, facing: 0 }, look: grid ? `basket-grid-${grid}` : 'basket' });
    // Each part of the basket has the picture of its herb on the back wall (#61); a basket of places
    // has no parts.
    if (!grid) def.kinds.forEach((kind, k) => addEntity(world, { id: `sign:${def.id}:basket-${kind}`, keep: true, position: { x: b.x + (k + 0.5) * BASKET_PART, y: b.y, z: b.z - 0.1, facing: 0 }, look: `herb-tag-${kind}` }));
    // Grade 3: one dose of the recipe lies on a leaf beside the basket, so that the recipe is seen
    // as things. Grade 4: a model basket of two doses, and two empty leaves: the child can deal its
    // bunches onto the leaves (a press at a leaf puts one), and one leaf is one dose.
    const side = { x: b.x - 4.2, z: b.z + 0.6 };
    if (plan.form === 'doses') {
      addEntity(world, { id: `leaf:${def.id}:dose`, keep: true, position: { x: side.x, y: b.y, z: side.z, facing: 0 }, look: 'herb-leaf' });
      layDose(world, def, plan.recipe, side, b.y, 'dose');
    } else if (plan.form === 'model') {
      const model = heap('model', { x: side.x - 1.2, y: b.y, z: side.z - 2.4 }, def.kinds.map((k) => `herb-${k}`), { cols: 6, step: 0.5 });
      for (const k of def.kinds) {
        for (let i = 0; i < plan.recipe[k] * MODEL_DOSES; i++) {
          const id = `herb-${k}:model:${tz.zone.made++}`;
          addEntity(world, { id, keep: true, item: { kind: `herb-${k}`, size: 1, task: owner, zone: 'model', home: 'model', held: null, set: false, model: true }, position: { ...model.position }, look: `herb-${k}` });
          model.zone.items.push(id);
        }
      }
      model.zone.model = true;
      packHeap(world, model.zone);
      addEntity(world, { id: `basket:${def.id}:model`, keep: true, position: { x: side.x - 1.6, y: b.y, z: side.z - 2.8, facing: 0 }, look: 'basket-small' });
      for (let j = 0; j < MODEL_DOSES; j++) {
        const at = { x: side.x - 1.4 + j * 2.6, y: b.y, z: side.z + 1.2 };
        addEntity(world, { id: `zone:leaf-${j}`, keep: true, zone: { id: `leaf-${j}`, task: owner, rule: 'leaf', accepts: def.kinds.map((k) => `herb-${k}`), kinds: def.kinds, items: [], x: at.x, y: at.y, z: at.z, rect: { x0: at.x - 1.1, x1: at.x + 1.1, z0: at.z - 0.7, z1: at.z + 0.7 } }, position: { x: at.x, y: at.y, z: at.z + 1, facing: 0 } });
        addEntity(world, { id: `leaf:${def.id}:${j}`, keep: true, position: { x: at.x, y: at.y, z: at.z, facing: 0 }, look: 'herb-leaf' });
      }
    }
  } else if (def.task === 'feed') {
    // Trays of 3 and 5 bowls on the path of the paddies, and the pot in front of the house of Gióng.
    const trays = heap('trays', P(def.places.trays), 'bowls', { cols: 3, step: 1.6 });
    for (const [size, n] of Object.entries(def.trays)) for (let i = 0; i < n; i++) addTray(world, trays.zone, Number(size), owner, tz, def.pace);
    packHeap(world, trays.zone);
    const p = P(def.places.pot);
    addEntity(world, { id: 'zone:pot', keep: true, zone: { id: 'pot', task: owner, rule: 'feed', accepts: 'bowls', items: [], x: p.x, y: p.y, z: p.z, rect: rect(p, 2, 2) }, position: { x: p.x + 1, y: p.y, z: p.z + 2.5, facing: 0 } });
    addEntity(world, { id: 'pot:rice', keep: true, position: { x: p.x, y: p.y, z: p.z, facing: 0 }, look: 'rice-pot-0' });
    Object.assign(tz.zone, { ones: 0, heads: 0, group: [], start: 0 });
  } else if (def.task === 'share') {
    // Behind the wall: the pile, and a row of three mats across the road, with the friends
    // behind their mats (the basket of the hero, Nghé, and Gióng).
    const gy = (x, z) => env.groundY(x / 2, z / 2);
    const back = { x: -def.dir.x, z: -def.dir.z };
    const side = { x: -def.dir.z, z: def.dir.x };
    const pt = (b, s) => { const x = def.at.x + back.x * b + side.x * s; const z = def.at.z + back.z * b + side.z * s; return { x, y: gy(x, z), z }; };
    const pile = heap('loot', pt(3, 0), 'sack', { cols: 4, step: 0.9 });
    things(pile, 'sack', def.loot);
    def.who.forEach((who, i) => {
      const m = pt(7, (i - 1) * 3.5);
      addEntity(world, { id: `zone:share-${who}`, keep: true, zone: { id: `share-${who}`, task: owner, rule: 'share', accepts: 'sack', who, items: [], x: m.x, y: m.y, z: m.z, rect: { x0: m.x - 1.4, x1: m.x + 1.4, z0: m.z - 1.4, z1: m.z + 1.4 } }, position: { x: m.x - back.x * 2, y: m.y, z: m.z - back.z * 2, facing: 0 } });
      addEntity(world, { id: `mat:share-${who}`, keep: true, position: { x: m.x, y: m.y, z: m.z, facing: 0 }, look: 'share-mat' });
      // A friend stands behind the mat; where the ground there is not level with the mat (a paddy),
      // in front of it.
      const behind = pt(9, (i - 1) * 3.5);
      const by = Math.abs(behind.y - m.y) < 0.6 ? behind : pt(4.8, (i - 1) * 3.5);
      const face = Math.atan2(-back.x, -back.z) + (by === behind ? 0 : Math.PI);
      if (who === 'hero') addEntity(world, { id: 'by:share-hero', keep: true, position: { ...by, facing: face }, look: 'basket-low' });
      if (who === 'giong') addEntity(world, { id: 'by:share-giong', keep: true, position: { ...by, facing: face }, look: 'giong-hero' });
      const friend = friendOf(world);
      if (who === 'nghe' && friend) friend.follow.goal = { x: by.x, z: by.z, face };
    });
    Object.assign(tz.zone, { loot: def.loot, who: def.who, settled: null, leave: null, face: Math.atan2(-back.x, -back.z) });
  } else if (def.task === 'exact') {
    // A small event of the day: the things of sizes on a pile (or a lost duck alone at each of its
    // places), and the place where they go. The things that are there from the start (the ducks
    // that did not run away) are set.
    const at = (p) => ({ x: p.x, y: env.groundY(p.x / 2, p.z / 2), z: p.z });
    const add = (zone, size, extra = {}, look = def.thing === 'duck' ? 'duck' : `${def.thing}-${size}`) => {
      const id = `${def.thing}:${def.id}:${tz.zone.made++}`;
      addEntity(world, { id, keep: true, item: { kind: def.thing, size, task: owner, zone: zone.zone.id, home: zone.zone.id, held: null, set: false, ...extra }, position: { x: zone.zone.x, y: zone.zone.y, z: zone.zone.z, facing: 0 }, look });
      zone.zone.items.push(id);
      return id;
    };
    // The things of another owner (ducks of another farm) at their own yard: they count on the
    // place too, and too many go back there.
    (def.at.strays ?? []).forEach((p, k) => {
      const h = heap(`${def.id}-stray-${k}`, at(p), def.thing, { cols: 1 });
      add(h, 1, { stray: true }, def.strayLook);
      packHeap(world, h.zone);
    });
    if (def.lost) {
      def.at.lost.forEach((p, k) => {
        const h = heap(`${def.id}-lost-${k}`, at(p), def.thing, { cols: 1 });
        add(h, def.pile[k] ?? 1);
        packHeap(world, h.zone);
      });
    } else {
      // The pile lies in the middle of its free cells (three by three).
      const p = at({ x: def.at.pile.x - 1, z: def.at.pile.z - 1 });
      const pile = heap(`${def.id}-pile`, p, def.thing, { cols: 3, step: 1 });
      for (const size of def.pile) add(pile, size);
      packHeap(world, pile.zone);
    }
    const t = at(def.at.target);
    const place = addEntity(world, { id: `zone:${def.id}-place`, keep: true, zone: { id: `${def.id}-place`, task: owner, rule: 'exact', accepts: def.thing, items: [], x: t.x, y: t.y, z: t.z, rect: { x0: t.x - 2.5, x1: t.x + 2.5, z0: t.z - 2.5, z1: t.z + 2.5 } }, position: { x: t.x, y: t.y, z: t.z + 2.5, facing: 0 } });
    addEntity(world, { id: `mark:${def.id}`, keep: true, position: { ...t, facing: 0 }, look: def.target });
    for (let i = 0; i < (def.keep ?? 0); i++) add(place, 1, { set: true, fixed: true });
    packExact(world, place.zone);
    // The goods of a seller (barter) lie on her tray, for all to see: in front of her, beside the
    // mat (def.at.wares, #42), or else on her side of the mat.
    if (def.give) {
      const [goods, n] = Object.entries(def.give)[0];
      const w = def.at.wares ? at(def.at.wares) : { x: t.x, y: t.y, z: t.z - 3.5 };
      addEntity(world, { id: `wares:${def.id}`, keep: true, position: { x: w.x, y: w.y, z: w.z, facing: 0 }, look: `wares-${goods}-${n}` });
    }
    Object.assign(tz.zone, { work: { id: def.id, skill: def.skill, level: def.level, need: def.need }, need: def.need, day: def.day, event: def.event, give: def.give ?? null });
  } else if (def.task === 'slash') {
    const c = P(def.places.clump);
    Object.assign(tz.zone, { clump: { x: c.x, y: c.y, z: c.z }, pieces: Array(task.parts).fill(null) });
    for (let i = 0; i < task.parts; i++) addCulm(world, tz, task, i);
    // The sample staff of the woodcutter stands at the head of the row: each staff must be as long
    // as it, so that the child looks at the rings (#54: two quick taps cut two equal short staffs).
    if (task.length) addEntity(world, { id: 'sample:staffs', keep: true, item: { kind: 'stump', size: task.length, slot: -1, task: owner, zone: null, held: null, set: true, fixed: true }, position: { x: c.x, y: c.y, z: c.z + CULM_STEP, facing: 0 }, look: `stump-${task.length}` });
  } else if (def.task === 'cut') {
    const s = P(def.places.stem);
    tz.zone.stem = { x: s.x, y: s.y, z: s.z, length: task.length };
    tz.zone.marks = [];
    // The stem is solid: the hero stands beside it, never on it (#75: the body covered the ring of
    // the mark).
    addEntity(world, { id: 'stem:woodcutter', keep: true, item: { kind: 'stem', size: task.length, task: owner, zone: null, held: null, set: true, fixed: true }, position: { x: s.x, y: s.y, z: s.z, facing: Math.PI / 2 }, look: `stem-${task.length}`, solid: { rect: { x0: s.x - 0.2, x1: s.x + task.length + 0.2, z0: s.z - 0.6, z1: s.z + 0.6 } } });
    // The things of the first lines, one new word at a time (#75): a stick of chalk on the ground at
    // the start of the stem, and a sample of equal pieces of a short stick (another thing, not this
    // stem), one piece for each part, side by side. The sample lies by the far end of the stem, away
    // from the woodcutter and the hero who talks to him (#91: it lay under them, and a child did not
    // see "như thế này").
    addEntity(world, { id: 'tool:woodcutter:chalk', keep: true, position: { x: s.x - 1.2, y: s.y, z: s.z + 2.2, facing: 0.4 }, look: 'chalk-stick' });
    for (let i = 0; i < task.parts; i++) addEntity(world, { id: `sample:woodcutter:${i}`, keep: true, position: { x: s.x + task.length - 3, y: s.y, z: s.z + 2.2 + i * 1.3, facing: Math.PI / 2 }, look: 'piece-2' });
    // In a practice the wood pile is next to the end of the stem, so that a round is the math and
    // not a long walk to the bridge (#48).
    const w = opts.practice ? { x: s.x + task.length + PILE_GAP, y: env.groundY((s.x + task.length + PILE_GAP) / 2, s.z / 2), z: s.z } : P(def.places.pile);
    addEntity(world, { id: 'zone:woodpile', keep: true, zone: { id: 'woodpile', task: owner, rule: 'woodpile', accepts: 'sticks', items: [], x: w.x, y: w.y, z: w.z, rect: rect(w, 3, 2) }, position: { x: w.x + 1, y: w.y, z: w.z + 2, facing: 0 } });
    if (!getEntity(world, 'pile:woodcutter')) addEntity(world, { id: 'pile:woodcutter', keep: true, position: { x: w.x, y: w.y, z: w.z, facing: 0 }, look: 'woodpile' });
  }
  // The point of each place of the task is the middle of its rect (the button and the light aim
  // there), and the hero stands at the old point (stand) to work there (#47).
  for (const z of query(world, 'zone')) {
    const r = z.zone.rect;
    if (z.zone.task !== owner || !r || z.zone.stand) continue;
    z.zone.stand = { x: z.position.x, z: z.position.z };
    z.position = { ...z.position, x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
  }
  return tz;
}

// Take away the things of a trial, so that a new round of a practice starts with new things: its
// zones, its things, and the things that only show it (the mat, the trough, the marks, the bundles).
// A person and the friend stay. A hand that held a thing of the trial is empty.
export function clearTrial(world, id) {
  const owner = `trial-${id}`;
  const shows = (e) => !e.item && !e.zone && !e.person && !e.follow && !e.control && String(e.id).split(':')[1] === id;
  for (const e of [...world.entities]) {
    if (e.id === `zone:${owner}` || e.item?.task === owner || e.zone?.task === owner || shows(e)) removeEntity(world, e.id);
  }
  for (const e of query(world, 'hands')) {
    if (e.hands.holds && !getEntity(world, e.hands.holds)) {
      e.hands.holds = null;
      delete e.carry;
    }
  }
}

// A tray of bowls of rice (3 or 5) in the heap on the path of the paddies. pace: the speed factor
// of the walk with a tray of each size (a tray of five is heavy).
function addTray(world, zone, size, owner, tz, pace = {}) {
  const id = `bowls:${size}:${tz.zone.made++}`;
  addEntity(world, { id, keep: true, item: { kind: 'bowls', size, pace: pace?.[size] ?? 1, task: owner, zone: zone.id, home: zone.id, held: null, set: false }, position: { x: zone.x, y: zone.y, z: zone.z, facing: 0 }, look: `bowls-${size}` });
  zone.items.push(id);
}

// The things of a heap lie close together in a small grid (rods, ore, stakes, herbs).
export function packHeap(world, zone) {
  const step = zone.step ?? 1;
  zone.items.forEach((id, i) => {
    const e = getEntity(world, id);
    if (!e) return;
    const col = i % (zone.cols ?? 4);
    const row = Math.floor(i / (zone.cols ?? 4));
    e.position = { x: zone.x + col * step, y: zone.y, z: zone.z + row * step, facing: e.item.kind === 'rod' ? ((i * 7) % 5) * 0.3 : 0 };
  });
}

// The rods on the mat lie in rows of five, with a space between two rods: a full row is five, and
// two full rows are ten (#61). A child sees how many in a known pattern, as in a frame of ten. The
// rods over ten (a wrong tie) lie outside the frame, beside it.
export const MAT_ROW = 5;
export const MAT_GAP = 1.0; // half blocks from the middle of a rod to the next one
export const MAT_ROW_GAP = 1.8; // half blocks from a row of rods to the next one
export const MAT_TEN = 10; // the places of the frame
export const MAT_FRAME = MAT_ROW * MAT_GAP; // half blocks: the length of the frame of ten
const MAT_SIDE = MAT_FRAME + 0.9; // half blocks from the start of the mat: the rods over ten
const MAT_SIDE_GAP = 1.0;
const MAT_Z = 0.7; // half blocks from the north edge of the mat to the middle of the first row
// The place of the rod i on the mat: two rows of five (a frame of ten, #69), and the rods over ten
// outside the frame, beside it, in two columns (#87, #98: the rods looked stacked, and a child could
// not count them). Between two rods there is a space wider than a rod.
export function matSlot(zone, i) {
  if (i >= MAT_TEN) {
    const k = i - MAT_TEN;
    return { x: zone.x + MAT_SIDE + (k % 2) * MAT_SIDE_GAP, z: zone.z + MAT_Z + Math.floor(k / 2) * MAT_ROW_GAP };
  }
  return { x: zone.x + MAT_GAP / 2 + (i % MAT_ROW) * MAT_GAP, z: zone.z + MAT_Z + Math.floor(i / MAT_ROW) * MAT_ROW_GAP };
}
function packMat(world, zone) {
  zone.items.forEach((id, i) => {
    const e = getEntity(world, id);
    const p = matSlot(zone, i);
    if (e) e.position = { x: p.x, y: zone.y + 0.15, z: p.z, facing: 0 };
  });
}

// The things in the basket, by kind: one part of the basket for each kind.
// The basket of the healer has three parts, BASKET_PART half blocks wide, one for each kind. The
// bunches stand up in a row in their part, so that each bunch shows from the camera (#61).
export const BASKET_PART = 1.6;
// A basket of places (grade 5, #101): rows of GRID_ROW places, GRID_STEP half blocks apart. The
// bunches fill the places in the order of the kinds of one half, one third, and the rest.
export const GRID_ROW = 6;
export const GRID_STEP = 0.8;
export const gridAt = (zone, i) => ({ x: zone.x + 0.4 + (i % GRID_ROW) * GRID_STEP, z: zone.z + 0.4 + Math.floor(i / GRID_ROW) * GRID_STEP });
function packBasket(world, zone) {
  if (zone.grid) {
    const order = [...zone.kinds].reverse();
    const list = zone.items.map((id) => getEntity(world, id)).filter((e) => e && !e.item.set)
      .sort((a, b) => order.indexOf(a.item.kind.slice(5)) - order.indexOf(b.item.kind.slice(5)));
    list.forEach((e, i) => {
      const p = gridAt(zone, i);
      e.position = { x: p.x, y: zone.y + BASKET_FLOOR, z: p.z, facing: 0 };
    });
    return;
  }
  const n = {};
  for (const id of zone.items) {
    const e = getEntity(world, id);
    if (!e || e.item.set) continue;
    const k = zone.kinds.indexOf(e.item.kind.slice(5));
    const i = (n[k] = (n[k] ?? -1) + 1);
    // More than eight bunches of a kind: rows of five, closer (doses of a recipe, #101).
    const cols = (zone.need?.[zone.kinds[k]] ?? 0) > 8 ? 5 : 4;
    const step = cols === 5 ? 0.27 : 0.34;
    e.position = { x: zone.x + 0.3 + k * BASKET_PART + (i % cols) * step, y: zone.y + BASKET_FLOOR, z: zone.z + 0.45 + Math.floor(i / cols) * (cols === 5 ? 0.42 : 0.6), facing: 0 };
  }
}

// A dose of the recipe as things on a leaf (#101): each kind in its row, the bunches side by side.
// They only show the recipe: no tap takes them.
function layDose(world, def, recipe, at, y, tag) {
  def.kinds.forEach((k, row) => {
    for (let i = 0; i < recipe[k]; i++) addEntity(world, { id: `${tag}:${def.id}:${k}:${i}`, keep: true, position: { x: at.x - 0.6 + i * 0.45, y: y + 0.05, z: at.z - 0.45 + row * 0.45, facing: 0 }, look: `herb-${k}` });
  });
}
// The bunches on a leaf of the model (#101): each kind in its row.
function packLeaf(world, zone) {
  const n = {};
  for (const id of zone.items) {
    const e = getEntity(world, id);
    if (!e) continue;
    const row = zone.kinds.indexOf(e.item.kind.slice(5));
    const i = (n[row] = (n[row] ?? -1) + 1);
    e.position = { x: zone.x - 0.7 + i * 0.4, y: zone.y + 0.05, z: zone.z - 0.45 + row * 0.45, facing: 0 };
  }
}

// After a wrong give, the healer lays each kind in a row in front of the basket (#61): row k is the
// kind k of the basket, and the bunch i of a row lies at basketRowAt(zone, k, i).
export const ROW_GAP = 0.7;
export function basketRowAt(zone, row, i) {
  return { x: zone.rect.x0 + 1 + i * ROW_GAP, z: zone.rect.z1 + 0.6 + row * 0.9 };
}

// A thing goes back to its heap.
export function toHeap(world, thing) {
  const home = thing.item.home ? zoneEnt(world, thing.item.home) : null;
  if (!home) return;
  thing.item.zone = home.zone.id;
  thing.item.held = null;
  thing.hidden = false;
  if (!home.zone.items.includes(thing.id)) home.zone.items.push(thing.id);
  packHeap(world, home.zone);
}

// A thing goes back from its place to its own heap: the end of the first step that a person
// shows (src/core/world/systems/mentor.js), and the undo of a drag. Return true when it went back.
export function backHome(world, thing) {
  if (!thing?.item?.home || thing.item.held || thing.item.zone === thing.item.home) return false;
  takeOut(world, thing);
  delete thing.item.slot;
  toHeap(world, thing);
  return true;
}

// The person of a task puts a thing of the pile into the place for the child (a move of the mentor:
// smaller or share, src/core/mentor.js). Return true when the thing went in.
export function handPut(world, person, thing, zoneEnt, env) {
  if (!thing?.item || thing.item.held || thing.item.set || !zoneEnt?.zone) return false;
  const zone = zoneEnt.zone;
  takeOut(world, thing);
  if (zone.rule === 'bundle') {
    thing.item.zone = zone.id;
    zone.items.push(thing.id);
    packMat(world, zone);
    say(world, 'add', zoneEnt.id, { item: thing.id, by: person.id, sound: 'tap' });
    return true;
  }
  return putWork(world, person, zone, thing, null, env);
}

// Take a thing out of the zone where it lies (a take back with the hands too: src/core/world/systems/place.js).
export function takeOut(world, thing) {
  const z = thing.item.zone ? zoneEnt(world, thing.item.zone) : null;
  if (!z) return;
  z.zone.items = z.zone.items.filter((i) => i !== thing.id);
  if (z.zone.rule === 'heap') packHeap(world, z.zone);
  if (z.zone.rule === 'leaf') packLeaf(world, z.zone);
  if (z.zone.rule === 'bundle') packMat(world, z.zone);
  if (z.zone.rule === 'basket') packBasket(world, z.zone);
  if (z.zone.rule === 'hearth') packHearth(world, z.zone);
  if (z.zone.rule === 'share') packShare(world, z.zone);
  if (z.zone.rule === 'exact') packExact(world, z.zone);
}

// The sacks on a mat lie in rows of three, and then in a second layer.
function packShare(world, zone) {
  zone.items.forEach((id, i) => {
    const e = getEntity(world, id);
    if (e) e.position = { x: zone.x + (i % 3) * 0.8 - 0.8, y: zone.y + 0.1 + Math.floor(i / 6) * 0.9, z: zone.z + (Math.floor(i / 3) % 2) * 0.8 - 0.4, facing: 0 };
  });
}

// The lumps in the hearth lie in rows of four.
function packHearth(world, zone) {
  zone.items.forEach((id, i) => {
    const e = getEntity(world, id);
    if (e) e.position = { x: zone.x + 0.5 + (i % 4) * 0.8, y: zone.y + 1, z: zone.z + 0.6 + Math.floor(i / 4) * 0.8, facing: 0 };
  });
}

// The things on the place of a small event lie in rows of four (a duck in a pen: in rows of three).
function packExact(world, zone) {
  const cols = zone.accepts === 'duck' ? 3 : 4;
  const step = zone.accepts === 'duck' ? 1.4 : 1;
  zone.items.forEach((id, i) => {
    const e = getEntity(world, id);
    if (e) e.position = { x: zone.x - 1.5 + (i % cols) * step, y: zone.y + (zone.accepts === 'duck' ? 0 : 0.2), z: zone.z - 1.2 + Math.floor(i / cols) * step, facing: zone.accepts === 'duck' ? (i % 4) * 1.5 : 0 };
  });
}

// The free spot of a zone of spots nearest to a point (half blocks), or the first free spot with
// no point. Return its index, or -1 when every spot has a thing.
export function freeSlot(world, zone, at = null) {
  const taken = new Set(zone.items.map((id) => getEntity(world, id)?.item.slot));
  let best = -1;
  let bestD = Infinity;
  zone.slots.forEach((q, k) => {
    if (taken.has(k)) return;
    const d = at ? Math.hypot(q.x - at.x, q.z - at.z) : k;
    if (d < bestD) {
      best = k;
      bestD = d;
    }
  });
  return best;
}

// Can the hero take this thing? A thing that is set (the stakes of the fisher, a stem) cannot
// move; the stakes on the line wait for the tide while the tide is in.
export function canTakeWork(world, thing) {
  if (thing.item.fixed || thing.item.set) return false;
  // The thing of an example that a person shows (the first step) is the person's until the person
  // takes it back: a press of the child during the example never takes it (#61).
  if (query(world, 'script').some((e) => e.script.put?.includes(thing.id))) return false;
  if (thing.item.zone === 'forge') return false;
  if (thing.item.task === 'trial-share' && trialZone(world, 'share')?.zone.leave !== null) return false;
  if (thing.item.zone === 'hearth') return trialZone(world, 'horse')?.zone.heat === null;
  if (thing.item.zone === 'line') {
    const tz = trialZone(world, 'fisher');
    return tz?.zone.tide?.phase === 'low';
  }
  return true;
}

// Can the hero give the basket to the healer now (#79: the button showed the basket, and a press
// did nothing, because the button and the world had two rules)? The basket has bunches and no
// count lies in rows, and the hero is next to the basket, or next to the healer while she is at her
// beds. The button of the session and the give of the world use this one rule.
const GIVE_AT_BEDS = 16; // half blocks: the healer this near the basket is at her beds
export function giveReady(world, at) {
  const tz = trialZone(world, 'healer');
  const basket = zoneEnt(world, 'basket');
  if (!tz || tz.zone.done || tz.zone.lay || !basket?.zone.items.length || !at) return false;
  if (dist(at, basket.position) <= REACH + 4) return true;
  const healer = query(world, 'person').find((p) => p.person.ref === 'healer' && !p.hidden);
  return Boolean(healer && dist(at, healer.position) <= REACH + 3 && dist(healer.position, basket.position) <= GIVE_AT_BEDS);
}

// Has a place of a task room for one more thing now? The mat of the teacher takes MAT_MAX rods
// (#68: the button showed the put on a full mat, and the press did nothing).
export function hasRoom(zone) {
  if (zone.rule === 'bundle') return zone.items.length < MAT_MAX;
  return true;
}

// The place system gives a thing in the hands to a zone of a task. at: the point of the tap (the
// line of stakes). Return true when the thing went in.
export function putWork(world, e, zone, thing, at, env) {
  const tz = trialZone(world, thing.item.task.slice(6));
  if (!tz) return false;
  if (zone.rule === 'heap') {
    // The bunches of the model basket go back only to it, and the others only to their beds (#101).
    if (Boolean(zone.model) !== Boolean(thing.item.model)) return false;
    thing.item.zone = zone.id;
    zone.items.push(thing.id);
    packHeap(world, zone);
  } else if (zone.rule === 'bundle') {
    if (zone.items.length >= MAT_MAX) return false;
    thing.item.zone = zone.id;
    zone.items.push(thing.id);
    packMat(world, zone);
  } else if (zone.rule === 'hearth') {
    if (tz.zone.heat !== null) return false;
    thing.item.zone = zone.id;
    zone.items.push(thing.id);
    packHearth(world, zone);
  } else if (zone.rule === 'share') {
    if (tz.zone.leave !== null) return false;
    thing.item.zone = zone.id;
    zone.items.push(thing.id);
    packShare(world, zone);
  } else if (zone.rule === 'line') {
    if (tz.zone.tide?.phase !== 'low') return false;
    const slot = Math.max(1, Math.min(zone.length, Math.round((at?.x ?? zone.x) - zone.x)));
    const taken = query(world, 'item').some((s) => s.item.zone === 'line' && s.item.slot === slot && s.id !== thing.id);
    if (taken) return false;
    // A stake that comes back goes to a new place (#97: after a take-back, a press at once put the
    // stake into the same hole): a put from the point where it came from, with no walk, in the first
    // second, does nothing.
    const from = thing.item.from;
    if (from?.zone === zone.id && world.tick - from.tick < BACK_AGAIN / STEP && dist(e.position, from.at) < 1) return false;
    delete thing.item.from;
    thing.item.zone = zone.id;
    thing.item.slot = slot;
    zone.items.push(thing.id);
    thing.position = { x: zone.x + slot, y: zone.y, z: zone.z, facing: 0 };
  } else if (zone.rule === 'basket') {
    // A bunch of the model basket stays out of the basket of the child (#101).
    if (thing.item.model) return false;
    thing.item.zone = zone.id;
    zone.items.push(thing.id);
    packBasket(world, zone);
  } else if (zone.rule === 'leaf') {
    if (!thing.item.model) return false;
    thing.item.zone = zone.id;
    zone.items.push(thing.id);
    packLeaf(world, zone);
  } else if (zone.rule === 'feed') {
    feed(world, tz, thing, env);
    return true;
  } else if (zone.rule === 'exact') {
    thing.item.zone = zone.id;
    zone.items.push(thing.id);
    packExact(world, zone);
    // A duck walks from the hands of the hero to the others in the pen (#100: a duck went in with
    // no sign, and a child could not tell).
    if (thing.item.kind === 'duck') walkFrom(thing, e.position);
  } else if (zone.rule === 'spots') {
    // A spot for one thing (a fish trap in the stream): the free spot nearest to the tap.
    const k = freeSlot(world, zone, at);
    if (k < 0) return false;
    thing.item.zone = zone.id;
    thing.item.slot = k;
    zone.items.push(thing.id);
    thing.position = { x: zone.slots[k].x, y: zone.y, z: zone.slots[k].z, facing: 0 };
  } else if (zone.rule === 'woodpile') {
    thing.item.zone = zone.id;
    thing.item.set = true;
    zone.items.push(thing.id);
    thing.position = { x: zone.x + 0.5, y: zone.y, z: zone.z + 0.5, facing: Math.PI / 2 };
    finish(world, tz, thing.position);
  } else return false;
  say(world, 'put', e.id, { item: thing.id, zone: zone.id, sound: thingSound(thing) });
  return true;
}

// The sound of a thing that goes down: a duck quacks; other things knock (#100).
export const thingSound = (thing) => (thing?.item?.kind === 'duck' ? 'quack' : 'plank-down');
const WALK_PACE = 2.5; // half blocks each second: a duck that walks to its place
// A thing that walks from a point to its place now (a duck): a slide with the time of a walk, and
// the thing turns the way that it goes.
export function walkFrom(thing, from) {
  const to = { ...thing.position };
  const d = Math.hypot(to.x - from.x, to.z - from.z);
  if (d < 0.3) return;
  thing.slide = { from: { ...to, x: from.x, z: from.z }, to, t: 0, time: Math.max(0.4, Math.min(3, d / WALK_PACE)), face: true, set: thing.item?.set ?? false };
  thing.position = { ...thing.slide.from, facing: Math.atan2(to.x - from.x, to.z - from.z) };
}

// The work of the hands: tie (the teacher ties the rods on the mat), exact (the person of a small
// event checks the place), blow (the bellows), quench (the iron into the water), give (the basket
// to the healer), mark (a chalk mark on the stem, or away), aim and slash (a culm of the staffs),
// and cut (the woodcutter cuts at the marks).
function act(world, e, want, env) {
  const tz = trialZone(world, want.trial);
  if (!tz || tz.zone.done) return;
  const task = taskFor(env, tz.zone);
  if (!task) return;
  const near = (p, r = REACH + 2) => p && dist(e.position, p) <= r;
  const thing = want.item ? getEntity(world, want.item) : null;
  if (want.act === 'tie') {
    // The teacher ties the rods on the mat (the hero stands at the teacher, or at the mat).
    const mat = zoneEnt(world, 'mat');
    const teacher = query(world, 'person').find((p) => p.person.ref === 'teacher');
    if (!mat || !mat.zone.items.length || tz.zone.spring || !(near(mat.position, REACH + 3) || near(teacher?.position, REACH + 3))) return;
    const n = mat.zone.items.length;
    const solved = tieResult(n, task.bundle);
    commit(world, tz, task, { solved, parts: [n], target: task.bundle });
    if (solved) {
      // Ten rods tie into a bundle, and the bundle goes to the row by the teacher.
      for (const id of mat.zone.items) removeEntity(world, id);
      mat.zone.items = [];
      const k = mat.zone.tied++;
      // The bundles stand in a row on the side of the mat away from the teacher and the heap, in
      // view of the work (#48).
      const r = mat.zone.rect;
      const bundle = addEntity(world, { id: `bundle:scholar:${k}`, keep: true, position: { x: r.x0 + 1.4 + k * BUNDLE_STEP, y: mat.zone.y, z: r.z1 + 1.2, facing: Math.PI / 2 }, look: 'rod-bundle' });
      say(world, 'tie', mat.id, { sound: 'plank-up' });
      const heapZone = zoneEnt(world, 'rods');
      if ((heapZone?.zone.items.length ?? 0) < task.bundle) finish(world, tz, bundle.position);
      else {
        success(world, tz, bundle.position);
        // A right part has its line (#74: the pip turned orange, and nobody spoke).
        const teacher = getEntity(world, 'npc:teacher');
        if (teacher && !teacher.hidden) say(world, 'call', teacher.id, { key: 'scholar.tied', params: { n: { key: `num.${k + 1}` } }, happened: true });
        // He says at once how many bundles are left, and the heap glows (#96: after the first
        // bundle nobody spoke, and the children guessed from the goal bar).
        const left = Math.floor((heapZone?.zone.items.length ?? 0) / task.bundle);
        if (teacher && !teacher.hidden && left > 0) say(world, 'call', teacher.id, { key: 'scholar.more', params: { n: { key: `num.${left}` } }, happened: true });
        if (left > 0) world.events.push({ type: 'glowThings', ids: [...heapZone.zone.items] });
      }
    } else {
      // The band snaps (a puff of dust), and the rods stay on the mat in their rows, so that the
      // teacher counts them aloud with the child (#61: before, all the rods went back to the heap,
      // and the count counted nothing). After the count, only the rods over a bundle roll back to
      // the heap, one at a time. With too few, all the rods stay. While the extra rods wait, a tap
      // does not take them.
      const c = { x: (mat.zone.rect.x0 + mat.zone.rect.x1) / 2, z: (mat.zone.rect.z0 + mat.zone.rect.z1) / 2 };
      const extra = mat.zone.items.slice(task.bundle);
      for (const id of extra) {
        const rod = getEntity(world, id);
        if (rod) rod.item.set = true;
      }
      if (extra.length) tz.zone.spring = { t: springTime(n), ids: extra };
      say(world, 'snap', mat.id, { count: n, at: { x: c.x, z: c.z }, sound: 'plank-down' });
    }
  } else if (want.act === 'exact') {
    // The person of a small event checks the work: the sum of the sizes on the place is the commit.
    const place = zoneEnt(world, `${task.id}-place`);
    if (!place || !(near(place.position, REACH + 6) || near(getEntity(world, `event:${task.id}`)?.position, REACH + 3))) return;
    const things = place.zone.items.map((id) => getEntity(world, id)).filter(Boolean);
    const brought = things.filter((t) => !t.item.fixed);
    if (!brought.length) return say(world, 'short', place.id, { sound: 'tap' });
    const sum = things.reduce((a, t) => a + t.item.size, 0);
    // A thing of another owner on the place (a duck of another farm) is never right: it goes back
    // to its own yard, and the person says why.
    const strays = brought.filter((t) => t.item.stray);
    const r = strays.length ? { solved: false, over: strays.length } : exactResult(sum, task.need);
    commit(world, tz, task, { solved: r.solved, parts: brought.map((t) => t.item.size), target: task.need });
    if (strays.length) {
      for (const t of strays) {
        place.zone.items = place.zone.items.filter((id) => id !== t.id);
        toHeap(world, t);
      }
      packExact(world, place.zone);
      say(world, 'roll', place.id, { sound: 'plank-down' });
    } else if (r.solved) {
      for (const t of things) t.item.set = true;
      say(world, 'exact', place.id, { sound: 'plank-up' });
      finish(world, tz, place.position);
    } else if (r.over) {
      // Too many: the last things go back to the pile, until the place is not over.
      let rest = sum;
      while (rest > task.need && brought.length) {
        const t = brought.pop();
        place.zone.items = place.zone.items.filter((id) => id !== t.id);
        rest -= t.item.size;
        toHeap(world, t);
      }
      packExact(world, place.zone);
      say(world, 'roll', place.id, { sound: 'plank-down' });
    } else {
      say(world, 'short', place.id, { sound: 'tap', n: sum });
    }
  } else if (want.act === 'blow') {
    // The bellows: the count of the lumps in the hearth is the commit.
    const hearth = zoneEnt(world, 'hearth');
    if (!hearth || tz.zone.heat !== null || !near(hearth.position, REACH + 3)) return;
    const count = hearth.zone.items.length;
    const r = hearthResult(count, task.ore);
    tz.zone.blows += 1;
    commit(world, tz, { ...task, ...task.count }, { solved: r.solved, first: tz.zone.blows === 1, parts: [count], target: task.ore });
    if (r.solved) {
      // The fire burns high: the lumps melt, and the iron lies on the anvil.
      for (const id of hearth.zone.items) removeEntity(world, id);
      hearth.zone.items = [];
      const a = tz.zone.anvil;
      addEntity(world, { id: tz.zone.iron, keep: true, item: { kind: 'iron', size: 2, task: `trial-${tz.zone.trial}`, zone: null, held: null, set: true, fixed: true }, position: { x: a.x, y: a.y + 1, z: a.z, facing: Math.PI / 2 }, look: 'iron-0', solid: { rect: { x0: a.x - 0.8, x1: a.x + 0.8, z0: a.z - 0.8, z1: a.z + 0.8 } } });
      tz.zone.heat = 0;
      say(world, 'fire', tz.id, { sound: 'lantern' });
    } else if (r.short) {
      say(world, 'puff', hearth.id, { sound: 'tap' });
    } else {
      // The fire chokes: the extra lumps roll back to the heap.
      for (let i = 0; i < r.over; i++) {
        const lump = getEntity(world, hearth.zone.items.pop());
        if (lump) toHeap(world, lump);
      }
      packHearth(world, hearth.zone);
      say(world, 'roll', hearth.id, { sound: 'plank-down' });
    }
  } else if (want.act === 'quench') {
    const iron = getEntity(world, tz.zone.iron ?? 'iron:smith');
    if (!iron || tz.zone.heat === null || tz.zone.bent || tz.zone.demo || !near(tz.zone.anvil, REACH + 3)) return;
    const value = glowAt(tz.zone.heat, task.glow, task.hold);
    const solved = quenchResult(value, task.glow);
    if (tz.zone.quenches !== undefined) tz.zone.quenches += 1;
    commit(world, tz, task, { solved, first: tz.zone.quenches === undefined ? undefined : tz.zone.quenches === 1, parts: [Math.round(value * 10)], target: Math.round(task.glow.hot * 10) });
    if (solved) {
      iron.look = task.made ?? 'blade';
      iron.item.set = true;
      tz.zone.heat = null;
      say(world, 'hiss', iron.id, { sound: 'sizzle', at: iron.position });
      finish(world, tz, iron.position);
    } else {
      iron.look = 'iron-bent';
      tz.zone.bent = BEND;
      const early = value > 0 && tz.zone.heat % (task.glow.rise + task.hold + task.glow.dim + task.glow.cold) < task.glow.rise;
      say(world, 'bend', iron.id, { sound: 'plank-down', early });
      // The smith says what happened first, in words that a child knows (#70): not hot enough yet,
      // or cold again.
      say(world, 'call', 'npc:smith', { key: early ? 'smith.bend.early' : 'smith.bend.late', happened: true });
    }
  } else if (want.act === 'give') {
    const basket = zoneEnt(world, 'basket');
    const healer = query(world, 'person').find((p) => p.person.ref === 'healer');
    if (!giveReady(world, e.position)) return;
    const counts = {};
    for (const id of basket.zone.items) {
      const k = getEntity(world, id)?.item.kind.slice(5);
      if (k) counts[k] = (counts[k] ?? 0) + 1;
    }
    const need = basket.zone.need ?? task.each;
    const want = (k) => (typeof need === 'number' ? need : need[k]);
    const result = basketResult(counts, basket.zone.kinds, need);
    commit(world, tz, task, { solved: result.solved, parts: basket.zone.kinds.map((k) => counts[k] ?? 0), target: basket.zone.kinds.reduce((a, k) => a + want(k), 0) });
    if (result.solved) {
      for (const id of basket.zone.items) removeEntity(world, id);
      basket.zone.items = [];
      const b = getEntity(world, 'basket:healer');
      if (b) b.look = 'basket-full';
      say(world, 'given', basket.id, { sound: 'pickup' });
      finish(world, tz, b?.position);
    } else {
      // The healer takes the bunches out and lays each kind in a row in front of the basket, so
      // that she counts each row aloud with the child (#61: before, the extra herbs flew back at
      // once, and the count counted nothing). After the count, only the bunches over the number go
      // back to their beds, one at a time, and the rest go back into the basket. While they lie in
      // the rows, a tap does not take them.
      const extra = [];
      basket.zone.kinds.forEach((k, row) => {
        const bunches = basket.zone.items.map((id) => getEntity(world, id)).filter((h) => h?.item.kind === `herb-${k}`);
        bunches.forEach((h, i) => {
          h.item.set = true;
          h.position = { ...basketRowAt(basket.zone, row, i), y: basket.zone.y, facing: 0 };
          if (i >= want(k)) extra.push(h.id);
        });
      });
      const n = basket.zone.items.length;
      // The count of the healer: each bunch, and the empty end of each short row (src/core/mentoring.js).
      const extraKinds = new Set(extra.map((id) => getEntity(world, id)?.item.kind)).size;
      tz.zone.lay = { t: layTime(n, basket.zone.kinds.length, extraKinds), ids: extra.reverse() };
      say(world, 'nope', healer?.id ?? basket.id, { sound: 'tap' });
    }
  } else if (want.act === 'mark') {
    const stem = getEntity(world, 'stem:woodcutter');
    const s = tz.zone.stem;
    if (!stem || stem.hidden || tz.zone.cut) return;
    const at = Math.round(want.at);
    if (at <= 0 || at >= s.length) return;
    const id = `chalk:woodcutter:${at}`;
    const off = tz.zone.marks.includes(at);
    if (off) {
      tz.zone.marks = tz.zone.marks.filter((m) => m !== at);
      tz.zone.resets += 1;
      removeEntity(world, id);
    } else {
      tz.zone.marks.push(at);
      addEntity(world, { id, keep: true, position: { x: s.x + at, y: s.y, z: s.z, facing: 0 }, look: 'chalk-band' });
    }
    say(world, 'mark', stem.id, { at, off, sound: 'tap' });
  } else if (want.act === 'aim') {
    // While the button is down, the mark of the slash goes up the culm, one ring at a time.
    const culm = getEntity(world, `culm:staffs:${want.culm}`);
    if (!culm || tz.zone.cut) return;
    tz.zone.aim = { culm: want.culm, at: 1, t: 0 };
    // A second press (a double tap) starts the mark again at the first ring.
    removeEntity(world, 'aim:staffs');
    addEntity(world, { id: 'aim:staffs', position: { ...culm.position, y: culm.position.y + 1 }, look: 'chalk' });
  } else if (want.act === 'slash') {
    // A slash at the height of the hand on a standing culm: the top falls away, and the piece from
    // the ground to the cut stands in its place (the staff). The pieces stand side by side in the
    // row, so that the heights are easy to compare.
    const c = tz.zone.clump;
    const i = want.culm;
    const culm = getEntity(world, `culm:staffs:${i}`);
    // The height of the slash: the mark that went up while the button was down.
    const aim = tz.zone.aim;
    delete tz.zone.aim;
    removeEntity(world, 'aim:staffs');
    if (want.at == null && aim?.culm !== i) return;
    // The height by the time of the touch when the view sends it (#81), else by the time of the world.
    const byTouch = want.held != null && aim?.culm === i ? Math.min(task.reach, 1 + Math.floor(want.held / AIM_RISE)) : null;
    const at = Math.round(want.at ?? byTouch ?? aim.at);
    if (!c || !culm || tz.zone.cut || at < 1 || at >= task.height) return;
    if (at > task.reach) return say(world, 'high', tz.id, { culm: i, sound: 'tap' });
    removeEntity(world, culm.id);
    tz.zone.pieces[i] = at;
    addEntity(world, { id: `stump:staffs:${i}`, keep: true, item: { kind: 'stump', size: at, slot: i, task: 'trial-staffs', zone: null, held: null, set: true, fixed: true }, position: { ...culm.position }, look: `stump-${at}` });
    say(world, 'slash', tz.id, { culm: i, at, sound: 'plank-up' });
    if (tz.zone.pieces.includes(null)) return;
    const result = staffResult(tz.zone.pieces, task.length ?? null);
    commit(world, tz, task, { solved: result.solved, parts: [...tz.zone.pieces], target: task.height });
    if (result.solved) {
      // Equal staffs, tied into a bundle for the men of the village.
      tz.zone.pieces.forEach((_, j) => removeEntity(world, `stump:staffs:${j}`));
      removeEntity(world, 'sample:staffs');
      addEntity(world, { id: 'staffs:bamboo', keep: true, position: { x: c.x + 3, y: c.y, z: c.z - (task.parts - 1) * CULM_STEP / 2, facing: 0 }, look: `staffs-${task.parts}` });
      say(world, 'chop', tz.id, { sound: 'plank-up', pieces: [...tz.zone.pieces] });
      finish(world, tz, getEntity(world, 'staffs:bamboo')?.position);
    } else {
      // The pieces that are not equal to the others break, and their culms grow again.
      const pieces = [...tz.zone.pieces];
      for (const j of result.broken) {
        removeEntity(world, `stump:staffs:${j}`);
        tz.zone.pieces[j] = null;
      }
      tz.zone.cut = NEW_STEM;
      say(world, 'snap', tz.id, { pieces, broken: result.broken, sound: 'plank-down' });
    }
  } else if (want.act === 'cut') {
    const s = tz.zone.stem;
    const person = query(world, 'person').find((p) => p.person.ref === 'woodcutter');
    if (!s || !tz.zone.marks.length || tz.zone.cut || (person && !near(person.position, REACH + 3))) return;
    const result = cutResult(tz.zone.marks, s.length, task.parts);
    commit(world, tz, task, { solved: result.solved, parts: result.pieces, target: s.length });
    for (const m of tz.zone.marks) removeEntity(world, `chalk:woodcutter:${m}`);
    tz.zone.marks = [];
    const stem = getEntity(world, 'stem:woodcutter');
    // The pieces lie side by side, so that the child sees them, and the woodcutter counts the
    // rings of each piece (the move count, src/core/mentoring.js). After a wrong cut the short one
    // glows and breaks, and then a new stem comes (#48, #75: the pieces were gone before the
    // child saw which one was short). After a right cut he says that the pieces are equal, and
    // then they are tied into a bundle (#80: the stem went away with no count and no line). With a
    // wrong number of pieces, the piece that glows and breaks is a long one, never a piece of the
    // right length (#98).
    if (result.solved) for (const e of query(world, 'position').filter((x) => /^(sample|tool):woodcutter:/.test(x.id))) removeEntity(world, e.id);
    const bad = result.solved ? null : badPiece(result.pieces, task.parts);
    const short = bad ? bad.i : null;
    if (stem) stem.hidden = true;
    const n = result.pieces.length;
    result.pieces.forEach((len, i) => {
      addEntity(world, { id: `piece:woodcutter:${i}`, keep: true, position: { x: s.x, y: s.y, z: s.z + (i - (n - 1) / 2) * PIECE_ROW, facing: Math.PI / 2 }, look: `piece-${len}` });
    });
    const count = cutCount(result.pieces);
    tz.zone.cutPieces = [...result.pieces];
    tz.zone.cutParts = task.parts;
    tz.zone.cutAt = 0;
    tz.zone.breakAt = short === null ? null : count + SHORT_SHOW;
    tz.zone.cut = (short === null ? count : count + SHORT_SHOW) + (result.solved ? CUT_STAY_RIGHT : CUT_STAY);
    tz.zone.short = short;
    tz.zone.cutSolved = result.solved;
    // After a cut with too many pieces, the woodcutter shows one time that a tap on a mark takes it
    // off, when the child marks too many again (#80: no child found that).
    if (!result.solved && result.pieces.length > task.parts) tz.zone.tooMany = task.parts;
    tz.zone.sticks = task.parts;
    if (!result.solved) say(world, 'snap', `zone:trial-woodcutter`, { pieces: result.pieces, short: short === null || bad.long ? null : result.pieces[short], long: bad?.long ? result.pieces[short] : null, sound: 'plank-down' });
  }
}

// A tray of bowls goes into the pot of Gióng: each full ten, Gióng eats and grows one head taller;
// the rest stays in the pot. Each ten is a commit. The tray comes back full to the path.
function feed(world, tz, thing, env) {
  const def = env.trials?.trials.find((t) => t.id === tz.zone.trial);
  const task = taskFor(env, tz.zone);
  const size = thing.item.size;
  const home = zoneEnt(world, thing.item.home);
  // The choice of the child: the size of the tray, and the steps of the walk with it (for the log).
  say(world, 'carry', tz.id, { task: tz.zone.trial, size, ticks: world.tick - (thing.item.since ?? world.tick) });
  removeEntity(world, thing.id);
  if (home) {
    addTray(world, home.zone, size, thing.item.task, tz, def.pace);
    packHeap(world, home.zone);
  }
  tz.zone.group.push(size);
  const r = feedResult(tz.zone.ones, size);
  if (r.grew) {
    const ten = tenResult(tz.zone.group, tz.zone.start, Object.keys(def.trays).map(Number).sort((a, b) => a - b));
    commit(world, tz, task, { solved: ten.solved, efficient: ten.efficient, first: true, parts: [...tz.zone.group], target: 10 - tz.zone.start });
    tz.zone.heads += r.grew;
    tz.zone.group = [];
    tz.zone.start = r.ones;
    const giong = getEntity(world, `npc:${def.grows ?? 'giong-boy'}`);
    if (giong) giong.look = `giong-boy-${Math.min(5, tz.zone.heads)}`;
    say(world, 'grow', tz.id, { heads: tz.zone.heads, sound: 'drum' });
  } else say(world, 'bowls', tz.id, { sound: 'tap' });
  tz.zone.ones = r.ones;
  const pot = getEntity(world, 'pot:rice');
  if (pot) pot.look = `rice-pot-${r.ones}`;
  if (tz.zone.heads >= task.heads) finish(world, tz, pot?.position);
}

// A glowing iron on the anvil of the smith (the demo piece of the smith, or the iron of the child).
function addIron(world, tz, id) {
  const a = tz.zone.anvil;
  addEntity(world, { id, keep: true, item: { kind: 'iron', size: 2, task: 'trial-smith', zone: null, held: null, set: true, fixed: true }, position: { x: a.x, y: a.y + 1, z: a.z, facing: Math.PI / 2 }, look: 'iron-0', solid: { rect: { x0: a.x - 0.8, x1: a.x + 0.8, z0: a.z - 0.8, z1: a.z + 0.8 } } });
  say(world, 'fire', tz.id, { sound: 'lantern' });
}

function tickForge(world, tz, dt, env) {
  // After the demo of the smith, the iron of the child comes on the anvil.
  if (tz.zone.next) {
    tz.zone.next -= dt;
    if (tz.zone.next > 0) return;
    delete tz.zone.next;
    tz.zone.heat = 0;
    addIron(world, tz, 'iron:smith');
  }
  const iron = getEntity(world, tz.zone.iron ?? 'iron:smith');
  if (!iron || tz.zone.heat === null) return;
  const task = taskFor(env, tz.zone);
  if (tz.zone.bent) {
    tz.zone.bent -= dt;
    if (tz.zone.bent > 0) return;
    delete tz.zone.bent;
    tz.zone.heat = 0;
  }
  tz.zone.heat += dt;
  const value = glowAt(tz.zone.heat, task.glow, task.hold);
  // The iron turns hot: a sound, so that the child hears the moment too.
  if ((iron.glow ?? 0) < task.glow.hot && quenchResult(value, task.glow)) say(world, 'glow', iron.id, { sound: 'lantern' });
  // Round down, so that a glow at or over hot is truly hot (the cue reads it).
  iron.glow = Math.floor(value * 100) / 100;
  iron.look = ironLook(value, task.glow);
  // The demo: a moment after the iron turns hot, the smith drops it into the water and says when.
  if (!tz.zone.demo || !quenchResult(value, task.glow)) return;
  tz.zone.demoHot = (tz.zone.demoHot ?? 0) + dt;
  if (tz.zone.demoHot < DEMO_WAIT) return;
  const a = tz.zone.anvil;
  iron.look = task.made ?? 'blade';
  iron.position = { x: a.x - 2.4, y: a.y, z: a.z + 0.6, facing: Math.PI / 2 };
  delete iron.solid;
  delete iron.glow;
  delete tz.zone.demo;
  delete tz.zone.demoHot;
  delete tz.zone.iron;
  tz.zone.heat = null;
  tz.zone.next = DEMO_NEXT;
  say(world, 'hiss', iron.id, { sound: 'sizzle', at: iron.position });
  say(world, 'call', 'npc:smith', { key: 'smith.quench.show' });
}

// The look of the iron of the smith at a glow value (#70): bright red, with a glow and sparks, for
// the whole hot time (a quench then is right); dark red-brown under it; grey when cold. Never
// yellow: the smith says "đỏ rực", and the child waits for red.
export function ironLook(value, glow) {
  if (quenchResult(value, glow)) return 'iron-hot';
  return value >= glow.hot / 2 ? 'iron-warm' : 'iron-0';
}

// The tide: it comes in after some seconds; the row of stakes is the commit. Then it goes out and
// shows the trap: the fish stay in, or they swim out through the widest space.
function tickTide(world, tz, dt, env) {
  const tide = tz.zone.tide;
  const line = zoneEnt(world, 'line');
  const water = getEntity(world, 'tide:fisher');
  if (!tide || !line) return;
  const task = taskFor(env, tz.zone);
  const row = query(world, 'item').filter((s) => s.item.zone === 'line');
  // The clock of the tide starts at the first stake of the child (#48): the wait is the time of the
  // child, not of the talk or of the first step that the fisher shows.
  if (!tide.started) {
    // A stake that the hero puts on the line in this step (the place system runs before this one);
    // the stake of the first step that the fisher shows does not count.
    if (!world.events.some((ev) => ev.type === 'put' && ev.id === 'hero' && ev.zone === 'line')) return;
    tide.started = true;
    tide.t = 0;
  }
  // The tide of a task that the child left waits, and so do the lines of the fisher (#78: "Cắm
  // thêm cọc trước đã …" came at the beds of the healer, far from the river).
  if (tide.phase === 'low' && env.here && !env.here(tz.id.slice(5))) return;
  tide.t += dt;
  const held = query(world, 'item').some((s) => s.item.held === 'hero' && String(s.id).startsWith('stake:fisher:'));
  // While the child carries a stake to the row, the tide does not come (#76: the tide came first,
  // and the stake in the hands could not go in): the water stays low.
  if (tide.phase === 'low' && held) tide.t = Math.min(tide.t, tide.every - 10);
  if (tide.phase === 'low') {
    emptyPile(world, tz, line, row, held, dt);
    const hole = tz.zone.hole;
    if (hole && row.some((s) => s.item.slot > hole.from && s.item.slot < hole.from + hole.size)) {
      delete tz.zone.hole;
      delete tz.zone.holeBrought;
      removeEntity(world, 'why:fisher:space');
    }
    backHint(world, tz, line, row);
    holeStake(world, tz, line, row, held);
    // The row is at the float: a few seconds after the last stake, the water rises, and the fisher
    // says it (#78: the child put the row to the float, and nothing happened for a minute).
    const atFloat = row.some((s) => s.item.slot === line.zone.length);
    const now = [...row.map((s) => s.item.slot)].sort((a, b) => a - b).join(',');
    if (world.events.some((ev) => (ev.type === 'put' || ev.type === 'pick') && ev.id === 'hero')) tide.still = 0;
    else tide.still = (tide.still ?? 0) + dt;
    if (atFloat && !held && now !== tide.last && tide.still >= FLOAT_WAIT && tide.t < tide.every - FLOAT_RISE) {
      tide.t = tide.every - FLOAT_RISE;
      const fisher = query(world, 'person').find((p) => p.person.ref === 'fisher' && !p.hidden);
      if (fisher) say(world, 'call', fisher.id, { key: 'fisher.full', params: {}, happened: true });
    }
    // The water rises in the last part of the wait, so that the child sees it come.
    const k = Math.max(0, (tide.t - (tide.every - 10)) / 10);
    if (water) water.look = `tide-${Math.min(2, Math.floor(k * 3))}`;
    if (tide.t < tide.every) return;
    const offsets = row.map((s) => s.item.slot);
    // A row that did not change since the last tide, or with no stake of the child, is no try
    // (#48): the water comes and goes, and the fisher says to put more stakes first.
    const key = [...offsets].sort((a, b) => a - b).join(',');
    // A row that did not change after an escape gets no new tide: the hole is still the next step
    // (#96: the child heard "Cắm thêm cọc trước đã …" with no stake to put).
    if (key === tide.last && tz.zone.hole) {
      tide.t = 0;
      return;
    }
    if (key === tide.last || !row.some((s) => !FISHER_STAKES.has(s.id))) {
      tide.phase = 'in';
      tide.t = 0;
      tide.result = null;
      if (water) water.look = 'tide-3';
      say(world, 'tide', tz.id, { sound: 'splash' });
      const fisher = query(world, 'person').find((p) => p.person.ref === 'fisher');
      if (fisher) say(world, 'call', fisher.id, { key: 'fisher.tide.more', params: {} });
      return;
    }
    tide.last = key;
    const result = stakeResult(offsets, line.zone.length, line.zone.space);
    commit(world, tz, task, { solved: result.solved, efficient: result.efficient, parts: result.gaps, target: line.zone.length });
    tide.phase = 'in';
    tide.t = 0;
    tide.result = { solved: result.solved, widest: result.widest };
    if (water) water.look = 'tide-3';
    say(world, 'tide', tz.id, { sound: 'splash' });
  } else if (tide.phase === 'in' && tide.t >= TIDE_IN) {
    tide.phase = 'out';
    tide.t = 0;
    if (water) water.look = 'tide-0';
    const r = tide.result;
    if (!r) return;
    const fish = r.solved ? 'fish-in' : 'fish-out';
    const at = r.solved ? line.zone.length / 2 : r.widest.from + r.widest.size / 2;
    // The fish stay in the trap, or they swim out at the space into the river (+z of the line; the
    // bank is on the other side).
    addEntity(world, { id: 'fish:fisher', keep: true, position: { x: line.zone.x + at, y: line.zone.y, z: line.zone.z + (r.solved ? 1 : 1.5), facing: 0 }, look: fish });
    say(world, r.solved ? 'catch' : 'escape', tz.id, { at: { x: line.zone.x + at, z: line.zone.z }, sound: 'splash' });
    if (!r.solved) {
      // The hole of the escape is the next step until a stake stands in it (#96, #97).
      tz.zone.hole = { from: r.widest.from, size: r.widest.size };
      // The answer of the world to a wrong row, at each level of help (#73: after the handover of
      // the checking, the fish swam out and nobody spoke): the widest space glows while the fish
      // swim through it, and the fisher (or Nghé, while the fisher is away) says it.
      // On the surface of the water (#97: at the height of the bed, the river covered it), until a
      // stake stands in the hole.
      addEntity(world, { id: 'why:fisher:space', keep: true, position: { x: line.zone.x + r.widest.from, y: line.zone.y + WATER_UP, z: line.zone.z, facing: Math.PI / 2 }, look: `gap-frame-${Math.max(1, Math.round(r.widest.size))}` });
      const fisher = query(world, 'person').find((p) => p.person.ref === 'fisher' && !p.hidden);
      const nghe = getEntity(world, 'friend:nghe');
      const who = fisher ?? (nghe && !nghe.hidden ? nghe : null);
      // The person points at the hole while he says "Chỗ này …".
      if (who) who.gesture = { act: 'point', x: line.zone.x + at, z: line.zone.z, t: 3 };
      if (who && (!env.here || env.here(tz.id.slice(5)))) say(world, 'call', who.id, { key: 'fisher.escape', params: {}, happened: true });
    }
  } else if (tide.phase === 'out' && tide.t >= TIDE_OUT) {
    const r = tide.result;
    if (r?.solved) {
      finish(world, tz, getEntity(world, 'fish:fisher')?.position);
      return;
    }
    removeEntity(world, 'fish:fisher');
    tide.phase = 'low';
    tide.t = 0;
    tide.result = null;
  }
}

// The pile keeps the stakes of the level (#88: since #78 the fisher brought more stakes each time
// the pile was empty, and presses alone finished the row). When the pile is empty, no stake is in
// the hands, and the row is not at the float:
// - the first time, the fisher says that a gap is narrower than his gap, and the narrow gaps of the
//   row glow (event empty, n 1);
// - when the pile is empty again after that, or after EMPTY_IDLE seconds, the fisher shows his gap on
//   a short row next to the child (event empty, n 2: the session starts the demonstration), and
//   after it he brings the stakes that the rest of the row needs at his gap. Later, he brings them
//   again with no demonstration, so that the task is never impossible (rule 12).
function emptyPile(world, tz, line, row, held, dt) {
  const z = tz.zone;
  const pile = zoneEnt(world, 'stakes');
  if (!pile) return;
  if (z.narrowT > 0) {
    z.narrowT -= dt;
    if (z.narrowT <= 0 || world.events.some((ev) => ev.type === 'pick' && ev.id === 'hero' && String(ev.item).startsWith('stake:'))) clearNarrow(world);
  }
  const inPile = pile.zone.items.some((id) => getEntity(world, id) && !getEntity(world, id).item.held);
  if (inPile) {
    if (z.empties === 1) z.refilled = true;
    z.emptyT = 0;
    return;
  }
  if (held || row.some((s) => s.item.slot === line.zone.length)) return;
  z.emptyT = (z.emptyT ?? 0) + dt;
  const fisher = query(world, 'person').find((p) => p.person.ref === 'fisher' && !p.hidden);
  if (!z.empties) {
    z.empties = 1;
    z.refilled = false;
    z.emptyT = 0;
    markNarrow(world, z, line, row);
    if (fisher) say(world, 'call', fisher.id, { key: 'fisher.empty', params: {}, happened: true });
    say(world, 'empty', tz.id, { n: 1 });
    return;
  }
  if (z.empties === 1 && (z.refilled || z.emptyT >= EMPTY_IDLE)) {
    z.empties = 2;
    z.helpT = HELP_WAIT;
    clearNarrow(world);
    say(world, 'empty', tz.id, { n: 2 });
    return;
  }
  if (z.empties < 2) return;
  // The stakes come after the demonstration (the session plays it) ends.
  if (query(world, 'demo').length) return;
  z.helpT = (z.helpT ?? 0) - dt;
  if (z.helpT > 0) return;
  // The narrow gaps glow again with each bring of stakes: the new stakes come with a pointer to the
  // gap, not only with more presses.
  markNarrow(world, z, line, row);
  // At once, the stakes for each gap that is too wide and for the rest to the float (#92: after the
  // demonstration, one stake came after each put, nine times, and each was a walk to the pile).
  // They lie next to the end of the row.
  const n = stakesNeeded(line, row);
  if (n <= 0) return;
  if (!z.nearPile) {
    const last = Math.max(0, ...row.map((s) => s.item.slot ?? 0));
    const side = Math.sign(pile.zone.z - line.zone.z) || 1;
    const x = line.zone.x + Math.min(line.zone.length, last + 2);
    Object.assign(pile.zone, { x, z: line.zone.z + side * NEAR_ROW });
    pile.position = { ...pile.position, x, z: line.zone.z + side * NEAR_ROW };
    z.nearPile = true;
  }
  bringStakes(world, tz, pile, n, fisher);
  z.helpT = HELP_WAIT;
}
// The fisher brings n stakes to the pile, and says it.
function bringStakes(world, tz, pile, n, fisher) {
  for (let i = 0; i < n; i++) {
    const id = `stake:fisher:${tz.zone.made++}`;
    addEntity(world, { id, keep: true, item: { kind: 'stake', size: 1, task: tz.id.slice(5), zone: pile.zone.id, home: pile.zone.id, held: null, set: false }, position: { x: pile.zone.x, y: pile.zone.y, z: pile.zone.z, facing: 0 }, look: 'stake' });
    pile.zone.items.push(id);
  }
  packHeap(world, pile.zone);
  if (fisher) say(world, 'call', fisher.id, { key: 'fisher.more', params: {}, happened: true });
  say(world, 'more', pile.id, { sound: 'plank-down', n, task: tz.id });
}
// After an escape with an empty pile and no stake to take back, the fisher brings one stake for the
// hole (#97, rule 12: the task is never impossible).
function holeStake(world, tz, line, row, held) {
  const z = tz.zone;
  const pile = zoneEnt(world, 'stakes');
  if (!z.hole || z.holeBrought || held || !pile || z.tide?.phase !== 'low') return;
  if (pile.zone.items.some((id) => getEntity(world, id) && !getEntity(world, id).item.held)) return;
  if (spareStake(line, row)) return;
  z.holeBrought = true;
  bringStakes(world, tz, pile, 1, query(world, 'person').find((p) => p.person.ref === 'fisher' && !p.hidden));
}
// The stakes that the row still needs: the stakes for each gap that is too wide (at the gap of the
// fisher), and the stakes from the last stake to the float (a stake stands at the float).
export function stakesNeeded(line, row) {
  const space = line.zone.space;
  const slots = [...new Set([0, ...row.filter((s) => s.item.slot != null).map((s) => s.item.slot)])].sort((a, b) => a - b);
  let n = 0;
  for (let i = 1; i < slots.length; i++) n += Math.max(0, Math.ceil((slots[i] - slots[i - 1]) / space) - 1);
  // The rest to the float at the gap that the child uses, when it is narrower than the gap of the
  // fisher (the play of #92: a child who only pressed put the stakes one apart, and the stakes came
  // six times), so that one bring finishes the row.
  const last = slots.length > 1 ? slots.at(-1) - slots.at(-2) : space;
  const step = last > 0 && last < space ? last : space;
  return n + Math.ceil((line.zone.length - slots.at(-1)) / step);
}
// The stake to take back (#97): the last stake of the child that the row does not need (the gap
// from the stake before it to the stake after it is not wider than the gap of the fisher), or null.
export function spareStake(line, row) {
  const stakes = row.filter((s) => s.item.slot != null).sort((a, b) => a.item.slot - b.item.slot);
  for (let i = stakes.length - 2; i >= 0; i--) {
    if (FISHER_STAKES.has(stakes[i].id)) continue;
    const before = i > 0 ? stakes[i - 1].item.slot : 0;
    if (stakes[i + 1].item.slot - before <= line.zone.space) return stakes[i];
  }
  return null;
}
// The gaps of the row that are narrower than the gap of the fisher show as frames on the water (a
// mark, rule 34). Only the stake to take back glows and bobs, and only the frames next to it are
// bright; the others are dim until that stake is up (#97: with every gap narrow, every stake and
// frame glowed, and "cái cọc này" marked nothing).
function markNarrow(world, z, line, row) {
  clearNarrow(world);
  const stakes = row.filter((s) => s.item.slot != null).sort((a, b) => a.item.slot - b.item.slot);
  const slots = [0, ...stakes.map((s) => s.item.slot)];
  const spare = spareStake(line, row);
  const at = spare?.item.slot;
  slots.forEach((a, i) => {
    const b = slots[i + 1];
    if (b === undefined || b === a || b - a >= line.zone.space) return;
    // A frame on the surface of the water around the narrow gap, as clear as the ring of a cue
    // (#92: at the height of the bed, the river covered it).
    const bright = a === at || b === at;
    addEntity(world, { id: `why:fisher:narrow:${i}`, keep: true, position: { x: line.zone.x + a, y: line.zone.y + WATER_UP, z: line.zone.z, facing: Math.PI / 2 }, look: `gap-frame-${Math.max(1, Math.round(b - a))}${bright ? '' : '-dim'}` });
  });
  if (spare) world.events.push({ type: 'glowThings', ids: [spare.id] });
  z.narrowT = NARROW_MARKS;
}
// After a take-back from the row, the fisher says to walk toward the float, and the point at his
// gap from the last stake glows until the child puts the stake (#97: the stake went back into the
// same hole, and nobody said that the ghost stake follows the hero).
function backHint(world, tz, line, row) {
  const back = world.events.find((ev) => ev.type === 'pick' && ev.id === 'hero' && ev.from === line.zone.id);
  if (back) {
    const last = Math.max(0, ...row.map((s) => s.item.slot ?? 0));
    const slot = Math.min(line.zone.length, last + line.zone.space);
    removeEntity(world, 'why:fisher:next');
    addEntity(world, { id: 'why:fisher:next', keep: true, position: { x: line.zone.x + slot, y: line.zone.y + WATER_UP, z: line.zone.z, facing: 0 }, look: 'pull-ring' });
    const fisher = query(world, 'person').find((p) => p.person.ref === 'fisher' && !p.hidden);
    const nghe = getEntity(world, 'friend:nghe');
    const who = fisher ?? (nghe && !nghe.hidden ? nghe : null);
    if (who) {
      say(world, 'call', who.id, { key: fisher ? 'mentor.fisher.back' : 'mentor.nghe.fisher.back', params: {} });
      who.gesture = { act: 'point', x: line.zone.x + slot, z: line.zone.z, t: 2.5 };
    }
  }
  if (world.events.some((ev) => ev.type === 'put' && ev.id === 'hero' && ev.zone === line.zone.id)) removeEntity(world, 'why:fisher:next');
}
function clearNarrow(world) {
  for (const e of query(world, 'position').filter((x) => String(x.id).startsWith('why:fisher:narrow:'))) removeEntity(world, e.id);
}

// A new stem comes after sticks that were not equal.
// A standing culm of the bamboo clump, in its place (i) in the row, with a ring at each half block.
// The row goes along -z, so that the culms stand apart in the first view of the camera.
function addCulm(world, tz, task, i) {
  const c = tz.zone.clump;
  addEntity(world, { id: `culm:staffs:${i}`, keep: true, item: { kind: 'culm', size: task.height, slot: i, task: 'trial-staffs', zone: null, held: null, set: true, fixed: true }, position: { x: c.x, y: c.y, z: c.z - i * CULM_STEP, facing: 0 }, look: `culm-${task.height}` });
}

// Nghé follows the hero (the friend of the hero).
const friendOf = (world) => query(world, 'follow', 'position').find((f) => f.follow.target === 'hero') ?? null;

// The share of the loot: when the hands are empty and the pile has fewer sacks than friends, the
// share is the commit (once for each new share). Fair: all are happy, and the friends go home
// after a moment. If not, Nghé turns away and shakes her head.
function tickShare(world, tz, dt, env) {
  if (tz.zone.leave !== null) {
    tz.zone.leave -= dt;
    if (tz.zone.leave <= 0) finish(world, tz);
    return;
  }
  if (query(world, 'item').some((t) => t.item.task === 'trial-share' && t.item.held)) return;
  const counts = tz.zone.who.map((w) => zoneEnt(world, `share-${w}`)?.zone.items.length ?? 0);
  const left = zoneEnt(world, 'loot')?.zone.items.length ?? 0;
  const r = shareResult(counts, left);
  const friend = friendOf(world);
  const goal = friend?.follow.goal;
  if (!r.settled) {
    // Coins went back to the pile: Nghé looks at the mats again.
    if (goal && tz.zone.settled) Object.assign(goal, { face: tz.zone.face, act: undefined });
    tz.zone.settled = null;
    return;
  }
  const key = counts.join(',');
  if (key === tz.zone.settled) return;
  tz.zone.settled = key;
  commit(world, tz, taskFor(env, tz.zone), { solved: r.fair, parts: counts, target: tz.zone.loot });
  if (goal) Object.assign(goal, r.fair ? { face: tz.zone.face, act: 'stretch' } : { face: tz.zone.face + Math.PI, act: 'shake' });
  if (r.fair) {
    tz.zone.leave = 2.5;
    say(world, 'happy', tz.id, { counts, sound: 'pickup' });
  } else say(world, 'sulk', friend?.id ?? tz.id, { counts, sound: 'tap' });
}

// The mark of a slash goes up the culm while the button is down (up to the reach of the hand);
// after the pieces that are not equal break, their culms grow again.
function tickSlash(world, tz, dt, env) {
  const aim = tz.zone.aim;
  if (aim) {
    const task = taskFor(env, tz.zone);
    aim.t += dt;
    aim.at = Math.min(task.reach, 1 + Math.floor(aim.t / AIM_RISE));
    const culm = getEntity(world, `culm:staffs:${aim.culm}`);
    const mark = getEntity(world, 'aim:staffs');
    if (culm && mark) mark.position = { ...culm.position, y: culm.position.y + aim.at };
  }
  if (!tz.zone.cut) return;
  tz.zone.cut -= dt;
  if (tz.zone.cut > 0) return;
  delete tz.zone.cut;
  const task = taskFor(env, tz.zone);
  tz.zone.pieces.forEach((p, i) => { if (p === null && !getEntity(world, `culm:staffs:${i}`)) addCulm(world, tz, task, i); });
  say(world, 'stem', tz.id, { sound: 'plank-down' });
}

// The extra rods of a band that snapped roll back to the heap after the count, one at a time.
function tickSpring(world, tz, dt) {
  const sp = tz.zone.spring;
  if (!sp || (sp.t -= dt) > 0) return;
  const id = sp.ids.pop();
  if (sp.ids.length) sp.t = ROLL_STEP;
  else delete tz.zone.spring;
  const rod = getEntity(world, id);
  if (!rod) return;
  const mat = zoneEnt(world, 'mat');
  if (mat) {
    mat.zone.items = mat.zone.items.filter((x) => x !== id);
    packMat(world, mat.zone);
  }
  // The rod rolls back slowly, so that the child sees it go (#69): it lies on the heap already, and
  // a tap takes it only at the end of the roll.
  const from = { ...rod.position };
  toHeap(world, rod);
  rod.slide = { from, to: { ...rod.position }, t: 0 };
  rod.position = { ...from };
}

// A thing that rolls from one point to another in ROLL_TIME seconds (an extra rod back to its heap).
// A slide with `time` is a walk (a duck): it takes that time, and the thing keeps its set.
function tickSlide(e, dt) {
  const sl = e.slide;
  const time = sl.time ?? ROLL_TIME;
  sl.t = Math.min(time, sl.t + dt);
  const k = sl.t / time;
  e.position = { ...e.position, x: sl.from.x + (sl.to.x - sl.from.x) * k, y: sl.from.y + (sl.to.y - sl.from.y) * k, z: sl.from.z + (sl.to.z - sl.from.z) * k };
  if (sl.t < time) return;
  delete e.slide;
  if (sl.face) e.position.facing = sl.to.facing ?? e.position.facing;
  if (e.item) e.item.set = sl.set ?? false;
}

// The rows of a wrong give: after the count, the extra bunches go back to their beds one at a time,
// and then the rest go back into the basket.
function tickLay(world, tz, dt) {
  const lay = tz.zone.lay;
  if (!lay || (lay.t -= dt) > 0) return;
  const basket = zoneEnt(world, 'basket');
  const id = lay.ids.shift();
  const h = id ? getEntity(world, id) : null;
  if (h) {
    h.item.set = false;
    if (basket) basket.zone.items = basket.zone.items.filter((x) => x !== id);
    toHeap(world, h);
  }
  if (lay.ids.length) {
    lay.t = LAY_STEP;
    return;
  }
  delete tz.zone.lay;
  if (!basket) return;
  for (const x of basket.zone.items) {
    const e = getEntity(world, x);
    if (e) e.item.set = false;
  }
  packBasket(world, basket.zone);
  say(world, 'counted', basket.id, { sound: 'pickup' });
}

const NEAR_ROW = 3; // half blocks from the row of the fisher to the stakes that he brings (#92)
const ADD_MARK_WALK = 1.5; // half blocks: a walk this long ends the glow of the free rings
function tickStem(world, tz, dt) {
  // The free rings glow until the hero walks or makes a mark (#91).
  const free = tz.zone.addMark;
  if (free) {
    const hero = getEntity(world, 'hero');
    const marked = world.events.some((ev) => ev.type === 'mark');
    if (marked || !hero || Math.hypot(hero.position.x - free.x, hero.position.z - free.z) > ADD_MARK_WALK) {
      delete tz.zone.addMark;
      for (const e of query(world, 'position').filter((x) => String(x.id).startsWith('why:woodcutter:free:'))) removeEntity(world, e.id);
    }
  }
  if (!tz.zone.cut) return;
  tz.zone.cut -= dt;
  tz.zone.cutAt = (tz.zone.cutAt ?? 0) + dt;
  // The short piece breaks after the count of the pieces and its line: dust where it lay.
  if (tz.zone.short != null && tz.zone.breakAt != null && tz.zone.cutAt >= tz.zone.breakAt) {
    const short = getEntity(world, `piece:woodcutter:${tz.zone.short}`);
    if (short) {
      say(world, 'snap', short.id, { at: { x: short.position.x + 2, z: short.position.z }, sound: 'plank-down' });
      removeEntity(world, short.id);
    }
    delete tz.zone.short;
  }
  if (tz.zone.cut > 0) return;
  // A cut with too few pieces: the child must add a mark (#91: after one mark the button was the
  // knife, and a child cut too soon two times).
  const few = !tz.zone.cutSolved && (tz.zone.cutPieces?.length ?? 0) < (tz.zone.cutParts ?? 0);
  delete tz.zone.cut;
  delete tz.zone.cutAt;
  delete tz.zone.breakAt;
  delete tz.zone.cutPieces;
  delete tz.zone.cutParts;
  for (const e of query(world, 'position').filter((x) => String(x.id).startsWith('piece:woodcutter:'))) removeEntity(world, e.id);
  const stem = getEntity(world, 'stem:woodcutter');
  if (tz.zone.cutSolved) {
    // Equal sticks, tied into a bundle, to carry to the wood pile by the bridge.
    delete tz.zone.cutSolved;
    const s = tz.zone.stem;
    if (stem) removeEntity(world, stem.id);
    addEntity(world, { id: 'sticks:woodcutter', keep: true, item: { kind: 'sticks', size: 2, task: 'trial-woodcutter', zone: null, home: null, held: null, set: false }, position: { x: s.x + s.length / 2 - 1, y: s.y, z: s.z, facing: Math.PI / 2 }, look: `sticks-${tz.zone.sticks ?? 2}` });
    say(world, 'chop', 'zone:trial-woodcutter', { sound: 'plank-up' });
    return;
  }
  if (stem) {
    stem.hidden = false;
    say(world, 'stem', stem.id, { sound: 'plank-down' });
    const hero = getEntity(world, 'hero');
    if (few && hero) {
      // The woodcutter says how to add a mark, and each ring where a mark can go glows.
      const s = tz.zone.stem;
      for (let j = 1; j < s.length; j++) addEntity(world, { id: `why:woodcutter:free:${j}`, why: { zone: tz.id }, position: { x: s.x + j, y: s.y, z: s.z, facing: 0 }, look: 'mark-glow' });
      tz.zone.addMark = { x: hero.position.x, z: hero.position.z };
      // The woodcutter says it, or Nghé while he is away (at home at night).
      const person = query(world, 'person').find((p) => p.person.ref === 'woodcutter' && atWork(p, world.clock.minutes) && dist(p.position, hero.position) <= PERSON_AWAY);
      const nghe = getEntity(world, 'friend:nghe');
      const who = person ?? (nghe && !nghe.hidden ? nghe : null);
      if (who) say(world, 'call', who.id, { key: person ? 'woodcutter.addMark' : 'mentor.nghe.woodcutter.addMark', params: {}, happened: true });
    }
  }
}
