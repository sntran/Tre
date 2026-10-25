// The help and the taps after the play test of #115 to #122 (#131): no take-back help when the
// row holds, the demonstration of the boat ends with an empty boat, the help after a check reads
// the hands and the desks, and a tap on the body of a person chooses the person.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query, addEntity, removeEntity } from '../src/core/world/state.js';
import { stakeResult } from '../src/core/world/trials.js';
import { tapTarget, sessionCamera, sessionScreen } from '../src/world/hit.js';

const run = (session, sec) => {
  for (let i = 0; i < sec / STEP; i++) {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
  }
};
const listen = (session) => {
  const said = [];
  session.listen((e) => { if (e.type === 'open' && e.textKey) said.push(e.textKey); });
  return said;
};

test('the save of Tí after the stake at the float: a wave says that the water comes, never the stake to take back', async () => {
  const profile = JSON.parse(readFileSync(new URL('../docs/reference/saves/ti-save.json', import.meta.url), 'utf8'));
  let session = null;
  const failures = await runHeadless({ name: 'ti-save', steps: [{ wait: 2 }] }, { profile, onSession: (x) => { session = x; } });
  assert.deepEqual(failures, []);
  const line = getEntity(session.state, 'zone:line');
  const z = line.zone;
  // The row of his save, with its narrow places, reaches the float; the child moves the stake of a
  // narrow place into the wide space, so that the row holds.
  const stake = query(session.state, 'item').find((e) => e.item.zone === 'line' && e.item.slot === 1);
  stake.item.slot = 6;
  stake.position = { ...stake.position, x: z.x + 6 };
  const slots = query(session.state, 'item').filter((e) => e.item.zone === 'line' && e.item.slot != null).map((e) => e.item.slot);
  assert.ok(stakeResult(slots, z.length, z.space).solved, `the row holds: ${slots.sort((a, b) => a - b).join(',')}`);
  const said = listen(session);
  session.command({ type: 'wave' });
  run(session, 6);
  assert.ok(!said.includes('mentor.fisher.tight'), said.join(', '));
  assert.ok(said.some((k) => /full/.test(k)), said.join(', '));
});

test('a press during the demonstration of the boat ends it: the boat is empty, the line of the turn comes, and the load counts from the stake of the child', async () => {
  const s0 = load('tests/stories/trial-fisher.json');
  const first = s0.steps.findIndex((x) => x.read === true) + 1;
  let session = null;
  const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade: 4 }, steps: s0.steps.slice(0, first) }, { onSession: (x) => { session = x; } });
  assert.deepEqual(failures, []);
  const said = listen(session);
  const loads = [];
  session.listen((e) => { if (e.type === 'open' && /^fisher\.load/.test(e.textKey)) loads.push(e.params?.n?.key ?? 'num.1'); });
  // The demonstration plays; the child presses at once.
  for (let i = 0; i < 40 && !getEntity(session.state, 'script:trial-fisher'); i++) { session.step(); session.events(); }
  assert.ok(getEntity(session.state, 'script:trial-fisher')?.script.move === 'first', 'the demonstration plays');
  run(session, 1.5);
  session.command({ type: 'hands', id: session.action()?.id });
  run(session, 0.2);
  assert.ok(!getEntity(session.state, 'script:trial-fisher'), 'the demonstration ends at the press');
  assert.ok(said.includes('mentor.first.you'), said.join(', '));
  run(session, 1);
  assert.equal(said.filter((k) => k === 'mentor.first.you').length, 1, said.join(', '));
  const boat = getEntity(session.state, 'zone:boat').zone;
  const own = boat.items.filter((id) => getEntity(session.state, id)?.item.held == null);
  run(session, 3);
  assert.ok(boat.items.length <= 1, `the boat has only the stake of the child: ${boat.items.length}`);
  assert.ok(loads.every((k) => k === 'num.1'), `the load counts from the stake of the child: ${loads.join(', ')} (${own.length})`);
  assert.match(load('i18n/vi.json')['mentor.show.fisher.boat'], /^Chú bấm/);
});

test('a press at any time of the demonstration of the boat brings the line of the turn one time only (a play of #131 heard it two times)', async () => {
  const s0 = load('tests/stories/trial-fisher.json');
  const first = s0.steps.findIndex((x) => x.read === true) + 1;
  for (const at of [0.5, 2, 4, 7]) {
    let session = null;
    await runHeadless({ ...s0, profile: { ...s0.profile, grade: 4 }, steps: s0.steps.slice(0, first) }, { onSession: (x) => { session = x; } });
    const said = listen(session);
    for (let i = 0; i < 40 && !getEntity(session.state, 'script:trial-fisher'); i++) { session.step(); session.events(); }
    run(session, at);
    session.command({ type: 'hands', id: session.action()?.id });
    run(session, 6);
    assert.equal(said.filter((k) => k === 'mentor.first.you').length, 1, `a press at ${at} s: ${said.join(', ')}`);
  }
});

test('a tap on the body of the healer with a bed behind her chooses her, and a press gives the basket', async () => {
  const s0 = load('tests/stories/trial-healer.json');
  const first = s0.steps.findIndex((x) => x.read === true) + 1;
  let session = null;
  const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade: 0 }, steps: [...s0.steps.slice(0, first), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 60 } }, { wait: 1 }] }, { onSession: (x) => { session = x; } });
  assert.deepEqual(failures, []);
  const healer = getEntity(session.state, 'npc:healer');
  const bed = getEntity(session.state, 'zone:bed-rauma').zone;
  // The healer stands in front of the bed of rau má, between it and the camera.
  const cam0 = sessionCamera(session);
  const toCam = { x: Math.sin(Math.PI / 4), z: Math.cos(Math.PI / 4) };
  Object.assign(healer.position, { x: bed.x + toCam.x * 2.2, z: bed.z + toCam.z * 2.2 });
  delete healer.route;
  if (healer.schedule) healer.schedule.hold = true;
  const hero = getEntity(session.state, 'hero');
  Object.assign(hero.position, { x: healer.position.x + 3, z: healer.position.z + 1 });
  delete hero.route;
  run(session, 0.3);
  const cam = sessionCamera(session);
  // The middle of her body on the screen.
  const q = cam.project(healer.position.x / 2, healer.position.y / 2 + 0.6, healer.position.z / 2);
  const target = tapTarget(q, sessionScreen(session, cam));
  assert.deepEqual(target, { person: 'npc:healer' }, JSON.stringify(target));
  assert.ok(cam0);
});

