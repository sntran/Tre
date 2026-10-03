// The fine people and animals: built on a grid of quarter blocks (FIGURE_UNIT 0.25), so that they
// read as figures of a print and not as stacks of bricks. Pure data, no WebGL (the parts:
// src/world/parts.js). A head is a rounded box with a large flat face, and a child has the face of
// a child; the hair is a cap with the parts of its style, so that the styles differ from the
// front; the torso has a waist and narrower shoulders, and the barrel of Nghé has its corners cut
// by one unit. Faces have eyes (a white, a dark dot, and a highlight), brows, a mouth, and cheeks.
// Legs bend at one joint (the knee), and the feet lift at the heel. The coarse figures of
// src/world/figures.js are the far level of detail.
import { P, heldItem, shoulderPlank } from './parts.js';

// A small stepped ball of size (w, h, d): three crossed boxes and a core, so that the corners are
// cut (the heads of the animals).
function ball(name, [w, h, d], color, at, extra = {}) {
  const c = (k) => Math.max(1, k - 2);
  return [
    P(`${name}`, [w, c(h), c(d)], color, at, extra),
    P(`${name}Y`, [c(w), h, c(d)], color, at, extra),
    P(`${name}Z`, [c(w), c(h), d], color, at, extra),
    P(`${name}C`, [w - 1, h - 1, d - 1], color, at, extra),
  ];
}

// A box with its long edges cut by one unit: two crossed boxes.
function bevel(name, [w, h, d], color, at, extra = {}) {
  return [P(name, [w, h, d - 1], color, at, extra), P(`${name}B`, [w - 1, h, d], color, at, extra)];
}

// The head of a person: a rounded box with a large flat face (6 units wide and 5 to 6 tall, in
// quarter blocks), its vertical edges cut by half a unit, a round top under the hair, and ears. No
// steps under the chin. The front of the face is at z 3.5, the top of the skull at y 3, and the
// chin at y -3. A child has a round face, wider than it is long, full cheeks, and a soft small
// chin; a grown-up has a jaw that is narrower at the sides and a small nose with no ink.
export const HEAD = 7;
function headParts(skin, extra, child) {
  if (child) {
    return [
      P('skull', [6.4, 5.5, 7], skin, [0, 0.25, 0], extra),
      P('skullChin', [5.2, 0.6, 6.6], skin, [0, -2.8, 0], extra),
      P('skullX', [7.2, 4.4, 6], skin, [0, 0.5, 0], extra),
      P('skullTop', [6.2, 0.75, 6.2], skin, [0, 3.2, 0], extra),
      P('earL', [0.6, 1.3, 1.1], skin, [-3.9, -0.6, 0.2], extra),
      P('earR', [0.6, 1.3, 1.1], skin, [3.9, -0.6, 0.2], extra),
    ];
  }
  return [
    P('skull', [6, 4.5, 7], skin, [0, 0.75, 0], extra),
    P('skullJaw', [5, 1.5, 7], skin, [0, -2.25, 0], extra),
    P('skullX', [7, 4, 6], skin, [0, 1, 0], extra),
    P('skullTop', [6, 0.75, 6], skin, [0, 3.2, 0], extra),
    P('earL', [0.6, 1.4, 1.2], skin, [-3.75, -0.4, 0.2], extra),
    P('earR', [0.6, 1.4, 1.2], skin, [3.75, -0.4, 0.2], extra),
    P('nose', [0.7, 0.9, 0.45], skin, [0, -0.55, 3.7], { ...extra, noInk: true }),
  ];
}

// The pale tone of a skin (the cheeks of a grown-up), and the next darker tone (the neck, in the
// shadow under the chin).
const PALE = { skin4: 'skin3', skin3: 'skin2', skin2: 'skin1', skin1: 'vermilionPale' };
const SHADE = { skin1: 'skin2', skin2: 'skin3', skin3: 'skin4', skin4: 'wood' };

