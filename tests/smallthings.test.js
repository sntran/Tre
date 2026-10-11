// The smaller problems of the play test of #78 (#81): a place with no way out, a thing of a done
// task, a tap on a face during its line or a folk game, the print of the task where the child earned
// a skill, the card on the screen, the Nho sinh, the iron of the smith, "Sổ tay" once, no number of
// a chapter, and the time of a press.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity } from '../src/core/world/state.js';
import { load } from './helpers.js';
import { skillPrint } from '../src/core/notebook.js';

const vi = load('i18n/vi.json');
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const profile = (flags = {}) => ({ name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true, ...flags } });
function run(session, seconds, until = () => false) {
  for (let i = 0; i < seconds / STEP && !until(); i++) {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
  }
}
const send = (session, cmd) => {
  session.command(cmd);
  session.events();
};

test('next to the mat of the teacher after the task, a tap on the ground walks the hero away (no person closes every way)', async () => {
  let session = null;
  await runHeadless({ name: 'trap-81', profile: profile({ 'trial.scholar.done': true }), clock: 600, at: ['phu-dong', 57.5, 24.5], steps: [] }, { onSession: (s) => { session = s; } });
  run(session, 2);
  const hero = getEntity(session.state, 'hero');
  const c = { x: hero.position.x / 2, y: hero.position.z / 2 };
  for (const [dx, dy] of [[-5, 2], [3, 5], [-2, -4], [5, -2]]) {
    const before = { ...hero.position };
    send(session, { type: 'tap', target: { ground: { x: c.x + dx, y: c.y + dy } } });
    run(session, 2);
    assert.ok(Math.hypot(hero.position.x - before.x, hero.position.z - before.z) > 1, `a tap at (${dx}, ${dy}) moves the hero`);
    Object.assign(hero.position, before);
    delete hero.route;
  }
});

test('no press takes a thing from the heap of a done task, and a thing of a done task in the hands goes back with a press', async () => {
  let session = null;
  await runHeadless({ name: 'done-heap-81', profile: profile(), clock: 540, at: ['phu-dong', 54, 27], steps: [
    { press: { entity: 'npc:teacher' } }, { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } }, { read: true },
  ] }, { onSession: (s) => { session = s; } });
  run(session, 40, () => !session.state.entities.some((e) => e.script));
  const heap = getEntity(session.state, 'zone:rods') ?? session.state.entities.find((e) => e.zone?.rule === 'heap' && e.zone.task === 'trial-scholar');
  // A rod in the hands from before (a pick of the world, as a child took it before the task ended).
  const rod = heap.zone.items[0];
  const hero = getEntity(session.state, 'hero');
  heap.zone.items = heap.zone.items.filter((id) => id !== rod);
  Object.assign(getEntity(session.state, rod).item, { held: 'hero', zone: null });
  hero.hands.holds = rod;
  Object.assign(hero.position, { x: heap.position.x + 1.5, z: heap.position.z + 1.5 });
  delete hero.route;
  getEntity(session.state, 'zone:trial-scholar').zone.done = true;
  run(session, 0.5);
  const a = session.action();
  assert.equal(a?.act, 'put', `the button puts it back: ${a?.act}`);
  assert.equal(a.target, heap.id);
  send(session, { type: 'hands', id: a.id });
  run(session, 1.5);
  assert.equal(getEntity(session.state, 'hero').hands.holds ?? null, null, 'the rod is back');
  run(session, 0.5);
  assert.notEqual(session.action()?.act, 'pick', 'no pick from the heap of a done task');
});

test('a tap on a face during a folk game ends the game, with the line of the children, and the hero walks', async () => {
  const story = load('tests/stories/practice-nhay-lo-co.json');
  let session = null;
  await runHeadless({ ...story, steps: [{ until: { event: 'folkCall', timeout: 20 } }] }, { onSession: (s) => { session = s; } });
  const lines = [];
  session.listen((ev) => { if (ev.type === 'open' && ev.screen === 'callout') lines.push(ev.textKey); });
  const hero = getEntity(session.state, 'hero');
  const at = { x: hero.position.x / 2 + 20, y: hero.position.z / 2 + 6 };
  send(session, { type: 'tap', target: { ground: { ...at, h: 1, thing: false, object: null, goal: true } } });
  run(session, 1);
  assert.ok(lines.includes('loco.leave'), lines.join(' '));
  run(session, 3);
  assert.ok(Math.hypot(hero.position.x / 2 - at.x, hero.position.z / 2 - at.y) < 20 - 1, 'the hero walks toward the face');
});

test('the print of a skill fits the task where the child earned it first', () => {
  const notebook = load('data/notebook.json');
  const skill = load('data/skills.json').skills.find((s) => s.id === 'math.add.20');
  const figures = load('data/figures.json').figures;
  assert.equal(vi[skillPrint(notebook, skill).titleKey], 'Cái đăng');
  assert.equal(vi[skillPrint(notebook, skill, 'trial-fisher').titleKey], 'Cái đăng');
  for (const [from, name] of [['trial-woodcutter', 'Bó tre'], ['folk-loco', 'Lò cò']]) {
    const p = skillPrint(notebook, skill, from);
    assert.equal(vi[p.titleKey], name);
    assert.ok(figures[p.look], p.look);
  }
});

test('the cards and the words: the card fits the screen, Nho sinh says who they were, the smith gives iron, "Sổ tay" is said once, and the map has no number of a chapter', () => {
  const css = source('styles/main.css');
  assert.match(css, /\.print-card \{ left: 12px; right: 12px; width: fit-content;[^}]*transform: none; \}/);
  const done = load('data/dialogue/village.json').dialogues.find((d) => d.id === 'teacher.trial.done');
  assert.equal(done.nodes.n1.next, 'who');
  assert.equal(vi[done.nodes.who.textKey], 'Nho sinh là học trò ngày xưa.');
  assert.equal(load('data/callings.json').callings.find((c) => c.id === 'scholar').whoKey, 'calling.scholar.who');
  const trials = load('data/trials.json').trials;
  assert.deepEqual(trials.find((t) => t.id === 'smith').reward, { iron: 2 });
  assert.deepEqual(trials.find((t) => t.id === 'woodcutter').reward, { bamboo: 3 });
  assert.equal(vi['note.first'], 'Sổ tay của cháu đây. Mỗi khi gặp một điều mới, cháu có thêm một tranh.');
  assert.ok(!/Sổ tay/.test(vi['note.newName']));
  const village = source('src/ui/village.js');
  assert.match(village, /const first = !profile\.notebook\?\.told;/);
  assert.match(village, /key: 'note\.newName'/);
  assert.ok(!/world\.chapter/.test(source('src/ui/worldmap.js')), 'no number of a chapter on the map of the child');
});

test('a tap on a pulsing face during its line goes on to the next line', () => {
  const village = source('src/ui/village.js');
  assert.match(village, /if \(busy\) \{\n\s+if \(marksLine\) send\(\{ type: 'next' \}\);/);
});

test('the time of a press is the time of the touch: the jump and the hold use the times of the events', () => {
  const village = source('src/ui/village.js');
  assert.match(village, /jumpDown = e\.timeStamp;/);
  assert.match(village, /held: Math\.max\(0, \(e\?\.timeStamp \?\? performance\.now\(\)\) - holdDown\) \/ 1000/);
  // The world takes the time of the hold for the height of a slash.
  assert.match(source('src/core/world/systems/input.js'), /held: c\.held \?\? null/);
});
