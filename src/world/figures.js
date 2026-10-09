// Characters made of parts (head, body, arms, legs) that rotate. Pure data, no WebGL: the
// renderer makes one box for each part (the parts: src/world/parts.js). Units: the figure before
// `scale`, on its `grid` (in blocks); the front of a figure is +z. This file has the coarse
// figures (a grid of half blocks), which the renderer also draws for the people and animals far
// from the hero; the fine people and animals (a grid of quarter blocks) are in src/world/fine.js.
import { P, PLANK_TONES, heldItem, TOOLS } from './parts.js';
import { carriedParts } from './carry.js';
import { BASKET_FLOOR } from '../core/world/zones.js';
import { personFine, ngheFine, buffaloFine, dogFine, chickenFine, duckFine, fishFine, coatOf, hairStyleOf, TALL } from './fine.js';

export { PLANK_TONES };

// The look of the hero from the hero of the profile. options: the choices of hero creation
// (hero in data/figures.json); the profile keeps the number of each choice (1 is the first).
export function heroLook(hero, options) {
  const pick = (list, n) => list[(n ?? 1) - 1] ?? list[0];
  const c = pick(options.clothes, hero.clothes);
  const g = options.genders[hero.gender] ?? Object.values(options.genders)[0];
  return {
    child: true,
    skin: pick(options.skins, hero.skin ?? hero.face ?? 2),
    top: c.top,
    bottom: c.bottom,
    sash: c.sash,
    bottomKind: g.bottomKind,
    topKind: g.topKind,
    hair: pick(options.hairs, hero.hair),
    face: pick(options.faces, hero.face),
  };
}

// A person, the far level of the fine person (src/world/fine.js): the same proportions (a large
// head with a flat face, a short neck in shadow, a body with depth) and the outline of each hair
// style (long hair, braids, a topknot, a bun, the tuft of a child). look: { child, skin, top,
// bottom, sash, bottomKind (shorts, skirt, trousers, robe), topKind (shirt, yem, bare), hair,
// hairStyle, hairColor, beard, hat (non, band, helmet, plume), item, face, scale }.
export function person(look) {
  const child = Boolean(look.child);
  const skin = look.skin ?? 'skin2';
  const hairColor = look.hairColor ?? 'ink';
  const legH = child ? 2.1 : 2.6;
  const bodyH = child ? 2 : 2.4;
  const bodyW = child ? 2.2 : 2.3;
  const bodyD = child ? 1.5 : 1.6;
  const hip = legH;
  const shoulder = hip + bodyH + 0.1;
  const headW = child ? 2.7 : 2.5;
  const headH = child ? 2.4 : 2.5;
  const headD = 2.5;
  const headY = shoulder + headH / 2 + 0.35;
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
    parts.push(P('skirt', [bodyW, h, bodyD + 0.4], look.bottom, [0, hip - h / 2 + (look.bottomKind === 'robe' ? bodyH * 0.6 : 0) + 0.1, 0]));
  }
  // The body, and a short neck in the next darker tone of the skin.
  const topColor = look.topKind === 'bare' ? skin : look.top;
  parts.push(P('torso', [bodyW, bodyH, bodyD], topColor, [0, hip + bodyH / 2, 0]));
  if (look.topKind === 'yem') parts.push(P('yem', [1.4, 1.4, 0.2], look.sash ?? 'vermilion', [0, hip + bodyH * 0.55, bodyD / 2 + 0.07]));
  if (look.sash) parts.push(P('sash', [bodyW + 0.1, 0.45, bodyD + 0.1], look.sash, [0, hip + 0.2, 0]));
  parts.push(P('neck', [0.8, 0.5, 0.8], SHADE[skin] ?? skin, [0, shoulder + 0.2, -0.1]));
  // Arms hang from the shoulders.
  const armH = child ? 1.9 : 2.3;
  const armSkin = look.topKind === 'robe' ? look.top : skin;
  parts.push(P('armL', [0.75, armH, 0.75], armSkin, [-(bodyW / 2 + 0.4), shoulder, 0], { pivotTop: true }));
  parts.push(P('armR', [0.75, armH, 0.75], armSkin, [bodyW / 2 + 0.4, shoulder, 0], { pivotTop: true }));
  if (look.topKind === 'shirt') {
    parts.push(P('sleeveL', [0.85, 0.8, 0.85], look.top, [0, 0, 0], { parent: 'armL', pivotTop: true }));
    parts.push(P('sleeveR', [0.85, 0.8, 0.85], look.top, [0, 0, 0], { parent: 'armR', pivotTop: true }));
  }
  // The head, with hair, a hat, and a face.
  const onHead = { parent: 'head' };
  parts.push(P('head', [0.01, 0.01, 0.01], null, [0, headY, 0]));
  parts.push(P('skull', [headW, headH, headD], skin, [0, 0, 0], onHead));
  const hair = look.hair ?? 'short';
  const style = hairStyleOf(look);
  const covered = look.hat === 'non' || look.hat === 'helmet' || look.hat === 'plume';
  const capTop = headH / 2 + 0.3;
  if (hair !== 'bald') {
    const hc = hair === 'grey' ? 'ashLight' : hairColor;
    const H = (n, size, at) => parts.push(P(n, size, hc, at, onHead));
    H('hair', [headW + 0.15, 0.6, headD + 0.15], [0, headH / 2, 0]);
    H('hairBack', [headW + 0.15, headH * 0.8, 0.4], [0, 0.1, -headD / 2 - 0.05]);
    if (style === 'short') H('fringe', [headW * 0.8, 0.4, 0.2], [0.15, headH / 2 - 0.4, headD / 2 + 0.05]);
    if (style === 'topknot' && !covered) {
      H('knot', [0.9, 0.9, 0.9], [0, capTop + 0.45, -0.1]);
      parts.push(P('knotTie', [0.95, 0.2, 0.95], 'vermilion', [0, capTop + 0.05, -0.1], onHead));
    }
    if (style === 'long' || style === 'braids') {
      H('curtainL', [0.35, 1.7, 1], [-headW / 2 - 0.1, -0.1, 0.6]);
      H('curtainR', [0.35, 1.7, 1], [headW / 2 + 0.1, -0.1, 0.6]);
    }
    if (style === 'long') H('tail', [headW + 0.1, 2.2, 0.45], [0, -1.3, -headD / 2 - 0.15]);
    if (style === 'braids') {
      for (const s of [-1, 1]) {
        H(`braid${s}`, [0.45, 1.8, 0.45], [s * (headW / 2 - 0.1), -1.4, 0.55]);
        parts.push(P(`braidTie${s}`, [0.5, 0.2, 0.5], 'vermilion', [s * (headW / 2 - 0.1), -2.2, 0.55], onHead));
      }
    }
    if (style === 'bun') H('knot', [1.1, 1, 0.9], [0, -0.1, -headD / 2 - 0.5]);
    if (style === 'tufts' && !covered) H('tuft', [0.7, 0.7, 0.7], [0, capTop + 0.3, 0.5]);
  }
  if (look.beard) parts.push(P('beard', [1.1, 0.9, 0.4], look.beard === true ? 'ashLight' : look.beard, [0, -headH / 2 - 0.2, headD / 2 - 0.1], onHead));
  if (look.hat === 'non') parts.push(P('hat', [3.6, 0.4, 3.6], 'yellowPale', [0, capTop - 0.15, 0], onHead), P('hatTop', [1.4, 0.4, 1.4], 'yellowPale', [0, capTop + 0.2, 0], onHead));
  if (look.hat === 'band') parts.push(P('band', [headW + 0.2, 0.3, headD + 0.2], look.sash ?? 'vermilion', [0, 0.4, 0], onHead));
  if (look.hat === 'helmet' || look.hat === 'plume') {
    parts.push(P('helmet', [headW + 0.35, 1.1, headD + 0.35], 'ash', [0, headH / 2, 0], onHead));
    if (look.hat === 'plume') parts.push(P('plume', [0.4, 1.2, 1.2], 'vermilion', [0, headH / 2 + 1.15, -0.2], onHead));
  }
  // A child has the eyes lower on the head and larger.
  const eyeY = child ? (look.face === 3 ? -0.15 : -0.3) : look.face === 3 ? 0.2 : 0.05;
  const eye = child ? [0.32, 0.4] : [0.26, 0.32];
  for (const ex of [-0.5, 0.5]) parts.push(P(`eye${ex > 0 ? 'R' : 'L'}`, [eye[0], eye[1], 0.05], 'ink', [ex, eyeY, headD / 2 + 0.03], { ...onHead, mark: true }));
  if (look.face === 2 || look.face === 4) parts.push(P('mouth', [0.5, 0.12, 0.05], 'vermilion', [0, eyeY - 0.55, headD / 2 + 0.03], { ...onHead, mark: true }));
  // The size: the same height as the fine person (src/world/fine.js) to the top of the hair.
  const scale = (child ? TALL.child : TALL.adult) / (0.5 * (headY + capTop)) * (look.scale ? look.scale / (child ? 0.6 : 0.66) : 1);
  // A thing in the hands (src/world/carry.js), or a tool of a person (a staff, a net, a torch).
  const carried = carriedParts(look.carriedFigure, 1 / scale, {
    hand: { parent: 'armR', at: [0, -armH, 0.3] },
    front: { parent: 'body', at: [0, hip + bodyH * 0.25, bodyD / 2 + 0.3] },
    shoulder: { parent: 'body', at: [bodyW / 2 - 0.2, shoulder + 0.1, 0] },
    yoke: { parent: 'body', at: [bodyW / 2 + 0.2, shoulder + 0.4, 0] },
  }, look.carryRules);
  parts.push(...(carried.hold ? carried.parts : heldItem(look.item, (dx, dy, dz) => [dx, -armH + dy, dz], 1)));
  const knot = hair === 'bald' || covered ? 0 : style === 'topknot' ? 0.9 : style === 'tufts' ? 0.65 : 0;
  const top = headY + capTop + (look.hat === 'non' ? 0.4 : look.hat === 'plume' ? 1.45 : look.hat === 'helmet' ? 0.25 : knot);
  return { kind: 'biped', parts, scale, height: top, shadow: 1.3, hold: carried.hold };
}

