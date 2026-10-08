// The learning log: what the child did, kept on the device in the profile, so that Tre can find
// out what works (docs/DESIGN.md, "Learning measurement"). Pure functions on plain data, no DOM.
//
// The log: { v, tz, first, day, events, rollups, playMs }.
//   tz: the offset of the local time of the device (minutes, as Date#getTimezoneOffset), for the
//   days. first: the first day of the log; day: the day of the raw events. events: the raw events
//   of that day. rollups: { [variant]: a roll-up } for the days before. playMs: the time of play.
// An event: { type, t, variant, ... } with the fields of its kind in data/config/learnlog.json:
// numbers, times, ids, and words only. At the first event of a new day, the raw events of the day
// before roll up into the roll-ups, and they go.
//
// The nine questions of "What good means" are one pure function each, on the roll-ups.

export const DAY_MS = 86400000;
const LENGTHS = [5, 10, 20, 40]; // minutes: the buckets of the length of a session

export function createLog(tz = 0) {
  return { v: 1, tz, first: null, day: null, events: [], rollups: {}, playMs: 0 };
}

// The day of a time (whole days since 1970 in the local time of the device).
export const dayOf = (t, tz = 0) => Math.floor((t - tz * 60000) / DAY_MS);

// Check an event against the schema. Throw an error that names the bad field.
export function checkEvent(ev, schema) {
  const fail = (what) => { throw new Error(`learning log: ${what}`); };
  if (!ev || typeof ev !== 'object' || Array.isArray(ev)) fail('event');
  const kind = schema.kinds[ev.type];
  if (!kind) fail(`kind ${ev.type}`);
  const fields = { t: 'time', variant: 'id', ...kind };
  for (const key of Object.keys(ev)) if (key !== 'type' && !(key in fields)) fail(`${ev.type}.${key} is not in the schema`);
  for (const [key, spec] of Object.entries(fields)) {
    const v = ev[key];
    const nullable = typeof spec === 'string' && spec.endsWith('?');
    if (v === null && nullable) continue;
    if (v === undefined) fail(`${ev.type}.${key} is missing`);
    const base = typeof spec === 'string' ? spec.replace('?', '') : null;
    const num = (x) => typeof x === 'number' && Number.isFinite(x);
    const ok = Array.isArray(spec) ? spec.includes(v)
      : base === 'time' ? num(v) && v >= 0
        : base === 'id' ? typeof v === 'string' && /^[a-z0-9][a-z0-9.:_-]{0,39}$/.test(v)
          : base === 'bool' ? typeof v === 'boolean'
            : base === 'count' ? Number.isInteger(v) && v >= 0
              : base === 'number' ? num(v)
                : base === 'prob' ? num(v) && v >= 0 && v <= 1
                  : base === 'numbers' ? Array.isArray(v) && v.length <= 50 && v.every(num)
                    : false;
    if (!ok) fail(`${ev.type}.${key}`);
  }
  return true;
}

// Add an event. The events of a day before roll up first. Too many events in one day roll up too.
export function logEvent(log, ev, schema) {
  checkEvent(ev, schema);
  const day = dayOf(ev.t, log.tz);
  if (log.day !== null && day !== log.day && log.events.length) rollDay(log, schema);
  log.first ??= day;
  log.day = day;
  log.events.push(ev);
  if (log.events.length >= (schema.maxEvents ?? 2000)) rollDay(log, schema);
  return ev;
}

// Roll the raw events up into the roll-ups, and drop them.
export function rollDay(log, schema) {
  const r = rollupEvents(log.events, optionsOf(log, schema));
  for (const [variant, roll] of Object.entries(r)) log.rollups[variant] = mergeRollups(log.rollups[variant] ?? emptyRollup(), roll);
  log.events = [];
  log.day = null;
}

const optionsOf = (log, schema) => ({ tz: log.tz, first: log.first ?? 0, mastered: schema.mastered ?? 0.95, shortHint: schema.shortHint ?? 1, signals: schema.signals, activities: schema.activities });

// The roll-ups of the stored days and of the raw events of today, together.
export function currentRollups(log, schema) {
  const out = structuredClone(log.rollups);
  const today = rollupEvents(log.events, optionsOf(log, schema));
  for (const [variant, roll] of Object.entries(today)) out[variant] = mergeRollups(out[variant] ?? emptyRollup(), roll);
  return out;
}

