// The raids after the play test of #123–#134 (#135): an enemy stands only at a post that the child
// sees, a raid brings at most one new tool, the rule of the count says the side to count from, the
// trap says its place, and a lost raid says why.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { createRaid, stepRaid, along, raidLevel, raidTools } from '../src/core/world/raids.js';

const raids = load('data/raids.json');
const DT = 1 / 30;

test('while the child counts, an enemy stands only within the reach of a hit of a drawn post, at grades K, 1, and 4, in each raid of the slingshot', () => {
  for (const grade of [0, 1, 4]) {
    for (const [id, def] of Object.entries(raids.raids)) {
      if (!(def.tools ?? ['sling']).includes('sling')) continue;
      const raid = createRaid(raids, id, raidLevel(raids, grade), null, [], { aimHold: true, stop: grade < 4 ? 4 : 0 });
      const stood = [];
      for (let i = 0; i < 90 / DT && !raid.result; i++) {
        // The child counts all the time: every enemy may stand.
        raid.aim = { id: null, all: true };
        const was = new Map(raid.enemies.map((e) => [e.id, { x: e.x, z: e.z, state: e.state }]));
        stepRaid(raid, DT, {});
        for (const e of raid.enemies) {
          const p = was.get(e.id);
          if (p && p.state === 'walk' && e.state === 'walk' && p.x === e.x && p.z === e.z) stood.push(along(raid, e));
        }
      }
      assert.ok(stood.length, `${id} at grade ${grade}: an enemy stood`);
      for (const d of stood) assert.ok(raid.posts.some((q) => Math.abs(q.d - d) <= raid.sling.hit), `${id} at grade ${grade}: an enemy stood at ${d.toFixed(1)}, posts ${raid.posts.map((q) => q.d)}`);
    }
  }
});

test('no raid brings two tools that the child has not used: the first new tool comes, and the boss brings none at grades K to 2', () => {
  const order = ['sling', 'gate', 'traps', 'helpers', 'nghe', 'water', 'fire', 'lightning'];
  for (const grade of [0, 1, 2, 3, 5]) {
    // A child who meets the raids of the story in their order, and wins each one at once.
    const flags = {};
    for (const id of ['scouts', 'river', 'soldier1', 'soldier2', 'boss']) {
      const { tools, teach } = raidTools(raids, id, flags, grade);
      const fresh = tools.filter((t) => raids.toolLines[t] && !flags[`raid.tool.${t}`]);
      assert.ok(fresh.length <= 1, `${id} at grade ${grade}: new tools ${fresh}`);
      assert.deepEqual(fresh, teach);
      if (id === 'boss' && grade <= 2) assert.deepEqual(fresh, [], 'the boss at grades K to 2 uses only tools that the child has used');
      // The new tool is the first new one in the order of the story.
      if (fresh.length) assert.equal(fresh[0], (raids.raids[id].tools).filter((t) => order.includes(t)).find((t) => !flags[`raid.tool.${t}`]));
      for (const t of tools) if (raids.toolLines[t]) flags[`raid.tool.${t}`] = true;
    }
  }
});

const PLACES = { scouts: ['phu-dong', 61, 29], patrol: ['phu-dong', 61, 29] };
async function atRaid(id, grade, flags = {}) {
  const base = { 'intro.seen': true, 'giong.spoke': true, 'raid.tool.sling': true, 'raid.tool.gate': true, 'raid.tool.drag': true, 'raid.used.sling': 2, 'raid.used.gate': 2 };
  let session = null;
  await runHeadless({ name: 'raid-135', profile: { name: 'Su', grade, lang: 'vi', seed: 4, flags: { ...base, ...flags }, items: { rice: 5 } }, clock: 540, at: PLACES[id], steps: [{ wait: 1 }] }, { onSession: (s) => { session = s; } });
  const got = { lines: [], glows: [], time: 0 };
  session.listen((ev) => {
    if (ev.type === 'open' && ev.textKey) got.lines.push({ key: ev.textKey, params: ev.params ?? {} });
    if (ev.type === 'glowSeq') got.glows.push(ev.ids);
  });
  const run = (s) => {
    for (let i = 0; i < s / STEP; i++) {
      session.step();
      session.events();
      got.time += STEP;
    }
  };
  const read = () => {
    for (let n = 0; session.screen && n < 40; n++) {
      session.command(session.screen === 'dialogue' || session.screen === 'say' ? { type: 'next' } : { type: 'close' });
      session.events();
      run(0.3);
    }
  };
  session.command({ type: 'tap', target: { person: `encounter:${id}` } });
  session.events();
  session.command({ type: 'hands' });
  session.events();
  for (let t = 0; t < 20 && !getEntity(session.state, 'raid'); t += 0.3) {
    read();
    run(0.3);
  }
  read();
  return { session, got, run, read };
}

