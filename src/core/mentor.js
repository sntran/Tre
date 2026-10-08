// The mentor: the person who gives a task works with the child (docs/MENTOR.md; rules 31 to 41 of
// docs/DESIGN.md). After each commit, and on idle time, the mentor of the task takes what it
// observed, makes a diagnosis, and chooses one move. Pure functions, no DOM: the session keeps the
// state of each mentor and does the move in the world.
//
//   observations: the result and the size of the error, the time to the first action and of the
//     try, resets, leaving the station, misses in a row, the misses of the same fact, P(L), and the
//     moves that helped this child before (the memory, kept in the profile).
//   diagnoses: unsure (no action at the start), missing (off by exactly one part), units (as many
//     parts as the target: the child counted the things, not their units), slip (a small error
//     after a normal time), counting (right, but slow for the size), guess (fast and far off, or
//     the mashing flag), stuck (the same fact missed twice), frustrated (misses in a row, or
//     leaving after a miss), bored (fast clean commits in a row), ready (fast and right with a high
//     P(L)), miss (another miss), and ok (right).
//   moves: wait, show, mark, cue (Nghé points), demo (on another instance), smaller, share,
//     picture (another station), raise, break, tryFirst (a wave before any try), offer.
//   The help level is contingent: after a miss, one level more; after a success, one level less;
//   at mastery the person only watches (Wood, Wood & Middleton 1978).

export const MOVES = Object.freeze(['wait', 'show', 'mark', 'cue', 'demo', 'smaller', 'share', 'picture', 'raise', 'break', 'tryFirst', 'offer']);
// The moves that change the task in the hands of the child (the person does a part of it).
export const SHARES = Object.freeze(['smaller', 'share']);

// A new mentor for a task (key: the task id of its skill events).
export function newMentor(key) {
  return {
    key,
    level: 0, // the help level now (0: only watch)
    misses: 0, // misses in a row
    clean: 0, // fast clean commits in a row
    facts: {}, // the misses of each fact (the target of the try)
    repeat: { diag: null, n: 0 }, // the same diagnosis in a row
    helped: {}, // the diagnoses that got a move other than wait in this task
    tried: false, // the child committed at least one time
    raised: false, // the person gave a bigger task in this task
    lastDiag: null,
    lastSolved: null,
    pending: null, // the last move, until the next commit says whether it helped
    shown: false, // the person showed the action (unsure) in this task
    offered: false, // the person offered help after a miss
    toldTry: false, // the person said to try first (a wave before any act) in this task
    checked: false, // the child checked since the last change
    checks: [], // the checks since the last commit: { changed }
  };
}

// An empty memory of a mentor for a child (profile.mentors[key]).
export function newMemory() {
  return { worked: {}, tried: {}, errors: {}, selfFix: 0, lift: 0 };
}

const count = (map, a, b) => {
  const m = (map[a] ??= {});
  m[b] = (m[b] ?? 0) + 1;
};

// What the commit shows. input: parts (the sizes or counts of the try), target, solved, mashing,
// resets, timeS (seconds of the try, from the first action to the commit; fast is less than
// fastUnit for each unit of the target), sizes (the sizes of the
// things on the pile), fact (the key of the fact: the target), left (the child left the station
// soon after the last miss), allTaken (the child brought all the things of the task). fam: the
// family of the task (data/world/mentors.json).
export function readCommit(input, fam) {
  const parts = input.parts ?? [];
  // The units of the try: the target (each kind of the basket counts), or the parts.
  const units = fam.reader === 'sum' ? Math.max(1, input.target ?? 1) : fam.reader === 'each' ? Math.max(1, (input.target ?? 1) * parts.length) : Math.max(1, parts.length);
  const fast = (input.timeS ?? Infinity) < fam.fastUnit * units;
  const out = { solved: Boolean(input.solved), fast, slow: false, error: 0, missing: false, units: false, far: false };
  if (fam.reader === 'sum') {
    const total = parts.reduce((a, b) => a + b, 0);
    out.error = total - (input.target ?? 0);
    out.slow = out.solved && (input.timeS ?? 0) > fam.slowUnit * Math.max(1, input.target ?? 1);
    // The things were counted, not their units: as many things as the target, or all the things of
    // the task for a target that is less than their units, with a thing of more than one unit.
    out.units = !out.solved && parts.some((p) => p > 1) && (parts.length === input.target || (input.allTaken && total > input.target && parts.length < input.target));
    // Off by exactly one part of the sizes that the child could choose.
    out.missing = !out.solved && !out.units && (input.sizes ?? []).includes(Math.abs(out.error));
    out.far = Math.abs(out.error) > fam.slip;
  } else if (fam.reader === 'each') {
    const worst = parts.reduce((a, c) => Math.max(a, Math.abs(c - (input.target ?? 0))), 0);
    out.error = worst;
    out.slow = out.solved && (input.timeS ?? 0) > fam.slowUnit * Math.max(1, (input.target ?? 1) * parts.length);
    out.far = worst > fam.slip;
  } else {
    out.far = !out.solved;
  }
  return out;
}

