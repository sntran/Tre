// A star with a face (#62): each star of the story shows the small face of its person, a tap on it
// says where it goes ("Đi tìm bà lang."), and the star of the next step of the story is bigger.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.js';
import { liveTargets, starOf } from '../src/core/quests.js';
import { speakerLook } from '../src/world/portraits.js';

const quests = load('data/quests.json').quests;
const trials = load('data/trials.json').trials;
const figures = load('data/figures.json').figures;
const vi = load('i18n/vi.json');
const en = load('i18n/en.json');
const five = quests.flatMap((q) => q.steps).find((s) => s.id === 'five');

test('the five stars after the talk of the elder: each shows the face of its person, and only the first is the bigger star', () => {
  const live = liveTargets(five, {});
  const stars = live.map((tg, i) => starOf(tg, i, trials));
  assert.deepEqual(stars.map((s) => s.who), ['teacher', 'smith', 'fisher', 'healer', 'woodcutter']);
  assert.deepEqual(stars.map((s) => s.main), [true, false, false, false, false]);
  for (const s of stars) {
    assert.ok(speakerLook(s.who, { figures }), `${s.who}: a face`);
    assert.equal(s.key, 'star.go.person');
  }
  // After the teacher, the next bigger star is the smith.
  const after = liveTargets(five, { 'trial.scholar.done': true }).map((tg, i) => starOf(tg, i, trials));
  assert.equal(after.find((s) => s.main).who, 'smith');
});

test('every person of a star of the story has a face, and a tap on the star says where it goes', () => {
  for (const step of quests.flatMap((q) => q.steps)) {
    const all = step.targets ?? (step.target ? [{ npc: step.target }] : []);
    all.forEach((tg, i) => {
      const s = starOf(tg, i, trials);
      if (s.who) assert.ok(speakerLook(s.who, { figures }), `${step.id}: the face of ${s.who}`);
      assert.ok(vi[s.key] && en[s.key], `${step.id}: the line ${s.key}`);
    });
  }
  assert.equal(vi['star.go.person'].replace('{who}', 'bà lang'), 'Đi tìm bà lang.');
  // A trial on the work place (the bamboo clump of the staffs): the face of its person.
  assert.equal(starOf({ trial: 'staffs' }, 0, trials).who, 'woodcutter');
});
