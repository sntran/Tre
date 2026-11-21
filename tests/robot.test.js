// The short sweep of the robot child (#174): it plays the scenes of the works of this round by day
// and at night, 120 commands each, like a child of six (tools/robot/robot.mjs), and no law of
// progress breaks: no key in a text, no talk without a line, no press that does nothing, no same
// line again and again, no work without progress, and a morning after each night. The long sweep of
// all the scenes is node tools/robot/sweep.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playScene, scenes, report } from '../tools/robot/robot.mjs';

const SCENES = ['staffs-grade1', 'forge-horse', 'trial-healer', 'raid-river-night', 'event-duck', 'ferry'];
const all = new Map(scenes().map((s) => [s.name, s.story]));

for (const name of SCENES) {
  for (const night of [false, true]) {
    test(`the robot child in ${name} ${night ? 'at night' : 'by day'}: no law breaks in 120 commands`, async () => {
      assert.ok(all.has(name), name);
      const out = await playScene(all.get(name), { scene: name, kind: 'star', night, commands: 120 });
      assert.deepEqual(out.stats.failed, []);
      assert.equal(out.findings.length, 0, report(out.findings));
    });
  }
}
