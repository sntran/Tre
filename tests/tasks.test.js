// The table of the tasks (docs/TASKS.md): for each trial, the tap of each thing does its one job,
// the finish works with the action button, and the undo works. Each row plays a short story
// headless (tests/story-run.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { runHeadless } from './story-run.js';

const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
// The start of a trial: the talk of the person, and the first step that the person shows.
const start = (npc) => [
  { tap: { entity: `npc:${npc}` } },
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
  { read: true },
  { until: { event: 'call', with: { key: npc === 'woodcutter' ? 'mentor.woodcutter.first' : 'mentor.first.you' }, timeout: 15 } },
];
const carry = (item, zone) => [{ tap: { item } }, { until: { event: 'pick', timeout: 15 } }, { tap: { zone } }, { until: { event: 'put', timeout: 15 } }];

async function play(name, at, steps) {
  const failures = await runHeadless({ name, profile, clock: 540, at: ['phu-dong', ...at], steps });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
}

test('the teacher: a tap on a rod of the heap puts it on the mat; a tap on the rods on the mat ties; a drag to the heap takes a rod back', async () => {
  await play('task-teacher', [54, 27], [
    ...start('teacher'),
    // The teacher showed the first step and took the rod back: the mat is empty.
    { expect: [{ zone: 'mat', planks: 0 }] },
    { tap: { thing: 'rod:scholar:2' } },
    { until: { event: 'add', timeout: 10 } },
    { expect: [{ zone: 'mat', planks: 1 }, { action: { act: 'tie', icon: 'rope' } }] },
    { do: { type: 'drag', item: 'rod:scholar:2', zone: 'rods' } },
    { until: { event: 'back', timeout: 10 } },
    { expect: [{ zone: 'mat', planks: 0 }] },
    { tap: { thing: 'rod:scholar:3' } },
    { until: { event: 'add', timeout: 10 } },
    { tap: { thing: 'rod:scholar:3' } },
    { until: { event: 'snap', timeout: 10 } },
    { expect: [{ event: 'skill', with: { solved: false, parts: [1] } }] },
  ]);
});

test('the smith: a tap on the forge with ore in the hands puts the ore; the action button quenches the glowing iron', async () => {
  await play('task-smith', [53, 43], [
    ...start('smith'),
    ...carry('ore', 'forge').slice(0, 3),
    { until: { event: 'fire', timeout: 15 } },
    { expect: [{ action: { act: 'quench', icon: 'water' } }] },
    { until: { event: 'glow', timeout: 15 } },
    { do: { type: 'hands' } },
    { until: { event: 'hiss', timeout: 5 } },
    { expect: [{ event: 'pulse', with: { id: 'iron:smith' } }, { flag: 'trial.smith.done' }] },
  ]);
});

test('the healer: a tap on the basket or on a bunch in it gives the basket, and so does the action button; a drag of a bunch to its bed takes it back', async () => {
  await play('task-healer', [33, 44], [
    ...start('healer'),
    // The healer showed the first step and took the bunch back: the basket is empty.
    { expect: [{ zone: 'basket', planks: 0 }] },
    { tap: { thing: 'herb-ngai:healer:1' } },
    { until: { event: 'pick', timeout: 15 } },
    { tap: { zone: 'basket' } },
    { until: { event: 'put', timeout: 15 } },
    { tap: { thing: 'herb-ngai:healer:2' } },
    { until: { event: 'pick', timeout: 15 } },
    { tap: { zone: 'basket' } },
    { until: { event: 'put', timeout: 15 } },
    { expect: [{ zone: 'basket', planks: 2 }, { action: { act: 'give', icon: 'basket' } }] },
    { do: { type: 'drag', item: 'herb-ngai:healer:2', zone: 'bed-ngai' } },
    { until: { event: 'back', timeout: 10 } },
    { expect: [{ zone: 'basket', planks: 1 }, { hero: { holding: false } }] },
    // A tap on the bunch in the basket gives the basket (it never takes the bunch back).
    { tap: { thing: 'herb-ngai:healer:1' } },
    { until: { event: 'nope', timeout: 15 } },
    { expect: [{ hero: { holding: false } }] },
    { tap: { thing: 'herb-ngai:healer:3' } },
    { until: { event: 'pick', timeout: 15 } },
    { tap: { zone: 'basket' } },
    { until: { event: 'put', timeout: 15 } },
    { do: { type: 'hands' } },
    { until: { event: 'nope', timeout: 15 } },
    { expect: [{ event: 'pulse', with: { id: 'basket:healer' } }, { flag: 'trial.healer.done', is: false }] },
  ]);
});

test('the woodcutter: a tap on the stem puts a chalk mark, a tap on the mark takes it away; only the action button cuts', async () => {
  await play('task-woodcutter', [51, 8.5], [
    ...start('woodcutter'),
    { expect: [{ action: null }] },
    { tap: { stem: 3 } },
    { until: { event: 'mark', timeout: 10 } },
    { expect: [{ count: { entities: 'chalk', min: 1, max: 1 } }, { action: { act: 'cut', icon: 'knife' } }] },
    { tap: { stem: 3 } },
    { until: { event: 'mark', timeout: 10 } },
    { expect: [{ count: { entities: 'chalk', max: 0 } }] },
    { tap: { stem: 4 } },
    { until: { event: 'mark', timeout: 10 } },
    { do: { type: 'hands' } },
    { until: { event: 'chop', timeout: 10 } },
    { expect: [{ event: 'pulse', with: { id: 'stem:woodcutter' } }, { event: 'skill', with: { solved: true } }] },
  ]);
});

test('the fisher: a tap on a stake in the line takes it back while the tide is low', async () => {
  await play('task-fisher', [27, 64.5], [
    ...start('fisher'),
    // The fisher showed the first step and took the stake back: the line is empty.
    { expect: [{ zone: 'line', planks: 0 }] },
    { tap: { thing: 'stake:fisher:2' } },
    { until: { event: 'pick', timeout: 15 } },
    { tap: { line: 8 } },
    { until: { event: 'put', timeout: 15 } },
    { expect: [{ hero: { holding: false } }] },
    { expect: [{ zone: 'line', planks: 1 }] },
    { tap: { thing: 'stake:fisher:2' } },
    { until: { event: 'pick', timeout: 15 } },
    { expect: [{ hero: { holding: true } }] },
  ]);
});

test('no two buttons on the screen have the same picture: the action button never shows the wave hand or the jump', () => {
  // The pictures of the action button (the icons of action() in the session), and of the other
  // buttons beside it.
  const icons = [...new Set([...readFileSync('src/core/session.js', 'utf8').matchAll(/icon: '([a-z-]+)'/g)].map((m) => m[1]))];
  const others = [...readFileSync('src/ui/village.js', 'utf8').matchAll(/img\('ui\/([a-z-]+)', 'btn-icon'\)/g)].map((m) => m[1]).filter((n) => !icons.includes(n));
  assert.ok(others.includes('wave') && others.includes('jump'));
  const art = (n) => readFileSync(`art/ui/${n}.svg`, 'utf8');
  for (const n of [...icons, ...others]) assert.ok(existsSync(`art/ui/${n}.svg`), `art/ui/${n}.svg`);
  const all = [...icons, ...others];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) assert.notEqual(art(all[i]), art(all[j]), `${all[i]} and ${all[j]} have the same picture`);
  }
  for (const act of ['pick', 'put']) assert.ok(icons.includes(`hand-${act}`));
});
