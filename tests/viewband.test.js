// The near view by grade (#84): each grade has a band, the setting of the parent is stronger than
// the grade, the view changes only at the start of a game and after the parent area, the taps that
// miss are counted, and the weekly page has one line only when many taps miss.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './helpers.js';
import { VIEW_CHOICES, bandOf, nearOf } from '../src/core/viewband.js';
import { createTapCount, manyMisses, MIN_TAPS } from '../src/core/taps.js';
import { viewSize, nearView, setNearView, mmOf } from '../src/world/view.js';
import { createProfile, DEFAULT_SETTINGS } from '../src/core/profile.js';
import { serialize, deserialize, validate } from '../src/core/save.js';
import { rollupEvents, weekOf, logEvent, createLog } from '../src/core/learnlog.js';
import { weeklyNote } from '../src/core/weekly.js';

const game = load('data/config/game.json');
const vi = load('i18n/vi.json');
const en = load('i18n/en.json');
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('each grade has a band, and the hero is bigger on the glass for a younger child', () => {
  const near = (g) => bandOf(g, game.view).near;
  for (const g of game.grades.list.map((x) => x.id)) assert.ok(game.view.bands.some((b) => b.grades.includes(g)), `grade ${g} has a band`);
  assert.deepEqual([-1, 0, 1, 2, 3, 4, 5, 6, 7, 12].map(near), [16, 16, 18, 18, 21, 21, 21, 24, 24, 24]);
  const was = nearView();
  try {
    const mm = [];
    for (const g of [-1, 1, 4, 7]) {
      setNearView(near(g));
      mm.push((1.5 / viewSize(390, 844, 0).h) * 844 * mmOf(390, 844));
    }
    assert.ok(mm[0] > 12.5 && mm[0] < 13.5, `Pre-K: ${mm[0].toFixed(1)} mm`);
    assert.ok(mm[1] > 11 && mm[1] < 12, `grade 1: ${mm[1].toFixed(1)} mm`);
    assert.ok(mm[2] > 9.5 && mm[2] < 10.5, `grade 4: ${mm[2].toFixed(1)} mm`);
    assert.ok(mm[3] > 8 && mm[3] < 9, `grade 7: ${mm[3].toFixed(1)} mm`);
  } finally {
    setNearView(was);
  }
});

test('the setting of the parent is stronger than the grade; "by grade" follows a new grade', () => {
  const p = createProfile({ id: 'p1', name: 'An', grade: 7 });
  assert.equal(p.settings.view, 'grade');
  assert.equal(nearOf(p, game.view), 24);
  p.settings.view = 'very-near';
  assert.equal(nearOf(p, game.view), 16);
  p.settings.view = 'grade';
  p.grade = 0;
  assert.equal(nearOf(p, game.view), 16);
  assert.deepEqual(VIEW_CHOICES, ['grade', 'very-near', 'near', 'middle', 'far']);
  for (const v of VIEW_CHOICES) assert.ok(vi[`parent.view.${v}`] && en[`parent.view.${v}`], v);
  assert.equal(vi['parent.view'], 'Tầm nhìn');
  assert.equal(en['parent.view.grade'], 'By grade');
});

test('the save keeps the setting, an older save with none is good, and a bad value is not', () => {
  assert.equal(DEFAULT_SETTINGS.view, 'grade');
  const p = createProfile({ id: 'p1', name: 'An' });
  p.settings.view = 'far';
  assert.equal(deserialize(serialize(p, 0)).settings.view, 'far');
  const older = deserialize(serialize(p, 0));
  delete older.settings.view;
  assert.equal(validate(older), true);
  older.settings.view = 'huge';
  assert.throws(() => validate(older), /settings\.view/);
});

