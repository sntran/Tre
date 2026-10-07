// Raids that a child can win (#55): in an easy raid each enemy stops at each post and the enemies
// come one at a time; after a loss the raid has one enemy less; after two losses a helper at the
// wall gives each enemy one hit; and the first raid of the slingshot has no gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRaid, stepRaid, along } from '../src/core/world/raids.js';
import { load } from './helpers.js';

const raids = load('data/raids.json');
const run = (raid, seconds) => {
  const out = [];
  for (let t = 0; t < seconds; t += 1 / 30) out.push(...stepRaid(raid, 1 / 30, {}));
  return out;
};

test('in an easy raid, each enemy stops at each post for some seconds', () => {
  const raid = createRaid(raids, 'scouts', 0, null, [], { stop: 4 });
  const out = run(raid, 60);
  const pauses = out.filter((ev) => ev.type === 'pause' && ev.id === 'raider:1').map((ev) => ev.post);
  assert.deepEqual(pauses, [20, 15, 10, 5], 'the first scout stops at the fourth post, then the third, the second, and the first');
  // Without stops, no enemy stops at a post.
  const plain = createRaid(raids, 'scouts', 0, null, [], {});
  assert.equal(run(plain, 60).filter((ev) => ev.type === 'pause').length, 0);
});

test('in an easy raid, the next wave comes only when no enemy walks to the gate', () => {
  const raid = createRaid(raids, 'scouts', 0, null, [], { stop: 4 });
  run(raid, 20);
  assert.equal(raid.enemies.length, 1, 'one scout at a time');
  const scout = raid.enemies[0];
  scout.state = 'retreat';
  run(raid, 1);
  assert.equal(raid.enemies.filter((e) => e.state !== 'retreat').length, 1, 'the next scout comes when the first one retreats');
});

test('after a loss, the raid has one enemy less; after two losses, a helper gives each enemy one hit', () => {
  const waves = raids.raids.scouts.waves.length;
  assert.equal(createRaid(raids, 'scouts', 0, null, [], { fewer: 1 }).phases[0].waves.length, waves - 1);
  assert.equal(createRaid(raids, 'river', 0, null, [], { fewer: 5 }).phases[0].waves.length, 1, 'one enemy always stays');
  const raid = createRaid(raids, 'river', 0, null, [], { help: true, helper: 'fisher' });
  assert.equal(raid.helper, 'fisher');
  const out = run(raid, 1);
  assert.ok(out.some((ev) => ev.type === 'helped'));
  assert.equal(raid.enemies[0].hits, 1, 'the serpent needs one rice ball more, not two');
});

test('the first raid of the slingshot has no gate: one new tool in a raid', () => {
  const raid = createRaid(raids, 'scouts', 0, null, ['sling', 'gate'], { without: ['gate'] });
  assert.ok(!raid.tools.includes('gate'));
  assert.equal(raid.bar, null, 'no bar to tap');
  // Without the gate, a scout still comes to the gate and walks the road.
  run(raid, 5);
  assert.ok(along(raid, raid.enemies[0]) > 0);
});

test('at Trâu Sơn, with the soldiers in reach, a press starts the raid, not a look at the field (#55)', async () => {
  const { runHeadless } = await import('./story-run.js');
  const { getEntity } = await import('../src/core/world/state.js');
  let session = null;
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'giong.grown': true, 'raid.tool.sling': true, 'raid.tool.gate': true } };
  await runHeadless({ name: 'x', profile, clock: 420, at: ['trau-son', 80, 30], steps: [{ wait: 1 }] }, { onSession: (s) => { session = s; } });
  const enc = getEntity(session.state, 'encounter:soldier1');
  session.command({ type: 'tap', target: { person: enc.id } });
  session.events();
  for (let i = 0; i < 30 * 15; i++) {
    session.step();
    session.events();
  }
  const h = getEntity(session.state, 'hero').position;
  const d = Math.hypot(h.x - enc.position.x, h.z - enc.position.z);
  assert.ok(d >= 3 && d <= 4.5, `the walk stops ${d.toFixed(1)} half blocks before the soldier`);
  // A walk away and back with the stick ends the tap: the press alone must choose the soldier.
  session.command({ type: 'move', dx: 0, dz: 0.1, strength: 1 });
  session.step();
  session.command({ type: 'move', dx: 0, dz: 0, strength: 0 });
  session.events();
  assert.equal(session.chosen(), null, 'no tap counts now');
  assert.ok(session.targets().some((t) => t.act === 'look'), 'the field is in reach too');
  assert.equal(session.action().act, 'talk');
  assert.equal(session.action().target, enc.id);
});

