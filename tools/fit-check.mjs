// A headless browser check (#37): at a phone width of 360 px, in Vietnamese and in English, no
// label of a button is wider than its button (and a choice tile shows its word on one line), on each screen of hero creation (a new adventure,
// and the short creation of a practice link) and on the title screen.
// Run it from the root of the repository with a local server on port 8123
// (python3 -m http.server 8123), and Playwright (npm install playwright, or a global one):
//   node tools/fit-check.mjs [base URL] [--three <a local copy of three.module.min.js>]
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

const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = 0;
// The buttons on the screen whose text does not fit: the text is wider or taller than the button,
// the button goes past the screen, or a word breaks between two lines.
const cut = (page) => page.evaluate(() => [...document.querySelectorAll('button, .btn')]
  .filter((b) => b.offsetParent && b.textContent.trim())
  .map((b) => {
    const r = b.getBoundingClientRect();
    // The lines of each word: a word on two lines is cut.
    const broken = [];
    const walk = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const text = n.textContent;
      let i = 0;
      for (const word of text.split(/\s+/)) {
        const start = text.indexOf(word, i);
        i = start + word.length;
        if (!word) continue;
        const range = document.createRange();
        range.setStart(n, start);
        range.setEnd(n, start + word.length);
        const tops = new Set([...range.getClientRects()].map((q) => Math.round(q.top)));
        if (tops.size > 1) broken.push(word);
      }
    }
    // A choice tile shows its word on one line (a square that wraps "Bạn / trai" is too small).
    const all = document.createRange();
    all.selectNodeContents(b);
    const lines = new Set([...all.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top))).size;
    const wrapped = b.classList.contains('tile-btn') && lines > 1;
    return { text: b.textContent.trim(), wide: b.scrollWidth > b.clientWidth + 1, tall: b.scrollHeight > b.clientHeight + 1, out: r.right > window.innerWidth + 1 || r.left < -1, broken, wrapped };
  })
  .filter((x) => x.wide || x.tall || x.out || x.broken.length || x.wrapped));

for (const lang of ['vi', 'en']) {
  for (const start of ['', '?practice=xom-ruong']) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: lang === 'vi' ? 'vi-VN' : 'en-US' });
    const page = await ctx.newPage();
    if (three) await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: readFileSync(three), contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
    await page.goto(`${base}index.html${start}`);
    await page.waitForSelector('.btn.big.red');
    // The language of the screens.
    await page.evaluate((code) => window.tre.chooseLanguage(code), lang);
    await page.evaluate(() => window.tre.go('title'));
    await page.waitForTimeout(300);
    const screens = [['title', await cut(page)]];
    await page.click('.btn.big.red');
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(500);
      const name = await page.evaluate(() => document.querySelector('.create-stage h2')?.textContent ?? '');
      screens.push([`create: ${name}`, await cut(page)]);
      const input = await page.$('.name-input');
      if (input && !(await input.inputValue())) await input.fill('Mai');
      const lang = await page.$('.create-stage .btn.big.paper, .create-stage .btn.big.red');
      const btn = await page.$('.create-stage > .btn.big.red:last-child') ?? lang;
      if (!btn) break;
      const label = (await btn.textContent()).trim();
      if (/Bắt đầu|Start/i.test(label)) break;
      await btn.click();
    }
    for (const [name, bad] of screens) {
      const line = `${lang} ${start || 'new'} ${name}: ${bad.length ? `cut ${JSON.stringify(bad)}` : 'ok'}`;
      if (bad.length) failed += 1;
      console.log(line);
    }
    await ctx.close();
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
