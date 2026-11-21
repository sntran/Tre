// The share puts the sack where the child wants (#177): the mats lie one mat wide apart and two
// mats from the pile, a tap on a mat and a press put the sack on that mat, the owner says the count
// after each put, and Gióng sits behind his mat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';

const vi = load('i18n/vi.json');

async function atShare(name) {
  const s0 = load(`tests/stories/${name}.json`);
  const upto = s0.steps.findIndex((x) => x.expect?.some?.((f) => f.text?.shown === 'share.start'));
  let session = null;
  const said = [];
  const events = [];
  const steps = s0.steps.slice(0, upto + 1).map((x) => (x.expect ? { ...x, expect: x.expect.filter((f) => f.entity !== 'by:share-giong') } : x));
  const failures = await runHeadless({ ...s0, steps }, { onSession: (x) => {
    session = x;
    x.listen((e) => {
      events.push(e);
      if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, params: e.params ?? {} });
    });
  } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  return { session, said, events, run };
}

const MAT = 3.4; // half blocks: the width of a mat
const edgeGap = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)) - MAT;

for (const name of ['raid-soldiers', 'raid-boss']) {
  test(`${name}: the mats lie at least one mat apart, and the pile two mats from the nearest mat`, async () => {
    const h = await atShare(name);
    const z = (w) => getEntity(h.session.state, `zone:share-${w}`).zone;
    const mats = ['hero', 'nghe', 'giong'].map(z);
    for (let i = 1; i < mats.length; i++) assert.ok(edgeGap(mats[i - 1], mats[i]) >= MAT - 1e-6, `gap ${edgeGap(mats[i - 1], mats[i])}`);
    const pile = getEntity(h.session.state, 'zone:loot').zone;
    for (const m of mats) assert.ok(Math.hypot(m.x - pile.x, m.z - pile.z) - MAT / 2 >= 2 * MAT, `pile ${Math.hypot(m.x - pile.x, m.z - pile.z)}`);
  });
}

async function withSack(name) {
  const h = await atShare(name);
  h.run(6);
  const pile = getEntity(h.session.state, 'zone:loot').zone;
  h.session.command({ type: 'tap', target: { thing: pile.items[0] } });
  h.run(6);
  h.session.command({ type: 'hands', id: h.session.action()?.id });
  h.run(1.5);
  assert.equal(getEntity(h.session.state, h.session.holding())?.item.kind, 'sack');
  return h;
}

test('a tap on the mat of Gióng and a press put the sack there, also from beside the mat of Nghé, and Gióng says the count', async () => {
  const h = await withSack('raid-soldiers');
  const nghe = getEntity(h.session.state, 'zone:share-nghe').zone;
  const hero = getEntity(h.session.state, 'hero');
  // The hero stands by the mat of Nghé, between the mats of Nghé and of Gióng.
  const giong = getEntity(h.session.state, 'zone:share-giong').zone;
  Object.assign(hero.position, { x: nghe.x + (giong.x - nghe.x) * 0.35, z: nghe.z + (giong.z - nghe.z) * 0.35 + 3 });
  hero.position.facing = Math.atan2(nghe.x - hero.position.x, nghe.z - hero.position.z);
  h.run(0.5);
  h.session.command({ type: 'tap', target: { ground: { x: giong.x / 2, y: giong.z / 2, h: giong.y / 2, thing: false, object: null } } });
  h.run(6);
  const a = h.session.action();
  assert.equal(a?.target, 'zone:share-giong', `the button: ${a?.act} ${a?.target}`);
  assert.ok(a.ghost, 'the ghost of the sack on the mat');
  const from = h.said.length;
  h.session.command({ type: 'hands', id: a.id });
  h.run(2);
  assert.equal(getEntity(h.session.state, 'zone:share-giong').zone.items.length, 1);
  const line = h.said.slice(from).find((l) => l.key === 'share.put.one');
  assert.ok(line, h.said.slice(from).map((l) => l.key).join(', '));
  assert.equal(vi['share.put'].replace('{who}', vi['share.who.giong']).replace('{n}', vi['num.2']), 'Chiếu của Gióng: hai bao.');
});

test('with no tap, the press puts the sack on the mat that the hero faces', async () => {
  const h = await withSack('raid-soldiers');
  const hero = getEntity(h.session.state, 'hero');
  const hz = getEntity(h.session.state, 'zone:share-hero').zone;
  const nz = getEntity(h.session.state, 'zone:share-nghe').zone;
  // Between the mats of the hero and of Nghé, nearer to the mat of the hero, but facing the mat of Nghé.
  Object.assign(hero.position, { x: hz.x + (nz.x - hz.x) * 0.45, z: hz.z + (nz.z - hz.z) * 0.45 + 2.5 });
  hero.position.facing = Math.atan2(nz.x - hero.position.x, nz.z - hero.position.z);
  h.run(0.3);
  hero.position.facing = Math.atan2(nz.x - hero.position.x, nz.z - hero.position.z);
  assert.equal(h.session.action()?.target, 'zone:share-nghe');
});

test('Gióng sits behind his mat', async () => {
  const h = await atShare('raid-soldiers');
  h.run(10);
  const g = getEntity(h.session.state, 'by:share-giong') ?? query(h.session.state, 'person').find((e) => e.person.ref === 'giong-hero');
  assert.ok(g, 'Gióng at the share');
  assert.equal(g.act, 'sit');
});

test('after the share, a tap on the farmer and a press give the rest', async () => {
  const h = await atShare('raid-soldiers');
  h.run(6);
  // The child deals two sacks to each mat (the dealer of the robot does the same).
  const pile = () => getEntity(h.session.state, 'zone:loot').zone;
  for (let k = 0; k < 6; k++) {
    h.session.command({ type: 'tap', target: { thing: pile().items[0] } });
    h.run(5);
    h.session.command({ type: 'hands', id: h.session.action()?.id });
    h.run(1.5);
    const mat = getEntity(h.session.state, `zone:share-${['hero', 'nghe', 'giong'][k % 3]}`).zone;
    h.session.command({ type: 'tap', target: { ground: { x: mat.x / 2, y: mat.z / 2, h: mat.y / 2, thing: false, object: null } } });
    h.run(5);
    h.session.command({ type: 'hands', id: h.session.action()?.id });
    h.run(1.5);
  }
  h.run(5);
  const gift = getEntity(h.session.state, h.session.holding());
  assert.equal(gift?.item.kind, 'gift', 'the rest is in the hands');
  const farmer = getEntity(h.session.state, 'npc:hamlet');
  assert.ok(farmer, 'the farmer by the mats');
  h.session.command({ type: 'tap', target: { person: farmer.id } });
  h.run(6);
  const a = h.session.action();
  assert.equal(a?.act, 'give', `the button: ${a?.act}`);
  h.session.command({ type: 'hands', id: a.id });
  h.run(3);
  assert.ok(!h.session.holding(), 'the rest is given');
});
