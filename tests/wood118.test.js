// The woodcutter after the play test of #105 to #114 (#118): which way to move the chalk, a short
// count for the youngest, the demonstration beside the child, a tap near the stem, the knife only
// with enough marks, the rest of grade 5 as a fraction, and the stem in view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity } from '../src/core/world/state.js';
import { tapTarget, sessionCamera, sessionScreen } from '../src/world/hit.js';

const profile = (grade = 1) => ({ name: 'An', grade, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } });
const start = [
  { press: { entity: 'npc:woodcutter' } },
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
  { read: true },
  { until: { event: 'call', with: { key: 'mentor.woodcutter.first' }, timeout: 15 } },
];
async function atStem(grade = 1, hook = () => {}) {
  let session = null;
  const keys = [];
  const failures = await runHeadless({ name: 'wood-118', profile: profile(grade), clock: 540, at: ['phu-dong', 51, 8.5], steps: start }, {
    onSession: (s) => {
      session = s;
      s.listen((ev) => { if (ev.type === 'open' && ev.textKey) keys.push(ev.textKey); });
      hook(s);
    },
  });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  return { session, keys };
}
function run(session, seconds, until = () => false) {
  for (let i = 0; i < seconds / STEP && !until(); i++) {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
  }
}
const send = (session, cmd) => {
  session.command(cmd);
  session.events();
};
const wood = (session) => getEntity(session.state, 'zone:trial-woodcutter').zone;
// A mark at a ring with a tap and a press, from beside the stem.
function mark(session, at) {
  const stem = getEntity(session.state, 'stem:woodcutter');
  const hero = getEntity(session.state, 'hero');
  Object.assign(hero.position, { x: stem.position.x + at, z: stem.position.z + 2.5 });
  delete hero.route;
  run(session, 0.5);
  send(session, { type: 'tap', target: { thing: stem.id, along: at } });
  run(session, 0.3);
  send(session, { type: 'hands' });
  run(session, 1.5);
}
// A cut with a tap on the woodcutter and a press.
function cut(session) {
  send(session, { type: 'tap', target: { person: 'npc:woodcutter' } });
  run(session, 3);
  send(session, { type: 'hands' });
  run(session, 1);
}

test('grade 1, a mark one ring off the end: one number for each piece, the part of the long piece glows, and the new stem shows which way to move the chalk', async () => {
  const spawned = [];
  const { session, keys } = await atStem(1, (s) => s.listen((ev) => { if (ev.type === 'spawn' || ev.type === 'call') spawned.push(ev); }));
  const looks = new Set();
  const seen = () => { for (const e of session.state.entities) if (e.look) looks.add(e.look); };
  mark(session, 1);
  assert.deepEqual(wood(session).marks, [1]);
  cut(session);
  const s = wood(session).stem;
  run(session, 30, () => { seen(); return !getEntity(session.state, 'stem:woodcutter').hidden && !wood(session).cut; });
  run(session, 2, () => { seen(); return false; });
  assert.equal(keys.filter((k) => k === 'woodcutter.pieceN').length, 2, `two numbers: ${keys.join(', ')}`);
  assert.ok(!keys.includes('woodcutter.piece'), 'no count ring by ring');
  assert.ok(keys.includes('woodcutter.longer'), keys.join(', '));
  assert.ok(looks.has(`piece-glow-${s.length - 2}`), `the part that sticks out glows: ${[...looks].join(', ')}`);
  assert.ok(keys.includes('woodcutter.move'), keys.join(', '));
  const old = getEntity(session.state, 'old:woodcutter:1');
  assert.equal(old?.look, 'chalk-old', 'the chalk of the last try stays, grey');
  const man = getEntity(session.state, 'npc:woodcutter');
  assert.ok(man.gesture && man.gesture.x > s.x + 1, 'he points toward the long piece');
  assert.ok(keys.includes('woodcutter.tap'), 'the first time: a tap on the stem chooses the place');
});

test('grade 2: after a wrong cut, the long piece is named, and the count is ring by ring', async () => {
  const { session, keys } = await atStem(2);
  const len = wood(session).stem.length;
  mark(session, 2);
  mark(session, len - 2);
  cut(session);
  run(session, 40, () => !getEntity(session.state, 'stem:woodcutter').hidden && !wood(session).cut);
  assert.ok(keys.includes('woodcutter.longer'), keys.join(', '));
  assert.ok(keys.includes('woodcutter.piece') && !keys.includes('woodcutter.pieceN'), keys.join(', '));
});

