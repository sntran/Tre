import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  qHelp, createLog, logEvent, checkEvent, rollupEvents, mergeRollups, currentRollups, emptyRollup, DAY_MS,
  qLearn, qStay, qTransfer, qDifficulty, qPredict, qHints, qMashing, qComeBack, qSessions, QUESTIONS, summarize, extraFields,
} from '../src/core/learnlog.js';
import { load } from './helpers.js';

const schema = load('data/config/learnlog.json');
const T0 = Date.UTC(2026, 8, 1, 9); // a morning (UTC)

// Events of two days and two variants: bridge commits, a prediction, reviews, exams, sessions.
const attempt = (t, x) => ({ type: 'attempt', t, variant: 'base', task: 'bridge', skill: 'math.add.20', phase: 'commit', success: false, efficient: false, first: false, mashing: false, parts: [4, 4], resets: 0, latencies: [2, 3], hint: 0, hintSeen: null, pBefore: 0.5, pAfter: 0.4, play: 10, retry: false, harder: false, map: 'phu-dong', off: null, ...x });
const DAY1 = [
  { type: 'session', t: T0, variant: 'base', start: T0 - 12 * 60000, end: T0, endedBy: 'child', quests: 1, place: 'phu-dong', afterQuest: false, first: 'walk', practice: null },
  attempt(T0 + 1000, { first: true, mashing: true }),
  attempt(T0 + 2000, { success: true, parts: [4, 4, 4] }),
  attempt(T0 + 3000, { first: true, success: true, efficient: true, hint: 1, hintSeen: 0.5, pBefore: 0.9, pAfter: 0.96, play: 25 }),
  attempt(T0 + 4000, { phase: 'explore' }),
  { type: 'prediction', t: T0 + 5000, variant: 'base', task: 'bridge', gap: 12, guess: 3, used: 2, solved: false },
  { type: 'prediction', t: T0 + 6000, variant: 'base', task: 'bridge', gap: 15, guess: null, used: 3, solved: true },
  { type: 'exam', t: T0 + 7000, variant: 'base', skill: 'math.add.20', correct: true, p: 0.9 },
  { type: 'exam', t: T0 + 8000, variant: 'base', skill: 'math.add.20', correct: false, p: 0.3 },
  { type: 'exam', t: T0 + 9000, variant: 'base', skill: 'math.add.20', correct: true, p: 0.8 },
];
const DAY2 = [
  attempt(T0 + DAY_MS + 1000, { first: true, success: true, efficient: true, variant: 'predict:off', skill: 'math.mul.10' }),
  attempt(T0 + DAY_MS + 2000, { first: true, success: true, efficient: true }),
  { type: 'review', t: T0 + DAY_MS + 3000, variant: 'base', skill: 'math.add.20', due: T0, gap: 6, result: true },
  { type: 'review', t: T0 + DAY_MS + 4000, variant: 'base', skill: 'math.add.20', due: T0, gap: 20, result: false },
  { type: 'session', t: T0 + DAY_MS + 5000, variant: 'base', start: T0 + DAY_MS - 30 * 60000, end: T0 + DAY_MS + 5000, endedBy: 'parent', quests: 0, place: 'soc-son', afterQuest: true, first: 'talk', practice: 'bo-que' },
  { type: 'help', t: T0 + DAY_MS + 6000, variant: 'base', task: 'event-cart', diagnosis: 'units', move: 'demo', pBefore: 0.4, success: true, efficient: false },
  { type: 'help', t: T0 + DAY_MS + 7000, variant: 'base', task: 'event-cart', diagnosis: 'units', move: 'demo', pBefore: 0.5, success: false, efficient: false },
  { type: 'help', t: T0 + DAY_MS + 8000, variant: 'base', task: 'bridge', diagnosis: 'missing', move: 'mark', pBefore: null, success: true, efficient: true },
  { type: 'check', t: T0 + DAY_MS + 9000, variant: 'base', task: 'bridge', changed: true },
  { type: 'check', t: T0 + DAY_MS + 9500, variant: 'base', task: 'bridge', changed: false },
  { type: 'ask', t: T0 + DAY_MS + 9800, variant: 'base', task: 'bridge', when: 'before', move: 'tryFirst' },
];
const ALL = [...DAY1, ...DAY2];
const opts = { first: Math.floor(T0 / DAY_MS) };