// The face on the front of a head: eyes (a white, a dark dot, and a small white highlight), brows,
// cheeks, and a mouth. face: 1 to 4 (data/figures.json): 2 smiles, 3 has the eyes higher, 4 has a
// small open mouth. mood: calm, happy (brows up a little, a wide smile with the ends up), worried
// (the inner ends of the brows up, the ends of the mouth down), or surprised (brows high, large
// eyes, a small round mouth), for the portraits (src/world/portraits.js). A child has the eyes
// lower on the head under a large forehead, larger and darker and a little wider apart, thin short
// brows, rosy cheeks, and a small mouth close to the eyes (soft brown, or vermilion for a smile).
function faceParts(face, skin, mood = 'calm', child = false) {
  const out = [];
  const head = { parent: 'head', mark: true };
  const z = 3.53;
  const eyeY = child ? (face === 3 ? -0.1 : -0.35) : face === 3 ? 0.55 : 0.25;
  const ex = child ? 1.6 : 1.45;
  const eye = child ? [1.25, 1.35] : [1.15, 1.2];
  const pupil = child ? [0.8, 1] : [0.65, 0.85];
  const brow = child ? [0.85, 0.2] : [1.15, 0.28];
  const browUp = child ? 1.15 : 1.05;
  const wide = mood === 'surprised' ? 0.25 : 0;
  const lift = { happy: 0.15, surprised: 0.4 }[mood] ?? 0;
  for (const [side, x] of [['L', -ex], ['R', ex]]) {
    const inward = side === 'L' ? 1 : -1;
    out.push(P(`eyeW${side}`, [eye[0] + wide, eye[1] + wide, 0.05], 'diep', [x, eyeY, z], head));
    out.push(P(`eye${side}`, [pupil[0] + wide / 2, pupil[1] + wide / 2, 0.06], 'ink', [x + inward * 0.18, eyeY - 0.08, z + 0.01], head));
    out.push(P(`shine${side}`, [0.22, 0.22, 0.07], 'diep', [x + inward * 0.18 + 0.14, eyeY + 0.16, z + 0.02], head));
    const by = eyeY + browUp + lift + wide / 2;
    if (mood === 'worried') {
      // The inner end of the brow (near the nose) is higher: two short steps.
      out.push(P(`brow${side}`, [0.6, brow[1], 0.05], 'ink', [x - Math.sign(x) * 0.25, by + 0.25, z], head));
      out.push(P(`browO${side}`, [0.6, brow[1], 0.05], 'ink', [x + Math.sign(x) * 0.3, by - 0.05, z], head));
    } else out.push(P(`brow${side}`, [brow[0], brow[1], 0.05], 'ink', [x, by, z], head));
    out.push(P(`cheek${side}`, child ? [1.05, 0.6, 0.05] : [0.9, 0.5, 0.05], child ? 'vermilionPale' : (PALE[skin] ?? 'vermilionPale'), [x * (child ? 1.45 : 1.55), child ? eyeY - 1 : -1, z], head));
  }
  const color = face === 2 || face === 4 ? 'vermilion' : child ? 'wood' : 'ink';
  const my = child ? eyeY - 1.45 : -1.75;
  const ends = (y, w, c) => {
    for (const s of [-1, 1]) out.push(P(`mouth${s > 0 ? 'R' : 'L'}`, [0.35, 0.25, 0.05], c, [s * (w / 2 + 0.12), y, z], head));
  };
  if (mood === 'happy') {
    out.push(P('mouth', [1.3, 0.3, 0.05], 'vermilion', [0, my, z], head));
    ends(my + 0.25, 1.3, 'vermilion');
  } else if (mood === 'worried') {
    out.push(P('mouth', [0.9, 0.25, 0.05], 'ink', [0, my + 0.1, z], head));
    ends(my - 0.15, 0.9, 'ink');
  } else if (mood === 'surprised') out.push(P('mouth', [0.65, 0.75, 0.05], 'ink', [0, my, z], head));
  else if (face === 4) out.push(P('mouth', [0.65, 0.5, 0.05], 'vermilion', [0, my, z], head));
  else {
    // A slight smile: a middle line, and its ends a little higher.
    const w = (face === 2 ? 1 : 0.7) * (child ? 0.8 : 1);
    out.push(P('mouth', [w, 0.25, 0.05], color, [0, my, z], head));
    ends(my + 0.15, w, color);
  }
  return out;
}

// The eyes of a creature (Nghé): a white and a dark dot on each side, with no brows and no cheeks.
// z: the front of the head; ex: the half distance of the eyes.
function creatureEyes(z, ex) {
  const head = { parent: 'head', mark: true };
  const out = [];
  for (const [side, x] of [['L', -ex], ['R', ex]]) {
    out.push(P(`eyeW${side}`, [0.9, 0.9, 0.05], 'diep', [x, 0.1, z], head));
    out.push(P(`eye${side}`, [0.45, 0.55, 0.06], 'ink', [x + (side === 'L' ? 0.15 : -0.15), 0.05, z + 0.01], head));
  }
  return out;
}

