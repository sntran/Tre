// Movement: an entity with an intent walks or runs in that direction, with collision against
// blocked cells and cliffs, and stands on the ground. People and enemies (solid) push it away a
// little, like round walls. While the world waits (a dialogue), nothing walks. On the back of
// Nghé (riding) the hero is faster. motion.idle counts the seconds that the hero stands still.
// A hero who falls into the water (fall) does not walk: the place system moves the hero. A jump
// (src/core/world/jump.js) goes in an arc from its start to its end, after a short crouch; a
// jump into the gap of a task ends in the water (a fall).
// Each step sends the event "step" with the ground under the foot (grass, wood, or water). A heavy
// thing in the hands (item.pace, such as a tray of five bowls) makes the walk slower, and so does
// the mist of the land of a later era.
export const WRITES = ['position', 'motion', 'jump', 'fall', 'events'];

import { query, getEntity } from '../state.js';
import { stepBody, moveCircle, MOVE } from '../move.js';
import { arcAt } from '../jump.js';

export const RIDE_SPEED = 1.35; // the speed factor on the back of Nghé
const STRIDE = 2.4; // half blocks between two steps
const MIST_SLOW = 0.6; // the most that the mist takes from the speed

// The speed factor of the thing in the hands (1 for a light thing or empty hands).
function paceOf(world, e) {
  const held = e.hands?.holds ? getEntity(world, e.hands.holds) : null;
  return held?.item?.pace ?? 1;
}

export function move(world, dt, rng, env) {
  const solids = query(world, 'solid', 'position');
  for (const e of query(world, 'position', 'motion')) {
    if (e.jump && !e.fall) {
      jumpStep(world, e, dt, env);
      continue;
    }
    if (e.follow || e.steer || e.fall || (!e.control && !e.intent)) continue;
    const p = e.position;
    const m = e.motion;
    const i = world.paused ? null : e.intent;
    // The helpers work in map cells: one cell is 2 half blocks.
    // In the mist of the land of a later era the walk is slow, slower the deeper it goes.
    const mist = Math.min(MIST_SLOW, (env.mistAt?.(p.x / 2, p.z / 2) ?? 0) * 0.15);
    const body = { x: p.x / 2, y: p.z / 2, vx: m.vx / 2, vy: m.vz / 2, facing: p.facing, speedFactor: (e.riding ? RIDE_SPEED : 1) * paceOf(world, e) * (1 - mist) };
    stepBody(body, i ? { dx: i.dx, dy: i.dz, strength: i.strength, run: i.run } : { dx: 0, dy: 0, strength: 0 }, dt, env.near(body.x, body.y));
    for (const s of solids) {
      // A hidden thing (the rice cakes of Tết on another day) is not there: it does not block (#54).
      if (s === e || s.hidden || (e.riding && s.pushable)) continue;
      if (s.solid.rect) {
        pushOutOfRect(body, s.solid.rect, env);
        continue;
      }
      const dx = body.x - s.position.x / 2;
      const dy = body.y - s.position.z / 2;
      const d = Math.hypot(dx, dy);
      const r = s.solid.r / 2;
      if (d >= r || d < 1e-6) continue;
      const k = (r - d) / d;
      const out = moveCircle(body, dx * k, dy * k, MOVE.radius, env.near(body.x, body.y).isBlocked);
      body.x = out.x;
      body.y = out.y;
    }
    p.x = body.x * 2;
    p.z = body.y * 2;
    p.facing = body.facing;
    p.y = env.groundY(body.x, body.y);
    m.vx = body.vx * 2;
    m.vz = body.vy * 2;
    m.speed = body.speed * 2;
    m.shallow = Boolean(body.shallow);
    m.wade = Boolean(body.wade);
    m.idle = m.speed < 0.2 ? (m.idle ?? 0) + dt : 0;
    m.stride = (m.stride ?? 0) + m.speed * dt;
    if (m.stride > STRIDE) {
      m.stride = 0;
      const ground = env.groundAt?.(p.x, p.z);
      world.events.push({ type: 'step', id: e.id, sound: ground === 'shallow' || ground === 'surf' || ground === 'water' ? 'step-water' : ground === 'bridge' || ground === 'bamboo' ? 'step-wood' : 'step-grass' });
    }
  }
}

// A solid box of a thing of a task (a trough, a heap; rect in half blocks): the body goes out of it
// on the shortest way, as out of a wall.
function pushOutOfRect(body, rect, env) {
  const r = MOVE.radius;
  const x0 = rect.x0 / 2 - r;
  const x1 = rect.x1 / 2 + r;
  const z0 = rect.z0 / 2 - r;
  const z1 = rect.z1 / 2 + r;
  if (body.x <= x0 || body.x >= x1 || body.y <= z0 || body.y >= z1) return;
  const ways = [[x0 - body.x, 0], [x1 - body.x, 0], [0, z0 - body.y], [0, z1 - body.y]];
  const [dx, dy] = ways.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]))[0];
  const out = moveCircle(body, dx * 1.001, dy * 1.001, r, env.near(body.x, body.y).isBlocked);
  body.x = out.x;
  body.y = out.y;
}

// One step of a jump: the crouch, then the arc. At the end: the landing (a puff of dust, or a
// splash in shallow water), or the water of the gap of a task (the fall of the place system).
function jumpStep(world, e, dt, env) {
  const j = e.jump;
  const p = e.position;
  Object.assign(e.motion, { vx: 0, vz: 0, speed: 0 });
  if (world.paused) return;
  if (j.crouch > 0) {
    j.crouch -= dt;
    return;
  }
  j.t += dt;
  const k = Math.min(1, j.t / j.time);
  const groundTo = env.groundY(j.to.x / 2, j.to.z / 2);
  p.x = j.from.x + (j.to.x - j.from.x) * k;
  p.z = j.from.z + (j.to.z - j.from.z) * k;
  p.y = j.from.y + (groundTo - j.from.y) * k + arcAt(j.top, k);
  if (k < 1) return;
  delete e.jump;
  if (j.fall) {
    e.fall = { t: 0, x: p.x, z: p.z, y: p.y, water: j.fall.water ?? 2, time: j.fall.time ?? 1.2, out: { ...j.fall.out }, zone: j.fall.zone };
    world.events.push({ type: 'tip', id: e.id, jump: true, sound: 'creak' });
    return;
  }
  p.y = groundTo;
  world.events.push({ type: 'land', id: e.id, at: { x: p.x, z: p.z }, sound: j.splash ? 'step-water' : 'step-grass' });
  if (j.splash) world.events.push({ type: 'splash', id: e.id, sound: 'splash' });
}
