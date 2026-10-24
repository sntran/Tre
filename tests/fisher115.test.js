// The row of the fisher that a child can always finish (#115): the float always takes the last
// stake, a ring is never at a refused point, a row with no allowed point is never a dead end, a
// finger on the ring chooses its point, and the line of the see-through stake keeps its place in
// the voice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity, query } from '../src/core/world/state.js';
import { tightSlot, allowedSlots, takeBackSlot, stakeResult } from '../src/core/world/trials.js';
import { createVoiceQueue, bubbleLine } from '../src/core/bubblevoice.js';
import { tapTarget, sessionCamera, sessionScreen } from '../src/world/hit.js';

const profile = { name: 'An', grade: 2, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
const talk = [
  { press: { entity: 'npc:fisher' } },
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
  { read: true },
  { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 20 } },
];
async function start(opts = {}) {
  let session = null;
  const said = [];
  const story = opts.profile ? { name: 'fisher-115', steps: [{ wait: 2 }] } : { name: 'fisher-115', profile, clock: 540, at: ['phu-dong', 27, 64.5], steps: talk };
  const failures = await runHeadless(story, {
    ...(opts.profile ? { profile: opts.profile } : {}),
    onSession: (s) => {
      session = s;
      s.listen((ev) => { if (ev.type === 'call') said.push(ev.key); });
    },
  });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  return { session, said };
}
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
const slots = (session) => query(session.state, 'item').filter((e) => e.item.zone === 'line' && e.item.slot != null && !e.item.held).map((e) => e.item.slot).sort((a, b) => a - b);
// A finger on a point of the world (half blocks), through the camera of the game on a phone.
function finger(session, p) {
  const cam = sessionCamera(session);
  const s = cam.project(p.x / 2, p.y / 2, p.z / 2);
  return tapTarget(s, sessionScreen(session, cam));
}
// The row as the child left it: the stakes of the pile go to the points `at` (the two stakes of
// the fisher stay), one stake goes into the hands, and the rest leave the pile when `empty`.
function setRow(session, at, { empty = false } = {}) {
  const line = getEntity(session.state, 'zone:line').zone;
  const pile = getEntity(session.state, 'zone:stakes').zone;
  for (const id of [...line.items]) {
    const e = getEntity(session.state, id);
    line.items.splice(line.items.indexOf(id), 1);
    Object.assign(e.item, { zone: 'stakes', slot: null });
    pile.items.push(id);
  }
  while (pile.items.length < at.length + 1) {
    const id = `stake:fisher:x${pile.items.length}`;
    const proto = getEntity(session.state, pile.items[0]);
    session.state.entities.push({ ...proto, id, item: { ...proto.item }, position: { ...proto.position } });
    pile.items.push(id);
  }
  for (const k of at) {
    const id = pile.items.shift();
    const e = getEntity(session.state, id);
    Object.assign(e.item, { zone: 'line', slot: k });
    e.position = { x: line.x + k, y: line.y, z: line.z, facing: 0 };
    line.items.push(id);
  }
  // The clock of the tide started at the first stake of the child.
  getEntity(session.state, 'zone:trial-fisher').zone.tide.started = true;
  session.command({ type: 'tap', target: { thing: pile.items[0] } });
  run(session, 4);
  press(session);
  run(session, 1.5);
  assert.ok(getEntity(session.state, 'hero').hands?.holds, 'a stake in the hands');
  if (empty) for (const id of [...pile.items]) { const e = getEntity(session.state, id); if (!e.item.held) { pile.items.splice(pile.items.indexOf(id), 1); session.state.entities.splice(session.state.entities.indexOf(e), 1); } }
  return line;
}

test('the float always takes the last stake, also one point after the last stake', () => {
  assert.ok(!tightSlot([3, 6, 9, 12, 14], 15, 3, 15), 'the float after 14');
  assert.ok(tightSlot([3, 6, 9, 12, 14], 13, 3, 15), 'a point between 12 and 14 is still too narrow');
  assert.deepEqual(allowedSlots([0, 1, 3, 4, 5, 8, 9, 10, 11, 14], 15, 3), [15], 'the row of Tí: the float');
});

