// The share stays the share (#185): one work at a time on the button (never the start of a raid
// during the share), the share comes soon after the last line of the win, a raid with a trap ask
// waits for the trap up to grade 2, the line of a loss names only a true cause, and up to grade 1 a
// tap on a mat with empty hands takes a sack from the pile and walks to that mat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';

function tools(session) {
  const said = [];
  const events = [];
  session.listen((e) => {
    events.push({ ...e, tick: session.state.tick });
    if (e.type === 'open' && e.textKey) said.push(e.textKey);
  });
  const run = (sec, until = () => false) => {
    for (let i = 0; i < sec / STEP && !until(); i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  return { session, said, events, run };
}

async function play(name, steps, profile = null) {
  const s0 = load(`tests/stories/${name}.json`);
  let session = null;
  const failures = await runHeadless({ ...s0, ...(profile ? { profile: { ...s0.profile, ...profile } } : {}), steps: steps(s0.steps) }, { onSession: (x) => { session = x; } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  return tools(session);
}

// The share after the raid of the soldiers, after its first lines.
const atShare = (profile = null) => play('raid-soldiers', (steps) => steps.slice(0, steps.findIndex((x) => x.expect?.some?.((f) => f.text?.shown === 'share.start')) + 2), profile);

test('during the whole share the button never offers the start of the raid, also next to the crossroads', async () => {
  const h = await atShare();
  const s = h.session;
  const share = getEntity(s.state, 'zone:trial-share').zone;
  const loot = () => getEntity(s.state, 'zone:loot').zone.items;
  const who = share.who ?? ['hero', 'nghe', 'giong'];
  const acts = new Set();
  for (let i = 0; i < 6 && loot().length; i++) {
    s.command({ type: 'tap', target: { thing: loot()[0] } });
    h.run(4);
    acts.add(s.action()?.act);
    s.command({ type: 'hands', id: s.action()?.id });
    h.run(1);
    const mat = getEntity(s.state, `zone:share-${who[i % who.length]}`).zone;
    s.command({ type: 'tap', target: { ground: { x: mat.x / 2, y: mat.z / 2, h: mat.y / 2, thing: false, object: null } } });
    h.run(4);
    acts.add(s.action()?.act);
    s.command({ type: 'hands', id: s.action()?.id });
    h.run(2);
    acts.add(s.action()?.act);
  }
  assert.ok(!acts.has('raid'), [...acts].join(', '));
  assert.ok(!h.events.some((e) => e.type === 'raid' && e.on), 'no raid starts');
});

test('the share starts less than 2 s after the last line of the win is read', async () => {
  const h = await play('raid-soldiers', (steps) => steps.slice(0, steps.findIndex((x) => x.expect?.some?.((f) => f.event === 'end'))));
  let closed = null;
  for (let i = 0; i < 30 / STEP && !h.said.includes('share.start'); i++) {
    if (h.session.screen) {
      h.session.command({ type: 'next' });
      closed = h.session.state.tick;
    }
    h.session.step();
    h.session.events();
  }
  const start = h.events.find((e) => e.type === 'open' && e.textKey === 'share.start');
  assert.ok(start, h.said.join(', '));
  assert.ok((start.tick - closed) * STEP < 2, `${((start.tick - closed) * STEP).toFixed(1)} s`);
});

test('at grade 1, a raid with a trap ask after the first raid of the traps waits for the trap; it goes on when the trap is in the hands', async () => {
  const h = await play('raid-soldiers-traps', (steps) => steps.slice(0, 3), { grade: 1, flags: { ...load('tests/stories/raid-soldiers-traps.json').profile.flags, 'raid.tool.traps': true, 'raid.used.traps': 2 } });
  const raid = () => getEntity(h.session.state, 'raid').raid;
  assert.equal(raid().hold?.tool, 'traps');
  h.run(15);
  const walked = raid().enemies.filter((e) => e.state === 'walk');
  assert.deepEqual(walked.map((e) => e.id), [], 'no soldier walks before the trap is in the hands');
  const trap = query(h.session.state, 'item').find((e) => e.item.kind === 'trap' && !e.item.held);
  h.session.command({ type: 'tap', target: { thing: trap.id } });
  h.run(4);
  h.session.command({ type: 'hands', id: h.session.action()?.id });
  h.run(2);
  assert.equal(raid().hold, null, 'the raid goes on');
});

test('the line of a loss with no miss does not name the count; soldiers who came with no trap in the hands say so', async () => {
  const vi = load('i18n/vi.json');
  assert.equal(vi['raid.lost.notool'], '{who} tới khi cháu chưa cầm bẫy.');
  // Grade 3: the raid does not wait for the trap. The child does nothing.
  const flags = { ...load('tests/stories/raid-lost.json').profile.flags };
  const h = await play('raid-soldiers-traps', (steps) => steps.slice(0, 3), { grade: 3, flags });
  h.run(240, () => h.events.some((e) => e.type === 'end' && e.id === 'raid'));
  const end = h.events.find((e) => e.type === 'end' && e.id === 'raid');
  assert.ok(end && !end.won, 'a loss');
  h.run(3);
  assert.ok(!h.said.includes('raid.lost.count'), h.said.slice(-6).join(', '));
  assert.ok(h.said.includes('raid.lost.notool'), h.said.slice(-6).join(', '));
});

test('at grade 1, with empty hands a tap on a mat takes a sack from the pile and walks to that mat; a press puts it there', async () => {
  const h = await atShare();
  const s = h.session;
  s.profile.grade = 1;
  h.run(2);
  const mat = getEntity(s.state, 'zone:share-giong').zone;
  const before = mat.items.length;
  assert.equal(s.carried(), null);
  s.command({ type: 'tap', target: { thing: 'mat:share-giong' } });
  h.run(8);
  assert.ok(s.carried(), 'a sack in the hands');
  assert.equal(s.action()?.target, 'zone:share-giong', JSON.stringify(s.action()));
  s.command({ type: 'hands', id: s.action()?.id });
  h.run(2);
  assert.equal(mat.items.length, before + 1, 'the sack is on the mat of Gióng');
});