test('the rule of the count with the side comes at the start of a raid after a raid with no hit, and the first post glows', async () => {
  const none = await atRaid('scouts', 1, { 'raid.hits.last': 0 });
  const keys = none.got.lines.map((l) => l.key);
  assert.ok(keys.includes('raid.tool.sling') && keys.includes('raid.rule'), `the lines: ${keys.join(', ')}`);
  assert.ok(none.got.glows.some((g) => g.length === 1 && g[0] === 'post:1'), 'the first post glows');
  // The next raid of the same day after a raid with hits: no rule line.
  const hits = await atRaid('scouts', 1, { 'raid.hits.last': 3, 'raid.rule.day': 0 });
  assert.ok(!hits.got.lines.some((l) => l.key === 'raid.rule'), 'no rule line after a raid with hits on the same day');
});

test('with a trap in the hands, a press away from the road says the place, and the posts up to it glow; a trap at that post is right', async () => {
  const r = await atRaid('patrol', 2, { 'giong.farewell': true, 'scouts.won': true, 'raid.tool.traps': true });
  const { session, got, run, read } = r;
  const raid = getEntity(session.state, 'raid')?.raid;
  assert.ok(raid?.tools.includes('traps'), 'the patrol has the traps');
  // Walk to the heap and pick up a trap.
  const trap = getEntity(session.state, 'trap:1');
  session.command({ type: 'tap', target: { thing: trap.id } });
  session.events();
  run(5);
  session.command({ type: 'hands', id: session.action()?.id });
  session.events();
  run(1);
  read();
  assert.ok(['trap:1', 'trap:2'].some((id) => getEntity(session.state, id)?.item.held), 'a trap in the hands');
  const n = raid.posts.findIndex((q) => q.d === raid.trapPost) + 1;
  // A press away from the road: the line of the place.
  got.lines.length = 0;
  got.glows.length = 0;
  const a = session.action();
  assert.equal(a?.act, 'say', `the button: ${a?.act}`);
  session.command({ type: 'hands', id: a.id });
  session.events();
  run(0.5);
  const where = got.lines.find((l) => l.key === 'raid.trap.where');
  assert.ok(where, `the lines: ${got.lines.map((l) => l.key).join(', ')}`);
  assert.equal(where.params.post.key, `ord.${n}`);
  assert.ok(got.glows.some((g) => g.length === n && g.at(-1) === `post:${n}`), 'the posts up to it glow');
  // A tap on that post walks the hero there with the trap (as a child does), and the trap at that
  // post is right.
  session.command({ type: 'tap', target: { thing: `post:${n}` } });
  session.events();
  run(6);
  got.lines.length = 0;
  session.command({ type: 'hands', id: session.action()?.id });
  session.events();
  run(1);
  assert.ok(got.lines.some((l) => l.key === 'raid.trap.right'), `the lines: ${got.lines.map((l) => l.key).join(', ')}`);
});

test('a lost raid says how many enemies came to the gate', async () => {
  // A later raid of the scouts, and the child does nothing.
  const { session, got, run, read } = await atRaid('scouts', 1);
  for (let t = 0; t < 240 && getEntity(session.state, 'raid') && !getEntity(session.state, 'raid').raid.result; t += 1) {
    read();
    run(1);
  }
  read();
  run(2);
  read();
  const raid = getEntity(session.state, 'raid')?.raid;
  const why = got.lines.find((l) => l.key === 'raid.lost.why');
  assert.ok(why, `the lines: ${got.lines.map((l) => l.key).join(', ')} (${raid?.result})`);
  assert.match(why.params.n.key, /^num\.\d+$/);
});
