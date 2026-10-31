// The folk riddles of the evening and the trick questions of the children (#103): a riddle opens
// only in the evening, near Bà, and never in a task or a raid; a tap on its thing anywhere closes
// it, and a tap on another thing does nothing; the clue and the answer come in their order; a
// trick question waits before its answer and asks nothing back; and each riddle and trick question
// has a source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { createRiddles, answerAt, waveStep } from '../src/core/riddles.js';
import { createLaws } from '../src/core/story.js';

const data = load('data/world/riddles.json');
const vi = load('i18n/vi.json');
const en = load('i18n/en.json');
const map = load('data/maps/phu-dong.json');

test('each riddle and trick question has its lines in both languages, a source to check it against, and no digit', () => {
  assert.equal(data.riddles.length, 10);
  for (const r of data.riddles) {
    for (const k of [`riddle.${r.id}`, `riddle.${r.id}.fit`, `riddle.${r.id}.clue`, `riddle.${r.id}.answer`, `riddle.${r.id}.name`]) assert.ok(vi[k] && en[k], k);
    const src = data.sources[r.source];
    assert.ok(src?.book && src.year, `${r.id}: a published collection`);
    assert.ok(!/https?:/.test(JSON.stringify(src)), `${r.id}: no web page`);
    assert.ok((r.answer.kinds ?? []).length + (r.answer.ids ?? []).length + (r.answer.props ?? []).length > 0);
    // The English line says the riddle, and then one line about the words.
    assert.ok(en[`riddle.${r.id}`].split(/[.?!] /).length >= 2, en[`riddle.${r.id}`]);
  }
  for (const q of data.tricks) {
    assert.ok(vi[`trick.${q.id}`].startsWith('Đố bạn:') && vi[`trick.${q.id}.answer`] && en[`trick.${q.id}`] && en[`trick.${q.id}.answer`], q.id);
    assert.ok(data.sources[q.source]?.book, `${q.id}: a source`);
  }
  // The rule of the world: a riddle can end with a question mark, but it has no digit and no operator.
  const laws = createLaws({ texts: { vi, en }, limits: { maxWalk: 999 } });
  for (const key of [...data.riddles.map((r) => `riddle.${r.id}`), ...data.tricks.map((q) => `trick.${q.id}`)]) assert.deepEqual(laws.text({ type: 'open', screen: 'callout', textKey: key }), [], key);
  assert.equal(laws.text({ type: 'open', screen: 'callout', textKey: 'note.riddles' }).length, 0);
});

test('the thing of each riddle is in Phù Đổng: an animal of the village, Nghé, or a prop of the map', () => {
  const life = load('data/world/life.json').kinds;
  const props = new Set(map.layers.objects.map((o) => o.prop));
  for (const r of data.riddles) {
    const ok = (r.answer.kinds ?? []).some((k) => life[k]) || (r.answer.ids ?? []).length > 0 || (r.answer.props ?? []).some((p) => props.has(p));
    assert.ok(ok, r.id);
  }
});

// A small world for the rules: the hero, Bà, a chicken, and a bamboo clump of the map.
function rig({ minutes = 1030, busy = false } = {}) {
  const world = { entities: [
    { id: 'hero', position: { x: 20, z: 20 } },
    { id: 'npc:grandma', position: { x: 22, z: 20 } },
    { id: 'chicken:1', kind: 'chicken', position: { x: 60, z: 40 } },
    { id: 'dog:1', kind: 'dog', position: { x: 80, z: 40 } },
  ] };
  const said = [];
  const sounds = [];
  const walks = [];
  const profile = {};
  const clock = { day: 0, minutes, busy };
  const r = createRiddles({
    data, profile, world: () => world, map: () => ({ layers: { objects: [{ id: 'bamboo9', prop: 'bamboo', x: 50, y: 50, w: 3, h: 3 }] } }),
    day: () => clock.day, minutes: () => clock.minutes, busy: () => clock.busy,
    say: (id, key) => said.push(`${id} ${key}`), sound: (n) => sounds.push(n), point: () => {}, walkTo: (p) => walks.push(p), rng: () => 0,
  });
  return { r, world, said, sounds, walks, profile, clock, hero: world.entities[0] };
}

