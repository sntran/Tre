// Each move of the mentors is in the schema of the learning log (#89: the moves first and fix were
// not, and the record of the first demonstration of each task was lost).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './helpers.js';

test('each move of src/core/mentoring.js, src/core/mentor.js, and the ladders is in the schema of help and ask', () => {
  const src = ['../src/core/mentoring.js', '../src/core/mentor.js'].map((f) => readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n');
  const moves = new Set([...src.matchAll(/move(?:: | = | === | !== )'([a-zA-Z]+)'/g)].map((m) => m[1]));
  for (const f of Object.values(load('data/world/mentors.json').families)) for (const l of Object.values(f.ladders)) for (const m of l) moves.add(m);
  assert.ok(moves.has('first') && moves.has('fix'), [...moves].join(', '));
  const kinds = load('data/config/learnlog.json').kinds;
  for (const kind of ['help', 'ask']) {
    const missing = [...moves].filter((m) => !kinds[kind].move.includes(m));
    assert.deepEqual(missing, [], `the moves that ${kind} does not have`);
  }
  // The weekly note has a line for each move.
  const vi = load('i18n/vi.json');
  const en = load('i18n/en.json');
  for (const m of moves) assert.ok(vi[`parent.week.move.${m}`] && en[`parent.week.move.${m}`], `parent.week.move.${m}`);
});
