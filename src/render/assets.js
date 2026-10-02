// Load SVG art and turn it into bitmaps (canvas) for fast drawing.
// Safari does not draw an SVG with no width and height, so we add them from the viewBox.

const texts = new Map();
const bitmaps = new Map();

async function loadText(path) {
  if (!texts.has(path)) {
    texts.set(path, fetch(`art/${path}.svg`).then(async (r) => {
      if (!r.ok) throw new Error(`Missing art ${path}`);
      const text = await r.text();
      const m = text.match(/viewBox="\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)\s*"/);
      const w = m ? Number(m[3]) : 100;
      const h = m ? Number(m[4]) : 100;
      return { text, w, h };
    }));
  }
  return texts.get(path);
}

export async function artSize(path) {
  const { w, h } = await loadText(path);
  return { w, h };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

async function toImage(text, w, h) {
  const sized = text.replace(/<svg\b/, `<svg width="${w}" height="${h}"`);
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// A bitmap of one or more SVG layers (drawn in order), at a scale of the viewBox.
// The result has the size of the first layer. result.unitW and unitH are the viewBox size.
export async function bitmap(paths, scale = 1) {
  const list = Array.isArray(paths) ? paths : [paths];
  const key = `${list.join('+')}@${scale}`;
  if (!bitmaps.has(key)) {
    bitmaps.set(key, (async () => {
      const layers = await Promise.all(list.map(loadText));
      const { w, h } = layers[0];
      const cw = Math.ceil(w * scale);
      const ch = Math.ceil(h * scale);
      const canvas = makeCanvas(cw, ch);
      const ctx = canvas.getContext('2d');
      for (const layer of layers) {
        const img = await toImage(layer.text, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
      }
      canvas.unitW = w;
      canvas.unitH = h;
      return canvas;
    })());
  }
  return bitmaps.get(key);
}

// Load many bitmaps. Return a Map from path to bitmap.
export async function loadBitmaps(paths, scale) {
  const out = new Map();
  await Promise.all(paths.map(async (p) => out.set(p, await bitmap(p, scale))));
  return out;
}

export function artUrl(path) {
  return `art/${path}.svg`;
}
