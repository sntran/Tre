import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardRows, boardItems, baseOf, parseAddress, formatAddress, SWITCHES } from '../src/world/pieces.js';
import { figureOf } from '../src/world/figures.js';
import { HATS } from '../src/world/fine.js';
import { load } from './helpers.js';

const figures = load('data/figures.json');

test('the board has both heroes, every look of the data, every hair choice, and every hat, each one time', () => {
  const items = boardItems(figures);
  const ids = items.map((it) => it.id);
  assert.equal(new Set(ids).size, ids.length, 'each piece one time');
  for (const g of Object.keys(figures.hero.genders)) assert.ok(ids.includes(`hero-${g}`), `the hero (${g})`);
  for (const key of Object.keys(figures.figures)) assert.equal(items.filter((it) => it.key === key).length, 1, `${key} is on the board one time`);
  for (const hair of figures.hero.hairs) assert.ok(items.some((it) => it.id === `hair-${hair}` && it.look.hair === hair), `the hair choice ${hair}`);
  for (const hat of HATS) assert.ok(items.some((it) => it.look.hat === hat), `the hat ${hat}`);
  assert.deepEqual(boardRows(figures).map((r) => r.id), ['heroes', 'people', 'hairs', 'hats', 'animals', 'things']);
  // A new look in the data is one more piece.
  const more = { ...figures, figures: { ...figures.figures, 'test-weaver': { skin: 'skin3', top: 'green', bottom: 'indigo', hair: 'bun', face: 2 } } };
  assert.equal(boardItems(more).length, items.length + 1);
  assert.ok(boardRows(more).find((r) => r.id === 'people').items.some((it) => it.id === 'test-weaver'));
});

test('each piece stands on a base a little wider than its feet, made of quarter blocks', () => {
  for (const it of boardItems(figures)) {
    const { rx, rz } = baseOf(it.look);
    assert.ok(rx > 0.25 && rz > 0.25, `${it.id}: a base`);
    const base = figureOf({ kind: 'piece', rx, rz }, 'fine');
    assert.equal(base.grid, 0.25, 'quarter blocks');
    assert.ok(base.parts.every((p) => p.color === 'wood'), 'in wood');
  }
  // A long thing has an oval base; a person has a round one.
  const deck = boardItems(figures).find((it) => it.key === 'deck-20');
  const b = baseOf(deck.look);
  assert.ok(b.rz > b.rx * 2, 'a long base for a long deck');
  const g = baseOf(boardItems(figures).find((it) => it.key === 'grandma').look);
  assert.equal(g.rx, g.rz);
  // A square of paper under the base on the board.
  const sq = figureOf({ kind: 'piece', rx: 1, rz: 1, square: 3, dark: true }, 'fine');
  assert.ok(sq.parts.some((p) => p.name === 'square' && p.color === 'paperDeep'));
});

test('the address of the page: a parse of a format gives the same switches, and only known values are read', () => {
  const ids = boardItems(figures).map((it) => it.id);
  const state = { look: 'grandma', pose: 'walk', wind: 'full', mood: 'happy', time: 'night', level: 'far' };
  assert.equal(formatAddress(state), '?look=grandma&pose=walk&wind=full&mood=happy&time=night&level=far');
  assert.deepEqual(parseAddress(formatAddress(state), ids), state);
  // The defaults are not in the address.
  assert.equal(formatAddress({ look: null, pose: 'rest', wind: 'none', mood: 'calm', time: 'day', level: 'fine' }), '');
  // ?look= of each piece opens it; a look that does not exist opens the board.
  for (const id of ids) assert.equal(parseAddress(`?look=${encodeURIComponent(id)}`, ids).look, id);
  assert.equal(parseAddress('?look=nobody', ids).look, null);
  // Other parameters and bad values are not read.
  const odd = parseAddress('?look=nghe&wind=storm&mood=angry&x=1', ids);
  assert.deepEqual(odd, { look: 'nghe', pose: 'rest', wind: 'none', mood: 'calm', time: 'day', level: 'fine' });
  for (const [k, values] of Object.entries(SWITCHES)) for (const v of values) assert.equal(parseAddress(formatAddress({ look: null, [k]: v }), ids)[k], v);
});
