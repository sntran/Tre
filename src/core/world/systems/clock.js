// The day clock: play time passes, but not while the world waits (a dialogue or a panel), and
// not while the light holds for the work (clock.hold: a task or a folk game is open in a visit
// of a practice; src/core/session.js).
export const WRITES = ['clock'];

import { advance } from '../clock.js';

export function clock(world, dt) {
  if (!world.paused && !world.clock.hold) advance(world.clock, dt);
}
