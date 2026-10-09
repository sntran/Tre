// Following: Nghé walks behind the hero on the trail that the hero walked, with a soft lag, and
// jumps behind the hero when it is too far away (for example after a ferry). Nghé steps back from
// a fire (hot), carries the hero when the hero rides, is happy for a while after a pet, and lies
// down beside the hero when the hero rests at night. With a goal (follow.goal, from the place
// system), Nghé walks to that point, looks to `face`, and takes the pose `act` there: at the near
// end of the planks it stretches its neck toward the gap (a hint), beside the plank outlines it
// looks at the hero, and at the edge of the water it pulls the hero out. At a closed ford Nghé stops at the
// edge and shakes its head. Nghé never stands on a place of a task, and it steps aside when the hero
// walks toward it (#47). After a skip of the prediction, Nghé glances once at the outlines. Nghé
// does not go into the sea, nor into the mist of the land of a later era: it stops at the edge, and
// at the mist it lows.
export const WRITES = ['position', 'motion', 'follow', 'act', 'events'];

import { query, getEntity } from '../state.js';
import { stepFollower, moveCircle, faceOf, MOVE } from '../move.js';

const SHAKE = 1.6; // seconds of a shake of the head
const NEAR_HERO = 0.6; // half blocks: Nghé on the hero (nearer than this) steps past or away
const PERSON_CLEAR = 1; // half blocks: Nghé stays this far out of the body of a person

