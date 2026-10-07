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

// A review for the learning log: an answer for a mastered skill that is due, after an answer
// before it, at least the first interval of the boxes later. Return { due, gap } (gap in days), or
// null. A skill that starts as mastered (below the grade of the child) is due at once, but its first
// answer is not a review, and an answer a few minutes after the last one does not say whether the
// child keeps the skill (#52: "after about 7 days: 33%" on the first day of play).
export function reviewOf(entry, now, cfg) {
  if (!entry?.mastered || !isDue(entry, now) || !entry.last) return null;
  const gap = (now - entry.last) / DAY_MS;
  if (gap < cfg.intervalsDays[0]) return null;
  return { due: entry.due, gap };
}
