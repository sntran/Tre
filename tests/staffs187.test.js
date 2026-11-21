// The bamboo staffs (#187): the child follows the woodcutter to the clump (the knife is on the button
// only there), the show is in view, the number of the sample comes before the first hold, each cut
// has its word at once, the break names its piece, and the culm that grows again has its line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';

const vi = load('i18n/vi.json');
const s0 = load('tests/stories/staffs-bamboo.json');

async function afterTalk(grade = 1) {
  const upto = s0.steps.findIndex((x) => x.read === true);
  let session = null;
  const said = [];
  const events = [];
  const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade }, steps: s0.steps.slice(0, upto + 1) }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => {
        events.push({ ...e, tick: x.state.tick });
        if (e.type === 'open' && e.textKey && e.screen === 'callout') said.push({ key: e.textKey, params: e.params ?? {}, tick: x.state.tick });
      });
    },
  });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const run = (sec, until = () => false) => {
    for (let i = 0; i < sec / STEP && !until(); i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const tz = () => getEntity(session.state, 'zone:trial-staffs')?.zone;
  // To the clump, and the end of the show.
  const ready = () => {
    session.command({ type: 'tap', target: { thing: 'culm:staffs:0' } });
    run(40, () => said.some((l) => l.key === 'staffs.turn'));
    run(10, () => !session.state.entities.some((e) => e.script));
  };
  // A hold at a culm until the mark is at a ring.
  const cutAt = (culm, ring) => {
    session.command({ type: 'tap', target: { thing: `culm:staffs:${culm}` } });
    run(8, () => !getEntity(session.state, 'hero').route);
    run(1.2);
    session.command({ type: 'hold', on: true });
    run(20, () => (tz().aim?.at ?? 0) >= ring);
    session.command({ type: 'hold', on: false });
    run(0.6);
  };
  return { session, said, events, run, tz, ready, cutAt };
}

test('the talk ends with "Em theo anh ra bụi tre nhé.", and away from the clump the knife is not on the button', async () => {
  assert.equal(vi['dlg.woodcutter.staffs.k3'], 'Em theo anh ra bụi tre nhé.');
  assert.ok(!/giữ nút/i.test(vi['dlg.woodcutter.staffs.k2'] + vi['dlg.woodcutter.staffs.k3']), 'no line of the button before the knife');
  const h = await afterTalk(1);
  const hero = getEntity(h.session.state, 'hero');
  const c = h.tz().clump;
  Object.assign(hero.position, { x: c.x + 30, z: c.z + 30 });
  delete hero.route;
  h.run(1);
  assert.notEqual(h.session.action()?.act, 'slash');
});

test('the show is in view, and after "Giờ đến lượt em." the sample glows and its count and where to let go come, with the knife on the button', async () => {
  const h = await afterTalk(1);
  h.ready();
  const keys = h.said.map((l) => l.key);
  const you = keys.findIndex((k) => /mentor\.first\.you/.test(k));
  const turn = keys.indexOf('staffs.turn');
  assert.ok(you >= 0 && turn > you, keys.join(', '));
  assert.equal(h.said[turn].params.n.key, 'num.4');
  assert.equal(vi['staffs.turn'], 'Gậy mẫu có {n} đốt. Em giữ nút lớn, vạch tới đốt {n} thì buông tay.');
  assert.ok(h.events.some((e) => e.type === 'workView' && e.key === 'trial-staffs' && e.points?.length >= 2), 'the view frames the show');
  assert.ok(h.events.some((e) => (e.type === 'glowSeq' || e.type === 'seq') && (e.ids ?? []).includes('sample:staffs')), 'the sample glows');
  assert.equal(h.session.action()?.act, 'slash', 'the knife is on the button');
});

test('each cut has its word at once; the break names its piece; the culm that grows again has its line', async () => {
  const h = await afterTalk(1);
  h.ready();
  let from = h.said.length;
  h.cutAt(0, 6);
  const long = h.said.slice(from).find((l) => l.key === 'staffs.cut.long');
  assert.ok(long, h.said.slice(from).map((l) => l.key).join(', '));
  assert.equal(long.params.n.key, 'num.6');
  assert.equal(long.params.k.key, 'num.4');
  from = h.said.length;
  h.cutAt(1, 4);
  const keys = () => h.said.slice(from).map((l) => l.key);
  assert.ok(keys().includes('staffs.cut.right'), keys().join(', '));
  h.run(30, () => keys().includes('staffs.regrow'));
  assert.ok(keys().includes('staffs.broke.long'), keys().join(', '));
  assert.ok(keys().includes('staffs.regrow'), keys().join(', '));
  assert.equal(vi['staffs.broke.long'], 'Khúc trước có {n} đốt, dài hơn gậy mẫu, nên gãy.');
  assert.equal(vi['staffs.regrow'], 'Cây tre mọc lại, em chặt lại nhé.');
});

test('after the talk, the star of the clump leads the child there; at the clump it goes', async () => {
  const h = await afterTalk(1);
  const hero = getEntity(h.session.state, 'hero');
  const c = h.tz().clump;
  Object.assign(hero.position, { x: c.x + 30, z: c.z + 30 });
  delete hero.route;
  h.run(0.5);
  assert.equal(h.session.workLead(), true, 'away from the clump the work leads');
  const ui = (await import('node:fs')).readFileSync(new URL('../src/ui/village.js', import.meta.url), 'utf8');
  assert.match(ui, /lead \? markers\(\)\.filter\(\(m\) => m\.work\)/);
  Object.assign(hero.position, { x: c.x + 3, z: c.z + 3 });
  h.run(0.5);
  assert.equal(h.session.workLead(), false, 'at the clump no star');
});
