// What a child hits on a phone (#44): a tap always walks (never a talk or a text in place of a
// walk), the button acts at things with a text or a find, a thing goes to its place and not to the
// ground, and the button never offers a ride in a task.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless, data } from './story-run.js';
import { getEntity } from '../src/core/world/state.js';

const story = (name) => JSON.parse(readFileSync(new URL(`./stories/${name}.json`, import.meta.url), 'utf8'));
const steps = (session, seconds) => {
  for (let k = 0; k < Math.round(seconds * 30); k++) {
    session.step();
    session.events();
  }
};
// A session in Phù Đổng by day, at a cell of the plane (or of the hand-made map: [place, x, y]),
// with flags.
async function phuDong(at = ['phu-dong', 48, 8], flags = {}, clock = 540) {
  let session = null;
  const s = { name: 'taps', profile: { name: 'An', flags: { 'intro.seen': true, 'prologue.started': true, ...flags } }, clock, at, steps: [] };
  const failures = await runHeadless(s, { onSession: (x) => { session = x; } });
  assert.deepEqual(failures, []);
  return session;
}
const heroCell = (session) => {
  const h = getEntity(session.state, 'hero').position;
  return { x: h.x / 2, y: h.z / 2 };
};

test('a tap on a house walks the hero toward it and opens no talk (the đình, the house of Gióng, home, the school, the forge)', async () => {
  const houses = data.world.map('phu-dong').layers.objects.filter((o) => ['dinh', 'giong-house', 'home', 'school', 'forge'].includes(o.id));
  assert.equal(houses.length, 5);
  for (const o of houses) {
    const session = await phuDong();
    const opened = [];
    session.listen((ev) => {
      if (ev.type === 'open') opened.push(ev.screen);
    });
    // The objects and the zones of the world data are in cells of the plane.
    const [px, py] = [o.x + o.w / 2, o.y + o.h / 2];
    const before = heroCell(session);
    const d0 = Math.hypot(before.x - px, before.y - py);
    session.command({ type: 'tap', target: session.targetAt(px, py) });
    steps(session, 12);
    const after = heroCell(session);
    assert.ok(Math.hypot(after.x - px, after.y - py) < d0 - 3, `${o.id}: the hero walks toward it`);
    assert.ok(!opened.includes('dialogue'), `${o.id}: no talk opens`);
  }
});

test('a tap on a roof walks the hero around the house to the free cell nearest to the ground under the finger, the side past the house (#53)', async () => {
  const houses = data.world.map('phu-dong').layers.objects.filter((o) => ['dinh', 'giong-house', 'home', 'school', 'forge'].includes(o.id));
  for (const o of houses) {
    // The hero stands on the south side of the house; the finger is on the roof, and the ground
    // under the finger is on the north side, behind the house.
    const session = await phuDong([o.x + o.w / 2, o.y + o.h + 2]);
    const before = heroCell(session);
    const under = { x: o.x + o.w / 2, y: o.y - 2.5 };
    const roof = { x: o.x + o.w / 2, y: o.y + o.h / 2 };
    assert.ok(!session.tileMap.walkable(Math.floor(roof.x), Math.floor(roof.y)), `${o.id}: the roof is over the house`);
    session.command({ type: 'tap', target: { ground: { x: roof.x, y: roof.y, h: 4, thing: true, object: o.id, under } } });
    steps(session, 20);
    const after = heroCell(session);
    assert.ok(Math.hypot(after.x - before.x, after.y - before.y) > 3, `${o.id}: the hero moves`);
    assert.ok(Math.hypot(after.x - under.x, after.y - under.y) < 3, `${o.id}: the hero goes around the house to the north side: ${JSON.stringify(after)}`);
  }
});

test('a held finger behind a house walks the hero around the house, as a tap does (#53)', async () => {
  const houses = data.world.map('phu-dong').layers.objects.filter((o) => ['dinh', 'giong-house', 'home', 'school', 'forge'].includes(o.id));
  for (const o of houses) {
    const session = await phuDong([o.x + o.w / 2, o.y + o.h + 2]);
    const finger = { x: o.x + o.w / 2, y: o.y - 2.5 };
    // The village sends the move of the held finger in each frame.
    for (let k = 0; k < 30 * 20; k++) {
      const dir = session.holdToward(finger.x, finger.y);
      session.command({ type: 'move', ...(dir ?? { dx: 0, dz: 0, strength: 0 }) });
      session.step();
      session.events();
    }
    const after = heroCell(session);
    assert.ok(Math.hypot(after.x - finger.x, after.y - finger.y) < 3, `${o.id}: the hero goes around the house to the finger: ${JSON.stringify(after)}`);
  }
});

