// The raids after the play test of #135–#139 (#141): no enemy stands past the last post, one enemy
// at a post, a count with no enemy at a post throws no stone, a tool is known when the child uses
// it, the lines say true numbers, the view frames the road and not the enemies, and the sack that
// is left goes to the elder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { createRaid, stepRaid, shoot, along, postAt, lastPost, framePoints, raidLevel, AT_POST } from '../src/core/world/raids.js';
import { placeBubble } from '../src/world/marks.js';
import { createI18n } from '../src/core/i18n.js';

const raids = load('data/raids.json');
const DT = 1 / 30;
const alive = (e) => e.state !== 'retreat' && e.state !== 'gone';

// A child of grades K to 3 in a raid of the slingshot: counts for 2.4 seconds, then throws at the
// post of an enemy that stands at a post (a right count), and waits for the stone.
function playRaid(id, grade, stop) {
  const raid = createRaid(raids, id, raidLevel(raids, grade), null, [], { aimHold: true, stop, seed: 7 });
  const report = { past: 0, crowded: [], shots: 0, misses: [] };
  const pastFor = new Map();
  let phase = 'count';
  let t = 0;
  let shot = null;
  for (let i = 0; i < 150 / DT && !raid.result; i++) {
    t += DT;
    if (phase === 'count') raid.aim = { id: null, all: true };
    if (phase === 'count' && t >= 2.4) {
      const at = raid.enemies.filter((e) => alive(e) && !e.aside && e.state !== 'stunned' && postAt(raid, along(raid, e)));
      const e = at[0];
      if (e) {
        const q = postAt(raid, along(raid, e));
        raid.aim = { id: e.id, all: false };
        const evs = shoot(raid, q.d, 5);
        shot = { id: e.id, stone: evs.find((x) => x.type === 'shoot')?.id, d: q.d };
        report.shots += 1;
        phase = 'fly';
      } else {
        raid.aim = null;
        phase = 'rest';
      }
      t = 0;
    }
    if (phase === 'rest' && t >= 1) {
      phase = 'count';
      t = 0;
    }
    const was = new Map(raid.enemies.map((e) => [e.id, { x: e.x, z: e.z }]));
    const out = stepRaid(raid, DT, {});
    if (phase === 'fly') {
      const land = out.find((x) => x.type === 'land' && x.id === shot.stone);
      if (land) {
        if (!land.hit) report.misses.push(`${shot.id} at ${shot.d}`);
        raid.aim = null;
        phase = 'rest';
        t = 0;
      }
    }
    // No enemy past the last post for more than 3 seconds.
    const last = lastPost(raid);
    for (const e of raid.enemies) {
      const past = alive(e) && along(raid, e) > last + AT_POST ? (pastFor.get(e.id) ?? 0) + DT : 0;
      pastFor.set(e.id, past);
      report.past = Math.max(report.past, past);
    }
    // No two enemies stand at one post.
    const standing = raid.enemies.filter((e) => alive(e) && !e.aside && was.get(e.id)?.x === e.x && was.get(e.id)?.z === e.z && postAt(raid, along(raid, e)));
    const posts = standing.map((e) => postAt(raid, along(raid, e)).d);
    if (new Set(posts).size !== posts.length) report.crowded.push(`${raid.t.toFixed(1)}: ${posts}`);
  }
  return report;
}

test('at grades K to 3, in each raid of the slingshot: no enemy is past the last post for more than 3 seconds, no two enemies stand at one post, and every right count hits', () => {
  for (const grade of [0, 1, 2, 3]) {
    for (const [id, def] of Object.entries(raids.raids)) {
      if (!(def.tools ?? ['sling']).includes('sling')) continue;
      for (const stop of [0, 4]) {
        const r = playRaid(id, grade, stop);
        const name = `${id} at grade ${grade}, stops ${stop}`;
        assert.ok(r.past <= 3, `${name}: an enemy was past the last post for ${r.past.toFixed(1)} seconds`);
        assert.deepEqual(r.crowded, [], `${name}: two enemies at one post`);
        assert.ok(r.shots > 0, `${name}: a shot`);
        assert.deepEqual(r.misses, [], `${name}: a right count missed`);
      }
    }
  }
});

