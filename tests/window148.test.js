// The window of the hero after the play test of #140–#145 (#148): one test for "the hero is
// hidden", the same as the outline: the window opens when a third of the body is behind a
// building, at the place where a child of grade 5 saw only the outline at the đình, and around the
// person of a talk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, data } from './story-run.js';
import { getEntity } from '../src/core/world/state.js';
import { heroCovered, heroWindow, stillTurn, toCamera, BUILDINGS, ACROSS, HIGH } from '../src/world/fade.js';
import { VIEW } from '../src/world/view.js';

const [ox, oz] = data.world.at('phu-dong', 0, 0);
const PLACE = { x: 9388, z: 6270 }; // world units, the place of the play (#148)
const AZ = 3.93;

async function land() {
  let session = null;
  await runHeadless({ name: 'window-148', profile: { name: 'Lan', grade: 5, lang: 'vi', seed: 7, flags: { 'intro.seen': true } }, clock: 600, at: ['phu-dong', PLACE.x - ox + 0.5, PLACE.z - oz + 0.5], steps: [{ wait: 0.5 }] }, { onSession: (x) => { session = x; } });
  const t = session.terrain;
  const objectsNear = (p, r = 20) => t.objects
    .filter((o) => !o.gone && BUILDINGS.has(o.kind) && Math.abs(o.x + o.w / 2 - p.x) < r && Math.abs(o.y + o.h / 2 - p.z) < r)
    .map((o) => ({ o, b: t.boxOf(o), building: true, hits: (x, y, z) => t.hits(o.who, x, y, z) }));
  const ground = (x, z) => session.terrain.groundY?.(x, z) ?? getEntity(session.state, 'hero').position.y / 2;
  return { session, t, objectsNear, ground };
}

// The measure (a dense grid of rays on the body, 5 across by 7 high, each ray marched in small
// steps through the blocks of each building): the part of the rays that a building stops.
function measure(objects, p, az) {
  const d = toCamera(az, VIEW.elevation);
  const rx = Math.cos(az);
  const rz = -Math.sin(az);
  let hit = 0;
  let n = 0;
  for (const a of ACROSS) for (const h of HIGH) {
    n += 1;
    const o = { x: p.x + rx * a, y: p.y + h, z: p.z + rz * a };
    let stop = false;
    for (let s = 0.3; s < 40 && !stop; s += 0.1) {
      const q = { x: o.x + d.x * s, y: o.y + d.y * s, z: o.z + d.z * s };
      stop = objects.some((x) => q.x >= x.b.x0 && q.x <= x.b.x1 && q.y >= x.b.y0 && q.y <= x.b.y1 && q.z >= x.b.z0 && q.z <= x.b.z1 && x.hits(q.x, q.y, q.z));
    }
    if (stop) hit += 1;
  }
  return hit / n;
}
const openAfter = (covered, sec) => {
  let w = { t: 0, open: false };
  for (let t = 0; t < sec; t += 0.2) w = heroWindow(w, covered, 0.2);
  return w.open;
};

test('at the place of the play (Phù Đổng, 9388, 6270, the view at 3.93), the hero is hidden and the window opens within 1.5 seconds', async () => {
  const { session, objectsNear } = await land();
  const h = getEntity(session.state, 'hero').position;
  const p = { x: PLACE.x + 0.5, y: h.y / 2, z: PLACE.z + 0.5 };
  const objects = objectsNear(p);
  assert.ok(measure(objects, p, AZ) >= 1 / 3, `the outline covers ${measure(objects, p, AZ).toFixed(2)} of the body`);
  assert.ok(heroCovered(objects, p, AZ, VIEW.elevation));
  assert.ok(openAfter(true, 1.5));
  // The turn of a still hero uses the same test.
  const steps = stillTurn(objects, p, null, AZ, VIEW.elevation);
  if (steps) assert.ok(!heroCovered(objects, p, AZ + (steps * Math.PI) / 2, VIEW.elevation));
});

test('around the houses of Phù Đổng, at the four turns of the view: where a third of the dense rays hit a building, the window opens; where none hits, it stays closed', async () => {
  const { session, t, objectsNear } = await land();
  const y = getEntity(session.state, 'hero').position.y / 2;
  const houses = t.objects.filter((o) => !o.gone && BUILDINGS.has(o.kind) && Math.hypot(o.x - PLACE.x, o.y - PLACE.z) < 40).slice(0, 6);
  assert.ok(houses.length >= 3, `${houses.length} buildings`);
  let open = 0;
  let closed = 0;
  for (const o of houses) {
    for (let dz = -3; dz <= o.h + 3; dz += 2) {
      for (let dx = -3; dx <= o.w + 3; dx += 2) {
        const p = { x: o.x + dx + 0.5, y, z: o.y + dz + 0.5 };
        const objects = objectsNear(p);
        for (const k of [0, 1, 2, 3]) {
          const az = Math.PI / 4 + (k * Math.PI) / 2;
          const part = measure(objects, p, az);
          const covered = heroCovered(objects, p, az, VIEW.elevation);
          if (part >= 1 / 3) {
            assert.ok(covered && openAfter(covered, 1.5), `at ${p.x}, ${p.z}, view ${k}: ${part.toFixed(2)} hidden, no window`);
            open += 1;
          } else if (part === 0) {
            assert.ok(!covered, `at ${p.x}, ${p.z}, view ${k}: nothing hides the hero, a window`);
            closed += 1;
          }
        }
      }
    }
  }
  assert.ok(open > 0 && closed > 0, `${open} open, ${closed} closed`);
});
