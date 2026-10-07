// Raids: the defense of the village, in light real time on the map of the village. The pure rules
// (data/raids.json), with no DOM and no world state: a raid is plain data, and stepRaid moves it
// on. The raid system (systems/raid.js) keeps the figures of the raid in the world state.
//
//   Enemies walk on a straight path from their start to the gate, and never run. An enemy that is
//   hit enough times retreats (a creature becomes calm and swims away). An enemy at the gate takes
//   a bowl of rice from the store and leaves (nothing at the lowest level; Era 1 has no coins, #26). Nobody is hurt.
//   The slingshot: the child pulls back and lets go. The pull counts in steps of one half block
//   (the band has a tick at each step and a red band at every fifth, the same marks as the posts),
//   and the stone lands exactly at the count along the road, on a real arc at one angle. Short or
//   long shows on the road against the posts, so the next shot is a correction. Before the first
//   shot of a raid, the child taps the post nearest the enemy (a prediction).
//   Traps: a scout or a soldier that steps on a trap sits down for some seconds. The general
//   breaks a trap.
//   The gate bar: a scout lights a torch (the tell) and then throws it at the gate. A barred gate
//   stops the torch, and it falls on the road and burns there (a fire to drag from).
//   Villagers at spots: an enemy that passes a villager stops for a moment, once.
//   Nghé charges once in a raid: the first enemy takes a hit and goes back some steps.
//   The flow of the elements is a drag from a source to a point: water makes a wet zone and puts
//   out a fire; fire makes a soldier raise his wet shield (stones bounce off it, and it drips);
//   lightning from the forge into a wet zone shocks every enemy in the wet zones.
//   The boss: phases of soldiers, then the general, then the iron staff breaks (a talk), and a tap
//   on the bamboo lets Gióng pull it for the strike that ends the raid.
// The tools come one raid after the other (tools in the data): a tool that is not in the raid is
// not on the map. Each shot at an enemy, a trap at the post that a villager names, and each
// strike of lightning is one skill event for the learner (the child never sees it).
// Units: half blocks (one map cell is 2) and seconds. The data gives places in map cells.
import { byGrade } from '../grades.js';

const WET = 3; // half blocks: the radius of a wet zone from the water
const DRIP = 2.5; // half blocks: the radius of the wet zone under a wet shield
const DRY = 14; // seconds: a wet zone dries
const FLAME = 3; // half blocks: the reach of fire at a point
const BURN = 9; // seconds: a torch on the road burns
const CHARGE = 0.7; // seconds: Nghé runs to the first enemy
const STEAL = 1.2; // seconds: an enemy at an open gate takes a bowl of rice
const HELPER = 2; // half blocks each second: a villager walks to a spot
const PAUSE = 2.5; // seconds: an enemy stops in front of a villager
const NEAR_SPOT = 5; // half blocks: an enemy stops when it passes this near a villager
const TRAP = 0.9; // half blocks: an enemy steps on a trap this near
const HURT = 3; // half blocks: the blow of the general pushes the hero back
const MARK = 4; // seconds: a stone lies where it landed, so that short or long shows on the road
const AIM = 8; // half blocks: the shot is for the enemy nearest to the count, within this distance
const LANE = 2.5; // half blocks: a stone hits an enemy this far to the side of the line of the road
// The first raid of a tool waits for the child (#50): with a new slingshot, the first enemy stops
// this far from the wall (half blocks) until the first hit, and no other wave comes; with new
// traps, no enemy comes until the child has a trap in the hands.
export const HOLD_AT = 20;
export const HOLD_TOOLS = Object.freeze(['sling', 'traps']);

// The slingshot (world units are half blocks). max: the longest count of a pull.
export const SLING = Object.freeze({ g: 20, h0: 2.2, angle: 0.7, max: 30, hit: 1.5, reload: 0.6 });

// The level (0, 1, or 2) of the raids for a grade: grade 1 and lower is 0 (a lost raid takes
// nothing).
export function raidLevel(raids, grade) {
  const level = byGrade(raids.grades ?? {}, grade) ?? 1;
  return Math.max(0, Math.min(2, level - 1));
}

// The flight --------------------------------------------------------------------------------

// The flight of a stone that lands at `count` half blocks: the speed at the angle of the
// slingshot, and the time in the air. The count is a whole number from 1 to max.
export function flightFor(count, cfg = SLING) {
  const d = Math.max(1, Math.min(cfg.max, Math.round(count)));
  const c = Math.cos(cfg.angle);
  const speed = Math.sqrt((cfg.g * d * d) / (2 * c * c * (cfg.h0 + d * Math.tan(cfg.angle))));
  return { count: d, speed, angle: cfg.angle, t: d / (speed * c) };
}

