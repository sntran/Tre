// Buttons that do nothing and lines that are not true, after the play test of #140–#145 (#150): a
// person of the way talks, the start of a raid is a place with the slingshot, Gióng says what is
// true at the place, the ride is at once, the person of a side puzzle says the puzzle, a tap on an
// animal answers, and the woodcutter asks for iron only while the forge needs it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, data } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';
import { questMark } from '../src/core/clues.js';
import { pickTalk } from '../src/core/game.js';
import { tapTarget, sessionCamera, sessionScreen } from '../src/world/hit.js';
import { toCamera } from '../src/world/fade.js';
import { VIEW } from '../src/world/view.js';

async function start(s, steps = s.steps) {
  let session = null;
  const said = [];
  const events = [];
  const failures = await runHeadless({ ...s, steps }, { onSession: (x) => {
    session = x;
    x.listen((e) => {
      events.push(e);
      if (e.type === 'open' && e.textKey) said.push({ id: e.id, key: e.textKey, t: x.state.tick });
    });
  } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const press = (sec = 1) => {
    session.command({ type: 'hands', id: session.action()?.id ?? null });
    run(sec);
  };
  return { session, said, events, run, press };
}

test('a press of the talk at each person of the way says a line', async () => {
  const s = load('tests/stories/way-trau-son.json');
  const h = await start(s);
  const hero = () => getEntity(h.session.state, 'hero');
  const soldier = load('data/maps/trau-son.json').encounters.find((e) => e.id === 'soldier1');
  const [sx, sy] = data.world.at('trau-son', soldier.x, soldier.y);
  const spotOf = (id) => {
    const e = getEntity(h.session.state, `way:${id}`);
    return e ? { x: e.position.x / 2, y: e.position.z / 2 } : null;
  };
  const met = new Set();
  for (let k = 0; k < 6 && met.size < 2; k++) {
    const c = { x: hero().position.x / 2, y: hero().position.z / 2 };
    const m = questMark(data.clues, data.world.at, h.session.profile.flags, { x: sx, y: sy, h: 3 }, c, spotOf);
    h.session.command({ type: 'tap', target: { ground: { x: m.x, y: m.y, h: 3, thing: false, object: null, goal: true } } });
    for (let i = 0; i < 30 * 90 && (hero().route || h.session.screen); i++) h.run(STEP);
    h.run(2);
    // A person of the way next to the hero: the button shows the talk, and a press says a line.
    const way = query(h.session.state, 'person').find((e) => e.person.kind === 'way' && Math.hypot(e.position.x - hero().position.x, e.position.z - hero().position.z) < 10);
    if (!way || met.has(way.id)) continue;
    met.add(way.id);
    h.session.command({ type: 'tap', target: { person: way.id } });
    h.run(2);
    const a = h.session.action();
    assert.equal(a?.act, 'talk', `the act at ${way.id}: ${a?.act}`);
    for (let n = 0; n < 2; n++) {
      const before = h.said.length;
      h.press(1.5);
      assert.ok(h.said.slice(before).some((l) => l.id === way.id), `press ${n + 1} at ${way.id}: no line`);
    }
  }
  assert.equal(met.size, 2, 'two people of the way');
});

test('at the place of the soldiers, the button starts the raid with the picture of the slingshot, and Gióng says that the soldiers are here', async () => {
  const s = load('tests/stories/raid-soldiers-giong.json');
  const h = await start(s, [{ wait: 1 }]);
  const enc = getEntity(h.session.state, 'encounter:soldier1');
  const def = data.raids.raids.soldier1;
  // At the wall of the raid (the crossroads), not at the enemy.
  Object.assign(getEntity(h.session.state, 'hero').position, { x: def.wall[0] * 2, z: def.wall[1] * 2 });
  h.run(0.5);
  const a = h.session.action();
  assert.equal(a?.act, 'raid');
  assert.equal(a?.icon, 'sling');
  assert.equal(a?.target, enc.id);
  // Gióng at the place: his true line.
  assert.equal(pickTalk(data.npcs.npcs['giong-hero'], h.session.profile), 'giong.ready');
  const g = getEntity(h.session.state, 'npc:giong-hero');
  assert.ok(g, 'Gióng is here');
  h.session.command({ type: 'tap', target: { person: g.id } });
  h.run(4);
  const before = h.said.length;
  h.session.command({ type: 'hands', id: h.session.action()?.id ?? null });
  for (let i = 0; i < 30 && !h.said.slice(before).length; i++) h.run(STEP);
  assert.ok(h.said.slice(before).some((l) => l.key === 'dlg.giong.here.n1'), h.said.slice(before).map((l) => l.key).join(', '));
  assert.ok(!h.said.some((l) => l.key === 'dlg.giong.ready.n1'), 'no line of "far away" at the place');
});

test('a press of the ride during a walk mounts the hero in the same step, and the walk goes on', async () => {
  const profile = { name: 'Tí', grade: 2, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
  const h = await start({ name: 'ride-150', profile, clock: 600, at: ['phu-dong', 82.5, 30.5] }, [{ wait: 0.5 }]);
  const hero = getEntity(h.session.state, 'hero');
  const nghe = query(h.session.state, 'follow')[0];
  // A walk to a far point, and Nghé next to the hero.
  h.session.command({ type: 'tap', target: { ground: { x: hero.position.x / 2 + 20, y: hero.position.z / 2, h: 3, thing: false, object: null } } });
  h.run(0.5);
  assert.ok(hero.route, 'the walk');
  Object.assign(nghe.position, { x: hero.position.x + 1.5, z: hero.position.z });
  h.session.step();
  h.session.command({ type: 'hands', id: null });
  h.session.step();
  h.session.events();
  assert.equal(hero.riding, nghe.id, 'on Nghé at once');
  h.run(0.5);
  assert.ok(hero.route, 'the walk goes on, on the back of Nghé');
});

test('after the offer of the pots, a talk with bà lang says the puzzle again and she points at the well', async () => {
  const s = load('tests/stories/puzzle-pots.json');
  const h = await start(s, s.steps.slice(0, 1));
  h.run(2);
  const healer = getEntity(h.session.state, 'npc:healer');
  h.session.command({ type: 'tap', target: { person: healer.id } });
  h.run(2);
  const before = h.said.length;
  h.press(2);
  const lines = h.said.slice(before).map((l) => l.key);
  assert.ok(lines.some((k) => /^puzzle\.pots\.start/.test(k)), lines.join(', '));
  assert.equal(healer.gesture?.act, 'point');
});

test('a tap on the dog next to the hero on Nghé: the dog barks and hops, and Nghé does not moo', async () => {
  const profile = { name: 'Bin', grade: 0, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
  const h = await start({ name: 'dog-150', profile, clock: 600, at: ['phu-dong', 40, 60] }, [{ wait: 0.5 }]);
  const hero = getEntity(h.session.state, 'hero');
  const nghe = query(h.session.state, 'follow')[0];
  const dog = h.session.state.entities.find((e) => e.kind === 'dog' && e.position);
  assert.ok(dog, 'a dog');
  // The hero rides Nghé, and the dog stands next to them.
  hero.riding = nghe.id;
  Object.assign(dog.position, { x: hero.position.x + 1.6, y: hero.position.y, z: hero.position.z + 1.6 });
  delete dog.route;
  if (dog.steer) dog.steer.goal = null;
  h.session.step();
  const cam = sessionCamera(h.session);
  const q = cam.project(dog.position.x / 2, dog.position.y / 2 + 0.3, dog.position.z / 2);
  const target = tapTarget({ x: q.x, y: q.y }, sessionScreen(h.session, cam));
  assert.deepEqual(target, { animal: dog.id });
  const from = h.events.length;
  h.session.command({ type: 'tap', target });
  h.run(0.5);
  const evs = h.events.slice(from);
  assert.ok(evs.some((e) => e.type === 'answer' && e.id === dog.id && e.sound === 'bark'), 'the dog barks');
  assert.ok(!evs.some((e) => e.type === 'petted' || e.sound === 'moo'), 'Nghé does not moo');
});

test('after the horse is made with no first ore, the woodcutter says his idle line, not the line of the iron', () => {
  const flags = { 'giong.spoke': true, 'horse.forged': true };
  const talk = pickTalk(data.npcs.npcs.woodcutter, { flags, grade: 1, inventory: {} });
  assert.notEqual(talk, 'woodcutter.ore');
  const rule = data.npcs.npcs.woodcutter.talk.find((r) => r.dialogue === 'woodcutter.ore');
  assert.ok(rule.when.notFlags.includes('horse.forged'));
});

test('in the stories, each act of the button that the child can press next to people (a talk, the start of a raid, a ride, a look) says a line or changes the world', async () => {
  const names = ['way-trau-son', 'walk-trau-son', 'giong-cart', 'event-duck', 'puzzle-pots', 'puzzle-ferry', 'raid-soldiers-giong', 'riddle-evening'];
  const dead = [];
  let checked = 0;
  for (const name of names) {
    const s = load(`tests/stories/${name}.json`);
    const h = await start(s);
    h.run(1);
    const seen = new Set();
    for (let k = 0; k < 8; k++) {
      const t = h.session.targets().find((x) => ['talk', 'raid', 'ride', 'look'].includes(x.act) && !seen.has(`${x.act}:${x.target}`));
      if (!t) break;
      seen.add(`${t.act}:${t.target}`);
      const from = h.events.length;
      const tgt = /^(npc|way|event|pz|encounter|friend):/.test(t.target) ? (t.act === 'ride' ? { pet: t.target } : { person: t.target }) : null;
      if (tgt) {
        h.session.command({ type: 'tap', target: tgt });
        h.run(3);
      }
      const a = h.session.action();
      if (!a || a.act !== t.act) continue;
      h.session.command({ type: 'hands', id: a.id ?? null });
      h.run(1.5);
      const evs = h.events.slice(from);
      const did = evs.some((e) => (e.type === 'open' && e.textKey) || ['mount', 'dismount', 'raid', 'answer', 'petted', 'look'].includes(e.type) || (e.type === 'open' && e.screen));
      checked += 1;
      if (!did) dead.push(`${name}: ${t.act} ${t.target}`);
      if (getEntity(h.session.state, 'raid')) break;
    }
  }
  assert.deepEqual(dead, []);
  assert.ok(checked >= 6, `${checked} acts`);
});

test('at a talk with a person of the way, Gióng on his horse in front of the hero rides out of the way and is never pale (#158)', async () => {
  const s = load('tests/stories/way-trau-son.json');
  const h = await start(s, s.steps.slice(0, 1));
  const hero = getEntity(h.session.state, 'hero');
  const g = getEntity(h.session.state, 'npc:giong-hero');
  assert.ok(g, 'Gióng is here');
  delete hero.route;
  // Gióng three half blocks from the hero, toward the camera (the view turns the camera to az).
  const d = toCamera(Math.PI / 4, VIEW.elevation);
  const n = Math.hypot(d.x, d.z);
  h.session.command({ type: 'view', az: Math.PI / 4 });
  Object.assign(g.position, { x: hero.position.x + (d.x / n) * 3, z: hero.position.z + (d.z / n) * 3 });
  if (g.route) delete g.route;
  let pale = false;
  for (let i = 0; i < 3 / STEP; i++) {
    h.session.step();
    h.session.events();
    if (h.session.seeThrough().has(g.id)) pale = true;
  }
  assert.ok(!pale, 'Gióng is never pale');
  // He is no longer between the camera and the hero.
  const along = (g.position.x - hero.position.x) * (d.x / n) + (g.position.z - hero.position.z) * (d.z / n);
  const side = Math.abs((g.position.x - hero.position.x) * (d.z / n) - (g.position.z - hero.position.z) * (d.x / n));
  assert.ok(along < 1 || side > 3.2, `Gióng at ${along.toFixed(1)} toward the camera, ${side.toFixed(1)} to the side`);
});
