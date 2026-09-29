// The facts of a map that the systems read: which cells block, the ground type, the height of
// the ground, the named places, and the homes. They come from the map and never change in a step,
// so they are not state. Only the collision of some cells changes in play (a ford under a high
// river, the deck of a bridge): the ground system sets it from the state in each step (see
// block), so it is not state either.
import { worldFor } from './move.js';
import { findPath } from '../tilemap.js';

const WATER = new Set(['water', 'shallow', 'field']); // a paddy is still water too

// The named places of a map (layers.places, in map cells) on the half-block grid, with the
// height of each (the ground and h over it).
export function placesOf(map, tileMap) {
  const out = {};
  for (const [name, p] of Object.entries(map.layers.places ?? {})) {
    out[name] = { x: p.x * 2, z: p.y * 2, y: (tileMap.heightAt(Math.floor(p.x), Math.floor(p.y)) + 1) * 2 + (p.h ?? 0) };
  }
  return out;
}

// extra: { places: { name: { x, y, z } }, homes: { id: { base, top, door } } } in half blocks,
// day (data/world/day.json), and zones (the kinds of placement zones, data/world/zones.json).
export function envFor(tileMap, extra = {}) {
  const cell = (v) => Math.floor(v / 2);
  // The tile map for walks of the world: only the ground and the objects block.
  const ground = { width: tileMap.width, inside: tileMap.inside, walkable: (x, y) => tileMap.inside(x, y) && !tileMap.isBlocked(x, y), canStep: tileMap.canStep };
  const base = new Map(); // cell index -> the collision of the map, for the cells that changed
  // The cells of the fords (shallow water that people walk through).
  const fords = [];
  for (let y = 0; y < tileMap.height; y++) for (let x = 0; x < tileMap.width; x++) if (tileMap.groundAt(x, y) === 'shallow') fords.push({ x, y });
  const env = {
    // The world as a body at the map point (x, y) sees it (a cliff blocks too).
    near: (x, y) => worldFor(tileMap, x, y),
    // The top of the ground of a cell, in half blocks (the height digit + 1, in blocks).
    groundY: (x, y) => (tileMap.inside(Math.floor(x), Math.floor(y)) ? (tileMap.heightAt(Math.floor(x), Math.floor(y)) + 1) * 2 : 2),
    isBlocked: (tx, ty) => tileMap.isBlocked(tx, ty),
    // The ground type under a point on the half-block grid.
    groundAt: (x, z) => tileMap.groundAt(cell(x), cell(z)),
    width: tileMap.width * 2,
    height: tileMap.height * 2,
    // Can a thing that walks, swims, or flies go from one point to the next (half blocks)?
    canEnter(medium, from, to) {
      const tx = cell(to.x);
      const tz = cell(to.z);
      if (!tileMap.inside(tx, tz)) return false;
      if (medium === 'air') return true;
      if (medium === 'water') return WATER.has(tileMap.groundAt(tx, tz));
      return !worldFor(tileMap, from.x / 2, from.z / 2).isBlocked(tx, tz);
    },
    // A walk on land from one point to another (half blocks), around houses, water, and cliffs:
    // the middle points of the cells on the way, or null. People do not block this way.
    path(from, to) {
      const a = { x: cell(from.x), y: cell(from.z) };
      const b = { x: cell(to.x), y: cell(to.z) };
      const cells = findPath(ground, a, b, { maxNodes: 20000 });
      return cells ? cells.map((c) => ({ x: c.x * 2 + 1, z: c.y * 2 + 1 })) : null;
    },
    // The edge of the water next to the nearest bank, for a swimmer at (x, z) (half blocks).
    bankNear(x, z) {
      const isWater = (q) => env.canEnter('water', q, q);
      const isLand = (q) => env.canEnter('land', q, q) && !isWater(q);
      for (let r = 0; r < 20; r += 0.5) {
        for (let a = 0; a < 16; a++) {
          const q = { x: x + Math.cos((a / 16) * Math.PI * 2) * r, z: z + Math.sin((a / 16) * Math.PI * 2) * r };
          if (!isWater(q)) continue;
          for (let b = 0; b < 8; b++) {
            if (isLand({ x: q.x + Math.cos((b / 8) * Math.PI * 2) * 1.2, z: q.z + Math.sin((b / 8) * Math.PI * 2) * 1.2 })) return q;
          }
        }
      }
      return { x, z };
    },
    // Change the collision of a cell in play: true blocks it, false opens it, and null gives the
    // collision of the map back.
    block(tx, ty, on) {
      if (!tileMap.inside(tx, ty)) return;
      const i = ty * tileMap.width + tx;
      if (!base.has(i)) base.set(i, tileMap.isBlocked(tx, ty));
      tileMap.setSolid(tx, ty, on === null ? base.get(i) : on);
    },
    fords,
    places: extra.places ?? {},
    homes: extra.homes ?? {},
    day: extra.day ?? null,
    zones: extra.zones ?? {},
  };
  return env;
}
