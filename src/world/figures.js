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
  // No sharp points or blades (docs/ART.md): soldiers carry blunt staffs.
  if (item === 'staff') parts.push(P('item', [0.3, 6, 0.3], 'wood', [hand[0], hand[1] + 1.5, hand[2]], { parent: 'armR' }));
  if (item === 'hammer') parts.push(P('item', [0.25, 1.8, 0.25], 'wood', [0, hand[1] - 0.4, 0.3], { parent: 'armR' }), P('head2', [0.9, 0.6, 0.6], 'ash', [0, hand[1] - 1.3, 0.3], { parent: 'armR' }));
  if (item === 'axe') parts.push(P('item', [0.25, 2.2, 0.25], 'wood', [0, hand[1] - 0.5, 0.3], { parent: 'armR' }), P('blade', [0.2, 0.8, 0.8], 'ashLight', [0, hand[1] - 1.4, 0.7], { parent: 'armR' }));
  if (item === 'net') parts.push(P('item', [1.4, 1.4, 0.2], 'paperDeep', [0, hand[1] - 0.6, 0.4], { parent: 'armR' }));
  if (item === 'basket') parts.push(P('item', [1.3, 1, 1.3], 'ochre', [0, hand[1] - 0.4, 0.4], { parent: 'armR' }));
  if (item === 'scroll') parts.push(P('item', [0.4, 1.4, 0.4], 'paper', [0, hand[1] - 0.3, 0.4], { parent: 'armR' }));
  if (item === 'fan') parts.push(P('item', [1.2, 1.2, 0.15], 'yellowPale', [0, hand[1] - 0.5, 0.4], { parent: 'armR' }));
  if (item === 'lantern') parts.push(P('item', [0.15, 1, 0.15], 'wood', [0, hand[1] - 0.2, 0.3], { parent: 'armR' }), P('lamp', [0.8, 0.9, 0.8], 'yellow', [0, hand[1] - 1.1, 0.3], { parent: 'armR' }));
  if (item === 'drum') parts.push(P('item', [1.4, 1, 1.4], 'vermilion', [0, hand[1] - 0.2, 0.6], { parent: 'armR' }));
  // A raid: the lit torch of a scout (the tell before the throw), the wet shield of a soldier on
  // the left arm, and a trap of bamboo in the hands.
  if (item === 'torch') parts.push(P('item', [0.25, 1.6, 0.25], 'wood', [0, hand[1] - 0.2, 0.3], { parent: 'armR' }), P('flame', [0.7, 0.8, 0.7], 'vermilion', [0, hand[1] - 1.3, 0.3], { parent: 'armR' }), P('core', [0.4, 0.5, 0.4], 'yellow', [0, hand[1] - 1.5, 0.3], { parent: 'armR' }));
  if (item === 'shield') parts.push(P('item', [0.3, 2.2, 2.2], 'indigo', [-0.3, hand[1] + 0.4, 0.5], { parent: 'armL' }), P('boss', [0.35, 0.6, 0.6], 'indigoPale', [-0.5, hand[1] + 0.4, 0.5], { parent: 'armL' }));
  if (item === 'trap') parts.push(P('item', [1.2, 0.4, 1.2], 'yellow', [0, hand[1] - 0.4, 0.5], { parent: 'armR' }));
  // A thing of a trial in the hands.
  const carried = { ore: 'ash', bucket: 'wood', stake: 'ochre', sticks: 'green' }[String(item).replace(/-.*$/, '')] ?? (String(item).startsWith('herb-') ? 'greenPale' : null);
  if (carried) parts.push(P('item', item === 'stake' ? [0.35, 2, 0.35] : [0.9, 0.8, 0.9], carried, [0, hand[1] - 0.5, 0.5], { parent: 'armR' }));
  // A plank on the right shoulder, along the way the person looks, with its units and dots.
  const plankOf = /^plank-(\d+)$/.exec(item ?? '');
  if (plankOf) {
    const n = Number(plankOf[1]);
    const u = 1 / (look.scale ?? (child ? 0.6 : 0.66)); // one half block in the units of this figure
    for (let i = 0; i < n; i++) {
      const z = (i - n / 2 + 0.5) * u + u * 0.6;
      parts.push(P(`plank${i}`, [u * 1.2, u * 0.5, u], PLANK_TONES[i % 2], [bodyW / 2 + 0.1, shoulder + 0.5, z]));
      parts.push(P(`plankDot${i}`, [u * 0.35, 0.04, u * 0.35], 'vermilion', [bodyW / 2 + 0.1, shoulder + 0.5 + u * 0.26, z], { mark: true }));
    }
  }
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

