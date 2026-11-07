// The raid of the traps at K and grade 1 (#157): one tool, a press always puts the trap, a tap at a
// post is a tap on the post, the hand says the tool of the moment, the coach counts the posts once,
// a loss says what was missing, and the speaker of a rule is where the child sees him.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';
import { raidTools, along } from '../src/core/world/raids.js';

const raids = load('data/raids.json');

async function start(name, grade, extra = {}) {
  const s = load(`tests/stories/${name}.json`);
  const upto = s.steps.findIndex((x) => x.read === true);
  let session = null;
  const said = [];
  const events = [];
  const failures = await runHeadless({ ...s, profile: { ...s.profile, grade, flags: { ...s.profile.flags, ...extra } }, steps: s.steps.slice(0, upto + 1) }, { onSession: (x) => {
    session = x;
    x.listen((e) => {
      events.push(e);
      if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, params: e.params ?? {}, speaker: e.speaker ?? null, id: e.id ?? null });
    });
  } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const press = (sec = 1) => { session.command({ type: 'hands', id: session.action()?.id ?? null }); run(sec); };
  const raid = () => getEntity(session.state, 'raid')?.raid;
  const hero = () => getEntity(session.state, 'hero');
  const pick = () => {
    const trap = query(session.state, 'item').find((e) => e.item.kind === 'trap' && !e.item.held && e.item.zone !== 'raid-road');
    session.command({ type: 'tap', target: { thing: trap.id } });
    run(5);
    press(1);
    assert.equal(getEntity(session.state, session.state.entities.find((e) => e.id === 'hero').hands?.holds)?.item.kind, 'trap', 'a trap in the hands');
  };
  return { session, said, events, run, press, raid, hero, pick };
}

test('up to grade 1 the raid soldier2 has the traps and the slingshot only, and the slingshot waits for the first trap; from grade 2 the tools come together', () => {
  const flags = { 'raid.tool.sling': true, 'raid.tool.gate': true, 'raid.tool.traps': true, 'raid.used.traps': 1 };
  for (const grade of [0, 1]) {
    const t = raidTools(raids, 'soldier2', flags, grade);
    assert.deepEqual(t.tools, ['sling', 'traps'], `grade ${grade}`);
    assert.equal(t.slingAfter, 'traps');
  }
  const two = raidTools(raids, 'soldier2', flags, 2);
  assert.ok(two.tools.includes('helpers'), 'the flags at grade 2');
  assert.equal(two.slingAfter, null);
});

test('at K in the raid of the soldiers: no flag, and no slingshot before the first trap is down', async () => {
  const h = await start('raid-soldiers-traps', 0);
  const r = h.raid();
  assert.ok(!r.tools.includes('helpers'), r.tools.join(', '));
  const acts = new Set();
  for (let i = 0; i < 6 / STEP; i++) {
    h.run(STEP);
    acts.add(h.session.action()?.act ?? 'none');
  }
  assert.ok(!acts.has('sling'), [...acts].join(', '));
  assert.ok(!h.said.some((l) => l.key === 'raid.tool.helpers'), 'no line of the flags');
});

test('at K, a press with a trap 10 half blocks from the road puts the trap on the road, and the line says where it lies and where it goes', async () => {
  const h = await start('raid-soldiers-traps', 0);
  h.pick();
  const r = h.raid();
  // The hero steps 10 half blocks away from the road, across it.
  const side = { x: -r.dir.z, z: r.dir.x };
  Object.assign(h.hero().position, { x: r.wall.x + r.dir.x * 4 + side.x * 10, z: r.wall.z + r.dir.z * 4 + side.z * 10 });
  h.run(1.5);
  assert.equal(h.session.action()?.act, 'put');
  const from = h.said.length;
  h.press(8);
  const onRoad = query(h.session.state, 'item').filter((e) => e.item.kind === 'trap' && e.item.zone === 'raid-road');
  assert.equal(onRoad.length, 1, 'the trap is on the road');
  const keys = h.said.slice(from).map((l) => l.key);
  assert.ok(keys.includes('raid.trap.wrong') || keys.includes('raid.trap.right'), keys.join(', '));
  assert.ok(!keys.every((k) => k === 'raid.trap.where'), 'not only the line again');
});

