// Characters made of parts (head, body, arms, legs) that rotate. Pure data, no WebGL: the
// renderer makes one box for each part. A part: { name, size: [w, h, d], color, at: [x, y, z],
// parent, pivotTop, mark }. `at` is the place of the part in its parent. A part with pivotTop
// hangs from its top (legs, arms), so a rotation swings it. A mark is a flat ink mark (eyes).
// Units: the figure before `scale`; the front of a figure is +z.

const P = (name, size, color, at, extra = {}) => ({ name, size, color, at, parent: extra.parent ?? 'body', pivotTop: Boolean(extra.pivotTop), mark: Boolean(extra.mark) });

// Clothes of the hero, from the choice at the start (1 to 4).
const CLOTHES = {
  1: { top: 'indigo', bottom: 'indigo', sash: 'vermilion' },
  2: { top: 'ochre', bottom: 'wood', sash: 'yellow' },
  3: { top: 'vermilionPale', bottom: 'indigo', sash: 'green' },
  4: { top: 'green', bottom: 'wood', sash: 'vermilion' },
};
const HAIR = { 1: 'short', 2: 'topknot', 3: 'long', 4: 'braids', 5: 'bun', 6: 'tufts' };

// The look of the hero from the hero of the profile.
export function heroLook(hero) {
  const c = CLOTHES[hero.clothes] ?? CLOTHES[1];
  const girl = hero.gender === 'girl';
  return {
    child: true,
    skin: `skin${hero.skin ?? hero.face ?? 2}`,
    top: c.top,
    bottom: c.bottom,
    sash: c.sash,
    bottomKind: girl ? 'skirt' : 'shorts',
    topKind: girl ? 'yem' : 'shirt',
    hair: HAIR[hero.hair] ?? 'short',
    face: hero.face ?? 1,
  };
}

