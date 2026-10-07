// The weekly note of the parents (#25; docs/LEARNLOG.md, "The weekly note"): does the practice
// work, and does the child like it. Made from the roll-ups of the weeks (src/core/learnlog.js,
// weekRollups), the memory of the facts and its history (src/core/planting.js), and the mentors.
// Pure: the note is a list of text keys with their params; the parent page says them in the
// language of the parent. The note says what happened and what the game did. It never judges the
// child, never ranks, never compares with other children, and gives no grade-level score. A longer
// session is not "better": the note names the healthy signs (comes back, finishes, chooses to play
// on) and warns about restless or frustrated play. With small numbers it says so.

import { allVariants, SIGNALS, activityOf } from './learnlog.js';
import { factKey } from './planting.js';

// The activities that the parent can play together with the child, with a line for each.
const TOGETHER = ['mua-trong', 'cho-vit-an', 'dat-lo', 'cay-lua'];
const round = (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d;
const sum = (list) => list.reduce((a, b) => a + b, 0);

// The median of the buckets of the seconds of the right commits of the facts (bounds: the upper
// bound of each bucket but the last). Null when there are too few.
export function medianOf(buckets, bounds, few = SIGNALS.few) {
  const n = sum(buckets);
  if (n < few) return null;
  let k = 0;
  for (let i = 0; i < buckets.length; i++) {
    k += buckets[i];
    if (k >= n / 2) return i < bounds.length ? bounds[i] : bounds[bounds.length - 1] * 2;
  }
  return null;
}

// The name of an activity: the title of its practice link, or parent.act.<id>.
export const titleOf = (practice, id) => (practice?.activities ?? []).find((a) => a.id === id)?.titleKey ?? `parent.act.${id}`;

// The signs of an activity in the week, in words: steady, restless, frustrated at times, or keen.
export function signsOf(r, few = SIGNALS.few) {
  const misses = r.commits - r.ok;
  const out = [];
  if (r.commits < few) return ['few'];
  if (r.fast + r.far >= Math.max(few, r.commits / 2)) out.push('restless');
  if (r.left >= 2 || r.missRuns >= 2) out.push('frustrated');
  if ((r.near >= few && r.near >= misses / 2) || r.stay > 0) out.push('keen');
  return out.length ? out : ['steady'];
}

// A count in a sentence, with its plural (parent.count.<what>, with .one for English).
const count = (what, n) => ({ key: `parent.count.${what}`, params: { n } });

// The most lines in the note: the rest stays in the lines of the activities and the table (#42).
export const MAX_LINES = 6;

// The weekly note. rollups: the roll-ups of the log (all the variants); profile: the profile;
// week: the week of the note (weekOf of now); data: { practice, learnlog, planting, names }.
// names: the names of the people (src/core/naming.js, namesOf), so that a line says who helped.
// Each line is a sentence, or a few sentences ({ parts: [...] }), with the counts inside the words
// (#42). The lines that matter most this week come first, at most MAX_LINES; the order of the note
// stays the order below.
// Returns { week, played, lines: [{ key, params } | { parts }], acts: [...], facts, check }.
export function weeklyNote(rollups, profile, week, data = {}) {
  const sig = { ...SIGNALS, ...(data.learnlog?.signals ?? {}) };
  const acts = data.learnlog?.activities ?? {};
  const all = allVariants(rollups ?? {});
  const W = all.weeks?.[week] ?? null;
  const L = all.weeks?.[week - 1] ?? null;
  const name = profile.hero?.name ?? '';
  const found = [];
  const line = (prio, key, params = {}) => found.push({ prio, at: found.length, l: { key, params: { name, ...params } } });
  const lineOf = (prio, parts) => found.push({ prio, at: found.length, l: { parts: parts.map(([key, params = {}]) => ({ key, params: { name, ...params } })) } });
  const title = (id) => ({ key: titleOf(data.practice, id) });

  // The facts of the table: this week, last week, the new confident facts, and the factors that are
  // still new (no confident fact among the facts met).
  const skill = data.planting?.skill ?? 'math.mul.10';
  const snap = profile.factSnap?.week === week ? profile.factSnap : null;
  const cur = snap?.cur?.[skill] ?? null;
  const prev = snap ? snap.prev?.[skill] ?? null : profile.factSnap?.cur?.[skill] ?? null;
  // A fact a × b and b × a is one fact: the cells on and over the diagonal.
  const sure = (s) => (s ? [...s].filter((c, i) => c === 'c' && i % 10 >= Math.floor(i / 10)).length : 0);
  const newer = cur ? [...cur].map((c, i) => (c === 'c' && (!prev || prev[i] !== 'c') ? factKey(Math.floor(i / 10) + 1, (i % 10) + 1) : null)).filter(Boolean) : [];
  const stillNew = [];
  if (cur) {
    for (let f = 2; f <= 10; f++) {
      const row = Array.from({ length: 10 }, (_, j) => cur[(f - 1) * 10 + j]).filter((c) => c !== '-');
      if (row.length >= 2 && !row.includes('c')) stillNew.push(f);
    }
  }
  const facts = { skill, cur, prev, prevWeek: snap?.prevWeek ?? null, confident: sure(cur), confidentBefore: sure(prev), newer: [...new Set(newer)], stillNew };

  // The outside check: the short questions of the teacher on the facts (rule 26).
  const check = W ? { n: W.quiz[0], ok: W.quiz[1], known: [...W.quizKnown] } : { n: 0, ok: 0, known: [0, 0] };

  if (!W || (!W.sessions && !Object.keys(W.acts).length)) {
    return { week, played: false, lines: [{ key: 'parent.week.none', params: { name } }], acts: [], facts, check };
  }

  // 1. How much: the sessions and their length, who started them, and too few to tell.
  if (W.sessions) {
    const parts = [['parent.week.played', { times: count('times', W.sessions), minutes: count('minutes', round(W.minutes / W.sessions)) }]];
    if (W.sent && W.self) parts.push(['parent.week.sent', { self: count('times', W.self), sent: count('times', W.sent) }]);
    else if (W.sent) parts.push(['parent.week.sentOnly', { n: W.sent }]);
    if (W.sessions < sig.few) parts.push(['parent.week.few']);
    lineOf(10, parts);
  }

  // 2. The activities: liked most (chosen first, and back with no link).
  const list = Object.entries(W.acts).filter(([, r]) => r.commits || r.sets);
  const top = (f) => list.filter(([, r]) => f(r) > 0).sort((a, b) => f(b[1]) - f(a[1]))[0] ?? null;
  const first = top((r) => r.first);
  const back = list.filter(([id, r]) => r.self >= 2 || (r.self >= 1 && (L?.acts?.[id]?.sessions ?? 0) > 0)).map(([id]) => id);
  if (first && first[1].first >= 2 && back.includes(first[0])) line(8, 'parent.week.likes', { act: title(first[0]) });
  else {
    if (first && first[1].first >= 2) line(7, 'parent.week.first', { act: title(first[0]), times: count('times', first[1].first) });
    if (back.length) line(7, 'parent.week.back', { act: title(back[0]) });
  }

  // 3. The facts.
  if (cur) {
    const parts = [[prev ? 'parent.week.facts' : 'parent.week.factsFirst', { facts: count('facts', facts.confident), before: facts.confidentBefore }]];
    if (stillNew.length) parts.push(['parent.week.stillNew', { list: stillNew }]);
    lineOf(9, parts);
  }
  const med = medianOf(W.recall, sig.recall, sig.few);
  const medBefore = L ? medianOf(L.recall, sig.recall, sig.few) : null;
  if (med !== null) line(5, medBefore !== null ? 'parent.week.recall' : 'parent.week.recallFirst', { secs: count('seconds', med), before: count('seconds', medBefore ?? 0) });

  // 4. The signs, for each activity, with what the game did.
  for (const [id, r] of list) {
    const signs = signsOf(r, sig.few);
    if (signs.includes('frustrated')) line(8, 'parent.week.frustrated', { act: title(id), times: count('times', Math.max(r.left, r.missRuns)) });
    if (signs.includes('restless')) line(7, 'parent.week.restless', { act: title(id) });
    if (r.sets && r.stay) line(4, 'parent.week.stay', { act: title(id), sets: count('sets', r.sets), times: count('times', r.stay) });
  }
  if (W.hops >= sig.few) line(3, 'parent.week.hops', { times: count('times', W.hops) });
  // The sessions got shorter over the week: the last days with play against the first.
  const days = W.day.map((m, i) => [i, m]).filter(([, m]) => m > 0);
  if (days.length >= 3) {
    const half = Math.floor(days.length / 2);
    const a = sum(days.slice(0, half).map(([, m]) => m)) / half;
    const b = sum(days.slice(-half).map(([, m]) => m)) / half;
    if (b < a * 0.6) line(6, 'parent.week.shorter');
  }

  // 5. Learning to learn: checks, self-corrections, waves, predictions, and the handover.
  const l = W.l2l;
  if (l.checks) line(4, l.selfFix ? 'parent.week.checks' : 'parent.week.checksOnly', { times: count('times', l.checks), fixed: count('times', l.selfFix) });
  if (L?.l2l?.marks && l.marks < L.l2l.marks) line(5, 'parent.week.handover', { now: count('times', l.marks), before: count('times', L.l2l.marks) });
  if (l.after && l.before) line(3, 'parent.week.asks', { after: count('times', l.after), before: count('times', l.before) });
  else if (l.after) line(3, 'parent.week.asksAfter', { times: count('times', l.after), n: l.after });
  else if (l.before) line(3, 'parent.week.asksBefore', { times: count('times', l.before) });
  const missed = list.reduce((a, [, r]) => [a[0] + r.again, a[1] + r.changed, a[2] + r.left], [0, 0, 0]);
  if (sum(missed) >= sig.few) {
    // The way that the child takes most after a miss, and the leaving (or none).
    const how = missed[1] >= missed[0] ? 'parent.week.miss.changed' : 'parent.week.miss.again';
    const n = Math.max(missed[0], missed[1]);
    line(6, missed[2] ? 'parent.week.afterMiss' : 'parent.week.afterMissStay', { how: { key: how, params: { times: count('times', n) } }, left: count('times', missed[2]) });
  }
  if (l.predN) {
    const err = round(l.predErr / l.predN, 1);
    const before = L?.l2l?.predN ? round(L.l2l.predErr / L.l2l.predN, 1) : null;
    line(3, before !== null ? 'parent.week.predict' : 'parent.week.predictFirst', { err, before: before ?? 0 });
  }

  // 6. What helped: the move of a person with the best next commit this week, as an act of that
  // person at the thing of the activity (#42).
  let best = null;
  for (const [act, moves] of Object.entries(W.moves ?? {})) {
    for (const [move, [n, ok]] of Object.entries(moves)) {
      if (n >= sig.few && (!best || ok / n > best.rate || (ok / n === best.rate && n > best.n))) best = { act, move, n, rate: ok / n };
    }
  }
  if (best) {
    const who = (data.practice?.activities ?? []).find((a) => a.id === best.act)?.person ?? null;
    const person = (who && data.names?.[who]) || { key: 'parent.week.person' };
    line(6, 'parent.week.helped', { move: { key: `parent.week.move.${best.move}`, params: { name, person, thing: { key: `parent.week.thing.${best.act}` } } } });
  }

  // 7. The real game of #30, and a thing to play together.
  for (const a of data.practice?.activities ?? []) if (a.real && W.acts[a.id]?.commits) line(2, a.real);
  const together = TOGETHER.map((id) => [id, W.acts[id]?.minutes ?? 0]).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1])[0];
  if (together) line(2, `parent.week.together.${together[0]}`);

  // The lines that matter most, in the order of the note.
  const lines = found.slice().sort((a, b) => b.prio - a.prio || a.at - b.at).slice(0, MAX_LINES).sort((a, b) => a.at - b.at).map((x) => x.l);

  // The line of each activity.
  const learned = {};
  for (const e of Object.values(profile.facts?.[skill] ?? {})) {
    if (e.from === undefined || e.fromWk !== week - 1) continue;
    const a = activityOf(e.from, acts);
    const x = (learned[a] ??= [0, 0]);
    x[0] += 1;
    x[1] += e.kept !== undefined ? 1 : 0;
  }
  const out = list.map(([id, r]) => ({
    id,
    titleKey: titleOf(data.practice, id),
    minutes: round(r.minutes),
    sets: r.sets,
    first: r.first,
    self: r.self,
    stops: r.stops,
    signs: signsOf(r, sig.few),
    learned: learned[id] ?? null,
  })).sort((a, b) => b.minutes - a.minutes);
  return { week, played: true, lines, acts: out, facts, check };
}

