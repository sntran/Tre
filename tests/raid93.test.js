// The first raid of the play test of #85 to #89 (#93): the elder shows the quick presses after two
// short stones of one press, a ring of the pull that shows, an end with the help of Nghé, the raid
// again from the elder, and the pace of a child.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { getEntity } from '../src/core/world/state.js';

const profile = { name: 'An', grade: 1, lang: 'vi', seed: 3, flags: { 'intro.seen': true, 'giong.spoke': true }, items: { rice: 5 } };
const start = [
  { press: { entity: 'encounter:scouts' } },
  { until: { event: 'open', with: { screen: 'say' }, timeout: 30 } },
  { read: true },
  { wait: 15 },
];
// One press, and a wait for the stone and the line after it.
const one = [{ do: { type: 'hands' } }, { wait: 6 }];

function listen(x, out) {
  x.listen((e) => {
    if (e.type === 'open' && e.textKey) out.push(`${e.id}:${e.textKey}`);
    if (['shoot', 'land', 'end', 'drive'].includes(e.type)) out.push(`${e.type}${e.demo ? ':demo' : ''}${e.helped ? ':helped' : ''}${e.type === 'shoot' ? `:${e.count}` : ''}`);
    if (e.type === 'skill' && String(e.task).startsWith('raid-')) out.push('skill');
  });
}

test('after two short stones of one press each, the elder shows three quick presses at a post with no enemy, and the stone flies there', async () => {
  let s = null;
  const seen = [];
  const failures = await runHeadless({ name: 'raid-demo', profile, clock: 540, at: ['phu-dong', 61, 29], steps: [...start, ...one, ...one, { wait: 8 }] }, { onSession: (x) => { s = x; listen(x, seen); } });
  assert.deepEqual(failures, []);
  const at = seen.indexOf('npc:elder:raid.demo.look');
  assert.ok(at > 0, `the elder says "Xem ông này.": ${seen.join(', ')}`);
  const after = seen.slice(at);
  const nums = after.filter((x) => /^npc:elder:num\.\d$/.test(x)).map((x) => x.split('.').at(-1));
  assert.deepEqual(nums, ['1', '2', '3'], 'he counts while he presses');
  assert.ok(after.includes('shoot:demo:15'), `the stone flies to the third post: ${after.join(', ')}`);
  assert.ok(after.includes('land:demo'));
  assert.ok(after.includes('npc:elder:raid.demo.back'), 'he gives the slingshot back');
  const demo = after.slice(after.indexOf('shoot:demo:15'), after.indexOf('land:demo') + 1);
  assert.ok(!demo.includes('skill'), 'the stone of the elder is no try of the child');
  assert.ok(!getEntity(s.state, 'raid').raid.result, 'the raid goes on');
});

test('after the demonstration and four more misses, Nghé comes, and the raid ends as won with help; the raid can come again from the elder', async () => {
  let s = null;
  const seen = [];
  const failures = await runHeadless({ name: 'raid-help', profile, clock: 540, at: ['phu-dong', 61, 29], steps: [...start, ...one, ...one, { wait: 8 }, ...one, ...one, ...one, ...one, { wait: 6 }] }, { onSession: (x) => { s = x; listen(x, seen); } });
  assert.deepEqual(failures, []);
  assert.ok(seen.includes('friend:nghe:raid.help.nghe'), `Nghé comes: ${seen.join(', ')}`);
  assert.ok(seen.includes('end:helped'), 'the raid ends as won with help');
  assert.equal(s.profile.flags['raid.scouts.again'], true, 'the raid can come again');
  assert.ok(s.profile.flags['scouts.won'], 'the story goes on');
});

test('a child of grade 1 has 2.4 seconds between two presses before the stone flies', async () => {
  const seen = [];
  const failures = await runHeadless({ name: 'raid-pace', profile, clock: 540, at: ['phu-dong', 61, 29], steps: [...start, { do: { type: 'hands' } }, { wait: 2.1 }, { do: { type: 'hands' } }, { wait: 4 }] }, { onSession: (x) => listen(x, seen) });
  assert.deepEqual(failures, []);
  const shots = seen.filter((x) => x.startsWith('shoot'));
  assert.deepEqual(shots, ['shoot:10'], `one stone of two posts: ${shots.join(', ')}`);
});

test('the elder starts the raid again after a win with help', async () => {
  let s = null;
  const flags = { 'intro.seen': true, 'prologue.started': true, 'prologue.done': true, 'giong.messenger': true, 'giong.spoke': true, 'scouts.won': true, 'raid.scouts.again': true, 'raid.tool.sling': true };
  const failures = await runHeadless({
    name: 'raid-again', profile: { ...profile, flags }, clock: 540, at: ['phu-dong', 61, 29],
    steps: [
      { press: { entity: 'npc:elder' } },
      { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 60 } },
      { expect: [{ text: { shown: 'dlg.elder.raid.again.n1' } }] },
      { read: true },
      { wait: 3 },
    ],
  }, { onSession: (x) => { s = x; } });
  assert.deepEqual(failures, []);
  assert.ok(getEntity(s.state, 'raid'), 'the raid starts at the wall');
});
