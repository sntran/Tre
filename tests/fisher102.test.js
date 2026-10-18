// The fisher by grade (#102): stakes one at a time at the gap of the fisher (grades 1 and 2), and
// from grade 3 a boat that brings a load of stakes in one trip: the row as a measure (k stakes
// after the stake of the fisher), the problem of the trees (k + 1 stakes from the bank), and a gap
// of one pole and a half (x ÷ 1,5 + 1 stakes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';
import { rowPlan, boatResult } from '../src/core/world/trials.js';
import { createRng } from '../src/core/rng.js';
import { createI18n } from '../src/core/i18n.js';

const fisher = load('data/trials.json').trials.find((t) => t.id === 'fisher');
const vi = createI18n(load('i18n/vi.json'), 'vi');

test('the plan of each level: k poles from the stake, k poles from the bank, and x poles at a gap of one pole and a half', () => {
  for (let seed = 1; seed < 40; seed++) {
    const m = rowPlan(fisher.levels[2], createRng(seed));
    assert.ok(m.k >= 3 && m.k <= 6 && m.start && m.need === m.k && m.length === m.k * m.space);
    const t = rowPlan(fisher.levels[3], createRng(seed));
    assert.ok(!t.start && t.need === t.k + 1);
    const h = rowPlan(fisher.levels[4], createRng(seed));
    assert.ok([12, 15, 18, 21].includes(h.halves));
    assert.equal(h.space, h.pole * 1.5);
    assert.equal(h.need, h.halves / 2 / 1.5 + 1, `${h.halves / 2} poles`);
  }
  assert.equal(rowPlan(fisher.levels[0], createRng(1)).form, 'gaps');
  // A load against the row: right, short, and over.
  const plan = { length: 12, space: 3 };
  assert.deepEqual(boatResult(5, 0, plan), { solved: true, need: 5, set: 5, over: 0, left: 0 });
  assert.deepEqual(boatResult(4, 0, plan), { solved: false, need: 5, set: 4, over: 0, left: 1 });
  assert.deepEqual(boatResult(7, 1, plan), { solved: false, need: 4, set: 4, over: 3, left: 0 });
});

async function play(grade, steps) {
  const s = load('tests/stories/trial-fisher.json');
  s.profile = { ...s.profile, grade };
  let session = null;
  const said = [];
  const events = [];
  const failures = await runHeadless({ ...s, steps: [...s.steps.slice(0, 3), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 40 } }, ...steps] }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => {
        if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, text: vi.t(e.textKey, e.params ?? {}) });
        if (['skill', 'call', 'drive', 'measure'].includes(e.type)) events.push(e);
      });
    },
  });
  return { session, said, events, failures };
}
const load1 = (n) => ({ repeat: n, steps: [{ press: { item: 'stake' } }, { until: { event: 'put', with: { id: 'hero' }, timeout: 15 } }] });
const send = [{ press: { entity: 'boat:fisher' } }, { until: { event: 'boat', timeout: 15 } }];
const planOf = async (grade) => getEntity((await play(grade, [])).session.state, 'zone:trial-fisher').zone.plan;

