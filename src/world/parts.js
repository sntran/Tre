// The parts of a figure (src/world/figures.js and src/world/fine.js). Pure data, no WebGL. A part:
// { name, size: [w, h, d], color, at: [x, y, z], parent, pivotTop, mark }. `at` is the place of the
// part in its parent. A part with pivotTop hangs from its top (legs, arms), so a rotation swings it.
// A mark is a flat mark with no ink outline (eyes, a mouth, a dot). shape: 'box' (the default), or
// 'ball' (a low smooth mesh in the flat tones, for the smooth heads that the owner compares on
// docs/reference/figures.html).

export const P = (name, size, color, at, extra = {}) => ({ name, size, color, at, parent: extra.parent ?? 'body', pivotTop: Boolean(extra.pivotTop), mark: Boolean(extra.mark), shape: extra.shape ?? 'box' });

// The planks of the bridge have units in two tones.
export const PLANK_TONES = Object.freeze(['yellowPale', 'ochre']);

// A thing in the hands. at(dx, dy, dz): the place in the part that holds it, from the hand; k: the
// size of one unit of the list below in the units of the figure (1 for a coarse figure, 2 for a
// fine one). hand, off: the parts that hold it (the right hand, and the left for a shield). No
// sharp points or blades (docs/ART.md): soldiers carry blunt staffs.
export function heldItem(item, at, k, hand = 'armR', off = 'armL') {
  const s = (v) => v.map((x) => x * k);
  const R = (name, size, color, dx, dy, dz) => P(name, s(size), color, at(dx, dy, dz), { parent: hand });
  const L = (name, size, color, dx, dy, dz) => P(name, s(size), color, at(dx, dy, dz), { parent: off });
  const out = [];
  if (!item) return out;
  if (item === 'staff') out.push(R('item', [0.3, 6, 0.3], 'wood', 0, 1.5, 0.2));
  if (item === 'hammer') out.push(R('item', [0.25, 1.8, 0.25], 'wood', 0, -0.4, 0.3), R('head2', [0.9, 0.6, 0.6], 'ash', 0, -1.3, 0.3));
  if (item === 'axe') out.push(R('item', [0.25, 2.2, 0.25], 'wood', 0, -0.5, 0.3), R('blade', [0.2, 0.8, 0.8], 'ashLight', 0, -1.4, 0.7));
  if (item === 'net') out.push(R('item', [1.4, 1.4, 0.2], 'paperDeep', 0, -0.6, 0.4));
  if (item === 'basket') out.push(R('item', [1.3, 1, 1.3], 'ochre', 0, -0.4, 0.4));
  if (item === 'scroll') out.push(R('item', [0.4, 1.4, 0.4], 'paper', 0, -0.3, 0.4));
  if (item === 'fan') out.push(R('item', [1.2, 1.2, 0.15], 'yellowPale', 0, -0.5, 0.4));
  if (item === 'lantern') out.push(R('item', [0.15, 1, 0.15], 'wood', 0, -0.2, 0.3), R('lamp', [0.8, 0.9, 0.8], 'yellow', 0, -1.1, 0.3));
  if (item === 'drum') out.push(R('item', [1.4, 1, 1.4], 'vermilion', 0, -0.2, 0.6));
  // A raid: the lit torch of a scout (the tell before the throw), the wet shield of a soldier on
  // the left arm, and a trap of bamboo in the hands.
  if (item === 'torch') out.push(R('item', [0.25, 1.6, 0.25], 'wood', 0, -0.2, 0.3), R('flame', [0.7, 0.8, 0.7], 'vermilion', 0, -1.3, 0.3), R('core', [0.4, 0.5, 0.4], 'yellow', 0, -1.5, 0.3));
  if (item === 'shield') out.push(L('item', [0.3, 2.2, 2.2], 'indigo', -0.3, 0.4, 0.5), L('boss', [0.35, 0.6, 0.6], 'indigoPale', -0.5, 0.4, 0.5));
  if (item === 'trap') out.push(R('item', [1.2, 0.4, 1.2], 'yellow', 0, -0.4, 0.5));
  // A tray of bowls of rice for Gióng.
  if (String(item).startsWith('bowls-')) {
    const n = Number(item.slice(6));
    out.push(R('item', [n * 0.5 + 0.4, 0.5, 1], 'wood', 0, -0.3, 0.6), R('bowls', [n * 0.5, 0.4, 0.8], 'diep', 0, 0.05, 0.6));
  }
  // A thing of a trial in the hands.
  const carried = { ore: 'ash', bucket: 'wood', stake: 'ochre', sticks: 'green' }[String(item).replace(/-.*$/, '')] ?? (String(item).startsWith('herb-') ? 'greenPale' : null);
  if (carried) out.push(R('item', item === 'stake' ? [0.35, 2, 0.35] : [0.9, 0.8, 0.9], carried, 0, -0.5, 0.5));
  return out;
}

// A plank on the right shoulder, along the way the person looks, with its units and dots. u: one
// half block in the units of the figure; x, y: the place of the shoulder.
export function shoulderPlank(item, u, x, y) {
  const m = /^plank-(\d+)$/.exec(item ?? '');
  if (!m) return [];
  const n = Number(m[1]);
  const out = [];
  for (let i = 0; i < n; i++) {
    const z = (i - n / 2 + 0.5) * u + u * 0.6;
    out.push(P(`plank${i}`, [u * 1.2, u * 0.5, u], PLANK_TONES[i % 2], [x, y + 0.5, z]));
    out.push(P(`plankDot${i}`, [u * 0.35, 0.04, u * 0.35], 'vermilion', [x, y + 0.5 + u * 0.26, z], { mark: true }));
  }
  return out;
}
