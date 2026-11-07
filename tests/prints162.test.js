// The prints of the notebook (#162): a print always draws (it tries again with a growing wait),
// each print shows the whole thing from its usual side, each skill has its own print, the print of
// a place is what the child had in the hands there, and the card and its voice go together.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './helpers.js';
import { retryDraw } from '../src/ui/retry.js';
import { figureOf, printFraming } from '../src/world/figures.js';
import { printView, isAnimal } from '../src/world/portraits.js';
import { skillPrint } from '../src/core/notebook.js';

const notebook = load('data/notebook.json');
const figures = load('data/figures.json').figures;
const vi = load('i18n/vi.json');

test('a renderer that fails three times: the fourth try draws, after waits that grow', async () => {
  let tries = 0;
  const waits = [];
  const n = await retryDraw(() => { tries += 1; return tries >= 4; }, { wait: (ms, fn) => { waits.push(ms); fn(); } });
  assert.equal(n, 4);
  assert.equal(tries, 4);
  assert.equal(waits.length, 3);
  assert.ok(waits[1] > waits[0] && waits[2] > waits[1], waits.join(', '));
  // A try that throws is a try that did not draw.
  let k = 0;
  assert.equal(await retryDraw(() => { k += 1; if (k < 2) throw new Error('lost context'); return true; }, { wait: (ms, fn) => fn() }), 2);
  // The tries stop when the picture is not wanted any more.
  assert.equal(await retryDraw(() => false, { wait: (ms, fn) => fn(), alive: (i) => i < 5 }), null);
  // The canvas of a portrait shows an outline while it waits, and tries while it is on the screen.
  const src = readFileSync(new URL('../src/ui/portraits.js', import.meta.url), 'utf8');
  assert.match(src, /outline\(c, size\)/);
  assert.match(src, /alive: \(n\) => c\.isConnected \|\| n < DRAW_TRIES/);
});

// The box of a coarse figure (the parts hang from their parents).
function box(f) {
  const by = new Map((f.parts ?? []).map((p) => [p.name, p]));
  const abs = (p) => {
    let a = [...p.at];
    let q = p;
    for (let g = 0; q.parent && by.has(q.parent) && g < 20; g++) {
      q = by.get(q.parent);
      a = a.map((v, i) => v + q.at[i]);
    }
    return a;
  };
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of f.parts ?? []) {
    const a = abs(p);
    const c = [a[0], p.pivotTop ? a[1] - p.size[1] / 2 : a[1], a[2]];
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], c[i] - p.size[i] / 2);
      hi[i] = Math.max(hi[i], c[i] + p.size[i] / 2);
    }
  }
  return { x: hi[0] - lo[0], y: hi[1] - lo[1], z: hi[2] - lo[2] };
}
function printLooks() {
  const out = new Set();
  for (const v of Object.values(notebook.skills)) {
    out.add(v.look);
    for (const x of Object.values(v.from ?? {})) out.add(x.look);
  }
  for (const v of Object.values(notebook.sources)) out.add(v.look);
  for (const e of notebook.entries) if (e.look) out.add(e.look);
  return [...out].filter(Boolean);
}

test('each print of an animal or a thing is the whole thing from its usual side: it covers between 30% and 80% of the box at 64 pixels', () => {
  const bad = [];
  for (const key of printLooks()) {
    const look = figures[key];
    assert.ok(look, `the look ${key}`);
    const f = figureOf(look, 'coarse');
    if (f.kind === 'biped') {
      assert.equal(printFraming(look), 'bust', key);
      continue;
    }
    assert.equal(printFraming(look), 'print', key);
    const v = printView(box(f), isAnimal(look, f.kind));
    // The box of the thing on 64 pixels.
    const px = Math.round(v.cover * 64 * 64);
    if (v.cover < 0.3 || v.cover > 0.8) bad.push(`${key}: ${(v.cover * 100).toFixed(0)}% (${px} of 4096 pixels)`);
    if (isAnimal(look, f.kind)) assert.ok(v.turn >= Math.PI / 4 - 1e-9, `${key} from the side`);
  }
  assert.deepEqual(bad, []);
});

test('no two prints of skills have the same name and look, and two skills of the same place have two prints', () => {
  const seen = new Map();
  for (const [id, v] of Object.entries(notebook.skills)) {
    for (const [where, x] of [['', v], ...Object.entries(v.from ?? {})]) {
      const k = `${x.titleKey}|${x.look}`;
      assert.ok(!seen.has(k) || seen.get(k) === id, `${id} ${where} and ${seen.get(k)}: ${k}`);
      seen.set(k, id);
    }
  }
  // Two skills earned first at the forge: the first has the print of the place, the second its own.
  const ids = Object.keys(notebook.skills).filter((id) => !notebook.skills[id].from?.['trial-horse']).slice(0, 2);
  const from = { [ids[0]]: 'trial-horse', [ids[1]]: 'trial-horse' };
  const a = skillPrint(notebook, { id: ids[0] }, 'trial-horse', from);
  const b = skillPrint(notebook, { id: ids[1] }, 'trial-horse', from);
  assert.notEqual(`${a.titleKey}|${a.look}`, `${b.titleKey}|${b.look}`);
  assert.equal(a.titleKey, 'print.from.trial-horse');
  // The count and the color of the forge: a pile of iron, and the red iron.
  const count = skillPrint(notebook, { id: 'math.count.120' }, 'trial-horse', { 'math.count.120': 'trial-horse' });
  assert.notEqual(vi[count.titleKey], vi['print.from.trial-horse']);
});

test('the print of the raid of the river is a rice ball, not a stone', () => {
  const p = notebook.sources['raid-river'];
  assert.equal(p.look, 'riceball');
  assert.equal(vi[p.titleKey], 'Nắm cơm');
});

test('a screen over the card takes its line out of the voice queue, and the card comes back after the screen', () => {
  const src = readFileSync(new URL('../src/ui/village.js', import.meta.url), 'utf8');
  const pump = src.slice(src.indexOf('function pumpPrints'), src.indexOf('function showPrint'));
  assert.match(pump, /voiceQueue\.forget\(isPrintLine\)/);
  assert.match(pump, /printQueue\.unshift\(printEv\)/);
});
