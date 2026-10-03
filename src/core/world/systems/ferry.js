// The ferries: one boat at a landing of a big river takes the hero and Nghé across, with no cut.
// The boat comes to the landing of the riders when it waits at the other one (call), the riders
// step onto it (board), the boat crosses the river with them (cross), and they step off at the
// other landing (land). A rider is `aboard` while it rides: its position is the deck of the boat.
// Units: half blocks and seconds.
export const WRITES = ['ferry', 'position', 'motion', 'aboard', 'route', 'events'];

import { query, getEntity } from '../state.js';

const SPEED = 4; // half blocks a second: two cells a second over the water
const STEP_TIME = 0.8; // seconds to step onto the boat or off it
const DECK = 0.7; // half blocks: the deck over the water
const SURFACE = 1.2; // half blocks: the surface of a river over its bed

// The spot of the boat on a side, and the place where the riders step off there.
const spotOf = (f, side) => (side === 'a' ? f.a : f.b);
const landOf = (f, side) => (side === 'a' ? f.landA : f.landB);

export function ferry(world, dt, rng, env) {
  for (const e of query(world, 'ferry', 'position')) {
    const f = e.ferry;
    if (f.state === 'wait') continue;
    const p = e.position;
    // The deck places of the riders: the hero in the middle, Nghé behind (along the way across).
    const axis = { x: f.b.x - f.a.x, z: f.b.z - f.a.z };
    const len = Math.hypot(axis.x, axis.z) || 1;
    const u = { x: axis.x / len, z: axis.z / len };
    const deck = (i) => ({ x: p.x - u.x * i * 1.6, y: p.y + DECK, z: p.z - u.z * i * 1.6 });
    const riders = f.riders.map((id) => getEntity(world, id)).filter(Boolean);
    const put = (r, q, facing) => {
      r.position.x = q.x;
      r.position.y = q.y;
      r.position.z = q.z;
      if (facing !== undefined) r.position.facing = facing;
      if (r.motion) {
        r.motion.vx = 0;
        r.motion.vz = 0;
        r.motion.speed = 0;
      }
      delete r.route;
    };
    const sail = (to) => {
      const dx = to.x - p.x;
      const dz = to.z - p.z;
      const d = Math.hypot(dx, dz);
      const k = Math.min(1, (SPEED * dt) / Math.max(d, 1e-6));
      p.x += dx * k;
      p.z += dz * k;
      p.y = (env.groundY?.(p.x / 2, p.z / 2) ?? 2) + SURFACE;
      if (d > 1e-3) p.facing = Math.atan2(dx, dz);
      return d <= SPEED * dt;
    };
    if (f.state === 'call') {
      // The boat comes over the water to the landing of the riders.
      if (sail(spotOf(f, f.call))) {
        f.side = f.call;
        f.state = 'board';
        f.t = 0;
        f.from = riders.map((r) => ({ x: r.position.x, y: r.position.y, z: r.position.z }));
      }
    } else if (f.state === 'board' || f.state === 'land') {
      f.t = Math.min(1, f.t + dt / STEP_TIME);
      riders.forEach((r, i) => {
        const a = f.from[i] ?? deck(i);
        // Off the boat: the hero at the landing, Nghé a little farther from the water.
        const off = landOf(f, f.side);
        const s = f.side === 'b' ? 1 : -1;
        const land = { x: off.x + u.x * i * 1.6 * s, z: off.z + u.z * i * 1.6 * s };
        const b = f.state === 'board' ? deck(i) : { ...land, y: env.groundY?.(land.x / 2, land.z / 2) ?? r.position.y };
        // A small hop: up and over the edge of the boat.
        const hop = Math.sin(f.t * Math.PI) * 0.6;
        r.aboard = e.id;
        put(r, { x: a.x + (b.x - a.x) * f.t, y: a.y + (b.y - a.y) * f.t + hop, z: a.z + (b.z - a.z) * f.t }, Math.atan2(b.x - a.x, b.z - a.z));
      });
      if (f.t >= 1 && f.state === 'board') {
        f.state = 'cross';
      } else if (f.t >= 1) {
        for (const r of riders) delete r.aboard;
        world.events.push({ type: 'ferried', id: e.id, riders: f.riders, side: f.side });
        f.state = 'wait';
        f.riders = [];
        f.from = [];
      }
    } else if (f.state === 'cross') {
      const to = f.side === 'a' ? 'b' : 'a';
      const there = sail(spotOf(f, to));
      riders.forEach((r, i) => {
        r.aboard = e.id;
        put(r, deck(i), p.facing);
      });
      if (there) {
        f.side = to;
        f.state = 'land';
        f.t = 0;
        f.from = riders.map((r) => ({ x: r.position.x, y: r.position.y, z: r.position.z }));
      }
    }
  }
}
