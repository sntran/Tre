// Swimming: a duck swims slowly in a small circle around its point on the water.
export const WRITES = ['swim', 'position', 'motion'];

import { query } from '../state.js';
import { faceOf } from '../move.js';

export function swim(world, dt) {
  for (const e of query(world, 'swim', 'position')) {
    const s = e.swim;
    s.a += dt * s.speed * s.dir;
    e.position.x = s.cx + Math.cos(s.a) * s.r;
    e.position.z = s.cz + Math.sin(s.a) * s.r;
    e.position.facing = faceOf(-Math.sin(s.a) * s.dir, Math.cos(s.a) * s.dir);
    if (e.motion) e.motion.speed = s.speed * s.r;
  }
}
