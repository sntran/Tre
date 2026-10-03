// The stories: the use paths of the game, as data in tests/stories/. Each story plays headless on
// a session of the village (src/core/session.js) at the fixed step of the world. The laws of the
// world hold on every step: no NaN, no entity outside the map, the hero and the people on free
// ground, the count of the entities under the limit, the save of the world loads back to the
// same world, and no text of the village has a digit, an operator, or a question mark.
// The stories are in three parts (this file and tests/stories-2.test.js, tests/stories-3.test.js),
// so that node:test plays the parts at the same time.
import { storyTests } from './story-run.js';

storyTests(0, 3);
