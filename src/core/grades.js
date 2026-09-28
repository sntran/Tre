// The grades of the game come from the configuration (data/config/game.json, "grades").
// A grade is a whole number: -1 is Pre-K, 0 is K, and 1 to 12 are the school grades.
// No other file has a fixed list of grades.

// The list of grade numbers, in order.
export function gradeIds(cfg) {
  return (cfg?.list ?? []).map((g) => g.id);
}

export function isGrade(grade, cfg) {
  return gradeIds(cfg).includes(grade);
}

// The text key and params of the name of a grade (for example "Grade 3" or "Pre-K").
export function gradeName(grade, cfg) {
  const entry = cfg?.list?.find((g) => g.id === grade);
  return entry?.name ? { key: entry.name, params: {} } : { key: 'grade.name', params: { n: grade } };
}

// The short text key and params of a grade, for buttons (for example "3" or "K").
export function gradeShort(grade, cfg) {
  const entry = cfg?.list?.find((g) => g.id === grade);
  return entry?.short ? { key: entry.short, params: {} } : { key: 'grade.short', params: { n: grade } };
}

// The value in an object with grade keys ("1", "2", ...) for a grade. A grade with no value
// uses the nearest grade with a value (the lower one when two are equally near).
export function byGrade(table, grade) {
  if (table[String(grade)] !== undefined) return table[String(grade)];
  const keys = Object.keys(table).map(Number).filter(Number.isFinite);
  if (keys.length === 0) return undefined;
  const best = keys.sort((a, b) => Math.abs(a - grade) - Math.abs(b - grade) || a - b)[0];
  return table[String(best)];
}
