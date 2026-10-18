// The teacher by grade (#101): equal bundles of g with one band for each bundle (grade 3), a
// number of rods shared among desks with a rest in a box (grade 4), and tenths and hundredths
// (grade 5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { rodsPlan } from '../src/core/world/trials.js';
import { createRng } from '../src/core/rng.js';

const scholar = load('data/trials.json').trials.find((t) => t.id === 'scholar');
const s0 = load('tests/stories/trial-scholar.json');
const first = s0.steps.findIndex((x) => x.read === true) + 1;
const start = [...s0.steps.slice(0, first), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 40 } }];
const press = (item, n) => ({ repeat: n, steps: [{ press: { item } }, { until: { event: 'put', with: { id: 'hero' }, timeout: 15 } }] });
const tie = [{ press: { entity: 'npc:teacher' } }, { until: { event: 'tie', timeout: 15 } }, { wait: 2 }];
async function play(grade, steps = []) {
  let session = null;
  const said = [];
  const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade }, steps: [...start, ...steps] }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => {
        if (e.type === 'open' && e.textKey) said.push(e.textKey);
        if (e.type === 'skill') said.push(`skill:${e.skill}:${e.solved}`);
      });
    },
  });
  return { session, said, failures, plan: getEntity(session.state, 'zone:trial-scholar').zone.plan };
}

test('the plans: equal bundles of 3 to 9 with at most 60 rods, two digits for 3 to 5 desks, and hundredths from 1,05 to 2,99', () => {
  for (let seed = 1; seed < 50; seed++) {
    const g = rodsPlan(scholar.levels[2], createRng(seed));
    assert.ok(g.g >= 3 && g.g <= 9 && g.bundles >= 3 && g.bundles <= 6 && g.n <= 60 && g.n === g.g * g.bundles);
    const sh = rodsPlan(scholar.levels[3], createRng(seed));
    assert.ok(sh.n >= 40 && sh.n <= 99 && sh.k >= 3 && sh.k <= 5 && sh.each * sh.k + sh.rest === sh.n);
    const d = rodsPlan(scholar.levels[4], createRng(seed));
    assert.ok(d.x >= 105 && d.x <= 299 && d.bundles * 10 + d.rods >= d.x);
  }
});

test('grade 3: the bands are the prediction; when they run out the teacher counts the bundles by g, and more bands finish the work', async () => {
  const { plan } = await play(3);
  assert.equal(plan.form, 'groups');
  const { session, said, failures } = await play(3, [
    press('band', plan.bundles - 1),
    ...Array.from({ length: plan.bundles - 1 }, () => [press('rod', plan.g), ...tie]).flat(),
    { wait: 14 }, press('band', 1), press('rod', plan.g), ...tie, { until: { event: 'trial', timeout: 20 } },
  ]);
  assert.deepEqual(failures.map((f) => `${f.step}: ${f.message}`), [], said.join(' '));
  assert.ok(said.includes('dlg.teacher.trial.n3.groups'));
  assert.ok(said.includes('skill:math.div.10:false'), 'the prediction of the bands');
  const g = plan.g;
  const nums = said.filter((k) => /^num\./.test(k)).map((k) => Number(k.slice(4)));
  assert.ok(nums.includes(g) && nums.includes(2 * g) && !nums.includes(1), `by g: ${nums.join(',')}`);
  assert.ok(said.includes('mentor.scholar.loose') && said.includes('mentor.scholar.bandMore'));
  assert.ok(getEntity(session.state, 'zone:trial-scholar').zone.done);
});

test('grade 3: a tie with no band ties nothing, and the teacher says where the bands are', async () => {
  const { plan } = await play(3);
  const { session, said } = await play(3, [press('rod', plan.g), { press: { entity: 'npc:teacher' } }, { wait: 3 }]);
  assert.ok(said.includes('scholar.band.none'), said.join(' '));
  assert.equal(getEntity(session.state, 'zone:mat').zone.items.length, plan.g, 'the rods stay on the mat');
});
