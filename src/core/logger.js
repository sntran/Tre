// The logger: the one way into the learning log (src/core/learnlog.js). The scenes and the world
// send events here, never to the log itself. It adds the time and the variant, keeps the session
// that is open, and counts the time of play. No DOM: the time comes from `now`.
import { createLog, logEvent } from './learnlog.js';
import { questState } from './quests.js';
import { conditionState } from './game.js';

const FIRST = new Set(['walk', 'place', 'talk', 'travel', 'menu']);
const AFTER_QUEST_MS = 60000; // a session went on after a quest step when it lasted one more minute

// The steps of the quests that are done (for the quests of a session).
export function questSteps(profile, quests) {
  const state = conditionState(profile);
  return quests.reduce((a, q) => a + Math.max(0, questState(q, state).index), 0);
}

// profile: the profile (the log is profile.log). schema: data/config/learnlog.json. label(): the
// label of the variant. quests: the quests of the story. now(): the time in milliseconds.
// tz: the offset of the local time (minutes). drop: true for a story run or a scripted play (the
// storybook, the headless stories, ?harness in the address): the log drops every event, so that
// the steps of a script never look like a child.
export function createLogger({ profile, schema, label = () => 'base', quests = [], now = () => Date.now(), tz = 0, drop = false }) {
  profile.log ??= createLog(tz);
  const log = profile.log;
  let session = null;

  // Add an event of a kind. Return the event, or null when it does not fit the schema (the game
  // goes on; the log keeps only good events).
  function record(type, fields) {
    if (drop) return null;
    try {
      return logEvent(log, { type, t: now(), variant: label(), ...fields }, schema);
    } catch (e) {
      if (typeof console !== 'undefined') console.warn(e.message);
      return null;
    }
  }

  const playMinutes = () => (log.playMs + (session ? now() - session.start : 0)) / 60000;

  return {
    record,
    // A commit (or a free try) at a task. The time of play is added here.
    attempt(fields) {
      return record('attempt', { play: Math.round(playMinutes() * 10) / 10, ...fields });
    },
    startSession() {
      if (session || drop) return;
      session = { start: now(), steps: questSteps(profile, quests), first: 'none', lastStep: null };
    },
    // The kind of the first action of the session (walk, place, talk, travel, or menu).
    action(kind) {
      if (session && session.first === 'none' && FIRST.has(kind)) session.first = kind;
    },
    // A quest step is done now.
    questStep() {
      if (session) session.lastStep = now();
    },
    // Look for quest steps that are done since the last look (at each save).
    checkQuests() {
      if (!session) return;
      const steps = questSteps(profile, quests);
      if (steps > (session.seen ?? session.steps)) session.lastStep = now();
      session.seen = steps;
    },
    // The end of the session: by the device (the app went to the background), the parent (the
    // time limit), or the child (the child left the game).
    endSession(endedBy, place = null) {
      if (!session) return null;
      const end = now();
      const s = session;
      session = null;
      log.playMs += end - s.start;
      const steps = Math.max(0, questSteps(profile, quests) - s.steps);
      return record('session', {
        start: s.start, end, endedBy, quests: steps, place, afterQuest: s.lastStep !== null && end - s.lastStep >= AFTER_QUEST_MS, first: s.first,
      });
    },
    get open() {
      return Boolean(session);
    },
    playMinutes,
  };
}
