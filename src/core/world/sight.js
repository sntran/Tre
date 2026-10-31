// The figures in the line of sight (#146, #147): pure rules, no WebGL. A figure is a box on the
// ground (a radius and a height in blocks). It hides a point when the line from the point to the
// camera goes through the box (the ray test of src/world/fade.js). Points and figures are in half
// blocks (x, y at the ground, z), as the entities of the world.
import { rayHits, toCamera } from '../../world/fade.js';
import { VIEW } from '../../world/view.js';

export const ELEVATION = VIEW.elevation;

// The size of a figure: r (blocks, half the width) and h (blocks, the height).
export const FIGURES = Object.freeze({
  // Gióng on his iron horse: the seat is 2 blocks over the ground, and the horse is about three
  // blocks long.
  rider: { r: 1.6, h: 4.2 },
  person: { r: 0.55, h: 2 },
  nghe: { r: 1, h: 1.6 },
});
// The heights over the ground of a point of the work (a thing on the ground, and the body of a
// person), and of the hero (the feet, the body, and the head).
export const THING_HEIGHTS = [0.3, 1.2];
export const HERO_HEIGHTS = [0.4, 1.2, 2.2];

// The box of a figure of size f at q (world units: blocks).
export function figureBox(q, f) {
  const x = q.x / 2;
  const z = q.z / 2;
  const y = (q.y ?? 0) / 2;
  return { x0: x - f.r, x1: x + f.r, y0: y, y1: y + f.h, z0: z - f.r, z1: z + f.r };
}

// Does the box hide the point p (heights over the ground of p) from the camera at az?
export function hides(box, p, az, elevation, heights = THING_HEIGHTS) {
  const d = toCamera(az, elevation);
  return heights.some((h) => rayHits(box, { x: p.x / 2, y: (p.y ?? 0) / 2 + h, z: p.z / 2 }, d));
}

// Is a figure of size f at q clear of the points (no point behind it, and no point in its body)?
// points: [{ x, z, y, heights }].
export function clearOf(q, f, points, az, elevation) {
  const box = figureBox(q, f);
  return !points.some((p) => hides(box, p, az, elevation, p.heights ?? THING_HEIGHTS));
}

// The spot for a figure of size f near the hero: the first free spot of the candidates, in the
// order of `prefer` (a spot near it first). candidates: [{ x, z, y }]; free(q): the ground there is
// open; points: what the figure must not hide. Return null when no spot is free.
export function clearSpot(candidates, f, points, az, elevation, free, prefer) {
  const list = candidates
    .filter((q) => free(q))
    .sort((a, b) => Math.hypot(a.x - prefer.x, a.z - prefer.z) - Math.hypot(b.x - prefer.x, b.z - prefer.z));
  return list.find((q) => clearOf(q, f, points, az, elevation)) ?? null;
}

// The candidate spots on rings around a point (half blocks).
export function ringSpots(c, radii, n = 16) {
  const out = [];
  for (const r of radii) for (let i = 0; i < n; i++) out.push({ x: c.x + Math.sin((i / n) * Math.PI * 2) * r, z: c.z + Math.cos((i / n) * Math.PI * 2) * r });
  return out;
}

// The figures in front of the work (#147: "I am standing on the iron, I can not see if it is red!
// My body is in the way."): each figure whose box hides a point of the work from the camera draws
// pale and see-through while the point is a point of the work. A point in the body of the figure
// is the figure itself (the person of the task, the hero), not a thing behind it. figs: [{ id,
// position, size }]; points: [{ x, y, z }] (half blocks). Return the ids.
export function seeThrough(figs, points, az, elevation) {
  const out = new Set();
  for (const f of figs) {
    const box = figureBox(f.position, f.size);
    const r = f.size.r * 2 + 0.6;
    const behind = points.filter((p) => Math.hypot(p.x - f.position.x, p.z - f.position.z) > r);
    if (behind.some((p) => hides(box, p, az, elevation))) out.add(f.id);
  }
  return out;
}
// The size of the figure of an entity: Gióng on his horse (and a horse), Nghé, or a person or an
// animal. Null for a thing that is not a figure (the things of a task, the marks).
export function sizeOf(e) {
  if (!e.position || !e.look || e.hidden || e.item || e.zone) return null;
  if (e.riding && typeof e.riding === 'number') return FIGURES.rider;
  if (String(e.id).startsWith('mount:') || String(e.id).startsWith('steed:')) return FIGURES.rider;
  if (e.follow) return FIGURES.nghe;
  if (e.person || e.id === 'hero' || e.motion || String(e.id).startsWith('companion:')) return FIGURES.person;
  return null;
}
