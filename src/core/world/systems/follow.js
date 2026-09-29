// Following: Nghé walks behind the hero on the trail that the hero walked, with a soft lag, and
// jumps behind the hero when it is too far away (for example after a ferry).
export const WRITES = ['position', 'motion', 'follow'];

import { query, getEntity } from '../state.js';
import { stepFollower } from '../move.js';

export function follow(world, dt, rng, env) {
  for (const e of query(world, 'follow', 'position', 'motion')) {
    const leader = getEntity(world, e.follow.target);
    if (!leader?.position) continue;
    const p = e.position;
    const m = e.motion;
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
  }
}
