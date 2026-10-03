// The fine heights of the land: tiles of 1 x 1 degree with a value every 0.005 degree (about
// 550 m), made from SRTM by tools/geo/build.mjs (data/geo/heights/<name>.bin). Each value keeps the
// tops of its square, so that a small hill keeps its height. A tile has both of its edges, so that
// a point in a tile needs no other tile: the land can be made tile by tile. And the curve that
// turns meters into steps of the ground. Pure functions, no DOM.

// The name of the tile that holds a point (its south-west corner, as SRTM names it).
export function tileOf(lon, lat) {
  const la = Math.floor(lat);
  const lo = Math.floor(lon);
  return `N${String(la).padStart(2, '0')}E${String(lo).padStart(3, '0')}`;
}

// Read a tile file (an ArrayBuffer or a Node Buffer): the length of the header (4 bytes,
// little-endian), the header (JSON), and the values (16-bit, little-endian, row 0 is the north).
// Return the header with the values (data, meters).
export function parseHeightTile(bytes) {
  const buf = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const view = new DataView(buf);
  const n = view.getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, n)));
  const count = header.cols * header.rows;
  if (buf.byteLength !== 4 + n + count * 2) throw new Error(`Height tile ${header.tile}: wrong size`);
  const data = new Int16Array(count);
  for (let i = 0; i < count; i++) data[i] = view.getInt16(4 + n + i * 2, true);
  return { ...header, data };
}

// The heights of a set of tiles: at(lon, lat) gives the meters at a point (bilinear between the
// four values around it, from the tile of the point only), or null where no tile is loaded. More
// tiles can come later (add), when the hero comes near them.
export function createHeights(tiles = []) {
  const byName = new Map(tiles.map((t) => [t.tile, t]));
  return {
    get tiles() { return [...byName.keys()]; },
    has: (name) => byName.has(name),
    add(t) { byName.set(t.tile, t); },
    at(lon, lat) {
      const t = byName.get(tileOf(lon, lat));
      if (!t) return null;
      const fx = (lon - t.lon0) / t.step;
      const fy = (t.lat1 - lat) / t.step;
      const x0 = Math.max(0, Math.min(t.cols - 2, Math.floor(fx)));
      const y0 = Math.max(0, Math.min(t.rows - 2, Math.floor(fy)));
      const tx = Math.max(0, Math.min(1, fx - x0));
      const ty = Math.max(0, Math.min(1, fy - y0));
      const v = (x, y) => t.data[y * t.cols + x];
      return (v(x0, y0) * (1 - tx) + v(x0 + 1, y0) * tx) * (1 - ty) + (v(x0, y0 + 1) * (1 - tx) + v(x0 + 1, y0 + 1) * tx) * ty;
    },
  };
}

// The steps of the ground over the base for a height in meters: a concave curve, so that the low
// land stays flat (the paddies), a hill of 100 m is about 8 steps, and a mountain of 1,300 m about 29.
// relief: { low (meters: the low land; the land under it is flat), k }.
export function stepsOf(meters, relief) {
  return relief.k * Math.sqrt(Math.max(0, meters - relief.low));
}
