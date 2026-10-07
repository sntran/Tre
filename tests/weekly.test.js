// The weekly note of the parents (#25; src/core/weekly.js): from made-up roll-ups, in Vietnamese
// and English, with "too few to tell yet" when the numbers are small. No ranking, no name in the
// shared summary.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { weeklyNote, medianOf, signsOf, actSentences, checkSentence, MAX_LINES } from '../src/core/weekly.js';
import { rollupEvents, weekOf, summarize, createLog, logEvent, extraFields, DAY_MS } from '../src/core/learnlog.js';
import { createI18n } from '../src/core/i18n.js';
import { namesOf } from '../src/core/naming.js';
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
// A line of the note is a sentence, or a few sentences ({ parts }), as the parent page says it.
const say = (i18n, l) => (l.parts ? l.parts.map((x) => i18n.t(x.key, x.params)).join(' ') : i18n.t(l.key, l.params));
const text = (i18n, note) => note.lines.map((l) => say(i18n, l)).join('\n');
const naming = load('data/world/naming.json');
const regions = load('data/world/regions.json');
const npcs = load('data/npcs.json').npcs;

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
  const keys = note.lines.flatMap((l) => (l.parts ?? [l]).map((x) => x.key));
  for (const k of ['parent.week.played', 'parent.week.sent', 'parent.week.likes', 'parent.week.facts', 'parent.week.frustrated']) assert.ok(keys.includes(k), k);
  const e = text(en, note);
  const v = text(vi, note);
  assert.match(e, /Nam played 3 times this week, about 7 minutes each time\./);
  assert.match(e, /Nam likes the drum dance most: Nam chose it first, and came back to it alone\./);
  assert.match(e, /Nam is sure of 1 fact of the table now, and was sure of 1 last week\./);
  assert.match(e, /At Fish traps, Nam found it hard at times and stopped right after a miss, 2 times\./);
  assert.match(v, /Nam chơi 3 lần tuần này, mỗi lần khoảng 7 phút\. 2 lần Nam tự mở game, 1 lần mở từ đường dẫn bố mẹ gửi\./);
  assert.match(v, /Nam thích Múa trống nhất: Nam chọn nó trước tiên, và tự quay lại chơi\./);
  for (const l of [...note.lines, ...note.acts.flatMap((a) => actSentences(a, 'Nam')), checkSentence(note.check, 'Nam')]) {
    for (const i18n of [en, vi]) assert.ok(!/\{|\}|undefined|NaN|parent\./.test(say(i18n, l)), say(i18n, l));
  }
  // The facts: this week and last week, and the new confident fact.
  assert.equal(note.facts.confident, 1, 'three by seven and seven by three are one fact');
  assert.equal(note.facts.confidentBefore, 1);
  assert.deepEqual(note.facts.newer, ['3x7'], 'the cell seven by three is new this week');
  // The line of each activity, as sentences, with its signs, and the facts first right there last
  // week that stayed (no fraction).
  const drum = note.acts.find((a) => a.id === 'mua-trong');
  assert.ok(drum.signs.includes('keen'));
  assert.deepEqual(drum.learned, [1, 1]);
  assert.equal(drum.sets, 3);
  assert.equal(actSentences(drum, 'Nam').map((x) => say(en, x)).join(' '), '4 minutes, 3 sets. Nam chose it first 3 times and opened it alone 2 times. Keen. Nam first got 1 fact of the table right here last week, and still knows it this week.');
  const traps = note.acts.find((a) => a.id === 'dat-lo');
  assert.ok(traps.signs.includes('frustrated'), 'two stops right after a miss');
  assert.match(actSentences(traps, 'Nam').map((x) => say(vi, x)).join(' '), /^Chưa tới 1 phút\./, 'less than half a minute is not "0 phút"');
  // The outside check.
  assert.deepEqual(note.check, { n: 2, ok: 1, known: [1, 1] });
  assert.equal(say(en, checkSentence(note.check, 'Nam')), 'The teacher in the village asked Nam 2 facts of the table quickly, and Nam got 1 right. Of the facts that are sure in the game, Nam got 1 of 1 right.');
  // No ranking and no comparison with other children.
  assert.ok(!/rank|other children|average child|grade level/i.test(e));
});

test('too few to tell yet; no play this week', () => {
  const r = rollupEvents([commit(MON + 10 * S, 'trial-drum'), session(MON, MON + 60 * S)], opts);
  const note = weeklyNote(r, profile(), W, data);
  assert.deepEqual(note.lines[0].parts.map((x) => x.key), ['parent.week.played', 'parent.week.few']);
  assert.equal(say(en, note.lines[0]), 'Nam played 1 time this week, about 1 minute each time. That is still too few to tell much.');
  assert.match(text(vi, note), /chưa đủ để kết luận/);
  assert.deepEqual(note.acts[0].signs, ['few']);
  const none = weeklyNote(r, profile(), W + 1, data);
  assert.equal(none.played, false);
  assert.equal(say(en, none.lines[0]), 'Nam did not play this week.');
});

