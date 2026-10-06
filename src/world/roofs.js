// The smooth thatch roofs: two slopes whose ridge sweeps up at the ends like a boat, a ridge cap,
// the gables, and bird-head finials on the đình; or a round roof (a low dome), as on the drums. Pure, no WebGL: the result is plain arrays, as
// from src/world/mesher.js, in world units. A roof is a look of its house: it draws while its owner
// block (a block of the house under it) is there (src/world/chunks.js).
import { toneRgb, colorIndex, FACE_TONES } from './voxel.js';

// r: a roof of a prop (fine units): { x0, x1, z0, z1, y, ridgeH, color, ridge, finials, sweep, who,
// shape ('round': a dome, else two slopes with a ridge) }.
// Return { positions, colors, owners, indices, segs, outer }.
export function roofMesh(r) {
  const S = 0.5;
  const x0 = r.x0 * S;
  const x1 = r.x1 * S;
  const z0 = r.z0 * S;
  const z1 = r.z1 * S;
  const y = r.y * S;
  const zc = (z0 + z1) / 2;
  const hd = r.ridgeH * S;
  const seg = 12;
  const positions = [];
  const colors = [];
  const owners = [];
  const indices = [];
  const segs = [];
  const outer = [];
  const who = r.who ?? 0;
  const base = colorIndex(r.color);
  const ridge = colorIndex(r.ridge);
  // The ends of the ridge rise by `sweep` ground blocks (one on a house, two on the đình).
  const sweep = r.sweep ?? 1;
  const ridgeY = (t) => y + hd + sweep * Math.abs(t) ** 3.2;
  const eaveY = (t) => y + 0.5 * sweep * Math.abs(t) ** 4;
  let n = 0;
  const quad = (pts, c, tone, flip) => {
    const rgb = toneRgb(c, tone);
    for (const p of pts) {
      positions.push(...p);
      colors.push(...rgb);
      owners.push(who);
    }
    if (flip) indices.push(n, n + 2, n + 1, n, n + 3, n + 2);
    else indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
    n += pts.length;
  };
  const line = (a, b, out = 1) => {
    segs.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    outer.push(out);
  };
  // A round roof: a low shell of thatch over the house, as on the drums (the shell of a turtle):
  // oval, long along the house, with its eaves below the top of the walls. A ring of ink at the
  // eave, a few lines down its sides, and a small cap at the top.
  if (r.shape === 'round') {
    const shell = roundShell(r);
    const { xc, around, rings, at } = shell;
    for (let j = 0; j < around; j++) {
      const a0 = (j / around) * Math.PI * 2;
      const a1 = ((j + 1) / around) * Math.PI * 2;
      const tone = 0.8 + 0.18 * Math.max(0, Math.sin((a0 + a1) / 2));
      for (let k = 0; k < rings; k++) {
        const pts = [at(a0, k / rings), at(a1, k / rings), at(a1, (k + 1) / rings), at(a0, (k + 1) / rings)];
        quad(pts, base, tone, true);
      }
      line(at(a0, 0), at(a1, 0));
      if (j % 4 === 0) line(at(a0, 0), at(a0, (rings - 1) / rings), 0);
    }
    for (let j = 0; j < around; j++) line(at((j / around) * Math.PI * 2, (rings - 1) / rings), at(((j + 1) / around) * Math.PI * 2, (rings - 1) / rings), 0);
    const capY = shell.top;
    const top = colorIndex(r.ridge);
    for (let j = 0; j < 4; j++) {
      const a0 = (j / 4) * Math.PI * 2;
      const a1 = ((j + 1) / 4) * Math.PI * 2;
      const rgb = toneRgb(top, 0.95);
      for (const p of [[xc, capY + 0.12, zc], [xc + Math.cos(a0) * 0.35, capY - 0.05, zc + Math.sin(a0) * 0.35], [xc + Math.cos(a1) * 0.35, capY - 0.05, zc + Math.sin(a1) * 0.35]]) {
        positions.push(...p);
        colors.push(...rgb);
        owners.push(who);
      }
      indices.push(n, n + 2, n + 1);
      n += 3;
    }
    return { positions, colors, owners, indices, segs, outer };
  }
  for (const sideZ of [-1, 1]) {
    for (let i = 0; i < seg; i++) {
      const ta = (i / seg) * 2 - 1;
      const tb = ((i + 1) / seg) * 2 - 1;
      const xa = x0 + ((x1 - x0) * i) / seg;
      const xb = x0 + ((x1 - x0) * (i + 1)) / seg;
      const ez = zc + sideZ * (z1 - zc);
      const pts = [[xa, ridgeY(ta), zc], [xb, ridgeY(tb), zc], [xb, eaveY(tb), ez], [xa, eaveY(ta), ez]];
      quad(pts, base, sideZ < 0 ? 0.86 : 0.98, sideZ > 0);
      line(pts[3], pts[2]);
      if (i % 2 === 0) line(pts[0], pts[3], 0);
    }
  }
  for (let i = 0; i < seg; i++) {
    const ta = (i / seg) * 2 - 1;
    const tb = ((i + 1) / seg) * 2 - 1;
    const xa = x0 + ((x1 - x0) * i) / seg;
    const xb = x0 + ((x1 - x0) * (i + 1)) / seg;
    for (const [za, zb, tone, flip] of [[zc - 0.22, zc, 1, false], [zc, zc + 0.22, 0.92, true]]) {
      const pts = [[xa, ridgeY(ta) + 0.16, za], [xb, ridgeY(tb) + 0.16, za], [xb, ridgeY(tb) + 0.16, zb], [xa, ridgeY(ta) + 0.16, zb]];
      quad(pts, ridge, tone, false);
      if (flip) line(pts[3], pts[2]);
      else line(pts[0], pts[1]);
    }
  }
  for (const [x, t] of [[x0, -1], [x1, 1]]) {
    const rgb = toneRgb(base, 0.72);
    const tri = [[x, ridgeY(t), zc], [x, eaveY(t), z1], [x, eaveY(t), z0]];
    for (const p of tri) {
      positions.push(...p);
      colors.push(...rgb);
      owners.push(who);
    }
    indices.push(n, n + 1, n + 2);
    n += 3;
    line(tri[0], tri[1]);
    line(tri[0], tri[2]);
  }
  // A bird head at each end of the ridge, as on the bronze drums: a neck, a head, and a beak.
  const box = (w, h, d, color, cx, cy, cz) => {
    const c = colorIndex(color);
    const faces = [
      ['px', [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]],
      ['nx', [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]],
      ['py', [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]],
      ['pz', [[1, -1, 1], [1, 1, 1], [-1, 1, 1], [-1, -1, 1]]],
      ['nz', [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]]],
    ];
    for (const [key, vs] of faces) quad(vs.map(([a, b, e]) => [cx + (a * w) / 2, cy + (b * h) / 2, cz + (e * d) / 2]), c, FACE_TONES[key], false);
  };
  if (r.finials) {
    for (const [x, t, dir] of [[x0, -1, -1], [x1, 1, 1]]) {
      const by = ridgeY(t) + 0.2;
      box(0.3, 1.2, 0.3, 'ochre', x + dir * 0.1, by + 0.6, zc);
      box(0.6, 0.45, 0.45, 'ochre', x + dir * 0.5, by + 1.25, zc);
      box(0.5, 0.2, 0.2, 'vermilion', x + dir * 0.95, by + 1.2, zc);
    }
  }
  return { positions, colors, owners, indices, segs, outer };
}