// The parts of the cap of the hair, the same for each style (the styles add their own parts).
export const HAIR_CAP = Object.freeze(['hairTop', 'hairCrown', 'hairline', 'hairBack', 'hairSideL', 'hairSideR']);
// The top of the cap of the hair over the middle of the head.
const CAP_TOP = 4.65;

// The hair: a cap over the top, the back, and the sides down to the ears, with its front edge in
// front of the skull (no strip of scalp shows), and the parts of a style, so that the styles differ
// from the front: a fringe parted on the left (short), the hair pulled back to a knot on the crown
// with a red tie (topknot), a part in the middle with the hair on both sides of the face down to
// the shoulders (long), two braids in front of the shoulders with red ties (braids), the hair
// pulled back over the temples to a low bun with a pin (bun), and the tuft of a child (trái đào) on
// a short crop (tufts). hat: a hat covers the top, so the knot and the tuft are not made.
function hairParts(style, hc, extra, hat) {
  const H = (n, size, at, x = {}) => P(n, size, hc, at, { ...extra, ...x });
  const out = [];
  const crop = style === 'tufts';
  const t = crop ? 0.5 : 1; // the thickness of the cap
  const covered = hat === 'non' || hat === 'helmet' || hat === 'plume';
  out.push(H('hairTop', [7.2, t, 7.6], [0, 3.1 + t / 2, -0.1]));
  out.push(H('hairCrown', [5.4, 0.6, 6], [0, 3.35 + t, -0.1]));
  out.push(H('hairline', [6.4, 0.5, 0.5], [0, 2.95, 3.5]));
  out.push(H('hairBack', [7.4, crop ? 4 : 5.5, t], [0, crop ? 1 : 0.35, -3.5 - t / 2]));
  out.push(H('hairSideL', [t, 2.6, 5.4], [-3.5 - t / 2, 1.75, -0.6]));
  out.push(H('hairSideR', [t, 2.6, 5.4], [3.5 + t / 2, 1.75, -0.6]));
  if (style === 'short') {
    // Locks of different lengths, longer to the right (the part is on the left), over the brows
    // but never over the eyes. They lift in the air from the front.
    out.push(H('fringe', [2, 0.8, 0.5], [-1.9, 2.85, 3.6], { pivotTop: true, hang: 'lift' }));
    out.push(H('fringe2', [2, 1, 0.5], [0.1, 2.75, 3.65], { pivotTop: true, hang: 'lift' }));
    out.push(H('fringe3', [2.2, 1.25, 0.5], [2.2, 2.6, 3.6], { pivotTop: true, hang: 'lift' }));
  }
  if (style === 'topknot' && !covered) {
    out.push(H('knot', [2.2, 1.9, 2.2], [0, 5.3, -0.3], { pivotBottom: true, hang: 'bob' }));
    out.push(P('knotTie', [2.3, 0.35, 2.3], 'vermilion', [0, 5.45, -0.3], extra));
  }
  if (style === 'long' || style === 'braids') {
    out.push(H('fringeL', [2.6, 0.8, 0.5], [-1.6, 2.8, 3.6]));
    out.push(H('fringeR', [2.6, 0.8, 0.5], [1.6, 2.8, 3.6]));
    out.push(H('curtainL', [1.1, 4.2, 2.6], [-3.6, 0.5, 2]));
    out.push(H('curtainR', [1.1, 4.2, 2.6], [3.6, 0.5, 2]));
  }
  if (style === 'long') {
    out.push(H('tail', [7.4, 6, 1.2], [0, -3.2, -3.9], { pivotTop: true, hang: 'hang' }));
    out.push(H('lockL', [1.2, 3.5, 2.4], [-3.65, -3, 0.4], { pivotTop: true, hang: 'hang' }));
    out.push(H('lockR', [1.2, 3.5, 2.4], [3.65, -3, 0.4], { pivotTop: true, hang: 'hang' }));
  }
  if (style === 'braids') {
    for (const s of [-1, 1]) {
      out.push(H(`braid${s}`, [1.3, 5, 1.3], [s * 3.3, -1.6, 1.4], { pivotTop: true, hang: 'hang' }));
      out.push(P(`braidTie${s}`, [1.45, 0.4, 1.45], 'vermilion', [0, -4.8, 0], { ...extra, parent: `braid${s}` }));
    }
  }
  if (style === 'bun') {
    // The hair goes back over the temples to the bun.
    out.push(H('sweepL', [1, 1.6, 2.4], [-3.55, 2.1, 2.2]));
    out.push(H('sweepR', [1, 1.6, 2.4], [3.55, 2.1, 2.2]));
    out.push(H('knot', [3, 2.6, 2.4], [0, 0, -4.9], { hang: 'bob' }));
    out.push(P('pin', [4.2, 0.3, 0.3], 'yellow', [0.3, 0.4, -5], extra));
  }
  if (style === 'tufts' && !covered) {
    out.push(H('tuft', [2.2, 1.6, 2.2], [0, 4.4, 1.6], { pivotBottom: true, hang: 'bob' }));
    out.push(H('tuftTip', [1.2, 1, 1.2], [0, 6, 2.4], { pivotBottom: true, hang: 'bob' }));
  }
  return out;
}

