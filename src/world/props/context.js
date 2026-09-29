// The context of a prop builder: it writes half-size blocks into the fine grid, keeps the box
// of the prop (for the fade of things in front of the hero), the roofs (smooth meshes), and the
// shadows on the ground. Pure, no DOM.
import { seeded } from '../voxel.js';

// fine: the fine grid. groundTop(fx, fz): the first free fine y over the ground at a fine x, z.
// shadow(cx, cz): mark a ground cell (full-size) as in shadow.
export function propContext(fine, groundTop, shadow, { who = 0, seed = 1 } = {}) {
  const box = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  const roofs = [];
  const grow = (x, y, z) => {
    if (x < box.x0) box.x0 = x;
    if (y < box.y0) box.y0 = y;
    if (z < box.z0) box.z0 = z;
    if (x + 1 > box.x1) box.x1 = x + 1;
    if (y + 1 > box.y1) box.y1 = y + 1;
    if (z + 1 > box.z1) box.z1 = z + 1;
  };
  const ctx = {
    rng: seeded(seed),
    who,
    ground: groundTop,
    set(x, y, z, color) {
      if (!fine.inside(x, y, z)) return;
      fine.set(x, y, z, color, who);
      grow(x, y, z);
    },
    // Set only an empty place.
    add(x, y, z, color) {
      if (fine.get(x, y, z)) return;
      ctx.set(x, y, z, color);
    },
    box(x0, y0, z0, x1, y1, z1, color) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) {
          for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) ctx.set(x, y, z, color);
        }
      }
    },
    get: (x, y, z) => fine.get(x, y, z),
    // A shadow on the ground, at a fine x, z.
    shadow: (fx, fz) => shadow(Math.floor(fx / 2), Math.floor(fz / 2)),
    // A disc of shadow: the light comes from the front-left, so a shadow falls to -z (back-right).
    shadowDisc(cx, cz, r, back) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= r * r) ctx.shadow(cx + dx, cz + dz - back);
      }
    },
    // A roof: a smooth thatch shape that the renderer makes (fine units).
    roof(r) {
      roofs.push({ ...r, who });
      grow(r.x0, r.y, r.z0);
      grow(r.x1 - 1, r.y + r.ridgeH * 2, r.z1 - 1);
    },
  };
  ctx.result = () => ({ box: box.x0 === Infinity ? null : { ...box }, roofs });
  return ctx;
}
