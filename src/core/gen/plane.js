// The plane of the land: one plane of cells for the whole country, at one scale, the same in both
// directions. A conformal projection (Mercator, true scale at the latitude `trueLat`) with `scale`
// meters of real land for each cell: the shapes of the hills and the rivers stay, and a walk between
// two story places of a region takes one to three minutes. x goes to the east, y to the south.
// Pure functions.

const R = 6371000; // meters: the radius of the earth
const rad = (d) => (d * Math.PI) / 180;
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2));

// def: { origin: [lon, lat] (the cell 0, 0), trueLat, scale (meters for each cell) }.
export function createPlane(def) {
  const [lon0, lat0] = def.origin;
  const k = (R * Math.cos(rad(def.trueLat ?? 16))) / (def.scale ?? 45); // cells for each radian
  const m0 = merc(lat0);
  return {
    scale: def.scale ?? 45,
    // The cell of a real place.
    toCell([lon, lat]) {
      return [k * rad(lon - lon0), k * (m0 - merc(lat))];
    },
    // The real place of a cell.
    toGeo([x, y]) {
      const m = m0 - y / k;
      return [lon0 + ((x / k) * 180) / Math.PI, ((2 * Math.atan(Math.exp(m)) - Math.PI / 2) * 180) / Math.PI];
    },
    // The real size of one cell at a latitude (meters): the scale grows away from trueLat.
    metersAt(lat) {
      return (def.scale ?? 45) * (Math.cos(rad(lat)) / Math.cos(rad(def.trueLat ?? 16)));
    },
  };
}

// The place of each frame on the plane. A frame is the coordinate system of a place (the cells of
// its map file); its anchor is a cell of the frame and its real place. frames: [{ id, cell: [x, y],
// at: [lon, lat] }]. Return a Map from frame id to the plane cell of the frame cell 0, 0 (whole
// cells, so that the stamps stay on the grid).
export function frameOrigins(plane, frames) {
  const out = new Map();
  for (const f of frames) {
    const [px, py] = plane.toCell(f.at);
    out.set(f.id, [Math.round(px - f.cell[0]), Math.round(py - f.cell[1])]);
  }
  return out;
}
