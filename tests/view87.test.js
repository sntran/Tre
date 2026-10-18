// People and work in view (#87): people keep their colors and a covered hero shows as an outline,
// the hero does not stand behind the person of a task, the sticks of the mat make a frame of ten,
// and a tap on Nghé after a task pets her.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { getEntity, query } from '../src/core/world/state.js';
import { matSlot, MAT_ROW, MAT_FRAME } from '../src/core/world/systems/work.js';
import { figureOf } from '../src/world/figures.js';

const story = (name) => JSON.parse(readFileSync(new URL(`./stories/${name}.json`, import.meta.url), 'utf8'));
const steps = (session, seconds) => {
  for (let k = 0; k < Math.round(seconds * 30); k++) {
    session.step();
    session.events();
  }
};

test('people and animals keep their colors, and a covered hero shows as a pale outline', () => {
  const src = readFileSync(new URL('../src/render/figure3d.js', import.meta.url), 'utf8');
  assert.ok(!/f\.cover/.test(src), 'no pale tint for a person in front of the hero');
  assert.ok(/GreaterDepth/.test(src) && /stencilFuncMask: 6, stencilFunc: THREE\.EqualStencilFunc/.test(src), 'an outline of the hero where something covers it and the hero does not show');
  assert.ok(/xLine = new THREE\.InstancedMesh\(box, new THREE\.MeshBasicMaterial\(\{ \.\.\.xray, color: new THREE\.Color\(C\.yellowPale\)/.test(src), 'the outline is pale on dark clothes');
});

test('the rods of the mat make a frame of ten: thin rods, two rows apart, and the eleventh beside the frame', () => {
  const zone = { x: 0, z: 0 };
  const ten = Array.from({ length: 10 }, (_, i) => matSlot(zone, i));
  const rod = figureOf({ kind: 'rod' }, 'coarse');
  const stick = rod.parts.find((p) => (p.name ?? p.id) === 'stick');
  assert.ok(stick.size[0] <= 0.25, 'a thin rod');
  const xs = [...new Set(ten.map((p) => p.x))];
  const zs = [...new Set(ten.map((p) => p.z))];
  assert.equal(xs.length, MAT_ROW);
  assert.equal(zs.length, 2);
  // A rod shows with its ink outline (about 0.4 half blocks); the space between two rods is wider (#98).
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] - stick.size[0] >= 0.7, 'a space between two rods');
  assert.ok(zs[1] - zs[0] - stick.size[2] >= 0.8, 'a space between the two rows');
  // The rods over ten lie beside the frame, not on it.
  for (let i = 10; i < 14; i++) {
    const p = matSlot(zone, i);
    assert.ok(p.x - stick.size[0] / 2 > MAT_FRAME + 0.3, `rod ${i + 1} is outside the frame`);
    assert.ok(!ten.some((q) => Math.abs(q.x - p.x) < 0.7 && Math.abs(q.z - p.z) < 1.2));
    for (let j = 10; j < i; j++) {
      const q = matSlot(zone, j);
      assert.ok(Math.abs(q.x - p.x) >= 0.9 || Math.abs(q.z - p.z) >= 1.2, `rod ${i + 1} lies apart from rod ${j + 1}`);
    }
  }
});

test('after the task of the teacher, a tap on Nghé on the things of the done task pets her', async () => {
  const { tapTarget, viewCamera, sessionScreen } = await import('../src/world/hit.js');
  let session = null;
  const s = story('trial-scholar');
  s.steps.push({ wait: 1 }, { read: true }, { wait: 2 });
  await runHeadless(s, { onSession: (x) => { session = x; } });
  assert.ok(getEntity(session.state, 'zone:trial-scholar').zone.done);
  const nghe = session.state.entities.find((e) => e.follow?.target === 'hero');
  const rod = query(session.state, 'item', 'position').find((e) => e.item.task === 'trial-scholar' && !e.hidden);
  assert.ok(rod, 'a thing of the done task');
  Object.assign(nghe.position, { x: rod.position.x, z: rod.position.z });
  const at = { x: nghe.position.x / 2, y: nghe.position.y / 2, z: nghe.position.z / 2 };
  const cam = viewCamera({ focus: at, width: 390, height: 844 });
  assert.deepEqual(tapTarget(cam.project(at.x, at.y + 0.5, at.z), sessionScreen(session, cam)), { pet: nghe.id });
  assert.equal(session.openThing(rod.id), false);
});

test('at a task, when the hero stands still behind the person, as the camera sees it, the person steps to the side', async () => {
  let session = null;
  const s = story('practice-bo-que');
  s.steps = s.steps.slice(0, 5);
  await runHeadless(s, { onSession: (x) => { session = x; } });
  assert.ok(session.mentorTask, 'at the task');
  const teacher = getEntity(session.state, 'npc:teacher');
  const hero = getEntity(session.state, 'hero');
  // The camera looks from (sin az, cos az) with az = PI / 4: the hero 1.5 half blocks behind him.
  const c = Math.SQRT1_2;
  Object.assign(hero.position, { x: teacher.position.x - c * 1.5, z: teacher.position.z - c * 1.5 });
  const at = { ...hero.position };
  steps(session, 6);
  const dx = teacher.position.x - hero.position.x;
  const dz = teacher.position.z - hero.position.z;
  const along = dx * c + dz * c;
  const side = Math.abs(dx * c - dz * c);
  assert.ok(along < 0.2 || along > 2.5 || side > 1.4, `the hero is not behind the teacher (along ${along.toFixed(1)}, side ${side.toFixed(1)})`);
  assert.ok(Math.hypot(hero.position.x - at.x, hero.position.z - at.z) < 0.5, 'the hero stays at the work');
});
