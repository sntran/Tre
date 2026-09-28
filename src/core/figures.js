// The sizes of people in pictures. A child is drawn smaller than an adult.
// cfg (data/config/game.json, "figures"): { map, battle, child }
//   map, battle: the scale of an adult on the map and in battles.
//   child: the size of a child as a share of the size of an adult.

// def: { scale, child } of a person. place: 'map' or 'battle'.
export function figureScale(def, place, cfg) {
  if (typeof def?.scale === 'number') return def.scale;
  const adult = cfg[place];
  return def?.child ? adult * cfg.child : adult;
}
