// Following: Nghé walks behind the hero on the trail that the hero walked, with a soft lag, and
// jumps behind the hero when it is too far away (for example after a ferry). Nghé steps back from
// a fire (hot), carries the hero when the hero rides, is happy for a while after a pet, and lies
// down beside the hero when the hero rests at night. With a goal (follow.goal, from the place
// system), Nghé walks to that point and looks to `face`: to the end of the planks of the bridge
// as a hint, or to the edge of the water to pull the hero out. At a closed ford Nghé stops at the
// edge and shakes its head.
export const WRITES = ['position', 'motion', 'follow', 'act'];

import { query, getEntity } from '../state.js';
import { stepFollower, moveCircle, faceOf, MOVE } from '../move.js';

const SHAKE = 1.6; // seconds of a shake of the head

export function follow(world, dt, rng, env) {
  const hot = query(world, 'hot', 'position');
  for (const e of query(world, 'follow', 'position', 'motion')) {
    const leader = getEntity(world, e.follow.target);
    if (!leader?.position) continue;
    const p = e.position;
    const m = e.motion;
    e.follow.happy = Math.max(0, (e.follow.happy ?? 0) - dt);
    // Ridden: Nghé is under the hero.
    if (leader.riding === e.id) {
      Object.assign(p, { x: leader.position.x, y: leader.position.y, z: leader.position.z, facing: leader.position.facing });
      m.vx = leader.motion.vx;
      m.vz = leader.motion.vz;
      m.speed = leader.motion.speed;
      m.shallow = leader.motion.shallow;
      e.follow.trail = [];
      delete e.act;
      continue;
    }
    if (e.follow.goal) {
      goTo(e, e.follow.goal, dt, env);
      // A short trail from Nghé to the hero, so that Nghé walks back after the goal (and does not jump).
      e.follow.trail = [[p.x, p.z], [leader.position.x, leader.position.z]];
      delete e.act;
      continue;
    }
    const f = {
      x: p.x / 2, y: p.z / 2, vx: m.vx / 2, vy: m.vz / 2, facing: p.facing, speed: 0, moving: false,
      idle: e.follow.idle ?? 0, trail: e.follow.trail.map(([x, z]) => ({ x: x / 2, y: z / 2 })),
    };
    stepFollower(f, { x: leader.position.x / 2, y: leader.position.z / 2, facing: leader.position.facing }, dt, env.near(f.x, f.y));
    p.x = f.x * 2;
    p.z = f.y * 2;
    p.facing = f.facing;
    p.y = env.groundY(f.x, f.y);
    m.vx = f.vx * 2;
    m.vz = f.vy * 2;
    m.speed = f.speed * 2;
    m.shallow = Boolean(f.shallow);
    e.follow.idle = f.idle;
    e.follow.trail = f.trail.map((t) => [t.x * 2, t.y * 2]);
    // A fire: Nghé steps back from it.
    for (const h of hot) {
      const hx = p.x - h.position.x;
      const hz = p.z - h.position.z;
      const d = Math.hypot(hx, hz);
      if (d >= h.hot.r || d < 1e-6) continue;
      const away = Math.min(h.hot.r - d, dt * 6);
      const to = { x: p.x + (hx / d) * away, z: p.z + (hz / d) * away };
      if (env.canEnter('land', p, to)) {
        p.x = to.x;
        p.z = to.z;
        p.facing = Math.atan2(hx, hz);
        m.speed = Math.max(m.speed, 6);
      }
    }
    // The hero rests at night (stands still): Nghé lies down beside the hero.
    const near = Math.hypot(leader.position.x - p.x, leader.position.z - p.z) < 7;
    const rest = (world.sky?.night ?? 0) > 0.5 && (leader.motion?.idle ?? 0) > 2 && near && m.speed < 0.2;
    // A closed ford: when the hero stands at its edge, Nghé shakes its head, once for each visit.
    const atFord = world.sky?.high && fordNear(env, leader.position, 3) && fordNear(env, p, 5);
    if (atFord && !e.follow.shook) {
      e.follow.shook = true;
      e.follow.shake = SHAKE;
    }
    if (!atFord) delete e.follow.shook;
    e.follow.shake = Math.max(0, (e.follow.shake ?? 0) - dt);
    if (!e.follow.shake) delete e.follow.shake;
    if (rest) e.act = 'rest';
    else if (e.follow.shake) e.act = 'shake';
    else if (e.follow.happy > 0) e.act = 'happy';
    else delete e.act;
  }
}

// Is a cell of a ford within r half blocks of a point?
function fordNear(env, p, r) {
  return (env.fords ?? []).some((c) => Math.hypot(c.x * 2 + 1 - p.x, c.y * 2 + 1 - p.z) < r + 1);
}

// Walk straight to a goal (half blocks) and look to goal.face at the end.
function goTo(e, goal, dt, env) {
  const p = e.position;
  const m = e.motion;
  const dx = goal.x - p.x;
  const dz = goal.z - p.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.3) {
    Object.assign(m, { vx: 0, vz: 0, speed: 0 });
    if (goal.face !== undefined) p.facing = goal.face;
    return;
  }
  const speed = Math.min(MOVE.walk * 2 * 1.1, 1.5 + d * 3);
  const stepLen = Math.min(d, speed * dt);
  const body = { x: p.x / 2, y: p.z / 2 };
  const next = moveCircle(body, (dx / d) * stepLen / 2, (dz / d) * stepLen / 2, MOVE.radius, env.near(body.x, body.y).isBlocked);
  const moved = Math.hypot(next.x - body.x, next.y - body.y) * 2;
  if (moved > 1e-4) p.facing = faceOf(next.x - body.x, next.y - body.y);
  p.x = next.x * 2;
  p.z = next.y * 2;
  p.y = env.groundY(next.x, next.y);
  m.vx = ((dx / d) * moved) / dt;
  m.vz = ((dz / d) * moved) / dt;
  m.speed = moved / dt;
}
