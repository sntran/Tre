// The growth of the hero (#8): experience and a hero level, shown as a bamboo in the HUD that grows
// one section for each level. Experience comes from what the child does in the world: a task, a
// raid, a step of a quest, and a small event of the day. It never comes from a question (a
// practice with the teacher, an exam). Pure: no DOM.

// The experience of each kind of deed.
export const XP = Object.freeze({ task: 10, raid: 15, quest: 5, event: 3, round: 4 });

// The kinds of deed that give experience. A question is not one of them.
export const DEEDS = Object.freeze(Object.keys(XP));

// The experience that a level needs to go to the next level: 20 for level 1, 30 for level 2, and
// so on (10 more for each level), so that the first levels come fast.
export const stepOf = (level) => 10 + 10 * level;

// The level of an amount of experience: { level (1 or more), into (the experience in this level),
// need (the experience that this level needs) }.
export function levelOf(xp = 0) {
  let level = 1;
  let rest = Math.max(0, Math.floor(xp));
  while (rest >= stepOf(level)) {
    rest -= stepOf(level);
    level += 1;
  }
  return { level, into: rest, need: stepOf(level) };
}

// The growth record of a profile: { xp, steps } (steps: the done steps of the quests that gave
// experience already). A profile with no record gets one.
export function growthOf(profile) {
  profile.growth ??= { xp: 0, steps: null };
  return profile.growth;
}

// Give the experience of a deed. Return { xp (given), level, up (true when the level went up) }, or
// null for a kind that gives none (a question).
export function addXp(profile, kind, times = 1) {
  if (!DEEDS.includes(kind)) return null;
  const g = growthOf(profile);
  const before = levelOf(g.xp).level;
  const xp = XP[kind] * Math.max(0, Math.floor(times));
  g.xp += xp;
  const after = levelOf(g.xp);
  return { xp, level: after.level, up: after.level > before, into: after.into, need: after.need };
}

// The steps of the quests that are done now give experience one time each. done: the number of done
// steps now. The first count of a profile gives none (an old save does not get experience for the
// steps that it did before the growth came). Return the result of addXp, or null.
export function questSteps(profile, done) {
  const g = growthOf(profile);
  if (g.steps === null || g.steps === undefined || done < g.steps) {
    g.steps = done;
    return null;
  }
  const n = done - g.steps;
  g.steps = done;
  return n > 0 ? addXp(profile, 'quest', n) : null;
}
