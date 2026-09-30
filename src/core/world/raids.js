// Raids: the defense of the village, in light real time on the map of the village. The pure rules
// (data/raids.json), with no DOM and no world state: a raid is plain data, and stepRaid moves it
// on. The raid system (systems/raid.js) keeps the figures of the raid in the world state.
//
//   Enemies walk on a straight path from their start to the gate, and never run. An enemy that is
//   hit enough times retreats (a creature becomes calm and swims away). An enemy at the gate takes
//   a coin and leaves (nothing at the lowest level). Nobody is hurt.
//   The slingshot: the child pulls back and lets go. The stone flies on a real arc at one angle;
//   the pull gives the speed, so the child finds the distance. Posts stand along the road.
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
// Each shot at an enemy, each trap that snaps, each torch at a gate that the child barred, and
// each strike of lightning is one skill event for the learner (the child never sees it).
// Units: half blocks (one map cell is 2) and seconds. The data gives places in map cells.
import { byGrade } from '../grades.js';

const WET = 3; // half blocks: the radius of a wet zone from the water
const DRIP = 2.5; // half blocks: the radius of the wet zone under a wet shield
const DRY = 14; // seconds: a wet zone dries
const FLAME = 3; // half blocks: the reach of fire at a point
const BURN = 9; // seconds: a torch on the road burns
const CHARGE = 0.7; // seconds: Nghé runs to the first enemy
const STEAL = 1.2; // seconds: an enemy at an open gate takes a coin
const HELPER = 2; // half blocks each second: a villager walks to a spot
const PAUSE = 2.5; // seconds: an enemy stops in front of a villager
const NEAR_SPOT = 5; // half blocks: an enemy stops when it passes this near a villager
const TRAP = 0.9; // half blocks: an enemy steps on a trap this near
const HURT = 3; // half blocks: the blow of the general pushes the hero back
const AIM = 0.6; // radians: the aimed enemy is inside this angle from the line of the shot

// The slingshot, as in the first prototype (world units are half blocks).
export const SLING = Object.freeze({ g: 20, h0: 2.2, vMax: 27, angle: 0.7, maxPull: 1, hit: 1.5, reload: 0.6, preview: 0.28 });

// The level (0, 1, or 2) of the raids for a grade: grade 1 and lower is 0 (a lost raid takes
// nothing).
export function raidLevel(raids, grade) {
  const level = byGrade(raids.grades ?? {}, grade) ?? 1;
  return Math.max(0, Math.min(2, level - 1));
}

// The flight --------------------------------------------------------------------------------

// A shot from a pull (0 to maxPull; more is a full pull).
export function shotOf(pull, cfg = SLING) {
  const power = Math.max(0, Math.min(1, pull / cfg.maxPull));
  return { power, speed: power * cfg.vMax, angle: cfg.angle };
}

// The stone at t seconds after the release: d along the line of the shot, and h over the ground.
export function positionAt(shot, t, cfg = SLING) {
  const vx = shot.speed * Math.cos(shot.angle);
  const vy = shot.speed * Math.sin(shot.angle);
  return { d: vx * t, h: cfg.h0 + vy * t - (cfg.g * t * t) / 2 };
}

// The time when the stone reaches the ground, and the distance there.
export function landingOf(shot, cfg = SLING) {
  const vy = shot.speed * Math.sin(shot.angle);
  const t = (vy + Math.sqrt(vy * vy + 2 * cfg.g * cfg.h0)) / cfg.g;
  return { t, d: shot.speed * Math.cos(shot.angle) * t };
}

// The pull that lands a stone at a distance (for the tests and the stories).
export function pullFor(distance, cfg = SLING) {
  const c = Math.cos(cfg.angle);
  const v = Math.sqrt((cfg.g * distance * distance) / (2 * c * c * (cfg.h0 + distance * Math.tan(cfg.angle))));
  return (v / cfg.vMax) * cfg.maxPull;
}