test('the frame of the view of a raid is the road: it does not change while the enemies walk', () => {
  const raid = createRaid(raids, 'soldier1', 0, null, [], { aimHold: true });
  const before = JSON.stringify(framePoints(raid));
  for (let i = 0; i < 20 / DT; i++) stepRaid(raid, DT, {});
  assert.ok(raid.enemies.length, 'the enemies came');
  assert.equal(JSON.stringify(framePoints(raid)), before);
  // The frame has the posts and the place where the enemies come in.
  const far = Math.max(...framePoints(raid).map((p) => along(raid, p)));
  assert.ok(far > lastPost(raid) && far <= lastPost(raid) + 4, `the frame ends at ${far}`);
});

test('a line of a person stands off the posts and the enemies (the work boxes of a raid)', () => {
  const screen = { w: 390, h: 844, top: 0, bottom: 844 };
  // A post under the head of the person.
  const post = { x0: 170, y0: 300, x1: 220, y1: 380 };
  const at = placeBubble({ x: 195, y: 330 }, 260, 60, { screen, work: [post] });
  const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  assert.ok(!overlaps(at, post), JSON.stringify(at));
});

async function atScouts(grade, flags = {}) {
  const base = { 'intro.seen': true, 'giong.spoke': true, 'raid.tool.sling': true, 'raid.tool.gate': true, 'raid.tool.drag': true, 'raid.used.sling': 2, 'raid.used.gate': 2, 'raid.rule.day': 0, 'raid.hits.last': 2 };
  let session = null;
  await runHeadless({ name: 'raid-141', profile: { name: 'Su', grade, lang: 'vi', seed: 4, flags: { ...base, ...flags }, items: { rice: 5 } }, clock: 540, at: ['phu-dong', 61, 29], steps: [{ wait: 1 }] }, { onSession: (s) => { session = s; } });
  const got = { lines: [], glows: [], events: [] };
  session.listen((ev) => {
    if (ev.type === 'open' && ev.textKey) got.lines.push(ev.textKey);
    if (ev.type === 'glowSeq') got.glows.push(ev.ids);
    got.events.push(ev);
  });
  const run = (s) => {
    for (let i = 0; i < s / STEP; i++) {
      session.step();
      for (const ev of session.events()) got.events.push(ev);
    }
  };
  const read = () => {
    for (let n = 0; session.screen && n < 40; n++) {
      session.command(session.screen === 'dialogue' || session.screen === 'say' ? { type: 'next' } : { type: 'close' });
      session.events();
      run(0.3);
    }
  };
  const start = (id) => {
    session.command({ type: 'tap', target: { person: `encounter:${id}` } });
    session.events();
    session.command({ type: 'hands' });
    session.events();
    for (let t = 0; t < 20 && !getEntity(session.state, 'raid'); t += 0.3) {
      read();
      run(0.3);
    }
    read();
  };
  return { session, got, run, read, start };
}

test('at grade 1, a count that ends while no enemy is at a post throws no stone, says the line one time, and the next post glows', async () => {
  const s = await atScouts(1);
  s.start('scouts');
  const raid = getEntity(s.session.state, 'raid').raid;
  // The first scout comes in near the last post and walks on: wait until it is between two posts.
  for (let i = 0; i < 400; i++) {
    const e = raid.enemies.find(alive);
    if (e && along(raid, e) < 19 && along(raid, e) > 17) break;
    s.run(STEP);
  }
  const e = raid.enemies.find(alive);
  assert.ok(e && !postAt(raid, along(raid, e)), `the scout is between two posts (${e && along(raid, e).toFixed(1)})`);
  s.got.lines.length = 0;
  s.got.glows.length = 0;
  const shots = raid.shots;
  const a = s.session.action();
  assert.equal(a?.act, 'sling');
  s.session.command({ type: 'hands', id: a.id });
  s.run(3);
  assert.equal(raid.stones.length, 0, 'no stone');
  assert.equal(raid.shots, shots);
  assert.ok(s.got.lines.includes('raid.nopost'), s.got.lines.join(', '));
  assert.ok(s.got.glows.some((g) => g.length === 1 && g[0] === 'post:3'), JSON.stringify(s.got.glows));
  const vi = createI18n(load('i18n/vi.json'), 'vi');
  assert.equal(vi.t('raid.nopost', { who: { key: 'raid.who.soldier' } }), 'Lính chưa tới cột nào. Chờ lính đứng ở cột, rồi đếm nhé.');
});

