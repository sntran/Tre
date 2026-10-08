// The growth of the hero (#8): experience from deeds in the world, never from questions, and a
// bamboo in the HUD that grows one section for each level (src/core/growth.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { XP, DEEDS, levelOf, stepOf, addXp, questSteps } from '../src/core/growth.js';
import { doneSteps } from '../src/core/quests.js';
import { createProfile } from '../src/core/profile.js';
import { serialize, deserialize } from '../src/core/save.js';
import { load } from './helpers.js';

test('the level rule: level 1 at the start, each level needs 10 more than the last', () => {
  assert.deepEqual(levelOf(0), { level: 1, into: 0, need: 20 });
  assert.deepEqual(levelOf(19), { level: 1, into: 19, need: 20 });
  assert.deepEqual(levelOf(20), { level: 2, into: 0, need: 30 });
  assert.deepEqual(levelOf(50), { level: 3, into: 0, need: 40 });
  assert.equal(levelOf(-5).level, 1);
  assert.deepEqual([1, 2, 3, 4].map(stepOf), [20, 30, 40, 50]);
  // The level never goes down when experience comes.
  let last = 1;
  for (let xp = 0; xp < 2000; xp += 7) {
    const { level } = levelOf(xp);
    assert.ok(level >= last);
    last = level;
  }
});

test('experience comes from tasks, raids, steps of quests, rounds, and events, never from a question', () => {
  assert.deepEqual([...DEEDS].sort(), ['event', 'quest', 'raid', 'round', 'task']);
  const p = createProfile({ id: 'a', name: 'An' });
  assert.equal(addXp(p, 'question'), null);
  assert.equal(addXp(p, 'exam'), null);
  assert.equal(p.growth?.xp ?? 0, 0);
  const r = addXp(p, 'task');
  assert.equal(r.xp, XP.task);
  assert.equal(r.up, false);
  const up = addXp(p, 'raid');
  assert.equal(up.level, 2, 'a task and a raid give the second section of the bamboo');
  assert.equal(up.up, true);
});

test('each done step of a quest gives experience one time; an old save gets none for its old steps', () => {
  const p = createProfile({ id: 'a', name: 'An' });
  assert.equal(questSteps(p, 4), null, 'the first count of an old save gives none');
  assert.equal(questSteps(p, 4), null);
  assert.equal(questSteps(p, 6).xp, 2 * XP.quest);
  assert.equal(questSteps(p, 6), null);
  // The real quests: a new profile has no done steps; the flags of the prologue make some.
  const quests = load('data/quests.json').quests;
  assert.equal(doneSteps(quests, { flags: {}, inventory: {} }), 0);
  assert.ok(doneSteps(quests, { flags: { 'prologue.started': true }, inventory: {} }) >= 1);
});

test('the growth saves with the profile and loads back', () => {
  const p = createProfile({ id: 'a', name: 'An' });
  addXp(p, 'task', 3);
  questSteps(p, 2);
  const back = deserialize(serialize(p));
  assert.deepEqual(back.growth, { xp: 30, steps: 2 });
  assert.throws(() => deserialize(serialize({ ...p, growth: { xp: -1 } })));
});
