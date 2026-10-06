// A headless browser check of the controls of the village (#44): at the sizes of a small phone, a
// phone, a tablet, and a laptop, with a touch screen, no button of the screen overlaps the stick
// or another button, and every button is fully on the screen.
// Run it from the root of the repository with a local server on port 8123
// (python3 -m http.server 8123), and Playwright (npm install playwright, or a global one):
//   node tools/layout-check.mjs [base URL] [--three <a local copy of three.module.min.js>]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const at = args.indexOf('--three');
const three = at >= 0 ? args.splice(at, 2)[1] : null;
const base = args[0] ?? 'http://127.0.0.1:8123/';
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(`${process.env.NODE_PATH ?? '/usr/local/lib/node_modules'}/playwright`);
}

export const SIZES = [[360, 740], [390, 844], [768, 1024], [1366, 768]];
const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = 0;
for (const [width, height] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: width < 1000 });
  const page = await ctx.newPage();
  if (three) await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: readFileSync(three), contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  // A story start in the village, at a task with a person (the wave button shows there).
  await page.goto(`${base}index.html?story=practice-bo-que`);
  await page.waitForFunction(() => window.tre?.activeVillage, null, { timeout: 120000 });
  await page.waitForTimeout(3000);
  const rects = await page.evaluate(() => {
    // The wave button shows at a task; show it here so that its place is checked too.
    document.querySelector('.wave-btn')?.removeAttribute('hidden');
    const out = [];
    for (const el of document.querySelectorAll('.turns button, .hud button, .hud .count')) {
      if (!el.offsetParent) continue;
      const r = el.getBoundingClientRect();
      out.push({ name: el.getAttribute('aria-label') || el.className, x: r.x, y: r.y, w: r.width, h: r.height });
    }
    // The stick: its home at the bottom left, 24 px from the edges (stickHome in src/ui/village.js),
    // as large as its element.
    const stick = document.querySelector('.stick');
    const size = parseFloat(getComputedStyle(stick).width) || 112;
    out.push({ name: 'stick', x: 24, y: innerHeight - 24 - size, w: size, h: size, stick: true });
    return { out, w: innerWidth, h: innerHeight };
  });
  const bad = [];
  const over = (a, b) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
  const list = rects.out;
  for (const a of list) {
    if (a.x < -1 || a.y < -1 || a.x + a.w > rects.w + 1 || a.y + a.h > rects.h + 1) bad.push(`${a.name} is not fully on the screen`);
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      // A count inside the HUD may touch its neighbours; the stick and the buttons must not.
      if (over(list[i], list[j])) bad.push(`${list[i].name} overlaps ${list[j].name}`);
    }
  }
  if (!list.some((r) => r.stick)) bad.push('no stick on a touch screen');
  console.log(`${width} × ${height}: ${bad.length ? bad.join('; ') : 'ok'}`);
  failed += bad.length;
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