// A chicken: legs that swing, wings that flap when it runs, and a head that pecks.
export function chicken(look = {}) {
  const c = look.color ?? 'diep';
  const parts = [
    P('legL', [0.25, 0.8, 0.25], 'yellow', [-0.3, 0.8, 0], { pivotTop: true }),
    P('legR', [0.25, 0.8, 0.25], 'yellow', [0.3, 0.8, 0], { pivotTop: true }),
    P('trunk', [1.1, 0.9, 1.4], c, [0, 1.2, 0]),
    P('tailF', [0.7, 0.8, 0.4], c === 'diep' ? 'ashLight' : 'wood', [0, 1.6, -0.7]),
    P('wingL', [0.2, 0.6, 1], c, [-0.62, 1.3, 0], { pivotTop: true }),
    P('wingR', [0.2, 0.6, 1], c, [0.62, 1.3, 0], { pivotTop: true }),
    P('head', [0.01, 0.01, 0.01], null, [0, 1.8, 0.6]),
    P('skull', [0.6, 0.7, 0.6], c, [0, 0.1, 0], { parent: 'head' }),
    P('comb', [0.15, 0.3, 0.4], 'vermilion', [0, 0.55, 0], { parent: 'head' }),
    P('beak', [0.25, 0.2, 0.3], 'yellow', [0, 0, 0.4], { parent: 'head' }),
  ];
  for (const ex of [-0.31, 0.31]) parts.push(P(`eye${ex > 0 ? 'R' : 'L'}`, [0.05, 0.14, 0.14], 'ink', [ex, 0.15, 0.12], { parent: 'head', mark: true }));
  return { kind: 'fowl', parts, scale: 0.7, height: 2.4, shadow: 0.8 };
}

// A fish at the ford: a body and a tail that wiggles, under the water.
export function fish() {
  const parts = [
    P('trunk', [0.4, 0.5, 1.2], 'ash', [0, 0, 0]),
    P('tail', [0.1, 0.5, 0.5], 'ashLight', [0, 0, -0.75]),
    P('fin', [0.08, 0.25, 0.4], 'ashLight', [0, 0.35, 0]),
  ];
  return { kind: 'fish', parts, scale: 0.8, height: 0.5, shadow: 0 };
}

// A buffalo of another family: like Nghé, but grown up and darker.
export function buffalo() {
  const calf = nghe();
  const parts = calf.parts.map((p) => ({ ...p, color: p.color === 'ashLight' ? 'ash' : p.color === 'ash' ? 'ink' : p.color }));
  return { ...calf, parts, scale: 0.85, height: 4.2 };
}

// A dog of the village: like a small buffalo calf with no horns, ochre, with a tail up.
export function dog() {
  const parts = [P('trunk', [1.2, 1.1, 2.4], 'ochre', [0, 1.9, 0])];
  const legs = [['legFL', -0.4, 0.8], ['legFR', 0.4, 0.8], ['legBL', -0.4, -0.8], ['legBR', 0.4, -0.8]];
  for (const [name, x, z] of legs) parts.push(P(name, [0.4, 1.4, 0.4], 'wood', [x, 1.4, z], { pivotTop: true }));
  parts.push(P('head', [0.01, 0.01, 0.01], null, [0, 2.4, 1.2]));
  parts.push(P('skull', [1, 0.9, 1], 'ochre', [0, 0.1, 0.4], { parent: 'head' }));
  parts.push(P('muzzle', [0.6, 0.5, 0.6], 'yellowPale', [0, -0.15, 1.1], { parent: 'head' }));
  parts.push(P('earL', [0.25, 0.5, 0.3], 'wood', [-0.4, 0.7, 0.2], { parent: 'head' }));
  parts.push(P('earR', [0.25, 0.5, 0.3], 'wood', [0.4, 0.7, 0.2], { parent: 'head' }));
  for (const ex of [-0.3, 0.3]) parts.push(P(`eye${ex > 0 ? 'R' : 'L'}`, [0.14, 0.16, 0.05], 'ink', [ex, 0.25, 0.92], { parent: 'head', mark: true }));
  parts.push(P('tail', [0.2, 1, 0.2], 'wood', [0, 2.4, -1.2], { pivotTop: true }));
  return { kind: 'quadruped', parts, scale: 0.55, height: 3.2, shadow: 1.2 };
}

