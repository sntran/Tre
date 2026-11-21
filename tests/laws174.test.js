// The static laws of the texts (#174): no key two times in a file of texts, every person has a name
// in both languages, and every key that the code builds from parts exists for every value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './helpers.js';

const vi = load('i18n/vi.json');
const en = load('i18n/en.json');
const npcs = load('data/npcs.json').npcs;

test('no key two times in i18n/vi.json or i18n/en.json', () => {
  for (const f of ['i18n/vi.json', 'i18n/en.json']) {
    const keys = [...readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').matchAll(/^\s+"([^"]+)":/gm)].map((m) => m[1]);
    const seen = new Set();
    assert.deepEqual(keys.filter((k) => (seen.has(k) ? true : (seen.add(k), false))), [], f);
  }
});

test('every person of data/npcs.json has a name in both languages: a name key, or a kin and an order for the names of the region', () => {
  const missing = [];
  for (const [id, n] of Object.entries(npcs)) {
    for (const [lang, dict] of [['vi', vi], ['en', en]]) {
      if (!dict[`npc.${id}.name`] && !(n.nameKey && dict[n.nameKey]) && !(n.kin && n.order)) missing.push(`${lang}: ${id}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('the count words num.0 to num.150 exist in both languages (the code says num.${Math.min(150, n)})', () => {
  for (let n = 0; n <= 150; n++) {
    assert.ok(vi[`num.${n}`], `vi num.${n}`);
    assert.ok(en[`num.${n}`], `en num.${n}`);
  }
});

test('every fraction that a plan of the woodcutter can make (a part a/b, b up to 30) has words in both languages (#181)', async () => {
  const { fracWord } = await import('../src/core/fracword.js');
  const keysOf = (p) => [p.key, ...Object.values(p.params ?? {}).flatMap(keysOf)];
  for (let b = 2; b <= 30; b++) {
    for (let a = 1; a < b; a++) {
      for (const k of keysOf(fracWord(a, b))) {
        assert.ok(vi[k], `vi ${k} for ${a}/${b}`);
        assert.ok(en[k], `en ${k} for ${a}/${b}`);
      }
    }
  }
  assert.deepEqual(fracWord(11, 12), { key: 'frac.say', params: { n: { key: 'num.11' }, d: { key: 'num.12' } } });
  assert.equal(vi['frac.say'].replace('{n}', vi['num.11']).replace('{d}', vi['num.12']), 'mười một phần mười hai');
});
