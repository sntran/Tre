// The view of the world: an orthographic camera from above at a fixed elevation, that turns in
// steps of 90 degrees around the hero, with two zoom levels. Pure: the renderer
// (src/render/voxel.js) uses the same numbers, and the budget test uses inView to count what a
// frame draws.

// elevation: the angle of the camera over the ground; zooms: the height of the view in world units
// (near, far) on the phone of REF; lag: how fast the camera follows the hero.
// The near view is close (#83): on a phone of 390 × 844 the hero is about 69 pixels (11 mm) high,
// as Link in the Zelda games with a view from above; the far view comes with a pinch.
export const VIEW = Object.freeze({ elevation: Math.atan(0.5), zooms: [18, 40], lag: 4 });

// The size on the glass (#83): the zooms are for a phone of 390 × 844 points (about 64 × 138 mm).
// On another screen the view shows the world at the same size on the glass, so that the hero is
// about 11 mm high on a small phone and on an iPad too (not huge there). The millimeters of a
// point: about 0.164 on a phone, 0.2 on a tablet or a computer (a screen at least 600 points on
// its short side).
export const REF = Object.freeze({ width: 390, height: 844, mm: 0.164 });
const MIN_VIEW = 10; // world units: the view is never closer than this
const ROOM = 1.04; // the frame of a work is this much bigger than the work
export const mmOf = (width, height) => (Math.min(width, height) < 600 ? REF.mm : 0.2);
// The near view (world units on the phone of REF): one value that the grade of the child or the
// parent sets (#84). It changes only at the start of a game, never during play.
let near = VIEW.zooms[0];
export const nearView = () => near;
export function setNearView(units) {
  if (Number.isFinite(units) && units > 0) near = units;
}

// The size of the view (world units) on a screen of width x height pixels at a zoom level.
// scale: a frame of a work (#83: under 1 is closer than the near view, over 1 is farther).
export function viewSize(width, height, level = 0, scale = 1) {
  const units = level === 0 ? near : VIEW.zooms[level];
  const glass = (height * mmOf(width, height)) / (REF.height * REF.mm);
  const h = Math.max(MIN_VIEW, units * glass) * scale;
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
// The safe part of the view while the talk box is open (#62): the box covers the bottom part of the
// screen of a phone held upright.
export const TALK_SAFE = Object.freeze({ top: 0.16, bottom: 0.38, side: 0.04 });

// Is a box of the world fully in the safe part of the view?
export function inSafe(box, focus, { az = Math.PI / 4, size, safe = SAFE }) {
  const r = screenRect(box, focus, az);
  return r.x0 >= -size.w / 2 + safe.side * size.w && r.x1 <= size.w / 2 - safe.side * size.w && r.y1 <= size.h / 2 - safe.top * size.h && r.y0 >= -size.h / 2 + safe.bottom * size.h;
}

// The box of a person or a thing at a point (world units): a block wide, a person high.
export const figureBox = (p) => ({ x0: p.x - 0.5, x1: p.x + 0.5, y0: p.y, y1: p.y + 1.5, z0: p.z - 0.5, z1: p.z + 0.5 });

// The frame of a work (#83): the focus (blocks) and the height of the view (world units) that show
// all the points as big as they can, fully in the safe part of the screen. points: blocks, the
// hero first; each point is a figure (figureBox). min, max: the limits of the height. lift: the
// middle of the screen is this far over the focus (the renderer looks at the hero 1.5 over the
// ground). When the points do not fit at max, the hero stays fully on the screen and the focus goes
// toward the work.
export function frameWork(points, { az = Math.PI / 4, width, height, safe = SAFE, min = MIN_VIEW, max = 60, lift = 0 }) {
  const e = VIEW.elevation;
  const right = [Math.cos(az), 0, -Math.sin(az)];
  // The rect of the points on the screen (world units from the first point): x to the right, y up.
  const base = points[0];
  const t = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  for (const p of points) {
    const q = screenRect(figureBox(p), base, az);
    t.x0 = Math.min(t.x0, q.x0);
    t.x1 = Math.max(t.x1, q.x1);
    t.y0 = Math.min(t.y0, q.y0);
    t.y1 = Math.max(t.y1, q.y1);
  }
  const aspect = width / height;
  // A little room around the work (ROOM), so that it does not touch the HUD.
  const need = ROOM * Math.max((t.y1 - t.y0) / (1 - safe.top - safe.bottom), (t.x1 - t.x0) / (aspect * (1 - 2 * safe.side)));
  const h = Math.min(max, Math.max(min, need));
  const fits = need <= max;
  // The middle of the screen: the points in the middle of the safe part.
  let cx = (t.x0 + t.x1) / 2;
  let cy = (t.y0 + t.y1) / 2 - ((safe.bottom - safe.top) * h) / 2;
  if (!fits) {
    // The hero stays in the safe part: the middle goes from the hero toward the work as far as it can.
    const hb = screenRect(figureBox(base), base, az);
    const w = h * aspect;
    const lx = [hb.x1 - w / 2 + safe.side * w, hb.x0 + w / 2 - safe.side * w];
    const ly = [hb.y1 - h / 2 + safe.top * h, hb.y0 + h / 2 - safe.bottom * h];
    cx = Math.max(lx[0], Math.min(lx[1], cx));
    cy = Math.max(ly[0], Math.min(ly[1], cy));
  }
  // From the screen back to the ground: a step to the right is a step on the ground; a step up on
  // the screen is a step away from the camera on the ground, longer by 1 / sin(elevation).
  const away = [-Math.sin(az), 0, -Math.cos(az)];
  const k = (cy - lift * Math.cos(e)) / Math.sin(e);
  const focus = { x: base.x + right[0] * cx + away[0] * k, y: base.y, z: base.z + right[2] * cx + away[2] * k };
  return { focus, h, fits };
}
