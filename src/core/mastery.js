// Mastery model: Bayesian Knowledge Tracing (BKT).
// p is the chance that the player knows the skill.
// cfg: { pTransit, pSlip, pGuess, almost, mastered }

export function bktUpdate(p, correct, cfg) {
  const { pSlip: slip, pGuess: guess, pTransit: transit } = cfg;
  const known = correct
    ? (p * (1 - slip)) / (p * (1 - slip) + (1 - p) * guess)
    : (p * slip) / (p * slip + (1 - p) * (1 - guess));
  const next = known + (1 - known) * transit;
  return Math.min(0.9999, Math.max(0.0001, next));
}

// The chance of a correct answer now.
export function pCorrect(p, cfg) {
  return p * (1 - cfg.pSlip) + (1 - p) * cfg.pGuess;
}

// Three simple states for the parent page.
export function masteryState(p, cfg) {
  if (p >= cfg.mastered) return 'mastered';
  if (p >= cfg.almost) return 'almost';
  return 'learning';
}

// How many correct answers in a row move p from the start to mastered.
export function answersToMaster(p, cfg, limit = 50) {
  let n = 0;
  while (p < cfg.mastered && n < limit) {
    p = bktUpdate(p, true, cfg);
    n++;
  }
  return n;
}
