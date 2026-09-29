// The world of regions and maps. Pure functions, no DOM.
// A region has maps. A map has exits: when the hero walks into an exit, the hero goes to
// another map. The links are the roads between regions on the country map.
import { check } from '../core/conditions.js';

// world: data/world/regions.json. maps: a Map from map id to map data.
export function createWorld(world, maps) {
  const regions = new Map(world.regions.map((r) => [r.id, r]));
  const regionOf = new Map();
  for (const r of world.regions) for (const id of r.maps) regionOf.set(id, r.id);

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

  // The travel time in game hours between two regions, on the roads (links). Infinity when no road.
  function travelHours(from, to) {
    if (from === to) return 0;
    const dist = new Map([[from, 0]]);
    const open = [from];
    while (open.length) {
      open.sort((a, b) => dist.get(a) - dist.get(b));
      const r = open.shift();
      for (const [a, b, hours] of world.links) {
        const next = a === r ? b : b === r ? a : null;
        if (!next) continue;
        const d = dist.get(r) + hours;
        if (d < (dist.get(next) ?? Infinity)) {
          dist.set(next, d);
          open.push(next);
        }
      }
    }
    return dist.get(to) ?? Infinity;
  }

  // The home of the hero: the start map and its spawn point.
  const home = () => ({ map: world.start.map, ...maps.get(world.start.map)?.spawn });

  return {
    start: world.start,
    home,
    regions: world.regions,
    region: (id) => regions.get(id) ?? null,
    regionOf: (mapId) => regionOf.get(mapId) ?? null,
    map: (id) => maps.get(id) ?? null,
    isOpen,
    exitAt,
    arrival,
    firstExit,
    whereIs,
    travelHours,
  };
}
