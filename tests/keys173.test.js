// No key aloud, and words and history by the grade (#173): each person has a name, a star of
// Gióng in the sky says his name, the help at a full pen is the call of the person and never a
// find, and up to grade 2 the fact of history after the raid of Trâu Sơn is one short sentence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';

const vi = load('i18n/vi.json');
const en = load('i18n/en.json');
const npcs = load('data/npcs.json').npcs;
const raids = load('data/raids.json').raids;

test('each person with a name key of its own has that key in both languages, and the star of a person uses it', () => {
  for (const [id, n] of Object.entries(npcs)) {
    if (!n.nameKey) continue;
    assert.ok(vi[n.nameKey] && en[n.nameKey], `${id}: ${n.nameKey}`);
  }
  assert.equal(vi[npcs['giong-sky'].nameKey], 'Gióng');
  const src = readFileSync(new URL('../src/ui/village.js', import.meta.url), 'utf8');
  assert.match(src, /\{ key: data\.npcs\?\.npcs\?\.\[by\]\?\.nameKey \?\? `npc\.\$\{by\}\.name` \}/);
});

test('all the ducks in the pen: a wave gets the call of the farmer, never "find a duck"', async () => {
  const s = load('tests/stories/event-duck.json');
  const last = s.steps.map((x, i) => (x.press?.entity === 'event:duck' ? i : -1)).filter((i) => i >= 0).at(-1);
  let session = null;
  const said = [];
  const failures = await runHeadless({ ...s, steps: s.steps.slice(0, last) }, { onSession: (x) => {
    session = x;
    x.listen((e) => { if ((e.type === 'open' && e.textKey) || e.type === 'call') said.push(e.textKey ?? e.key); });
  } });
  assert.deepEqual(failures.map((f) => f.message), []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  run(2);
  const from = said.length;
  session.command({ type: 'wave' });
  run(8);
  const after = said.slice(from);
  assert.ok(!after.includes('mentor.duck.show'), after.join(', '));
  assert.ok(after.includes('event.duck.all'), after.join(', '));
});

test('up to grade 2 the fact of history after the raid of Trâu Sơn is one short sentence; from grade 3 the long one', () => {
  const boss = raids.boss;
  assert.equal(boss.historyKey, 'history.giong.festival');
  assert.equal(vi[boss.historyShortKey], 'Ngày nay, làng Phù Đổng vẫn mở hội Gióng mỗi năm.');
  assert.ok(en[boss.historyShortKey]);
  assert.ok(!/UNESCO|\d/.test(vi[boss.historyShortKey]));
  const src = readFileSync(new URL('../src/core/session.js', import.meta.url), 'utf8');
  assert.match(src, /Number\(profile\.grade \?\? 1\) <= WORD_GRADE && def\.historyShortKey \? def\.historyShortKey : def\.historyKey/);
});
