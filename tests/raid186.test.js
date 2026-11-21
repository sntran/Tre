// The soldiers on the road (#186): a soldier never draws pale (the post behind him shows through
// him as an outline), a soldier who retreats leaves the road in 2 s, one rule decides "at a post"
// for the ring of the count and the throw, no line of the rules comes during a count, a soldier
// waits at a post at most 4 s, and a slow count of grade 2 still adds up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { readFileSync } from 'node:fs';
import { getEntity } from '../src/core/world/state.js';
import { along, RETREAT_TIME } from '../src/core/world/raids.js';

const s0 = load('tests/stories/raid-soldiers.json');

async function inRaid(upto) {
  let session = null;
  const events = [];
  const failures = await runHeadless({ ...s0, steps: s0.steps.slice(0, upto) }, { onSession: (x) => {
    session = x;
    x.listen((e) => events.push({ ...e, tick: x.state.tick }));
  } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const run = (sec, each = () => {}) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
      each();
    }
  };
  return { session, events, run, raid: () => getEntity(session.state, 'raid')?.raid };
}
// The raid of the slingshot: after the first soldier stops at a post.
const atSling = () => inRaid(s0.steps.findIndex((x) => x.until?.event === 'pause') + 1);

test('no soldier draws pale during the raid', async () => {
  const h = await atSling();
  let pale = 0;
  h.run(20, () => { if ([...h.session.seeThrough()].some((id) => String(id).startsWith('raider:'))) pale += 1; });
  assert.equal(pale, 0);
});

test('a soldier who retreats is gone from the road in 2 s', async () => {
  const h = await atSling();
  const e = h.raid().enemies.find((x) => x.state !== 'gone');
  e.hits = e.max;
  e.state = 'retreat';
  h.run(RETREAT_TIME + 0.3);
  assert.equal(RETREAT_TIME, 2);
  assert.equal(e.state, 'gone');
});

test('a count whose ring is on a soldier throws the stone, also when he stands a little off the post', async () => {
  const h = await atSling();
  const r = h.raid();
  const e = r.enemies.find((x) => x.state !== 'gone' && x.state !== 'retreat');
  // Two presses: the ring at 10 half blocks. The soldier 1.3 half blocks behind it (off the post,
  // inside the reach of a hit).
  const at = 10 + 1.3;
  const d0 = along(r, e);
  e.x += r.dir.x * (at - d0);
  e.z += r.dir.z * (at - d0);
  e.state = 'wait';
  e.t = 10;
  const from = h.events.length;
  for (let i = 0; i < 2; i++) {
    h.session.command({ type: 'hands', id: h.session.action()?.id });
    h.run(0.4);
  }
  h.run(5);
  const after = h.events.slice(from);
  assert.ok(!after.some((x) => x.type === 'nopost'), 'no "Lính chưa tới cột nào"');
  assert.ok(after.some((x) => x.type === 'shoot'), after.map((x) => x.type).join(' '));
  // The hero stays while the stone flies, and the stone lands at most 1.5 s after the throw.
  const shot = after.find((x) => x.type === 'shoot');
  const land = after.find((x) => x.type === 'land');
  assert.ok(land && (land.tick - shot.tick) * STEP <= 1.5, `${land && ((land.tick - shot.tick) * STEP).toFixed(2)} s`);
  const walks = after.filter((x) => x.tick > shot.tick && x.tick <= land.tick && x.type === 'walk' && x.id === 'hero');
  assert.deepEqual(walks, []);
});

test('no line of the rules comes during a count', () => {
  const src = readFileSync(new URL('../src/core/session.js', import.meta.url), 'utf8');
  assert.match(src, /if \(slingPull \|\| trapPull \|\| r\.stones\.some\(\(st\) => !st\.done\)\) return;/);
});

test('a soldier waits at a post at most 4 s, also after a loss; up to grade 2 a count waits 3.5 s after the last press', () => {
  const src = readFileSync(new URL('../src/core/session.js', import.meta.url), 'utf8');
  assert.match(src, /const RAID_STOP = Object\.freeze\(\{ first: 4, lost: 4 \}\);/);
  assert.match(src, /const FIRE_WAIT = Number\(profile\.grade\) <= 2 \? 3\.5 : 1\.8;/);
});
