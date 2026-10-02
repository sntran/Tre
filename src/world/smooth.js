// The smooth looks of the world: everything living and round (tree crowns, bamboo culms, banana
// leaves, haystacks, bushes, the hanging roots of the banyan). Each is low-poly, in the flat tones
// of the palette (the tone of a face comes from its normal, as the tone of a face of a block), with
// ink at the silhouette only (a hull drawn from the back) and at the edges of a leaf (lines). Pure,
// no WebGL: plain arrays in world units, as from src/world/mesher.js.
//
// A smooth look is a look, not a thing: it has an owner block in the fine grid (a trunk, a stem,
// the base of a culm, the pole of a haystack), and it draws only while that block is there
// (src/world/chunks.js). Nothing is baked: the same seed builds the same mesh again from the save.
import { toneRgb, colorIndex, FACE_TONES, seeded } from './voxel.js';

export const HULL = 0.06; // world units: the ink around a smooth look

// The tone of a face from its normal: the top is lit, the sides are lit or dark, as on a block.
function toneOf(nx, ny, nz) {
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const az = Math.abs(nz);
  if (ay >= ax && ay >= az) return ny > 0 ? FACE_TONES.py : FACE_TONES.ny;
  if (ax >= az) return nx > 0 ? FACE_TONES.px : FACE_TONES.nx;
  return nz > 0 ? FACE_TONES.pz : FACE_TONES.nz;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// The layers of the sway (the gust crosses them in this order: src/core/world/ambient.js).
export const SWAY_LAYERS = Object.freeze({ paddy: 0, hedge: 1, tree: 2, kite: 3 });

// A builder of one look: flat triangles with their tones, the hull, and ink lines. Each vertex has a
// sway: [weight, layer] (how much the wind moves it, and its layer), from swayAt(point).
function builder(who) {
  const out = { positions: [], colors: [], owners: [], indices: [], sway: [], segs: [], segSway: [], hull: { positions: [], indices: [], sway: [] } };
  let n = 0;
  let h = 0;
  const B = {
    out,
    swayAt: () => [0, 0],
    // A triangle of a closed shape, turned so that its front looks away from `center` (a point in
    // the shape). color: a palette name, or a function of the normal. hull: the ink around it.
    tri(a, b, c, center, color, hull = true) {
      let nrm = norm(cross(sub(b, a), sub(c, a)));
      const mid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
      if (center && dot(nrm, sub(mid, center)) < 0) {
        [b, c] = [c, b];
        nrm = [-nrm[0], -nrm[1], -nrm[2]];
      }
      const name = typeof color === 'function' ? color(nrm) : color;
      const rgb = toneRgb(colorIndex(name), toneOf(nrm[0], nrm[1], nrm[2]));
      for (const p of [a, b, c]) {
        out.positions.push(...p);
        out.colors.push(...rgb);
        out.owners.push(who);
        out.sway.push(...B.swayAt(p));
      }
      out.indices.push(n, n + 1, n + 2);
      n += 3;
      if (!hull || !center) return;
      // The hull: the same triangle a little out from the center, with the same front.
      for (const p of [a, b, c]) {
        const d = norm(sub(p, center));
        out.hull.positions.push(p[0] + d[0] * HULL, p[1] + d[1] * HULL, p[2] + d[2] * HULL);
        out.hull.sway.push(...B.swayAt(p));
      }
      out.hull.indices.push(h, h + 1, h + 2);
      h += 3;
    },
    line(a, b) {
      out.segs.push(...a, ...b);
      out.segSway.push(...B.swayAt(a), ...B.swayAt(b));
    },
  };
  return B;
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// The 12 corners and 20 faces of an icosahedron, and one split of each face (80 faces): a low ball.
const T = (1 + Math.sqrt(5)) / 2;
const ICO_V = [[-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0], [0, -1, T], [0, 1, T], [0, -1, -T], [0, 1, -T], [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1]].map(norm);
const ICO_F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
const ICO1 = (() => {
  const faces = [];
  for (const [i, j, k] of ICO_F) {
    const a = ICO_V[i];
    const b = ICO_V[j];
    const c = ICO_V[k];
    const ab = norm([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
    const bc = norm([(b[0] + c[0]) / 2, (b[1] + c[1]) / 2, (b[2] + c[2]) / 2]);
    const ca = norm([(c[0] + a[0]) / 2, (c[1] + a[1]) / 2, (c[2] + a[2]) / 2]);
    faces.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
  }
  return faces;
})();

// A blob: a low ball (80 faces) of radii (rx, ry, rz) at a center, a little uneven by its seed.
function blob(B, center, [rx, ry, rz], color, rng) {
  const bump = new Map();
  const key = (v) => v.map((x) => x.toFixed(3)).join(',');
  const at = (v) => {
    const k = key(v);
    if (!bump.has(k)) bump.set(k, 1 + (rng.next() - 0.5) * 0.18);
    const s = bump.get(k);
    return [center[0] + v[0] * rx * s, center[1] + v[1] * ry * s, center[2] + v[2] * rz * s];
  };
  for (const [a, b, c] of ICO1) B.tri(at(a), at(b), at(c), center, color);
}

// A ring of `sides` points around an axis point, at a radius.
const ring = (p, r, sides, turn = 0) => Array.from({ length: sides }, (_, i) => {
  const a = turn + (i / sides) * Math.PI * 2;
  return [p[0] + Math.cos(a) * r, p[1], p[2] + Math.sin(a) * r];
});

// A tube from a list of axis points (with a radius at each), closed at the top.
function tube(B, points, radii, colors, sides = 6) {
  const rings = points.map((p, i) => ring(p, radii[i], sides));
  for (let i = 0; i + 1 < rings.length; i++) {
    const a = rings[i];
    const b = rings[i + 1];
    const mid = [(points[i][0] + points[i + 1][0]) / 2, (points[i][1] + points[i + 1][1]) / 2, (points[i][2] + points[i + 1][2]) / 2];
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      B.tri(a[k], a[k2], b[k2], mid, colors[i]);
      B.tri(a[k], b[k2], b[k], mid, colors[i]);
    }
  }
  const top = points.at(-1);
  const last = rings.at(-1);
  const inside = [top[0], top[1] - 0.05, top[2]];
  for (let k = 0; k < sides; k++) B.tri(last[k], last[(k + 1) % sides], top, inside, colors.at(-1));
}

// A flat leaf: a strip from a base point along a curve, wide in the middle and pointed at the tip,
// with ink at its edges. path: the points along the midrib; width: the widest half width; side: the
// direction across the leaf.
function leaf(B, path, width, side, color) {
  const n = path.length - 1;
  const edge = (i, s) => {
    const w = Math.sin((i / n) * Math.PI) * width * s;
    return [path[i][0] + side[0] * w, path[i][1] + side[1] * w, path[i][2] + side[2] * w];
  };
  for (let i = 0; i < n; i++) {
    const a = edge(i, 1);
    const b = edge(i + 1, 1);
    const c = edge(i + 1, -1);
    const d = edge(i, -1);
    B.tri(a, b, c, null, color, false);
    B.tri(a, c, d, null, color, false);
    B.line(a, b);
    B.line(d, c);
  }
}

// A flat rectangle (two triangles) with ink at its edges: a flag, a cloth on a line. a: the corner
// at the pole or the line; u, v: the two sides.
function sheet(B, a, u, v, color) {
  const b = [a[0] + u[0], a[1] + u[1], a[2] + u[2]];
  const c = [b[0] + v[0], b[1] + v[1], b[2] + v[2]];
  const d = [a[0] + v[0], a[1] + v[1], a[2] + v[2]];
  B.tri(a, b, c, null, color, false);
  B.tri(a, c, d, null, color, false);
  B.line(a, b);
  B.line(b, c);
  B.line(c, d);
  B.line(d, a);
}

// The leaves are pale on top, so that a crown has a lit top as the blocks had.
const leafy = (base) => (n) => (n[1] > 0.55 ? 'greenPale' : base);

const BUILD = {
  // A tree crown: three or four overlapping blobs. { x, y, z (the middle of the crown), r, leaf }
  crown(B, s, rng) {
    // The top of the crown moves most.
    B.swayAt = (p) => [0.15 + 0.55 * clamp01((p[1] - (s.y - s.r)) / (2 * s.r)), SWAY_LAYERS.tree];
    const count = 3 + (rng.next() < 0.5 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng.next();
      const d = i === 0 ? 0 : s.r * 0.45;
      const c = [s.x + Math.cos(a) * d, s.y + (i === 0 ? s.r * 0.15 : -s.r * 0.1 + rng.next() * s.r * 0.2), s.z + Math.sin(a) * d];
      const k = i === 0 ? 0.8 : 0.6 + rng.next() * 0.1;
      blob(B, c, [s.r * k, s.r * k * 0.8, s.r * k], leafy(s.leaf ?? 'green'), rng);
    }
  },
  // A bush: two small blobs. { x, y, z (the ground under it), r }
  bush(B, s, rng) {
    B.swayAt = (p) => [0.3 * clamp01((p[1] - s.y) / (s.r * 1.4)), SWAY_LAYERS.hedge];
    blob(B, [s.x, s.y + s.r * 0.6, s.z], [s.r, s.r * 0.7, s.r], leafy('green'), rng);
    blob(B, [s.x + s.r * 0.4, s.y + s.r * 0.5, s.z - s.r * 0.3], [s.r * 0.7, s.r * 0.6, s.r * 0.7], leafy('green'), rng);
  },
  // A bamboo culm: a thin segmented cylinder with a dark ring at each joint, a little lean, and
  // fans of narrow leaves in its top third. { x, y (the ground), z, h, lean: [dx, dz], leaf }
  culm(B, s, rng) {
    // The top of a culm bends with the wind; its foot stays.
    B.swayAt = (p) => [1.4 * clamp01((p[1] - s.y) / s.h) ** 2, SWAY_LAYERS.hedge];
    const joints = Math.max(3, Math.round(s.h / 2.5));
    const points = [];
    const radii = [];
    const colors = [];
    for (let i = 0; i <= joints; i++) {
      const t = i / joints;
      const p = [s.x + s.lean[0] * t * t, s.y + s.h * t, s.z + s.lean[1] * t * t];
      points.push(p);
      radii.push(0.16 - 0.05 * t);
      colors.push('green');
      // The joint: a short dark ring.
      if (i < joints && i > 0) {
        points.push([p[0], p[1] + 0.12, p[2]]);
        radii.push(0.18 - 0.05 * t);
        colors[colors.length - 1] = 'greenDeep';
        colors.push('green');
      }
    }
    tube(B, points, radii, colors, 5);
    const fans = 3 + (rng.next() < 0.5 ? 1 : 0);
    for (let f = 0; f < fans; f++) {
      const t = 0.68 + (f / fans) * 0.3;
      const base = [s.x + s.lean[0] * t * t, s.y + s.h * t, s.z + s.lean[1] * t * t];
      const a0 = rng.next() * Math.PI * 2;
      for (let k = 0; k < 3; k++) {
        const a = a0 + (k - 1) * 0.5;
        const dir = [Math.cos(a), 0, Math.sin(a)];
        const len = 1.1 + rng.next() * 0.5;
        const path = [0, 0.33, 0.66, 1].map((u) => [base[0] + dir[0] * len * u, base[1] - u * u * 0.6, base[2] + dir[2] * len * u]);
        leaf(B, path, 0.16, [-dir[2], 0, dir[0]], s.leaf ?? 'greenDeep');
      }
    }
  },
  // The leaves of a banana plant: wide curved planes that arch out from the top of the stem and
  // droop, and a bud. { x, y (the top of the stem), z }
  banana(B, s, rng) {
    B.swayAt = (p) => [0.1 + 0.45 * clamp01(Math.hypot(p[0] - s.x, p[2] - s.z) / 2.4), SWAY_LAYERS.tree];
    const count = 6;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng.next() * 0.4;
      const dir = [Math.cos(a), 0, Math.sin(a)];
      const len = 2 + rng.next() * 0.6;
      const path = [0, 0.25, 0.5, 0.75, 1].map((u) => [s.x + dir[0] * len * u, s.y + 0.4 + Math.sin(u * Math.PI * 0.9) * 0.8 - u * u * 1.1, s.z + dir[2] * len * u]);
      leaf(B, path, 0.45, [-dir[2], 0, dir[0]], i % 2 ? 'green' : 'greenPale');
    }
    blob(B, [s.x + 0.4, s.y - 1, s.z + 0.4], [0.22, 0.32, 0.22], 'vermilionPale', rng);
  },
  // A haystack: a cone of straw in bands around a pole. { x, y (the ground), z, r, h }
  haystack(B, s) {
    const sides = 12;
    const bands = 4;
    for (let i = 0; i < bands; i++) {
      const y0 = s.y + (s.h * i) / bands;
      const y1 = s.y + (s.h * (i + 1)) / bands;
      const r0 = s.r * (1 - i / bands);
      const r1 = s.r * (1 - (i + 1) / bands);
      const a = ring([s.x, y0, s.z], r0, sides, 0.13);
      const b = ring([s.x, y1, s.z], r1, sides, 0.13);
      const mid = [s.x, (y0 + y1) / 2 - 0.2, s.z];
      for (let k = 0; k < sides; k++) {
        const k2 = (k + 1) % sides;
        const color = i % 2 ? 'ochre' : 'yellow';
        B.tri(a[k], a[k2], b[k2], mid, color);
        if (r1 > 0.01) B.tri(a[k], b[k2], b[k], mid, color);
      }
    }
  },
  // The hanging roots of the banyan: thin curves from the crown to the ground. { x, y (the ground),
  // z, top (the height of the crown), roots: [[dx, dz], ...] }
  roots(B, s, rng) {
    B.swayAt = (p) => [0.25 * clamp01(1 - (p[1] - s.y) / s.top), SWAY_LAYERS.tree];
    for (const [dx, dz] of s.roots) {
      const bend = (rng.next() - 0.5) * 0.6;
      const points = [0, 0.25, 0.5, 0.75, 1].map((u) => [s.x + dx + Math.sin(u * Math.PI) * bend, s.y + s.top * (1 - u), s.z + dz + Math.sin(u * Math.PI) * bend * 0.5]);
      tube(B, points, points.map((_, i) => 0.08 + i * 0.015), points.map(() => 'wood'), 4);
    }
  },
  // The flag of the đình on its pole: a yellow banner with a vermilion band, in four parts so that it
  // waves (its free end moves most). { x, y (the top of the pole), z, w, h }
  flag(B, s) {
    B.swayAt = (p) => [1.2 * clamp01(Math.hypot(p[0] - s.x, p[2] - s.z) / s.w), SWAY_LAYERS.tree];
    const parts = 4;
    for (let i = 0; i < parts; i++) {
      const a = [s.x + (s.w * i) / parts, s.y, s.z];
      sheet(B, a, [s.w / parts, 0, 0], [0, -s.h * 0.7, 0], 'yellow');
      sheet(B, [a[0], s.y - s.h * 0.7, a[2]], [s.w / parts, 0, 0], [0, -s.h * 0.3, 0], 'vermilion');
    }
  },
  // Laundry on a line between two posts: three cloths that hang and move in the wind. { x, y (the
  // line), z0, z1 }
  laundry(B, s) {
    B.swayAt = (p) => [0.8 * clamp01((s.y - p[1]) / 0.8), SWAY_LAYERS.tree];
    B.line([s.x, s.y, s.z0], [s.x, s.y, s.z1]);
    const colors = ['indigo', 'vermilionPale', 'paper'];
    const step = (s.z1 - s.z0) / 3;
    colors.forEach((c, i) => sheet(B, [s.x, s.y, s.z0 + step * i + 0.15], [0, 0, step * 0.7], [0, -0.55 - (i % 2) * 0.2, 0], c));
  },
  // A kite high over the village on a windy day, on a long string from a stake. { x, y (the
  // kite), z, sx, sy, sz (the stake) }
  kite(B, s) {
    B.swayAt = (p) => [clamp01((p[1] - s.sy) / (s.y - s.sy)), SWAY_LAYERS.kite];
    const r = 0.6;
    const top = [s.x, s.y + r, s.z];
    const left = [s.x - r * 0.7, s.y, s.z];
    const right = [s.x + r * 0.7, s.y, s.z];
    const bottom = [s.x, s.y - r * 1.2, s.z];
    B.tri(top, left, right, null, 'vermilion', false);
    B.tri(left, bottom, right, null, 'yellow', false);
    for (const [a, b] of [[top, left], [left, bottom], [bottom, right], [right, top]]) B.line(a, b);
    // The tail, and the string down to the stake.
    let p = bottom;
    for (let i = 1; i <= 4; i++) {
      const q = [s.x + (i % 2 ? 0.2 : -0.2), s.y - r * 1.2 - i * 0.4, s.z];
      B.line(p, q);
      p = q;
    }
    B.line(bottom, [s.sx, s.sy, s.sz]);
  },
};

export const SMOOTH_KINDS = Object.freeze(Object.keys(BUILD));

// The mesh of one smooth look: { kind, seed, who, owner, ...the numbers of its kind }.
// Return { positions, colors, owners, indices, sway, segs, segSway, hull: { positions, indices, sway } }
// (sway: [weight, layer] for each vertex, and for each end of a line).
export function smoothMesh(s) {
  const build = BUILD[s.kind];
  if (!build) throw new Error(`Unknown smooth look ${s.kind}`);
  const B = builder(s.who ?? 0);
  build(B, s, seeded(s.seed ?? 1));
  return B.out;
}
