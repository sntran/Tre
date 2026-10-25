// What a tap on the screen hits (#47): a pure orthographic camera with the numbers of the view
// (src/world/view.js, the same as src/render/voxel.js), and the hit test of a tap. The village
// (src/ui/village.js) and the tests (tests/screen.test.js, the story step tap: { screenOf }) use the
// same hit test, so that a story taps where a child taps.
// World units here: blocks (x, z on the ground, y up). The positions of the entities are in half
// blocks.
import { VIEW, viewSize, frameWork } from './view.js';
import { pickGround, pickTopOf, columnTop } from './terrain.js';

export const THING_PAD = 6; // screen pixels around the box of a thing, for small fingers
// The area that takes the tap of a small thing of a task is at least TAP_AREA points across, about
// 10 mm on a phone (#83: children of 5 to 10 miss a target of 4.8 mm about 30 times in 100, and a
// target of 9.6 mm about 5 times in 100).
export const TAP_AREA = 60;
export const PERSON_PAD = 10; // screen pixels around the box of a person
export const PERSON_PAD_AT_PLACE = -6; // next to a place of a task: only the body of the person
export const FRIEND_PAD = 8; // screen pixels around Nghé
export const PERSON_HEIGHT = 1.8; // blocks: a person when the renderer does not give the height
export const BODY_DEPTH = 0.4; // blocks: a person this far behind a thing still stands on it

