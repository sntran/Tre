// The rice of Gióng after the play test (#129): the pot says its count after each tray, a person of
// an event of the day waits while the rice is open and the wave gives the help of the rice, the help
// of the ducks reads the hands, and the line of the trays shows the trays and the pot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';

const rice = load('tests/stories/rice-giong.json');
const duckStory = load('tests/stories/event-duck.json');

function tools(session) {
  const said = [];
  const cues = [];
  const names = [];
  session.listen((e) => {
    if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, n: e.params?.n?.key ?? null, id: e.id ?? null });
    if (e.type === 'cue') cues.push([...e.ids]);
    if (e.type === 'names') names.push(e);
  });
  const run = (sec, read = true) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (read && session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const press = () => { session.command({ type: 'hands', id: session.action()?.id }); run(2); };
  const tray = (size) => query(session.state, 'item').find((e) => e.item.kind === 'bowls' && e.item.size === size && !e.item.held);
  const carry = (size) => {
    session.command({ type: 'tap', target: { thing: tray(size).id } });
    run(6);
    press();
    session.command({ type: 'tap', target: { zone: 'pot' } });
    run(6);
    press();
  };
  return { session, said, cues, names, run, press, carry };
}

// The rice is open, after the talk of the mother; with the event of the ducks today.
async function atRice(grade = 2, steps = rice.steps.slice(0, 4)) {
  let session = null;
  const failures = await runHeadless({ ...rice, profile: { ...rice.profile, grade }, steps: [{ do: { type: 'event', id: 'duck' } }, ...steps] }, { onSession: (x) => { session = x; } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  return session;
}

test('a tray that leaves the pot under ten says the count of the pot while the pot glows, and ten says the ten', async () => {
  const h = tools(await atRice(2));
  h.carry(3);
  const first = h.said.filter((x) => /^rice\.(pot|grow)/.test(x.key));
  assert.deepEqual(first.map((x) => [x.key, x.n]), [['rice.pot', 'num.3']]);
  assert.equal(first[0].id, 'npc:mother', 'the mother says it');
  assert.ok(h.cues.some((c) => c.includes('pot:rice')), 'the pot glows');
  h.carry(5);
  h.carry(3);
  const lines = h.said.filter((x) => /^rice\.(pot|grow)/.test(x.key)).map((x) => [x.key, x.n]);
  assert.deepEqual(lines, [['rice.pot', 'num.3'], ['rice.pot', 'num.8'], ['rice.grow.rest.one', 'num.1']]);
});

test('while the rice is open, a tap on the farmer of the ducks does not start her talk, she stands off the way, and a wave gives the help of the rice', async () => {
  const h = tools(await atRice(2));
  const farmer = getEntity(h.session.state, 'event:duck');
  assert.ok(farmer, 'the farmer of the ducks is there');
  // Off the way between the trays and the pot.
  const a = getEntity(h.session.state, 'zone:trays').zone;
  const b = getEntity(h.session.state, 'zone:pot').zone;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((farmer.position.x - a.x) * dx + (farmer.position.z - a.z) * dz) / (dx * dx + dz * dz)));
  const off = Math.hypot(farmer.position.x - a.x - t * dx, farmer.position.z - a.z - t * dz);
  assert.ok(off >= 8, `the farmer is ${off.toFixed(1)} half blocks from the way`);
  h.session.command({ type: 'tap', target: { person: farmer.id } });
  h.run(6);
  h.press();
  h.run(4);
  assert.ok(h.said.some((x) => x.key === 'event.duck.wait'), h.said.map((x) => x.key).join(', '));
  assert.ok(!h.said.some((x) => x.key === 'event.duck.start'), 'no talk of the ducks');
  assert.ok(!getEntity(h.session.state, 'zone:trial-event-duck'), 'no task of the ducks');
  // The wave button shows near the rice (the play of #129 found no button there).
  assert.ok(h.session.canWave, 'the wave button shows');
  // A wave with empty hands: the count of the pot and the trays; with a tray: the pot.
  h.session.command({ type: 'wave' });
  h.run(3);
  assert.ok(h.said.some((x) => x.key === 'rice.help.tray.zero'), h.said.map((x) => x.key).join(', '));
  assert.ok(h.cues.some((c) => c.includes('zone:trays')), 'the trays glow');
  h.session.command({ type: 'tap', target: { thing: query(h.session.state, 'item').find((e) => e.item.kind === 'bowls').id } });
  h.run(6);
  h.press();
  h.session.command({ type: 'wave' });
  h.run(3);
  assert.ok(h.said.some((x) => x.key === 'rice.help.pot.zero'), h.said.map((x) => x.key).join(', '));
  assert.ok(!h.said.some((x) => /^mentor\.(duck|tryFirst)|^mentor\.wait/.test(x.key)), h.said.map((x) => x.key).join(', '));
});

