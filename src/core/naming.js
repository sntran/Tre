// The names of the people of a village (#38, #41; data/world/naming.json): a word of kinship to the
// child and a word after it: the order of birth in the family ("cô Năm", "chú Tư"), the name of the
// first child ("ông Dương"), or the own small name ("chị Hến"), by the age of the person. The rules
// and the word for the order follow the way of naming of the region of the map
// (data/world/regions.json): in the north, and in all regions before the 18th century, the first
// child is Cả; in the center and the south from the 18th century on, the first child is Hai. A name is a text parameter ({ key: 'kin.<id>', params:
// { word } }), so that each language writes it: "cô {word}" in Vietnamese (a capital at the start
// of a sentence), and the same name with a capital word of kinship in English ("Cô {word}").
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

// The word after the word of kinship by a rule of naming: the order of birth ("Năm"), the name of
// the first child ("Dương"), the own small name ("Hến"), or the order and the name of the first child
// ("Hai Tùng"). Null when the person has no field for the rule.
function wordBy(rule, person, way, naming) {
  const order = person.order === undefined ? null : orderWord(naming, way, person.order);
  if (rule === 'child') return person.child ?? null;
  if (rule === 'own') return person.name ?? null;
  if (rule === 'order-child') return order && person.child ? `${order} ${person.child}` : null;
  return order;
}

// The name of a person as a text parameter, or null for a person with no word of kinship (the
// people of Phù Đổng keep their names of work and kinship, as "Bác thợ rèn"). The way of the region
// gives a rule for the age of the person (#41); a person with no field for the rule gets the order.
// rule: another rule (the rule of the way for two people with the same name).
export function personName(person, way, naming, rule = null) {
  if (!person?.kin) return null;
  const w = naming.ways[way] ?? naming.ways.north;
  let by = rule ?? w.ages?.[person.age] ?? 'order';
  let word = wordBy(by, person, way, naming);
  if (!word && by !== 'order') {
    by = 'order';
    word = wordBy(by, person, way, naming);
  }
  if (!word) return null;
  return { key: `kin.${person.kin}`, params: { word } };
}

// The names of all the people with a word of kinship, for the region of a map: id -> parameter.
// No two people have the same name: when two would, the rule of the way for the same names
// (same) names them ("chị Hai Tùng" in the south, the name of the first child in the north).
export function namesOf(data, regionId) {
  const way = wayOf(data.regions, regionId);
  const naming = data.naming;
  const out = {};
  if (!naming) return out;
  const people = data.npcs?.npcs ?? {};
  for (const [id, n] of Object.entries(people)) {
    const name = personName(n, way, naming);
    if (name) out[id] = name;
  }
  const said = (p) => `${p.key} ${p.params.word}`;
  const same = (naming.ways[way] ?? naming.ways.north).same;
  for (const id of Object.keys(out)) {
    const twins = Object.keys(out).filter((o) => said(out[o]) === said(out[id]));
    if (twins.length < 2 || !same) continue;
    for (const o of twins) out[o] = personName(people[o], way, naming, same) ?? out[o];
  }
  return out;
}
