// The sky: the light of the day from the clock (0 by day, 1 at night, soft at dusk and dawn),
// the rain of some days (from the seed and the day), and the river that rises one block in the
// rain and goes down after it (then the ford is closed). The events dawn and dusk go to the story
// and the sound.
export const WRITES = ['sky', 'wind', 'events'];

import { createRng, hashSeed } from '../../rng.js';
import { gustAt, DEFAULT_AMBIENT } from '../ambient.js';
import { DAY_MINUTES } from '../clock.js';

export const DEFAULT_DAY = Object.freeze({ dusk: [17, 19], dawn: [5, 7], rain: { chance: 0.3, start: [11, 15], hours: [1.5, 3.5], rise: 1, fall: 1 } });

const ramp = (h, [a, b]) => Math.min(1, Math.max(0, (h - a) / (b - a)));

// The wind of the world at a time (seconds of play): a soft breeze from the river with a slow
// swell, and now and then a gust (src/core/world/ambient.js; at the trees, the last layer that it
// crosses). { x, z } is the direction it blows to, and strength goes from 0 to 1. The parts that
// hang move with it (src/world/sway.js).
export const BREEZE = Object.freeze({ x: 0.8, z: 0.6, strength: 0.35, swell: 0.15, period: 23, gust: 0.45 });
export function breezeAt(seconds, b = BREEZE, seed = null, ambient = DEFAULT_AMBIENT) {
  const gust = seed === null ? 0 : gustAt(seed, seconds, 'tree', ambient);
  return { x: b.x, z: b.z, strength: b.strength + b.swell * Math.sin((2 * Math.PI * seconds) / b.period) + b.gust * gust };
}

// The light of an hour: 0 by day, 1 at night.
export function nightAt(hour, day = DEFAULT_DAY) {
  if (hour >= day.dawn[1] && hour <= day.dusk[0]) return 0;
  if (hour > day.dusk[0] && hour < day.dusk[1]) return ramp(hour, day.dusk);
  if (hour > day.dawn[0] && hour < day.dawn[1]) return 1 - ramp(hour, day.dawn);
  return 1;
}

// The rain of a day (from the seed): null, or { start, end } in hours.
export function rainOf(seed, dayIndex, day = DEFAULT_DAY) {
  const r = createRng(hashSeed(`${seed}:rain:${dayIndex}`));
  if (r.next() >= day.rain.chance) return null;
  const start = day.rain.start[0] + r.next() * (day.rain.start[1] - day.rain.start[0]);
  return { start, end: start + day.rain.hours[0] + r.next() * (day.rain.hours[1] - day.rain.hours[0]) };
}

export function sky(world, dt, rng, env) {
  world.wind = breezeAt(world.tick * dt, BREEZE, world.seed, env.day?.ambient ?? DEFAULT_AMBIENT);
  const day = env.day ?? DEFAULT_DAY;
  const minutes = world.clock.minutes;
  const hour = (minutes % DAY_MINUTES) / 60;
  const s = (world.sky ??= { night: nightAt(hour, day), rain: 0, flood: 0, last: minutes });
  const was = s.night;
  s.night = nightAt(hour, day);
  if (was < 0.5 && s.night >= 0.5) world.events.push({ type: 'dusk', id: 'sky' });
  if (was >= 0.5 && s.night < 0.5) world.events.push({ type: 'dawn', id: 'sky' });
  const rain = rainOf(world.seed, Math.floor(minutes / DAY_MINUTES), day);
  const raining = rain && hour >= rain.start && hour < rain.end ? 1 : 0;
  // The end of a rain: the land is wet (the session can bring a flood).
  if (s.raining && !raining) world.events.push({ type: 'dry', id: 'sky' });
  s.raining = raining;
  const hours = Math.min(6, Math.max(0, (minutes - (s.last ?? minutes)) / 60));
  s.last = minutes;
  s.rain += (raining - s.rain) * Math.min(1, hours * 4);
  // The river rises in the rain and goes down after it. While it is high (in the rain and until
  // it is down again, about one hour after the rain), the ford stones are under the water and the
  // ford is closed (see the ground system).
  s.flood = raining ? Math.min(1, s.flood + hours / day.rain.rise) : Math.max(0, s.flood - hours / day.rain.fall);
  s.high = Boolean(raining) || s.flood > 0;
}
