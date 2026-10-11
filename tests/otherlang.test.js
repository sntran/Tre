// The language in the game (#82): one line in the other language, on request, with the words of a
// count in the language of the game and the names kept; a change of the language in the middle of a
// talk, a task, and a raid, after which the game goes on and the save loads back; the two choices of
// the parent; and the lines of the weekly note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless, data } from './story-run.js';
import { load } from './helpers.js';
import { createI18n, otherLine, capitalize } from '../src/core/i18n.js';
import { storyProfile, storyOnPlane } from '../src/core/story.js';
import { serialize, deserialize, validate } from '../src/core/save.js';
import { createProfile, DEFAULT_SETTINGS } from '../src/core/profile.js';
import { rollupEvents, weekOf, logEvent, createLog } from '../src/core/learnlog.js';
import { weeklyNote } from '../src/core/weekly.js';

const viDict = load('i18n/vi.json');
const enDict = load('i18n/en.json');
const vi = createI18n(viDict, 'vi', enDict);
const en = createI18n(enDict, 'en', viDict);
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const schema = load('data/config/learnlog.json');

test('one line in the other language: the words of a count stay in the language of the game, and the names stay', () => {
  const n = { key: 'num.2' };
  assert.equal(otherLine(vi, en, 'woodcutter.equal', { n }), `${capitalize(vi.t('num.2'))} pieces of the same length.`);
  assert.equal(otherLine(en, vi, 'woodcutter.equal', { n }), `${capitalize(en.t('num.2'))} khúc dài bằng nhau.`);
  // The name that the child gave to the calf stays in the line of the other language.
  const line = otherLine(vi, en, 'dlg.grandma.intro.ride', {}, { nghecalf: 'Mướp' });
  assert.match(line, /Mướp/);
  assert.ok(!/\[\[/.test(line), line);
  // The voice uses the text for the voice of the other language when it has one.
  assert.equal(otherLine(vi, en, 'prob.add', { a: 3, b: 4 }, null, true), en.t('prob.add.say', { a: 3, b: 4 }));
});

test('each line of a person in the world has a text in the other language', () => {
  for (const key of Object.keys(viDict).filter((k) => /^(mentor|fisher|healer|woodcutter|smith|teacher|dlg)\./.test(k) && !k.endsWith('.say'))) {
    assert.ok(key in enDict, `${key} in English`);
    const text = otherLine(vi, en, key, {});
    assert.ok(text.length > 0, key);
  }
});

// A story, with the language of the game changed at the first event of a kind; the game goes on with
// no failure, and the save loads back with the new language, the names, and the place in the story.
async function switched(name, at) {
  const story = load(`tests/stories/${name}.json`);
  const profile = storyProfile(storyOnPlane(story, data.world));
  profile.friendNames = { ...(profile.friendNames ?? {}), nghe: 'Mướp' };
  let changes = 0;
  const failures = await runHeadless(story, {
    profile,
    onSession: (s) => s.listen((ev) => {
      if (changes === 0 && at(ev)) {
        profile.settings.lang = profile.settings.lang === 'vi' ? 'en' : 'vi';
        changes += 1;
      }
    }),
  });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), [], name);
  assert.equal(changes, 1, `${name}: the language changed`);
  const again = deserialize(serialize(profile, 0));
  assert.equal(again.settings.lang, 'en');
  assert.equal(again.hero.name, profile.hero.name);
  assert.equal(again.friendNames.nghe, 'Mướp');
  assert.deepEqual(again.flags, profile.flags);
  assert.equal(validate(again), true);
}

test('a change of the language in the middle of a talk: the talk goes on and the save loads back', async () => {
  await switched('trial-healer', (ev) => ev.type === 'open' && ev.screen === 'dialogue');
});

test('a change of the language in the middle of a task: the task goes on and the save loads back', async () => {
  await switched('trial-woodcutter', (ev) => ev.type === 'mark');
});

test('a change of the language in the middle of a raid: the raid goes on and the save loads back', async () => {
  await switched('raid-patrol', (ev) => ev.type === 'call' || ev.type === 'open');
});

test('the parent decides: both choices are on in a new save, an older save with none is good, and a bad value is not', () => {
  assert.equal(DEFAULT_SETTINGS.langSwitch, true);
  assert.equal(DEFAULT_SETTINGS.otherLine, true);
  const p = createProfile({ id: 'p1', name: 'An' });
  assert.equal(p.settings.langSwitch, true);
  assert.equal(p.settings.otherLine, true);
  p.settings.langSwitch = false;
  assert.equal(deserialize(serialize(p, 0)).settings.langSwitch, false);
  const older = deserialize(serialize(p, 0));
  delete older.settings.langSwitch;
  delete older.settings.otherLine;
  assert.equal(validate(older), true);
  older.settings.otherLine = 'yes';
  assert.throws(() => validate(older), /settings\.otherLine/);
});

