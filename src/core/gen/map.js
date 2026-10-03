// The maps of a region for a seed: the land (land.js) and the scattered things (scatter.js) in
// the window of each map, with the stamps and the story data of the map. The result has the form
// of a map that the tile map, the terrain, and the session read. Pure functions.
import { createLand } from './land.js';
import { scatter } from './scatter.js';
import { placeHamlets } from './hamlets.js';

// The fields at most this far from water (cells) can flood after a rain.
const WET = 12;

// defs: the map definitions of the region (with their exits), in the order of the region. land:
// the land of the region (data/world/land-<region>.json). geo: { rivers, heights }. rules:
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
    // The spots of the small events of the day (src/core/world/days.js): points of the roads on
    // the low land (a cart does not climb a hill path), the middles of paddies, and the yards of
    // the hamlets, away from the stamps and the edges; with the hand-made spots of the stamps
    // (layers.spots).
    const inside = (gx, gy, m = 6) => gx >= x + m && gy >= y + m && gx < x + def.width - m && gy < y + def.height - m;
    const spots = { road: [], field: [], yard: [] };
    for (const r of ground.roads) {
      for (let k = 0; k < r.line.length; k += 9) {
        const gx = Math.floor(r.line[k][0]);
        const gy = Math.floor(r.line[k][1]);
        const c = ground.cell(gx, gy);
        if (c && c.map === mi && c.letter === '=' && !c.stamp && c.nearStamp > 8 && c.level <= (land.base ?? 2) + 1 && inside(gx, gy)) spots.road.push([gx - x, gy - y]);
      }
    }
    const fields = [];
    for (let gy = y + 2; gy < y + def.height; gy += 5) {
      for (let gx = x + 2; gx < x + def.width; gx += 5) {
        const c = ground.cell(gx, gy);
        if (c && c.map === mi && c.letter === 'f' && !c.stamp && inside(gx, gy)) fields.push([gx - x, gy - y]);
      }
    }
    // At most sixteen paddies, spread over the map.
    const every = Math.max(1, Math.ceil(fields.length / 16));
    spots.field = fields.filter((_, i) => i % every === 0);
    for (const site of ground.sites) if (site.map === mi) spots.yard.push([site.x + 11 - x, site.y + 12 - y]);
    const hand = def.layers.spots ?? {};
    for (const k of Object.keys(spots)) spots[k] = [...(hand[k] ?? []), ...spots[k]];
    // The fields near water (the river, a pond): a flood comes only there.
    spots.wetfield = spots.field.filter(([sx, sy]) => (ground.cell(sx + x, sy + y)?.water ?? Infinity) <= WET);
    const { stamps, ...rest } = def;
    out.set(def.id, {
      ...rest,
      seed,
      // The key of the map and its seed (a cache of a terrain keeps one for each key).
      key: `${def.id}:${seed}`,
      looks,
      layers: { ...def.layers, ground: rows.ground, height: rows.height, objects: [...def.layers.objects, ...objects], life: [...(def.layers.life ?? []), ...life], villagers, spots },
    });
  });
  return out;
}
