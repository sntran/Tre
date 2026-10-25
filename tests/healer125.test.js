// The healer at grade 4 after the play test (#125): a talk that starts at the well walks to the
// beds first, the model is not a thing of the child, the count of the model is the whole model, the
// model is dealt one time, no press of the child is lost while she acts, and no line of the need
// comes after the end.
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

test('a talk that starts at the well walks to the beds first, and each thing that a line names is on the screen of a phone', async () => {
  let session = null;
  // 11:40: the healer is at the well, away from her beds.
  await runHeadless({ name: 'healer-125', profile: { name: 'Vy', grade: 4, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } }, clock: 700, at: ['phu-dong', 33, 44], steps: [{ wait: 30 }] }, { onSession: (x) => { session = x; } });
  const h = tools(session);
  const healer = getEntity(session.state, 'npc:healer');
  const hero = getEntity(session.state, 'hero');
  Object.assign(hero.position, { x: healer.position.x + 1.5, z: healer.position.z + 1.5 });
  delete hero.route;
  session.command({ type: 'tap', target: { person: 'npc:healer' } });
  h.run(2, false);
  session.command({ type: 'hands', id: session.action()?.id });
  h.run(0.5, false);
  assert.ok(h.said.some((x) => x.key === 'dlg.healer.trial.come'), h.said.map((x) => x.key).join(', '));
  assert.equal(session.screen, null, 'the talk waits for the walk');
  const named = ['zone:bed-ngai', 'zone:bed-tiato', 'zone:bed-rauma', 'zone:basket', 'zone:model'];
  let lines = 0;
  for (let i = 0; i < 60 / STEP && !h.said.some((x) => x.key === 'mentor.show.healer.model'); i++) {
    session.step();
    session.events();
    if (session.screen !== 'dialogue') continue;
    lines += 1;
    const cam = sessionCamera(session);
    for (const id of named) {
      const z = getEntity(session.state, id)?.zone;
      if (!z) continue;
      const q = cam.project(z.x / 2, z.y / 2, z.z / 2);
      assert.ok(q.x >= 0 && q.x <= cam.width && q.y >= 0 && q.y <= cam.height, `${id} at ${q.x.toFixed(0)}, ${q.y.toFixed(0)}`);
    }
    session.command({ type: 'next' });
  }
  assert.ok(lines >= 4, `${lines} lines of the talk`);
  // The talk is at the beds: the hero and the healer stand at the place of the work.
  const beds = getEntity(session.state, 'zone:bed-tiato').zone;
  for (const e of [hero, healer]) assert.ok(Math.hypot(e.position.x - beds.x, e.position.z - beds.z) < 14, `${e.id} at the beds`);
});

test('a tap and a press on a bunch of the model never move it, and the healer counts the whole model and one dose', async () => {
  const h = await atHealer(4);
  const model = query(h.session.state, 'item').filter((e) => e.item.model);
  const where = () => model.map((e) => `${e.id}@${e.item.zone}`).sort();
  const before = where();
  // The model lies on its leaves after the first step, and the leaves keep it.
  assert.ok(model.every((e) => /^leaf-/.test(e.item.zone)), before.join(', '));
  for (const e of model.slice(0, 3)) {
    h.tapThing(e.id);
    h.press();
    h.press();
  }
  assert.deepEqual(where(), before);
  assert.ok(!h.puts.some((p) => p.by === 'hero' && model.some((e) => e.id === p.item)), JSON.stringify(h.puts.filter((p) => p.by === 'hero')));
  assert.ok(!getEntity(h.session.state, 'hero').hands?.holds, 'nothing in the hands');
  // The count: two doses, and one dose of the recipe.
  const plan = getEntity(h.session.state, 'zone:healer')?.zone.plan ?? query(h.session.state, 'zone').find((z) => z.zone.plan?.recipe)?.zone.plan;
  const counts = h.said.filter((x) => x.key === 'healer.model.count');
  assert.ok(counts.length >= 1, h.said.map((x) => x.key).join(', '));
  for (const c of counts) {
    assert.deepEqual(c.params.k, { key: 'num.2' });
    const each = Object.fromEntries(c.params.list.map((x) => [x.key.replace(/^healer\.model\.kind\.|\.one$/g, ''), x.params?.n.key ?? 'num.1']));
    assert.deepEqual(each, Object.fromEntries(Object.entries(plan.recipe).map(([k, n]) => [k, `num.${n}`])));
  }
});

