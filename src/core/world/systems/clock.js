// The day clock: play time passes, but not while the world waits (a dialogue or a panel).
export const WRITES = ['clock'];

import { advance } from '../clock.js';

export function clock(world, dt) {
  if (!world.paused) advance(world.clock, dt);
}
