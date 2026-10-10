// Every line is heard (#73): a line that says what happened is never cut or replaced by a later
// line of the same person, every word of a count is said, the escape of the fish has its own line
// and its glowing space, and the first visit to a task has no picture of another station.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bubbleLine, createVoiceQueue } from '../src/core/bubblevoice.js';
import { onCommit, onWave, newMemory, newMentor } from '../src/core/mentor.js';
import { runHeadless, data } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity } from '../src/core/world/state.js';
import { load } from './helpers.js';

const cfg = data.mentors;
const line = (key, id = 'npc:healer', extra = {}) => bubbleLine({ screen: 'callout', id, textKey: key, params: {}, ...extra });

// The lines that a slow voice says, in their order: each line comes while the voice is busy.
function heardOf(lines) {
  const q = createVoiceQueue();
  let now = 0;
  for (const l of lines) q.offer(l, true, now += 0.1);
  const out = [];
  for (let x = q.next(false, now); x; x = q.next(false, now += 3)) out.push(x.key);
  return out;
}

test('a line of what happened is never replaced by a later line of the same person, and the later line comes after it', () => {
  const bend = line('smith.bend.late', 'npc:smith', { happened: true });
  assert.equal(bend.kind, 'world');
  const heard = heardOf([bend, line('mentor.picture.smith', 'npc:smith'), line('mentor.break', 'npc:smith')]);
  assert.equal(heard[0], 'smith.bend.late', heard.join(' '));
  assert.ok(heard.includes('mentor.break'));
  // Two lines of what happened in a row: both are said.
  assert.deepEqual(heardOf([line('mentor.healer.none.tiato', 'npc:healer', { happened: true }), line('mentor.healer.none.rauma', 'npc:healer', { happened: true })]), ['mentor.healer.none.tiato', 'mentor.healer.none.rauma']);
});

test('every word of a count is said: the rows of 4, 5, and 4 at the healer while the voice is behind', () => {
  const rows = [4, 5, 4].flatMap((n) => Array.from({ length: n }, (_, i) => line(`num.${i + 1}`)));
  const heard = heardOf([...rows, line('mentor.healer.share')]);
  assert.deepEqual(heard.slice(0, 13), rows.map((l) => l.key));
  assert.equal(heard[13], 'mentor.healer.share', 'the next line of the person waits for the last number');
});

test('the mentor: no picture of another station in the first visit to a task; in a later visit it can come', () => {
  const fam = cfg.families.plain;
  const input = { parts: [1], target: 1, solved: false, efficient: false, mashing: false, resets: 0, timeS: 6, sizes: [1], fact: '1', pL: 0 };
  for (const firstVisit of [true, false]) {
    const st = newMentor('trial-smith');
    const memory = newMemory();
    const moves = [];
    for (let k = 0; k < 6; k++) moves.push(onCommit(st, memory, { ...input, firstVisit }, fam, cfg).move);
    if (firstVisit) assert.ok(!moves.includes('picture'), moves.join(' '));
    else assert.ok(moves.includes('picture'), moves.join(' '));
  }
});

test('the mentor: a wave after a break gives a help of the ladder, never the break or the picture again', () => {
  for (const name of Object.keys(cfg.families)) {
    const fam = cfg.families[name];
    for (const diag of Object.keys(fam.ladders)) {
      for (let level = 0; level <= cfg.top; level++) {
        const st = { ...newMentor('trial-smith'), tried: true, lastSolved: false, lastDiag: diag, level };
        const r = onWave(st, newMemory(), fam, cfg, 0, true);
        assert.ok(!['break', 'picture', 'wait', 'offer'].includes(r.move), `${name} ${diag} ${level}: ${r.move}`);
      }
    }
  }
});

function run(session, seconds, until = () => false) {
  for (let i = 0; i < seconds / STEP && !until(); i++) {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
  }
}

// A row of the fisher that is too short (the practice cam-coc), with the memory of the mentor of a
// child who checks the row alone (the handover: the person only watches).
async function escape(mentors = {}) {
  let session = null;
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true }, mentors };
  const failures = await runHeadless({ name: 'lines-escape', practice: 'cam-coc', profile, steps: [
    { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } },
    { read: true },
    { press: { thing: 'stake:fisher:2' } },
    { until: { event: 'pick', timeout: 15 } },
    { tap: { line: 9 } },
    { wait: 2 },
    { press: true },
    { until: { event: 'put', timeout: 15 } },
  ] }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  const lines = [];
  const glow = [];
  session.listen((ev) => {
    if (ev.type === 'open' && ev.screen === 'callout') lines.push({ key: ev.textKey, happened: Boolean(ev.happened) });
    if (ev.type === 'escape') glow.push(Boolean(getEntity(session.state, 'why:fisher:space')));
  });
  run(session, 200, () => glow.length > 0);
  run(session, 1);
  const space = getEntity(session.state, 'why:fisher:space');
  run(session, 8);
  return { lines, glow: glow[0] && Boolean(space), gone: !getEntity(session.state, 'why:fisher:space') };
}

test('the fish swim out: the widest space glows, and the fisher says it, also after the handover of the checking', async () => {
  for (const mentors of [{}, { 'trial-fisher': { ...newMemory(), selfFix: 9, visits: 4 } }]) {
    const r = await escape(mentors);
    assert.ok(r.glow, 'the widest space glows while the fish swim out');
    assert.ok(r.gone, 'the glow goes with the fish');
    const said = r.lines.find((l) => l.key === 'fisher.escape');
    assert.ok(said?.happened, `the line of the escape: ${r.lines.map((l) => l.key).join(' ')}`);
  }
});

test('the late quench says what the iron does next', () => {
  const vi = load('i18n/vi.json');
  assert.equal(vi['smith.bend.late'], 'Sắt nguội mất rồi, nên cong. Sắt vào lò, lát nữa lại đỏ.');
  assert.equal(vi['fisher.escape'], 'Chỗ này hở quá, cá chui ra mất.');
});