test('from the đình, taps on the star of Văn Miếu alone take the hero to the gate: along the roads, and on the ferry over the Red River (#53)', async () => {
  const dinh = data.world.map('phu-dong').layers.objects.find((o) => o.id === 'dinh');
  const [gx, gy] = data.world.at('road-thanglong', 0.6, 40);
  let session = null;
  const s = { name: 'far', profile: { name: 'An', grade: 2, seed: 7, flags: { 'intro.seen': true, 'prologue.done': true } }, clock: 540, at: [dinh.x + dinh.w / 2, dinh.y + dinh.h + 2], steps: [] };
  await runHeadless(s, { onSession: (x) => { session = x; } });
  const hero = () => getEntity(session.state, 'hero');
  let gate = false;
  session.listen((ev) => {
    if (ev.type === 'open' && ev.screen === 'vanmieu') gate = true;
  });
  let taps = 0;
  let idle = 0;
  for (let k = 0; k < 30 * 60 * 8 && !gate; k++) {
    const screen = session.screen;
    if (screen === 'dialogue' || screen === 'say') session.command({ type: 'next' });
    else if (screen) session.command({ type: 'close' });
    // A child taps the star again when the hero stands still for two seconds.
    idle = hero().route || hero().aboard || screen ? 0 : idle + 1;
    if (idle > 60) {
      session.command({ type: 'tap', target: { ground: { x: gx, y: gy, h: 3, thing: false, object: null, goal: true } } });
      taps += 1;
      idle = 0;
    }
    session.step();
    session.events();
  }
  assert.ok(gate, `the hero comes to the gate of Văn Miếu: ${JSON.stringify(heroCell(session))}, ${taps} taps`);
  assert.ok(taps <= 6, `a few taps on the star: ${taps}`);
});

test('a tap on water or on a field far away walks the hero to a free cell on the way', async () => {
  const zones = data.world.map('phu-dong').layers.triggers.filter((z) => ['river', 'field-home'].includes(z.id));
  for (const z of zones) {
    const session = await phuDong(['phu-dong', 40, 40]);
    const [px, py] = [z.x + z.w / 2, z.y + z.h / 2];
    const before = heroCell(session);
    session.command({ type: 'tap', target: session.targetAt(px, py) });
    steps(session, 10);
    const after = heroCell(session);
    assert.ok(Math.hypot(after.x - before.x, after.y - before.y) > 1, `${z.id}: the hero moves`);
    assert.ok(Math.hypot(after.x - px, after.y - py) < Math.hypot(before.x - px, before.y - py), `${z.id}: toward the tap`);
  }
});

test('next to a thing with a find, the big button looks at it: the ore gives iron', async () => {
  const ore = data.world.map('phu-dong').layers.triggers.find((z) => z.id === 'ore1');
  let profile = null;
  let session = null;
  const s = { name: 'ore', profile: { name: 'An', flags: { 'intro.seen': true, 'prologue.started': true, 'giong.spoke': true } }, clock: 540, at: [ore.x - 1, ore.y + 1], steps: [] };
  await runHeadless(s, { onSession: (x) => { session = x; }, onEnd: (r) => { profile = r.profile; } });
  const a = session.action();
  assert.equal(a?.act, 'look');
  session.command({ type: 'hands' });
  steps(session, 1);
  assert.equal(profile.flags['horse.ore1'], true, 'the ore is found');
  assert.ok(profile.inventory.iron > 0, 'the iron is in the basket');
});

test('a rod taken at the heap goes on the mat at once, also when the hero still faces the heap', async () => {
  const s = story('practice-bo-que');
  // Up to the first pick-up at the heap.
  s.steps = [...s.steps.slice(0, 5), { press: { item: 'rod' } }, { until: { event: 'pick', timeout: 10 } }];
  let session = null;
  await runHeadless(s, { onSession: (x) => { session = x; } });
  steps(session, 0.5);
  assert.ok(session.carried(), 'a rod is in the hands');
  const a = session.action();
  assert.equal(a.act, 'put');
  assert.ok(a.target !== getEntity(session.state, 'hero').hands.holds, 'not on the ground');
  assert.notEqual(a.target, 'zone:teacher-rods', 'not back on the heap');
});

test('a thing of a task left on the ground goes back to its heap after a few seconds', async () => {
  const s = story('practice-bo-que');
  s.steps = [...s.steps.slice(0, 5), { press: { item: 'rod' } }, { until: { event: 'pick', timeout: 10 } }];
  let session = null;
  await runHeadless(s, { onSession: (x) => { session = x; } });
  steps(session, 0.5);
  const id = getEntity(session.state, 'hero').hands.holds;
  session.command({ type: 'drop', id: 'hero' });
  steps(session, 0.2);
  assert.equal(getEntity(session.state, id).item.zone, null, 'on the ground');
  steps(session, 5);
  assert.ok(getEntity(session.state, id).item.zone, 'back on its heap');
});

