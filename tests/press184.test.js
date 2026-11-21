// A press is never lost (#184): presses during a walk do their acts at the end of the walk, one
// act for each press; a hold before the knife is ready says "not now" and the woodcutter says to
// wait, never silence; a press from away at the forge walks to the anvil and does not dip; and a
// press just after the act of the button changed does the act that the button showed before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';

function tools(session) {
  const said = [];
  const events = [];
  session.listen((e) => {
    events.push(e);
    if (e.type === 'open' && e.textKey) said.push(e.textKey);
  });
  const run = (sec, until = () => false) => {
    for (let i = 0; i < sec / STEP && !until(); i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const press = () => session.command({ type: 'hands', id: session.action()?.id });
  // The answers to presses with no act and no "not now": a lost press.
  const lost = () => events.filter((e) => e.type === 'press' && !e.done && !e.wait && !e.again && !e.nope && !e.arrive);
  return { session, said, events, run, press, lost };
}

async function playTo(name, upto, grade = null) {
  const s0 = load(`tests/stories/${name}.json`);
  let session = null;
  const failures = await runHeadless({ ...s0, ...(grade ? { profile: { ...s0.profile, grade } } : {}), steps: upto(s0.steps) }, { onSession: (x) => { session = x; } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  return tools(session);
}

test('bà lang: three presses during the walk to a bed each put a bunch in the basket at the end of the walk', async () => {
  const h = await playTo('trial-healer', (steps) => [...steps.slice(0, steps.findIndex((x) => x.read === true) + 1), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 90 } }, { wait: 2 }], 4);
  const s = h.session;
  const basket = getEntity(s.state, 'zone:basket').zone;
  const hero = getEntity(s.state, 'hero').position;
  // The hero walks away, then a tap on a bunch of a bed walks back.
  s.command({ type: 'tap', target: { ground: { x: (hero.x + 16) / 2, y: (hero.z + 8) / 2, h: 3, thing: false, object: null } } });
  h.run(5);
  const bed = query(s.state, 'zone').find((z) => /^zone:bed-/.test(z.id));
  const before = basket.items.length;
  s.command({ type: 'tap', target: { thing: bed.zone.items[0] } });
  h.run(0.3);
  assert.ok(getEntity(s.state, 'hero').route, 'the hero walks');
  for (let i = 0; i < 3; i++) {
    h.press();
    h.run(0.3);
  }
  h.run(8);
  assert.equal(basket.items.length - before, 3, 'one bunch for each press');
  assert.deepEqual(h.lost(), []);
});

test('the staffs: a hold while the woodcutter shows the first cut says "not now", and he says to wait; never silence', async () => {
  const h = await playTo('staffs-bamboo', (steps) => steps.slice(0, steps.findIndex((x) => x.read === true) + 1), 1);
  const s = h.session;
  s.command({ type: 'tap', target: { thing: 'culm:staffs:0' } });
  h.run(30, () => s.mentorOf('trial-staffs') && getEntity(s.state, 'script:trial-staffs')?.script.move === 'first');
  assert.equal(getEntity(s.state, 'script:trial-staffs')?.script.move, 'first', 'the show plays');
  const from = h.events.length;
  s.command({ type: 'hold', on: true });
  h.run(1);
  s.command({ type: 'hold', on: false });
  h.run(0.5);
  const after = h.events.slice(from);
  assert.ok(after.some((e) => e.type === 'nope'), 'a "not now" sound and shake');
  assert.ok(after.some((e) => e.type === 'open' && e.textKey === 'mentor.wait.show.em'), after.filter((e) => e.textKey).map((e) => e.textKey).join(', '));
  assert.equal(load('i18n/vi.json')['mentor.wait.show.em'], 'Chờ anh chặt xong nhé.');
});

test('the forge: a press from the bellows, with no tap, walks to the anvil and does not dip; the next press dips', async () => {
  const h = await playTo('forge-horse', (steps) => steps.slice(0, steps.findIndex((x) => x.until?.event === 'fire') + 1));
  const s = h.session;
  const tz = getEntity(s.state, 'zone:trial-horse').zone;
  const bellows = getEntity(s.state, 'bellows:horse').position;
  Object.assign(getEntity(s.state, 'hero').position, { x: bellows.x + 2, z: bellows.z + 1 });
  // Wait for the red bar on the anvil.
  h.run(20, () => (getEntity(s.state, 'iron:horse')?.glow ?? 0) >= 0.9 && tz.heat !== null);
  const dips = () => h.events.filter((e) => e.type === 'quench' || e.type === 'bend' || (e.type === 'press' && e.act === 'quench')).length;
  const before = dips();
  // One press with no tap: the button shows the dip, and the press walks.
  assert.equal(s.action()?.act, 'quench');
  h.press();
  h.run(0.5);
  h.run(6, () => !getEntity(s.state, 'hero').route);
  h.run(0.8);
  assert.equal(dips(), before, 'no dip at the end of the walk');
  assert.ok(h.events.some((e) => e.type === 'press' && e.arrive === 'quench'), 'the press stops at the anvil');
  assert.equal(s.action()?.act, 'quench', 'the button shows the dip');
  h.press();
  h.run(1);
  assert.ok(dips() > before, 'the next press dips');
});

test('a press 0.3 s after the act of the button changed does the act that the button showed before', async () => {
  let session = null;
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'giong.spoke': true, 'nghe.named': true } };
  await runHeadless({ name: 'x', profile, clock: 540, at: ['phu-dong', 20, 20], steps: [{ wait: 1 }] }, { onSession: (s) => { session = s; } });
  const h = tools(session);
  const hero = getEntity(session.state, 'hero');
  const nghe = session.state.entities.find((e) => e.follow?.target === 'hero');
  Object.assign(nghe.position, { x: hero.position.x + 1.5, z: hero.position.z });
  h.run(1.5);
  assert.equal(session.action()?.act, 'ride');
  // A person comes next to the hero: the button changes to the talk.
  const npc = session.state.entities.find((e) => e.person && e.id.startsWith('npc:') && !e.hidden);
  Object.assign(npc.position, { x: hero.position.x - 1.2, z: hero.position.z + 0.4 });
  if (npc.route) delete npc.route;
  h.run(0.1);
  const now = session.action()?.act;
  assert.notEqual(now, 'ride', `the button changed (${now})`);
  h.run(0.2);
  h.press();
  h.run(0.6);
  assert.ok(hero.riding, 'the press does the ride that the button showed before');
  assert.deepEqual(h.lost(), []);
});
