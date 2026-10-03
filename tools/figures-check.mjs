// A headless browser check of docs/reference/figures.html: the board, and one piece up close with
// the walk and the full wind. Each page must set data-ready and have no error in the console.
// Run it from the root of the repository with a local server on port 8123
// (python3 -m http.server 8123), and Playwright (npm install playwright, or a global one):
//   node tools/figures-check.mjs [base URL] [--three <a local copy of three.module.min.js>]
// --three serves three.js from a file, for a machine with no network to the CDN.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const at = args.indexOf('--three');
const three = at >= 0 ? args.splice(at, 2)[1] : null;
const base = args[0] ?? 'http://localhost:8123/';
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(`${process.env.NODE_PATH ?? '/usr/local/lib/node_modules'}/playwright`);
}

const pages = ['docs/reference/figures.html', 'docs/reference/figures.html?look=hero-boy&pose=walk&wind=full'];
const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = 0;
for (const path of pages) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  if (three) await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: readFileSync(three), contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await page.goto(base + path);
  const ready = await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 60000 }).then(() => true, () => false);
  const ok = ready && !errors.length;
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok' : 'NOT OK'} ${path}${ready ? '' : ' (no data-ready)'}${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
