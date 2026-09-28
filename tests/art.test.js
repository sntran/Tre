import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const palette = JSON.parse(readFileSync(join(root, 'art/palette.json'), 'utf8')).colors;
const allowed = new Set(Object.values(palette).map((c) => c.toLowerCase()));
const sizes = JSON.parse(readFileSync(join(root, 'tests/art-sizes.json'), 'utf8')).sizes;

function svgFiles(dir = 'art') {
  const out = [];
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) out.push(...svgFiles(rel));
    else if (name.endsWith('.svg')) out.push(rel);
  }
  return out;
}

// All color values in a text: #rgb, #rrggbb, and color names in fill or stroke.
function colors(text) {
  const out = [];
  for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) out.push(m[0].toLowerCase());
  for (const m of text.matchAll(/(?:fill|stroke|stop-color|color)\s*[:=]\s*"?\s*([a-zA-Z]+)\b/g)) {
    const v = m[1].toLowerCase();
    if (!['none', 'currentcolor', 'inherit', 'transparent'].includes(v)) out.push(v);
  }
  return out;
}

test('the three palette files have the same colors', () => {
  const css = readFileSync(join(root, 'styles/palette.css'), 'utf8');
  const js = readFileSync(join(root, 'src/render/palette.js'), 'utf8');
  for (const [name, value] of Object.entries(palette)) {
    assert.ok(css.includes(`--${name}: ${value};`), `palette.css: ${name}`);
    const camel = name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
    assert.ok(js.includes(`${camel}: '${value}'`), `palette.js: ${name}`);
  }
});

test('each art file uses only palette colors and allowed SVG parts', () => {
  const problems = [];
  for (const file of svgFiles()) {
    const text = readFileSync(join(root, file), 'utf8');
    const bad = [...new Set(colors(text).filter((c) => !allowed.has(c)))];
    if (bad.length) problems.push(`${file}: colors ${bad.join(' ')}`);
    for (const word of ['<text', '<script', '<image', 'href=', 'url(', '<filter', 'filter=', 'Gradient', '<foreignObject']) {
      if (text.includes(word)) problems.push(`${file}: ${word}`);
    }
    const head = text.match(/<svg\b[^>]*>/)?.[0] ?? '';
    if (!head.includes('viewBox=')) problems.push(`${file}: no viewBox`);
    if (/\s(width|height)=/.test(head)) problems.push(`${file}: width or height on <svg>`);
  }
  assert.deepEqual(problems, []);
});

test('each art file keeps its viewBox, because the code uses the sizes', () => {
  const problems = [];
  for (const [file, box] of Object.entries(sizes)) {
    const path = join(root, 'art', file);
    if (!existsSync(path)) {
      problems.push(`${file}: missing`);
      continue;
    }
    const head = readFileSync(path, 'utf8').match(/<svg\b[^>]*>/)?.[0] ?? '';
    const got = head.match(/viewBox="([^"]+)"/)?.[1];
    if (got !== box) problems.push(`${file}: viewBox "${got}", not "${box}"`);
  }
  assert.deepEqual(problems, []);
});

test('the CSS uses only palette colors', () => {
  const problems = [];
  for (const file of ['styles/main.css']) {
    const text = readFileSync(join(root, file), 'utf8');
    for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      if (!allowed.has(m[0].toLowerCase())) problems.push(`${file}: ${m[0]}`);
    }
  }
  assert.deepEqual(problems, []);
});