// The first part of the arc, for the dotted line while the child pulls (not the landing point).
export function previewOf(shot, count = 8, cfg = SLING) {
  const out = [];
  for (let i = 1; i <= count; i++) out.push(positionAt(shot, (cfg.preview * i) / count, cfg));
  return out;
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
export function createRaid(raids, id, level = 0, loss = null) {
  const def = raids.raids[id];
  const sling = { ...SLING, ...raids.sling };
  const wall = hb(def.wall);
  const gate = hb(def.gate);
  const dir = unit({ x: def.dir[0], z: def.dir[1] });
  const phases = def.phases ?? [{ id: 'raid', waves: def.waves }];
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
    bar: def.bar ? { down: 0, cool: 0, tapped: null, ...(raids.gateBar ?? { hold: 3, rest: 1 }) } : null,
    posts: (raids.posts ?? []).map((d) => ({ d, x: wall.x + dir.x * d, z: wall.z + dir.z * d })),
    enemies: [],
    count: 0, // the enemies so far (raider:1, raider:2, ...)
    made: 0, // the other things so far (stones, fires)
    stones: [],
    torches: [],
    fires: [],
    wet: [],
    traps: [],
    spots: (def.spots ?? []).map((p, i) => ({ id: `spot:${i + 1}`, ...hb(p), helper: null })),
    helpers: def.helpers ?? 0,
    sources: (def.sources ?? []).map((s) => ({ ...s, ...hb(s.at), cool: 0 })),
    charge: 'ready',
    nghe: null,
    reload: 0,
    losses: 0,
    taken: {},
    allow: def.allow ?? 1,
    take: def.take ?? { coin: 1 },
    loss: loss ?? (level > 0 ? 'small' : 'none'),
    aims: {},
    bamboo: null,
    sling,
    kinds: raids.enemies,
    skills: raids.skills,
  };
}

// The distance of a point along the road from the wall.
export const along = (raid, p) => (p.x - raid.wall.x) * raid.dir.x + (p.z - raid.wall.z) * raid.dir.z;

const alive = (e) => e.state !== 'retreat' && e.state !== 'gone';
const active = (raid) => raid.enemies.filter(alive);

