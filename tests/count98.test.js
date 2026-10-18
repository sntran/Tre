// Counts that a child can follow (#98): each rod of the mat is seen alone and no animal stands on
// the mat, the woodcutter never calls a piece of the right length short, the first example of the
// woodcutter is all in the frame, and the line of `raise` comes only when it is true.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { taskPlaces, wayOut } from '../src/core/world/systems/steer.js';

const story = (name) => load(`tests/stories/${name}.json`);

test('an animal in two places that touch goes out of both, not from one into the other', () => {
  const places = [{ x0: 0, x1: 10, z0: 0, z1: 6 }, { x0: 10, x1: 20, z0: -1, z1: 8 }];
  const inPlace = (p) => places.find((r) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1) ?? null;
  // On the line between the two places: the nearest side of each place goes into the other.
  const p = { x: 10.2, z: 2 };
  const [ox, oz] = wayOut(p, inPlace);
  assert.deepEqual([ox, oz], [0, -1], 'out by the near side of the two places');
  for (let i = 0; i < 40 && inPlace(p); i++) {
    const [dx, dz] = wayOut(p, inPlace);
    p.x += dx * 0.2;
    p.z += dz * 0.2;
  }
  assert.equal(inPlace(p), null);
});

test('no animal of the village stands on the mat or the heap of the teacher while the task is open', async () => {
  const s = story('trial-scholar');
  const first = s.steps.findIndex((x) => x.read === true) + 2;
  let session = null;
  let inside = [];
  const probe = () => {
    if (!session || getEntity(session.state, 'zone:trial-scholar')?.zone.done !== false || session.state.tick < 60) return;
    const places = taskPlaces(session.state);
    for (const e of session.state.entities) {
      if (!e.kind || !e.position || e.hidden || e.person || e.follow) continue;
      // The places with half of their margin: the mat, its rods, and the heap.
      if (places.some((r) => e.position.x > r.x0 + 1 && e.position.x < r.x1 - 1 && e.position.z > r.z0 + 1 && e.position.z < r.z1 - 1)) inside.push(`${session.state.tick} ${e.id}`);
    }
  };
  const put = (n) => ({ repeat: n, steps: [{ press: { item: 'rod' } }, { until: { event: 'put', timeout: 10 } }] });
  const failures = await runHeadless({ ...s, steps: [...s.steps.slice(0, first), put(6), { wait: 60 }] }, {
    onSession: (x) => {
      session = x;
      const step = x.step.bind(x);
      x.step = (...a) => { const r = step(...a); probe(); return r; };
    },
  });
  assert.deepEqual(failures, []);
  assert.ok(session.state.entities.some((e) => e.kind === 'chicken' && !e.hidden), 'the chickens of the school yard');
  assert.deepEqual(inside.slice(0, 5), [], 'no animal on the mat or the heap');
});
