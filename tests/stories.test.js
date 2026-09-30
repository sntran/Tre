// The stories: the use paths of the game, as data in tests/stories/. Each story plays headless on
// a session of the village (src/core/session.js) at the fixed step of the world. The laws of the
// world hold on every step: no NaN, no entity outside the map, the hero and the people on free
// ground, the count of the entities under the limit, the save of the world loads back to the
// same world, and no text of the village has a digit, an operator, or a question mark.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';

const dir = new URL('./stories/', import.meta.url);
const stories = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));

for (const story of stories) {
  test(`story ${story.name}: ${story.about?.en ?? ''}`, async () => {
    const failures = await runHeadless(story);
    assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  });
}
