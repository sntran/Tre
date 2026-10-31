// The healer at grade 4 after the play test of #135–#139 (#144): "thang" has its word line, the
// packet is never "lá", each put has its line, next to bà lang the button gives the basket, no
// "come to me" next to her, no break while the child puts, and the model is big enough to count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { createI18n } from '../src/core/i18n.js';
import { wordList, freshWords } from '../src/core/words.js';
import { sessionCamera } from '../src/world/hit.js';

const s0 = load('tests/stories/trial-healer.json');
const first = s0.steps.findIndex((x) => x.read === true) + 1;
const viDict = load('i18n/vi.json');
const vi = createI18n(viDict, 'vi');

async function atHealer(grade = 4) {
  let session = null;
  const said = [];
  const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade }, steps: [...s0.steps.slice(0, first), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 90 } }, { wait: 2 }] }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => {
        if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, params: e.params ?? {}, t: x.state.tick * STEP });
      });
    },
  });
  assert.deepEqual(failures, []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const press = (sec = 1.5) => { session.command({ type: 'hands', id: session.action()?.id }); run(sec); };
  const zone = (id) => getEntity(session.state, `zone:${id}`)?.zone;
  const tapThing = (id) => { session.command({ type: 'tap', target: { thing: id } }); run(4); };
  const bedThing = (k) => zone(`bed-${k}`).items.find((id) => !getEntity(session.state, id)?.item.held);
  const hero = () => getEntity(session.state, 'hero');
  const healer = () => getEntity(session.state, 'npc:healer');
  // A bunch of a kind from its bed into the basket: a tap on the bed, a press (pick and put).
  const put = (k) => {
    tapThing(bedThing(k));
    press();
    if (hero().hands?.holds) press();
  };
  return { session, said, run, press, zone, tapThing, bedThing, hero, healer, put };
}

test('at the level of the model: the first line with "thang" has the word line, and no line of the healer calls the packet "lá"', async () => {
  const h = await atHealer(4);
  const list = wordList(viDict);
  const flags = {};
  let thang = null;
  for (const l of h.said) {
    const text = vi.t(l.key, l.params);
    const { say, seen } = freshWords(text, list, flags, viDict[l.key] ?? null);
    for (const id of seen) flags[`word.${id}`] = true;
    if (seen.includes('thang')) {
      thang = { key: l.key, say: say.map((w) => w.id) };
      break;
    }
  }
  assert.ok(thang, h.said.map((l) => l.key).join(', '));
  assert.deepEqual(thang.say, ['thang'], `the first line with thang: ${thang.key}`);
  assert.equal(vi.t('word.thang'), 'Một thang thuốc là một gói lá thuốc, đủ cho một lần sắc.');
  for (const [k, v] of Object.entries(viDict)) {
    if (!/healer/.test(k)) continue;
    assert.ok(!/lá này|mỗi lá|một lá là/i.test(v), `${k}: "${v}"`);
  }
  assert.match(vi.t('dlg.healer.trial.n4.model', { k: { key: 'num.4' } }), /Giỏ mẫu có hai gói\. Mỗi gói là một thang\./);
});

test('each put has its put line, also while a help plays; no break while the child puts; next to her the act is the give, and no "come to me"', async () => {
  const h = await atHealer(4);
  const plan = h.zone('trial-healer').plan;
  assert.equal(plan.form, 'model');
  // A wrong basket, and a give: the help of the level comes after it.
  for (const k of ['ngai', 'tiato']) h.put(k);
  h.session.command({ type: 'tap', target: { person: 'npc:healer' } });
  h.run(4);
  h.press(25);
  // Then puts, one after the other, while the help would play.
  const from = h.said.length;
  let puts = 0;
  for (const k of ['ngai', 'tiato', 'rauma', 'ngai', 'tiato', 'rauma', 'tiato', 'tiato']) {
    const before = h.said.length;
    const n = h.zone('basket').items.length;
    h.put(k);
    if (h.zone('basket').items.length > n) {
      puts += 1;
      const lines = h.said.slice(before).map((l) => l.key);
      assert.ok(lines.some((x) => /^healer\.(put|more)\./.test(x)), `a put with no put line: ${lines.join(', ')}`);
    }
  }
  assert.ok(puts >= 6, `${puts} puts`);
  const during = h.said.slice(from).map((l) => l.key);
  assert.ok(!during.some((x) => x === 'mentor.break' || /break|rest/.test(x)), during.join(', '));
  // Next to her with the basket: the give, never the talk; no line that says to come to her.
  const hp = h.healer().position;
  Object.assign(h.hero().position, { x: hp.x + 2, z: hp.z + 1 });
  delete h.hero().route;
  h.run(0.5);
  for (let i = 0; i < 3 && h.hero().hands?.holds; i++) h.press();
  Object.assign(h.hero().position, { x: hp.x + 2, z: hp.z + 1 });
  delete h.hero().route;
  h.run(0.5);
  const a = h.session.action();
  assert.equal(a?.act, 'give', `the act next to her: ${a?.act} ${a?.target} holds ${h.hero().hands?.holds}`);
  h.session.command({ type: 'wave' });
  h.run(8);
  assert.notEqual(h.session.action()?.act, 'talk');
  assert.ok(!h.said.slice(from).some((l) => l.key === 'mentor.healer.give'), 'no "come to me" next to her');
});

test('a press next to her while she lays out the doses never puts them back before her count', async () => {
  const h = await atHealer(4);
  for (const k of ['ngai', 'tiato', 'rauma', 'rauma']) h.put(k);
  h.session.command({ type: 'tap', target: { person: 'npc:healer' } });
  h.run(4);
  h.press(0.5);
  const tz = h.zone('trial-healer');
  // While she lays out: presses.
  for (let i = 0; i < 6 && !h.said.some((l) => l.key === 'healer.dose.lack'); i++) {
    const a = h.session.action();
    assert.notEqual(a?.act, 'talk', 'no talk while she lays out');
    h.press(1);
  }
  h.run(20);
  assert.ok(h.said.some((l) => l.key === 'healer.dose.lack'), `her count: ${h.said.map((l) => l.key).join(', ')}`);
  assert.ok(tz, 'the trial is open');
});

test('at 390 × 844, while a line names a packet, the view shows a bunch of the model at least 4 mm on the glass', async () => {
  const h = await atHealer(4);
  // A wave: the help of the level names the packet ("Một thang như gói này.").
  for (const k of ['ngai', 'tiato']) h.put(k);
  h.session.command({ type: 'tap', target: { person: 'npc:healer' } });
  h.run(4);
  h.press(20);
  h.session.command({ type: 'wave' });
  let seen = false;
  for (let i = 0; i < 30 * 15 && !seen; i++) {
    h.run(STEP);
    seen = h.session.work()?.key === 'packet';
  }
  assert.ok(seen, `the view of the packet: ${h.said.map((l) => l.key).join(', ')}`);
  const cam = sessionCamera(h.session);
  const leaf = h.zone('leaf-0');
  const bunch = getEntity(h.session.state, leaf.items[0]);
  const p = bunch.position;
  const a = cam.project(p.x / 2 - 0.3, p.y / 2, p.z / 2);
  const b = cam.project(p.x / 2 + 0.3, p.y / 2, p.z / 2);
  // A bunch is about 0.6 blocks wide (the leaves of tía tô). A phone of 390 points is about 64 mm wide: about 6.1 points in one millimeter.
  const mm = Math.hypot(a.x - b.x, a.y - b.y) / (390 / 64);
  assert.ok(mm >= 4, `a bunch is ${mm.toFixed(1)} mm`);
});