test('each event has the shape of its kind: numbers, times, ids, and words only', () => {
  for (const ev of ALL) assert.ok(checkEvent(ev, schema));
  const bad = [
    { ...DAY1[1], name: 'Mai' }, // a name
    { ...DAY1[1], skill: 'Hello, my friend!' }, // free text
    { ...DAY1[1], phase: 'play' }, // a word that is not in the list
    { ...DAY1[1], latencies: 'fast' },
    { ...DAY1[1], pAfter: 1.4 },
    { type: 'photo', t: T0, variant: 'base' },
  ];
  for (const ev of bad) assert.throws(() => checkEvent(ev, schema));
  const { resets, ...missing } = DAY1[1];
  assert.throws(() => checkEvent(missing, schema), /resets/);
});

test('the roll-up of the days gives the same numbers as the raw events', () => {
  const whole = rollupEvents(ALL, opts);
  const a = rollupEvents(DAY1, opts);
  const b = rollupEvents(DAY2, opts);
  const merged = {};
  for (const v of new Set([...Object.keys(a), ...Object.keys(b)])) merged[v] = mergeRollups(a[v] ?? emptyRollup(), b[v] ?? emptyRollup());
  assert.deepEqual(merged, whole);
  // The counts against the raw events.
  const base = whole.base.skills['math.add.20'];
  const raw = ALL.filter((e) => e.type === 'attempt' && e.variant === 'base' && e.skill === 'math.add.20' && e.phase === 'commit');
  assert.equal(base.commits, raw.length);
  assert.equal(base.successes, raw.filter((e) => e.success).length);
  assert.equal(base.firsts, raw.filter((e) => e.first).length);
  assert.equal(base.explore, 1);
  assert.equal(whole.base.sessions.n, 2);
  assert.equal(whole.base.sessions.ms, 42 * 60000 + 5000);
  assert.equal(whole.base.days, 2);
  // The log rolls a day up at the first event of the next day, and drops the raw events.
  const log = createLog(0);
  for (const ev of DAY1) logEvent(log, ev, schema);
  assert.equal(log.events.length, DAY1.length);
  logEvent(log, DAY2[0], schema);
  assert.equal(log.events.length, 1, 'the events of the day before are gone');
  for (const ev of DAY2.slice(1)) logEvent(log, ev, schema);
  assert.deepEqual(currentRollups(log, schema), whole);
});