// The height (in blocks) of a person from the ground to the top of the hair, as the coarse person
// (src/world/figures.js), so that both levels have the same size in the world.
export const TALL = Object.freeze({ child: 2.34, adult: 2.87 });

// The shape of the hair of a look: grey hair keeps the grey color with the shape in hairStyle
// (data/figures.json; a bun for grandma, short for the elders with a beard).
export const hairStyleOf = (look) => (look.hair === 'grey' ? look.hairStyle ?? 'short' : look.hair ?? 'short');

// A person. The same look as the coarse person (src/world/figures.js): { child, skin, top, bottom,
// sash, bottomKind (shorts, skirt, trousers, robe), topKind (shirt, yem, bare, robe), hair,
// hairStyle, hairColor, beard, hat (non, band, helmet, plume), item, face, mood, scale }.
export function personFine(look) {
  const child = Boolean(look.child);
  const skin = look.skin ?? 'skin2';
  const hairColor = look.hairColor ?? 'ink';
  const shin = child ? 2.5 : 3;
  const thigh = child ? 2.5 : 3;
  const hip = 1 + shin + thigh;
  // The torso: as wide as the hips at the sash, a waist over the sash, and the chest one unit
  // narrower up to the shoulders.
  const bodyH = child ? 4.5 : 5.5;
  const bodyW = child ? 5 : 6.5;
  const bodyD = child ? 4 : 4.5;
  const chestW = bodyW - 1;
  const shoulder = hip + bodyH;
  const armLen = child ? 3.5 : 4.25;
  const headY = shoulder + 0.75 + HEAD / 2;
  const legX = child ? 1.25 : 1.5;
  const parts = [];
  const trousers = look.bottomKind === 'trousers';
  const covered = look.bottomKind === 'skirt' || look.bottomKind === 'robe';
  // Legs hang from the hips; the shin hangs from the knee, and the foot from the ankle.
  for (const [side, x] of [['L', -legX], ['R', legX]]) {
    const thighColor = trousers || look.bottomKind === 'shorts' ? look.bottom : skin;
    parts.push(P(`leg${side}`, [2, thigh, 2], thighColor, [x, hip, 0], { pivotTop: true }));
    parts.push(P(`shin${side}`, [1.75, shin, 1.75], trousers ? look.bottom : skin, [0, -thigh, 0], { parent: `leg${side}`, pivotTop: true }));
    // The hem of the trousers (at the ankle) and of the shorts (at the knee).
    if (trousers) parts.push(P(`hem${side}`, [2.1, 0.5, 2.1], look.bottom, [0, -shin + 0.25, 0], { parent: `shin${side}` }));
    if (look.bottomKind === 'shorts') parts.push(P(`hem${side}`, [2.35, 0.75, 2.35], look.bottom, [0, -thigh + 0.4, 0], { parent: `leg${side}` }));
    // A bare foot with two toes.
    parts.push(P(`foot${side}`, [1.75, 1, 2.75], skin, [0, -shin, 0.4], { parent: `shin${side}`, pivotTop: true }));
    for (const t of [-0.45, 0.45]) parts.push(P(`toe${side}${t > 0 ? 'b' : 'a'}`, [0.7, 0.5, 0.75], skin, [t, -0.75, 1.55], { parent: `foot${side}` }));
  }
  if (covered) {
    const robe = look.bottomKind === 'robe';
    const h = robe ? thigh + shin + bodyH * 0.5 : thigh + 1;
    const top = robe ? hip + bodyH * 0.5 : hip + 0.5;
    // The skirt hangs from the waist and swings a little; its hem is on it.
    parts.push(P('skirt', [bodyW + 0.5, h, bodyD + 0.5], look.bottom, [0, top, 0], { pivotTop: true, hang: 'cloth' }));
    parts.push(P('hemSkirt', [bodyW + 0.75, 0.5, bodyD + 0.75], look.bottom, [0, -h + 0.25, 0], { parent: 'skirt' }));
  }
  // The body: hips, a waist, a chest with cut corners, sloping shoulders, a collar line, and a sash
  // with a tail.
  const topColor = look.topKind === 'bare' || look.topKind === 'yem' ? skin : look.top;
  const chestH = bodyH - 2.5;
  parts.push(P('hips', [bodyW, 1.5, bodyD], topColor, [0, hip + 0.75, 0]));
  parts.push(P('waist', [bodyW - 1.5, 1, bodyD - 0.5], topColor, [0, hip + 2, 0]));
  parts.push(...bevel('torso', [chestW, chestH, bodyD], topColor, [0, hip + 2.5 + chestH / 2, 0]));
  parts.push(P('shoulders', [chestW - 1.5, 0.75, bodyD - 1], topColor, [0, shoulder + 0.375, 0]));
  // One short neck in the next darker tone of the skin, set back a little: the shadow under the
  // chin. A child has a thinner and shorter neck.
  parts.push(P('neck', child ? [2, 1.2, 2] : [2.4, 1.4, 2.4], SHADE[skin] ?? skin, [0, shoulder + 0.6, -0.3]));
  if (look.topKind === 'shirt' || look.topKind === 'robe') {
    parts.push(P('collarL', [0.3, 1.5, 0.05], 'ink', [-0.45, shoulder - 0.55, bodyD / 2 + 0.03], { mark: true }));
    parts.push(P('collarR', [0.3, 1.5, 0.05], 'ink', [0.45, shoulder - 0.55, bodyD / 2 + 0.03], { mark: true }));
  }
  if (look.topKind === 'yem') parts.push(P('yem', [3, 3, 0.4], look.sash ?? 'vermilion', [0, hip + 2.5 + chestH / 2, bodyD / 2 + 0.1]));
  if (look.sash) {
    parts.push(P('sash', [bodyW + 0.25, 1, bodyD + 0.25], look.sash, [0, hip + 0.75, 0]));
    parts.push(P('sashTail', [0.75, 2.25, 0.5], look.sash, [bodyW / 2 - 0.75, hip + 0.475, bodyD / 2 + 0.2], { pivotTop: true, hang: 'hang' }));
  }
  // Arms hang from the shoulders; the sleeves of the áo hang over the hands.
  const sleeved = look.topKind === 'shirt' || look.topKind === 'robe';
  for (const [side, x] of [['L', -(chestW / 2 + 0.75)], ['R', chestW / 2 + 0.75]]) {
    parts.push(P(`arm${side}`, [1.5, armLen, 1.5], sleeved ? look.top : skin, [x, shoulder - 0.25, 0], { pivotTop: true }));
    if (sleeved) parts.push(P(`cuff${side}`, [1.9, 1, 1.9], look.top, [0, -armLen + 1, 0], { parent: `arm${side}`, pivotTop: true, hang: 'cloth' }));
    parts.push(P(`hand${side}`, [1.25, 1.25, 1.25], skin, [0, -armLen - 0.4, 0], { parent: `arm${side}` }));
  }
  // The head: a head with a large flat face, a face by age, hair, and a hat.
  const onHead = { parent: 'head' };
  parts.push(P('head', [0.01, 0.01, 0.01], null, [0, headY, 0]));
  parts.push(...headParts(skin, onHead, child));
  parts.push(...faceParts(look.face ?? 1, skin, look.mood, child));
  const hair = look.hair ?? 'short';
  const style = hairStyleOf(look);
  if (hair !== 'bald') parts.push(...hairParts(style, hair === 'grey' ? 'ashLight' : hairColor, onHead, look.hat));
  if (look.beard) parts.push(P('beard', [3.5, 2.5, 1.5], look.beard === true ? 'ashLight' : look.beard, [0, -3.25, 3], onHead));
  // The top of the head: the cap of the hair (with a knot or a tuft over it), or the bald skull.
  const hairTop = hair === 'bald' ? 3.6 : CAP_TOP;
  const capped = look.hat === 'non' || look.hat === 'helmet' || look.hat === 'plume';
  let top = hairTop + (hair === 'bald' || capped ? 0 : style === 'topknot' ? 2.55 : style === 'tufts' ? 2.35 : 0);
  // The hats sit on the top of each hair style, with no hair through a hat.
  if (look.hat === 'non') {
    // The nón lá: a stepped cone on the hair.
    parts.push(P('hat', [10, 0.6, 10], 'yellowPale', [0, hairTop - 0.7, 0], onHead));
    parts.push(P('hat2', [6.5, 0.6, 6.5], 'yellowPale', [0, hairTop - 0.1, 0], onHead));
    parts.push(P('hat3', [3, 0.6, 3], 'yellowPale', [0, hairTop + 0.5, 0], onHead));
    // The strings of the nón hang from the rim at the sides of the head.
    for (const s of [-1, 1]) parts.push(P(`string${s > 0 ? 'R' : 'L'}`, [0.25, 3.5, 0.25], 'paperDeep', [s * 4.65, hairTop - 1, 0.5], { ...onHead, pivotTop: true, hang: 'hang' }));
    top = hairTop + 0.8;
  }
  if (look.hat === 'band') parts.push(P('band', [9, 1, 9], look.sash ?? 'vermilion', [0, 1.8, 0], onHead));
  if (look.hat === 'helmet' || look.hat === 'plume') {
    parts.push(P('helmet', [9, 3, 9], 'ash', [0, 3.2, 0], onHead), P('helmetTop', [6.4, 1, 6.4], 'ash', [0, 5, 0], onHead));
    top = 5.5;
    if (look.hat === 'plume') {
      parts.push(P('plume', [1, 2.5, 2.5], 'vermilion', [0, 6.75, -0.5], onHead));
      top = 8;
    }
  }
  // Something in the hands, and a plank on the right shoulder.
  parts.push(...heldItem(look.item, (dx, dy, dz) => [dx * 2, dy * 2 + 0.5, dz * 2], 2, 'handR', 'handL'));
  // The scale gives the size of the coarse person (a look with its own scale, as Gióng who grows,
  // is in the scale of the coarse person: the same ratio).
  const base = headY + hairTop;
  const scale = (child ? TALL.child : TALL.adult) / (0.25 * base) * (look.scale ? look.scale / (child ? 0.6 : 0.66) : 1);
  parts.push(...shoulderPlank(look.item, 2 / scale, chestW / 2 + 0.25, shoulder));
  // crown: the top of the head for the frame of a portrait (src/world/portraits.js): the hat, or
  // the cap of the hair with the lower half of a knot or a tuft, so that a tall knot does not make
  // the face small and the style still shows.
  const knot = hair === 'bald' || capped ? 0 : style === 'topknot' ? 1.6 : style === 'tufts' ? 1.4 : 0;
  return { kind: 'biped', parts, scale, grid: 0.25, height: headY + top, crown: headY + (capped ? top : hairTop + knot), shadow: 5 };
}

