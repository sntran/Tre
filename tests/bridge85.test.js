// The bridge of the play test of #85: the line after a plank that is too long, a press with a
// plank that goes to the gap, the guess with clear words and its check, the eye at the bridge,
// and a demonstration next to the child.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { getEntity, query } from '../src/core/world/state.js';
import { load } from './helpers.js';

const profile = (flags) => ({ name: 'An', grade: 2, lang: 'vi', seed: 7, flags: { 'intro.seen': true, ...flags } });
const open = { 'trial.fisher.done': true };
const start = [
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } },
  { read: true },
  { wait: 1 },
];
const plank = (size) => [
  { press: { plank: size } },
  { until: { event: 'pick', timeout: 20 } },
  { press: { screenOf: 'bridge-gap' } },
];

test('after a plank that is too long, the fisher says to take a shorter one, and the shorter planks glow until the child takes one', async () => {
  let s = null;
  const lines = [];
  const cues = [];
  const failures = await runHeadless({
    name: 'bridge-shorter', profile: profile(open), clock: 540, at: ['phu-dong', 46, 61],
    steps: [
      ...start,
      { press: { guess: 3 } },
      { until: { event: 'guess', timeout: 3 } },
      { wait: 2 },
      ...plank(4), { until: { event: 'put', timeout: 20 } }, { wait: 1.5 },
      ...plank(4), { until: { event: 'put', timeout: 20 } }, { wait: 1.5 },
      ...plank(5), { until: { event: 'long', timeout: 20 } },
      { until: { event: 'float', timeout: 15 } },
      { wait: 8 },
      { expect: [{ zone: 'bridge-gap', planks: 2 }] },
      // A tap on a plank of four and a press: the gap is solid.
      ...plank(4), { until: { event: 'put', timeout: 20 } }, { wait: 1 },
      { press: { screenOf: 'bridge-gap' } },
      { until: { event: 'solid', timeout: 20 } },
    ],
  }, {
    onSession: (x) => {
      s = x;
      x.listen((e) => {
        if (e.type === 'open') lines.push(e.textKey);
        if (e.type === 'cue') cues.push(e.ids);
      });
    },
  });
  assert.deepEqual(failures, []);
  assert.ok(lines.includes('mentor.bridge.shorter'), `the line of a shorter plank: ${lines.join(', ')}`);
  const pile = getEntity(s.state, 'zone:bridge-pile').zone.items.map((id) => getEntity(s.state, id));
  const shorter = pile.filter((p) => p.item.size < 5).map((p) => p.id).sort();
  assert.ok(shorter.length > 0);
  assert.ok(cues.some((ids) => ids.length && [...ids].sort().join() === shorter.join()), `the shorter planks glow: ${JSON.stringify(cues.at(-1))}`);
  assert.ok(!cues.some((ids) => ids.some((id) => getEntity(s.state, id)?.item?.size === 5)), 'no plank of five glows');
  assert.deepEqual(cues.at(-1), [], 'the glow ends after the pick');
});

test('the three lengths of the pile lie in rows with a clear space between them, and each unit of a plank shows', async () => {
  let s = null;
  const failures = await runHeadless({ name: 'bridge-pile', profile: profile(open), clock: 540, at: ['phu-dong', 46, 61], steps: [{ wait: 1 }] }, { onSession: (x) => { s = x; } });
  assert.deepEqual(failures, []);
  const planks = getEntity(s.state, 'zone:bridge-pile').zone.items.map((id) => getEntity(s.state, id));
  const rows = new Map();
  for (const p of planks) rows.set(p.item.size, [...(rows.get(p.item.size) ?? []), p]);
  const zs = [...rows.values()].map((r) => r[0].position.z).sort((a, b) => a - b);
  for (const r of rows.values()) assert.ok(r.every((p) => p.position.z === r[0].position.z), 'one row for each length');
  for (let i = 1; i < zs.length; i++) assert.ok(zs[i] - zs[i - 1] >= 4, `rows ${zs[i - 1]} and ${zs[i]} are apart`);
  for (const r of rows.values()) {
    const xs = r.map((p) => p.position.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] - r[0].item.size >= 2, 'a space between the planks of a row');
  }
  const { plank } = await import('../src/world/figures.js');
  const ticks = plank(5).parts.filter((x) => /^tick/.test(x.name ?? x.id));
  assert.ok(ticks.every((t) => t.mark && t.size[2] >= 0.18 && t.size[1] >= 0.06), 'the line between two units is a clear mark');
});

