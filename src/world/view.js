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

// The rect of a box of the world (x0, x1, y0, y1, z0, z1) on the screen of a camera that looks at
// the focus (x, y, z) from the angle az, in world units from the middle of the screen (y up).
function screenRect(box, focus, az) {
  const e = VIEW.elevation;
  // The direction to the camera, the right of the screen, and the up of the screen.
  const d = [Math.cos(e) * Math.sin(az), Math.sin(e), Math.cos(e) * Math.cos(az)];
  const right = [Math.cos(az), 0, -Math.sin(az)];
  const up = [d[1] * right[2] - d[2] * right[1], d[2] * right[0] - d[0] * right[2], d[0] * right[1] - d[1] * right[0]];
  const r = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  for (const x of [box.x0, box.x1]) for (const y of [box.y0, box.y1]) for (const z of [box.z0, box.z1]) {
    const p = [x - focus.x, y - focus.y, z - focus.z];
    const sx = p[0] * right[0] + p[1] * right[1] + p[2] * right[2];
    const sy = p[0] * up[0] + p[1] * up[1] + p[2] * up[2];
    r.x0 = Math.min(r.x0, sx);
    r.x1 = Math.max(r.x1, sx);
    r.y0 = Math.min(r.y0, sy);
    r.y1 = Math.max(r.y1, sy);
  }
  return r;
}

// Is a box of the world (x0, x1, y0, y1, z0, z1) in the view of a camera that looks at the focus
// (x, y, z) from the angle az? size: from viewSize. A box at the edge is in the view.
export function inView(box, focus, { az = Math.PI / 4, size }) {
  const r = screenRect(box, focus, az);
  return r.x1 >= -size.w / 2 && r.x0 <= size.w / 2 && r.y1 >= -size.h / 2 && r.y0 <= size.h / 2;
}

// The part of the screen that the HUD and the buttons do not cover (parts of the height and the
// width of the view): the quest bar at the top, the stick and the buttons at the bottom (#44).
export const SAFE = Object.freeze({ top: 0.16, bottom: 0.2, side: 0.04 });

// Is a box of the world fully in the safe part of the view?
export function inSafe(box, focus, { az = Math.PI / 4, size, safe = SAFE }) {
  const r = screenRect(box, focus, az);
  return r.x0 >= -size.w / 2 + safe.side * size.w && r.x1 <= size.w / 2 - safe.side * size.w && r.y1 <= size.h / 2 - safe.top * size.h && r.y0 >= -size.h / 2 + safe.bottom * size.h;
}

// The box of a person or a thing at a point (world units): a block wide, a person high.
export const figureBox = (p) => ({ x0: p.x - 0.5, x1: p.x + 0.5, y0: p.y, y1: p.y + 1.5, z0: p.z - 0.5, z1: p.z + 0.5 });

// The focus of the camera at a task (#44): the middle of the hero and the places of the work, so
// that the person, the heap, and the places are on the screen of a phone held upright. points:
// world units (blocks) with the hero first. Returns { focus, level, fits }: the zoom level is the
// near one when all the points fit there, else the far one. A point fits when it is fully in the
// safe part of the screen (SAFE). When the work does not fit, the hero stays on the screen.
export function leadFocus(points, { az = Math.PI / 4, width, height }) {
  const lo = { x: Infinity, y: Infinity, z: Infinity };
  const hi = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of points) {
    for (const k of ['x', 'y', 'z']) {
      lo[k] = Math.min(lo[k], p[k]);
      hi[k] = Math.max(hi[k], p[k]);
    }
  }
  const mid = { x: (lo.x + hi.x) / 2, y: (lo.y + hi.y) / 2, z: (lo.z + hi.z) / 2 };
  const fitsAt = (focus, level) => points.every((p) => inSafe(figureBox(p), focus, { az, size: viewSize(width, height, level) }));
  const level = fitsAt(mid, 0) ? 0 : VIEW.zooms.length - 1;
  const fits = fitsAt(mid, level);
  if (fits) return { focus: mid, level, fits };
  // The work does not fit: the hero (the first point) stays fully on the screen, and the focus goes
  // from the hero toward the work as far as it can.
  const hero = points[0];
  const size = viewSize(width, height, level);
  const at = (t) => ({ x: hero.x + (mid.x - hero.x) * t, y: hero.y + (mid.y - hero.y) * t, z: hero.z + (mid.z - hero.z) * t });
  let a = 0;
  let b = 1;
  for (let k = 0; k < 12; k++) {
    const t = (a + b) / 2;
    if (inSafe(figureBox(hero), at(t), { az, size })) a = t;
    else b = t;
  }
  return { focus: at(a), level, fits };
}
