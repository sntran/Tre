import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newMentor, newMemory, onCommit } from '../src/core/mentor.js';
import { load } from './helpers.js';
import { runHeadless } from './story-run.js';
import { spokenOf } from '../src/core/voices.js';
import { fadeFor, SIGHT_R } from '../src/world/fade.js';
import { createTileMap } from '../src/core/tilemap.js';
import { createWorldState, addEntity, command, getEntity, query } from '../src/core/world/state.js';
import { step, STEP } from '../src/core/world/step.js';
import { envFor } from '../src/core/world/env.js';
import { addHero, addFriend } from '../src/core/world/populate.js';

const cfg = load('data/world/mentors.json');
const vi = load('i18n/vi.json');
const en = load('i18n/en.json');
const sum = cfg.families.groups;
// A fast try with a high P(L): the diagnosis ready.
const tryOf = (parts, target) => ({ parts, target, solved: parts.reduce((a, b) => a + b, 0) === target, timeS: target * 0.3, sizes: [1, 2, 5], fact: target, pL: 0.9, resets: 0 });

test('a bigger task comes only after a right try that came after no miss, and its line does not praise (#94)', () => {
  assert.equal(onCommit(newMentor('x'), newMemory(), tryOf([5, 2], 7), sum, cfg).move, 'raise');
  // The person fixed the try (the rods over ten went back), and then the child tied ten.
  const st = newMentor('x');
  const mem = newMemory();
  onCommit(st, mem, tryOf([5, 1], 7), sum, cfg);
  const r = onCommit(st, mem, tryOf([5, 2], 7), sum, cfg);
  assert.equal(r.diagnosis, 'ready');
  assert.equal(r.move, 'wait');
  for (const key of ['mentor.raise', 'mentor.nghe.raise', 'mentor.scholar.raise']) {
    assert.doesNotMatch(vi[key], /đúng|giỏi|nhanh/i, key);
    assert.doesNotMatch(en[key], /right|good|fast/i, key);
  }
});

test('a frustration comes only after fast misses: slow, careful misses get help, not a break (#94)', () => {
  const span = cfg.families.span;
  const slow = (parts) => ({ ...tryOf(parts, 12), timeS: 40, pL: 0.3 });
  const fast = (parts) => ({ ...tryOf(parts, 12), timeS: 2, pL: 0.3 });
  let st = newMentor('bridge');
  let mem = newMemory();
  const slowDiags = [slow([5, 5, 5]), slow([5, 5, 4, 3]), slow([4, 4, 5])].map((x) => onCommit(st, mem, x, span, cfg).diagnosis);
  assert.ok(!slowDiags.includes('frustrated'), slowDiags.join(', '));
  st = newMentor('bridge');
  mem = newMemory();
  const fastDiags = [fast([5, 5, 5]), fast([5, 5, 4, 3]), fast([4, 4, 5])].map((x) => onCommit(st, mem, x, span, cfg).diagnosis);
  assert.equal(fastDiags.at(-1), 'frustrated', fastDiags.join(', '));
  // No ladder has a break for a diagnosis other than the frustration.
  for (const [name, fam] of Object.entries(cfg.families)) {
    for (const [diag, ladder] of Object.entries(fam.ladders)) if (diag !== 'frustrated') assert.ok(!ladder.includes('break'), `${name}.${diag}`);
  }
});