test('a press with a plank in the hands at the pile walks to the gap and puts the plank there', async () => {
  const puts = [];
  const failures = await runHeadless({
    name: 'bridge-press-put', profile: profile(open), clock: 540, at: ['phu-dong', 46, 61],
    steps: [
      ...start,
      { press: { plank: 4 } },
      { until: { event: 'pick', timeout: 20 } },
      { wait: 0.5 },
      { press: true },
      { until: { event: 'put', timeout: 20 } },
    ],
  }, { onSession: (x) => { x.listen((e) => { if (e.type === 'put') puts.push(e.zone); }); } });
  assert.deepEqual(failures, []);
  assert.deepEqual(puts, ['bridge-gap']);
});

test('the guess has clear words; the fisher points at the two ends of the gap, and the rows glow one after another', async () => {
  let s = null;
  const names = [];
  const lines = [];
  let gesture = null;
  const failures = await runHeadless({
    name: 'bridge-guess-words', profile: profile(open), clock: 540, at: ['phu-dong', 46, 61],
    steps: [
      { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 5 } },
      { do: { type: 'next' } }, { wait: 0.3 },
      { do: { type: 'next' } }, { wait: 0.3 },
      { do: { type: 'next' } }, { wait: 0.3 },
      { wait: 2 },
    ],
  }, {
    onSession: (x) => {
      s = x;
      x.listen((e) => {
        if (e.type === 'names') names.push(e);
        if (e.type === 'open' && e.textKey) lines.push(e.textKey);
        if (e.type === 'names' && e.seq?.length) gesture = structuredClone(getEntity(x.state, 'npc:fisher').gesture);
      });
    },
  });
  assert.deepEqual(failures, []);
  assert.ok(lines.includes('dlg.bridge.start.n3') && lines.includes('dlg.bridge.start.n4'), lines.join(', '));
  const vi = load('i18n/vi.json');
  assert.equal(vi['dlg.bridge.start.n3'], 'Đây là những hàng ván mờ.');
  assert.equal(vi['dlg.bridge.start.n4'], 'Cháu tìm hàng ván mờ dài bằng chỗ gãy, rồi chạm vào hàng đó.');
  const last = names.find((e) => e.seq?.length);
  assert.ok(last, 'the second line has rows that glow one after another');
  assert.deepEqual(last.seq, [1, 2, 3, 4, 5, 6].map((n) => `guess:bridge-gap:${n}`));
  assert.ok(!last.ids.some((id) => id.startsWith('guess:')), 'the rows do not all glow at once');
  const z = getEntity(s.state, 'zone:bridge-gap').zone;
  assert.ok(gesture?.then, 'a point, and then a second point');
  const ends = [gesture, gesture.then].map((g) => g.z).sort((a, b) => a - b);
  assert.deepEqual(ends, [z.from, z.from + z.gap]);
  assert.ok([gesture, gesture.then].every((g) => g.x === z.lane));
});

test('at night Nghé says the guess line with the same words, points at the ends of the gap, and the rows glow one after another', async () => {
  const seqs = [];
  const lines = [];
  const failures = await runHeadless({ name: 'bridge-guess-night', profile: profile(open), clock: 1260, at: ['phu-dong', 46, 61], steps: [{ wait: 6 }] }, {
    onSession: (x) => { x.listen((e) => { if (e.type === 'glowSeq') seqs.push(e.ids); if (e.type === 'open') lines.push(e.textKey); }); },
  });
  assert.deepEqual(failures, []);
  assert.ok(lines.includes('mentor.nghe.bridge.guess'));
  assert.equal(load('i18n/vi.json')['mentor.nghe.bridge.guess'], 'Đây là những hàng ván mờ. Bạn tìm hàng ván mờ dài bằng chỗ gãy, rồi chạm vào hàng đó.');
  assert.equal(seqs.length, 1);
  assert.equal(seqs[0].length, 6);
});