export function emptyRollup() {
  return {
    days: 0,
    skills: {},
    reviews: { 7: [0, 0], 14: [0, 0], 30: [0, 0] },
    exams: { n: 0, sp: 0, sc: 0, spc: 0, spp: 0, scc: 0 },
    predictions: { n: 0, skipped: 0, err: 0, curve: [] },
    sessions: { n: 0, ms: 0, endedBy: { device: 0, parent: 0, child: 0 }, weeks: {}, afterQuest: 0, stops: {}, first: {}, lengths: [0, 0, 0, 0, 0] },
    // The moves of the mentors: for each diagnosis and move, [moves, next commits right, efficient].
    helps: {},
    checks: [0, 0], // checks, and checks with a change after them (self-corrections)
    asks: { before: 0, after: 0 },
    // The weeks of play (#25): { [week]: a week } (weekOf), for the weekly note of the parents.
    weeks: {},
  };
}

function emptySkill() {
  return { commits: 0, successes: 0, efficient: 0, firsts: 0, firstSuccesses: 0, mashing: 0, afterMash: [0, 0], hints: {}, hintsShort: 0, explore: 0, recent: [], curve: [], masteredAt: null, retries: 0, harder: 0, lastMash: false, firstOk: null };
}

// Add one point to a curve of [day, n, value] (one point for each day).
function addPoint(curve, day, value) {
  const p = curve.find((x) => x[0] === day);
  if (p) {
    p[1] += 1;
    p[2] += value;
  } else {
    curve.push([day, 1, value]);
    curve.sort((a, b) => a[0] - b[0]);
  }
}

// The roll-ups of a list of raw events: { [variant]: roll-up }.
export function rollupEvents(events, { tz = 0, first = 0, mastered = 0.95, shortHint = 1, signals = SIGNALS, activities = {} } = {}) {
  const out = {};
  const days = {};
  for (const ev of [...events].sort((a, b) => a.t - b.t)) {
    const r = (out[ev.variant] ??= emptyRollup());
    const day = dayOf(ev.t, tz) - first;
    (days[ev.variant] ??= new Set()).add(day);
    if (ev.type === 'attempt') {
      const s = (r.skills[ev.skill] ??= emptySkill());
      if (ev.phase === 'explore') {
        s.explore += 1;
        continue;
      }
      const ok = ev.success ? 1 : 0;
      if (!s.commits) s.firstOk = ok;
      s.commits += 1;
      s.successes += ok;
      s.efficient += ev.efficient ? 1 : 0;
      if (ev.first) {
        s.firsts += 1;
        s.firstSuccesses += ok;
      }
      if (s.lastMash) {
        s.afterMash[0] += 1;
        s.afterMash[1] += ok;
      }
      s.lastMash = ev.mashing;
      s.mashing += ev.mashing ? 1 : 0;
      const h = (s.hints[ev.hint] ??= [0, 0]);
      h[0] += 1;
      h[1] += ok;
      if (ev.hint > 0 && ev.hintSeen !== null && ev.hintSeen < shortHint) s.hintsShort += 1;
      s.recent = [...s.recent, ok].slice(-10);
      addPoint(s.curve, day, ok);
      if (s.masteredAt === null && ev.pBefore !== null && ev.pAfter !== null && ev.pBefore < mastered && ev.pAfter >= mastered) s.masteredAt = ev.play;
      s.retries += ev.retry ? 1 : 0;
      s.harder += ev.harder ? 1 : 0;
    } else if (ev.type === 'review') {
      const b = r.reviews[ev.gap <= 7 ? 7 : ev.gap <= 14 ? 14 : 30];
      b[0] += 1;
      b[1] += ev.result ? 1 : 0;
    } else if (ev.type === 'exam') {
      const c = ev.correct ? 1 : 0;
      const e = r.exams;
      e.n += 1;
      e.sp += ev.p;
      e.sc += c;
      e.spc += ev.p * c;
      e.spp += ev.p * ev.p;
      e.scc += c;
    } else if (ev.type === 'prediction') {
      const p = r.predictions;
      p.n += 1;
      if (ev.guess === null) p.skipped += 1;
      else {
        const err = Math.abs(ev.guess - ev.used);
        p.err += err;
        addPoint(p.curve, day, err);
      }
    } else if (ev.type === 'help') {
      const h = ((r.helps[ev.diagnosis] ??= {})[ev.move] ??= [0, 0, 0]);
      h[0] += 1;
      h[1] += ev.success ? 1 : 0;
      h[2] += ev.efficient ? 1 : 0;
    } else if (ev.type === 'check') {
      r.checks[0] += 1;
      r.checks[1] += ev.changed ? 1 : 0;
    } else if (ev.type === 'ask') {
      r.asks[ev.when] += 1;
    } else if (ev.type === 'session') {
      const s = r.sessions;
      const ms = Math.max(0, ev.end - ev.start);
      s.n += 1;
      s.ms += ms;
      s.endedBy[ev.endedBy] += 1;
      const week = Math.floor(day / 7);
      s.weeks[week] = (s.weeks[week] ?? 0) + 1;
      s.afterQuest += ev.afterQuest ? 1 : 0;
      // A stop is a stop of the child: the time limit (parent) or a closed tab (device) is not (#58).
      if (ev.place && ev.endedBy === 'child') s.stops[ev.place] = (s.stops[ev.place] ?? 0) + 1;
      s.first[ev.first] = (s.first[ev.first] ?? 0) + 1;
      const min = ms / 60000;
      const i = LENGTHS.findIndex((x) => min < x);
      s.lengths[i < 0 ? LENGTHS.length : i] += 1;
    }
  }
  for (const [variant, set] of Object.entries(days)) out[variant].days = set.size;
  for (const [variant, weeks] of Object.entries(weekRollups(events, { tz, signals, activities }))) out[variant].weeks = weeks;
  return out;
}