test('the weekly note says the lines heard in the other language and the changes of the language, and no line says 0', () => {
  const MON = Date.UTC(2026, 8, 7, 9);
  const week = weekOf(MON);
  const log = createLog(0);
  const lang = (t, what) => logEvent(log, { type: 'lang', t, variant: 'base', what, to: 'en' }, schema);
  const note = (events) => {
    const r = rollupEvents(events, { signals: schema.signals, activities: schema.activities });
    return weeklyNote(r, { hero: { name: 'Nam' }, facts: {} }, week, { practice: load('data/world/practice.json'), learnlog: schema, planting: load('data/world/planting.json') });
  };
  const keys = (n) => n.lines.map((l) => l.key);
  const session = { type: 'session', t: MON + 600000, variant: 'base', start: MON, end: MON + 600000, endedBy: 'child', quests: 0, place: 'xom-ruong', afterQuest: false, first: 'walk', practice: null };
  const events = [lang(MON, 'line'), lang(MON + 1000, 'line'), lang(MON + 2000, 'line'), lang(MON + 3000, 'switch')];
  const both = note([...events, session]);
  const line = both.lines.find((l) => l.key === 'parent.week.lang');
  assert.ok(line, keys(both).join(' '));
  assert.equal(vi.t(line.key, { name: 'Nam', ...Object.fromEntries(Object.entries(line.params).map(([k, v]) => [k, v.key ? vi.t(v.key, v.params) : v])) }), 'Nam nghe 3 câu bằng ngôn ngữ kia, và đổi ngôn ngữ của game 1 lần.');
  assert.deepEqual(keys(note([events[0], session])).filter((k) => /week\.lang/.test(k)), ['parent.week.langLines']);
  assert.deepEqual(keys(note([events[3], session])).filter((k) => /week\.lang/.test(k)), ['parent.week.langSwitch']);
  assert.deepEqual(keys(note([session])).filter((k) => /week\.lang/.test(k)), []);
  // A bad event of the language does not go in the log.
  assert.throws(() => logEvent(createLog(0), { type: 'lang', t: MON, variant: 'base', what: 'all', to: 'en' }, schema));
});

test('the buttons: the talk box and a spoken bubble have the button of the other language, the menu has the switch, and each choice of the parent hides its button', () => {
  const dialogue = source('src/ui/dialogue.js');
  assert.match(dialogue, /otherLineOn\(ctx\) \? button\(otherLang\(\)\.toUpperCase\(\)/);
  assert.match(dialogue, /export const otherLineOn = \(ctx\) => ctx\.profile\?\.settings\?\.otherLine !== false;/);
  // The line in the other language first, and then again in the language of the game.
  assert.match(dialogue, /const back = \(\) => \{\n\s+if \(!spoken \|\| !shown\) return;[\s\S]*speak\(key, params, \{ force: true, voice \}\);/);
  // The other line shows for a time also on a device with no voice, and a second tap does nothing.
  assert.match(dialogue, /Math\.max\(OTHER_SHOW_MS, el\.textContent\.length \* OTHER_CHAR_MS\)/);
  assert.match(dialogue, /if \(el\.dataset\.other\) return;/);
  const village = source('src/ui/village.js');
  assert.match(village, /line\.kind !== 'count' && otherLineOn\(ctx\)/);
  assert.match(village, /if \(box && boxLine\) box\.show\(boxLine\);/);
  const app = source('src/ui/app.js');
  assert.match(app, /c\.profile\?\.settings\?\.langSwitch !== false \? h\('div', \{ class: 'menu-lang' \}/);
  assert.match(app, /c\.log\?\.\('lang', \{ what: 'switch', to: code \}\);\n\s+await c\.setLanguage\(code\);\n\s+await c\.save\('lang'\);/);
  const parent = source('src/ui/parent.js');
  assert.match(parent, /toggleRow\(t\('parent\.langSwitch'\)/);
  assert.match(parent, /toggleRow\(t\('parent\.otherLine'\)/);
  assert.equal(viDict['parent.langSwitch'], 'Con được đổi ngôn ngữ trong game');
  assert.equal(viDict['parent.otherLine'], 'Con được nghe một câu bằng ngôn ngữ kia');
  assert.equal(viDict['ui.lang.title'], 'Ngôn ngữ / Language');
  // The card of a calling stands over the buttons of the talk box, so the button of the other
  // language does not cover it.
  assert.match(source('styles/main.css'), /\.talk-calling \{[^}]*bottom: calc\(100% \+ var\(--touch\) \* 0\.8 \+ 6px\);/);
  // The head of each panel, with its close button, stays at the top while the panel scrolls.
  assert.match(source('styles/main.css'), /\.panel > \.panel-head \{ position: sticky; top: calc\(var\(--gap\) \* -1\.4\); z-index: 3; \}/);
});
