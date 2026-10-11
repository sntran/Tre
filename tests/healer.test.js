// The healer (#79): a wave after a right count keeps each row at the number of the task, the
// picture of the give and the press agree, a press next to the healer gives a full basket, a tap
// next to the basket never takes a bunch out, and the first lines show the tap on a bed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity } from '../src/core/world/state.js';
import { load } from './helpers.js';

async function afterTalk(grade = 1) {
  const story = load('tests/stories/trial-healer.json');
  const first = story.steps.findIndex((s) => s.read === true);
  let session = null;
  const failures = await runHeadless({ ...story, profile: { ...story.profile, grade }, steps: story.steps.slice(0, first + 1) }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  run(session, 3);
  run(session, 40, () => !session.state.entities.some((e) => e.script) && !session.carried());
  return session;
}
function run(session, seconds, until = () => false) {
  for (let i = 0; i < seconds / STEP && !until(); i++) {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
  }
}
const send = (session, cmd) => {
  session.command(cmd);
  session.events();
};
function linesOf(session, id) {
  const lines = [];
  session.listen((ev) => { if (ev.type === 'open' && ev.screen === 'callout' && ev.id === id) lines.push({ key: ev.textKey, params: ev.params ?? {} }); });
  return lines;
}
const bedThing = (session, kind) => getEntity(session.state, `zone:bed-${kind}`).zone.items.find((id) => !getEntity(session.state, id).item.held);
const inBasket = (session, kind) => getEntity(session.state, 'zone:basket').zone.items.filter((id) => getEntity(session.state, id)?.item.kind === `herb-${kind}`).length;
function putFrom(session, kind, n) {
  send(session, { type: 'tap', target: { thing: bedThing(session, kind) } });
  run(session, 8, () => !getEntity(session.state, 'hero').route);
  run(session, 1);
  const before = inBasket(session, kind);
  for (let k = 0; k < n + 4 && inBasket(session, kind) < before + n; k++) {
    send(session, { type: 'hands' });
    run(session, 1.2);
  }
  assert.equal(inBasket(session, kind), before + n, `${n} bunches of ${kind}`);
}
const commits = (session) => {
  const out = [];
  session.listen((ev) => { if (ev.type === 'commit' || ev.type === 'count' || (ev.type === 'call' && /^mentor\.healer\.(mark|row)/.test(ev.key))) out.push(ev); });
  return out;
};

test('at grade 2, a wave after a right count keeps each row at four, and the healer says no extra', async () => {
  const session = await afterTalk(2);
  assert.equal(getEntity(session.state, 'zone:basket').zone.each, 4, 'four of each at grade 2');
  putFrom(session, 'ngai', 7);
  putFrom(session, 'tiato', 4);
  putFrom(session, 'rauma', 4);
  const lines = linesOf(session, 'npc:healer');
  send(session, { type: 'tap', target: { person: 'npc:healer' } });
  send(session, { type: 'hands' });
  run(session, 80, () => lines.some((l) => l.key === 'mentor.healer.now'));
  assert.equal(lines.find((l) => l.key === 'mentor.healer.now')?.params.n.key, 'num.4', lines.map((l) => l.key).join(' '));
  run(session, 3);
  assert.deepEqual(['ngai', 'tiato', 'rauma'].map((k) => inBasket(session, k)), [4, 4, 4]);
  lines.length = 0;
  send(session, { type: 'wave' });
  run(session, 60);
  assert.deepEqual(['ngai', 'tiato', 'rauma'].map((k) => inBasket(session, k)), [4, 4, 4], `the rows stay at four: ${lines.map((l) => l.key).join(' ')}`);
  assert.ok(!lines.some((l) => /^mentor\.healer\.extra/.test(l.key)), `no extra: ${lines.map((l) => l.key).join(' ')}`);
  // The wave after the right count gets the next step (the give), not the same count again.
  assert.ok(!lines.some((l) => l.key === 'mentor.healer.mark'), `no count again: ${lines.map((l) => l.key).join(' ')}`);
  assert.ok(lines.some((l) => l.key === 'mentor.healer.give'), `the give: ${lines.map((l) => l.key).join(' ')}`);
});

test('the picture of the give and the press agree: after a tap on the healer at her beds, the button shows the give and a press gives', async () => {
  const session = await afterTalk(1);
  putFrom(session, 'ngai', 2);
  putFrom(session, 'tiato', 2);
  putFrom(session, 'rauma', 2);
  const hero = getEntity(session.state, 'hero');
  send(session, { type: 'tap', target: { person: 'npc:healer' } });
  run(session, 0.3);
  run(session, 10, () => !hero.route);
  const a = session.action();
  assert.equal(a?.act, 'give', `the button shows the give (${a?.act})`);
  const done = [];
  session.listen((ev) => { if (ev.type === 'given') done.push(ev); });
  send(session, { type: 'hands', id: a.id });
  run(session, 3);
  assert.equal(done.length, 1, 'the press gives the basket');
});

test('the button and the world have one rule for the give: wherever the hero stands, the button shows the give exactly when a press gives', async () => {
  const { giveReady } = await import('../src/core/world/systems/work.js');
  const session = await afterTalk(1);
  putFrom(session, 'ngai', 2);
  const hero = getEntity(session.state, 'hero');
  const basket = getEntity(session.state, 'zone:basket').position;
  for (const [dx, dz] of [[1, -1.5], [6, 0], [10, 4], [-8, -6], [14, -2]]) {
    Object.assign(hero.position, { x: basket.x + dx, z: basket.z + dz });
    delete hero.route;
    send(session, { type: 'tap', target: { person: 'npc:healer' } });
    run(session, 0.3);
    run(session, 10, () => !hero.route);
    const shows = session.action()?.act === 'give';
    assert.ok(!shows || giveReady(session.state, hero.position), `(${dx}, ${dz}): the button shows the give only when the world gives`);
  }
});

test('with bunches of each kind in the basket, the hint is the give, never another bunch', async () => {
  const session = await afterTalk(1);
  putFrom(session, 'ngai', 1);
  putFrom(session, 'tiato', 1);
  putFrom(session, 'rauma', 1);
  const lines = linesOf(session, 'npc:healer');
  send(session, { type: 'mentor', key: 'trial-healer', move: 'show' });
  run(session, 4);
  const keys = lines.map((l) => l.key);
  assert.ok(keys.includes('mentor.healer.give'), keys.join(' '));
  assert.ok(!keys.includes('mentor.show.healer'), keys.join(' '));
});

test('a tap next to the basket never chooses a bunch in it; a tap on the bunch does', async () => {
  const { tapTarget, sessionCamera, sessionScreen } = await import('../src/world/hit.js');
  const session = await afterTalk(1);
  putFrom(session, 'tiato', 1);
  const id = getEntity(session.state, 'zone:basket').zone.items[0];
  const bunch = getEntity(session.state, id);
  const cam = sessionCamera(session);
  // The middle of the bunch, as the hit of a tap measures it (along its facing, a little up).
  const q = bunch.position;
  const mid = { x: q.x + Math.sin(q.facing ?? 0) * bunch.item.size / 2, z: q.z + Math.cos(q.facing ?? 0) * bunch.item.size / 2 };
  const on = cam.project(mid.x / 2, q.y / 2 + 0.4, mid.z / 2);
  const inIt = (t) => getEntity(session.state, 'zone:basket').zone.items.includes(t?.thing);
  const tapOn = tapTarget(on, sessionScreen(session, cam));
  assert.ok(inIt(tapOn), `a tap on the bunch: ${JSON.stringify(tapOn)}`);
  // A finger a little off the bunch, outside the basket.
  const off = cam.project(bunch.position.x / 2 + 0.25, bunch.position.y / 2, bunch.position.z / 2 + 1.6);
  const tapOff = tapTarget(off, sessionScreen(session, cam));
  assert.ok(!inIt(tapOff), `a tap next to the basket: ${JSON.stringify(tapOff)}`);
});

test('the first lines show the tap on a bed, with the beds glowing', () => {
  const vi = load('i18n/vi.json');
  const talk = load('data/dialogue/village.json').dialogues.find((d) => d.id === 'healer.trial');
  const keys = [];
  for (let id = talk.start; id; id = talk.nodes[id].next) keys.push(id);
  const tap = talk.nodes.tap;
  assert.ok(keys.indexOf('tap') > keys.indexOf('n3') && keys.indexOf('tap') < keys.indexOf('n4'), keys.join(' '));
  assert.equal(vi[tap.textKey], 'Chạm vào luống nào, cháu lấy lá luống đó.');
  assert.deepEqual(tap.names, ['zone:bed-ngai', 'zone:bed-tiato', 'zone:bed-rauma']);
});
