// The fisher (#78): a row that a child can always finish. The pile never runs out while the row
// needs a stake, a tap on a stake of the row and a press take it back, the tide comes soon after the
// row reaches the float, the hint fits the row, the help never puts stakes into the row of the
// child, a tap on a point with a stake puts at the nearest free point, and the lines and the tide of
// the fisher wait while the child is at another place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity, query } from '../src/core/world/state.js';
import { readFileSync } from 'node:fs';

const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
const FISHER = [27, 64.5];
const start = [
  { press: { entity: 'npc:fisher' } },
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
  { read: true },
  { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 15 } },
];
async function atRow(steps = [], hook = () => {}) {
  let session = null;
  const failures = await runHeadless({ name: 'fisher-78', profile, clock: 540, at: ['phu-dong', ...FISHER], steps: [...start, ...steps] }, { onSession: (s) => { session = s; hook(s); } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
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
function heard(session) {
  const out = [];
  session.listen((ev) => {
    // A line of a person comes as a call and then as its bubble: the call only.
    if (ev.type === 'call') out.push({ key: ev.key, t: session.state.tick * STEP, id: ev.id });
    else if (ev.type !== 'open') out.push({ type: ev.type, id: ev.id, t: session.state.tick * STEP });
  });
  return out;
}
const slots = (session) => query(session.state, 'item').filter((e) => e.item.zone === 'line').map((e) => e.item.slot).sort((a, b) => a - b);
const line = (session) => getEntity(session.state, 'zone:line').zone;
const pileLeft = (session) => getEntity(session.state, 'zone:stakes').zone.items.filter((id) => !getEntity(session.state, id)?.item.held).length;
// A stake from the pile, and then the row at this point (half blocks from its start).
const stakeTo = (n, at) => [{ press: { thing: `stake:fisher:${n}` } }, { until: { event: 'pick', timeout: 15 } }, { tap: { line: at } }, { wait: 2 }, { press: true }, { until: { event: 'put', timeout: 15 } }];

test('a child who only presses still reaches the float: when the pile is empty, the fisher brings more stakes and says it', async () => {
  const session = await atRow();
  const lines = heard(session);
  const z = line(session);
  for (let k = 0; k < 120 && !slots(session).includes(z.length); k++) {
    if (getEntity(session.state, 'zone:trial-fisher')?.zone.tide.phase !== 'low') {
      run(session, 2);
      continue;
    }
    const a = session.action();
    send(session, { type: 'hands', id: a?.id });
    run(session, 3);
  }
  assert.ok(slots(session).includes(z.length), `the row reaches the float: ${slots(session).join(',')}`);
  assert.ok(lines.some((l) => l.key === 'fisher.more'), 'the fisher says that he brings more stakes');
  // No hint names the pile while it is empty.
  const empty = lines.filter((l) => l.key === 'mentor.show.fisher');
  assert.ok(empty.length === 0 || pileLeft(session) > 0, 'no hint asks for a stake of an empty pile');
});

test('a tap on a stake of the row chooses it on the screen, and a press takes it back', async () => {
  const { tapTarget, sessionCamera, sessionScreen } = await import('../src/world/hit.js');
  const session = await atRow(stakeTo(2, 8));
  run(session, 1);
  const stake = query(session.state, 'item').find((e) => e.item.zone === 'line' && e.item.slot === 8);
  assert.ok(stake, 'a stake of the child at 8');
  const cam = sessionCamera(session);
  // The finger on the body of the stake, over the water.
  const t = tapTarget(cam.project(stake.position.x / 2, stake.position.y / 2 + 0.7, stake.position.z / 2), sessionScreen(session, cam));
  assert.deepEqual(t, { thing: stake.id }, `the tap chooses the stake: ${JSON.stringify(t)}`);
  send(session, { type: 'tap', target: t });
  run(session, 0.3);
  run(session, 8, () => !getEntity(session.state, 'hero').route);
  assert.equal(session.action()?.act, 'pick', `the button takes it back: ${session.action()?.act}`);
  send(session, { type: 'hands', id: session.action().id });
  run(session, 2);
  assert.equal(getEntity(session.state, 'hero').hands.holds, stake.id, 'the stake is in the hands');
  assert.ok(!slots(session).includes(8), 'the point is free');
});

test('a few seconds after the row reaches the float, the water rises and the fisher says it; the hint is then to wait', async () => {
  const session = await atRow([...stakeTo(2, 8), ...stakeTo(3, 12), ...stakeTo(4, 16)]);
  const lines = heard(session);
  const t0 = session.state.tick * STEP;
  run(session, 20, () => lines.some((l) => l.type === 'tide'));
  const tide = lines.find((l) => l.type === 'tide');
  assert.ok(tide && tide.t - t0 < 10, `the tide comes soon: ${tide ? (tide.t - t0).toFixed(1) : 'none'} s`);
  assert.ok(lines.some((l) => l.key === 'fisher.full' && l.t < tide.t), 'the fisher says the row is full before the water comes');
});

test('while the row is at the float, the hint is to wait for the tide, never to take a stake', async () => {
  const session = await atRow([...stakeTo(2, 8), ...stakeTo(3, 12), ...stakeTo(4, 16)]);
  const lines = heard(session);
  send(session, { type: 'mentor', key: 'trial-fisher', move: 'show' });
  run(session, 4);
  const keys = lines.filter((l) => l.key).map((l) => l.key);
  assert.ok(keys.includes('fisher.full'), keys.join(' '));
  assert.ok(!keys.includes('mentor.show.fisher'), keys.join(' '));
});

test('the help of the fisher never puts a stake into the row of the child; a tight row gets the line of the take back one time', async () => {
  const session = await atRow([...stakeTo(2, 5), ...stakeTo(3, 6)]);
  const lines = heard(session);
  const before = slots(session).join(',');
  for (let k = 0; k < 6; k++) {
    send(session, { type: 'wave' });
    run(session, 8);
  }
  assert.equal(slots(session).join(','), before, 'the row of the child is the same');
  assert.ok(!lines.some((l) => /putDone$/.test(l.key ?? '')), 'no line of a put');
  assert.equal(lines.filter((l) => l.key === 'mentor.fisher.tight').length, 1, `the take back is shown one time: ${lines.filter((l) => l.key).map((l) => l.key).join(' ')}`);
});

test('a tap on a point with a stake puts the stake in the hands at the free point nearest to the tap', async () => {
  const session = await atRow([...stakeTo(2, 8), ...stakeTo(3, 16), { press: { thing: 'stake:fisher:4' } }, { until: { event: 'pick', timeout: 15 } }, { tap: { line: 16 } }, { wait: 3 }]);
  const z = line(session);
  const a = session.action();
  assert.equal(a?.act, 'put', `the button puts: ${a?.act}`);
  assert.equal(Math.round(a.ghost.x - z.x), 15, 'at the free point next to the float');
});

test('the tide and the lines of the fisher wait while the child is at another place', async () => {
  const session = await atRow(stakeTo(2, 8));
  const lines = heard(session);
  const hero = getEntity(session.state, 'hero');
  Object.assign(hero.position, { x: hero.position.x + 90, z: hero.position.z - 60 });
  delete hero.route;
  run(session, 150);
  assert.ok(!lines.some((l) => l.type === 'tide'), 'no tide while the child is away');
  assert.ok(!lines.some((l) => l.key && l.id === 'npc:fisher'), `no line of the fisher: ${lines.filter((l) => l.id === 'npc:fisher').map((l) => l.key).join(' ')}`);
});

test('quick presses on a picture that a phone shows a moment late are never refused: a press on the act that an earlier press just did is a part of it', async () => {
  const session = await atRow();
  const presses = [];
  session.listen((ev) => { if (ev.type === 'press') presses.push(ev); });
  const refused = [];
  for (let k = 0; k < 40; k++) {
    if (getEntity(session.state, 'zone:trial-fisher')?.zone.tide.phase !== 'low') {
      run(session, 2);
      continue;
    }
    // The screen shows the picture of the last frame: the finger comes 0.15 seconds later.
    const a = session.action();
    run(session, 0.15);
    const before = presses.length;
    send(session, { type: 'hands', id: a?.id ?? null });
    run(session, 0.9);
    const mine = presses.slice(before).filter((e) => e.id === a?.id);
    if (a?.act && mine.some((e) => !e.done && !e.wait && !e.again) && !mine.some((e) => e.done || e.wait || e.again)) refused.push(`${k}: ${a.act} ${a.target}`);
  }
  assert.deepEqual(refused, []);
});

test('the picture of the button follows the real time, also when the frames are slow', () => {
  const village = readFileSync(new URL('../src/ui/village.js', import.meta.url), 'utf8');
  assert.match(village, /const real = Math\.max\(0, \(now - last\) \/ 1000\);\n\s+const dt = Math\.min\(0\.05, real\);/);
  assert.match(village, /updateAction\(real\);/);
});
