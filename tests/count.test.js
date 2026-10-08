// After each wrong try, the child hears and sees the count of the child's own work before any
// other help (#64): the teacher counts the rods on the mat, the healer counts each row, at each
// help level. A wave during the count waits for its end, and no idle move comes soon after a wave.
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
  // The first step of the person ends (the child watches it).
  const busy = () => session.state.entities.some((e) => e.script);
  for (let i = 0; i < 40 / STEP && (i < 2 / STEP || busy()); i++) {
    session.step();
    session.events();
  }
  return session;
}
const run = (session, seconds, until = () => false) => {
  for (let i = 0; i < seconds / STEP && !until(); i++) {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
  }
};
const press = (session, n, wait = 1.5) => {
  for (let k = 0; k < n; k++) {
    session.command({ type: 'hands' });
    session.events();
    run(session, wait);
  }
};
const tapAndPress = (session, target) => {
  session.command({ type: 'tap', target });
  session.events();
  session.command({ type: 'hands' });
  session.events();
};
// The lines of a person after a try: the words of the count (num.*) and the other lines, in order.
function linesOf(session, id, seconds) {
  const out = [];
  const off = session.listen((ev) => { if (ev.type === 'open' && ev.screen === 'callout' && ev.id === id) out.push(ev.textKey); });
  run(session, seconds);
  off();
  return out;
}

test('the teacher: after each wrong tie, he counts the rods on the mat before any other help', async () => {
  const session = await afterTalk('trial-scholar');
  const mat = () => getEntity(session.state, 'zone:mat').zone.items.length;
  // Nine rods, a tie; then two more rods (eleven), and a tie: two wrong bundles, the second at a
  // higher help level.
  for (const [k, presses, n] of [[1, 9, 9], [2, 2, 11]]) {
    press(session, presses);
    run(session, 5, () => mat() >= n);
    assert.equal(mat(), n, `try ${k}: the rods on the mat`);
    tapAndPress(session, { person: 'npc:teacher' });
    const lines = linesOf(session, 'npc:teacher', 30);
    const last = lines.indexOf(`num.${n}`);
    assert.ok(last >= 0, `try ${k}: the count of ${n} rods: ${lines.join(' ')}`);
    const other = lines.findIndex((l) => !/^num\./.test(l) && !/mark/.test(l));
    assert.ok(other === -1 || other > last, `try ${k}: the count comes first: ${lines.join(' ')}`);
    run(session, 20, () => !getEntity(session.state, 'script:trial-scholar'));
  }
});

test('the healer: after a wrong give, she counts each row before any other help', async () => {
  const session = await afterTalk('trial-healer');
  for (let k = 0; k < 2; k++) {
    // Three bunches of one bed, and a give.
    session.command({ type: 'tap', target: { thing: getEntity(session.state, 'zone:bed-ngai').zone.items.find((id) => !getEntity(session.state, id).item.held) } });
    session.events();
    run(session, 8, () => !getEntity(session.state, 'hero').route);
    press(session, 3);
    tapAndPress(session, { person: 'npc:healer' });
    const lines = linesOf(session, 'npc:healer', 30);
    assert.ok(lines.includes('num.1'), `try ${k + 1}: the count: ${lines.join(' ')}`);
    const first = lines.findIndex((l) => /^num\./.test(l));
    const other = lines.findIndex((l) => !/^num\./.test(l) && !/mark/.test(l) && !/^healer\./.test(l));
    assert.ok(other === -1 || other > first, `try ${k + 1}: the count comes first: ${lines.join(' ')}`);
    run(session, 30, () => !getEntity(session.state, 'script:trial-healer') && !getEntity(session.state, 'zone:trial-healer').zone.lay);
  }
});

test('a wave during the count waits for its end, and the offer never answers a wave', async () => {
  const session = await afterTalk('trial-scholar');
  const mat = () => getEntity(session.state, 'zone:mat').zone.items.length;
  run(session, 20, () => !session.carried() && mat() === 0);
  press(session, 9);
  tapAndPress(session, { person: 'npc:teacher' });
  run(session, 1.5);
  const moves = [];
  session.listen((ev) => { if (ev.type === 'mentor') moves.push({ ...ev, t: session.state.tick * STEP }); });
  const lines = [];
  session.listen((ev) => { if (ev.type === 'open' && ev.screen === 'callout' && ev.id === 'npc:teacher') lines.push(ev.textKey); });
  session.command({ type: 'wave' });
  session.events();
  run(session, 40);
  assert.ok(lines.includes('num.9'), `the count went on to nine: ${lines.join(' ')}`);
  const asked = moves.find((m) => m.asked);
  assert.ok(asked && !['wait', 'offer', 'tryFirst'].includes(asked.move), JSON.stringify(moves));
  assert.ok(!moves.some((m) => m.idle && m.move === 'offer' && m.t - asked.t < 20), `no offer in the 20 seconds after the wave: ${JSON.stringify(moves)}`);
});

// The hero stands beside the stem at the point that the child tapped (#64: the walk ended at an
// end of the stem, and the press put the chalk mark there).
test('the woodcutter: a tap at a point of the stem walks the hero beside it, and a press marks that point', async () => {
  const session = await afterTalk('trial-woodcutter');
  const stem = session.state.entities.find((e) => e.item?.kind === 'stem' && !e.hidden);
  const marks = () => getEntity(session.state, 'zone:trial-woodcutter').zone.marks;
  for (const along of [2, 6]) {
    session.command({ type: 'tap', target: { thing: stem.id, along } });
    session.events();
    run(session, 0.5);
    run(session, 10, () => !getEntity(session.state, 'hero').route);
    const hp = getEntity(session.state, 'hero').position;
    assert.ok(Math.abs(hp.x - (stem.position.x + along)) <= 1.5, `along ${along}: the hero at ${hp.x - stem.position.x}`);
    session.command({ type: 'hands' });
    session.events();
    run(session, 1);
    assert.ok(marks().includes(along), `along ${along}: the marks ${marks()}`);
  }
});