// A clay pot of the yard, and the pieces of a broken pot.
export function pot(broken = false) {
  if (broken) {
    return {
      kind: 'still',
      parts: [
        P('shard1', [0.9, 0.4, 0.7], 'vermilionPale', [-0.5, 0.2, 0.2]),
        P('shard2', [0.7, 0.3, 0.8], 'vermilionPale', [0.5, 0.15, -0.3]),
        P('shard3', [0.5, 0.5, 0.5], 'ochre', [0.1, 0.25, 0.6]),
      ],
      scale: 0.9,
      height: 0.6,
      shadow: 0,
    };
  }
  return {
    kind: 'still',
    parts: [
      P('trunk', [1.8, 1.6, 1.8], 'vermilionPale', [0, 1, 0]),
      P('foot', [1.2, 0.3, 1.2], 'ochre', [0, 0.15, 0]),
      P('neck', [1.1, 0.4, 1.1], 'vermilionPale', [0, 2, 0]),
      P('rim', [1.4, 0.2, 1.4], 'ochre', [0, 2.25, 0]),
    ],
    scale: 0.9,
    height: 2.4,
    shadow: 0.9,
  };
}

// A tuft of tall grass: three blades that bend away from the hero.
export function grass() {
  const parts = [];
  for (let b = 0; b < 3; b++) parts.push(P(`blade${b}`, [0.28, 2 + (b % 2) * 0.6, 0.28], b === 1 ? 'green' : 'greenDeep', [(b - 1) * 0.36, (2 + (b % 2) * 0.6) / 2, (b - 1) * 0.12]));
  return { kind: 'still', parts, scale: 0.9, height: 2.6, shadow: 0 };
}

// The owl in the banyan at night.
export function owl() {
  const parts = [
    P('trunk', [1.4, 1.8, 1.2], 'ash', [0, 0.9, 0]),
    P('belly', [1, 1.2, 0.1], 'ashLight', [0, 0.8, 0.62]),
    P('head', [0.01, 0.01, 0.01], null, [0, 2.1, 0]),
    P('skull', [1.3, 1, 1.1], 'ash', [0, 0, 0], { parent: 'head' }),
    P('earL', [0.3, 0.4, 0.3], 'ash', [-0.45, 0.6, 0], { parent: 'head' }),
    P('earR', [0.3, 0.4, 0.3], 'ash', [0.45, 0.6, 0], { parent: 'head' }),
    P('eyeL', [0.35, 0.35, 0.05], 'yellow', [-0.3, 0.05, 0.57], { parent: 'head', mark: true }),
    P('eyeR', [0.35, 0.35, 0.05], 'yellow', [0.3, 0.05, 0.57], { parent: 'head', mark: true }),
  ];
  return { kind: 'still', parts, scale: 0.8, height: 2.8, shadow: 0 };
}

// A small bird of the dusk: a body and two wings that beat.
export function bird() {
  const parts = [
    P('trunk', [0.5, 0.4, 1], 'ink', [0, 0, 0]),
    P('wingL', [1, 0.1, 0.5], 'ink', [-0.25, 0.1, 0], { pivotTop: false }),
    P('wingR', [1, 0.1, 0.5], 'ink', [0.25, 0.1, 0], { pivotTop: false }),
  ];
  parts[1].at = [-0.7, 0.1, 0];
  parts[2].at = [0.7, 0.1, 0];
  return { kind: 'flyer', parts, scale: 0.7, height: 0.5, shadow: 0 };
}

// The lantern of a house: dark by day; at night, when the family is in, the lamp is lit and the
// door is dark. The figure stands at the door.
export function lantern(lit = false) {
  const parts = [
    P('hook', [0.15, 0.8, 0.15], 'wood', [1.6, 2.8, 0.2]),
    P('lamp', [0.8, 1, 0.8], lit ? 'yellowPale' : 'vermilion', [1.6, 2, 0.2]),
    P('cap', [1, 0.2, 1], 'wood', [1.6, 2.6, 0.2]),
  ];
  if (lit) parts.push(P('door', [1.9, 2.9, 0.1], 'ink', [0, 1.45, 0.08]));
  return { kind: 'still', parts, scale: 1, height: 3, shadow: 0 };
}

