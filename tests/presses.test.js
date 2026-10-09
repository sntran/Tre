// A child who plays the trials of the story with the big button (#54): after the talk of each
// mentor, presses only; then one tap and presses. The laws of playPresses (tests/restless.js) hold:
// a press never asks for help, never takes back what it just put, and never puts a thing of a task
// on the ground. The work goes on with presses, but a press never finds the number that the child
// must find (#63): the healer and the fisher need the child's taps and counts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, data } from './story-run.js';
import { playPresses, blindPresses, STEP } from './restless.js';
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

// The button never knows the answer (#63): presses alone never give the basket with the right
// count, and never make the row of the fisher with the right space. The child's taps and counts
// decide, and a child who counts right finishes with few touches.
test('the healer: presses alone take the same kind again and never give the basket', async () => {
  const session = await afterTalk('trial-healer');
  const log = [];
  assert.deepEqual(playPresses(session, { presses: 16, log }), []);
  assert.equal(zone(session, 'trial-healer').done, false, 'no give with no tap on the healer');
  assert.ok(log.length >= 6, `presses put bunches: ${log.length}`);
  assert.equal(new Set(log).size, 1, `presses take one kind only: ${[...new Set(log)].join(', ')}`);
});

test('the healer: a child who taps each bed and counts the presses gives the right basket', async () => {
  const session = await afterTalk('trial-healer');
  const each = taskOf(data.trials.trials.find((t) => t.id === 'healer'), zone(session, 'trial-healer').level).each;
  const skills = [];
  session.listen((ev) => { if (ev.type === 'skill') skills.push(ev); });
  let touches = 0;
  for (const bed of ['bed-ngai', 'bed-tiato', 'bed-rauma']) {
    const herb = zone(session, bed).items.find((id) => !getEntity(session.state, id).item.held);
    session.command({ type: 'tap', target: { thing: herb } });
    session.events();
    run(session, 8, () => !getEntity(session.state, 'hero').route);
    touches += 1;
    // The child counts: one press for each bunch.
    for (let k = 0; k < each; k++) {
      session.command({ type: 'hands' });
      session.events();
      run(session, 1.5);
      touches += 1;
    }
  }
  tapAndPress(session, { person: 'npc:healer' });
  touches += 2;
  assert.deepEqual(skills.map((e) => e.solved), [true], `the give: ${JSON.stringify(skills.map((e) => e.parts))}`);
  assert.ok(touches <= 3 * (each + 1) + 2, `few touches: ${touches}`);
});

test('the fisher: presses alone put the stakes next to each other, and the row never reaches the float', async () => {
  const session = await afterTalk('trial-fisher');
  const line = zone(session, 'line');
  const slots = () => query(session.state, 'item').filter((e) => e.item.zone === 'line' && !e.item.held).map((e) => e.item.slot).sort((a, b) => a - b);
  assert.deepEqual(playPresses(session, { presses: 24 }), []);
  assert.ok(Math.max(...slots()) < line.length, `the row of presses does not reach the float: ${slots().join(' ')}`);
  run(session, 120, () => zone(session, 'trial-fisher').tide?.phase === 'high');
  run(session, 60, () => zone(session, 'trial-fisher').tide?.phase !== 'high');
  assert.equal(zone(session, 'trial-fisher').done, false, 'the fish swim out at the first tide');
});

