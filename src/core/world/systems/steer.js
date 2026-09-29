// Steering for everything that moves by itself: animals and people. Each entity turns on only the
// behaviors that it needs in its `steer` component, each with a weight:
//   seek (go to the goal), arrive (slow down near the goal and stop at it), flee (run from a point
//   for some time), wander (short runs with stops), separation (keep away from others), and
//   avoidance (turn before a wall, a house, water, or a field). The medium (land, water, air) says
//   where the entity can go. A flock adds its pull in `steer.bias` (see flock.js).
export const WRITES = ['steer', 'position', 'motion'];

import { query, getEntity } from '../state.js';
import { faceOf } from '../move.js';

// steer: { speed, accel, medium, goal: { x, z } | null, arrived, flee: { x, z, time } | null,
//   bias: { x, z }, wander: { t, dx, dz, on }, weights: { seek, arrive, flee, wander, separation,
//   avoid }, slow (the distance where arrive starts to slow down), radius (for separation), boost
//   (the speed factor when fleeing) }. Units: half blocks and seconds.

export function steer(world, dt, rng, env) {
  const movers = query(world, 'steer', 'position', 'motion').filter((e) => !e.hidden && !e.climb);
  const hero = getEntity(world, 'hero');
  for (const e of movers) {
    const s = e.steer;
    const w = s.weights;
    const p = e.position;
    const m = e.motion;
    let dx = 0;
    let dz = 0;
    // Seek and arrive: go to the goal and stop there.
    s.arrived = false;
    if (s.goal) {
      const gx = s.goal.x - p.x;
      const gz = s.goal.z - p.z;
      const d = Math.hypot(gx, gz);
      if (d < (s.stop ?? 0.4)) s.arrived = true;
      else {
        const k = w.arrive ? Math.min(1, d / (s.slow ?? 3)) * w.arrive : w.seek ?? 1;
        dx += (gx / d) * s.speed * k;
        dz += (gz / d) * s.speed * k;
      }
    }
    // Flee: run away from a point for some time.
    if (s.flee) {
      s.flee.time -= dt;
      const fx = p.x - s.flee.x;
      const fz = p.z - s.flee.z;
      const d = Math.hypot(fx, fz) || 1;
      dx += (fx / d) * s.speed * (s.boost ?? 2) * (w.flee ?? 1);
      dz += (fz / d) * s.speed * (s.boost ?? 2) * (w.flee ?? 1);
      if (s.flee.time <= 0) s.flee = null;
    }
    // Wander: short runs in a random direction, and stops. Only with no goal and no fear.
    if (w.wander && !s.goal && !s.flee) {
      const wa = (s.wander ??= { t: 0, dx: 0, dz: 0, on: false });
      wa.t -= dt;
      if (wa.t <= 0) {
        wa.on = !wa.on && rng.chance(0.6);
        const [a, b] = wa.on ? s.run ?? [0.6, 1.6] : s.pause ?? [1, 3];
        wa.t = a + rng.next() * (b - a);
        const angle = rng.next() * Math.PI * 2;
        wa.dx = Math.sin(angle);
        wa.dz = Math.cos(angle);
      }
      if (wa.on) {
        dx += wa.dx * s.speed * w.wander;
        dz += wa.dz * s.speed * w.wander;
      }
    }
    // A thing that is not in a flock stays near its place (the flock system does this for flocks).
    if (e.range && !e.flock && !s.goal && !s.flee) {
      const rx = e.range.x - p.x;
      const rz = e.range.z - p.z;
      const d = Math.hypot(rx, rz);
      if (d > e.range.r) {
        dx += (rx / d) * s.speed;
        dz += (rz / d) * s.speed;
      }
    }
    // The pull of the flock.
    if (s.bias) {
      dx += s.bias.x;
      dz += s.bias.z;
    }
    // Separation: keep away from other movers and from the hero.
    if (w.separation) {
      const r = s.radius ?? 1.6;
      for (const o of [...movers, hero]) {
        if (!o || o === e || !o.position) continue;
        const ox = p.x - o.position.x;
        const oz = p.z - o.position.z;
        const d = Math.hypot(ox, oz);
        if (d >= r || d < 1e-6) continue;
        const k = ((r - d) / r) * s.speed * w.separation * 2;
        dx += (ox / d) * k;
        dz += (oz / d) * k;
      }
    }
    // Avoidance: look ahead, and turn to a free side before a wall or the edge of the water.
    const speedNow = Math.hypot(dx, dz);
    if (w.avoid && speedNow > 1e-3) {
      const look = 1.6;
      const ahead = { x: p.x + (dx / speedNow) * look, z: p.z + (dz / speedNow) * look };
      if (!env.canEnter(s.medium, p, ahead)) {
        const base = Math.atan2(dx, dz);
        for (const turn of [0.6, -0.6, 1.2, -1.2, 2, -2, Math.PI]) {
          const a = base + turn;
          const q = { x: p.x + Math.sin(a) * look, z: p.z + Math.cos(a) * look };
          if (!env.canEnter(s.medium, p, q)) continue;
          dx = Math.sin(a) * speedNow;
          dz = Math.cos(a) * speedNow;
          break;
        }
      }
    }
    // The limit of the speed, and a soft change of the velocity.
    const top = s.speed * (s.flee ? s.boost ?? 2 : 1);
    const len = Math.hypot(dx, dz);
    if (len > top) {
      dx = (dx / len) * top;
      dz = (dz / len) * top;
    }
    const k = Math.min(1, dt * (s.accel ?? 8));
    m.vx += (dx - m.vx) * k;
    m.vz += (dz - m.vz) * k;
    if (Math.hypot(m.vx, m.vz) < 0.05) {
      m.vx = 0;
      m.vz = 0;
    }
    // Move, and never enter a place of another medium: slide along it, or stop.
    const next = { x: p.x + m.vx * dt, z: p.z + m.vz * dt };
    let moved = true;
    if (env.canEnter(s.medium, p, next)) Object.assign(p, next);
    else if (env.canEnter(s.medium, p, { x: next.x, z: p.z })) {
      p.x = next.x;
      m.vz = 0;
    } else if (env.canEnter(s.medium, p, { x: p.x, z: next.z })) {
      p.z = next.z;
      m.vx = 0;
    } else {
      m.vx = 0;
      m.vz = 0;
      moved = false;
      if (s.wander) s.wander.t = 0;
    }
    m.speed = moved ? Math.hypot(m.vx, m.vz) : 0;
    if (m.speed > 0.1) p.facing = faceOf(m.vx, m.vz);
    // Walkers stand on the ground; swimmers float on the water (a fish under it); fliers keep
    // their height over the ground.
    const ground = env.groundY(p.x / 2, p.z / 2);
    if (s.medium === 'land') p.y = ground;
    else if (s.medium === 'water') p.y = ground + (s.float ?? 1.1);
    else p.y += (ground + (s.altitude ?? 12) - p.y) * Math.min(1, dt * 2);
  }
}
