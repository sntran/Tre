// Movement: an entity with an intent walks or runs in that direction, with collision against
// blocked cells and cliffs, and stands on the ground. People and enemies (solid) push it away a
// little, like round walls. While the world waits (a dialogue), nothing walks. On the back of
// Nghé (riding) the hero is faster. motion.idle counts the seconds that the hero stands still.
// Each step sends the event "step" with the ground under the foot (grass, wood, or water).
export const WRITES = ['position', 'motion', 'events'];

import { query } from '../state.js';
import { stepBody, moveCircle, MOVE } from '../move.js';

export const RIDE_SPEED = 1.35; // the speed factor on the back of Nghé
const STRIDE = 2.4; // half blocks between two steps

export function move(world, dt, rng, env) {
  const solids = query(world, 'solid', 'position');
  for (const e of query(world, 'position', 'motion')) {
    if (e.follow || e.steer || (!e.control && !e.intent)) continue;
    const p = e.position;
    const m = e.motion;
    const i = world.paused ? null : e.intent;
    // The helpers work in map cells: one cell is 2 half blocks.
    const body = { x: p.x / 2, y: p.z / 2, vx: m.vx / 2, vy: m.vz / 2, facing: p.facing, speedFactor: e.riding ? RIDE_SPEED : 1 };
    stepBody(body, i ? { dx: i.dx, dy: i.dz, strength: i.strength, run: i.run } : { dx: 0, dy: 0, strength: 0 }, dt, env.near(body.x, body.y));
    for (const s of solids) {
      if (s === e || (e.riding && s.pushable)) continue;
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
    m.idle = m.speed < 0.2 ? (m.idle ?? 0) + dt : 0;
    m.stride = (m.stride ?? 0) + m.speed * dt;
    if (m.stride > STRIDE) {
      m.stride = 0;
      const ground = env.groundAt?.(p.x, p.z);
      world.events.push({ type: 'step', id: e.id, sound: ground === 'shallow' || ground === 'water' ? 'step-water' : ground === 'bridge' ? 'step-wood' : 'step-grass' });
    }
  }
}
