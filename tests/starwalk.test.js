// A walk to the star of a person (#72): it goes around a thing that stops it, it follows the person
// to where the person is now, and at the end the view shows the person and the hero.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { getEntity } from '../src/core/world/state.js';

const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'giong.spoke': true, 'elder.intro': true } };
async function at(x, y) {
  let s = null;
  await runHeadless({ name: 'star', profile, clock: 600, at: ['phu-dong', x, y], steps: [{ wait: 0.5 }] }, { onSession: (q) => { s = q; } });
  return s;
}
const starTap = (s, p) => {
  s.command({ type: 'tap', target: { ground: { x: p.x / 2, y: p.z / 2, h: 0, thing: false, object: null, goal: true } } });
  s.events();
};
const run = (s, seconds, until = () => false) => {
  for (let i = 0; i < seconds * 30 && !until(); i++) {
    s.step();
    s.events();
  }
};

test('a walk to a star that stops plans again around the place where it stopped (#72)', async () => {
  const s = await at(31, 28);
  const hero = getEntity(s.state, 'hero');
  const healer = getEntity(s.state, 'npc:healer');
  let stuck = 0;
  s.listen((e) => { if (e.type === 'stuck') stuck += 1; });
  starTap(s, healer.position);
  run(s, 0.5);
  // Something that the plans do not see holds the hero (in the browser, a corner of a house): the
  // walk stops there.
  const cell = (q) => `${Math.floor(q.x / 2)},${Math.floor(q.z / 2)}`;
  const held = cell(hero.route.points[0]);
  const stay = { x: hero.position.x, z: hero.position.z };
  for (let i = 0; i < 30 && !stuck; i++) {
    Object.assign(hero.position, stay);
    s.step();
    s.events();
  }
  assert.equal(stuck, 1, 'the walk stopped');
  // The next plan goes around the cell ahead of the stop.
  run(s, 2, () => Boolean(hero.route));
  assert.ok(hero.route, 'the walk goes on');
  assert.ok(!hero.route.points.some((q) => cell(q) === held), `the new way does not go through ${held}`);
  run(s, 40, () => Math.hypot(hero.position.x - healer.position.x, hero.position.z - healer.position.z) < 6 && !hero.route);
  const d = Math.hypot(hero.position.x - healer.position.x, hero.position.z - healer.position.z) / 2;
  assert.ok(d <= 3.5, `the hero is next to the healer: ${d.toFixed(1)} cells`);
});

test('a walk to the star of a person who walks on ends next to the person, and the view shows them both (#72)', async () => {
  const s = await at(40, 30);
  const hero = getEntity(s.state, 'hero');
  const teacher = getEntity(s.state, 'npc:teacher');
  const views = [];
  s.listen((e) => { if (e.type === 'workView') views.push(e); });
  starTap(s, teacher.position);
  run(s, 1);
  // The teacher walks on, six cells to the side, while the hero walks to his star.
  const to = { x: teacher.position.x - 12, z: teacher.position.z + 4 };
  delete teacher.steer;
  delete teacher.schedule;
  Object.assign(teacher.position, to);
  run(s, 40, () => views.length > 0);
  const d = Math.hypot(hero.position.x - teacher.position.x, hero.position.z - teacher.position.z) / 2;
  assert.ok(d <= 3.5, `the hero is next to the teacher where he is now: ${d.toFixed(1)} cells`);
  const v = views.at(-1);
  assert.equal(v?.key, 'meet-npc:teacher', 'the view turns to the teacher');
  assert.ok(v.points.some((p) => Math.hypot(p.x - teacher.position.x, p.z - teacher.position.z) < 1), 'the view holds the teacher');
});

test('a tap on the teacher at his mat walks toward him from each side, never away first (#72)', async () => {
  const story = (await import('./helpers.js')).load('tests/stories/trial-scholar.json');
  const away = [];
  for (const [dx, dy] of [[6, 0], [-6, 0], [0, 6], [0, -6], [4, 4], [-4, -4], [4, -4], [-4, 4]]) {
    let s = null;
    await runHeadless({ ...story, name: 'tap-teacher', steps: [{ wait: 0.5 }] }, { onSession: (q) => { s = q; } });
    const teacher = getEntity(s.state, 'npc:teacher');
    const hero = getEntity(s.state, 'hero');
    const start = { x: teacher.position.x + dx * 2, z: teacher.position.z + dy * 2 };
    // A start in a house or in the water is not a place to stand.
    if (!s.tileMap.walkable(Math.floor(start.x / 2), Math.floor(start.z / 2))) continue;
    Object.assign(hero.position, start);
    s.step();
    const d0 = Math.hypot(hero.position.x - teacher.position.x, hero.position.z - teacher.position.z) / 2;
    s.command({ type: 'tap', target: { person: 'npc:teacher' } });
    s.events();
    let most = d0;
    for (let i = 0; i < 20 * 30; i++) {
      s.step();
      s.events();
      most = Math.max(most, Math.hypot(hero.position.x - teacher.position.x, hero.position.z - teacher.position.z) / 2);
      if (i > 15 && !hero.route) break;
    }
    const end = Math.hypot(hero.position.x - teacher.position.x, hero.position.z - teacher.position.z) / 2;
    if (most > d0 + 1.5 || end > 3.5) away.push(`from ${dx},${dy}: start ${d0.toFixed(1)}, most ${most.toFixed(1)}, end ${end.toFixed(1)} cells`);
  }
  assert.deepEqual(away, []);
});