// The shape of a round roof (world units): an oval in plan (a superellipse, long along the longer
// side of the house, so that it covers the corners of the walls), and a low profile that stays
// wide up to half its height, then rounds over. The eave is a little below the top of the walls
// (r.y), and the top is half of the height of a ridge over them. at(a, t): the point at the angle a
// and the height t (0 at the eave, 1 at the top).
export function roundShell(r) {
  const S = 0.5;
  const x0 = r.x0 * S;
  const x1 = r.x1 * S;
  const z0 = r.z0 * S;
  const z1 = r.z1 * S;
  const xc = (x0 + x1) / 2;
  const zc = (z0 + z1) / 2;
  const long = x1 - x0 >= z1 - z0 ? 'x' : 'z';
  const rx = ((x1 - x0) / 2) * (long === 'x' ? 1.12 : 1);
  const rz = ((z1 - z0) / 2) * (long === 'z' ? 1.12 : 1);
  const eave = r.y * S - 0.6;
  const top = r.y * S + r.ridgeH * S * 0.5;
  const P = 3; // the plan: |x / rx|^P + |z / rz|^P = 1
  const Q = 3; // the profile: the width at the height t is (1 - t^Q)^(1 / Q)
  const width = (t) => Math.max(0, 1 - t ** Q) ** (1 / Q);
  const plan = (a) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [Math.sign(c) * Math.abs(c) ** (2 / P), Math.sign(s) * Math.abs(s) ** (2 / P)];
  };
  const at = (a, t) => {
    const [px, pz] = plan(a);
    const w = width(t);
    return [xc + px * rx * w, eave + (top - eave) * t, zc + pz * rz * w];
  };
  // Is a point (world units) under the shell?
  const covers = (x, y, z) => {
    if (y < eave || y > top) return false;
    const w = width((y - eave) / (top - eave));
    return Math.abs((x - xc) / (rx * w)) ** P + Math.abs((z - zc) / (rz * w)) ** P <= 1;
  };
  return { xc, zc, rx, rz, eave, top, around: 20, rings: 5, at, covers };
}

// Is a point (fine units) under the thatch of a roof: in its eaves and under its slopes (or its
// shell)? A little more than the shape, so that a line of sight past the edge of a roof counts
// (the fade of a house, #53).
export function inRoof(r, fx, fy, fz) {
  if (fx < r.x0 - 0.5 || fx > r.x1 + 0.5 || fz < r.z0 - 0.5 || fz > r.z1 + 0.5 || fy < r.y - 1) return false;
  const hx = Math.max(0.5, (r.x1 - r.x0) / 2);
  const hz = Math.max(0.5, (r.z1 - r.z0) / 2);
  const dx = Math.abs(fx - (r.x0 + r.x1) / 2) / hx;
  const dz = Math.abs(fz - (r.z0 + r.z1) / 2) / hz;
  const rise = r.shape === 'round' ? 1 - Math.min(1, dx * dx + dz * dz) : 1 - Math.min(1, dz);
  return fy <= r.y + 0.5 + r.ridgeH * 2 * rise + (r.sweep ?? 1) * 2 * dx * dx;
}
