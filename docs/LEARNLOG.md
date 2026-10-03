# The learning log, the experiments, and the researcher view

This file tells how Tre keeps the data that finds out what works. `docs/DESIGN.md` ("Learning measurement: how Tre finds out what works", and the rules 19 to 25) is the source of truth; the research behind it is in `docs/research/learning-by-doing.md`.

## The log

The log is `profile.log`, next to the save. It is plain data: `src/core/learnlog.js` has the pure functions, and `data/config/learnlog.json` has the schema.

| Field | What it holds |
| --- | --- |
| `v` | The version of the log. |
| `tz` | The offset of the local time of the device (minutes), for the days. |
| `first` | The first day of the log (whole days since 1970). |
| `day` | The day of the raw events. |
| `events` | The raw events of that day. |
| `rollups` | `{ [variant]: roll-up }` for the days before. |
| `playMs` | The time of play of all sessions. |

At the first event of a new day, the raw events of the day before roll up into the roll-ups, and they go. The roll-up of a day gives the same numbers as the raw events; a test checks it.

A story run (the storybook in the browser and the headless stories) and a scripted play (`?harness` in the address) are not a child: their logger (`createLogger` with `drop`) drops every event, so that the fast steps of a script never show as mashing or as short hints.

### The events

Each event has `type`, `t` (the time), and `variant`, and the fields of its kind. Only numbers, times, short ids from the data of the game, words from a list, and lists of numbers. No name, no free text, no picture, and no device information. `checkEvent` checks each event against the schema; the logger keeps only good events, and the save checks the log again.

| Kind | Fields | Sent by |
| --- | --- | --- |
| `attempt` | task, skill, phase (explore or commit), success, efficient, first, mashing, parts, resets, latencies, hint, hintSeen, pBefore, pAfter, play, retry, harder, map | the village, for each skill event of a commit on the bridge |
| `session` | start, end, endedBy (device, parent, or child), quests, place, afterQuest, first (the first action), practice (the id of the activity of a practice link, or null) | the app, at the end of a session |
| `review` | skill, due, gap (days since the last practice), result | the learner, for an answer for a mastered skill that is due |
| `exam` | skill, correct, p (P(L) before the answer) | Văn Miếu, for each exam item |
| `prediction` | task, gap, guess (null when skipped), used, solved | the village, at the first commit on a gap |
| `help` | task, diagnosis, move, pBefore, success, efficient (the next commit after the move) | the session, at the commit after a move of the mentor of a task (`docs/MENTOR.md`) |
| `check` | task, changed (a part put or taken back after the check, before the commit: a self-correction) | the session, at the commit after the check |
| `ask` | task, when (before or after a try), move | the session, when the child waves for help |
| `carry` | task, size (the size of the load, such as a tray of three or five bowls), seconds (the walk from the pick-up to the put) | the village, when a load of rice goes into the pot |

The scenes never write the log. They call `ctx.log(kind, fields)`, the one way in (`src/core/logger.js`). The logger adds the time and the variant, keeps the open session, and counts the time of play.

A **session** starts in a scene of play (the village, a battle, Văn Miếu) and ends at the title (the child left), at the rest screen (the time limit of the parent), or when the page goes to the background (the device). `quests` counts the quest steps that were done in the session, and `afterQuest` is true when the play went on for one more minute after a quest step.

**Mashing** (rule 22) is computed in the log module (`isMashing`) from the latencies, the pause after a failure, and a sweep of sizes at one place. The attempt carries the flag.

### The nine questions

One pure function for each question of the table "What good means" in the design, on the roll-ups (`QUESTIONS` in `src/core/learnlog.js`):

| Question | Function | What it gives |
| --- | --- | --- |
| Does the child learn? | `qLearn` | for each skill: the commits, the time of play to mastery, the success of the last ten commits, and the curve of each day |
| Does it stay? | `qStay` | success on reviews after about 7, 14, and 30 days |
| Does it transfer? | `qTransfer` | the correlation of P(L) with the exam items |
| Is the difficulty right? | `qDifficulty` | first-try success against the band of rule 15, and the choices of the harder version |
| Do predictions help? | `qPredict` | the predictions, the skips, the mean miss over the days, and the time to mastery in each variant |
| Do hints help or replace? | `qHints` | success after each hint level, hints seen for less than one second, and the time to mastery in each variant |
| Is the child playing or mashing? | `qMashing` | the share of commits with the signs of mashing, and the success of the commit after one |
| Does the child want to come back? | `qComeBack` | sessions, sessions each week, retries after a success, play after a quest step, and where sessions stop |
| Is the session length right? | `qSessions` | the length, the lengths in buckets, who ended the session, and the first action |

## The experiments

`data/config/experiments.json` names the experiments and their variants; each variant gives the values of its switches. The field `active` names at most one experiment; now it is `null`, so every profile has the defaults and the label `base`. `src/core/experiments.js` is the one place where the code reads a switch: the code asks for the value of a switch (`value('predict')`), never for a variant.

| Experiment | Variants | Switch | Read by |
| --- | --- | --- | --- |
| `predict` | on, off | `predict` | the place system: the plank outlines before the first commit on a gap |
| `explore` | none, minute | `explore` | not yet (the free phase comes with the tasks of #4 and #6) |
| `hints` | gated, always | `hintsGated` | not yet (hint levels three and four come with the scaffold ladder of rule 25) |
| `target` | 80, 85 | `target` | the learner: the target of the choice of the next level |
| `review` | doubling, weeks | `reviewDays` | the learner: the days between reviews |

A profile gets its variant of the active experiment from its seed, so that a child stays in one variant. The parent can change it on the learning tab of the parent area (`profile.experiment`). Every event carries the label of the variant.

## The parent area

The learning tab (`src/ui/research.js`) has three parts:

- **The experiment:** the variant of this child, and a choice when an experiment is active.
- **The researcher view:** one small block for each of the nine questions, in words and simple bars, from the roll-ups of this device, in Vietnamese and English. HTML and CSS only.
- **Share a learning summary:** it makes a small JSON of the roll-ups (rounded rates, counts, and times; the grade, not the age; no name), shows all of it, and offers to copy it or to save it as a file. Nothing is sent. The summary has only the fields in `summary` of `data/config/learnlog.json`; a test checks it.
