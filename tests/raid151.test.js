// The raids of the slingshot after the play test of #140–#145 (#151): the throw of the elder on the
// real enemy, a stand at a post on its line, a word for a trap at the wrong post, for the gate, and
// for a snap, the pile of traps first, the rest of the share by the mats, and one thing after a
// raid.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query, command as worldCommand } from '../src/core/world/state.js';
import { along, postAt } from '../src/core/world/raids.js';
import { sessionCamera } from '../src/world/hit.js';

async function start(s, steps, profile = s.profile) {
  let session = null;
  const said = [];
  const events = [];
  const failures = await runHeadless({ ...s, profile, steps }, { onSession: (x) => {
    session = x;
    x.listen((e) => {
      events.push({ ...e, tick: x.state.tick });
      if (e.type === 'open' && e.textKey) said.push({ id: e.id, key: e.textKey, params: e.params, tick: x.state.tick });
    });
  } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const step = (each = () => {}) => {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
    each();
  };
  const run = (sec, each) => {
    for (let i = 0; i < sec / STEP; i++) step(each);
  };
  return { session, said, events, run, step };
}
const raidOf = (h) => getEntity(h.session.state, 'raid')?.raid;

for (const grade of [1, 3]) {
  test(`grade ${grade}, the first raid of the slingshot: a wave while an enemy stands at a post; the elder says that post, counts to it while the posts glow, and the stone hits that enemy; the button is the slingshot or nothing from the throw to the next press`, async () => {
    const s = load('tests/stories/raid-first-sling.json');
    const h = await start(s, s.steps.slice(0, 5), { ...s.profile, grade });
    const raid = raidOf(h);
    // Wait until an enemy stands at a post.
    let at = null;
    for (let i = 0; i < 60 / STEP && !at; i++) {
      h.step();
      const e = raid.enemies.find((x) => x.state !== 'gone' && x.state !== 'retreat' && !x.aside && postAt(raid, along(raid, x)));
      if (e) at = { e, k: raid.posts.indexOf(postAt(raid, along(raid, e))) + 1 };
    }
    assert.ok(at, 'an enemy at a post');
    const from = h.said.length;
    const evFrom = h.events.length;
    h.session.command({ type: 'wave' });
    const acts = new Set();
    h.run(12, () => acts.add(h.session.action()?.icon ?? 'none'));
    const lines = h.said.slice(from);
    const told = lines.find((l) => l.key === 'raid.demo.at');
    assert.ok(told, lines.map((l) => l.key).join(', '));
    const k = Number(String(told.params.post.key).split('.').at(-1));
    const nums = lines.filter((l) => /^num\.\d$/.test(l.key)).map((l) => Number(l.key.split('.')[1]));
    assert.deepEqual(nums, Array.from({ length: k }, (_, i) => i + 1), `he counts to the post that he says (${k})`);
    const glows = h.events.slice(evFrom).filter((e) => e.type === 'glowSeq').flatMap((e) => e.ids).filter((id) => /^post:/.test(id));
    assert.deepEqual([...new Set(glows)].slice(0, k), Array.from({ length: k }, (_, i) => `post:${i + 1}`), 'the posts up to it glow');
    const shot = h.events.slice(evFrom).find((e) => e.type === 'shoot' && e.demo);
    assert.equal(shot?.count, k * 5);
    assert.ok(h.events.slice(evFrom).some((e) => e.type === 'hit'), 'the stone hits the enemy');
    assert.ok([...acts].every((a) => a === 'sling' || a === 'none'), [...acts].join(', '));
    assert.ok(lines.some((l) => l.key.startsWith('mentor.first.you')), 'Giờ đến lượt cháu.');
  });
}

test('with no enemy at a post, the throw of the elder waits; an enemy who stands at a post stands on its line, with a stamp', async () => {
  const s = load('tests/stories/raid-first-sling.json');
  const h = await start(s, s.steps.slice(0, 5));
  const raid = raidOf(h);
  // At once: the enemies are far, none at a post.
  assert.ok(!raid.enemies.some((x) => postAt(raid, along(raid, x))));
  const from = h.said.length;
  h.session.command({ type: 'wave' });
  h.run(0.8);
  assert.ok(!h.said.slice(from).some((l) => /^num\./.test(l.key)), 'no count before an enemy stands at a post');
  // Each stand at a post is on the line: exactly at the distance of the post.
  const stamps = [];
  h.run(30, () => {
    for (const e of raid.enemies) {
      if (e.state === 'wait' && postAt(raid, along(raid, e))) assert.ok(Math.abs(along(raid, e) - postAt(raid, along(raid, e)).d) < 0.05, `${e.id} stands off its line`);
    }
  });
  for (const e of h.events) if (e.type === 'stamp') stamps.push(e);
  assert.ok(stamps.length > 0, 'a stamp at a post');
  for (let i = 1; i <= raid.posts.length; i++) assert.ok(getEntity(h.session.state, `postline:${i}`), `the line of post ${i}`);
});

test('a trap at post 2 when the villager asks for post 3: the line says both posts, and the posts up to 3 glow', async () => {
  const s = load('tests/stories/raid-soldiers-traps.json');
  const h = await start(s, s.steps.slice(0, 3));
  const raid = raidOf(h);
  assert.equal(raid.posts.findIndex((q) => q.d === raid.trapPost) + 1, 3);
  const hero = getEntity(h.session.state, 'hero');
  const trap = query(h.session.state, 'item').find((e) => e.item.kind === 'trap');
  // A tap on a trap and a press (the pick), a tap on the road at post 2 and a press (the put).
  h.session.command({ type: 'tap', target: { thing: trap.id } });
  h.run(4);
  h.session.command({ type: 'hands', id: h.session.action()?.id ?? null });
  h.run(1);
  assert.ok(hero.hands?.holds, 'a trap in the hands');
  const p2 = raid.posts[1];
  const from = h.said.length;
  const evFrom = h.events.length;
  h.session.command({ type: 'tap', target: { ground: { x: p2.x / 2, y: p2.z / 2, h: 0, thing: false, object: null } } });
  h.run(4);
  h.session.command({ type: 'hands', id: h.session.action()?.id ?? null });
  h.run(1.5);
  const l = h.said.slice(from).find((x) => x.key === 'raid.trap.wrong');
  assert.ok(l, h.said.slice(from).map((x) => x.key).join(', '));
  assert.equal(l.params.at.key, 'num.2');
  assert.equal(l.params.post.key, 'num.3');
  const glows = h.events.slice(evFrom).filter((e) => e.type === 'glowSeq').flatMap((e) => e.ids);
  assert.deepEqual(glows, ['post:1', 'post:2', 'post:3']);
});

test('at the start of the raid of the soldiers at K, the pile of traps is on the screen, and before the first trap the button is the pick with a walk to the pile', async () => {
  const s = load('tests/stories/raid-soldiers-traps.json');
  const h = await start(s, s.steps.slice(0, 3), { ...s.profile, grade: 0 });
  h.run(1);
  const a = h.session.action();
  assert.equal(a?.act, 'pick', `the act: ${a?.act}`);
  const pile = getEntity(h.session.state, 'zone:raid-traps').zone;
  const cam = sessionCamera(h.session);
  const q = cam.project(pile.x / 2, pile.y / 2, pile.z / 2);
  assert.ok(q.x > 0 && q.x < 390 && q.y > 0 && q.y < 844, `the pile at ${Math.round(q.x)}, ${Math.round(q.y)}`);
});

test('the words of the gate: the bar stops a torch (the first times in a raid); no scout lifts a torch while the elder shows a throw', async () => {
  const s = load('tests/stories/raid-scouts.json');
  const h = await start(s, s.steps);
  const stops = h.events.filter((e) => e.type === 'stop' && String(e.id).startsWith('torch:'));
  const told = h.said.filter((l) => l.key === 'raid.gate.stopped');
  if (stops.length) assert.equal(told.length, Math.min(2, stops.length), `${stops.length} stops, ${told.length} lines`);
  for (const b of h.events.filter((e) => e.type === 'burn')) assert.ok(h.said.some((l) => l.key === 'raid.gate.burn' && l.tick >= b.tick && l.tick <= b.tick + 30), 'a line after a torch over the gate');
  // During a throw of the elder: no torch.
  for (const l of h.events.filter((e) => e.type === 'light')) {
    const demo = h.said.find((x) => x.key === 'raid.demo.look' && x.tick <= l.tick && !h.said.some((y) => y.key.startsWith('mentor.first.you') && y.tick > x.tick && y.tick < l.tick));
    assert.ok(!demo, 'a torch during the throw of the elder');
  }
});

test('after the share at the foot of Trâu Sơn, the person of the rest stands within 20 half blocks of the mats; while the share goes on, the goal says the share', async () => {
  const s0 = load('tests/stories/raid-soldiers.json');
  const upto = s0.steps.findIndex((x) => x.expect?.some?.((f) => f.text?.shown === 'share.start'));
  const rest = s0.steps.findIndex((x) => x.expect?.some?.((f) => f.text?.shown === 'share.rest.hamlet'));
  let goal = null;
  let mats = null;
  const steps = s0.steps.slice(0, rest + 1).map((x, i) => (i === upto ? { ...x, expect: x.expect.filter((f) => f.entity !== 'by:share-giong') } : x));
  const h = await start(s0, steps.slice(0, upto + 1));
  goal = h.session.workGoal();
  mats = ['hero', 'nghe', 'giong'].map((w) => ({ ...getEntity(h.session.state, `mat:share-${w}`).position }));
  assert.equal(goal, 'quest.share', 'the goal says the share');
  const h2 = await start(s0, steps);
  const to = h2.session.giftTo();
  assert.ok(to, 'the rest is in the hands');
  const e = getEntity(h2.session.state, `npc:${to}`);
  const mid = { x: mats.reduce((a, p) => a + p.x, 0) / 3, z: mats.reduce((a, p) => a + p.z, 0) / 3 };
  const d = e ? Math.hypot(e.position.x - mid.x, e.position.z - mid.z) : Infinity;
  assert.ok(d <= 20, `the person of the rest is ${d.toFixed(1)} half blocks from the mats`);
  assert.notEqual(h2.session.workGoal(), 'quest.share');
});
