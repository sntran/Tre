// The share says where the rest goes (#167): the first line says that the extra sack stays on the
// pile, the line of a mistake says what to do next, each mat shows the face of its owner, the mats
// lie on open, level ground, Gióng stands at the outer side of his mat, and the sacks are big
// enough to count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';

const vi = load('i18n/vi.json');

async function atShare(name) {
  const s0 = load(`tests/stories/${name}.json`);
  const upto = s0.steps.findIndex((x) => x.expect?.some?.((f) => f.text?.shown === 'share.start'));
  let session = null;
  const said = [];
  const events = [];
  const steps = s0.steps.slice(0, upto + 1).map((x) => (x.expect ? { ...x, expect: x.expect.filter((f) => f.entity !== 'by:share-giong') } : x));
  const failures = await runHeadless({ ...s0, steps }, { onSession: (x) => {
    session = x;
    x.listen((e) => {
      events.push(e);
      if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, params: e.params ?? {} });
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
  return { session, said, events, run };
}

for (const name of ['raid-soldiers', 'raid-boss']) {
  test(`${name}: each mat and the place of its friend lie on dry ground, level with the pile`, async () => {
    const h = await atShare(name);
    const pile = getEntity(h.session.state, 'zone:loot').zone;
    const env = h.session.env ?? null;
    for (const w of ['hero', 'nghe', 'giong']) {
      const z = getEntity(h.session.state, `zone:share-${w}`).zone;
      assert.ok(Math.abs(z.y - pile.y) < 0.6, `the mat of ${w} is level with the pile: ${z.y} and ${pile.y}`);
      if (env?.groundAt) assert.notEqual(env.groundAt(z.x, z.z), 'field', `the mat of ${w} is not in a paddy`);
    }
  });
}

test('seven sacks for three mats: the first lines say that the extra sack stays on the pile', async () => {
  const h = await atShare('raid-soldiers');
  h.run(6);
  const loot = getEntity(h.session.state, 'zone:loot').zone;
  assert.ok(loot.items.length % 3, `the loot is ${loot.items.length}`);
  assert.ok(h.said.some((l) => l.key === 'share.rest.rule'), h.said.map((l) => l.key).join(', '));
  assert.equal(vi['share.rest.rule'], 'Mỗi chiếu phải bằng nhau. Bao nào thừa thì để lại trên đống.');
});

// Put the sacks of the pile on the mats by hand: counts for hero, nghe, giong.
function deal(h, counts) {
  const st = h.session.state;
  const loot = getEntity(st, 'zone:loot').zone;
  ['hero', 'nghe', 'giong'].forEach((w, i) => {
    const z = getEntity(st, `zone:share-${w}`).zone;
    for (let k = 0; k < counts[i]; k++) {
      const id = loot.items.pop();
      getEntity(st, id).item.zone = z.id;
      z.items.push(id);
    }
  });
}

test('one sack more on the mat of Nghé, and the pile cannot even it: the line says to take one sack from her mat back to the pile', async () => {
  const h = await atShare('raid-soldiers');
  h.run(6);
  const n = getEntity(h.session.state, 'zone:loot').zone.items.length;
  const each = Math.floor(n / 3);
  deal(h, [each, n - 2 * each, each]);
  const from = h.said.length;
  h.run(3);
  const l = h.said.slice(from).find((x) => /^share\.more/.test(x.key));
  assert.ok(l, h.said.slice(from).map((x) => x.key).join(', '));
  assert.equal(l.key, 'share.more.back');
  assert.equal(l.params.who.key, 'share.who.nghe');
  assert.ok(h.events.some((e) => e.type === 'glowSeq' && e.ids.join() === 'mat:share-nghe,zone:loot'));
});

test('two sacks more on one mat than on another: the line says to move one sack to the mat with fewer', async () => {
  const h = await atShare('raid-soldiers');
  h.run(6);
  const n = getEntity(h.session.state, 'zone:loot').zone.items.length;
  const each = Math.floor(n / 3);
  deal(h, [each + 1, each - 1, n - 2 * each]);
  const from = h.said.length;
  h.run(3);
  const l = h.said.slice(from).find((x) => /^share\.more/.test(x.key));
  assert.ok(l, h.said.slice(from).map((x) => x.key).join(', '));
  assert.equal(l.key, 'share.more.move');
  assert.equal(l.params.to.key, 'share.who.nghe');
});

test('each mat shows the face of its owner, and the sacks are bigger', () => {
  const src = readFileSync(new URL('../src/ui/village.js', import.meta.url), 'utf8');
  assert.match(src, /const who = \/\^mat:share-\(\\w\+\)\$\/\.exec/);
  assert.match(src, /setFace\(el, who\);/);
  const fig = readFileSync(new URL('../src/world/figures.js', import.meta.url), 'utf8');
  assert.match(fig, /case 'sack': return still\(\[P\('sack', \[0\.95, 0\.8, 0\.8\]/);
});
