// Reactions: people and enemies turn to the hero when the hero comes near.
export const WRITES = ['position'];

import { query, getEntity } from '../state.js';
import { faceOf } from '../move.js';

const TURN = 5; // radians a second

export function react(world, dt) {
  const hero = getEntity(world, 'hero');
  if (!hero?.position) return;
  for (const e of query(world, 'react', 'position')) {
    const p = e.position;
    const dx = hero.position.x - p.x;
    const dz = hero.position.z - p.z;
    if (Math.hypot(dx, dz) > e.react.turn) continue;
    p.facing = turnToward(p.facing ?? 0, faceOf(dx, dz), dt * TURN);
  }
}

// Turn an angle toward another angle by at most `step` (radians), the short way.
export function turnToward(from, to, step) {
  let d = ((((to - from + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  if (Math.abs(d) > step) d = Math.sign(d) * step;
  return from + d;
}
