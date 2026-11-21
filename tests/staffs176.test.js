// The staffs, one voice at a time (#176): the show of the woodcutter plays one time and ends before
// the knife works; while the button is down only the count of the child plays; the help at the clump
// is the help of the staffs, also with a small event near; a hold away from a culm walks to the
// nearest culm; and after the win no line of the staffs plays.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';

const s0 = load('tests/stories/staffs-bamboo.json');
const vi = load('i18n/vi.json');

async function atClump(grade = 1) {
  const upto = s0.steps.findIndex((x) => x.read === true);
  let session = null;
  const said = [];
  const events = [];
  const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade }, steps: s0.steps.slice(0, upto + 1) }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => {
        events.push(e);
        if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, id: e.id, params: e.params ?? {} });
      });
    },
  });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const run = (sec, until = () => false) => {
    for (let i = 0; i < sec / STEP && !until(); i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const tz = () => getEntity(session.state, 'zone:trial-staffs')?.zone;
  const ready = () => {
    session.command({ type: 'tap', target: { thing: 'culm:staffs:0' } });
    run(40, () => said.some((l) => /mentor\.first\.you/.test(l.key)));
    run(10, () => !session.state.entities.some((e) => e.script));
  };
  // A hold of sec seconds of the world, and a release that says a much longer time of the touch
  // (a slow phone: the world ran slower than the clock).
  const hold = (culm, sec, held) => {
    session.command({ type: 'tap', target: { thing: `culm:staffs:${culm}` } });
    run(8, () => !getEntity(session.state, 'hero').route);
    run(1.2);
    session.command({ type: 'hold', on: true });
    run(sec);
    session.command({ type: 'hold', on: false, held });
    run(0.5);
  };
  return { session, said, events, run, tz, ready, hold };
}

const STAFF_LINES = /^(mentor\.staffs|staffs\.|woodcutter\.staffs|num\.)/;

test('the show plays one time: after "Giờ đến lượt em." no show starts again by itself, and the knife waits for the end of the show', async () => {
  const h = await atClump(1);
  h.session.command({ type: 'tap', target: { thing: 'culm:staffs:0' } });
  // While the show is due or plays, the knife is not on the button.
  let knifeInShow = false;
  h.run(40, () => {
    const showing = h.session.state.entities.some((e) => e.script?.move === 'first') || !h.said.some((l) => /mentor\.first\.you/.test(l.key));
    if (showing && h.session.action()?.act === 'slash' && h.said.some((l) => l.key === 'mentor.staffs.first')) knifeInShow = true;
    return h.said.some((l) => /mentor\.first\.you/.test(l.key));
  });
  assert.ok(h.said.some((l) => l.key === 'mentor.staffs.first'), 'the show');
  assert.ok(!knifeInShow, 'the knife waited for the end of the show');
  const from = h.said.length;
  h.run(30);
  assert.deepEqual(h.said.slice(from).filter((l) => l.key === 'mentor.staffs.first').map((l) => l.key), [], 'no second show');
});

test('while the button is down, only the count of the child plays', async () => {
  const h = await atClump(1);
  h.ready();
  // A wave asks for help, and its count of the sample starts; then the child holds the knife.
  h.session.command({ type: 'wave' });
  h.run(1.5);
  h.session.command({ type: 'tap', target: { thing: 'culm:staffs:0' } });
  h.run(8, () => !getEntity(h.session.state, 'hero').route);
  h.run(1.2);
  const from = h.said.length;
  let rings = 0;
  h.session.listen((e) => { if (e.type === 'ring') rings = e.at; });
  h.session.command({ type: 'hold', on: true });
  h.run(0.45 * 3.2);
  const during = h.said.slice(from).map((l) => l.key);
  h.session.command({ type: 'hold', on: false });
  assert.deepEqual(during, Array.from({ length: rings }, (_, i) => `num.${i + 1}`), 'the count of the rings only');
});

test('a hold away from the culms walks to the nearest culm, never to a person', async () => {
  const h = await atClump(1);
  h.ready();
  const hero = getEntity(h.session.state, 'hero');
  const wc = getEntity(h.session.state, 'npc:woodcutter');
  // The hero next to the woodcutter, away from the clump.
  Object.assign(hero.position, { x: wc.position.x + 1.5, z: wc.position.z });
  h.run(1.2);
  h.session.command({ type: 'tap', target: { person: 'npc:woodcutter' } });
  h.run(1.2);
  const from = h.said.length;
  h.session.command({ type: 'hold', on: true });
  h.run(0.3);
  h.session.command({ type: 'hold', on: false });
  h.run(8, () => !hero.route);
  const culm = h.session.state.entities.filter((e) => e.item?.kind === 'culm' && !e.hidden).sort((a, b) => Math.hypot(a.position.x - hero.position.x, a.position.z - hero.position.z) - Math.hypot(b.position.x - hero.position.x, b.position.z - hero.position.z))[0];
  assert.ok(Math.hypot(culm.position.x - hero.position.x, culm.position.z - hero.position.z) <= 6, 'the hero is at a culm');
  assert.deepEqual(h.said.slice(from).filter((l) => /greet/.test(l.key)).map((l) => l.key), [], 'no greeting');
});

test('with the ducks of a small event near the clump, the hand says a line of the staffs', async () => {
  const h = await atClump(1);
  h.ready();
  const { addEntity } = await import('../src/core/world/state.js');
  const hero = getEntity(h.session.state, 'hero');
  addEntity(h.session.state, { id: 'zone:trial-event-duck', zone: { rule: 'trial', task: 'trial-event-duck', done: false }, position: { x: hero.position.x + 1, y: hero.position.y, z: hero.position.z } });
  const from = h.said.length;
  h.session.command({ type: 'wave' });
  h.run(6);
  const lines = h.said.slice(from).map((l) => l.key);
  assert.ok(lines.length, 'a line');
  assert.ok(lines.every((k) => STAFF_LINES.test(k)), lines.join(', '));
});

test('after the win, no line of the staffs plays', async () => {
  const h = await atClump(1);
  h.ready();
  // A break starts the count of the woodcutter (the piece, the sample, and where to let go).
  h.hold(0, 0.45 * 1.2);
  h.run(1);
  // The task is won in the middle of that count.
  h.tz().done = true;
  const from = h.said.length;
  h.run(15);
  assert.deepEqual(h.said.slice(from).filter((l) => STAFF_LINES.test(l.key)).map((l) => l.key), []);
});

test('the first talk of the staffs up to grade 2 is three short lines', async () => {
  const vi = load('i18n/vi.json');
  const d = load('data/dialogue/village.json').dialogues.find((x) => x.id === 'woodcutter.staffs');
  const keys = ['k1', 'k2', 'k3'].map((k) => d.nodes[k].textKey);
  for (const k of keys) assert.ok(vi[k].split(/\s+/).length <= 14, `${k}: ${vi[k]}`);
  assert.deepEqual(d.nodes.g.if, { grade: { max: 2 } });
});
