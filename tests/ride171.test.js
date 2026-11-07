// The ride shows (#171): the hero jumps up onto Nghé and sits on her back, the picture of the
// button is a buffalo calf with horns, and after the get off the hero stands beside Nghé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the hero jumps up onto Nghé, and gets down beside her', async () => {
  const s = load('tests/stories/raid-river-night.json');
  let session = null;
  const failures = await runHeadless({ ...s, steps: [] }, { onSession: (x) => { session = x; } });
  assert.deepEqual(failures, []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  run(1);
  const nghe = query(session.state, 'follow')[0];
  const hero = getEntity(session.state, 'hero');
  Object.assign(nghe.position, { x: hero.position.x + 1, z: hero.position.z });
  session.command({ type: 'ride', mount: nghe.id });
  let jumped = false;
  for (let i = 0; i < 6; i++) {
    session.step();
    session.events();
    jumped ||= Boolean(hero.cheer);
  }
  assert.equal(hero.riding, nghe.id, 'on Nghé');
  assert.ok(jumped, 'the hero jumps up');
  run(1);
  session.command({ type: 'ride', mount: nghe.id });
  run(0.2);
  assert.ok(!hero.riding, 'down');
  const d = Math.hypot(hero.position.x - nghe.position.x, hero.position.z - nghe.position.z);
  assert.ok(d >= 1.5, `the hero stands ${d.toFixed(2)} half blocks from Nghé`);
});

test('the seat is on the back of Nghé, and the pictures of the ride are a buffalo calf with horns', () => {
  const seat = Number(/const RIDER = ([\d.]+);/.exec(src('src/render/figure3d.js'))[1]);
  assert.ok(seat >= 0.7, `the seat: ${seat}`);
  for (const f of ['art/ui/ride.svg', 'art/ui/ride-off.svg']) {
    const svg = src(f);
    // Two horns, light on dark, that curve out from the head.
    assert.equal((svg.match(/stroke="#a79f90" stroke-width="[\d.]+"\/>/g) ?? []).length, 1, f);
    assert.match(svg, /Q3\d(\.\d)?,\d+(\.\d)? 3\d(\.\d)?,1\d/, f);
  }
});
