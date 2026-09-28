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

// Decide the mastery of a skill entry and keep it in entry.mastered.
// entry: { p, n (answers), top (correct answers at the highest level), mastered }.
// A skill becomes mastered when p is high enough, after enough answers, with enough
// correct answers at the highest level. It stays mastered until p falls below "almost",
// so that the state does not flap between two answers.
export function decideMastery(entry, cfg) {
  if (entry.mastered) {
    if (entry.p < cfg.almost) entry.mastered = false;
  } else if (entry.p >= cfg.mastered
    && entry.n >= (cfg.minAnswers ?? 0)
    && (entry.top ?? 0) >= (cfg.minTopCorrect ?? 0)
    && recentMistakes(entry) <= allowedMistakes(entry, cfg)) {
    entry.mastered = true;
  }
  return entryState(entry, cfg);
}

// Keep the results of the last answers as a text of "1" (correct) and "0" (wrong).
export function pushRecent(entry, correct, size) {
  entry.recent = ((entry.recent ?? '') + (correct ? '1' : '0')).slice(-size);
}

// The mistakes that the last answers can have. With fewer answers than recentAnswers,
// the number is smaller in proportion (for example no mistake in 8 answers).
function allowedMistakes(entry, cfg) {
  if (cfg.recentMistakes == null || !cfg.recentAnswers) return Infinity;
  return Math.floor((cfg.recentMistakes * (entry.recent ?? '').length) / cfg.recentAnswers);
}

export function recentMistakes(entry) {
  return [...(entry.recent ?? '')].filter((c) => c === '0').length;
}

export function entryState(entry, cfg) {
  if (entry.mastered) return 'mastered';
  return entry.p >= cfg.almost ? 'almost' : 'learning';
}
