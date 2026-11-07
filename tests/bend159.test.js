// The bend of the smith at grade 5 (#159): an L that the child sees, light bars on a light plank,
// the wide view of the task with the whole smith, the hero beside the smith, and the compare side
// by side with the pebble in one frame.
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

test('the look bar-bent is an L of two parts, one flat and one upright, each at least one and a half units long, light grey on a light plank; the bar from the water is straight', () => {
  const bars = (k) => figureOf(lookOfKey(k), 'coarse').parts.filter((p) => /^bar/.test(p.name ?? p.id ?? ''));
  const l = bars('bar-bent');
  assert.equal(l.length, 2, l.map((p) => p.name).join(', '));
  const flat = l.find((p) => p.size[2] > p.size[1]);
  const up = l.find((p) => p.size[1] > p.size[2]);
  assert.ok(flat && flat.size[2] >= 1.5, 'the flat arm');
  assert.ok(up && up.size[1] >= 1.5, 'the upright arm');
  for (const p of l) assert.ok(['ashLight', 'diep', 'paper'].includes(p.color), p.color);
  const plank = figureOf(lookOfKey('bar-bent'), 'coarse').parts.find((p) => (p.name ?? '') === 'plank');
  assert.ok(plank && ['diep', 'paper'].includes(plank.color), 'a light plank');
  const straight = bars('bar-straight');
  assert.equal(straight.length, 1);
});

async function bendTest() {
  const story = load('tests/stories/smith-grade5.json');
  let session = null;
  const views = [];
  const said = [];
  const failures = await runHeadless({ ...story, steps: story.steps.slice(0, 3) }, { onSession: (s) => {
    session = s;
    s.listen((e) => {
      if (e.type === 'workView') views.push(e);
      if (e.type === 'open' && e.textKey) said.push(e.textKey);
    });
  } });
  assert.deepEqual(failures, []);
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
  return { session, views, said, run, tz };
}

test('at the bend the view is the view of the task (no close view) with the smith, the hero is not between the camera and the bars and is never pale, and at the compare the two bars and the pebble are on the screen, each bar at least 40 points long', async () => {
  const h = await bendTest();
  const d = toCamera(Math.PI / 4, VIEW.elevation);
  const blocked = [];
  let compare = null;
  h.run(25, () => {
    const t = h.tz().test;
    if (!t) return false;
    const hero = getEntity(h.session.state, 'hero');
    for (const q of t.tries) {
      const bar = getEntity(h.session.state, q.id);
      if (!bar || !/^bar-/.test(bar.look)) continue;
      if (rayHits(figureBox(hero.position, sizeOf(hero)), { x: bar.position.x / 2, y: bar.position.y / 2 + 0.3, z: bar.position.z / 2 }, d)) blocked.push(bar.look);
    }
    assert.ok(!h.session.seeThrough().has('hero'), 'the hero is pale');
    if (!compare && h.said.some((k) => /^smith\.(guess\.(right|wrong)|fair\.why)/.test(k))) {
      const cam = sessionCamera(h.session);
      compare = t.tries.map((q) => {
        const bar = getEntity(h.session.state, q.id);
        const p0 = cam.project(bar.position.x / 2, bar.position.y / 2, bar.position.z / 2 - 0.8);
        const p1 = cam.project(bar.position.x / 2, bar.position.y / 2, bar.position.z / 2 + 0.8);
        return { look: bar.look, at: cam.project(bar.position.x / 2, bar.position.y / 2, bar.position.z / 2), len: Math.hypot(p1.x - p0.x, p1.y - p0.y) };
      });
      const pebble = getEntity(h.session.state, 'pebble:smith');
      if (pebble) compare.push({ look: 'pebble', at: cam.project(pebble.position.x / 2, pebble.position.y / 2, pebble.position.z / 2), len: 40 });
    }
    return false;
  });
  const bend = h.views.filter((v) => v.key === 'smith-bend');
  assert.ok(bend.length, 'the view of the bend');
  for (const v of bend) assert.equal(v.close, undefined, 'no close view');
  assert.ok(bend.some((v) => v.points.length >= 3), 'the smith and the bars in the view');
  assert.deepEqual([...new Set(blocked)], [], 'the hero between the camera and a bar');
  assert.ok(compare, 'the compare');
  for (const c of compare) {
    assert.ok(c.at.x > 0 && c.at.x < 390 && c.at.y > 0 && c.at.y < 844, `${c.look} at ${Math.round(c.at.x)}, ${Math.round(c.at.y)}`);
    assert.ok(c.len >= 40, `${c.look} is ${c.len.toFixed(0)} points long`);
  }
});
