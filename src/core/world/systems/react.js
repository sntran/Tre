// Reactions: what a thing does when the hero comes near. The `react` component says which
// reaction and its numbers (from data/world/life.json):
//   flee: chickens run from a hero who runs at them; ducks and fish swim away from the hero.
//   greet: people turn to the hero, wave, and greet, then wait some time before the next greeting.
//   follow: the dog follows the hero for a while, and then goes home.
//   break: a pot breaks when the hero walks into it. It gives nothing (Era 1 has no coins, #26):
//     a few grains spill, and the chickens near it come to peck them. The next morning the mender
//     (grandma) sets a new pot. A broken pot is a change of the player, so the save keeps it.
//   bend: tall grass bends away from the hero and rustles.
//   hop: a frog on a lily pad jumps into the water when the hero comes near, and comes back after
//     a while (the small joys, docs/WORLD.md).
//   splash: a puddle after the rain splashes when the hero walks into it.
//   follow with when: walk: the ducklings follow a hero who walks past, not one who runs.
// The sounds and the story (a greeting, a broken pot) go out as events.
export const WRITES = ['react', 'steer', 'position', 'look', 'broken', 'keep', 'solid', 'hidden', 'peck', 'events'];

import { query, getEntity } from '../state.js';
import { faceOf } from '../move.js';
import { DAY_MINUTES } from '../clock.js';

export const RUN_SPEED = 11; // half blocks a second: faster than this, the hero runs
export const HOP_SECONDS = 0.6; // the jump of a frog into the water
export const SPILL = { radius: 24, seconds: 6 }; // the chickens that come to the grains of a broken pot
const TURN = 5; // radians a second

