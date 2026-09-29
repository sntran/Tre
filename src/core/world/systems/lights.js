// Lights: at night the lantern of a house lights when its family is in, and its door is dark.
// The lantern of the đình burns all night.
export const WRITES = ['look'];

import { query } from '../state.js';

export function lights(world) {
  const night = world.sky?.night ?? 0;
  const inside = new Set(query(world, 'schedule').filter((e) => e.hidden && e.schedule.home).map((e) => e.schedule.home));
  for (const e of query(world, 'lantern')) {
    const on = night > 0.4 && (e.lantern.always || inside.has(e.lantern.home));
    e.look = on ? 'lantern-lit' : 'lantern';
  }
}
