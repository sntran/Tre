// Each sound name of the world has a sound (#86: the shot and the landing of a stone in a raid
// were silent, because src/ui/audio.js had no sound with their names).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SOUND_NAMES } from '../src/ui/audio.js';

const root = new URL('..', import.meta.url).pathname;
function files(dir, ext) {
  const out = [];
  for (const name of readdirSync(join(root, dir))) {
    const p = join(dir, name);
    if (statSync(join(root, p)).isDirectory()) out.push(...files(p, ext));
    else if (name.endsWith(ext)) out.push(p);
  }
  return out;
}

test('each sound name in src and in data has a sound in src/ui/audio.js', () => {
  const names = new Map();
  const note = (name, where) => names.set(name, [...(names.get(name) ?? []), where]);
  for (const f of files('src', '.js')) {
    const text = readFileSync(join(root, f), 'utf8');
    // A name, or the names of a choice: sound: hit ? 'thud' : 'whoosh'.
    for (const m of text.matchAll(/\bsound: ([^,}\n]*)/g)) for (const n of `: ${m[1]}`.matchAll(/[?:] ['"]([a-z0-9-]+)['"]/g)) note(n[1], f);
    // A list of sounds: const INSIDE_SOUNDS = [...].
    for (const m of text.matchAll(/_SOUNDS = (?:Object\.freeze\()?\[([^\]]*)\]/g)) for (const n of m[1].matchAll(/['"]([a-z0-9-]+)['"]/g)) note(n[1], f);
    for (const m of text.matchAll(/\bplay\(['"]([a-z0-9-]+)['"]\)/g)) note(m[1], f);
  }
  for (const f of files('data', '.json')) {
    const text = readFileSync(join(root, f), 'utf8');
    for (const m of text.matchAll(/"sound": ?"([a-z0-9-]+)"/g)) note(m[1], f);
  }
  assert.ok(names.size > 20, 'the names are found');
  const known = new Set(SOUND_NAMES);
  const missing = [...names].filter(([n]) => !known.has(n)).map(([n, w]) => `${n} (${[...new Set(w)].join(', ')})`);
  assert.deepEqual(missing, []);
});

test('the sounds of a raid have their own sound', () => {
  for (const n of ['sling', 'thud', 'whoosh', 'snap', 'thunder']) assert.ok(SOUND_NAMES.includes(n), n);
});