test('the fisher: a child who taps each point of the row at the space of the fisher keeps the fish', async () => {
  const session = await afterTalk('trial-fisher');
  const line = zone(session, 'line');
  const slots = () => query(session.state, 'item').filter((e) => e.item.zone === 'line' && !e.item.held).map((e) => e.item.slot);
  for (let at = 2 * line.space; at <= line.length; at += line.space) {
    // A press takes a stake from the bank (again, while a move of the fisher keeps the press
    // busy), a tap chooses the point, and a press puts it there.
    for (let k = 0; k < 4 && !session.carried(); k++) {
      session.command({ type: 'hands' });
      session.events();
      run(session, 8, () => Boolean(session.carried()));
    }
    session.command({ type: 'tap', target: { ground: { x: (line.x + at) / 2, y: line.z / 2 } } });
    session.events();
    session.command({ type: 'hands' });
    session.events();
    run(session, 8, () => !session.carried());
  }
  assert.equal(Math.max(...slots()), line.length, `the row reaches the float: ${slots().sort((a, b) => a - b).join(' ')}`);
  run(session, 160, () => zone(session, 'trial-fisher').done);
  assert.equal(zone(session, 'trial-fisher').done, true, 'the tide comes, and the trap keeps the fish');
});

// The same presses at a different number make the same puts (tests/restless.js, blindPresses).
test('the button is blind: the same presses make the same puts when the number of the task changes', async () => {
  // [story, trial, number, two values]. The fisher puts the first two stakes of the row, at 0 and
  // at the space: with a space of 8 or 9, his second stake is out of the reach of the presses.
  const cases = [['trial-healer', 'healer', 'each', [2, 3]], ['trial-fisher', 'fisher', 'space', [8, 9]], ['trial-woodcutter', 'woodcutter', 'parts', [2, 4]], ['rice-giong', 'rice', 'heads', [2, 3]], ['forge-horse', 'horse', 'ore', [6, 5]]];
  for (const [story, id, key, values] of cases) {
    const def = data.trials.trials.find((t) => t.id === id);
    const set = (value) => () => {
      const old = def.levels.map((l) => l[key]);
      for (const l of def.levels) l[key] = value;
      return () => def.levels.forEach((l, i) => { l[key] = old[i]; });
    };
    assert.deepEqual(await blindPresses(() => afterTalk(story), values.map(set), { presses: story === 'rice-giong' ? 16 : 8 }), [], story);
  }
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
  await runHeadless({ name: 'x', profile, clock: 540, at: ['phu-dong', 35, 42], steps: [{ wait: 1 }] }, { onSession: (s) => { session = s; } });
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

// The ride is easy to find (#60): after a tap on Nghé next to the hero, the button shows the ride,
// also when a person is in reach.
test('after a tap on Nghé next to the hero, the button shows the ride, also with a person in reach', async () => {
  let session = null;
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'giong.spoke': true } };
  await runHeadless({ name: 'x', profile, clock: 540, at: ['phu-dong', 35, 42], steps: [{ wait: 1 }] }, { onSession: (s) => { session = s; } });
  const hero = () => getEntity(session.state, 'hero');
  const nghe = session.state.entities.find((e) => e.follow?.target === 'hero');
  Object.assign(nghe.position, { x: hero().position.x + 1, z: hero().position.z });
  run(session, 0.5);
  assert.equal(session.action()?.act, 'talk', 'the healer is in reach: the button talks');
  session.command({ type: 'pet', id: nghe.id });
  session.events();
  run(session, 0.3);
  assert.equal(session.action()?.act, 'ride', 'after the tap on Nghé, the button rides');
  session.command({ type: 'hands' });
  session.events();
  run(session, 1);
  assert.ok(hero().riding, 'the press rides');
});

// The first step leaves no thing when a new move comes (#61): the teacher puts one rod on the mat
// and takes it back a moment later. A wave in that time ends the step; the rod goes back to the
// heap, so that the ten rods of the child are not eleven.
test('the teacher: a wave during the first step leaves the mat empty', async () => {
  const session = await afterTalk('trial-scholar');
  const mat = () => zone(session, 'mat').items.length;
  let put = false;
  for (let i = 0; i < 30 * 6 && !put; i++) {
    session.step();
    session.events();
    put = mat() > 0;
  }
  assert.ok(put, 'the teacher puts a rod on the mat');
  session.command({ type: 'wave' });
  session.events();
  run(session, 2);
  assert.equal(mat(), 0, 'the rod of the example went back to the heap');
});

