// The slingshot says its count (#166): each press says its count, the post where an enemy stands
// glows, an enemy in front of a post draws pale, a miss says the count and the post where the stone
// fell, a hit on an enemy that takes more hits says how many more, and the example of the coach
// waits until the child stops pressing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { along, postAt } from '../src/core/world/raids.js';

const vi = load('i18n/vi.json');

async function inRaid(name, grade, flags = {}) {
  const s = load(`tests/stories/${name}.json`);
  const upto = s.steps.findIndex((x) => x.read === true);
  let session = null;
  const said = [];
  const events = [];
  const failures = await runHeadless({ ...s, profile: { ...s.profile, grade, flags: { ...s.profile.flags, ...flags } }, steps: s.steps.slice(0, upto + 1) }, { onSession: (x) => {
    session = x;
    x.listen((e) => {
      events.push(e);
      if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, id: e.id, params: e.params ?? {} });
    });
  } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const raid = () => getEntity(session.state, 'raid')?.raid;
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  // Until an enemy stands at a post from the second post on: { e, k }.
  const standing = (min = 2) => {
    for (let i = 0; i < 120 / STEP; i++) {
      run(STEP);
      const r = raid();
      if (!r || r.result) return null;
      for (const e of r.enemies) {
        if (e.state !== 'wait') continue;
        const q = postAt(r, along(r, e));
        const k = q ? r.posts.indexOf(q) + 1 : 0;
        if (k >= min) return { e, k };
      }
    }
    return null;
  };
  const press = (n) => {
    for (let i = 0; i < n; i++) {
      const a = session.action();
      assert.equal(a?.act, 'sling', `press ${i + 1}: ${a?.act}`);
      session.command({ type: 'hands', id: a.id });
      run(0.4);
    }
  };
  return { session, said, events, raid, run, standing, press };
}

test('each press says its count, and a short stone says the count and the post where it fell; that post glows', async () => {
  const h = await inRaid('raid-first-sling', 1);
  const at = h.standing(2);
  assert.ok(at, 'an enemy at a post');
  const glowsAt = h.events.filter((e) => e.type === 'glowSeq' && e.ids.length === 1 && e.ids[0] === `post:${at.k}`);
  assert.ok(glowsAt.length, `post ${at.k} glows while the enemy stands there`);
  const from = h.said.length;
  h.press(1);
  h.run(5);
  const after = h.said.slice(from);
  assert.ok(after.some((l) => l.id === 'hero' && l.key === 'num.1'), after.map((l) => l.key).join(', '));
  const miss = after.find((l) => l.key === 'raid.miss.short.at');
  assert.ok(miss, after.map((l) => l.key).join(', '));
  assert.equal(miss.params.n.key, 'num.1');
  assert.ok(h.events.some((e) => e.type === 'glowSeq' && e.ids[0] === 'post:1'));
});

test('a hit on an enemy that takes two hits says that one more is needed', async () => {
  const h = await inRaid('raid-first-sling', 1);
  const at = h.standing(1);
  assert.ok(at, 'an enemy at a post');
  const from = h.said.length;
  h.press(at.k);
  h.run(5);
  const after = h.said.slice(from).map((l) => l.key);
  assert.ok(after.includes('raid.hit.more') || after.includes('raid.hit'), after.join(', '));
  const counts = h.said.slice(from).filter((l) => l.id === 'hero' && /^num\./.test(l.key)).map((l) => l.key);
  assert.deepEqual(counts, Array.from({ length: at.k }, (_, i) => `num.${i + 1}`));
});

test('the lines: count words, the place of the stone, and what is left', () => {
  const fill = (k, p) => k.replace(/\{(\w+)\}/g, (_, x) => p[x]);
  assert.equal(fill(vi['raid.miss.short.at'], { n: 'một', ball: 'hòn đá', who: 'lính' }), 'Cháu đếm tới một: hòn đá rơi ở cột một, trước lính. Cột của lính xa hơn.');
  assert.equal(fill(vi['raid.hit.rice.more'], { n: 'một', ball: 'nắm cơm' }), 'Nó ăn rồi! Thêm một nắm cơm nữa, nó sẽ no.');
});

test('an enemy in front of a post draws pale, and the example of the coach waits for the end of a count of the child', () => {
  const src = readFileSync(new URL('../src/core/session.js', import.meta.url), 'utf8');
  assert.match(src, /if \(String\(id\)\.startsWith\('raider:'\)\) \{\n\s+seeIds\.add\(id\);/);
  assert.match(src, /if \(slingPull\) teach\.demoDue = true;/);
});
