// The ferry after the play test (#110): no ford in the frame of the puzzle, and a traveler who does
// not look like the fisher.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.js';

const data = load('data/world/puzzles.json');
const F = data.ferry;

test('no ford and no stepping stones within the frame of the puzzle', () => {
  const map = load('data/maps/phu-dong.json');
  const o = map.layers.objects.find((x) => x.id === F.anchor);
  const cells = [F.at, F.a, F.b, F.landA, F.landB, ...F.spotsA, ...F.spotsB].map(([dx, dy]) => [o.x + dx, o.y + dy]);
  const MARGIN = 6;
  const x0 = Math.min(...cells.map((c) => c[0])) - MARGIN;
  const x1 = Math.max(...cells.map((c) => c[0])) + MARGIN;
  const y0 = Math.min(...cells.map((c) => c[1])) - MARGIN;
  const y1 = Math.max(...cells.map((c) => c[1])) + MARGIN;
  const shallow = Object.entries(map.legend).filter(([, v]) => v === 'shallow').map(([k]) => k);
  for (const s of map.stamps) {
    (s.ground ?? []).forEach((row, j) => [...row].forEach((ch, i) => {
      const x = s.x + i;
      const y = s.y + j;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) assert.ok(!shallow.includes(ch), `a ford at ${x}, ${y}`);
    }));
  }
});

test('the traveler wears a khăn and carries a bundle on a pole, not the nón and the top of the fisher', () => {
  const figs = load('data/figures.json').figures;
  const t = figs.traveler;
  assert.equal(t.hat, 'khan');
  assert.equal(t.carried?.kind, 'bundle-pole');
  assert.notEqual(t.top, figs.fisher.top);
  assert.notEqual(t.top, 'indigoPale');
});