// The next darker tone of a skin (the neck, in the shadow under the chin).
const SHADE = { skin1: 'skin2', skin2: 'skin3', skin3: 'skin4', skin4: 'wood' };

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

// A duck (coat: see coatOf in fine.js).
export function duck(coat) {
  const c = coatOf(coat);
  const parts = [
    P('trunk', [1, 0.7, 1.5], c.body, [0, 0.2, 0]),
    P('head', [0.6, 0.6, 0.6], c.head, [0, 0.8, 0.6]),
    P('beak', [0.3, 0.15, 0.4], 'yellow', [0, 0.7, 1]),
  ];
  return { kind: 'float', parts, scale: 0.6, height: 1.2, shadow: 0 };
}

// A thuồng luồng of the river: a long body of segments, a head with a fin. look: { scale, belly }:
// Sóng, the friend of the water, is a small one with a pale belly.
export function serpent(look = {}) {
  const parts = [];
  for (let i = 0; i < 5; i++) parts.push(P(`seg${i}`, [1.4 - i * 0.15, 1.2 - i * 0.12, 1.3], i % 2 ? 'indigoPale' : 'indigo', [0, 1.1, -i * 1.25]));
  if (look.belly) for (let i = 0; i < 5; i++) parts.push(P(`belly${i}`, [1.2 - i * 0.15, 0.3, 1.2], look.belly, [0, 0.55 - i * 0.06, -i * 1.25]));
  parts.push(P('head', [0.01, 0.01, 0.01], null, [0, 1.8, 1.1]));
  parts.push(P('skull', [1.6, 1.3, 1.8], 'indigo', [0, 0, 0.3], { parent: 'head' }));
  parts.push(P('fin', [0.3, 1, 1.2], 'vermilion', [0, 0.9, -0.1], { parent: 'head' }));
  for (const ex of [-0.55, 0.55]) parts.push(P(`eye${ex > 0 ? 'R' : 'L'}`, [0.25, 0.25, 0.05], 'yellow', [ex, 0.2, 1.23], { parent: 'head', mark: true }));
  return { kind: 'serpent', parts, scale: look.scale ?? 0.8, height: 3.2, shadow: 0 };
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

// The small joys (docs/WORLD.md, "The world at rest"): small things that the child finds or does
// not. A duckling walks with quick steps; the others stand still, and the systems move them.

// A duckling: a small yellow ball with a beak, on two legs.
export function duckling() {
  const parts = [
    P('legL', [0.3, 0.6, 0.3], 'ochre', [-0.3, 0.6, 0], { pivotTop: true }),
    P('legR', [0.3, 0.6, 0.3], 'ochre', [0.3, 0.6, 0], { pivotTop: true }),
    P('trunk', [1.3, 1, 1.6], 'yellowPale', [0, 1.05, 0]),
    P('tailF', [0.6, 0.5, 0.4], 'yellowPale', [0, 1.4, -0.85]),
    P('wingL', [0.2, 0.6, 1], 'yellow', [-0.7, 1.2, 0], { pivotTop: true }),
    P('wingR', [0.2, 0.6, 1], 'yellow', [0.7, 1.2, 0], { pivotTop: true }),
    P('head', [0.01, 0.01, 0.01], null, [0, 1.8, 0.6]),
    P('skull', [0.9, 0.9, 0.9], 'yellowPale', [0, 0.1, 0], { parent: 'head' }),
    P('beak', [0.5, 0.25, 0.5], 'ochre', [0, 0, 0.6], { parent: 'head' }),
  ];
  for (const ex of [-0.46, 0.46]) parts.push(P(`eye${ex > 0 ? 'R' : 'L'}`, [0.05, 0.18, 0.18], 'ink', [ex, 0.2, 0.2], { parent: 'head', mark: true }));
  return { kind: 'fowl', parts, scale: 0.45, height: 2.4, shadow: 0.6 };
}

// A frog of the river: a flat green body, two eyes on top, and the back legs folded.
export function frog() {
  const parts = [
    P('trunk', [2.2, 1, 2.6], 'green', [0, 0.5, 0]),
    P('belly', [1.8, 0.3, 2.2], 'yellowPale', [0, 0.1, 0.1]),
    P('legL', [0.7, 0.6, 1.6], 'greenDeep', [-1.2, 0.3, -0.6]),
    P('legR', [0.7, 0.6, 1.6], 'greenDeep', [1.2, 0.3, -0.6]),
  ];
  for (const ex of [-0.6, 0.6]) {
    const n = ex > 0 ? 'R' : 'L';
    parts.push(P(`bump${n}`, [0.7, 0.6, 0.7], 'green', [ex, 1.2, 0.8]));
    parts.push(P(`eye${n}`, [0.35, 0.35, 0.05], 'ink', [ex, 1.25, 1.16], { mark: true }));
  }
  return { kind: 'still', parts, scale: 0.32, height: 1.6, shadow: 0 };
}

// A lily pad on the water, with a notch and one pale bud.
export function lilyPad() {
  const parts = [
    P('pad', [6, 0.3, 4.4], 'green', [0, 0, 0]),
    P('padB', [4.4, 0.3, 6], 'green', [0, 0, 0]),
    P('notch', [0.6, 0.32, 2.4], 'greenDeep', [0, 0.01, 1.8], { mark: true }),
    P('bud', [0.8, 1, 0.8], 'vermilionPale', [1.8, 0.6, -1.4]),
  ];
  return { kind: 'still', parts, scale: 0.32, height: 0.4, shadow: 0 };
}

// A kingfisher on a stake by the ford: a blue back, a rust belly, and a long dark beak.
export function kingfisher() {
  const parts = [
    P('stake', [0.6, 4, 0.6], 'wood', [0, 2, 0]),
    P('trunk', [1.2, 1.3, 1.8], 'indigo', [0, 4.65, 0]),
    P('belly', [1, 0.9, 1.4], 'ochre', [0, 4.35, 0.25]),
    P('tail', [0.6, 0.3, 1.2], 'indigoPale', [0, 4.4, -1.3]),
    P('head', [1.1, 1, 1.1], 'indigo', [0, 5.6, 0.7]),
    P('cheek', [1.15, 0.35, 0.5], 'ochre', [0, 5.35, 0.9]),
    P('beak', [0.3, 0.3, 1.3], 'ink', [0, 5.5, 1.8]),
  ];
  for (const ex of [-0.56, 0.56]) parts.push(P(`eye${ex > 0 ? 'R' : 'L'}`, [0.05, 0.25, 0.25], 'ink', [ex, 5.7, 0.9], { mark: true }));
  return { kind: 'still', parts, scale: 0.34, height: 6.2, shadow: 0 };
}

// A golden bamboo shoot in the hedge: rings that get narrow to the tip.
export function goldenShoot() {
  const parts = [];
  const rings = [[1.6, 1.4], [1.3, 1.3], [1, 1.2], [0.7, 1], [0.4, 0.8]];
  let y = 0;
  rings.forEach(([w, h], i) => {
    parts.push(P(`ring${i}`, [w, h, w], i % 2 ? 'yellowPale' : 'yellow', [0, y + h / 2, 0]));
    y += h;
  });
  parts.push(P('sheath', [0.2, 1.2, 0.7], 'ochre', [0.75, 1, 0]));
  return { kind: 'still', parts, scale: 0.5, height: y, shadow: 0 };
}

// A piece of the board of the figures (docs/reference/figures.html): a flat round base of quarter
// blocks in wood under a figure, as a piece of a board game, with the ink outline. rx, rz: the
// radii in blocks (a long figure has an oval base; 0 for a square with no base). square: the side
// (blocks) of a square of dó paper under the base on the board (0 for none); dark: the darker paper
// of every second square.
export function pieceBase(rx, rz = rx, square = 0, dark = false) {
  const qx = Math.max(2, Math.round(rx * 4));
  const qz = Math.max(2, Math.round(rz * 4));
  const parts = [];
  if (square) parts.push(P('square', [square * 4, 0.5, square * 4], dark ? 'paperDeep' : 'paper', [0, -0.25, 0]));
  // One row of quarter blocks for each quarter along z: a stepped disc (or oval); none for a square
  // alone (rx 0).
  for (let z = -qz; z < qz && rx > 0; z++) {
    const t = (z + 0.5) / qz;
    const half = Math.round(qx * Math.sqrt(Math.max(0, 1 - t * t)));
    if (half > 0) parts.push(P(`row${z}`, [half * 2, 1, 1], 'wood', [0, 0.5, z + 0.5]));
  }
  return { kind: 'still', parts, scale: 1, grid: 0.25, height: 0.25, shadow: 0 };
}

// A puddle on the road after the rain: a flat pool of sky.
export function puddle() {
  const parts = [
    P('pool', [7, 0.12, 4.4], 'indigoPale', [0, 0.06, 0]),
    P('poolB', [5, 0.12, 6], 'indigoPale', [0.4, 0.06, 0.2]),
    P('glint', [1.6, 0.14, 0.4], 'diep', [-1.2, 0.07, -0.8], { mark: true }),
  ];
  return { kind: 'still', parts, scale: 0.3, height: 0.2, shadow: 0 };
}

// The pot of bánh chưng at Tết: a big pot on three stones over a small fire, and square cakes
// wrapped in leaves beside it.
export function banhChung() {
  const parts = [];
  for (const [i, a] of [0, 2.1, 4.2].entries()) parts.push(P(`stone${i}`, [1, 0.8, 1], 'ashLight', [Math.cos(a) * 1.4, 0.4, Math.sin(a) * 1.4]));
  parts.push(P('flame', [1.2, 0.9, 1.2], 'vermilion', [0, 0.5, 0]), P('core', [0.6, 0.6, 0.6], 'yellow', [0, 0.6, 0]));
  parts.push(P('pot', [3.4, 2.6, 3.4], 'ash', [0, 2.1, 0]), P('potB', [2.8, 2.9, 2.8], 'ash', [0, 2.1, 0]));
  parts.push(P('lid', [3, 0.3, 3], 'wood', [0, 3.55, 0]));
  for (const [i, [x, z]] of [[3, 0.6], [3, -0.9], [3.1, -0.15]].entries()) {
    const y = i === 2 ? 1.25 : 0.45;
    parts.push(P(`cake${i}`, [1.4, 0.9, 1.4], 'green', [x, y, z]));
    parts.push(P(`tie${i}`, [1.45, 0.92, 0.2], 'paperDeep', [x, y, z], { mark: true }));
  }
  return { kind: 'still', parts, scale: 0.55, height: 3.8, shadow: 1.6 };
}

// The lion of the lion dance (múa lân) at Tết: a big head with a horn and wide eyes, a body of
// cloth, and four legs in indigo trousers (two dancers).
export function lion() {
  const parts = [P('trunk', [3.2, 1.8, 6], 'yellow', [0, 4.2, -0.4])];
  for (const z of [-2.4, -0.4, 1.6]) parts.push(P(`stripe${z}`, [3.3, 1.85, 0.5], 'vermilion', [0, 4.2, z]));
  parts.push(P('fringe', [3.4, 0.4, 6], 'diep', [0, 3.2, -0.4]));
  const legs = [['legFL', -0.8, 1.8], ['legFR', 0.8, 1.8], ['legBL', -0.8, -2.6], ['legBR', 0.8, -2.6]];
  for (const [name, x, z] of legs) parts.push(P(name, [0.7, 3.2, 0.7], 'indigo', [x, 3.2, z], { pivotTop: true }));
  parts.push(P('head', [0.01, 0.01, 0.01], null, [0, 5.2, 2.8]));
  parts.push(P('skull', [3.6, 3, 2.6], 'vermilion', [0, 0.4, 0.6], { parent: 'head' }));
  parts.push(P('brow', [3.8, 0.6, 2.7], 'yellow', [0, 1.7, 0.6], { parent: 'head' }));
  parts.push(P('horn', [0.6, 1.2, 0.6], 'yellow', [0, 2.5, 1], { parent: 'head' }));
  parts.push(P('mouth', [2.6, 0.6, 0.3], 'ink', [0, -0.7, 1.95], { parent: 'head', mark: true }));
  parts.push(P('beard', [2.4, 1.2, 0.4], 'diep', [0, -1.4, 1.8], { parent: 'head' }));
  for (const ex of [-0.9, 0.9]) {
    const n = ex > 0 ? 'R' : 'L';
    parts.push(P(`eyeW${n}`, [1, 1, 0.05], 'diep', [ex, 0.8, 1.93], { parent: 'head', mark: true }));
    parts.push(P(`eye${n}`, [0.5, 0.5, 0.06], 'ink', [ex, 0.8, 1.95], { parent: 'head', mark: true }));
    parts.push(P(`ear${n}`, [0.5, 1, 0.5], 'yellow', [ex * 1.9, 1.6, 0.2], { parent: 'head' }));
  }
  parts.push(P('tail', [0.6, 2.2, 0.6], 'vermilion', [0, 4.6, -3.4], { pivotTop: true }));
  return { kind: 'quadruped', parts, scale: 0.66, height: 7.2, shadow: 2.6 };
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

// The boat of a ferry: a long dugout with a deck, a rim, and a bird-head prow (as the boats on the
// bronze drums). The ferryman stands at the stern with his pole (an entity of its own). It lies
// along +z; the deck is at 0.6 units (the riders stand there), and the hull goes under the water.
export function ferryBoat() {
  const parts = [
    P('hull', [4, 1, 10], 'wood', [0, -0.1, 0]),
    P('deck', [3.4, 0.2, 8.6], 'ochre', [0, 0.5, 0]),
    P('rimL', [0.4, 0.6, 9.4], 'yellow', [-1.9, 0.7, 0]),
    P('rimR', [0.4, 0.6, 9.4], 'yellow', [1.9, 0.7, 0]),
    P('stern', [3.2, 0.8, 0.5], 'wood', [0, 0.7, -4.9]),
    P('prow', [0.7, 2.2, 0.7], 'ochre', [0, 1.2, 5.1]),
    P('head', [0.7, 0.7, 1.2], 'vermilion', [0, 2.3, 5.5]),
  ];
  return { kind: 'still', parts, scale: 1, height: 2, shadow: 0 };
}

// A new plank for the bridge, n units long (one unit is one half block). The units are pale and
// ochre in turn, with a red dot painted on each, so that the child sees the length and can count
// it. The plank lies along +z from its position; its top is at 0.8.
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
// The tones of the herbs: [below, top]. Perilla (tía tô) is purple below and green on top: the
// palette of the prints has no purple, so its leaves are indigo below (#61).
const HERBS = { ngai: ['greenPale', 'ashLight'], tiato: ['indigo', 'green'], rauma: ['green', 'greenPale'] };
const IRON = ['ash', 'vermilionPale', 'vermilion', 'yellowPale'];
// The looks of the planting of Xóm Ruộng that come from their key (docs/PLANTING.md): a row of n
// seedlings at a stage of growth (seedlings-<n>-<stage>), a bundle of n seedlings tied with straw
// (bundle-<n>), a loose bunch (bunch-<n>), and a bamboo stake of a plot (plot-stake). Null for
// another key.
export function thingLook(key) {
  const k = String(key);
  let m = /^seedlings-(\d+)-([a-z]+)$/.exec(k);
  if (m) return { kind: 'seedlings', n: Number(m[1]), stage: m[2] };
  m = /^(bundle|bunch)-(\d+)$/.exec(k);
  if (m) return { kind: `seed-${m[1]}`, n: Number(m[2]) };
  if (k === 'plot-stake') return { kind: 'plot-stake' };
  // The mat of the teacher with the places of a frame of ten (grade 1 and below, #69), and the glow
  // of an empty place after a count.
  if (k === 'mat-frame') return { kind: 'mat', frame: true };
  if (k === 'place-glow') return { kind: 'place-glow' };
  // The small sign at a bed of the healer, with a picture of its herb and no word (#61).
  m = /^herb-(sign|tag)-(ngai|tiato|rauma)$/.exec(k);
  if (m) return { kind: 'herb-sign', herb: m[2], tag: m[1] === 'tag' };
  // A chalk mark on the stem of the woodcutter: a band around the stem (#48); a cut piece of the
  // stem (green), n half blocks long.
  if (k === 'chalk-band') return { kind: 'chalk-band' };
  m = /^piece-(\d+)$/.exec(k);
  if (m) return { kind: 'stem', n: Number(m[1]), green: true };
  // The things of the ducks, the fish traps, and the drum dance (docs/HAMLET.md).
  m = /^duck-trough-(\d+)$/.exec(k);
  if (m) return { kind: 'duck-trough', n: Number(m[1]) };
  m = /^trough-feed-(\d+)$/.exec(k);
  if (m) return { kind: 'trough-feed', n: Number(m[1]) };
  m = /^lo-(\d+)(-full)?$/.exec(k);
  if (m) return { kind: 'lo', n: Number(m[1]), full: Boolean(m[2]) };
  if (k === 'feed-jar' || k === 'trap-spot' || k === 'bronze-drum') return { kind: k };
  m = /^feast-table-(\d+)-(\d+)-(\d+)$/.exec(k);
  if (m) return { kind: 'feast-table', eggs: Number(m[1]), fish: Number(m[2]), sheaves: Number(m[3]) };
  if (k === 'weir-shut' || k === 'weir-open') return { kind: 'weir', open: k === 'weir-open' };
  // The shard of a broken pot of nhảy lò cò (docs/FOLKGAMES.md).
  if (k === 'shard') return { kind: 'shard' };
  // The goods of a seller on a market day (barter, #26): fish, eggs, or pots on a tray.
  m = /^wares-([a-z]+)-(\d+)$/.exec(k);
  if (m) return { kind: 'wares', goods: m[1], n: Number(m[2]) };
  return null;
}
// The feed of one scoop takes this length of the trough (half blocks): a notch on the side of the
// trough for each fifth scoop, and a bigger notch for each tenth.
export const SCOOP_LENGTH = 0.2;
// The size of the chalk band around the stem (half blocks): the stem is 1 x 1.
export const CHALK_BAND = 1.8;
// The fish of the trap of the fisher jump at this height over the bed of the line (the ducks swim
// at about 1.1).
export const FISH_JUMP = 1.3;
// The seat of the iron horse of Gióng over the ground (half blocks): the height of the hips of
// grown Gióng (#50), so that his feet hang at the sides of the horse.
export const STEED_SEAT = 3.6;
const RINGS = { 2: 1.6, 5: 2.4, 10: 3.4 }; // the length of a fish trap (half blocks) for its rings
const STAGES = { planted: ['greenPale', 0.8], green: ['green', 1.2], tall: ['greenDeep', 1.7], gold: ['yellow', 1.9] };
// The water of a paddy stands over the ground (WATER.paddy in src/world/terrain.js): a seedling
// rises from under the water.
const PADDY_WATER = 1.1;

export function workThing(look) {
  switch (look.kind) {
    // A row of seedlings, one on each half block along +x from the first one: young and pale,
    // then green, then tall, then gold.
    case 'seedlings': {
      const [color, h] = STAGES[look.stage] ?? STAGES.planted;
      const parts = [];
      for (let i = 0; i < Math.max(1, Math.min(14, look.n ?? 1)); i++) {
        parts.push(P(`s${i}`, [0.34, h + 0.3, 0.34], color, [i, PADDY_WATER - 0.3 + (h + 0.3) / 2, 0]));
        parts.push(P(`l${i}`, [0.62, 0.16, 0.2], color, [i, PADDY_WATER + h * 0.8, 0]));
      }
      return still(parts, PADDY_WATER + h);
    }
    // A bundle of seedlings (bó mạ): green blades tied with straw, wider for more seedlings.
    case 'seed-bundle': {
      const w = Math.min(0.9, 0.3 + (look.n ?? 1) * 0.06);
      // A bundle is for two hands, so that its size is seen (src/world/carry.js).
      return { ...still([P('blades', [w, 0.9, w], 'green', [0, 0.45, 0]), P('roots', [w * 0.9, 0.15, w * 0.9], 'ochre', [0, 0.07, 0]), P('band', [w + 0.06, 0.12, w + 0.06], 'yellowPale', [0, 0.35, 0])], 0.9), hold: 'front' };
    }
    // A loose bunch of seedlings: a few blades.
    case 'seed-bunch': {
      const w = Math.min(0.6, 0.18 + (look.n ?? 1) * 0.04);
      return still([P('blades', [w, 0.6, w], 'greenPale', [0, 0.3, 0]), P('roots', [w, 0.1, w], 'ochre', [0, 0.05, 0])], 0.6);
    }
    // The long wooden trough of the ducks along +x (a duck for each two half blocks), with a notch
    // on its south side for each fifth scoop of feed and a bigger notch for each tenth.
    case 'duck-trough': {
      const len = Math.max(3, (look.n ?? 1) * 2 + 1);
      const parts = [P('floor', [len, 0.2, 1], 'wood', [len / 2, 0.1, 0]), P('sideN', [len, 0.5, 0.15], 'ochre', [len / 2, 0.25, -0.45]), P('sideS', [len, 0.5, 0.15], 'ochre', [len / 2, 0.25, 0.45]), P('endW', [0.15, 0.5, 1], 'ochre', [0, 0.25, 0]), P('endE', [0.15, 0.5, 1], 'ochre', [len, 0.25, 0])];
      for (let k = 5; k * SCOOP_LENGTH < len - 0.4 && parts.length < 60; k += 5) parts.push(P(`notch${k}`, [0.06, k % 10 ? 0.25 : 0.45, 0.04], 'ink', [0.4 + k * SCOOP_LENGTH, k % 10 ? 0.37 : 0.28, 0.53]));
      return still(parts, 0.5);
    }
    // The feed in the trough: one strip that grows one scoop at a time from the head of the trough.
    case 'trough-feed': {
      const n = look.n ?? 0;
      if (!n) return still([P('none', [0.01, 0.01, 0.01], 'wood', [0, 0, 0])], 0.01);
      const len = n * SCOOP_LENGTH;
      return still([P('feed', [len, 0.18, 0.7], 'yellowPale', [0.4 + len / 2, 0.29, 0]), P('grain', [len, 0.06, 0.4], 'ochre', [0.4 + len / 2, 0.4, 0])], 0.45);
    }
    // The shard of a broken pot: a flat piece of fired clay.
    case 'shard': return still([P('shard', [0.8, 0.12, 0.6], 'vermilionPale', [0, 0.06, 0]), P('edge', [0.5, 0.1, 0.2], 'ochre', [0.1, 0.1, 0.3])], 0.2);
    // The goods of a seller on a flat tray of woven bamboo, in rows of five, so that the child
    // sees how many there are: fish, eggs, or small clay pots.
    case 'wares': {
      const n = Math.max(1, Math.min(20, look.n ?? 1));
      const rows = Math.ceil(n / 5);
      const parts = [P('tray', [3, 0.12, rows * 0.6 + 0.4], 'yellow', [0, 0.06, 0])];
      for (let i = 0; i < n; i++) {
        const at = [-1.2 + (i % 5) * 0.6, 0, -(rows - 1) * 0.3 + Math.floor(i / 5) * 0.6];
        if (look.goods === 'fish') parts.push(P(`fish${i}`, [0.22, 0.18, 0.5], 'ash', [at[0], 0.21, at[2]]));
        else if (look.goods === 'egg') parts.push(P(`egg${i}`, [0.26, 0.32, 0.26], 'paper', [at[0], 0.28, at[2]]));
        else parts.push(P(`pot${i}`, [0.4, 0.4, 0.4], 'vermilionPale', [at[0], 0.32, at[2]]), P(`neck${i}`, [0.24, 0.1, 0.24], 'ochre', [at[0], 0.56, at[2]]));
      }
      return still(parts, 0.6);
    }
    // The clay jar of feed (a vại) by the head of the trough: the child holds it to pour.
    case 'feed-jar': return still([P('body', [1.2, 1.1, 1.2], 'wood', [0, 0.55, 0]), P('belly', [1.35, 0.5, 1.35], 'wood', [0, 0.6, 0]), P('neck', [0.9, 0.2, 0.9], 'ochre', [0, 1.2, 0]), P('feed', [0.7, 0.08, 0.7], 'yellowPale', [0, 1.3, 0])], 1.35);
    // A fish trap (a lờ) of bamboo, lying along +z: a cone with a ring for each fish that it holds.
    case 'lo': {
      const len = RINGS[look.n] ?? 1.2 + look.n * 0.14;
      const parts = [P('cone', [1, 1, len], 'yellow', [0, 0.5, 0]), P('mouth', [1.3, 1.3, 0.2], 'ochre', [0, 0.6, len / 2])];
      for (let i = 0; i < look.n; i++) parts.push(P(`ring${i}`, [1.08, 1.08, 0.08], 'wood', [0, 0.5, -len / 2 + (len * (i + 0.5)) / look.n]));
      if (look.full) parts.push(P('fish', [0.5, 0.35, len * 0.7], 'ashLight', [0, 1.1, 0]), P('fishB', [0.4, 0.3, len * 0.5], 'ash', [0.25, 1.2, -0.1]));
      // A fish trap is held in front, in two hands, so that its rings are seen (src/world/carry.js).
      return { ...still(parts, 1.3), hold: 'front' };
    }
    // A stake in the stream: a spot for a trap.
    case 'trap-spot': return still([P('pole', [0.2, 2.6, 0.2], 'wood', [-0.8, 0.6, 0]), P('top', [0.28, 0.12, 0.28], 'ochre', [-0.8, 1.95, 0])], 2);
    // The small weir of bamboo across the stream: shut, or with its gate open.
    case 'weir': {
      const parts = [P('beam', [8, 0.25, 0.25], 'wood', [0, 1.2, 0])];
      for (let i = 0; i < 9; i++) if (!look.open || i < 3 || i > 5) parts.push(P(`slat${i}`, [0.7, 1.4, 0.2], 'yellow', [-4 + i * 1, 0.5, 0]));
      return still(parts, 1.4);
    }
    // The feast table in the yard: a low table of wood with a tray of eggs, dried fish on a rack, and
    // sheaves of the new rice (each up to a few, so that the table shows what the activities gave).
    case 'feast-table': {
      const parts = [P('top', [5, 0.25, 2.6], 'wood', [0, 0.9, 0]), P('legA', [0.3, 0.8, 0.3], 'ochre', [-2.2, 0.4, -1]), P('legB', [0.3, 0.8, 0.3], 'ochre', [2.2, 0.4, -1]), P('legC', [0.3, 0.8, 0.3], 'ochre', [-2.2, 0.4, 1]), P('legD', [0.3, 0.8, 0.3], 'ochre', [2.2, 0.4, 1])];
      for (let i = 0; i < (look.eggs ?? 0); i++) parts.push(P(`egg${i}`, [0.32, 0.4, 0.32], 'paper', [-2 + (i % 3) * 0.42, 1.23, -0.8 + Math.floor(i / 3) * 0.42]));
      for (let i = 0; i < (look.fish ?? 0); i++) parts.push(P(`fish${i}`, [0.3, 0.2, 1], 'ash', [-0.4 + (i % 5) * 0.4, 1.13, -0.6 + Math.floor(i / 5) * 1.2]));
      for (let i = 0; i < (look.sheaves ?? 0); i++) parts.push(P(`sheaf${i}`, [0.4, 1.1, 0.4], 'yellow', [1.6 + (i % 2) * 0.5, 1.58, -0.9 + Math.floor(i / 2) * 0.6]), P(`band${i}`, [0.44, 0.12, 0.44], 'vermilion', [1.6 + (i % 2) * 0.5, 1.4, -0.9 + Math.floor(i / 2) * 0.6]));
      return still(parts, 2.2);
    }
    // The bronze drum (trống đồng) of the dance: a low wide drum with a star on its face.
    case 'bronze-drum': return still([P('body', [1.6, 0.8, 1.6], 'ochre', [0, 0.4, 0]), P('waist', [1.3, 0.3, 1.3], 'wood', [0, 0.15, 0]), P('face', [1.7, 0.1, 1.7], 'yellow', [0, 0.85, 0]), P('star', [0.5, 0.04, 0.5], 'vermilion', [0, 0.92, 0])], 0.95);
    // A thin bamboo stake at the edge of a plot: one for each row, one for each column.
    case 'plot-stake': return still([P('pole', [0.18, 1.6, 0.18], 'yellow', [0, 0.8, 0]), P('top', [0.24, 0.12, 0.24], 'ochre', [0, 1.62, 0])], 1.7);
    // A counting rod: a stick of bamboo, thick enough to see on a phone at the zoom of the start
    // (more than 4 pixels wide, #61).
    case 'rod': return still([P('stick', [0.4, 0.3, 1.2], 'yellow', [0, 0.15, 0]), P('endA', [0.4, 0.3, 0.12], 'ochre', [0, 0.15, 0.66]), P('endB', [0.4, 0.3, 0.12], 'ochre', [0, 0.15, -0.66])], 0.32);
    // Ten rods tied with a red band.
    case 'rod-bundle': return still([P('rods', [0.8, 0.8, 1.5], 'yellow', [0, 0.4, 0]), P('ends', [0.7, 0.7, 1.52], 'ochre', [0, 0.4, 0]), P('band', [0.9, 0.9, 0.3], 'vermilion', [0, 0.4, 0])], 0.9);
    // A reed mat on the ground.
    case 'mat': {
      const parts = [P('mat', [4.4, 0.08, 2.6], 'yellowPale', [2, 0.04, 1.2]), P('edgeN', [4.4, 0.1, 0.2], 'ochre', [2, 0.05, -0.05]), P('edgeS', [4.4, 0.1, 0.2], 'ochre', [2, 0.05, 2.45])];
      // A frame of ten (#69): two rows of five places (matSlot in src/core/world/systems/work.js),
      // so that a child sees the empty places and the full rows. A rod over ten lies outside it.
      if (look.frame) {
        for (let c = 0; c <= 5; c++) parts.push(P(`col${c}`, [0.1, 0.1, 2.6], 'ochre', [c * 0.8, 0.09, 1.25]));
        parts.push(P('mid', [4, 0.1, 0.1], 'ochre', [2, 0.09, 1.25]));
      }
      return still(parts, 0.1);
    }
    // The glow of an empty place of the mat after a count (#69): a ring of light around the place.
    case 'place-glow': return still([P('n', [0.8, 0.12, 0.1], 'vermilion', [0, 0.12, -0.62]), P('s', [0.8, 0.12, 0.1], 'vermilion', [0, 0.12, 0.62]), P('w', [0.1, 0.12, 1.3], 'vermilion', [-0.36, 0.12, 0]), P('e', [0.1, 0.12, 1.3], 'vermilion', [0.36, 0.12, 0])], 0.15);
    // A coil of straw rope.
    case 'band': return still([P('coil', [0.9, 0.3, 0.9], 'ochre', [0, 0.15, 0]), P('hole', [0.4, 0.32, 0.4], 'wood', [0, 0.16, 0]), P('end', [0.2, 0.2, 0.6], 'ochre', [0.5, 0.1, 0.4])], 0.35);
    // A lump of iron ore; red hot in the forge.
    case 'ore': return still([P('lump', [0.8, 0.55, 0.7], look.hot ? 'vermilion' : 'ash', [0, 0.28, 0]), P('grain', [0.4, 0.3, 0.4], look.hot ? 'yellow' : 'ink', [0.15, 0.5, 0.1]), P('chip', [0.3, 0.25, 0.3], look.hot ? 'vermilionPale' : 'ashLight', [-0.3, 0.15, -0.2])], 0.7);
    // The bellows of the forge: a box of wood with a pole to push.
    case 'bellows': return still([P('box', [1, 0.8, 1.4], 'wood', [0, 0.4, 0]), P('lid', [1.05, 0.12, 1.45], 'ochre', [0, 0.84, 0]), P('pole', [0.15, 0.15, 1.2], 'ink', [0, 0.95, -0.9]), P('grip', [0.5, 0.15, 0.15], 'wood', [0, 0.95, -1.5]), P('nozzle', [0.25, 0.25, 0.5], 'ink', [0, 0.3, 0.9])], 1);
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
      if (look.horse) {
        // The iron horse for Gióng: a body, a neck and a head, four legs, and a tail.
        const legs = [[-0.25, -0.5], [0.25, -0.5], [-0.25, 0.5], [0.25, 0.5]].map(([x, z], i) => P(`leg${i}`, [0.18, 0.6, 0.18], 'ink', [x, 0.3, z]));
        return still([...anvil, ...legs, P('body', [0.6, 0.45, 1.4], 'ash', [0, 0.8, 0]), P('neck', [0.35, 0.6, 0.35], 'ash', [0, 1.2, 0.6]), P('head', [0.35, 0.3, 0.7], 'ash', [0, 1.55, 0.85]), P('mane', [0.12, 0.5, 0.4], 'vermilion', [0, 1.4, 0.45]), P('tail', [0.15, 0.5, 0.15], 'ink', [0, 0.8, -0.8])], 1.8);
      }
      return still([...anvil, P('bar', [0.4, 0.3, 2], IRON[Math.max(0, Math.min(3, look.glow ?? 0))], [0, 0.15, 0])], 0.4);
    }
    // The iron horse that Gióng rides (#50): a horse of iron as big as grown Gióng, with a red
    // mane. The seat (the top of the back) is at STEED_SEAT over the ground; k: the size of the
    // horse against a horse with its seat at 1.65.
    case 'steed': {
      const k = STEED_SEAT / 1.65;
      const legs = [[-0.35, -0.9], [0.35, -0.9], [-0.35, 0.9], [0.35, 0.9]].map(([x, z], i) => P(`leg${i}`, [0.35 * k, 1.05 * k, 0.35 * k], 'ink', [x * k, 0.525 * k, z * k]));
      return still([
        ...legs,
        P('body', [0.9 * k, 0.7 * k, 2.4 * k], 'ash', [0, STEED_SEAT - 0.35 * k, 0]),
        P('neck', [0.5 * k, 1 * k, 0.5 * k], 'ash', [0, STEED_SEAT + 0.25 * k, 1.1 * k]),
        P('head', [0.5 * k, 0.45 * k, 1 * k], 'ash', [0, STEED_SEAT + 0.75 * k, 1.5 * k]),
        P('mane', [0.15 * k, 0.8 * k, 0.5 * k], 'vermilion', [0, STEED_SEAT + 0.45 * k, 0.9 * k]),
        P('tail', [0.2 * k, 0.8 * k, 0.2 * k], 'ink', [0, STEED_SEAT - 0.35 * k, -1.3 * k]),
      ], STEED_SEAT + 1 * k);
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
    // Fish in the trap, or fish that swim out through a space and away into the river. They jump at the top of the water
    // (FISH_JUMP over the bed of the line, where the ducks swim), light on the dark water, so that
    // the child sees the catch and the escape (#48).
    case 'fish-trap': {
      const parts = [];
      for (let i = 0; i < 3; i++) {
        const y = FISH_JUMP + (i % 2) * 0.35;
        const z = look.in ? 0.4 * i : 1 + 1.2 * i;
        parts.push(P(`fish${i}`, [0.45, 0.4, 1.1], 'paper', [(i - 1) * 1.2, y, z]), P(`tail${i}`, [0.5, 0.35, 0.35], 'ashLight', [(i - 1) * 1.2, y, z - 0.7]));
      }
      return still(parts, FISH_JUMP + 0.6);
    }
    // A bunch of healing leaves. Each kind has its own shape, so that a child tells them apart also
    // in a dim light (#48): mugwort (ngải) tall and thin, grey-green; perilla (tía tô) wide and
    // flat, red; pennywort (rau má) low round leaves near the ground, green.
    case 'herb': {
      const [a, b] = HERBS[look.herb] ?? HERBS.ngai;
      if (look.herb === 'tiato') return still([P('stem', [0.2, 0.5, 0.2], 'greenDeep', [0, 0.25, 0]), P('leaves', [1.2, 0.2, 1.2], a, [0, 0.55, 0]), P('top', [0.9, 0.2, 0.9], b, [0, 0.75, 0])], 0.85);
      if (look.herb === 'rauma') return still([P('leafA', [0.5, 0.18, 0.5], a, [-0.3, 0.12, -0.2]), P('leafB', [0.5, 0.18, 0.5], b, [0.3, 0.14, -0.1]), P('leafC', [0.5, 0.18, 0.5], a, [0, 0.16, 0.3])], 0.3);
      return still([P('stem', [0.18, 1.5, 0.18], 'greenDeep', [0, 0.75, 0]), P('leafA', [0.5, 0.35, 0.18], a, [0.2, 0.6, 0]), P('leafB', [0.18, 0.35, 0.5], a, [0, 1, 0.2]), P('tip', [0.3, 0.4, 0.3], b, [0, 1.5, 0])], 1.7);
    }
    // A sign at a bed: a post with a board, and on the board the shape of the herb in its tones.
    case 'herb-sign': {
      const [a, b] = HERBS[look.herb] ?? HERBS.ngai;
      // A tag on the back wall of a part of the basket: the board only, on the top of the wall
      // (#61, #64: the basket stands on a stand).
      const y = look.tag ? BASKET_FLOOR + 0.45 : 0;
      const parts = look.tag ? [P('board', [1.1, 0.9, 0.12], 'paper', [0, 1.45 + y, 0])] : [P('post', [0.2, 1.2, 0.2], 'wood', [0, 0.6, 0]), P('board', [1.1, 0.9, 0.12], 'paper', [0, 1.45, 0])];
      if (look.herb === 'ngai') parts.push(P('pic', [0.16, 0.7, 0.04], a, [0, 1.45 + y, 0.08]), P('picTip', [0.3, 0.2, 0.04], b, [0, 1.75 + y, 0.08]));
      else if (look.herb === 'tiato') parts.push(P('pic', [0.8, 0.22, 0.04], a, [0, 1.3 + y, 0.08]), P('picTop', [0.55, 0.2, 0.04], b, [0, 1.52 + y, 0.08]));
      else parts.push(P('picA', [0.25, 0.25, 0.04], a, [-0.25, 1.25 + y, 0.08]), P('picB', [0.25, 0.25, 0.04], b, [0.05, 1.3 + y, 0.08]), P('picC', [0.25, 0.25, 0.04], a, [0.3, 1.24 + y, 0.08]));
      return still(parts, 1.9 + y);
    }
    // The basket of the healer, with three parts; full when the healer takes it.
    case 'basket': {
      // Three parts, 1.6 half blocks wide each (#61: a basket where the child sees the count). The
      // front wall is low, so that the bunches that stand in the parts show.
      if (look.low) {
        // The low basket of the hero at the share of the loot: on the ground.
        const parts = [P('floor', [4.8, 0.2, 1.8], 'ochre', [2.4, 0.1, 0.8]), P('wallN', [4.8, 0.7, 0.2], 'ochre', [2.4, 0.35, 0]), P('wallS', [4.8, 0.35, 0.2], 'ochre', [2.4, 0.18, 1.7]), P('wallW', [0.2, 0.7, 1.8], 'ochre', [0, 0.35, 0.8]), P('wallE', [0.2, 0.7, 1.8], 'ochre', [4.8, 0.35, 0.8]), P('div1', [0.15, 0.6, 1.6], 'wood', [1.6, 0.3, 0.8]), P('div2', [0.15, 0.6, 1.6], 'wood', [3.2, 0.3, 0.8])];
        return still(parts, 0.9);
      }
      // The basket of the healer is big (#64: no child found the small one): on a low stand, with
      // its back wall about as tall as the hero, and its own lamp on a pole at the east end, which
      // lights at dusk and at night (src/ui/village.js). The bunches stand on its floor
      // (BASKET_FLOOR, src/core/world/systems/work.js).
      const f = BASKET_FLOOR;
      const parts = [
        P('legNW', [0.3, f - 0.2, 0.3], 'wood', [0.2, (f - 0.2) / 2, 0.15]), P('legNE', [0.3, f - 0.2, 0.3], 'wood', [4.6, (f - 0.2) / 2, 0.15]),
        P('legSW', [0.3, f - 0.2, 0.3], 'wood', [0.2, (f - 0.2) / 2, 1.55]), P('legSE', [0.3, f - 0.2, 0.3], 'wood', [4.6, (f - 0.2) / 2, 1.55]),
        P('floor', [4.8, 0.2, 1.8], 'ochre', [2.4, f - 0.1, 0.8]),
        P('wallN', [4.8, 1.3, 0.2], 'ochre', [2.4, f + 0.65, 0]), P('wallS', [4.8, 0.45, 0.2], 'ochre', [2.4, f + 0.22, 1.7]),
        P('wallW', [0.2, 1.3, 1.8], 'ochre', [0, f + 0.65, 0.8]), P('wallE', [0.2, 1.3, 1.8], 'ochre', [4.8, f + 0.65, 0.8]),
        P('rim', [5, 0.15, 0.3], 'wood', [2.4, f + 1.35, 0]),
        P('div1', [0.15, 1, 1.6], 'wood', [1.6, f + 0.5, 0.8]), P('div2', [0.15, 1, 1.6], 'wood', [3.2, f + 0.5, 0.8]),
        P('pole', [0.2, 2.6, 0.2], 'wood', [5.25, 1.3, 0]), P('lamp', [0.7, 0.8, 0.7], 'yellowPale', [5.25, 2.9, 0]), P('lampCap', [0.9, 0.15, 0.9], 'wood', [5.25, 3.35, 0]),
      ];
      if (look.full) parts.push(P('leaves', [4.4, 0.4, 1.5], 'green', [2.4, f + 0.3, 0.8]));
      return still(parts, 3.4);
    }
    // The wood pile of the woodcutter (#57): two rows of logs on a low rack, so that the place
    // where the sticks go has a picture, not only the light of the cue.
    // The lights of the work at dusk and at night (#65): a lantern on a post (the woodcutter and
    // the other tasks), an oil lamp on a low stand (the teacher), and a torch on the bank (the
    // fisher). The flame is pale, so that it shows in the day too; the view lights it at night.
    case 'work-lamp': return still([P('post', [0.25, 2.6, 0.25], 'wood', [0, 1.3, 0]), P('arm', [0.8, 0.15, 0.15], 'wood', [0.35, 2.5, 0]), P('lamp', [0.6, 0.7, 0.6], 'yellowPale', [0.7, 2.05, 0]), P('cap', [0.75, 0.12, 0.75], 'wood', [0.7, 2.45, 0])], 2.7);
    case 'oil-lamp': return still([P('stand', [0.3, 0.9, 0.3], 'wood', [0, 0.45, 0]), P('dish', [0.8, 0.15, 0.8], 'ochre', [0, 0.95, 0]), P('flame', [0.25, 0.4, 0.25], 'yellowPale', [0, 1.2, 0])], 1.4);
    case 'work-torch': return still([P('pole', [0.25, 2.8, 0.25], 'wood', [0, 1.4, 0]), P('wrap', [0.4, 0.4, 0.4], 'ochre', [0, 2.9, 0]), P('flame', [0.5, 0.6, 0.5], 'yellow', [0, 3.35, 0]), P('core', [0.25, 0.35, 0.25], 'yellowPale', [0, 3.4, 0])], 3.7);
    case 'woodpile': return still([
      P('rack', [3.2, 0.2, 2], 'ink', [1.5, 0.1, 1]),
      P('log1', [3, 0.55, 0.55], 'wood', [1.5, 0.45, 0.4]), P('log2', [3, 0.55, 0.55], 'ochre', [1.5, 0.45, 1]), P('log3', [3, 0.55, 0.55], 'wood', [1.5, 0.45, 1.6]),
      P('log4', [3, 0.55, 0.55], 'ochre', [1.5, 0.95, 0.7]), P('log5', [3, 0.55, 0.55], 'wood', [1.5, 0.95, 1.3]),
      P('ends', [0.08, 0.9, 1.6], 'yellowPale', [0, 0.7, 1]),
    ], 1.25);
    // A fallen bamboo stem, n half blocks long, along +z, with a node at each unit.
    case 'stem': {
      const parts = [];
      // A fallen stem dries yellow, so that it stands out on the grass; a cut stem is green, with
      // a dark ring at each half block.
      const [a, b, ring] = look.green ? ['green', 'greenPale', 'greenDeep'] : ['yellow', 'yellowPale', 'ochre'];
      // The nodes are thin and close to the stem, so that they do not look like chalk marks (#48).
      for (let i = 0; i < look.n; i++) parts.push(P(`seg${i}`, [1, 1, 1], i % 2 ? a : b, [0, 0.5, i + 0.5]), P(`node${i}`, [1.04, 1.04, 0.08], ring, [0, 0.5, i + 1]));
      parts.push(P('end', [0.8, 0.8, 0.1], 'yellowPale', [0, 0.5, 0]));
      return still(parts, 0.8);
    }
    // A standing culm of the bamboo clump of the staffs, n half blocks tall, with a dark ring at
    // each half block (the rings are the heights where the hand can slash) and leaves at the top;
    // or a cut piece (cut) that stands where its culm stood.
    case 'culm': {
      const parts = [];
      for (let i = 0; i < look.n; i++) parts.push(P(`seg${i}`, [0.8, 1, 0.8], i % 2 ? 'green' : 'greenPale', [0, i + 0.5, 0]), P(`ring${i}`, [0.9, 0.14, 0.9], 'greenDeep', [0, i + 1, 0]));
      // A cut piece (the staff, where the culm stood) has a pale cut at the top and no leaves.
      if (look.cut) {
        parts.push(P('cut', [0.7, 0.1, 0.7], 'yellowPale', [0, look.n + 0.05, 0]));
        return still(parts, look.n + 0.1);
      }
      parts.push(P('leaves', [2.6, 1.4, 2.6], 'greenPale', [0, look.n + 0.4, 0]), P('leavesTop', [1.4, 1, 1.4], 'green', [0, look.n + 1.4, 0]));
      return still(parts, look.n + 1.9);
    }
    // A small sack of rice tied at the top (the loot of a raid; Era 1 has no coins, #26).
    case 'sack': return still([P('sack', [0.7, 0.6, 0.6], 'yellowPale', [0, 0.3, 0]), P('neck', [0.35, 0.2, 0.3], 'yellowPale', [0, 0.68, 0]), P('tie', [0.4, 0.08, 0.35], 'ochre', [0, 0.62, 0])], 0.8);
    // The rest of the loot on a red cloth, when the child puts it down on the way.
    case 'gift': {
      const parts = [P('cloth', [1.4, 0.08, 1.1], 'vermilion', [0, 0.04, 0]), P('knot', [0.3, 0.2, 0.3], 'vermilionPale', [0.6, 0.1, -0.45])];
      for (let i = 0; i < look.n; i++) parts.push(P(`sack${i}`, [0.45, 0.45, 0.4], 'yellowPale', [(i - (look.n - 1) / 2) * 0.55, 0.3, 0]));
      return still(parts, 0.55);
    }
    // A small reed mat for a share of the loot.
    case 'share-mat': return still([P('mat', [2.2, 0.08, 2.2], 'yellowPale', [0, 0.04, 0]), P('edgeN', [2.2, 0.1, 0.2], 'ochre', [0, 0.05, -1.05]), P('edgeS', [2.2, 0.1, 0.2], 'ochre', [0, 0.05, 1.05])], 0.1);
    // The things of the small events of the day: each shows its units, so that its size is seen
    // and never written. Stones in a net (one, two, or five), pails of water on a carrying pole,
    // and bowls of rice.
    case 'stones': {
      const n = look.n ?? 1;
      const parts = [];
      for (let i = 0; i < n; i++) {
        const at = [(i % 3 - 1) * 0.55, 0.22 + Math.floor(i / 3) * 0.4, (Math.floor(i / 3) % 2) * 0.3];
        parts.push(P(`stone${i}`, [0.55, 0.45, 0.55], 'ash', at), P(`top${i}`, [0.3, 0.1, 0.3], 'ashLight', [at[0] + 0.05, at[1] + 0.25, at[2]]));
      }
      parts.push(P('net', [Math.min(3, n) * 0.6, 0.08, 0.9], 'ochre', [0, 0.04, 0]));
      // Stones in a net are heavy: two hands (src/world/carry.js).
      return { ...still(parts, 0.6 + Math.floor((n - 1) / 3) * 0.4), hold: 'front' };
    }
    case 'pails': {
      const n = look.n ?? 1;
      const parts = [P('pole', [Math.max(1, n) * 0.8 + 0.4, 0.12, 0.12], 'wood', [0, 1.1, 0])];
      for (let i = 0; i < n; i++) parts.push(P(`pail${i}`, [0.55, 0.6, 0.55], 'wood', [(i - (n - 1) / 2) * 0.8, 0.3, 0]), P(`water${i}`, [0.45, 0.05, 0.45], 'indigoPale', [(i - (n - 1) / 2) * 0.8, 0.62, 0]));
      // Pails go on the carrying pole across the shoulder (đòn gánh, src/world/carry.js).
      return { ...still(parts, 1.2), hold: 'yoke' };
    }
    // A bowl of rice (bát gạo, #26, #42): the measure that every kitchen uses, a bowl of glazed clay
    // on a small foot, full of rice in a low mound.
    case 'rice-bowl': return still([P('foot', [0.4, 0.1, 0.4], 'ashLight', [0, 0.05, 0]), P('bowl', [0.7, 0.24, 0.7], 'diep', [0, 0.22, 0]), P('band', [0.74, 0.06, 0.74], 'indigoPale', [0, 0.31, 0]), P('rice', [0.56, 0.1, 0.56], 'paper', [0, 0.38, 0])], 0.44);
    // The mud under the wheel of a stuck cart.
    case 'mud': return still([P('mud', [2.6, 0.06, 2], 'wood', [0, 0.03, 0]), P('wet', [1.6, 0.07, 1.2], 'ink', [0.2, 0.04, 0.1]), P('rut', [0.5, 0.08, 2.2], 'ochre', [-0.8, 0.05, 0])], 0.1);
    // A small ditch at the side of a paddy, where the water goes.
    case 'ditch': return still([P('bed', [2.8, 0.06, 1.2], 'ochre', [0, 0.03, 0]), P('water', [2.4, 0.07, 0.7], 'indigoPale', [0, 0.05, 0]), P('lip', [2.8, 0.12, 0.15], 'wood', [0, 0.06, -0.6])], 0.1);
    // A low pen of woven bamboo for the ducks.
    case 'pen': {
      const parts = [];
      for (const [x, z, w, d] of [[0, -2, 4.4, 0.2], [0, 2, 4.4, 0.2], [-2.2, 0, 0.2, 4], [2.2, 0.8, 0.2, 2.4]]) parts.push(P(`side${x}${z}`, [w, 0.6, d], 'yellow', [x, 0.3, z]));
      return still(parts, 0.6);
    }
    // The mark of a mentor: a red ring on the ground and a small red flag on a stick, where the
    // person points (what matters, the heap, the place).
    case 'mentor-mark': return still([P('ring', [1.4, 0.06, 1.4], 'vermilion', [0, 0.03, 0]), P('hole', [0.9, 0.07, 0.9], 'paper', [0, 0.035, 0]), P('stick', [0.15, 1.6, 0.15], 'wood', [0, 0.8, 0]), P('flag', [0.6, 0.4, 0.08], 'vermilion', [0.3, 1.4, 0])], 1.6);
    // A chalk mark on the stem: a red band around the stem, much larger than the stem, so that it
    // shows on the top and on the sides (#48).
    case 'chalk-band': return still([P('band', [0.4, CHALK_BAND, CHALK_BAND], 'vermilion', [0, CHALK_BAND / 2 - 0.1, 0])], CHALK_BAND);
    // A chalk mark across a culm (the height of a slash).
    case 'chalk': return still([P('mark', [1.3, 0.08, 0.25], 'vermilion', [0, 0.45, 0]), P('dotA', [0.25, 0.4, 0.25], 'vermilion', [-0.65, 0.25, 0]), P('dotB', [0.25, 0.4, 0.25], 'vermilion', [0.65, 0.25, 0])], 0.5);
    // Equal bamboo sticks (or staffs) tied into a bundle.
    case 'sticks': {
      const parts = [];
      // Staffs for the men of the village are longer than sticks.
      const long = look.long ? 3.6 : 2.4;
      for (let i = 0; i < look.n; i++) parts.push(P(`stick${i}`, [0.45, 0.45, long], 'green', [(i - (look.n - 1) / 2) * 0.5, 0.25 + (i % 2) * 0.1, 0]));
      parts.push(P('band', [look.n * 0.5 + 0.2, 0.6, 0.3], 'vermilion', [0, 0.3, 0]));
      return still(parts, 0.7);
    }
    default: return null;
  }
}

// The things of a raid (src/core/world/systems/raid.js). Units: half blocks.
export function raidThing(look) {
  switch (look.kind) {
    // A tray of bowls of rice (3 or 5 bowls in a row on a flat tray).
    case 'bowls': {
      const n = look.n ?? 3;
      const parts = [P('tray', [n * 0.9 + 0.3, 0.2, 1.2], 'wood', [0, 0.1, 0]), P('rim', [n * 0.9 + 0.4, 0.12, 0.2], 'ochre', [0, 0.25, 0.55])];
      for (let i = 0; i < n; i++) parts.push(P(`bowl${i}`, [0.7, 0.4, 0.7], 'diep', [(i - (n - 1) / 2) * 0.9, 0.4, 0]), P(`rice${i}`, [0.5, 0.15, 0.5], 'paper', [(i - (n - 1) / 2) * 0.9, 0.65, 0]));
      // A tray of bowls is held in front, in two hands (src/world/carry.js).
      return { ...still(parts, 0.8), hold: 'front' };
    }
    // The pot of Gióng, with the bowls of the ten that is not full yet beside it (the ones).
    case 'rice-pot': {
      const n = look.n ?? 0;
      const parts = [P('pot', [2, 1.6, 2], 'ink', [1, 0.8, 1]), P('rim', [2.2, 0.25, 2.2], 'ash', [1, 1.65, 1]), P('rice', [1.6, 0.2, 1.6], 'paper', [1, 1.75, 1])];
      for (let i = 0; i < n; i++) parts.push(P(`bowl${i}`, [0.6, 0.35, 0.6], 'diep', [2.6 + (i % 5) * 0.75, 0.18 + Math.floor(i / 5) * 0.4, 0.3 + Math.floor(i / 5) * 0.2]));
      return still(parts, 2);
    }
    // A stone of the slingshot, and a rice ball for the creatures of the river.
    case 'riceball': return still([P('ball', [0.6, 0.55, 0.6], 'diep', [0, 0.28, 0]), P('top', [0.4, 0.15, 0.4], 'paper', [0, 0.58, 0]), P('leaf', [0.62, 0.2, 0.3], 'green', [0, 0.1, 0])], 0.6);
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
      // A post that waits for a tap (the prediction before the first shot) has a yellow cap.
      // A post up to the pull of the slingshot (on, #55) is bright: a pale pole and a yellow cap,
      // also at night (a light of the dusk, src/ui/village.js).
      const parts = [P('pole', [0.6, 4.5, 0.6], look.on ? 'diep' : 'wood', [0, 2.25, 0]), P('cap', [0.9, look.lit || look.on ? 0.6 : 0.3, 0.9], look.lit || look.on ? 'yellow' : 'ink', [0, look.lit || look.on ? 4.75 : 4.6, 0])];
      for (let i = 0; i < n; i++) parts.push(P(`band${i}`, [0.7, 0.35, 0.7], 'vermilion', [0, 3.9 - i * 0.6, 0]));
      return still(parts, 4.8);
    }
    // The count of the pull on the road: a small ring of marks (#55). It is not the arc.
    case 'pull-ring': {
      const parts = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        parts.push(P(`m${i}`, [0.5, 0.08, 0.5], i % 2 ? 'yellow' : 'vermilion', [Math.cos(a) * 1.2, 0.04, Math.sin(a) * 1.2], { mark: true }));
      }
      return still(parts, 0.1);
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
    // The cloud that comes down over Gióng at his farewell (#51): round puffs of light paper.
    case 'cloud': return still([
      P('mid', [7, 3, 5], 'diep', [0, 1.5, 0]),
      P('left', [4, 2.4, 4], 'diep', [-4.4, 1.1, 0.4]),
      P('right', [4.4, 2.6, 4], 'diep', [4.2, 1.2, -0.4]),
      P('top', [4, 2, 3.4], 'diep', [0.6, 3.6, 0]),
      P('under', [9, 0.6, 4], 'ashLight', [0, 0.1, 0]),
    ], 4.6);
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

// The figure of a look from data/figures.json. detail: 'fine' (the people and animals on a grid of
// quarter blocks, src/world/fine.js) or 'coarse' (the parts of this file, for far figures). Things
// have one level.
export function figureOf(look, detail = 'fine') {
  const fine = detail !== 'coarse';
  // A thing in the hands of a person: the figure of the thing itself (src/world/carry.js).
  if (look.carried && !look.carriedFigure && !TOOLS.has(look.item)) {
    const thing = figureOf(look.carried, 'coarse');
    if (thing.kind !== 'biped') look = { ...look, carriedFigure: thing };
  }
  const thing = workThing(look) ?? raidThing(look);
  if (thing) return thing;
  if (look.kind === 'plank') return plank(look.n);
  if (look.kind === 'plank-ghost') return plankGhost(Boolean(look.on));
  if (look.kind === 'gap') return gapMarks(look.n);
  if (look.kind === 'deck') return deck(look.n, look.w);
  if (look.kind === 'nghe') return fine ? ngheFine() : nghe();
  if (look.kind === 'duck') {
    // A duck of the feeding stands out a little (size); a big duck (it eats twice the share of a
    // small duck) is half as big again.
    const f = fine ? duckFine(look.coat) : duck(look.coat);
    const k = (look.size ?? 1) * (look.big ? 1.5 : 1);
    // A duck in the arms is held with two hands (src/world/carry.js).
    return { ...f, hold: 'front', ...(k === 1 ? {} : { scale: f.scale * k }) };
  }
  if (look.kind === 'serpent') return serpent(look);
  if (look.kind === 'chicken') return fine ? chickenFine(look) : chicken(look);
  if (look.kind === 'fish') return fine ? fishFine() : fish();
  if (look.kind === 'buffalo') return fine ? buffaloFine() : buffalo();
  if (look.kind === 'dog') return fine ? dogFine() : dog();
  if (look.kind === 'pot') return pot(Boolean(look.broken));
  if (look.kind === 'grass') return grass();
  if (look.kind === 'owl') return owl();
  if (look.kind === 'cart') return cart();
  if (look.kind === 'ferry') return ferryBoat();
  if (look.kind === 'bird') return bird();
  if (look.kind === 'lantern') return lantern(Boolean(look.lit));
  if (look.kind === 'duckling') return duckling();
  if (look.kind === 'frog') return frog();
  if (look.kind === 'lily-pad') return lilyPad();
  if (look.kind === 'kingfisher') return kingfisher();
  if (look.kind === 'golden-shoot') return goldenShoot();
  if (look.kind === 'puddle') return puddle();
  if (look.kind === 'piece') return pieceBase(look.rx, look.rz, look.square, look.dark);
  if (look.kind === 'banh-chung') return banhChung();
  if (look.kind === 'lion') return lion();
  return fine ? personFine(look) : person(look);
}