// A person. look: { child, skin, top, bottom, sash, bottomKind (shorts, skirt, trousers, robe),
// topKind (shirt, yem, bare), hair, hairColor, beard, hat (non, band, helmet, plume), item, face, scale }.
export function person(look) {
  const child = Boolean(look.child);
  const skin = look.skin ?? 'skin2';
  const hairColor = look.hairColor ?? 'ink';
  const legH = child ? 2.4 : 2.9;
  const bodyH = child ? 2.2 : 2.6;
  const bodyW = child ? 2.2 : 2.3;
  const hip = legH;
  const shoulder = hip + bodyH + (child ? 0.1 : 0.2);
  const headS = child ? 2 : 1.9;
  const headY = shoulder + headS / 2 + 0.3;
  const parts = [];
  // Legs hang from the hips.
  const legColor = look.bottomKind === 'trousers' ? look.bottom : skin;
  parts.push(P('legL', [0.9, legH, 0.9], legColor, [-0.5, hip, 0], { pivotTop: true }));
  parts.push(P('legR', [0.9, legH, 0.9], legColor, [0.5, hip, 0], { pivotTop: true }));
  if (look.bottomKind === 'shorts') {
    parts.push(P('shortsL', [1, 0.9, 1], look.bottom, [0, 0, 0], { parent: 'legL', pivotTop: true }));
    parts.push(P('shortsR', [1, 0.9, 1], look.bottom, [0, 0, 0], { parent: 'legR', pivotTop: true }));
  } else if (look.bottomKind === 'skirt' || look.bottomKind === 'robe') {
    const h = look.bottomKind === 'robe' ? legH + bodyH * 0.6 : legH * 0.8;
    parts.push(P('skirt', [bodyW, h, 1.7], look.bottom, [0, hip - h / 2 + (look.bottomKind === 'robe' ? bodyH * 0.6 : 0) + 0.1, 0]));
  }
  // The body.
  const topColor = look.topKind === 'bare' ? skin : look.top;
  parts.push(P('torso', [bodyW, bodyH, 1.3], topColor, [0, hip + bodyH / 2, 0]));
  if (look.topKind === 'yem') parts.push(P('yem', [1.4, 1.4, 0.2], look.sash ?? 'vermilion', [0, hip + bodyH * 0.55, 0.72]));
  if (look.sash) parts.push(P('sash', [bodyW + 0.1, 0.45, 1.4], look.sash, [0, hip + 0.2, 0]));
  // Arms hang from the shoulders.
  const armH = child ? 2 : 2.4;
  const armSkin = look.topKind === 'robe' ? look.top : skin;
  parts.push(P('armL', [0.75, armH, 0.75], armSkin, [-(bodyW / 2 + 0.4), shoulder, 0], { pivotTop: true }));
  parts.push(P('armR', [0.75, armH, 0.75], armSkin, [bodyW / 2 + 0.4, shoulder, 0], { pivotTop: true }));
  if (look.topKind === 'shirt') {
    parts.push(P('sleeveL', [0.85, 0.8, 0.85], look.top, [0, 0, 0], { parent: 'armL', pivotTop: true }));
    parts.push(P('sleeveR', [0.85, 0.8, 0.85], look.top, [0, 0, 0], { parent: 'armR', pivotTop: true }));
  }
  // The head, with hair, a hat, and a face.
  parts.push(P('head', [0.01, 0.01, 0.01], null, [0, headY, 0]));
  parts.push(P('skull', [headS, headS, headS], skin, [0, 0, 0], { parent: 'head' }));
  const hair = look.hair ?? 'short';
  if (hair !== 'bald') {
    const hc = hair === 'grey' ? 'ashLight' : hairColor;
    parts.push(P('hair', [headS + 0.1, 0.8, headS + 0.1], hc, [0, headS / 2 - 0.3, 0], { parent: 'head' }));
    parts.push(P('hairBack', [headS + 0.1, headS * 0.8, 0.5], hc, [0, 0.1, -headS / 2 + 0.15], { parent: 'head' }));
    if (hair === 'topknot' || hair === 'bun') parts.push(P('knot', [0.8, 0.8, 0.8], hc, hair === 'bun' ? [0, 0.4, -headS / 2 - 0.4] : [0, headS / 2 + 0.35, -0.1], { parent: 'head' }));
    if (hair === 'long') parts.push(P('tail', [0.6, 1.6, 0.4], hc, [0, -0.9, -headS / 2 - 0.1], { parent: 'head' }));
    if (hair === 'braids') for (const s of [-1, 1]) parts.push(P(`braid${s}`, [0.45, 1.5, 0.45], hc, [s * (headS / 2 + 0.1), -0.8, -0.2], { parent: 'head' }));
    if (hair === 'tufts') for (const s of [-1, 1]) parts.push(P(`tuft${s}`, [0.5, 0.5, 0.5], hc, [s * 0.5, headS / 2 + 0.25, 0.1], { parent: 'head' }));
  }
  if (look.beard) parts.push(P('beard', [1.1, 0.9, 0.4], look.beard === true ? 'ashLight' : look.beard, [0, -headS / 2 - 0.2, headS / 2 - 0.1], { parent: 'head' }));
  if (look.hat === 'non') parts.push(P('hat', [3.2, 0.5, 3.2], 'yellowPale', [0, headS / 2 + 0.3, 0], { parent: 'head' }), P('hatTop', [1.4, 0.6, 1.4], 'yellowPale', [0, headS / 2 + 0.8, 0], { parent: 'head' }));
  if (look.hat === 'band') parts.push(P('band', [headS + 0.15, 0.3, headS + 0.15], look.sash ?? 'vermilion', [0, 0.45, 0], { parent: 'head' }));
  if (look.hat === 'helmet' || look.hat === 'plume') {
    parts.push(P('helmet', [headS + 0.3, 0.9, headS + 0.3], 'ash', [0, headS / 2 + 0.1, 0], { parent: 'head' }));
    if (look.hat === 'plume') parts.push(P('plume', [0.4, 1.2, 1.2], 'vermilion', [0, headS / 2 + 1.1, -0.2], { parent: 'head' }));
  }
  const eyeY = look.face === 3 ? 0.1 : 0;
  for (const ex of [-0.45, 0.45]) parts.push(P(`eye${ex > 0 ? 'R' : 'L'}`, [0.22, 0.3, 0.05], 'ink', [ex, eyeY, headS / 2 + 0.03], { parent: 'head', mark: true }));
  if (look.face === 2 || look.face === 4) parts.push(P('mouth', [0.5, 0.12, 0.05], 'vermilion', [0, -0.55, headS / 2 + 0.03], { parent: 'head', mark: true }));
  // Something in the hand.
  const item = look.item;
  const hand = [0, -armH, 0.2];
  if (item === 'staff' || item === 'spear') parts.push(P('item', [0.3, 6, 0.3], item === 'spear' ? 'wood' : 'ash', [hand[0], hand[1] + 1.5, hand[2]], { parent: 'armR' }));
  if (item === 'spear') parts.push(P('tip', [0.4, 0.8, 0.4], 'ashLight', [0, hand[1] + 4.8, 0.2], { parent: 'armR' }));
  if (item === 'sword') parts.push(P('item', [0.25, 2.6, 0.5], 'ashLight', [0, hand[1] - 0.8, 0.6], { parent: 'armR' }));
  if (item === 'hammer') parts.push(P('item', [0.25, 1.8, 0.25], 'wood', [0, hand[1] - 0.4, 0.3], { parent: 'armR' }), P('head2', [0.9, 0.6, 0.6], 'ash', [0, hand[1] - 1.3, 0.3], { parent: 'armR' }));
  if (item === 'axe') parts.push(P('item', [0.25, 2.2, 0.25], 'wood', [0, hand[1] - 0.5, 0.3], { parent: 'armR' }), P('blade', [0.2, 0.8, 0.8], 'ashLight', [0, hand[1] - 1.4, 0.7], { parent: 'armR' }));
  if (item === 'net') parts.push(P('item', [1.4, 1.4, 0.2], 'paperDeep', [0, hand[1] - 0.6, 0.4], { parent: 'armR' }));
  if (item === 'basket') parts.push(P('item', [1.3, 1, 1.3], 'ochre', [0, hand[1] - 0.4, 0.4], { parent: 'armR' }));
  if (item === 'scroll') parts.push(P('item', [0.4, 1.4, 0.4], 'paper', [0, hand[1] - 0.3, 0.4], { parent: 'armR' }));
  if (item === 'fan') parts.push(P('item', [1.2, 1.2, 0.15], 'yellowPale', [0, hand[1] - 0.5, 0.4], { parent: 'armR' }));
  if (item === 'drum') parts.push(P('item', [1.4, 1, 1.4], 'vermilion', [0, hand[1] - 0.2, 0.6], { parent: 'armR' }));
  const top = headY + headS / 2 + (look.hat === 'non' ? 1.1 : look.hat === 'plume' ? 1.7 : 0.8);
  return {
    kind: 'biped',
    parts,
    scale: look.scale ?? (child ? 0.6 : 0.66),
    height: top,
    shadow: 1.3,
  };
}

