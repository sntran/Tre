import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newMentor, newMemory, diagnose, shiftLevel, onCommit, onIdle, onWave, onCheck, onChange, handoverStage, demoTarget, demoParts, shareParts, chooseMove, MOVES } from '../src/core/mentor.js';
import { load } from './helpers.js';

const cfg = load('data/world/mentors.json');
const vi = load('i18n/vi.json');
const en = load('i18n/en.json');
const sum = cfg.families.groups;
const span = cfg.families.span;
// A try: the parts, the target, and the seconds of the try (normal: two seconds a part).
const tryOf = (parts, target, extra = {}) => ({ parts, target, solved: parts.reduce((a, b) => a + b, 0) === target, timeS: parts.length * 2, sizes: [1, 2, 5], fact: target, pL: 0.4, resets: 0, ...extra });

test('the help level is contingent: down after a success, up after a miss, none at mastery', () => {
  assert.equal(shiftLevel(2, true, 0.4, cfg), 1);
  assert.equal(shiftLevel(0, true, 0.4, cfg), 0);
  assert.equal(shiftLevel(1, false, 0.4, cfg), 2);
  assert.equal(shiftLevel(cfg.top, false, 0.4, cfg), cfg.top);
  assert.equal(shiftLevel(2, false, 0.97, cfg), 0, 'at mastery the person only watches');
  const st = newMentor('event-cart');
  const mem = newMemory();
  onCommit(st, mem, tryOf([2, 2], 7, { fact: 'a' }), sum, cfg);
  assert.equal(st.level, 1);
  onCommit(st, mem, tryOf([5, 1], 7, { fact: 'b' }), sum, cfg);
  assert.equal(st.level, 2);
  onCommit(st, mem, tryOf([5, 2], 7), sum, cfg);
  assert.equal(st.level, 1, 'one level less after the success');
  // At mastery, a miss gets only "wait".
  const m = newMentor('event-cart');
  assert.equal(onCommit(m, newMemory(), tryOf([5, 1], 7, { pL: 0.97 }), sum, cfg).move, 'wait');
});

test('the diagnoses of made-up commits', () => {
  const d = (input, fam = sum, st = newMentor('t')) => diagnose(input, st, fam, cfg);
  // A missing group: the planks are short by exactly one plank size.
  assert.equal(d(tryOf([4, 4], 12, { sizes: [3, 4, 5] }), span), 'missing');
  // The things counted, not their units (an addition in place of a sum of groups): seven nets of stones for seven.
  assert.equal(d(tryOf([2, 2, 1, 2, 2, 1, 2], 7)), 'units');
  // A slip: off by one, after a normal time.
  assert.equal(d(tryOf([5, 1], 7, { sizes: [5, 2] })), 'slip');
  // Slow and right: counting all.
  assert.equal(d(tryOf([1, 1, 1, 1, 1, 1, 1], 7, { timeS: 40 })), 'counting');
  // Fast and far off: a guess; the mashing flag is a guess too.
  assert.equal(d(tryOf([5, 5, 5, 2], 7, { timeS: 1 })), 'guess');
  assert.equal(d(tryOf([5, 2], 7, { mashing: true })), 'guess');
  // The same fact missed twice: stuck.
  const st = newMentor('t');
  onCommit(st, newMemory(), tryOf([5, 5], 7), sum, cfg);
  assert.equal(diagnose(tryOf([5, 5, 5], 7), st, sum, cfg), 'stuck');
  // Misses in a row with fast resets: frustrated; leaving soon after a miss too.
  const f = newMentor('t');
  onCommit(f, newMemory(), tryOf([5, 5], 7, { fact: 'a' }), sum, cfg);
  onCommit(f, newMemory(), tryOf([1], 7, { fact: 'b', resets: 3 }), sum, cfg);
  assert.equal(diagnose(tryOf([2], 7, { fact: 'c', resets: 4 }), f, sum, cfg), 'frustrated');
  const g = newMentor('t');
  onCommit(g, newMemory(), tryOf([5, 5], 7, { fact: 'a' }), sum, cfg);
  assert.equal(diagnose(tryOf([1], 7, { fact: 'b', left: true }), g, sum, cfg), 'frustrated');
  // Many fast clean commits: bored.
  const b = newMentor('t');
  for (let i = 0; i < 2; i++) onCommit(b, newMemory(), tryOf([5, 2], 7, { timeS: 0.5, fact: i }), sum, cfg);
  assert.equal(diagnose(tryOf([5, 2], 7, { timeS: 0.5 }), b, sum, cfg), 'bored');
  // Fast and right with a high P(L): ready for more.
  assert.equal(d(tryOf([5, 2], 7, { timeS: 0.5, pL: 0.85 })), 'ready');
  // Idle at the start: the person shows the action, once.
  const u = newMentor('t');
  assert.equal(onIdle(u, { seconds: 5, acted: false }, sum), null);
  assert.deepEqual(onIdle(u, { seconds: sum.idleStart, acted: false }, sum), { diagnosis: 'unsure', move: 'show' });
  assert.equal(onIdle(u, { seconds: sum.idleStart * 2, acted: false }, sum), null, 'once');
});