const addMap = (a, b) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
};
const addPairs = (a, b) => [a[0] + b[0], a[1] + b[1]];
function mergeCurves(a, b) {
  const out = a.map((p) => [...p]);
  for (const [day, n, v] of b) {
    const p = out.find((x) => x[0] === day);
    if (p) {
      p[1] += n;
      p[2] += v;
    } else out.push([day, n, v]);
  }
  return out.sort((x, y) => x[0] - y[0]);
}

// Two roll-ups as one (a: the older one). The same numbers as the roll-up of all their events.
export function mergeRollups(a, b) {
  const out = emptyRollup();
  out.days = a.days + b.days;
  for (const id of new Set([...Object.keys(a.skills), ...Object.keys(b.skills)])) {
    const x = a.skills[id] ?? emptySkill();
    const y = b.skills[id] ?? emptySkill();
    const hints = {};
    for (const k of new Set([...Object.keys(x.hints), ...Object.keys(y.hints)])) hints[k] = addPairs(x.hints[k] ?? [0, 0], y.hints[k] ?? [0, 0]);
    // The first commit of b comes after a mashing commit at the end of a.
    const afterMash = addPairs(addPairs(x.afterMash, y.afterMash), x.lastMash && y.commits ? [1, y.firstOk] : [0, 0]);
    out.skills[id] = {
      commits: x.commits + y.commits,
      successes: x.successes + y.successes,
      efficient: x.efficient + y.efficient,
      firsts: x.firsts + y.firsts,
      firstSuccesses: x.firstSuccesses + y.firstSuccesses,
      mashing: x.mashing + y.mashing,
      afterMash,
      hints,
      hintsShort: x.hintsShort + y.hintsShort,
      explore: x.explore + y.explore,
      recent: [...x.recent, ...y.recent].slice(-10),
      curve: mergeCurves(x.curve, y.curve),
      masteredAt: x.masteredAt ?? y.masteredAt,
      retries: x.retries + y.retries,
      harder: x.harder + y.harder,
      lastMash: y.commits ? y.lastMash : x.lastMash,
      firstOk: x.commits ? x.firstOk : y.firstOk,
    };
  }
  for (const k of [7, 14, 30]) out.reviews[k] = addPairs(a.reviews[k], b.reviews[k]);
  out.exams = addMap(a.exams, b.exams);
  out.predictions = { n: a.predictions.n + b.predictions.n, skipped: a.predictions.skipped + b.predictions.skipped, err: a.predictions.err + b.predictions.err, curve: mergeCurves(a.predictions.curve, b.predictions.curve) };
  const s = a.sessions;
  const t = b.sessions;
  out.sessions = {
    n: s.n + t.n,
    ms: s.ms + t.ms,
    endedBy: addMap(s.endedBy, t.endedBy),
    weeks: addMap(s.weeks, t.weeks),
    afterQuest: s.afterQuest + t.afterQuest,
    stops: addMap(s.stops, t.stops),
    first: addMap(s.first, t.first),
    lengths: s.lengths.map((v, i) => v + t.lengths[i]),
  };
  // A roll-up of an older version has no helps, checks, or asks.
  for (const x of [a.helps ?? {}, b.helps ?? {}]) {
    for (const [d, moves] of Object.entries(x)) {
      for (const [m, v] of Object.entries(moves)) {
        const o = ((out.helps[d] ??= {})[m] ??= [0, 0, 0]);
        v.forEach((n, i) => { o[i] += n; });
      }
    }
  }
  out.checks = addPairs(a.checks ?? [0, 0], b.checks ?? [0, 0]);
  out.asks = addMap(a.asks ?? { before: 0, after: 0 }, b.asks ?? { before: 0, after: 0 });
  out.weeks = deepAdd(a.weeks ?? {}, b.weeks ?? {});
  return out;
}

