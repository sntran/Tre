// The fine people and animals: built on a grid of quarter blocks (FIGURE_UNIT 0.25), so that they
// read as figures of a print and not as stacks of bricks. Pure data, no WebGL (the parts:
// src/world/parts.js). Round where a print is round: a head is a stepped ball of seven units, the
// hair a cap two units thick that follows it, the torso has a waist and narrower shoulders, and
// the barrel of Nghé has its corners cut by one unit. A smooth variant (smooth heads, for the
// comparison on docs/reference/figures.html) keeps the same body. Faces
// have eyes (a white and a dark dot), brows, a mouth, and cheeks. Legs bend at one joint (the
// knee), and the feet lift at the heel. The coarse figures of src/world/figures.js are the far
// level of detail.
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

// A round head of seven units: a stepped ball whose layers are 7, 5, and 3 units wide (the middle
// layer is a cross of 7 by 5 and 5 by 7, then 5 by 5 layers, then 3 by 3 caps), so that its outline
// is round from every side. The front of the face is at z 3.5.
export const HEAD = 7;
function roundHead(color, extra) {
  return [
    P('skull', [7, 3, 5], color, [0, 0, 0], extra),
    P('skullX', [5, 3, 7], color, [0, 0, 0], extra),
    P('skullU', [5, 1, 5], color, [0, 2, 0], extra),
    P('skullD', [5, 1, 5], color, [0, -2, 0], extra),
    P('skullT', [3, 1, 3], color, [0, 3, 0], extra),
    P('skullB', [3, 1, 3], color, [0, -3, 0], extra),
  ];
}

// Hair as a cap two units thick that follows the round head (one unit out of it): a 3 by 3 top,
// a 5 by 5 layer, a cross over the forehead, and the back and the sides down to the ears. No flat
// top. The fringe stands out over the brows.
function hairCap(color, extra) {
  return [
    P('hairT', [3, 1, 3], color, [0, 4, 0], extra),
    P('hairU', [5, 1, 5], color, [0, 3, 0], extra),
    P('hair', [7, 1, 5], color, [0, 2, -0.25], extra),
    P('hairX', [5, 1, 7.5], color, [0, 2, 0], extra),
    P('hairBack', [7, 3, 1], color, [0, 0, -4], extra),
    P('hairSideL', [1, 3, 4], color, [-4, 0, -1.5], extra),
    P('hairSideR', [1, 3, 4], color, [4, 0, -1.5], extra),
    P('hairNape', [5, 1, 1], color, [0, -2, -3], extra),
    // The fringe turns about its top, so that it lifts in the air from the front.
    P('fringe', [5, 1, 1], color, [0, 2.25, 3.8], { ...extra, pivotTop: true, hang: 'lift' }),
  ];
}

// A face on the front of a head: eyes (a white and a dark dot), brows, a mouth, and cheeks. face:
// 1 to 4 (data/figures.json): 2 smiles, 3 has the eyes higher, 4 has a small open mouth. A creature
// (Nghé) has no brows and no cheeks. z: the front of the head; ex: the half distance of the eyes.
// smooth: the face of a smooth head: each mark sits on the ball, the eyes are one unit larger, and
// the mouth is a slight upward curve (a flat line on a ball reads as a frown).
function faceParts(face, skin, { brows = true, cheeks = true, z = HEAD / 2 + 0.03, ex = 1.1, smooth = false } = {}) {
  const out = [];
  const eyeY = face === 3 ? 0.5 : 0.1;
  const head = { parent: 'head', mark: true };
  // On a ball the face goes back from the middle (an icosphere is a little inside its ball).
  const zAt = (x, y) => (smooth ? Math.sqrt(Math.max(0, (HEAD / 2) ** 2 - x * x - y * y)) * 0.97 + 0.06 : z);
  const big = smooth ? 1 : 0;
  const eyeX = smooth ? ex + 0.35 : ex;
  for (const [side, x] of [['L', -eyeX], ['R', eyeX]]) {
    out.push(P(`eyeW${side}`, [0.9 + big, 0.9 + big, 0.05], 'diep', [x, eyeY, zAt(x, eyeY)], head));
    out.push(P(`eye${side}`, [0.45 + big / 2, 0.55 + big / 2, 0.06], 'ink', [x + (side === 'L' ? 0.15 : -0.15), eyeY - 0.05, zAt(x, eyeY) + 0.01], head));
    if (brows) out.push(P(`brow${side}`, [1 + big / 2, 0.25, 0.05], 'ink', [x, eyeY + 0.85 + big / 2, zAt(x, eyeY + 0.85 + big / 2)], head));
    if (cheeks) out.push(P(`cheek${side}`, [0.75, 0.45, 0.05], PALE[skin] ?? 'vermilionPale', [x * 1.55, -0.7, zAt(x * 1.55, -0.7)], head));
  }
  const color = face === 2 || face === 4 ? 'vermilion' : 'ink';
  if (face === 4) out.push(P('mouth', [0.6, 0.5, 0.05], 'vermilion', [0, -1.1, zAt(0, -1.1)], head));
  else if (smooth) {
    // A slight smile: a middle line, and its ends a little higher.
    const w = face === 2 ? 0.8 : 0.5;
    out.push(P('mouth', [w, 0.25, 0.05], color, [0, -1.2, zAt(0, -1.2)], head));
    for (const s of [-1, 1]) out.push(P(`mouth${s > 0 ? 'R' : 'L'}`, [0.35, 0.25, 0.05], color, [s * (w / 2 + 0.12), -1.05, zAt(s * (w / 2 + 0.12), -1.05)], head));
  } else out.push(P('mouth', [face === 2 ? 1.4 : 1, 0.25, 0.05], color, [0, -1.1, z], head));
  return out;
}
// The pale tone of a skin (the cheeks).
const PALE = { skin4: 'skin3', skin3: 'skin2', skin2: 'skin1', skin1: 'vermilionPale' };

