// The names of the people of a village (#38; data/world/naming.json): a word of kinship to the child
// and the order of birth in the family ("cô Năm", "chú Tư"). The word for the order follows the way
// of naming of the region of the map (data/world/regions.json): in the north, and in all regions
// before the 18th century, the first child is Cả; in the center and the south from the 18th
// century on, the first child is Hai. A name is a text parameter ({ key: 'kin.<id>', params:
// { order } }), so that each language writes it: "cô {order}" in Vietnamese (a capital at the start
// of a sentence), and the same name with a capital word of kinship in English ("Cô {order}").
// Pure: no DOM.

// The way of naming of a region (north when the region names none).
export function wayOf(regions, regionId) {
  return regions?.regions?.find((r) => r.id === regionId)?.naming ?? 'north';
}

// The word of an order of birth (1, 2, ..., or 'youngest') in a way of naming.
export function orderWord(naming, way, order) {
  const w = naming.ways[way] ?? naming.ways.north;
  if (order === 'youngest') return w.youngest;
  return w.orders[order - 1] ?? null;
}

// The name of a person as a text parameter, or null for a person with no word of kinship (the
// people of Phù Đổng keep their names of work and kinship, as "Bác thợ rèn").
export function personName(person, way, naming) {
  if (!person?.kin || person.order === undefined) return null;
  const order = orderWord(naming, way, person.order);
  if (!order) return null;
  return { key: `kin.${person.kin}`, params: { order } };
}

// The names of all the people with a word of kinship, for the region of a map: id -> parameter.
export function namesOf(data, regionId) {
  const way = wayOf(data.regions, regionId);
  const out = {};
  for (const [id, n] of Object.entries(data.npcs?.npcs ?? {})) {
    const name = data.naming ? personName(n, way, data.naming) : null;
    if (name) out[id] = name;
  }
  return out;
}
