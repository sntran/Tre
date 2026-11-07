// The throw of the coach in a raid (#156): while he shows, the enemies hold still, no new enemy and
// no torch comes, he shows on the enemy that has time, an enemy at the gate gets one stone first,
// and an example never costs the raid. A lost raid of the slingshot says the count to try.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { along, postAt } from '../src/core/world/raids.js';

async function inRaid(name, grade) {
  const s = load(`tests/stories/${name}.json`);
  const upto = s.steps.findIndex((x) => x.read === true);
  let session = null;
  const said = [];
  const events = [];
  const failures = await runHeadless({ ...s, profile: { ...s.profile, grade }, steps: s.steps.slice(0, upto + 1) }, { onSession: (x) => {
    session = x;
    x.listen((e) => {
      events.push({ ...e, tick: x.state.tick });
      if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, tick: x.state.tick });
    });
  } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const raid = () => getEntity(session.state, 'raid')?.raid;
  const step = () => {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
  };
  return { session, said, events, raid, step };
}

for (const [name, grade] of [['raid-river', 3], ['raid-scouts', 3], ['raid-first-sling', 1]]) {
  test(`${name}, grade ${grade}: from the count of the coach to the end of his throw no enemy moves; the throw hits; no loss, no torch, and no take in the ten seconds after the tap on the hand`, async () => {
    const h = await inRaid(name, grade);
    // Wait until an enemy is at a post (two enemies near the wall, when the raid has them).
    for (let i = 0; i < 90 / STEP; i++) {
      h.step();
      const r = h.raid();
      if (!r) break;
      const at = r.enemies.filter((e) => e.state !== 'gone' && e.state !== 'retreat' && postAt(r, along(r, e)));
      if (at.length >= Math.min(2, r.enemies.length) && at.length) break;
    }
    const r = h.raid();
    assert.ok(r && !r.result, 'the raid goes on');
    const from = h.events.length;
    const tick0 = h.session.state.tick;
    h.session.command({ type: 'wave' });
    let still = null;
    let moved = [];
    let end = null;
    for (let i = 0; i < 10 / STEP; i++) {
      h.step();
      if (r.still && !still) still = new Map(r.enemies.map((e) => [e.id, { x: e.x, z: e.z }]));
      if (r.still && still) {
        for (const e of r.enemies) {
          const p = still.get(e.id);
          if (p && e.state !== 'retreat' && Math.hypot(e.x - p.x, e.z - p.z) > 0.05) moved.push(e.id);
        }
      }
      if (still && !r.still && end === null) end = h.session.state.tick;
    }
    const evs = h.events.slice(from);
    assert.ok(still, 'the coach counts on an enemy');
    assert.deepEqual([...new Set(moved)], [], 'an enemy moved during the throw');
    assert.ok(evs.some((e) => e.type === 'shoot' && e.demo), 'the throw');
    assert.ok(evs.some((e) => e.type === 'hit'), 'the throw hits');
    assert.ok(!evs.some((e) => e.type === 'end' && !e.won), 'no loss in the ten seconds');
    assert.ok(!evs.some((e) => e.type === 'take' && e.tick < (end ?? Infinity)), 'no take during the example');
    assert.ok(!evs.some((e) => e.type === 'light' && e.tick > tick0 && e.tick < (end ?? Infinity)), 'no torch during the example');
    assert.ok(!evs.some((e) => e.type === 'come' && e.tick > tick0 && e.tick < (end ?? Infinity)), 'no new enemy during the example');
  });
}

test('the coach shows on the enemy at the post that is farthest from the wall', async () => {
  const h = await inRaid('raid-river', 3);
  let pick = null;
  for (let i = 0; i < 90 / STEP && !pick; i++) {
    h.step();
    const r = h.raid();
    const at = r.enemies.filter((e) => e.state !== 'gone' && e.state !== 'retreat' && !e.aside && postAt(r, along(r, e)));
    if (at.length >= 2) pick = at.map((e) => postAt(r, along(r, e)).d);
  }
  if (!pick) return; // the raid has one enemy at a post at a time at this grade
  h.session.command({ type: 'wave' });
  const said = h.said.length;
  for (let i = 0; i < 4 / STEP; i++) h.step();
  const told = h.said.slice(said).find((l) => l.key === 'raid.demo.at');
  assert.ok(told);
  const r = h.raid();
  const k = r.posts.findIndex((q) => q.d === Math.max(...pick)) + 1;
  assert.ok(h.events.some((e) => e.type === 'open' && e.textKey === 'raid.demo.at' && e.params?.post?.key === `ord.${k}`), `the post ${k}`);
});

test('an enemy past the last post when the child taps the hand gets one stone of the coach first', async () => {
  const h = await inRaid('raid-river', 3);
  let near = null;
  for (let i = 0; i < 120 / STEP && !near; i++) {
    h.step();
    const r = h.raid();
    if (!r || r.result) break;
    // Hold the aim off, so that the enemy walks past the last post.
    const first = Math.min(...r.posts.map((q) => q.d));
    near = r.enemies.find((e) => e.state === 'walk' && along(r, e) < first - 1) ?? null;
    if (!near) for (const e of r.enemies) if (e.state === 'wait') e.t = 0;
  }
  if (!near) return;
  const from = h.events.length;
  h.session.command({ type: 'wave' });
  for (let i = 0; i < 3 / STEP; i++) h.step();
  const evs = h.events.slice(from);
  assert.ok(evs.some((e) => e.type === 'shoot' && e.demo), 'the stone of the coach');
  assert.ok(!evs.some((e) => e.type === 'take'), 'no take');
});

test('a lost raid of the slingshot says the count to try before the line of the dawn', async () => {
  const h = await inRaid('raid-river', 3);
  // The last enemy took at the ford, and the raid allows no take: the raid is lost.
  const r = h.raid();
  for (const ph of r.phases) for (const w of ph.waves ?? []) w.in = true;
  r.phase = r.phases.length - 1;
  for (const e of r.enemies) e.state = 'gone';
  r.losses = 1;
  r.allow = 0;
  for (let i = 0; i < 5 / STEP && !h.events.some((e) => e.type === 'end'); i++) h.step();
  for (let i = 0; i < 2 / STEP; i++) h.step();
  const end = h.events.find((e) => e.type === 'end');
  assert.ok(end && !end.won, 'the raid is lost');
  const keys = h.said.map((l) => l.key);
  const count = keys.indexOf('raid.lost.count');
  assert.ok(count >= 0, keys.slice(-6).join(', '));
  assert.ok(count < keys.indexOf('raid.river.lost'), 'before the line of the dawn');
  assert.match(load('i18n/vi.json')['raid.lost.count'], /bấm nút lớn bấy nhiêu lần/);
});
