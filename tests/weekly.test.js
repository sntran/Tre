// The weekly note of the parents (#25; src/core/weekly.js): from made-up roll-ups, in Vietnamese
// and English, with "too few to tell yet" when the numbers are small. No ranking, no name in the
// shared summary.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weeklyNote, medianOf, signsOf } from '../src/core/weekly.js';
import { rollupEvents, weekOf, summarize, createLog, logEvent, extraFields, DAY_MS } from '../src/core/learnlog.js';
import { createI18n } from '../src/core/i18n.js';
import { load } from './helpers.js';

const schema = load('data/config/learnlog.json');
const data = { practice: load('data/world/practice.json'), learnlog: schema, planting: load('data/world/planting.json') };
const vi = createI18n(load('i18n/vi.json'), 'vi');
const en = createI18n(load('i18n/en.json'), 'en');
const opts = { signals: schema.signals, activities: schema.activities };
const MON = Date.UTC(2026, 8, 7, 9);
const S = 1000;
const W = weekOf(MON);
const commit = (t, task, x = {}) => ({ type: 'attempt', t, variant: 'base', task, skill: 'math.mul.10', phase: 'commit', success: true, efficient: true, first: false, mashing: false, parts: [3, 3], resets: 0, latencies: [], hint: 0, hintSeen: null, pBefore: null, pAfter: null, play: 1, retry: false, harder: false, map: 'xom-ruong', off: 0, ...x });
const session = (start, end, practice = null) => ({ type: 'session', t: end, variant: 'base', start, end, endedBy: 'child', quests: 0, place: 'xom-ruong', afterQuest: false, first: 'walk', practice });
const profile = (x = {}) => ({ hero: { name: 'Nam' }, facts: {}, ...x });
const text = (i18n, note) => note.lines.map((l) => i18n.t(l.key, l.params)).join('\n');

// Three days of play: the drum (keen, chosen first, played on after a set) and the fish traps
// (two misses and a stop right after each).
function week() {
  const out = [];
  for (let d = 0; d < 3; d++) {
    const t = MON + d * DAY_MS;
    out.push(commit(t + 10 * S, 'trial-drum'), commit(t + 14 * S, 'trial-drum', { success: false, off: 1 }), commit(t + 20 * S, 'trial-drum', { parts: [4, 4] }), commit(t + 25 * S, 'trial-drum'));
    out.push({ type: 'set', t: t + 30 * S, variant: 'base', activity: 'mua-trong', end: 'done' }, { type: 'set', t: t + 31 * S, variant: 'base', activity: 'mua-trong', end: 'stay' });
    out.push(commit(t + 200 * S, 'trial-traps', { success: false, off: 2 }));
    out.push(session(t, t + 205 * S + (d === 0 ? 600 * S : 0), d === 2 ? 'mua-trong' : null));
    out.push({ type: 'check', t: t + 40 * S, variant: 'base', task: 'trial-drum', changed: true });
  }
  out.push({ type: 'quiz', t: MON + 50 * S, variant: 'base', skill: 'math.mul.10', fact: '3x7', known: true, correct: true });
  out.push({ type: 'quiz', t: MON + 60 * S, variant: 'base', skill: 'math.mul.10', fact: '6x8', known: false, correct: false });
  return rollupEvents(out, opts);
}
const facts = { 'math.mul.10': { '3x7': { box: 3, n: 4, due: 9, miss: 0, from: 'drum', fromWk: W - 1, kept: W }, '2x3': { box: 1, n: 1, due: 2, miss: 0 } } };
const snap = { week: W, prevWeek: W - 1, cur: { 'math.mul.10': '-'.repeat(100).split('').map((c, i) => (i === 26 || i === 62 ? 'c' : i === 1 ? 'g' : c)).join('') }, prev: { 'math.mul.10': '-'.repeat(100).split('').map((c, i) => (i === 26 ? 'c' : c)).join('') } };

