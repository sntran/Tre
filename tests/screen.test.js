// What a tap on the screen chooses (#47): with the camera of the game on a phone held upright (the
// focus on the hero, led toward the work), from each of the four angles of the view, a tap at the
// middle of each place of each trial and station chooses that place, or a thing of that place. The
// hit test is the one of the village (src/world/hit.js); the stories tap through it with the step
// tap: { screenOf }.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, data } from './story-run.js';
import { tapTarget, sessionCamera, sessionScreen } from '../src/world/hit.js';

const ANGLES = [0, 1, 2, 3].map((k) => Math.PI / 4 + (k * Math.PI) / 2);

// Read the talks and wait until the task of the activity starts (its work is in view).
function untilTask(session, seconds = 120) {
  for (let k = 0; k < seconds * 30; k++) {
    if (session.screen === 'dialogue' || session.screen === 'say') session.command({ type: 'next' });
    else if (session.screen) session.command({ type: 'close' });
    session.step();
    session.events();
    const w = session.work();
    if (w && !String(w.key).startsWith('example-') && session.inTask()) return w;
  }
  return null;
}

// The middle of a place (half blocks): its rect, or the middle of the things of a heap.
function middleOf(session, z) {
  const r = z.zone.rect ?? z.solid?.rect;
  if (r) return { x: (r.x0 + r.x1) / 2, y: z.zone.y ?? z.position.y, z: (r.z0 + r.z1) / 2 };
  const things = z.zone.items.map((id) => session.state.entities.find((e) => e.id === id)?.position).filter(Boolean);
  if (!things.length) return null;
  return { x: things.reduce((a, p) => a + p.x, 0) / things.length, y: z.zone.y ?? z.position.y, z: things.reduce((a, p) => a + p.z, 0) / things.length };
}

for (const a of data.practice.activities) {
  test(`on a phone, a tap at the middle of each place of ${a.id} chooses that place`, async () => {
    let session = null;
    const failures = await runHeadless({ name: `screen-${a.id}`, practice: a.id, profile: { name: 'An', grade: 2, lang: 'vi', seed: 3, flags: {} }, steps: [] }, { onSession: (s) => { session = s; } });
    assert.deepEqual(failures, []);
    const work = untilTask(session);
    if (!work) return; // a folk game with no places of a task
    const owner = String(work.key).startsWith('trial-') ? work.key : null;
    const zones = session.state.entities.filter((e) => e.zone && owner && e.zone.task === owner && e.zone.rule !== 'trial' && e.zone.rule !== 'road');
    const wrong = [];
    // No thing of a heap lies in the rect of a place (a tap there would choose the thing).
    for (const h of zones.filter((z) => z.zone.rule === 'heap')) {
      for (const id of h.zone.items) {
        const p = session.state.entities.find((e) => e.id === id)?.position;
        const inside = zones.find((z) => z.zone.rect && p && p.x >= z.zone.rect.x0 && p.x <= z.zone.rect.x1 && p.z >= z.zone.rect.z0 && p.z <= z.zone.rect.z1);
        if (inside) wrong.push(`${id} of ${h.id} lies in the rect of ${inside.id}`);
      }
    }
    for (const z of zones) {
      const mid = middleOf(session, z);
      if (!mid) continue;
      for (const az of ANGLES) {
        const cam = sessionCamera(session, { az });
        const p = cam.project(mid.x / 2, mid.y / 2, mid.z / 2);
        if (p.x < 0 || p.x > cam.width || p.y < 0 || p.y > cam.height) {
          wrong.push(`${z.id} from the angle ${ANGLES.indexOf(az)}: off the screen`);
          continue;
        }
        const t = tapTarget(p, sessionScreen(session, cam));
        const thing = t?.thing ? session.state.entities.find((e) => e.id === t.thing) : null;
        const ok = (thing && (z.zone.items.includes(thing.id) || thing.item?.zone === z.zone.id)) || (t?.ground && session.taskPlace(t.ground.x, t.ground.y) === z.id);
        if (!ok) wrong.push(`${z.id} from the angle ${ANGLES.indexOf(az)}: ${JSON.stringify(t)}${t?.ground ? ` (the place there: ${session.taskPlace(t.ground.x, t.ground.y)})` : ''}`);
      }
    }
    assert.deepEqual(wrong, []);
  });
}
