import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { linkIdOf, activityOf, linkOf, visitClock, nextLevel, practiceStart, practiceLinks } from '../src/core/practice.js';
import { createProfile } from '../src/core/profile.js';
import { createSession } from '../src/core/session.js';
import { heroPlace } from '../src/core/world/save.js';
import { serialize, deserialize } from '../src/core/save.js';
import { runHeadless, data } from './story-run.js';
import { load } from './helpers.js';

const practice = load('data/world/practice.json');
const trials = load('data/trials.json').trials;
const vi = load('i18n/vi.json');
const en = load('i18n/en.json');
const story = (name) => load(`tests/stories/${name}.json`);

test('the link holds only the id: a known id, an unknown id, and more parameters', () => {
  assert.equal(linkIdOf('?practice=bo-que'), 'bo-que');
  assert.ok(activityOf(practice, linkIdOf('?practice=bo-que')));
  // An unknown id is no activity (the title screen opens with a short line).
  assert.equal(linkIdOf('?practice=cay-lua-xyz'), 'cay-lua-xyz');
  assert.equal(activityOf(practice, 'cay-lua-xyz'), null);
  // Only the parameter "practice" is read.
  assert.equal(linkIdOf('?name=An&practice=ren-sat&grade=2&story=bridge'), 'ren-sat');
  // A bad id, or no id, is null.
  for (const bad of ['', '?practice=', '?practice=Bo%20Que', '?practice=%3Cb%3E', `?practice=${'a'.repeat(41)}`, '?story=bridge']) assert.equal(linkIdOf(bad), null, bad);
  // The link of an activity has the address of the game and the id, and nothing else.
  assert.equal(linkOf('https://sntran.github.io/Tre/?story=bridge&play#x', 'bo-que'), 'https://sntran.github.io/Tre/?practice=bo-que');
});

test('each activity has its texts, its trial, its skills, its place, and its story', () => {
  const ids = new Set();
  for (const a of practice.activities) {
    assert.match(a.id, /^[a-z0-9][a-z0-9-]{0,39}$/);
    assert.ok(!ids.has(a.id), `${a.id} twice`);
    ids.add(a.id);
    for (const key of [a.titleKey, a.lineKey]) assert.ok(vi[key] && en[key], `${a.id}: ${key}`);
    if (a.task === 'planting') {
      // The planting of Xóm Ruộng (docs/PLANTING.md): the planter, or no person for the whole hamlet.
      assert.ok(a.person === 'planter' || a.person === null, `${a.id}: the person of the planting`);
      assert.deepEqual([...a.skills].sort(), [data.planting.skill, data.planting.divide].sort(), `${a.id}: the skills of the planting`);
    } else if (['ducks', 'traps', 'drum'].includes(a.task)) {
      // An activity of the hamlet (docs/HAMLET.md): the person of its station, and the skill of
      // the memory of the facts.
      assert.equal(a.person, data.hamlet.stations[a.task], `${a.id}: the person of the activity`);
      assert.ok(a.skills.includes(data.planting.skill), `${a.id}: the skills of the activity`);
    } else {
      const def = trials.find((t) => t.id === a.trial);
      assert.ok(def, `${a.id}: trial ${a.trial}`);
      assert.equal(a.person, def.npc, `${a.id}: the person of the trial`);
      assert.deepEqual([...a.skills].sort(), [...new Set(def.levels.map((l) => l.skill))].sort(), `${a.id}: the skills of the trial`);
    }
    assert.ok(Number.isInteger(a.set) && a.set >= 1, `${a.id}: set`);
    assert.equal(a.story, `practice-${a.id}`);
    assert.ok(existsSync(new URL(`./stories/${a.story}.json`, import.meta.url)), `${a.id}: story`);
    assert.equal(story(a.story).practice, a.id);
    // The place is on the plane of a region with a map, near the things of the trial.
    const [frame, x, y] = a.at;
    const [px, py] = data.world.at(frame, x, y);
    assert.ok(data.world.regionOf(frame), `${a.id}: frame ${frame}`);
    assert.ok(Number.isFinite(px) && Number.isFinite(py));
  }
});

test('a visit at night starts at the next morning; a visit in the day starts now', () => {
  const [from] = practice.hours;
  assert.equal(visitClock(540, practice.hours), 540, 'nine in the morning');
  assert.equal(visitClock(1440 + 22 * 60, practice.hours), 2 * 1440 + from * 60, 'ten at night: the next morning');
  assert.equal(visitClock(1440 + 3 * 60, practice.hours), 1440 + from * 60, 'three at night: the morning of the same day');
  assert.equal(visitClock(18 * 60, practice.hours), 1440 + from * 60, 'the dusk, when the people go home');
});

