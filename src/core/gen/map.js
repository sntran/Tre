// The maps of a region for a seed: the land (land.js) and the scattered things (scatter.js) in
// the window of each map, with the stamps and the story data of the map. The result has the form
// of a map that the tile map, the terrain, and the session read. Pure functions.
import { createLand } from './land.js';
import { scatter } from './scatter.js';
import { placeHamlets } from './hamlets.js';

// defs: the map definitions of the region (with their exits), in the order of the region. land:
// the land of the region (data/world/land-<region>.json). geo: { rivers, elevation }. rules:
// data/world/scatter.json. parts: the parts of the villagers (data/figures.json). Return a Map from
// map id to map.
export function generateRegion(defs, land, geo, rules, seed, parts = null) {
  // The land keeps the sites of the hamlets; their houses and people come before the scatter.
  const ground = createLand(land, defs, geo, seed, parts ? rules.hamlets : null);
  const hamlets = placeHamlets(ground, defs, parts);
  const things = scatter(ground, rules, defs, seed);
  const out = new Map();
  defs.forEach((def, mi) => {
    const { x, y } = def.window;
    const rows = ground.rows(def);
    const objects = [
      ...hamlets.objects.filter((o) => o.map === mi).map((o) => ({ id: o.id, prop: o.prop, x: o.x - x, y: o.y - y, w: o.w, h: o.h, seed: o.seed, gen: true })),
      ...things.objects.filter((o) => o.map === mi).map((o, i) => ({ id: `gen:${o.prop}:${i}`, prop: o.prop, x: o.x - x, y: o.y - y, w: o.w, h: o.h, seed: o.seed, gen: true })),
    ];
    const life = [...hamlets.life, ...things.life].filter((g) => g.map === mi).map((g) => ({ kind: g.kind, n: g.n, x: g.x - x, y: g.y - y, r: g.r, gen: true }));
    // The villagers of the hamlets, and their looks from parts (the view draws a look by its key).
    const villagers = hamlets.villagers.filter((v) => v.map === mi).map((v) => ({ id: v.id, home: v.home, plan: v.plan, x: v.x - x, y: v.y - y }));
    const looks = Object.fromEntries(hamlets.villagers.filter((v) => v.map === mi).map((v) => [v.id, v.look]));
    const { stamps, ...rest } = def;
    out.set(def.id, {
      ...rest,
      seed,
      // The key of the map and its seed (a cache of a terrain keeps one for each key).
      key: `${def.id}:${seed}`,
      looks,
      layers: { ...def.layers, ground: rows.ground, height: rows.height, objects: [...def.layers.objects, ...objects], life: [...(def.layers.life ?? []), ...life], villagers },
    });
  });
  return out;
}