// All the variants together.
export function allVariants(rollups) {
  return Object.values(rollups).reduce((a, b) => mergeRollups(a, b), emptyRollup());
}

// The weeks of play (#25; docs/LEARNLOG.md, "The weekly note"). A week starts on Monday, in the
// local time of the device: weekOf(t, tz) is the number of the week since 1970.
export const weekOf = (t, tz = 0) => Math.floor((dayOf(t, tz) + 3) / 7);

// The definitions of the signals (data/config/learnlog.json, signals): seconds and counts.
export const SIGNALS = Object.freeze({ fast: 3, idle: 60, gap: 300, leave: 20, missRun: 3, hop: 60, near: 1, recall: [2, 4, 6, 10, 20], few: 3 });

// The activity of a task or a mentor key (data/config/learnlog.json, activities): a task id, or a
// beginning of task ids that ends with "-"; the task itself when the list does not have it.
export function activityOf(task, activities = {}) {
  if (activities[task]) return activities[task];
  const pre = Object.keys(activities).filter((k) => k.endsWith('-') && String(task).startsWith(k)).sort((a, b) => b.length - a.length)[0];
  return pre ? activities[pre] : task;
}

// How far a commit was from the target, in groups: 0 is exact, at most 1 is a near miss (off by
// one group), more is a far miss. parts: the sizes of the commit; target: the number; null when the
// event has no target.
export function offOf(parts, target) {
  if (!Array.isArray(parts) || !parts.length || typeof target !== 'number') return null;
  const sum = parts.reduce((a, b) => a + b, 0);
  const group = Math.max(1, Math.abs(parts[parts.length - 1]));
  return Math.abs(sum - target) / group;
}

const emptyAct = () => ({ commits: 0, ok: 0, near: 0, far: 0, fast: 0, idle: 0, resets: 0, missRuns: 0, again: 0, changed: 0, left: 0, sessions: 0, self: 0, sent: 0, first: 0, stops: 0, sets: 0, stay: 0, minutes: 0 });
const emptyWeek = () => ({
  sessions: 0, self: 0, sent: 0, minutes: 0, hops: 0,
  day: [0, 0, 0, 0, 0, 0, 0], // minutes of play on each day of the week, Monday first
  acts: {},
  // Learning to learn: checks before a commit, self-corrections, waves before and after a try,
  // predictions and their error, the moves of the people, and the moves that check for the child.
  l2l: { checks: 0, selfFix: 0, before: 0, after: 0, predN: 0, predErr: 0, helps: 0, marks: 0 },
  // The moves of the people by activity: { [activity]: { [move]: [moves, right next commits] } },
  // so that the note can say who helped, and how (#42).
  moves: {},
  recall: [0, 0, 0, 0, 0, 0], // the seconds of right commits of the facts of the table, in buckets
  quiz: [0, 0], // the short questions of the teacher on the facts: [questions, right]
  quizKnown: [0, 0], // the same, on the facts that are confident in the world
});

// Add two plain values: numbers add, lists of numbers add item by item, objects add key by key.
export function deepAdd(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a + b;
  if (Array.isArray(a) && Array.isArray(b)) return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = k in a ? deepAdd(a[k], v) : structuredClone(v);
    return out;
  }
  return b ?? a;
}