test('a break at the bridge: the hero sits and eats a rice ball, Nghé comes for a bite, and the next help comes at once (#94)', async () => {
  const lines = [];
  const seen = [];
  let s = null;
  const plank = (size) => [{ press: { plank: size } }, { until: { event: 'pick', timeout: 20 } }, { press: { screenOf: 'bridge-gap' } }];
  const long = (size) => [...plank(size), { until: { event: 'long', timeout: 20 } }, { until: { event: 'open', with: { textKey: 'mentor.bridge.stuck' }, timeout: 20 } }, { wait: 0.5 }];
  const failures = await runHeadless({
    name: 'bridge-break', profile: { name: 'An', grade: 2, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'trial.fisher.done': true } }, clock: 540, at: ['phu-dong', 46, 61],
    steps: [
      { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } }, { read: true }, { wait: 1 },
      { press: { guess: 3 } }, { until: { event: 'guess', timeout: 3 } }, { wait: 2 },
      ...plank(5), { until: { event: 'put', timeout: 20 } }, { wait: 1 },
      ...plank(5), { until: { event: 'stuck', timeout: 20 } }, { wait: 1 },
      ...long(5), ...long(4),
      // The second long plank gets the demonstration; the third comes after it.
      { until: { event: 'open', with: { textKey: 'mentor.demo.done' }, timeout: 20 } }, { wait: 1 },
      ...long(3),
      { until: { event: 'open', with: { textKey: 'mentor.break' }, timeout: 20 } },
      { wait: 2.5 },
      { expect: [{ count: { entities: 'rice-ball-half', min: 1 } }] },
      { wait: 4 },
    ],
  }, {
    onSession: (x) => {
      s = x;
      x.listen((e) => {
        if (e.type === 'open' && e.textKey) lines.push(e.textKey);
        if (e.type === 'example' && e.sound) seen.push(`${e.id}:${e.sound}`);
      });
    },
  });
  assert.deepEqual(failures, []);
  const hero = getEntity(s.state, 'hero');
  assert.ok(!hero.gesture, 'the hero stands up after the break');
  assert.ok(seen.includes('hero:peck') && seen.includes('friend:nghe:peck'), `the hero eats, and Nghé gets a bite: ${seen.join(', ')}`);
  const after = lines.slice(lines.lastIndexOf('mentor.break') + 1);
  assert.ok(after.some((k) => /^num\./.test(k)), `the next help comes after the break: ${after.join(', ')}`);
  assert.ok(!query(s.state, 'demo').some((e) => /^rice-ball/.test(e.look) && !e.hidden), 'the rice ball is gone');
});

test('the line of the hero in a talk with one choice is said in the voice of the hero, after the line (#94)', () => {
  const data = { npcs: {}, friends: {}, voices: { speakers: {} } };
  const girl = { hero: { gender: 'girl' } };
  assert.deepEqual(spokenOf({ speaker: 'nghe', textKey: 'dlg.grandma.intro.nghe2', choices: ['dlg.grandma.intro.nghe2.c1'] }, data, girl).map((x) => [x.key, x.voice]), [['dlg.grandma.intro.nghe2', 'narrator'], ['dlg.grandma.intro.nghe2.c1', 'girl']]);
  // Two choices: the voice says each of them in the voice of the hero, with its index, so that the
  // box lights the choice that it says (#139).
  assert.deepEqual(spokenOf({ speaker: 'narrator', textKey: 'a', choices: ['b', 'c'] }, data, girl).map((x) => [x.key, x.voice, x.choice]), [['a', 'narrator', undefined], ['b', 'girl', 0], ['c', 'girl', 1]]);
  assert.equal(spokenOf({ speaker: 'narrator', textKey: 'a' }, data, girl).length, 1);
});

// Is a point between the camera and a rect of work (the camera toward (sin, cos) of az)?
const inFront = (p, r, az, margin = 0) => {
  const cx = Math.sin(az);
  const cz = Math.cos(az);
  const mid = { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
  const half = (Math.abs(cz) * (r.x1 - r.x0) + Math.abs(cx) * (r.z1 - r.z0)) / 2;
  const along = (p.x - mid.x) * cx + (p.z - mid.z) * cz;
  const side = (p.x - mid.x) * cz - (p.z - mid.z) * cx;
  return along > 0 && Math.abs(side) < half - margin;
};

test('at the mat of the teacher, the hero and Nghé stand beside the work, never between the camera and the rods (#94)', async () => {
  for (const az of [Math.PI / 4, (5 * Math.PI) / 4, (3 * Math.PI) / 4, -Math.PI / 4]) {
    let s = null;
    const failures = await runHeadless({
      name: 'mat-beside', profile: { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } }, clock: 540, at: ['phu-dong', 54, 27],
      steps: [
        { do: { type: 'view', az } },
        { press: { entity: 'npc:teacher' } },
        { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
        { read: true },
        { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 15 } },
        { repeat: 3, steps: [{ press: { item: 'rod' } }, { until: { event: 'put', timeout: 10 } }] },
        { wait: 3 },
      ],
    }, { onSession: (x) => { s = x; } });
    assert.deepEqual(failures, [], `az ${az.toFixed(2)}`);
    const r = getEntity(s.state, 'zone:mat').zone.rect;
    const hero = getEntity(s.state, 'hero').position;
    const nghe = getEntity(s.state, 'friend:nghe').position;
    assert.ok(!inFront(hero, r, az), `az ${az.toFixed(2)}: the hero at ${hero.x.toFixed(1)}, ${hero.z.toFixed(1)} is in front of the mat ${JSON.stringify(r)}`);
    assert.ok(!inFront(nghe, r, az), `az ${az.toFixed(2)}: Nghé at ${nghe.x.toFixed(1)}, ${nghe.z.toFixed(1)} is in front of the mat`);
  }
});