test('the view does not change during play: a new grade or setting takes effect at the start of a game or after the parent area', () => {
  const was = nearView();
  try {
    setNearView(18);
    const p = createProfile({ id: 'p1', name: 'An', grade: 1 });
    // The parent changes the grade in the middle of a task: the near view stays.
    p.grade = 7;
    assert.equal(viewSize(390, 844, 0).h, 18);
  } finally {
    setNearView(was);
  }
  // Only applyView sets the near view, and only the start of a profile and the end of the parent
  // area call it; the village takes the new view on the event view, which only applyView sends.
  const app = source('src/ui/app.js');
  assert.equal(app.match(/setNearView\(/g).length, 1);
  assert.equal(app.match(/ctx\.applyView\(\)/g).length, 2);
  assert.match(app, /await ctx\.setLanguage\(code\);\n\s+ctx\.applyView\(\);/);
  assert.match(app, /modals\.parent \? modals\.parent\(ctx, opts\) : Promise\.resolve\(\)\)\.then\(\(r\) => \{\n\s+ctx\.applyView\(\);/);
  for (const f of ['src/ui/village.js', 'src/ui/parent.js', 'src/world/hit.js', 'src/render/voxel.js']) assert.ok(!/setNearView\(/.test(source(f)), f);
  assert.match(source('src/ui/village.js'), /ctx\.bus\.on\('view', \(\) => view\.resize\(size\.width, size\.height\)\)/);
  // Back from the parent area during a task, a raid, or a talk: the new view waits for its end.
  assert.match(app, /if \(ctx\.activeVillage\?\.working\(\)\) \{\n\s+ctx\.viewPending = true;\n\s+return;/);
  assert.match(source('src/ui/village.js'), /if \(frames % 30 === 0 && ctx\.viewPending && !working\(\)\) ctx\.applyView\(\);/);
  assert.match(source('src/ui/village.js'), /const working = \(\) => Boolean\(session\.mentorTask \|\| session\.screen \|\| /);
});

test('a tap that chooses nothing is a miss when a second tap near it chooses something within 1.5 s', () => {
  const c = createTapCount({ mmPerPoint: 0.164 });
  // A miss: on the ground, then 40 points away on the person, 0.8 s later.
  c.tap(0, 100, 100, false);
  c.tap(0.8, 130, 125, true);
  // No miss: the second tap is too late.
  c.tap(5, 100, 100, false);
  c.tap(7, 110, 100, true);
  // No miss: the second tap is far (15 mm is about 91 points).
  c.tap(10, 100, 100, false);
  c.tap(10.5, 250, 100, true);
  // A walk: taps on the ground only.
  c.tap(20, 100, 100, false);
  c.tap(21, 120, 100, false);
  assert.deepEqual(c.take(), { taps: 8, misses: 1 });
  assert.deepEqual(c.take(), { taps: 0, misses: 0 });
});

test('the weekly page has the line of the taps only when more than 1 in 5 of at least 50 taps miss', () => {
  assert.equal(MIN_TAPS, 50);
  assert.equal(manyMisses(40, 20), false);
  assert.equal(manyMisses(100, 20), false);
  assert.equal(manyMisses(100, 21), true);
  const schema = load('data/config/learnlog.json');
  const MON = Date.UTC(2026, 8, 7, 9);
  const log = createLog(0);
  const session = { type: 'session', t: MON + 600000, variant: 'base', start: MON, end: MON + 600000, endedBy: 'child', quests: 0, place: 'xom-ruong', afterQuest: false, first: 'walk', practice: null };
  const taps = (t, n, m) => logEvent(log, { type: 'taps', t, variant: 'base', taps: n, misses: m }, schema);
  const note = (events) => weeklyNote(rollupEvents(events, { signals: schema.signals, activities: schema.activities }), { hero: { name: 'Nam' }, facts: {} }, weekOf(MON), { practice: load('data/world/practice.json'), learnlog: schema, planting: load('data/world/planting.json') });
  const has = (events) => note([...events, session]).lines.some((l) => l.key === 'parent.week.taps');
  assert.equal(has([taps(MON, 50, 6), taps(MON + 1000, 50, 15)]), true, '21 of 100');
  assert.equal(has([taps(MON, 50, 6), taps(MON + 1000, 50, 14)]), false, '20 of 100');
  assert.equal(has([taps(MON, 30, 20)]), false, 'too few taps');
  assert.equal(vi['parent.week.taps'], 'Con hay chạm trượt. Có thể thử tầm nhìn gần hơn.');
  assert.equal(en['parent.week.taps'], 'Your child often misses a tap. A nearer view can help.');
  // The line has a button that opens the setting of the view, and nothing shows in the world.
  assert.match(source('src/ui/parent.js'), /l\.key === 'parent\.week\.taps' \? button\(t\('parent\.week\.taps\.open'\), \(\) => \{ tab = 'settings';/);
  assert.ok(!/parent\.week\.taps/.test(source('src/ui/village.js')));
});
