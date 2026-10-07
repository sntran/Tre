// A play on a phone, as a child plays (#46 and the issues of the play test): the real game in a
// headless browser at 390 × 844 with touch, and only taps on the screen and the buttons of the
// screen. No story command, no keyboard, and no teleport. The tool saves the frames of the play,
// and it fails when the page has an error, when the frame loop stops, when a tap on free ground
// that the hero can walk to does not move the hero, or when a tap on a place of a task does not
// choose it.
// Run it from the root of the repository with a local server on port 8123
// (python3 -m http.server 8123), and Playwright (npm install playwright, or a global one):
//   node tools/phone-play.mjs <plan.json> [--out <folder>] [--base <URL>] [--three <three.module.min.js>]
// A plan is JSON: { "start": "?practice=bo-que", "lang": "vi", "size": [390, 844], "dsf": 1, "steps": [...],
// "allow": [...] }. allow: parts of the text of known problems that do not fail the play (for a
// problem that a later issue fixes).
// The steps:
//   { "create": "Nam" }          pass the hero creation (a new game or the short creation of a link)
//   { "tap": [x, y] }            a tap at a point of the screen
//   { "tap": { "person": "teacher" } }, { "tap": { "thing": "rod:1" } }, { "tap": { "cell": [x, y] } },
//   { "tap": { "place": "mat" } } a tap on a person, a thing, a cell of the map, or the middle of a
//                                place of a task, where the screen shows it
//   { "tap": { "stem": 4 } }     a tap on the stem of the woodcutter, 4 half blocks from its start
//   { "tap": { "star": true } }  a tap on the goal star (or the arrow at the edge of the screen)
//   { "walk": { "person": "woodcutter" }, "taps": 12 } taps toward a target until the hero is near it
//   { "press": true }            a quick tap on the big button (the press and the release at once)
//   { "hold": 1.5 }              the big button down for this many seconds
//   { "hold": { "until": "expr", "timeout": 30, "print": "expr" }, "shot": "name" } the big button
//                                down until the expression is true (a child who looks at the band),
//                                with a value and a frame before the finger goes up
//   { "button": ".jump-btn" }    a tap on another button of the screen (a CSS selector)
//   { "click": "Tiếp" }          a tap on a visible button with this text
//   { "stick": [dx, dy, 1.5] }   the stick: a finger down at the stick, moved by dx, dy, for seconds
//   { "drag": [[x0, y0], [x1, y1], 0.6] } a finger that moves over the screen (the slingshot)
//   { "read": 10 }               taps on the box of a talk, up to this many lines
//   { "wait": 2 }                seconds of play with no finger
//   { "restless": 20, "seed": 1 } seconds of random taps, presses, and jumps near the hero
//   { "shot": "name" }           a frame of the screen (JPEG) in the out folder
//   { "until": "expr", "timeout": 120 } play on with no finger until the expression is true
//   { "check": "expr" }          a JavaScript expression on window.tre that must be true
//   { ..., "if": "expr" }        any step: it runs only when the expression is true
//   { "print": "expr" }          the value of a JavaScript expression on window.tre, in the output
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : fallback;
};
const out = opt('--out', 'phone-play');
const base = opt('--base', 'http://127.0.0.1:8123/');
const three = opt('--three', null);
const plan = JSON.parse(readFileSync(args[0], 'utf8'));
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(`${process.env.NODE_PATH ?? '/usr/local/lib/node_modules'}/playwright`);
}
mkdirSync(out, { recursive: true });

