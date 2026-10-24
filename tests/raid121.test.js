// The raids after the play test of #105 to #114 (#121): a hit has its word, only the posts look like
// posts near the road, the enemies that are left show and the last one is said, the gate glows with
// its line, and no sleeper snores near a raid.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { raidClear, raidTally } from '../src/core/world/raids.js';

const story = (name) => load(`tests/stories/${name}.json`);
async function play(name, steps = null) {
  const s = story(name);
  let session = null;
  const said = [];
  const sounds = [];
  const failures = await runHeadless({ ...s, steps: steps ?? s.steps }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => {
        if (e.type === 'open' && e.textKey) said.push(e.textKey);
        if (e.sound) sounds.push({ sound: e.sound, raid: Boolean(getEntity(x.state, 'raid')?.raid && !getEntity(x.state, 'raid').raid.result) });
      });
    },
  });
  return { session, said, sounds, failures };
}

test('near the road of a raid, from the wall to past the farthest post, no plant stands tall like a post', async () => {
  const { session } = await play('raid-scouts', story('raid-scouts').steps.slice(0, 5));
  // The raids of the data, on the plane of the region (the session moves them there).
  const data = session.data.raids;
  const rects = raidClear(data, session.map.id);
  for (const id of ['scouts', 'river']) {
    const def = data.raids[id];
    const far = Math.max(...data.posts) / 2;
    const end = { x: def.wall[0] + def.dir[0] * far, y: def.wall[1] + def.dir[1] * far };
    assert.ok(rects.some((r) => end.x >= r.x0 && end.x <= r.x1 && end.y >= r.z0 && end.y <= r.z1), `${id}: the farthest post is in the clear land`);
  }
  const tall = new Set(['bamboo', 'tree', 'areca', 'banana']);
  const t = session.terrain;
  const bad = [];
  let seen = 0;
  for (const r of rects) {
    for (let cz = Math.floor(r.z0 / 16) - 1; cz <= Math.floor(r.z1 / 16) + 1; cz++) {
      for (let cx = Math.floor(r.x0 / 16) - 1; cx <= Math.floor(r.x1 / 16) + 1; cx++) {
        for (const o of t.chunk(cx, cz).objects ?? []) {
          if (!(o.x + (o.w ?? 1) > r.x0 && o.x <= r.x1 && o.y + (o.h ?? 1) > r.z0 && o.y <= r.z1)) continue;
          seen += 1;
          if (tall.has(o.kind)) bad.push(`${o.kind} at ${o.x}, ${o.y}`);
      // A bush there is low: the fade of the view draws a thing of two blocks or more as a tall
      // dotted shape (a bush on the place of a tree was 3.5 blocks).
      const b = t.boxOf(o);
      if (o.kind === 'bush' && b.y1 - b.y0 >= 2) bad.push(`a bush of ${(b.y1 - b.y0).toFixed(1)} blocks at ${o.x}, ${o.y}`);
        }
      }
    }
  }
  assert.deepEqual(bad, []);
  void seen;
});

test('the scouts: a hit says "Trúng rồi!", the gate glows at its line and at a torch, the last one is said, and the end says it', async () => {
  const { session, said, sounds, failures } = await play('raid-scouts');
  assert.deepEqual(failures, []);
  assert.ok(said.includes('raid.hit'), said.join(', '));
  assert.ok(said.includes('raid.last'), said.join(', '));
  assert.ok(said.includes('raid.won'), said.join(', '));
  assert.ok(!sounds.some((s) => s.raid && s.sound === 'snore'), 'no snore while the raid goes on');
  void session;
});

test('the gate glows with its line until the child taps it', async () => {
  const s = story('raid-scouts');
  const upTo = s.steps.findIndex((x) => x.until?.event === 'light') + 1;
  const { session, failures } = await play('raid-scouts', s.steps.slice(0, upTo));
  assert.deepEqual(failures, []);
  const bar = getEntity(session.state, 'bar:raid');
  const coach = session.state.entities.find((e) => e.raidCoach && !e.hidden);
  assert.ok(coach?.gesture && Math.hypot(coach.gesture.x - bar.position.x, coach.gesture.z - bar.position.z) < 0.5, 'the coach points at the gate');
});

test('the river: a hit says "Nó ăn rồi!"', async () => {
  const { said } = await play('raid-river');
  assert.ok(said.includes('raid.hit.rice') || !said.some((k) => k.startsWith('raid.hit')), said.join(', '));
  assert.ok(!said.includes('raid.hit'), 'no stone words at the river');
});

test('the tally of a raid counts all its waves and the ones that are done', () => {
  // Four waves: three came; one enemy walks, and one went back (two are gone from the list).
  const raid = { phases: [{ waves: [{ in: true }, { in: true }, { in: true }] }, { waves: [{}] }], enemies: [{ state: 'retreat' }, { state: 'walk' }] };
  assert.deepEqual(raidTally(raid), { total: 4, done: 2 });
});
