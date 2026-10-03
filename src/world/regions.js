// The world of regions and maps. Pure functions, no DOM.
// A region has maps. Each map is a window on the plane of its region, and the maps touch at their
// edges. A map has exits: when the hero walks into an exit, the hero goes to another map. The
// exits come from the windows: an edge that touches another map takes the hero there. The links
// between regions are the roads on the country map. The land of each map comes from the rules of
// its region and the seed of the world (src/core/gen/map.js).
import { check } from '../core/conditions.js';
import { createRoutes } from './travel.js';
import { generateRegion } from '../core/gen/map.js';

const EDGE = 2; // the depth of an exit at an edge (cells)
const IN = 2.6; // the arrival: this far into the next map (past its exit)

// The exits of the maps of a region, from their windows. roads: the roads of the land of the
// region; where a road crosses an edge, the exit marks that point (the quest marker stands there).
export function edgeExits(list, roads = []) {
  const out = new Map(list.map((m) => [m.id, []]));
  const mark = (a, edge, lo, hi) => {
    for (const r of roads) {
      for (const [x, y] of r.points) {
        if (edge.x !== undefined && x === edge.x && y >= lo && y < hi) return { x: Math.min(a.width - 1, Math.max(0, x - a.window.x)), y: y - a.window.y };
        if (edge.y !== undefined && y === edge.y && x >= lo && x < hi) return { x: x - a.window.x, y: Math.min(a.height - 1, Math.max(0, y - a.window.y)) };
      }
    }
    return null;
  };
  for (const a of list) {
    for (const b of list) {
      if (a === b || !a.window || !b.window) continue;
      const A = a.window;
      const B = b.window;
      const ys = [Math.max(A.y, B.y), Math.min(A.y + a.height, B.y + b.height)];
      const xs = [Math.max(A.x, B.x), Math.min(A.x + a.width, B.x + b.width)];
      const exits = out.get(a.id);
      const add = (dir, rect, to, m) => exits.push({ id: `${dir}:${b.id}`, kind: 'edge', ...rect, to: { map: b.id, ...to }, ...(m ? { mark: m } : {}) });
      if (ys[1] > ys[0] && A.x + a.width === B.x) add('east', { x: a.width - EDGE, y: ys[0] - A.y, w: EDGE, h: ys[1] - ys[0] }, { x: IN, dy: A.y - B.y }, mark(a, { x: B.x }, ...ys));
      if (ys[1] > ys[0] && B.x + b.width === A.x) add('west', { x: 0, y: ys[0] - A.y, w: EDGE, h: ys[1] - ys[0] }, { x: b.width - IN, dy: A.y - B.y }, mark(a, { x: A.x }, ...ys));
      if (xs[1] > xs[0] && A.y + a.height === B.y) add('south', { x: xs[0] - A.x, y: a.height - EDGE, w: xs[1] - xs[0], h: EDGE }, { y: IN, dx: A.x - B.x }, mark(a, { y: B.y }, ...xs));
      if (xs[1] > xs[0] && B.y + b.height === A.y) add('north', { x: xs[0] - A.x, y: 0, w: xs[1] - xs[0], h: EDGE }, { y: b.height - IN, dx: A.x - B.x }, mark(a, { y: A.y }, ...xs));
    }
  }
  return out;
}

