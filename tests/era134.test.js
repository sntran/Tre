// Era 1 after the play test (#134): the messenger of the Hùng King gives the tests at the village
// hall of Phù Đổng (the placement test after the Five Trials, the exam of the era after the farewell
// of Gióng), the title of Era 1 is "người tài" in the notebook, and no line of Era 1 and no name of
// the country map says Văn Miếu or Thăng Long (Văn Miếu was built in 1070, and Thăng Long has its
// name from 1010).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load, worldOf } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { currentGoal } from '../src/core/quests.js';
import { conditionState } from '../src/core/game.js';
import { isMet } from '../src/core/notebook.js';
import { giveTitle } from '../src/core/profile.js';
import { examinerOf } from '../src/core/examiners.js';
import { mapNames } from '../src/world/geo.js';

const vi = load('i18n/vi.json');
const en = load('i18n/en.json');
const quests = load('data/quests.json').quests;
const titles = load('data/titles.json');
const notebook = load('data/notebook.json');
const geo = load('data/geo/vietnam.json');
const world = worldOf();
// The names of a later time, in both languages.
const LATER = /Văn Miếu|Thăng Long|Temple of Literature|\[\[(vanmieu|thanglong)\]\]/;
// The keys of the screen of Văn Miếu of chapter 7 (src/ui/vanmieu.js, the scene "vanmieu"), of its
// gloss, of the old lines of its road, and of the region of Thăng Long on the map (no name in Era 1).
const LATER_KEYS = /^(vanmieu\.|gloss\.(vanmieu|thanglong)\.|exam\.(stele|place\.vanmieu)$|map\.(road\.early|sign\.vanmieu)$|region\.thang-long$)/;

const done5 = { 'intro.seen': true, 'prologue.started': true, 'trial.scholar.done': true, 'trial.smith.done': true, 'trial.fisher.done': true, 'trial.healer.done': true, 'trial.woodcutter.done': true };
const farewell = { ...done5, 'prologue.done': true, 'giong.messenger': true, 'giong.spoke': true, 'horse.iron': true, 'horse.forged': true, 'giong.grown': true, 'soldier1.won': true, 'soldier2.won': true, 'boss.staffs': true, 'era1.boss.won': true, 'river.calmed': true, 'scouts.won': true };

// A run that reads each line, and keeps the lines, the screens, and the goals of the story.
function tools(session) {
  const lines = [];
  const screens = [];
  const goals = [];
  session.listen((e) => {
    if (e.type === 'open' && e.textKey) lines.push(e.textKey);
    if (e.type === 'open') screens.push({ screen: e.screen, cmd: e.cmd ?? null });
  });
  const goal = () => {
    const g = currentGoal(quests, conditionState(session.profile));
    if (g?.step) goals.push(g.step);
  };
  const run = (sec, read = true) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (read && (session.screen === 'dialogue' || session.screen === 'say')) session.command({ type: 'next' });
      session.step();
      session.events();
      if (i % 30 === 0) goal();
    }
  };
  return { session, lines, screens, goals, run };
}
const said = (h) => h.lines.map((k) => [vi[k], en[k]].join(' | ')).filter((x) => LATER.test(x));