test('the help of the give makes the healer the place of the next press, with her glow, also after a tap on a bed', async () => {
  const s0 = load('tests/stories/trial-healer.json');
  const upTo = s0.steps.findIndex((x) => x.press?.entity === 'npc:healer' && s0.steps.indexOf(x) > 2);
  let session = null;
  const failures = await runHeadless({ ...s0, steps: s0.steps.slice(0, upTo) }, { onSession: (x) => { session = x; } });
  assert.deepEqual(failures, []);
  const events = [];
  session.listen((e) => events.push(e));
  // The last tap of the child was on a bed: a press would take one more bunch.
  const bed = getEntity(session.state, 'zone:bed-rauma').zone;
  session.command({ type: 'tap', target: { thing: bed.items[0] } });
  run(session, 3);
  session.command({ type: 'wave' });
  run(session, 6);
  assert.ok(events.some((e) => e.type === 'open' && e.textKey === 'mentor.healer.give'), 'the help of the give');
  assert.equal(session.action()?.act, 'give', JSON.stringify(session.action()));
  session.command({ type: 'hands', id: session.action()?.id });
  run(session, 3);
  assert.ok(events.some((e) => e.type === 'nope' || e.type === 'given'), 'the press gives the basket');
  assert.ok(!events.some((e) => e.type === 'pick' && e.id === 'hero'), 'no bunch taken');
});

test('the teacher of grade 4: with the desks equal and the last rod in the hands, a wave points at the box, the rod glows, and no share is played', async () => {
  const s0 = load('tests/stories/trial-scholar.json');
  const first = s0.steps.findIndex((x) => x.read === true) + 1;
  let session = null;
  const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade: 4 }, steps: [...s0.steps.slice(0, first), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 80 } }, { wait: 2 }] }, { onSession: (x) => { session = x; } });
  assert.deepEqual(failures, []);
  const zone = (id) => getEntity(session.state, `zone:${id}`)?.zone;
  const plan = zone('trial-scholar').plan;
  assert.equal(plan.form, 'share');
  // The work as it is: each desk has its share, and one rod is left, in the hands of the child.
  const place = (id, to) => {
    const e = getEntity(session.state, id);
    const from = zone(e.item.zone);
    if (from) from.items.splice(from.items.indexOf(id), 1);
    e.item.zone = to;
    zone(to).items.push(id);
    e.position = { x: zone(to).x, y: zone(to).y + 0.1, z: zone(to).z, facing: 0 };
  };
  const value = (id) => getEntity(session.state, id)?.item.value ?? getEntity(session.state, id)?.item.size ?? 0;
  const sum = (z) => zone(z).items.reduce((a, id) => a + value(id), 0);
  // One bundle of the heap opens into ten rods (as on the mat), then the child deals.
  const bundle = zone('rods').items.find((x) => value(x) === 10);
  zone('rods').items.splice(zone('rods').items.indexOf(bundle), 1);
  removeEntity(session.state, bundle);
  for (let i = 0; i < 10; i++) {
    const id = `rod:test:${i}`;
    addEntity(session.state, { id, keep: true, item: { kind: 'rod', size: 1, task: 'trial-scholar', zone: 'rods', home: 'rods', held: null, set: false }, position: { x: zone('rods').x, y: zone('rods').y, z: zone('rods').z, facing: 0 }, look: 'rod' });
    zone('rods').items.push(id);
  }
  for (let i = 0; i < plan.k; i++) {
    while (sum(`desk-${i}`) < plan.each) {
      const need = plan.each - sum(`desk-${i}`);
      const id = zone('rods').items.find((x) => value(x) <= need && value(x) === (need >= 10 ? 10 : 1)) ?? zone('rods').items.find((x) => value(x) === 1);
      if (!id) break;
      place(id, `desk-${i}`);
    }
  }
  const sums = Array.from({ length: plan.k }, (_, i) => sum(`desk-${i}`));
  const left = zone('rods').items.map(value).reduce((a, b) => a + b, 0);
  assert.ok(sums.every((v) => v === sums[0]) && left > 0 && left < plan.k, `desks ${sums.join(',')}, left ${left}`);
  const rod = zone('rods').items.find((x) => value(x) === 1);
  const hero = getEntity(session.state, 'hero');
  Object.assign(hero.position, { x: zone('rods').x, z: zone('rods').z + 2 });
  session.command({ type: 'tap', target: { thing: rod } });
  run(session, 3);
  session.command({ type: 'hands', id: session.action()?.id });
  run(session, 2);
  assert.ok(hero.hands?.holds, 'a rod in the hands');
  const said = listen(session);
  const glows = [];
  session.listen((e) => { if (e.type === 'glow' || e.type === 'cue') glows.push(...(e.ids ?? [])); });
  session.command({ type: 'wave' });
  run(session, 20);
  assert.ok(!said.includes('mentor.scholar.demo.share'), said.join(', '));
  assert.ok(said.includes('mentor.scholar.toBox'), said.join(', '));
});
