// The items of a time (#26; data/items.json): Era 1 trades by barter, and an item that came later
// (the coin of the Đinh, 968) is not in the world of an earlier time. Pure: no DOM.

// Is an item in the world in a year? (from: the first year; null: always.)
export const itemIn = (items, id, year) => {
  const it = items.items?.[id];
  return Boolean(it) && (it.from === null || it.from === undefined || year === null || year === undefined || it.from <= year);
};

// The items of the world in a year.
export const itemsOf = (items, year) => Object.keys(items.items ?? {}).filter((id) => itemIn(items, id, year));

// The goods of the basket of the household: [{ id, n }] in the order of the basket, with the
// goods that the household has.
export const basketOf = (items, inventory) => (items.basket ?? []).map((id) => ({ id, n: inventory?.[id] ?? 0 }));