test('the nine questions, on a fixed set of events', () => {
  const r = rollupEvents(ALL, opts);
  // 1. Learn: the time of play to mastery, the last ten commits, and the curve.
  const learn = qLearn(r).find((x) => x.skill === 'math.add.20');
  assert.equal(learn.toMastery, 25);
  assert.equal(learn.commits, 4);
  assert.equal(learn.recent, 3 / 4);
  assert.deepEqual(learn.curve.map((c) => [c.day, c.rate]), [[0, 2 / 3], [1, 1]]);
  // 2. Stay: a review after about 7 days and one after 30.
  assert.deepEqual(qStay(r).map((x) => [x.days, x.n, x.rate]), [[7, 1, 1], [14, 0, null], [30, 1, 0]]);
  // 3. Transfer: P(L) against the exam items.
  const tr = qTransfer(r);
  assert.equal(tr.n, 3);
  assert.ok(tr.r > 0.9, `a high correlation (${tr.r})`);
  // 4. Difficulty: first tries 3 of 4 (the mul skill too).
  const d = qDifficulty(r);
  assert.equal(d.firsts, 4);
  assert.equal(d.rate, 3 / 4);
  assert.equal(d.inBand, false);
  // 5. Predictions: one made (error 1), one skipped.
  const p = qPredict(r);
  assert.deepEqual([p.n, p.skipped, p.error], [2, 0.5, 1]);
  assert.equal(p.mastery.base.minutes, 25);
  // 6. Hints: level 1 once (a success), seen for half a second.
  const h = qHints(r);
  assert.deepEqual(h.levels.find((x) => x.level === 1), { level: 1, n: 1, rate: 1 });
  assert.equal(h.short, 1);
  // 7. Mashing: one commit of five, and the next commit was a success.
  const m = qMashing(r);
  assert.equal(m.share, 1 / 5);
  assert.deepEqual(m.after, { n: 1, rate: 1 });
  // 8. Come back: two sessions in one week, one went on after the quest.
  const c = qComeBack(r);
  assert.deepEqual([c.sessions, c.perWeek, c.afterQuest], [2, 2, 0.5]);
  assert.deepEqual(c.stops.map((x) => x.place).sort(), ['phu-dong', 'soc-son']);
  // 9. Sessions: the length, who ended it, and the first action.
  const s = qSessions(r);
  assert.equal(Math.round(s.minutes), 21);
  assert.deepEqual(s.endedBy, { device: 0, parent: 1, child: 1 });
  assert.deepEqual(s.lengths, [0, 0, 1, 1, 0]);
  assert.deepEqual(s.first, { walk: 1, talk: 1 });
  assert.equal(Object.keys(QUESTIONS).length, 9);
});

test('a mashing commit at the end of a day counts in the success after mashing of the next day', () => {
  const a = rollupEvents([attempt(T0, { mashing: true })], opts);
  const b = rollupEvents([attempt(T0 + DAY_MS, { success: true })], opts);
  const merged = mergeRollups(a.base, b.base);
  assert.deepEqual(merged.skills['math.add.20'].afterMash, [1, 1]);
  assert.deepEqual(merged, rollupEvents([attempt(T0, { mashing: true }), attempt(T0 + DAY_MS, { success: true })], opts).base);
});

test('the shared summary has only the allowed fields, no name, and is small', () => {
  const log = createLog(0);
  // Ten minutes of play, many times over: the summary stays small.
  for (let d = 0; d < 30; d++) for (let i = 0; i < 40; i++) logEvent(log, attempt(T0 + d * DAY_MS + i * 1000, { success: i % 3 === 0, first: i % 5 === 0 }), schema);
  for (const ev of ALL) logEvent(log, { ...ev, t: ev.t + 40 * DAY_MS }, schema);
  const sum = summarize(log, { grade: 2, variant: 'base' }, schema);
  assert.deepEqual(extraFields(sum, schema.summary), []);
  const text = JSON.stringify(sum);
  assert.ok(text.length < 20000, `${text.length} characters`);
  assert.ok(!/Mai|"name"|lastMash|firstOk|userAgent|screen/.test(text));
  assert.equal(sum.grade, 2);
  assert.ok(sum.days >= 30);
  // A field that is not allowed is found.
  assert.deepEqual(extraFields({ ...sum, name: 'Mai' }, schema.summary), ['name']);
});