// Nghé, the buffalo calf: a stepped barrel, legs that bend at one joint, a head with a muzzle and
// eyes, horns that curve in three steps, ears, and a tail with a tuft. The diagonal legs move
// together. colors: { body, leg, horn, muzzle }.
export function ngheFine(colors = {}) {
  const body = colors.body ?? 'ashLight';
  const leg = colors.leg ?? 'ash';
  const horn = colors.horn ?? 'diep';
  const muzzle = colors.muzzle ?? 'paperDeep';
  const parts = [];
  // The barrel: its corners cut by one unit, and a pale belly.
  parts.push(...bevel('trunk', [5, 4.5, 9], body, [0, 6.5, 0]));
  parts.push(P('back', [4, 1, 8], body, [0, 8.9, 0]));
  parts.push(P('belly', [3, 0.25, 6], muzzle, [0, 4.2, 0], { mark: true }));
  const legs = [['FL', -1.6, 3], ['FR', 1.6, 3], ['BL', -1.6, -3], ['BR', 1.6, -3]];
  for (const [n, x, z] of legs) {
    parts.push(P(`leg${n}`, [1.75, 2.5, 1.75], body, [x, 5, z], { pivotTop: true }));
    parts.push(P(`shin${n}`, [1.5, 2, 1.5], leg, [0, -2.5, 0], { parent: `leg${n}`, pivotTop: true }));
    parts.push(P(`hoof${n}`, [1.75, 0.75, 1.75], 'ink', [0, -2.4, 0.1], { parent: `shin${n}` }));
  }
  parts.push(P('head', [0.01, 0.01, 0.01], null, [0, 8, 4.5]));
  parts.push(...ball('skull', [4, 4, 4], body, [0, 0, 1.5], { parent: 'head' }).slice(0, 3));
  parts.push(P('muzzle', [3, 2, 1.75], muzzle, [0, -1, 3.75], { parent: 'head' }));
  for (const s of [-0.7, 0.7]) parts.push(P(`nostril${s > 0 ? 'R' : 'L'}`, [0.4, 0.4, 0.05], 'ink', [s, -0.8, 4.65], { parent: 'head', mark: true }));
  parts.push(...creatureEyes(3.53, 0.9).map((p) => ({ ...p, at: [p.at[0] * 1.2, p.at[1] + 0.6, p.at[2]] })));
  // The horns curve out, up, and back, in three steps.
  for (const s of [-1, 1]) {
    const n = s > 0 ? 'R' : 'L';
    parts.push(P(`horn${n}1`, [1.25, 1, 1], horn, [s * 2.4, 1.6, 1.4], { parent: 'head' }));
    parts.push(P(`horn${n}2`, [1, 1, 1], horn, [s * 3.1, 2.3, 1.1], { parent: 'head' }));
    parts.push(P(`horn${n}3`, [0.75, 1, 0.75], horn, [s * 3.3, 3.1, 0.6], { parent: 'head' }));
    parts.push(P(`ear${n}`, [1.5, 0.75, 1], body, [s * 2.6, 0.5, 0.9], { parent: 'head', hang: 'ear' }));
  }
  parts.push(P('tail', [0.6, 3.5, 0.6], leg, [0, 8, -4.5], { pivotTop: true, hang: 'tail' }));
  parts.push(P('tuft', [1, 1, 1], 'ink', [0, -3.5, 0], { parent: 'tail' }));
  return { kind: 'quadruped', parts, scale: 0.41, grid: 0.25, height: 12, shadow: 4.6 };
}