// The camera of the view: it looks at the focus (blocks) from the angle az, at a zoom level, on a
// screen of width x height pixels. project: a world point to a screen point (pixels from the top
// left); screenBox: the screen box of a world box; nearness: bigger is nearer to the camera; ray:
// the ray of a screen point (for the pick of the ground).
// scale: the frame of a work (viewSize).
export function viewCamera({ focus, az = Math.PI / 4, level = 0, width, height, scale = 1 }) {
  const e = VIEW.elevation;
  const size = viewSize(width, height, level, scale);
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

// The places of a task where a thing lies after a put (a tap must be on the body of the thing).
const PLACED = new Set(['basket', 'mat', 'hearth', 'share']);
// The places where a tap next to a thing chooses it while the hands are empty and the place is a
// heap of the work (nearTake, #116).
const NEAR_TAKE = new Set(['mat']);
// The height of a stake of the row of the fisher over the water, for a tap (blocks).
const STAKE_TALL = 1.2;
const inBox = (p, b, pad, padY = pad) => p.x >= b.x0 - pad && p.x <= b.x1 + pad && p.y >= b.y0 - padY && p.y <= b.y1 + padY;

// Can a tap choose this thing? A thing that is set does not move, but a fixed thing of a task (a
// stem, the iron, a culm) answers a tap.
// A thing in the hands of the hero takes no tap (inHands, #104: the pot in the hands at the well),
// and nor does a thing under another one (covered: the ring of straw under its pot).
export const tappable = (e) => Boolean(e.item && e.position && !e.hidden && !e.item.inHands && !e.item.covered && !(e.item.set && !e.item.fixed));

// The thing under a screen point: the one whose middle line on the screen is nearest to the finger.
// inside: the finger is on the body of the thing, not only on its margin and pad. along: the place along the
// thing (half blocks), for a stem or a culm.
export function thingUnder(p, cam, things, pad = THING_PAD) {
  let best = null;
  for (const e of things) {
    if (!tappable(e)) continue;
    const q = e.position;
    // A standing culm (or cut piece) goes up from its foot, and so does a stake of the row of the
    // fisher (#78: the taps on the stakes of the row never chose a stake); other things lie along
    // their facing.
    const stake = e.item.kind === 'stake' && e.item.zone === 'line';
    const up = e.item.kind === 'culm' || e.item.kind === 'stump' || stake;
    const tall = stake ? STAKE_TALL : e.item.size / 2;
    const end = up ? { x: q.x, z: q.z } : { x: q.x + Math.sin(q.facing ?? 0) * e.item.size, z: q.z + Math.cos(q.facing ?? 0) * e.item.size };
    // The box of the thing with a margin of half a block for small fingers.
    const b = cam.screenBox({
      x0: Math.min(q.x, end.x) / 2 - 0.5, x1: Math.max(q.x, end.x) / 2 + 0.5,
      y0: q.y / 2, y1: q.y / 2 + (up ? tall : 0.5),
      z0: Math.min(q.z, end.z) / 2 - 0.5, z1: Math.max(q.z, end.z) / 2 + 0.5,
    });
    // A small thing takes a tap in an area of at least TAP_AREA points (#83).
    if (!inBox(p, b, Math.max(pad, (TAP_AREA - (b.x1 - b.x0)) / 2), Math.max(pad, (TAP_AREA - (b.y1 - b.y0)) / 2))) continue;
    const a = cam.project(q.x / 2, q.y / 2 + (up ? 0 : 0.4), q.z / 2);
    const c = cam.project(end.x / 2, q.y / 2 + (up ? tall : 0.4), end.z / 2);
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(p.x - (a.x + dx * k), p.y - (a.y + dy * k));
    // On the body of the thing: near its line on the screen (a third of a block, at least 6 pixels).
    const top = cam.project(q.x / 2, q.y / 2 + 1, q.z / 2);
    const block = Math.hypot(top.x - a.x, top.y - a.y + 0) / Math.cos(VIEW.elevation) || 1;
    // A stake of the row is thin: a finger at most half a block (and 14 pixels) from it is on it.
    if (!best || d < best.d) best = { e, d, along: Math.round(k * e.item.size), inside: d <= (stake ? Math.max(14, block / 2) : Math.max(6, block / 3)) };
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

// The row of plank outlines of the prediction at the bridge under a screen point (#90: each row lies
// beside the gap, len half blocks along +z from its position).
export function guessUnder(p, cam, guesses) {
  let best = null;
  for (const g of guesses) {
    if (g.guess.left !== undefined || g.hidden) continue;
    const q = g.position;
    const len = (g.guess.len ?? 4) / 2;
    const b = cam.screenBox({ x0: q.x / 2 - 0.6, x1: q.x / 2 + 0.6, y0: q.y / 2, y1: q.y / 2 + 0.3, z0: q.z / 2, z1: q.z / 2 + len });
    if (!inBox(p, b, 4)) continue;
    // The rows lie close together: the one whose line is nearest to the finger.
    const a = cam.project(q.x / 2, q.y / 2 + 0.1, q.z / 2);
    const c = cam.project(q.x / 2, q.y / 2 + 0.1, q.z / 2 + len);
    const vx = c.x - a.x;
    const vy = c.y - a.y;
    const k = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1)));
    const d = Math.hypot(p.x - (a.x + vx * k), p.y - (a.y + vy * k));
    if (!best || d < best.d) best = { g, d };
  }
  return best?.g ?? null;
}

