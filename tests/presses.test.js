// A child who plays the trials of the story with the big button (#54): after the talk of each
// mentor, presses only; then one tap and presses. The laws of playPresses (tests/restless.js) hold:
// a press never asks for help, never takes back what it just put, and never puts a thing of a task
// on the ground. The work goes on with presses: the basket of the healer fills with the right kinds,
// the row of the fisher goes on to the float, the forge takes the ore, and the smith quenches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, data } from './story-run.js';
import { playPresses, STEP } from './restless.js';
import { getEntity, query } from '../src/core/world/state.js';
import { load } from './helpers.js';
import { taskOf } from '../src/core/world/trials.js';

// The session of a story at the end of the talk of the mentor (its first read).
async function afterTalk(name) {
  const story = load(`tests/stories/${name}.json`);
  const first = story.steps.findIndex((s) => s.read === true);
  let session = null;
  const failures = await runHeadless({ ...story, steps: story.steps.slice(0, first + 1) }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  return session;
}
const zone = (session, id) => getEntity(session.state, `zone:${id}`)?.zone;
const kinds = (session, id) => {
  const out = {};
  for (const i of zone(session, id)?.items ?? []) {
    const k = getEntity(session.state, i)?.item.kind;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
};
const run = (session, seconds, until = () => false) => {
  for (let i = 0; i < seconds / STEP && !until(); i++) {
    session.step();
    session.events();
  }
};
// One tap on an entity (a person, a thing), as the view sends it, and a press at the end of the walk.
function tapAndPress(session, target) {
  session.command({ type: 'tap', target });
  session.events();
  session.command({ type: 'hands' });
  session.events();
  run(session, 15, () => session.screen);
}

test('the healer: presses fill the basket with each kind, as many as she needs, and give it to her', async () => {
  const session = await afterTalk('trial-healer');
  const each = taskOf(data.trials.trials.find((t) => t.id === 'healer'), zone(session, 'trial-healer').level).each;
  const skills = [];
  session.listen((ev) => { if (ev.type === 'skill') skills.push(ev); });
  assert.deepEqual(playPresses(session, { presses: 30, until: () => zone(session, 'trial-healer').done }), []);
  assert.equal(zone(session, 'trial-healer').done, true, 'the healer takes the basket');
  assert.deepEqual(skills.map((e) => [e.solved, e.parts]), [[true, [each, each, each]]], 'presses take the same kind again, then the next kind, and give the basket when it has enough of each');
});

test('the fisher: presses go on with the row toward the float, and never take back a stake', async () => {
  const session = await afterTalk('trial-fisher');
  const line = zone(session, 'line');
  const slots = () => query(session.state, 'item').filter((e) => e.item.zone === 'line' && !e.item.held).map((e) => e.item.slot);
  assert.deepEqual(playPresses(session, { presses: 16, until: () => Math.max(...slots()) === line.length }), []);
  assert.equal(Math.max(...slots()), line.length, `the row reaches the float: ${slots().sort((a, b) => a - b).join(' ')}`);
  // The row is at the float: a press takes no more stakes (no stake stays in the hands with no act).
  assert.deepEqual(playPresses(session, { presses: 3 }), []);
  assert.equal(session.carried(), null, 'no stake in the hands after the row is done');
  run(session, 120, () => zone(session, 'trial-fisher').done);
  assert.equal(zone(session, 'trial-fisher').done, true, 'the tide comes, and the trap keeps the fish');
});

test('the iron horse: presses carry the ore into the hearth, never into the forge of the done trial of the smith', async () => {
  const session = await afterTalk('forge-horse');
  assert.deepEqual(playPresses(session, { presses: 6 }), []);
  assert.ok((zone(session, 'hearth').items.length) >= 2, `ore in the hearth: ${zone(session, 'hearth').items.length}`);
  assert.equal((zone(session, 'forge')?.items ?? []).filter((i) => !getEntity(session.state, i)?.item.fixed).length, 0, 'no ore in the forge of the smith');
});

test('the smith: presses quench the iron; no press asks for help', async () => {
  const session = await afterTalk('trial-smith');
  const quench = [];
  session.listen((ev) => { if (ev.type === 'skill') quench.push(ev); });
  assert.deepEqual(playPresses(session, { presses: 10 }), []);
  assert.ok(quench.length > 0, 'the presses quench');
});

test('the teacher: presses carry rods to the mat; after ten, one tap on the teacher ties the bundle', async () => {
  const session = await afterTalk('trial-scholar');
  const mat = () => zone(session, 'mat').items.length;
  assert.deepEqual(playPresses(session, { presses: 40, until: () => mat() >= 10 && !session.carried() }), []);
  assert.equal(mat(), 10);
  const tied = [];
  session.listen((ev) => { if (ev.type === 'skill') tied.push(ev); });
  tapAndPress(session, { person: 'npc:teacher' });
  assert.ok(tied.some((e) => e.solved), JSON.stringify(tied));
});

test('the staffs: presses walk to the clump and slash; quick taps cut short staffs, which break', async () => {
  const session = await afterTalk('staffs-bamboo');
  const slashes = [];
  session.listen((ev) => { if (ev.type === 'slash' || ev.type === 'skill') slashes.push(ev); });
  assert.deepEqual(playPresses(session, { presses: 20, hold: 0, until: () => slashes.some((e) => e.type === 'skill') }), []);
  const skill = slashes.find((e) => e.type === 'skill');
  assert.ok(skill, 'the presses cut each culm');
  assert.equal(skill.solved, false, `staffs at the lowest ring are too short: ${JSON.stringify(skill.parts)}`);
});

test('the rice for Gióng and the woodcutter: no press undoes a put, asks for help, or drops a thing of the task', async () => {
  for (const name of ['rice-giong', 'trial-woodcutter']) {
    const session = await afterTalk(name);
    assert.deepEqual(playPresses(session, { presses: 16 }), [], name);
  }
});

// A press next to the mentor is no ask (#58): only a tap on the person asks for help, so the log
// and the note of the parents count only the asks of the child.
test('the healer: a tap on her asks for help once; presses next to her never ask', async () => {
  const session = await afterTalk('trial-healer');
  const asks = [];
  session.listen((ev) => { if (ev.type === 'mentor' && ev.asked) asks.push(ev); });
  assert.equal(session.carried(), null, 'empty hands at the start');
  tapAndPress(session, { person: 'npc:healer' });
  assert.equal(asks.length, 1, 'the tap asks');
  for (let n = 0; session.screen && n < 20; n++) {
    session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.events();
  }
  const healer = getEntity(session.state, 'npc:healer').position;
  Object.assign(getEntity(session.state, 'hero').position, { x: healer.x + 1.5, z: healer.z });
  assert.deepEqual(playPresses(session, { presses: 8, wait: 1.5 }), []);
  assert.equal(asks.length, 1, 'no press asks');
});

// The press does the act of the picture that the child saw (#60): Nghé walks up next to the hero
// 0.2 seconds before a press; the picture changes to the ride, but the press does not put the hero
// on Nghé. A press after the new picture settled rides.
test('when Nghé comes into reach 0.2 seconds before a press, the press does not put the hero on Nghé', async () => {
  let session = null;
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'giong.spoke': true, 'nghe.named': true } };
  await runHeadless({ name: 'x', profile, clock: 540, at: ['phu-dong', 20, 20], steps: [{ wait: 1 }] }, { onSession: (s) => { session = s; } });
  const hero = getEntity(session.state, 'hero');
  const nghe = session.state.entities.find((e) => e.follow?.target === 'hero');
  // Nghé is away (out of sight); the button has no act.
  nghe.hidden = true;
  run(session, 2);
  assert.equal(session.action(), null);
  // Nghé comes next to the hero.
  nghe.hidden = false;
  Object.assign(nghe.position, { x: hero.position.x + 1.5, z: hero.position.z });
  run(session, 0.2);
  assert.equal(session.action()?.act, 'ride', 'the picture changes to the ride');
  session.command({ type: 'hands' });
  session.events();
  run(session, 0.5);
  assert.ok(!getEntity(session.state, 'hero').riding, 'the press 0.2 s after the change does not ride');
  run(session, 0.7);
  session.command({ type: 'hands' });
  session.events();
  run(session, 1);
  assert.ok(getEntity(session.state, 'hero').riding, 'a press after the picture settled rides');
});