test('after a wrong basket the model is not dealt again, and the presses of the child at a bed while she lays the doses all act', async () => {
  const h = await atHealer(4);
  for (const k of ['ngai', 'tiato', 'rauma']) {
    h.tapThing(h.bedThing(k));
    h.press();
  }
  const leafLines = h.said.filter((x) => x.key === 'healer.model.leaf').length;
  const from = h.puts.length;
  h.session.command({ type: 'tap', target: { person: 'npc:healer' } });
  h.run(3);
  h.press();
  // While she lays the doses, the child taps a bed and presses two times.
  h.run(2);
  const inBasket = () => h.zone('basket').items.length;
  h.session.command({ type: 'tap', target: { thing: h.bedThing('rauma') } });
  h.run(2, false);
  const n0 = h.puts.filter((p) => p.by === 'hero' && p.type === 'pick').length;
  for (let i = 0; i < 2; i++) {
    h.session.command({ type: 'hands', id: h.session.action()?.id });
    h.run(0.5, false);
  }
  h.run(20);
  const picks = h.puts.filter((p) => p.by === 'hero' && p.type === 'pick').length - n0;
  assert.equal(picks, 2, `two presses, ${picks} picks (${inBasket()} in the basket)`);
  for (let i = 0; i < 3; i++) {
    h.session.command({ type: 'wave' });
    h.run(20);
  }
  assert.equal(h.said.filter((x) => x.key === 'healer.model.leaf').length, leafLines, 'no deal again');
  assert.ok(!h.puts.slice(from).some((p) => p.by !== 'hero' && /^leaf-/.test(p.zone ?? '')), JSON.stringify(h.puts.slice(from).filter((p) => p.by !== 'hero')));
});

test('after the end, a tap on the healer says no line of the need', async () => {
  const h = await atHealer(4);
  const plan = query(h.session.state, 'zone').find((z) => z.zone.plan?.recipe)?.zone.plan;
  for (const [k, n] of Object.entries(plan.need)) {
    h.tapThing(h.bedThing(k));
    for (let i = 0; i < n; i++) h.press();
  }
  assert.deepEqual(h.zone('basket').items.length, Object.values(plan.need).reduce((a, b) => a + b, 0));
  h.session.command({ type: 'tap', target: { person: 'npc:healer' } });
  h.run(3);
  h.press();
  // The child taps the healer again and again, also while she takes the basket and after the end.
  for (let i = 0; i < 30; i++) {
    if (h.session.screen) h.session.command({ type: 'next' });
    else h.session.command({ type: 'tap', target: { person: 'npc:healer' } });
    h.run(1, false);
  }
  const done = h.said.findIndex((x) => /^dlg\.healer\.trial\.done/.test(x.key));
  assert.ok(done >= 0, h.said.map((x) => x.key).slice(-8).join(', '));
  // Taps on the basket, on the model, and on the healer after the end.
  const leafThing = query(h.session.state, 'item').find((e) => e.item.model)?.id;
  for (const target of [{ thing: 'basket:healer' }, { zone: 'basket' }, ...(leafThing ? [{ thing: leafThing }] : []), { person: 'npc:healer' }]) {
    h.session.command({ type: 'tap', target });
    h.run(4);
  }
  const after = h.said.slice(done).map((x) => x.key);
  assert.ok(!after.some((k) => /^healer\.(need|dose)|^teacher\.need/.test(k)), after.join(", "));
});

test('on a phone, a leaf of one dose and the basket of the child are at least a finger target, and the first bunch in the hands makes the basket glow', async () => {
  const h = await atHealer(4);
  const cam = sessionCamera(h.session);
  const FINGER = 40; // pixels: about 7 mm on the glass of a phone of 390 × 844
  for (const id of ['leaf-0', 'leaf-1', 'basket']) {
    const z = h.zone(id);
    const r = z.rect;
    const p = (x, zz) => cam.project(x / 2, z.y / 2, zz / 2);
    const w = Math.hypot(p(r.x1, r.z0).x - p(r.x0, r.z0).x, p(r.x1, r.z0).y - p(r.x0, r.z0).y);
    const d = Math.hypot(p(r.x0, r.z1).x - p(r.x0, r.z0).x, p(r.x0, r.z1).y - p(r.x0, r.z0).y);
    assert.ok(w >= FINGER && d >= FINGER, `${id}: ${w.toFixed(0)} × ${d.toFixed(0)} pixels`);
  }
  const cues = [];
  h.session.listen((e) => { if (e.type === 'cue') cues.push(...e.ids); });
  h.tapThing(h.bedThing('ngai'));
  h.press();
  h.run(1);
  assert.ok(cues.includes('basket:healer'), cues.join(', '));
});
