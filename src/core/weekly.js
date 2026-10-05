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

// The weekly note. rollups: the roll-ups of the log (all the variants); profile: the profile;
// week: the week of the note (weekOf of now); data: { practice, learnlog, planting, mentors }.
// Returns { week, played, lines: [{ key, params }], acts: [...], facts, check }.
export function weeklyNote(rollups, profile, week, data = {}) {
  const sig = { ...SIGNALS, ...(data.learnlog?.signals ?? {}) };
  const acts = data.learnlog?.activities ?? {};
  const all = allVariants(rollups ?? {});
  const W = all.weeks?.[week] ?? null;
  const L = all.weeks?.[week - 1] ?? null;
  const name = profile.hero?.name ?? '';
  const lines = [];
  const say = (key, params = {}) => lines.push({ key, params: { name, ...params } });
  const title = (id) => ({ key: titleOf(data.practice, id) });

  // The facts of the table: this week, last week, the new confident facts, and the factors that are
  // still new (no confident fact among the facts met).
  const skill = data.planting?.skill ?? 'math.mul.10';
  const snap = profile.factSnap?.week === week ? profile.factSnap : null;
  const cur = snap?.cur?.[skill] ?? null;
  const prev = snap ? snap.prev?.[skill] ?? null : profile.factSnap?.cur?.[skill] ?? null;
  // A fact a × b and b × a is one fact: the cells on and over the diagonal.
  const count = (s) => (s ? [...s].filter((c, i) => c === 'c' && i % 10 >= Math.floor(i / 10)).length : 0);
  const newer = cur ? [...cur].map((c, i) => (c === 'c' && (!prev || prev[i] !== 'c') ? factKey(Math.floor(i / 10) + 1, (i % 10) + 1) : null)).filter(Boolean) : [];
  const stillNew = [];
  if (cur) {
    for (let f = 2; f <= 10; f++) {
      const row = Array.from({ length: 10 }, (_, j) => cur[(f - 1) * 10 + j]).filter((c) => c !== '-');
      if (row.length >= 2 && !row.includes('c')) stillNew.push(f);
    }
  }
  const facts = { skill, cur, prev, prevWeek: snap?.prevWeek ?? null, confident: count(cur), confidentBefore: count(prev), newer: [...new Set(newer)], stillNew };

  // The outside check: the short questions of the teacher on the facts (rule 26).
  const check = W ? { n: W.quiz[0], ok: W.quiz[1], known: [...W.quizKnown] } : { n: 0, ok: 0, known: [0, 0] };

  if (!W || (!W.sessions && !Object.keys(W.acts).length)) {
    say('parent.week.none');
    return { week, played: false, lines, acts: [], facts, check };
  }

  // 1. How much: the sessions, and their length; too few to tell.
  const minutes = W.sessions ? W.minutes / W.sessions : null;
  if (W.sessions) say('parent.week.played', { n: W.sessions, minutes: round(minutes ?? 0) });
  if (W.sessions < sig.few) say('parent.week.few');
  // Started by the child, or by a practice link.
  if (W.sent && W.self) say('parent.week.sent', { self: W.self, sent: W.sent });
  else if (W.sent) say('parent.week.sentOnly');

  // 2. The activities: chosen first, and back with no link.
  const list = Object.entries(W.acts).filter(([, r]) => r.commits || r.sets);
  const top = (f) => list.filter(([, r]) => f(r) > 0).sort((a, b) => f(b[1]) - f(a[1]))[0] ?? null;
  const first = top((r) => r.first);
  if (first && first[1].first >= 2) say('parent.week.first', { act: title(first[0]) });
  const back = list.filter(([id, r]) => r.self >= 2 || (r.self >= 1 && (L?.acts?.[id]?.sessions ?? 0) > 0)).map(([id]) => id);
  if (back.length) say('parent.week.back', { act: title(back[0]) });

  // 3. The facts.
  if (cur) {
    say(prev ? 'parent.week.facts' : 'parent.week.factsFirst', { n: facts.confident, before: facts.confidentBefore });
    if (stillNew.length) say('parent.week.stillNew', { list: stillNew.join(', ') });
  }
  const med = medianOf(W.recall, sig.recall, sig.few);
  const medBefore = L ? medianOf(L.recall, sig.recall, sig.few) : null;
  if (med !== null) say(medBefore !== null ? 'parent.week.recall' : 'parent.week.recallFirst', { s: med, before: medBefore ?? 0 });

  // 4. The signs, for each activity, with what the game did.
  for (const [id, r] of list) {
    const signs = signsOf(r, sig.few);
    if (signs.includes('frustrated')) say('parent.week.frustrated', { act: title(id), n: Math.max(r.left, r.missRuns) });
    if (signs.includes('restless')) say('parent.week.restless', { act: title(id) });
    if (r.sets && r.stay) say('parent.week.stay', { act: title(id), sets: r.sets, stay: r.stay });
  }
  if (W.hops >= sig.few) say('parent.week.hops', { n: W.hops });
  // The sessions got shorter over the week: the last days with play against the first.
  const days = W.day.map((m, i) => [i, m]).filter(([, m]) => m > 0);
  if (days.length >= 3) {
    const half = Math.floor(days.length / 2);
    const a = sum(days.slice(0, half).map(([, m]) => m)) / half;
    const b = sum(days.slice(-half).map(([, m]) => m)) / half;
    if (b < a * 0.6) say('parent.week.shorter');
  }

  // 5. Learning to learn: checks, self-corrections, waves, predictions, and the handover.
  const l = W.l2l;
  if (l.checks) say('parent.week.checks', { n: l.checks, fixed: l.selfFix });
  if (L?.l2l?.marks && l.marks < L.l2l.marks) say('parent.week.handover', { n: L.l2l.marks, now: l.marks });
  if (l.after || l.before) say('parent.week.asks', { after: l.after, before: l.before });
  const missed = list.reduce((a, [, r]) => [a[0] + r.again, a[1] + r.changed, a[2] + r.left], [0, 0, 0]);
  if (sum(missed) >= sig.few) say('parent.week.afterMiss', { again: missed[0], changed: missed[1], left: missed[2] });
  if (l.predN) {
    const err = round(l.predErr / l.predN, 1);
    const before = L?.l2l?.predN ? round(L.l2l.predErr / L.l2l.predN, 1) : null;
    say(before !== null ? 'parent.week.predict' : 'parent.week.predictFirst', { err, before: before ?? 0 });
  }

  // 6. What helped: the move of the mentors with the best next commit, of all the weeks.
  const moves = [];
  for (const [, m] of Object.entries(all.helps ?? {})) for (const [move, [n, ok]] of Object.entries(m)) moves.push({ move, n, rate: ok / n });
  const byMove = {};
  for (const m of moves) {
    const x = (byMove[m.move] ??= { n: 0, ok: 0 });
    x.n += m.n;
    x.ok += m.rate * m.n;
  }
  const best = Object.entries(byMove).filter(([, x]) => x.n >= sig.few).sort((a, b) => b[1].ok / b[1].n - a[1].ok / a[1].n)[0];
  if (best) say('parent.week.helped', { move: { key: `parent.move.${best[0]}` } });

  // 7. The real game of #30, and a thing to play together.
  for (const a of data.practice?.activities ?? []) if (a.real && W.acts[a.id]?.commits) say(a.real);
  const together = TOGETHER.map((id) => [id, W.acts[id]?.minutes ?? 0]).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1])[0];
  if (together) say(`parent.week.together.${together[0]}`);

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
