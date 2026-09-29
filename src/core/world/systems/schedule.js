// Schedules: the day of each person and animal, from the plans in data/world/people.json and
// data/world/life.json and the clock. The system sets the goal of the steering. At home time a
// person walks to the foot of the ladder, climbs, and goes in (hidden); in the morning the person
// comes out and climbs down. A person with no house, or a person who is part of the quest at night
// (schedule.stay), stays out with a lantern. Chickens go to their coop and sit, ducks sit on the
// bank, the owl comes at night, and the birds fly at dusk.
export const WRITES = ['schedule', 'steer', 'position', 'hidden', 'act', 'carry', 'events'];

import { query } from '../state.js';
import { DAY_MINUTES } from '../clock.js';

export const CLIMB_SECONDS = 2.5;

// The step of a plan at an hour: the last step that started before the hour (the plan wraps
// around midnight).
export function stepAt(plan, hour) {
  let out = plan[plan.length - 1];
  for (const s of plan) if (s.from <= hour) out = s;
  return out;
}

export function schedule(world, dt, rng, env) {
  const hour = (world.clock.minutes % DAY_MINUTES) / 60;
  const night = world.sky?.night ?? 0;
  for (const e of query(world, 'schedule', 'position')) {
    const sc = e.schedule;
    const plan = stepAt(sc.plan, hour);
    let at = plan.at;
    const home = sc.home ? env.homes[sc.home] : null;
    if (at === 'home' && (!home || sc.stay)) at = 'spot';
    e.carry = at === 'spot' && sc.home !== undefined && night > 0.3 ? 'lantern' : undefined;
    if (e.carry === undefined) delete e.carry;
    e.act = plan.act && e.steer?.arrived ? plan.act : undefined;
    if (e.act === undefined) delete e.act;
    // In and out of the house.
    if (at === 'home') {
      if (e.hidden) continue;
      if (sc.climb > 0) {
        climb(e, home, dt, 1);
        if (sc.climb >= 1) {
          e.hidden = true;
          sc.climb = 0;
          world.events.push({ type: 'home', id: e.id, home: sc.home });
        }
        continue;
      }
      goTo(e, { x: home.base.x, z: home.base.z }, env);
      if (Math.hypot(home.base.x - e.position.x, home.base.z - e.position.z) < 0.8) {
        sc.climb = 0.001;
        e.climb = true;
      }
      continue;
    }
    if (sc.home && (e.hidden || sc.down > 0)) {
      // Morning: out of the door and down the ladder.
      if (e.hidden) {
        delete e.hidden;
        sc.down = 1;
        e.climb = true;
        world.events.push({ type: 'out', id: e.id, home: sc.home });
      }
      climb(e, home, dt, -1);
      continue;
    }
    if (at === 'gone') {
      e.hidden = true;
      continue;
    }
    if (e.hidden) {
      delete e.hidden;
      if (sc.spot) Object.assign(e.position, { x: sc.spot.x, z: sc.spot.z });
    }
    if (!e.steer) {
      // A thing that does not walk (the owl) sits at its spot.
      if (sc.spot) Object.assign(e.position, { x: sc.spot.x, y: sc.spot.y ?? e.position.y, z: sc.spot.z });
      continue;
    }
    let target = null;
    if (at !== 'bed') delete sc.bank;
    if (at === 'spot') target = sc.spot;
    else if (at === 'bed' && e.steer.medium === 'water') target = (sc.bank ??= env.bankNear(e.position.x, e.position.z));
    else if (at === 'bed') target = sc.bed;
    else if (at !== 'range' && env.places[at]) target = { x: env.places[at].x + (sc.offset?.x ?? 0), z: env.places[at].z + (sc.offset?.z ?? 0) };
    goTo(e, target, env);
  }
}

// Walk to a target on a way around houses and water (a path of cells); the steering goes from
// point to point and slows down only at the end.
function goTo(e, target, env) {
  const sc = e.schedule;
  const s = e.steer;
  if (!target) {
    s.goal = null;
    s.pass = false;
    delete sc.way;
    return;
  }
  const key = `${Math.round(target.x * 10)},${Math.round(target.z * 10)}`;
  if (sc.wayTo !== key) {
    sc.wayTo = key;
    const far = Math.hypot(target.x - e.position.x, target.z - e.position.z) > 4;
    const way = far && s.medium === 'land' ? env.path(e.position, target) : null;
    sc.way = way ? [...way.slice(0, -1), { x: target.x, z: target.z }] : [{ x: target.x, z: target.z }];
  }
  while (sc.way.length > 1 && Math.hypot(sc.way[0].x - e.position.x, sc.way[0].z - e.position.z) < 1.2) sc.way.shift();
  s.goal = { ...sc.way[0] };
  s.pass = sc.way.length > 1;
}

// Up the ladder (dir 1) or down (dir -1): from the foot to the top, and in at the door.
function climb(e, home, dt, dir) {
  const sc = e.schedule;
  const key = dir > 0 ? 'climb' : 'down';
  sc[key] = dir > 0 ? Math.min(1, sc[key] + dt / CLIMB_SECONDS) : Math.max(0, sc[key] - dt / CLIMB_SECONDS);
  const k = sc[key];
  const a = home.base;
  const b = home.top;
  e.position.x = a.x + (b.x - a.x) * k;
  e.position.y = a.y + (b.y - a.y) * k;
  e.position.z = a.z + (b.z - a.z) * k;
  e.position.facing = dir > 0 ? Math.PI : 0;
  if (e.motion) e.motion.speed = 3;
  if (dir < 0 && k <= 0) {
    delete sc.down;
    delete e.climb;
  }
  if (dir > 0 && k >= 1) delete e.climb;
}
