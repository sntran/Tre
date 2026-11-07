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

// The rest of a step (#155: "I looked everywhere, there is none!"): when every target of the step
// waits (the enemies of a lost raid come back at the next dawn, a target waits for the flag of such
// a raid), the next step is a rest until the morning, and the star goes to a place of rest. At night
// a raid does not start, so a step whose live targets are all raids rests too. Return null when a
// target has a star, else { rest: true, raid: the id of the raid that waits (or null), night }.
export function restOf(step, flags, { raidOf = () => null, raids = {}, minutes = 0, night = false, dayOnly = () => false } = {}) {
  const list = step?.targets ?? (step?.target ? [{ npc: step.target }] : []);
  if (!list.length) return null;
  const live = liveTargets(step, flags, { raidOf, raids, minutes });
  const waiting = list.map((tg) => (tg.encounter ? raidOf(tg.encounter) : null))
    .find((raid) => raid && flags[`raid.${raid}.back`] !== undefined && flags[`raid.${raid}.back`] > minutes) ?? null;
  if (!live.length) return waiting || night ? { rest: true, raid: waiting, night } : null;
  // At night the rest is the next step, for every step, also a step with a person (#164: the star
  // of rest did not show while the step had a person, and a girl of grade 1 used about 60 touches to
  // find the sleep).
  if (night) return { rest: true, raid: null, night: true };
  return null;
}

// Whose star a live target is (#62): the person whose small face shows in the disc of the star,
// and the line that a tap on the star says before the walk ("Đi tìm bà lang."). The first live
// target of a step is the next step of the story: its star is bigger than the others. tg: a live
// target; index: its place in the list of live targets; trials: data.trials.trials. Return
// { who (an id of a person, or null), key (the text key of the line), main }.
// thing: the look of the small picture of a target that is not a person (#154: "There are 3 star
// arrows now ... I don't know which one has iron."): the ore for a place of iron, the enemy of a
// raid. raids: data.raids ({ raids, enemies }); raidOf(encounter id): the id of its raid.
// The line of a thing names it (#163: "Đi tới chỗ ngôi sao." at a face or a rock): an object to
// find ("Đi tìm quặng sắt."), or the enemies of a raid ("Đi tới chỗ thuồng luồng."). target: the
// target of the star, so that its line comes one time.
export function starOf(tg, index = 0, trials = [], { raids = null, raidOf = () => null } = {}) {
  const who = tg.npc ?? (tg.trial ? trials.find((t) => t.id === tg.trial)?.npc ?? null : null);
  const target = tg.npc ?? tg.trial ?? tg.object ?? tg.encounter ?? null;
  if (who) return { who, thing: null, key: 'star.go.person', main: index === 0, target };
  const kind = thingKind(tg, raids, raidOf);
  const name = kind ? `star.thing.${kind}` : null;
  return { who, thing: thingOf(tg, raids, raidOf), key: !name ? 'star.go.place' : tg.object ? 'star.go.find' : 'star.go.to', name, main: index === 0, target };
}
// The kind of the thing of a target: the object (ore), or the first enemy of the raid.
function thingKind(tg, raids, raidOf) {
  if (tg.object) return String(tg.object).replace(/\d+$/, '');
  if (!tg.encounter || !raids) return null;
  const def = raids.raids?.[raidOf(tg.encounter)];
  const waves = def?.waves ?? (def?.phases?.find((ph) => ph.boss) ?? def?.phases?.[0])?.waves ?? [];
  const kind = waves[0]?.kind;
  return kind === 'general' ? 'soldier' : kind ?? null;
}

// The look of the picture of a target that is a thing (an object of the map, the enemies of a raid),
// or null.
export const OBJECT_LOOKS = { ore: 'ore' };
export function thingOf(tg, raids = null, raidOf = () => null) {
  if (tg.object) return OBJECT_LOOKS[String(tg.object).replace(/\d+$/, '')] ?? null;
  if (tg.encounter && raids) {
    const def = raids.raids?.[raidOf(tg.encounter)];
    // The enemy that the child stops at the end (the general of the phase of the boss).
    const waves = def?.waves ?? (def?.phases?.find((ph) => ph.boss) ?? def?.phases?.[0])?.waves ?? [];
    const kind = waves[0]?.kind;
    return kind ? raids.enemies?.[kind]?.look ?? null : null;
  }
  return null;
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
