// One fixed step of the world. The systems run in this order, each one for a reason:
import { createRng } from '../rng.js';
import { input } from './systems/input.js';
import { route } from './systems/route.js';
import { move } from './systems/move.js';
import { follow } from './systems/follow.js';
import { react } from './systems/react.js';
import { flock } from './systems/flock.js';
import { steer } from './systems/steer.js';
import { clock } from './systems/clock.js';

export const STEP = 1 / 30; // seconds: 30 steps a second

export const SYSTEMS = [
  input, //  first: the commands of the player go into the entities before anything moves.
  route, //  a route turns into an intent (a direction), so that movement reads one kind of input.
  move, //   the hero and other walkers move with collision, from their intents.
  follow, // after the hero moves, so that Nghé follows the new position without a step of lag.
  flock, //  the pull of each flock goes into the steering before the animals move.
  steer, //  animals and people that move by themselves, after the hero, so that they react to where the hero is now.
  react, //  after all movement, so that people turn to where the hero is now.
  clock, //  last: the time of this step passes after all that happened in it.
];

// Run one step. env: the facts of the map (see env.js). The events of the step are in
// world.events until the next step.
export function step(world, dt, env) {
  world.events = [];
  const rng = createRng(1);
  rng.state = world.rng;
  for (const system of SYSTEMS) system(world, dt, rng, env);
  world.rng = rng.state;
  world.tick += 1;
}
