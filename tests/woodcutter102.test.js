// The woodcutter by grade (#102): equal pieces (grades 1 and 2), and from grade 3 parts of the
// stem: one part for the bridge (one fourth), a/b of the stem (three fourths), and one third and one
// fourth. Each piece is compared with the length that the task asks for, and the check lays a piece
// along another and says the part.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { stemPlan, fracCut } from '../src/core/world/trials.js';
import { layPlan } from '../src/core/world/zones.js';
import { createRng } from '../src/core/rng.js';
import { createI18n } from '../src/core/i18n.js';

const wood = load('data/trials.json').trials.find((t) => t.id === 'woodcutter');
const vi = createI18n(load('i18n/vi.json'), 'vi');

test('the plan of each level: a part that the rings allow, a/b of the stem, and thirds and fourths of 12 or 24 rings', () => {
  for (let seed = 1; seed < 60; seed++) {
    const u = stemPlan(wood.levels[2], createRng(seed));
    assert.ok([8, 12, 16].includes(u.length) && u.length % u.b === 0 && [2, 3, 4, 6].includes(u.b), JSON.stringify(u));
    assert.deepEqual(u.want, [u.length / u.b, u.length - u.length / u.b]);
    const e = stemPlan(wood.levels[3], createRng(seed));
    assert.equal(e.want[0], (e.a * e.length) / e.b);
    assert.ok(Number.isInteger(e.want[0]));
    const k = stemPlan(wood.levels[4], createRng(seed));
    assert.ok([12, 24].includes(k.length));
    assert.deepEqual(k.want, [k.length / 3, k.length / 4, (5 * k.length) / 12]);
  }
});

test('a piece is compared with the length that the task asks for: a piece of the right length is never named', () => {
  const cases = [
    [[4, 8], { want: [3, 9] }], [[2, 10], { want: [3, 9] }], [[8, 4], { want: [9, 3] }], [[10, 2], { want: [9, 3] }],
    [[4, 4, 4], { want: [4, 3, 5] }], [[3, 5, 4], { want: [4, 3, 5] }], [[2, 5, 5], { want: [4, 3, 5] }], [[8, 6, 10], { want: [8, 6, 10] }], [[6, 8, 10], { want: [8, 6, 10] }],
  ];
  for (const [pieces, plan] of cases) {
    const r = fracCut(pieces, plan);
    if (r.solved) {
      assert.deepEqual([...pieces].sort((a, b) => a - b), [...plan.want].sort((a, b) => a - b));
      continue;
    }
    assert.ok(!plan.want.includes(pieces[r.bad.i]) || pieces.filter((p) => p === pieces[r.bad.i]).length > plan.want.filter((w) => w === pieces[r.bad.i]).length, `${pieces}: ${pieces[r.bad.i]} is a length of the task`);
    assert.equal(r.bad.long, pieces[r.bad.i] > r.bad.want);
  }
  // The piece for the bridge of a stem of two parts is the part that the task names.
  assert.deepEqual(fracCut([4, 8], { want: [3, 9] }).bad, { i: 0, long: true, want: 3 });
  assert.deepEqual(fracCut([8, 4], { want: [9, 3] }).bad, { i: 0, long: false, want: 9 });
  // The lays: one fourth along the rest counts four; three fourths count three; at grade 5 a third
  // and a fourth along the stem.
  assert.deepEqual(layPlan([4, 12], { form: 'unit', want: [4, 12] }), [{ piece: 0, onto: 1, n: 3, from: 2, part: { a: 1, b: 4 } }]);
  assert.deepEqual(layPlan([12, 4], { form: 'equiv', want: [12, 4] }), [{ piece: 1, onto: 0, n: 3, from: 1, part: { a: 3, b: 4 } }]);
  assert.deepEqual(layPlan([8, 6, 10], { form: 'unlike', length: 24, want: [8, 6, 10] }).map((o) => [o.piece, o.n, o.part]), [[0, 3, { a: 1, b: 3 }], [1, 4, { a: 1, b: 4 }]]);
});

async function play(grade, marks, more = []) {
  const s = load('tests/stories/trial-woodcutter.json');
  s.profile = { ...s.profile, grade };
  let session = null;
  const said = [];
  const events = [];
  const steps = [...s.steps.slice(0, 3), { wait: 8 }];
  if (marks) {
    for (const m of marks) steps.push({ press: { stem: m } }, { until: { event: 'mark', timeout: 10 } });
    steps.push({ press: { entity: 'npc:woodcutter' } }, { until: { event: 'skill', timeout: 10 } }, ...more);
  }
  const failures = await runHeadless({ ...s, steps }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => {
        if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, text: vi.t(e.textKey, e.params ?? {}) });
        if (['skill', 'chop', 'snap', 'stem'].includes(e.type)) events.push(e);
      });
    },
  });
  return { session, said, events, failures };
}
const marksOf = (want) => want.slice(0, -1).map((_, i) => want.slice(0, i + 1).reduce((a, b) => a + b, 0));

