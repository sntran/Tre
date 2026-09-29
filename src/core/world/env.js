// The facts of a map that the systems read: which cells block, the ground type, the height of
// the ground, the named places, and the homes. They come from the map and never change in a step,
// so they are not state.
import { worldFor } from './move.js';

const WATER = new Set(['water', 'shallow']);

// extra: { places: { name: { x, z } }, homes: { id: { door, base, top } } } in half blocks.
export function envFor(tileMap, extra = {}) {
  const cell = (v) => Math.floor(v / 2);
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
    places: extra.places ?? {},
    homes: extra.homes ?? {},
  };
  return env;
}
