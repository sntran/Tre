// What the child hears and sees, after the play test of #135–#139 (#145): the riddle comes first,
// a roof opens a window around a hidden hero, a new picture of an animal comes only when the child
// sees the animal, Nghé is a buffalo calf at first look, an old woman wears the khăn vấn, the glow
// of a piece that the woodcutter names stays until the next press, and a person calls the child in
// one way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';
import { createVoiceQueue } from '../src/core/bubblevoice.js';
import { createI18n } from '../src/core/i18n.js';
import { heroWindow, fadeFor, WINDOW_WAIT } from '../src/world/fade.js';
import { ngheFine, dogFine } from '../src/world/fine.js';
import { villagerLook } from '../src/core/gen/people.js';
import { createRng } from '../src/core/rng.js';

const vi = createI18n(load('i18n/vi.json'), 'vi');
const en = createI18n(load('i18n/en.json'), 'en');

test('with a busy voice, the riddle stays before its "how": a newer line of the person never takes the place of a line that asks', () => {
  const q = createVoiceQueue();
  // The voice says the line of a star; a greeting and the riddle come in the same moment.
  assert.equal(q.offer({ id: 'npc:mai', key: 'star.go.person', kind: 'line' }, false), 'now');
  q.next(false);
  q.offer({ id: 'npc:grandma', key: 'world.greet.1', kind: 'greet' }, true);
  q.offer({ id: 'npc:grandma', key: 'riddle.ask.grandma.how', kind: 'line' }, true);
  q.offer({ id: 'npc:grandma', key: 'riddle.how.animal', kind: 'line' }, true);
  const heard = [];
  for (let line = q.next(false); line; line = q.next(false)) heard.push(line.key);
  assert.ok(heard.indexOf('riddle.ask.grandma.how') >= 0, heard.join(', '));
  assert.ok(heard.indexOf('riddle.ask.grandma.how') < Math.max(heard.indexOf('riddle.how.animal'), heard.length), heard.join(', '));
  // The riddle and its "how" are one line.
  assert.equal(vi.t('riddle.ask.grandma.how', { riddle: { key: 'riddle.ga' }, how: { key: 'riddle.how.animal' } }).endsWith('Cháu đoán ra thì đi tìm con vật đó, rồi chạm vào nó nhé.'), true);
});

test('a roof opens a window around a hero that it covers for more than a moment, and closes it when the hero comes out', () => {
  let w = { t: 0, open: false };
  for (let t = 0; t < WINDOW_WAIT - 0.2; t += 0.2) w = heroWindow(w, true, 0.2);
  assert.equal(w.open, false, 'not at once');
  w = heroWindow(w, true, 0.4);
  assert.equal(w.open, true, 'after about one second');
  // The hero as a point of the work: the building fades only around the lines of sight (local).
  const hero = { x: 0, y: 0, z: 0, work: true };
  const f = fadeFor(true, [hero], () => true);
  assert.deepEqual(f, { hit: true, full: true, local: true });
  w = heroWindow(w, false, 0.2);
  assert.equal(w.open, false, 'the window closes when the hero comes out');
});

test('no new picture of an animal while a house covers it; the picture comes when the child sees it, with a ring under it', async () => {
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
  let session = null;
  const cards = [];
  await runHeadless({ name: 'see-145', profile, clock: 600, at: ['phu-dong', 40, 60], steps: [{ wait: 0.5 }] }, {
    onSession: (s) => {
      session = s;
      s.listen((e) => { if (e.type === 'notebook' && e.from) cards.push(e); });
    },
  });
  const hero = getEntity(session.state, 'hero');
  const dog = session.state.entities.find((e) => e.kind === 'dog' && e.position);
  assert.ok(dog, 'a dog');
  const hold = (p) => {
    for (let i = 0; i < 60; i++) {
      Object.assign(dog.position, p);
      delete dog.route;
      session.step();
      session.events();
    }
  };
  // A house near the hero: the dog in the middle of it is under its roof.
  const hp = hero.position;
  const house = session.terrain.objects.filter((o) => ['house', 'hut', 'dinh', 'school'].includes(o.kind) && !o.gone)
    .sort((a, b) => Math.hypot(a.x + a.w / 2 - hp.x / 2, a.y + a.h / 2 - hp.z / 2) - Math.hypot(b.x + b.w / 2 - hp.x / 2, b.y + b.h / 2 - hp.z / 2))[0];
  assert.ok(house, 'a house');
  const inside = { x: (house.x + house.w / 2) * 2, y: hp.y, z: (house.y + house.h / 2) * 2 };
  Object.assign(hero.position, { x: inside.x + 1, z: inside.z + house.h + 3 });
  delete hero.route;
  hold(inside);
  assert.equal(cards.filter((c) => c.from === dog.id).length, 0, 'no card while the house covers the dog');
  hold({ x: hero.position.x + 2, y: hero.position.y, z: hero.position.z + 2 });
  assert.ok(cards.some((c) => c.from === dog.id), 'the card when the child sees the dog');
  assert.ok(query(session.state, 'noteRing').some((m) => m.id === `mark:note:${dog.id}`), 'a ring under the dog');
});

