// The smaller problems (#77): the card and the notebook show each skill with the name that a child
// knows and its own picture, the law of the stories checks the cards, the notebook uses the name of
// the calf, a hint goes when the child does it, the right quench sizzles, and the line of the
// faces shows the faces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './helpers.js';
import { runHeadless } from './story-run.js';
import { createLaws } from '../src/core/story.js';
import { createI18n } from '../src/core/i18n.js';
import { skillPrint, notebookOf } from '../src/core/notebook.js';
import { createVoiceQueue, doneBy } from '../src/core/bubblevoice.js';
import { createDialogue } from '../src/core/dialogue.js';

const vi = load('i18n/vi.json');
const en = load('i18n/en.json');
const notebook = load('data/notebook.json');
const skills = load('data/skills.json').skills;
const figures = load('data/figures.json').figures;
const limits = load('data/config/limits.json');
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
// The words of the curriculum that a child does not know, or that name an operation.
const SCHOOL = /cộng|trừ|nhân|chia|phạm vi|phân số|hàng trăm|đơn vị|so sánh|plus|minus|add|subtract|times|divide|fraction|within/i;

test('each skill has its own picture and a name that a child knows, with no digit and no name of an operation', () => {
  const looks = new Set();
  for (const s of skills) {
    const p = skillPrint(notebook, s);
    assert.ok(p.titleKey.startsWith('print.'), `${s.id}: a print of its own`);
    assert.ok(figures[p.look], `${s.id}: the picture ${p.look} is a look`);
    assert.ok(!looks.has(p.look), `${s.id}: the picture ${p.look} is its own`);
    looks.add(p.look);
    for (const [lang, t] of [['vi', vi], ['en', en]]) {
      const name = t[p.titleKey];
      assert.ok(name, `${s.id} (${lang}): a name`);
      assert.ok(!/[0-9+−×÷=?]/.test(name) && !SCHOOL.test(name), `${s.id} (${lang}): "${name}"`);
    }
    // The name of the curriculum stays for the parent area.
    assert.equal(p.skillKey, `skill.${s.id}`);
  }
  // The page "Việc em làm được" shows the same names and pictures.
  const profile = { grade: 2, learning: { skills: { 'math.add.20': { n: 1 }, 'math.place.1000': { n: 1 } } }, notebook: { seen: {} }, flags: {} };
  const list = notebookOf(notebook, skills, profile).filter((e) => e.kind === 'skill' && e.met);
  assert.deepEqual(list.map((e) => [vi[e.titleKey], e.look]).sort(), [['Bó que tính', 'rod-bundle'], ['Cái đăng', 'stake-set']]);
});

test('the law of the stories checks the card of a new print', () => {
  const laws = createLaws({ texts: { vi, en }, limits });
  assert.equal(laws.text({ type: 'notebook', id: 'skill:math.add.20', titleKey: 'skill.math.add.20', kind: 'skill' }).length, 2, 'the name of the curriculum breaks the rule, in each language');
  assert.deepEqual(laws.text({ type: 'notebook', id: 'skill:math.add.20', titleKey: 'print.math.add.20', kind: 'skill' }), []);
  assert.deepEqual(laws.text({ type: 'notebook', id: 'creature:nghe', titleKey: 'note.creature.nghe', kind: 'creature' }), []);
});

test('the first cut of the woodcutter sends the card of a print with the name that a child knows and its picture', async () => {
  const cards = [];
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
  const failures = await runHeadless({ name: 'small-77', profile, clock: 540, at: ['phu-dong', 51, 8.5], steps: [
    { press: { entity: 'npc:woodcutter' } },
    { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
    { read: true },
    { until: { event: 'call', with: { key: 'mentor.woodcutter.first' }, timeout: 15 } },
    { press: { stem: 4 } },
    { until: { event: 'mark', timeout: 10 } },
    { press: { entity: 'npc:woodcutter' } },
    { until: { event: 'notebook', timeout: 20 } },
  ] }, { onSession: (s) => s.listen((ev) => { if (ev.type === 'notebook') cards.push(ev); }) });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const card = cards.find((c) => c.kind === 'skill');
  assert.ok(card, cards.map((c) => c.id).join(' '));
  assert.equal(card.titleKey, 'print.math.add.20');
  assert.equal(card.look, 'stake-set');
  assert.equal(createI18n(vi, 'vi').t('note.new', { name: { key: card.titleKey } }), 'Sổ tay có tranh mới: Cái đăng.');
});

test('the notebook uses the name that the child gave to the calf', () => {
  const i18n = createI18n(vi, 'vi');
  assert.equal(i18n.plain(i18n.t('note.creature.nghe'), { nghecalf: 'Mít' }), 'Mít, bạn của em');
  assert.equal(i18n.plain(i18n.t('note.creature.nghe')), 'Nghé, bạn của em');
});

test('a hint goes when the child does what it says: the line that waits goes at the put', () => {
  assert.ok(doneBy('mentor.carry.fisher', 'put'));
  assert.ok(!doneBy('mentor.carry.fisher', 'pick'));
  assert.ok(!doneBy('mentor.fisher.show', 'put'));
  const q = createVoiceQueue();
  q.offer({ id: 'npc:mentor-fisher', key: 'num.1', params: {}, kind: 'count' }, true);
  q.offer({ id: 'npc:mentor-fisher', key: 'mentor.carry.fisher', params: {}, kind: 'line' }, true);
  q.forget((l) => doneBy(l.key, 'put'));
  assert.equal(q.size(), 1);
  assert.ok(!q.waiting('npc:mentor-fisher', 'mentor.carry.fisher'));
  // The view: the bubble of the hint goes at the put, and a bubble lives in seconds.
  const village = source('src/ui/village.js');
  assert.match(village, /doneBy\(x\.line\?\.key, ev\.type\)/);
  assert.match(village, /b\.age \+= dt;/);
});

test('the right quench sizzles: the hiss of the iron has the sound of hot iron in water', () => {
  const work = source('src/core/world/systems/work.js');
  assert.equal((work.match(/say\(world, 'hiss', iron\.id, \{ sound: 'sizzle'/g) ?? []).length, 2);
  assert.match(source('src/ui/audio.js'), /\n {2}sizzle: \(t\) =>/);
});

test('the lines about the round marks with a face show the marks, and the close button of the notebook stays on the screen', () => {
  const talks = load('data/dialogue/prologue.json').dialogues;
  let n = 0;
  for (const d of talks) {
    for (const [id, node] of Object.entries(d.nodes)) {
      if (!/mặt người/.test(vi[node.textKey] ?? '')) continue;
      n += 1;
      assert.equal(node.marks, true, `${d.id}.${id}`);
      const talk = createDialogue({ ...d, start: id }, { flags: {} });
      assert.equal(talk.view().marks, true, `${d.id}.${id}: the view of the line`);
    }
  }
  assert.equal(n, 3);
  assert.match(source('styles/main.css'), /\.notebook-panel \.panel-head \{ position: sticky;/);
});
