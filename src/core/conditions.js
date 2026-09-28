// Conditions on story flags. Maps, dialogue, and quests use the same form:
// { "flags": ["a", "b"], "notFlags": ["c"], "anyFlags": ["d", "e"], "grade": { "min": 3 },
//   "items": { "iron": 6 }, "any": [ {...}, {...} ] }
// All parts must be true. An empty or missing condition is always true.

export function check(when, state) {
  if (!when) return true;
  const flags = state.flags ?? {};
  if (when.flags && !when.flags.every((f) => flags[f])) return false;
  if (when.notFlags && when.notFlags.some((f) => flags[f])) return false;
  if (when.anyFlags && !when.anyFlags.some((f) => flags[f])) return false;
  if (when.grade) {
    const g = state.grade ?? 1;
    if (when.grade.min !== undefined && g < when.grade.min) return false;
    if (when.grade.max !== undefined && g > when.grade.max) return false;
  }
  if (when.items) {
    const inv = state.inventory ?? {};
    for (const [item, count] of Object.entries(when.items)) if ((inv[item] ?? 0) < count) return false;
  }
  if (when.any && !when.any.some((c) => check(c, state))) return false;
  if (when.calling !== undefined && (state.calling ?? null) !== when.calling) return false;
  return true;
}