test('with a trap in the hands, a tap on Nghé who stands at post 2 is a tap on post 2', async () => {
  const h = await start('raid-soldiers-traps', 0);
  h.pick();
  const r = h.raid();
  const nghe = query(h.session.state, 'follow')[0];
  const q = r.posts[1];
  // Nghé stands beside the road at post 2, 1.5 half blocks from it.
  const side = { x: -r.dir.z, z: r.dir.x };
  Object.assign(nghe.position, { x: q.x + side.x * 1.5, z: q.z + side.z * 1.5 });
  if (nghe.follow) nghe.follow.goal = { x: nghe.position.x, z: nghe.position.z };
  h.session.command({ type: 'tap', target: { pet: nghe.id } });
  h.run(6);
  h.press(2);
  const put = query(h.session.state, 'item').find((e) => e.item.kind === 'trap' && e.item.zone === 'raid-road');
  assert.ok(put, 'the trap is on the road');
  const d = along(r, put.position);
  assert.ok(Math.abs(d - q.d) <= 1, `the trap is at ${d.toFixed(1)}, post 2 at ${q.d}`);
  assert.ok(!h.events.some((e) => e.type === 'petted'), 'no pet of Nghé');
});

test('with a trap in the hands, the hand says the line of the trap and the posts up to it glow', async () => {
  const h = await start('raid-soldiers-traps', 0);
  h.pick();
  const from = h.said.length;
  const glows = h.events.length;
  h.session.command({ type: 'wave' });
  h.run(1);
  const l = h.said.slice(from).find((x) => x.key === 'raid.trap.where');
  assert.ok(l, h.said.slice(from).map((x) => x.key).join(', '));
  assert.ok(!h.said.slice(from).some((x) => x.key === 'raid.tool.sling'), 'no line of the slingshot');
  assert.ok(h.events.slice(glows).some((e) => e.type === 'glowSeq'));
});

test('a lost raid with no trap on the road says that no trap was on the road', async () => {
  const h = await start('raid-soldiers-traps', 0);
  const r = h.raid();
  for (const ph of r.phases) for (const w of ph.waves ?? []) w.in = true;
  r.phase = r.phases.length - 1;
  for (const e of r.enemies) e.state = 'gone';
  r.hold = null;
  r.losses = 1;
  r.allow = 0;
  const from = h.said.length;
  for (let i = 0; i < 5 / STEP && !h.events.some((e) => e.type === 'end'); i++) h.run(STEP);
  h.run(2);
  const keys = h.said.slice(from).map((l) => l.key);
  assert.ok(keys.includes('raid.lost.notrap'), keys.join(', '));
});

test('at the first raid with posts, the coach counts the posts from the hero, and each post glows', async () => {
  const h = await start('raid-first-sling', 1);
  assert.ok(h.said.some((l) => l.key === 'raid.posts.count'), h.said.map((l) => l.key).join(', '));
  assert.ok(h.events.some((e) => e.type === 'glowSeq' && e.ids.length === 4), 'the four posts glow');
  assert.equal(h.session.profile.flags['raid.posts.counted'], true);
});

test('at Trâu Sơn, the rules of the raid come from a person at the wall or from Nghé, never from a person who is not there', async () => {
  const h = await start('raid-soldiers-traps', 0);
  const r = h.raid();
  for (const l of h.said) {
    if (!l.speaker || l.speaker === 'narrator') continue;
    if (l.speaker === 'nghe') continue;
    const e = getEntity(h.session.state, `npc:${l.speaker}`);
    assert.ok(e && !e.hidden && Math.hypot(e.position.x - r.wall.x, e.position.z - r.wall.z) <= 30, `${l.key} from ${l.speaker}`);
  }
});