test('in a task, the big button never offers a ride on Nghé', async () => {
  const s = story('practice-bo-que');
  s.steps = s.steps.slice(0, 6);
  let session = null;
  await runHeadless(s, { onSession: (x) => { session = x; } });
  // Nghé comes next to the hero.
  const hero = getEntity(session.state, 'hero');
  const nghe = session.state.entities.find((e) => e.follow?.target === 'hero');
  if (nghe) Object.assign(nghe.position, { x: hero.position.x + 1, z: hero.position.z });
  for (let k = 0; k < 60; k++) {
    steps(session, 0.1);
    assert.notEqual(session.action()?.act, 'ride');
  }
});

test('the cue of a heap is one rim around the heap, and no ring over each thing of the heap', async () => {
  const s = story('practice-bo-que');
  s.steps = s.steps.slice(0, 5);
  let session = null;
  const cues = [];
  await runHeadless(s, { onSession: (x) => { session = x; x.listen((ev) => ev.type === 'cue' && ev.ids.length && cues.push(ev)); } });
  steps(session, 12);
  const cue = cues.at(-1);
  assert.ok(cue, 'the rods glow when the child waits');
  const heap = getEntity(session.state, 'zone:rods');
  assert.ok(cue.ids.some((id) => heap.zone.items.includes(id)), 'the rods of the heap breathe');
  assert.deepEqual(cue.rings, [], 'no ring over a rod');
  assert.equal(cue.spots.length, 1, 'one rim around the heap');
});

test('the next press never takes back what the child just put: three more presses at the mat leave the rod there', async () => {
  const s = story('practice-bo-que');
  s.steps = [...s.steps.slice(0, 5), { press: { item: 'rod' } }, { until: { event: 'pick', timeout: 10 } }];
  let session = null;
  await runHeadless(s, { onSession: (x) => { session = x; } });
  steps(session, 0.5);
  const mat = () => getEntity(session.state, 'zone:mat').zone.items.length;
  session.command({ type: 'hands' });
  steps(session, 1);
  assert.equal(mat(), 1, 'the rod is on the mat');
  for (let k = 0; k < 3; k++) {
    const before = mat();
    session.command({ type: 'hands' });
    steps(session, 1);
    assert.ok(mat() >= before, `press ${k + 2}: no rod comes back from the mat`);
  }
  // A tap on the rod on the mat, and a press: the rod comes back.
  const rod = getEntity(session.state, 'zone:mat').zone.items.at(-1);
  if (session.carried()) {
    session.command({ type: 'hands' });
    steps(session, 1);
  }
  const n = mat();
  session.command({ type: 'tap', target: { thing: rod } });
  steps(session, 2);
  session.command({ type: 'hands' });
  steps(session, 1);
  assert.equal(mat(), n - 1, 'after a tap on the rod, the press takes it back');
});

test('in a task, Nghé never stands on a place of the work, and a tap on Nghé there is a tap on the place', async () => {
  const { tapTarget, viewCamera, sessionScreen } = await import('../src/world/hit.js');
  const s = story('practice-bo-que');
  s.steps = s.steps.slice(0, 5);
  let session = null;
  await runHeadless(s, { onSession: (x) => { session = x; } });
  const nghe = session.state.entities.find((e) => e.follow?.target === 'hero');
  assert.ok(nghe, 'Nghé follows the hero');
  const mat = getEntity(session.state, 'zone:mat');
  const r = mat.zone.rect;
  // Nghé on the middle of the mat: it steps out.
  Object.assign(nghe.position, { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 });
  const inMat = () => nghe.position.x >= r.x0 && nghe.position.x <= r.x1 && nghe.position.z >= r.z0 && nghe.position.z <= r.z1;
  // A tap on Nghé there, before it moves: the tap goes to the place under Nghé, not a pet.
  const at = { x: nghe.position.x / 2, y: nghe.position.y / 2, z: nghe.position.z / 2 };
  const cam = viewCamera({ focus: at, width: 390, height: 844 });
  const t = tapTarget(cam.project(at.x, at.y + 0.5, at.z), sessionScreen(session, cam));
  assert.ok(!t?.pet, `no pet in a task: ${JSON.stringify(t)}`);
  steps(session, 2);
  assert.ok(!inMat(), 'Nghé stepped off the mat');
});

