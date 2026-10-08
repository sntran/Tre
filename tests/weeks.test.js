// The weeks of play for the weekly note of the parents (#25): the signals of each activity, from
// the actions of the child only (src/core/learnlog.js, weekRollups; data/config/learnlog.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollupEvents, mergeRollups, weekOf, activityOf, offOf, checkEvent, DAY_MS, emptyRollup } from '../src/core/learnlog.js';
import { load } from './helpers.js';

const schema = load('data/config/learnlog.json');
const opts = { signals: schema.signals, activities: schema.activities };
// Monday, 7 September 2026, 9:00 (UTC).
const MON = Date.UTC(2026, 8, 7, 9);
const S = 1000;
const commit = (t, task, x = {}) => ({ type: 'attempt', t, variant: 'base', task, skill: 'math.mul.10', phase: 'commit', success: false, efficient: false, first: false, mashing: false, parts: [3, 3], resets: 0, latencies: [], hint: 0, hintSeen: null, pBefore: null, pAfter: null, play: 1, retry: false, harder: false, map: 'xom-ruong', off: null, ...x });
const session = (start, end, practice = null) => ({ type: 'session', t: end, variant: 'base', start, end, endedBy: 'child', quests: 0, place: 'xom-ruong', afterQuest: false, first: 'walk', practice });
const week = (events) => Object.values(rollupEvents(events, opts).base.weeks)[0];

test('a week starts on Monday; a task or a mentor key has its activity; a miss is near or far by groups', () => {
  assert.equal(weekOf(MON), weekOf(MON + 6 * DAY_MS + 3 * 3600 * S));
  assert.equal(weekOf(MON - 3600 * S * 10), weekOf(MON) - 1, 'Sunday is the week before');
  assert.equal(activityOf('trial-drum', opts.activities), 'mua-trong');
  assert.equal(activityOf('trial-plant', opts.activities), 'cay-lua');
  assert.equal(activityOf('trial-event-cart', opts.activities), 'events');
  assert.equal(activityOf('event-cart', opts.activities), 'events');
  assert.equal(activityOf('folk-rope', opts.activities), 'nhay-day');
  assert.equal(activityOf('raid-scouts', opts.activities), 'raids');
  assert.equal(offOf([3, 3, 3], 12), 1, 'one group short: near');
  assert.equal(offOf([3], 12), 3, 'far');
  assert.equal(offOf([], 12), null);
  for (const ev of [commit(MON, 'trial-drum', { off: 1 }), { type: 'set', t: MON, variant: 'base', activity: 'mua-trong', end: 'done' }, { type: 'quiz', t: MON, variant: 'base', skill: 'math.mul.10', fact: '3x7', known: true, correct: true }]) assert.ok(checkEvent(ev, schema));
});

test('bored: fast careless commits and far misses; hopping between stations within a minute', () => {
  const t = MON;
  const w = week([
    commit(t + 10 * S, 'trial-drum', { off: 3 }),
    commit(t + 11 * S, 'trial-drum', { off: 4 }),
    commit(t + 12 * S, 'trial-drum', { off: 2.5 }),
    commit(t + 40 * S, 'trial-ducks', { success: true, off: 0 }),
    session(t, t + 120 * S),
  ]);
  const d = w.acts['mua-trong'];
  assert.equal(d.far, 3);
  assert.equal(d.near, 0);
  assert.equal(d.fast, 2, 'two commits came less than three seconds after the one before');
  assert.equal(w.hops, 1);
  assert.equal(d.missRuns, 1, 'three misses in a row');
  assert.equal(d.left, 0, 'the ducks came twenty-eight seconds after the last miss: not a leave');
});

test('frustrated: misses in a row and leaving right after a miss; the time of a commit grows', () => {
  const t = MON;
  const w = week([
    commit(t + 10 * S, 'trial-traps', { off: 1 }),
    commit(t + 30 * S, 'trial-traps', { off: 1, parts: [5, 5] }),
    commit(t + 100 * S, 'trial-traps', { off: 2, resets: 2 }),
    session(t, t + 105 * S),
  ]);
  const d = w.acts['dat-lo'];
  assert.equal(d.missRuns, 1);
  assert.equal(d.left, 1, 'the session ended five seconds after a miss');
  assert.equal(d.changed, 2, 'after each miss the next try had other parts');
  assert.equal(d.idle, 1, 'seventy seconds before the third commit');
  assert.equal(d.resets, 2);
  assert.equal(d.near, 2);
});

