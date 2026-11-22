// The leaves of bà lang at grade 4 (#178): the two packs of the model are big on the screen and
// beside the basket, a tap on a pack counts it, a give that is short says the count of the short
// herb and the count of one pack, the lines of the give are true, and "Giờ đến lượt cháu." comes one
// time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';
import { sessionCamera } from '../src/world/hit.js';

const s0 = load('tests/stories/trial-healer.json');
const first = s0.steps.findIndex((x) => x.read === true) + 1;

function tools(session) {
  const said = [];
  const puts = [];
  session.listen((e) => {
    if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, params: e.params, tick: session.state.tick });
    if (e.type === 'put' || e.type === 'pick') puts.push({ type: e.type, by: e.id, zone: e.zone ?? e.from, item: e.item, tick: session.state.tick });
  });
  const run = (sec, read = true) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (read && session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const press = () => { session.command({ type: 'hands', id: session.action()?.id }); run(1.5); };
  const zone = (id) => getEntity(session.state, `zone:${id}`)?.zone;
  const tapThing = (id) => { session.command({ type: 'tap', target: { thing: id } }); run(4); };
  const bedThing = (k) => zone(`bed-${k}`).items.find((id) => !getEntity(session.state, id)?.item.held);
  return { session, said, puts, run, press, zone, tapThing, bedThing };
}

async function atHealer(grade = 4) {
  let session = null;
  const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade }, steps: [...s0.steps.slice(0, first), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 90 } }, { wait: 2 }] }, { onSession: (x) => { session = x; } });
  assert.deepEqual(failures, []);
  return tools(session);
}

const vi = load('i18n/vi.json');

test('on a phone of 390 × 844, each pack of the model is at least 60 points wide, and the packs are beside the basket', async () => {
  const h = await atHealer(4);
  const cam = sessionCamera(h.session);
  const basket = h.zone('basket');
  for (const id of ['leaf-0', 'leaf-1']) {
    const z = h.zone(id);
    const r = z.rect;
    const p = (x) => cam.project(x / 2, z.y / 2, r.z0 / 2);
    const w = Math.hypot(p(r.x1).x - p(r.x0).x, p(r.x1).y - p(r.x0).y);
    assert.ok(w >= 60, `${id}: ${w.toFixed(0)} points`);
    assert.ok(Math.abs(z.x - basket.x) <= 24, `${id} is ${Math.abs(z.x - basket.x).toFixed(1)} half blocks from the basket`);
  }
});

test('a tap on a pack of the model counts that pack: "Gói này: …"', async () => {
  const h = await atHealer(4);
  const leaf = h.zone('leaf-0');
  const thing = leaf.items[0] ?? query(h.session.state, 'item').find((e) => e.item.model)?.id;
  const from = h.said.length;
  h.tapThing(thing);
  const line = h.said.slice(from).find((l) => l.key === 'healer.model.pack');
  assert.ok(line, h.said.slice(from).map((l) => l.key).join(', '));
  assert.ok(line.params.list.length >= 2, JSON.stringify(line.params));
});

test('a give that is short one bunch names every herb that the pack lacks, the packs that are done and left, and the whole pack (#178, #189)', async () => {
  const h = await atHealer(4);
  const plan = query(h.session.state, 'zone').find((z) => z.zone.plan?.recipe)?.zone.plan;
  const kinds = Object.keys(plan.need);
  const short = kinds[kinds.length - 1];
  for (const k of kinds) {
    h.tapThing(h.bedThing(k));
    for (let i = 0; i < plan.need[k] - (k === short ? 1 : 0); i++) h.press();
  }
  const from = h.said.length;
  h.session.command({ type: 'tap', target: { person: 'npc:healer' } });
  h.run(3);
  h.press();
  h.run(30);
  const said = h.said.slice(from);
  const lack = said.find((l) => l.key === 'healer.dose.lack.all');
  assert.ok(lack, said.map((l) => l.key).join(', '));
  assert.deepEqual(lack.params.list.map((x) => x.key), [`healer.model.kind.${short}.one`]);
  const done = said.find((l) => l.key === 'healer.dose.done');
  assert.ok(done, said.map((l) => l.key).join(', '));
  assert.equal(done.params.k.key, `num.${plan.doses}`);
  const recipe = said.find((l) => l.key === 'healer.recipe');
  assert.ok(recipe && recipe.params.list.length === kinds.length, said.map((l) => l.key).join(', '));
  assert.equal(vi['healer.dose.done'], 'Có {d} thang rồi. Bà cần {k} thang: còn {r} thang nữa.');
  assert.equal(vi['healer.recipe'], 'Mỗi thang: {list}.');
});

test('no line of bà lang says "bấm nút lớn: bà nhận giỏ", and the first word "thang" has its card', () => {
  for (const [k, v] of Object.entries(vi)) assert.ok(!/bấm nút lớn: bà nhận giỏ/.test(v), k);
  const trials = load('data/trials.json').trials;
  const healer = trials.find((t) => t.id === 'healer');
  const levels = JSON.stringify(healer);
  assert.ok(levels.includes('"word.thang"'), 'the card of the word thang');
});

test('"Giờ đến lượt cháu." comes one time, and never after a put of the child', async () => {
  const h = await atHealer(4);
  const plan = query(h.session.state, 'zone').find((z) => z.zone.plan?.recipe)?.zone.plan;
  const k = Object.keys(plan.need)[0];
  h.tapThing(h.bedThing(k));
  h.press();
  h.press();
  for (let i = 0; i < 3; i++) {
    h.session.command({ type: 'tap', target: { person: 'npc:healer' } });
    h.run(8);
  }
  // The line came at the end of the show (atHealer waits for it): never again after the puts and taps.
  assert.equal(h.said.filter((l) => /^mentor\.first\.you/.test(l.key)).length, 0, h.said.map((l) => l.key).join(', '));
});
