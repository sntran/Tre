// The country map: real coordinates to map units and back, distances, region areas, the land
// of an era, and the places of the seals. Pure functions, no DOM.
// A coordinate is [longitude, latitude] in degrees. Map units: x to the east, y to the south.

export const EARTH_KM = 6371;

// An equirectangular projection. One degree of latitude is `unit` map units; one degree of
// longitude is shorter by the cosine of the middle latitude, so that shapes look true near it.
export function createProjection(box, { unit = 60, midLat = 16 } = {}) {
  const kx = unit * Math.cos((midLat * Math.PI) / 180);
  return {
    unit,
    width: (box.lon1 - box.lon0) * kx,
    height: (box.lat1 - box.lat0) * unit,
    toMap: ([lon, lat]) => ({ x: (lon - box.lon0) * kx, y: (box.lat1 - lat) * unit }),
    fromMap: ({ x, y }) => [box.lon0 + x / kx, box.lat1 - y / unit],
  };
}

// The distance on the earth between two coordinates, in km.
export function distanceKm([lon1, lat1], [lon2, lat2]) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

// The length of a line of coordinates, in km.
export function lineKm(line) {
  let km = 0;
  for (let i = 1; i < line.length; i++) km += distanceKm(line[i - 1], line[i]);
  return km;
}

// Clip a polygon (points {x, y}, can be concave) to a half-plane: keep the side where f(p) >= 0.
// f is a linear function, so the cut point is found from the values at the two ends.
export function clipHalf(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const fa = f(a);
    const fb = f(b);
    if (fb >= 0) {
      if (fa < 0) out.push(lerp(a, b, fa / (fa - fb)));
      out.push(b);
    } else if (fa >= 0) {
      out.push(lerp(a, b, fa / (fa - fb)));
    }
  }
  return out;
}

const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// The land south of a latitude is not the land of the era. Return the part of a ring
// (coordinates) north of the latitude, as coordinates.
export function northOf(ring, lat) {
  return clipHalf(ring.map(([x, y]) => ({ x, y })), (p) => p.y - lat).map((p) => [p.x, p.y]);
}

// Clip a polygon whose edges have tags (the tag of the edge that starts at each point) to a
// half-plane. The new edge along the cut line gets the tag `cut`.
function clipTagged(poly, f, cut) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const fa = f(a);
    const fb = f(b);
    if (fa >= 0) {
      out.push(a);
      if (fb < 0) out.push({ ...lerp(a, b, fa / (fa - fb)), tag: cut });
    } else if (fb >= 0) {
      out.push({ ...lerp(a, b, fa / (fa - fb)), tag: a.tag });
    }
  }
  return out;
}

// The area of each region: the land that is nearer to a point of the region than to any other
// point (Voronoi cells), cut from the land rings. centers: [{ id, x, y }] in map units; a region
// can have more than one point. rings: land rings in map units ([{x, y}]).
// Return { areas: Map from id to a list of rings, borders: [[{x, y}, {x, y}]] }: the borders are
// the edges between two regions (not the edges between two points of the same region).
export function regionAreas(centers, rings) {
  const areas = new Map(centers.map((c) => [c.id, []]));
  const borders = [];
  centers.forEach((c, ci) => {
    for (const ring of rings) {
      let part = ring.map((p) => ({ x: p.x, y: p.y, tag: -1 }));
      centers.forEach((o, oi) => {
        if (oi === ci || !part.length) return;
        // Keep the points nearer to c than to o: the half-plane of the perpendicular bisector.
        const mx = (c.x + o.x) / 2;
        const my = (c.y + o.y) / 2;
        const dx = c.x - o.x;
        const dy = c.y - o.y;
        part = clipTagged(part, (p) => (p.x - mx) * dx + (p.y - my) * dy, oi);
      });
      if (part.length < 3) continue;
      areas.get(c.id).push(part.map((p) => ({ x: p.x, y: p.y })));
      part.forEach((p, i) => {
        if (p.tag >= 0 && centers[p.tag].id !== c.id && ci < p.tag) borders.push([p, part[(i + 1) % part.length]].map((q) => ({ x: q.x, y: q.y })));
      });
    }
  });
  return { areas, borders };
}

// Seals on the map must not cover each other. Each seal starts at its anchor (the real place).
// Seals that are too near push each other away; a weak pull keeps each seal near its anchor.
// radius: the radius of a seal in map units. Return [{ id, x, y, ax, ay }].
export function layoutSeals(anchors, radius, { steps = 200, pull = 0.02 } = {}) {
  const seals = anchors.map((a, i) => ({ id: a.id, ax: a.x, ay: a.y, x: a.x + Math.cos(i * 2.4) * 0.01, y: a.y + Math.sin(i * 2.4) * 0.01 }));
  const min = radius * 2.2;
  for (let s = 0; s < steps; s++) {
    for (let i = 0; i < seals.length; i++) {
      for (let j = i + 1; j < seals.length; j++) {
        const a = seals[i];
        const b = seals[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        if (d >= min) continue;
        const push = (min - d) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
      }
    }
    // The last steps only push, so that no two seals overlap at the end.
    const k = s < steps - 40 ? pull : 0;
    for (const p of seals) {
      p.x += (p.ax - p.x) * k;
      p.y += (p.ay - p.y) * k;
    }
  }
  return seals;
}

// Flat bands of height from a grid, with smooth edges: each cell is cut into two triangles, and
// each triangle is cut at the height `level` (the height changes in a straight line inside a
// triangle). grid: rows of values, row 0 is the north. cellAt(row, col) gives the map point of the
// north-west corner of a cell. Return the rings (in map units) of the land higher than `level`.
export function heightBand(grid, cellAt, level) {
  const rings = [];
  for (let r = 0; r + 1 < grid.length; r++) {
    for (let c = 0; c + 1 < grid[r].length; c++) {
      const v = [grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]];
      if (Math.max(...v) < level) continue;
      const p = [cellAt(r, c), cellAt(r, c + 1), cellAt(r + 1, c + 1), cellAt(r + 1, c)];
      for (const tri of [[0, 1, 2], [0, 2, 3]]) {
        const pts = tri.map((i) => ({ ...p[i], v: v[i] }));
        if (pts.every((q) => q.v >= level)) {
          rings.push(pts);
          continue;
        }
        const out = [];
        for (let i = 0; i < 3; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % 3];
          if (a.v >= level) out.push(a);
          if ((a.v >= level) !== (b.v >= level)) {
            const t = (level - a.v) / (b.v - a.v);
            out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
          }
        }
        if (out.length >= 3) rings.push(out);
      }
    }
  }
  return rings;
}
