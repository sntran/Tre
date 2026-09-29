// Travel between regions on the country map. Pure functions, no DOM.
// A travel takes game hours on the roads, and has a few simple road events.
import { addHours } from './clock.js';

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
  return { ok: true, to, hours, events: picked, entry: world.region(to).entry };
}

// Apply a planned travel to the profile: the clock, the items of the events, and the new place.
export function applyTravel(profile, plan) {
  addHours(profile.clock, plan.hours);
  for (const e of plan.events) {
    for (const [item, n] of Object.entries(e.give ?? {})) profile.inventory[item] = (profile.inventory[item] ?? 0) + n;
  }
  profile.place = { map: plan.entry.map, x: plan.entry.x, y: plan.entry.y };
  return profile;
}
