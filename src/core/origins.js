// The things of the world that came at a known time (#39; data/world/origins.json): a crop, a food,
// a tool. The world of a region has only the things whose first year is not after the year of the
// region (no corn under the eaves in the time of the Hùng Kings). Pure: no DOM.

// Is a thing in the world in this year? A thing with no year is not, until it has a year with a
// source; a thing that the data does not name is always there.
export function thingIn(origins, thing, year) {
  const t = origins?.things?.[thing];
  if (!t) return true;
  return t.from !== null && year !== null && year !== undefined && t.from <= year;
}

// The things of the data that are in the world in this year.
export const thingsOf = (origins, year) => Object.keys(origins?.things ?? {}).filter((id) => thingIn(origins, id, year));

// The words of the things that are not in the world in this year (lang: vi or en), for the check
// of the texts.
export function wordsBefore(origins, year, lang) {
  return Object.entries(origins?.things ?? {}).filter(([id]) => !thingIn(origins, id, year)).flatMap(([, t]) => t[lang] ?? []);
}
