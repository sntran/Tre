// The notebook (Sổ tay, #8): the fill rules of the prints (src/core/notebook.js, data/notebook.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notebookOf, noteSeen, isMet, notebookCount, entriesOfKey, notebookSkills } from '../src/core/notebook.js';
import { createProfile } from '../src/core/profile.js';
import { serialize, deserialize } from '../src/core/save.js';
import { load } from './helpers.js';

const def = load('data/notebook.json');
const skills = load('data/skills.json').skills;
const figures = load('data/figures.json').figures;
const vi = load('i18n/vi.json');
const en = load('i18n/en.json');
const dialogues = ['prologue', 'village', 'giong'].flatMap((f) => load(`data/dialogue/${f}.json`).dialogues.map((d) => d.id));

test('each print has a title in both languages, a print that the game can draw, and a rule that the game can meet', () => {
  const kinds = new Set(def.kinds);
  for (const e of def.entries) {
    assert.ok(kinds.has(e.kind), e.id);
    assert.ok(vi[e.titleKey] && en[e.titleKey], `${e.id}: title`);
    if (e.look) assert.ok(figures[e.look], `${e.id}: the look ${e.look}`);
    const [kind, what] = e.met.split(/:(.*)/);
    assert.ok(['talk', 'creature', 'map', 'flag'].includes(kind), e.id);
    if (kind === 'talk') assert.ok(dialogues.includes(what), `${e.id}: the talk ${what}`);
    if (kind === 'map') assert.ok(load(`data/maps/${what}.json`), e.id);
  }
  for (const s of notebookSkills(def, skills, 5)) assert.ok(vi[`skill.${s.id}`] && en[`skill.${s.id}`], s.id);
  assert.equal(new Set(def.entries.map((e) => e.id)).size, def.entries.length, 'no two prints with one id');
});

test('a new profile has the print of Nghé only; a talk, a creature, and a place fill in their prints one time', () => {
  const p = createProfile({ id: 'a', name: 'An', grade: 1 });
  let list = notebookOf(def, skills, p);
  assert.deepEqual(list.filter((e) => e.met).map((e) => e.id), ['creature:nghe']);
  assert.equal(noteSeen(p, 'talk:giong.speaks', 600), true);
  assert.equal(noteSeen(p, 'talk:giong.speaks', 700), false, 'one time');
  noteSeen(p, 'creature:duck');
  noteSeen(p, 'map:phu-dong');
  list = notebookOf(def, skills, p);
  assert.deepEqual(list.filter((e) => e.met).map((e) => e.id).sort(), ['creature:duck', 'creature:nghe', 'legend:speaks', 'place:phu-dong']);
  assert.deepEqual(entriesOfKey(def, 'creature:duck').map((e) => e.id), ['creature:duck']);
  assert.equal(isMet('flag:friend.nghe', p), true);
  assert.equal(isMet('creature:owl', p), false);
});

test('a skill fills in at its first skill event, and gets the red seal when it is mastered', () => {
  const p = createProfile({ id: 'a', name: 'An', grade: 1 });
  // A skill below the grade starts as mastered in the learner, with no event: no print yet.
  p.learning.skills['math.count.120'] = { p: 0.97, n: 0, mastered: true };
  p.learning.skills['math.add.10'] = { p: 0.4, n: 3, mastered: false };
  p.learning.skills['math.add.20'] = { p: 0.97, n: 12, mastered: true };
  const list = notebookOf(def, skills, p);
  const at = (id) => list.find((e) => e.id === `skill:${id}`);
  assert.equal(at('math.count.120').met, false);
  assert.deepEqual([at('math.add.10').met, at('math.add.10').sealed], [true, false]);
  assert.deepEqual([at('math.add.20').met, at('math.add.20').sealed], [true, true]);
  // The pages with a print first (the skills and the creatures: Nghé), then the pages of gaps.
  const kinds = list.map((e) => e.kind);
  assert.deepEqual([...new Set(kinds)], ['skill', 'creature', 'legend', 'place']);
  // No skill of a later era; a skill over the grade of the child only when the child met it.
  assert.ok(list.every((e) => e.kind !== 'skill' || skills.find((s) => s.id === e.skill).grade <= 1 || e.met));
  assert.ok(list.some((e) => e.id === 'skill:math.add.20'), 'a skill of grade 2 that the child met');
  assert.ok(!list.some((e) => e.id === 'skill:math.sub.20'), 'not a skill of grade 2 that the child did not meet');
  // On a page the met prints come first.
  const page = list.filter((e) => e.kind === 'skill');
  assert.deepEqual(page.slice(0, 2).map((e) => e.met), [true, true]);
  const c = notebookCount(list);
  assert.equal(c.sealed, 1);
  assert.ok(c.have >= 3 && c.have < c.all);
});

test('the notebook saves with the profile and loads back', () => {
  const p = createProfile({ id: 'a', name: 'An' });
  noteSeen(p, 'map:soc-son', 1200);
  assert.deepEqual(deserialize(serialize(p)).notebook, { seen: { 'map:soc-son': 1200 } });
  assert.throws(() => deserialize(serialize({ ...p, notebook: { seen: { x: 'y' } } })));
});

test('in play, the notebook fills in: the talk of the fisher, the animals at the river, and the place', async () => {
  const { runHeadless } = await import('./story-run.js');
  const { readFileSync } = await import('node:fs');
  const story = JSON.parse(readFileSync(new URL('./stories/trial-fisher.json', import.meta.url)));
  let session = null;
  const prints = [];
  const failures = await runHeadless(story, { onSession: (s) => { session = s; s.listen((ev) => { if (ev.type === 'notebook') prints.push(ev.id); }); } });
  assert.deepEqual(failures, []);
  const seen = session.profile.notebook.seen;
  assert.ok('talk:fisher.trial' in seen);
  assert.ok('map:phu-dong' in seen);
  assert.ok(prints.includes('place:phu-dong'));
  assert.ok(prints.some((id) => id.startsWith('creature:')), 'an animal at the river');
  assert.equal(new Set(prints).size, prints.length, 'each print comes one time');
});
