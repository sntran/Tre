// The healer by grade (#101): the same number of each kind (grades 1 and 2), doses of a recipe
// (grade 3), one dose from a model basket of two doses (grade 4), and a number of bunches by
// fractions (grade 5); the counts by groups from grade 3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { basketPlan, basketResult } from '../src/core/world/trials.js';
import { createRng } from '../src/core/rng.js';

const KINDS = ['ngai', 'tiato', 'rauma'];
const healer = load('data/trials.json').trials.find((t) => t.id === 'healer');

test('the plan of each level: the doses of a recipe, a model of two doses, and one half and one third', () => {
  for (let seed = 1; seed < 40; seed++) {
    const doses = basketPlan(healer.levels[2], KINDS, createRng(seed));
    assert.ok(KINDS.every((k) => doses.recipe[k] >= 1 && doses.recipe[k] <= 3 && doses.need[k] === doses.recipe[k] * doses.doses));
    assert.ok(doses.doses >= 2 && doses.doses <= 5);
    assert.ok(!KINDS.every((k) => doses.recipe[k] === doses.recipe.ngai), 'a recipe, not "each"');
    const model = basketPlan(healer.levels[3], KINDS, createRng(seed));
    assert.ok(model.doses !== 2 && model.doses >= 3);
    const frac = basketPlan(healer.levels[4], KINDS, createRng(seed));
    assert.equal(frac.need.rauma, frac.n / 2);
    assert.equal(frac.need.tiato, frac.n / 3);
    assert.equal(frac.need.ngai + frac.need.tiato + frac.need.rauma, frac.n);
  }
  assert.ok(basketResult({ ngai: 2, tiato: 4, rauma: 6 }, KINDS, { ngai: 2, tiato: 4, rauma: 6 }).solved);
  assert.ok(!basketResult({ ngai: 2, tiato: 4, rauma: 5 }, KINDS, { ngai: 2, tiato: 4, rauma: 6 }).solved);
});

async function play(grade, steps) {
  const s = load('tests/stories/trial-healer.json');
  s.profile = { ...s.profile, grade };
  let session = null;
  const said = [];
  const failures = await runHeadless({ ...s, steps: [...s.steps.slice(0, 3), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 40 } }, ...steps] }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => { if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, params: e.params ?? {} }); });
    },
  });
  return { session, said, failures };
}
const put = (kind, n) => ({ repeat: n, steps: [{ press: { item: `herb-${kind}` } }, { until: { event: 'put', with: { id: 'hero' }, timeout: 15 } }] });

test('each grade gets its level, and a right basket of each level is done', async () => {
  for (const [grade, level, form] of [[1, 0, 'each'], [2, 1, 'each'], [3, 2, 'doses'], [4, 3, 'model'], [5, 4, 'fraction']]) {
    const first = await play(grade, []);
    const z = getEntity(first.session.state, 'zone:trial-healer').zone;
    assert.equal(z.level, level, `grade ${grade}`);
    assert.equal(z.plan.form, form, `grade ${grade}`);
    const need = z.plan.need;
    // The same seed and grade give the same basket: a second run fills it.
    const { session, failures } = await play(grade, [...KINDS.map((k) => put(k, need[k])), { press: { entity: 'npc:healer' } }, { until: { event: 'trial', timeout: 30 } }]);
    assert.deepEqual(failures.map((f) => `${f.step}: ${f.message}`), [], `grade ${grade}: ${JSON.stringify(need)}`);
    assert.ok(getEntity(session.state, 'zone:trial-healer').zone.done, `grade ${grade}: done`);
  }
});

test('grade 3: the line says the recipe and the doses, one dose lies on a leaf, and the count is by doses', async () => {
  const first = await play(3, []);
  const plan = getEntity(first.session.state, 'zone:trial-healer').zone.plan;
  const line = first.said.find((l) => l.key === 'dlg.healer.trial.n4.doses');
  assert.ok(line, first.said.map((l) => l.key).join(', '));
  assert.equal(line.params.k.key, `num.${plan.doses}`);
  assert.equal(first.session.state.entities.filter((e) => /^dose:healer:/.test(e.id)).length, plan.recipe.ngai + plan.recipe.tiato + plan.recipe.rauma, 'one dose on the leaf');
  // One dose too few of ngải cứu: the count says the doses.
  const { said } = await play(3, [...KINDS.map((k) => put(k, plan.need[k] - (k === 'ngai' ? plan.recipe.ngai : 0))), { press: { entity: 'npc:healer' } }, { until: { event: 'counted', timeout: 60 } }]);
  const keys = said.map((l) => l.key);
  assert.ok(keys.includes('count.dose') || keys.includes('count.dose.one'), keys.join(', '));
  assert.ok(!keys.some((k) => k === `num.${plan.need.rauma}` && plan.need.rauma > 10), 'no count by ones over ten');
});

test('grade 4: a model of two doses lies on its leaves, and its bunches never go into the basket', async () => {
  // The first step deals the model onto its two leaves, and the leaves keep it (#125: the child
  // does not move the model).
  const { session, said } = await play(4, []);
  const plan = getEntity(session.state, 'zone:trial-healer').zone.plan;
  const leaves = [0, 1].map((j) => getEntity(session.state, `zone:leaf-${j}`).zone.items.length);
  const dose = plan.recipe.ngai + plan.recipe.tiato + plan.recipe.rauma;
  assert.deepEqual(leaves, [dose, dose], 'one dose on each leaf');
  assert.equal(getEntity(session.state, 'zone:basket').zone.items.length, 0);
  assert.ok(said.some((l) => l.key === 'dlg.healer.trial.n4.model'));
});

test('grade 5: the basket has a place for each bunch in rows of six; the count says the total of each kind and the whole', async () => {
  const first = await play(5, []);
  const plan = getEntity(first.session.state, 'zone:trial-healer').zone.plan;
  assert.equal(getEntity(first.session.state, 'basket:healer').look, `basket-grid-${plan.n}`);
  const { said } = await play(5, [...KINDS.map((k) => put(k, plan.need[k] + (k === 'tiato' ? 1 : 0))), { press: { entity: 'npc:healer' } }, { until: { event: 'counted', timeout: 60 } }]);
  const keys = said.map((l) => l.key);
  assert.ok(keys.includes('count.bunches') && keys.includes('count.whole'), keys.join(', '));
});
