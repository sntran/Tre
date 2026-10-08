// The game clock. Pure functions, no DOM.
// The clock counts game minutes from the start of the game. The light of the day (5:00 to 19:00,
// with dawn and dusk) passes in 10 minutes of play, and the night (19:00 to 5:00) in 4 minutes
// (#65: with 8 minutes for a whole day, a child who looked around came to the first task at dusk).
// So the clock goes slower in the day and faster at night; the hours of the day stay as they are.
// Travel adds game hours.

export const DAY_MINUTES = 24 * 60;
export const CLOCK = Object.freeze({
  daySeconds: 600, // seconds of play from 5:00 to 19:00
  nightSeconds: 240, // seconds of play from 19:00 to 5:00
  dayFrom: 5 * 60,
  dayTo: 19 * 60,
  realSecondsPerDay: 840, // daySeconds + nightSeconds: about 14 minutes of play for one day
  start: 7 * 60, // a new game starts at 7 in the morning of day 1
});

export function createClock(cfg = CLOCK) {
  return { minutes: cfg.start };
}

// The game minutes that pass in one second of play at a minute of the day.
export function rateAt(minutes, cfg = CLOCK) {
  const m = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return m >= cfg.dayFrom && m < cfg.dayTo
    ? (cfg.dayTo - cfg.dayFrom) / cfg.daySeconds
    : (DAY_MINUTES - (cfg.dayTo - cfg.dayFrom)) / cfg.nightSeconds;
}

// Play time passes. realSeconds: seconds of play. The rate changes at 5:00 and at 19:00.
export function advance(clock, realSeconds, cfg = CLOCK) {
  let left = realSeconds;
  while (left > 1e-9) {
    const m = ((clock.minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    const day = m >= cfg.dayFrom && m < cfg.dayTo;
    const edge = day ? cfg.dayTo : m >= cfg.dayTo ? DAY_MINUTES + cfg.dayFrom : cfg.dayFrom;
    const rate = rateAt(m, cfg);
    const toEdge = (edge - m) / rate;
    if (left <= toEdge) {
      clock.minutes += left * rate;
      break;
    }
    clock.minutes += edge - m;
    left -= toEdge;
  }
  return clock;
}

export function addHours(clock, hours) {
  clock.minutes += hours * 60;
  return clock;
}

// The day (from 1), the hour and minute of the day, and the part of the day.
export function timeOfDay(clock) {
  const total = Math.max(0, clock.minutes);
  const day = Math.floor(total / DAY_MINUTES) + 1;
  const inDay = total % DAY_MINUTES;
  const hour = Math.floor(inDay / 60);
  const minute = Math.floor(inDay % 60);
  const part = hour < 5 ? 'night' : hour < 7 ? 'dawn' : hour < 17 ? 'day' : hour < 19 ? 'dusk' : 'night';
  return { day, hour, minute, part };
}