// The point of the row of the fisher nearest to a screen point: { a (half blocks from its start),
// d (pixels) }, or null when the finger is not on the row. A point takes a tap in a circle of
// TAP_AREA points (#83) around its upright line from the bed of the river to the surface of the
// water, where the ring of the fisher floats, and up to the top of a stake that stands there (#115:
// a finger on the ring met the bed of the river behind it, and the tap chose the point before the
// ring). stood: the points of the row with a stake.
const ROW_PAD = TAP_AREA / 2;
// Blocks over the bed of the river: the surface of the water, and the top of a stake.
const ROW_WATER = 0.65;
const ROW_TOP = ROW_WATER + STAKE_TALL;
function rowUnder(p, cam, row, stood = new Set()) {
  let best = null;
  for (let a = 1; a <= row.length; a++) {
    const lo = cam.project((row.x + a) / 2, row.y / 2, row.z / 2);
    const hi = cam.project((row.x + a) / 2, row.y / 2 + (stood.has(a) ? ROW_TOP : ROW_WATER), row.z / 2);
    const vx = hi.x - lo.x;
    const vy = hi.y - lo.y;
    const k = Math.max(0, Math.min(1, ((p.x - lo.x) * vx + (p.y - lo.y) * vy) / (vx * vx + vy * vy || 1)));
    const d = Math.hypot(p.x - (lo.x + vx * k), p.y - (lo.y + vy * k));
    if (!best || d < best.d) best = { a, d };
  }
  return best && best.d <= ROW_PAD ? best : null;
}
// With a stake in the hands, a tap on the water within one gap of the row chooses the point of the
// row at the tap (#115: taps on the water next to the row did not move the hero). hit: the ground
// under the finger (cells).
function rowWater(hit, row) {
  if (!hit || !row.space || hit.h * 2 > row.y + 1.5) return null;
  if (Math.abs(hit.y * 2 - row.z) > row.space) return null;
  const a = Math.round(hit.x * 2 - row.x);
  if (a < 1 - row.space || a > row.length + row.space) return null;
  return { a: Math.max(1, Math.min(row.length, a)), d: 0 };
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
// - under(px, py): the ground under the point behind the props, { x, y } or null (optional);
// - placeAt(x, y, pad): a place of a task at a map point (cells), with a pad in half blocks;
// - line(): the row of the open task of the fisher, { x, y, z, length, space } in half blocks, or null
//   (optional);
// - openThing(e): the thing is of a task that is open now (optional; else every thing is);
//   nearTake(e): the place of the thing is a heap of the work, and a tap next to the thing chooses
//   it with empty hands (optional);
//   openSpanAt(x, y): the map point is on the gap of an open bridge (optional);
//   carrying: a thing is in the hands of the hero; raidAt(p): the target of a raid (optional).
// The order: a plank outline, a target of a raid, a thing of the hamlet; then a thing, but a place
// of a task wins over a thing that only touches the finger with its margin (#47), and the body of
// a person on the thing or in front of it wins over the thing (#70); Nghé when no thing and no
// place of an open task is under the finger (#87; else a tap on Nghé is a tap on what is under or
// behind Nghé, #47); then a place
// of a task under the finger; then a person (next to a place of a task, only the body of the
// person); then the ground.
// Returns a target for the session ({ guess }, { hamlet }, { thing }, { pet }, { person },
// { ground }), a target of a raid, or null.
// A child of a folk game who can ask a trick question (#103) takes a tap as a person, out of a
// game (in a game, a tap goes to the court).
export const askingChild = (e, session) => Boolean(e.folkChild && String(e.id).startsWith('npc:') && !session.inTask());

export function tapTarget(p, w) {
  // The plank outlines of the prediction take a tap only with empty hands: with a plank in the
  // hands, the child puts it (#47).
  const ghost = w.carrying ? null : guessUnder(p, w.cam, w.guesses ?? []);
  if (ghost) return { guess: { zone: ghost.guess.zone, n: ghost.guess.n } };
  const raid = w.raidAt?.(p);
  if (raid) return raid;
  const tap = figureUnder(p, w.cam, w.hamlet ?? [], 10, 0.6);
  if (tap) return { hamlet: { ...tap.hamletTap, id: tap.id } };
  const hit = w.pick(p.x, p.y);
  // The row of the fisher: its stakes stand higher than the water that the ray meets, so the
  // point of the row nearest to the finger on the screen is the point of the tap (#63: the stake
  // went two half blocks farther than the finger, or the tap missed the row).
  const row = w.line?.() ?? null;
  const stood = new Set(w.things.filter((e) => e.item?.zone === 'line' && e.item.slot != null && !e.item.held && !e.hidden).map((e) => e.item.slot));
  const onRow = row ? rowUnder(p, w.cam, row, stood) ?? (w.carrying ? rowWater(hit, row) : null) : null;
  const inPlace = onRow || (hit && w.placeAt(hit.x, hit.y, 0));
  // With a stake in the hands, a tap on a stake of the row is a tap on its point of the row: the
  // put goes to the free point nearest to it (#78).
  const found = thingUnder(p, w.cam, w.things);
  const thing = found && !(w.carrying && found.e.item.zone === 'line') ? found : null;
  // Nghé: a tap on her is a pet when no thing and no place of an open task is under the finger,
  // also during a task and after it (#87: after the task of the teacher, Nghé stood on the heap of
  // the done task, and each tap on her was a walk). A person under the finger comes first (#56).
  const pal = figureUnder(p, w.cam, w.friends ?? [], FRIEND_PAD, 0.8);
  const taskThing = thing && (w.openThing ? w.openThing(thing.e) : true);
  const taskPlace = inPlace || (hit && w.openSpanAt?.(hit.x, hit.y));
  if (pal && !taskThing && !taskPlace && !figureUnder(p, w.cam, w.persons ?? [], PERSON_PAD)) return { pet: pal.id };
  // A thing on a place of a task (a bunch in the basket, a rod on the mat) is chosen only by a tap on
  // its body, never by a tap next to it (#79: a tap near the basket took a bunch out). With empty
  // hands, a tap within a finger of a rod on the mat chooses it: the mat takes nothing from empty
  // hands, and a rod that lies flat has almost no body on the screen (#116: a girl of grade 4 could
  // not take the last rod of the mat for the box).
  const nearRod = thing && !w.carrying && NEAR_TAKE.has(thing.e.item.zone) && (w.nearTake ? w.nearTake(thing.e) : false);
  if (thing && (thing.inside || nearRod || (!inPlace && !PLACED.has(thing.e.item.zone)))) {
    // A person whose body is under the finger and who stands on the thing or in front of it: the
    // tap is for the person (#70: the healer stood on her bed of rau má, and each tap on her chose
    // the bed, so the child could not give the basket).
    // A thing of a puzzle is the work there: it keeps the tap (#104: the healer stood at the jar).
    const body = String(thing.e.item.kind).startsWith('pz') ? null : figureUnder(p, w.cam, (w.persons ?? []).filter((q) => !String(q.id).startsWith('encounter:')), PERSON_PAD_AT_PLACE);
    const q = thing.e.position;
    if (body && w.cam.nearness(body.x, body.y, body.z) >= w.cam.nearness(q.x / 2, q.y / 2, q.z / 2) - BODY_DEPTH) return { person: body.id };
    return thing.e.item.fixed ? { thing: thing.e.id, along: thing.along } : { thing: thing.e.id };
  }
  // The ground between the things of a heap: the nearest thing of the heap (a heap has no rect).
  // A person whose body is under the finger and who stands in front of the heap keeps the tap
  // (#131: a tap on the healer chose the bed of rau má behind her).
  const heaped = hit && !inPlace ? heapThingNear(w.things, hit) : null;
  if (heaped) {
    const body = figureUnder(p, w.cam, (w.persons ?? []).filter((q) => !String(q.id).startsWith('encounter:')), PERSON_PAD_AT_PLACE);
    const q = heaped.position;
    if (body && w.cam.nearness(body.x, body.y, body.z) >= w.cam.nearness(q.x / 2, q.y / 2, q.z / 2) - BODY_DEPTH) return { person: body.id };
    return { thing: heaped.id };
  }
  // An enemy of an encounter under the finger comes before Nghé: a tap on the enemy never pets
  // Nghé (#55).
  const foe = figureUnder(p, w.cam, (w.persons ?? []).filter((q) => String(q.id).startsWith('encounter:')), PERSON_PAD);
  if (foe) return { person: foe.id };
  // A person under the finger comes before Nghé too: a tap on Nghé is a pet only when no person
  // is under the finger (#56: Nghé stood next to the elder, and a tap on him petted her).
  const nearPlace = hit && w.placeAt(hit.x, hit.y);
  const person = figureUnder(p, w.cam, w.persons ?? [], nearPlace ? PERSON_PAD_AT_PLACE : PERSON_PAD);
  const friend = person || taskPlace ? null : pal;
  if (friend) return { pet: friend.id };
  // A place of a task under the finger comes before a person who stands in front of it (#31,
  // #47); next to a place, only a tap on the body of the person is for the person.
  if (onRow) return { ground: { x: (row.x + onRow.a) / 2, y: row.z / 2, h: row.y / 2, thing: false, object: null } };
  if (inPlace) return { ground: { x: hit.x, y: hit.y, h: hit.h, thing: Boolean(hit.who), object: hit.object ?? null } };
  if (person) return { person: person.id };
  if (!hit) return null;
  // On a roof, a wall, or a tree, the ground under the finger behind it: the hero walks around
  // the thing toward that side (#53).
  const under = hit.who ? w.under?.(p.x, p.y) ?? null : null;
  return { ground: { x: hit.x, y: hit.y, h: hit.h, thing: Boolean(hit.who), object: hit.object ?? null, ...(under ? { under: { x: under.x, y: under.y } } : {}) } };
}

// The camera of the game on a phone for a headless session (the tests and the story step tap:
// { screenOf }): as the village does (#83), the frame of the work in view (frameWork) with the
// hero and the person, or the hero in the middle, at the angle az. The renderer looks at a point
// 1.5 over the ground (LIFT).
const LIFT = 1.5;
const FRAME_CLOSE = 0.8;
const WORK_AWAY = 16;
export function sessionCamera(session, { az = Math.PI / 4, width = 390, height = 844 } = {}) {
  const half = (p) => ({ x: p.x / 2, y: (p.y ?? 0) / 2, z: p.z / 2 });
  const hero = session.state.entities.find((e) => e.id === 'hero');
  const at = half(hero.position);
  const work = session.work?.();
  const pts = (work?.points ?? []).map(half);
  const person = work?.person ? session.state.entities.find((e) => e.id === work.person) : null;
  const mid = pts.length ? pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, z: a.z + p.z / pts.length }), { x: 0, z: 0 }) : null;
  // A demonstration on another instance shows until it ends (#85).
  const demo = session.state.entities.filter((e) => e.demo && e.position).map((e) => half(e.position));
  if ((!mid || Math.hypot(at.x - mid.x, at.z - mid.z) > WORK_AWAY) && !demo.length) return viewCamera({ focus: { ...at, y: at.y + LIFT }, az, width, height });
  if (hero.riding) return viewCamera({ focus: { ...at, y: at.y + LIFT }, az, width, height });
  if (!mid || Math.hypot(at.x - mid.x, at.z - mid.z) > WORK_AWAY) pts.length = 0;
  pts.push(...demo);
  if (person?.position && mid) pts.push(half(person.position));
  const nearH = viewSize(width, height, 0).h;
  const f = frameWork([at, ...pts], { az, width, height, min: nearH * FRAME_CLOSE, max: viewSize(width, height, VIEW.zooms.length - 1).h, lift: LIFT });
  return viewCamera({ focus: { ...f.focus, y: at.y + LIFT }, az, width, height, scale: f.h / nearH });
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
    persons: list.filter((e) => (e.person || askingChild(e, session)) && e.position && !e.hidden).map((e) => fig(e)),
    friends: friend ? [fig(friend, { height: 1.1 }), ...(hero.riding ? [{ ...fig(hero), id: friend.id }] : [])] : [],
    guesses: list.filter((e) => e.guess && e.position),
    hamlet: list.filter((e) => e.hamletTap && e.position).map((e) => fig(e, { hamletTap: e.hamletTap, height: 0.8 })),
    pick: groundPick(cam, session.tileMap),
    placeAt: (x, y, pad) => session.taskPlaceAt(x, y, pad),
    line: () => session.line(),
    openThing: (e) => session.openThing(e.id),
    nearTake: (e) => session.nearTake(e.id),
    openSpanAt: (x, y) => session.openSpanAt(x, y),
    carrying: Boolean(session.carried()),
  };
}