// A wooden cart with two wheels and two shafts. The shafts point to the front (+z).
export function cart() {
  const parts = [
    P('bed', [3, 0.4, 4], 'wood', [0, 1.9, 0]),
    P('sideL', [0.3, 0.9, 4], 'ochre', [-1.35, 2.5, 0]),
    P('sideR', [0.3, 0.9, 4], 'ochre', [1.35, 2.5, 0]),
    P('back', [3, 0.9, 0.3], 'ochre', [0, 2.5, -1.85]),
    P('load', [2.2, 0.8, 2.6], 'yellow', [0, 2.5, -0.3]),
    P('wheelL', [0.4, 2.2, 2.2], 'wood', [-1.75, 1.1, 0]),
    P('wheelR', [0.4, 2.2, 2.2], 'wood', [1.75, 1.1, 0]),
    P('hubL', [0.5, 0.6, 0.6], 'ink', [-1.8, 1.1, 0]),
    P('hubR', [0.5, 0.6, 0.6], 'ink', [1.8, 1.1, 0]),
    P('shaftL', [0.25, 0.25, 3], 'wood', [-0.9, 1.9, 3.3]),
    P('shaftR', [0.25, 0.25, 3], 'wood', [0.9, 1.9, 3.3]),
  ];
  return { kind: 'still', parts, scale: 0.7, height: 3, shadow: 1.8 };
}

// A new plank for the bridge, n units long (one unit is one half block). The units are pale and
// ochre in turn, with a red dot painted on each, so that the child sees the length and can count
// it. The plank lies along +z from its position; its top is at 0.8.
export const PLANK_TONES = Object.freeze(['yellowPale', 'ochre']);
export function plank(n) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    parts.push(P(`unit${i}`, [2, 0.8, 1], PLANK_TONES[i % 2], [0, 0.4, i + 0.5]));
    parts.push(P(`dot${i}`, [0.45, 0.04, 0.45], 'vermilion', [0, 0.82, i + 0.5], { mark: true }));
  }
  return { kind: 'still', parts, scale: 1, height: 0.8, shadow: 0 };
}

// A part of the deck of the bridge, n units long and w units wide: boards across, dark and
// ochre in turn, as the deck of the map, on two beams. It lies along +z from its position; its
// top is at 1.
export function deck(n, w = 8) {
  const parts = [];
  for (let i = 0; i < n; i++) parts.push(P(`board${i}`, [w, 1, 1], i % 2 ? 'wood' : 'ochre', [0, 0.5, i + 0.5]));
  // Two beams under the boards, near the sides.
  for (const s of [-1, 1]) parts.push(P(`beam${s}`, [0.6, 0.6, n], 'wood', [s * (w / 2 - 0.8), -0.3, n / 2]));
  return { kind: 'still', parts, scale: 1, height: 1, shadow: 0 };
}

// The outline of a plank for the prediction (a frame of four thin bars, 2 by 4 units), or the same
// plank filled with pale wood when the child chose it. It shows no numeral.
export function plankGhost(on = false) {
  const parts = on
    ? [0, 1, 2, 3].map((i) => P(`unit${i}`, [2, 0.5, 1], 'yellowPale', [0, 0.25, i + 0.5]))
    : [
      P('sideL', [0.25, 0.3, 4], 'diep', [-0.9, 0.15, 2]),
      P('sideR', [0.25, 0.3, 4], 'diep', [0.9, 0.15, 2]),
      P('endN', [2, 0.3, 0.25], 'diep', [0, 0.15, 0.12]),
      P('endS', [2, 0.3, 0.25], 'diep', [0, 0.15, 3.88]),
    ];
  return { kind: 'still', parts, scale: 1, height: 0.5, shadow: 0 };
}

// The marks of the empty part of a gap after a fall: n red frames of one unit each (the red of
// the dots on the planks), over the water at the height of the deck, so that the child sees how
// many units were missing.
export function gapMarks(n) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    parts.push(P(`l${i}`, [0.25, 0.3, 0.8], 'vermilion', [-0.8, 0, i + 0.5]));
    parts.push(P(`r${i}`, [0.25, 0.3, 0.8], 'vermilion', [0.8, 0, i + 0.5]));
    parts.push(P(`e${i}`, [1.85, 0.3, 0.25], 'vermilion', [0, 0, i + 0.88]));
  }
  return { kind: 'still', parts, scale: 1, height: 0.2, shadow: 0 };
}