test('over many rows that the rule allows, an unfinished row always has an allowed point', () => {
  let rows = 0;
  for (let length = 4; length <= 20; length++) {
    for (let space = 2; space <= 5 && space < length; space++) {
      for (let seed = 1; seed <= 40; seed++) {
        let r = seed * 9301 + length * 49297 + space;
        const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
        const row = [0, space];
        for (let n = 0; n < 3 * length; n++) {
          if (stakeResult(row, length, space).solved) break;
          const free = allowedSlots(row, length, space);
          assert.ok(free.length, `no allowed point: row ${row.join(', ')} (${length}, gap ${space})`);
          row.push(free[Math.floor(rnd() * free.length)]);
          rows += 1;
        }
      }
    }
  }
  assert.ok(rows > 1000);
});

test('with no allowed point, the stake to take back is one of the child that opens a point', () => {
  // A row of the float with no free point that the rule allows, and a hole that no point can fill.
  const row = [0, 3, 5, 7, 9, 11, 12, 13, 15];
  assert.deepEqual(allowedSlots(row, 15, 3).filter((k) => k !== 15), allowedSlots(row, 15, 3));
  const k = takeBackSlot(row, 15, 3, 12, [0, 3]);
  assert.ok(k !== null && ![0, 3].includes(k));
  assert.ok(allowedSlots(row.filter((x) => x !== k), 15, 3).length, 'the take-back opens a point');
});

test('grade 2: after stakes at 12 and 14, the float takes the last stake, and the row ends', async () => {
  const { session, said } = await start();
  const line = setRow(session, [6, 9, 12, 14]);
  const t = finger(session, { x: line.x + 15, y: line.y + 1.3, z: line.z });
  session.command({ type: 'tap', target: t });
  run(session, 4);
  assert.equal(session.action()?.ghost?.x, line.x + 15, 'the see-through stake is at the float');
  press(session);
  run(session, 2);
  assert.ok(slots(session).includes(15), slots(session).join(', '));
  assert.ok(!said.includes('fisher.tight.here'), said.join(', '));
  run(session, 60, () => getEntity(session.state, 'zone:trial-fisher').zone.done);
  assert.ok(getEntity(session.state, 'zone:trial-fisher').zone.done, said.join(', '));
});

test('a ring is never at a refused point, and a finger on the ring puts the next stake there', async () => {
  const { session, said } = await start();
  const line = getEntity(session.state, 'zone:line').zone;
  for (let i = 0; i < 12 && !getEntity(session.state, 'why:fisher:next'); i++) {
    press(session);
    run(session, 2);
  }
  const ring = getEntity(session.state, 'why:fisher:next');
  assert.ok(ring, said.join(', '));
  const k = ring.position.x - line.x;
  assert.ok(!tightSlot(slots(session), k, line.space, line.length), `the ring at ${k}: row ${slots(session).join(', ')}`);
  const t = finger(session, ring.position);
  const h0 = { ...getEntity(session.state, 'hero').position };
  session.command({ type: 'tap', target: t });
  run(session, 4);
  const h = getEntity(session.state, 'hero').position;
  assert.ok(Math.abs(h.x - ring.position.x) < Math.abs(h0.x - ring.position.x), 'the hero walks along the bank to the ring');
  press(session);
  run(session, 2);
  assert.ok(slots(session).includes(k), `the stake at the ring ${k}: ${slots(session).join(', ')}`);
});

test('a finger on the water next to the row chooses the point there', async () => {
  const { session } = await start();
  const line = setRow(session, [6]);
  const t = finger(session, { x: line.x + 10, y: line.y + 1.2, z: line.z + 1.5 });
  session.command({ type: 'tap', target: t });
  run(session, 4);
  const at = session.action()?.ghost?.x - line.x;
  assert.ok(Math.abs(at - 10) <= 1, `the see-through stake at ${at}: ${JSON.stringify(t)}`);
});

