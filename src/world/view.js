// The view of the world: an orthographic camera from above at a fixed elevation, that turns in
// steps of 90 degrees around the hero, with two zoom levels. Pure: the renderer
// (src/render/voxel.js) uses the same numbers, and the budget test uses inView to count what a
// frame draws.

// elevation: the angle of the camera over the ground; zooms: the height of the view in world units
// (near, far); lag: how fast the camera follows the hero.
export const VIEW = Object.freeze({ elevation: Math.atan(0.5), zooms: [26, 40], lag: 4 });

// The size of the view (world units) on a screen of width x height pixels at a zoom level. A phone
// shows a little more of the world than an iPad.
export function viewSize(width, height, level = 0) {
  const h = VIEW.zooms[level] * (height < 500 ? 1.15 : 1);
  return { w: h * (width / height), h };
}

// Is a box of the world (x0, x1, y0, y1, z0, z1) in the view of a camera that looks at the focus
// (x, y, z) from the angle az? size: from viewSize.
export function inView(box, focus, { az = Math.PI / 4, size }) {
  const e = VIEW.elevation;
  // The direction to the camera, the right of the screen, and the up of the screen.
  const d = [Math.cos(e) * Math.sin(az), Math.sin(e), Math.cos(e) * Math.cos(az)];
  const right = [Math.cos(az), 0, -Math.sin(az)];
  const up = [d[1] * right[2] - d[2] * right[1], d[2] * right[0] - d[0] * right[2], d[0] * right[1] - d[1] * right[0]];
  let sx0 = Infinity;
  let sx1 = -Infinity;
  let sy0 = Infinity;
  let sy1 = -Infinity;
  for (const x of [box.x0, box.x1]) for (const y of [box.y0, box.y1]) for (const z of [box.z0, box.z1]) {
    const p = [x - focus.x, y - focus.y, z - focus.z];
    const sx = p[0] * right[0] + p[1] * right[1] + p[2] * right[2];
    const sy = p[0] * up[0] + p[1] * up[1] + p[2] * up[2];
    sx0 = Math.min(sx0, sx);
    sx1 = Math.max(sx1, sx);
    sy0 = Math.min(sy0, sy);
    sy1 = Math.max(sy1, sy);
  }
  return sx1 >= -size.w / 2 && sx0 <= size.w / 2 && sy1 >= -size.h / 2 && sy0 <= size.h / 2;
}