const guessRun = async (guess, sizes) => {
  const said = [];
  const failures = await runHeadless({
    name: `bridge-check-${guess}`, profile: profile(open), clock: 540, at: ['phu-dong', 46, 61],
    steps: [
      ...start,
      { press: { guess } },
      { until: { event: 'guess', timeout: 3 } },
      { wait: 2 },
      ...sizes.flatMap((n, i) => [...plank(n), { until: { event: 'put', timeout: 20 } }, { wait: i === sizes.length - 1 ? 1 : 1.5 }]),
      { press: { screenOf: 'bridge-gap' } },
      { until: { event: 'solid', timeout: 20 } },
      { wait: 1 },
    ],
  }, { onSession: (x) => { x.listen((e) => { if (e.type === 'open' && /guess(Right|Off)$/.test(e.textKey ?? '')) said.push({ key: e.textKey, n: e.params.n.key, m: e.params.m.key }); }); } });
  return { failures, said };
};

test('when the gap is solid, the fisher says the guess against the planks, in words', async () => {
  const right = await guessRun(3, [4, 4, 4]);
  assert.deepEqual(right.failures, []);
  assert.deepEqual(right.said, [{ key: 'mentor.bridge.guessRight', n: 'num.3', m: 'num.3' }]);
  const off = await guessRun(2, [4, 4, 4]);
  assert.deepEqual(off.failures, []);
  assert.deepEqual(off.said, [{ key: 'mentor.bridge.guessOff', n: 'num.2', m: 'num.3' }]);
  const vi = load('i18n/vi.json');
  assert.equal(vi['mentor.bridge.guessRight'], 'Cháu đoán {n} tấm. Cháu đặt {m} tấm: đoán đúng rồi!');
  assert.equal(vi['mentor.bridge.guessOff'], 'Cháu đoán {n} tấm. Cháu đặt {m} tấm.');
  for (const k of ['mentor.bridge.guessRight', 'mentor.bridge.guessOff', 'mentor.nghe.bridge.guessRight', 'mentor.nghe.bridge.guessOff']) assert.ok(!/\d/.test(vi[k]), `no digit in ${k}`);
});

test('at the bridge, the eye is never the act of the button, and the river line does not tell the child to wade while the bridge task is open', async () => {
  let s = null;
  const acts = [];
  const failures = await runHeadless({ name: 'bridge-eye', profile: profile(open), clock: 540, at: ['phu-dong', 46, 61], steps: [...start, { wait: 2 }] }, {
    onSession: (x) => { s = x; x.listen(() => { if (!x.screen) acts.push(x.action()?.act ?? null); }); },
  });
  assert.deepEqual(failures, []);
  assert.ok(s.mentorTask, 'the hero is at the place of a task');
  assert.ok(!acts.includes('look'), `no look at the bridge: ${[...new Set(acts)].join(', ')}`);
  // The line of the river away from the bridge: the text of the bridge while its task is open,
  // and the old text while the fisher still has his own task.
  const river = async (flags) => {
    const said = [];
    const fails = await runHeadless({ name: 'river-line', profile: profile(flags), clock: 540, at: ['phu-dong', 20, 64], steps: [{ wait: 1 }, { press: true }, { wait: 1 }] }, {
      onSession: (x) => { x.listen((e) => { if (e.type === 'open' && e.textKey) said.push(e.textKey); }); },
    });
    assert.deepEqual(fails, []);
    return said;
  };
  assert.deepEqual(await river(open), ['map.river.bridge']);
  assert.deepEqual(await river({}), ['map.river']);
  const vi = load('i18n/vi.json');
  assert.ok(!/lội/.test(vi['map.river.bridge']), 'no wade in the line of the river while the bridge task is open');
  assert.ok(/sửa cầu/.test(vi['map.river.bridge']));
});

test('a demonstration is next to the child', async () => {
  let worst = 0;
  const failures = await runHeadless(load('tests/stories/mentor-cart.json'), {
    onSession: (x) => {
      x.listen(() => {
        const h = getEntity(x.state, 'hero')?.position;
        for (const d of query(x.state, 'demo', 'position')) if (h) worst = Math.max(worst, Math.hypot(d.position.x - h.x, d.position.z - h.z));
      });
    },
  });
  assert.deepEqual(failures, []);
  assert.ok(worst > 0, 'a demonstration came');
  assert.ok(worst <= 16, `the demonstration is next to the hero (${worst.toFixed(1)} half blocks at most)`);
});
