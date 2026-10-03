// The worker that makes the land of the plane, tile by tile (src/core/gen/tiles.js), so that a new
// tile never stops a frame of the game. The game sends what makes the land (init), the height tiles
// when they come (heights), and the tiles to make (tile); the worker sends each tile back, the same
// tile as the game would make (the generator is pure).
import { createLandPlane } from '../core/gen/tiles.js';
import { createHeights, parseHeightTile } from '../core/gen/heights.js';

let land = null;
let heights = null;

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    heights = createHeights((m.heights ?? []).map(parseHeightTile));
    land = createLandPlane(m.def, m.places, { rivers: m.rivers, land: m.land, heights }, m.seed, m.rules, m.parts);
    return;
  }
  if (m.type === 'heights') {
    for (const bytes of m.tiles) heights.add(parseHeightTile(bytes));
    return;
  }
  if (m.type === 'tile' && land) {
    const t = land.tile(m.tx, m.tz);
    const buffers = ['letter', 'level', 'fixed', 'water', 'road', 'field', 'nearStamp', 'mist'].map((k) => t[k].buffer);
    // The arrays go to the game (the worker makes them again if it needs them).
    self.postMessage({ type: 'tile', key: m.key, tile: t }, buffers);
    land.forget?.(m.tx, m.tz);
  }
};
