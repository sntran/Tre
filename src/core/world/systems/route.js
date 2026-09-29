// Routes: an entity with a route walks from point to point (a walk to a tapped place, a person,
// or a thing). At the end it sends the event "arrived" with the token of the route. When it
// cannot move for some time (for example behind a person), the route stops with "stuck".
export const WRITES = ['route', 'intent', 'events'];

import { query } from '../state.js';
import { inputToward } from '../move.js';

export const ROUTE = Object.freeze({ reach: 0.6, stuck: 0.6, runAfter: 10 }); // half blocks, seconds, points

export function route(world, dt) {
  for (const e of query(world, 'route', 'position')) {
    const r = e.route;
    const p = e.position;
    // Stuck: the entity did not move in the last steps.
    if (r.last && Math.hypot(p.x - r.last.x, p.z - r.last.z) < 2e-3) r.still += dt;
    else r.still = 0;
    r.last = { x: p.x, z: p.z };
    const end = (type) => {
      world.events.push({ type, id: e.id, token: r.token });
      delete e.route;
      delete e.intent;
    };
    if (r.still > ROUTE.stuck) {
      end('stuck');
      continue;
    }
    if (r.near && Math.hypot(r.near.x - p.x, r.near.z - p.z) <= r.near.d) {
      end('arrived');
      continue;
    }
    while (r.points.length && Math.hypot(r.points[0].x - p.x, r.points[0].z - p.z) < ROUTE.reach) r.points.shift();
    if (!r.points.length) {
      end('arrived');
      continue;
    }
    const next = r.points[0];
    const i = inputToward({ x: p.x / 2, y: p.z / 2 }, { x: next.x / 2, y: next.z / 2 }, { run: r.points.length > ROUTE.runAfter, stop: 0.05 });
    e.intent = { dx: i.dx, dz: i.dy, strength: i.strength, run: i.run };
  }
}
