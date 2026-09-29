// The game clock. Pure functions, no DOM.
// The clock counts game minutes from the start of the game. A game day passes in about
// 8 minutes of play, so one second of play is 3 game minutes. Travel adds game hours.

export const DAY_MINUTES = 24 * 60;
export const CLOCK = Object.freeze({
  realSecondsPerDay: 480, // about 8 minutes of play for one day
  start: 7 * 60, // a new game starts at 7 in the morning of day 1
});

export function createClock(cfg = CLOCK) {
  return { minutes: cfg.start };
}

// Play time passes. realSeconds: seconds of play.
export function advance(clock, realSeconds, cfg = CLOCK) {
  clock.minutes += (realSeconds * DAY_MINUTES) / cfg.realSecondsPerDay;
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
