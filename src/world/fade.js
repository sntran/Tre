// The fade of the things in front of the hero: pure rules, no WebGL. The renderer
// (src/render/voxel.js) keeps one fade for each object of the terrain and draws it as a stipple.
// A thing fades when the line of sight from the hero to the camera goes through its blocks (#53:
// not only through its box); it comes back when the line leaves it. The fade snaps to exactly 0 and 1 at the ends, so that a thing that was
// in front once keeps no dots.

// Under this fade a thing draws whole: an object that only touches the edge of the line of sight
// gets no light scatter of dots.
export const FADE_MIN = 0.3;
// The look of a full fade (#53): the part of the dots of the faces that goes (the rest stays, a
// soft see-through shape), and the part of the outline that goes (no hard lines of wire).
export const FADE_HOLES = 0.6;
export const FADE_OUTLINE = 0.65;
const SPEED = 8; // a fade goes most of the way in about one eighth of a second
const SNAP = 0.02;

// The direction from the target to the camera, for the turn of the camera (az) and its elevation.
export const toCamera = (az, elevation) => ({ x: Math.cos(elevation) * Math.sin(az), y: Math.sin(elevation), z: Math.cos(elevation) * Math.cos(az) });

// Does the ray from o in the direction d cross the box b (world units)? From 0.3 to 80 units, so
// that a thing at the feet of the hero does not count.
export function rayHits(b, o, d) {
  let t0 = 0.3;
  let t1 = 80;
  for (const [lo, hi, oo, dd] of [[b.x0, b.x1, o.x, d.x], [b.y0, b.y1, o.y, d.y], [b.z0, b.z1, o.z, d.z]]) {
    if (Math.abs(dd) < 1e-9) {
      if (oo < lo || oo > hi) return false;
      continue;
    }
    let a = (lo - oo) / dd;
    let c = (hi - oo) / dd;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, c);
    if (t0 > t1) return false;
  }
  return true;
}

// The points of the hero that the camera must see: the feet, the head, and the two sides (so that
// a thing near the line of sight fades too). hero: { x, y, z } (world units, y at the feet).
export function heroPoints(hero, az) {
  const rx = Math.cos(az) * 0.9;
  const rz = -Math.sin(az) * 0.9;
  return [
    { x: hero.x, y: hero.y + 0.4, z: hero.z },
    { x: hero.x, y: hero.y + 2.4, z: hero.z },
    { x: hero.x + rx, y: hero.y + 1.2, z: hero.z + rz },
    { x: hero.x - rx, y: hero.y + 1.2, z: hero.z - rz },
  ];
}

// Is a box in front of the hero (the line of sight from one of its points crosses the box)?
export function inFront(box, hero, az, elevation) {
  const d = toCamera(az, elevation);
  return heroPoints(hero, az).some((p) => rayHits(box, p, d));
}

// Does a building hide the hero: does the line of sight from the feet, the body, or the head of
// the hero to the camera go through a block or the roof of the building (not only through its box,
// which takes the air around a roof and the yard, #53)? hits(x, y, z): is a point (world units) in
// the building. A sample each quarter of a unit, in the box.
const SIGHT = [0.4, 1.2, 2.2];
export function hidesHero(box, hero, az, elevation, hits) {
  const d = toCamera(az, elevation);
  for (const h of SIGHT) {
    const o = { x: hero.x, y: hero.y + h, z: hero.z };
    const span = rayRange(box, o, d);
    if (!span) continue;
    for (let t = span[0]; t <= span[1]; t += 0.25) {
      if (hits(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t)) return true;
    }
  }
  return false;
}