test('the fisher: a press while the tide is in keeps the stake in the hands, and the fisher says to wait', async () => {
  const s = story('practice-cam-coc');
  // Up to the first stake in the hands.
  s.steps = [...s.steps.slice(0, 7)];
  let session = null;
  await runHeadless(s, { onSession: (x) => { session = x; } });
  const tz = getEntity(session.state, 'zone:trial-fisher');
  assert.ok(tz, 'the task of the fisher goes on');
  assert.ok(session.carried(), 'a stake is in the hands');
  // At the line, and the tide comes in.
  const line = getEntity(session.state, 'zone:line');
  const hero = getEntity(session.state, 'hero');
  Object.assign(hero.position, { x: line.zone.stand.x, z: line.zone.stand.z });
  tz.zone.tide.phase = 'in';
  tz.zone.tide.t = 0;
  const said = [];
  session.listen((ev) => ev.type === 'open' && ev.screen === 'callout' && said.push(ev.textKey));
  assert.equal(session.action()?.act, 'wait');
  session.command({ type: 'hands' });
  steps(session, 0.2);
  assert.ok(session.carried(), 'the stake stays in the hands');
  assert.ok(said.includes('fisher.tide.wait'), 'the fisher says to wait');
});

test('after a put at the mat, a press with the teacher in front takes from the heap: no tie and no call for help without a tap on the teacher', async () => {
  const s = story('practice-bo-que');
  s.steps = [...s.steps.slice(0, 5), { press: { item: 'rod' } }, { until: { event: 'pick', timeout: 10 } }, { press: { screenOf: 'mat' } }, { until: { event: 'put', timeout: 10 } }];
  let session = null;
  await runHeadless(s, { onSession: (x) => { session = x; } });
  const hero = getEntity(session.state, 'hero');
  const r = getEntity(session.state, 'zone:mat').zone.rect;
  const teacher = getEntity(session.state, 'npc:teacher').position;
  // At the left edge of the mat, facing the teacher (the heap behind the hero).
  Object.assign(hero.position, { x: r.x0 + 1.5, z: (r.z0 + r.z1) / 2, facing: Math.atan2(teacher.x - r.x0 - 1.5, teacher.z - (r.z0 + r.z1) / 2) });
  steps(session, 0.1);
  assert.equal(session.action()?.act, 'pick', JSON.stringify(session.action()));
  // A tap on the teacher: now the press ties.
  session.command({ type: 'tap', target: { person: 'npc:teacher' } });
  steps(session, 3);
  assert.equal(session.action()?.act, 'tie');
});

test('a press at once after a tap on a spot in the stream waits for the walk, and the trap goes into the stream', async () => {
  const { tapTarget, sessionCamera, sessionScreen } = await import('../src/world/hit.js');
  let session = null;
  await runHeadless({ name: 'press-walk', practice: 'dat-lo', profile: { name: 'An', grade: 1, lang: 'vi', seed: 3, flags: {} }, steps: [] }, { onSession: (x) => { session = x; } });
  for (let k = 0; k < 20 * 30; k++) {
    if (session.screen === 'dialogue' || session.screen === 'say') session.command({ type: 'next' });
    session.step();
    session.events();
  }
  const pile = getEntity(session.state, 'zone:traps-pile');
  session.command({ type: 'tap', target: { thing: pile.zone.items[0] } });
  steps(session, 4);
  session.command({ type: 'hands' });
  steps(session, 1.5);
  assert.ok(session.carried(), 'a trap is in the hands');
  // The child taps the spot on the screen and presses at once, while the hero walks.
  const spot = getEntity(session.state, 'hamlet:spot:1');
  const cam = sessionCamera(session);
  const t = tapTarget(cam.project(spot.position.x / 2, spot.position.y / 2, spot.position.z / 2), sessionScreen(session, cam));
  session.command({ type: 'tap', target: t });
  session.command({ type: 'hands' });
  steps(session, 5);
  assert.equal(getEntity(session.state, 'zone:traps-stream').zone.items.length, 1, 'the trap is in the stream');
  assert.equal(session.carried(), null);
});

test('a press at once after a tap on the scouts waits for the walk, and the raid starts (#50)', async () => {
  const { tapTarget, sessionCamera, sessionScreen } = await import('../src/world/hit.js');
  const session = await phuDong(['phu-dong', 61, 29], { 'giong.spoke': true });
  const enc = getEntity(session.state, 'encounter:scouts');
  const cam = sessionCamera(session);
  const t = tapTarget(cam.project(enc.position.x / 2, enc.position.y / 2 + 0.8, enc.position.z / 2), sessionScreen(session, cam));
  assert.equal(t.person, 'encounter:scouts', 'the finger is on the scouts');
  session.command({ type: 'tap', target: t });
  steps(session, 0.2);
  session.command({ type: 'hands' });
  steps(session, 8);
  assert.equal(session.screen, 'say', 'the line of the scouts');
  session.command({ type: 'next' });
  steps(session, 1);
  assert.ok(getEntity(session.state, 'raid'), 'the raid of the scouts is on');
});
