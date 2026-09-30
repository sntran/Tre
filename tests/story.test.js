// The parts of the stories: the profile of a story, the targets of the taps, each kind of step,
// each kind of fact, and the laws of the world (src/core/story.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storyProfile, tapTarget, checkFact, createLaws, STORY_EPOCH } from '../src/core/story.js';
import { createSession } from '../src/core/session.js';
import { getEntity, query } from '../src/core/world/state.js';
import { runHeadless, data } from './story-run.js';
import { load } from './helpers.js';

const texts = { vi: load('i18n/vi.json'), en: load('i18n/en.json') };
const limits = load('data/config/limits.json');

function sessionOf(story) {
  const session = createSession({ data, profile: storyProfile(story) });
  session.start();
  return session;
}

test('the profile of a story: the flags, the things, the party, the place, the clock, and the time of play', () => {
  const p = storyProfile({ name: 't', profile: { grade: 3, seed: 5, flags: { 'intro.seen': true }, items: { coin: 4 }, timeLimit: 20, played: 19 }, map: 'soc-son', clock: 700, place: [30, 40] });
  assert.equal(p.grade, 3);
  assert.equal(p.flags['intro.seen'], true);
  assert.equal(p.flags['friend.nghe'], true, 'Nghé is a friend from the start');
  assert.equal(p.inventory.coin, 4);
  assert.equal(p.settings.timeLimit, 20);
  assert.equal(p.time.usedMs, 19 * 60000);
  assert.equal(p.world.map, 'soc-son');
  assert.equal(p.world.clock.minutes, 700);
  const hero = p.world.entities.find((e) => e.id === 'hero');
  assert.deepEqual([hero.position.x, hero.position.z], [60, 80]);
  // With no place, the hero starts at the spawn of the map.
  const s = sessionOf({ name: 'u', profile: { flags: { 'intro.seen': true } }, map: 'phu-dong' });
  const c = s.heroCell();
  assert.deepEqual([Math.floor(c.x), Math.floor(c.y)], [Math.floor(s.map.spawn.x), Math.floor(s.map.spawn.y)]);
});

test('the targets of the taps: a cell, a person, a plank of a size, a plank outline, the gap, the last plank, and the hero', () => {
  const s = sessionOf({ name: 't', profile: { flags: { 'intro.seen': true } }, map: 'phu-dong', clock: 540, place: [46, 61] });
  s.step();
  assert.ok(tapTarget(s, { cell: [40, 58] }).target.ground);
  assert.deepEqual(tapTarget(s, { entity: 'npc:fisher' }).target, { person: 'npc:fisher' });
  const plank = tapTarget(s, { plank: 4 });
  assert.equal(getEntity(s.state, plank.target.thing).item.size, 4);
  assert.equal(tapTarget(s, { plank: 9 }), null, 'no plank of that size');
  assert.deepEqual(tapTarget(s, { guess: 2 }).target, { guess: { zone: 'bridge-gap', n: 2 } });
  const gap = tapTarget(s, { zone: 'bridge-gap' });
  assert.ok(gap.target.ground && gap.point.y >= 66);
  assert.equal(tapTarget(s, { span: 'bridge-gap' }), null, 'no plank on the gap yet');
  assert.deepEqual(tapTarget(s, { hero: true }).target, { hero: true });
});

test('each kind of fact: true and false', () => {
  const s = sessionOf({ name: 't', profile: { flags: { 'intro.seen': true }, items: { coin: 2 } }, map: 'phu-dong', clock: 600, place: [46, 61] });
  s.step();
  const ctx = { session: s, events: [{ type: 'open', screen: 'callout', textKey: 'world.greet.1' }, { type: 'skill', skill: 'math.add.20', solved: true, parts: [4, 4, 4] }], learner: { entry: () => ({ p: 0.6 }) }, data };
  const ok = (fact) => assert.equal(checkFact(fact, ctx), null, JSON.stringify(fact));
  const no = (fact) => assert.equal(typeof checkFact(fact, ctx), 'string', JSON.stringify(fact));
  ok({ hero: { map: 'phu-dong', cell: [46, 61], holding: false, falls: false, riding: false } });
  no({ hero: { in: 'water' } });
  ok({ hero: { in: 'path' } });
  no({ hero: { near: 'npc:grandma', within: 3 } });
  ok({ entity: 'friend:nghe', near: 'hero', within: 4 });
  no({ entity: 'nobody' });
  ok({ entity: 'nobody', gone: true });
  no({ entity: 'friend:nghe', gone: true });
  ok({ event: 'skill', with: { solved: true, parts: [4, 4, 4] } });
  no({ event: 'skill', with: { solved: false } });
  ok({ event: 'tip', not: true });
  ok({ flag: 'intro.seen' });
  no({ flag: 'prologue.done' });
  ok({ flag: 'prologue.done', is: false });
  ok({ item: 'coin', count: 2 });
  no({ item: 'coin', count: '>= 3' });
  ok({ learner: { skill: 'math.add.20', pL: '>= 0.5' } });
  no({ learner: { skill: 'math.add.20', pL: '> 0.9' } });
  ok({ clock: { between: [9.9, 10.1] } });
  no({ clock: { between: [11, 12] } });
  ok({ zone: 'bridge-gap', state: 'open', round: 0, planks: 0, gap: 12 });
  no({ zone: 'bridge-gap', state: 'solid' });
  ok({ ford: 'open' });
  no({ ford: 'closed' });
  ok({ text: { shown: 'world.greet.1' } });
  no({ text: { shown: 'world.greet.2' } });
  ok({ screen: null });
  ok({ count: { entities: 'chicken', min: 3 } });
  no({ count: { entities: 'chicken', max: 1 } });
  ok({ all: { of: 'people', near: 'spot', within: 40 } });
  no({ all: { of: 'people', hidden: true } });
  no({ nothing: 1 });
});