// The diagnosis of a commit. st: the mentor before this commit. pL: P(L) of the skill (or null).
export function diagnose(input, st, fam, cfg) {
  const obs = readCommit(input, fam);
  const pL = input.pL ?? 0;
  // The signs of mashing on a miss: a guess (a right try with them is no evidence, and no miss).
  if (input.mashing && !obs.solved) return 'guess';
  if (!obs.solved && (st.misses + 1 >= fam.frustrated || (input.left && st.misses >= 1))) return 'frustrated';
  if (obs.solved) {
    const clean = obs.fast && !(input.resets > 0) ? st.clean + 1 : 0;
    if (clean >= fam.bored) return 'bored';
    if (obs.fast && pL >= cfg.ready) return 'ready';
    if (obs.slow) return 'counting';
    return 'ok';
  }
  const fact = String(input.fact ?? input.target ?? '');
  if ((st.facts[fact] ?? 0) + 1 >= 2) return 'stuck';
  if (fam.reader === 'sum') {
    if (obs.units) return 'units';
    if (obs.missing) return 'missing';
    if (!obs.far && !obs.fast) return 'slip';
    if (obs.fast && obs.far) return 'guess';
    return 'miss';
  }
  if (fam.reader === 'each') {
    if (!obs.far && !obs.fast) return 'slip';
    if (obs.fast && obs.far) return 'guess';
    return 'miss';
  }
  return obs.fast ? 'guess' : 'miss';
}

// The contingent help level after a commit: one less after a success, one more after a miss, and
// none at mastery.
export function shiftLevel(level, solved, pL, cfg) {
  if ((pL ?? 0) >= cfg.mastery) return 0;
  return solved ? Math.max(0, level - 1) : Math.min(cfg.top, level + 1);
}

// The stage of the handover of the checking: 0 (the person marks what went wrong), 1 (the person
// first waits while the child looks), 2 (the person only watches).
export function handoverStage(memory, cfg) {
  const [first, last] = cfg.handover ?? [1, 3];
  const n = memory?.selfFix ?? 0;
  return n >= last ? 2 : n >= first ? 1 : 0;
}

// The move for a diagnosis. Return { move, remembered }. A move that helped this child before for
// this diagnosis comes first (once in a task, as the first help for it).
export function chooseMove(diag, st, memory, fam, cfg, pL = 0) {
  if (diag === 'ok') return { move: 'wait', remembered: false };
  if ((pL ?? 0) >= cfg.mastery && diag !== 'bored' && diag !== 'ready') return { move: 'wait', remembered: false };
  const ladder = fam.ladders[diag] ?? fam.ladders.miss ?? ['wait'];
  const worked = memory?.worked?.[diag];
  if (worked && !st.helped[diag]) {
    const best = Object.entries(worked).filter(([m, n]) => n > 0 && ladder.includes(m) && m !== 'wait').sort((a, b) => b[1] - a[1])[0];
    if (best) return { move: best[0], remembered: true };
  }
  // A miss climbs the ladder with the help level; the other diagnoses climb with each repeat.
  const success = diag === 'bored' || diag === 'ready' || diag === 'counting';
  const again = st.repeat.diag === diag ? st.repeat.n : 0;
  const i = success || diag === 'frustrated' ? again : Math.max(0, st.level - 1);
  return { move: ladder[Math.min(ladder.length - 1, i)], remembered: false };
}

// Close the last move with the result of this commit: the record of the log (help), and the memory
// of what helped. Return the record, or null.
function closePending(st, memory, solved, efficient) {
  const p = st.pending;
  st.pending = null;
  if (!p) return null;
  count(memory.tried, p.diagnosis, p.move);
  if (solved) count(memory.worked, p.diagnosis, p.move);
  return { task: st.key, diagnosis: p.diagnosis, move: p.move, pBefore: p.pBefore, success: Boolean(solved), efficient: Boolean(efficient) };
}

// A commit. input: as readCommit, with efficient and pL. Return { diagnosis, move, level,
// remembered, delay (seconds to wait before the move: the child looks first), help (the record
// of the last move with its outcome, or null), checks (the checks since the last commit) }.
export function onCommit(st, memory, input, fam, cfg) {
  const help = closePending(st, memory, input.solved, input.efficient);
  const diag = diagnose(input, st, fam, cfg);
  const obs = readCommit(input, fam);
  const pL = input.pL ?? 0;
  st.level = shiftLevel(st.level, obs.solved, pL, cfg);
  st.repeat = st.repeat.diag === diag ? { diag, n: st.repeat.n + 1 } : { diag, n: 0 };
  let { move, remembered } = chooseMove(diag, st, memory, fam, cfg, pL);
  // The counts after the diagnosis: misses in a row, fast clean runs, and the misses of each fact.
  const fact = String(input.fact ?? input.target ?? '');
  if (obs.solved) {
    st.misses = 0;
    st.clean = obs.fast && !(input.resets > 0) ? st.clean + 1 : 0;
  } else {
    st.misses += 1;
    st.clean = 0;
    st.facts[fact] = (st.facts[fact] ?? 0) + 1;
    memory.errors[diag] = (memory.errors[diag] ?? 0) + 1;
  }
  // Boredom got its answer: a new run starts.
  if (diag === 'bored') st.clean = 0;
  // The handover of the checking: a mark after a miss waits while the child looks, and at last
  // the person only watches.
  let delay = 0;
  if (move === 'mark' && !obs.solved) {
    const stage = handoverStage(memory, cfg);
    if (stage === 2) move = 'wait';
    else if (stage === 1) delay = fam.look;
  }
  // A bigger task comes once in a task.
  if (move === 'raise' && st.raised) move = 'wait';
  if (move === 'raise') st.raised = true;
  if (move !== 'wait') st.helped[diag] = true;
  st.tried = true;
  st.lastDiag = diag;
  st.lastSolved = obs.solved;
  st.offered = false;
  st.pending = { diagnosis: diag, move, pBefore: input.pL ?? null };
  const checks = st.checks;
  st.checks = [];
  st.checked = false;
  return { diagnosis: diag, move, level: st.level, remembered, delay, help, checks };
}