// The height (in blocks) of a person from the ground to the top of the hair, as the coarse person
// (src/world/figures.js), so that both levels have the same size in the world.
const TALL = { child: 2.34, adult: 2.87 };

// A person. The same look as the coarse person (src/world/figures.js): { child, skin, top, bottom,
// sash, bottomKind (shorts, skirt, trousers, robe), topKind (shirt, yem, bare, robe), hair,
// hairColor, beard, hat (non, band, helmet, plume), item, face, scale }. smooth: the head and the
// hair are smooth balls (for the comparison on docs/reference/figures.html).
export function personFine(look, { smooth = false } = {}) {
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
  const bodyD = child ? 3.5 : 4;
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
  parts.push(P('neck', [2.5, 1.25, 2.5], skin, [0, shoulder + 0.6, 0]));
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
  // The head: a round head of seven units, a face, hair as a cap, a hat.
  const onHead = { parent: 'head' };
  parts.push(P('head', [0.01, 0.01, 0.01], null, [0, headY, 0]));
  parts.push(...(smooth ? [P('skull', [HEAD, HEAD, HEAD], skin, [0, 0, 0], { ...onHead, shape: 'ball' })] : roundHead(skin, onHead)));
  parts.push(...faceParts(look.face ?? 1, skin, { smooth }));
  const hair = look.hair ?? 'short';
  if (hair !== 'bald') {
    const hc = hair === 'grey' ? 'ashLight' : hairColor;
    // The smooth hair: a ball a little larger than the head, up and back, so that it covers the
    // top, the back, and the forehead and leaves the face.
    if (smooth) parts.push(P('hair', [8.4, 8, 8.4], hc, [0, 1, -1.2], { ...onHead, shape: 'ball' }));
    else parts.push(...hairCap(hc, onHead));
    // The parts that hang swing from the head (src/world/sway.js); a knot, a bun, and tufts bob.
    // On the smooth hair the topknot stands higher and taller, so that it reads as a topknot.
    if (hair === 'topknot') parts.push(smooth ? P('knot', [2, 2.25, 2], hc, [0, 4.6, -0.6], { ...onHead, pivotBottom: true, hang: 'bob' }) : P('knot', [2, 1.5, 2], hc, [0, 4.35, -0.5], { ...onHead, pivotBottom: true, hang: 'bob' }));
    if (hair === 'bun') parts.push(P('knot', [2.5, 2.5, 2.5], hc, [0, 1.5, -5], { ...onHead, hang: 'bob' }));
    if (hair === 'long') parts.push(P('tail', [2, 5, 1.25], hc, [0, -0.5, -4.4], { ...onHead, pivotTop: true, hang: 'hang' }));
    if (hair === 'braids') for (const s of [-1, 1]) parts.push(P(`braid${s}`, [1.25, 4.5, 1.25], hc, [s * 4, -0.75, -1], { ...onHead, pivotTop: true, hang: 'hang' }));
    if (hair === 'tufts') for (const s of [-1, 1]) parts.push(P(`tuft${s}`, [1.5, 1.5, 1.5], hc, [s * 1.5, 4.25, 0.25], { ...onHead, pivotBottom: true, hang: 'bob' }));
  }
  if (look.beard) parts.push(P('beard', [3.5, 2.5, 1.5], look.beard === true ? 'ashLight' : look.beard, [0, -3.25, 3], onHead));
  const hairTop = hair === 'bald' ? HEAD / 2 : HEAD / 2 + 1;
  let top = hairTop + (hair === 'topknot' ? 0.85 : 0);
  if (look.hat === 'non') {
    // The nón lá: a stepped cone on the hair.
    parts.push(P('hat', [10, 0.6, 10], 'yellowPale', [0, hairTop - 0.7, 0], onHead));
    parts.push(P('hat2', [6.5, 0.6, 6.5], 'yellowPale', [0, hairTop - 0.1, 0], onHead));
    parts.push(P('hat3', [3, 0.6, 3], 'yellowPale', [0, hairTop + 0.5, 0], onHead));
    // The strings of the nón hang from the rim at the sides of the head.
    for (const s of [-1, 1]) parts.push(P(`string${s > 0 ? 'R' : 'L'}`, [0.25, 3.5, 0.25], 'paperDeep', [s * 3.9, hairTop - 1, 0.5], { ...onHead, pivotTop: true, hang: 'hang' }));
    top = hairTop + 0.8;
  }
  if (look.hat === 'band') parts.push(P('band', [9, 1, 9], look.sash ?? 'vermilion', [0, 1.8, 0], onHead));
  if (look.hat === 'helmet' || look.hat === 'plume') {
    parts.push(P('helmet', [9, 2.5, 9], 'ash', [0, 3, 0], onHead), P('helmetTop', [5.5, 1, 5.5], 'ash', [0, 4.6, 0], onHead));
    top = 5.1;
    if (look.hat === 'plume') {
      parts.push(P('plume', [1, 2.5, 2.5], 'vermilion', [0, 6.2, -0.5], onHead));
      top = 7.4;
    }
  }
  // Something in the hands, and a plank on the right shoulder.
  parts.push(...heldItem(look.item, (dx, dy, dz) => [dx * 2, dy * 2 + 0.5, dz * 2], 2, 'handR', 'handL'));
  // The scale gives the size of the coarse person (a look with its own scale, as Gióng who grows,
  // is in the scale of the coarse person: the same ratio).
  const base = headY + hairTop;
  const scale = (child ? TALL.child : TALL.adult) / (0.25 * base) * (look.scale ? look.scale / (child ? 0.6 : 0.66) : 1);
  parts.push(...shoulderPlank(look.item, 2 / scale, chestW / 2 + 0.25, shoulder));
  return { kind: 'biped', parts, scale, grid: 0.25, height: headY + top, shadow: 5 };
}

