// Travel between regions on the country map. Pure functions, no DOM.
// A travel takes game hours on the roads, and has a few simple road events.
import { addHours } from '../core/world/clock.js';
import { setHeroPlace } from '../core/world/save.js';
import { lineKm } from './geo.js';

// The roads and rivers between places. routes: data/world/routes.json.
// places: [{ id, at: [longitude, latitude] }]. A way from one place to another goes on the routes
// with the least time. A day has `walkHours` hours of travel; the other hours are for rest.
export function createRoutes(routes, places) {
  const at = new Map(places.map((p) => [p.id, p.at]));
  const edges = new Map();
  const add = (a, b, leg) => {
    if (!edges.has(a)) edges.set(a, []);
    edges.get(a).push({ to: b, leg });
  };
  for (const r of routes.routes) {
    const line = [at.get(r.from), ...(r.via ?? []), at.get(r.to)];
    if (line.some((p) => !p)) continue;
    const km = lineKm(line);
    const hours = km / routes.speeds[r.mode];
    add(r.from, r.to, { mode: r.mode, km, hours, line });
    add(r.to, r.from, { mode: r.mode, km, hours, line: [...line].reverse() });
  }

  // The way with the least time: { hours (on the way, with no rest), km, legs }, or null.
  function way(from, to) {
    if (from === to) return { hours: 0, km: 0, legs: [] };
    const best = new Map([[from, { hours: 0, km: 0, legs: [] }]]);
    const open = [from];
    const done = new Set();
    while (open.length) {
      open.sort((a, b) => best.get(a).hours - best.get(b).hours);
      const p = open.shift();
      if (done.has(p)) continue;
      done.add(p);
      if (p === to) return best.get(p);
      for (const { to: q, leg } of edges.get(p) ?? []) {
        const cur = best.get(p);
        const hours = cur.hours + leg.hours;
        if (hours < (best.get(q)?.hours ?? Infinity)) {
          best.set(q, { hours, km: cur.km + leg.km, legs: [...cur.legs, leg] });
          open.push(q);
        }
      }
    }
    return null;
  }

  // The hours on the game clock: the hours on the way, and a rest for each full day of travel.
  const clockHours = (wayHours) => Math.ceil(wayHours + Math.floor(wayHours / routes.walkHours) * (24 - routes.walkHours));

  return { way, clockHours };
}

export const TRAVEL = Object.freeze({
  hoursPerEvent: 6, // about one road event for each 6 hours on the road
  maxEvents: 3,
});

// Plan a travel from one region to another. world: createWorld(). rng: createRng().
// Return { ok: false, reason } ('here', 'locked', or 'noroad'), or { ok: true, to, hours, events, entry }.
export function planTravel(world, from, to, state, rng, events, cfg = TRAVEL) {
  if (from === to) return { ok: false, reason: 'here' };
  if (!world.isOpen(to, state)) return { ok: false, reason: 'locked' };
  const road = world.travelHours(from, to);
  if (!Number.isFinite(road)) return { ok: false, reason: 'noroad' };
  const count = Math.min(cfg.maxEvents, Math.floor(road / cfg.hoursPerEvent) + (rng.next() < (road % cfg.hoursPerEvent) / cfg.hoursPerEvent ? 1 : 0));
  const picked = [];
  for (let i = 0; i < count && events.length; i++) {
    const left = events.filter((e) => !picked.includes(e));
    if (!left.length) break;
    picked.push(rng.weighted(left, (e) => e.weight ?? 1));
  }
  const hours = Math.max(1, road + picked.reduce((sum, e) => sum + (e.hours ?? 0), 0));
  return { ok: true, to, hours, events: picked, entry: world.entryOf(to), legs: world.travelWay?.(from, to)?.legs ?? [] };
}

// Apply a planned travel to the profile: the clock, the items of the events, and the new place.
export function applyTravel(profile, plan) {
  addHours(profile.world.clock, plan.hours);
  for (const e of plan.events) {
    for (const [item, n] of Object.entries(e.give ?? {})) profile.inventory[item] = (profile.inventory[item] ?? 0) + n;
  }
  setHeroPlace(profile.world, plan.entry.map, plan.entry.x, plan.entry.y);
  return profile;
}