test('the short stem of the demonstration lies beside the hero, in the view, and not under the hero', async () => {
  const { session, keys } = await atStem(0);
  const len = wood(session).stem.length;
  let demo = null;
  let under = false;
  let out = false;
  for (let k = 0; k < 2; k++) {
    mark(session, len / 2 - 1);
    cut(session);
    run(session, 60, () => !getEntity(session.state, 'stem:woodcutter').hidden && !wood(session).cut);
    run(session, 1);
  }
  run(session, 20, () => {
    const d = session.state.entities.find((e) => e.demo && /^stem-/.test(e.look ?? ''));
    if (!d) return false;
    demo = d;
    const h = getEntity(session.state, 'hero').position;
    const n = Number(d.look.split('-')[1]);
    const f = d.position.facing ?? 0;
    const cam = sessionCamera(session);
    for (let j = 0; j <= n; j++) {
      const p = { x: d.position.x + Math.sin(f) * j, z: d.position.z + Math.cos(f) * j };
      if (Math.hypot(p.x - h.x, p.z - h.z) < 1.5) under = true;
      const q = cam.project(p.x / 2, d.position.y / 2, p.z / 2);
      if (q.x < 0 || q.x > cam.width || q.y < 0 || q.y > cam.height * 0.8) out = true;
    }
    return false;
  });
  assert.ok(keys.includes('mentor.woodcutter.demo'), keys.join(', '));
  assert.ok(demo, 'the short stem');
  assert.ok(!under, 'not under the hero');
  assert.ok(!out, 'in the view, above the buttons');
});

test('a finger next to the stem chooses the ring nearest to it', async () => {
  const { session } = await atStem(1);
  const stem = getEntity(session.state, 'stem:woodcutter');
  run(session, 1);
  const cam = sessionCamera(session);
  for (const j of [2, 5]) {
    // The finger a little beside ring j, off the body of the stem.
    const p = cam.project((stem.position.x + j - 0.5) / 2, stem.position.y / 2, (stem.position.z + 1.1) / 2);
    const t = tapTarget(p, sessionScreen(session, cam));
    assert.equal(t?.thing, stem.id, JSON.stringify(t));
    assert.ok(Math.abs(t.along - (j - 0.5)) <= 1, `ring ${j}: ${t.along}`);
  }
});

test('grade 5: after one mark the button is the chalk, after two it is the knife; a tap on the woodcutter still cuts', async () => {
  const { session, keys } = await atStem(5);
  const len = wood(session).stem.length;
  mark(session, len / 3);
  assert.equal(wood(session).marks.length, 1);
  assert.notEqual(session.action()?.act, 'cut', JSON.stringify(session.action()));
  assert.ok(keys.includes('woodcutter.needMarks'), keys.join(', '));
  mark(session, len / 3 + len / 4);
  assert.equal(wood(session).marks.length, 2);
  assert.equal(session.action()?.act, 'cut', JSON.stringify(session.action()));
});

test('grade 5: the end says the rest as a fraction, and the whole', async () => {
  const { session, keys } = await atStem(5);
  const len = wood(session).stem.length;
  mark(session, len / 3);
  mark(session, len / 3 + len / 4);
  cut(session);
  run(session, 60, () => wood(session).done || keys.includes('woodcutter.rest'));
  assert.ok(keys.includes('woodcutter.rest'), keys.join(', '));
});

test('while the hero marks, the whole stem is in the view', async () => {
  const { session } = await atStem(1);
  mark(session, 3);
  run(session, 2);
  const stem = getEntity(session.state, 'stem:woodcutter');
  const len = wood(session).stem.length;
  const cam = sessionCamera(session);
  for (const j of [0, len]) {
    const q = cam.project((stem.position.x + j) / 2, stem.position.y / 2, stem.position.z / 2);
    assert.ok(q.x >= 0 && q.x <= cam.width && q.y >= 0 && q.y <= cam.height * 0.8, `the end ${j} at ${q.x.toFixed(0)}, ${q.y.toFixed(0)}`);
  }
});
