// The forge of the iron horse after the play test (#126): one step at a time, the hearth is a thing
// that a child sees and finds, a wrong blow says the count, the lumps lie apart, and the first iron
// waits for the child at the anvil.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { sessionCamera } from '../src/world/hit.js';

const story = load('tests/stories/forge-horse.json');
const vi = load('i18n/vi.json');

async function atForge(grade = 1) {
  let session = null;
  const first = story.steps.findIndex((s) => s.read === true);
  const failures = await runHeadless({ ...story, profile: { ...story.profile, grade }, steps: story.steps.slice(0, first + 1) }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  const said = [];
  const events = [];
  session.listen((e) => {
    if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, params: e.params, screen: e.screen });
    events.push(e);
  });
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const zone = (id) => getEntity(session.state, `zone:${id}`)?.zone;
  const press = () => { session.command({ type: 'hands', id: session.action()?.id }); run(2); };
  const tap = (target) => { session.command({ type: 'tap', target }); run(4); };
  // One lump from the heap into the hearth.
  const lump = () => {
    const id = zone('horse-ore').items.find((x) => !getEntity(session.state, x)?.item.held);
    tap({ thing: id });
    press();
    tap({ thing: 'hearth:horse' });
    press();
  };
  return { session, said, events, run, zone, press, tap, lump };
}

test('the talk says the goal and the first step only, and a tap on the smith says the step of now (the lumps until the hearth has six)', async () => {
  const h = await atForge(1);
  const n2 = vi['dlg.smith.forge.n2'];
  assert.ok(!/ống bễ|đe\b|nhúng/.test(n2), n2);
  h.tap({ person: 'npc:smith' });
  h.press();
  assert.equal(h.said.at(-1)?.key, 'horse.step.lumps');
  h.lump();
  assert.equal(h.zone('hearth').items.length, 1);
  // The step of the bellows came after the first lump, with the line of the new word (grade 1).
  assert.ok(h.said.some((x) => x.key === 'horse.step.bellows.word'), h.said.map((x) => x.key).join(', '));
  // With one lump of six, the step of now is still the lumps (a play of #126).
  h.tap({ person: 'npc:smith' });
  h.press();
  assert.equal(h.said.at(-1)?.key, 'horse.step.lumps');
  // With the lumps of the level, the step of the bellows, and the word line one time only.
  while (h.zone('hearth').items.length < 6 && h.zone('horse-ore').items.length) h.lump();
  h.tap({ person: 'npc:smith' });
  h.press();
  assert.equal(h.said.at(-1)?.key, 'horse.step.bellows', 'the word line comes one time');
  assert.ok(!h.said.some((x) => x.key === 'dlg.smith.forge.n1' && x.screen === 'dialogue' && h.said.indexOf(x) > 0), 'no talk again');
});

test('a blow with fewer lumps than the hearth needs says the count and the need, and the lumps glow', async () => {
  const h = await atForge(1);
  h.lump();
  h.tap({ thing: 'bellows:horse' });
  h.press();
  const count = h.said.find((x) => x.key === 'horse.count');
  assert.ok(count, h.said.map((x) => x.key).join(', '));
  assert.deepEqual(count.params, { n: { key: 'num.1' }, need: { key: 'num.6' } });
  assert.ok(h.events.some((e) => e.type === 'glowThings' && e.ids.length === 1));
});

test('a tap on the oven of the forge makes the hearth the place of the next press', async () => {
  const h = await atForge(1);
  const id = h.zone('horse-ore').items[0];
  h.tap({ thing: id });
  h.press();
  assert.ok(getEntity(h.session.state, 'hero').hands?.holds, 'a lump in the hands');
  // The oven of the forge (the object "forge" of the map), as the view sends a tap on it.
  const oven = getEntity(h.session.state, 'hearth:horse').position;
  h.tap({ ground: { x: oven.x / 2 + 3.4, y: oven.z / 2 - 4.7, h: 4, thing: true, object: 'forge', under: { x: oven.x / 2 + 3.4, y: oven.z / 2 - 7.5 } } });
  // The hero walks to the hearth, not behind the posts of the oven, and the press puts there.
  const hp = getEntity(h.session.state, 'hero').position;
  const hz = h.zone('hearth');
  assert.ok(Math.hypot(hp.x - (hz.x + 1.5), hp.z - (hz.z + 1)) <= 5, `the hero is ${Math.hypot(hp.x - (hz.x + 1.5), hp.z - (hz.z + 1)).toFixed(1)} half blocks from the hearth`);
  assert.equal(h.session.action()?.target, 'zone:hearth');
  h.press();
  assert.equal(h.zone('hearth').items.length, 1, 'the lump went into the hearth');
});

test('the lumps on the hearth lie apart, each a thing of its own on a phone', async () => {
  const h = await atForge(1);
  for (let i = 0; i < 6; i++) h.lump();
  assert.equal(h.zone('hearth').items.length, 6);
  const cam = sessionCamera(h.session);
  const pts = h.zone('hearth').items.map((id) => getEntity(h.session.state, id).position).map((p) => cam.project(p.x / 2, p.y / 2, p.z / 2));
  let least = Infinity;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) least = Math.min(least, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
  assert.ok(least >= 14, `two lumps are ${least.toFixed(0)} pixels apart`);
  for (const p of pts) assert.ok(p.x > 0 && p.x < cam.width && p.y > 0 && p.y < cam.height, 'on the screen');
});

test('the first iron does not cool before the hero stands at the anvil', async () => {
  const h = await atForge(2);
  for (let i = 0; i < 6; i++) h.lump();
  h.tap({ thing: 'bellows:horse' });
  h.press();
  const tz = getEntity(h.session.state, 'zone:trial-horse').zone;
  assert.equal(tz.heat, 0, 'the fire burns, and the iron is on the anvil');
  assert.ok(h.said.some((x) => x.key.startsWith('horse.step.anvil')), h.said.map((x) => x.key).join(', '));
  // The hero walks away from the anvil: the iron waits.
  const hero = getEntity(h.session.state, 'hero');
  Object.assign(hero.position, { x: tz.anvil.x - 16, z: tz.anvil.z + 6 });
  delete hero.route;
  h.run(12);
  assert.equal(tz.heat, 0, 'the iron waits');
  // A lump in the hands at the hearth: the smith points at the iron.
  h.tap({ thing: getEntity(h.session.state, 'iron:horse').id });
  h.run(8);
  assert.ok(tz.heat > 0, 'the iron glows when the hero is at the anvil');
});