// Nghé, the buffalo calf. The diagonal legs move together.
export function nghe() {
  const body = 'ashLight';
  const leg = 'ash';
  const parts = [P('trunk', [2.2, 1.9, 3.6], body, [0, 2.6, 0])];
  const legs = [['legFL', -0.7, 1.2], ['legFR', 0.7, 1.2], ['legBL', -0.7, -1.2], ['legBR', 0.7, -1.2]];
  for (const [name, x, z] of legs) parts.push(P(name, [0.7, 1.7, 0.7], leg, [x, 1.8, z], { pivotTop: true }));
  parts.push(P('head', [0.01, 0.01, 0.01], null, [0, 3.1, 1.8]));
  parts.push(P('skull', [1.5, 1.4, 1.6], body, [0, 0, 0.8], { parent: 'head' }));
  parts.push(P('muzzle', [1.2, 0.8, 0.6], 'paperDeep', [0, -0.35, 1.7], { parent: 'head' }));
  parts.push(P('hornL', [0.9, 0.3, 0.3], 'diep', [-0.75, 0.75, 0.6], { parent: 'head' }));
  parts.push(P('hornR', [0.9, 0.3, 0.3], 'diep', [0.75, 0.75, 0.6], { parent: 'head' }));
  parts.push(P('earL', [0.6, 0.25, 0.35], body, [-1, 0.35, 0.4], { parent: 'head' }));
  parts.push(P('earR', [0.6, 0.25, 0.35], body, [1, 0.35, 0.4], { parent: 'head' }));
  for (const ex of [-0.5, 0.5]) parts.push(P(`eye${ex > 0 ? 'R' : 'L'}`, [0.18, 0.22, 0.05], 'ink', [ex, 0.2, 1.63], { parent: 'head', mark: true }));
  parts.push(P('tail', [0.2, 1.2, 0.2], leg, [0, 3.2, -1.85], { pivotTop: true }));
  return { kind: 'quadruped', parts, scale: 0.58, height: 4.2, shadow: 1.9 };
}

export function duck() {
  const parts = [
    P('trunk', [1, 0.7, 1.5], 'diep', [0, 0.2, 0]),
    P('head', [0.6, 0.6, 0.6], 'green', [0, 0.8, 0.6]),
    P('beak', [0.3, 0.15, 0.4], 'yellow', [0, 0.7, 1]),
  ];
  return { kind: 'float', parts, scale: 0.6, height: 1.2, shadow: 0 };
}

// A thuồng luồng of the river: a long body of segments, a head with a fin.
export function serpent() {
  const parts = [];
  for (let i = 0; i < 5; i++) parts.push(P(`seg${i}`, [1.4 - i * 0.15, 1.2 - i * 0.12, 1.3], i % 2 ? 'indigoPale' : 'indigo', [0, 1.1, -i * 1.25]));
  parts.push(P('head', [0.01, 0.01, 0.01], null, [0, 1.8, 1.1]));
  parts.push(P('skull', [1.6, 1.3, 1.8], 'indigo', [0, 0, 0.3], { parent: 'head' }));
  parts.push(P('fin', [0.3, 1, 1.2], 'vermilion', [0, 0.9, -0.1], { parent: 'head' }));
  for (const ex of [-0.55, 0.55]) parts.push(P(`eye${ex > 0 ? 'R' : 'L'}`, [0.25, 0.25, 0.05], 'yellow', [ex, 0.2, 1.23], { parent: 'head', mark: true }));
  return { kind: 'serpent', parts, scale: 0.8, height: 3.2, shadow: 0 };
}

// The figure of a look from data/figures.json.
export function figureOf(look) {
  if (look.kind === 'nghe') return nghe();
  if (look.kind === 'duck') return duck();
  if (look.kind === 'serpent') return serpent();
  return person(look);
}
