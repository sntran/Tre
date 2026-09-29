// Flocks: animals with the same flock id keep together. Alignment turns each one to the way that
// its neighbors go, and cohesion pulls it to their middle. A flock that the hero scatters comes
// back together after its fear ends. The range keeps a flock near its place (a yard, a pond).
// The pull goes into steer.bias; the steering system moves the animal.
export const WRITES = ['steer'];

import { query } from '../state.js';

// flock: { id, align, cohere, radius }. range: { x, z, r } (half blocks).
export function flock(world) {
  const members = query(world, 'flock', 'steer', 'position', 'motion').filter((e) => !e.hidden);
  const groups = new Map();
  for (const e of members) {
    if (!groups.has(e.flock.id)) groups.set(e.flock.id, []);
    groups.get(e.flock.id).push(e);
  }
  for (const list of groups.values()) {
    // Cohesion pulls to the middle of the whole flock (a flock is small), so that two parts of a
    // scattered flock find each other again. Alignment follows the near neighbors only.
    let mx = 0;
    let mz = 0;
    for (const o of list) {
      mx += o.position.x;
      mz += o.position.z;
    }
    mx /= list.length;
    mz /= list.length;
    for (const e of list) {
      const f = e.flock;
      const p = e.position;
      const s = e.steer;
      let n = 0;
      let vx = 0;
      let vz = 0;
      for (const o of list) {
        if (o === e || Math.hypot(o.position.x - p.x, o.position.z - p.z) > f.radius) continue;
        n += 1;
        vx += o.motion.vx;
        vz += o.motion.vz;
      }
      // Fear and a goal (the way to the coop) are stronger than the flock: the pull is small.
      const k = s.flee || s.goal ? 0.15 : 1;
      let bx = n ? (vx / n) * f.align * k : 0;
      let bz = n ? (vz / n) * f.align * k : 0;
      const cx = mx - p.x;
      const cz = mz - p.z;
      const d = Math.hypot(cx, cz);
      if (list.length > 1 && d > 1e-6) {
        const pull = Math.min(1, d / f.radius) * s.speed * f.cohere * k;
        bx += (cx / d) * pull;
        bz += (cz / d) * pull;
      }
      // The range: back to the yard or the pond.
      if (e.range && !s.flee && !s.goal) {
        const rx = e.range.x - p.x;
        const rz = e.range.z - p.z;
        const d = Math.hypot(rx, rz);
        if (d > e.range.r) {
          bx += (rx / d) * s.speed;
          bz += (rz / d) * s.speed;
        }
      }
      s.bias = { x: bx, z: bz };
    }
  }
}