test('a new tool that the child does not use stays new: after a lost try the same line comes again, and its flag comes only with its use or a win', async () => {
  // The patrol brings the traps, new for this child. The child takes a trap and never puts it.
  const s = await atScouts(2, { 'giong.farewell': true, 'scouts.won': true });
  s.start('patrol');
  assert.ok(s.got.lines.includes('raid.tool.traps'), s.got.lines.join(', '));
  const raid = getEntity(s.session.state, 'raid').raid;
  const flags = s.session.profile.flags;
  assert.equal(flags['raid.tool.traps'], undefined, 'no flag with the line');
  const used = flags['raid.used.traps'];
  s.session.command({ type: 'tap', target: { thing: 'trap:1' } });
  s.run(5);
  s.session.command({ type: 'hands', id: s.session.action()?.id });
  s.run(1);
  s.read();
  for (let i = 0; i < 240 && !raid.result; i++) {
    s.read();
    s.run(0.5);
  }
  assert.equal(raid.result, 'lost', 'the scouts took the rice');
  assert.equal(flags['raid.tool.traps'], undefined, 'the traps are still new');
  assert.equal(flags['raid.used.traps'], used);
  // The next try: the same new tool with its line.
  const again = await atScouts(2, { 'giong.farewell': true, 'scouts.won': true, 'raid.patrol.lost': 1 });
  again.start('patrol');
  assert.ok(again.got.lines.includes('raid.tool.traps'), again.got.lines.join(', '));
  // A trap on the road is a use: the flag comes.
  again.session.command({ type: 'tap', target: { thing: 'trap:1' } });
  again.run(5);
  again.session.command({ type: 'hands', id: again.session.action()?.id });
  again.run(1);
  again.read();
  const r2 = getEntity(again.session.state, 'raid').raid;
  again.session.command({ type: 'tap', target: { thing: `post:${r2.posts.findIndex((q) => q.d === r2.trapPost) + 1}` } });
  again.run(6);
  again.session.command({ type: 'hands', id: again.session.action()?.id });
  again.run(1);
  assert.ok(again.got.events.some((ev) => ev.type === 'trapput'), 'a trap on the road');
  assert.equal(again.session.profile.flags['raid.tool.traps'], true);
});

test('the lines of the soldiers and of the shares say true numbers, and the sack that is left goes to the elder', () => {
  const vi = createI18n(load('i18n/vi.json'), 'vi');
  const grown = vi.t('dlg.giong.grown.n3');
  assert.ok(!/\bHai\b|\bhai\b/.test(grown), grown);
  assert.match(grown, /chân núi Trâu/);
  // Each group of soldiers has three soldiers; the second share says its own count.
  for (const id of ['soldier1', 'soldier2']) assert.equal(raids.raids[id].waves.length, 3);
  assert.equal(raids.raids.soldier2.shareKey, 'share.start.again');
  assert.equal(vi.t('share.start.again', { n: { key: `num.${raids.raids.soldier2.loot}` } }), 'Toán lính thứ hai cũng bỏ lại gạo: mười bao. Lại chia đều nhé.');
  assert.equal(vi.t('share.rest', { n: { key: 'num.1' } }), 'Còn một bao gạo lẻ. Cháu mang về cho cụ già làng ở đình nhé.');
  const share = load('data/trials.json').trials.find((t) => t.id === 'share');
  assert.deepEqual(Object.keys(share.rest), ['elder']);
});
