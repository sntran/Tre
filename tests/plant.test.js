import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';
import { query } from '../src/core/world/state.js';

// The planting of Xóm Ruộng in the world (docs/PLANTING.md), with the story practice-cay-lua: a set
// of six plots, one too few (then the rest), one too many, and the others just right.
const story = load('tests/stories/practice-cay-lua.json');
const seedlings = (state, pid) => query(state, 'position').filter((e) => e.look?.startsWith('seedlings-') && (e.plotPart?.plot === pid || e.paddy)).reduce((a, e) => a + Number(e.look.split('-')[1]), 0);

test('the commit in the world: just right fills the plot; too few leaves the empty cells; too many leaves the extra seedlings on the dike', async () => {
  const seen = [];
  let ses;
  const failures = await runHeadless(story, {
    onSession: (s) => {
      ses = s;
      let before = 0;
      s.listen((ev) => {
        if (ev.type === 'skill' && ev.skill === 'math.mul.10') before = seedlings(s.state, 'p0');
        if (ev.type !== 'planted') return;
        const st = s.state;
        const now = seedlings(st, 'p0');
        const extra = st.entities.find((e) => e.id === 'pextra:p0');
        seen.push({ result: ev.result, full: ev.full, planted: now - before, empty: ev.empty, extra: ev.extra, onDike: Boolean(extra) });
      });
    },
  });
  assert.deepEqual(failures, []);
  const few = seen.find((r) => r.result === 'few');
  assert.ok(few && !few.full && few.empty > 0, 'too few: the plot is not full, and the empty cells stay');
  const many = seen.find((r) => r.result === 'many');
  assert.ok(many && many.full && many.extra > 0 && many.onDike, 'too many: the plot is full, and the extra seedlings lie on the dike');
  assert.ok(seen.filter((r) => r.result === 'exact').every((r) => r.full && r.empty === 0 && r.extra === 0), 'just right: full, nothing left');
  // The memory of the facts belongs to the skill, in the profile.
  const mem = ses.profile.facts['math.mul.10'];
  assert.ok(Object.keys(mem).length >= 3);
  assert.ok(Object.values(mem).some((e) => e.miss >= 1), 'the missed facts are in the memory');
  // One round for all the activities: a missed fact comes back in any of them (docs/HAMLET.md).
  assert.equal(ses.profile.factRound, seen.filter((r) => r.full).length);
  assert.ok(Object.values(mem).filter((e) => e.again).every((e) => e.again.activity === 'planting' && Number.isInteger(e.again.round)));
  assert.equal(ses.profile.planting.sets, 1);
});

test('the planted plots grow on the next days and stay after a save and a load', async () => {
  // The story plant-grow: one plot, the next morning, a save and a load, and two more mornings.
  let ses;
  const failures = await runHeadless(load('tests/stories/plant-grow.json'), { onSession: (x) => { ses = x; } });
  assert.deepEqual(failures, []);
  const rows = query(ses.state, 'paddy');
  assert.ok(rows.length >= 2, 'the rows of the planted plot are in the world after the load');
  assert.ok(rows.every((e) => e.look.endsWith('-tall') && e.paddy.season === 'spring'), rows.map((e) => e.look).join(' '));
});