// The things of the Five Trials (src/core/world/systems/work.js). Plain things with flat colors
// (rule 9 of the design: the content object is plain; the village is rich). Units: half blocks.
const still = (parts, height, shadow = 0) => ({ kind: 'still', parts, scale: 1, height, shadow });
const HERBS = { ngai: ['greenPale', 'ashLight'], tiato: ['vermilionPale', 'greenDeep'], rauma: ['green', 'greenPale'] };
const IRON = ['ash', 'vermilionPale', 'vermilion', 'yellowPale'];
export function workThing(look) {
  switch (look.kind) {
    // A counting rod: a thin stick of bamboo.
    case 'rod': return still([P('stick', [0.22, 0.22, 1.2], 'yellow', [0, 0.11, 0]), P('endA', [0.22, 0.22, 0.12], 'ochre', [0, 0.11, 0.66]), P('endB', [0.22, 0.22, 0.12], 'ochre', [0, 0.11, -0.66])], 0.25);
    // Ten rods tied with a red band.
    case 'rod-bundle': return still([P('rods', [0.8, 0.8, 1.5], 'yellow', [0, 0.4, 0]), P('ends', [0.7, 0.7, 1.52], 'ochre', [0, 0.4, 0]), P('band', [0.9, 0.9, 0.3], 'vermilion', [0, 0.4, 0])], 0.9);
    // A reed mat on the ground.
    case 'mat': return still([P('mat', [4.4, 0.08, 2.6], 'yellowPale', [2, 0.04, 1.2]), P('edgeN', [4.4, 0.1, 0.2], 'ochre', [2, 0.05, -0.05]), P('edgeS', [4.4, 0.1, 0.2], 'ochre', [2, 0.05, 2.45])], 0.1);
    // A coil of straw rope.
    case 'band': return still([P('coil', [0.9, 0.3, 0.9], 'ochre', [0, 0.15, 0]), P('hole', [0.4, 0.32, 0.4], 'wood', [0, 0.16, 0]), P('end', [0.2, 0.2, 0.6], 'ochre', [0.5, 0.1, 0.4])], 0.35);
    // A lump of iron ore; red hot in the forge.
    case 'ore': return still([P('lump', [0.8, 0.55, 0.7], look.hot ? 'vermilion' : 'ash', [0, 0.28, 0]), P('grain', [0.4, 0.3, 0.4], look.hot ? 'yellow' : 'ink', [0.15, 0.5, 0.1]), P('chip', [0.3, 0.25, 0.3], look.hot ? 'vermilionPale' : 'ashLight', [-0.3, 0.15, -0.2])], 0.7);
    // A wooden bucket of water.
    case 'bucket': return still([P('pail', [0.9, 0.9, 0.9], 'wood', [0, 0.45, 0]), P('water', [0.7, 0.05, 0.7], 'indigoPale', [0, 0.9, 0]), P('handle', [0.1, 0.5, 0.9], 'ink', [0, 1.1, 0])], 1.2);
    // A wooden trough, empty or with water.
    case 'trough': {
      const parts = [P('floor', [3.2, 0.3, 1.6], 'wood', [1.6, 0.15, 1]), P('sideN', [3.2, 0.9, 0.3], 'ochre', [1.6, 0.45, 0.2]), P('sideS', [3.2, 0.9, 0.3], 'ochre', [1.6, 0.45, 1.8]), P('endW', [0.3, 0.9, 1.6], 'ochre', [0, 0.45, 1]), P('endE', [0.3, 0.9, 1.6], 'ochre', [3.2, 0.45, 1])];
      if (look.full) parts.push(P('water', [2.8, 0.05, 1.2], 'indigoPale', [1.6, 0.8, 1]));
      return still(parts, 1);
    }
    // The iron bar on the anvil: dark, red, bright red, and white hot; bent; or a hard blade.
    case 'iron': {
      const anvil = [P('anvil', [1.4, 1, 1.2], 'ink', [0, -0.5, 0]), P('horn', [0.6, 0.3, 0.5], 'ink', [0, -0.15, 0.8])];
      if (look.bent) return still([...anvil, P('barA', [0.4, 0.3, 1.1], 'ash', [0, 0.15, -0.3]), P('barB', [0.4, 0.3, 1.1], 'ash', [0.35, 0.35, 0.6])], 0.6);
      if (look.blade) return still([...anvil, P('blade', [0.5, 0.2, 2.2], 'ashLight', [0, 0.1, 0]), P('grip', [0.35, 0.3, 0.6], 'wood', [0, 0.15, -1.3])], 0.4);
      return still([...anvil, P('bar', [0.4, 0.3, 2], IRON[Math.max(0, Math.min(3, look.glow ?? 0))], [0, 0.15, 0])], 0.4);
    }
    // A stake of the fish trap, half in the water.
    case 'stake': return still([P('pole', [0.55, 4, 0.55], look.set ? 'wood' : 'ochre', [0, 1.2, 0]), P('top', [0.6, 0.2, 0.6], 'yellowPale', [0, 3.25, 0]), P('tie', [0.62, 0.2, 0.62], 'ink', [0, 2.4, 0])], 3.3);
    // The red float at the end of the line of the trap.
    case 'float': return still([P('buoy', [0.8, 0.6, 0.8], 'vermilion', [0, 0.1, 0]), P('flag', [0.12, 1.4, 0.12], 'wood', [0, 0.9, 0]), P('cloth', [0.1, 0.5, 0.6], 'vermilion', [0, 1.4, 0.3])], 1.7);
    // The water of the tide over the line of the trap (n: how high).
    case 'tide': {
      const n = look.n ?? 0;
      const h = 0.08 + n * 0.5;
      return still([P('water', [20, h, 3], n ? 'indigoPale' : 'indigo', [10, h / 2, 0]), P('lineN', [20, h + 0.02, 0.15], 'indigo', [10, h / 2, -1.5]), P('lineS', [20, h + 0.02, 0.15], 'indigo', [10, h / 2, 1.5])], h);
    }
    // Fish in the trap, or fish that swim out through a space.
    case 'fish-trap': {
      const parts = [];
      for (let i = 0; i < 3; i++) parts.push(P(`fish${i}`, [0.4, 0.3, 1], 'ash', [(i - 1) * 1.2, 0.1, look.in ? 0.4 * i : -1 - i]), P(`tail${i}`, [0.4, 0.3, 0.3], 'ashLight', [(i - 1) * 1.2, 0.1, (look.in ? 0.4 * i : -1 - i) - 0.6]));
      return still(parts, 0.3);
    }
    // A bunch of healing leaves: mugwort (grey-green), perilla (red and green), pennywort (round, green).
    case 'herb': {
      const [a, b] = HERBS[look.herb] ?? HERBS.ngai;
      return still([P('stem', [0.2, 0.6, 0.2], 'greenDeep', [0, 0.3, 0]), P('leaves', [0.8, 0.4, 0.8], a, [0, 0.7, 0]), P('tip', [0.45, 0.3, 0.45], b, [0, 1, 0])], 1.1);
    }
    // The basket of the healer, with three parts; full when the healer takes it.
    case 'basket': {
      const parts = [P('floor', [3.4, 0.2, 1.4], 'ochre', [1.7, 0.1, 0.6]), P('wallN', [3.4, 0.7, 0.2], 'ochre', [1.7, 0.35, 0]), P('wallS', [3.4, 0.7, 0.2], 'ochre', [1.7, 0.35, 1.3]), P('wallW', [0.2, 0.7, 1.4], 'ochre', [0, 0.35, 0.6]), P('wallE', [0.2, 0.7, 1.4], 'ochre', [3.4, 0.35, 0.6]), P('div1', [0.15, 0.6, 1.2], 'wood', [1.15, 0.3, 0.6]), P('div2', [0.15, 0.6, 1.2], 'wood', [2.25, 0.3, 0.6])];
      if (look.full) parts.push(P('leaves', [3, 0.4, 1.1], 'green', [1.7, 0.7, 0.6]));
      return still(parts, 0.9);
    }
    // A fallen bamboo stem, n half blocks long, along +z, with a node at each unit.
    case 'stem': {
      const parts = [];
      // A fallen stem dries yellow, so that it stands out on the grass.
      for (let i = 0; i < look.n; i++) parts.push(P(`seg${i}`, [1, 1, 1], i % 2 ? 'yellow' : 'yellowPale', [0, 0.5, i + 0.5]), P(`node${i}`, [1.1, 1.1, 0.14], 'ochre', [0, 0.5, i + 1]));
      return still(parts, 0.8);
    }
    // A chalk mark across the stem.
    case 'chalk': return still([P('mark', [1.3, 0.08, 0.25], 'vermilion', [0, 0.45, 0]), P('dotA', [0.25, 0.4, 0.25], 'vermilion', [-0.65, 0.25, 0]), P('dotB', [0.25, 0.4, 0.25], 'vermilion', [0.65, 0.25, 0])], 0.5);
    // Equal bamboo sticks tied into a bundle.
    case 'sticks': {
      const parts = [];
      for (let i = 0; i < look.n; i++) parts.push(P(`stick${i}`, [0.45, 0.45, 2.4], 'green', [(i - (look.n - 1) / 2) * 0.5, 0.25 + (i % 2) * 0.1, 0]));
      parts.push(P('band', [look.n * 0.5 + 0.2, 0.6, 0.3], 'vermilion', [0, 0.3, 0]));
      return still(parts, 0.7);
    }
    default: return null;
  }
}

