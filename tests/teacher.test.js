// The teacher after a count (#69): the child hears what happens to the extra rods or the empty
// places, the demonstration comes at most one time, the teacher puts his rods one at a time and says
// how many, the mat shows a frame of ten for grade 1 and below, and a press of the one move counts
// as an act (no offer of help in the middle of the presses).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity } from '../src/core/world/state.js';
import { load } from './helpers.js';

async function atMat(grade = null) {
  const story = load('tests/stories/trial-scholar.json');
  if (grade !== null) story.profile = { ...(story.profile ?? {}), grade };
  const first = story.steps.findIndex((s) => s.read === true);
  let session = null;
  const failures = await runHeadless({ ...story, steps: story.steps.slice(0, first + 1) }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  // The first step of the teacher ends (he puts a rod on the mat and takes it back).
  run(session, 3);
  run(session, 40, () => !session.state.entities.some((e) => e.script) && !session.carried() && mat(session) === 0);
  return session;
}
const mat = (session) => getEntity(session.state, 'zone:mat').zone.items.length;
function run(session, seconds, until = () => false) {
  for (let i = 0; i < seconds / STEP && !until(); i++) {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
  }
}
// Presses until the mat has n rods, then a tap on the teacher and a press (the tie).
function tie(session, n) {
  for (let k = 0; k < 40 && mat(session) < n; k++) {
    session.command({ type: 'hands' });
    session.events();
    run(session, 1.2);
  }
  assert.equal(mat(session), n, 'the rods on the mat before the tie');
  session.command({ type: 'tap', target: { person: 'npc:teacher' } });
  session.events();
  session.command({ type: 'hands' });
  session.events();
}
function listenLines(session) {
  const lines = [];
  const off = session.listen((ev) => { if (ev.type === 'open' && ev.screen === 'callout' && ev.id === 'npc:teacher') lines.push({ key: ev.textKey, params: ev.params ?? {} }); });
  return { lines, off };
}
const quiet = (session) => !getEntity(session.state, 'script:trial-scholar') && !getEntity(session.state, 'zone:trial-scholar').zone.spring && !session.state.entities.some((e) => e.slide);

test('too many rods: after the count the teacher says how many go back, and they roll back one at a time', async () => {
  const session = await atMat();
  tie(session, 12);
  const { lines, off } = listenLines(session);
  let slid = 0;
  const seen = new Set();
  run(session, 40, () => {
    for (const e of session.state.entities) if (e.slide && !seen.has(e.id)) { seen.add(e.id); slid += 1; }
    return lines.length > 3 && quiet(session);
  });
  off();
  const keys = lines.map((l) => l.key);
  const extra = lines.find((l) => l.key === 'mentor.scholar.extra');
  assert.ok(extra, keys.join(' '));
  assert.deepEqual(extra.params.n, { key: 'num.2' });
  assert.ok(keys.indexOf('mentor.scholar.extra') > keys.indexOf('num.12'), `the line after the count: ${keys.join(' ')}`);
  assert.equal(slid, 2, 'two rods roll back');
  assert.equal(mat(session), 10);
});

test('too few rods: the empty places glow and the teacher says the mat has room, with no count of the target', async () => {
  const session = await atMat();
  tie(session, 7);
  const { lines, off } = listenLines(session);
  let glows = 0;
  run(session, 30, () => {
    glows = Math.max(glows, session.state.entities.filter((e) => e.look === 'place-glow').length);
    return lines.length > 3 && quiet(session);
  });
  off();
  const keys = lines.map((l) => l.key);
  assert.ok(keys.includes('mentor.scholar.room'), keys.join(' '));
  assert.equal(glows, 3, 'the three empty places of the frame glow');
  assert.ok(!keys.includes('num.10'), `no count to ten after a count of seven: ${keys.join(' ')}`);
});

test('the demonstration comes at most one time; the teacher puts his rods one at a time and says how many', async () => {
  const session = await atMat();
  const all = [];
  const { lines, off } = listenLines(session);
  const adds = [];
  session.listen((ev) => { if (ev.type === 'add' && ev.by === 'npc:teacher') adds.push(lines.length); });
  for (const n of [7, 12, 7, 12, 7, 12]) {
    if (getEntity(session.state, 'zone:trial-scholar').zone.done) break;
    // The rods that the teacher put stay; the child fills the mat to n or takes nothing back.
    if (mat(session) > n) break;
    tie(session, n);
    run(session, 60, () => quiet(session) && lines.length > 0);
    all.push(...lines.splice(0));
  }
  off();
  const keys = all.map((l) => l.key);
  assert.ok(keys.filter((k) => k === 'mentor.scholar.demo').length <= 1, `one demonstration at most: ${keys.join(' ')}`);
  if (keys.includes('mentor.scholar.demo')) assert.ok(keys.includes('mentor.scholar.demoDone'), keys.join(' '));
  assert.ok(!keys.includes('mentor.demo.done'), 'the end of the demonstration in words that a child knows');
  for (const l of all.filter((x) => /^mentor\.scholar\.(smaller|share)Put$/.test(x.key))) assert.ok(/^num\.[1-9]$/.test(l.params.n.key), JSON.stringify(l));
});

test('the frame of ten shows for grade 1 and below, and fades for grade 2', async () => {
  for (const [grade, look] of [[1, 'mat-frame'], [2, 'mat']]) {
    const session = await atMat(grade);
    assert.equal(getEntity(session.state, 'mat:scholar').look, look, `grade ${grade}`);
  }
});

test('the presses of the one move are acts: no offer of help in the middle of them', async () => {
  const session = await atMat();
  tie(session, 7);
  run(session, 30, () => quiet(session));
  const moves = [];
  session.listen((ev) => { if (ev.type === 'mentor') moves.push(ev.move); });
  for (let k = 0; k < 6; k++) {
    session.command({ type: 'hands' });
    session.events();
    run(session, 4);
  }
  assert.ok(!moves.includes('offer'), moves.join(' '));
});

test('smaller and share: the teacher puts his rods one at a time, counts them, and says how many he put and how many the child puts', async () => {
  for (const [move, n, m] of [['smaller', null, null], ['share', 5, 5]]) {
    const session = await atMat();
    const { lines, off } = listenLines(session);
    let adds = 0;
    session.listen((ev) => { if (ev.type === 'add' && ev.by === 'npc:teacher') adds += 1; });
    session.command({ type: 'mentor', key: 'trial-scholar', move });
    session.events();
    run(session, 20, () => !getEntity(session.state, 'script:trial-scholar'));
    off();
    const keys = lines.map((l) => l.key);
    const said = lines.find((l) => l.key === `mentor.scholar.${move}Put`);
    assert.ok(said, `${move}: ${keys.join(' ')}`);
    assert.ok(adds >= 1 && mat(session) === adds, `${move}: the rods of the teacher on the mat`);
    assert.deepEqual(said.params.n, { key: `num.${adds}` });
    assert.deepEqual(keys.slice(0, adds), Array.from({ length: adds }, (_, i) => `num.${i + 1}`), `${move}: one number for each rod, before the line`);
    if (n !== null) {
      assert.equal(adds, n);
      assert.deepEqual(said.params.m, { key: `num.${m}` });
    }
  }
});

test('while the teacher shows his own count, a tap on him and a press never tie: his count goes on to its end, and then the child ties', async () => {
  const session = await atMat();
  const { lines } = listenLines(session);
  const shows = () => ['demo', 'smaller', 'share'].includes(getEntity(session.state, 'script:trial-scholar')?.script.move);
  // Wrong tries until the teacher shows a move with his own count.
  for (const n of [7, 12, 7, 12, 7, 12]) {
    if (shows() || getEntity(session.state, 'zone:trial-scholar').zone.done || mat(session) > n) break;
    tie(session, n);
    run(session, 30, () => shows());
  }
  assert.ok(shows(), 'the teacher shows a move with his own count');
  const move = getEntity(session.state, 'script:trial-scholar').script.move;
  run(session, 2);
  const ties = [];
  const off = session.listen((ev) => { if (ev.type === 'tie') ties.push(ev); });
  lines.length = 0;
  // A child taps the teacher and presses, again and again, during his count.
  for (let k = 0; k < 6 && shows(); k++) {
    assert.ok(!session.targets().some((c) => c.act === 'tie'), `no tie while the teacher shows ${move}`);
    session.command({ type: 'tap', target: { person: 'npc:teacher' } });
    session.events();
    session.command({ type: 'hands' });
    session.events();
    run(session, 1);
  }
  run(session, 30, () => !shows());
  off();
  assert.deepEqual(ties, [], 'no tie during his count');
  const keys = lines.map((l) => l.key);
  const end = { demo: 'mentor.scholar.demoDone', smaller: 'mentor.scholar.smallerPut', share: 'mentor.scholar.sharePut' }[move];
  assert.ok(keys.includes(end), `his count goes on to its end: ${keys.join(' ')}`);
  // Then the tie is there again.
  run(session, 1);
  session.command({ type: 'tap', target: { person: 'npc:teacher' } });
  session.events();
  run(session, 3);
  assert.ok(session.targets().some((c) => c.act === 'tie'), 'after his count the child can tie');
});