// A wrong bundle stays on the mat, and the teacher counts it aloud (#61): after a tie of 11 rods,
// the teacher says the numbers from one to eleven with a point at each rod, then the rod over ten
// rolls back to the heap, and 10 rods stay on the mat.
test('the teacher: after a tie of 11 rods, the teacher counts to eleven and only the extra rod goes back', async () => {
  const session = await afterTalk('trial-scholar');
  const mat = () => zone(session, 'mat').items.length;
  assert.deepEqual(playPresses(session, { presses: 60, until: () => mat() >= 10 && !session.carried() }), []);
  // One rod more on the mat (as the rod of an example that stayed, before #61, item 7).
  const heap = zone(session, 'rods');
  const id = heap.items.pop();
  zone(session, 'mat').items.push(id);
  getEntity(session.state, id).item.zone = 'mat';
  assert.equal(mat(), 11);
  const counts = [];
  session.listen((ev) => {
    if (ev.type === 'open' && ev.screen === 'callout' && ev.id === 'npc:teacher' && String(ev.textKey).startsWith('num.')) counts.push(Number(ev.textKey.slice(4)));
  });
  let snapped = false;
  session.listen((ev) => { if (ev.type === 'snap') snapped = true; });
  session.command({ type: 'tap', target: { person: 'npc:teacher' } });
  session.events();
  session.command({ type: 'hands' });
  session.events();
  run(session, 15, () => snapped);
  assert.ok(snapped, 'the band snaps');
  run(session, 2);
  assert.equal(mat(), 11, 'the rods stay on the mat after the snap');
  run(session, 20, () => counts.length >= 11 && mat() === 10);
  run(session, 2);
  assert.deepEqual(counts.slice(0, 11), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], `the teacher counts aloud: ${counts.join(' ')}`);
  assert.equal(mat(), 10, 'the rod over ten went back to the heap');
});

// One press, one rod (#61): with the heap and the mat in reach, a press takes one rod from the heap
// and puts it on the mat in one move. After the first step of the teacher, 10 presses and one tie
// make one bundle.
test('the teacher: 10 presses put 10 rods on the mat, and one tie makes a bundle', async () => {
  const session = await afterTalk('trial-scholar');
  const mat = () => zone(session, 'mat');
  run(session, 8);
  const hero = getEntity(session.state, 'hero').position;
  const r = mat().rect;
  Object.assign(hero, { x: (r.x0 + r.x1) / 2, z: r.z0 - 2 });
  for (let k = 0; k < 10; k++) {
    session.command({ type: 'hands' });
    session.events();
    run(session, 1.2);
  }
  assert.equal(mat().items.length, 10, `10 presses, 10 rods: ${mat().items.length}`);
  assert.equal(session.carried(), null, 'no rod stays in the hands');
  tapAndPress(session, { person: 'npc:teacher' });
  assert.equal(mat().tied, 1, 'one bundle');
});

// The first step of the healer and the presses of the child at the same time (#61). The bunch of
// the example is the healer's until she takes it back: a tap on it and a press never take it. And
// a bunch that the child put first stays in the basket: the step never puts it again and never
// takes it back.
test('the healer: the child never takes the bunch of the example, and the example never takes a bunch of the child', async () => {
  const one = await afterTalk('trial-healer');
  const basket = (q) => zone(q, 'basket').items;
  for (let i = 0; i < 30 * 6 && !basket(one).length; i++) { one.step(); one.events(); }
  const shown = basket(one)[0];
  assert.ok(shown, 'the healer puts a bunch in the basket');
  const b = getEntity(one.state, 'zone:basket').position;
  Object.assign(getEntity(one.state, 'hero').position, { x: b.x, z: b.z + 2 });
  one.command({ type: 'tap', target: { thing: shown } });
  one.events();
  run(one, 0.3);
  one.command({ type: 'hands' });
  one.events();
  assert.equal(one.carried(), null, 'the press does not take the bunch of the example');
  run(one, 4);
  assert.ok(!basket(one).includes(shown), 'the healer took her bunch back');
  assert.ok(zone(one, getEntity(one.state, shown).item.zone).rule === 'heap', 'her bunch is on its bed');

  const two = await afterTalk('trial-healer');
  const withPut = () => two.state.entities.find((e) => e.script?.steps.some((st) => st.put));
  for (let i = 0; i < 30 * 3 && !withPut(); i++) { two.step(); two.events(); }
  const script = withPut();
  const id = script.script.steps.find((st) => st.put).put.item;
  // The child puts that bunch in the basket before the healer does.
  const thing = getEntity(two.state, id);
  const bed = zone(two, thing.item.zone);
  bed.items.splice(bed.items.indexOf(id), 1);
  basket(two).push(id);
  thing.item.zone = 'basket';
  run(two, 8);
  assert.deepEqual(basket(two), [id], 'the bunch of the child stays in the basket');
});

