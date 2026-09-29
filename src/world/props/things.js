// Things: the well, haystacks, pots, rocks, ore, boats, the signpost, the gate, fences, rice
// stacks, and the mountain. Units are fine blocks.
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
  for (let l = 0; l < layers; l++) {
    const rad = r0 - (l * r0) / layers;
    for (let dz = -Math.ceil(r0); dz <= Math.ceil(r0); dz++) {
      for (let dx = -Math.ceil(r0); dx <= Math.ceil(r0); dx++) if (dx * dx + dz * dz <= rad * rad) ctx.set(x + dx, g + l, z + dz, l % 3 === 2 ? 'ochre' : 'yellow');
    }
  }
  ctx.box(x, g + layers, z, x, g + layers + 2, z, 'wood');
  ctx.shadowDisc(x, z, Math.ceil(r0), 3);
}

export function rock(ctx, o, opts = {}) {
  const r = ctx.rng;
  const { x, z } = center(o);
  const g = ctx.ground(x, z);
  const rad = Math.max(1.5, Math.min(o.fw, o.fd) / 2 - 0.3);
  for (let dy = 0; dy <= rad; dy++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dz * dz + dy * dy * 1.6 > rad * rad + r.next()) continue;
        const glint = opts.ore && r.chance(0.25);
        ctx.set(x + dx, g + dy, z + dz, glint ? r.pick(['ochre', 'ashLight']) : opts.ore ? 'ash' : (dy === 0 ? 'ash' : 'ashLight'));
      }
    }
  }
}

export const ore = (ctx, o) => rock(ctx, o, { ore: true });

// A long dugout boat with a bird-head prow, along x.
export function boat(ctx, o) {
  const { fx, fz, fw, fd } = o;
  const z = fz + Math.floor(fd / 2);
  const g = o.water ? o.water : ctx.ground(fx + fw / 2, z);
  for (let x = fx; x < fx + fw; x++) {
    const end = x === fx || x === fx + fw - 1;
    ctx.set(x, g, z, 'wood');
    if (!end) {
      ctx.set(x, g + 1, z - 1, 'ochre');
      ctx.set(x, g + 1, z + 1, 'ochre');
      ctx.set(x, g, z - 1, 'wood');
      ctx.set(x, g, z + 1, 'wood');
    }
  }
  const px = fx + fw - 1;
  ctx.box(px, g + 1, z, px, g + 3, z, 'ochre');
  ctx.set(px + 1, g + 3, z, 'vermilion');
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

// A rounded mountain of blocks with ridge rocks and trees at its foot.
export function mountain(ctx, o) {
  const r = ctx.rng;
  const { fx, fz, fw, fd } = o;
  const cx = fx + fw / 2;
  const cz = fz + fd / 2;
  const rx = fw / 2;
  const rz = fd / 2;
  const peak = Math.round(Math.min(fw, fd) * 0.9);
  for (let z = fz; z < fz + fd; z++) {
    for (let x = fx; x < fx + fw; x++) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((z + 0.5 - cz) / rz) ** 2;
      if (d >= 1) continue;
      const g = ctx.ground(x, z);
      const h = Math.round(peak * (1 - d) ** 0.8);
      for (let y = 0; y < h; y++) ctx.set(x, g + y, z, y === h - 1 ? (r.chance(0.08) ? 'ashLight' : 'greenPale') : 'green');
    }
  }
  ctx.shadowDisc(cx, cz, Math.floor(Math.min(rx, rz)), 6);
}
