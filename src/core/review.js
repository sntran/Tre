// Spaced review with Leitner boxes. A mastered skill goes into box 1.
// A correct review moves it to the next box, which waits longer.
// A wrong review moves it back to box 1.

export const DAY_MS = 24 * 60 * 60 * 1000;

export function intervalMs(box, cfg) {
  const days = cfg.intervalsDays[Math.min(box, cfg.intervalsDays.length) - 1];
  return days * DAY_MS;
}

// Put a skill into review when it becomes mastered.
export function startReview(entry, now, cfg) {
  if (entry.box > 0) return entry;
  entry.box = 1;
  entry.due = now + intervalMs(1, cfg);
  return entry;
}

// Record a review answer. Only an answer on or after the due time moves the box up.
export function recordReview(entry, correct, now, cfg) {
  if (!entry.box) return entry;
  if (!correct) {
    entry.box = 1;
    entry.due = now + intervalMs(1, cfg);
  } else if (now >= entry.due) {
    entry.box = Math.min(entry.box + 1, cfg.intervalsDays.length);
    entry.due = now + intervalMs(entry.box, cfg);
  }
  return entry;
}

export function isDue(entry, now) {
  return Boolean(entry?.box) && now >= entry.due;
}