test('the line of the trays makes the trays and the pot glow, the view of the talk frames both, and at grade 2 "bờ ruộng" has its line one time', async () => {
  let session = null;
  await runHeadless({ ...rice, profile: { ...rice.profile, grade: 2 }, steps: rice.steps.slice(0, 2) }, { onSession: (x) => { session = x; } });
  const h = tools(session);
  let seen = null;
  for (let i = 0; i < 8 && !seen; i++) {
    if (session.screen === 'dialogue' && h.said.at(-1)?.key === 'dlg.giong.rice.n2') seen = h.names.at(-1);
    else {
      session.command({ type: 'next' });
      h.run(1, false);
    }
  }
  assert.ok(seen, h.said.map((x) => x.key).join(', '));
  // The names of the line: the two places (their rims glow), and the points that the view of the
  // talk frames (src/ui/village.js, the event names).
  const trays = getEntity(session.state, 'zone:trays').zone;
  const pot = getEntity(session.state, 'zone:pot').zone;
  assert.equal(seen.spots.length, 2, 'the trays and the pot');
  for (const z of [trays, pot]) assert.ok(seen.points.some((p) => Math.hypot(p.x - z.x, p.z - z.z) <= 4), `${z.id} in the points of the view`);
  h.run(10);
  assert.equal(h.said.filter((x) => x.key === 'word.boruong').length, 1);
});

// The ducks, with a duck of her flock or a brown duck in the hands.
async function duckInHands(stray) {
  let session = null;
  const start = duckStory.steps.slice(0, duckStory.steps.findIndex((x) => x.read === true) + 1);
  await runHeadless({ ...duckStory, profile: { ...duckStory.profile, grade: 2 }, steps: start }, { onSession: (x) => { session = x; } });
  const h = tools(session);
  const hero = getEntity(session.state, 'hero');
  const heap = query(session.state, 'zone').find((z) => z.zone.rule === 'heap' && (stray ? /-stray-\d+$/ : /-lost-\d+$/).test(z.zone.id) && z.zone.items.length);
  const duck = getEntity(session.state, heap.zone.items[0]);
  Object.assign(hero.position, { x: duck.position.x + 1.5, z: duck.position.z });
  delete hero.route;
  h.run(0.5);
  session.command({ type: 'tap', target: { thing: duck.id } });
  h.run(3);
  h.press();
  assert.equal(hero.hands?.holds, duck.id);
  return h;
}

test('a wave with a duck of her flock in the hands points at the pen, and the pen glows; with a brown duck, the line says it is not hers', async () => {
  const h = await duckInHands(false);
  const from = h.said.length;
  h.session.command({ type: 'wave' });
  h.run(4);
  const after = h.said.slice(from).map((x) => x.key);
  assert.ok(after.includes('mentor.duck.carry'), after.join(', '));
  assert.ok(!after.includes('mentor.duck.show'), after.join(', '));
  const pen = query(h.session.state, 'zone').find((z) => z.zone.rule === 'exact' && /duck/.test(z.zone.task));
  assert.ok(h.cues.some((c) => c.includes(pen.id)), `the pen glows: ${JSON.stringify(h.cues.slice(-4))}`);
  const s = await duckInHands(true);
  const from2 = s.said.length;
  s.session.command({ type: 'wave' });
  s.run(4);
  const after2 = s.said.slice(from2).map((x) => x.key);
  assert.ok(after2.includes('mentor.duck.stray'), after2.join(', '));
});
