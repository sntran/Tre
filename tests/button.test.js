// One act for the picture of the big button and the press (#68): the press does the act of the
// picture, or nothing; the button never shows an act that the world refuses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity } from '../src/core/world/state.js';
import { load } from './helpers.js';

async function afterTalk(name) {
  const story = load(`tests/stories/${name}.json`);
  const first = story.steps.findIndex((s) => s.read === true);
  let session = null;
  const failures = await runHeadless({ ...story, steps: story.steps.slice(0, first + 1) }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  return session;
}
const run = (session, seconds, until = () => false) => {
  for (let i = 0; i < seconds / STEP && !until(); i++) {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
  }
};

test('a full mat takes no rod: the button never shows a put that the world refuses, and a rod in the hands goes back to the heap (#68)', async () => {
  const session = await afterTalk('trial-scholar');
  const mat = getEntity(session.state, 'zone:mat').zone;
  const refused = [];
  const evs = [];
  session.listen((e) => { if (['press', 'put', 'pick', 'pulse', 'open'].includes(e.type)) evs.push(`${e.type}:${e.act ?? e.item ?? e.textKey ?? e.id ?? ''}:${e.done ?? ''}`); });
  // A child presses and presses (Su pressed on after fourteen rods). Each press of a picture does
  // its act: a put puts, and no press is refused.
  for (let k = 0; k < 22; k++) {
    evs.length = 0;
    const a = session.action();
    session.command({ type: 'hands', id: a?.id ?? null });
    session.events();
    run(session, 1.5);
    if (!a) continue;
    const done = evs.some((e) => e.startsWith(`press:${a.act}:true`));
    const put = a.act !== 'put' || evs.some((e) => e.startsWith('put:'));
    if (!done || !put) refused.push(`${a.act} ${a.target} with ${mat.items.length} rods: ${evs.join(' ')}`);
    if (mat.items.length >= 14 && !session.carried()) assert.notEqual(`${session.action()?.act} ${session.action()?.target}`, 'put zone:mat', 'no put on a full mat');
  }
  assert.ok(mat.items.length <= 14, `${mat.items.length} rods`);
  assert.deepEqual(refused, [], 'each press of a picture does its act');
  // A rod in the hands at a full mat: the button shows the way back to its heap, and the press puts
  // it there.
  const heap = getEntity(session.state, 'zone:rods').zone;
  while (mat.items.length < 14 && heap.items.length > 1) {
    const id = heap.items.pop();
    getEntity(session.state, id).item.zone = 'mat';
    mat.items.push(id);
  }
  const rod = getEntity(session.state, heap.items.pop());
  rod.item.zone = null;
  rod.item.held = 'hero';
  rod.hidden = true;
  const hero = getEntity(session.state, 'hero');
  hero.hands = { ...(hero.hands ?? {}), holds: rod.id };
  hero.carry = rod.look;
  run(session, 1);
  const a = session.action();
  assert.equal(`${a?.act} ${a?.target}`, 'put zone:rods', 'the button shows the way back to the heap');
  session.command({ type: 'hands', id: a.id });
  session.events();
  run(session, 4, () => !session.carried());
  assert.equal(session.carried(), null, 'the rod is back on its heap');
});

test('a press in the same step as the act of a press that waited does its own act on a new thing, not the act on the same thing again (#68)', async () => {
  const session = await afterTalk('trial-scholar');
  const hero = getEntity(session.state, 'hero');
  // The hero stands a few steps away from the heap of rods, and the child taps a rod there.
  const heap = getEntity(session.state, 'zone:rods');
  Object.assign(hero.position, { x: heap.position.x + 12, z: heap.position.z });
  session.command({ type: 'tap', target: { thing: heap.zone.items[0] } });
  session.events();
  run(session, 0.2);
  let done = 0;
  const puts = [];
  session.listen((e) => {
    if (e.type === 'press' && e.done) done += 1;
    if (e.type === 'put' && e.id === 'hero') puts.push(e.item);
  });
  // The first press during the walk waits for the end of the walk.
  session.command({ type: 'hands' });
  session.events();
  for (let i = 0; i < 10 / STEP && !done; i++) {
    session.step();
    session.events();
  }
  assert.equal(done, 1, 'the press that waited did its act');
  // The second press comes in the same step: the world did not take the first act yet.
  session.command({ type: 'hands' });
  session.events();
  run(session, 2);
  assert.equal(done, 2, 'the second press did its act');
  assert.equal(new Set(puts).size, 2, `two presses, two rods on the mat: ${puts.join(', ')}`);
});

test('during the walk to a tapped thing the button shows the act at the end of the walk, and a press during the walk does that act there and no other (#68)', async () => {
  const session = await afterTalk('trial-scholar');
  const hero = getEntity(session.state, 'hero');
  const heap = getEntity(session.state, 'zone:rods');
  const mat = getEntity(session.state, 'zone:mat').zone;
  Object.assign(hero.position, { x: heap.position.x + 12, z: heap.position.z });
  session.command({ type: 'tap', target: { thing: heap.zone.items[0] } });
  session.events();
  run(session, 0.3);
  assert.ok(hero.route, 'the hero walks to the rod');
  // The one move of the teacher (#63): a rod from the heap onto the mat.
  const a = session.action();
  assert.equal(`${a?.act} ${a?.target}`, 'put zone:mat', 'during the walk the picture is the act at the end of the walk');
  const rods = mat.items.length;
  const presses = [];
  session.listen((e) => { if (e.type === 'press' || e.type === 'ride') presses.push(e); });
  session.command({ type: 'hands', id: a.id });
  session.events();
  run(session, 10, () => presses.some((e) => e.done));
  const done = presses.filter((e) => e.done);
  assert.equal(done.length, 1, 'the press did one act');
  assert.equal(`${done[0].id} ${done[0].act} ${done[0].target}`, `${a.id} put zone:mat`, 'the act of the picture at the end of the walk');
  assert.ok(!presses.some((e) => e.type === 'ride'), 'no ride');
  assert.equal(mat.items.length, rods + 1, 'one more rod on the mat');
});

test('a press of a picture whose act is gone does nothing: no other act, and the button pulses (#68)', async () => {
  const session = await afterTalk('trial-scholar');
  const hero = getEntity(session.state, 'hero');
  const heap = getEntity(session.state, 'zone:rods');
  const mat = getEntity(session.state, 'zone:mat').zone;
  run(session, 1.5);
  const a = session.action();
  assert.equal(`${a?.act} ${a?.target}`, 'put zone:mat', 'the picture is the one move at the mat');
  // The hero is far from the work before the press (the picture is old, and its act is out of
  // reach).
  Object.assign(hero.position, { x: heap.position.x + 40, z: heap.position.z });
  delete hero.route;
  run(session, 2.5);
  const rods = mat.items.length;
  const evs = [];
  session.listen((e) => { if (['press', 'pulse', 'pick', 'put', 'ride'].includes(e.type)) evs.push(e); });
  session.command({ type: 'hands', id: a.id });
  session.events();
  run(session, 2);
  assert.ok(!evs.some((e) => e.type === 'press' && e.done), `no act: ${evs.map((e) => `${e.type}:${e.act ?? ''}`).join(' ')}`);
  assert.ok(!evs.some((e) => ['pick', 'put', 'ride'].includes(e.type)), 'nothing moves');
  assert.ok(evs.some((e) => e.type === 'pulse'), 'the button pulses');
  assert.equal(mat.items.length, rods);
  assert.equal(session.carried(), null);
});

test('after a press that waited does its act at the end of the walk, the next picture is the change of the child: a press at once does it (#68)', async () => {
  let session = null;
  const failures = await runHeadless({ name: 'button-walked', profile: { name: 'An', grade: 2, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'trial.fisher.done': true } }, clock: 540, at: ['phu-dong', 46, 61], steps: [{ until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } }, { read: true }, { press: { guess: 3 } }, { until: { event: 'guess', timeout: 5 } }, { wait: 2 }] }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  const hero = getEntity(session.state, 'hero');
  const pile = getEntity(session.state, 'zone:bridge-pile');
  Object.assign(hero.position, { x: pile.position.x - 10, z: pile.position.z });
  run(session, 0.5);
  const plank = pile.zone.items[0];
  session.command({ type: 'tap', target: { thing: plank } });
  session.events();
  run(session, 0.3);
  const a = session.action();
  assert.equal(a?.act, 'pick');
  const presses = [];
  session.listen((e) => { if (e.type === 'press') presses.push(e); });
  session.command({ type: 'hands', id: a.id });
  session.events();
  for (let i = 0; i < 15 / STEP && !session.carried(); i++) {
    session.step();
    session.events();
  }
  assert.ok(session.carried(), 'the press that waited picked the plank');
  // The child presses again at once (in less than half a second).
  for (let i = 0; i < 3; i++) {
    session.step();
    session.events();
  }
  const b = session.action();
  assert.ok(b && b.id !== a.id, 'a new picture');
  presses.length = 0;
  session.command({ type: 'hands', id: b.id });
  session.events();
  run(session, 1, () => presses.some((e) => e.done));
  const done = presses.find((e) => e.done);
  assert.ok(done, `the press does the act of the new picture at once: ${b.act} ${b.target}`);
  assert.equal(`${done.act} ${done.target}`, `${b.act} ${b.target}`);
});