// A buffalo of another family: like Nghé, grown up and darker.
export function buffaloFine() {
  return { ...ngheFine({ body: 'ash', leg: 'ink', horn: 'paperDeep', muzzle: 'ashLight' }), scale: 0.6 };
}

// A dog of the village: ochre, with a muzzle, ears that stand, and a tail up.
export function dogFine() {
  const parts = [...bevel('trunk', [3, 2.75, 6], 'ochre', [0, 5, 0])];
  const legs = [['FL', -1, 2], ['FR', 1, 2], ['BL', -1, -2], ['BR', 1, -2]];
  for (const [n, x, z] of legs) {
    parts.push(P(`leg${n}`, [1, 2, 1], 'ochre', [x, 4, z], { pivotTop: true }));
    parts.push(P(`shin${n}`, [0.9, 2, 0.9], 'wood', [0, -2, 0], { parent: `leg${n}`, pivotTop: true }));
  }
  parts.push(P('head', [0.01, 0.01, 0.01], null, [0, 6.5, 3]));
  parts.push(...ball('skull', [3, 3, 3], 'ochre', [0, 0.25, 0.75], { parent: 'head' }).slice(0, 3));
  parts.push(P('muzzle', [1.75, 1.25, 1.75], 'yellowPale', [0, -0.5, 2.5], { parent: 'head' }));
  parts.push(P('nose', [0.6, 0.5, 0.05], 'ink', [0, -0.2, 3.4], { parent: 'head', mark: true }));
  for (const s of [-1, 1]) {
    const n = s > 0 ? 'R' : 'L';
    parts.push(P(`ear${n}`, [0.75, 1.5, 0.5], 'wood', [s * 1, 2, 0.5], { parent: 'head' }));
    parts.push(P(`eyeW${n}`, [0.7, 0.7, 0.05], 'diep', [s * 0.7, 0.6, 2.28], { parent: 'head', mark: true }));
    parts.push(P(`eye${n}`, [0.35, 0.45, 0.06], 'ink', [s * 0.62, 0.55, 2.3], { parent: 'head', mark: true }));
  }
  parts.push(P('tail', [0.5, 2.5, 0.5], 'wood', [0, 6, -3], { pivotTop: true, hang: 'tail' }));
  return { kind: 'quadruped', parts, scale: 0.39, grid: 0.25, height: 9, shadow: 3 };
}

