// The place of a press at the fisher and the woodcutter (#109): presses at the pile with no walk put
// no stake into a space narrower than half of the gap, the talk names both sides of the rule, after
// an escape a take-back leads to the hole, the see-through stake and chalk say what they are, and
// the see-through chalk follows the hero along the stem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query, command as worldCommand } from '../src/core/world/state.js';
import { tightSlot } from '../src/core/world/trials.js';

const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
const talk = (who, key) => [
  { press: { entity: `npc:${who}` } },
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
  { read: true },
  { until: { event: 'call', with: { key }, timeout: 20 } },
];
async function at(place, steps) {
  let session = null;
  const said = [];
  const failures = await runHeadless({ name: 'press-109', profile, clock: 540, at: ['phu-dong', ...place], steps }, {
    onSession: (s) => {
      session = s;
      s.listen((ev) => { if (ev.type === 'call') said.push(ev.key); });
    },
  });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  return { session, said };
}
const atRow = () => at([27, 64.5], talk('fisher', 'mentor.first.you'));
const atStem = () => at([51, 8.5], talk('woodcutter', 'mentor.woodcutter.first'));
function run(session, seconds, until = () => false) {
  for (let i = 0; i < seconds / STEP && !until(); i++) {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
  }
}
const press = (session) => {
  session.command({ type: 'hands', id: session.action()?.id });
  session.events();
};
const slots = (session) => query(session.state, 'item').filter((e) => e.item.zone === 'line').map((e) => e.item.slot).sort((a, b) => a - b);

test('a stake goes into no space narrower than half of the gap, and always into a hole', () => {
  assert.ok(tightSlot([4], 1, 4), 'one from the bank, between the first two stakes');
  assert.ok(tightSlot([4], 3, 4), 'one before the stake of the fisher');
  assert.ok(!tightSlot([4], 2, 4), 'half of the gap is not too narrow');
  assert.ok(tightSlot([4], 5, 4), 'one after the last stake');
  assert.ok(!tightSlot([4], 8, 4), 'at the gap from the last stake');
  assert.ok(!tightSlot([4, 12], 5, 4), 'into a hole');
});

test('presses at the pile with no walk put no stake into a space narrower than half of the gap, and the fisher shows where to go on (the ring, #130)', async () => {
  const { session, said } = await atRow();
  const space = getEntity(session.state, 'zone:line').zone.space;
  for (let i = 0; i < 16; i++) {
    press(session);
    run(session, 2);
  }
  const s = [...new Set([0, ...slots(session)])];
  for (let i = 1; i < s.length; i++) assert.ok(s[i] - s[i - 1] >= space / 2, `the row ${s.join(', ')} (gap ${space})`);
  assert.ok(said.includes('fisher.tight.ring'), said.join(', '));
  assert.ok(said.includes('fisher.ghost'), 'the see-through stake says what it is');
  assert.equal(said.filter((k) => k === 'fisher.ghost').length, 1, 'once');
});

test('the talk of the fisher names both sides of the rule', () => {
  for (const lang of ['vi', 'en']) {
    const line = load(`i18n/${lang}.json`)['dlg.fisher.trial.n5'];
    assert.match(line, lang === 'vi' ? /rộng quá.*hẹp quá/ : /too wide.*too narrow/, line);
  }
});

test('after an escape, a take-back puts the ring at the hole and the line says the hole', async () => {
  const { session, said } = await atRow();
  const tz = getEntity(session.state, 'zone:trial-fisher').zone;
  const line = getEntity(session.state, 'zone:line').zone;
  const space = line.space;
  // A row with a stake of the child, and a hole after it (as after an escape).
  const pile = query(session.state, 'item').find((e) => /^stake:/.test(e.id) && e.item.zone === 'stakes');
  const hero = getEntity(session.state, 'hero');
  Object.assign(hero.position, { x: pile.position.x + 1, z: pile.position.z });
  delete hero.route;
  worldCommand(session.state, { type: 'pick', id: 'hero', item: pile.id });
  run(session, 0.5);
  Object.assign(hero.position, { x: line.x + 2 * space, z: line.z - 1.5 });
  delete hero.route;
  worldCommand(session.state, { type: 'put', id: 'hero', zone: 'line', at: { x: line.x + 2 * space, z: line.z } });
  run(session, 0.5);
  assert.ok(slots(session).includes(2 * space), slots(session).join(', '));
  tz.hole = { from: 2 * space, size: 3 * space };
  worldCommand(session.state, { type: 'pick', id: 'hero', item: pile.id });
  run(session, 0.5);
  const ring = getEntity(session.state, 'why:fisher:next');
  assert.ok(ring, 'a ring');
  assert.equal(ring.position.x, line.x + Math.round(2 * space + 1.5 * space));
  assert.ok(said.includes('mentor.fisher.back.hole'), said.join(', '));
});

test('the see-through chalk lies under the hero before the first mark, follows the hero along the stem, and the woodcutter says once what it is', async () => {
  const { session, said } = await atStem();
  const stem = getEntity(session.state, 'stem:woodcutter');
  const hero = getEntity(session.state, 'hero');
  const ghostAt = (x) => {
    Object.assign(hero.position, { x: stem.position.x + x, z: stem.position.z - 2 });
    delete hero.route;
    run(session, 0.5);
    return session.action();
  };
  for (const x of [3, 5]) {
    const a = ghostAt(x);
    assert.equal(a?.act, 'mark');
    assert.equal(a.ghost.look, 'chalk-band');
    assert.ok(a.ghost.see, 'see-through');
    assert.equal(Math.round(a.ghost.x - stem.position.x), x);
  }
  press(session);
  run(session, 1);
  assert.ok(said.includes('woodcutter.ghost'), said.join(', '));
  const b = ghostAt(2);
  assert.ok(!b.ghost.see, 'after the first mark, the ghost is the chalk');
  press(session);
  run(session, 1);
  assert.equal(said.filter((k) => k === 'woodcutter.ghost').length, 1, 'once');
});
