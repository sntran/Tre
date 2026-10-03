import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

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
  for (const dir of ['src', 'data', 'i18n', 'art', 'audio', 'styles', 'fonts']) walk(dir);
  return out.sort();
}

function swFiles() {
  const text = readFileSync(join(root, 'sw.js'), 'utf8');
  const list = text.slice(text.indexOf('const FILES = ['), text.indexOf('];', text.indexOf('const FILES = [')));
  return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
}

// The height tiles of the start of the era (startTiles in the lands): the install keeps only these.
function startTiles() {
  const out = new Set();
  for (const f of readdirSync(join(root, 'data/world')).filter((n) => n.startsWith('land-'))) {
    const land = JSON.parse(readFileSync(join(root, 'data/world', f), 'utf8'));
    for (const t of land.startTiles ?? land.tiles ?? []) out.add(`data/geo/heights/${t}.bin`);
  }
  return out;
}

test('the service worker keeps a copy of each file that the site ships, but the height tiles of later', () => {
  const start = startTiles();
  assert.ok(start.size > 0);
  assert.deepEqual(swFiles(), shipped().filter((f) => !f.startsWith('data/geo/heights/') || start.has(f)));
});

// Run sw.js with a fake worker scope: a cache in a Map, and a fetch that the test controls.
async function serviceWorker(fetchOf, cached = {}) {
  const store = new Map(Object.entries(cached));
  const handlers = {};
  const cache = {
    match: async (r) => store.get(typeof r === 'string' ? r : new URL(r.url).pathname.slice(1)) ?? undefined,
    put: async (r, res) => { store.set(new URL(r.url).pathname.slice(1), res); },
    addAll: async () => {},
  };
  const scope = {
    location: { origin: 'https://tre.test' },
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };
  const text = readFileSync(join(root, 'sw.js'), 'utf8').replace('const WAIT = 4000;', 'const WAIT = 50;');
  new Function('self', 'caches', 'fetch', 'Response', text)(scope, { open: async () => cache, keys: async () => [] }, fetchOf, Response);
  return async (path) => {
    let answer;
    handlers.fetch({ request: { method: 'GET', url: `https://tre.test/${path}`, mode: 'cors' }, respondWith: (p) => { answer = p; } });
    return answer;
  };
}

test('a fetch slower than the time to wait still gives the file when the cache has no copy', async () => {
  const slow = () => new Promise((resolve) => setTimeout(() => resolve(new Response('icon')), 150));
  const get = await serviceWorker(slow);
  const res = await get('art/icon.svg');
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'icon');
  // With a copy, the copy comes after the time to wait.
  const withCopy = await serviceWorker(slow, { 'art/icon.svg': new Response('copy') });
  assert.equal(await (await withCopy('art/icon.svg')).text(), 'copy');
  // No network and no copy: an empty answer.
  const offline = await serviceWorker(() => Promise.reject(new Error('offline')));
  assert.equal((await offline('art/icon.svg')).status, 504);
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

test('three.js is the one file from another site, at a fixed version, and the service worker keeps a copy', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  const url = 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js';
  const map = html.match(/<script type="importmap">([^<]*)<\/script>/);
  assert.ok(map, 'the page has an import map');
  assert.deepEqual(JSON.parse(map[1]), { imports: { three: url } });
  assert.ok(html.indexOf('type="importmap"') < html.indexOf('type="module"'), 'the import map comes before the first module');
  assert.deepEqual([...new Set(html.match(/https:\/\/[^\s"';]+/g))].sort(), ['https://cdn.jsdelivr.net', url].sort());
  assert.ok(sw.includes(`const THREE = '${url}';`));
  // The policy of the page permits the import map by its hash only.
  const hash = createHash('sha256').update(map[1]).digest('base64');
  assert.ok(html.includes(`'sha256-${hash}'`), 'the policy has the hash of the import map');
  // Only the drawing code imports three.js.
  for (const f of shipped().filter((x) => x.endsWith('.js'))) {
    const text = readFileSync(join(root, f), 'utf8');
    if (/from 'three'/.test(text)) assert.ok(f.startsWith('src/render/'), `${f} imports three.js`);
  }
});
