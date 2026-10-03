// Things: the well, haystacks, pots, rocks, ore, boats, the signpost, the gate, fences, rice
// stacks, the gate of Văn Miếu, and a stele on a turtle. Units are fine blocks.
import { levelOf } from './houses.js';

const center = (o) => ({ x: o.fx + Math.floor(o.fw / 2), z: o.fz + Math.floor(o.fd / 2) });

export function well(ctx, o) {
  const { fx, fz } = o;
  const s = Math.max(4, Math.min(o.fw, o.fd));
  const g = levelOf(ctx, fx, fz, s, s);
  for (let dx = 0; dx < s; dx++) {
    for (let dz = 0; dz < s; dz++) {
      const edge = dx === 0 || dz === 0 || dx === s - 1 || dz === s - 1;
      if (edge) ctx.box(fx + dx, g, fz + dz, fx + dx, g + 1, fz + dz, 'ashLight');
      else ctx.set(fx + dx, g, fz + dz, 'indigo');
    }
  }
  ctx.box(fx, g + 2, fz + 1, fx, g + 5, fz + 1, 'wood');
  ctx.box(fx + s - 1, g + 2, fz + 1, fx + s - 1, g + 5, fz + 1, 'wood');
  ctx.box(fx, g + 6, fz + 1, fx + s - 1, g + 6, fz + 1, 'wood');
  ctx.set(fx + Math.floor(s / 2), g + 4, fz + 1, 'ochre');
  ctx.shadowDisc(fx + s / 2, fz + s / 2, 2, 2);
}

// A chicken coop: a low hut of straw on short legs, with a small ramp.
export function coop(ctx, o) {
  const { x, z } = center(o);
  const g = ctx.ground(x, z);
  ctx.box(x - 2, g, z - 2, x - 2, g, z - 2, 'wood');
  ctx.box(x + 1, g, z - 2, x + 1, g, z - 2, 'wood');
  ctx.box(x - 2, g, z + 1, x - 2, g, z + 1, 'wood');
  ctx.box(x + 1, g, z + 1, x + 1, g, z + 1, 'wood');
  ctx.box(x - 2, g + 1, z - 2, x + 1, g + 1, z + 1, 'wood');
  ctx.box(x - 2, g + 2, z - 2, x + 1, g + 3, z + 1, 'yellow');
  ctx.box(x - 1, g + 4, z - 2, x, g + 4, z + 1, 'ochre');
  ctx.box(x - 1, g + 2, z + 1, x, g + 3, z + 1, 'ink');
  ctx.box(x - 1, g, z + 2, x, g, z + 2, 'wood');
  ctx.shadowDisc(x, z, 2, 1);
}

export function haystack(ctx, o) {
  const { x, z } = center(o);
  const g = ctx.ground(x, z);
  const r0 = Math.max(2, Math.min(o.fw, o.fd) / 2 - 0.5);
  const layers = Math.round(r0 * 1.8);
  // The pole of blocks goes through the stack; the straw is a smooth cone around it.
  ctx.box(x, g, z, x, g + layers + 2, z, 'wood');
  ctx.smooth({ kind: 'haystack', x: (x + 0.5) / 2, y: g / 2, z: (z + 0.5) / 2, r: (r0 + 0.6) / 2, h: (layers + 0.6) / 2 }, [(r0 + 0.6) / 2, 0, (layers + 3) / 2]);
  ctx.shadowDisc(x, z, Math.ceil(r0), 3);
}