test('the level of the next round goes up with no fail and down with many fails', () => {
  assert.equal(nextLevel(0, { commits: 2, fails: 0 }), 1);
  assert.equal(nextLevel(2, { commits: 3, fails: 0 }), 2, 'the top level stays');
  assert.equal(nextLevel(1, { commits: 2, fails: 1 }), 1, 'one fail in two: the level stays');
  assert.equal(nextLevel(1, { commits: 3, fails: 2 }), 0);
  assert.equal(nextLevel(0, { commits: 4, fails: 4 }), 0, 'the lowest level stays');
});

test('the start of a visit: the place, the place before the visit, and the level of the last visit', () => {
  const a = activityOf(practice, 'bo-que');
  const p = createProfile({ id: 'p', name: 'An', grade: 2, seed: 7 });
  let s = practiceStart(data, p, a);
  assert.equal(s.map, 'giong');
  assert.equal(s.practice.back, null, 'a new profile has no place before the visit');
  assert.equal(s.practice.level, 1, 'the level of the grade');
  p.world.entities.push({ id: 'hero', keep: true, control: true, position: { x: 80, y: 0, z: 60, facing: 0 }, motion: { vx: 0, vz: 0, speed: 0 }, hands: { holds: null }, look: 'hero' });
  p.practice = { 'bo-que': { level: 2, sets: 3 } };
  s = practiceStart(data, p, a);
  assert.deepEqual(s.practice.back, { map: p.world.map, x: 40, y: 30 });
  assert.equal(s.practice.level, 2, 'the level of the last visit');
  // The save keeps the practice, and a bad one does not load.
  assert.deepEqual(deserialize(serialize(p, 0)).practice, p.practice);
  const bad = structuredClone(p);
  bad.practice['bo-que'].level = 'hard';
  assert.throws(() => deserialize(serialize(bad, 0)));
});

test('a device with no profile: the activity at once, with no prologue; "go back" goes to the start of the game', () => {
  const a = activityOf(practice, 'bo-que');
  const profile = createProfile({ id: 'new', name: 'An', grade: 1, seed: 7, now: 0 });
  const session = createSession({ data, profile, now: () => 0 });
  const s = practiceStart(data, profile, a);
  session.start(s.map, { at: s.at, clock: s.clock, practice: s.practice });
  const talks = session.opening().filter((ev) => ev.type === 'open' && ev.screen === 'dialogue');
  assert.equal(talks[0]?.id, 'teacher.trial', 'the person of the activity speaks first');
  assert.ok(!talks.some((ev) => String(ev.id).startsWith('grandma.')), 'no prologue');
  const h = session.heroCell();
  assert.ok(Math.hypot(h.x - s.at.x, h.y - s.at.y) < 3, 'the hero is at the place of the activity');
  assert.ok(session.state.entities.some((e) => e.id === 'friend:nghe'), 'Nghé is there too');
  // The save of a visit keeps no place (the profile had none).
  session.syncSave();
  assert.equal(heroPlace(profile.world).x, null);
});

test('after a set and "go back": the hero is back; P(L), the log with the practice id, and the earnings are saved', async () => {
  let end = null;
  const raw = story('practice-bo-que');
  const failures = await runHeadless(raw, { log: true, onEnd: (x) => { end = x; } });
  assert.deepEqual(failures, []);
  const { profile, logger } = end;
  // The hero is at the place before the visit, in the save too.
  const [bx, by] = data.world.at(...raw.at);
  const place = heroPlace(profile.world);
  assert.ok(Math.hypot(place.x - bx, place.y - by) < 2, `the hero of the save is at ${place.x}, ${place.y}`);
  assert.equal(profile.inventory.coin, 3, 'the reward of the set');
  assert.deepEqual(profile.practice['bo-que'], { level: 2, sets: 1 });
  assert.equal(profile.flags['trial.scholar.done'], undefined, 'the trial of the story stays as it is');
  assert.ok(profile.learning.skills['math.count.120'].p > 0.2, 'P(L) of the skill of the task');
  logger.endSession('child', 'giong');
  const events = profile.log.events;
  assert.ok(events.some((ev) => ev.type === 'attempt' && ev.task === 'trial-scholar'), 'the commits are in the log');
  assert.ok(events.some((ev) => ev.type === 'session' && ev.practice === 'bo-que'), 'the session has the practice id');
});

test('the parent page lists every activity, and each link opens its activity', () => {
  const rows = practiceLinks(practice, 'https://sntran.github.io/Tre/');
  assert.deepEqual(rows.map((r) => r.id), practice.activities.map((a) => a.id));
  for (const r of rows) {
    const a = activityOf(practice, linkIdOf(new URL(r.link).search));
    assert.equal(a?.id, r.id);
    assert.deepEqual(r.skills, a.skills);
  }
});
