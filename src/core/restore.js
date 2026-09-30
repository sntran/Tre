// Restore points: the game keeps the save of the last dawns of each profile (the state at the start
// of each game day), next to the current save. A parent can go back to one of them. Pure: the
// storage (src/ui/storage.js) keeps the records, this module only changes them.
//
// A record of the profile store: { id, name, text, updatedAt, points }. text: the current save (the
// save format of src/core/save.js). points: the restore points, the newest first:
// [{ text, day, era, at }] (day: the game day of the dawn; era: the era of the story then; at: the
// real time in milliseconds).

export const KEEP = 3;

// The game day of a profile (from the clock of its world): day 0 is the first day.
export function gameDay(profile) {
  const minutes = profile?.world?.clock?.minutes ?? 0;
  return Math.floor(minutes / 1440);
}

// Add the save of a dawn as a restore point. A second save on the same game day takes the place
// of the first; the oldest points go out when there are more than `keep`.
export function addPoint(record, point, keep = KEEP) {
  const points = (record.points ?? []).filter((p) => p.day !== point.day);
  return { ...record, points: [point, ...points].sort((a, b) => b.day - a.day || b.at - a.at).slice(0, keep) };
}

// Go back to a restore point: it becomes the current save, and the current save becomes a restore
// point in its place. The other points stay. current: { day, era } of the current save.
export function restorePoint(record, index, current, now) {
  const point = record.points?.[index];
  if (!point) return record;
  const back = { text: record.text, day: current.day, era: current.era, at: now };
  const points = record.points.map((p, i) => (i === index ? back : p)).sort((a, b) => b.day - a.day || b.at - a.at);
  return { ...record, text: point.text, updatedAt: now, points };
}

// The title screen: "new adventure" is always there. With the profiles full, it asks for the parent
// gate (a parent can remove a profile there).
export function newAdventure(count, max) {
  return { show: true, full: count >= max };
}