// A chicken: legs that swing, wings that flap when it runs, and a head that pecks.
export function chickenFine(look = {}) {
  const c = look.color ?? 'diep';
  const parts = [];
  for (const [n, x] of [['L', -0.7], ['R', 0.7]]) {
    parts.push(P(`leg${n}`, [0.5, 2, 0.5], 'yellow', [x, 2, 0], { pivotTop: true }));
    parts.push(P(`foot${n}`, [1, 0.25, 1.25], 'yellow', [0, -2, 0.3], { parent: `leg${n}` }));
  }
  parts.push(...bevel('trunk', [3, 2.5, 4], c, [0, 3.2, 0]));
  // The tail feathers stand up from their base and move with the wind.
  parts.push(P('tailF', [1.75, 2.5, 1], c === 'diep' ? 'ashLight' : 'wood', [0, 3.15, -2.2], { pivotBottom: true, hang: 'tail' }));
  parts.push(P('wingL', [0.5, 1.75, 3], c, [-1.6, 3.8, 0], { pivotTop: true }));
  parts.push(P('wingR', [0.5, 1.75, 3], c, [1.6, 3.8, 0], { pivotTop: true }));
  parts.push(P('head', [0.01, 0.01, 0.01], null, [0, 5, 1.6]));
  parts.push(P('skull', [2, 2, 2], c, [0, 0.4, 0], { parent: 'head' }));
  parts.push(P('comb', [0.5, 1, 1.5], 'vermilion', [0, 1.8, 0], { parent: 'head' }));
  parts.push(P('wattle', [0.5, 0.75, 0.5], 'vermilion', [0, -0.75, 0.9], { parent: 'head' }));
  parts.push(P('beak', [0.75, 0.5, 1], 'yellow', [0, 0.1, 1.4], { parent: 'head' }));
  for (const s of [-1, 1]) {
    const n = s > 0 ? 'R' : 'L';
    parts.push(P(`eye${n}`, [0.05, 0.45, 0.45], 'ink', [s * 1.03, 0.6, 0.35], { parent: 'head', mark: true }));
  }
  return { kind: 'fowl', parts, scale: 0.45, grid: 0.25, height: 7.5, shadow: 1.8 };
}

