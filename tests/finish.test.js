// A finish that a child sees with the sound off (#62): at each success in a task (a bundle, a
// quench, a full basket, the row of stakes), the person of the task jumps and a burst of leaves
// comes from the thing. At the end of the task, the person jumps two times and waves, and the seal
// of the calling flies to its pip (the view), all in less than 2 seconds, with no text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';

const PEOPLE = { scholar: 'npc:teacher', smith: 'npc:smith', fisher: 'npc:fisher', healer: 'npc:healer', woodcutter: 'npc:woodcutter' };

for (const [trial, person] of Object.entries(PEOPLE)) {
  test(`the ${trial} trial: the person cheers at each success, and at the end two jumps and a wave in less than 2 seconds`, async () => {
    const story = JSON.parse(readFileSync(new URL(`./stories/trial-${trial === 'scholar' ? 'scholar' : trial}.json`, import.meta.url)));
    const cheers = [];
    const failures = await runHeadless(story, {
      onSession: (s) => s.listen((ev) => {
        if (ev.type !== 'cheer' || ev.trial !== trial) return;
        const e = s.state.entities.find((x) => x.id === ev.by);
        cheers.push({ ...ev, cheer: e?.cheer && { ...e.cheer } });
      }),
    });
    assert.deepEqual(failures, []);
    assert.ok(cheers.length >= 1, 'a cheer');
    for (const c of cheers) {
      assert.equal(c.by, person, 'the person of the task cheers');
      // A full point, with its height (#65: the light of a burst with no height was NaN at night).
      assert.ok(c.at && Number.isFinite(c.at.x) && Number.isFinite(c.at.y) && Number.isFinite(c.at.z), 'the burst comes from a full point of a thing');
    }
    const ends = cheers.filter((c) => c.end);
    assert.equal(ends.length, 1, 'one end of the task');
    assert.equal(cheers.at(-1), ends[0], 'the end comes last');
    const { hops, hop, wave } = ends[0].cheer;
    assert.equal(hops, 2);
    assert.ok(wave, 'a wave at the end');
    assert.ok(hops * hop + 0.9 < 2, 'the jumps and the wave take less than 2 seconds');
    if (trial === 'scholar') assert.ok(cheers.length >= 2, 'a jump at each bundle');
  });
}

test('the cheer of the person goes on while the done talk is open (the world waits, the session does not)', async () => {
  const story = JSON.parse(readFileSync(new URL('./stories/trial-smith.json', import.meta.url)));
  // The talk stays open: no read at the end, but a wait of two seconds.
  assert.deepEqual(story.steps.at(-1), { read: true });
  story.steps[story.steps.length - 1] = { wait: 2 };
  let session = null;
  let open = null;
  const failures = await runHeadless(story, {
    onSession: (s) => {
      session = s;
      s.listen((ev) => {
        if (ev.type === 'open' && ev.screen === 'dialogue' && ev.textKey === 'dlg.smith.trial.done.n1') open = { ...s.state.entities.find((e) => e.id === 'npc:smith').cheer };
      });
    },
  });
  assert.deepEqual(failures, []);
  assert.ok(open?.hops === 2, 'the smith cheers when the done talk opens');
  assert.equal(session.state.entities.find((e) => e.id === 'npc:smith').cheer, undefined, 'and the cheer ends in less than 2 seconds, while the talk is open');
});

test('a burst always has a full point: a point with no height takes the top of the ground (#65)', async () => {
  const { fullPoint } = await import('../src/core/session.js');
  const ground = (x, y) => x + y;
  assert.deepEqual(fullPoint({ x: 10, z: 4 }, ground), { x: 10, y: 7, z: 4 });
  assert.deepEqual(fullPoint({ x: 10, y: 2, z: 4 }, ground), { x: 10, y: 2, z: 4 });
  assert.deepEqual(fullPoint({ x: 10, y: Number.NaN, z: 4 }, ground), { x: 10, y: 7, z: 4 });
  assert.equal(fullPoint({ x: 10 }, ground), null);
  assert.equal(fullPoint(null, ground), null);
});