// A raid with quick far misses (#55): the time of the shot, not a bored child, makes a miss there,
// and nobody in a raid gives a smaller task. So no restless line, no frustrated line, and no help
// of a person comes from a raid.
test('a raid gives no reason for its misses and no person who helped (#55)', () => {
  const out = [];
  for (let d = 0; d < 3; d++) {
    const t = MON + d * DAY_MS;
    for (let i = 0; i < 6; i++) {
      out.push(commit(t + 10 * S + i * S, 'raid-scouts', { success: false, off: 2, parts: [5, 5], skill: 'math.count.5' }));
      out.push({ type: 'help', t: t + 10 * S + i * S + 500, variant: 'base', task: 'raid-scouts', diagnosis: 'missing', move: 'mark', pBefore: null, success: true, efficient: true });
    }
    out.push(session(t, t + 120 * S));
  }
  const note = weeklyNote(rollupEvents(out, opts), profile(), W, data);
  const keys = note.lines.flatMap((l) => (l.parts ?? [l]).map((x) => x.key));
  for (const k of ['parent.week.restless', 'parent.week.frustrated', 'parent.week.helped']) assert.ok(!keys.includes(k), k);
  const raids = note.acts.find((a) => a.id === 'raids');
  assert.ok(raids, 'the raids have a line of their own');
  assert.ok(!raids.signs.includes('restless') && !raids.signs.includes('frustrated'), raids.signs.join(' '));
});

// The rules of #42: each line is a sentence that a parent says, not a table of counts.
test('the rules of the plain words: no count after a colon, no fraction, a person in each move, no "1 times", at most six lines', () => {
  const extra = [];
  const moves = ['wait', 'show', 'mark', 'cue', 'demo', 'smaller', 'share', 'picture', 'raise', 'break', 'tryFirst', 'offer'];
  for (let d = 0; d < 5; d++) {
    const t = MON + d * DAY_MS;
    extra.push(commit(t + 10 * S, 'cay-lua'), commit(t + 20 * S, 'cay-lua', { success: false, off: 1 }), commit(t + 30 * S, 'cay-lua'));
    extra.push({ type: 'help', t: t + 25 * S, variant: 'base', task: 'cay-lua', diagnosis: 'missing', move: 'mark', pBefore: null, success: true, efficient: true });
    extra.push({ type: 'ask', t: t + 26 * S, variant: 'base', task: 'cay-lua', when: 'after' });
    extra.push({ type: 'prediction', t: t + 27 * S, variant: 'base', task: 'bridge', guess: 4, used: 5 });
    extra.push(session(t, t + 400 * S, d === 1 ? 'cay-lua' : null));
  }
  const r = rollupEvents(extra, opts);
  const names = namesOf({ npcs: { npcs }, regions, naming }, 'giong');
  for (const [rr, p, ctx] of [[r, profile({ facts, factSnap: snap }), { ...data, names }], [r, profile(), data], [week(), profile({ facts, factSnap: snap }), { ...data, names }]]) {
    const note = weeklyNote(rr, p, W, ctx);
    assert.ok(note.lines.length <= MAX_LINES, `${note.lines.length} lines`);
    for (const l of note.lines) {
      for (const x of l.parts ?? [l]) {
        const move = x.params?.move;
        if (move) {
          assert.match(move.key, /^parent\.week\.move\./);
          assert.ok(move.params.person, `${move.key} has a person`);
        }
      }
      for (const i18n of [en, vi]) {
        const s = say(i18n, l);
        assert.ok(!/:\s*\d/.test(s), `a count after a colon: ${s}`);
        assert.ok(!/\d\s*\/\s*\d/.test(s), `a fraction: ${s}`);
        assert.ok(!/\b1 (times|minutes|seconds|facts|sets)\b/.test(s), `"1 times": ${s}`);
        assert.ok(!/\{|undefined|NaN|parent\./.test(s), s);
      }
    }
  }
  // The person of the move is the planter by name, at the row of seedlings.
  const note = weeklyNote(r, profile(), W, { ...data, names });
  const helped = note.lines.find((l) => l.key === 'parent.week.helped');
  assert.ok(helped, 'a line of what helped');
  assert.equal(say(vi, helped), 'Điều giúp Nam nhiều nhất là khi cô Năm chỉ vào chỗ còn thiếu ở hàng mạ.');
  assert.equal(say(en, helped), 'What helped Nam most was when Cô Năm pointed at the part of the row of seedlings that was still missing.');
  // Each move has a sentence in both languages, and no old text of a move stays.
  for (const m of moves) for (const i18n of [en, vi]) assert.notEqual(i18n.t(`parent.week.move.${m}`), `parent.week.move.${m}`, m);
  for (const k of Object.keys(load('i18n/en.json'))) assert.ok(!k.startsWith('parent.move.'), k);
});

// The colors of the table of the facts (#42): no red for a fact that the child explores (rule 13).
test('the table of the facts has a calm color for exploring, yellow for getting there, and green for confident', () => {
  const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
  const color = (state) => css.match(new RegExp(`\\.fact\\.${state}[^{]*\\{\\s*background:\\s*var\\(--([a-z-]+)\\)`))?.[1];
  assert.equal(color('exploring'), 'indigo-pale');
  assert.equal(color('getting'), 'yellow-pale');
  assert.equal(color('confident'), 'green-pale');
  assert.ok(!/\.fact[^{]*\{[^}]*vermilion/.test(css));
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