// Idle time. seconds: the time with no action (since the start of the task, or since the last
// commit); acted: the child did something in this task. Return { diagnosis, move } or null.
export function onIdle(st, { seconds, acted }, fam) {
  if (!acted && !st.tried && !st.shown && seconds >= fam.idleStart) {
    st.shown = true;
    return { diagnosis: 'unsure', move: 'show' };
  }
  if (st.tried && st.lastSolved === false && !st.offered && seconds >= fam.offerAfter) {
    st.offered = true;
    return { diagnosis: st.lastDiag, move: 'offer' };
  }
  return null;
}

// A wave: the child calls the person. A wave always helps (#64). At the first wave before any act
// of the child in the task, the person says to try first and watches (no hint). At a second wave
// before any act (the child is stuck), after an act but before a try, or after a right try, the
// person shows the next step (show: points at the next thing and says it).
// After a miss, the next move of the ladder; a move that does not help (a wait, the offer, try
// first) is the show. acted: the child did something in the task. Return { when, diagnosis, move }.
const NO_HELP = new Set(['wait', 'offer', 'tryFirst']);
export function onWave(st, memory, fam, cfg, pL = 0, acted = false) {
  if (!st.tried && !acted && !st.toldTry) {
    st.toldTry = true;
    return { when: 'before', diagnosis: 'unsure', move: 'tryFirst' };
  }
  if (!st.tried || st.lastSolved) return { when: st.tried ? 'after' : 'before', diagnosis: 'unsure', move: 'show' };
  st.level = Math.min(cfg.top, st.level + 1);
  const diag = st.lastDiag ?? 'miss';
  let { move } = chooseMove(diag, { ...st, helped: {} }, null, fam, cfg, pL);
  // A wave always gets a line that shows the next step (#64): never a wait, an offer, or the picture
  // of another station.
  if (NO_HELP.has(move) || move === 'picture') move = 'show';
  st.helped[diag] = true;
  st.pending = { diagnosis: diag, move, pBefore: pL ?? null };
  return { when: 'after', diagnosis: diag, move };
}

// A check before a commit (the child looks at the place, walks along it, counts the parts).
export function onCheck(st) {
  st.checked = true;
  st.checks.push({ changed: false });
}

// A change of the try after a check that takes a thing away from the place (or changes its kind):
// a self-correction (#64: a put is not). Return true, and the memory counts it (the handover of the
// checking).
export function onChange(st, memory) {
  if (!st.checked) return false;
  st.checked = false;
  const last = st.checks[st.checks.length - 1];
  if (last) last.changed = true;
  memory.selfFix = (memory.selfFix ?? 0) + 1;
  return true;
}

// The target of a demonstration on another instance: near the target of the task, never the same
// (a smaller related one when it can be).
export function demoTarget(target, sizes = [1]) {
  const small = Math.min(...sizes);
  const t = target > small * 2 ? target - small : target + small;
  return t === target ? target + 1 : t;
}

// The parts of a demonstration: the biggest parts first, then counting on (each part with the
// running total, as words). Return [{ size, total }].
export function demoParts(target, sizes = [1]) {
  const out = [];
  let total = 0;
  const desc = [...new Set(sizes)].sort((a, b) => b - a);
  while (total < target) {
    const size = desc.find((s) => total + s <= target) ?? desc[desc.length - 1];
    total += size;
    out.push({ size, total });
    if (out.length > 40) break;
  }
  return out;
}

// The parts that the person puts for the child: smaller (one part), or share (about half). Never
// the whole task: the sum stays under what is left. pile: the sizes on the pile; have: the sum on
// the place now. Return the sizes, in order.
export function shareParts(move, target, have, pile) {
  const left = target - have;
  if (left <= 1) return [];
  const goal = move === 'smaller' ? left - 1 : Math.floor(left / 2);
  const free = [...pile].sort((a, b) => b - a);
  const out = [];
  let sum = 0;
  for (const s of free) {
    if (sum + s > goal) continue;
    out.push(s);
    sum += s;
    if (move === 'smaller') break;
  }
  return out;
}
