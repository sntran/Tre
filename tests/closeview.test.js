// A closer view on a phone (#83): the hero is about 11 mm high on the glass of a phone of 390 ×
// 844, of a small phone, and of an iPad; the near view is one value that the grade sets (#84);
// each task frames its whole work with the hero and the person; a raid shows its posts and its
// enemies; each small thing takes a tap in an area of about 10 mm; and the far view of a pinch goes
// back to the near view with a walk, a face, or work.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { VIEW, REF, mmOf, viewSize, nearView, setNearView, frameWork, figureBox, inSafe, SAFE } from '../src/world/view.js';
import { tapTarget, sessionCamera, sessionScreen, TAP_AREA } from '../src/world/hit.js';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
// The height of the hero on the glass (mm): a figure of 1.5 world units.
const heroMM = (w, h) => (1.5 / viewSize(w, h, 0).h) * h * mmOf(w, h);

test('the hero is about 11 mm high on the glass of a phone, a small phone, and an iPad', () => {
  assert.equal(VIEW.zooms[0], 18);
  assert.equal(viewSize(REF.width, REF.height, 0).h, 18);
  // About 69 points high on a phone of 390 × 844.
  assert.ok(Math.abs((1.5 / 18) * 844 - 70) < 2);
  for (const [w, h] of [[390, 844], [360, 640], [820, 1180], [1024, 1366]]) {
    const mm = heroMM(w, h);
    assert.ok(mm > 10.5 && mm < 12.5, `${w} × ${h}: ${mm.toFixed(1)} mm`);
  }
  // The far view of a pinch shows more than twice the height.
  assert.ok(viewSize(390, 844, 1).h > 2 * viewSize(390, 844, 0).h);
});

test('the near view is one value that can be set (the grade, #84), and the far view does not change with it', () => {
  const was = nearView();
  try {
    setNearView(24);
    assert.equal(viewSize(390, 844, 0).h, 24);
    assert.equal(viewSize(390, 844, 1).h, 40);
    setNearView(-3);
    assert.equal(nearView(), 24, 'a bad value is not taken');
  } finally {
    setNearView(was);
  }
});

