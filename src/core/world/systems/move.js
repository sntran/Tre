// Movement: an entity with an intent walks or runs in that direction, with collision against
// blocked cells and cliffs, and stands on the ground. People and enemies (solid) push it away a
// little, like round walls. While the world waits (a dialogue), nothing walks.
export const WRITES = ['position', 'motion'];

import { query } from '../state.js';
import { stepBody, moveCircle, MOVE } from '../move.js';

export function move(world, dt, rng, env) {
  const solids = query(world, 'solid', 'position');
  for (const e of query(world, 'position', 'motion')) {
    if (e.follow || e.swim) continue;
    const p = e.position;
    const m = e.motion;
    const i = world.paused ? null : e.intent;
    // The helpers work in map cells: one cell is 2 half blocks.
    const body = { x: p.x / 2, y: p.z / 2, vx: m.vx / 2, vy: m.vz / 2, facing: p.facing };
    stepBody(body, i ? { dx: i.dx, dy: i.dz, strength: i.strength, run: i.run } : { dx: 0, dy: 0, strength: 0 }, dt, env.near(body.x, body.y));
    for (const s of solids) {
      if (s === e) continue;
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
  }
}
