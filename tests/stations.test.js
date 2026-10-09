// The healer and the fisher (#70): each put of the healer has its line, an empty row has a word,
// the shared bunches go in one at a time with their lines, and the hint of the fisher fits the
// thing in the hands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity } from '../src/core/world/state.js';
import { load } from './helpers.js';

async function afterTalk(name, grade = null) {
  const story = load(`tests/stories/${name}.json`);
  if (grade !== null) story.profile = { ...(story.profile ?? {}), grade };
  const first = story.steps.findIndex((s) => s.read === true);
  let session = null;
  const failures = await runHeadless({ ...story, steps: story.steps.slice(0, first + 1) }, { onSession: (s) => { session = s; } });
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

test('the healer: each put has its line, also the fourth of a kind', async () => {
  const session = await afterTalk('trial-healer', 2);
  const lines = linesOf(session, 'npc:healer');
  send(session, { type: 'tap', target: { thing: bedThing(session, 'ngai') } });
  run(session, 8, () => !getEntity(session.state, 'hero').route);
  run(session, 1);
  for (let k = 0; k < 5; k++) {
    send(session, { type: 'hands' });
    run(session, 1.5);
  }
  const puts = lines.filter((l) => l.key === 'healer.put.ngai').length;
  const inBasket = getEntity(session.state, 'zone:basket').zone.items.filter((id) => getEntity(session.state, id).item.kind === 'herb-ngai').length;
  assert.ok(inBasket >= 4, `bunches in the basket: ${inBasket}`);
  assert.equal(puts, inBasket, lines.map((l) => l.key).join(' '));
});

test('the healer: after a wrong give, an empty row has a word', async () => {
  const session = await afterTalk('trial-healer');
  const lines = linesOf(session, 'npc:healer');
  send(session, { type: 'tap', target: { thing: bedThing(session, 'ngai') } });
  run(session, 8, () => !getEntity(session.state, 'hero').route);
  run(session, 1);
  for (let k = 0; k < 6 && getEntity(session.state, 'zone:basket').zone.items.length < 2; k++) {
    send(session, { type: 'hands' });
    run(session, 1.5);
  }
  send(session, { type: 'tap', target: { person: 'npc:healer' } });
  send(session, { type: 'hands' });
  run(session, 30);
  const keys = lines.map((l) => l.key);
  assert.ok(keys.includes('mentor.healer.none.tiato') && keys.includes('mentor.healer.none.rauma'), keys.join(' '));
});

test('the healer: in a shared task she puts her bunches one at a time, each with its line', async () => {
  const session = await afterTalk('trial-healer');
  // A wrong give first (two bunches of one kind), so that the healer knows the target.
  send(session, { type: 'tap', target: { thing: bedThing(session, 'ngai') } });
  run(session, 8, () => !getEntity(session.state, 'hero').route);
  run(session, 1);
  const basket = () => getEntity(session.state, 'zone:basket').zone.items.length;
  for (let k = 0; k < 6 && basket() < 2; k++) {
    send(session, { type: 'hands' });
    run(session, 1.5);
  }
  const skills = [];
  session.listen((ev) => { if (ev.type === 'skill') skills.push(ev); });
  send(session, { type: 'tap', target: { person: 'npc:healer' } });
  send(session, { type: 'hands' });
  run(session, 30, () => skills.length > 0);
  assert.equal(skills.length, 1, 'a wrong give');
  run(session, 30, () => !getEntity(session.state, 'script:trial-healer') && !getEntity(session.state, 'zone:trial-healer').zone.lay);
  run(session, 30, () => !getEntity(session.state, 'script:trial-healer'));
  const lines = linesOf(session, 'npc:healer');
  let adds = 0;
  session.listen((ev) => { if (ev.type === 'put' && ev.id === 'npc:healer') adds += 1; });
  send(session, { type: 'mentor', key: 'trial-healer', move: 'share' });
  run(session, 20, () => !getEntity(session.state, 'script:trial-healer'));
  const puts = lines.filter((l) => /^healer\.put\./.test(l.key)).length;
  assert.ok(adds >= 1, `the healer put some bunches: ${lines.map((l) => l.key).join(' ')} basket ${getEntity(session.state, 'zone:basket').zone.items.join(',')}`);
  assert.equal(puts, adds, lines.map((l) => l.key).join(' '));
});

test('the fisher: with a stake in the hands, a wave names the place of the stake, never the heap', async () => {
  const session = await afterTalk('trial-fisher');
  const lines = linesOf(session, 'npc:fisher');
  const stake = getEntity(session.state, 'zone:stakes').zone.items.find((id) => !getEntity(session.state, id).item.held);
  send(session, { type: 'tap', target: { thing: stake } });
  run(session, 10, () => !getEntity(session.state, 'hero').route);
  for (let k = 0; k < 3 && !session.carried(); k++) {
    run(session, 1);
    send(session, { type: 'hands' });
    run(session, 1, () => Boolean(session.carried()));
  }
  assert.ok(session.carried(), `a stake in the hands: ${JSON.stringify(session.action())} ${JSON.stringify(getEntity(session.state, 'hero').position)} ${JSON.stringify(getEntity(session.state, stake).position)}`);
  for (let k = 0; k < 3; k++) {
    send(session, { type: 'wave' });
    run(session, 6);
  }
  const keys = lines.map((l) => l.key);
  assert.ok(!keys.includes('mentor.show.fisher'), keys.join(' '));
  assert.ok(keys.includes('mentor.carry.fisher') || keys.includes('fisher.tide.wait'), keys.join(' '));
});