test('the row of Tí: his saved game, the row of the play test, and the stake in the hands; taps and presses end the task', async () => {
  const save = JSON.parse(readFileSync(new URL('../docs/reference/saves/ti-save.json', import.meta.url), 'utf8'));
  const { session, said } = await start({ profile: save });
  const line = setRow(session, [1, 4, 5, 8, 9, 10, 11, 14], { empty: true });
  session.command({ type: 'wave' });
  run(session, 6);
  assert.notEqual(said.filter((k) => k.startsWith('mentor.') || k.startsWith('fisher.')).at(-1), 'fisher.tight.here', said.join(', '));
  const t = finger(session, { x: line.x + 15, y: line.y + 1.3, z: line.z });
  session.command({ type: 'tap', target: t });
  run(session, 4);
  press(session);
  run(session, 2);
  assert.ok(slots(session).includes(15), slots(session).join(', '));
  run(session, 60, () => getEntity(session.state, 'zone:trial-fisher').zone.done);
  assert.ok(getEntity(session.state, 'zone:trial-fisher').zone.done, said.join(', '));
});

test('a full row and a stake in the hands: the fisher says the pile, a press puts it back, and the row ends', async () => {
  const { session, said } = await start();
  setRow(session, [5, 7, 9, 11, 13, 15]);
  run(session, 1);
  assert.ok(said.includes('fisher.pile'), said.join(', '));
  assert.notEqual(session.action()?.target, 'zone:line', `no put into the row: ${JSON.stringify(session.action())}`);
  session.command({ type: 'wave' });
  run(session, 6);
  assert.ok(!said.includes('mentor.carry.fisher'), said.join(', '));
  for (let i = 0; i < 3 && getEntity(session.state, 'hero').hands?.holds; i++) {
    press(session);
    run(session, 4);
  }
  assert.equal(getEntity(session.state, 'hero').hands?.holds ?? null, null, 'the stake went back');
  run(session, 60, () => getEntity(session.state, 'zone:trial-fisher').zone.done);
  assert.ok(getEntity(session.state, 'zone:trial-fisher').zone.done, said.join(', '));
});

test('the line of the see-through stake keeps its place in the voice when a hint comes in the same step', () => {
  const q = createVoiceQueue();
  const ev = (textKey) => ({ screen: 'callout', id: 'npc:fisher', textKey, params: {} });
  q.offer(bubbleLine({ screen: 'callout', id: 'npc:teacher', textKey: 'x.busy', params: {} }), true);
  q.offer(bubbleLine(ev('fisher.ghost')), true);
  q.offer(bubbleLine(ev('mentor.fisher.back.hole')), true);
  const keys = [];
  for (let l = q.next(); l; l = q.next()) keys.push(l.key);
  assert.ok(keys.includes('fisher.ghost'), keys.join(', '));
  assert.ok(keys.includes('mentor.fisher.back.hole'), keys.join(', '));
});

test('a child who only presses at a narrow place: after the ring shows, each refused press says the ring and points at it, not the narrow line again', async () => {
  const { session, said } = await start();
  run(session, 1);
  // Presses from where the hero stands (beside the first stakes of the fisher).
  for (let i = 0; i < 8; i++) {
    if (session.action()?.act === 'pick' || session.action()?.act === 'put') press(session);
    run(session, 1.6);
  }
  const ring = getEntity(session.state, 'why:fisher:next');
  assert.ok(ring, `the ring: ${said.join(', ')}`);
  const after = said.slice(said.indexOf('fisher.tight.ring') + 1);
  assert.ok(!after.includes('fisher.tight.here'), said.join(', '));
  const fisher = getEntity(session.state, 'npc:fisher');
  press(session);
  run(session, 0.3);
  if (said.at(-1) === 'fisher.tight.ring') assert.ok(fisher.gesture && Math.hypot(fisher.gesture.x - ring.position.x, fisher.gesture.z - ring.position.z) < 0.5, 'he points at the ring');
});