test('into it: near misses, right commits of the facts and their seconds, sets finished and play after a set', () => {
  const t = MON;
  const w = week([
    commit(t + 10 * S, 'trial-plant', { off: 0.5 }),
    commit(t + 15 * S, 'trial-plant', { success: true, off: 0, parts: [3, 3, 3, 3] }),
    commit(t + 18 * S, 'trial-plant', { success: true, off: 0, parts: [4, 4] }),
    commit(t + 30 * S, 'trial-plant', { success: true, off: 0, parts: [5, 5] }),
    { type: 'set', t: t + 40 * S, variant: 'base', activity: 'cay-lua', end: 'done' },
    { type: 'set', t: t + 45 * S, variant: 'base', activity: 'cay-lua', end: 'stay' },
    session(t, t + 600 * S, 'cay-lua'),
  ]);
  const d = w.acts['cay-lua'];
  assert.equal(d.near, 1);
  assert.equal(d.changed, 1, 'after the near miss, another try');
  assert.equal(d.left, 0);
  assert.deepEqual(w.recall, [0, 1, 1, 0, 1, 0], 'three right commits: 5, 3, and 12 seconds after the one before');
  assert.equal(d.sets, 1);
  assert.equal(d.stay, 1);
  assert.equal(d.sent, 1, 'a session from a practice link');
  assert.equal(w.sent, 1);
  assert.equal(w.self, 0);
  assert.equal(d.minutes, 10, 'the whole session of the practice link (#52), not only the twenty seconds between the commits');
});

test('self-started or sent; first and last activity of a session; minutes of each day of the week', () => {
  const t = MON + DAY_MS * 2; // Wednesday
  const w = week([
    commit(t + 10 * S, 'trial-ducks', { success: true, off: 0 }),
    commit(t + 400 * S, 'trial-drum', { success: true, off: 0 }),
    session(t, t + 12 * 60 * S),
    commit(t + 3600 * S + 10 * S, 'trial-drum', { success: true, off: 0 }),
    session(t + 3600 * S, t + 3600 * S + 6 * 60 * S, 'mua-trong'),
  ]);
  assert.equal(w.sessions, 2);
  assert.equal(w.self, 1);
  assert.equal(w.sent, 1);
  assert.equal(w.acts['cho-vit-an'].first, 1);
  assert.equal(w.acts['mua-trong'].stops, 2);
  assert.equal(w.acts['mua-trong'].self, 1);
  assert.equal(w.acts['mua-trong'].sent, 1);
  assert.equal(w.day[2], 18, 'eighteen minutes on Wednesday');
  assert.equal(w.minutes, 18);
});

test('learning to learn and the questions of the teacher, each week; the weeks of two days merge as one', () => {
  const t = MON;
  const ev = (x) => ({ variant: 'base', ...x });
  const day1 = [
    ev({ type: 'check', t: t + S, task: 'trial-plant', changed: true }),
    ev({ type: 'check', t: t + 2 * S, task: 'trial-plant', changed: false }),
    ev({ type: 'ask', t: t + 3 * S, task: 'trial-plant', when: 'after', move: 'show' }),
    ev({ type: 'help', t: t + 4 * S, task: 'trial-plant', diagnosis: 'missing', move: 'mark', pBefore: null, success: true, efficient: false }),
    ev({ type: 'prediction', t: t + 5 * S, task: 'bridge', gap: 12, guess: 3, used: 4, solved: false }),
    ev({ type: 'quiz', t: t + 6 * S, skill: 'math.mul.10', fact: '3x7', known: true, correct: true }),
    ev({ type: 'quiz', t: t + 7 * S, skill: 'math.mul.10', fact: '6x8', known: false, correct: false }),
  ];
  const day2 = day1.map((e) => ({ ...e, t: e.t + DAY_MS }));
  const a = rollupEvents(day1, opts).base;
  const b = rollupEvents(day2, opts).base;
  const both = mergeRollups(mergeRollups(emptyRollup(), a), b);
  const w = both.weeks[weekOf(t)];
  assert.deepEqual(w.l2l, { checks: 4, selfFix: 2, before: 0, after: 2, predN: 2, predErr: 2, helps: 2, marks: 2 });
  assert.deepEqual(w.quiz, [4, 2]);
  assert.deepEqual(w.quizKnown, [2, 2]);
  assert.deepEqual(both.weeks, rollupEvents([...day1, ...day2], opts).base.weeks, 'the same as the roll-up of all the events');
});