// One step of the raid. ctx: { hero, nghe } (where they are, in half blocks). Return the events
// of the step.
export function stepRaid(raid, dt, ctx = {}) {
  const out = [];
  if (raid.result) return out;
  raid.t += dt;
  raid.phaseT += dt;
  raid.reload = Math.max(0, raid.reload - dt);
  spawn(raid, out);
  tickGate(raid, dt, out);
  tickHelpers(raid, dt, out);
  tickCharge(raid, dt, ctx, out);
  for (const e of raid.enemies) tickEnemy(raid, e, dt, ctx, out);
  tickStones(raid, dt, out);
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
    w.in = true;
    const kind = raid.kinds[w.kind];
    const from = hb(w.from);
    const to = w.to ? hb(w.to) : { x: raid.gate.x + (w.side ?? 0) * -raid.dir.z, z: raid.gate.z + (w.side ?? 0) * raid.dir.x };
    const e = {
      id: `raider:${++raid.count}`, kind: w.kind, look: kind.look, x: from.x, z: from.z, from, to,
      hits: 0, max: kind.hits, state: 'walk', t: 0, cool: kind.torch?.first ?? kind.sword?.first ?? 0, waited: [], shield: 0, phase: raid.phase,
    };
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
    // The enemy takes a coin at the open gate, and leaves (nothing at the lowest level).
    raid.losses += 1;
    const give = {};
    if (raid.loss !== 'none') for (const [k, n] of Object.entries(raid.take)) give[k] = n * (raid.loss === 'normal' ? 2 : 1);
    for (const [k, n] of Object.entries(give)) raid.taken[k] = (raid.taken[k] ?? 0) + n;
    out.push({ type: 'take', id: e.id, take: give, sound: 'coin' });
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
    out.push(skill(raid, 'trap', { solved: true, efficient: true, first: true, parts: [Math.round(along(raid, trap))], target: Math.round(along(raid, trap)) }));
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
  e.hits = Math.min(e.max, e.hits + damage);
  out.push({ type: 'hit', id: e.id, by, damage, left: e.max - e.hits, sound: 'hit' });
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
    if (s.t < s.land.t) continue;
    s.done = true;
    const at = { x: s.land.x, z: s.land.z };
    // The enemy at the point where the stone lands, at that moment.
    const target = raid.enemies.filter((e) => alive(e) && e.state !== 'stunned' && dist(e, at) <= raid.sling.hit).sort((a, b) => dist(a, at) - dist(b, at))[0] ?? null;
    let solved = false;
    if (target && target.shield > 0) out.push({ type: 'block', id: target.id, sound: 'plank-down' });
    else if (target) solved = hit(raid, target, 1, 'stone', out);
    out.push({ type: 'land', id: s.id, at, hit: solved, sound: solved ? null : 'thud' });
    // The skill event: the distance of the shot against the distance of the enemy it was for.
    const aimed = raid.enemies.find((e) => e.id === s.aimed);
    if (aimed) {
      const was = raid.aims[aimed.id];
      const goal = Math.round(dist(s.from, aimed));
      const got = Math.round(s.land.d);
      const hitAimed = solved && target === aimed;
      const kinds = raid.skills.shot[Math.min(raid.skills.shot.length - 1, raid.level)];
      const correct = Boolean(was);
      out.push(skill(raid, correct ? 'correct' : 'shot', {
        skill: correct ? kinds.correct : kinds.first, solved: hitAimed, efficient: hitAimed && !correct, first: !correct,
        parts: correct ? [was.got, got] : [got], target: goal, gap: correct ? Math.abs(goal - was.got) : goal,
      }));
      raid.aims[aimed.id] = hitAimed ? null : { got };
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
    // The skill event of the gate: only when the child tapped the bar for this torch or the bar
    // is down. Efficient: the bar came down after the tell (the torch was lit).
    const tapped = bar?.tapped;
    if (bar && (barred || (tapped !== null && tapped >= t.lit))) {
      out.push(skill(raid, 'gate', { solved: barred, efficient: barred && tapped !== null && tapped >= t.lit, first: true, parts: [], target: 0 }));
    }
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

// A shot from the hero (from: half blocks) along dir (on the ground), with a pull. Return the
// events (none when the slingshot is not ready).
export function shoot(raid, from, dir, pull) {
  if (raid.result || raid.reload > 0) return [];
  const u = unit(dir);
  const shot = shotOf(pull, raid.sling);
  if (shot.power <= 0.05) return [];
  const land = landingOf(shot, raid.sling);
  raid.reload = raid.sling.reload;
  // The enemy that the shot was for: the nearest one to the line of the shot, inside a narrow
  // angle.
  let aimed = null;
  let best = Infinity;
  for (const e of raid.enemies) {
    if (!alive(e) || e.state === 'stunned') continue;
    const v = { x: e.x - from.x, z: e.z - from.z };
    const d = Math.hypot(v.x, v.z);
    const off = Math.acos(Math.max(-1, Math.min(1, (v.x * u.x + v.z * u.z) / (d || 1))));
    if (off > AIM) continue;
    const side = d * Math.sin(off) + Math.abs(d - land.d) * 0.25;
    if (side < best) {
      best = side;
      aimed = e;
    }
  }
  const s = {
    id: `stone:${++raid.made}`, from: { x: from.x, z: from.z }, dir: u, shot, t: 0, aimed: aimed?.id ?? null,
    land: { t: land.t, d: land.d, x: from.x + u.x * land.d, z: from.z + u.z * land.d },
  };
  raid.stones.push(s);
  return [{ type: 'shoot', id: s.id, sound: 'sling' }];
}

// The place of a stone in the air (half blocks, h over the ground at its start).
export function stoneAt(raid, s) {
  const p = positionAt(s.shot, Math.min(s.t, s.land.t), raid.sling);
  return { x: s.from.x + s.dir.x * p.d, z: s.from.z + s.dir.z * p.d, h: Math.max(0, p.h) };
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
  const fire = raid.fires.find((f) => f.id === sourceId);
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

// Traps on the road: the places of the traps that the child put (from the world), as
// { id, x, z }. A trap that snapped stays snapped.
export function setTraps(raid, list) {
  const was = new Map(raid.traps.map((t) => [t.id, t]));
  raid.traps = list.map((t) => ({ ...t, sprung: was.get(t.id)?.sprung ?? Boolean(t.sprung) }));
}
