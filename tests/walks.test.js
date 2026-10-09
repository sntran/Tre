// Presses and taps go only where the child chose (#66).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { getEntity } from '../src/core/world/state.js';

const load = (name) => JSON.parse(readFileSync(new URL(`./stories/${name}.json`, import.meta.url), 'utf8'));

test('on the calf next to the scouts, one press gets the hero down and opens the talk of the encounter (#66)', async () => {
  const story = load('raid-scouts');
  let s = null;
  const failures = await runHeadless({ ...story, steps: [{ wait: 1 }] }, { onSession: (x) => { s = x; } });
  assert.deepEqual(failures, []);
  const enc = getEntity(s.state, 'encounter:scouts');
  const hero = getEntity(s.state, 'hero');
  const nghe = getEntity(s.state, 'friend:nghe');
  Object.assign(hero.position, { x: enc.position.x - 4, y: enc.position.y, z: enc.position.z });
  Object.assign(nghe.position, { x: hero.position.x, y: hero.position.y, z: hero.position.z });
  hero.riding = nghe.id;
  // The child sees the new picture for a moment before the press (#60).
  for (let i = 0; i < 24; i++) s.step();
  const a = s.action();
  assert.equal(a?.act, 'talk', 'the button shows the talk');
  assert.equal(a.target, 'encounter:scouts');
  s.command({ type: 'hands' });
  for (let i = 0; i < 30 && !s.screen; i++) s.step();
  assert.ok(!getEntity(s.state, 'hero').riding, 'the hero is down');
  assert.ok(s.screen, 'the talk of the encounter is open');
});

test('from each station of the five trials, a tap on each person of the trials walks the hero to that person (#66)', async () => {
  const people = ['teacher', 'smith', 'fisher', 'healer', 'woodcutter'];
  const misses = [];
  let checked = 0;
  for (const from of people) {
    const story = load(`trial-${from === 'teacher' ? 'scholar' : from}`);
    for (const to of people) {
      if (to === from) continue;
      let s = null;
      // Start at the station (the place of the story), with no talk: a tap on the person, and the walk.
      const failures = await runHeadless({ ...story, name: `walk-${from}-${to}`, steps: [{ tap: { entity: `npc:${to}` } }, { wait: 0.5 }] }, { onSession: (x) => { s = x; } });
      // The end of the walk (a person who walks on after the hero came is not a miss).
      for (let i = 0; i < 60 * 30 && getEntity(s.state, 'hero').route; i++) s.step();
      const hero = getEntity(s.state, 'hero').position;
      const p = getEntity(s.state, `npc:${to}`)?.position;
      // A person out of the loaded land is not on the screen: no tap reaches it.
      if (!p) continue;
      checked += 1;
      if (failures.length) {
        misses.push(`${from} -> ${to}: ${failures.map((f) => f.message).join('; ')}`);
        continue;
      }
      const d = Math.hypot(hero.x - p.x, hero.z - p.z) / 2;
      if (d > 3.5) misses.push(`${from} -> ${to}: ${d.toFixed(1)} cells`);
    }
  }
  assert.deepEqual(misses, []);
  assert.ok(checked >= 12, `${checked} walks`);
});

test('a press never walks to another task: a bunch of the healer in the hands at the forge flies back to its bed, and the press stays at the forge (#66)', async () => {
  const story = load('trial-healer');
  const upTo = story.steps.findIndex((x) => x.read) + 1;
  let s = null;
  const failures = await runHeadless({ ...story, steps: [...story.steps.slice(0, upTo), { wait: 1 }] }, { onSession: (x) => { s = x; } });
  assert.deepEqual(failures, []);
  const hero = getEntity(s.state, 'hero');
  const bed = getEntity(s.state, 'zone:bed-ngai');
  const herb = getEntity(s.state, bed.zone.items[0]);
  // The bunch in the hands (as after a pick).
  bed.zone.items = bed.zone.items.filter((id) => id !== herb.id);
  herb.item.held = 'hero';
  herb.item.zone = null;
  herb.hidden = true;
  hero.hands = { ...(hero.hands ?? {}), holds: herb.id };
  hero.carry = herb.look;
  s.step();
  assert.equal(hero.hands.holds, herb.id, 'in the area of the task, the bunch stays in the hands');
  // The hero goes to the forge.
  const anvil = getEntity(s.state, 'npc:smith').position;
  Object.assign(hero.position, { x: anvil.x + 3, z: anvil.z + 3 });
  s.step();
  s.step();
  assert.equal(hero.hands.holds ?? null, null, 'the hands are free');
  assert.equal(herb.item.zone, 'bed-ngai', 'the bunch is back in its bed');
  // A press at the forge never walks back to the healer.
  const at = { ...hero.position };
  s.command({ type: 'hands' });
  for (let i = 0; i < 90; i++) s.step();
  assert.ok(Math.hypot(hero.position.x - at.x, hero.position.z - at.z) < 4, 'the hero stays at the forge');
});