const MARKS = new Set(['show', 'mark', 'cue', 'demo']); // the people check or show for the child

// The weeks of the raw events of a day: { [variant]: { [week]: a week } }. The attempts of a
// session are the attempts between its start and its end. The signals of an activity:
//   commits, ok: the commits, and the right ones.
//   near, far: the misses off by at most one group, and the misses farther off.
//   fast, idle: the commits less than signals.fast seconds after the commit before (careless), and
//     the commits more than signals.idle seconds after it (a long pause).
//   resets, missRuns: the resets of the commits, and the runs of signals.missRun misses in a row.
//   again, changed, left: after a miss, the next commit of the same activity (and with other
//     parts), or no more commit of it: the session ended or the child went to another activity
//     within signals.leave seconds.
//   sessions, self, sent, first, stops: the sessions with commits of the activity (started by the
//     child or by a practice link), the sessions that it began, and the sessions that it ended.
//   sets, stay: the sets of a practice done, and the times the child played on after a set.
//   minutes: the time between the commits of the activity (each gap at most signals.gap seconds);
//     in a session of a practice link, the whole time of the session goes to its activity.
// hops: a commit of another activity less than signals.hop seconds after a commit.
export function weekRollups(events, { tz = 0, signals = SIGNALS, activities = {} } = {}) {
  const sig = { ...SIGNALS, ...signals };
  const out = {};
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const byVariant = {};
  for (const ev of sorted) (byVariant[ev.variant] ??= []).push(ev);
  for (const [variant, list] of Object.entries(byVariant)) {
    const weeks = (out[variant] = {});
    const W = (t) => (weeks[weekOf(t, tz)] ??= emptyWeek());
    const act = (w, a) => (w.acts[a] ??= emptyAct());
    const sessions = list.filter((e) => e.type === 'session');
    const sessionOf = (t) => sessions.find((s) => s.start <= t && t <= s.end) ?? null;
    const seen = new Map(); // a session: { acts: Set, first, last, lastT }
    let prev = null; // the last commit: { a, t, ok, parts, session }
    const missRun = {};
    const closeMiss = (p, how) => {
      const w = W(p.t);
      act(w, p.a)[how] += 1;
    };
    for (const ev of list) {
      const w = W(ev.t);
      if (ev.type === 'attempt' && ev.phase === 'commit') {
        const a = activityOf(ev.task, activities);
        const r = act(w, a);
        const s = sessionOf(ev.t);
        const ok = Boolean(ev.success);
        r.commits += 1;
        r.ok += ok ? 1 : 0;
        r.resets += ev.resets ?? 0;
        const off = ok ? 0 : (ev.off ?? offOf(ev.parts, ev.target));
        if (!ok && off !== null) r[off <= sig.near ? 'near' : 'far'] += 1;
        // The signals that join two commits count only within one session (a day of the roll-up
        // ends with its sessions), so that the roll-ups of the days add up to the roll-up of all.
        const inSession = Boolean(prev && s && prev.session === s);
        const last = inSession && prev.a === a ? prev : null;
        if (last) {
          const secs = (ev.t - last.t) / 1000;
          if (secs < sig.fast) r.fast += 1;
          if (secs > sig.idle) r.idle += 1;
          // The time of a session of a practice link goes to its activity at the end of the session.
          if (!s?.practice) r.minutes += Math.min(secs, sig.gap) / 60;
          if (ok && String(ev.skill).startsWith('math.mul')) {
            const i = sig.recall.findIndex((x) => secs <= x);
            w.recall[i < 0 ? sig.recall.length : i] += 1;
          }
        }
        // After a miss: the same activity again (with other parts or not), or another one soon.
        if (inSession && !prev.ok) {
          if (prev.a === a) closeMiss(prev, JSON.stringify(prev.parts) === JSON.stringify(ev.parts) ? 'again' : 'changed');
          else if ((ev.t - prev.t) / 1000 < sig.leave) closeMiss(prev, 'left');
        }
        if (inSession && prev.a !== a && (ev.t - prev.t) / 1000 < sig.hop) w.hops += 1;
        if (!inSession) for (const k of Object.keys(missRun)) delete missRun[k];
        missRun[a] = ok ? 0 : (missRun[a] ?? 0) + 1;
        if (missRun[a] === sig.missRun) r.missRuns += 1;
        if (s) {
          const k = seen.get(s) ?? { acts: new Set(), first: a, last: a, lastT: ev.t };
          k.acts.add(a);
          k.last = a;
          k.lastT = ev.t;
          seen.set(s, k);
        }
        prev = { a, t: ev.t, ok, parts: ev.parts, session: s };
      } else if (ev.type === 'session') {
        const k = seen.get(ev);
        // A miss as the last commit of a session, a little before its end: the child left. Only the
        // child ends a session by a choice; the time limit (parent) or a closed tab (device) is no
        // stop of the child (#58).
        const byChild = ev.endedBy === 'child';
        if (byChild && prev && !prev.ok && prev.session === ev && (ev.end - prev.t) / 1000 < sig.leave) closeMiss(prev, 'left');
        const min = Math.max(0, ev.end - ev.start) / 60000;
        w.sessions += 1;
        w.minutes += min;
        w[ev.practice ? 'sent' : 'self'] += 1;
        w.day[(dayOf(ev.start, tz) + 3) % 7] += min;
        if (k) {
          for (const a of k.acts) {
            const r = act(w, a);
            r.sessions += 1;
            r[ev.practice ? 'sent' : 'self'] += 1;
          }
          act(w, k.first).first += 1;
          if (byChild) act(w, k.last).stops += 1;
        }
        // A session of a practice link: all its minutes are of its activity, from the start to the
        // end, also with one commit or none (#52).
        if (ev.practice) {
          const r = act(w, ev.practice);
          r.minutes += min;
          if (!k?.acts.has(ev.practice)) {
            r.sessions += 1;
            r.sent += 1;
          }
          if (!k) {
            r.first += 1;
            if (byChild) r.stops += 1;
          }
        }
        prev = null;
      } else if (ev.type === 'set') {
        const r = act(w, ev.activity);
        if (ev.end === 'done') r.sets += 1;
        if (ev.end === 'stay') r.stay += 1;
      } else if (ev.type === 'check') {
        w.l2l.checks += 1;
        w.l2l.selfFix += ev.changed ? 1 : 0;
      } else if (ev.type === 'ask') {
        w.l2l[ev.when] += 1;
      } else if (ev.type === 'help') {
        w.l2l.helps += 1;
        w.l2l.marks += MARKS.has(ev.move) ? 1 : 0;
        const m = ((w.moves[activityOf(ev.task, activities)] ??= {})[ev.move] ??= [0, 0]);
        m[0] += 1;
        m[1] += ev.success ? 1 : 0;
      } else if (ev.type === 'prediction' && ev.guess !== null) {
        w.l2l.predN += 1;
        w.l2l.predErr += Math.abs(ev.guess - ev.used);
      } else if (ev.type === 'quiz') {
        w.quiz[0] += 1;
        w.quiz[1] += ev.correct ? 1 : 0;
        if (ev.known) {
          w.quizKnown[0] += 1;
          w.quizKnown[1] += ev.correct ? 1 : 0;
        }
      }
    }
  }
  return out;
}