// world: data/world/regions.json. defs: a Map from map id to map data (data/maps/). geo: { routes
// (data/world/routes.json), places, rivers, elevation (data/geo/vietnam.json), lands (a Map from the
// land of a region to its data, data/world/land-<region>.json), scatter (data/world/scatter.json),
// villagers (the parts of the villagers, data/figures.json) }.
export function createWorld(world, defs, geo = null) {
  const routes = geo?.routes ? createRoutes(geo.routes, geo.places) : null;
  const regions = new Map(world.regions.map((r) => [r.id, r]));
  const regionOf = new Map();
  for (const r of world.regions) for (const id of r.maps) regionOf.set(id, r.id);
  // The maps with their exits.
  const maps = new Map(defs);
  for (const r of world.regions) {
    const list = r.maps.map((id) => defs.get(id)).filter((m) => m?.window);
    const land = r.land ? geo?.lands?.get(r.land) : null;
    for (const [id, exits] of edgeExits(list, land?.roads)) {
      const m = defs.get(id);
      maps.set(id, { ...m, layers: { ...m.layers, exits: [...(m.layers.exits ?? []), ...exits] } });
    }
  }
  // The generated maps of each region, for the last seeds.
  const built = new Map(); // region id -> Map(seed -> Map(map id -> map))
  function generated(regionId, seed) {
    const r = regions.get(regionId);
    const land = r?.land ? geo?.lands?.get(r.land) : null;
    if (!land || !geo?.elevation) return null;
    const bySeed = built.get(regionId) ?? new Map();
    built.set(regionId, bySeed);
    if (!bySeed.has(seed)) {
      if (bySeed.size >= 2) bySeed.delete(bySeed.keys().next().value);
      bySeed.set(seed, generateRegion(r.maps.map((id) => maps.get(id)), land, geo, geo.scatter ?? {}, seed, geo.villagers ?? null));
    }
    return bySeed.get(seed);
  }

  const exitsOf = (mapId) => maps.get(mapId)?.layers.exits ?? [];
  const inside = (z, x, y) => x >= z.x && y >= z.y && x < z.x + (z.w ?? 1) && y < z.y + (z.h ?? 1);

  // A region is open when it has maps, and its condition (if any) is true.
  function isOpen(regionId, state) {
    const r = regions.get(regionId);
    return Boolean(r && r.maps.length && check(r.when, state));
  }

  // The exit at a tile of a map, or null.
  function exitAt(mapId, tx, ty, state = {}) {
    for (const e of exitsOf(mapId)) {
      if (inside(e, tx, ty) && check(e.when, state)) return e;
    }
    return null;
  }

  // The place where the hero arrives through an exit. The hero at (x, y) on the old map.
  function arrival(exit, x, y) {
    const to = exit.to;
    return {
      map: to.map,
      x: typeof to.x === 'number' ? to.x : x + (to.dx ?? 0),
      y: typeof to.y === 'number' ? to.y : y + (to.dy ?? 0),
    };
  }

  // The first exit on the shortest way from one map to another (through other maps), or null.
  function firstExit(fromMap, toMap) {
    if (fromMap === toMap) return null;
    const seen = new Set([fromMap]);
    const queue = exitsOf(fromMap).map((e) => ({ map: e.to.map, first: e }));
    while (queue.length) {
      const { map, first } = queue.shift();
      if (seen.has(map)) continue;
      seen.add(map);
      if (map === toMap) return first;
      for (const e of exitsOf(map)) queue.push({ map: e.to.map, first });
    }
    return null;
  }

  // The map of a person, an encounter, or an object with this id, or null.
  function whereIs(kind, id) {
    const list = kind === 'npc' ? 'npcs' : kind === 'encounter' ? 'encounters' : null;
    for (const [mapId, m] of maps) {
      const items = list ? m[list] : m.layers.objects;
      if (items?.some((x) => x.id === id)) return mapId;
    }
    return null;
  }

  // The way between two regions, from the place of one to the place of the other, or null.
  function travelWay(from, to) {
    const a = regions.get(from);
    const b = regions.get(to);
    return a && b && routes ? routes.way(a.place, b.place) : null;
  }

  // The travel time between two regions, in hours on the game clock (with the rest at night).
  // Infinity when there is no way.
  function travelHours(from, to) {
    if (from === to) return 0;
    const w = travelWay(from, to);
    return w ? routes.clockHours(w.hours) : Infinity;
  }

  // The home of the hero: the start map and its spawn point.
  const home = () => ({ map: world.start.map, ...maps.get(world.start.map)?.spawn });

  return {
    start: world.start,
    home,
    eraLand: world.eraLand ?? null,
    regions: world.regions,
    region: (id) => regions.get(id) ?? null,
    regionOf: (mapId) => regionOf.get(mapId) ?? null,
    // The text key of the name of the era of a map (the era of its region; the start region for an
    // unknown map). The profile cards and the parent area show it.
    eraOf: (mapId) => regions.get(regionOf.get(mapId) ?? world.start.region).eraKey,
    // A map. With a seed: the whole map, with the land of the seed (ground, height, the scattered
    // things). Without: its definition (the stamps, the people, the exits), with no land.
    map(id, seed = null) {
      const def = maps.get(id);
      if (!def || seed === null || seed === undefined) return def ?? null;
      return generated(regionOf.get(id), seed >>> 0)?.get(id) ?? def;
    },
    isOpen,
    exitAt,
    arrival,
    firstExit,
    whereIs,
    travelWay,
    travelHours,
  };
}
