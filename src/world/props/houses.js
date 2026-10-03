// Houses: houses on stilts (nhà sàn), the đình, the school, the forge, and a small hut.
// All units are fine blocks (half the size of a ground block). A prop gets its footprint:
// { fx, fz, fw, fd } (x from fx, z from fz, fw wide, fd deep). The front of a house is +z.

// The highest ground in a footprint, so that a house stands level.
export function levelOf(ctx, fx, fz, fw, fd) {
  let y = 0;
  for (let z = fz; z < fz + fd; z += 1) for (let x = fx; x < fx + fw; x += 1) y = Math.max(y, ctx.ground(x, z));
  return y;
}

// A house on stilts. opts: { postH, walls, band, roof, ridge, finials, stairs, door, sweep }.
// sweep: how high the ends of the ridge rise over its middle, in ground blocks.
export function stiltHouse(ctx, o, opts = {}) {
  const { fx, fz, fw, fd } = o;
  const r = ctx.rng;
  const gy = levelOf(ctx, fx, fz, fw, fd);
  const postH = opts.postH ?? 6 + r.int(0, 1);
  const fy = gy + postH; // the floor
  const wx0 = fx + 1;
  const wx1 = fx + fw - 2;
  const wz0 = fz + 1;
  const wz1 = fz + Math.max(4, Math.round(fd * 0.55));
  const top = fy + (opts.wallH ?? 4); // the top of the walls
  // Posts under the floor.
  const stepX = Math.max(3, Math.floor((wx1 - wx0) / 3));
  const postXs = [];
  for (let x = wx0; x < wx1; x += stepX) postXs.push(x);
  postXs.push(wx1);
  for (const px of postXs) for (const pz of [wz0, wz1]) ctx.box(px, gy, pz, px, fy - 1, pz, 'wood');
  // The floor, with a small veranda in front.
  ctx.box(wx0 - 1, fy, wz0 - 1, wx1 + 1, fy, wz1 + 2, 'wood');
  // Walls of woven bamboo, with a band.
  for (let y = fy + 1; y <= top; y++) {
    for (let x = wx0; x <= wx1; x++) {
      for (let z = wz0; z <= wz1; z++) {
        if (x !== wx0 && x !== wx1 && z !== wz0 && z !== wz1) continue;
        ctx.set(x, y, z, y === fy + 2 ? (opts.band ?? 'yellow') : (opts.walls ?? 'yellowPale'));
      }
    }
  }
  // The door in the front wall.
  const dx = Math.floor((wx0 + wx1) / 2);
  ctx.box(dx, fy + 1, wz1, dx + 1, fy + 3, wz1, opts.door ?? 'wood');
  // The gables under the roof, at the two ends.
  const zc = (wz0 + wz1) / 2;
  const gableH = Math.ceil((wz1 - wz0 + 1) / 2);
  for (const gx of [wx0, wx1]) {
    for (let y = top + 1; y <= top + gableH; y++) {
      for (let z = wz0; z <= wz1; z++) if (Math.abs(z - zc) < top + gableH - y + 0.5) ctx.set(gx, y, z, opts.walls ?? 'yellowPale');
    }
  }
  // A ladder (steep, as on the real houses), or wide stairs.
  if (opts.stairs) {
    for (let s = 0; s < postH; s++) ctx.box(dx - 2, fy - 1 - s, wz1 + 3 + s, dx + 3, fy - 1 - s, wz1 + 3 + s, 'wood');
  } else {
    for (let s = 0; s <= postH; s++) {
      const z = wz1 + 3 + Math.floor(s * 0.6);
      ctx.set(dx, fy - s, z, 'wood');
      ctx.set(dx + 1, fy - s, z, 'wood');
    }
  }
  // A clay jar under the floor.
  ctx.box(wx0 + 1, gy, wz0 + 1, wx0 + 2, gy + 1, wz0 + 2, 'vermilionPale');
  // The roof: a smooth thatch shape with the curved ridge of the Đông Sơn houses.
  ctx.roof({
    x0: wx0 - 2, x1: wx1 + 3, z0: wz0 - 2, z1: wz1 + 3, y: top + 1,
    ridgeH: gableH + 2, color: opts.roof ?? 'ochre', ridge: opts.ridge ?? 'yellow', finials: Boolean(opts.finials), sweep: opts.sweep ?? 1,
  });
  // The shadow under the floor, and behind the house.
  for (let z = wz0 - 1; z <= wz1 + 2; z++) for (let x = wx0 - 1; x <= wx1 + 1; x++) ctx.shadow(x, z);
  for (let z = wz0 - 6; z < wz0; z++) for (let x = wx0; x <= wx1 + 2; x++) ctx.shadow(x, z);
  // The way in (fine units): the foot of the ladder or the stairs, the top of it on the veranda,
  // and the door. The people of the house walk to the foot at dusk, climb, and go in.
  const foot = opts.stairs ? wz1 + 3 + postH : wz1 + 3 + Math.floor(postH * 0.6) + 1;
  const home = {
    base: { x: dx + 1, y: gy, z: foot + 1 },
    top: { x: dx + 1, y: fy + 1, z: wz1 + 2 },
    door: { x: dx + 1, y: fy + 1, z: wz1 + 1 },
  };
  ctx.info = { ground: gy, floor: fy, posts: postXs.length * 2, walls: { x0: wx0, x1: wx1, z0: wz0, z1: wz1, top }, home };
  return { dx, fy, wx0, wx1, wz0, wz1, gy };
}

