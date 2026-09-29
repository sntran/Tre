// The facts of a map that the systems read: which cells block, the ground type, and the height of
// the ground. They come from the tile map and never change in a step, so they are not state.
import { worldFor } from './move.js';

export function envFor(tileMap) {
  return {
    // The world as a body at the map point (x, y) sees it (a cliff blocks too).
    near: (x, y) => worldFor(tileMap, x, y),
    // The top of the ground of a cell, in half blocks (the height digit + 1, in blocks).
    groundY: (x, y) => (tileMap.inside(Math.floor(x), Math.floor(y)) ? (tileMap.heightAt(Math.floor(x), Math.floor(y)) + 1) * 2 : 2),
    isBlocked: (tx, ty) => tileMap.isBlocked(tx, ty),
  };
}
