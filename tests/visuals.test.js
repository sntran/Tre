import { test } from 'node:test';
import assert from 'node:assert/strict';

// A small stand-in for the DOM: the picture code only makes SVG elements.
globalThis.document = {
  createElementNS: () => ({
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    set innerHTML(v) { this.html = v; },
  }),
};
const { renderVisual, shapeSvg } = await import('../src/ui/visuals.js');

test('each problem picture has a width and a height, so that it shows on the screen', () => {
  const visuals = [
    { type: 'dots', groups: [3, 4] },
    { type: 'array', rows: 3, cols: 4 },
    { type: 'shape', shape: 'pentagon' },
    { type: 'rect', w: 4, h: 3, grid: true },
    { type: 'fractions', values: [[1, 2], [1, 4]] },
  ];
  for (const v of visuals) {
    const el = renderVisual(v);
    const [, , w, h] = el.attrs.viewBox.split(' ').map(Number);
    assert.equal(Number(el.attrs.width), w, `${v.type}: width`);
    assert.equal(Number(el.attrs.height), h, `${v.type}: height`);
    assert.ok(w > 0 && h > 0);
  }
  assert.ok(Number(shapeSvg('square').attrs.width) > 0);
});
