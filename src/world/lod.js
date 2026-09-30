// The level of detail and the culling of the figures (people and animals). Pure: the renderer
// (src/render/figure3d.js) gives the distances and the planes of the view.

// A figure far from the hero draws its coarse version (src/world/figures.js); nearer, its fine
// version (src/world/fine.js). The line follows the zoom of the camera: about 30 blocks at the near
// zoom and 45 at the far zoom. Between near and far, a figure keeps the level it has, so that
// nothing pops back and forth at the edge.
export const LINES = Object.freeze([30, 45]);
export const LOD = Object.freeze({ near: 29, far: 31 });

// The near and far distances at a zoom level of the camera (0: near, 1: far).
export function lodFor(level = 0) {
  const line = LINES[Math.max(0, Math.min(LINES.length - 1, level))];
  return { near: line - 1, far: line + 1 };
}

// The level of a figure now: prev (the level before, or null), dist (blocks from the hero).
export function detailFor(prev, dist, lod = LOD) {
  if (dist <= lod.near) return 'fine';
  if (dist >= lod.far) return 'coarse';
  return prev ?? 'fine';
}

// Is a ball (center c, radius r, in blocks) in the view? planes: the six planes of the view, each
// { nx, ny, nz, d } with the normal to the inside (a point p is inside when n·p + d >= 0).
export function inView(planes, c, r) {
  for (const p of planes) if (p.nx * c.x + p.ny * c.y + p.nz * c.z + p.d < -r) return false;
  return true;
}
