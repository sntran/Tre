// The boat of the fisher after the play test of #105 to #114 (#119): the load stands upright and
// a child can count it, each load has its count, the stake of the demonstration goes back, and the
// end says the reason of the number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { sessionCamera } from '../src/world/hit.js';

async function play(grade, steps) {
  const s = load('tests/stories/trial-fisher.json');
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
const load1 = (n) => ({ repeat: n, steps: [{ press: { item: 'stake' } }, { until: { event: 'put', with: { id: 'hero' }, timeout: 15 } }] });
const send = [{ press: { entity: 'boat:fisher' } }, { until: { event: 'boat', timeout: 15 } }];
// The pixels between two stakes next to each other on the boat (the least), and the height of a
// stake, on a phone of 390 × 844 with the view of the task.
const PX_APART = 8;
const PX_TALL = 30;

test('at grades 3, 4, and 5 each stake on the boat stands apart in the view, the fisher says the load, and the stake of the demonstration is not on the boat', async () => {
  for (const grade of [3, 4, 5]) {
    const first = await play(grade, []);
    assert.equal(getEntity(first.session.state, 'zone:boat').zone.items.length, 0, `grade ${grade}: the stake of the demonstration went back`);
    assert.ok(first.said.some((l) => l.key === 'fisher.boat.back'), `grade ${grade}: he says that he puts it back`);
    const plan = getEntity(first.session.state, 'zone:trial-fisher').zone.plan;
    const n = plan.need + 1;
    const { session, said, failures } = await play(grade, [load1(n), { wait: 1 }]);
    assert.deepEqual(failures.map((f) => `${f.step}: ${f.message}`), []);
    const boat = getEntity(session.state, 'zone:boat').zone;
    assert.equal(boat.items.length, n);
    const cam = sessionCamera(session);
    const pts = boat.items.map((id) => getEntity(session.state, id)).map((e) => ({ e, foot: cam.project(e.position.x / 2, e.position.y / 2, e.position.z / 2), top: cam.project(e.position.x / 2, e.position.y / 2 + 1.3, e.position.z / 2) }));
    for (const p of pts) {
      assert.equal(p.e.look, 'stake-rack', 'upright');
      assert.ok(p.foot.x > 0 && p.foot.x < cam.width && p.top.y > 0 && p.foot.y < cam.height * 0.8, `grade ${grade}: in the view`);
      assert.ok(Math.hypot(p.top.x - p.foot.x, p.top.y - p.foot.y) >= PX_TALL, `grade ${grade}: tall enough`);
    }
    for (let i = 1; i < pts.length; i++) assert.ok(Math.hypot(pts[i].foot.x - pts[i - 1].foot.x, pts[i].foot.y - pts[i - 1].foot.y) >= PX_APART, `grade ${grade}: stakes ${i - 1} and ${i} apart`);
    const loads = said.filter((l) => l.key === 'fisher.load' || l.key === 'fisher.load.one');
    assert.equal(loads.length, n, `grade ${grade}: a count at each load`);
    assert.equal(loads.at(-1).params.n.key, `num.${n}`);
    // A tap on the boat: the button sends it, and its picture is the boat with its stakes.
    session.command({ type: 'tap', target: { thing: 'boat:fisher' } });
    for (let i = 0; i < 90; i++) { session.step(); session.events(); }
    assert.equal(session.action()?.act, 'send');
    assert.equal(session.buttonThing(), `boat-load-${n}`, 'the button shows the boat with its stakes');
    // A tap on a stake that stands on the boat sends the boat too; it does not take the stake back.
    session.command({ type: 'tap', target: { thing: boat.items[0] } });
    for (let i = 0; i < 90; i++) { session.step(); session.events(); }
    assert.equal(session.action()?.act, 'send', JSON.stringify(session.action()));
  }
});

test('the end says the reason in the words of each level, and the stakes go in with their count', async () => {
  for (const [grade, key] of [[3, 'fisher.why.measure'], [4, 'fisher.why.trees'], [5, null]]) {
    const plan = getEntity((await play(grade, [])).session.state, 'zone:trial-fisher').zone.plan;
    const why = key ?? (plan.halves % 2 ? 'fisher.why.half' : 'fisher.why.halfWhole');
    const { said, failures } = await play(grade, [load1(plan.need), ...send, { until: { event: 'trial', timeout: 60 } }]);
    assert.deepEqual(failures.map((f) => `${f.step}: ${f.message}`), [], `grade ${grade}`);
    const keys = said.map((l) => l.key);
    assert.ok(keys.includes(why), `grade ${grade}: ${keys.join(' ')}`);
    const line = said.find((l) => l.key === why);
    assert.equal(line.params.n.key, `num.${plan.form === 'measure' ? plan.k : Math.round(plan.length / plan.space) + 1}`);
    const at = keys.indexOf(why);
    for (let i = 1; i <= plan.need; i++) assert.ok(keys.slice(0, at).includes(`num.${i}`), `grade ${grade}: the count ${i} before the reason`);
  }
});

test('a wrong load says what is missing or what is left over', async () => {
  const plan = getEntity((await play(3, [])).session.state, 'zone:trial-fisher').zone.plan;
  const short = await play(3, [load1(plan.need - 1), ...send, { until: { event: 'call', with: { key: 'fisher.gaps.one' }, timeout: 40 } }]);
  assert.deepEqual(short.failures.map((f) => `${f.step}: ${f.message}`), []);
  const over = await play(3, [load1(plan.need + 1), ...send, { until: { event: 'call', with: { key: 'fisher.over.one' }, timeout: 40 } }]);
  assert.deepEqual(over.failures.map((f) => `${f.step}: ${f.message}`), []);
});
