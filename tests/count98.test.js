// Counts that a child can follow (#98): each rod of the mat is seen alone and no animal stands on
// the mat, the woodcutter never calls a piece of the right length short, the first example of the
// woodcutter is all in the frame, and the line of `raise` comes only when it is true.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { taskPlaces, wayOut } from '../src/core/world/systems/steer.js';
import { badPiece } from '../src/core/world/zones.js';
import { frameWork, TALK_SAFE, viewSize, VIEW } from '../src/world/view.js';
import { viewCamera } from '../src/world/hit.js';

const story = (name) => load(`tests/stories/${name}.json`);

test('an animal in two places that touch goes out of both, not from one into the other', () => {
  const places = [{ x0: 0, x1: 10, z0: 0, z1: 6 }, { x0: 10, x1: 20, z0: -1, z1: 8 }];
  const inPlace = (p) => places.find((r) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1) ?? null;
  // On the line between the two places: the nearest side of each place goes into the other.
  const p = { x: 10.2, z: 2 };
  const [ox, oz] = wayOut(p, inPlace);
  assert.deepEqual([ox, oz], [0, -1], 'out by the near side of the two places');
  for (let i = 0; i < 40 && inPlace(p); i++) {
    const [dx, dz] = wayOut(p, inPlace);
    p.x += dx * 0.2;
    p.z += dz * 0.2;
  }
  assert.equal(inPlace(p), null);
});

test('no animal of the village stands on the mat or the heap of the teacher while the task is open', async () => {
  const s = story('trial-scholar');
  const first = s.steps.findIndex((x) => x.read === true) + 2;
  let session = null;
  let inside = [];
  const probe = () => {
    if (!session || getEntity(session.state, 'zone:trial-scholar')?.zone.done !== false || session.state.tick < 60) return;
    const places = taskPlaces(session.state);
    for (const e of session.state.entities) {
      if (!e.kind || !e.position || e.hidden || e.person || e.follow) continue;
      // The places with half of their margin: the mat, its rods, and the heap.
      if (places.some((r) => e.position.x > r.x0 + 1 && e.position.x < r.x1 - 1 && e.position.z > r.z0 + 1 && e.position.z < r.z1 - 1)) inside.push(`${session.state.tick} ${e.id}`);
    }
  };
  const put = (n) => ({ repeat: n, steps: [{ press: { item: 'rod' } }, { until: { event: 'put', timeout: 10 } }] });
  const failures = await runHeadless({ ...s, steps: [...s.steps.slice(0, first), put(6), { wait: 60 }] }, {
    onSession: (x) => {
      session = x;
      const step = x.step.bind(x);
      x.step = (...a) => { const r = step(...a); probe(); return r; };
    },
  });
  assert.deepEqual(failures, []);
  assert.ok(session.state.entities.some((e) => e.kind === 'chicken' && !e.hidden), 'the chickens of the school yard');
  assert.deepEqual(inside.slice(0, 5), [], 'no animal on the mat or the heap');
});

test('the woodcutter names a long piece after a wrong number of pieces, and a short piece only after the right number', () => {
  // Vy: a stem of 12 for four pieces of 3.
  assert.deepEqual(badPiece([8, 4], 4), { i: 0, long: true });
  assert.deepEqual(badPiece([4, 3, 5], 4), { i: 2, long: true });
  // The right number of pieces that are not equal: the short one, as before.
  assert.deepEqual(badPiece([3, 5], 2), { i: 0, long: false });
  assert.equal(badPiece([4, 4], 2), null);
  // Too many pieces, none longer than a right piece: no piece is named.
  assert.equal(badPiece([2, 2, 2, 2], 2), null);
  // Never a piece of the right length.
  for (const [pieces, parts] of [[[8, 4], 4], [[4, 3, 5], 4], [[3, 9], 4], [[4, 8], 3], [[2, 4, 6], 3], [[1, 3, 4, 4], 3]]) {
    const bad = badPiece(pieces, parts);
    const right = pieces.reduce((a, b) => a + b, 0) / parts;
    if (bad) assert.notEqual(pieces[bad.i], right, `${pieces} for ${parts}`);
  }
});