// In a task, the button is for the task (#60): at the row of the fisher with empty hands, the look
// at the river is never the act of a press, also after a tap on a stake of the row.
test('the fisher: at the row with empty hands, the look at the river is never the act of a press', async () => {
  const session = await afterTalk('trial-fisher');
  assert.deepEqual(playPresses(session, { presses: 6 }), []);
  if (session.carried()) {
    session.command({ type: 'hands' });
    run(session, 2);
  }
  const look = session.targets().find((t) => t.act === 'look');
  assert.ok(look, 'the look at the river is in reach');
  assert.notEqual(session.action()?.act, 'look');
  // A tap on a stake of the row, then the stake goes back: the look does not come.
  const stake = query(session.state, 'item').find((e) => e.item.zone === 'line' && !e.item.fixed);
  tapAndPress(session, { thing: stake.id });
  if (session.carried()) {
    session.command({ type: 'hands' });
    run(session, 2);
  }
  assert.notEqual(session.action()?.act, 'look', 'after a tap on a stake');
  // A tap on the water next to the row is a tap on the place of the task (a check), so the look
  // waits for a tap on the river away from the work.
});

// On Nghé, a press next to a person talks (#60): the button shows the talk, and one press gets the
// hero down and opens the talk. With no person in reach, the press gets the hero down.
test('on Nghé next to a person, one press gets down and talks; with nobody near, it gets down', async () => {
  let session = null;
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'giong.spoke': true } };
  await runHeadless({ name: 'x', profile, clock: 540, at: ['phu-dong', 30, 40], steps: [{ wait: 1 }] }, { onSession: (s) => { session = s; } });
  const hero = () => getEntity(session.state, 'hero');
  const nghe = session.state.entities.find((e) => e.follow?.target === 'hero');
  // The hero gets on Nghé (as the button does it away from people) next to the healer.
  Object.assign(nghe.position, { x: hero().position.x + 1, z: hero().position.z });
  session.command({ type: 'ride', id: 'hero', mount: nghe.id });
  session.events();
  run(session, 1);
  assert.ok(hero().riding, 'the hero rides Nghé');
  const a = session.action();
  assert.equal(a?.act, 'talk', `the button shows the talk: ${JSON.stringify(a)}`);
  session.command({ type: 'hands' });
  session.events();
  run(session, 1);
  assert.ok(!hero().riding, 'the hero gets down');
  assert.equal(session.screen, 'dialogue', 'and the talk opens with the same press');
});
