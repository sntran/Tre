// The people of the generated hamlets, from parts (data/figures.json, villagers): an age, a body,
// a skin, clothes, a hair, a hat, an item, and a face, each chosen by the seed. They are not
// people of the story: no names, no talks. Pure functions.

// A look of a villager (src/world/fine.js reads it). rng: a seeded generator (src/core/rng.js).
export function villagerLook(rng, parts) {
  const age = rng.weighted(parts.ages, (a) => a.weight);
  const bodyName = rng.pick(Object.keys(parts.bodies));
  const body = parts.bodies[bodyName];
  const clothes = rng.pick(parts.clothes);
  const look = {
    skin: rng.pick(parts.skins),
    top: clothes.top,
    bottom: clothes.bottom,
    sash: clothes.sash,
    topKind: body.topKind,
    bottomKind: body.bottomKind,
    hair: age.hair ?? rng.pick(body.hairs),
    face: rng.pick(parts.faces),
  };
  const hat = rng.pick(parts.hats);
  const item = rng.pick(parts.items);
  if (hat) look.hat = hat;
  if (item && age.age !== 'child') look.item = item;
  if (age.scale) {
    look.child = true;
    look.scale = age.scale;
  }
  if (look.hair === 'grey' && body.grey) look.hairStyle = body.grey;
  if (age.age === 'old' && bodyName === 'man' && rng.chance(0.5)) look.beard = true;
  return look;
}