test('each grade gets its row: the talk says the poles, and a right load of the boat makes the row in one trip', async () => {
  for (const [grade, form] of [[1, 'gaps'], [2, 'gaps'], [3, 'measure'], [4, 'trees'], [5, 'half']]) {
    const first = await play(grade, []);
    const plan = getEntity(first.session.state, 'zone:trial-fisher').zone.plan;
    assert.equal(plan.form, form, `grade ${grade}`);
    if (form === 'gaps') continue;
    const n4 = first.said.find((l) => l.key.startsWith('dlg.fisher.trial.n4'));
    assert.equal(n4.key, `dlg.fisher.trial.n4.${form}`);
    assert.ok(!/\{/.test(n4.text), n4.text);
    assert.match(n4.text, form === 'half' ? /sào rưỡi\.$/ : new RegExp(`dài ${vi.t(`num.${plan.k}`)} sào`), n4.text);
    assert.ok(!/\d/.test(n4.text), `no numeral: ${n4.text}`);
    const { session, events, failures } = await play(grade, [load1(plan.need), ...send, { until: { event: 'trial', timeout: 60 } }]);
    assert.deepEqual(failures.map((f) => `${f.step}: ${f.message}`), [], `grade ${grade}: ${JSON.stringify(plan)}`);
    const skill = events.find((e) => e.type === 'skill');
    assert.deepEqual([skill.skill, skill.solved, skill.parts[0], skill.target], [fisher.levels[grade - 1].skill, true, plan.need, plan.need]);
    const slots = query(session.state, 'item').filter((e) => e.item.zone === 'line').map((e) => e.item.slot).sort((a, b) => a - b);
    assert.deepEqual(slots, Array.from({ length: plan.length / plan.space + 1 }, (_, i) => i * plan.space), `grade ${grade}: a stake at each pole`);
  }
});

test('the problem of the trees: k stakes for k gaps leave the gap at the float open, and the fisher points at that end', async () => {
  for (const grade of [4, 5]) {
    const plan = await planOf(grade);
    const { session, events, failures } = await play(grade, [load1(plan.need - 1), ...send, { until: { event: 'call', with: { key: 'fisher.end' }, timeout: 40 } }]);
    assert.deepEqual(failures.map((f) => `${f.step}: ${f.message}`), [], `grade ${grade}`);
    assert.equal(events.find((e) => e.type === 'skill').solved, false);
    const z = getEntity(session.state, 'zone:line').zone;
    const fisherE = getEntity(session.state, 'npc:fisher');
    assert.equal(fisherE.gesture?.x, z.x + z.length, 'he points at the float');
    assert.ok(getEntity(session.state, 'why:fisher:open'), 'the open gap shows on the water');
    assert.ok(!getEntity(session.state, 'zone:trial-fisher').zone.done);
    // One more stake in the boat closes the row.
    const end = await play(grade, [load1(plan.need - 1), ...send, { until: { event: 'call', with: { key: 'fisher.end' }, timeout: 40 } }, { wait: 4 }, load1(1), ...send, { until: { event: 'trial', timeout: 60 } }]);
    assert.deepEqual(end.failures.map((f) => `${f.step}: ${f.message}`), [], `grade ${grade}: the last stake`);
    assert.deepEqual(end.events.filter((e) => e.type === 'skill').map((e) => [e.solved, e.parts[0], e.target]), [[false, plan.need - 1, plan.need], [true, 1, 1]]);
  }
});

test('too few stakes: the fisher says the gaps that are left; too many: he says how many, and they go back to the pile', async () => {
  const plan = await planOf(3);
  const short = await play(3, [load1(plan.need - 2), ...send, { until: { event: 'call', with: { key: 'fisher.gaps' }, timeout: 40 } }]);
  assert.deepEqual(short.failures.map((f) => `${f.step}: ${f.message}`), []);
  assert.equal(short.said.find((l) => l.key === 'fisher.gaps').text, 'Còn hai khe nữa.');
  // The water comes a step nearer after a trip that was short.
  assert.equal(getEntity(short.session.state, 'tide:fisher').look, 'tide-1');
  const over = await play(3, [load1(plan.need + 2), ...send, { until: { event: 'trial', timeout: 60 } }]);
  assert.deepEqual(over.failures.map((f) => `${f.step}: ${f.message}`), []);
  assert.equal(over.said.find((l) => l.key === 'fisher.over').text, 'Thừa hai cọc.');
  const pile = getEntity(over.session.state, 'zone:stakes').zone.items;
  assert.equal(pile.length, fisher.extra - 2 + 2, 'the two stakes over the float are back on the pile');
  assert.equal(over.events.find((e) => e.type === 'skill').solved, false);
});

test('a tap on the pole lays it along the row, one length at a time, with a knot at each length; no number shows', async () => {
  const plan = await planOf(3);
  const tap = { repeat: plan.k, steps: [{ press: { entity: 'pole:fisher' } }, { until: { event: 'measure', timeout: 15 } }] };
  const { session, events, failures } = await play(3, [tap]);
  assert.deepEqual(failures.map((f) => `${f.step}: ${f.message}`), []);
  assert.deepEqual(events.filter((e) => e.type === 'measure').map((e) => e.n), Array.from({ length: plan.k }, (_, i) => i + 1));
  const z = getEntity(session.state, 'zone:line').zone;
  const knots = query(session.state, 'position').filter((e) => e.id.startsWith('measure:fisher:')).map((e) => e.position.x - z.x).sort((a, b) => a - b);
  assert.deepEqual(knots, Array.from({ length: plan.k }, (_, i) => (i + 1) * plan.pole));
  assert.equal(getEntity(session.state, 'pole:fisher').position.x, z.x + (plan.k - 1) * plan.pole);
});
