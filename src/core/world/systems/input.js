// Input: the commands of the last frames go into the components of the entities.
// Commands: move (a map direction from the stick or the keys), walk (a route of points), stop,
// place (put an entity at a point), face (turn to a point), pause (a dialogue opens or closes).
export const WRITES = ['commands', 'paused', 'intent', 'route', 'position', 'motion', 'follow', 'events'];

import { getEntity, query } from '../state.js';
import { faceOf } from '../move.js';

export function input(world, dt, rng, env) {
  for (const c of world.commands) {
    if (c.type === 'pause') {
      world.paused = Boolean(c.on);
      continue;
    }
    const e = getEntity(world, c.id);
    if (!e) continue;
    if (c.type === 'move') {
      e.intent = { dx: c.dx ?? 0, dz: c.dz ?? 0, strength: c.strength ?? 1, run: Boolean(c.run) };
      delete e.route;
    } else if (c.type === 'walk') {
      e.route = { points: c.points.map((p) => ({ x: p.x, z: p.z })), near: c.near ?? null, token: c.token ?? null, still: 0, last: null };
      delete e.intent;
    } else if (c.type === 'stop') {
      delete e.intent;
      delete e.route;
    } else if (c.type === 'place' && e.position) {
      e.position.x = c.x;
      e.position.z = c.z;
      e.position.y = env.groundY(c.x / 2, c.z / 2);
      if (e.motion) Object.assign(e.motion, { vx: 0, vz: 0, speed: 0 });
      delete e.intent;
      delete e.route;
      // The followers of the entity start again behind it.
      for (const f of query(world, 'follow', 'position')) {
        if (f.follow.target !== e.id) continue;
        f.follow.trail = [];
        f.position.x = c.x - 3.2 * Math.sin(e.position.facing ?? 0);
        f.position.z = c.z - 3.2 * Math.cos(e.position.facing ?? 0);
        if (env.near(f.position.x / 2, f.position.z / 2).isBlocked(Math.floor(f.position.x / 2), Math.floor(f.position.z / 2))) {
          f.position.x = c.x;
          f.position.z = c.z;
        }
        f.position.y = env.groundY(f.position.x / 2, f.position.z / 2);
      }
      world.events.push({ type: 'placed', id: e.id });
    } else if (c.type === 'face' && e.position) {
      const dx = c.x - e.position.x;
      const dz = c.z - e.position.z;
      if (Math.hypot(dx, dz) > 0.05) e.position.facing = faceOf(dx, dz);
    }
  }
  world.commands = [];
}