export function follow(world, dt, rng, env) {
  const hot = query(world, 'hot', 'position');
  for (const e of query(world, 'follow', 'position', 'motion')) {
    const leader = getEntity(world, e.follow.target);
    if (!leader?.position) continue;
    const p = e.position;
    const m = e.motion;
    const from = { x: p.x, z: p.z };
    e.follow.happy = Math.max(0, (e.follow.happy ?? 0) - dt);
    // Ridden: Nghé is under the hero.
    if (leader.riding === e.id) {
      Object.assign(p, { x: leader.position.x, y: leader.position.y, z: leader.position.z, facing: leader.position.facing });
      m.vx = leader.motion.vx;
      m.vz = leader.motion.vz;
      m.speed = leader.motion.speed;
      m.shallow = leader.motion.shallow;
      e.follow.trail = [];
      delete e.act;
      continue;
    }
    if (e.follow.goal) {
      const g = e.follow.goal;
      goTo(e, g, dt, env);
      // A short trail from Nghé to the hero, so that Nghé walks back after the goal (and does not jump).
      e.follow.trail = [[p.x, p.z], [leader.position.x, leader.position.z]];
      if (g.act && Math.hypot(g.x - p.x, g.z - p.z) < 0.5) e.act = g.act;
      else delete e.act;
      continue;
    }
    const f = {
      x: p.x / 2, y: p.z / 2, vx: m.vx / 2, vy: m.vz / 2, facing: p.facing, speed: 0, moving: false,
      idle: e.follow.idle ?? 0, trail: e.follow.trail.map(([x, z]) => ({ x: x / 2, y: z / 2 })),
    };
    stepFollower(f, { x: leader.position.x / 2, y: leader.position.z / 2, facing: leader.position.facing }, dt, (env.nearFriend ?? env.near)(f.x, f.y));
    p.x = f.x * 2;
    p.z = f.y * 2;
    p.facing = f.facing;
    p.y = env.groundY(f.x, f.y);
    m.vx = f.vx * 2;
    m.vz = f.vy * 2;
    m.speed = f.speed * 2;
    m.shallow = Boolean(f.shallow);
    e.follow.idle = f.idle;
    e.follow.trail = f.trail.map((t) => [t.x * 2, t.y * 2]);
    // A fire: Nghé steps back from it.
    for (const h of hot) {
      const hx = p.x - h.position.x;
      const hz = p.z - h.position.z;
      const d = Math.hypot(hx, hz);
      if (d >= h.hot.r || d < 1e-6) continue;
      const away = Math.min(h.hot.r - d, dt * 6);
      const to = { x: p.x + (hx / d) * away, z: p.z + (hz / d) * away };
      if (env.canEnter('land', p, to)) {
        p.x = to.x;
        p.z = to.z;
        p.facing = Math.atan2(hx, hz);
        m.speed = Math.max(m.speed, 6);
      }
    }
    // The places of a task that goes on: Nghé steps out of their rects, so that it never stands on a
    // place of the work (#47). The hero walks toward Nghé: Nghé steps aside.
    for (const z of query(world, 'zone')) {
      const r = z.zone.rect;
      if (!r || !z.zone.task?.startsWith('trial-') || getEntity(world, `zone:${z.zone.task}`)?.zone.done) continue;
      if (p.x < r.x0 || p.x > r.x1 || p.z < r.z0 || p.z > r.z1) continue;
      // The nearest edge, one half block out.
      const outs = [{ x: r.x0 - 1, z: p.z }, { x: r.x1 + 1, z: p.z }, { x: p.x, z: r.z0 - 1 }, { x: p.x, z: r.z1 + 1 }]
        .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
      const out = outs.find((o) => env.canEnter('land', p, o));
      if (!out) continue;
      const d = Math.hypot(out.x - p.x, out.z - p.z);
      const step = Math.min(d, dt * 8);
      p.x += ((out.x - p.x) / d) * step;
      p.z += ((out.z - p.z) / d) * step;
      p.facing = Math.atan2(out.x - p.x, out.z - p.z);
      m.speed = Math.max(m.speed, 6);
    }
    const lv = leader.motion;
    if (lv && (lv.speed ?? 0) > 0.5) {
      const dx = p.x - leader.position.x;
      const dz = p.z - leader.position.z;
      const d = Math.hypot(dx, dz);
      const v = Math.hypot(lv.vx, lv.vz) || 1;
      if (d < 3 && d > 1e-6 && (dx * lv.vx + dz * lv.vz) / (d * v) > 0.7) {
        // To the side that is nearer (the left or the right of the walk of the hero).
        const side = Math.sign(dx * lv.vz - dz * lv.vx) || 1;
        const to = { x: p.x + side * (lv.vz / v) * dt * 6, z: p.z - side * (lv.vx / v) * dt * 6 };
        if (env.canEnter('land', p, to)) {
          p.x = to.x;
          p.z = to.z;
          m.speed = Math.max(m.speed, 6);
        }
      }
    }
    // Never on the hero: Nghé on the hero (after a step out of a place or aside) steps past or
    // away, so that the walk of the hero is never stuck in Nghé.
    const ox = p.x - leader.position.x;
    const oz = p.z - leader.position.z;
    const od = Math.hypot(ox, oz);
    if (od < NEAR_HERO) {
      // Past the hero in the way of the walk of Nghé, or away from the hero, or to the side of the
      // hero, so that Nghé never stays in the hero.
      const mx = p.x - from.x;
      const mz = p.z - from.z;
      const mv = Math.hypot(mx, mz);
      const f = leader.position.facing ?? 0;
      const [ux, uz] = mv > 1e-3 ? [mx / mv, mz / mv] : od > 1e-6 ? [ox / od, oz / od] : [Math.cos(f), -Math.sin(f)];
      const to = { x: leader.position.x + ux * NEAR_HERO * 2, z: leader.position.z + uz * NEAR_HERO * 2 };
      if (env.canEnter('land', p, to)) {
        p.x = to.x;
        p.z = to.z;
      }
    }
    // Never in a person: Nghé in the body of a person (behind the hero at the anvil, in the place of
    // the smith) steps out to the side of the person where it is (#72: the calf stood inside the
    // smith).
    for (const q of query(world, 'person', 'position')) {
      if (q.hidden) continue;
      const clear = (q.solid?.r ?? 1.8) + PERSON_CLEAR;
      const qx = p.x - q.position.x;
      const qz = p.z - q.position.z;
      const qd = Math.hypot(qx, qz);
      if (qd >= clear) continue;
      // Out on the side of Nghé, or (in the middle) on the side away from the hero.
      const hx = q.position.x - leader.position.x;
      const hz = q.position.z - leader.position.z;
      const hd = Math.hypot(hx, hz);
      const [ux, uz] = qd > 1e-3 ? [qx / qd, qz / qd] : hd > 1e-3 ? [hx / hd, hz / hd] : [1, 0];
      const sides = [[ux, uz], [-uz, ux], [uz, -ux], [-ux, -uz]];
      for (const [sx, sz] of sides) {
        const to = { x: q.position.x + sx * clear, z: q.position.z + sz * clear };
        if (!env.canEnter('land', p, to)) continue;
        p.x = to.x;
        p.z = to.z;
        break;
      }
    }
    p.y = env.groundY(p.x / 2, p.z / 2);
    // The hero rests at night (stands still): Nghé lies down beside the hero.
    const near = Math.hypot(leader.position.x - p.x, leader.position.z - p.z) < 7;
    const rest = (world.sky?.night ?? 0) > 0.5 && (leader.motion?.idle ?? 0) > 2 && near && m.speed < 0.2;
    // A closed ford: when the hero stands at its edge, Nghé shakes its head, once for each visit.
    const atFord = world.sky?.high && fordNear(env, leader.position, 3) && fordNear(env, p, 8);
    if (atFord && !e.follow.shook) {
      e.follow.shook = true;
      e.follow.shake = SHAKE;
      world.events.push({ type: 'shake', id: e.id });
    }
    if (!atFord) delete e.follow.shook;
    // The mist of the land of a later era: Nghé stops at its edge and lows, once for each time that
    // the hero walks in.
    const misty = (env.mistAt?.(leader.position.x / 2, leader.position.z / 2) ?? 0) > 0;
    if (misty && !e.follow.lowed) {
      e.follow.lowed = true;
      world.events.push({ type: 'low', id: e.id, sound: 'moo' });
    }
    if (!misty) delete e.follow.lowed;
    e.follow.shake = Math.max(0, (e.follow.shake ?? 0) - dt);
    if (!e.follow.shake) delete e.follow.shake;
    // A glance: Nghé turns its head to a point for a moment (the plank outlines after a skip).
    if (e.follow.glance) {
      p.facing = faceOf(e.follow.glance.x - p.x, e.follow.glance.z - p.z);
      e.follow.glance.t -= dt;
      if (e.follow.glance.t <= 0) delete e.follow.glance;
    }
    if (rest) e.act = 'rest';
    else if (e.follow.shake) e.act = 'shake';
    else if (e.follow.happy > 0) e.act = 'happy';
    else delete e.act;
  }
}

