// Small SVG pictures for problems: dots, arrays, shapes, rectangles, and fractions.
// They have numbers only, and no words.
const NS = 'http://www.w3.org/2000/svg';
import { C } from '../render/palette.js';

const INK = C.ink;
const COLORS = [C.vermilion, C.indigo, C.green, C.yellow];

function svg(w, h, children) {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', `0 0 ${w} ${h}`);
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = children;
  return el;
}

function dots(groups, crossed = 0) {
  const r = 14;
  const gap = 36;
  let x = 20;
  let out = '';
  const total = groups.reduce((a, b) => a + b, 0);
  let index = 0;
  groups.forEach((n, gi) => {
    for (let i = 0; i < n; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const cx = x + col * gap + r;
      const cy = 20 + row * gap + r;
      out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${COLORS[gi % 4]}" stroke="${INK}" stroke-width="2.2"/>`;
      if (index >= total - crossed) out += `<path d="M${cx - 12} ${cy - 12} L${cx + 12} ${cy + 12}" stroke="${INK}" stroke-width="4"/>`;
      index++;
    }
    x += Math.min(5, n) * gap + 24;
  });
  const rows = Math.max(...groups.map((n) => Math.ceil(n / 5)), 1);
  return svg(Math.max(x, 60), 24 + rows * gap, out);
}

function array(rows, cols) {
  const gap = 34;
  let out = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out += `<circle cx="${22 + c * gap}" cy="${22 + r * gap}" r="12" fill="${COLORS[0]}" stroke="${INK}" stroke-width="3"/>`;
    }
  }
  return svg(cols * gap + 10, rows * gap + 10, out);
}

export function shapeSvg(shape) {
  const S = `fill="${C.yellow}" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"`;
  const poly = (n, r = 44, rot = -Math.PI / 2) => Array.from({ length: n }, (_, i) => {
    const a = rot + (i * 2 * Math.PI) / n;
    return `${(60 + r * Math.cos(a)).toFixed(1)},${(60 + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const inner = {
    circle: `<circle cx="60" cy="60" r="44" ${S}/>`,
    triangle: `<polygon points="${poly(3, 48, -Math.PI / 2)}" transform="translate(0 8)" ${S}/>`,
    square: `<rect x="20" y="20" width="80" height="80" ${S}/>`,
    rectangle: `<rect x="8" y="32" width="104" height="56" ${S}/>`,
    pentagon: `<polygon points="${poly(5)}" ${S}/>`,
    hexagon: `<polygon points="${poly(6, 46, 0)}" ${S}/>`,
  }[shape] ?? '';
  return svg(120, 120, inner);
}

function rect(w, h, grid) {
  const u = Math.min(32, 300 / Math.max(w, h));
  let out = '';
  if (grid) {
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
      out += `<rect x="${30 + x * u}" y="${10 + y * u}" width="${u}" height="${u}" fill="${C.yellowPale}" stroke="${INK}" stroke-width="1.2"/>`;
    }
  }
  out += `<rect x="30" y="10" width="${w * u}" height="${h * u}" fill="${grid ? 'none' : C.yellowPale}" stroke="${INK}" stroke-width="3"/>`;
  out += `<text x="${30 + (w * u) / 2}" y="${h * u + 36}" font-size="22" font-weight="700" font-family="Be Vietnam Pro, sans-serif" text-anchor="middle" fill="${INK}">${w}</text>`;
  out += `<text x="18" y="${10 + (h * u) / 2 + 8}" font-size="22" font-weight="700" font-family="Be Vietnam Pro, sans-serif" text-anchor="middle" fill="${INK}">${h}</text>`;
  return svg(w * u + 50, h * u + 46, out);
}

function fractions(values) {
  const width = 300;
  let out = '';
  values.forEach(([n, d], i) => {
    const y = 10 + i * 56;
    for (let k = 0; k < d; k++) {
      out += `<rect x="${10 + (k * width) / d}" y="${y}" width="${width / d}" height="40" fill="${k < n ? COLORS[i % 2] : C.diep}" stroke="${INK}" stroke-width="2.5"/>`;
    }
  });
  return svg(width + 20, values.length * 56 + 6, out);
}

export function renderVisual(v) {
  if (!v) return null;
  switch (v.type) {
    case 'dots': return dots(v.groups, v.crossed ?? 0);
    case 'array': return array(v.rows, v.cols);
    case 'shape': return shapeSvg(v.shape);
    case 'rect': return rect(v.w, v.h, v.grid);
    case 'fractions': return fractions(v.values);
    default: return null;
  }
}
