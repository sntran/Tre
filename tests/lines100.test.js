// Lines that are true (#100): the elder before any task, the people of the events (name, figure,
// pronoun, and voice agree), the count of the ducks before what it shows, a duck at the pen, and
// the + of the map toward the hero.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';
import { check } from '../src/core/conditions.js';
import { voiceOf } from '../src/core/voices.js';
import { getEntity, command as worldCommand } from '../src/core/world/state.js';
import { STEP } from './restless.js';

const vi = load('i18n/vi.json');
const npcs = load('data/npcs.json').npcs;
const game = load('data/config/game.json');
const TRIALS = ['scholar', 'smith', 'fisher', 'healer', 'woodcutter'];
const talkOf = (who, flags) => npcs[who].talk.find((r) => check(r.when, { flags, grade: 1 }))?.dialogue;

test('before any of the five tasks the elder does not say that a task is done', () => {
  const base = { 'prologue.started': true, 'intro.seen': true };
  const first = talkOf('elder', base);
  assert.equal(first, 'elder.trials.start');
  assert.ok(!/đã giúp/.test(vi['dlg.elder.trials.start.n1']), vi['dlg.elder.trials.start.n1']);
  assert.equal(talkOf('elder', { ...base, 'trial.smith.done': true }), 'elder.trials.wait');
  assert.equal(talkOf('elder', { ...base, ...Object.fromEntries(TRIALS.map((t) => [`trial.${t}.done`, true])) }), 'elder.trials.done');
});

test('the people of the events: the name, the figure, the pronoun of the lines, and the voice agree', () => {
  const events = load('data/world/events.json').events;
  const figures = load('data/figures.json').figures;
  const data = { npcs: {}, friends: {}, voices: game.voices };
  const WOMAN = /^(Cô|Bà|Chị)\s/;
  const MAN = /^(Chú|Bác|Anh|Ông)\s/;
  for (const person of new Set(events.map((e) => e.person))) {
    const name = vi[`npc.${person}.name`];
    const woman = figures[person].bottomKind === 'skirt';
    assert.ok(woman ? WOMAN.test(name) : MAN.test(name), `${person}: "${name}" and the figure`);
    const voice = voiceOf(person, data);
    assert.equal(game.voices[voice]?.gender, woman ? 'female' : 'male', `${person}: the voice ${voice}`);
    // The lines of the person call the person by the word of the name.
    const word = name.split(' ')[0].toLowerCase();
    const keys = events.filter((e) => e.person === person).flatMap((e) => Object.values(e.lines));
    const other = woman ? /(^|\s)(chú|anh|ông)(?=[\s.,!?]|$)/iu : /(^|\s)(cô|chị|bà)(?=[\s.,!?]|$)/iu;
    for (const k of keys) assert.ok(!other.test(vi[k] ?? ''), `${person}: "${vi[k]}" (${k}) and "${word}"`);
  }
});

test('the farmer counts the ducks first, and then says what the count shows; a duck at the pen quacks and walks to the others', async () => {
  const s = load('tests/stories/event-duck.json');
  const at = s.steps.findIndex((x) => x.expect?.some((e) => e.text?.shown === 'event.duck.short'));
  const order = [];
  let session = null;
  const walks = [];
  const failures = await runHeadless({ ...s, steps: s.steps.slice(0, at) }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => {
        if (e.type === 'open' && e.textKey) order.push(e.textKey);
        if (e.type === 'put' && String(e.item).startsWith('duck')) walks.push({ sound: e.sound, slide: Boolean(getEntity(x.state, e.item)?.slide) });
      });
    },
  });
  assert.deepEqual(failures, [], order.join(', '));
  const verdict = order.indexOf('event.duck.short');
  const nums = order.map((k, i) => (/^num\./.test(k) ? i : -1)).filter((i) => i >= 0);
  assert.ok(nums.length >= 1, order.join(', '));
  assert.ok(nums.at(-1) < verdict, `the count, then the line: ${order.join(', ')}`);
  assert.ok(walks.length >= 1 && walks.every((w) => w.sound === 'quack' && w.slide), JSON.stringify(walks));
  void session;
});

test('a check at the person of an event counts, also when the place is far from the person', async () => {
  // At night the farmer stood 11 half blocks from the pen, and the hero at her side: the world looked
  // for the person as event:event-duck, so a check there did nothing.
  const s = load('tests/stories/event-duck.json');
  const at = s.steps.findIndex((x) => x.expect?.some((e) => e.text?.shown === 'event.duck.short')) - 2;
  let session = null;
  const failures = await runHeadless({ ...s, steps: s.steps.slice(0, at) }, { onSession: (x) => { session = x; } });
  assert.deepEqual(failures, []);
  const st = session.state;
  const tz = getEntity(st, 'zone:trial-event-duck');
  const place = getEntity(st, 'zone:event-duck-place');
  const farmer = getEntity(st, 'event:duck');
  const hero = getEntity(st, 'hero');
  farmer.position = { ...farmer.position, x: place.position.x + 14, z: place.position.z };
  hero.position = { ...hero.position, x: farmer.position.x - 3, z: farmer.position.z };
  delete hero.route;
  const before = tz.zone.commits;
  worldCommand(st, { type: 'work', id: 'hero', trial: 'event-duck', act: 'exact' });
  for (let i = 0; i < 1 / STEP; i++) {
    session.step();
    session.events();
  }
  assert.equal(tz.zone.commits, before + 1);
});

test('the + of the map zooms toward the hero', () => {
  const src = readFileSync(new URL('../src/ui/worldmap.js', import.meta.url), 'utf8');
  assert.match(src, /button\('\+', zoomIn/);
  assert.match(src, /const zoomIn = \(\) => \{\s*const p = heroPoint\(\);\s*setView\(view\.w \* 0\.7, p\?\.x/);
});
