// The legend in front of the child (#137): the iron horse comes out of the forge at full size and
// goes to the yard of Gióng, Gióng grows in front of the child and gets on it, the grown Gióng has
// his armor and his horse, and after "Có!" he rides behind the child.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';
import { person } from '../src/world/figures.js';

const forge = load('tests/stories/forge-horse.json');
const rice = load('tests/stories/rice-giong.json');
const figures = load('data/figures.json').figures;
const npcs = load('data/npcs.json').npcs;

async function story(s, steps) {
  let session = null;
  const failures = await runHeadless({ ...s, steps }, { onSession: (x) => { session = x; } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  return session;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const run = (session, sec, read = true, each = null) => {
  for (let i = 0; i < sec / STEP; i++) {
    if (read && session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
    each?.();
  }
};

test('after the last piece of the forge, the iron horse stands by the forge at full size, and then in the yard of Gióng', async () => {
  const session = await story(forge, forge.steps.slice(0, 20));
  const steed = getEntity(session.state, 'steed:giong');
  assert.equal(steed?.look, 'iron-steed');
  const at = session.env.places['forge-steed'];
  assert.ok(dist(steed.position, at) < 1, 'by the forge');
  run(session, 3);
  // The child walks away: the smith leads the horse to the yard.
  const far = session.env.places['woodcutter-stem'];
  session.command({ type: 'tap', target: { ground: { x: far.x / 2, y: far.z / 2 } } });
  run(session, 60);
  const yard = session.env.places['giong-yard'];
  assert.ok(dist(getEntity(session.state, 'steed:giong').position, yard) < 1, 'in the yard of the house of Gióng');
  assert.equal(session.profile.flags['horse.yard'], true);
});

test('at the end of the rice, Gióng grows in front of the child: one Gióng at a time, the grown Gióng on his horse in the yard when the box shows, and after "Có!" he rides behind the child', async () => {
  const session = await story(rice, rice.steps.slice(0, 29));
  const giongs = () => [
    ...query(session.state, 'person').filter((e) => (e.person.ref === 'giong-boy' || e.person.ref === 'giong-hero') && !e.hidden),
    ...(getEntity(session.state, 'grow:giong') ? [getEntity(session.state, 'grow:giong')] : []),
  ];
  const looks = new Set();
  let most = 0;
  let atBox = null;
  let last = null;
  session.listen((ev) => {
    if (ev.type === 'open') last = ev;
    if (ev.type === 'open' && ev.textKey === 'dlg.giong.grown.n1') {
      const g = query(session.state, 'person').find((e) => e.person.ref === 'giong-hero');
      atBox = g ? { at: { ...g.position }, hidden: Boolean(g.hidden), riding: g.riding, mount: getEntity(session.state, 'mount:giong-hero') } : null;
    }
  });
  run(session, 9, false, () => {
    most = Math.max(most, giongs().length);
    const g = getEntity(session.state, 'grow:giong');
    if (g) looks.add(g.look);
  });
  assert.equal(most, 1, 'never two Gióngs on the map at once');
  assert.deepEqual([...looks], ['giong-boy-5', 'giong-grow-1', 'giong-grow-2', 'giong-hero'], 'he grows in a few steps');
  assert.ok(atBox, 'the box of the legend shows');
  assert.ok(!atBox.hidden && dist(atBox.at, session.env.places['giong-yard']) < 2, 'the grown Gióng is in the yard of his house when the box shows');
  assert.ok(atBox.riding > 0 && atBox.mount?.look === 'iron-steed', 'on his iron horse');
  // The talk: the line of the legend, his words from the horse, and "Có!".
  for (let n = 0; n < 20 && session.screen; n++) {
    session.command(last?.choices?.length ? { type: 'choose', n: 0 } : { type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.events();
    run(session, 0.5, false);
  }
  run(session, 2);
  assert.equal(session.profile.flags['giong.follow'], true, 'Có! starts the ride behind the child');
  const well = session.env.places.well;
  session.command({ type: 'tap', target: { ground: { x: well.x / 2, y: well.z / 2 } } });
  run(session, 30, true);
  const g = query(session.state, 'person').find((e) => e.person.ref === 'giong-hero');
  const h = getEntity(session.state, 'hero');
  assert.ok(dist(g.position, h.position) <= 14, `Gióng is ${(dist(g.position, h.position) / 2).toFixed(1)} cells from the hero`);
  assert.ok(!g.hidden && g.riding > 0, 'on his horse, in sight');
});

test('the grown Gióng has armor of iron, the staff, and his horse', () => {
  const look = figures['giong-hero'];
  assert.ok(look.armor, 'armor');
  assert.equal(look.item, 'staff');
  assert.equal(npcs['giong-hero'].mount.look, 'iron-steed');
  const parts = person(look).parts.map((p) => p.name ?? p.id);
  assert.ok(parts.some((n) => /^armor/.test(n)), `the parts of the armor: ${parts.join(' ')}`);
  // He is clearly bigger than the boy of the last step.
  const tall = (k) => { const f = person(figures[k]); return f.height * f.scale; };
  assert.ok(tall('giong-hero') > tall('giong-boy-5') * 1.15);
});