// A duck on the water: a body, a neck, a head with a beak, and eyes.
// The coat of a duck: 'brown' for the ducks of another farm (a brown body and head), else a white
// body with a green head.
const COATS = { white: { body: 'diep', wing: 'ashLight', head: 'green' }, brown: { body: 'ochre', wing: 'wood', head: 'wood' } };
export const coatOf = (coat) => COATS[coat] ?? COATS.white;

export function duckFine(coat) {
  const c = coatOf(coat);
  const parts = [
    ...bevel('trunk', [3, 2, 4.5], c.body, [0, 0.6, 0]),
    P('tailF', [1.5, 1, 1], c.body, [0, 1.3, -2.6]),
    P('wingL', [0.4, 1, 2.5], c.wing, [-1.55, 1, -0.2]),
    P('wingR', [0.4, 1, 2.5], c.wing, [1.55, 1, -0.2]),
    P('neck', [1.25, 1.75, 1.25], c.head, [0, 2.2, 1.6]),
    P('head', [2, 2, 2.25], c.head, [0, 3.4, 1.9]),
    P('beak', [1.25, 0.5, 1.5], 'yellow', [0, 3.1, 3.4]),
  ];
  for (const s of [-1, 1]) parts.push(P(`eye${s > 0 ? 'R' : 'L'}`, [0.05, 0.4, 0.4], 'ink', [s * 1.03, 3.6, 2.4], { mark: true }));
  return { kind: 'float', parts, scale: 0.32, grid: 0.25, height: 4.5, shadow: 0 };
}

// A fish at the ford: a body, a tail that wiggles, fins, and an eye.
export function fishFine() {
  const parts = [
    ...bevel('trunk', [1.25, 1.75, 4], 'ash', [0, 0, 0]),
    P('tail', [0.25, 1.75, 1.25], 'ashLight', [0, 0, -2.5]),
    P('fin', [0.25, 0.75, 1.5], 'ashLight', [0, 1.2, 0]),
  ];
  for (const s of [-1, 1]) parts.push(P(`eye${s > 0 ? 'R' : 'L'}`, [0.05, 0.4, 0.4], 'ink', [s * 0.65, 0.3, 1.4], { mark: true }));
  return { kind: 'fish', parts, scale: 0.46, grid: 0.25, height: 1.75, shadow: 0 };
}
