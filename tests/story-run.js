// Play a story headless on a session of the village, as tests/stories.test.js does. The laws of
// the world run on every step (src/core/story.js).
import { createSession } from '../src/core/session.js';
import { storyProfile, playStory, createLaws, STORY_EPOCH, STEP } from '../src/core/story.js';
import { createSkillGraph } from '../src/core/skills.js';
import { createLearner } from '../src/core/learner.js';
import { createLogger } from '../src/core/logger.js';
import { createRng } from '../src/core/rng.js';
import { serialize, deserialize } from '../src/core/save.js';
import { saveWorld } from '../src/core/world/save.js';
import { addPoint, restorePoint, whereOf } from '../src/core/restore.js';
import { buildTerrain } from '../src/world/terrain.js';
import { loadGameData, load } from './helpers.js';

const data = await loadGameData();
const graph = createSkillGraph(data.skills);
const laws = createLaws({ texts: { vi: load('i18n/vi.json'), en: load('i18n/en.json') }, limits: load('data/config/limits.json') });
const terrains = new Map();
const terrainOf = (map, tileMap) => {
  const key = map.key ?? map.id; // one terrain for each map and seed
  if (!terrains.has(key) || terrains.get(key).edited) terrains.set(key, buildTerrain(map, data.tiles.types, tileMap, data.blocks));
  return terrains.get(key);
};

// Play a story headless. Return the failures of the steps and of the laws.
export async function runHeadless(story, { onSession = null } = {}) {
  let elapsed = 0;
  const now = () => STORY_EPOCH + elapsed * 1000;
  let profile = storyProfile(story);
  let learner = null;
  let logger = null;
  let session = null;
  // The record of the profile in the store of the device (src/ui/storage.js): the current save and
  // the restore points of the dawns.
  let record = { id: profile.id, text: '', points: [] };
  const store = (reason) => {
    session.syncSave();
    const text = serialize(profile, now());
    record = { ...record, text };
    if (reason === 'dawn') record = addPoint(record, { text, ...whereOf(profile), at: now() });
  };
  const broken = new Map(); // a law message -> the first step where it broke
  let current = -1;
  const breakLaw = (message) => {
    if (!broken.has(message)) broken.set(message, current);
  };
  const textParams = () => ({ name: profile.hero.name, trials: 0, iron: profile.inventory.iron ?? 0 });

  function begin() {
    const bank = data.questions.questions;
    learner = createLearner({ graph, config: data.learning, learning: profile.learning, grade: profile.grade, rng: createRng(`${profile.seed}:story`), bank, lang: profile.settings.lang, clock: now });
    logger = createLogger({ profile, schema: data.learnlog, quests: data.quests.quests, now, drop: true });
    const log = (kind, fields = {}) => {
      if (kind === 'attempt') return logger.attempt(fields);
      if (kind === 'action') return logger.action(fields.kind);
      if (kind === 'questStep') return logger.questStep();
      return logger.record(kind, fields);
    };
    session = createSession({ data, profile, learner: () => learner, log, save: store, now, terrainOf });
    session.listen((ev) => {
      for (const p of laws.text(ev, textParams())) breakLaw(`a text of the world: ${p}`);
    });
    session.start();
    logger.startSession();
    onSession?.(session);
  }
  begin();

  const io = {
    session: () => session,
    learner: () => learner,
    data,
    onStep: (i) => {
      current = i;
    },
    async advance(seconds, until) {
      const n = Math.ceil(seconds / STEP);
      for (let k = 0; k < n; k++) {
        session.step();
        elapsed += STEP;
        session.events();
        for (const p of laws.step(session)) breakLaw(p);
        if (until?.()) return true;
      }
      return !until;
    },
    async send(cmd) {
      session.command(cmd);
      session.events();
    },
    async restore(index) {
      // The parent area saves the open game first; its save becomes a point in place of the chosen one.
      store('restore');
      if (!record.points[index]) return `no restore point ${index}`;
      record = restorePoint(record, index, whereOf(profile), now());
      profile = deserialize(record.text);
      begin();
      return null;
    },
    points: () => record.points.map(({ day, era, at, before = false }) => ({ day, era, at, before })),
    async reload() {
      session.syncSave();
      const before = saveWorld(session.state);
      profile = deserialize(serialize(profile, now()));
      begin();
      const after = saveWorld(session.state);
      return JSON.stringify(after) === JSON.stringify(before) ? null : 'the loaded world is not the same as the saved world';
    },
  };
  const failures = await playStory(story, io);
  // At the end: the whole profile saves and loads back.
  session.syncSave();
  const again = deserialize(serialize(profile, now()));
  if (JSON.stringify(again.world) !== JSON.stringify(profile.world)) breakLaw('the save of the profile does not load back to the same world');
  for (const [message, step] of broken) failures.push({ step, message: `law: ${message}` });
  return failures;
}

export { data };
