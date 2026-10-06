// Routes: an entity with a route walks from point to point (a walk to a tapped place, a person,
// or a thing). At the end it sends the event "arrived" with the token of the route. A person in
// the way: the walker steps around. When it cannot move for some time, the route stops with
// "stuck".
export const WRITES = ['route', 'intent', 'events'];

import { query } from '../state.js';
import { inputToward } from '../move.js';

export const ROUTE = Object.freeze({ reach: 0.6, stuck: 0.6, runAfter: 10, clear: 2.5 }); // half blocks, seconds, points, half blocks
const SLIDE = 0.95; // half blocks: the margin of a box of a thing of a task for the walk around it (the walker's radius)

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
    // A point of the way where a person stands cannot be reached: go on to the point after it.
    while (r.points.length > 1 && underPerson(world, e, r.points[0])) r.points.shift();
    const next = r.points[0];
    const i = inputToward({ x: p.x / 2, y: p.z / 2 }, { x: next.x / 2, y: next.z / 2 }, { run: r.points.length > ROUTE.runAfter, stop: 0.05 });
    const way = slide(world, e, around(world, e, i.dx, i.dy, next), next);
    e.intent = { dx: way.dx, dz: way.dz, strength: i.strength, run: i.run };
  }
}

// Is a point under a person (in the round body of a solid thing), or in the box of a solid thing
// of a task (a trough, a heap)?
function underPerson(world, e, q) {
  return query(world, 'solid', 'position').some((s) => {
    if (s === e || s.hidden) return false;
    const b = s.solid.rect;
    if (b) return q.x > b.x0 - 0.8 && q.x < b.x1 + 0.8 && q.z > b.z0 - 0.8 && q.z < b.z1 + 0.8;
    return Math.hypot(s.position.x - q.x, s.position.z - q.z) < s.solid.r + 0.8;
  });
}

// A person stands in the way: the walker steps to the side of the person that is nearer to the
// next point, and so walks around, as a child walks around a grown-up. dx, dz: the direction to
// the next point.
function around(world, e, dx, dz, next) {
  let ax = dx;
  let az = dz;
  const p = e.position;
  for (const s of query(world, 'solid', 'position')) {
    // A box of a thing of a task does not walk: the route goes to its edge. A thing that stands
    // still (a pot, a cart) is in the path of the walk already: no step around it, which in a
    // narrow way pushes the walker into a wall (#53).
    if (s === e || s.hidden || s.solid.rect) continue;
    if (!s.person && !((s.motion?.speed ?? 0) > 0.05)) continue;
    const sx = s.position.x - p.x;
    const sz = s.position.z - p.z;
    const d = Math.hypot(sx, sz);
    const r = s.solid.r + ROUTE.clear;
    if (d > r || d < 1e-6) continue;
    // Only a person ahead, not one behind or far to the side.
    if ((sx * dx + sz * dz) / d < 0.3) continue;
    const tx = -sz / d;
    const tz = sx / d;
    const side = tx * (next.x - p.x) + tz * (next.z - p.z) >= 0 ? 1 : -1;
    const w = 2 * (1 - d / r) + 0.5;
    ax += tx * side * w;
    az += tz * side * w;
  }
  const n = Math.hypot(ax, az) || 1;
  return { dx: ax / n, dz: az / n };
}

// A box of a thing of a task (a trough, a heap) in the way: the walker goes along its side to the
// corner that is nearer to the next point, and so walks around it.
function slide(world, e, way, next) {
  const p = e.position;
  for (const s of query(world, 'solid', 'position')) {
    const b = s.solid.rect;
    if (!b || s === e || s.hidden) continue;
    const m = SLIDE;
    const x0 = b.x0 - m;
    const x1 = b.x1 + m;
    const z0 = b.z0 - m;
    const z1 = b.z1 + m;
    // The point one stride ahead: is it in the box (and the walker not)?
    const ax = p.x + way.dx * 0.5;
    const az = p.z + way.dz * 0.5;
    if (ax <= x0 || ax >= x1 || az <= z0 || az >= z1) continue;
    if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) continue;
    if (p.x <= x0 || p.x >= x1) {
      // The walker is at the west or east side: go along it to the north or south corner.
      const to = Math.abs(next.z - z0) + Math.abs(p.z - z0) < Math.abs(next.z - z1) + Math.abs(p.z - z1) ? z0 - 0.3 : z1 + 0.3;
      return { dx: 0, dz: Math.sign(to - p.z) || 1 };
    }
    const to = Math.abs(next.x - x0) + Math.abs(p.x - x0) < Math.abs(next.x - x1) + Math.abs(p.x - x1) ? x0 - 0.3 : x1 + 0.3;
    return { dx: Math.sign(to - p.x) || 1, dz: 0 };
  }
  return way;
}
