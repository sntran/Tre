// Isometric grid math. 2:1 dimetric: a tile is a diamond 64 units wide and 32 units tall.
// Map x goes to the screen right and down. Map y goes to the screen left and down.
// "Screen" here means world pixels at zoom 1, before the camera moves and scales them.
// A position (x, y) is a point on the map in tile units: the tile (3, 5) covers 3 <= x < 4, 5 <= y < 6.

export const TILE_W = 64;
export const TILE_H = 32;
const HW = TILE_W / 2;
const HH = TILE_H / 2;

// A map point to a screen point. z is a height above the ground in screen units.
export function toScreen(x, y, z = 0) {
  return { x: (x - y) * HW, y: (x + y) * HH - z };
}

// A screen point (on the ground) to a map point.
export function toMap(sx, sy) {
  return { x: (sx / HW + sy / HH) / 2, y: (sy / HH - sx / HW) / 2 };
}

// The tile under a screen point: the diamond that contains it.
export function pickTile(sx, sy) {
  const p = toMap(sx, sy);
  return { x: Math.floor(p.x), y: Math.floor(p.y) };
}

// The four corners of a tile (or a w × h footprint) on the screen: north, east, south, west.
export function diamond(x, y, w = 1, h = 1) {
  return {
    north: toScreen(x, y),
    east: toScreen(x + w, y),
    south: toScreen(x + w, y + h),
    west: toScreen(x, y + h),
  };
}

// The screen box of a picture that stands on a footprint. The picture is (w + h) tiles wide,
// its bottom is the south corner of the footprint, and it is "height" screen units tall.
export function spriteBox(x, y, w, h, height) {
  const d = diamond(x, y, w, h);
  return { left: d.west.x, top: d.south.y - height, width: (w + h) * HW, height };
}

// A direction on the screen (for example from a stick or the arrow keys) as a map direction
// of length 1. Up on the screen is north on the map (x and y both go down).
export function screenDirToMap(dx, dy) {
  const m = { x: dx / HW + dy / HH, y: dy / HH - dx / HW };
  const len = Math.hypot(m.x, m.y);
  return len ? { x: m.x / len, y: m.y / len } : { x: 0, y: 0 };
}

// The screen box of the whole map (width × height tiles), for the camera limits.
export function mapBounds(width, height) {
  return { left: -height * HW, right: width * HW, top: 0, bottom: (width + height) * HH };
}