test('boredom gets a response within the same number of commits as frustration', () => {
  const firstMove = (inputs) => {
    const st = newMentor('t');
    const mem = newMemory();
    for (const [i, input] of inputs.entries()) {
      const r = onCommit(st, mem, input, sum, cfg);
      if (['raise', 'picture', 'share', 'break'].includes(r.move)) return i + 1;
    }
    return Infinity;
  };
  const bored = firstMove(Array.from({ length: 6 }, (_, i) => tryOf([5, 2], 7, { timeS: 0.5, fact: i })));
  const frustrated = firstMove(Array.from({ length: 6 }, (_, i) => tryOf([1], 7, { fact: `f${i}`, resets: 3 })));
  assert.ok(bored <= frustrated, `bored after ${bored}, frustrated after ${frustrated}`);
  assert.equal(bored, sum.bored);
});

test('no move gives the answer to the same instance, and no line has a digit, an operator, or a question mark', () => {
  for (const target of [4, 7, 12, 15, 18, 20]) {
    for (const sizes of [[1], [1, 2], [2, 5], [3, 4, 5]]) {
      const t = demoTarget(target, sizes);
      assert.notEqual(t, target, `the demonstration of ${target} is another instance`);
      const parts = demoParts(t, sizes);
      assert.ok(parts.length && parts[parts.length - 1].total >= t);
      for (const have of [0, 1, 3]) {
        for (const move of ['smaller', 'share']) {
          const put = shareParts(move, target, have, [...sizes, ...sizes, ...sizes, 1, 1]).reduce((a, b) => a + b, 0);
          assert.ok(have + put < target, `${move} leaves a part of ${target} to the child`);
        }
      }
    }
  }
  const keys = [...Object.values(cfg.lines), ...Object.values(cfg.again), ...Object.values(cfg.mentors).map((m) => m.picture), 'mentor.demo.done'].filter(Boolean);
  for (const key of keys) {
    for (const [lang, texts] of [['vi', vi], ['en', en]]) {
      assert.ok(texts[key], `${key} (${lang})`);
      assert.doesNotMatch(texts[key], /[0-9+−×÷=?]/, `${key} (${lang})`);
    }
  }
  // Every move of every ladder is a known move.
  for (const fam of Object.values(cfg.families)) for (const ladder of Object.values(fam.ladders)) for (const m of ladder) assert.ok(MOVES.includes(m), m);
});

test('a move that helped this child comes first next time, and the outcome of each move is kept', () => {
  const mem = newMemory();
  const st = newMentor('event-cart');
  // A slip: the first help is "wait" at level one... the second miss gets a mark, and the next
  // commit is right: the mark helped.
  onCommit(st, mem, tryOf([5, 1], 7, { sizes: [5, 2], fact: 'a' }), sum, cfg);
  const second = onCommit(st, mem, tryOf([5, 2, 2], 8, { sizes: [5, 2], fact: 'b' }), sum, cfg);
  assert.equal(second.move, 'mark');
  const third = onCommit(st, mem, tryOf([5, 2], 7), sum, cfg);
  assert.deepEqual(third.help, { task: 'event-cart', diagnosis: 'slip', move: 'mark', pBefore: 0.4, success: true, efficient: false });
  assert.equal(mem.worked.slip.mark, 1);
  // Next time (a new task), the first slip gets the mark at once, and it says so.
  const next = newMentor('event-cart');
  const r = onCommit(next, mem, tryOf([5, 1], 7, { sizes: [5, 2] }), sum, cfg);
  assert.equal(r.move, 'mark');
  assert.equal(r.remembered, true);
  assert.equal(chooseMove('slip', next, mem, sum, cfg).remembered, false, 'only as the first help in a task');
});

