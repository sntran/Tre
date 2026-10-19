// The teacher at grade 4 after the play test (#107): a thing in the box comes back, the help of each
// form is the help of that form, a desk says what it has, and the desks stand near the heap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';

const s0 = load('tests/stories/trial-scholar.json');
const first = s0.steps.findIndex((x) => x.read === true) + 1;

async function atTeacher(grade) {
  let session = null;
  const said = [];
  const failures = await runHeadless({ ...s0, profile: { ...s0.profile, grade }, steps: [...s0.steps.slice(0, first), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 80 } }, { wait: 2 }] }, {
    onSession: (x) => { session = x; x.listen((e) => { if (e.type === 'open' && e.textKey) said.push(e.textKey); }); },
  });
  assert.deepEqual(failures, []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const press = () => { session.command({ type: 'hands', id: session.action()?.id }); run(1.5); };
  const tapAt = (id) => {
    const e = getEntity(session.state, id);
    session.command({ type: 'tap', target: e.person ? { person: id } : e.zone ? session.targetAt(e.zone.x / 2, e.zone.z / 2) : { thing: id } });
    run(4);
  };
  const zone = (id) => getEntity(session.state, `zone:${id}`)?.zone;
  const held = () => getEntity(session.state, 'hero').hands?.holds ?? null;
  // A thing of a kind from a zone into another zone (one press when the place is in reach).
  const move = (from, kind, to) => {
    const id = zone(from).items.find((i) => getEntity(session.state, i)?.item.kind === kind);
    if (!id) return false;
    tapAt(id);
    press();
    if (held() === id) {
      tapAt(`zone:${to}`);
      press();
    }
    return zone(to).items.includes(id);
  };
  return { session, said, run, press, tapAt, zone, held, move, plan: zone('trial-scholar').plan };
}

test('a rod in the box comes back with a tap and a press, and goes onto a desk', async () => {
  const h = await atTeacher(4);
  assert.ok(h.move('rods', 'rod', 'box'), 'a rod into the box');
  const rod = h.zone('box').items[0];
  h.tapAt(rod);
  assert.equal(h.session.action()?.act, 'pick');
  assert.equal(h.session.action()?.target, rod, 'the tap chooses the rod in the box');
  h.press();
  assert.equal(h.held(), rod);
  assert.equal(h.zone('box').items.length, 0);
  h.tapAt('zone:desk-0');
  h.press();
  assert.ok(h.zone('desk-0').items.includes(rod));
});