export function react(world, dt) {
  const hero = getEntity(world, 'hero');
  if (!hero?.position) return;
  const h = hero.position;
  const running = (hero.motion?.speed ?? 0) > RUN_SPEED;
  const today = Math.floor(world.clock.minutes / DAY_MINUTES);
  const menders = query(world, 'schedule').some((m) => m.schedule.mends);
  const walking = !running && (hero.motion?.speed ?? 0) > 0.5;
  // The chickens at the grains of a broken pot go back to their flock after a while.
  for (const c of query(world, 'peck')) {
    c.peck -= dt;
    if (c.peck <= 0) {
      delete c.peck;
      if (c.steer) c.steer.goal = null;
    }
  }
  for (const e of query(world, 'react', 'position')) {
    const r = e.react;
    // A frog under the water comes back to its lily pad after a while.
    if (r.kind === 'hop' && r.away > 0 && r.left !== undefined) {
      r.left -= dt;
      if (r.left <= 0) {
        delete r.left;
        delete e.hidden;
        Object.assign(e.position, r.home);
      }
      continue;
    }
    if (e.hidden) continue;
    const p = e.position;
    const dx = h.x - p.x;
    const dz = h.z - p.z;
    const d = Math.hypot(dx, dz);
    const near = d < r.radius;
    const say = (type, extra = {}) => world.events.push({ type, id: e.id, sound: r.sound ?? null, ...extra });
    if (r.kind === 'flee' && e.steer) {
      if (near && (r.when !== 'run' || running)) {
        if (!e.steer.flee) say('flee');
        e.steer.flee = { x: h.x, z: h.z, time: r.time };
      }
    } else if (r.kind === 'greet') {
      r.cool = Math.max(0, (r.cool ?? 0) - dt);
      r.waving = Math.max(0, (r.waving ?? 0) - dt);
      if (near && !world.paused) {
        p.facing = turnToward(p.facing ?? 0, faceOf(dx, dz), dt * TURN);
        if (r.cool === 0) {
          r.cool = r.cooldown;
          r.waving = r.wave;
          say('greet');
        }
      }
    } else if (r.kind === 'follow' && e.steer) {
      r.cool = Math.max(0, (r.cool ?? 0) - dt);
      if ((r.state ?? 'home') === 'home' && near && r.cool === 0 && !world.paused && (r.when !== 'walk' || walking)) {
        r.state = 'follow';
        r.left = r.time;
        say('follow');
      }
      if (r.state === 'follow') {
        r.left -= dt;
        e.steer.goal = { x: h.x, z: h.z };
        if (r.left <= 0) {
          r.state = 'back';
          r.cool = r.cooldown;
        }
      }
      if (r.state === 'back') {
        e.steer.goal = e.range ? { x: e.range.x, z: e.range.z } : null;
        if (!e.steer.goal || e.steer.arrived) {
          r.state = 'home';
          e.steer.goal = null;
        }
      }
    } else if (r.kind === 'break') {
      if (e.broken && (e.broken.mended || (today > e.broken.day && !menders))) {
        // A new pot: the mender set it (with a small sigh), or, on a map with no mender, the
        // family set it in the night.
        if (e.broken.mended) say('mend', { sound: 'sigh' });
        mend(e);
      } else if (e.broken && today > e.broken.day) {
        // A new day: the pot waits for the mender (see the schedule system).
        e.broken.due = true;
      } else if (!e.broken && d < r.radius) {
        r.whole = e.look;
        r.solid = e.solid;
        e.broken = { day: today };
        e.look = r.broken;
        e.keep = true;
        delete e.solid;
        say('break', { spill: true });
        // The grains of the pot: the chickens near it come and peck for a while.
        for (const c of query(world, 'steer', 'position')) {
          if (c.kind !== 'chicken' || Math.hypot(c.position.x - p.x, c.position.z - p.z) > SPILL.radius) continue;
          const a = (c.position.x * 7 + c.position.z * 3) % (Math.PI * 2);
          c.steer.goal = { x: p.x + Math.cos(a) * 1.2, z: p.z + Math.sin(a) * 1.2 };
          c.peck = SPILL.seconds;
        }
      }
    } else if (r.kind === 'hop') {
      if (r.hop !== undefined) {
        // The jump: an arc away from the hero, then under the water.
        r.hop += dt;
        const k = Math.min(1, r.hop / HOP_SECONDS);
        p.x = r.home.x + r.dir.x * 2.4 * k;
        p.z = r.home.z + r.dir.z * 2.4 * k;
        p.y = r.home.y + Math.sin(Math.PI * k) * 1.6 - k * 0.8;
        if (k >= 1) {
          delete r.hop;
          r.left = r.away;
          e.hidden = true;
          say('dive', { sound: null, at: { x: p.x, z: p.z } });
        }
      } else if (near && !world.paused) {
        r.home = { x: p.x, y: p.y, z: p.z };
        r.dir = d > 0.01 ? { x: -dx / d, z: -dz / d } : { x: 0, z: 1 };
        r.hop = 0;
        p.facing = faceOf(-dx, -dz);
        say('hop');
      }
    } else if (r.kind === 'splash') {
      const was = r.inside ?? false;
      r.inside = near;
      if (near && !was && !hero.riding) say('splash', { at: { x: p.x, z: p.z } });
    } else if (r.kind === 'bend') {
      const was = r.inside ?? false;
      r.inside = near;
      if (near) {
        r.bend = { amount: 1 - d / r.radius, dir: Math.atan2(-dx, -dz) };
        if (!was) say('rustle');
      } else if (r.bend) {
        r.bend.amount *= Math.max(0, 1 - dt * 3);
        if (r.bend.amount < 0.01) delete r.bend;
      }
    }
  }
}

// Turn an angle toward another angle by at most `step` (radians), the short way.
export function turnToward(from, to, step) {
  let d = ((((to - from + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  if (Math.abs(d) > step) d = Math.sign(d) * step;
  return from + d;
}

// A broken thing is whole again (its look, its solid, and it is not kept).
function mend(e) {
  const r = e.react;
  delete e.broken;
  e.look = r.whole ?? e.look;
  e.keep = false;
  e.solid = r.solid ?? e.solid;
}
