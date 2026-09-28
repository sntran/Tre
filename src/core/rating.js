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

// Pick the level whose chance of a correct answer is nearest to the target.
// itemRatings: the rating of each level, in level order. Return a level (1, 2, ...).
export function chooseLevel(playerRating, itemRatings, cfg) {
  let best = 1;
  let bestGap = Infinity;
  itemRatings.forEach((r, i) => {
    const gap = Math.abs(expected(playerRating, r, cfg.scale) - cfg.target);
    if (gap < bestGap - 1e-9) {
      best = i + 1;
      bestGap = gap;
    }
  });
  return best;
}
