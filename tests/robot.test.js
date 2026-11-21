// The short sweep of the robot child (#174, #183): it plays the scenes of the works of this round
// by day and at night, like a child of six (tools/robot/robot.mjs), and no law of progress breaks:
// no key in a text, no talk without a line, no press that does nothing, no lost press, no other
// work on the button, no loop of fails, no line that names the button before its act, no thing of
// a riddle that the view does not draw, no same line again and again, no work without progress,
// and a morning after each night. The long sweep of all the scenes is node tools/robot/sweep.mjs.
//
// A case that breaks a law before the fix of its issue is a todo with the number of that issue
// (#183): the issue turns its case on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playScene, scenes, report, lostPresses, otherWork, failStep, sayNow, unseen } from '../tools/robot/robot.mjs';

const all = new Map(scenes().map((s) => [s.name, s.story]));
// { name, kind, night, grade, steps (the first steps of the story, played before the robot),
//   commands, todo }
const CASES = [];
for (const name of ['staffs-grade1', 'forge-horse', 'trial-healer', 'raid-river-night', 'event-duck', 'ferry']) {
  for (const night of [false, true]) CASES.push({ name, kind: 'star', night });
}
// The first line of the ferry says to press the boat before the boat is on the button (#190).
CASES.find((c) => c.name === 'ferry' && !c.night).todo = '#190: the first line of the ferry';
for (const night of [false, true]) {
  // The share after the raid of the soldiers: the raid stays off the button (#185).
  CASES.push({ name: 'raid-soldiers', kind: 'dealer', night, steps: 26, commands: 80, todo: '#185: the raid on the button at the share' });
  // A child who counts slowly: the count still adds up (#186).
  CASES.push({ name: 'raid-soldiers', kind: 'slow', night, todo: night ? '#186: the slow count' : null });
  CASES.push({ name: 'bridge-mashing', kind: 'presser', night, todo: night ? null : '#191: the loop of the plank' });
  CASES.push({ name: 'forge-horse', kind: 'presser', night, grade: 3 });
  CASES.push({ name: 'puzzle-ferry', kind: 'star', night, todo: '#190: the loop of the riddle, the fisher at night' });
  CASES.push({ name: 'healer-grade4', kind: 'walker', night });
  CASES.push({ name: 'staffs-grade1', kind: 'walker', night, todo: night ? null : '#185, #187: a thing of bà lang at the staffs, the line of the hold' });
}

for (const c of CASES) {
  const what = `${c.name}, the ${c.kind} child${c.grade ? ` of grade ${c.grade}` : ''}, ${c.night ? 'at night' : 'by day'}`;
  test(`the robot child in ${what}: no law breaks in ${c.commands ?? 120} commands`, c.todo ? { todo: c.todo } : {}, async () => {
    assert.ok(all.has(c.name), c.name);
    const story = all.get(c.name);
    const out = await playScene(story, { scene: c.name, kind: c.kind, night: c.night, grade: c.grade ?? null, commands: c.commands ?? 120, steps: c.steps ? story.steps.slice(0, c.steps) : [] });
    assert.deepEqual(out.stats.failed, []);
    assert.equal(out.findings.length, 0, report(out.findings));
  });
}

// The laws of #183, each on its own.
test('lostPress: a press with no act, no wait for a walk, no "not now", and no stop at a commit is lost; a press of another child is not checked', () => {
  const mine = new Map([[1, 'put'], [2, 'pick'], [3, 'slash'], [4, 'cross']]);
  const answers = [
    { id: 1, act: null, done: false, why: 'settle' },
    { id: 2, act: 'pick', done: true },
    { id: 3, act: null, done: false, wait: true },
    { id: 3, act: null, done: false, why: 'walk' },
    { id: 4, act: null, done: false, nope: true },
    { id: 4, act: null, done: false, arrive: 'cross' },
    { id: 9, act: null, done: false },
  ];
  assert.deepEqual(lostPresses(answers, mine), ['put: settle', 'slash: walk']);
});

test('otherWork: at the share, the start of a raid or the work of another task on the button breaks the law; a talk, a ride, and the same work do not', () => {
  assert.equal(otherWork('trial-share', { act: 'raid', task: null }), true);
  assert.equal(otherWork('trial-staffs', { act: 'put', task: 'trial-healer' }), true);
  assert.equal(otherWork('trial-share', { act: 'put', task: 'trial-share' }), false);
  assert.equal(otherWork('trial-event-duck', { act: 'check', task: 'event-duck' }), false);
  assert.equal(otherWork('bridge', { act: 'pick', task: 'bridge-gap' }), false);
  assert.equal(otherWork('trial-share', { act: 'talk', task: 'trial-healer' }), false);
  assert.equal(otherWork('puzzle', { act: 'put', task: 'trial-healer' }), false);
  assert.equal(otherWork(null, { act: 'raid' }), false);
});

test('failLoop: the same fail line three times with presses only; a tap between starts the count again', () => {
  const key = 'mentor.bridge.stuck';
  let f = null;
  f = failStep(f, key, -1, 1);
  f = failStep(f, key, -1, 2);
  f = failStep(f, key, -1, 3);
  assert.equal(f.n, 3);
  // A tap at command 4, and the fail at command 5: one again.
  assert.equal(failStep(f, key, 4, 5).n, 1);
  // Another fail starts again; a line that is no fail changes nothing.
  assert.equal(failStep(f, 'horse.bend.late', -1, 4).n, 1);
  assert.equal(failStep(f, 'share.put', -1, 4), f);
});

test('lineBeforeAct: a line that asks for a hold or a press now; a rule (when, each time) or a walk first does not', () => {
  assert.equal(sayNow('Em giữ nút lớn, vạch đi lên từng đốt. Buông tay là chặt.'), 'hold');
  assert.equal(sayNow('Bấm nút lớn để cắt.'), 'press');
  assert.equal(sayNow('Đến ngã tư thì bấm nút lớn.'), null);
  assert.equal(sayNow('Mỗi lần cháu bấm nút lớn, bẫy đi thêm một cột.'), null);
  assert.equal(sayNow('Cháu đứng cạnh một thứ, rồi bấm nút lớn để đưa nó lên đò.'), null);
  assert.equal(sayNow('Chiếu của Gióng: một bao.'), null);
});

test('unseenThing: a thing of an open riddle near the hero with no figure (hidden, or with no look) breaks the law', () => {
  const at = { x: 0, y: 0, z: 0 };
  const things = [
    { id: 'pz:dog', near: true, open: true, held: false, entity: { position: at, look: 'dog' } },
    { id: 'pz:hen', near: true, open: true, held: false, entity: { position: at, look: 'hen', hidden: true } },
    { id: 'pz:rice', near: true, open: true, held: false, entity: { position: at } },
    { id: 'pz:far', near: false, open: true, held: false, entity: { position: at, hidden: true } },
    { id: 'pz:held', near: true, open: true, held: true, entity: { position: at, hidden: true } },
  ];
  assert.deepEqual(unseen(things), ['pz:hen', 'pz:rice']);
});
