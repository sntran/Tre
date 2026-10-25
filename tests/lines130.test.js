// What the people and the voice say, after the play test of #115 to #122 (#130): a short plank
// says it and the count says what is missing, the river says the bridge only when the bridge is the
// work, the start talk of the fisher is short and the words come when they are used, the ring comes
// at the first refused press, the need is said in the words of its task, and the woodcutter says
// "em".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';
import { readFileSync } from 'node:fs';
import { createVoiceQueue } from '../src/core/bubblevoice.js';

const vi = load('i18n/vi.json');

test('a short plank says that it is short, and the count of the deck ends with what is missing', async () => {
  const story = load('tests/stories/mentor-bridge.json');
  const said = [];
  const glows = [];
  const failures = await runHeadless({ ...story, steps: [...story.steps.slice(0, 15), { wait: 10 }] }, {
    onSession: (s) => s.listen((e) => {
      if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, params: e.params });
      if (e.type === 'glowThings') glows.push(...e.ids);
    }),
  });
  assert.deepEqual(failures, []);
  const keys = said.map((l) => l.key);
  assert.ok(keys.includes('world.bridge.short'), keys.join(', '));
  assert.equal(vi['world.bridge.short'], 'Tấm này ngắn quá: chưa tới bờ bên kia.');
  assert.ok(glows.some((id) => id.startsWith('why:')), 'the empty part glows');
  const miss = said.find((l) => l.key.startsWith('mentor.bridge.missing'));
  assert.ok(miss, keys.join(', '));
  assert.deepEqual(miss.params, { n: { key: 'num.4' } });
  // After the numbers of the count, and no line of a break before the line of why.
  assert.ok(keys.indexOf(miss.key) > keys.lastIndexOf('num.8'), keys.join(', '));
  const brk = keys.findIndex((k) => /break|rest/.test(k));
  assert.ok(brk < 0 || brk > keys.indexOf('world.bridge.short'));
});

test('while the bridge is open and not the work of the child, the river says only where it flows', () => {
  assert.equal(vi['map.river.plain'], 'Sông Đuống chảy về phía đông.');
  const map = load('data/maps/phu-dong.json');
  const river = map.layers.triggers.find((t) => t.id === 'river');
  assert.deepEqual(river.action.openText, { bridge: 'map.river.plain' });
});

test('the need is said in the words of its task: no line of the teacher at the smith', async () => {
  const story = load('tests/stories/trial-smith.json');
  for (const grade of [1, 5]) {
    const said = [];
    const first = story.steps.findIndex((s) => s.read === true);
    const failures = await runHeadless({ ...story, profile: { ...story.profile, grade }, steps: [...story.steps.slice(0, first + 1), { wait: 6 }] }, {
      onSession: (s) => s.listen((e) => { if (e.type === 'open' && e.textKey) said.push(e.textKey); }),
    });
    assert.deepEqual(failures, []);
    assert.ok(!said.some((k) => k.startsWith('teacher.need')), `grade ${grade}: ${said.join(', ')}`);
  }
});

test('no line that the woodcutter says has "cháu"', () => {
  const talks = [...load('data/dialogue/village.json').dialogues, ...load('data/dialogue/prologue.json').dialogues];
  const keys = new Set(Object.keys(vi).filter((k) => /^(woodcutter\.|mentor\.woodcutter\.|dlg\.woodcutter\.)/.test(k)));
  for (const d of talks) for (const n of Object.values(d.nodes)) if (n.speaker === 'woodcutter' && n.textKey) keys.add(n.textKey);
  for (const k of keys) assert.ok(!/\bcháu\b/i.test(vi[k] ?? ''), `${k}: ${vi[k]}`);
});

test('each new word has its line, and the lines of the words are in the review list', () => {
  const review = readFileSync(new URL('../docs/REVIEW.md', import.meta.url), 'utf8');
  for (const w of ['sugia', 'bocoi', 'quanan', 'tieuphu', 'kinhthanh', 'choloi']) {
    assert.ok(vi[`word.${w}`], w);
    assert.ok(review.includes(`word.${w}`), `docs/REVIEW.md names word.${w}`);
  }
});

test('the voice keeps the words of a count before a later line, and a talk box can wait for them', () => {
  const q = createVoiceQueue();
  for (const n of [5, 6, 7]) q.offer({ id: 'npc:fisher', key: `num.${n}`, params: {}, kind: 'count' }, true);
  q.offer({ id: 'npc:fisher', key: 'fisher.why', params: {}, kind: 'world' }, true);
  assert.ok(q.has((l) => l.kind === 'count'), 'the count waits');
  const order = [];
  for (let l = q.next(); l; l = q.next()) order.push(l.key);
  assert.deepEqual(order, ['num.5', 'num.6', 'num.7', 'fisher.why']);
  assert.ok(!q.has(() => true));
});