const [width, height] = plan.size ?? [390, 844];
const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: plan.dsf ?? 1, hasTouch: true, isMobile: true, locale: plan.lang === 'en' ? 'en-US' : 'vi-VN' });
const page = await ctx.newPage();
if (three) await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: readFileSync(three), contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
const problems = [];
const log = [];
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 300)}`);
});
await page.goto(`${base}index.html${plan.start ?? ''}`);
await page.waitForFunction(() => window.tre, null, { timeout: 60000 });
if (plan.lang) await page.evaluate((code) => window.tre.chooseLanguage?.(code), plan.lang);

// A finger on the screen: down, a move, and up (pointer events of the kind touch).
const cdp = await ctx.newCDPSession(page);
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
const sleep = (s) => page.waitForTimeout(s * 1000);
async function finger(points, seconds = 0) {
  const [x0, y0] = points[0];
  await touch('touchStart', x0, y0);
  const n = Math.max(1, Math.round(seconds * 30));
  for (let k = 1; k <= n && points.length > 1; k++) {
    const t = k / n;
    const [x1, y1] = points[points.length - 1];
    await touch('touchMove', x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    await sleep(seconds / n);
  }
  if (points.length === 1 && seconds) await sleep(seconds);
  await touch('touchEnd');
}
const tapAt = (x, y) => finger([[x, y]]);
const center = async (selector) => {
  const box = await page.locator(selector).first().boundingBox();
  return box ? [box.x + box.width / 2, box.y + box.height / 2] : null;
};
// The screen point of a target of a tap: a person, a thing, a cell, or the goal star.
async function pointOf(spec) {
  if (Array.isArray(spec)) return spec;
  return page.evaluate((s) => {
    const v = window.tre.activeVillage;
    if (!v) return null;
    let p = null;
    if (s.person) p = v.screenOfPerson(s.person);
    else if (s.thing) p = v.screenOfThing(s.thing);
    else if (s.cell) p = v.screenOf(s.cell[0], s.cell[1]);
    else if (s.stem !== undefined) {
      // A point of the stem of the woodcutter, this many half blocks from its start.
      const st = v.state().entities.find((e) => e.id === 'stem:woodcutter');
      p = st ? v.pointOf((st.position.x + s.stem) / 2, st.position.z / 2) : null;
    }
    else if (s.place) {
      // The middle of the rect of a place of a task (the mat, the basket), on the ground.
      const z = v.state().entities.find((e) => e.id === `zone:${s.place}`);
      const r = z?.zone.rect;
      p = r ? v.pointOf((r.x0 + r.x1) / 4, (r.z0 + r.z1) / 4) : null;
    }
    else if (s.star) {
      const el = document.querySelector('.world-marks .world-star:not([hidden]), .world-marks .edge-arrow:not([hidden])');
      const r = el?.getBoundingClientRect();
      p = r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
    }
    return p ? [p.x, p.y] : null;
  }, spec);
}
// Free ground under a screen point: a cell that the hero can walk to, more than two cells away,
// with no talk open. Return the cell of the hero then, or null.
const freeGround = (p) => page.evaluate(([x, y]) => {
  const v = window.tre.activeVillage;
  const s = v?.session;
  if (!v || !s || s.screen || document.querySelector('.dialogue-layer, .modal-layer')) return null;
  const t = v.targetUnder(x, y);
  const g = t?.ground;
  const c = v.heroTile();
  if (!g || g.thing || g.object || !c || s.placeAt?.(g.x, g.y)) return null;
  if (!s.tileMap.walkable(Math.floor(g.x), Math.floor(g.y)) || Math.hypot(g.x - c.x, g.y - c.y) < 2) return null;
  return { x: c.x, y: c.y };
}, p);
// Does the session choose this target in the next second?
async function chose(id) {
  for (let k = 0; k < 4; k++) {
    if (await page.evaluate((x) => window.tre.activeVillage?.session.chosen() === x, id)) return true;
    await sleep(0.25);
  }
  return false;
}
// Did the hero move from a cell in the next 3 seconds (a browser with no GPU is slow)?
async function movedSince(from) {
  for (let k = 0; k < 12; k++) {
    await sleep(0.25);
    const c = await page.evaluate(() => window.tre.activeVillage?.heroTile() ?? null);
    if (c && Math.hypot(c.x - from.x, c.y - from.y) > 0.5) return true;
  }
  return false;
}
// The tick of the world: a frame loop that stopped has the same tick after a second.
const tick = () => page.evaluate(() => window.tre.activeVillage?.session.state.tick ?? null);
let rng = 1;
const random = () => {
  rng = (rng * 1103515245 + 12345) % 2147483648;
  return rng / 2147483648;
};

let shots = 0;
try {
for (const [i, s] of (plan.steps ?? []).entries()) {
  const before = problems.length;
  // A step with "if" runs only when the expression is true (a child who sees a torch taps the gate).
  if (s.if && !(await page.evaluate((expr) => Boolean(new Function('tre', `return (${expr});`)(window.tre)), s.if).catch(() => false))) continue;
  if (s.create !== undefined) {
    for (let k = 0; k < 12 && !(await page.evaluate(() => Boolean(window.tre.activeVillage))); k++) {
      const input = await page.$('.name-input');
      if (input && !(await input.inputValue())) await input.fill(s.create);
      // The main button of the screen: the last red button (a chosen tile is red too). When it is
      // under the bottom of the screen, the child must scroll to find it: a problem.
      const main = page.locator('.btn.big.red:visible').last();
      let box = await main.boundingBox().catch(() => null);
      if (box && box.y + box.height > height) {
        problems.push(`create: the button ${(await main.textContent()).trim()} is under the bottom of the screen`);
        await main.scrollIntoViewIfNeeded();
        box = await main.boundingBox().catch(() => null);
      }
      if (box) await tapAt(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(0.8);
    }
    await page.waitForFunction(() => window.tre.activeVillage, null, { timeout: 120000 });
    await sleep(3);
  } else if (s.tap !== undefined) {
    const p = await pointOf(s.tap);
    if (!p) problems.push(`step ${i}: nothing on the screen for ${JSON.stringify(s.tap)}`);
    else {
      // A tap on free ground that the hero can walk to moves the hero (#53: a long press ended as a
      // tap, and the stop of the press ended the walk of the tap).
      const free = await freeGround(p);
      await tapAt(p[0], p[1]);
      if (free && !(await movedSince(free))) problems.push(`step ${i}: a tap on free ground at ${p.map(Math.round)} did not move the hero`);
      // A tap on a place of a task chooses that place (#48: a slow tap in the area of the stick did
      // nothing).
      if (s.tap.place && !(await chose(`zone:${s.tap.place}`))) problems.push(`step ${i}: a tap on the place ${s.tap.place} at ${p.map(Math.round)} did not choose it`);
    }
    await sleep(s.after ?? 0.3);
  } else if (s.walk !== undefined) {
    // Taps toward the target, as a child taps where to go: on the target when the screen shows
    // it, else at the edge of the screen in its direction; until the hero is near it.
    let near = false;
    for (let k = 0; k < (s.taps ?? 12) && !near; k++) {
      const p = await pointOf(s.walk);
      const hero = await page.evaluate(() => {
        const v = window.tre.activeVillage;
        const c = v?.heroTile();
        const q = c ? v.screenOf(c.x, c.y) : null;
        return q ? [q.x, q.y] : null;
      });
      if (!p || !hero) break;
      near = Math.hypot(p[0] - hero[0], p[1] - hero[1]) < (s.near ?? 70);
      if (near) break;
      // A point on the line from the hero to the target, inside the play area of the screen.
      const [x0, y0, x1, y1] = [30, 170, width - 30, height - 200];
      let [x, y] = p;
      const t = Math.min(1, ...[x < x0 ? (x0 - hero[0]) / (x - hero[0]) : 1, x > x1 ? (x1 - hero[0]) / (x - hero[0]) : 1, y < y0 ? (y0 - hero[1]) / (y - hero[1]) : 1, y > y1 ? (y1 - hero[1]) / (y - hero[1]) : 1].filter((v) => v >= 0));
      x = hero[0] + (x - hero[0]) * t;
      y = hero[1] + (y - hero[1]) * t;
      await tapAt(x, y);
      await sleep(s.every ?? 2.5);
    }
    if (!near) problems.push(`step ${i}: the hero did not come to ${JSON.stringify(s.walk)}`);
  } else if (s.press) {
    const p = await center('.act-btn');
    await tapAt(...p);
    await sleep(s.after ?? 0.3);
  } else if (s.hold !== undefined) {
    const p = await center('.act-btn');
    if (typeof s.hold === 'number' && !s.shot) await finger([p], s.hold);
    else {
      await touch('touchStart', ...p);
      const t0 = Date.now();
      if (typeof s.hold === 'number') await sleep(s.hold);
      else {
        const timeout = (s.hold.timeout ?? 30) * 1000;
        let ok = false;
        while (!ok && Date.now() - t0 < timeout) {
          ok = await page.evaluate((expr) => Boolean(new Function('tre', `return (${expr});`)(window.tre)), s.hold.until).catch(() => false);
          if (!ok) await sleep(0.1);
        }
        if (!ok) problems.push(`step ${i}: the hold did not come to ${s.hold.until}`);
      }
      if (s.hold.print) console.log(`step ${i}: ${s.hold.print} = ${await page.evaluate((expr) => JSON.stringify(new Function('tre', `return (${expr});`)(window.tre)), s.hold.print).catch((e) => `error ${e.message}`)}`);
      if (s.shot) {
        shots += 1;
        await page.screenshot({ path: `${out}/${String(shots).padStart(2, '0')}-${s.shot}.jpg`, type: 'jpeg', quality: 80 });
      }
      await touch('touchEnd');
    }
    await sleep(0.2);
  } else if (s.button) {
    const p = await center(s.button);
    if (!p) problems.push(`step ${i}: no button ${s.button}`);
    else await tapAt(...p);
    await sleep(s.after ?? 0.3);
  } else if (s.click) {
    const btn = page.locator('button:visible, .btn:visible').filter({ hasText: s.click }).first();
    const box = await btn.boundingBox().catch(() => null);
    if (!box) problems.push(`step ${i}: no button with the text ${s.click}`);
    else if (box.y + box.height > height) problems.push(`step ${i}: the button ${s.click} is under the bottom of the screen`);
    else await tapAt(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(s.after ?? 0.5);
  } else if (s.stick) {
    const [dx, dy, seconds = 1] = s.stick;
    const x = 80;
    const y = height - 80;
    await finger([[x, y], [x + dx, y + dy]], seconds);
  } else if (s.drag) {
    const [a, b, seconds = 0.6] = s.drag;
    await finger([a, b], seconds);
  } else if (s.read !== undefined) {
    for (let k = 0; k < s.read; k++) {
      const box = await page.locator('.dialogue-layer .dialogue, .dialogue-layer, .say-layer').first().boundingBox().catch(() => null);
      if (!box) break;
      await tapAt(box.x + box.width / 2, box.y + box.height - 10);
      await sleep(0.5);
    }
  } else if (s.wait !== undefined) {
    await sleep(s.wait);
  } else if (s.restless !== undefined) {
    rng = s.seed ?? 1;
    const end = Date.now() + s.restless * 1000;
    while (Date.now() < end) {
      const r = random();
      if (r < 0.45) await tapAt(30 + random() * (width - 60), 120 + random() * (height - 320));
      else if (r < 0.75) {
        const p = await center('.act-btn');
        if (random() < 0.5) await tapAt(...p);
        else await finger([p], random() * 1.5);
      } else if (r < 0.85) await tapAt(...(await center('.jump-btn')));
      else await finger([[80, height - 80], [80 + (random() - 0.5) * 100, height - 80 + (random() - 0.5) * 100]], random());
      await sleep(0.1 + random() * 0.4);
    }
  } else if (s.shot) {
    shots += 1;
    await page.screenshot({ path: `${out}/${String(shots).padStart(2, '0')}-${s.shot}.jpg`, type: 'jpeg', quality: 80 });
  } else if (s.check) {
    const ok = await page.evaluate((expr) => Boolean(new Function('tre', `return (${expr});`)(window.tre)), s.check).catch((e) => `error ${e.message}`);
    if (ok !== true) problems.push(`step ${i}: the check ${s.check} is not true`);
  } else if (s.until) {
    // Play on with no finger until the expression is true (the browser can be slower than a phone).
    // The page forbids eval in its own scripts (Content Security Policy), so the polls of
    // waitForFunction fail after the first one; page.evaluate is not under that rule.
    const t0 = Date.now();
    const limit = (s.timeout ?? 120) * 1000;
    let ok = false;
    let error = null;
    while (Date.now() - t0 < limit) {
      ok = await page.evaluate((expr) => Boolean(new Function('tre', `return (${expr});`)(window.tre)), s.until).catch((e) => { error = e.message.split('\n')[0]; return false; });
      if (ok) break;
      await sleep(0.5);
    }
    if (!ok) problems.push(`step ${i}: ${s.until} did not come true in ${Math.round((Date.now() - t0) / 1000)} seconds${error ? ` (${error})` : ''}`);
  } else if (s.print) {
    const v = await page.evaluate((expr) => JSON.stringify(new Function('tre', `return (${expr});`)(window.tre)), s.print).catch((e) => `error ${e.message}`);
    console.log(`step ${i}: ${s.print} = ${v}`);
  } else problems.push(`step ${i}: an unknown step ${JSON.stringify(s)}`);
  // The frame loop goes on: the tick of the world grows in a second and a half (when no line holds it).
  const t0 = await tick();
  await sleep(1.5);
  const t1 = await tick();
  const held = await page.evaluate(() => Boolean(document.querySelector('.dialogue-layer, .modal-layer')) || (window.tre.activeVillage?.session.screen ?? null) !== null);
  if (t0 !== null && t1 !== null && t0 === t1 && !held) problems.push(`step ${i}: the world stopped at tick ${t0}`);
  log.push({ step: i, ...s, problems: problems.slice(before) });
}
} catch (err) {
  // A step that cannot go on (a screen that did not come): the frame of the screen shows why.
  problems.push(`the play stopped: ${err.message.split('\n')[0]}`);
  await page.screenshot({ path: `${out}/stopped.jpg`, type: 'jpeg', quality: 80 }).catch(() => {});
}
// The problems that a plan allows for now (a known problem of a later issue): a part of the text.
const allowed = (p) => (plan.allow ?? []).some((a) => p.includes(a));
const known = problems.filter(allowed);
problems.splice(0, problems.length, ...problems.filter((p) => !allowed(p)));
for (const p of known) console.log(`known: ${p}`);
writeFileSync(`${out}/play.json`, JSON.stringify({ plan: args[0], problems, log }, null, 2));
for (const p of problems) console.log(p);
console.log(`${plan.steps?.length ?? 0} steps, ${shots} frames in ${out}, ${problems.length} problems`);
await browser.close();
process.exit(problems.length ? 1 : 0);