const rate = (ok, n) => (n ? ok / n : null);
const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);

// 1. Does the child learn? Time of play to mastery for each skill, the success rate of the last
// ten commits, and the curve (the success rate of each day).
export function qLearn(rollups) {
  const all = allVariants(rollups);
  return Object.entries(all.skills).filter(([, s]) => s.commits).map(([skill, s]) => ({
    skill,
    commits: s.commits,
    toMastery: s.masteredAt,
    recent: mean(s.recent),
    curve: s.curve.map(([day, n, ok]) => ({ day, rate: ok / n, n })),
  }));
}

// 2. Does it stay? Success on a review after about 7, 14, and 30 days.
export function qStay(rollups) {
  const r = allVariants(rollups).reviews;
  return [7, 14, 30].map((days) => ({ days, n: r[days][0], rate: rate(r[days][1], r[days][0]) }));
}

// 3. Does it transfer? The correlation of P(L) with the exam items of the same skill.
export function qTransfer(rollups) {
  const e = allVariants(rollups).exams;
  const vp = e.n * e.spp - e.sp * e.sp;
  const vc = e.n * e.scc - e.sc * e.sc;
  const r = e.n >= 3 && vp > 0 && vc > 0 ? (e.n * e.spc - e.sp * e.sc) / Math.sqrt(vp * vc) : null;
  return { n: e.n, r, correct: rate(e.sc, e.n) };
}

