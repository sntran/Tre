// One fixed step of the world. The systems run in this order, each one for a reason:
import { createRng } from '../rng.js';
import { input } from './systems/input.js';
import { route } from './systems/route.js';
import { move } from './systems/move.js';
import { follow } from './systems/follow.js';
import { react } from './systems/react.js';
import { sky } from './systems/sky.js';
import { schedule } from './systems/schedule.js';
import { lights } from './systems/lights.js';
import { push } from './systems/push.js';
import { flock } from './systems/flock.js';
import { steer } from './systems/steer.js';
import { clock } from './systems/clock.js';
import { ground } from './systems/ground.js';
import { place } from './systems/place.js';
import { work } from './systems/work.js';
import { raid } from './systems/raid.js';
import { joys } from './systems/joys.js';

export const STEP = 1 / 30; // seconds: 30 steps a second

export const SYSTEMS = [
  input, //  first: the commands of the player go into the entities before anything moves.
  sky, //    the light and the rain of this hour, so that the plans and the lanterns read them.
  ground, // the cells that open and close in play (a ford under a high river, a bridge deck), before anything moves.
  schedule, // the plan of the hour sets the goals of the people and the animals before anything moves.
  lights, // after the plans, so that a lantern lights in the step when its family goes in.
  route, //  a route turns into an intent (a direction), so that movement reads one kind of input.
  move, //   the hero and other walkers move with collision, from their intents.
  follow, // after the hero moves, so that Nghé follows the new position without a step of lag.
  place, //  after the hero and Nghé move: the hands pick up and put down, and a span answers where the hero stands now.
  work, //   after the hands: the tasks of the trials answer the work of the hands, and their timed parts go on.
  raid, //   after the hands and Nghé: the enemies answer the traps on the road and the hero where the hero stands now.
  push, //   after the hero moves: a cart moves out of the way of the hero on the back of Nghé.
  react, //  after the hero moves, so that things react to where the hero is now; before steering, so that a flight starts in this step.
  joys, //   after the plans and Nghé: the small joys show or hide, the fisher holds up a fish over his plan, and Nghé turns its head over its walk.
  flock, //  the pull of each flock goes into the steering before the animals move.
  steer, //  animals and people that move by themselves.
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