test('at the fisher, presses up to the float and on past it never walk the hero to the bridge (#66)', async () => {
  const story = load('trial-fisher');
  const upTo = story.steps.findIndex((x) => x.read) + 1;
  let s = null;
  await runHeadless({ ...story, steps: [...story.steps.slice(0, upTo), { wait: 1 }] }, { onSession: (x) => { s = x; } });
  const hero = getEntity(s.state, 'hero');
  const gap = getEntity(s.state, 'zone:bridge-gap').position;
  const pile = getEntity(s.state, 'zone:bridge-pile').position;
  const near = () => Math.min(Math.hypot(hero.position.x - gap.x, hero.position.z - gap.z), Math.hypot(hero.position.x - pile.x, hero.position.z - pile.z));
  let least = near();
  // A child presses again and again, also after the row is at the float.
  for (let k = 0; k < 40; k++) {
    for (let n = 0; s.screen && n < 40; n++) {
      s.command({ type: s.screen === 'dialogue' || s.screen === 'say' ? 'next' : 'close' });
      s.step();
    }
    s.command({ type: 'hands' });
    for (let i = 0; i < 45; i++) {
      s.step();
      least = Math.min(least, near());
    }
  }
  assert.ok(least > 30, `the hero came ${(least / 2).toFixed(1)} cells from the bridge`);
});

test('a walk to the star of a person goes to the person, past the station of an open task (#66)', async () => {
  const story = load('trial-scholar');
  const upTo = story.steps.findIndex((x) => x.read) + 1;
  let s = null;
  await runHeadless({ ...story, steps: [...story.steps.slice(0, upTo), { wait: 1 }] }, { onSession: (x) => { s = x; } });
  const hero = getEntity(s.state, 'hero');
  const teacher = getEntity(s.state, 'npc:teacher').position;
  const smith = getEntity(s.state, 'npc:smith').position;
  // The hero stands on the other side of the open task of the teacher, so that the way to the smith
  // goes past it.
  const dx = teacher.x - smith.x;
  const dz = teacher.z - smith.z;
  const n = Math.hypot(dx, dz);
  Object.assign(hero.position, { x: teacher.x + (dx / n) * 20, z: teacher.z + (dz / n) * 20 });
  s.command({ type: 'tap', target: { ground: { x: smith.x / 2, y: smith.z / 2, h: 3, thing: false, object: null, goal: true } } });
  for (let i = 0; i < 30 * 90 && !(i > 30 && !hero.route); i++) s.step();
  assert.ok(Math.hypot(hero.position.x - smith.x, hero.position.z - smith.z) / 2 < 3, 'the hero is at the smith');
});

test('the bridge starts with a short talk of the fisher, one new word in each line with its thing shown, and after the guess a line says what comes next (#66)', async () => {
  const story = load('bridge');
  const lines = [];
  const names = [];
  const failures = await runHeadless({ ...story, steps: story.steps.slice(0, 6) }, { onSession: (s) => s.listen((ev) => {
    if (ev.type === 'open' && (ev.screen === 'dialogue' || ev.screen === 'callout')) lines.push(ev.textKey);
    if (ev.type === 'names') names.push([...ev.ids, ...ev.spots.map(() => 'spot')]);
  }) });
  assert.deepEqual(failures, []);
  assert.deepEqual(lines.filter((k) => k.startsWith('dlg.bridge.start')), ['dlg.bridge.start.n1', 'dlg.bridge.start.n2', 'dlg.bridge.start.n3', 'dlg.bridge.start.n4']);
  assert.ok(names.some((n) => n.includes('spot')), 'the gap and the pile glow as places');
  assert.ok(names.some((n) => n.some((id) => String(id).startsWith('guess:'))), 'the pale planks glow');
  assert.ok(lines.indexOf('mentor.bridge.next') > lines.indexOf('dlg.bridge.start.n4'), 'after the guess, the next step');
});