// The sentences of the line of an activity (#42): its time and sets, how the child came to it and
// left it, its signs, and the facts first right there last week. Returns [{ key, params }].
export function actSentences(a, name) {
  const out = [];
  // Less than half a minute: "less than a minute", not "0 minutes".
  const minutes = a.minutes < 0.5 ? { key: 'parent.count.underMinute' } : count('minutes', Math.round(a.minutes));
  out.push(a.sets ? { key: 'parent.week.act.time', params: { minutes, sets: count('sets', a.sets) } } : { key: 'parent.week.act.timeOnly', params: { minutes } });
  const how = [['first', a.first], ['self', a.self], ['stops', a.stops]].filter(([, n]) => n > 0).map(([k, n]) => ({ key: `parent.week.act.${k}`, params: { times: count('times', n) } }));
  if (how.length) out.push({ key: 'parent.week.act.how', params: { name, list: how } });
  out.push({ key: 'parent.week.act.signs', params: { signs: a.signs.map((x) => ({ key: `parent.week.sign.${x}` })) } });
  if (a.learned) {
    const [n, kept] = a.learned;
    out.push({ key: kept === n ? 'parent.week.learned.all' : 'parent.week.learned', params: { name, facts: count('facts', n), n, kept } });
  }
  return out;
}

// The sentence of the outside check (rule 26), or the line of no check.
export function checkSentence(check, name) {
  if (!check.n) return { key: 'parent.week.check.none', params: { name } };
  const parts = [{ key: 'parent.week.check', params: { name, facts: count('facts', check.n), ok: check.ok } }];
  if (check.known[0]) parts.push({ key: 'parent.week.check.known', params: { name, ok: check.known[1], n: check.known[0] } });
  return { parts };
}
