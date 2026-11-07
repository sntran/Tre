// One press, one post, for the trap as for the slingshot (#165): each press with a trap in the
// hands moves the trap one post and says the count, the trap goes to the post of the count, the
// lines of the trap come before the lines of the slingshot, and the posts have count words.
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';
import { along } from '../src/core/world/raids.js';

const vi = load('i18n/vi.json');
const en = load('i18n/en.json');

async function start(name, grade, extra = {}) {
  const s = load(`tests/stories/${name}.json`);
  const upto = s.steps.findIndex((x) => x.read === true);
  let session = null;
  const said = [];
  const events = [];
  const failures = await runHeadless({ ...s, profile: { ...s.profile, grade, flags: { ...s.profile.flags, ...extra } }, steps: s.steps.slice(0, upto + 1) }, { onSession: (x) => {
    session = x;
    x.listen((e) => {
      events.push(e);
      if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, params: e.params ?? {}, id: e.id ?? null });
    });
  } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const press = (sec = 0.5) => { session.command({ type: 'hands', id: session.action()?.id ?? null }); run(sec); };
  const raid = () => getEntity(session.state, 'raid')?.raid;
  const pick = () => {
    const trap = query(session.state, 'item').find((e) => e.item.kind === 'trap' && !e.item.held && e.item.zone !== 'raid-road');
    session.command({ type: 'tap', target: { thing: trap.id } });
    run(5);
    press(1);
    assert.equal(getEntity(session.state, getEntity(session.state, 'hero').hands?.holds)?.item.kind, 'trap', 'a trap in the hands');
  };
  return { session, said, events, run, press, raid, pick };
}

test('no two keys of the same name in the texts, and no "cột nhất": the posts have count words', () => {
  for (const f of ['i18n/vi.json', 'i18n/en.json']) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    const keys = [...src.matchAll(/^\s+"([^"]+)":/gm)].map((m) => m[1]);
    const seen = new Set();
    const twice = keys.filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
    assert.deepEqual(twice, [], f);
  }
  assert.equal(vi['raid.trap.ask'].replace('{post}', vi['num.2']), 'Đặt một cái bẫy ở cột hai.');
  assert.equal(vi['healer.dose.lack'].replace('{n}', vi['ord.1']).replace('{herb}', 'rau má'), 'Thang thứ nhất còn thiếu rau má.');
  assert.equal(en['raid.trap.ask'].replace('{post}', en['num.2']), 'Put a trap at post two.');
});

test('at K, two presses with a trap in the hands: the hero says one, two, the ghost goes to post 2, and the trap lies at post 2', async () => {
  const h = await start('raid-soldiers-traps', 0);
  h.pick();
  const r = h.raid();
  const ghostAt = () => along(r, h.session.action().ghost);
  assert.ok(Math.abs(ghostAt() - r.posts[0].d) <= 1, 'before a press the ghost is at post 1');
  const from = h.said.length;
  h.press(0.5);
  h.press(0.5);
  assert.ok(Math.abs(ghostAt() - r.posts[1].d) <= 1, `the ghost at ${ghostAt()}, post 2 at ${r.posts[1].d}`);
  const counts = h.said.slice(from).filter((l) => /^num\./.test(l.key)).map((l) => l.key);
  assert.deepEqual(counts, ['num.1', 'num.2']);
  h.run(10);
  const put = query(h.session.state, 'item').find((e) => e.item.kind === 'trap' && e.item.zone === 'raid-road');
  assert.ok(put, 'the trap is on the road');
  assert.ok(Math.abs(along(r, put.position) - r.posts[1].d) <= 1, `the trap at ${along(r, put.position)}`);
});

test('at K the lines of the trap come before the lines of the slingshot, and the slingshot lines come after the first trap', async () => {
  const h = await start('raid-soldiers-traps', 0, { 'raid.hits.last': 0 });
  const keys = h.said.map((l) => l.key);
  const ask = keys.indexOf('raid.trap.ask');
  assert.ok(ask >= 0, keys.join(', '));
  assert.ok(!keys.slice(0, ask).some((k) => k === 'raid.rule' || k === 'raid.tool.sling'), keys.join(', '));
  assert.equal(h.said[ask].params.post.key, `num.${h.raid().posts.findIndex((q) => q.d === h.raid().trapPost) + 1}`);
  h.run(10);
  assert.ok(!h.said.some((l) => l.key === 'raid.rule'), 'no rule of the slingshot before the trap');
  h.pick();
  const n = h.raid().posts.findIndex((q) => q.d === h.raid().trapPost) + 1;
  for (let i = 0; i < n; i++) h.press(0.5);
  h.run(12);
  assert.ok(h.raid().trapDone || h.raid().usedTools?.includes('traps'), 'the trap is down');
  h.run(10);
  const all = h.said.map((l) => l.key);
  assert.ok(all.lastIndexOf('raid.tool.sling') > all.indexOf('raid.trap.right') || all.lastIndexOf('raid.rule') > all.indexOf('raid.trap.right'), all.join(', '));
});