// A tap on a pale row of the bridge and a press at once, while the hero walks there and the button
// still shows an older act: the press makes the guess of that row at the end of the walk (#66).
test('a tap on a pale row of the bridge and a press at once make the guess of that row (#66)', async () => {
  const story = load('bridge');
  let s = null;
  const failures = await runHeadless({ ...story, name: 'guess-at-once', steps: story.steps.slice(0, 4) }, { onSession: (x) => { s = x; } });
  assert.deepEqual(failures, []);
  const guesses = [];
  s.listen((ev) => { if (ev.type === 'guess') guesses.push(ev); });
  s.command({ type: 'tap', target: { guess: { zone: 'bridge-gap', n: 3 } } });
  s.step();
  s.command({ type: 'hands' });
  for (let i = 0; i < 30 * 20 && !guesses.length; i++) {
    s.step();
    s.events();
  }
  assert.equal(guesses.length, 1, 'one guess');
});

// A press during a walk does the act that the button showed at the press, on its target, at the
// end of the walk (#66: Su tapped the healer, the button showed the talk, she pressed during the
// walk, and the press put her on the calf next to the healer).
test('a press during the walk to a person does the act of the picture at the press: the talk, not a ride on the calf on the way (#66)', async () => {
  let s = null;
  const failures = await runHeadless({ ...load('trial-healer'), name: 'press-in-walk', steps: [{ wait: 0.5 }] }, { onSession: (x) => { s = x; } });
  assert.deepEqual(failures, []);
  const healer = getEntity(s.state, 'npc:healer');
  const hero = getEntity(s.state, 'hero');
  const nghe = getEntity(s.state, 'friend:nghe');
  // The hero stands some steps away; the calf stands next to the healer, at the end of the walk.
  Object.assign(hero.position, { x: healer.position.x + 8, z: healer.position.z });
  if (nghe) Object.assign(nghe.position, { x: healer.position.x - 3, y: healer.position.y, z: healer.position.z + 1 });
  s.step();
  s.command({ type: 'tap', target: { person: 'npc:healer' } });
  s.step();
  const a = s.action();
  assert.equal(a?.act, 'talk', `the button shows the talk (${a?.act})`);
  assert.ok(getEntity(s.state, 'hero').route, 'the hero walks');
  s.command({ type: 'hands' });
  for (let i = 0; i < 60 * 30 && !s.screen; i++) s.step();
  assert.ok(!getEntity(s.state, 'hero').riding, 'the hero is not on the calf');
  assert.equal(s.screen, 'dialogue', 'the talk of the healer opens');
});

// The walk of the play test ended stuck, and the healer walked on: the act of the picture cannot be
// done, so the press does nothing (the button pulses); it never puts the hero on the calf.
test('a press during a walk that ends stuck, away from the person, never rides the calf (#66)', async () => {
  let s = null;
  const failures = await runHeadless({ ...load('trial-healer'), name: 'press-in-stuck-walk', steps: [{ wait: 0.5 }] }, { onSession: (x) => { s = x; } });
  assert.deepEqual(failures, []);
  const healer = getEntity(s.state, 'npc:healer');
  const hero = getEntity(s.state, 'hero');
  Object.assign(hero.position, { x: healer.position.x + 8, z: healer.position.z });
  s.step();
  s.command({ type: 'tap', target: { person: 'npc:healer' } });
  s.step();
  assert.equal(s.action()?.act, 'talk');
  s.command({ type: 'hands' });
  // The healer walks on, and the walk of the hero stops where it is.
  Object.assign(healer.position, { x: healer.position.x - 40 });
  const r = getEntity(s.state, 'hero').route;
  if (r) Object.assign(r, { still: 10, last: { x: hero.position.x, z: hero.position.z } });
  for (let i = 0; i < 3 * 30; i++) s.step();
  assert.ok(!getEntity(s.state, 'hero').riding, 'the hero is not on the calf');
});