// The parts of a house that change from one house to the next (by its seed): the walls, the
// band, the thatch, the door, the curve of the ridge, and the things around it. The size and the
// way in stay the same, so that the people of a house always find the ladder.
export const HOUSE_PARTS = Object.freeze({
  walls: ['yellowPale', 'paper', 'paperDeep'],
  band: ['yellow', 'ochre', 'wood', 'vermilionPale'],
  roof: ['ochre', 'yellow', 'ochre', 'wood'],
  ridge: ['yellow', 'ochre', 'wood'],
  door: ['wood', 'indigo', 'greenDeep', 'ochre'],
  sweep: [0.5, 1, 1.5],
  extras: ['firewood', 'corn', 'baskets', 'jar'],
});

// A variant of a house from its seed: one choice of each part, and one or two extras.
export function houseVariant(rng) {
  const pick = (k) => rng.pick(HOUSE_PARTS[k]);
  const first = pick('extras');
  const second = pick('extras');
  const extras = rng.chance(0.5) && second !== first ? [first, second] : [first];
  return { walls: pick('walls'), band: pick('band'), roof: pick('roof'), ridge: pick('ridge'), door: pick('door'), sweep: pick('sweep'), extras };
}

// The extras around a house (fine units): firewood under the floor, corn under the eaves, baskets
// on the veranda, a water jar at the side of the ladder.
function extrasOf(ctx, h, list) {
  for (const e of list) {
    if (e === 'firewood') ctx.box(h.wx1 - 3, h.gy, h.wz0 + 1, h.wx1 - 1, h.gy + 1, h.wz0 + 2, 'wood');
    if (e === 'corn') for (let x = h.wx0 + 1; x < h.wx1; x += 2) ctx.set(x, h.fy - 1, h.wz1 + 2, 'yellow');
    if (e === 'baskets') ctx.box(h.wx0, h.fy + 1, h.wz1 + 1, h.wx0, h.fy + 2, h.wz1 + 1, 'ochre');
    if (e === 'jar') ctx.box(h.dx + 3, h.gy, h.wz1 + 3, h.dx + 3, h.gy + 1, h.wz1 + 3, 'vermilionPale');
  }
}

export function house(ctx, o) {
  const v = houseVariant(ctx.rng);
  const h = stiltHouse(ctx, o, v);
  extrasOf(ctx, h, v.extras);
}

// The house of Gióng: a green door cloth, a rice basket on the veranda, and a piece of fence.
export function giongHouse(ctx, o) {
  const h = stiltHouse(ctx, o, { door: 'greenDeep' });
  ctx.box(h.wx1 - 1, h.fy + 1, h.wz1 + 1, h.wx1, h.fy + 2, h.wz1 + 2, 'yellow');
  for (let x = o.fx; x < o.fx + 4; x++) {
    ctx.set(x, h.gy, o.fz + o.fd - 1, 'ochre');
    if (x % 2 === 0) ctx.set(x, h.gy + 1, o.fz + o.fd - 1, 'ochre');
  }
}

// The đình (village hall): larger and taller, with a vermilion ridge, bird-head finials, and stairs.
export function dinh(ctx, o) {
  const h = stiltHouse(ctx, o, { postH: 7, wallH: 5, band: 'vermilion', ridge: 'vermilion', finials: true, stairs: true, sweep: 2 });
  // A flag on a tall pole at the front of the yard; it waves in the wind (src/world/smooth.js).
  const px = o.fx;
  const pz = o.fz + o.fd - 2;
  const g = ctx.ground(px, pz);
  ctx.box(px, g, pz, px, g + 15, pz, 'wood');
  ctx.smooth({ kind: 'flag', x: (px + 1) / 2, y: (g + 16) / 2, z: (pz + 0.5) / 2, w: 1.8, h: 1.1 }, [2.2, 1.2, 0.2]);
  return h;
}

// A small hut. Some huts have laundry on a line between two posts at the side.
export function hut(ctx, o) {
  const v = houseVariant(ctx.rng);
  const h = stiltHouse(ctx, o, { ...v, postH: 5, wallH: 3 });
  extrasOf(ctx, h, v.extras.slice(0, 1));
  if (!ctx.rng.chance(0.5)) return;
  const x = o.fx;
  const z0 = h.wz0;
  const z1 = h.wz1 + 1;
  const g = ctx.ground(x, z0);
  ctx.box(x, g, z1, x, g + 4, z1, 'wood');
  ctx.box(x, g, z0, x, g + 4, z0, 'wood');
  ctx.smooth({ kind: 'laundry', x: (x + 0.5) / 2, y: (g + 4.5) / 2, z0: (z0 + 0.5) / 2, z1: (z1 + 0.5) / 2 }, [1, 1, 0.2]);
}