test('a riddle opens only in the evening near Bà, one each day, and never while a task or a raid is open', () => {
  const day = rig({ minutes: 600 });
  day.r.tick(STEP);
  assert.equal(day.profile.riddles.open, null, 'not in the morning');
  const busy = rig({ busy: true });
  busy.r.tick(STEP);
  assert.equal(busy.profile.riddles.open, null, 'not in a task');
  const far = rig();
  far.hero.position = { x: 200, z: 200 };
  far.r.tick(STEP);
  assert.equal(far.profile.riddles.open, null, 'not far from Bà');
  const ok = rig();
  ok.r.tick(STEP);
  assert.equal(ok.profile.riddles.open.id, 'ga');
  // The first riddle says how to answer (#139).
  // The riddle and its "how" are one line (#145).
  assert.deepEqual(ok.said, ['npc:grandma riddle.ask.grandma.how']);
  // Found the same evening: no second riddle until the next day.
  ok.r.tap({ x: 60.5, z: 40 });
  ok.r.tick(STEP);
  assert.equal(ok.profile.riddles.open, null);
  ok.clock.day = 1;
  ok.r.tick(STEP);
  assert.equal(ok.profile.riddles.open.id, 'vit');
});

test('a tap on any thing of the kind closes the riddle, also far from Bà; a tap on another thing does nothing', () => {
  const t = rig();
  t.r.tick(STEP);
  assert.equal(t.r.tap({ x: 80, z: 40 }), false, 'the dog is not a chicken');
  assert.equal(t.profile.riddles.open.id, 'ga');
  t.hero.position = { x: 58, z: 40 };
  assert.equal(t.r.tap({ x: 61, z: 41 }), true);
  assert.deepEqual(t.profile.riddles.found.map((f) => [f.id, f.how]), [['ga', 'alone']]);
  assert.ok(t.sounds.includes('bell'));
  // Bà was far: she says how the words fit at the next meeting.
  assert.ok(t.said.includes('hero riddle.later'));
  assert.equal(t.profile.riddles.fit, 'ga');
  t.hero.position = { x: 20, z: 20 };
  t.r.tick(STEP);
  assert.deepEqual(t.said.slice(-2), ['npc:grandma riddle.again', 'npc:grandma riddle.ga.fit']);
  // A prop of the map counts too.
  const b = { riddles: [{ id: 'tre', answer: { props: ['bamboo'] } }] };
  assert.ok(answerAt(b.riddles[0], { x: 102, z: 102 }, { world: { entities: [] }, map: { layers: { objects: [{ id: 'bamboo9', prop: 'bamboo', x: 50, y: 50, w: 3, h: 3 }] } } }));
  assert.equal(answerAt(b.riddles[0], { x: 20, z: 20 }, { world: { entities: [] }, map: { layers: { objects: [{ id: 'bamboo9', prop: 'bamboo', x: 50, y: 50, w: 3, h: 3 }] } } }), null);
});

test('a wave near Bà gives the clue; on a later day, the answer and the walk to the thing, and the record keeps how', () => {
  assert.equal(waveStep({ clue: null }, 0), 'clue');
  assert.equal(waveStep({ clue: 0, told: null }, 0), null);
  assert.equal(waveStep({ clue: 0, told: null }, 1), 'answer');
  const t = rig();
  t.r.tick(STEP);
  assert.ok(t.r.canWave());
  t.r.wave();
  assert.equal(t.said.at(-1), 'npc:grandma riddle.ga.clue');
  t.r.wave();
  assert.equal(t.said.at(-1), 'npc:grandma riddle.ga.clue', 'the same day: the clue again');
  t.clock.day = 1;
  t.r.wave();
  assert.equal(t.said.at(-1), 'npc:grandma riddle.ga.answer');
  assert.deepEqual(t.walks, [{ x: 60, z: 40, id: 'chicken:1' }]);
  t.hero.position = { x: 59, z: 40 };
  t.r.tick(STEP);
  assert.deepEqual(t.profile.riddles.found.map((f) => [f.id, f.how]), [['ga', 'answer']]);
  // With a clue, and found alone after it.
  const c = rig();
  c.r.tick(STEP);
  c.r.wave();
  c.r.tap({ x: 60, z: 40 });
  assert.equal(c.profile.riddles.found[0].how, 'clue');
});

