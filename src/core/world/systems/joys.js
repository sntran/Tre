// The small joys of the world at rest (docs/WORLD.md, "The world at rest"). Nothing here teaches,
// counts, or gives: no reward, no count, no notebook entry, and no text. The child finds them or
// does not.
//   when: a thing that is there only on some days or hours (a rare thing of the seed, the days of
//     Tết, the hours after a rain, an hour of the day). Out of them it is hidden.
//   dance: the lion dance of Tết goes around its place in steps, with a beat of the drum.
//   flick: a tap on a sleeping animal makes it flick an ear (the input system starts it).
//   catch: now and then the net of the fisher comes up with a fish, and the fisher holds it up.
//     The fisher keeps the span of the catch (haul), so that one catch is one splash (#49).
//   notice: Nghé turns its head to a joy near it, at most once a day, so that the child learns to
//     look where Nghé looks.
export const WRITES = ['hidden', 'position', 'motion', 'flick', 'carry', 'act', 'haul', 'notice', 'noticed', 'events'];

import { query, getEntity } from '../state.js';
import { hashSeed } from '../../rng.js';
import { faceOf } from '../move.js';
import { DAY_MINUTES } from '../clock.js';
import { DEFAULT_AMBIENT, isTet, rareOn, dayIndex } from '../ambient.js';
import { rainOf, DEFAULT_DAY } from './sky.js';

// A number from 0 to 1 for a seed and a key (the same each time).
const unit = (seed, key) => (hashSeed(`${seed}:${key}`) % 100000) / 100000;

// Is a thing with `when` there at a time? minutes: the game clock. Return true or false.
export function whenOn(when, seed, minutes, ambient = DEFAULT_AMBIENT, day = DEFAULT_DAY) {
  const d = dayIndex(minutes);
  const hour = (minutes % DAY_MINUTES) / 60;
  if (when.rare && !rareOn(seed, d, ambient).includes(when.rare)) return false;
  if (when.tet && !isTet(d, ambient)) return false;
  if (when.hours && !(hour >= when.hours[0] && hour < when.hours[1])) return false;
  if (when.wet) {
    // From the start of the rain of the day until some hours after its end.
    const rain = rainOf(seed, d, day);
    if (!rain || hour < rain.start || hour >= rain.end + when.wet) return false;
  }
  return true;
}

// Does the fisher hold up a fish at a time (seconds of play)? From the seed: in each span of
// `every` seconds, on about `chance` of them, for the first `hold` seconds.
export function catchAt(seed, seconds, c) {
  const span = Math.floor(seconds / c.every);
  return seconds - span * c.every < c.hold && unit(seed, `catch:${span}`) < c.chance;
}

export function joys(world, dt, rng, env) {
  const ambient = env.day?.ambient ?? DEFAULT_AMBIENT;
  const minutes = world.clock.minutes;
  const seconds = world.tick * dt;
  for (const e of query(world, 'when', 'position')) {
    const on = whenOn(e.when, world.seed, minutes, ambient, env.day ?? DEFAULT_DAY);
    if (on) delete e.hidden;
    else e.hidden = true;
  }
  // The lion dance: a step around the circle each `step` seconds, a beat of the drum each `beat`.
  for (const e of query(world, 'dance', 'position')) {
    if (e.hidden) continue;
    const d = e.dance;
    const a = Math.floor(seconds / d.step) * 0.7;
    e.position.x = d.x + Math.cos(a) * d.r;
    e.position.z = d.z + Math.sin(a) * d.r;
    e.position.facing = faceOf(-Math.sin(a), Math.cos(a));
    if (e.motion) e.motion.speed = 3;
    if (Math.floor(seconds / d.beat) !== Math.floor((seconds - dt) / d.beat)) world.events.push({ type: 'beat', id: e.id, sound: 'tom' });
  }
  for (const e of query(world, 'flick')) {
    e.flick = Math.max(0, e.flick - dt);
    if (e.flick === 0) delete e.flick;
  }
  const c = env.joys?.catch;
  const fisher = c ? getEntity(world, c.who) : null;
  if (fisher && !fisher.hidden && !world.paused && (fisher.motion?.speed ?? 0) < 0.5 && (world.sky?.night ?? 0) < 0.3 && catchAt(world.seed, seconds, c)) {
    // The schedule clears carry at each step, so the span of the catch, not carry, says that the
    // splash of this catch has played.
    const span = Math.floor(seconds / c.every);
    if (fisher.haul !== span) world.events.push({ type: 'haul', id: fisher.id, sound: 'splash' });
    fisher.haul = span;
    fisher.carry = 'fish';
    fisher.act = 'catch';
  }
  notice(world, dt, env.joys?.notice);
}

// Nghé turns its head to a joy near it, at most once a day.
function notice(world, dt, n) {
  const nghe = query(world, 'follow', 'position')[0];
  if (!nghe || !n) return;
  if (nghe.notice) {
    nghe.notice.left -= dt;
    nghe.position.facing = faceOf(nghe.notice.x - nghe.position.x, nghe.notice.z - nghe.position.z);
    if (nghe.notice.left <= 0) delete nghe.notice;
    return;
  }
  const today = dayIndex(world.clock.minutes);
  const hero = getEntity(world, 'hero');
  if (world.noticed === today || !hero || hero.riding || world.paused) return;
  const p = nghe.position;
  for (const j of query(world, 'joy', 'position')) {
    if (j.hidden) continue;
    const d = Math.hypot(j.position.x - p.x, j.position.z - p.z);
    if (d > n.radius || d < 1 || Math.hypot(j.position.x - hero.position.x, j.position.z - hero.position.z) > n.hero) continue;
    world.noticed = today;
    nghe.notice = { x: j.position.x, z: j.position.z, left: n.time };
    world.events.push({ type: 'notice', id: nghe.id, at: j.id });
    return;
  }
}
