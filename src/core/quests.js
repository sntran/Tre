// Quests. The state of a quest comes from the story flags, so it can never be
// in a strange state. Each step is done when its "done" condition is true.
// quest: { id, titleKey, when, steps: [{ id, goalKey, done: {...}, progress: [flags], target: "npc-id" }] }
import { check } from './conditions.js';

export function questState(quest, state) {
  if (!check(quest.when, state)) return { id: quest.id, open: false, done: false, step: null, index: -1 };
  const index = quest.steps.findIndex((s) => !check(s.done, state));
  if (index === -1) return { id: quest.id, open: true, done: true, step: null, index: quest.steps.length };
  const step = quest.steps[index];
  const progress = step.progress ? {
    have: step.progress.filter((f) => state.flags?.[f]).length,
    need: step.progress.length,
  } : step.count ? {
    have: Math.min(step.count.need, state.inventory?.[step.count.item] ?? 0),
    need: step.count.need,
  } : null;
  return { id: quest.id, open: true, done: false, step, index, progress };
}

// The first open quest that is not done: the current goal of the player.
export function currentGoal(quests, state) {
  for (const q of quests) {
    const s = questState(q, state);
    if (s.open && !s.done) return { quest: q, ...s };
  }
  return null;
}