test('the laws: a text of the world with a digit, an operator, or a question mark breaks the rule of the world', () => {
  const laws = createLaws({ texts: { vi: { a: 'Chào {name}', b: 'Mấy cái?', c: 'Một cộng một = hai', d: '{n} con gà' }, en: { a: 'Hello, {name}', b: 'How many', c: 'One', d: '{n} chickens' } }, limits });
  assert.deepEqual(laws.text({ type: 'open', screen: 'callout', textKey: 'a' }, { name: 'An' }), []);
  assert.equal(laws.text({ type: 'open', screen: 'say', textKey: 'b' }).length, 1, 'a question mark');
  assert.equal(laws.text({ type: 'open', screen: 'say', textKey: 'c' }).length, 1, 'an operator');
  assert.equal(laws.text({ type: 'open', screen: 'say', textKey: 'd', params: { n: 3 } }).length, 2, 'a digit from a value, in each language');
  assert.equal(laws.text({ type: 'open', screen: 'dialogue', textKey: 'a', choices: ['b'] }).length, 1, 'the choices too');
  assert.deepEqual(laws.text({ type: 'hud' }), []);
  // A fact of history keeps its year, and a place name is not checked.
  const more = createLaws({ texts: { vi: { 'history.x': 'Năm 2010', e: 'Ở {place}', 'place.km': 'Km 5' }, en: { 'history.x': 'In 2010', e: 'At {place}', 'place.km': 'Km 5' } }, limits });
  assert.deepEqual(more.text({ type: 'open', screen: 'say', textKey: 'history.x', mark: null }), []);
  assert.deepEqual(more.text({ type: 'open', screen: 'say', textKey: 'e', params: { place: { key: 'place.km' } } }), []);
  // All the texts of the talks of the game keep the rule.
  const all = createLaws({ texts, limits });
  const bad = [...data.dialogues.values()].flatMap((d) => Object.values(d.nodes).flatMap((n) => all.text({ type: 'open', textKey: n.textKey, choices: (n.choices ?? []).map((c) => c.textKey) }, { name: 'An', trials: 0, iron: 0 })));
  assert.deepEqual(bad, []);
});

test('the laws: no NaN, nothing outside the map, nobody in a blocked cell or deep water, the limit, and the save', () => {
  const laws = createLaws({ texts, limits });
  const s = sessionOf({ name: 't', profile: { flags: { 'intro.seen': true } }, map: 'phu-dong', clock: 540, place: [46, 61] });
  s.step();
  assert.deepEqual(laws.step(s), []);
  const hero = getEntity(s.state, 'hero');
  const at = { ...hero.position };
  hero.position.x = NaN;
  assert.match(laws.step(s).join(), /not a number/);
  Object.assign(hero.position, at, { x: -4 });
  assert.match(laws.step(s).join(), /outside the map/);
  Object.assign(hero.position, at, { x: 30 * 2 + 1, z: 70 * 2 + 1 });
  assert.match(laws.step(s).join(), /deep water/);
  hero.fall = { t: 0 };
  assert.deepEqual(laws.step(s), [], 'a hero who falls may be in the water');
  delete hero.fall;
  Object.assign(hero.position, at);
  const tight = createLaws({ texts, limits: { entities: 10 } });
  assert.match(tight.step(s).join(), /more than 10/);
  // A person in a house.
  const person = query(s.state, 'person').find((p) => !p.hidden);
  const blocked = { x: 45, y: 70 };
  assert.ok(s.tileMap.isBlocked(blocked.x, blocked.y));
  Object.assign(person.position, { x: blocked.x * 2 + 1, z: blocked.y * 2 + 1 });
  assert.match(laws.step(s).join(), /blocked cell/);
});

