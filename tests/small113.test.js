// Small things after the play test of #95 to #104 (#113): the elder looks like an old man from each
// angle of the view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personFine } from '../src/world/fine.js';
import { person } from '../src/world/figures.js';
import { load } from './helpers.js';

const figs = load('data/figures.json').figures;

// The rectangle of a part of the head as the camera sees it from a side: from the front or the
// back, x and y; from the left or the right, z and y.
const rectOf = (p, side) => {
  const [w, h, d] = p.size;
  const [x, y, z] = p.at;
  const u = side === 'x' ? [z - d / 2, z + d / 2] : [x - w / 2, x + w / 2];
  return { u0: u[0], u1: u[1], v0: y - h / 2, v1: y + h / 2 };
};
// Does a point of the beard show out of the other parts of the head, from that side?
function beardShows(parts, side) {
  const head = parts.filter((p) => p.parent === 'head' && !/^beard/.test(p.name) && p.size[0] > 0.05);
  const beard = parts.filter((p) => /^beard/.test(p.name));
  for (const b of beard) {
    const r = rectOf(b, side);
    for (let i = 0; i <= 8; i++) {
      for (let j = 0; j <= 8; j++) {
        const u = r.u0 + ((r.u1 - r.u0) * i) / 8;
        const v = r.v0 + ((r.v1 - r.v0) * j) / 8;
        // From the front, the beard is in front of the face; from the back and the sides, it shows
        // only out of the head.
        if (side === 'front') return true;
        if (!head.some((p) => { const q = rectOf(p, side); return u > q.u0 && u < q.u1 && v > q.v0 && v < q.v1; })) return true;
      }
    }
  }
  return false;
}

test('the elder: a dark robe, a khăn, and a white beard that shows from the front, the side, and the back', () => {
  const e = figs.elder;
  assert.equal(e.hat, 'khan');
  assert.ok(['wood', 'ink', 'indigo'].includes(e.top), `a dark robe: ${e.top}`);
  assert.equal(e.beard, true);
  assert.equal(e.item, 'staff');
  for (const fig of [personFine(e), person(e)]) {
    for (const side of ['front', 'back', 'x']) assert.ok(beardShows(fig.parts, side), `${fig.grid ? 'fine' : 'coarse'}: the beard shows from the ${side === 'x' ? 'side' : side}`);
  }
});

// The hero at the đình when the envoy has come (the step of the goal is the envoy).
async function atEnvoy(cell = [34, 27], steps = [{ wait: 1 }]) {
  const { runHeadless } = await import('./story-run.js');
  const { getEntity } = await import('../src/core/world/state.js');
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true, 'prologue.done': true, 'trial.scholar.done': true, 'trial.smith.done': true, 'trial.fisher.done': true, 'trial.healer.done': true, 'trial.woodcutter.done': true } };
  let session = null;
  const failures = await runHeadless({ name: 'envoy-113', profile, clock: 600, at: ['phu-dong', ...cell], steps }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  return { session, getEntity };
}

test('with the envoy near the hero, the big button talks to the envoy, not to the elder', async () => {
  // Next to the elder, and the envoy a few steps away.
  const { session } = await atEnvoy([32, 26.5]);
  const a = session.action();
  assert.equal(a?.act, 'talk');
  assert.equal(a.target, 'npc:messenger', JSON.stringify(a));
});

test('while the envoy waits at the đình, the people of the village walk there and stand around him', async () => {
  const { session, getEntity } = await atEnvoy();
  const run = (sec) => {
    for (let i = 0; i < sec * 30; i++) {
      if (session.screen) session.command({ type: 'close' });
      session.step();
      session.events();
    }
  };
  run(60);
  const envoy = getEntity(session.state, 'npc:messenger').position;
  const near = ['elder', 'grandma', 'teacher', 'healer', 'smith'].filter((id) => {
    const e = getEntity(session.state, `npc:${id}`);
    return e && !e.hidden && Math.hypot(e.position.x - envoy.x, e.position.z - envoy.z) <= 10;
  });
  assert.ok(near.length >= 3, `people near the envoy: ${near.join(', ')}`);
});
