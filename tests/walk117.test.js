// A tap next to a person always walks (#117): for each person of a task, from points all around the
// person at 1 to 3 half blocks (every 30 degrees), after the first demonstration, a tap on the heap
// or the place of the task moves the hero more than one half block, or the hero is already there.
// A boy of K stood beside the teacher, and no tap moved him: two open cells between a wall and the
// body of the teacher had no way out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, command as worldCommand } from '../src/core/world/state.js';

const PEOPLE = [
  { story: 'trial-scholar', person: 'npc:teacher', place: 'zone:rods', after: 'mentor.first.you', grade: 0 },
  { story: 'trial-healer', person: 'npc:healer', place: 'zone:bed-ngai', after: 'mentor.first.you' },
  { story: 'trial-fisher', person: 'npc:fisher', place: 'zone:stakes', after: 'mentor.first.you' },
  { story: 'trial-woodcutter', person: 'npc:woodcutter', place: 'zone:woodpile', after: 'mentor.woodcutter.first' },
  { story: 'trial-smith', person: 'npc:smith', place: 'zone:forge', after: null },
];
const THERE = 6; // half blocks: the hero is already at the place (the reach of the hands, and one more)
// The work of the place is in reach: the button acts there with no walk (a put, a pick, a quench).
const WORK = new Set(['put', 'pick', 'mark', 'cut', 'quench', 'blow', 'tie']);

for (const p of PEOPLE) {
  test(`a tap on the place of the task moves the hero from every point around ${p.person}`, async () => {
    const s0 = load(`tests/stories/${p.story}.json`);
    const first = s0.steps.findIndex((x) => x.read === true) + 1;
    let session = null;
    const wait = p.after ? [{ until: { event: 'call', with: { key: p.after }, timeout: 80 } }, { wait: 1 }] : [{ wait: 20 }];
    const failures = await runHeadless({ ...s0, profile: { ...s0.profile, ...(p.grade !== undefined ? { grade: p.grade } : {}) }, steps: [...s0.steps.slice(0, first), ...wait] }, { onSession: (x) => { session = x; } });
    assert.deepEqual(failures, []);
    const run = (sec) => {
      for (let i = 0; i < sec / STEP; i++) {
        if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
        session.step();
        session.events();
      }
    };
    const who = getEntity(session.state, p.person).position;
    const place = getEntity(session.state, p.place);
    const at = place.zone ? { x: place.zone.x + (place.zone.cols ?? 1) / 2, z: place.zone.z } : place.position;
    const stuck = [];
    let tried = 0;
    for (let deg = 0; deg < 360; deg += 30) {
      for (const r of [1, 1.5, 2, 2.5, 3]) {
        const a = (deg * Math.PI) / 180;
        const x = who.x + Math.cos(a) * r;
        const z = who.z + Math.sin(a) * r;
        if (!session.tileMap.walkable(Math.floor(x / 2), Math.floor(z / 2))) continue;
        worldCommand(session.state, { type: 'stop', id: 'hero' });
        worldCommand(session.state, { type: 'place', id: 'hero', x, z });
        run(0.2);
        const h = getEntity(session.state, 'hero').position;
        const h0 = { x: h.x, z: h.z };
        if (Math.hypot(h0.x - at.x, h0.z - at.z) < THERE) continue;
        tried += 1;
        session.command({ type: 'tap', target: session.targetAt(at.x / 2, at.z / 2) });
        run(3);
        const moved = Math.hypot(h.x - h0.x, h.z - h0.z);
        const act = session.action();
        const ready = act && !act.walk && WORK.has(act.act);
        if (moved <= 1 && !ready && Math.hypot(h.x - at.x, h.z - at.z) >= THERE) stuck.push(`${deg} degrees, ${r}: moved ${moved.toFixed(2)}, ${JSON.stringify(act)}`);
      }
    }
    assert.ok(tried >= 8, `points tried: ${tried}`);
    assert.deepEqual(stuck, []);
  });
}
