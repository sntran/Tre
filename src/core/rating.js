// Difficulty rating (Elo style). Each player has a rating for each skill.
// Each problem item (a skill and a level) has a rating too.
// The game picks the level where the player is correct about 80 percent of the time.

export function expected(playerRating, itemRating, scale = 400) {
  return 1 / (1 + 10 ** ((itemRating - playerRating) / scale));
}

export function updateRatings(playerRating, itemRating, correct, { kPlayer, kItem, scale = 400 }) {
  const e = expected(playerRating, itemRating, scale);
  const score = correct ? 1 : 0;
  return {
    player: playerRating + kPlayer * (score - e),
    item: itemRating - kItem * (score - e),
    expected: e,
  };
}

// The first rating of an item: the base of its grade plus a step for each level.
export function itemStartRating(skill, level, cfg) {
  const own = skill.levels[level - 1]?.rating;
  if (typeof own === 'number') return own;
  return cfg.gradeBase[String(skill.grade)] + (level - 1) * cfg.levelStep;
}

// The first rating of a player for any skill, from the grade of the player.
export function playerStartRating(grade, cfg) {
  return cfg.gradeBase[String(grade)] + cfg.playerStartOffset;
}

// Choose the level for the next problem. The target is an expected success between
// targetLow and targetHigh (for example 75 to 85 percent). If some levels are in that range,
// use the hardest of them. If no level is in the range, use the level nearest to the range.
export function chooseLevel(playerRating, itemRatings, cfg) {
  const low = cfg.targetLow ?? cfg.target;
  const high = cfg.targetHigh ?? cfg.target;
  let best = 1;
  let bestDistance = Infinity;
  itemRatings.forEach((r, i) => {
    const e = expected(playerRating, r, cfg.scale);
    const distance = e < low ? low - e : e > high ? e - high : 0;
    // Levels are in order from easy to hard, so a later level in the range wins.
    if (distance < bestDistance - 1e-9 || (distance === 0 && bestDistance === 0)) {
      best = i + 1;
      bestDistance = distance;
    }
  });
  return best;
}
