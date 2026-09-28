// Hit tests on the map. A tap anywhere on the picture of a person or an enemy
// (head, body, or feet) selects that person, not only a tap on the tile of the feet.

// sprites: [{ id, x, y, w, h }] where (x, y) is the middle of the feet, in world units.
// pad: extra units around each picture, for small fingers.
// Return the sprite in front (the largest y) that contains the point, or null.
export function spriteAt(sprites, px, py, pad = 0) {
  let best = null;
  for (const s of sprites) {
    const inside = px >= s.x - s.w / 2 - pad && px <= s.x + s.w / 2 + pad && py >= s.y - s.h - pad && py <= s.y + pad;
    if (inside && (!best || s.y > best.y)) best = s;
  }
  return best;
}

// The point on the edge of a view rectangle in the direction of a target that is out of view.
// view: { x, y, w, h }. inset: { top, right, bottom, left } space to keep free at the edges.
// Return null when the target is in view. Otherwise { x, y, angle } (angle points to the target).
export function edgeMarker(view, target, inset = {}) {
  const left = view.x + (inset.left ?? 0);
  const right = view.x + view.w - (inset.right ?? 0);
  const top = view.y + (inset.top ?? 0);
  const bottom = view.y + view.h - (inset.bottom ?? 0);
  if (target.x >= left && target.x <= right && target.y >= top && target.y <= bottom) return null;
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;
  // Move from the middle toward the target until the line meets the edge.
  const sx = dx === 0 ? Infinity : ((dx > 0 ? right : left) - cx) / dx;
  const sy = dy === 0 ? Infinity : ((dy > 0 ? bottom : top) - cy) / dy;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s, angle: Math.atan2(dy, dx) };
}
