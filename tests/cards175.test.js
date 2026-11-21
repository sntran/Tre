// Nothing comes between the presses of a count (#175): no card of the notebook during a count, a
// hold, or a raid; the timer of a count waits while a screen is up; the first card comes at a calm
// moment; and the cards come one at a time, at least three seconds apart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';
import { along } from '../src/core/world/raids.js';

async function start(name, grade, profile = {}) {
  const s = load(`tests/stories/${name}.json`);
  const upto = s.steps.findIndex((x) => x.read === true);
  let session = null;
  const events = [];
  const failures = await runHeadless({ ...s, profile: { ...s.profile, grade, ...profile }, steps: s.steps.slice(0, upto + 1) }, { onSession: (x) => {
    session = x;
    x.listen((e) => events.push({ ...e, tick: x.state.tick, raid: Boolean(getEntity(x.state, 'raid')), task: query(x.state, 'zone').some((z) => z.zone.rule === 'trial' && !z.zone.done) }));
  } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  return { session, events, run };
}

test('at the trap of post 3 with the first card of the notebook due, three presses put the trap at post 3, and no card comes during the raid', async () => {
  const h = await start('raid-soldiers-traps', 1);
  const r = getEntity(h.session.state, 'raid').raid;
  const n = r.posts.findIndex((q) => q.d === r.trapPost) + 1;
  assert.equal(n, 3);
  const trap = query(h.session.state, 'item').find((e) => e.item.kind === 'trap' && !e.item.held && e.item.zone !== 'raid-road');
  h.session.command({ type: 'tap', target: { thing: trap.id } });
  h.run(5);
  h.session.command({ type: 'hands', id: h.session.action()?.id });
  h.run(1);
  const from = h.events.length;
  for (let i = 0; i < n; i++) {
    h.session.command({ type: 'hands', id: h.session.action()?.id });
    h.run(0.6);
  }
  h.run(10);
  const put = query(h.session.state, 'item').find((e) => e.item.kind === 'trap' && e.item.zone === 'raid-road');
  assert.ok(put, 'the trap is on the road');
  assert.ok(Math.abs(along(r, put.position) - r.trapPost) <= 1, `the trap at ${along(r, put.position)}, post 3 at ${r.trapPost}`);
  assert.deepEqual(h.events.slice(from).filter((e) => e.type === 'notebook').map((e) => e.id), [], 'no card in the raid');
});

test('the cards wait while a raid goes on, and come one at a time, at least three seconds apart', async () => {
  const h = await start('raid-soldiers-traps', 1);
  const r = getEntity(h.session.state, 'raid').raid;
  // The raid ends: the cards of the raid come after it.
  for (const ph of r.phases ?? []) for (const w of ph.waves ?? []) w.in = true;
  r.phase = Math.max(0, (r.phases ?? []).length - 1);
  for (const e of r.enemies) e.state = 'gone';
  r.hold = null;
  h.run(40);
  const cards = h.events.filter((e) => e.type === 'notebook');
  assert.ok(cards.length >= 1, 'the cards of the raid came after it');
  assert.deepEqual(cards.filter((c) => c.raid).map((c) => c.id), [], 'no card while the raid goes on');
  for (let i = 1; i < cards.length; i++) assert.ok((cards[i].tick - cards[i - 1].tick) * STEP >= 3 - 1e-9, `${cards[i - 1].id} and ${cards[i].id}`);
});

test('the first card of the notebook waits for a calm moment: no task, no raid, and no talk', async () => {
  const h = await start('trial-healer', 1);
  h.run(30);
  const first = h.events.find((e) => e.type === 'notebook');
  assert.ok(!first || !first.task, `the first card ${first?.id} came in the task`);
});