test('grade 3: the Five Trials, the drum, the messenger at the village hall, the placement exam there, the calling, and "Gióng speaks"; no step of the story goes to the road over the Red River', async () => {
  let session = null;
  await runHeadless({ name: 'grade3-134', profile: { name: 'Vy', grade: 3, lang: 'vi', seed: 7, flags: { ...done5 } }, clock: 600, at: ['phu-dong', 31, 27], steps: [{ wait: 0.5 }] }, { onSession: (x) => { session = x; } });
  const h = tools(session);
  // The elder: the five trials are done, and the drum sounds at every grade.
  session.command({ type: 'tap', target: { person: 'npc:elder' } });
  h.run(3, false);
  session.command({ type: 'hands', id: session.action()?.id });
  h.run(20);
  assert.ok(h.lines.includes('dlg.elder.trials.done.drum'), h.lines.join(', '));
  assert.ok(!h.lines.some((k) => /placement/.test(k)), h.lines.join(', '));
  assert.ok(session.profile.flags['prologue.done']);
  // The goal of the story is the messenger at the village hall.
  assert.equal(currentGoal(quests, conditionState(session.profile))?.step?.target, 'messenger');
  // The messenger: his call, the test of the king, and the placement exam at the hall.
  const messenger = getEntity(session.state, 'npc:messenger');
  assert.ok(messenger && !messenger.hidden, 'the messenger is at the hall');
  const hero = getEntity(session.state, 'hero');
  Object.assign(hero.position, { x: messenger.position.x + 2, z: messenger.position.z + 2 });
  delete hero.route;
  session.command({ type: 'tap', target: { person: 'npc:messenger' } });
  h.run(2, false);
  session.command({ type: 'hands', id: session.action()?.id });
  for (let i = 0; i < 60 / STEP && session.screen !== 'exam'; i++) h.run(STEP);
  assert.equal(session.screen, 'exam', h.lines.join(', '));
  assert.ok(h.lines.includes('dlg.messenger.call.test'), h.lines.join(', '));
  assert.equal(h.screens.find((x) => x.screen === 'exam')?.cmd?.kind, 'placement');
  assert.ok(!h.lines.includes('dlg.messenger.call.n4'), 'Gióng speaks after the exam');
  // The exam screen (src/ui/vanmieu.js) does the exam and the choice of a calling; here, as it does.
  assert.equal(examinerOf({ titles, world }, session.profile).speaker, 'messenger');
  session.profile.flags['placement.done'] = true;
  session.profile.calling = 'smith';
  session.command({ type: 'closed' });
  h.run(10);
  const tested = h.lines.indexOf('dlg.messenger.call.tested');
  assert.ok(tested >= 0 && h.lines.indexOf('dlg.messenger.call.n4') > tested, h.lines.join(', '));
  assert.ok(session.profile.flags['giong.messenger']);
  assert.ok(!h.screens.some((x) => x.screen === 'vanmieu'));
  // No step of the story on the road over the Red River (the place of Văn Miếu before).
  assert.ok(!h.goals.some((st) => st.place?.map === 'road-thanglong'), JSON.stringify(h.goals.filter((st) => st.place)));
  assert.ok(!quests.flatMap((q) => q.steps).some((st) => st.place?.map === 'road-thanglong'));
  assert.deepEqual(said(h), []);
});

test('grade 1: after the farewell of Gióng, the drum, the messenger at the village hall, the exam of Era 1 there, and the title người tài in the profile and in the notebook', async () => {
  // The farewell on the top of Sóc Sơn: at its end, the drum of the village hall.
  let session = null;
  const before = { ...farewell };
  await runHeadless({ name: 'farewell-134', profile: { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: before }, clock: 600, at: ['soc-son', 38, 20], steps: [{ wait: 0.5 }] }, { onSession: (x) => { session = x; } });
  let h = tools(session);
  const sky = session.state.entities.find((e) => e.person?.ref === 'giong-sky');
  assert.ok(sky, 'Gióng on the top of Sóc Sơn');
  const hero = getEntity(session.state, 'hero');
  Object.assign(hero.position, { x: sky.position.x + 2, z: sky.position.z + 2 });
  delete hero.route;
  session.command({ type: 'tap', target: { person: sky.id } });
  h.run(2, false);
  session.command({ type: 'hands', id: session.action()?.id });
  h.run(30);
  assert.ok(session.profile.flags['giong.farewell']);
  assert.ok(h.lines.includes('dlg.giong.farewell.drum'), h.lines.join(', '));
  assert.equal(currentGoal(quests, conditionState(session.profile))?.step?.target, 'messenger');
  assert.deepEqual(said(h), []);
  // The messenger at the village hall: his thanks, and the exam of Era 1 at the end of his talk.
  await runHeadless({ name: 'exam-134', profile: { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { ...farewell, 'giong.farewell': true } }, clock: 600, at: ['phu-dong', 32, 26.5], steps: [{ wait: 1 }] }, { onSession: (x) => { session = x; } });
  h = tools(session);
  const messenger = getEntity(session.state, 'npc:messenger');
  assert.ok(messenger && !messenger.hidden, 'the messenger is back at the hall');
  session.command({ type: 'tap', target: { person: 'npc:messenger' } });
  h.run(2, false);
  session.command({ type: 'hands', id: session.action()?.id });
  for (let i = 0; i < 60 / STEP && session.screen !== 'exam'; i++) h.run(STEP);
  assert.equal(session.screen, 'exam', h.lines.join(', '));
  assert.deepEqual(h.lines.filter((k) => /^dlg\.messenger/.test(k)), ['dlg.messenger.thanks.n1', 'dlg.messenger.thanks.n2']);
  assert.equal(h.screens.find((x) => x.screen === 'exam')?.cmd?.kind, 'era1');
  // The pass, as the exam screen gives it: the title of a print, with no row on a stele.
  const title = titles.titles.find((x) => x.id === titles.exams.era1.title);
  assert.equal(title.id, 'nguoi-tai');
  assert.ok(title.print);
  giveTitle(session.profile, title.id, title.era, 5, { stele: !title.print });
  session.profile.flags[titles.exams.era1.flag] = true;
  session.command({ type: 'closed' });
  h.run(2);
  assert.deepEqual(session.profile.titles, ['nguoi-tai']);
  assert.deepEqual(session.profile.stele, []);
  assert.equal(vi['title.nguoi-tai.name'], 'Người tài');
  // The print of the title in the notebook: the messenger.
  const print = notebook.entries.find((e) => e.id === 'legend:talent');
  assert.ok(print && print.look === 'messenger' && isMet(print.met, session.profile), JSON.stringify(print));
  // The lines of the messenger at the exam say "cháu", and the title.
  assert.match(vi['exam.messenger.passed'], /người tài của làng Phù Đổng/);
  assert.deepEqual(said(h), []);
});