// The things of a raid (src/core/world/systems/raid.js). Units: half blocks.
export function raidThing(look) {
  switch (look.kind) {
    // A stone of the slingshot.
    case 'stone': return still([P('stone', [0.5, 0.45, 0.5], 'ash', [0, 0.22, 0]), P('top', [0.3, 0.12, 0.3], 'ashLight', [0.05, 0.47, 0.05]), P('chip', [0.2, 0.2, 0.2], 'ink', [-0.2, 0.15, 0.15])], 0.5);
    // A torch in the air.
    case 'torch': return still([P('stick', [0.25, 0.25, 1.4], 'wood', [0, 0.2, 0]), P('flame', [0.7, 0.7, 0.7], 'vermilion', [0, 0.3, 0.8]), P('core', [0.4, 0.4, 0.4], 'yellow', [0, 0.35, 0.95])], 0.8);
    // A torch that burns on the road.
    case 'fire': return still([P('stick', [0.25, 0.25, 1.4], 'wood', [0, 0.12, 0]), P('flame', [1, 1.2, 1], 'vermilion', [0, 0.7, 0.2]), P('core', [0.5, 0.8, 0.5], 'yellow', [0, 0.8, 0.2])], 1.4);
    // Wet ground: a flat pool of water.
    case 'puddle': {
      const r = look.r ?? 3;
      return still([P('a', [r * 2, 0.06, r * 1.2], 'indigoPale', [0, 0.03, 0], { mark: true }), P('b', [r * 1.2, 0.06, r * 2], 'indigoPale', [0, 0.03, 0], { mark: true }), P('shine', [r * 0.6, 0.08, r * 0.3], 'diep', [r * 0.2, 0.04, -r * 0.3], { mark: true })], 0.1);
    }
    // A distance post by the road: its count as bands, no numeral.
    case 'post': {
      const n = look.n ?? 1;
      const parts = [P('pole', [0.6, 4.5, 0.6], 'wood', [0, 2.25, 0]), P('cap', [0.8, 0.3, 0.8], 'ink', [0, 4.6, 0])];
      for (let i = 0; i < n; i++) parts.push(P(`band${i}`, [0.7, 0.35, 0.7], 'vermilion', [0, 3.9 - i * 0.6, 0]));
      return still(parts, 4.8);
    }
    // A bamboo trap on the road: a frame with a spring; closed after it snaps.
    case 'trap': {
      if (look.sprung) return still([P('frame', [1.4, 0.3, 1.4], 'ochre', [0, 0.15, 0]), P('jawA', [1.4, 0.7, 0.2], 'yellow', [0, 0.4, -0.1]), P('jawB', [1.4, 0.7, 0.2], 'yellow', [0, 0.4, 0.1])], 0.8);
      return still([P('frame', [1.4, 0.2, 1.4], 'ochre', [0, 0.1, 0]), P('jawA', [1.4, 0.2, 0.2], 'yellow', [0, 0.25, -0.6]), P('jawB', [1.4, 0.2, 0.2], 'yellow', [0, 0.25, 0.6]), P('spring', [0.25, 0.4, 0.25], 'vermilion', [0, 0.3, 0])], 0.5);
    }
    // The bar of the gate: up by the gate, or down across the way.
    case 'bar': {
      const posts = [P('postA', [0.6, 3.4, 0.6], 'wood', [0, 1.7, -2.4]), P('postB', [0.6, 3.4, 0.6], 'wood', [0, 1.7, 2.4])];
      if (look.down) return still([...posts, P('bar', [0.7, 0.7, 5.6], 'yellow', [0, 2, 0]), P('tie', [0.8, 0.8, 0.3], 'vermilion', [0, 2, 0])], 3.4);
      return still([...posts, P('bar', [0.7, 5.6, 0.7], 'yellow', [0, 2.8, -1.8]), P('tie', [0.8, 0.3, 0.8], 'vermilion', [0, 2, -1.8])], 5.6);
    }
    // A spot for a villager: a small straw flag.
    case 'spot': return still([P('pole', [0.2, 2.6, 0.2], 'wood', [0, 1.3, 0]), P('flag', [0.1, 0.8, 1.1], 'yellowPale', [0, 2.2, 0.55]), P('base', [0.8, 0.15, 0.8], 'ochre', [0, 0.07, 0])], 2.6);
    // A jar of water, a brazier of fire, and the small forge (lightning).
    case 'jar': return still([P('body', [1.4, 1.5, 1.4], 'ochre', [0, 0.75, 0]), P('neck', [0.9, 0.3, 0.9], 'wood', [0, 1.6, 0]), P('water', [0.7, 0.05, 0.7], 'indigoPale', [0, 1.76, 0])], 1.8);
    case 'brazier': return still([P('bowl', [1.4, 0.6, 1.4], 'ink', [0, 0.9, 0]), P('leg', [0.3, 0.7, 0.3], 'ink', [0, 0.35, 0]), P('flame', [0.9, 0.9, 0.9], 'vermilion', [0, 1.6, 0]), P('core', [0.5, 0.6, 0.5], 'yellow', [0, 1.7, 0])], 2.1);
    case 'forge': return still([P('base', [2, 1.2, 1.6], 'ash', [0, 0.6, 0]), P('mouth', [0.8, 0.5, 0.1], 'vermilion', [0, 0.7, 0.8]), P('rod', [0.2, 3, 0.2], 'ink', [0.6, 2.7, 0]), P('tip', [0.5, 0.3, 0.5], 'yellow', [0.6, 4.2, 0])], 4.4);
    // The bamboo that Gióng pulls up: a clump, or the pulled stem that lies on the ground.
    case 'bamboo': {
      if (look.pulled) return still([P('hole', [1.6, 0.1, 1.6], 'wood', [0, 0.05, 0]), P('stem', [0.6, 0.6, 7], 'green', [0, 0.3, 3.5]), P('leaves', [1.4, 0.6, 1.6], 'greenPale', [0, 0.4, 7.2])], 0.7);
      const parts = [];
      for (let i = 0; i < 3; i++) parts.push(P(`stem${i}`, [0.5, 7 + i, 0.5], i === 1 ? 'green' : 'greenDeep', [(i - 1) * 0.6, (7 + i) / 2, (i % 2) * 0.4]));
      parts.push(P('leaves', [2.4, 1.2, 2.4], 'greenPale', [0, 8, 0.2]));
      return still(parts, 8.6);
    }
    default: return null;
  }
}

// The figure of a look from data/figures.json.
export function figureOf(look) {
  const thing = workThing(look) ?? raidThing(look);
  if (thing) return thing;
  if (look.kind === 'plank') return plank(look.n);
  if (look.kind === 'plank-ghost') return plankGhost(Boolean(look.on));
  if (look.kind === 'gap') return gapMarks(look.n);
  if (look.kind === 'deck') return deck(look.n, look.w);
  if (look.kind === 'nghe') return nghe();
  if (look.kind === 'duck') return duck();
  if (look.kind === 'serpent') return serpent();
  if (look.kind === 'chicken') return chicken(look);
  if (look.kind === 'fish') return fish();
  if (look.kind === 'buffalo') return buffalo();
  if (look.kind === 'dog') return dog();
  if (look.kind === 'pot') return pot(Boolean(look.broken));
  if (look.kind === 'grass') return grass();
  if (look.kind === 'owl') return owl();
  if (look.kind === 'cart') return cart();
  if (look.kind === 'bird') return bird();
  if (look.kind === 'lantern') return lantern(Boolean(look.lit));
  return person(look);
}