// 4. Is the difficulty right? First-try success on skill tasks against the band of rule 15, and
// how often the child chose the harder version.
export function qDifficulty(rollups, band = [0.8, 0.9]) {
  const skills = Object.values(allVariants(rollups).skills);
  const firsts = skills.reduce((a, s) => a + s.firsts, 0);
  const ok = skills.reduce((a, s) => a + s.firstSuccesses, 0);
  const r = rate(ok, firsts);
  const commits = skills.reduce((a, s) => a + s.commits, 0);
  return { firsts, rate: r, band, inBand: r !== null && r >= band[0] && r <= band[1], harder: skills.reduce((a, s) => a + s.harder, 0), commits };
}

// The mean time of play to mastery (minutes) of each variant.
function masteryByVariant(rollups) {
  const out = {};
  for (const [variant, r] of Object.entries(rollups)) {
    const times = Object.values(r.skills).map((s) => s.masteredAt).filter((x) => x !== null);
    out[variant] = { skills: times.length, minutes: mean(times) };
  }
  return out;
}

// 5. Do predictions help? The error of the predictions over the days, the share of skips, and the
// time to mastery in each variant (with and without the prediction gesture).
export function qPredict(rollups) {
  const p = allVariants(rollups).predictions;
  const made = p.n - p.skipped;
  return { n: p.n, skipped: rate(p.skipped, p.n), error: rate(p.err, made), curve: p.curve.map(([day, n, err]) => ({ day, error: err / n, n })), mastery: masteryByVariant(rollups) };
}

// 6. Do hints help or replace? Success after each hint level, the hints seen for less than a
// second, and the time to mastery in each variant (hints gated or not).
export function qHints(rollups) {
  const skills = Object.values(allVariants(rollups).skills);
  const levels = {};
  for (const s of skills) for (const [k, v] of Object.entries(s.hints)) levels[k] = addPairs(levels[k] ?? [0, 0], v);
  const shown = Object.entries(levels).filter(([k]) => Number(k) > 0).reduce((a, [, v]) => a + v[0], 0);
  return {
    levels: Object.entries(levels).map(([level, [n, ok]]) => ({ level: Number(level), n, rate: rate(ok, n) })).sort((a, b) => a.level - b.level),
    short: rate(skills.reduce((a, s) => a + s.hintsShort, 0), shown),
    mastery: masteryByVariant(rollups),
  };
}

// 7. Is the child playing or mashing? The share of commits with the signs of mashing, and the
// success of the commit after one.
export function qMashing(rollups) {
  const skills = Object.values(allVariants(rollups).skills);
  const commits = skills.reduce((a, s) => a + s.commits, 0);
  const after = skills.reduce((a, s) => addPairs(a, s.afterMash), [0, 0]);
  return { commits, share: rate(skills.reduce((a, s) => a + s.mashing, 0), commits), after: { n: after[0], rate: rate(after[1], after[0]) } };
}

// 8. Does the child want to come back? Sessions each week, retries after a success, sessions
// that went on after the quest ended, and where sessions stop.
export function qComeBack(rollups) {
  const all = allVariants(rollups);
  const s = all.sessions;
  const weeks = Object.keys(s.weeks).map(Number);
  const span = weeks.length ? Math.max(...weeks) - Math.min(...weeks) + 1 : 0;
  return {
    sessions: s.n,
    perWeek: span ? s.n / span : null,
    retries: Object.values(all.skills).reduce((a, x) => a + x.retries, 0),
    afterQuest: rate(s.afterQuest, s.n),
    stops: Object.entries(s.stops).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([place, n]) => ({ place, n })),
  };
}

// 9. Is the session length right? The length, who ended it, and the first action of a session.
export function qSessions(rollups) {
  const s = allVariants(rollups).sessions;
  return { n: s.n, minutes: s.n ? s.ms / s.n / 60000 : null, lengths: [...s.lengths], bounds: [...LENGTHS], endedBy: { ...s.endedBy }, first: { ...s.first } };
}