test('each grade gets its stem: the talk names the part in words, and a right cut is laid and counted, and its piece goes to the wood pile', async () => {
  for (const [grade, form, part] of [[3, 'unit', null], [4, 'equiv', null], [5, 'unlike', 'Một phần ba cây tre cho cái cầu']]) {
    const first = await play(grade, null);
    const plan = getEntity(first.session.state, 'zone:trial-woodcutter').zone.plan;
    assert.equal(plan.form, form, `grade ${grade}`);
    const n3 = first.said.find((l) => l.key.startsWith('dlg.woodcutter.trial.n3'));
    assert.equal(n3.key, `dlg.woodcutter.trial.n3.${form}`);
    assert.ok(!/\{|\d/.test(n3.text), n3.text);
    assert.ok(n3.text.includes(part ?? vi.t(`frac.${plan.a}.${plan.b}`)), n3.text);
    const { session, said, events, failures } = await play(grade, marksOf(plan.want), [{ until: { event: 'chop', timeout: 40 } }, { press: { item: 'sticks' } }, { until: { event: 'pick', timeout: 10 } }, { press: { screenOf: 'woodpile' } }, { until: { event: 'trial', timeout: 120 } }]);
    assert.deepEqual(failures.map((f) => `${f.step}: ${f.message}`), [], `grade ${grade}: ${JSON.stringify(plan)}`);
    const skill = events.find((e) => e.type === 'skill');
    assert.deepEqual([skill.skill, skill.solved], [wood.levels[grade - 1].skill, true]);
    const parts = said.filter((l) => l.key === 'woodcutter.part').map((l) => l.text);
    const want = form === 'unlike' ? ['Một phần ba cây tre.', 'Một phần tư cây tre.'] : [`${vi.t(`frac.${plan.a}.${plan.b}`)[0].toUpperCase()}${vi.t(`frac.${plan.a}.${plan.b}`).slice(1)} cây tre.`];
    assert.deepEqual(parts, want, `grade ${grade}`);
    // The count of the lays: one fourth is "một, hai, ba, bốn".
    if (form === 'unit') assert.deepEqual(said.filter((l) => /^num\./.test(l.key)).map((l) => l.key), Array.from({ length: plan.b }, (_, i) => `num.${i + 1}`));
    if (form === 'unlike') assert.ok(said.some((l) => l.key === 'woodcutter.rest'));
    assert.ok(getEntity(session.state, 'zone:trial-woodcutter').zone.done, `grade ${grade}: done`);
    assert.ok(session.state.entities.some((e) => e.id.startsWith('rest:woodcutter:')), 'the rest of the stem stays');
  }
});

test('the common mistakes: a part too long or too short is named with its line after the lays, and a new stem comes', async () => {
  const plan = getEntity((await play(3, null)).session.state, 'zone:trial-woodcutter').zone.plan;
  // One mark at the middle: two halves, not the part of the task (unless the task is one half).
  const half = plan.length / 2;
  const { said, events, failures } = await play(3, [plan.b === 2 ? half - 1 : half], [{ until: { event: 'stem', timeout: 40 } }]);
  assert.deepEqual(failures.map((f) => `${f.step}: ${f.message}`), []);
  assert.equal(events.find((e) => e.type === 'skill').solved, false);
  const lines = said.map((l) => l.key);
  const named = lines.indexOf(plan.b === 2 ? 'woodcutter.short' : 'woodcutter.long');
  assert.ok(named > 0, lines.join(', '));
  assert.ok(lines.lastIndexOf('num.2') < named, 'the lays come before the line');
  assert.ok(!lines.includes(plan.b === 2 ? 'woodcutter.long' : 'woodcutter.short'));
  // Three fourths: a mark at one half is short for the bridge.
  const p4 = getEntity((await play(4, null)).session.state, 'zone:trial-woodcutter').zone.plan;
  const four = await play(4, [p4.length / 2], [{ until: { event: 'stem', timeout: 40 } }]);
  assert.deepEqual(four.failures.map((f) => `${f.step}: ${f.message}`), []);
  assert.ok(four.said.some((l) => l.key === 'woodcutter.short'), four.said.map((l) => l.key).join(', '));
  assert.ok(!four.said.some((l) => l.key === 'woodcutter.long'));
});