test('a roof never fades for the hero alone, and fades only near the lines of sight of the work (#94)', () => {
  const hero = { x: 0, y: 0, z: 0 };
  const work = { x: 4, y: 0, z: 0, work: true };
  // A roof in front of the hero only: drawn whole (the outline of the hero shows).
  assert.deepEqual(fadeFor(true, [hero, work], (p) => p === hero), { hit: false, full: false, local: false });
  // A roof in front of the work: it fades, and only there.
  assert.deepEqual(fadeFor(true, [hero, work], (p) => p === work), { hit: true, full: true, local: true });
  // A tree in front of the hero still fades (a few dots), with no local tube.
  assert.deepEqual(fadeFor(false, [hero], (p) => p === hero), { hit: true, full: false, local: false });
  assert.ok(SIGHT_R > 1 && SIGHT_R < 4, 'the tube is about as wide as a place of the work');
});

test('a card waits while a person does a move and until the voice is quiet, so that its voice comes with it (#94)', () => {
  const village = readFileSync(new URL('../src/ui/village.js', import.meta.url), 'utf8');
  assert.match(village, /if \(speaking\(\) \|\| spoken \|\| voiceQueue\.size\(\)\) voiceAt = performance\.now\(\);/);
  assert.match(village, /performance\.now\(\) - Math\.max\(printGone, voiceAt\) < PRINT_GAP \|\| query\(state, 'script'\)\.length/);
});

test('Nghé steps out of a heap of a task that goes on (the bunches of the healer, #94)', () => {
  const tiles = load('data/tiles.json').types;
  const open = { width: 30, height: 30, legend: { '.': 'grass' }, layers: { ground: Array(30).fill('.'.repeat(30)), height: Array(30).fill('2'.repeat(30)), objects: [] } };
  const env = envFor(createTileMap(open, tiles));
  const w = createWorldState({ seed: 1, clock: { minutes: 600 } });
  addHero(w, env, { x: 10, y: 15, facing: Math.PI / 2 });
  addFriend(w, env, 'nghe');
  addEntity(w, { id: 'zone:trial-healer', zone: { id: 'trial-healer', rule: 'trial', task: 'trial-healer', items: [], done: false }, position: { x: 20, y: 4, z: 30, facing: 0 } });
  const items = [];
  for (let k = 0; k < 4; k++) {
    const id = `herb:${k}`;
    items.push(id);
    addEntity(w, { id, item: { kind: 'herb', size: 1, task: 'trial-healer', zone: 'bed', held: null, set: false }, position: { x: 30 + k * 0.8, y: 4, z: 30, facing: 0 }, look: 'herb' });
  }
  addEntity(w, { id: 'zone:bed', zone: { id: 'bed', task: 'trial-healer', rule: 'heap', accepts: 'herb', items, x: 30, y: 4, z: 30 }, position: { x: 30, y: 4, z: 30, facing: 0 } });
  command(w, { type: 'place', id: 'hero', x: 26, z: 30 });
  step(w, STEP, env);
  const nghe = getEntity(w, 'friend:nghe');
  Object.assign(nghe.position, { x: 31, z: 30 });
  for (let i = 0; i < 15; i++) step(w, STEP, env);
  const near = Math.min(...items.map((id) => getEntity(w, id).position).map((p) => Math.hypot(p.x - nghe.position.x, p.z - nghe.position.z)));
  assert.ok(near > 1.5, `Nghé is out of the bunches: ${near.toFixed(2)}`);
});
