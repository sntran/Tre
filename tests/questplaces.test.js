// The star of a step of a quest leads to where the step ends (#51): the place of a step is inside
// a zone of its map that the hero enters (the gate of Văn Miếu), not a wall in the fields.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { load } from './helpers.js';
import { currentGoal } from '../src/core/quests.js';

const quests = load('data/quests.json').quests;

test('the place of each step of a quest is inside a zone of its map that the hero enters', () => {
  let n = 0;
  for (const q of quests) for (const st of q.steps) {
    if (!st.place) continue;
    n++;
    const file = `data/maps/${st.place.map}.json`;
    assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${q.id}/${st.id}: no map ${st.place.map}`);
    const zones = (load(file).layers?.triggers ?? []).filter((z) => z.on === 'enter');
    const { x, y } = st.place;
    const inside = zones.filter((z) => x >= z.x && x < z.x + (z.w ?? 1) && y >= z.y && y < z.y + (z.h ?? 1));
    assert.ok(inside.length, `${q.id}/${st.id}: the place ${x}, ${y} is in no zone of ${st.place.map}`);
  }
  assert.ok(n >= 2);
});

test('after the exam of Văn Miếu, the goal is the teacher at home: the star leads on, until his talk (#51)', () => {
  // All the steps of the story before are done (the flags of their ends).
  const flags = {};
  const add = (d) => {
    for (const f of d?.flags ?? []) flags[f] = true;
    for (const x of d?.any ?? []) add(x);
  };
  for (const q of quests) if (q.id !== 'home') for (const st of q.steps) add(st.done);
  const goal = currentGoal(quests, { flags, grade: 2, inventory: {}, calling: null });
  assert.equal(goal?.quest.id, 'home');
  assert.equal(goal.step.target, 'teacher');
  assert.equal(currentGoal(quests, { flags: { ...flags, 'chapter1.home': true }, grade: 2, inventory: {}, calling: null }), null);
});