test('the history of the facts: where a fact was first right, if it stayed a week later, and the table of last week', async () => {
  const { recordFact, snapFacts, factString } = await import('../src/core/planting.js');
  const { validate } = await import('../src/core/save.js');
  const { createProfile } = await import('../src/core/profile.js');
  const data = load('data/world/planting.json');
  const p = createProfile({ id: 'p1', name: 'An', gender: 'girl', grade: 2, now: 1000 });
  const mem = ((p.facts ??= {})['math.mul.10'] = {});
  const w = weekOf(MON);
  const rec = (key, ok, week, activity = 'drum') => recordFact(mem, key, { ok, day: 1, set: 0, index: 0, form: 'rows', round: 0, activity, week }, data);
  rec('3x7', false, w);
  assert.equal(mem['3x7'].from, undefined, 'a miss is not learning');
  rec('3x7', true, w);
  assert.equal(mem['3x7'].from, 'drum');
  assert.equal(mem['3x7'].fromWk, w);
  rec('3x7', true, w, 'ducks');
  assert.equal(mem['3x7'].from, 'drum', 'the first activity stays');
  assert.equal(mem['3x7'].kept, undefined, 'the same week is not a later check');
  rec('3x7', true, w + 1, 'ducks');
  assert.equal(mem['3x7'].kept, w + 1, 'still right a week later');
  assert.equal(factString(mem).length, 100);
  assert.equal(factString(mem)[2 * 10 + 6], 'c', 'row three, column seven: confident after three right commits');
  // The table of this week, and of the week before.
  snapFacts(p, w);
  rec('6x8', true, w + 1);
  const snap = snapFacts(p, w + 1);
  assert.equal(snap.prevWeek, w);
  assert.equal(snap.prev['math.mul.10'][5 * 10 + 7], '-', 'last week: six times eight was not met yet');
  assert.equal(snap.cur['math.mul.10'][5 * 10 + 7], 'g');
  assert.equal(validate(p), true, 'the save keeps the history');
});

test('a question of the teacher on a fact of the table goes to the log, with the fact and whether the world knows it', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('src/ui/quiz.js', 'utf8');
  assert.match(src, /ctx\.log\?\.\('quiz', \{ skill: problem\.skill, fact, known, correct: ok \}\)/);
});

test('a session of a practice link gives all its minutes to its activity, also with one commit or none (#52)', () => {
  const t = MON;
  const w = week([
    // The forge: one commit in a visit of four minutes.
    commit(t + 60 * S, 'trial-smith', { success: true, off: 0 }),
    session(t, t + 240 * S, 'ren-sat'),
    // The herbs: no commit in a visit of two minutes.
    session(t + 300 * S, t + 420 * S, 'hai-thuoc'),
    // Free play: the minutes between the commits, as before.
    commit(t + 500 * S, 'trial-drum'),
    commit(t + 530 * S, 'trial-drum'),
    session(t + 480 * S, t + 600 * S),
  ]);
  assert.equal(w.acts['ren-sat'].minutes, 4);
  assert.deepEqual([w.acts['ren-sat'].sessions, w.acts['ren-sat'].sent], [1, 1]);
  assert.equal(w.acts['hai-thuoc'].minutes, 2);
  assert.deepEqual([w.acts['hai-thuoc'].sessions, w.acts['hai-thuoc'].sent, w.acts['hai-thuoc'].first, w.acts['hai-thuoc'].stops], [1, 1, 1, 1]);
  assert.equal(w.acts['mua-trong'].minutes, 0.5, 'thirty seconds between the two commits');
  assert.equal(w.sessions, 3);
});

test('a stop by the time limit or a closed tab is no stop of the child: no stop and no left after a miss (#58)', () => {
  const t = MON + DAY_MS;
  const ended = (by, practice = null) => {
    const w = week([commit(t + 10 * S, 'trial-drum', { off: 2 }), { ...session(t, t + 15 * S, practice), endedBy: by }]);
    return [w.acts['mua-trong'].stops, w.acts['mua-trong'].left];
  };
  assert.deepEqual(ended('child'), [1, 1], 'the child stopped right after a miss');
  assert.deepEqual(ended('parent'), [0, 0], 'the time limit stopped the game');
  assert.deepEqual(ended('device'), [0, 0], 'the tab closed');
  // A session of a practice link with no commit: a stop only when the child ended it.
  const sent = (by) => week([{ ...session(t, t + 60 * S, 'mua-trong'), endedBy: by }]).acts['mua-trong'].stops;
  assert.deepEqual([sent('child'), sent('parent')], [1, 0]);
  // The places where the child stops: only the sessions that the child ended.
  const r = rollupEvents([{ ...session(t, t + 60 * S), endedBy: 'parent', place: 'soc-son' }, { ...session(t + 3600 * S, t + 3660 * S), place: 'phu-dong' }], opts);
  assert.deepEqual(r.base.sessions.stops, { 'phu-dong': 1 });
});
