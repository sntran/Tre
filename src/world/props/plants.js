// Plants: fruit trees, the banyan, bamboo, banana plants, herbs, and low bushes of the hedge.
// Units are fine blocks. Each plant grows from the middle of its footprint.

const center = (o) => ({ x: o.fx + Math.floor(o.fw / 2), z: o.fz + Math.floor(o.fd / 2) });

// The plants are blocks where they can be taken (a trunk, a stem, the base of a culm) and smooth
// looks where they are living and round (src/world/smooth.js): the look of a plant goes with its
// blocks. World units for the smooth looks are half of the fine units.

// A round tree: a trunk of blocks and a smooth crown of three or four blobs.
export function tree(ctx, o, opts = {}) {
  const r = ctx.rng;
  const { x, z } = center(o);
  const g = ctx.ground(x, z);
  const h = opts.trunk ?? 5 + r.int(0, 2);
  const rad = opts.crown ?? 3 + r.int(0, 1);
  ctx.box(x - 1, g, z - 1, x, g + h, z, 'wood');
  const cy = g + h + Math.round(rad * 0.6);
  const leaf = opts.leaf ?? r.pick(['green', 'green', 'greenDeep']);
  const R = (rad / 2) * 1.15;
  ctx.smooth({ kind: 'crown', x: x / 2, y: (cy + 0.5) / 2, z: z / 2, r: R, leaf }, [R * 1.4, R, R]);
  // Some trees have a second, smaller crown to one side (a tree from parts: no two the same).
  if (opts.second ?? r.chance(0.35)) {
    const side = r.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    const r2 = R * 0.7;
    ctx.smooth({ kind: 'crown', x: x / 2 + side[0] * R * 0.8, y: (cy + 0.5) / 2 - R * 0.35, z: z / 2 + side[1] * R * 0.8, r: r2, leaf }, [R * 1.4 + r2, R, R]);
  }
  ctx.shadowDisc(x, z, rad, Math.round((h + rad) * 0.4));
  ctx.info = { trunk: h, crown: rad };
}

// An areca palm (cây cau) of the gardens: a tall thin trunk of blocks with rings, and a tuft of
// fronds at the top (the smooth leaves of the banana plant).
export function areca(ctx, o) {
  const r = ctx.rng;
  const { x, z } = center(o);
  const g = ctx.ground(x, z);
  const h = 16 + r.int(0, 6);
  for (let y = g; y < g + h; y++) ctx.set(x, y, z, y % 4 === 0 ? 'ash' : 'ashLight');
  ctx.smooth({ kind: 'banana', x: (x + 0.5) / 2, y: (g + h + 1) / 2, z: (z + 0.5) / 2 }, [2.8, 1.5, 1.4]);
  ctx.shadowDisc(x, z, 2, Math.round(h * 0.4));
}

// The old banyan: a thick trunk, a wide crown, aerial roots that hang to the ground as curves, and
// a small shrine stone.
export function banyan(ctx, o) {
  const r = ctx.rng;
  const { x, z } = center(o);
  const g = ctx.ground(x, z);
  ctx.box(x + 2, g, z + 3, x + 3, g + 1, z + 3, 'ashLight');
  ctx.set(x + 2, g + 2, z + 3, 'vermilion');
  const roots = [];
  for (let i = 0; i < 12; i++) {
    const a = r.next() * Math.PI * 2;
    const rr = 1.2 + r.next() * 2;
    roots.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  ctx.box(x - 1, g, z - 1, x + 1, g + 8, z + 1, 'wood');
  ctx.smooth({ kind: 'roots', x: x / 2, y: g / 2, z: z / 2, top: 4.6, roots }, [3.5, 0, 4.6]);
  tree(ctx, o, { trunk: 9, crown: Math.min(8, Math.floor(o.fw / 2) + 1), leaf: 'green' });
}

// A clump of bamboo: two or three tall culms (smooth: thin segmented cylinders with fans of narrow
// leaves), each on a base block in the ground.
export function bamboo(ctx, o, opts = {}) {
  const r = ctx.rng;
  const { x, z } = center(o);
  const stems = opts.stems ?? 2 + r.int(0, 1);
  const spread = Math.max(1, Math.floor(Math.min(o.fw, o.fd) / 2) - 1);
  for (let i = 0; i < stems; i++) {
    const bx = x + r.int(-spread, spread);
    const bz = z + r.int(-spread, spread);
    const g = ctx.ground(bx, bz);
    const h = (opts.height ?? 24) + r.int(0, 8);
    ctx.set(bx, g, bz, 'greenDeep');
    const leaf = r.chance(0.5) ? 'greenDeep' : 'green';
    const lean = [(r.next() - 0.5) * 1.2, (r.next() - 0.5) * 1.2];
    ctx.smooth({ kind: 'culm', x: (bx + 0.5) / 2, y: (g + 1) / 2, z: (bz + 0.5) / 2, h: h / 2, lean, leaf }, [2, 0, h / 2]);
  }
  ctx.shadowDisc(x, z, 2, 4);
}

// A banana plant: a short thick stem of blocks, and wide smooth leaves that arch out, with a bud.
export function banana(ctx, o) {
  const { x, z } = center(o);
  const g = ctx.ground(x, z);
  ctx.box(x, g, z, x, g + 5, z, 'greenPale');
  ctx.smooth({ kind: 'banana', x: (x + 0.5) / 2, y: (g + 6) / 2, z: (z + 0.5) / 2 }, [2.8, 1.5, 1.4]);
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

// A low bush of the hedge on the sides that face the camera: a smooth bush on a stem block, and
// sometimes a young culm out of it.
export function bush(ctx, o) {
  const r = ctx.rng;
  const { x, z } = center(o);
  const g = ctx.ground(x, z);
  if (r.chance(0.5)) ctx.box(x, g, z, x, g + 6, z, 'green');
  ctx.set(x, g, z, 'greenDeep');
  ctx.smooth({ kind: 'bush', x: (x + 0.5) / 2, y: g / 2, z: (z + 0.5) / 2, r: 1 + r.next() * 0.25 }, [1.8, 0, 1.4]);
}
