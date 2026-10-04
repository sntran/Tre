// The table of the tasks (docs/TASKS.md): for each trial, the tap of each thing does its one job,
// the finish works with the action button, and the undo works. Each row plays a short story
// headless (tests/story-run.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
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
    { expect: [{ action: { act: 'tie', icon: 'rope' } }] },
    { tap: { item: 'rod' } },
    { until: { event: 'add', timeout: 10 } },
    { do: { type: 'drag', item: 'rod:scholar:0', zone: 'rods' } },
    { until: { event: 'back', timeout: 10 } },
    { tap: { thing: 'rod:scholar:1' } },
    { until: { event: 'snap', timeout: 10 } },
    { expect: [{ event: 'skill', with: { solved: false } }] },
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

test('the healer: a tap on an herb in the basket takes it back; a tap on the full basket gives it; so does the action button', async () => {
  await play('task-healer', [33, 44], [
    ...start('healer'),
    // The healer put one herb into the basket: a tap on it takes it back into the hands.
    { tap: { thing: 'herb-ngai:healer:0' } },
    { until: { event: 'pick', timeout: 15 } },
    { expect: [{ hero: { holding: true } }] },
    { tap: { zone: 'basket' } },
    { until: { event: 'put', timeout: 15 } },
    { expect: [{ action: { act: 'give', icon: 'basket' } }] },
    { tap: { zone: 'basket' } },
    { until: { event: 'nope', timeout: 15 } },
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
    { tap: { item: 'stake' } },
    { until: { event: 'pick', timeout: 15 } },
    { tap: { line: 8 } },
    { until: { event: 'put', timeout: 15 } },
    { expect: [{ hero: { holding: false } }] },
    // The stake that the fisher put into the line (the first step) comes back into the hands.
    { tap: { thing: 'stake:fisher:0' } },
    { until: { event: 'pick', timeout: 15 } },
    { expect: [{ hero: { holding: true } }] },
  ]);
});
