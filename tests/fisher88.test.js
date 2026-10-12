// The fisher after the play test of #85 (#88): presses alone do not finish the row. The pile keeps
// the stakes of the level; at the first empty pile the fisher says that a gap is narrower than his
// gap, and the narrow gaps glow; at the second, he shows his gap on a short row next to the child,
// and then he brings the stakes that the rest of the row needs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity, query } from '../src/core/world/state.js';
import { load } from './helpers.js';

const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
const FISHER = [27, 64.5];
const start = [
  { press: { entity: 'npc:fisher' } },
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
  { read: true },
  { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 15 } },
];
async function atRow(steps = []) {
  let session = null;
  let end = null;
  const failures = await runHeadless({ name: 'fisher-88', profile, clock: 540, at: ['phu-dong', ...FISHER], steps: [...start, ...steps] }, { log: true, onSession: (s) => { session = s; }, onEnd: (x) => { end = x; } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  return { session, end };
}
function run(session, seconds, until = () => false) {
  for (let i = 0; i < seconds / STEP && !until(); i++) {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
  }
}
const slots = (session) => query(session.state, 'item').filter((e) => e.item.zone === 'line').map((e) => e.item.slot).sort((a, b) => a - b);
const stakeTo = (n, at) => [{ press: { thing: `stake:fisher:${n}` } }, { until: { event: 'pick', timeout: 15 } }, { tap: { line: at } }, { wait: 2 }, { press: true }, { until: { event: 'put', timeout: 15 } }];

test('the pile has the stakes of the level: three for the row at the gap of the fisher, and three more', async () => {
  const { session } = await atRow();
  assert.equal(getEntity(session.state, 'zone:stakes').zone.items.length, 6);
});

test('a child who only presses runs out, gets the line and the marks, runs out again, gets the demonstration and then the stakes, and reaches the float', async () => {
  const { session } = await atRow();
  const seen = [];
  let narrow = 0;
  let demo = 0;
  let marksAtMore = 0;
  session.listen((ev) => {
    if (ev.type === 'call') seen.push(ev.key);
    if (ev.type === 'empty') seen.push(`empty ${ev.n}`);
    const marks = query(session.state, 'position').filter((e) => String(e.id).startsWith('why:fisher:narrow:')).length;
    if (ev.type === 'more') {
      seen.push(`more ${ev.n}`);
      if (marks) marksAtMore += 1;
    }
    narrow = Math.max(narrow, marks);
    if (query(session.state, 'demo', 'position').length) demo += 1;
  });
  const z = getEntity(session.state, 'zone:line').zone;
  for (let k = 0; k < 160 && !slots(session).includes(z.length); k++) {
    if (getEntity(session.state, 'zone:trial-fisher')?.zone.tide.phase !== 'low') {
      run(session, 2);
      continue;
    }
    const a = session.action();
    session.command({ type: 'hands', id: a?.id });
    session.events();
    run(session, 3);
  }
  assert.ok(slots(session).includes(z.length), `the row reaches the float: ${slots(session).join(',')}`);
  const at = (x) => seen.indexOf(x);
  assert.ok(at('empty 1') >= 0, seen.join(', '));
  assert.ok(at('fisher.empty') > at('empty 1') - 2, 'the line of the empty pile');
  assert.ok(narrow > 0, 'the narrow gaps glow');
  assert.ok(seen.includes('mentor.fisher.tight'), 'the hint of the take back at the first empty pile');
  assert.ok(at('empty 2') > at('empty 1'), 'the second empty pile');
  assert.ok(demo > 0, 'a demonstration');
  assert.ok(seen.includes('mentor.fisher.fit'), 'the line of his gap');
  const more = seen.findIndex((x) => x.startsWith('more '));
  assert.ok(more > at('empty 2'), 'the stakes come after the demonstration');
  assert.ok(seen.indexOf('fisher.more') > at('empty 2'));
  assert.ok(!seen.slice(0, at('empty 2')).includes('fisher.more'), 'no new stakes before the help');
  assert.equal(marksAtMore, seen.filter((x) => x.startsWith('more ')).length, 'the narrow gaps glow at each bring of stakes');
  // The record keeps the help and the count of the stakes.
  const helps = (session.profile.log?.events ?? []).filter((e) => e.type === 'stakes');
  assert.ok(helps.some((e) => e.help === 'demo'), JSON.stringify(helps));
  assert.ok(helps.some((e) => e.help === 'stakes' && e.stakes > 0), JSON.stringify(helps));
  const vi = load('i18n/vi.json');
  assert.equal(vi['fisher.empty'], 'Hết cọc rồi. Có khe hẹp hơn khe của chú.');
  assert.equal(vi['mentor.fisher.fit'], 'Khe rộng bằng khe của chú là vừa.');
});

test('a child who taps the points at the gap of the fisher finishes with the stakes of the pile and no help', async () => {
  const seen = [];
  let session = null;
  const failures = await runHeadless({
    name: 'fisher-88-taps', profile, clock: 540, at: ['phu-dong', ...FISHER],
    steps: [...start, ...stakeTo(0, 8), ...stakeTo(1, 12), ...stakeTo(2, 16), { until: { event: 'catch', timeout: 60 } }],
  }, {
    onSession: (s) => {
      session = s;
      s.listen((ev) => { if (ev.type === 'empty' || ev.type === 'more') seen.push(ev.type); });
    },
  });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  assert.deepEqual(seen, []);
  assert.deepEqual(slots(session).filter((x) => x > 4), [8, 12, 16]);
});