test('the note of a week in plain words, in both languages: plays, the activity chosen first, the facts, the signs, learning to learn, and a thing to do together', () => {
  const note = weeklyNote(week(), profile({ facts, factSnap: snap }), W, data);
  assert.equal(note.played, true);
  const keys = note.lines.map((l) => l.key);
  for (const k of ['parent.week.played', 'parent.week.sent', 'parent.week.first', 'parent.week.back', 'parent.week.facts', 'parent.week.frustrated', 'parent.week.stay', 'parent.week.checks', 'parent.week.together.mua-trong']) assert.ok(keys.includes(k), k);
  const e = text(en, note);
  const v = text(vi, note);
  assert.match(e, /Nam played 3 times/);
  assert.match(e, /Nam chose this first most often: The drum dance/);
  assert.match(e, /2 facts of the table are confident for Nam now \(1 last week\)/);
  assert.match(e, /Fish traps: Nam stopped right after a miss 2 times/);
  assert.match(e, /Try the drum dance together/);
  assert.match(v, /Nam chơi 3 lần/);
  assert.match(v, /Thử múa trống cùng nhau/);
  for (const l of note.lines) assert.ok(!/\{|undefined|NaN/.test(en.t(l.key, l.params) + vi.t(l.key, l.params)), l.key);
  // The facts: this week and last week, and the new confident fact.
  assert.equal(note.facts.confident, 2);
  assert.equal(note.facts.confidentBefore, 1);
  assert.deepEqual(note.facts.newer, ['3x7'], 'the cell seven by three is new this week');
  // The line of each activity, with its signs, and the facts first right there last week that stayed.
  const drum = note.acts.find((a) => a.id === 'mua-trong');
  assert.ok(drum.signs.includes('keen'));
  assert.deepEqual(drum.learned, [1, 1]);
  assert.equal(drum.sets, 3);
  const traps = note.acts.find((a) => a.id === 'dat-lo');
  assert.ok(traps.signs.includes('frustrated'), 'two stops right after a miss');
  // The outside check.
  assert.deepEqual(note.check, { n: 2, ok: 1, known: [1, 1] });
  // No ranking and no comparison with other children.
  assert.ok(!/rank|other children|average child|grade level/i.test(e));
});

test('too few to tell yet; no play this week', () => {
  const r = rollupEvents([commit(MON + 10 * S, 'trial-drum'), session(MON, MON + 60 * S)], opts);
  const note = weeklyNote(r, profile(), W, data);
  assert.ok(note.lines.some((l) => l.key === 'parent.week.few'));
  assert.match(text(en, note), /too few to tell yet/);
  assert.match(text(vi, note), /chưa đủ để kết luận/);
  assert.deepEqual(note.acts[0].signs, ['few']);
  const none = weeklyNote(r, profile(), W + 1, data);
  assert.equal(none.played, false);
  assert.equal(en.t(none.lines[0].key, none.lines[0].params), 'Nam did not play this week.');
});

test('the median of the seconds of the known facts, and the signs of an activity', () => {
  assert.equal(medianOf([0, 3, 1, 0, 0, 0], [2, 4, 6, 10, 20]), 4);
  assert.equal(medianOf([0, 1, 0, 0, 0, 0], [2, 4, 6, 10, 20]), null, 'too few');
  const base = { commits: 10, ok: 5, near: 0, far: 0, fast: 0, idle: 0, resets: 0, missRuns: 0, again: 0, changed: 0, left: 0, stay: 0 };
  assert.deepEqual(signsOf({ ...base, fast: 4, far: 4 }), ['restless']);
  assert.deepEqual(signsOf({ ...base, left: 2 }), ['frustrated']);
  assert.deepEqual(signsOf({ ...base, near: 4 }), ['keen']);
  assert.deepEqual(signsOf(base), ['steady']);
});

test('the shared summary has the weeks, rounded, with no name', () => {
  const log = createLog(0);
  log.first = Math.floor(MON / DAY_MS);
  const events = [commit(MON + 10 * S, 'trial-drum'), commit(MON + 13 * S, 'trial-drum'), session(MON, MON + 100 * S)];
  for (const ev of events) logEvent(log, ev, schema);
  const s = summarize(log, { grade: 2, variant: 'base' }, schema);
  assert.ok(s.rollups.base.weeks[W].acts['mua-trong']);
  assert.deepEqual(extraFields(s, schema.summary), []);
  assert.ok(!JSON.stringify(s).includes('Nam'));
});
