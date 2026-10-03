// The ground that changes in play: the collision of some cells follows the state. A span (the
// bridge) opens its old deck, the lane where the planks lie, and all of it when it is solid.
// A high river (in the rain and for a while after it) closes the ford; the ford stays open while
// somebody is in it, so that nobody is caught in the water. This system writes only the
// collision of env (env.block), never the world state.
export const WRITES = [];

import { query } from '../state.js';
import { spanCells, sizesOf, sum } from '../zones.js';

export function ground(world, dt, rng, env) {
  if (!env.block) return;
  for (const z of query(world, 'zone')) {
    const zone = z.zone;
    if (zone.rule !== 'span') continue;
    // The plank that tips or wobbles does not hold anybody.
    const ids = zone.effect ? zone.items.filter((id) => id !== zone.effect.id) : zone.items;
    for (const c of spanCells(zone, sum(sizesOf(world, ids)))) env.block(c.x, c.y, c.blocked);
  }
  if (!env.fords?.length) return;
  const high = Boolean(world.sky?.high);
  const bodies = query(world, 'position').filter((e) => e.control || e.follow);
  // Somebody in the water of the ford, or on a stepping stone in it.
  const cells = new Set(env.fords.map((c) => `${c.x},${c.y}`));
  const inFord = bodies.some((b) => env.groundAt(b.position.x, b.position.z) === 'shallow' || cells.has(`${Math.floor(b.position.x / 2)},${Math.floor(b.position.z / 2)}`));
  const close = high && !inFord;
  for (const c of env.fords) env.block(c.x, c.y, close ? true : null);
}
