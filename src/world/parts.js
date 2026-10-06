// The parts of a figure (src/world/figures.js and src/world/fine.js). Pure data, no WebGL. A part:
// { name, size: [w, h, d], color, at: [x, y, z], parent, pivotTop, mark }. `at` is the place of the
// part in its parent. A part with pivotTop hangs from its top (legs, arms), so a rotation swings it.
// A mark is a flat mark with no ink outline (eyes, a mouth, a dot). noInk: a part with no ink
// outline that is not flat (the small nose of a grown-up). hang: a kind of src/world/sway.js for a part that moves with the
// walk and the wind (hair, cloth, a tail); it turns about its top (pivotTop) or, for a part that
// stands up (a topknot, the tail of a rooster), about its bottom (pivotBottom).

export const P = (name, size, color, at, extra = {}) => ({ name, size, color, at, parent: extra.parent ?? 'body', pivotTop: Boolean(extra.pivotTop), pivotBottom: Boolean(extra.pivotBottom), mark: Boolean(extra.mark), noInk: Boolean(extra.noInk), hang: extra.hang ?? null });

// The planks of the bridge have units in two tones.
export const PLANK_TONES = Object.freeze(['yellowPale', 'ochre']);

// The tools of the people: a person holds one in the hand, and it has no look of its own on the
// ground. A thing that the hero picks up has its own look: the hands draw that look
// (src/world/carry.js).
export const TOOLS = new Set(['staff', 'pole', 'hammer', 'axe', 'net', 'fish', 'basket', 'scroll', 'fan', 'lantern', 'drum', 'torch', 'shield']);

// A tool in the hands. at(dx, dy, dz): the place in the part that holds it, from the hand; k: the
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
  // The long pole of a ferryman, held at its middle: it turns about the hand (animate: 'pole').
  if (item === 'pole') out.push(R('item', [0.25, 10, 0.25], 'wood', 0, 0, 0.3));
  if (item === 'hammer') out.push(R('item', [0.25, 1.8, 0.25], 'wood', 0, -0.4, 0.3), R('head2', [0.9, 0.6, 0.6], 'ash', 0, -1.3, 0.3));
  if (item === 'axe') out.push(R('item', [0.25, 2.2, 0.25], 'wood', 0, -0.5, 0.3), R('blade', [0.2, 0.8, 0.8], 'ashLight', 0, -1.4, 0.7));
  if (item === 'net') out.push(R('item', [1.4, 1.4, 0.2], 'paperDeep', 0, -0.6, 0.4));
  // A fish from the net of the fisher, held up by the tail.
  if (item === 'fish') out.push(R('item', [0.4, 1.6, 0.7], 'ashLight', 0, -0.9, 0.4), R('tail2', [0.2, 0.4, 0.8], 'ash', 0, -0.05, 0.4));
  if (item === 'basket') out.push(R('item', [1.3, 1, 1.3], 'ochre', 0, -0.4, 0.4));
  if (item === 'scroll') out.push(R('item', [0.4, 1.4, 0.4], 'paper', 0, -0.3, 0.4));
  if (item === 'fan') out.push(R('item', [1.2, 1.2, 0.15], 'yellowPale', 0, -0.5, 0.4));
  if (item === 'lantern') out.push(R('item', [0.15, 1, 0.15], 'wood', 0, -0.2, 0.3), R('lamp', [0.8, 0.9, 0.8], 'yellow', 0, -1.1, 0.3));
  if (item === 'drum') out.push(R('item', [1.4, 1, 1.4], 'vermilion', 0, -0.2, 0.6));
  // A raid: the lit torch of a scout (the tell before the throw), and the wet shield of a soldier
  // on the left arm.
  if (item === 'torch') out.push(R('item', [0.25, 1.6, 0.25], 'wood', 0, -0.2, 0.3), R('flame', [0.7, 0.8, 0.7], 'vermilion', 0, -1.3, 0.3), R('core', [0.4, 0.5, 0.4], 'yellow', 0, -1.5, 0.3));
  if (item === 'shield') out.push(L('item', [0.3, 2.2, 2.2], 'indigo', -0.3, 0.4, 0.5), L('boss', [0.35, 0.6, 0.6], 'indigoPale', -0.5, 0.4, 0.5));
  return out;
}