function run(session, seconds) {
  for (let i = 0; i < seconds / STEP; i++) {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
  }
}
async function afterTalk(name) {
  const story = load(`tests/stories/${name}.json`);
  const first = story.steps.findIndex((s) => s.read === true);
  let session = null;
  const failures = await runHeadless({ ...story, steps: story.steps.slice(0, first + 1) }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  run(session, 4);
  return session;
}
const half = (p) => ({ x: p.x / 2, y: (p.y ?? 0) / 2, z: p.z / 2 });

test('each task frames its whole work with the hero and the person, closer than the near view where it can', async () => {
  for (const name of ['trial-scholar', 'trial-smith', 'trial-fisher', 'trial-healer', 'trial-woodcutter']) {
    const session = await afterTalk(name);
    const work = session.work();
    assert.ok(work?.points.length, `${name}: the work in view`);
    const hero = half(getEntity(session.state, 'hero').position);
    const person = getEntity(session.state, work.person);
    const pts = [hero, ...work.points.map(half), ...(person ? [half(person.position)] : [])];
    for (const az of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      const f = frameWork(pts, { az, width: 390, height: 844, max: viewSize(390, 844, 1).h });
      assert.ok(f.fits, `${name}: the work fits`);
      const size = { w: (f.h * 390) / 844, h: f.h };
      for (const p of pts) assert.ok(inSafe(figureBox(p), f.focus, { az, size, safe: SAFE }), `${name}: a point of the work is off the screen`);
    }
    if (name === 'trial-fisher') {
      // The whole row, with the float at its end, is in the points of the frame.
      const line = getEntity(session.state, 'zone:line').zone;
      assert.ok(work.points.some((p) => p.x === line.x + line.length), 'the float');
      assert.ok(work.points.some((p) => p.x === line.x), 'the start of the row');
    }
    if (name === 'trial-woodcutter') {
      const stem = getEntity(session.state, 'zone:trial-woodcutter').zone.stem;
      assert.ok(work.points.some((p) => p.x === stem.x + stem.length), 'the end of the stem');
    }
  }
});

test('in a raid, the posts and the enemies all fit on the screen', async () => {
  const story = load('tests/stories/raid-patrol.json');
  let session = null;
  let checked = 0;
  const misses = [];
  await runHeadless(story, {
    onSession: (s) => {
      session = s;
      s.listen(() => {
        const r = getEntity(session.state, 'raid')?.raid;
        if (!r || r.result || session.state.tick % 30) return;
        const g = (p) => ({ x: p.x / 2, y: session.env.groundY(p.x / 2, p.z / 2), z: p.z / 2 });
        const hero = half(getEntity(session.state, 'hero').position);
        const pts = [hero, ...r.posts.map(g), ...r.enemies.filter((e) => e.state !== 'retreat').map(g), g({ x: r.wall.x + r.dir.x * 14, z: r.wall.z + r.dir.z * 14 })];
        checked += 1;
        if (![Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4].some((az) => frameWork(pts, { az, width: 390, height: 844, max: viewSize(390, 844, 1).h }).fits)) misses.push(session.state.tick);
      });
    },
  });
  assert.ok(checked > 0, 'the raid was checked');
  assert.deepEqual(misses, []);
});

test('a point of the row and the stem take a tap in an area of about 10 mm', async () => {
  assert.equal(TAP_AREA, 60);
  const session = await afterTalk('trial-fisher');
  const cam = sessionCamera(session);
  const w = sessionScreen(session, cam);
  const row = session.line();
  // A finger 24 points beside the point 8 of the row, at a right angle to the row on the screen:
  // the tap is on that point.
  const c = cam.project((row.x + 8) / 2, row.y / 2, row.z / 2);
  const e = cam.project((row.x + row.length) / 2, row.y / 2, row.z / 2);
  const len = Math.hypot(e.x - c.x, e.y - c.y);
  const t = tapTarget({ x: c.x - ((e.y - c.y) / len) * 24, y: c.y + ((e.x - c.x) / len) * 24 }, w);
  assert.ok(t?.ground, JSON.stringify(t));
  assert.equal(Math.round(t.ground.x * 2 - row.x), 8);
  // The woodcutter: a finger 24 points beside the line of the stem chooses the stem.
  const wood = await afterTalk('trial-woodcutter');
  const cw = sessionCamera(wood);
  const stem = getEntity(wood.state, 'stem:woodcutter');
  const s0 = cw.project((stem.position.x + 4) / 2, stem.position.y / 2 + 0.4, stem.position.z / 2);
  const ts = tapTarget({ x: s0.x, y: s0.y - 24 }, sessionScreen(wood, cw));
  assert.equal(ts?.thing, stem.id, JSON.stringify(ts));
});

test('the far view of a pinch goes back to the near view with a walk, a tap on a face, or work; the frame of a task comes back after a walk away', () => {
  const village = source('src/ui/village.js');
  assert.match(village, /function nearAgain\(\) \{\n\s+if \(view\.state\.level !== 0\) view\.setZoom\(0\);/);
  // A tap on the world, a push of the stick, a tap on a star, and the start of a work.
  assert.match(village, /if \(target && !target\.pet\) nearAgain\(\);/);
  assert.match(village, /if \(stick\.far >= 12\) nearAgain\(\);/);
  assert.match(village, /goal: true \} \} \}\);\n\s+nearAgain\(\);/);
  assert.match(village, /work = \{ points: pts, person: person \?\? null \};\n\s+nearAgain\(\);/);
  // The frame reads the work of the open task each frame (#78: after a walk away and back, the
  // view at the row stayed far).
  assert.match(village, /const live = session\.work\(\);/);
  assert.ok(!/CLOSE_WORK/.test(village), 'no fixed close views');
});