test('the checking goes to the child: a check, a self-correction, and the marks fade', () => {
  const mem = newMemory();
  const st = newMentor('event-cart');
  assert.equal(onChange(st, mem), false, 'a change with no check is not a self-correction');
  onCheck(st);
  assert.equal(onChange(st, mem), true, 'a fix after a check is a self-correction');
  assert.equal(mem.selfFix, 1);
  const r = onCommit(st, mem, tryOf([5, 5], 7, { fact: 'x' }), sum, cfg);
  assert.deepEqual(r.checks, [{ changed: true }]);
  assert.equal(handoverStage(mem, cfg), 1);
  // A missing group gets a mark. At stage one, the mark waits while the child looks first.
  const s1 = newMentor('event-cart');
  const a = onCommit(s1, newMemory(), tryOf([5, 5], 8, { fact: 'p' }), sum, cfg);
  assert.equal(a.move, 'mark');
  assert.equal(a.delay, 0, 'at first the person marks at once');
  const b = onCommit(newMentor('event-cart'), mem, tryOf([5, 5], 8, { fact: 'q' }), sum, cfg);
  assert.equal(b.move, 'mark');
  assert.equal(b.delay, sum.look, 'then the person waits while the child looks');
  mem.selfFix = cfg.handover[1];
  assert.equal(onCommit(newMentor('event-cart'), mem, tryOf([5, 5], 8, { fact: 'r' }), sum, cfg).move, 'wait', 'at last the person only watches');
});

test('a wave: before any try, try first and no hint; after a miss, the next move; a stuck child who does not ask gets an offer', () => {
  const st = newMentor('event-cart');
  const mem = newMemory();
  assert.deepEqual(onWave(st, mem, sum, cfg), { when: 'before', diagnosis: 'unsure', move: 'tryFirst' });
  onCommit(st, mem, tryOf([5, 5], 7, { fact: 'a' }), sum, cfg);
  const w = onWave(st, mem, sum, cfg);
  assert.equal(w.when, 'after');
  assert.ok(!['wait', 'tryFirst'].includes(w.move), `a move of the ladder (${w.move})`);
  // No wave after a miss: an offer after the set time, once.
  const quiet = newMentor('event-cart');
  onCommit(quiet, newMemory(), tryOf([5, 5], 7), sum, cfg);
  assert.equal(onIdle(quiet, { seconds: sum.offerAfter - 1, acted: true }, sum), null);
  assert.equal(onIdle(quiet, { seconds: sum.offerAfter, acted: true }, sum).move, 'offer');
  assert.equal(onIdle(quiet, { seconds: sum.offerAfter * 2, acted: true }, sum), null);
});

test('each mentor names a family and a person', () => {
  for (const [key, m] of Object.entries(cfg.mentors)) {
    assert.ok(cfg.families[m.family], `${key}: family`);
    assert.match(m.person, /^(npc|event):/, `${key}: person`);
  }
});

test('the save keeps the memory of the mentors, and a bad memory does not load', async () => {
  const { createProfile } = await import('../src/core/profile.js');
  const { serialize, deserialize } = await import('../src/core/save.js');
  const p = createProfile({ id: 'm', name: 'An' });
  const mem = newMemory();
  const st = newMentor('event-cart');
  onCommit(st, mem, tryOf([5, 1], 7, { sizes: [5, 2] }), sum, cfg);
  onCommit(st, mem, tryOf([5, 2], 7), sum, cfg);
  p.mentors = { 'event-cart': mem };
  assert.deepEqual(deserialize(serialize(p, 0)).mentors, p.mentors);
  const bad = structuredClone(p);
  bad.mentors['event-cart'].worked = { slip: { mark: 'often' } };
  assert.throws(() => deserialize(serialize(bad, 0)));
});