// Every string of the data of the game and of the code of the session that is a key of a line.
function keysIn(dir, out = new Set()) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) keysIn(p, out);
    else if (/\.(json|js)$/.test(f)) for (const m of readFileSync(p, 'utf8').matchAll(/["'`]([a-z][\w.-]+)["'`]/g)) if (vi[m[1]] !== undefined) out.add(m[1]);
  }
  return out;
}

test('in Era 1, no line of the game and no name of the country map says Văn Miếu or Thăng Long', () => {
  const keys = keysIn('data');
  for (const f of ['src/core', 'src/world']) keysIn(f, keys);
  for (const f of readdirSync('src/ui').filter((x) => x !== 'vanmieu.js')) for (const m of readFileSync(join('src/ui', f), 'utf8').matchAll(/["'`]([a-z][\w.-]+)["'`]/g)) if (vi[m[1]] !== undefined) keys.add(m[1]);
  const bad = [...keys].filter((k) => !LATER_KEYS.test(k) && (LATER.test(vi[k]) || LATER.test(en[k] ?? '')));
  assert.deepEqual(bad, []);
  // The map of the road has no gate, no trigger, and no sign of Văn Miếu, and its name is the land.
  const road = load('data/maps/road-thanglong.json');
  assert.ok(!road.layers.triggers.some((z) => z.action?.open === 'vanmieu' || LATER_KEYS.test(z.action?.textKey ?? '')));
  assert.ok(!LATER.test(vi[road.nameKey]) && !LATER.test(en[road.nameKey]), vi[road.nameKey]);
  // The country map at the start, after the Five Trials, and after the farewell, at grades 1 and 3.
  for (const grade of [1, 3]) {
    for (const flags of [{}, { ...done5, 'prologue.done': true }, { ...farewell, 'giong.farewell': true }]) {
      const names = mapNames(world, geo, { flags, grade }, 'giong');
      const words = [...names.regions.map((id) => vi[world.region(id).nameKey]), ...names.places.map((id) => geo.places.find((p) => p.id === id).name)];
      assert.ok(!words.some((w) => LATER.test(w)), `grade ${grade}: ${words.join(', ')}`);
      assert.ok(names.places.includes('phu-dong'), names.places.join(', '));
    }
  }
  // From the chapter of the Lý, the region of Thăng Long and Văn Miếu have their names.
  assert.equal(world.region('thang-long').nameFrom, 7);
  assert.ok(world.region('thang-long').places.includes('van-mieu'));
});
