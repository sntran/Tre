// The forge of the iron horse after the play test of #140: while the iron glows on the anvil, a press
// takes no lump from the pile; a lump in the hands always has a way out (the press puts it back on
// the pile, at each place of the forge); and the goal follows the part of the forge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';

const story = load('tests/stories/forge-horse.json');

async function atForge(grade = 0) {
  let session = null;
  const first = story.steps.findIndex((s) => s.read === true);
  const failures = await runHeadless({ ...story, profile: { ...story.profile, grade }, steps: story.steps.slice(0, first + 1) }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  const said = [];
  const huds = [];
  session.listen((e) => {
    if (e.type === 'open' && e.textKey) said.push(e.textKey);
    if (e.type === 'hud') huds.push(session.workGoal());
  });
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const zone = (id) => getEntity(session.state, `zone:${id}`)?.zone;
  const hero = () => getEntity(session.state, 'hero');
  const held = () => hero().hands?.holds ?? null;
  const press = (sec = 2) => { session.command({ type: 'hands', id: session.action()?.id }); run(sec); };
  const tap = (target) => { session.command({ type: 'tap', target }); run(4); };
  const lump = () => {
    const id = zone('horse-ore').items.find((x) => !getEntity(session.state, x)?.item.held);
    tap({ thing: id });
    press();
    tap({ thing: 'hearth:horse' });
    press();
  };
  // The iron on the anvil: the lumps of the level in the hearth, and a blow.
  const fire = () => {
    const need = session.data.trials.trials.find((t) => t.id === 'horse').levels[0].ore;
    while (zone('hearth').items.length < need) lump();
    tap({ thing: 'bellows:horse' });
    press();
    assert.equal(zone('trial-horse').heat, 0, 'the iron is on the anvil');
  };
  // The hero stands at a place (half blocks), with no walk.
  const standAt = (p) => {
    Object.assign(hero().position, { x: p.x, z: p.z });
    delete hero().route;
    run(0.5);
  };
  return { session, said, huds, run, zone, hero, held, press, tap, lump, fire, standAt };
}

test('at grade K, with the iron on the anvil, a press near the pile takes no lump, and walks to the quench', async () => {
  const h = await atForge(0);
  h.fire();
  assert.ok(h.zone('horse-ore').items.length > 0, 'lumps are left on the pile');
  const pile = getEntity(h.session.state, 'zone:horse-ore').position;
  h.standAt({ x: pile.x, z: pile.z + 2 });
  const a = h.session.action();
  assert.ok(a, 'the button is not empty at the pile');
  assert.notEqual(a.act, 'pick', 'the pile gives no lump');
  assert.equal(a.icon, 'water', `the button shows the water (${a.act})`);
  h.press(10);
  assert.equal(h.held(), null, 'no lump in the hands');
});

test('at grade K, a lump in the hands at each place of the forge has a press that puts it back on the pile', async () => {
  const h = await atForge(0);
  h.fire();
  const tz = h.zone('trial-horse');
  const places = {
    hearth: getEntity(h.session.state, 'zone:hearth').position,
    anvil: tz.anvil,
    // The trough of the forge (a place of the map; the water of the smith).
    trough: h.session.env.places['smith-trough'],
    pile: getEntity(h.session.state, 'zone:horse-ore').position,
    smith: getEntity(h.session.state, 'npc:smith').position,
  };
  for (const [name, p] of Object.entries(places)) {
    // A tap on a lump of the pile takes it (the child chose it).
    const id = h.zone('horse-ore').items.find((x) => !getEntity(h.session.state, x)?.item.held);
    h.tap({ thing: id });
    h.press();
    assert.ok(h.held(), `${name}: a lump in the hands`);
    h.standAt({ x: p.x + 2, z: p.z + 2 });
    const a = h.session.action();
    assert.ok(a, `${name}: the button is not empty`);
    assert.equal(a.icon, 'hand-put', `${name}: the button shows a lump that goes down (${a.act})`);
    assert.ok(h.session.buttonThing(), `${name}: the lump is on the button`);
    const before = h.said.length;
    h.press(12);
    assert.equal(h.held(), null, `${name}: the hands are empty again`);
    assert.ok(h.zone('horse-ore').items.includes(id), `${name}: the lump is on the pile again`);
    assert.ok(h.said.slice(before).includes('horse.back'), `${name}: the smith says the line`);
    // Then the button shows the water.
    assert.equal(h.session.action()?.icon, 'water', `${name}: then the button shows the water`);
  }
});

test('at grade K, the goal of the step is the line of each part of the forge', async () => {
  const h = await atForge(0);
  assert.equal(h.session.workGoal(), 'quest.horse.forge');
  const need = h.session.data.trials.trials.find((t) => t.id === 'horse').levels[0].ore;
  while (h.zone('hearth').items.length < need) h.lump();
  assert.equal(h.session.workGoal(), 'quest.horse.blow');
  assert.ok(h.huds.includes('quest.horse.blow'), 'the goal bar updates');
  h.tap({ thing: 'bellows:horse' });
  h.press();
  assert.equal(h.session.workGoal(), 'quest.horse.quench');
  assert.ok(h.huds.includes('quest.horse.quench'), 'the goal bar updates');
  const vi = load('i18n/vi.json');
  assert.equal(vi['quest.horse.forge'], 'Mang sắt đến lò rèn.');
  assert.equal(vi['quest.horse.blow'], 'Thổi lửa cho sắt đỏ.');
  assert.equal(vi['quest.horse.quench'], 'Nhúng sắt đỏ vào nước.');
  assert.equal(vi['horse.back'], 'Đủ sắt rồi. Cháu để cục này lại đống nhé.');
});
