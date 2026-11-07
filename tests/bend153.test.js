// The test of the smith at grade 5 after the play test of #140–#145 (#153), with the L and the wide
// view of #159: the smith bends each bar at the anvil, the bar from the rack goes to an L, the bar
// from the water stays straight, and the two bars lie side by side for the compare.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { sessionCamera } from '../src/world/hit.js';
import { lookOfKey, figureOf } from '../src/world/figures.js';
import { sizeOf, figureBox } from '../src/core/world/sight.js';
import { rayHits, toCamera } from '../src/world/fade.js';
import { VIEW } from '../src/world/view.js';

const story = load('tests/stories/trial-smith.json');
const MM = 390 / 64; // points in one millimeter on a phone of 390 points

async function bendTest() {
  let session = null;
  const first = story.steps.findIndex((s) => s.read === true);
  const failures = await runHeadless({ ...story, profile: { ...story.profile, grade: 5 }, steps: story.steps.slice(0, first + 1) }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  const said = [];
  session.listen((e) => { if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, tick: session.state.tick }); });
  const run = (sec, each = () => false) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
      if (each()) return;
    }
  };
  const tz = () => getEntity(session.state, 'zone:trial-smith').zone;
  const tap = (id) => { session.command({ type: 'tap', target: { thing: id } }); run(3); };
  const press = () => { session.command({ type: 'hands', id: session.action()?.id }); run(1); };
  run(40, () => tz().test && tz().test.check == null);
  run(1.2);
  press();
  tap('rack:smith');
  press();
  run(4);
  tap(tz().test.tries.find((q) => q.how === 'water').id);
  press();
  return { session, said, run, tz };
}

test('grade 5: during each bend the bar is at least 40 points long on the screen and no figure hides it; the bar from the rack bends to an L, the bar from the water stays straight; the two bars lie side by side when he says the result', async () => {
  const h = await bendTest();
  const tries = h.tz().test.tries.map((q) => ({ ...q }));
  const bends = [];
  const d = toCamera(Math.PI / 4, VIEW.elevation);
  h.run(20, () => {
    const t = h.tz().test;
    if (!t || t.stage == null) return false;
    for (const q of tries) {
      const bar = getEntity(h.session.state, q.id);
      if (!bar || !/^bar-(bend30|spring|bent|straight)$/.test(bar.look)) continue;
      const a = h.session.state.entities.find((e) => e.id === 'anvil:smith')?.position;
      if (!a || Math.hypot(bar.position.x - a.x, bar.position.z - a.z) > 0.1) continue;
      // On the anvil, in the hands of the smith: its length on the screen (the bar lies along x).
      const cam = sessionCamera(h.session);
      const p0 = cam.project(bar.position.x / 2 - 0.5, bar.position.y / 2, bar.position.z / 2);
      const p1 = cam.project(bar.position.x / 2 + 0.5, bar.position.y / 2, bar.position.z / 2);
      const mm = Math.hypot(p1.x - p0.x, p1.y - p0.y) * 1.6 / MM;
      const cover = h.session.state.entities.filter((e) => {
        const size = sizeOf(e);
        if (!size || Math.hypot(e.position.x - bar.position.x, e.position.z - bar.position.z) <= size.r * 2 + 0.6) return false;
        return rayHits(figureBox(e.position, size), { x: bar.position.x / 2, y: bar.position.y / 2 + 0.3, z: bar.position.z / 2 }, d) && !h.session.seeThrough().has(e.id);
      }).map((e) => e.id);
      bends.push({ id: q.id, how: q.how, look: bar.look, mm, cover });
    }
    return false;
  });
  assert.ok(bends.length > 0, 'the bends');
  for (const b of bends) {
    assert.ok(b.mm * MM >= 40, `${b.id} is ${(b.mm * MM).toFixed(0)} points long while he bends it`);
    assert.deepEqual(b.cover, [], `${b.id} behind a figure`);
  }
  // The looks: the bar from the rack bends to an L; the bar from the water stays straight.
  const rack = tries.find((q) => q.how === 'rack');
  const water = tries.find((q) => q.how === 'water');
  assert.ok(bends.some((b) => b.id === rack.id && b.look === 'bar-bent'));
  assert.ok(bends.some((b) => b.id === water.id && b.look === 'bar-straight'));
  const parts = figureOf(lookOfKey('bar-bent'), 'coarse').parts;
  const top = Math.max(...parts.map((p) => p.at[1] + p.size[1] / 2));
  assert.ok(top >= 1.6, `the arm rises to ${top.toFixed(2)}`);
  // Side by side when he says the result.
  const said = h.said.find((l) => /^smith\.(guess\.(right|wrong)|fair\.why)/.test(l.key));
  assert.ok(said, h.said.map((l) => l.key).join(', '));
  const [b1, b2] = tries.map((q) => getEntity(h.session.state, q.id)?.position);
  if (b1 && b2) {
    assert.ok(Math.abs(b1.x - b2.x) < 0.1 && Math.abs(Math.abs(b1.z - b2.z) - 1.4) < 0.2, 'the two bars side by side on the anvil');
  }
});