test('each kind of step: do, wait, until, at, tap, read, reload, and expect; a failure names the step', async () => {
  let session = null;
  const story = {
    name: 'steps',
    profile: { flags: {} },
    map: 'phu-dong',
    clock: 540,
    steps: [
      { expect: [{ screen: 'dialogue' }] },
      { read: true },
      { do: { type: 'closed' } },
      { wait: 0.5 },
      { at: { hour: 9.2 } },
      { expect: [{ clock: { between: [9.19, 9.25] } }] },
      { tap: { entity: 'npc:grandma' } },
      { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 30 } },
      { read: true },
      { reload: true },
      { expect: [{ flag: 'intro.seen' }, { screen: null }] },
      { until: { event: 'solid', timeout: 0.2 } },
      { expect: [{ flag: 'prologue.done' }] },
      { tap: { plank: 99 } },
      { jump: true },
    ],
  };
  const failures = await runHeadless(story, { onSession: (s) => { session = s; } });
  assert.ok(session);
  assert.deepEqual(failures.map((f) => f.step), [11, 12, 13, 14]);
  assert.match(failures[0].message, /no event solid/);
  assert.match(failures[1].message, /prologue.done/);
  assert.match(failures[2].message, /nothing to tap/);
  assert.match(failures[3].message, /unknown step/);
  assert.ok(STORY_EPOCH > 0);
});

test('the page of the stories lists each story with its about lines and a link to play it', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const page = readFileSync(new URL('../docs/reference/stories.html', import.meta.url), 'utf8');
  const dir = new URL('./stories/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const story = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    assert.equal(`${story.name}.json`, f, 'the name of a story is the name of its file');
    assert.ok(story.about?.vi && story.about?.en, `${story.name} has an about line in both languages`);
    assert.ok(page.includes(`?story=${story.name}&amp;play`), `the page links ${story.name} (run tools/stories.py)`);
    assert.ok(page.includes(story.about.en.replaceAll('&', '&amp;')), `the page has the about line of ${story.name} (run tools/stories.py)`);
  }
});

test('the tap targets of the trials: a thing, the first thing of a kind, a place on the stem, a place on the line, and a zone of a task', () => {
  const s = sessionOf({ name: 't', profile: { grade: 1, flags: { 'intro.seen': true, 'prologue.started': true } }, map: 'phu-dong', clock: 540, place: [50, 8] });
  for (const id of ['scholar', 'fisher', 'woodcutter', 'healer']) s.startTrial(id);
  s.step();
  assert.deepEqual(tapTarget(s, { thing: 'band:scholar' }).target, { thing: 'band:scholar' });
  assert.equal(getEntity(s.state, tapTarget(s, { item: 'rod' }).target.thing).item.kind, 'rod');
  assert.equal(getEntity(s.state, tapTarget(s, { item: 'herb-rauma' }).target.thing).item.kind, 'herb-rauma');
  assert.equal(tapTarget(s, { item: 'sticks' }), null, 'no sticks before the cut');
  assert.deepEqual(tapTarget(s, { stem: 4 }).target, { thing: 'stem:woodcutter', along: 4 });
  const line = tapTarget(s, { line: 8 });
  const z = getEntity(s.state, 'zone:line').zone;
  assert.equal(line.target.ground.x * 2, z.x + 8);
  const basket = tapTarget(s, { zone: 'basket' }).target.ground;
  const r = getEntity(s.state, 'zone:basket').zone.rect;
  assert.ok(basket.x * 2 > r.x0 && basket.x * 2 < r.x1, 'the middle of the zone');
});

test('the repeat step plays its steps again and again', async () => {
  let session = null;
  const story = {
    name: 'repeat',
    profile: { grade: 1, flags: { 'intro.seen': true, 'prologue.started': true } },
    map: 'phu-dong',
    clock: 540,
    place: [54, 27],
    steps: [
      { do: { type: 'talk', dialogue: 'teacher.trial' } },
      { read: true },
      { repeat: 3, steps: [{ tap: { item: 'rod' } }, { until: { event: 'add', timeout: 10 } }] },
      { expect: [{ event: 'add' }] },
    ],
  };
  const failures = await runHeadless(story, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  assert.equal(getEntity(session.state, 'zone:mat').zone.items.length, 3);
});