// The part of the ray (from 0.3 to 80 units) in a box: [t0, t1], or null.
function rayRange(b, o, d) {
  let t0 = 0.3;
  let t1 = 80;
  for (const [lo, hi, oo, dd] of [[b.x0, b.x1, o.x, d.x], [b.y0, b.y1, o.y, d.y], [b.z0, b.z1, o.z, d.z]]) {
    if (Math.abs(dd) < 1e-9) {
      if (oo < lo || oo > hi) return null;
      continue;
    }
    let a = (lo - oo) / dd;
    let c = (hi - oo) / dd;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, c);
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

// One step of a fade toward 1 (in front) or 0, with a snap at the ends.
export function stepFade(fade, hit, dt) {
  const target = hit ? 1 : 0;
  const next = fade + (target - fade) * Math.min(1, dt * SPEED);
  return Math.abs(target - next) < SNAP ? target : next;
}

// The stipple of a fade: 0 under FADE_MIN (the thing draws whole), else the fade itself.
export const stippleOf = (fade) => (fade < FADE_MIN ? 0 : fade);

// ---------------------------------------------------------------- The work in sight (#38)
// When a task or an example starts, the view turns (in its steps of 90 degrees) to an angle where
// no house or roof covers the places of the work and its person.
export const BUILDINGS = new Set(['house', 'hut', 'giong-house', 'dinh', 'school', 'forge']);
const EAVES = 2; // cells: a building counts within its eaves (not a kite high over a school)
const REACH = 30; // cells: farther buildings never cover the work
const WORK_HEIGHTS = [0.3, 1.2]; // over the ground: a thing of the work, and the body of a person

// A thing this tall (blocks over its ground) or more covers the work when it stands in front: a
// gate post, a wall, a tall tree, a stack (#42). A bush or a fence is lower. A tall thing at the
// work (within AT_WORK cells of a point: the clumps of the grove where the woodcutter works) is the
// place of the work: no turn shows the work out of it, and it fades as the hero walks in.
// Only a tall thing within TALL_REACH cells counts: a far clump of bamboo fades as a small part of
// the view, and the gate post right by the work fades as a large dotted shape over it.
export const TALL = 2;
const AT_WORK = 1.5;
const TALL_REACH = 10;

// The boxes of the buildings and of the other tall things near the points of the work (world
// units: x, z in cells, y in blocks over the ground, as terrain.boxOf).
export function workBoxes(terrain, points) {
  const near = (o) => points.some((p) => Math.abs(o.x + o.w / 2 - p.x) < REACH && Math.abs(o.y + o.h / 2 - p.z) < REACH);
  const out = [];
  for (const o of terrain.objects) {
    if (o.gone || !near(o)) continue;
    const b = terrain.boxOf(o);
    if (BUILDINGS.has(o.kind)) out.push({ ...b, x0: Math.max(b.x0, o.x - EAVES), x1: Math.min(b.x1, o.x + o.w + EAVES), z0: Math.max(b.z0, o.y - EAVES), z1: Math.min(b.z1, o.y + o.h + EAVES), id: o.id ?? o.kind, building: true });
    else if (b.y1 - b.y0 >= TALL && points.some((p) => Math.abs(o.x + o.w / 2 - p.x) < TALL_REACH && Math.abs(o.y + o.h / 2 - p.z) < TALL_REACH) && !points.some((p) => p.x >= b.x0 - AT_WORK && p.x <= b.x1 + AT_WORK && p.z >= b.z0 - AT_WORK && p.z <= b.z1 + AT_WORK)) out.push({ ...b, id: o.id ?? o.kind });
  }
  return out;
}

// The boxes that cover a point of the work from the angle az. points: { x, y, z } (world units, y:
// the ground).
export function workCovers(boxes, points, az, elevation) {
  const d = toCamera(az, elevation);
  return boxes.filter((b) => points.some((p) => WORK_HEIGHTS.some((h) => rayHits(b, { x: p.x, y: p.y + h, z: p.z }, d))));
}

// The turn (in steps of 90 degrees) to the first angle that shows the work with nothing in front:
// none when the angle now shows it, then one step either way, then the back. inSight(az): the
// person and the example are on the screen from that angle (the screen of a phone held upright is
// narrow); an angle with them in sight comes first. When no angle is free of all tall things, the
// first angle with no building in front (a tall tree fades to a few dots; a house hides the work,
// #42). 0 when no angle is clear (the view stays).
export function workTurn(boxes, points, az, elevation, inSight = () => true) {
  const order = [0, 1, -1, 2];
  const covers = order.map((steps) => workCovers(boxes, points, az + (steps * Math.PI) / 2, elevation));
  const pick = (ok) => {
    const clear = order.filter((_, i) => ok(covers[i]));
    return clear.find((steps) => inSight(az + (steps * Math.PI) / 2)) ?? clear[0];
  };
  return pick((c) => !c.length) ?? pick((c) => !c.some((b) => b.building)) ?? 0;
}
