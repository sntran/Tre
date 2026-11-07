// The leaves of bà lang at grade 4 (#160): each put says the count of its kind in the basket, a
// tap on the basket says the count of each kind, the child takes the extra out after her count,
// her help never takes a bunch out, and she and the hero stand beside the leaves of her count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { putWork, takeOut } from '../src/core/world/systems/work.js';

const s0 = load('tests/stories/trial-healer.json');
const first = s0.steps.findIndex((x) => x.read === true) + 1;
const vi = load('i18n/vi.json');

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
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const press = (sec = 1.5) => { session.command({ type: 'hands', id: session.action()?.id ?? null }); run(sec); };
  const zone = (id) => getEntity(session.state, `zone:${id}`)?.zone;
  const count = (k) => zone('basket').items.filter((id) => getEntity(session.state, id)?.item.kind === `herb-${k}`).length;
  // Bunches into the basket at once (the presses of a child who presses fast, with no walk).
  const fill = (k, n) => {
    for (let i = 0; i < n; i++) {
      const id = zone(`bed-${k}`).items.find((x) => !getEntity(session.state, x)?.item.held);
      const e = getEntity(session.state, id);
      takeOut(session.state, e);
      assert.ok(putWork(session.state, getEntity(session.state, 'hero'), zone('basket'), e, null, {}), `a bunch of ${k} into the basket`);
    }
  };
  const give = () => {
    session.command({ type: 'tap', target: { person: 'npc:healer' } });
    run(4);
    press(0.5);
  };
  return { session, said, run, press, zone, count, fill, give };
}

test('six fast presses at the bed of ngải cứu: six bunches in rows of five, and the last line says six', async () => {
  const h = await atHealer(4);
  const id = h.zone('bed-ngai').items.find((x) => !getEntity(h.session.state, x)?.item.held);
  h.session.command({ type: 'tap', target: { thing: id } });
  h.run(5);
  const from = h.said.length;
  for (let i = 0; i < 6 * 4 && h.count('ngai') < 6; i++) h.press(0.25);
  assert.equal(h.count('ngai'), 6);
  h.run(1);
  const lines = h.said.slice(from).filter((l) => /^healer\.count\.kind/.test(l.key));
  assert.ok(lines.length, h.said.slice(from).map((l) => l.key).join(', '));
  assert.equal(lines.at(-1).params.n.key, 'num.6');
  assert.equal(vi['healer.count.kind'], '{n} bó {herb}.');
  // Rows of five: the sixth bunch starts the second row.
  const at = h.zone('basket').items.map((x) => getEntity(h.session.state, x).position);
  assert.equal(new Set(at.slice(0, 5).map((p) => p.z.toFixed(2))).size, 1, 'the first five in one row');
  assert.ok(at[5].z > at[0].z, 'the sixth in the next row');
});

test('a basket with three bunches too many of each kind: her count, the line of the take, the take on the button, three takes, and then a right basket that she praises', async () => {
  const h = await atHealer(4);
  const need = h.zone('basket').need;
  assert.ok(['doses', 'model'].includes(h.zone('trial-healer').plan.form));
  h.fill('ngai', need.ngai + 3);
  h.fill('tiato', need.tiato + 2);
  h.fill('rauma', need.rauma + 2);
  // A tap on the basket says the count of each kind.
  let from = h.said.length;
  h.session.command({ type: 'tap', target: { thing: 'basket:healer' } });
  h.run(1);
  const all = h.said.slice(from).find((l) => l.key === 'healer.count.all');
  assert.ok(all, h.said.slice(from).map((l) => l.key).join(', '));
  assert.deepEqual(all.params.list.map((x) => x.params.n.key), [`num.${need.ngai + 3}`, `num.${need.tiato + 2}`, `num.${need.rauma + 2}`]);
  h.run(4);
  from = h.said.length;
  h.give();
  const total = need.ngai + need.tiato + need.rauma + 7;
  let ask = null;
  for (let i = 0; i < 90 && !ask; i++) {
    h.run(0.5);
    ask = h.said.slice(from).find((l) => /^healer\.take\.ask/.test(l.key));
  }
  assert.ok(ask, h.said.slice(from).map((l) => l.key).join(', '));
  const keys = h.said.slice(from).map((l) => l.key);
  assert.ok(keys.indexOf('healer.dose.left') < keys.indexOf(ask.key), 'the take after the count');
  assert.equal(ask.params.n.key, 'num.3');
  assert.equal(ask.params.herb.key, 'herb.name.ngai');
  h.run(6);
  assert.equal(h.zone('basket').items.length, total, 'her count leaves every bunch of the child in the basket');
  assert.equal(h.session.action()?.act, 'take', 'the take on the button');
  for (let i = 0; i < 3; i++) h.press(1.2);
  assert.equal(h.count('ngai'), need.ngai, 'three takes of ngải cứu');
  assert.ok(h.said.some((l) => l.key === 'healer.take.out'), 'the line of a take');
  // Then the other kinds, and the give: the praise comes after the basket of the child.
  for (let i = 0; i < 8 && h.session.action()?.act === 'take'; i++) h.press(1.2);
  assert.deepEqual(['ngai', 'tiato', 'rauma'].map(h.count), [need.ngai, need.tiato, need.rauma]);
  h.give();
  h.run(10);
  assert.ok(h.zone('trial-healer').done, h.said.slice(-6).map((l) => l.key).join(', '));
});

test('the help of the level says the need, and the basket keeps every bunch of the child', async () => {
  const h = await atHealer(4);
  const need = h.zone('basket').need;
  h.fill('ngai', need.ngai + 2);
  h.fill('tiato', need.tiato);
  h.fill('rauma', need.rauma);
  const total = h.zone('basket').items.length;
  // A wrong give, and then three waves: the help climbs to the move of the level.
  h.give();
  h.run(30);
  const from = h.said.length;
  for (let i = 0; i < 3; i++) {
    h.session.command({ type: 'wave' });
    h.run(12);
  }
  const keys = h.said.slice(from).map((l) => l.key);
  assert.ok(keys.includes('healer.need.doses'), keys.join(', '));
  assert.equal(h.zone('basket').items.length, total, 'no bunch went out of the basket');
});

test('during her count, bà lang and the hero stand beside the leaves of the doses, not on them', async () => {
  const h = await atHealer(4);
  const need = h.zone('basket').need;
  h.fill('ngai', need.ngai + 3);
  h.fill('tiato', need.tiato);
  h.fill('rauma', need.rauma);
  // The hero stands in front of the basket, where the leaves of the doses lie.
  const r = h.zone('basket').rect;
  Object.assign(getEntity(h.session.state, 'hero').position, { x: r.x0 + 2, z: r.z1 + 1.6 });
  h.give();
  const on = [];
  let seen = 0;
  for (let i = 0; i < 80 && (i < 4 || h.zone('trial-healer').lay); i++) {
    h.run(0.25);
    const leaves = h.session.state.entities.filter((e) => e.look === 'herb-leaf' && e.position);
    seen = Math.max(seen, leaves.length);
    for (const id of ['npc:healer', 'hero']) {
      const p = getEntity(h.session.state, id).position;
      if (leaves.some((l) => Math.hypot(l.position.x - p.x, l.position.z - p.z) < 1)) on.push(id);
    }
  }
  assert.ok(seen > 0, 'the leaves of her count');
  assert.deepEqual([...new Set(on)], []);
});