test('Nghé is a buffalo calf at first look: wide horns, a broad head, a heavy body on short legs; the dog has none of them', () => {
  const n = ngheFine();
  const d = dogFine();
  const part = (f, name) => f.parts.find((p) => p.name === name);
  const horns = n.parts.filter((p) => /^horn/.test(p.name));
  assert.ok(horns.length >= 6, 'horns');
  const reach = Math.max(...horns.map((p) => Math.abs(p.at[0]) + p.size[0] / 2));
  const skull = part(n, 'skull');
  assert.ok(reach >= skull.size[0] / 2 + 1.2, `the horns go ${reach} out, the head is ${skull.size[0]} wide`);
  assert.ok(!d.parts.some((p) => /^horn/.test(p.name)), 'the dog has no horns');
  // Wider than the dog in the world (scale), and low on its legs.
  const width = (f) => Math.max(...f.parts.filter((p) => /^trunk/.test(p.name)).map((p) => p.size[0])) * f.scale;
  assert.ok(width(n) >= 1.8 * width(d), `Nghé ${width(n).toFixed(2)}, the dog ${width(d).toFixed(2)}`);
  const legLen = (f) => (part(f, 'legFL').size[1] + part(f, 'shinFL').size[1]);
  assert.ok(legLen(n) / part(n, 'trunk').size[1] < legLen(d) / part(d, 'trunk').size[1], 'shorter legs for the body than the dog');
});

test('an old woman wears the khăn vấn: bà lang, the grandma, and the old women of the hamlets', () => {
  const figures = load('data/figures.json');
  for (const id of ['healer', 'grandma']) assert.equal(figures.figures[id].hat, 'van', id);
  const rng = createRng('old-women');
  let old = 0;
  for (let i = 0; i < 400; i++) {
    const v = villagerLook(rng, figures.villagers);
    if (v.hair === 'grey' && v.bottomKind === 'skirt' && !['non', 'band'].includes(v.hat)) {
      old += 1;
      assert.equal(v.hat, 'van');
    }
  }
  assert.ok(old > 0);
});

test('the shared lines of the mentors match the address of each person: the woodcutter says "em"', () => {
  const npcs = load('data/npcs.json').npcs;
  const mentors = load('data/world/mentors.json');
  const viDict = load('i18n/vi.json');
  assert.equal(npcs.woodcutter.address, 'em');
  for (const [id, n] of Object.entries(npcs)) {
    if (!n.address) continue;
    for (const k of mentors.addressLines[n.address]) {
      for (const i18n of [vi, en]) assert.ok(i18n.has(`${k}.${n.address}`), `${k}.${n.address}`);
      assert.ok(!/cháu/i.test(viDict[`${k}.${n.address}`]), `${id}: ${k}`);
    }
  }
  // The own lines of the woodcutter never say "cháu".
  for (const [k, v] of Object.entries(viDict)) if (/^(mentor\.woodcutter|woodcutter)\./.test(k)) assert.ok(!/cháu/i.test(v), `${k}: "${v}"`);
  assert.equal(vi.t('mentor.first.you.em'), 'Giờ đến lượt em.');
});

test('at the woodcutter, the glow of the piece that he names stays until the next press', async () => {
  const s0 = load('tests/stories/woodcutter-long.json');
  const upto = s0.steps.findIndex((x) => x.until?.with?.key === 'woodcutter.long');
  let session = null;
  const failures = await runHeadless({ ...s0, steps: s0.steps.slice(0, upto + 1) }, { onSession: (x) => { session = x; } });
  assert.deepEqual(failures, []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  run(1);
  assert.ok(query(session.state, 'untilPress').length, 'the glow of the piece');
  run(12);
  assert.ok(query(session.state, 'untilPress').length, 'the glow stays after the line');
  session.command({ type: 'hands', id: session.action()?.id ?? null });
  run(0.2);
  assert.equal(query(session.state, 'untilPress').length, 0, 'the glow goes at the next press');
  assert.equal(vi.t('woodcutter.longer.many', { n: { key: 'num.2' } }), 'Khúc này dài hơn hai khúc kia.');
});
