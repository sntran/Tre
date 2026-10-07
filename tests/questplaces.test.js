// The star of a step of a quest leads to where the step ends (#51): the place of a step is inside
// a zone of its map that the hero enters (the gate of Văn Miếu), not a wall in the fields.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { load } from './helpers.js';

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