// The stone at t seconds after the release: d along the road, and h over the ground.
export function positionAt(shot, t, cfg = SLING) {
  const vx = shot.speed * Math.cos(shot.angle);
  const vy = shot.speed * Math.sin(shot.angle);
  return { d: vx * t, h: cfg.h0 + vy * t - (cfg.g * t * t) / 2 };
}

// A raid ----------------------------------------------------------------------------------------

const hb = (p) => ({ x: p[0] * 2, z: p[1] * 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const unit = (v) => {
  const n = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / n, z: v.z / n };
};

// A new raid from its definition (data/raids.json), at a level. loss: what an enemy at the gate
// takes ('none', 'small', or 'normal': twice as much; see lossLevel in src/core/profile.js); by
// default nothing at the lowest level. The raid is plain data.
// teach: the tools that are new to the child in this raid (the first raid of each tool).
// easy (#55): { stop: seconds that each enemy stops at each post (0: none; then the next wave
// comes only when no enemy walks), fewer: waves less (after a loss), help: a helper at the wall
// gives each enemy one hit (after two losses), helper: the look of the helper, without: tools
// that are not in this raid (the gate in the first raid of the slingshot) }.
export function createRaid(raids, id, level = 0, loss = null, teach = [], easy = {}) {
  const def = raids.raids[id];
  const sling = { ...SLING, ...raids.sling };
  const wall = hb(def.wall);
  const gate = hb(def.gate);
  const dir = unit({ x: def.dir[0], z: def.dir[1] });
  const phases = (def.phases ?? [{ id: 'raid', waves: def.waves }]).map((p, i) => {
    const waves = p.waves ?? [];
    // One enemy less after a loss: the last waves of the first phase go (one always stays).
    return i === 0 && easy.fewer ? { ...p, waves: waves.slice(0, Math.max(1, waves.length - easy.fewer)) } : p;
  });
  const tools = (def.tools ?? ['sling']).filter((t) => !(easy.without ?? []).includes(t));
  const has = (t) => tools.includes(t);
  return {
    id,
    level,
    t: 0,
    phase: 0,
    phaseT: 0,
    phases: phases.map((p) => ({ ...p, waves: (p.waves ?? []).map((w) => ({ ...w })) })),
    spawned: 0,
    result: null,
    wall,
    gate,
    dir,
    tools: [...tools],
    bar: def.bar && has('gate') ? { down: 0, cool: 0, tapped: null, ...(raids.gateBar ?? { hold: 3, rest: 1 }) } : null,
    // The post where a villager asks for a trap (half blocks from the wall), and whether the child
    // put one there.
    trapPost: has('traps') ? def.trapPost ?? null : null,
    trapDone: false,
    ball: def.ball ?? null,
    posts: (raids.posts ?? []).map((d) => ({ d, x: wall.x + dir.x * d, z: wall.z + dir.z * d })),
    // The prediction before the first shot: pending (the posts wait for a tap), then the post that
    // the child tapped (guess) and the distance of the enemy then (gap), or skipped.
    predict: { state: 'pending', guess: null, gap: null },
    // The tool that the raid waits for (the first raid of the tool), or null.
    hold: HOLD_TOOLS.find((t) => has(t) && teach.includes(t)) ? { tool: HOLD_TOOLS.find((t) => has(t) && teach.includes(t)) } : null,
    marks: [],
    shots: 0,
    enemies: [],
    count: 0, // the enemies so far (raider:1, raider:2, ...)
    made: 0, // the other things so far (stones, fires)
    stones: [],
    torches: [],
    fires: [],
    wet: [],
    traps: [],
    spots: has('helpers') ? (def.spots ?? []).map((p, i) => ({ id: `spot:${i + 1}`, ...hb(p), helper: null })) : [],
    helpers: has('helpers') ? def.helpers ?? 0 : 0,
    sources: (def.sources ?? []).filter((s) => has(s.kind)).map((s) => ({ ...s, ...hb(s.at), cool: 0 })),
    charge: has('nghe') ? 'ready' : 'none',
    nghe: null,
    reload: 0,
    losses: 0,
    taken: {},
    allow: def.allow ?? 1,
    take: def.take ?? { rice: 1 },
    loss: loss ?? (level > 0 ? 'small' : 'none'),
    aims: {},
    bamboo: null,
    stop: easy.stop ?? 0,
    help: Boolean(easy.help),
    helper: easy.help ? easy.helper ?? null : null,
    sling,
    kinds: raids.enemies,
    skills: raids.skills,
  };
}

// The distance of a point along the road from the wall, and to the side of the line of the road.
export const along = (raid, p) => (p.x - raid.wall.x) * raid.dir.x + (p.z - raid.wall.z) * raid.dir.z;
export const across = (raid, p) => (p.x - raid.wall.x) * -raid.dir.z + (p.z - raid.wall.z) * raid.dir.x;

const alive = (e) => e.state !== 'retreat' && e.state !== 'gone';
const active = (raid) => raid.enemies.filter(alive);

// One step of the raid. ctx: { hero, nghe } (where they are, in half blocks). Return the events
// of the step.
export function stepRaid(raid, dt, ctx = {}) {
  const out = [];
  if (raid.result) return out;
  raid.t += dt;
  // While the raid waits for the child, no new wave comes.
  if (!raid.hold) raid.phaseT += dt;
  raid.reload = Math.max(0, raid.reload - dt);
  spawn(raid, out);
  tickGate(raid, dt, out);
  tickHelpers(raid, dt, out);
  tickCharge(raid, dt, ctx, out);
  for (const e of raid.enemies) tickEnemy(raid, e, dt, ctx, out);
  tickStones(raid, dt, out);
  for (const m of raid.marks) m.t -= dt;
  raid.marks = raid.marks.filter((m) => m.t > 0);
  tickTorches(raid, dt, out);
  for (const f of raid.fires) f.t -= dt;
  raid.fires = raid.fires.filter((f) => f.t > 0);
  for (const w of raid.wet) w.t -= dt;
  raid.wet = raid.wet.filter((w) => w.t > 0);
  for (const s of raid.sources) s.cool = Math.max(0, s.cool - dt);
  raid.enemies = raid.enemies.filter((e) => e.state !== 'gone');
  nextPhase(raid, out);
  return out;
}

// The waves of the phase that are due come in at their start.
function spawn(raid, out) {
  const phase = raid.phases[raid.phase];
  for (const w of phase.waves) {
    if (w.in || raid.phaseT < (w.at ?? 0)) continue;
    // New traps: no enemy until the child has a trap in the hands.
    if (raid.hold?.tool === 'traps') continue;
    // In an easy raid, the next wave comes only when no enemy walks to the gate (#55).
    if (raid.stop > 0 && active(raid).length) continue;
    w.in = true;
    const kind = raid.kinds[w.kind];
    const from = hb(w.from);
    const to = w.to ? hb(w.to) : { x: raid.gate.x + (w.side ?? 0) * -raid.dir.z, z: raid.gate.z + (w.side ?? 0) * raid.dir.x };
    const e = {
      id: `raider:${++raid.count}`, kind: w.kind, look: kind.look, x: from.x, z: from.z, from, to,
      hits: 0, max: kind.hits, state: 'walk', t: 0, cool: kind.torch?.first ?? kind.sword?.first ?? 0, waited: [], shield: 0, phase: raid.phase,
    };
    // After two lost raids, a helper at the wall gives each enemy one hit (#55).
    if (raid.help && e.max > 1) {
      e.hits = 1;
      out.push({ type: 'helped', id: e.id, sound: 'hit' });
    }
    raid.enemies.push(e);
    out.push({ type: 'come', id: e.id, kind: e.kind });
  }
}

// The facing of an enemy toward a point (the same angle as the facing of the world).
const faceTo = (e, p) => Math.atan2(p.x - e.x, p.z - e.z);

function walkTo(e, p, speed, dt) {
  const d = dist(e, p);
  e.facing = faceTo(e, p);
  if (d <= speed * dt) {
    e.x = p.x;
    e.z = p.z;
    return true;
  }
  e.x += ((p.x - e.x) / d) * speed * dt;
  e.z += ((p.z - e.z) / d) * speed * dt;
  return false;
}

function tickEnemy(raid, e, dt, ctx, out) {
  const kind = raid.kinds[e.kind];
  e.t = Math.max(0, e.t - dt);
  e.cool = Math.max(0, e.cool - dt);
  e.shield = Math.max(0, e.shield - dt);
  if (e.state === 'retreat') {
    if (walkTo(e, e.from, kind.speed, dt)) {
      e.state = 'gone';
      out.push({ type: 'gone', id: e.id });
    }
    return;
  }
  if (e.state === 'gone' || e.state === 'stunned') return;
  if (e.state === 'sit' || e.state === 'wait' || e.state === 'back') {
    if (e.state === 'back') walkTo(e, e.back, kind.speed * 2, dt);
    if (e.t <= 0) e.state = 'walk';
    return;
  }
  if (e.state === 'torch') {
    // The tell is over: the scout throws the torch at the gate.
    if (e.t > 0) return;
    const fly = kind.torch.fly;
    raid.torches.push({ id: `torch:${e.id}:${raid.t.toFixed(2)}`, by: e.id, from: { x: e.x, z: e.z }, to: { ...raid.gate }, t: 0, fly, lit: e.lit });
    out.push({ type: 'throw', id: e.id, sound: 'whoosh' });
    e.state = 'walk';
    e.cool = kind.torch.every;
    return;
  }
  if (e.state === 'sword') {
    if (e.t > 0) return;
    // The big blow: the hero in reach is pushed back, and Nghé lowers her horns.
    e.state = 'walk';
    e.cool = kind.sword.every;
    out.push({ type: 'blow', id: e.id, sound: 'thud' });
    if (ctx.hero && dist(e, ctx.hero) <= kind.sword.reach + 1) {
      const away = unit({ x: ctx.hero.x - e.x, z: ctx.hero.z - e.z });
      out.push({ type: 'hurt', id: 'hero', by: e.id, push: { x: away.x * HURT, z: away.z * HURT } });
    }
    return;
  }
  if (e.state === 'steal') {
    if (raid.bar?.down > 0) {
      e.t = STEAL;
      return;
    }
    if (e.t > 0) return;
    // The enemy takes rice from the store at the open gate, and leaves (nothing at the lowest level).
    raid.losses += 1;
    const give = {};
    if (raid.loss !== 'none') for (const [k, n] of Object.entries(raid.take)) give[k] = n * (raid.loss === 'normal' ? 2 : 1);
    for (const [k, n] of Object.entries(give)) raid.taken[k] = (raid.taken[k] ?? 0) + n;
    out.push({ type: 'take', id: e.id, take: give, sound: 'pickup' });
    if (kind.boss) {
      // The general does not leave: he steps back and comes again.
      e.state = 'back';
      e.back = { x: e.x + raid.dir.x * 10, z: e.z + raid.dir.z * 10 };
      e.t = 10 / (kind.speed * 2);
    } else e.state = 'retreat';
    return;
  }
  // Walk. The tells come first: the torch of a scout, the sword of the general.
  const d = along(raid, e);
  // A new slingshot: the enemy stops on the road and waits for the first shot of the child.
  if (raid.hold?.tool === 'sling' && d <= HOLD_AT) {
    e.facing = faceTo(e, raid.wall);
    return;
  }
  const gateD = along(raid, raid.gate);
  if (kind.torch && e.cool <= 0 && d - gateD <= kind.torch.range && d - gateD > 1) {
    e.state = 'torch';
    e.t = kind.torch.tell;
    e.lit = raid.t;
    out.push({ type: 'light', id: e.id, sound: 'fire' });
    return;
  }
  if (kind.sword && e.cool <= 0 && ctx.hero && dist(e, ctx.hero) <= kind.sword.reach) {
    e.state = 'sword';
    e.t = kind.sword.tell;
    out.push({ type: 'sword', id: e.id });
    return;
  }
  // In an easy raid, the enemy stops at each post for some seconds (#55): the child has time to
  // count the post and to press.
  if (raid.stop > 0) {
    const post = raid.posts.find((q) => !e.waited.includes(`post:${q.d}`) && d <= q.d + 0.2 && d > q.d - 2);
    if (post) {
      e.waited.push(`post:${post.d}`);
      e.state = 'wait';
      e.t = raid.stop;
      e.facing = faceTo(e, raid.wall);
      out.push({ type: 'pause', id: e.id, post: post.d });
      return;
    }
  }
  // A villager at a spot: the enemy stops for a moment, once for each spot.
  for (const s of raid.spots) {
    if (s.helper?.state !== 'there' || e.waited.includes(s.id) || dist(e, s) > NEAR_SPOT) continue;
    e.waited.push(s.id);
    e.state = 'wait';
    e.t = PAUSE;
    e.facing = faceTo(e, s);
    out.push({ type: 'pause', id: e.id, spot: s.id });
    return;
  }
  // A trap under the feet.
  for (const trap of raid.traps) {
    if (trap.sprung || dist(e, trap) > TRAP) continue;
    trap.sprung = true;
    if (!kind.trap) {
      out.push({ type: 'crush', id: e.id, trap: trap.id, sound: 'crack' });
      continue;
    }
    e.state = 'sit';
    e.t = kind.trap;
    out.push({ type: 'snap', id: e.id, trap: trap.id, sound: 'snap' });
    return;
  }
  if (walkTo(e, e.to, kind.speed, dt)) {
    // At the gate. A barred gate holds the enemy until the bar lifts.
    e.state = 'steal';
    e.t = STEAL;
    e.facing = faceTo(e, raid.wall);
    out.push({ type: 'gate', id: e.id });
  }
}

// A hit on an enemy: the damage pops up, and an enemy with enough hits retreats. A general at the
// last hit of his phase stands, stunned, for the next phase.
function hit(raid, e, damage, by, out) {
  if (!alive(e) || e.state === 'stunned') return false;
  // The first hit of a new slingshot: the raid goes on (a short or a long shot shows on the road,
  // and the enemy waits for the next try).
  if (raid.hold?.tool === 'sling') raid.hold = null;
  e.hits = Math.min(e.max, e.hits + damage);
  // A rice ball is food, not a blow: the creature eats it.
  out.push({ type: 'hit', id: e.id, by, damage, left: e.max - e.hits, sound: by === 'riceball' ? 'pickup' : 'hit' });
  if (e.hits < e.max) return true;
  if (raid.kinds[e.kind].boss) {
    e.state = 'stunned';
    out.push({ type: 'stunned', id: e.id });
    return true;
  }
  e.state = 'retreat';
  out.push({ type: 'retreat', id: e.id, calm: Boolean(raid.kinds[e.kind].calm) });
  return true;
}

// The gate bar comes down for some seconds, and then it lifts.
function tickGate(raid, dt, out) {
  const bar = raid.bar;
  if (!bar) return;
  bar.cool = Math.max(0, bar.cool - dt);
  if (bar.down <= 0) return;
  bar.down -= dt;
  if (bar.down <= 0) {
    bar.down = 0;
    out.push({ type: 'unbar', id: 'raid', sound: 'plank-up' });
  }
}

function tickHelpers(raid, dt, out) {
  for (const s of raid.spots) {
    const h = s.helper;
    if (!h || h.state !== 'go') continue;
    h.t += dt;
    const d = dist(h.from, s);
    const k = Math.min(1, (h.t * HELPER) / (d || 1));
    h.x = h.from.x + (s.x - h.from.x) * k;
    h.z = h.from.z + (s.z - h.from.z) * k;
    if (k >= 1) {
      h.state = 'there';
      out.push({ type: 'spot', id: s.id });
    }
  }
}

// Nghé runs to the enemy (ctx.nghe: where Nghé is now; without it, the run takes CHARGE
// seconds), and butts it.
function tickCharge(raid, dt, ctx, out) {
  const n = raid.nghe;
  if (!n) return;
  n.t += dt;
  const e = raid.enemies.find((x) => x.id === n.target);
  if (e) n.to = { x: e.x, z: e.z };
  const there = ctx.nghe && e ? dist(ctx.nghe, e) <= 2.5 : n.t >= CHARGE;
  if (!there && n.t < CHARGE * 5) return;
  raid.nghe = null;
  if (!e || !alive(e)) return;
  out.push({ type: 'butt', id: e.id, sound: 'thud' });
  hit(raid, e, 1, 'nghe', out);
  if (alive(e) && e.state !== 'stunned') {
    // Pushed back along the road, toward where it came from.
    e.state = 'back';
    e.back = { x: e.x + raid.dir.x * 6, z: e.z + raid.dir.z * 6 };
    e.t = 6 / (raid.kinds[e.kind].speed * 2);
  }
}

function tickStones(raid, dt, out) {
  for (const s of raid.stones) {
    s.t += dt;
    if (s.t < s.flight.t) continue;
    s.done = true;
    const at = { x: raid.wall.x + raid.dir.x * s.count, z: raid.wall.z + raid.dir.z * s.count };
    // The enemy where the stone lands, at that moment: the count along the road, and anywhere in
    // the lane of the road (an enemy that walks a little to the side is on the road too, #50).
    const onLane = (e) => Math.abs(along(raid, e) - s.count) <= raid.sling.hit && Math.abs(across(raid, e)) <= LANE;
    const target = raid.enemies.filter((e) => alive(e) && e.state !== 'stunned' && onLane(e)).sort((a, b) => dist(a, at) - dist(b, at))[0] ?? null;
    let solved = false;
    if (target && target.shield > 0) out.push({ type: 'block', id: target.id, sound: 'plank-down' });
    else if (target) solved = hit(raid, target, 1, s.ball ?? 'stone', out);
    // The shot was for the enemy nearest to the count (on the road, now).
    const aimed = raid.enemies.filter((e) => alive(e) && e.state !== 'stunned' || e === target)
      .map((e) => ({ e, off: Math.abs(along(raid, e) - s.count) })).filter((q) => q.off <= AIM).sort((a, b) => a.off - b.off)[0]?.e ?? null;
    const goal = aimed ? Math.round(along(raid, aimed)) : null;
    out.push({ type: 'land', id: s.id, at, count: s.count, hit: solved, off: goal === null ? null : s.count - goal, sound: solved ? null : 'thud' });
    if (!solved) raid.marks.push({ id: `mark:${s.id}`, ...at, t: MARK, look: s.ball ?? 'stone' });
    // The prediction of the first shot goes to the log with the result.
    if (s.first) {
      const p = raid.predict;
      out.push({ type: 'prediction', id: 'raid', task: `raid-${raid.id}`, gap: p.gap ?? goal ?? s.count, guess: p.guess, used: s.count, solved: solved && target === aimed });
    }
    // The skill event: the count of the shot against the distance of the enemy it was for. The next
    // shot at the same enemy after a miss is a correction (the difference on the road).
    if (aimed) {
      const was = raid.aims[aimed.id];
      const hitAimed = solved && target === aimed;
      const kinds = raid.skills.shot[Math.min(raid.skills.shot.length - 1, raid.level)];
      const correct = Boolean(was);
      out.push(skill(raid, correct ? 'correct' : 'shot', {
        skill: correct ? kinds.correct : kinds.first, solved: hitAimed, efficient: hitAimed && !correct, first: !correct,
        parts: correct ? [was.got, s.count] : [s.count], target: goal, gap: correct ? Math.abs(goal - was.got) : goal,
      }));
      raid.aims[aimed.id] = hitAimed ? null : { got: s.count };
    }
  }
  raid.stones = raid.stones.filter((s) => !s.done);
}

// The torches in the air: a barred gate stops them.
function tickTorches(raid, dt, out) {
  for (const t of raid.torches) {
    t.t += dt;
    if (t.t < t.fly) continue;
    t.done = true;
    const bar = raid.bar;
    const barred = Boolean(bar && bar.down > 0);
    if (barred) {
      // The torch hits the bar and falls on the road in front of the gate. It burns there.
      const at = { x: raid.gate.x + raid.dir.x * 2, z: raid.gate.z + raid.dir.z * 2 };
      raid.fires.push({ id: `fire:${raid.made++}`, ...at, t: BURN });
      out.push({ type: 'stop', id: t.id, at, sound: 'thud' });
    } else {
      // Over the open gate: the torch lands inside, and the villagers put it out. It costs.
      raid.losses += 1;
      out.push({ type: 'burn', id: t.id, at: { x: raid.wall.x - raid.dir.x * 3, z: raid.wall.z - raid.dir.z * 3 }, sound: 'fire' });
    }
    // The gate is timing, not a skill: a fact of the raid (was the bar down, and did it come down
    // after the tell), and no skill event.
    const tapped = bar?.tapped;
    if (bar && (barred || (tapped !== null && tapped >= t.lit))) out.push({ type: 'gated', id: 'raid', barred, afterTell: barred && tapped !== null && tapped >= t.lit });
  }
  raid.torches = raid.torches.filter((t) => !t.done);
}

// The next phase when this one is over; the end of the raid after the last phase.
function nextPhase(raid, out) {
  const phase = raid.phases[raid.phase];
  if (phase.bamboo) return; // it waits for the tap on the bamboo (bamboo())
  const allIn = phase.waves.every((w) => w.in);
  const mine = raid.enemies.filter((e) => e.phase === raid.phase);
  const over = phase.boss
    ? mine.some((e) => e.kind === phase.boss && e.state === 'stunned')
    : allIn && mine.every((e) => !alive(e));
  if (!over) return;
  if (raid.phase < raid.phases.length - 1) {
    raid.phase += 1;
    raid.phaseT = 0;
    const next = raid.phases[raid.phase];
    out.push({ type: 'phase', id: 'raid', phase: next.id, dialogue: next.dialogue ?? null });
    if (next.bamboo) raid.bamboo = { ...hb(next.bamboo), pulled: false };
    return;
  }
  if (raid.enemies.length) return; // the last ones walk away first
  end(raid, raid.losses <= raid.allow, out);
}

function end(raid, won, out) {
  raid.result = won ? 'won' : 'lost';
  out.push({ type: 'end', id: 'raid', won, taken: { ...raid.taken }, sound: won ? 'drum' : null });
}

// A skill event of the raid (the child never sees it).
function skill(raid, what, r) {
  const s = raid.skills[what] ?? {};
  let level = s.level ?? 1;
  if (what === 'shot') level = r.target <= (raid.skills.near ?? 20) ? 1 : 2;
  if (what === 'correct') level = r.gap <= 5 ? 1 : r.gap <= 10 ? 2 : 3;
  return {
    type: 'skill', id: 'raid', skill: r.skill ?? s.skill, level, task: `raid-${raid.id}`, solved: r.solved, correct: r.solved,
    efficient: r.efficient, first: r.first, evidence: true, mashing: false, parts: r.parts, target: r.target,
    latencies: [], resets: 0, hint: 0, hintSeen: null,
  };
}

// Commands of the child ------------------------------------------------------------------------

// A shot from the slingshot at the wall, along the road: the pull counts `count` half blocks,
// and the stone lands exactly there. Return the events (none when the slingshot is not ready).
// ball: what flies (a rice ball for the creatures of the river), from the data of the raid.
export function shoot(raid, count) {
  if (raid.result || raid.reload > 0 || !(count >= 1)) return [];
  const flight = flightFor(count, raid.sling);
  raid.reload = raid.sling.reload;
  // The first shot of the raid carries the prediction; a pull with no tap on a post skips it.
  const first = raid.shots === 0;
  raid.shots += 1;
  if (raid.predict.state === 'pending') raid.predict.state = 'skipped';
  const s = { id: `stone:${++raid.made}`, count: flight.count, flight, t: 0, first, ...(raid.ball ? { ball: raid.ball } : {}) };
  raid.stones.push(s);
  return [{ type: 'shoot', id: s.id, count: flight.count, sound: 'sling' }];
}

// The child has the tool that the raid waits for (a trap in the hands): the raid goes on.
export function releaseHold(raid, tool) {
  if (raid.hold?.tool !== tool) return [];
  raid.hold = null;
  return [{ type: 'release', id: 'raid', tool }];
}

// A tap on a post before the first shot: the child says where the enemy is (the post nearest to
// it). Return the events.
export function predict(raid, post) {
  const p = raid.predict;
  if (raid.result || p.state !== 'pending' || !raid.posts.some((q) => q.d === post)) return [];
  const first = active(raid).filter((e) => e.state !== 'stunned').sort((a, b) => along(raid, a) - along(raid, b))[0];
  if (!first) return [];
  p.state = 'done';
  p.guess = post;
  p.gap = Math.round(along(raid, first));
  const near = raid.posts.reduce((a, q) => (Math.abs(q.d - p.gap) < Math.abs(a.d - p.gap) ? q : a)).d;
  return [{ type: 'predict', id: 'raid', post, near, gap: p.gap, sound: 'tap' }];
}

// The place of a stone in the air (half blocks, h over the ground at the wall).
export function stoneAt(raid, s) {
  const p = positionAt(s.flight, Math.min(s.t, s.flight.t), raid.sling);
  return { x: raid.wall.x + raid.dir.x * p.d, z: raid.wall.z + raid.dir.z * p.d, h: Math.max(0, p.h) };
}

// The place of a torch in the air: a low arc from the scout to the gate.
export function torchAt(t) {
  const k = Math.min(1, t.t / t.fly);
  return { x: t.from.x + (t.to.x - t.from.x) * k, z: t.from.z + (t.to.z - t.from.z) * k, h: 3 + 5 * k * (1 - k) * 2 };
}

// A tap on the gate: the bar comes down.
export function barGate(raid) {
  const bar = raid.bar;
  if (!bar || raid.result || bar.cool > 0) return [];
  bar.down = bar.hold;
  bar.cool = bar.hold + bar.rest;
  bar.tapped = raid.t;
  return [{ type: 'bar', id: 'raid', sound: 'thud' }];
}

// Call a villager to a spot (the first villager walks from the wall).
export function callHelper(raid, spotId) {
  const s = raid.spots.find((x) => x.id === spotId);
  if (!s || s.helper || raid.helpers <= 0 || raid.result) return [];
  raid.helpers -= 1;
  s.helper = { state: 'go', t: 0, from: { ...raid.wall }, x: raid.wall.x, z: raid.wall.z };
  return [{ type: 'summon', id: s.id }];
}

// Nghé charges at the first enemy (the nearest one to the gate), once in a raid.
export function charge(raid, from) {
  if (raid.charge !== 'ready' || raid.result) return [];
  const first = active(raid).filter((e) => e.state !== 'stunned').sort((a, b) => along(raid, a) - along(raid, b))[0];
  if (!first) return [];
  raid.charge = 'used';
  raid.nghe = { target: first.id, t: 0, from: { x: from.x, z: from.z }, to: { x: first.x, z: first.z } };
  return [{ type: 'charge', id: first.id, sound: 'moo' }];
}

// The drag of an element from a source to a point (half blocks). source: the id of a source of
// the raid (data), or the id of a fire on the road.
export function pour(raid, sourceId, at) {
  if (raid.result) return [];
  const fire = raid.tools.includes('fire') ? raid.fires.find((f) => f.id === sourceId) : null;
  const src = fire ? { kind: 'fire', cool: 0 } : raid.sources.find((s) => s.id === sourceId);
  if (!src || src.cool > 0) return [];
  const out = [];
  const inWet = (p) => raid.wet.some((w) => dist(w, p) <= w.r);
  if (src.kind === 'water') {
    src.cool = src.every ?? 2;
    raid.wet.push({ x: at.x, z: at.z, r: WET, t: DRY });
    const out1 = raid.fires.filter((f) => dist(f, at) <= WET + 1);
    raid.fires = raid.fires.filter((f) => !out1.includes(f));
    out.push({ type: 'water', id: sourceId, at, out: out1.map((f) => f.id), sound: 'splash' });
    return out;
  }
  if (src.kind === 'fire') {
    if (fire) raid.fires = raid.fires.filter((f) => f !== fire);
    else src.cool = src.every ?? 4;
    // Fire on water: steam, and the wet ground there dries.
    raid.wet = raid.wet.filter((w) => dist(w, at) > w.r);
    out.push({ type: 'flame', id: sourceId, at, sound: 'fire' });
    for (const e of raid.enemies) {
      if (!alive(e) || dist(e, at) > FLAME) continue;
      if (raid.kinds[e.kind].shield) {
        // A soldier raises his wet shield: stones bounce off it, and it drips.
        e.shield = raid.kinds[e.kind].shield;
        raid.wet.push({ x: e.x, z: e.z, r: DRIP, t: DRY, by: e.id });
        out.push({ type: 'shield', id: e.id });
      } else hit(raid, e, 1, 'fire', out);
    }
    return out;
  }
  if (src.kind === 'lightning') {
    src.cool = src.every ?? 6;
    // Lightning into a wet zone: every enemy in the wet zones is shocked. On dry ground: a spark.
    const wet = inWet(at);
    const shocked = wet ? raid.enemies.filter((e) => alive(e) && inWet(e)) : [];
    out.push({ type: wet ? 'shock' : 'spark', id: sourceId, at, shocked: shocked.map((e) => e.id), sound: wet ? 'thunder' : 'snap' });
    for (const e of shocked) {
      e.shield = 0;
      hit(raid, e, 1, 'lightning', out);
    }
    out.push(skill(raid, 'chain', { solved: shocked.length > 0, efficient: shocked.length > 1, first: true, parts: [shocked.length], target: shocked.length }));
    return out;
  }
  return out;
}

// The tap on the bamboo in the last phase of the boss: Gióng pulls it for the strike that ends
// the raid. Every enemy retreats.
export function pullBamboo(raid) {
  const phase = raid.phases[raid.phase];
  if (!phase?.bamboo || raid.bamboo?.pulled || raid.result) return [];
  raid.bamboo.pulled = true;
  const out = [{ type: 'phase', id: 'raid', phase: 'strike', dialogue: phase.after ?? null }, { type: 'strike', id: 'giong', sound: 'thunder' }];
  for (const e of raid.enemies) {
    if (e.state === 'gone') continue;
    e.state = 'retreat';
    e.hits = e.max;
    out.push({ type: 'retreat', id: e.id, calm: false });
  }
  end(raid, true, out);
  return out;
}

// A trap that the child put on the road at `d` half blocks: at the post that the villager named,
// it is counting on the number line (one skill event, once in a raid); anywhere else it is play
// and sends nothing. Return the event, or null.
export function trapPut(raid, d) {
  if (raid.trapPost === null || raid.trapDone || d !== raid.trapPost) return null;
  raid.trapDone = true;
  return skill(raid, 'trap', { solved: true, efficient: true, first: true, parts: [d], target: raid.trapPost });
}

// Traps on the road: the places of the traps that the child put (from the world), as
// { id, x, z }. A trap that snapped stays snapped.
export function setTraps(raid, list) {
  const was = new Map(raid.traps.map((t) => [t.id, t]));
  raid.traps = list.map((t) => ({ ...t, sprung: was.get(t.id)?.sprung ?? Boolean(t.sprung) }));
}