// An open school: a low floor, posts, a mat, a low table with counting rods, and a scroll.
export function school(ctx, o) {
  const { fx, fz, fw, fd } = o;
  const gy = levelOf(ctx, fx, fz, fw, fd);
  const fy = gy + 2;
  const x0 = fx + 1;
  const x1 = fx + fw - 2;
  const z0 = fz + 1;
  const z1 = fz + fd - 3;
  const top = fy + 6;
  for (let x = x0; x <= x1; x += Math.max(3, Math.floor((x1 - x0) / 3))) for (const z of [z0, z1]) ctx.box(x, gy, z, x, top, z, 'wood');
  for (const z of [z0, z1]) ctx.box(x1, gy, z, x1, top, z, 'wood');
  ctx.box(x0, fy, z0, x1, fy, z1, 'wood');
  ctx.box(x0 + 2, fy + 1, z0 + 2, x1 - 2, fy + 1, z1 - 1, 'vermilionPale');
  const tx = Math.floor((x0 + x1) / 2);
  ctx.box(tx - 2, fy + 2, z0 + 2, tx + 2, fy + 2, z0 + 3, 'wood');
  for (let x = tx - 2; x <= tx + 2; x += 2) ctx.set(x, fy + 3, z0 + 2, 'ink');
  ctx.box(x0, fy + 2, z0, x0, fy + 5, z0, 'paper');
  ctx.roof({ x0: x0 - 2, x1: x1 + 3, z0: z0 - 2, z1: z1 + 3, y: top + 1, ridgeH: Math.ceil((z1 - z0) / 2) + 1, color: 'ochre', ridge: 'yellow', finials: false, sweep: 1 });
  // A stake in the yard, with the string of a kite that flies high over the village on a windy day.
  const kx = x1 + 2;
  const kz = z1 + 2;
  const kg = ctx.ground(kx, kz);
  ctx.set(kx, kg, kz, 'wood');
  ctx.smooth({ kind: 'kite', x: (kx + 8) / 2, y: (kg + 30) / 2, z: (kz - 6) / 2, sx: (kx + 0.5) / 2, sy: (kg + 1) / 2, sz: (kz + 0.5) / 2 }, [5, 0, 16]);
  for (let z = z0 - 5; z <= z1; z++) for (let x = x0; x <= x1; x++) ctx.shadow(x, z);
  ctx.info = { ground: gy, floor: fy, walls: { x0, x1, z0, z1, top } };
}

// An open forge: four posts and a roof, a clay furnace with fire, an anvil, and a water trough.
export function forge(ctx, o) {
  const { fx, fz, fw, fd } = o;
  const gy = levelOf(ctx, fx, fz, fw, fd);
  const x0 = fx + 1;
  const x1 = fx + fw - 2;
  const z0 = fz + 1;
  const z1 = fz + fd - 3;
  const top = gy + 7;
  for (const x of [x0, x1]) for (const z of [z0, z1]) ctx.box(x, gy, z, x, top, z, 'wood');
  ctx.box(x0 + 1, gy, z0 + 1, x0 + 4, gy + 4, z0 + 3, 'vermilionPale');
  ctx.box(x0 + 2, gy + 1, z0 + 3, x0 + 3, gy + 2, z0 + 3, 'vermilion');
  ctx.set(x0 + 2, gy + 1, z0 + 3, 'yellow');
  ctx.box(x0 + 2, gy + 5, z0 + 2, x0 + 3, gy + 6, z0 + 2, 'ash');
  ctx.box(x1 - 3, gy, z1 - 3, x1 - 2, gy + 1, z1 - 2, 'wood');
  ctx.box(x1 - 4, gy + 2, z1 - 3, x1 - 1, gy + 2, z1 - 2, 'ash');
  ctx.box(x0 + 1, gy, z1 - 1, x0 + 5, gy + 1, z1, 'wood');
  ctx.box(x0 + 2, gy + 1, z1 - 1, x0 + 4, gy + 1, z1, 'indigoPale');
  ctx.roof({ x0: x0 - 2, x1: x1 + 3, z0: z0 - 2, z1: z1 + 3, y: top + 1, ridgeH: Math.ceil((z1 - z0) / 2) + 1, color: 'ochre', ridge: 'yellow', finials: false, sweep: 1 });
  for (let z = z0 - 5; z <= z1; z++) for (let x = x0; x <= x1; x++) ctx.shadow(x, z);
  ctx.info = { ground: gy, walls: { x0, x1, z0, z1, top } };
}