test('after a cut into 4 and 8 for three pieces, he says the number, the 8 glows as long, and the 4 is never short; then the line of the added mark', async () => {
  const s = story('woodcutter-three');
  const at = s.steps.findIndex((x) => x.press?.stem === 6);
  const calls = [];
  let session = null;
  let glow = null;
  const steps = [...s.steps.slice(0, at), { press: { stem: 4 } }, { until: { event: 'mark', timeout: 10 } }, { wait: 1.5 }, { press: { entity: 'npc:woodcutter' } }, { until: { event: 'snap', timeout: 10 } },
    { until: { event: 'call', with: { key: 'woodcutter.addMark' }, timeout: 60 } }];
  const failures = await runHeadless({ ...s, steps }, {
    onSession: (x) => {
      session = x;
      x.listen((ev) => {
        if (ev.type === 'call') calls.push(ev.key);
        const g = session.state.entities.find((e) => /^piece-glow-/.test(e.look ?? ''));
        if (g && !glow) glow = g.look;
      });
    },
  });
  assert.deepEqual(failures.map((f) => `${f.step}: ${f.message}`), [], calls.join(' '));
  assert.ok(!calls.includes('woodcutter.short'), calls.join(' '));
  const order = ['woodcutter.pieces', 'woodcutter.long', 'woodcutter.addMark'].map((k) => calls.indexOf(k));
  assert.ok(order.every((i) => i >= 0) && order[0] < order[1] && order[1] < order[2], calls.join(' '));
  // The part of the long piece that is too long glows (#145): 8 against the right 4.
  assert.equal(glow, 'piece-glow-4', 'the part that is too long glows');
});

test('a bigger task for the next time is said at the end of the task, not after the first bundle', async () => {
  const s = story('trial-scholar');
  const first = s.steps.findIndex((x) => x.read === true) + 2;
  const put = (n) => ({ repeat: n, steps: [{ press: { item: 'rod' } }, { until: { event: 'put', timeout: 10 } }] });
  const tie = [{ press: { entity: 'npc:teacher' } }, { until: { event: 'tie', timeout: 10 } }];
  const opened = [];
  const failures = await runHeadless({ ...s, steps: [...s.steps.slice(0, first),
    put(10), ...tie,
    { do: { type: 'mentor', key: 'trial-scholar', move: 'raise' } },
    { wait: 3 },
    { expect: [{ event: 'call', with: { key: 'mentor.scholar.raise' }, not: true }] },
    put(10), ...tie,
    { until: { event: 'open', with: { screen: 'say', textKey: 'mentor.scholar.raise' }, timeout: 15 } },
    { read: true },
    { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 15 } },
  ] }, { onSession: (x) => x.listen((e) => { if (e.type === 'open' && (e.screen === 'say' || e.screen === 'dialogue' || e.textKey === 'mentor.scholar.raise')) opened.push(e.textKey ?? e.screen); }) });
  assert.deepEqual(failures.map((f) => `${f.step}: ${f.message}`), [], opened.join(', '));
  assert.equal(opened.filter((k) => k === 'mentor.scholar.raise').length, 1, opened.join(', '));
});

test('the line "như thế này" of the woodcutter frames all of the example and the stem on a phone, at each grade and angle', async () => {
  const W = 390;
  const H = 844;
  const wu = (p) => ({ x: p.x / 2, y: (p.y ?? 0) / 2, z: p.z / 2 });
  // From grade 3 the woodcutter names a part in words, with no example (#102).
  for (const grade of [1, 2]) {
    const s = story('woodcutter-three');
    s.profile = { ...s.profile, grade };
    let session = null;
    let names = null;
    await runHeadless({ ...s, steps: s.steps.slice(0, 2) }, { onSession: (x) => { session = x; x.listen((ev) => { if (ev.type === 'names' && ev.ids.some((id) => id.startsWith('sample:'))) names = ev; }); } });
    for (let i = 0; i < 400 && !names; i++) {
      if (session.screen) session.command({ type: 'next' });
      session.step();
      session.events();
    }
    assert.ok(names, `grade ${grade}: the line names the example`);
    const at = wu(getEntity(session.state, 'hero').position);
    const nearH = viewSize(W, H, 0).h;
    for (const az of [0, 1, 2, 3].map((k) => Math.PI / 4 + (k * Math.PI) / 2)) {
      // The frame of a talk, as the village makes it (src/ui/village.js, workFrame).
      const f = frameWork([at, ...names.points.map(wu)], { az, width: W, height: H, safe: TALK_SAFE, min: nearH * 0.8, max: viewSize(W, H, VIEW.zooms.length - 1).h, lift: 1.5 });
      const cam = viewCamera({ focus: { ...f.focus, y: at.y + 1.5 }, az, width: W, height: H, scale: f.h / nearH });
      for (const e of session.state.entities.filter((x) => /^(sample|stem):woodcutter/.test(x.id))) {
        const len = Number(/-(\d+)$/.exec(e.look)[1]) / 2;
        const p = wu(e.position);
        const b = cam.screenBox({ x0: p.x - 0.3, x1: p.x + len + 0.3, y0: p.y, y1: p.y + 0.6, z0: p.z - 0.3, z1: p.z + 0.3 });
        assert.ok(b.x0 >= 0 && b.x1 <= W && b.y0 >= H * 0.12 && b.y1 <= H * (1 - TALK_SAFE.bottom), `grade ${grade}, ${az.toFixed(2)}: ${e.id} in the frame ${JSON.stringify(b)}`);
      }
    }
  }
});
