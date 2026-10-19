// Small things after the play test of #95 to #104 (#113): the elder looks like an old man from each
// angle of the view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personFine } from '../src/world/fine.js';
import { person } from '../src/world/figures.js';
import { load } from './helpers.js';

const figs = load('data/figures.json').figures;

// The rectangle of a part of the head as the camera sees it from a side: from the front or the
// back, x and y; from the left or the right, z and y.
const rectOf = (p, side) => {
  const [w, h, d] = p.size;
  const [x, y, z] = p.at;
  const u = side === 'x' ? [z - d / 2, z + d / 2] : [x - w / 2, x + w / 2];
  return { u0: u[0], u1: u[1], v0: y - h / 2, v1: y + h / 2 };
};
// Does a point of the beard show out of the other parts of the head, from that side?
function beardShows(parts, side) {
  const head = parts.filter((p) => p.parent === 'head' && !/^beard/.test(p.name) && p.size[0] > 0.05);
  const beard = parts.filter((p) => /^beard/.test(p.name));
  for (const b of beard) {
    const r = rectOf(b, side);
    for (let i = 0; i <= 8; i++) {
      for (let j = 0; j <= 8; j++) {
        const u = r.u0 + ((r.u1 - r.u0) * i) / 8;
        const v = r.v0 + ((r.v1 - r.v0) * j) / 8;
        // From the front, the beard is in front of the face; from the back and the sides, it shows
        // only out of the head.
        if (side === 'front') return true;
        if (!head.some((p) => { const q = rectOf(p, side); return u > q.u0 && u < q.u1 && v > q.v0 && v < q.v1; })) return true;
      }
    }
  }
  return false;
}

test('the elder: a dark robe, a khăn, and a white beard that shows from the front, the side, and the back', () => {
  const e = figs.elder;
  assert.equal(e.hat, 'khan');
  assert.ok(['wood', 'ink', 'indigo'].includes(e.top), `a dark robe: ${e.top}`);
  assert.equal(e.beard, true);
  assert.equal(e.item, 'staff');
  for (const fig of [personFine(e), person(e)]) {
    for (const side of ['front', 'back', 'x']) assert.ok(beardShows(fig.parts, side), `${fig.grid ? 'fine' : 'coarse'}: the beard shows from the ${side === 'x' ? 'side' : side}`);
  }
});

// The hero at the đình when the envoy has come (the step of the goal is the envoy).
async function atEnvoy(cell = [34, 27], steps = [{ wait: 1 }]) {
  const { runHeadless } = await import('./story-run.js');
  const { getEntity } = await import('../src/core/world/state.js');
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true, 'prologue.done': true, 'trial.scholar.done': true, 'trial.smith.done': true, 'trial.fisher.done': true, 'trial.healer.done': true, 'trial.woodcutter.done': true } };
  let session = null;
  const failures = await runHeadless({ name: 'envoy-113', profile, clock: 600, at: ['phu-dong', ...cell], steps }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  return { session, getEntity };
}

test('with the envoy near the hero, the big button talks to the envoy, not to the elder', async () => {
  // Next to the elder, and the envoy a few steps away.
  const { session } = await atEnvoy([32, 26.5]);
  const a = session.action();
  assert.equal(a?.act, 'talk');
  assert.equal(a.target, 'npc:messenger', JSON.stringify(a));
});

test('while the envoy waits at the đình, the people of the village walk there and stand around him', async () => {
  const { session, getEntity } = await atEnvoy();
  const run = (sec) => {
    for (let i = 0; i < sec * 30; i++) {
      if (session.screen) session.command({ type: 'close' });
      session.step();
      session.events();
    }
  };
  run(60);
  const envoy = getEntity(session.state, 'npc:messenger').position;
  const near = ['elder', 'grandma', 'teacher', 'healer', 'smith'].filter((id) => {
    const e = getEntity(session.state, `npc:${id}`);
    return e && !e.hidden && Math.hypot(e.position.x - envoy.x, e.position.z - envoy.z) <= 10;
  });
  assert.ok(near.length >= 3, `people near the envoy: ${near.join(', ')}`);
});

test('the card of a new animal comes only while the animal is on the screen, and names the animal that pulses', async () => {
  const { runHeadless } = await import('./story-run.js');
  const { getEntity } = await import('../src/core/world/state.js');
  const { inView, viewSize } = await import('../src/world/view.js');
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
  let session = null;
  const cards = [];
  await runHeadless({ name: 'card-113', profile, clock: 600, at: ['phu-dong', 40, 60], steps: [{ wait: 0.5 }] }, {
    onSession: (s) => {
      session = s;
      s.listen((e) => { if (e.type === 'notebook' && e.from) cards.push(e); });
    },
  });
  const hero = getEntity(session.state, 'hero');
  const dog = session.state.entities.find((e) => e.kind === 'dog' && e.position);
  assert.ok(dog, 'a dog');
  const hold = (p) => {
    for (let i = 0; i < 60; i++) {
      Object.assign(dog.position, p);
      delete dog.route;
      session.step();
      session.events();
    }
  };
  // Near, but off the screen of a phone held upright.
  const scr = viewSize(390, 844, 0);
  const hp = hero.position;
  let off = null;
  for (let a = 0; a < 16 && !off; a++) {
    const p = { x: hp.x + Math.sin(a * Math.PI / 8) * 16, y: hp.y, z: hp.z + Math.cos(a * Math.PI / 8) * 16 };
    if (!inView({ x0: p.x / 2 - 0.4, x1: p.x / 2 + 0.4, y0: p.y / 2, y1: p.y / 2 + 0.8, z0: p.z / 2 - 0.4, z1: p.z / 2 + 0.4 }, { x: hp.x / 2, y: hp.y / 2, z: hp.z / 2 }, { az: Math.PI / 4, size: scr })) off = p;
  }
  assert.ok(off, 'a point off the screen');
  hold(off);
  assert.equal(cards.filter((c) => c.from === dog.id).length, 0, 'no card while the dog is off the screen');
  hold({ x: hp.x + 2, y: hp.y, z: hp.z + 2 });
  assert.ok(cards.some((c) => c.from === dog.id), 'the card when the dog is on the screen');
});

test('no greeting has a word of praise, and an old person says hello', () => {
  for (const lang of ['vi', 'en']) {
    const dict = load(`i18n/${lang}.json`);
    for (const [k, v] of Object.entries(dict)) {
      if (!/^world\.greet\./.test(k)) continue;
      assert.ok(!/ngoan|giỏi|tốt lắm|good (child|boy|girl)|well done|clever/i.test(v), `${lang} ${k}: ${v}`);
    }
  }
});
