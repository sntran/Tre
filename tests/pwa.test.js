import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;

// The files that the workflow ships (see .github/workflows/pages.yml).
function shipped() {
  const out = ['./', 'index.html', 'manifest.webmanifest', 'LICENSE', 'content/LICENSE'];
  const walk = (dir) => {
    for (const name of readdirSync(join(root, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(root, rel)).isDirectory()) walk(rel);
      else if (!name.endsWith('.md')) out.push(rel);
    }
  };
  for (const dir of ['src', 'data', 'i18n', 'art', 'audio', 'styles']) walk(dir);
  return out.sort();
}

function swFiles() {
  const text = readFileSync(join(root, 'sw.js'), 'utf8');
  const list = text.slice(text.indexOf('const FILES = ['), text.indexOf('];', text.indexOf('const FILES = [')));
  return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
}

test('the service worker keeps a copy of each file that the site ships', () => {
  assert.deepEqual(swFiles(), shipped());
});

test('the manifest and the page use relative paths only', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  for (const icon of manifest.icons) {
    assert.ok(!icon.src.startsWith('/'), icon.src);
    statSync(join(root, icon.src));
  }
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert.ok(!m[1].startsWith('/') && !/^https?:/.test(m[1]), m[1]);
  }
});

test('the code sends no requests to other sites', () => {
  const files = shipped().filter((f) => f.endsWith('.js') || f.endsWith('.css') || f.endsWith('.html') || f.endsWith('.json'));
  for (const f of files) {
    if (f === './') continue;
    const text = readFileSync(join(root, f), 'utf8');
    assert.ok(!/(fetch|import)\(\s*['"`]https?:/.test(text), `${f} fetches another site`);
    assert.ok(!/url\(\s*['"]?https?:/.test(text), `${f} loads a file from another site`);
    assert.ok(!/document\.cookie/.test(text), `${f} uses cookies`);
  }
});
