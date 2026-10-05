// The world of regions on one plane. Pure functions, no DOM.
// The whole country is one plane of cells (src/core/gen/plane.js). A region is a named area of the
// plane with its story places: each place is the frame of a map file (data/maps/), at its real place
// on the plane. The game walks one map for a region: the plane, with the stamps and the story data of
// all its places in plane cells, and the land of the seed around them (src/core/gen/tiles.js),
// made tile by tile when the hero comes near. Regions with no places are areas of the country map
// only. The links between regions are the roads on the country map.
import { check } from '../core/conditions.js';
import { createRoutes } from './travel.js';
import { createLandPlane, LETTER, TILE } from '../core/gen/tiles.js';
import { createPlane, frameOrigins } from '../core/gen/plane.js';
import { thingsOf } from '../core/origins.js';

// The size of the plane (cells): an index of a cell is y * PLANE_SIZE + x.
export const PLANE_SIZE = 65536;

// world: data/world/regions.json. defs: a Map from map id to map data (data/maps/). geo: { routes
// (data/world/routes.json), places, rivers, land (data/geo/vietnam.json), heights (the fine heights,
// src/core/gen/heights.js), lands (a Map from the land of a region to its data,
// data/world/land-<region>.json), scatter (data/world/scatter.json), villagers (the parts of the
// villagers, data/figures.json) }.
export function createWorld(world, defs, geo = null) {
  const routes = geo?.routes ? createRoutes(geo.routes, geo.places) : null;
  const regions = new Map(world.regions.map((r) => [r.id, r]));
  // The region of each place (map file), and of each region map.
  const regionOf = new Map();
  for (const r of world.regions) {
    for (const id of r.maps) regionOf.set(id, r.id);
    if (r.maps.length) regionOf.set(r.id, r.id);
  }
  const startRegion = world.start.region;
  const landOf = (r) => (r?.land ? geo?.lands?.get(r.land) ?? null : null);
  // The line of the land of the era of a region (eraLand of its chapter, degrees).
  const eraLine = (r) => world.eraLand?.byChapter?.[String(r.chapter)] ?? null;

  // The frames of the places of a region on the plane (made from the land file only, with no land).
  const framesOf = new Map();
  function frames(regionId) {
    if (!framesOf.has(regionId)) {
      const def = landOf(regions.get(regionId));
      framesOf.set(regionId, def ? frameOrigins(createPlane(def.plane), def.frames ?? []) : new Map());
    }
    return framesOf.get(regionId);
  }
  // A point in the frame of a place: [place, x, y] -> [x, y] on the plane.
  function at(place, x, y) {
    const o = frames(regionOf.get(place))?.get(place);
    return o ? [x + o[0], y + o[1]] : [x, y];
  }

  // The map of a region: the story data of all its places in plane cells. An id that two places
  // use (a tree, a sign) gets the id of its place in front ('soc-son:tree1') in the later place.
  const built = new Map();
  function regionMap(regionId) {
    if (built.has(regionId)) return built.get(regionId);
    const r = regions.get(regionId);
    if (!r?.maps.length) return null;
    const places = r.maps.map((id) => defs.get(id)).filter(Boolean);
    const used = new Map(); // kind -> Set of ids
    const uniq = (kind, place, id) => {
      if (!used.has(kind)) used.set(kind, new Set());
      const set = used.get(kind);
      const out = set.has(id) ? `${place}:${id}` : id;
      set.add(out);
      return out;
    };
    const layers = { objects: [], collision: [], zones: [], triggers: [], places: {}, life: [], paths: {}, spots: {}, ferries: [] };
    const npcs = [];
    const encounters = [];
    const legend = {};
    const spotsByPlace = {}; // the spots of the small events of each place
    for (const p of places) {
      const [ox, oy] = frames(regionId).get(p.id) ?? [0, 0];
      const move = (q) => ({ ...q, x: Math.round((q.x + ox) * 1000) / 1000, y: Math.round((q.y + oy) * 1000) / 1000 });
      Object.assign(legend, p.legend);
      const L = p.layers;
      L.objects.forEach((o) => layers.objects.push({ ...move(o), id: uniq('object', p.id, o.id), place: p.id }));
      for (const c of L.collision ?? []) layers.collision.push(move(c));
      for (const z of L.zones ?? []) layers.zones.push({ ...move(z), id: uniq('zone', p.id, z.id) });
      for (const t of L.triggers ?? []) {
        const n = { ...move(t), id: uniq('trigger', p.id, t.id), place: p.id };
        if (t.action?.move) n.action = { ...t.action, move: move(t.action.move) };
        layers.triggers.push(n);
      }
      for (const f of L.ferries ?? []) layers.ferries.push({ id: uniq('ferry', p.id, f.id), a: move(f.a), b: move(f.b), landA: move(f.landA), landB: move(f.landB) });
      for (const [name, q] of Object.entries(L.places ?? {})) layers.places[uniq('place', p.id, name)] = move(q);
      (L.life ?? []).forEach((g, i) => layers.life.push({ ...move(g), place: p.id, index: i }));
      for (const [name, line] of Object.entries(L.paths ?? {})) layers.paths[uniq('path', p.id, name)] = line.map(([x, y]) => [x + ox, y + oy]);
      spotsByPlace[p.id] = {};
      for (const [kind, list] of Object.entries(L.spots ?? {})) {
        (layers.spots[kind] ??= []).push(...list.map(([x, y]) => [x + ox, y + oy]));
        spotsByPlace[p.id][kind] = list.map(([x, y]) => [x + ox, y + oy]);
      }
      for (const n of p.npcs ?? []) npcs.push({ ...move(n), place: p.id });
      for (const e of p.encounters ?? []) encounters.push({ ...move(e), place: p.id });
    }
    for (const [type, ch] of Object.entries(LETTER)) legend[ch] ??= type;
    const start = places.find((p) => p.id === (r.id === startRegion ? world.start.place : r.maps[0])) ?? places[0];
    const [sx, sy] = frames(regionId).get(start.id) ?? [0, 0];
    const out = {
      id: regionId,
      region: regionId,
      plane: true,
      nameKey: r.nameKey,
      // The year of the time of the region, and the things of the data that are in the world then
      // (data/world/origins.json, #39): no corn under the eaves in the time of the Hùng Kings.
      year: r.year ?? null,
      things: thingsOf(geo?.origins, r.year ?? null),
      width: PLANE_SIZE,
      height: PLANE_SIZE,
      legend,
      spawn: { x: start.spawn.x + sx, y: start.spawn.y + sy },
      places: places.map((p) => p.id),
      frames: frames(regionId),
      layers,
      spotsByPlace,
      npcs,
      encounters,
    };
    built.set(regionId, out);
    return out;
  }

  // The land of a region for a seed (the last seeds stay: geo.seeds, two in the game; the land of a
  // seed is pure, so that the tests keep more).
  const lands = new Map(); // region id -> Map(seed -> map)
  function withLand(regionId, seed) {
    const base = regionMap(regionId);
    if (!base || !geo?.heights) return base;
    const bySeed = lands.get(regionId) ?? new Map();
    lands.set(regionId, bySeed);
    if (!bySeed.has(seed)) {
      if (bySeed.size >= (geo.seeds ?? 2)) bySeed.delete(bySeed.keys().next().value);
      const r = regions.get(regionId);
      const def = { ...landOf(r), eraLand: eraLine(r) ?? undefined };
      const places = r.maps.map((id) => defs.get(id)).filter(Boolean);
      const land = createLandPlane(def, places, { rivers: geo.rivers, land: geo.land, heights: geo.heights }, seed, geo.scatter ?? {}, geo.villagers ?? null);
      bySeed.set(seed, planeMap(base, land, def, seed));
    }
    return bySeed.get(seed);
  }

  // A map with its land: the stamped objects by tile (for the objects near a box), and the tiles of
  // the land when they can be made (their height tiles are there).
  function planeMap(base, land, def, seed) {
    const byTile = new Map();
    base.layers.objects.forEach((o, i) => {
      for (let tz = Math.floor(o.y / TILE); tz <= Math.floor((o.y + o.h - 1) / TILE); tz++) {
        for (let tx = Math.floor(o.x / TILE); tx <= Math.floor((o.x + o.w - 1) / TILE); tx++) {
          const k = `${tx},${tz}`;
          if (!byTile.has(k)) byTile.set(k, []);
          byTile.get(k).push(i);
        }
      }
    });
    const ready = (tx, tz) => land.has(tx, tz) || land.needs(tx, tz).every((n) => geo.heights.has?.(n) ?? true);
    return {
      ...base,
      seed,
      // The key of the map and its seed (a cache of a terrain keeps one for each key).
      key: `${base.id}:${seed}`,
      land,
      // What makes the land (for a worker that makes the same tiles: src/ui/gen-worker.js).
      source: { def, places: regions.get(base.region).maps.map((id) => defs.get(id)).filter(Boolean), seed },
      mist: def.mist ?? { fade: 12, walk: 4 },
      // The looks of the villagers of the generated hamlets (by id), when their tile is made.
      looks: {},
      ready,
      // The objects whose cells are in a box (x1 and y1 not included), in one fixed order: the
      // stamped objects first, then the objects of the tiles. order: [group, ...] for that order.
      objectsNear(x0, y0, x1, y1) {
        const out = [];
        const seen = new Set();
        const meets = (o) => o.x < x1 && o.y < y1 && o.x + o.w > x0 && o.y + o.h > y0;
        for (let tz = Math.floor(y0 / TILE); tz <= Math.floor((y1 - 1) / TILE); tz++) {
          for (let tx = Math.floor(x0 / TILE); tx <= Math.floor((x1 - 1) / TILE); tx++) {
            for (const i of byTile.get(`${tx},${tz}`) ?? []) {
              if (seen.has(i) || !meets(base.layers.objects[i])) continue;
              seen.add(i);
              out.push({ ...base.layers.objects[i], order: [0, i] });
            }
          }
        }
        // The objects of a tile lie in it, or over its edge by a few cells (the tiles around).
        for (let tz = Math.floor((y0 - 8) / TILE); tz <= Math.floor((y1 - 1) / TILE); tz++) {
          for (let tx = Math.floor((x0 - 8) / TILE); tx <= Math.floor((x1 - 1) / TILE); tx++) {
            if (!ready(tx, tz)) continue;
            land.tile(tx, tz).objects.forEach((o, i) => {
              if (meets(o)) out.push({ ...o, order: [1, tz, tx, i] });
            });
          }
        }
        return out.sort(byOrder);
      },
    };
  }

  // A region is open when it has maps, and its condition (if any) is true.
  function isOpen(regionId, state) {
    const r = regions.get(regionId);
    return Boolean(r && r.maps.length && check(r.when, state));
  }

  // The map of a person, an encounter, or an object with this id, or null.
  function whereIs(kind, id) {
    const list = kind === 'npc' ? 'npcs' : kind === 'encounter' ? 'encounters' : null;
    for (const r of world.regions) {
      const m = r.maps.length ? regionMap(r.id) : null;
      const items = m ? (list ? m[list] : m.layers.objects) : null;
      if (items?.some((x) => x.id === id)) return r.id;
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

  // The place where the hero arrives in a region after a travel: { map, x, y } on the plane.
  function entryOf(regionId) {
    const r = regions.get(regionId);
    if (!r?.entry) return null;
    const [x, y] = at(...r.entry.at);
    return { map: regionId, x, y };
  }

  // The home of the hero: the start map and its spawn point.
  const home = () => ({ map: startRegion, ...regionMap(startRegion)?.spawn });

  return {
    start: { ...world.start, map: startRegion },
    home,
    eraLand: world.eraLand ?? null,
    regions: world.regions,
    region: (id) => regions.get(id) ?? null,
    regionOf: (mapId) => regionOf.get(mapId) ?? null,
    // The text key of the name of the era of a map (the era of its region; the start region for an
    // unknown map). The profile cards and the parent area show it.
    eraOf: (mapId) => regions.get(regionOf.get(mapId) ?? startRegion).eraKey,
    // A map (the id of a region, or of one of its places). With a seed: the whole map, with the land
    // of the seed. Without: the stamps and the story data, with no land.
    map(id, seed = null) {
      const regionId = regionOf.get(id);
      if (!regionId) return null;
      if (seed === null || seed === undefined) return regionMap(regionId);
      return withLand(regionId, seed >>> 0);
    },
    // A point in the frame of a place, on the plane: at('phu-dong', x, y) -> [x, y].
    at,
    // The real place ([longitude, latitude]) of a cell of the plane of a map, or null.
    geoAt(mapId, x, y) {
      const def = landOf(regions.get(regionOf.get(mapId)));
      return def ? createPlane(def.plane).toGeo([x, y]) : null;
    },
    entryOf,
    isOpen,
    whereIs,
    travelWay,
    travelHours,
  };
}

const byOrder = (a, b) => {
  for (let k = 0; k < Math.max(a.order.length, b.order.length); k++) {
    const d = (a.order[k] ?? -1) - (b.order[k] ?? -1);
    if (d) return d;
  }
  return 0;
};