// Is a cell of a ford within r half blocks of a point?
function fordNear(env, p, r) {
  return (env.fords ?? []).some((c) => Math.hypot(c.x * 2 + 1 - p.x, c.y * 2 + 1 - p.z) < r + 1);
}

// Walk straight to a goal (half blocks) and look to goal.face at the end. goal.fast: run.
function goTo(e, goal, dt, env) {
  const p = e.position;
  const m = e.motion;
  const dx = goal.x - p.x;
  const dz = goal.z - p.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.3) {
    Object.assign(m, { vx: 0, vz: 0, speed: 0 });
    if (goal.face !== undefined) p.facing = goal.face;
    return;
  }
  // A charge in a raid is a run (Nghé runs; the enemies never do).
  const speed = Math.min(MOVE.walk * 2 * (goal.fast ? 3 : 1.1), 1.5 + d * 3);
  const stepLen = Math.min(d, speed * dt);
  const body = { x: p.x / 2, y: p.z / 2 };
  const next = moveCircle(body, (dx / d) * stepLen / 2, (dz / d) * stepLen / 2, MOVE.radius, env.near(body.x, body.y).isBlocked);
  const moved = Math.hypot(next.x - body.x, next.y - body.y) * 2;
  if (moved > 1e-4) p.facing = faceOf(next.x - body.x, next.y - body.y);
  p.x = next.x * 2;
  p.z = next.y * 2;
  p.y = env.groundY(next.x, next.y);
  m.vx = ((dx / d) * moved) / dt;
  m.vz = ((dz / d) * moved) / dt;
  m.speed = moved / dt;
}