// A rock of grey blocks (an ore rock has glints of ore). Never the shape of a sign: see
// docs/ART.md, "Do and do not".
export function rock(ctx, o, opts = {}) {
  const r = ctx.rng;
  const { fx, fz, fw, fd } = o;
  const g = ctx.ground(fx + Math.floor(fw / 2), fz + Math.floor(fd / 2));
  // Two or three lumps of different sizes along a long side that the seed turns, and a main lump
  // off the middle: no rock has a four-fold shape.
  const half = Math.min(fw, fd) / 2;
  const turn = r.next() * Math.PI;
  const ux = Math.cos(turn);
  const uz = Math.sin(turn);
  const cx = fx + fw / 2 + (r.next() - 0.5) * 0.8;
  const cz = fz + fd / 2 + (r.next() - 0.5) * 0.8;
  const lumps = [{ x: cx + ux * 0.4, z: cz + uz * 0.4, a: half * 0.95, b: half * 0.6, h: 2.6 + r.next() * 0.8 }];
  const more = 1 + (r.chance(0.5) ? 1 : 0);
  for (let k = 0; k < more; k++) {
    const t = (k ? 1 : -1) * (0.9 + r.next() * 0.5) * half * 0.6;
    lumps.push({ x: cx + ux * t + uz * (r.next() - 0.5), z: cz + uz * t - ux * (r.next() - 0.5), a: half * (0.45 + r.next() * 0.2), b: half * 0.4, h: 1.2 + r.next() * 0.9 });
  }
  // The height of each column: the highest lump over it.
  const cols = [];
  for (let z = fz; z < fz + fd; z++) {
    for (let x = fx; x < fx + fw; x++) {
      let v = 0;
      for (const l of lumps) {
        const dx = x + 0.5 - l.x;
        const dz = z + 0.5 - l.z;
        const along = (dx * ux + dz * uz) / l.a;
        const across = (-dx * uz + dz * ux) / l.b;
        v = Math.max(v, l.h * (1 - along * along - across * across));
      }
      if (v > 0.35) cols.push({ x, z, v, h: Math.max(1, Math.round(v)) });
    }
  }
  // The top: one or two blocks only (never a line or a cross of blocks).
  const top = Math.max(...cols.map((c) => c.h));
  cols.filter((c) => c.h === top).sort((p, q) => q.v - p.v).slice(2).forEach((c) => { c.h -= 1; });
  for (const c of cols) {
    for (let y = 0; y < c.h; y++) {
      const glint = opts.ore && r.chance(0.25);
      ctx.set(c.x, g + y, c.z, glint ? r.pick(['ochre', 'ashLight']) : opts.ore ? 'ash' : y === 0 ? 'ash' : 'ashLight');
    }
  }
}

export const ore = (ctx, o) => rock(ctx, o, { ore: true });

// A long dugout boat with a bird-head prow, along x.
export function boat(ctx, o) {
  const r = ctx.rng;
  const { fx, fz, fw, fd } = o;
  const z = fz + Math.floor(fd / 2);
  const g = o.water ? o.water : ctx.ground(fx + fw / 2, z);
  // A boat from parts: the wood of the hull, the color of the rim, and sometimes a curved cover
  // of woven bamboo (mui) and a pole.
  const hull = r.pick(['wood', 'wood', 'ash']);
  const rim = r.pick(['ochre', 'ochre', 'yellow']);
  for (let x = fx; x < fx + fw; x++) {
    const end = x === fx || x === fx + fw - 1;
    ctx.set(x, g, z, hull);
    if (!end) {
      ctx.set(x, g + 1, z - 1, rim);
      ctx.set(x, g + 1, z + 1, rim);
      ctx.set(x, g, z - 1, hull);
      ctx.set(x, g, z + 1, hull);
    }
  }
  const px = fx + fw - 1;
  ctx.box(px, g + 1, z, px, g + 3, z, 'ochre');
  ctx.set(px + 1, g + 3, z, 'vermilion');
  if (fw >= 5 && r.chance(0.5)) {
    const c = fx + Math.floor(fw / 2) - 1;
    for (let x = c; x < c + 2; x++) {
      ctx.set(x, g + 2, z - 1, 'yellow');
      ctx.set(x, g + 2, z + 1, 'yellow');
      ctx.set(x, g + 3, z, 'yellow');
    }
  }
  if (r.chance(0.4)) ctx.box(fx + 1, g + 1, z, fx + 1, g + 6, z, 'wood');
}

export function signpost(ctx, o) {
  const { x, z } = center(o);
  const g = ctx.ground(x, z);
  ctx.box(x, g, z, x, g + 5, z, 'wood');
  ctx.box(x - 2, g + 4, z + 1, x + 2, g + 5, z + 1, 'paper');
  ctx.set(x + 2, g + 4, z + 1, 'vermilion');
  ctx.set(x + 1, g + 5, z + 1, 'vermilion');
}

// The village gate in the bamboo hedge: two thick bamboo posts and a cross bar, open in the middle.
export function gate(ctx, o) {
  const { fx, fz, fw, fd } = o;
  const x = fx + Math.floor(fw / 2) - 1;
  const g = levelOf(ctx, fx, fz, fw, fd);
  for (const z of [fz, fz + fd - 2]) {
    for (let y = g; y <= g + 11; y++) ctx.box(x, y, z, x + 1, y, z + 1, (y - g) % 4 === 3 ? 'greenDeep' : 'green');
  }
  ctx.box(x, g + 10, fz, x + 1, g + 10, fz + fd - 1, 'ochre');
  ctx.box(x, g + 9, fz + 2, x + 1, g + 9, fz + 2, 'ochre');
  ctx.box(x, g + 9, fz + fd - 3, x + 1, g + 9, fz + fd - 3, 'ochre');
}

