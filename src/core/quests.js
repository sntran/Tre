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

// The targets of a step that have a star now (#50). A target with its flag `unless` is done, and a
// target waits for its flag `if`. An encounter has a star only while its enemies are there: not
// after the raid is won (the flags that the win of its raid sets), and not after a lost raid until
// the enemies come back at the next dawn (the flag raid.<raid>.back holds the minute of that dawn).
// step: a step of a quest; flags: the story flags; raidOf(id): the raid of an encounter; raids:
// data.raids.raids; minutes: the game clock. Return the targets that keep a star.
export function liveTargets(step, flags, { raidOf = () => null, raids = {}, minutes = 0 } = {}) {
  const list = step?.targets ?? (step?.target ? [{ npc: step.target }] : []);
  return list.filter((tg) => {
    if (tg.unless && flags[tg.unless]) return false;
    if (tg.if && !flags[tg.if]) return false;
    if (!tg.encounter) return true;
    const raid = raidOf(tg.encounter);
    const won = [].concat(raids[raid]?.win?.set ?? []);
    if (won.length && won.every((f) => flags[f])) return false;
    const back = flags[`raid.${raid}.back`];
    return !(back !== undefined && back > minutes);
  });
}

// Whose star a live target is (#62): the person whose small face shows in the disc of the star,
// and the line that a tap on the star says before the walk ("Đi tìm bà lang."). The first live
// target of a step is the next step of the story: its star is bigger than the others. tg: a live
// target; index: its place in the list of live targets; trials: data.trials.trials. Return
// { who (an id of a person, or null), key (the text key of the line), main }.
export function starOf(tg, index = 0, trials = []) {
  const who = tg.npc ?? (tg.trial ? trials.find((t) => t.id === tg.trial)?.npc ?? null : null);
  return { who, key: who ? 'star.go.person' : 'star.go.place', main: index === 0 };
}

// The point of the star of a place of a step (map cells): the middle of the cell of the place, so
// that a walk to the star ends in the zone of the place (#51).
export function placeMark(place) {
  return { x: place.x + 0.5, y: place.y + 0.5 };
}

// The number of the done steps of all the quests (#8: each done step gives experience one time).
export function doneSteps(quests, state) {
  let n = 0;
  for (const q of quests) {
    const s = questState(q, state);
    if (s.open) n += s.index;
  }
  return n;
}
