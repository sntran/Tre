// Game rules that change the profile: story effects, talks, and encounters.
// The functions return commands for the screens (for example "open a battle").
import { check } from './conditions.js';
import { addItem, takeItems, addFriend, setFlag } from './profile.js';

// Apply a list of effects to the profile. Return the commands for the screens
// and the changes (for messages to the player).
export function applyEffects(profile, effects, { maxParty = 3 } = {}) {
  const commands = [];
  const changes = { items: {}, flags: [], friends: [] };
  for (const e of effects ?? []) {
    if (e.set) {
      setFlag(profile, e.set, true);
      changes.flags.push(e.set);
    }
    if (e.unset) delete profile.flags[e.unset];
    if (e.give) {
      for (const [item, n] of Object.entries(e.give)) {
        addItem(profile, item, n);
        changes.items[item] = (changes.items[item] ?? 0) + n;
      }
    }
    if (e.take) {
      if (takeItems(profile, e.take)) {
        for (const [item, n] of Object.entries(e.take)) changes.items[item] = (changes.items[item] ?? 0) - n;
      }
    }
    if (e.friend && addFriend(profile, e.friend, maxParty)) changes.friends.push(e.friend);
    if (e.open || e.sound || e.speak) commands.push(e);
  }
  return { commands, changes };
}

// The state that conditions read.
export function conditionState(profile) {
  return { flags: profile.flags, grade: profile.grade, inventory: profile.inventory, calling: profile.calling };
}

// Pick the dialogue of a person: the first talk rule whose condition is true.
export function pickTalk(npc, profile) {
  const state = conditionState(profile);
  for (const rule of npc.talk ?? []) if (check(rule.when, state)) return rule.dialogue;
  return null;
}

// Is a person or an encounter on the map now?
export function isPresent(thing, profile) {
  return check(thing.when, conditionState(profile));
}