// Which help works: for each diagnosis and move of the mentors, the moves and the success of the
// next commit (and efficient); the checks and the self-corrections; the waves before and after a try.
export function qHelp(rollups) {
  const all = allVariants(rollups);
  const rows = [];
  for (const [diagnosis, moves] of Object.entries(all.helps)) {
    for (const [move, [n, ok, eff]] of Object.entries(moves)) rows.push({ diagnosis, move, n, rate: rate(ok, n), efficient: rate(eff, n) });
  }
  rows.sort((a, b) => b.n - a.n || a.diagnosis.localeCompare(b.diagnosis) || a.move.localeCompare(b.move));
  return { rows, checks: all.checks[0], selfFix: rate(all.checks[1], all.checks[0]), asks: { ...all.asks } };
}

export const QUESTIONS = Object.freeze({ learn: qLearn, stay: qStay, transfer: qTransfer, difficulty: qDifficulty, predict: qPredict, hints: qHints, mashing: qMashing, comeBack: qComeBack, sessions: qSessions });

// The signs of mashing (rule 22 of the design): the choices come faster than a child can count
// (the middle latency is short), there was no pause after a failure, or the sizes at one place go
// through the sizes in turn (a sweep). latencies: seconds; tries: [{ slot, size }]; pause: the
// seconds of the first choice after a failure, or null. limits: { think, pause } in seconds.
export function isMashing({ latencies = [], tries = [], pause = null } = {}, limits) {
  if (!limits) return false;
  const sorted = [...latencies].sort((a, b) => a - b);
  if (sorted.length >= 2 && sorted[Math.floor((sorted.length - 1) / 2)] < limits.think) return true;
  if (pause !== null && pause !== undefined && pause < limits.pause) return true;
  return hasSweep(tries);
}

// A sweep: at one place, the child tried three or more sizes in a row, each one larger (or each
// one smaller) than the one before.
export function hasSweep(tries) {
  const run = [];
  for (const t of tries) {
    const last = run[run.length - 1];
    if (last && last.slot !== t.slot) run.length = 0;
    run.push(t);
    const sizes = run.map((x) => x.size);
    for (let i = 0; i + 2 < sizes.length; i++) {
      const [a, b, c] = sizes.slice(i, i + 3);
      if ((a < b && b < c) || (a > b && b > c)) return true;
    }
  }
  return false;
}

// The summary that a parent can share: the roll-ups of this device, rounded, with the grade and
// the variant. No name, no age, no device information.
export function summarize(log, { grade, variant }, schema) {
  const round = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);
  const rollups = currentRollups(log, schema);
  const out = { v: 1, grade, days: 0, variant, rollups: {} };
  for (const [name, r] of Object.entries(rollups)) {
    out.days += r.days;
    const skills = {};
    for (const [id, s] of Object.entries(r.skills)) {
      const { lastMash, firstOk, ...rest } = s;
      skills[id] = JSON.parse(JSON.stringify(rest), (k, v) => round(v));
      if (skills[id].masteredAt !== null) skills[id].masteredAt = Math.round(skills[id].masteredAt);
    }
    const sessions = { ...r.sessions, ms: undefined, minutes: Math.round(r.sessions.ms / 60000) };
    delete sessions.ms;
    out.rollups[name] = {
      days: r.days,
      skills,
      reviews: r.reviews,
      exams: JSON.parse(JSON.stringify(r.exams), (k, v) => round(v)),
      predictions: JSON.parse(JSON.stringify(r.predictions), (k, v) => round(v)),
      sessions,
      helps: r.helps,
      checks: r.checks,
      asks: r.asks,
      weeks: JSON.parse(JSON.stringify(r.weeks ?? {}), (k, v) => round(v)),
    };
  }
  return out;
}

// The paths of the fields of a summary that are not in the allowed list (an empty list is good).
// An allowed path is a list of keys with dots between them; * is any one key. A key of the
// summary can have a dot in it (a skill id), so the paths are compared key by key.
export function extraFields(summary, allowed) {
  const pats = allowed.map((a) => a.split('.'));
  const ok = (keys) => pats.some((p) => p.length <= keys.length && p.every((k, i) => k === '*' || k === keys[i]));
  const bad = [];
  const walk = (v, keys) => {
    if (keys.length && ok(keys)) return;
    if (v && typeof v === 'object' && !Array.isArray(v)) for (const [k, x] of Object.entries(v)) walk(x, [...keys, k]);
    else bad.push(keys.join('.'));
  };
  walk(summary, []);
  return bad;
}
