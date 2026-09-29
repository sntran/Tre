// Painter's depth order for an isometric scene.
// Each item has a box on the map: x0 <= x < x1, y0 <= y < y1 (a footprint, or a small box
// around a person). An item is behind another item when it is fully on the north side of it
// on one axis (a smaller x, or a smaller y). Items that overlap on both axes use the sum of
// their centers. The sort is a topological sort, so tall buildings and people mix correctly.

// Must a be drawn before b?
export function isBehind(a, b) {
  // a is on the north side of b on one axis, or b is on the north side of a.
  const aBehind = a.x1 <= b.x0 || a.y1 <= b.y0;
  const bBehind = b.x1 <= a.x0 || b.y1 <= a.y0;
  if (aBehind !== bBehind) return aBehind;
  // Both (the items are far apart, on a diagonal) or neither (the boxes overlap): the item
  // with the nearer center is in front.
  const ca = a.x0 + a.x1 + a.y0 + a.y1;
  const cb = b.x0 + b.x1 + b.y0 + b.y1;
  return ca < cb || (ca === cb && (a.z ?? 0) < (b.z ?? 0));
}

// Return the items in draw order, from back to front.
export function depthSort(items) {
  const list = [...items].sort((a, b) => (a.x0 + a.y0) - (b.x0 + b.y0));
  const n = list.length;
  const behind = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && isBehind(list[j], list[i])) behind[i].push(j);
    }
  }
  const state = new Uint8Array(n); // 0 new, 1 in progress, 2 done
  const out = [];
  const visit = (i) => {
    if (state[i]) return; // a cycle or a done item
    state[i] = 1;
    for (const j of behind[i]) visit(j);
    state[i] = 2;
    out.push(list[i]);
  };
  for (let i = 0; i < n; i++) visit(i);
  return out;
}
