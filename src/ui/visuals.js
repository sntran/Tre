// Small SVG pictures for problems: dots, arrays, shapes, rectangles, and fractions.
// They have numbers only, and no words.
const NS = 'http://www.w3.org/2000/svg';
import { C } from '../render/palette.js';

const INK = C.ink;
const COLORS = [C.vermilion, C.indigo, C.green, C.yellow];

// The width and the height give the picture its size. With a viewBox only,
// the picture has no size in a centered column, and it does not show.
function svg(w, h, children) {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', `0 0 ${w} ${h}`);
  el.setAttribute('width', String(w));
  el.setAttribute('height', String(h));
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

export function shapeSvg(shape, marks = false) {
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
  // marks: a number on each side (#154: the reason of "not learned yet" counts the sides).
  const n = { triangle: 3, square: 4, rectangle: 4, pentagon: 5, hexagon: 6 }[shape] ?? 0;
  const corners = {
    triangle: () => poly(3, 48, -Math.PI / 2).split(' ').map((q) => q.split(',').map(Number)).map(([x, y]) => [x, y + 8]),
    square: () => [[20, 20], [100, 20], [100, 100], [20, 100]],
    rectangle: () => [[8, 32], [112, 32], [112, 88], [8, 88]],
    pentagon: () => poly(5).split(' ').map((q) => q.split(',').map(Number)),
    hexagon: () => poly(6, 46, 0).split(' ').map((q) => q.split(',').map(Number)),
  }[shape];
  let labels = '';
  if (marks && corners) {
    const c = corners();
    for (let i = 0; i < n; i++) {
      const [x0, y0] = c[i];
      const [x1, y1] = c[(i + 1) % n];
      // The middle of the side, a little out from the middle of the shape.
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      const len = Math.hypot(mx - 60, my - 60) || 1;
      const lx = mx + ((mx - 60) / len) * 12;
      const ly = my + ((my - 60) / len) * 12;
      labels += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${C.vermilion}" stroke-width="5" stroke-linecap="round"/>`;
      labels += `<text x="${lx.toFixed(1)}" y="${(ly + 6).toFixed(1)}" font-size="16" font-weight="700" font-family="Be Vietnam Pro, sans-serif" text-anchor="middle" fill="${INK}">${i + 1}</text>`;
    }
  }
  if (marks && shape === 'circle') labels = `<circle cx="60" cy="60" r="44" fill="none" stroke="${C.vermilion}" stroke-width="5"/>`;
  return marks ? svg(140, 140, `<g transform="translate(10 10)">${inner}${labels}</g>`) : svg(120, 120, inner);
}

// mark: 'row' fills the first row (the squares of one row, #154); 'edge' draws the way around the
// rectangle, with the length of each side.
function rect(w, h, grid, mark = null) {
  const u = Math.min(32, 300 / Math.max(w, h));
  let out = '';
  if (grid) {
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
      const fill = mark === 'row' && y === 0 ? C.vermilion : C.yellowPale;
      out += `<rect x="${30 + x * u}" y="${10 + y * u}" width="${u}" height="${u}" fill="${fill}" stroke="${INK}" stroke-width="1.2"/>`;
    }
  }
  out += `<rect x="30" y="10" width="${w * u}" height="${h * u}" fill="${grid ? 'none' : C.yellowPale}" stroke="${mark === 'edge' ? C.vermilion : INK}" stroke-width="${mark === 'edge' ? 6 : 3}"/>`;
  if (mark === 'edge') {
    out += `<text x="${30 + (w * u) / 2}" y="${10 + 22}" font-size="18" font-weight="700" font-family="Be Vietnam Pro, sans-serif" text-anchor="middle" fill="${INK}">${w}</text>`;
    out += `<text x="${30 + w * u - 14}" y="${10 + (h * u) / 2 + 6}" font-size="18" font-weight="700" font-family="Be Vietnam Pro, sans-serif" text-anchor="middle" fill="${INK}">${h}</text>`;
  }
  out += `<text x="${30 + (w * u) / 2}" y="${h * u + 36}" font-size="22" font-weight="700" font-family="Be Vietnam Pro, sans-serif" text-anchor="middle" fill="${INK}">${w}</text>`;
  out += `<text x="18" y="${10 + (h * u) / 2 + 8}" font-size="22" font-weight="700" font-family="Be Vietnam Pro, sans-serif" text-anchor="middle" fill="${INK}">${h}</text>`;
  return svg(w * u + 50, h * u + 46, out);
}

// values: [[n, d, split]]: a bar of d parts with n parts in color; split: each part cut into that
// many small parts with thin lines (#154: the bar of 1/4 cut into twelfths). mark: the index of a
// bar with a red frame.
function fractions(values, mark = -1) {
  const width = 300;
  let out = '';
  values.forEach(([n, d, split = 1], i) => {
    const y = 10 + i * 56;
    for (let k = 0; k < d; k++) {
      out += `<rect x="${10 + (k * width) / d}" y="${y}" width="${width / d}" height="40" fill="${k < n ? COLORS[i % 2] : C.diep}" stroke="${INK}" stroke-width="2.5"/>`;
      for (let j = 1; j < split; j++) {
        const x = 10 + (k * width) / d + (j * width) / (d * split);
        out += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 40}" stroke="${INK}" stroke-width="1" stroke-dasharray="3 2"/>`;
      }
    }
    if (i === mark) out += `<rect x="7" y="${y - 3}" width="${width + 6}" height="46" fill="none" stroke="${C.vermilion}" stroke-width="4"/>`;
  });
  return svg(width + 20, values.length * 56 + 6, out);
}

// A row of boxes with a number or a sign in each; the box mark has color (#154).
function row(items, mark = -1) {
  const bw = Math.max(44, Math.max(...items.map((x) => String(x).length)) * 14 + 16);
  const gap = 8;
  let out = '';
  items.forEach((x, i) => {
    const sign = /^[+−\-=<>×]$/.test(x);
    const left = 10 + i * (bw + gap);
    if (!sign) out += `<rect x="${left}" y="10" width="${bw}" height="44" rx="6" fill="${i === mark ? C.vermilion : C.yellowPale}" stroke="${INK}" stroke-width="2.5"/>`;
    out += `<text x="${left + bw / 2}" y="40" font-size="22" font-weight="700" font-family="Be Vietnam Pro, sans-serif" text-anchor="middle" fill="${i === mark ? C.paper : INK}">${x}</text>`;
  });
  return svg(items.length * (bw + gap) + 12, 64, out);
}

export function renderVisual(v) {
  if (!v) return null;
  switch (v.type) {
    case 'dots': return dots(v.groups, v.crossed ?? 0);
    case 'array': return array(v.rows, v.cols);
    case 'shape': return shapeSvg(v.shape, Boolean(v.marks));
    case 'rect': return rect(v.w, v.h, v.grid, v.mark ?? null);
    case 'fractions': return fractions(v.values, v.mark ?? -1);
    case 'row': return row(v.items, v.mark ?? -1);
    default: return null;
  }
}