// A basket where the child sees the count (#61): after a wrong give, the healer lays each kind in a
// row in front of the basket and counts each row aloud from one; then only the extra bunch goes
// back to its bed, and the rest go back into the basket.
test('the healer: after a wrong give, each kind lies in a row and she counts each row; then only the extra bunch goes back', async () => {
  const counts = [];
  let session = null;
  const story = load('tests/stories/trial-healer.json');
  const upToNope = story.steps.slice(0, story.steps.findIndex((s) => s.until?.event === 'nope') + 1);
  const failures = await runHeadless({ ...story, steps: [...upToNope, { do: { type: 'mentor', key: 'trial-healer', move: 'mark' } }] }, { onSession: (s) => {
    session = s;
    s.listen((ev) => { if (ev.type === 'call' && /^num\./.test(ev.key)) counts.push(Number(ev.key.slice(4))); });
  } });
  assert.deepEqual(failures, []);
  const basket = getEntity(session.state, 'zone:basket');
  const rows = basket.zone.items.map((id) => getEntity(session.state, id));
  assert.equal(rows.length, 7);
  assert.ok(rows.every((h) => h.item.set && h.position.z > basket.zone.rect.z1), 'the bunches lie in rows in front of the basket, and a tap does not take them');
  run(session, 12);
  assert.deepEqual(counts, [1, 2, 3, 1, 2, 1, 2], 'one count for each row');
  const after = kinds(session, 'basket');
  assert.deepEqual(after, { 'herb-ngai': 2, 'herb-tiato': 2, 'herb-rauma': 2 }, 'only the extra bunch went back');
  assert.ok(basket.zone.items.every((id) => !getEntity(session.state, id).item.set), 'the bunches are in the basket again');
});

// The count of a wrong bundle in view (#61): a hero who stands on the mat at the snap steps off to
// the place of the mat, so that the rods show while the teacher counts them.
test('the teacher: at a wrong tie, a hero who stands on the mat steps off it', async () => {
  const session = await afterTalk('trial-scholar');
  const mat = () => zone(session, 'mat');
  assert.deepEqual(playPresses(session, { presses: 40, until: () => mat().items.length >= 9 && !session.carried() }), []);
  assert.equal(mat().items.length, 9);
  const r = mat().rect;
  const hero = getEntity(session.state, 'hero').position;
  Object.assign(hero, { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 });
  let snapped = false;
  session.listen((ev) => { if (ev.type === 'snap') snapped = true; });
  tapAndPress(session, { person: 'npc:teacher' });
  run(session, 4, () => snapped);
  assert.ok(snapped, 'the band snaps');
  run(session, 4);
  const inside = hero.x > r.x0 + 0.8 && hero.x < r.x1 - 0.8 && hero.z > r.z0 + 0.8 && hero.z < r.z1 - 0.8;
  assert.ok(!inside, `the hero is off the mat: ${hero.x.toFixed(1)}, ${hero.z.toFixed(1)}`);
});