test('the logger: one way into the log, with the time, the variant, the session, and the time of play', async () => {
  const { createLogger } = await import('../src/core/logger.js');
  const quests = load('data/quests.json').quests;
  let now = T0;
  const profile = { flags: {}, inventory: {}, grade: 2, quests: {} };
  const logger = createLogger({ profile, schema, label: () => 'predict:on', quests, now: () => now });
  logger.startSession();
  now += 60000;
  logger.action('talk');
  logger.action('walk');
  now += 4 * 60000;
  const a = logger.attempt({ task: 'bridge', skill: 'math.add.20', phase: 'commit', success: true, efficient: true, first: true, mashing: false, parts: [4, 4, 4], resets: 1, latencies: [2.5, 3], hint: 0, hintSeen: null, pBefore: 0.3, pAfter: 0.5, retry: false, harder: false, map: 'phu-dong' });
  assert.equal(a.play, 5, 'five minutes of play');
  assert.equal(a.variant, 'predict:on');
  // A quest step, and one more minute of play after it.
  profile.flags['prologue.started'] = true;
  logger.checkQuests();
  now += 90000;
  const s = logger.endSession('device', 'phu-dong');
  assert.deepEqual([s.endedBy, s.first, s.quests, s.afterQuest, s.end - s.start], ['device', 'talk', 1, true, 6.5 * 60000]);
  assert.equal(profile.log.playMs, 6.5 * 60000);
  assert.equal(logger.endSession('child'), null, 'no session is open');
  assert.equal(s.practice, null);
  // The session of a practice link keeps the id of the activity.
  logger.startSession({ practice: 'bo-que' });
  assert.equal(logger.endSession('child', 'giong').practice, 'bo-que');
  // An event that does not fit the schema is not kept, and the game goes on.
  assert.equal(logger.record('exam', { skill: 'math.add.20', correct: 'yes', p: 0.5 }), null);
  assert.equal(profile.log.events.length, 3);
  // A story run (or a scripted play) is not a child: its log drops every event.
  const story = { flags: {}, inventory: {}, grade: 2, quests: {} };
  const quiet = createLogger({ profile: story, schema, quests, now: () => now, drop: true });
  quiet.startSession();
  assert.equal(quiet.attempt({ task: 'bridge', skill: 'math.add.20', phase: 'commit', success: true, efficient: true, first: true, mashing: false, parts: [4], resets: 0, latencies: [], hint: 0, hintSeen: null, pBefore: 0.3, pAfter: 0.5, retry: false, harder: false, map: 'phu-dong' }), null);
  assert.equal(quiet.endSession('child'), null);
  assert.equal(story.log.events.length, 0);
});

test('the save keeps the learning log, and a log with free text does not load', async () => {
  const { exportCode, importCode } = await import('../src/core/save.js');
  const { createProfile } = await import('../src/core/profile.js');
  const p = createProfile({ id: 'p1', name: 'Mai', gender: 'girl', grade: 2, now: T0, seed: 4 });
  p.log = createLog(-420);
  for (const ev of ALL) logEvent(p.log, ev, schema);
  p.experiment = { experiment: 'predict', variant: 'off' };
  const back = importCode(exportCode(p));
  assert.deepEqual(back.log, p.log);
  assert.deepEqual(back.experiment, p.experiment);
  const bad = structuredClone(p);
  bad.log.events.push({ ...ALL[1], skill: 'Hello, my friend!' });
  assert.throws(() => importCode(exportCode(bad)), (e) => e.reason === 'shape');
});

test('which help works: the moves of the mentors with the next commit, the checks, and the waves', () => {
  const r = rollupEvents(ALL, opts);
  const q = qHelp(r);
  assert.deepEqual(q.rows[0], { diagnosis: 'units', move: 'demo', n: 2, rate: 0.5, efficient: 0 });
  assert.deepEqual(q.rows[1], { diagnosis: 'missing', move: 'mark', n: 1, rate: 1, efficient: 1 });
  assert.equal(q.checks, 2);
  assert.equal(q.selfFix, 0.5);
  assert.deepEqual(q.asks, { before: 1, after: 0 });
  // A roll-up of an older version (no helps) merges with a new one.
  const old = emptyRollup();
  delete old.helps;
  delete old.checks;
  delete old.asks;
  assert.deepEqual(mergeRollups(old, r.base).helps, r.base.helps);
  assert.throws(() => checkEvent({ ...ALL.find((e) => e.type === 'help'), move: 'answer' }, schema), 'no move gives the answer');
});