test('a tap on a soldier of an encounter with Nghé in front of him never pets Nghé (#55)', async () => {
  const { runHeadless } = await import('./story-run.js');
  const { getEntity } = await import('../src/core/world/state.js');
  const { tapTarget, viewCamera, sessionScreen } = await import('../src/world/hit.js');
  let session = null;
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'giong.grown': true, 'raid.tool.sling': true, 'raid.tool.gate': true } };
  await runHeadless({ name: 'x', profile, clock: 420, at: ['trau-son', 80, 30], steps: [{ wait: 1 }] }, { onSession: (s) => { session = s; } });
  const enc = getEntity(session.state, 'encounter:soldier1');
  const nghe = session.state.entities.find((e) => e.follow?.target === 'hero');
  Object.assign(nghe.position, { x: enc.position.x, z: enc.position.z + 1 });
  const at = { x: enc.position.x / 2, y: enc.position.y / 2, z: enc.position.z / 2 };
  const cam = viewCamera({ focus: at, width: 390, height: 844 });
  const t = tapTarget(cam.project(at.x, at.y + 1, at.z), sessionScreen(session, cam));
  assert.deepEqual(t, { person: enc.id });
});

test('in a raid, the animals leave the road and the children of the court go home; after it, the children come back (#55)', async () => {
  const { runHeadless } = await import('./story-run.js');
  const { getEntity, query } = await import('../src/core/world/state.js');
  const { offRoad, KEEP_SIDE } = await import('../src/core/world/raids.js');
  let session = null;
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'giong.spoke': true, 'raid.tool.sling': true } };
  await runHeadless({ name: 'x', profile, clock: 540, at: ['phu-dong', 61, 29], steps: [{ wait: 1 }] }, { onSession: (s) => { session = s; } });
  const w = session.state;
  const children = query(w, 'folkChild');
  assert.ok(children.length >= 3 && children.every((c) => !c.hidden), 'the children play on the court by the road');
  session.command({ type: 'tap', target: { person: 'encounter:scouts' } });
  session.events();
  session.command({ type: 'hands' });
  session.events();
  for (let i = 0; i < 30 * 20 && !getEntity(w, 'raid'); i++) {
    session.step();
    session.events();
    if (session.screen) session.command({ type: 'next' });
  }
  const keep = getEntity(w, 'raid').raid.keep;
  // A buffalo on the road at the start of the raid walks off it.
  const buffalo = w.entities.find((e) => e.look === 'buffalo' && e.steer);
  Object.assign(buffalo.position, { x: (keep.a.x + keep.b.x) / 2, z: (keep.a.z + keep.b.z) / 2 });
  for (let i = 0; i < 30 * 10; i++) {
    session.step();
    session.events();
  }
  assert.ok(children.every((c) => c.hidden), 'the children of the court went home');
  for (const e of query(w, 'steer', 'position').filter((x) => x.steer.medium === 'land' && !x.follow && !x.hidden)) {
    assert.ok(offRoad(keep, e.position).d >= KEEP_SIDE - 0.5, `${e.id} (${e.look}) is ${offRoad(keep, e.position).d.toFixed(1)} half blocks from the road`);
  }
  // The end of the raid: the children come back.
  getEntity(w, 'raid').raid.result = 'won';
  for (let i = 0; i < 30 * 30 && getEntity(w, 'raid'); i++) {
    session.step();
    session.events();
    if (session.screen) session.command({ type: 'next' });
  }
  assert.equal(getEntity(w, 'raid'), null);
  assert.ok(children.every((c) => !c.hidden), 'the children play again');
});