test('a trick question waits before its answer, asks nothing back, and comes at most one time each day from each child', () => {
  const t = rig({ minutes: 600 });
  assert.equal(t.r.child('loco-child', 'npc:loco-child'), true);
  assert.equal(t.said.at(-1), 'npc:loco-child trick.than');
  t.r.tick(data.wait - 0.5);
  assert.equal(t.said.at(-1), 'npc:loco-child trick.than', 'the child waits');
  t.r.tick(0.6);
  assert.equal(t.said.at(-1), 'npc:loco-child trick.than.answer');
  assert.ok(t.sounds.includes('laugh'));
  assert.equal(t.r.child('loco-child', 'npc:loco-child'), false, 'one each day');
  assert.equal(t.r.child('elder', 'npc:elder'), false, 'only a child asks');
  t.clock.day = 1;
  assert.equal(t.r.child('loco-child', 'npc:loco-child'), true);
  assert.equal(t.said.at(-1), 'npc:loco-child trick.trau', 'the next question');
  const b = rig({ busy: true });
  assert.equal(b.r.child('loco-child', 'npc:loco-child'), false, 'not in a folk game or a task');
  // Nothing is recorded as right or wrong.
  assert.equal(JSON.stringify(t.profile.riddles).includes('right'), false);
});

test('in the village at dusk, Bà says the riddle of the evening, and a tap on a chicken finds it', async () => {
  const s = load('tests/stories/trial-fisher.json');
  let session = null;
  const said = [];
  const failures = await runHeadless({ ...s, at: ['phu-dong', 11, 27], clock: 1030, steps: [{ wait: 3 }] }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => { if (e.type === 'open' && e.textKey) said.push(e.textKey); });
    },
  });
  assert.deepEqual(failures, []);
  assert.ok(said.some((k) => k.startsWith('riddle.ask.grandma')), said.join(', '));
  assert.equal(session.profile.riddles.open.id, 'ga');
  assert.ok(session.canWave, 'the wave button shows near Bà');
  const ch = session.state.entities.find((e) => e.kind === 'chicken' && !e.hidden);
  session.command({ type: 'tap', target: { ground: { x: ch.position.x / 2, y: ch.position.z / 2, h: 3, thing: true, object: null } } });
  assert.equal(session.profile.riddles.open, null);
  assert.equal(session.profile.riddles.found[0].id, 'ga');
});

test('in the village, a tap on the hopscotch child on the screen is a tap on the child, and a trick question comes', async () => {
  const { tapTarget, viewCamera, sessionScreen } = await import('../src/world/hit.js');
  const s = load('tests/stories/trick-hopscotch.json');
  let session = null;
  const said = [];
  const failures = await runHeadless(s, { onSession: (x) => { session = x; x.listen((e) => { if (e.type === 'open' && e.textKey) said.push(e.textKey); }); } });
  assert.deepEqual(failures, []);
  const kid = session.state.entities.find((e) => e.id === 'npc:loco-child');
  for (let n = 0; n < 12 && !said.some((k) => /^trick\./.test(k)); n++) {
    const q = { x: kid.position.x / 2, y: kid.position.y / 2, z: kid.position.z / 2 };
    const cam = viewCamera({ focus: q, width: 390, height: 844 });
    const t = tapTarget(cam.project(q.x, q.y + 0.8, q.z), sessionScreen(session, cam));
    assert.equal(t?.person, 'npc:loco-child', JSON.stringify(t));
    session.command({ type: 'tap', target: t });
    for (let i = 0; i < 30; i++) { session.step(); session.events(); }
  }
  assert.ok(said.some((k) => /^trick\./.test(k)), said.join(', '));
});
