// Plants: fruit trees, the banyan, bamboo, banana plants, herbs, and low bushes of the hedge.
// Units are fine blocks. Each plant grows from the middle of its footprint.

const center = (o) => ({ x: o.fx + Math.floor(o.fw / 2), z: o.fz + Math.floor(o.fd / 2) });

// A round tree: a trunk and a crown of leaf clumps, with a few fruits.
export function tree(ctx, o, opts = {}) {
  const r = ctx.rng;
  const { x, z } = center(o);
  const g = ctx.ground(x, z);
  const h = opts.trunk ?? 5 + r.int(0, 2);
  const rad = opts.crown ?? 3 + r.int(0, 1);
  ctx.box(x - 1, g, z - 1, x, g + h, z, 'wood');
  const cy = g + h + Math.round(rad * 0.6);
  const leaf = opts.leaf ?? r.pick(['green', 'green', 'greenDeep']);
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dz = -rad; dz <= rad; dz++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const d = (dx * dx + dy * dy * 1.8 + dz * dz) / (rad * rad);
        if (d >= 1 - r.next() * 0.18) continue;
        const light = dy >= rad * 0.45 && r.chance(0.55);
        ctx.set(x + dx, cy + dy, z + dz, light ? 'greenPale' : leaf);
      }
    }
  }
  if (opts.fruit !== false) {
    for (let i = 0; i < 4; i++) ctx.set(x + r.int(-rad, rad), cy - 1, z + rad, r.pick(['yellow', 'vermilionPale']));
  }
  ctx.shadowDisc(x, z, rad, Math.round((h + rad) * 0.4));
  ctx.info = { trunk: h, crown: rad };
}

// The old banyan: a thick trunk, aerial roots, a wide crown, and a small shrine stone.
export function banyan(ctx, o) {
  const r = ctx.rng;
  const { x, z } = center(o);
  const g = ctx.ground(x, z);
  ctx.box(x - 1, g, z - 1, x + 1, g + 8, z + 1, 'wood');
  tree(ctx, o, { trunk: 9, crown: Math.min(8, Math.floor(o.fw / 2) + 1), leaf: 'green', fruit: false });
  for (let i = 0; i < 18; i++) {
    const a = r.next() * Math.PI * 2;
    const rr = 2 + r.next() * 4;
    const rx = Math.round(x + Math.cos(a) * rr);
    const rz = Math.round(z + Math.sin(a) * rr);
    for (let y = g; y <= g + 9; y++) ctx.add(rx, y, rz, 'wood');
  }
  ctx.box(x + 2, g, z + 3, x + 3, g + 1, z + 3, 'ashLight');
  ctx.set(x + 2, g + 2, z + 3, 'vermilion');
}

// A clump of bamboo: straight stems with joints, and narrow leaves near the top.
export function bamboo(ctx, o, opts = {}) {
  const r = ctx.rng;
  const { x, z } = center(o);
  const stems = opts.stems ?? 3 + r.int(0, 2);
  const spread = Math.max(1, Math.floor(Math.min(o.fw, o.fd) / 2) - 1);
  for (let i = 0; i < stems; i++) {
    const bx = x + r.int(-spread, spread);
    const bz = z + r.int(-spread, spread);
    const g = ctx.ground(bx, bz);
    const h = (opts.height ?? 18) + r.int(0, 8);
    for (let y = g; y < g + h; y++) ctx.set(bx, y, bz, (y - g) % 5 === 4 ? 'greenDeep' : 'green');
    for (let k = 0; k < 22; k++) {
      const lx = bx + r.int(-3, 3);
      const lz = bz + r.int(-3, 3);
      const ly = g + h - 1 - r.int(0, 8);
      ctx.add(lx, ly, lz, r.chance(0.6) ? 'greenDeep' : 'greenPale');
    }
  }
  ctx.shadowDisc(x, z, 2, 4);
}

// A banana plant: a short thick stem of leaf sheaths, wide leaves that arch out, and a bud.
export function banana(ctx, o) {
  const r = ctx.rng;
  const { x, z } = center(o);
  const g = ctx.ground(x, z);
  ctx.box(x, g, z, x, g + 5, z, 'greenPale');
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
  for (const [dx, dz] of dirs) {
    for (let k = 1; k <= 5; k++) {
      const y = g + 6 - (k > 3 ? k - 3 : 0);
      ctx.set(x + dx * k, y, z + dz * k, k === 5 && r.chance(0.3) ? 'ochre' : 'green');
      // The leaves are wide: a second row of blocks beside the midrib.
      ctx.add(x + dx * k + (dz ? 1 : 0), y, z + dz * k + (dx ? 1 : 0), 'greenPale');
    }
  }
  ctx.set(x, g + 7, z, 'green');
  ctx.set(x + 1, g + 3, z + 1, 'green');
  ctx.set(x + 1, g + 2, z + 1, 'vermilionPale');
  ctx.shadowDisc(x, z, 2, 3);
}

// A bed of herbs: a low earth border and small plants, one with a flower.
export function herbs(ctx, o) {
  const r = ctx.rng;
  const { fx, fz, fw, fd } = o;
  for (let z = fz; z < fz + fd; z++) {
    for (let x = fx; x < fx + fw; x++) {
      const g = ctx.ground(x, z);
      const edge = x === fx || z === fz || x === fx + fw - 1 || z === fz + fd - 1;
      if (edge) ctx.set(x, g, z, 'paperDeep');
      else {
        ctx.set(x, g, z, r.pick(['green', 'greenDeep']));
        if (r.chance(0.4)) ctx.set(x, g + 1, z, r.pick(['green', 'greenPale']));
      }
    }
  }
  ctx.set(fx + 1, ctx.ground(fx + 1, fz + 1) + 1, fz + 1, 'vermilion');
}

// A low bush of the hedge on the sides that face the camera: a trimmed bamboo bush.
export function bush(ctx, o) {
  const r = ctx.rng;
  const { x, z } = center(o);
  const g = ctx.ground(x, z);
  for (let dy = 0; dy <= 3; dy++) {
    for (let dz = -2; dz <= 1; dz++) {
      for (let dx = -2; dx <= 1; dx++) {
        if (dx * dx + dz * dz + dy * dy * 0.8 > 5 + r.next()) continue;
        ctx.set(x + dx, g + dy, z + dz, dy === 3 || r.chance(0.3) ? 'greenPale' : 'green');
      }
    }
  }
  if (r.chance(0.5)) ctx.box(x, g, z, x, g + 6, z, 'green');
}
