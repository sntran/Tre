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

// The hands of a child, step by step (a tap on a thing or a place, and a press).
function hands(session) {
  const run = (sec) => {
    for (let i = 0; i < sec * 30; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const press = () => { session.command({ type: 'hands', id: session.action()?.id }); run(1.5); };
  // A tap as the child does it: a person, a thing, or the middle of a place.
  const tapAt = (id) => {
    const e = getEntity(session.state, id);
    const target = e.person ? { person: id } : e.zone ? session.targetAt(e.zone.x / 2, e.zone.z / 2) : { thing: id };
    session.command({ type: 'tap', target });
    run(4);
  };
  const held = () => getEntity(session.state, 'hero').hands?.holds ?? null;
  // Take a thing of a zone (a heap or the mat), and put it into a place.
  const move = (from, kind, to) => {
    const z = getEntity(session.state, `zone:${from}`).zone;
    const id = z.items.find((i) => getEntity(session.state, i)?.item.kind === kind);
    if (!id) return false;
    // A thing on a place: first a walk next to it (a tap on a thing on a place is a check, #64).
    if (z.rule !== 'heap') {
      const p = getEntity(session.state, id).position;
      session.command({ type: 'tap', target: { ground: { x: p.x / 2, y: p.z / 2 - 2.2, h: 0, thing: false, object: null, goal: true } } });
      run(4);
    }
    tapAt(id);
    press();
    if (held() !== id) return getEntity(session.state, id)?.item.zone === to;
    tapAt(`zone:${to}`);
    press();
    return held() === null;
  };
  return { run, press, tapAt, move };
}

test('grade 4: the bundles and rods are shared among the desks, a bundle opens on the mat, the rest goes into the box, and the check counts each desk', async () => {
  const { session, said, plan } = await play(4);
  assert.equal(plan.form, 'share');
  assert.ok(said.includes('dlg.teacher.trial.n3.share'));
  const h = hands(session);
  const heard = [];
  session.listen((e) => { if (e.type === 'open' && e.textKey) heard.push(e.textKey); });
  // One desk with one rod less: the check says the desks are not equal.
  const each = plan.each;
  let bundles = plan.tens;
  for (let i = 0; i < plan.k; i++) {
    let need = each;
    while (need >= 10 && bundles > 0) {
      assert.ok(h.move('rods', 'rodbundle', `desk-${i}`), `a bundle to desk ${i}`);
      bundles -= 1;
      need -= 10;
    }
    while (need > 0) {
      const z = (id) => getEntity(session.state, `zone:${id}`).zone;
      if (!z('mat').items.length && !z('rods').items.some((id) => getEntity(session.state, id)?.item.kind === 'rod')) {
        assert.ok(h.move('rods', 'rodbundle', 'mat'), 'a bundle opens on the mat');
        bundles -= 1;
      }
      const from = z('rods').items.some((id) => getEntity(session.state, id)?.item.kind === 'rod') ? 'rods' : 'mat';
      assert.ok(h.move(from, 'rod', `desk-${i}`), `a rod to desk ${i}`);
      need -= 1;
    }
  }
  // The rest into the box, but the last rod stays on the heap or the mat: a first check.
  const z = (id) => getEntity(session.state, `zone:${id}`).zone;
  const loose = () => [...z('rods').items, ...z('mat').items].filter((id) => getEntity(session.state, id)?.item.kind === 'rod');
  while (loose().length + z('rods').items.length > 0) {
    if (!loose().length) assert.ok(h.move('rods', 'rodbundle', 'mat'));
    const from = z('rods').items.some((id) => getEntity(session.state, id)?.item.kind === 'rod') ? 'rods' : 'mat';
    assert.ok(h.move(from, 'rod', 'box'));
  }
  h.tapAt('npc:teacher');
  h.press();
  h.run(20);
  assert.ok(getEntity(session.state, 'zone:trial-scholar').zone.done, `done: ${heard.join(' ')}`);
});

test('grade 4: desks that are not equal: the teacher counts each desk and says so', async () => {
  const { session } = await play(4);
  const h = hands(session);
  const heard = [];
  session.listen((e) => { if (e.type === 'open' && e.textKey) heard.push(e.textKey); });
  assert.ok(h.move('rods', 'rodbundle', 'desk-0'));
  h.tapAt('npc:teacher');
  h.press();
  h.run(14);
  assert.ok(heard.includes('num.10') && heard.includes('num.0'), heard.join(' '));
  assert.ok(heard.includes('mentor.scholar.box'), heard.join(' '));
  assert.ok(heard.includes('mentor.scholar.shareLeft'), heard.join(' '));
});

test('grade 5: ten bundles tie into a big bundle; the table makes the number, and a wrong table is counted in parts and in words', async () => {
  const { session, said, plan } = await play(5);
  assert.equal(plan.form, 'decimal');
  assert.ok(said.includes('dlg.teacher.trial.n3.decimal'));
  const h = hands(session);
  const heard = [];
  session.listen((e) => { if (e.type === 'open' && e.textKey) heard.push(e.textKey); });
  const z = (id) => getEntity(session.state, `zone:${id}`).zone;
  const big = Math.floor(plan.x / 100);
  for (let b = 0; b < big; b++) {
    for (let i = 0; i < 10; i++) assert.ok(h.move('rods', 'rodbundle', 'mat'), 'a bundle to the mat');
    h.tapAt('npc:teacher');
    h.press();
    h.run(3);
  }
  assert.equal(z('rods').items.filter((id) => getEntity(session.state, id)?.item.kind === 'bigbundle').length, big, 'the big bundles');
  for (let b = 0; b < big; b++) assert.ok(h.move('rods', 'bigbundle', 'table'));
  // One bundle too few: the count of the parts and the number in words.
  const tens = Math.floor((plan.x % 100) / 10);
  for (let i = 0; i < Math.max(0, tens - 1); i++) assert.ok(h.move('rods', 'rodbundle', 'table'));
  for (let i = 0; i < plan.x % 10; i++) assert.ok(h.move('rods', 'rod', 'table'));
  h.tapAt('npc:teacher');
  h.press();
  h.run(16);
  assert.ok(heard.includes('scholar.part.big') && heard.includes('scholar.part.value') && heard.includes('mentor.scholar.need'), heard.join(' '));
  if (tens) assert.ok(h.move('rods', 'rodbundle', 'table'));
  else for (let i = 0; i < 10; i++) assert.ok(h.move('rods', 'rod', 'table'));
  h.tapAt('npc:teacher');
  h.press();
  h.run(6);
  assert.ok(z('trial-scholar').done, heard.join(' '));
});
