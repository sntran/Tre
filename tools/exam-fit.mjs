// A headless browser check of the exam screen (#136): at the size of a phone (390 x 844),
// with each kind of picture of the problems at its largest (dots, an array, a shape, a rectangle,
// fractions), the question, the keys of the keypad, the button "not learned yet", and the line of
// the answer are fully on the screen, with no scroll.
// Run it from the root of the repository with a local server (python3 -m http.server 8123), and
// Playwright (npm install playwright, or a global one):
//   node tools/exam-fit.mjs [base URL] [--three <a local copy of three.module.min.js>]
// With SHOTS=<a folder>, it keeps a screenshot of each picture.
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

// The largest picture of each kind that the generators make.
const VISUALS = [
  { type: 'dots', groups: [10], crossed: 4 },
  { type: 'array', rows: 5, cols: 5 },
  { type: 'shape', shape: 'hexagon' },
  { type: 'rect', w: 9, h: 9, grid: true },
  { type: 'rect', w: 9, h: 2, grid: false },
  { type: 'fractions', values: [[3, 8], [5, 12]] },
];
// The phone of the play tests (a phone of 360 x 740 scrolls a little on the first question, with the rule).
const SIZES = [[390, 844]];
const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = 0;
for (const [width, height] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  if (three) await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: readFileSync(three), contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await page.goto(`${base}index.html?story=placement-messenger`);
  await page.waitForFunction(() => window.tre?.activeVillage, null, { timeout: 180000 });
  for (const visual of VISUALS) {
    const out = await page.evaluate(async (v) => {
      const ctx = window.tre;
      // Each question of this exam has the picture.
      const make = ctx.learner.problem.bind(ctx.learner);
      ctx.learner.problem = (skill, opts) => ({ ...make('math.area', { level: 1 }), visual: v });
      delete ctx.profile.flags['placement.done'];
      ctx.open({ open: 'exam', kind: 'placement' });
      await new Promise((r) => setTimeout(r, 1500));
      const panel = document.querySelector('.panel.quiz.exam');
      const rects = [...document.querySelectorAll('.panel.quiz.exam .numpad .btn, .panel.quiz.exam .exam-skip, .panel.quiz.exam .answer-box, .panel.quiz.exam .prompt')].map((el) => {
        const r = el.getBoundingClientRect();
        return { name: el.className || el.tagName, x: r.x, y: r.y, w: r.width, h: r.height };
      });
      const scroll = panel ? panel.scrollHeight - panel.clientHeight : -1;
      ctx.learner.problem = make;
      return { rects, scroll, vw: innerWidth, vh: innerHeight };
    }, visual);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/exam-${width}-${visual.type}-${visual.w ?? ''}${visual.h ?? ''}.png` });
    await page.evaluate(() => document.querySelector('.panel.quiz.exam')?.closest('.modal-layer')?.remove());
    const bad = out.rects.filter((r) => r.x < 0 || r.y < 0 || r.x + r.w > out.vw + 0.5 || r.y + r.h > out.vh + 0.5);
    if (!out.rects.length || bad.length || out.scroll > 1) {
      failed += 1;
      console.log(`${width}x${height} ${visual.type}: ${out.rects.length} parts, off the screen: ${bad.map((r) => `${r.name} at ${Math.round(r.y)}+${Math.round(r.h)}`).join(', ') || 'none'}, scroll ${out.scroll}`);
    } else console.log(`${width}x${height} ${visual.type}: all ${out.rects.length} parts on the screen`);
  }
  await ctx.close();
}
await browser.close();
if (failed) {
  console.log(`${failed} problems`);
  process.exit(1);
}
console.log('the exam fits');
