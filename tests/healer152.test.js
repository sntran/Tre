// Bà lang after the play test of #140–#145 (#152): no put and no take while she lays out or counts
// the basket, her count is the basket of now, and she looks like a grandmother.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { createI18n } from '../src/core/i18n.js';
import { personFine } from '../src/world/fine.js';

const s0 = load('tests/stories/trial-healer.json');
const first = s0.steps.findIndex((x) => x.read === true) + 1;
const vi = createI18n(load('i18n/vi.json'), 'vi');

async function atHealer(grade) {
  let session = null;
  const said = [];
  const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade }, steps: [...s0.steps.slice(0, first), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 90 } }, { wait: 2 }] }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => {
        if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, params: e.params ?? {} });
        if (e.type === 'call' && e.key) said.push({ key: e.key, params: e.params ?? {} });
      });
    },
  });
  assert.deepEqual(failures, []);
  const run = (sec, each = () => {}) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
      each(i);
    }
  };
  const press = (sec = 1.5) => { session.command({ type: 'hands', id: session.action()?.id ?? null }); run(sec); };
  const zone = (id) => getEntity(session.state, `zone:${id}`)?.zone;
  const hero = () => getEntity(session.state, 'hero');
  const put = (k) => {
    const id = zone(`bed-${k}`).items.find((x) => !getEntity(session.state, x)?.item.held);
    session.command({ type: 'tap', target: { thing: id } });
    run(4);
    press();
    if (hero().hands?.holds) press();
  };
  const give = () => {
    session.command({ type: 'tap', target: { person: 'npc:healer' } });
    run(4);
    press(0.5);
  };
  return { session, said, run, press, zone, put, give, hero };
}

for (const grade of [1, 4]) {
  test(`grade ${grade}: presses during her count and lay-out do not change the basket; after one wrong give with one extra bunch, the next give is right`, async () => {
    const h = await atHealer(grade);
    const plan = h.zone('trial-healer').plan;
    const need = plan.need;
    // The basket of the task, and one bunch of ngải cứu too many.
    for (const [k, n] of Object.entries(need)) for (let i = 0; i < n; i++) h.put(k);
    h.put('ngai');
    const basket = () => h.zone('basket').items.length;
    const total = Object.values(need).reduce((a, n) => a + n, 0);
    assert.equal(basket(), total + 1, 'the basket with one extra bunch');
    h.give();
    // During her count: presses every half second, next to a bed.
    let counting = 0;
    let most = 0;
    let counted = false;
    h.session.listen((e) => { if (e.type === 'counted') counted = true; });
    for (let i = 0; i < 60 && !counted; i++) {
      const on = getEntity(h.session.state, 'script:trial-healer')?.script.move === 'count';
      if (on) {
        counting += 1;
        most = Math.max(most, basket());
        const a = h.session.action();
        assert.ok(!a || !['put', 'pick', 'take', 'move'].includes(a.act), `the act during her count: ${a?.act}`);
      }
      h.press(0.5);
    }
    assert.ok(counting > 0, 'she counts');
    assert.ok(most <= total + 1, `a bunch went into the basket during her count: ${most}`);
    h.run(4);
    // Grade 1: she took the extra bunch back, and the next give is right. Grade 4: her count of the
    // doses leaves the basket as it was, with no bunch more.
    if (grade === 4) {
      assert.equal(basket(), total + 1, 'no bunch more after her count');
      return;
    }
    assert.equal(basket(), total, 'she took the extra bunch back');
    // The next give is right.
    h.give();
    h.run(20);
    assert.ok(h.zone('trial-healer').done || h.said.some((l) => /done/.test(l.key)), h.said.slice(-6).map((l) => l.key).join(', '));
  });
}

test('the words of her count match the bunches in the basket', async () => {
  const h = await atHealer(1);
  const need = h.zone('trial-healer').plan.need;
  for (const [k, n] of Object.entries(need)) for (let i = 0; i < n; i++) h.put(k);
  h.put('ngai');
  const from = h.said.length;
  h.give();
  h.run(15);
  // The count of ngải cứu goes to its number in the basket (the last number word of its row).
  const lines = h.said.slice(from).map((l) => l.key);
  const nums = lines.filter((k) => /^num\.\d+$/.test(k)).map((k) => Number(k.split('.')[1]));
  assert.ok(nums.includes(need.ngai + 1), `the count reaches ${need.ngai + 1}: ${lines.join(', ')}`);
});

test('bà lang wears a khăn vấn: a round roll of dark cloth with no top, so the grey hair shows inside it', () => {
  const figures = load('data/figures.json').figures;
  const f = personFine(figures.healer);
  const van = f.parts.filter((p) => /^van/.test(p.name));
  assert.ok(van.length >= 4, van.map((p) => p.name).join(', '));
  // No part of the roll covers the middle of the top of the head.
  for (const p of van) assert.ok(Math.abs(p.at[0]) > 2 || Math.abs(p.at[2]) > 2, `${p.name} covers the top`);
  for (const p of van) assert.ok(['ink', 'wood'].includes(p.color), `${p.name}: ${p.color}`);
  assert.equal(figures.healer.hair, 'grey');
  assert.ok(vi.t('dlg.healer.trial.n1'));
});
