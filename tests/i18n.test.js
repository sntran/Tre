import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createI18n, formatNumber } from '../src/core/i18n.js';

const vi = JSON.parse(readFileSync(new URL('../i18n/vi.json', import.meta.url)));
const en = JSON.parse(readFileSync(new URL('../i18n/en.json', import.meta.url)));

test('each key in vi.json is also in en.json', () => {
  const missing = Object.keys(vi).filter((k) => !(k in en));
  assert.deepEqual(missing, []);
});

test('each key in en.json is also in vi.json', () => {
  const missing = Object.keys(en).filter((k) => !(k in vi));
  assert.deepEqual(missing, []);
});

test('each text has the same parameters in the two languages', () => {
  const params = (s) => [...s.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
  const wrong = Object.keys(vi).filter((k) => k in en &&
    JSON.stringify(params(vi[k])) !== JSON.stringify(params(en[k])));
  assert.deepEqual(wrong, []);
});

test('no text is empty', () => {
  const empty = [...Object.entries(vi), ...Object.entries(en)].filter(([, v]) => typeof v !== 'string' || v.trim() === '');
  assert.deepEqual(empty, []);
});

test('translate replaces parameters and nested keys', () => {
  const i = createI18n({ a: 'Hi {name}, {n}', b: 'B {x}' }, 'en');
  assert.equal(i.t('a', { name: 'Gióng', n: 1200 }), 'Hi Gióng, 1200');
  assert.equal(i.t('a', { name: { key: 'b', params: { x: 1 } }, n: 3 }), 'Hi B 1, 3');
  assert.equal(i.t('missing.key'), 'missing.key');
});

test('a parameter at the start of a sentence starts with a capital letter', () => {
  const i = createI18n({
    calm: '{name} is calm now.',
    call: 'Everybody! Gióng spoke! {name}, come here!',
    mid: 'Help {name} now. {who}? {what}… {x}',
    num: '{n} apples.',
    dot: 'Mai · {grade}',
  }, 'vi');
  assert.equal(i.t('calm', { name: 'lính trinh sát' }), 'Lính trinh sát is calm now.');
  assert.equal(i.t('call', { name: 'mai' }), 'Everybody! Gióng spoke! Mai, come here!');
  assert.equal(i.t('mid', { name: 'the smith', who: 'đứa bé', what: 'ánh sáng', x: 'ừ' }), 'Help the smith now. Đứa bé? Ánh sáng… Ừ');
  assert.equal(i.t('num', { n: 3 }), '3 apples.');
  assert.equal(i.t('dot', { grade: 'lớp 2' }), 'Mai · lớp 2', 'a dot in the middle is not the end of a sentence');
});

test('glossary shows the meaning the first time in English only', () => {
  const dict = { 'gloss.vm.name': 'Văn Miếu', 'gloss.vm.meaning': 'the Temple of Literature' };
  const en1 = createI18n(dict, 'en');
  const seen = new Set();
  assert.equal(en1.gloss('Go to [[vm]].', seen), 'Go to Văn Miếu (the Temple of Literature).');
  assert.equal(en1.gloss('Go to [[vm]].', seen), 'Go to Văn Miếu.');
  const vi1 = createI18n(dict, 'vi');
  assert.equal(vi1.gloss('Đi [[vm]].', new Set()), 'Đi Văn Miếu.');
});

test('numbers use the style of the language', () => {
  assert.equal(formatNumber(0.5, 'vi'), '0,5');
  assert.equal(formatNumber(0.5, 'en'), '0.5');
  assert.equal(formatNumber(12000, 'vi'), '12.000');
  assert.equal(formatNumber(12000, 'en'), '12,000');
  assert.equal(formatNumber(1200, 'en'), '1200');
});

// Keys used in data files: each property whose name ends with "Key" or "Keys",
// and the "choices" of hand-written questions.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function jsonFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...jsonFiles(path));
    else if (name.endsWith('.json')) out.push(path);
  }
  return out;
}

function collectKeys(value, found, parentName = '') {
  if (Array.isArray(value)) {
    for (const v of value) {
      if (typeof v === 'string' && (parentName.endsWith('Keys') || parentName === 'choices')) found.add(v);
      else collectKeys(v, found, parentName);
    }
  } else if (value && typeof value === 'object') {
    for (const [name, v] of Object.entries(value)) {
      if (typeof v === 'string' && name.endsWith('Key')) found.add(v);
      else collectKeys(v, found, name);
    }
  }
}

test('each key used in data files exists', () => {
  const dataDir = new URL('../data/', import.meta.url).pathname;
  const missing = [];
  for (const file of jsonFiles(dataDir)) {
    const found = new Set();
    collectKeys(JSON.parse(readFileSync(file, 'utf8')), found);
    for (const key of found) if (!(key in vi) || !(key in en)) missing.push(`${file.slice(dataDir.length)}: ${key}`);
  }
  assert.deepEqual(missing, []);
});

test('each skill and subject has a name', () => {
  const skills = JSON.parse(readFileSync(new URL('../data/skills.json', import.meta.url)));
  const missing = [
    ...skills.skills.map((s) => `skill.${s.id}`),
    ...skills.subjects.map((s) => `subject.${s}`),
  ].filter((k) => !(k in vi));
  assert.deepEqual(missing, []);
});

test('each fixed key used in the code exists', () => {
  const srcDir = new URL('../src/', import.meta.url).pathname;
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.js')) files.push(path);
    }
  };
  walk(srcDir);
  const pattern = /(?:\b(?:t|tg|speak|say|toast)\(\s*|\bkey:\s*|Key:\s*|textKey\s*=\s*)'([a-z][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+)+)'/g;
  const missing = [];
  let count = 0;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(pattern)) {
      count++;
      if (!(m[1] in vi) || !(m[1] in en)) missing.push(`${file.slice(srcDir.length)}: ${m[1]}`);
    }
  }
  assert.ok(count > 50, `found ${count} keys`);
  assert.deepEqual(missing, []);
});

test('each save error has a message for parents', () => {
  for (const reason of ['prefix', 'characters', 'checksum', 'data', 'json', 'format', 'version', 'newer', 'migration', 'shape']) {
    assert.ok(`parent.code.error.${reason}` in vi, reason);
  }
});
