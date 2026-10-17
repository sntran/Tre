import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newMentor, newMemory, onCommit } from '../src/core/mentor.js';
import { load } from './helpers.js';
import { runHeadless } from './story-run.js';
import { getEntity, query } from '../src/core/world/state.js';

const cfg = load('data/world/mentors.json');
const vi = load('i18n/vi.json');
const en = load('i18n/en.json');
const sum = cfg.families.groups;
// A fast try with a high P(L): the diagnosis ready.
const tryOf = (parts, target) => ({ parts, target, solved: parts.reduce((a, b) => a + b, 0) === target, timeS: target * 0.3, sizes: [1, 2, 5], fact: target, pL: 0.9, resets: 0 });

test('a bigger task comes only after a right try that came after no miss, and its line does not praise (#94)', () => {
  assert.equal(onCommit(newMentor('x'), newMemory(), tryOf([5, 2], 7), sum, cfg).move, 'raise');
  // The person fixed the try (the rods over ten went back), and then the child tied ten.
  const st = newMentor('x');
  const mem = newMemory();
  onCommit(st, mem, tryOf([5, 1], 7), sum, cfg);
  const r = onCommit(st, mem, tryOf([5, 2], 7), sum, cfg);
  assert.equal(r.diagnosis, 'ready');
  assert.equal(r.move, 'wait');
  for (const key of ['mentor.raise', 'mentor.nghe.raise']) {
    assert.doesNotMatch(vi[key], /đúng|giỏi|nhanh/i, key);
    assert.doesNotMatch(en[key], /right|good|fast/i, key);
  }
});

test('a frustration comes only after fast misses: slow, careful misses get help, not a break (#94)', () => {
  const span = cfg.families.span;
  const slow = (parts) => ({ ...tryOf(parts, 12), timeS: 40, pL: 0.3 });
  const fast = (parts) => ({ ...tryOf(parts, 12), timeS: 2, pL: 0.3 });
  let st = newMentor('bridge');
  let mem = newMemory();
  const slowDiags = [slow([5, 5, 5]), slow([5, 5, 4, 3]), slow([4, 4, 5])].map((x) => onCommit(st, mem, x, span, cfg).diagnosis);
  assert.ok(!slowDiags.includes('frustrated'), slowDiags.join(', '));
  st = newMentor('bridge');
  mem = newMemory();
  const fastDiags = [fast([5, 5, 5]), fast([5, 5, 4, 3]), fast([4, 4, 5])].map((x) => onCommit(st, mem, x, span, cfg).diagnosis);
  assert.equal(fastDiags.at(-1), 'frustrated', fastDiags.join(', '));
  // No ladder has a break for a diagnosis other than the frustration.
  for (const [name, fam] of Object.entries(cfg.families)) {
    for (const [diag, ladder] of Object.entries(fam.ladders)) if (diag !== 'frustrated') assert.ok(!ladder.includes('break'), `${name}.${diag}`);
  }
});

test('a break at the bridge: the hero sits and eats a rice ball, Nghé comes for a bite, and the next help comes at once (#94)', async () => {
  const lines = [];
  const seen = [];
  let s = null;
  const plank = (size) => [{ press: { plank: size } }, { until: { event: 'pick', timeout: 20 } }, { press: { screenOf: 'bridge-gap' } }];
  const long = (size) => [...plank(size), { until: { event: 'long', timeout: 20 } }, { until: { event: 'open', with: { textKey: 'mentor.bridge.stuck' }, timeout: 20 } }, { wait: 0.5 }];
  const failures = await runHeadless({
    name: 'bridge-break', profile: { name: 'An', grade: 2, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'trial.fisher.done': true } }, clock: 540, at: ['phu-dong', 46, 61],
    steps: [
      { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } }, { read: true }, { wait: 1 },
      { press: { guess: 3 } }, { until: { event: 'guess', timeout: 3 } }, { wait: 2 },
      ...plank(5), { until: { event: 'put', timeout: 20 } }, { wait: 1 },
      ...plank(5), { until: { event: 'stuck', timeout: 20 } }, { wait: 1 },
      ...long(5), ...long(4),
      // The second long plank gets the demonstration; the third comes after it.
      { until: { event: 'open', with: { textKey: 'mentor.demo.done' }, timeout: 20 } }, { wait: 1 },
      ...long(3),
      { until: { event: 'open', with: { textKey: 'mentor.break' }, timeout: 20 } },
      { wait: 2.5 },
      { expect: [{ count: { entities: 'rice-ball-half', min: 1 } }] },
      { wait: 4 },
    ],
  }, {
    onSession: (x) => {
      s = x;
      x.listen((e) => {
        if (e.type === 'open' && e.textKey) lines.push(e.textKey);
        if (e.type === 'example' && e.sound) seen.push(`${e.id}:${e.sound}`);
      });
    },
  });
  assert.deepEqual(failures, []);
  const hero = getEntity(s.state, 'hero');
  assert.ok(!hero.gesture, 'the hero stands up after the break');
  assert.ok(seen.includes('hero:peck') && seen.includes('friend:nghe:peck'), `the hero eats, and Nghé gets a bite: ${seen.join(', ')}`);
  const after = lines.slice(lines.lastIndexOf('mentor.break') + 1);
  assert.ok(after.some((k) => /^num\./.test(k)), `the next help comes after the break: ${after.join(', ')}`);
  assert.ok(!query(s.state, 'demo').some((e) => /^rice-ball/.test(e.look) && !e.hidden), 'the rice ball is gone');
});