// Nghé, the buffalo calf: a stepped barrel, legs that bend at one joint, a head with a muzzle and
// eyes, horns that curve in three steps, ears, and a tail with a tuft. The diagonal legs move
// together. colors: { body, leg, horn, muzzle }. smooth: the head is a smooth ball.
export function ngheFine(colors = {}, { smooth = false } = {}) {
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
  if (smooth) parts.push(P('skull', [4.5, 4.2, 4.5], body, [0, 0.1, 1.5], { parent: 'head', shape: 'ball' }));
  else parts.push(...ball('skull', [4, 4, 4], body, [0, 0, 1.5], { parent: 'head' }).slice(0, 3));
  parts.push(P('muzzle', [3, 2, 1.75], muzzle, [0, -1, 3.75], { parent: 'head' }));
  for (const s of [-0.7, 0.7]) parts.push(P(`nostril${s > 0 ? 'R' : 'L'}`, [0.4, 0.4, 0.05], 'ink', [s, -0.8, 4.65], { parent: 'head', mark: true }));
  parts.push(...faceParts(1, body, { brows: false, cheeks: false, z: 3.53, ex: 0.9 }).filter((p) => p.name !== 'mouth').map((p) => ({ ...p, at: [p.at[0] * 1.2, p.at[1] + 0.6, p.at[2]] })));
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
export function duckFine() {
  const parts = [
    ...bevel('trunk', [3, 2, 4.5], 'diep', [0, 0.6, 0]),
    P('tailF', [1.5, 1, 1], 'diep', [0, 1.3, -2.6]),
    P('wingL', [0.4, 1, 2.5], 'ashLight', [-1.55, 1, -0.2]),
    P('wingR', [0.4, 1, 2.5], 'ashLight', [1.55, 1, -0.2]),
    P('neck', [1.25, 1.75, 1.25], 'green', [0, 2.2, 1.6]),
    P('head', [2, 2, 2.25], 'green', [0, 3.4, 1.9]),
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
