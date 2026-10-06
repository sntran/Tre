// What a tap on the screen hits (#47): a pure orthographic camera with the numbers of the view
// (src/world/view.js, the same as src/render/voxel.js), and the hit test of a tap. The village
// (src/ui/village.js) and the tests (tests/screen.test.js, the story step tap: { screenOf }) use the
// same hit test, so that a story taps where a child taps.
// World units here: blocks (x, z on the ground, y up). The positions of the entities are in half
// blocks.
import { VIEW, viewSize, leadFocus } from './view.js';
import { pickGround, pickTopOf, columnTop } from './terrain.js';

export const THING_PAD = 6; // screen pixels around the box of a thing, for small fingers
export const PERSON_PAD = 10; // screen pixels around the box of a person
export const PERSON_PAD_AT_PLACE = -6; // next to a place of a task: only the body of the person
export const FRIEND_PAD = 8; // screen pixels around Nghé
export const PERSON_HEIGHT = 1.8; // blocks: a person when the renderer does not give the height

// The camera of the view: it looks at the focus (blocks) from the angle az, at a zoom level, on a
// screen of width x height pixels. project: a world point to a screen point (pixels from the top
// left); screenBox: the screen box of a world box; nearness: bigger is nearer to the camera; ray:
// the ray of a screen point (for the pick of the ground).
export function viewCamera({ focus, az = Math.PI / 4, level = 0, width, height }) {
  const e = VIEW.elevation;
  const size = viewSize(width, height, level);
  const dir = [Math.cos(e) * Math.sin(az), Math.sin(e), Math.cos(e) * Math.cos(az)];
  const right = [Math.cos(az), 0, -Math.sin(az)];
  const up = [dir[1] * right[2] - dir[2] * right[1], dir[2] * right[0] - dir[0] * right[2], dir[0] * right[1] - dir[1] * right[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cam = {
    focus, az, level, width, height,
    project(x, y, z) {
      const p = [x - focus.x, y - focus.y, z - focus.z];
      return { x: width / 2 + (dot(p, right) * width) / size.w, y: height / 2 - (dot(p, up) * height) / size.h, visible: true };
    },
    screenBox(b) {
      const out = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) {
        const q = cam.project(x, y, z);
        out.x0 = Math.min(out.x0, q.x);
        out.y0 = Math.min(out.y0, q.y);
        out.x1 = Math.max(out.x1, q.x);
        out.y1 = Math.max(out.y1, q.y);
      }
      return out;
    },
    nearness: (x, y, z) => x * dir[0] + y * dir[1] + z * dir[2],
    ray(px, py) {
      const sx = ((px - width / 2) * size.w) / width;
      const sy = (-(py - height / 2) * size.h) / height;
      const o = [0, 1, 2].map((k) => [focus.x, focus.y, focus.z][k] + right[k] * sx + up[k] * sy + dir[k] * 120);
      return { origin: { x: o[0], y: o[1], z: o[2] }, dir: { x: -dir[0], y: -dir[1], z: -dir[2] } };
    },
  };
  return cam;
}

// The ground (or the water on it) under a screen point, with the height layer of a tile map (no
// props): for the tests.
export function groundPick(cam, tileMap) {
  return (px, py) => {
    const r = cam.ray(px, py);
    const top = (x, z) => (tileMap.inside(x, z) ? pickTopOf(tileMap.type(x, z), columnTop(tileMap.heightAt(x, z))) : 0);
    const hit = pickGround(r.origin, r.dir, top, tileMap.width, tileMap.height, 64);
    return hit ? { ...hit, who: 0 } : null;
  };
}

const inBox = (p, b, pad) => p.x >= b.x0 - pad && p.x <= b.x1 + pad && p.y >= b.y0 - pad && p.y <= b.y1 + pad;

// Can a tap choose this thing? A thing that is set does not move, but a fixed thing of a task (a
// stem, the iron, a culm) answers a tap.
export const tappable = (e) => Boolean(e.item && e.position && !e.hidden && !(e.item.set && !e.item.fixed));

// The thing under a screen point: the one whose middle line on the screen is nearest to the finger.
// inside: the finger is on the body of the thing, not only on its margin and pad. along: the place along the
// thing (half blocks), for a stem or a culm.
export function thingUnder(p, cam, things, pad = THING_PAD) {
  let best = null;
  for (const e of things) {
    if (!tappable(e)) continue;
    const q = e.position;
    // A standing culm (or cut piece) goes up from its foot; other things lie along their facing.
    const up = e.item.kind === 'culm' || e.item.kind === 'stump';
    const end = up ? { x: q.x, z: q.z } : { x: q.x + Math.sin(q.facing ?? 0) * e.item.size, z: q.z + Math.cos(q.facing ?? 0) * e.item.size };
    // The box of the thing with a margin of half a block for small fingers.
    const b = cam.screenBox({
      x0: Math.min(q.x, end.x) / 2 - 0.5, x1: Math.max(q.x, end.x) / 2 + 0.5,
      y0: q.y / 2, y1: q.y / 2 + (up ? e.item.size / 2 : 0.5),
      z0: Math.min(q.z, end.z) / 2 - 0.5, z1: Math.max(q.z, end.z) / 2 + 0.5,
    });
    if (!inBox(p, b, pad)) continue;
    const a = cam.project(q.x / 2, q.y / 2 + (up ? 0 : 0.4), q.z / 2);
    const c = cam.project(end.x / 2, q.y / 2 + (up ? e.item.size / 2 : 0.4), end.z / 2);
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(p.x - (a.x + dx * k), p.y - (a.y + dy * k));
    // On the body of the thing: near its line on the screen (a third of a block, at least 6 pixels).
    const top = cam.project(q.x / 2, q.y / 2 + 1, q.z / 2);
    const block = Math.hypot(top.x - a.x, top.y - a.y + 0) / Math.cos(VIEW.elevation) || 1;
    if (!best || d < best.d) best = { e, d, along: Math.round(k * e.item.size), inside: d <= Math.max(6, block / 3) };
  }
  return best;
}

// The figure (a person, Nghé) under a screen point: the nearest one to the camera. figs: [{ id, x,
// y, z (blocks), height }]. r: the half width of the box (blocks).
export function figureUnder(p, cam, figs, pad, r = 0.7) {
  let best = null;
  for (const f of figs) {
    const b = cam.screenBox({ x0: f.x - r, x1: f.x + r, y0: f.y, y1: f.y + (f.height ?? PERSON_HEIGHT) + 0.2, z0: f.z - r, z1: f.z + r });
    if (!inBox(p, b, pad)) continue;
    const near = cam.nearness(f.x, f.y, f.z);
    if (!best || near > best.near) best = { f, near };
  }
  return best?.f ?? null;
}

// The plank outline of the prediction at the bridge under a screen point (the row lies on the bank).
export function guessUnder(p, cam, guesses) {
  let best = null;
  for (const g of guesses) {
    if (g.guess.left !== undefined) continue;
    const q = g.position;
    const b = cam.screenBox({ x0: q.x / 2 - 0.6, x1: q.x / 2 + 0.6, y0: q.y / 2, y1: q.y / 2 + 0.3, z0: q.z / 2, z1: q.z / 2 + 2 });
    if (!inBox(p, b, 4)) continue;
    // The outlines stand close together: the one whose middle is nearest to the finger.
    const c = cam.project(q.x / 2, q.y / 2 + 0.1, q.z / 2 + 1);
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (!best || d < best.d) best = { g, d };
  }
  return best?.g ?? null;
}

// The thing of a heap nearest to a point on the ground (cells), within one block: a thing of a heap
// lies at its home.
function heapThingNear(things, hit) {
  let best = null;
  for (const e of things) {
    if (!tappable(e) || !e.item.zone || e.item.zone !== e.item.home) continue;
    const d = Math.hypot(e.position.x / 2 - hit.x, e.position.z / 2 - hit.y);
    if (d <= 1 && (!best || d < best.d)) best = { e, d };
  }
  return best?.e ?? null;
}

// The target of a tap at a screen point (docs/TASKS.md: a tap only walks there and chooses the
// target of the button). w: what the screen shows now:
// - cam: the camera (viewCamera, or the view of the renderer, with the same project, screenBox,
//   and nearness);
// - things: the entities with an item; persons: [{ id (the entity), x, y, z, height }];
// - friends: the figures of Nghé (and of the hero on the back of Nghé), [{ id (Nghé), x, y, z,
//   height }]; a tap there pets Nghé; guesses: the plank outlines; hamlet: the things
//   of the hamlet with a tap ([{ id, hamletTap, x, y, z, height }]);
// - pick(px, py): the ground (or a prop: who) under the point, { x, y (map cells), h, who } or null;
// - placeAt(x, y, pad): a place of a task at a map point (cells), with a pad in half blocks;
// - inTask: a task or a folk game goes on now; raidAt(p): the target of a raid (optional).
// The order: a plank outline, a target of a raid, a thing of the hamlet; then a thing, but a place
// of a task wins over a thing that only touches the finger with its margin (#47); then Nghé (not
// in a task: in a task a tap on Nghé is a tap on what is under or behind Nghé, #47); then a place
// of a task under the finger; then a person (next to a place of a task, only the body of the
// person); then the ground.
// Returns a target for the session ({ guess }, { hamlet }, { thing }, { pet }, { person },
// { ground }), a target of a raid, or null.
export function tapTarget(p, w) {
  const ghost = guessUnder(p, w.cam, w.guesses ?? []);
  if (ghost) return { guess: { zone: ghost.guess.zone, n: ghost.guess.n } };
  const raid = w.raidAt?.(p);
  if (raid) return raid;
  const tap = figureUnder(p, w.cam, w.hamlet ?? [], 10, 0.6);
  if (tap) return { hamlet: { ...tap.hamletTap, id: tap.id } };
  const hit = w.pick(p.x, p.y);
  const inPlace = hit && w.placeAt(hit.x, hit.y, 0);
  const thing = thingUnder(p, w.cam, w.things);
  if (thing && (thing.inside || !inPlace)) return thing.e.item.fixed ? { thing: thing.e.id, along: thing.along } : { thing: thing.e.id };
  // The ground between the things of a heap: the nearest thing of the heap (a heap has no rect).
  const heaped = hit && !inPlace ? heapThingNear(w.things, hit) : null;
  if (heaped) return { thing: heaped.id };
  const friend = w.inTask ? null : figureUnder(p, w.cam, w.friends ?? [], FRIEND_PAD, 0.8);
  if (friend) return { pet: friend.id };
  // A place of a task under the finger comes before a person who stands in front of it (#31,
  // #47); next to a place, only a tap on the body of the person is for the person.
  if (inPlace) return { ground: { x: hit.x, y: hit.y, h: hit.h, thing: Boolean(hit.who), object: hit.object ?? null } };
  const nearPlace = hit && w.placeAt(hit.x, hit.y);
  const person = figureUnder(p, w.cam, w.persons ?? [], nearPlace ? PERSON_PAD_AT_PLACE : PERSON_PAD);
  if (person) return { person: person.id };
  if (!hit) return null;
  return { ground: { x: hit.x, y: hit.y, h: hit.h, thing: Boolean(hit.who), object: hit.object ?? null } };
}

// The camera of the game on a phone for a headless session (the tests and the story step tap:
// { screenOf }): the focus on the hero, led toward the work in view (leadFocus), at the angle az.
export function sessionCamera(session, { az = Math.PI / 4, width = 390, height = 844 } = {}) {
  const half = (p) => ({ x: p.x / 2, y: (p.y ?? 0) / 2, z: p.z / 2 });
  const hero = session.state.entities.find((e) => e.id === 'hero');
  const at = half(hero.position);
  const work = session.work?.();
  const lead = work?.points?.length ? leadFocus([at, ...work.points.map(half)], { az, width, height }) : { focus: at, level: 0 };
  return viewCamera({ focus: lead.focus, az, level: lead.level, width, height });
}

// What the screen of a headless session shows (the same lists as the village gives to tapTarget):
// the figures at their positions in the world state.
export function sessionScreen(session, cam) {
  const list = session.state.entities;
  const fig = (e, extra = {}) => ({ id: e.id, x: e.position.x / 2, y: e.position.y / 2, z: e.position.z / 2, ...extra });
  const hero = list.find((e) => e.id === 'hero');
  const friend = list.find((e) => e.follow?.target === 'hero' && e.position && !e.hidden);
  return {
    cam,
    things: list.filter((e) => e.item && e.position),
    persons: list.filter((e) => e.person && e.position && !e.hidden).map((e) => fig(e)),
    friends: friend ? [fig(friend, { height: 1.1 }), ...(hero.riding ? [{ ...fig(hero), id: friend.id }] : [])] : [],
    guesses: list.filter((e) => e.guess && e.position),
    hamlet: list.filter((e) => e.hamletTap && e.position).map((e) => fig(e, { hamletTap: e.hamletTap, height: 0.8 })),
    pick: groundPick(cam, session.tileMap),
    placeAt: (x, y, pad) => session.taskPlaceAt(x, y, pad),
    inTask: session.inTask(),
  };
}
