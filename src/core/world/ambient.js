// The world at rest: the gusts of wind, the meals, the calendar of the year (Tết), and the rare
// things of some days. Pure functions of the seed, the time, and data/world/day.json (ambient), so
// that the same seed gives the same days. Nothing here teaches, counts, or gives a reward: it is
// there for the child who looks (docs/ART.md, "The world breathes").
import { hashSeed } from '../rng.js';
import { DAY_MINUTES } from './clock.js';

export const DEFAULT_AMBIENT = Object.freeze({
  gust: { every: [35, 70], length: 7, delays: { paddy: 0, hedge: 2.5, tree: 5 } },
  meals: [[6, 7], [11, 12], [17, 18]],
  year: { days: 40, tet: [20, 21] },
  rare: { chance: 0.05, kinds: ['kingfisher', 'golden-shoot', 'firefly-horn'] },
  star: { chance: 0.2, hour: [21, 3] },
  rainbow: 3,
  windy: 0.35,
});

// A number from 0 to 1 for a seed and a text.
const unit = (seed, text) => (hashSeed(`${seed}:${text}`) % 100000) / 100000;

// The start (seconds) of each gust up to a time: the gaps between two gusts come from the seed.
function gustStarts(seed, seconds, g) {
  const out = [];
  let t = g.every[0] * unit(seed, 'gust:first');
  for (let k = 0; t <= seconds; k++) {
    out.push(t);
    t += g.every[0] + (g.every[1] - g.every[0]) * unit(seed, `gust:${k}`);
  }
  return out;
}

// The strength (0 to 1) of the gust at a layer ('paddy', 'hedge', or 'tree') at a time (seconds of
// play). A gust crosses the paddies first, then the hedge, then the trees: the same swell, later
// for each layer. It rises and falls softly.
export function gustAt(seed, seconds, layer, a = DEFAULT_AMBIENT) {
  const g = a.gust;
  const delay = g.delays[layer] ?? 0;
  let best = 0;
  const starts = gustStarts(seed, seconds - delay, g);
  for (const s of starts.slice(-2)) {
    const k = (seconds - delay - s) / g.length;
    if (k >= 0 && k <= 1) best = Math.max(best, Math.sin(k * Math.PI) ** 2);
  }
  return best;
}

// The gust on all three layers: { paddy, hedge, tree }.
export const gustsAt = (seed, seconds, a = DEFAULT_AMBIENT) => ({ paddy: gustAt(seed, seconds, 'paddy', a), hedge: gustAt(seed, seconds, 'hedge', a), tree: gustAt(seed, seconds, 'tree', a) });

// Is it a meal time at an hour (smoke from the kitchens, steam from the rice pot)?
export const mealAt = (hour, a = DEFAULT_AMBIENT) => a.meals.some(([s, e]) => hour >= s && hour < e);

// The day of the game (0 is the first) and the day of its year.
export const dayIndex = (minutes) => Math.floor(minutes / DAY_MINUTES);
export const yearDay = (day, a = DEFAULT_AMBIENT) => ((day % a.year.days) + a.year.days) % a.year.days;

// Is a day of the game one of the days of Tết?
export const isTet = (day, a = DEFAULT_AMBIENT) => a.year.tet.includes(yearDay(day, a));

// The rare things of a day (a kingfisher by the ford, a golden bamboo shoot in the hedge, a firefly
// on the horn of Nghé): each on about one day in twenty, from the seed.
export const rareOn = (seed, day, a = DEFAULT_AMBIENT) => a.rare.kinds.filter((k) => unit(seed, `rare:${k}:${day}`) < a.rare.chance);

// A shooting star on about one night in five, at an hour of that night from the seed. Return the
// hour (from 0 to 24), or null.
export function starOn(seed, day, a = DEFAULT_AMBIENT) {
  if (unit(seed, `star:${day}`) >= a.star.chance) return null;
  const [from, to] = a.star.hour;
  const span = (to - from + 24) % 24;
  return (from + span * unit(seed, `star:hour:${day}`)) % 24;
}

// Is a day windy (a kite over the village)?
export const windyOn = (seed, day, a = DEFAULT_AMBIENT) => unit(seed, `windy:${day}`) < a.windy;

// A rainbow over the river for a while after a rain. rain: the rain of the day ({ start, end } in
// hours, or null, from rainOf in systems/sky.js). Return true at the hour.
export const rainbowAt = (rain, hour, a = DEFAULT_AMBIENT) => Boolean(rain) && hour >= rain.end && hour < rain.end + a.rainbow;