// A short piece of woven bamboo fence along x.
export function fence(ctx, o) {
  const { fx, fz, fw } = o;
  const z = fz + 1;
  for (let x = fx; x < fx + fw; x++) {
    const g = ctx.ground(x, z);
    ctx.box(x, g, z, x, g + 2, z, x % 2 ? 'ochre' : 'yellowPale');
    if (x % 3 === 0) ctx.set(x, g + 3, z, 'ochre');
  }
}

export function riceStack(ctx, o) {
  const { x, z } = center(o);
  const g = ctx.ground(x, z);
  for (let i = -1; i <= 1; i++) ctx.box(x + i, g, z - 1, x + i, g + 2 - Math.abs(i), z + 1, i ? 'yellow' : 'ochre');
  ctx.set(x, g + 3, z, 'yellow');
}

// The gate of Văn Miếu across the road: two brick pillars, a beam, an upper wall with a round
// window, and a roof of red tiles in two steps with a light ridge. The road goes through it (along x).
export function vanmieuGate(ctx, o) {
  const { fx, fz, fw, fd } = o;
  const g = levelOf(ctx, fx, fz, fw, fd);
  const x0 = fx;
  const x1 = fx + fw - 1;
  for (const [z0, z1] of [[fz, fz + 3], [fz + fd - 4, fz + fd - 1]]) {
    for (let y = g; y <= g + 8; y++) ctx.box(x0, y, z0, x1, y, z1, y % 3 === 2 ? 'vermilionPale' : 'paperDeep');
  }
  // The beam over the way, and the upper wall with a round window (a ring of dark blocks).
  ctx.box(x0, g + 9, fz, x1, g + 9, fz + fd - 1, 'wood');
  ctx.box(x0, g + 10, fz + 1, x1, g + 12, fz + fd - 2, 'paperDeep');
  const mz = fz + Math.floor(fd / 2);
  for (const [dy, dz] of [[1, -1], [1, 0], [0, -2], [0, 1], [2, -2], [2, 1], [3, -1], [3, 0]]) ctx.set(x1, g + 9 + dy, mz + dz, 'ink');
  // The roof: two steps of red tiles that reach out over the wall, a light ridge, and ends that turn up.
  ctx.box(x0 - 1, g + 13, fz - 1, x1 + 1, g + 13, fz + fd, 'vermilion');
  ctx.box(x0, g + 14, fz, x1, g + 14, fz + fd - 1, 'vermilion');
  ctx.box(x0, g + 15, fz + 1, x1, g + 15, fz + fd - 2, 'ochre');
  for (const z of [fz - 1, fz + fd]) for (const x of [x0 - 1, x1 + 1]) ctx.set(x, g + 14, z, 'ochre');
  ctx.shadowDisc(fx + fw / 2, fz + fd / 2, 3, 2);
}

// A stele of the doctors on a stone turtle: the turtle has a stepped shell, a head to the front
// (+z), and four feet; the slab stands on its back with lines of writing as dark marks.
export function stele(ctx, o) {
  const { x, z } = center(o);
  const g = ctx.ground(x, z);
  const sx = x - 2;
  const sz = z - 2;
  // The turtle.
  ctx.box(sx, g, sz, sx + 3, g + 1, sz + 3, 'ash');
  ctx.box(sx + 1, g + 2, sz + 1, sx + 2, g + 2, sz + 2, 'ashLight');
  ctx.box(sx + 1, g, sz + 4, sx + 2, g + 1, sz + 4, 'ash');
  ctx.set(sx + 1, g + 1, sz + 5, 'ashLight');
  ctx.set(sx + 2, g + 1, sz + 5, 'ashLight');
  for (const [fx2, fz2] of [[sx - 1, sz], [sx + 4, sz], [sx - 1, sz + 3], [sx + 4, sz + 3]]) ctx.set(fx2, g, fz2, 'ash');
  // The slab, with a rounded top and lines of writing.
  ctx.box(sx + 1, g + 3, sz + 1, sx + 2, g + 10, sz + 2, 'paperDeep');
  ctx.box(sx + 1, g + 11, sz + 1, sx + 2, g + 11, sz + 2, 'ashLight');
  for (let y = g + 4; y <= g + 9; y += 2) ctx.set(sx + 1, y, sz + 2, 'ink');
  for (let y = g + 5; y <= g + 9; y += 2) ctx.set(sx + 2, y, sz + 2, 'ink');
  ctx.shadowDisc(x, z, 2, 2);
}
