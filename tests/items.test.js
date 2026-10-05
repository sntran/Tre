// The goods of barter and the items of a time (#26): data/items.json and src/core/items.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { itemIn, itemsOf, basketOf } from '../src/core/items.js';
import { load } from './helpers.js';

const items = load('data/items.json');
const vi = load('i18n/vi.json');
const en = load('i18n/en.json');
const regions = load('data/world/regions.json');
const ERA1 = Math.min(...regions.regions.filter((r) => r.year !== undefined).map((r) => r.year));

test('the goods of the basket are rice, rice balls, fish, eggs, and clay pots, each with its picture and name; the HUD shows the basket', () => {
  assert.deepEqual(items.basket, ['rice', 'riceball', 'fish', 'egg', 'pot']);
  for (const id of Object.keys(items.items)) {
    const it = items.items[id];
    assert.ok(existsSync(`art/${it.art}.svg`), `${id}: art`);
    assert.ok(vi[it.nameKey] && en[it.nameKey], `${id}: name`);
    assert.ok(it.from === null || Number.isInteger(it.from), `${id}: from`);
  }
  assert.ok(existsSync(`art/${items.basketArt}.svg`));
  assert.equal(items.hud[0], items.basket[0], 'the first counter of the HUD is the basket');
  assert.deepEqual(basketOf(items, { rice: 3, fish: 2 }).map((g) => g.n), [3, 0, 2, 0, 0]);
});

test('Era 1 has no coin: the coin comes with the Đinh (968), and all the goods of the basket are in Era 1', () => {
  assert.equal(items.items.coin.from, 968);
  assert.ok(!itemIn(items, 'coin', ERA1));
  assert.ok(itemIn(items, 'coin', 970));
  for (const id of items.basket) assert.ok(itemsOf(items, ERA1).includes(id), id);
  assert.ok(items.hud.every((id) => itemIn(items, id, ERA1)), 'no counter of the HUD in Era 1 is a coin');
});

test('no text of Era 1 says coins or a price in đồng; the coin is a thing of a later time', () => {
  const origins = load('data/world/origins.json');
  const numbers = Object.entries(vi).filter(([k]) => /^num\.\d+$/.test(k)).map(([, v]) => v.toLowerCase());
  assert.equal(origins.things.coin.from, items.items.coin.from, 'the item and the thing of the coin have one year');
  for (const [lang, texts] of [['vi', vi], ['en', en]]) {
    for (const [k, v] of Object.entries(texts)) {
      if (k === items.items.coin.nameKey) continue;
      assert.ok(!/(?<!\p{L})(coins?|tiền|xu)(?!\p{L})/iu.test(v), `${lang} ${k}: a coin word`);
      // A price: a parameter, the word giá (a price), or a number word before đồng.
      assert.ok(!/(\}|giá)\s+đồng(?!\p{L})/iu.test(v) && !numbers.some((n) => v.toLowerCase().includes(`${n} đồng`)), `${lang} ${k}: a price in đồng`);
    }
  }
  // No market line names a price: the seller says a rate of goods.
  for (const k of Object.keys(vi).filter((x) => x.startsWith('event.market'))) assert.ok(!/đồng/iu.test(vi[k]) && !/coin|cost|price/i.test(en[k]), k);
});
