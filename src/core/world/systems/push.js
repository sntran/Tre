// Pushing: on the back of Nghé the hero is strong enough to push a cart. The cart moves in the
// direction of the hero, on land only; without Nghé the cart is a solid thing that the hero walks
// around. A cart that the hero moved is a change of the player, so the save keeps it.
export const WRITES = ['position', 'keep'];

import { query, getEntity } from '../state.js';

export function push(world, dt, rng, env) {
  const hero = getEntity(world, 'hero');
  if (!hero?.riding) return;
  const h = hero.position;
  for (const e of query(world, 'pushable', 'position')) {
    const p = e.position;
    const dx = p.x - h.x;
    const dz = p.z - h.z;
    const d = Math.hypot(dx, dz);
    const reach = e.pushable.r + 1.2;
    if (d >= reach || d < 1e-6) continue;
    const out = reach - d;
    const to = { x: p.x + (dx / d) * out, z: p.z + (dz / d) * out };
    if (!env.canEnter('land', p, to)) continue;
    p.x = to.x;
    p.z = to.z;
    p.facing = Math.atan2(dx, dz);
    p.y = env.groundY(p.x / 2, p.z / 2);
    e.keep = true;
  }
}
