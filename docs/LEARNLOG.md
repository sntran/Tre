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
| `attempt` | task, skill, phase (explore or commit), success, efficient, first, mashing, parts, resets, latencies, hint, hintSeen, off (how far the commit was from the target, in groups: 0 is exact), pBefore, pAfter, play, retry, harder, map | the village, for each skill event of a commit on the bridge |
| `session` | start, end, endedBy (device, parent, or child), quests, place, afterQuest, first (the first action), practice (the id of the activity of a practice link, or null) | the app, at the start of a session; each save moves its end, and the end of the session sets endedBy and place (#52) |
| `review` | skill, due, gap (days since the last practice), result | the learner, for an answer for a mastered skill that is due, after an answer before it and at least the first interval of the boxes (`reviewOf` in `src/core/review.js`; a skill that starts as mastered is not reviewed at its first answer, #52) |
| `exam` | skill, correct, p (P(L) before the answer) | Văn Miếu, for each exam item |
| `prediction` | task, gap, guess (null when skipped), used, solved | the village, at the first commit on a gap |
| `help` | task, diagnosis, move, pBefore, success, efficient (the next commit after the move) | the session, at the commit after a move of the mentor of a task (`docs/MENTOR.md`) |
| `check` | task, changed (a part put or taken back after the check, before the commit: a self-correction) | the session, at the commit after the check |
| `ask` | task, when (before or after a try), move | the session, when the child waves for help |
| `carry` | task, size (the size of the load, such as a tray of three or five bowls), seconds (the walk from the pick-up to the put) | the village, when a load of rice goes into the pot |
| `set` | activity, end (done: the set is done; stay: the child plays one more set; back: the child goes back) | the session, at the end of each set of a practice activity |
| `raid` | raid, won | the session, at the end of a raid (#58) |
| `quiz` | skill, fact (null when the question is not a fact of the table), known (the fact is confident in the world), correct | the quiz of the teacher, for each short question (the outside check of rule 26) |

The scenes never write the log. They call `ctx.log(kind, fields)`, the one way in (`src/core/logger.js`). The logger adds the time and the variant, keeps the open session, and counts the time of play.

A **session** starts in a scene of play (the village, a battle, Văn Miếu) and ends at the title (the child left), at the rest screen (the time limit of the parent), or when the page goes to the background (the device). `quests` counts the quest steps that were done in the session, and `afterQuest` is true when the play went on for one more minute after a quest step. The session goes into the log at its start, and each save (at least each half minute of play) moves its end to the time of the save. A page that goes away with no end of the session (a new practice link in the same tab, a closed browser) leaves the session in the log with the end of its last save and `endedBy: device`. The time `t` of the event is its end, so that the roll-ups read it after its commits.

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

## The weekly note

The parent page has a tab "Tuần này" (`parent.tab.week`, the first tab). It answers two questions in plain words: does the practice work, and does the child like it. `src/core/weekly.js` (`weeklyNote`) makes the note; it is pure and gives a list of text keys with their params, and `src/ui/parent.js` (`drawWeek`) shows them in the language of the parent.

**The weeks.** A week starts on Monday, in the local time of the device (`weekOf`). When the raw events of a day roll up, `weekRollups` adds them to the roll-up of their week (`weeks` in the roll-up of each variant). A week keeps:

| Field | What it holds |
| --- | --- |
| `sessions`, `self`, `sent`, `minutes` | the sessions; the sessions that the child started, and the sessions from a practice link; the minutes of play |
| `day` | the minutes of play on each day, Monday first |
| `hops` | changes to another activity within `hop` seconds |
| `acts` | for each activity: `commits`, `ok`, `near` and `far` (misses by at most `near` groups, and the others), `fast` and `idle` (commits less than `fast` or more than `idle` seconds after the commit before), `resets`, `missRuns` (`missRun` misses in a row), `again`, `changed`, and `left` (after a miss: the same commit again, another commit, or the child left within `leave` seconds), `sessions`, `self`, `sent`, `first` (the first activity of a session), `stops` (the last activity of a session), `sets`, `stay` (one more set after a set), `won` and `lost` (the raids, #58), and `minutes` (in a session of a practice link, the whole session goes to its activity, also with one commit or none; in other play, the time between two commits of the activity, each gap at most `gap` seconds; #52) |
| `moves` | for each activity, for each move of the people: [moves, right next commits] |
| `l2l` | learning to learn: `checks` and `selfFix` (a check before a commit, and a change after it), `before` and `after` (a wave for help before or after a try), `predN` and `predErr` (predictions and their error), `helps` (moves of the people), and `marks` (moves that check for the child) |
| `recall` | the seconds of the right commits of the facts of the table, in the buckets of `recall` |
| `quiz`, `quizKnown` | the short questions of the teacher: [questions, right], and the same on the facts that are confident in the world |

The activity of a task comes from `activities` in `data/config/learnlog.json` (`activityOf`). The numbers of the signals are in `signals` there. A signal that joins two commits (a fast commit, a run of misses, a change after a miss) counts only within one session.

**The memory of the facts.** Each fact of the table (`src/core/planting.js`) keeps `from` (the activity of its first right commit), `fromWk` (the week of it), and `kept` (the week when it was right again after that week). At the first session of a new week, the session keeps the table of the week before (`profile.factSnap`: `cur`, `prev`, `week`, `prevWeek`; a table is a string of 100 letters: `-` not met, `e` emerging, `g` growing, `c` confident).

**The note.** Each line is a sentence, or a few sentences, that a parent says (#42): the counts are inside the words (`parent.count.*`, with a text for the count 1 in English, a key with `.one`), lists join with "và" or "and", and no line has a count after a colon or a fraction. The note has at most six lines (`MAX_LINES`): each line has a priority, the lines with the highest priority stay, in the order below. Only the lines that have something to say come:

1. How much: the sessions and their length, "too few to tell" under `few` sessions, and who started them (the child, or a practice link).
2. The activities: the activity that the child chose first most, and an activity that the child came back to with no link.
3. The facts: the confident facts now and last week (a × b and b × a are one fact), the factors with no confident fact, and the median seconds of a right fact against last week.
4. The signs of each activity: frustrated (the child left after a miss, or runs of misses), restless (many fast or far commits), and the sets with one more set; hops, and shorter sessions at the end of the week. Each line says what the game did (for example, a smaller task after a miss).
5. Learning to learn: checks and self-corrections, the handover (fewer moves that check for the child than last week), waves before and after a try, what the child did after a miss, and the error of the predictions.
6. What helped: the move of a person with the best next commit this week, when it has at least `few` uses, as an act of that person at the thing of the activity ("when Cô Năm pointed at the part of the row of seedlings that was still missing"). The week keeps the moves of each activity (`moves`: { activity: { move: [moves, right next commits] } }); the person is the person of the practice activity, by the names of the region (`namesOf`).
7. The real game of a folk game (`docs/FOLKGAMES.md`), and one thing to play together at home.

Under the note: the table of the facts of this week next to last week (a calm light indigo for exploring, yellow for getting there, green for confident; no red), the sentences of each activity (`actSentences`: minutes and sets, chosen first, started by the child, stops, the signs, and the facts first learned there last week that are still right, with no fraction), and the outside check (`checkSentence`: the short questions of the teacher, and the same on the facts that are confident in the world).

The note never judges the child, never ranks, never compares with other children, and gives no score of a grade. A longer session is not better: the note names the healthy signs (comes back, finishes, chooses to play on) and warns about restless or frustrated play.

**A test profile.** `node tools/week-profile.mjs out.json` plays the practice stories at speed on days of last week and this week, joins them into one profile with the log on, and adds short questions of the teacher. Load the profile in the browser to see the note.
