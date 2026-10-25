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

// Is the point p inside the rings (the even-odd rule)? rings: lists of { x, y }.
export function insideRings(rings, p) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i];
      const b = ring[j];
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
  }
  return inside;
}

// A point on the land of the rings near p: p itself when it is inside, or else a point a little
// inside from the nearest corner of the rings (a place on the coast can be just in the sea).
export function landPoint(rings, p) {
  if (!rings?.length || insideRings(rings, p)) return { x: p.x, y: p.y };
  let best = null;
  for (const ring of rings) {
    for (const q of ring) {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (!best || d < best.d) best = { d, q, ring };
    }
  }
  const c = best.ring.reduce((m, q) => ({ x: m.x + q.x / best.ring.length, y: m.y + q.y / best.ring.length }), { x: 0, y: 0 });
  for (let k = 1; k <= 50; k++) {
    const t = k / 50;
    const x = { x: best.q.x + (c.x - best.q.x) * t * t, y: best.q.y + (c.y - best.q.y) * t * t };
    if (insideRings(rings, x)) return x;
  }
  return { x: best.q.x, y: best.q.y };
}

// The seals of the regions on the country map (#113: a lock stood away from its land, and a tap on
// it lit a land at another place). The locked regions near each other share one seal (#45); that
// seal stands at the place of the first of them, not between them. A place just off the coast has
// its seal on the land near it. After the layout, a seal that went off the land of its region
// comes back toward its place until it is on the land.
// anchors: [{ id, x, y }] in map units; locked(id): the region is locked; areas: the map of the
// areas of the regions (regionAreas); near: the distance of a shared seal. Return the seals of
// layoutSeals, each with ids (the regions of the seal).
export function placeSeals(anchors, radius, { locked = () => false, areas = new Map(), near = radius * 4 } = {}) {
  const groups = [];
  for (const place of anchors) {
    const a = { id: place.id, ...landPoint(areas.get(place.id), place) };
    const group = locked(a.id) ? groups.find((q) => q.locked && Math.hypot(q.x - a.x, q.y - a.y) < near) : null;
    if (group) group.ids.push(a.id);
    else groups.push({ id: a.id, ids: [a.id], x: a.x, y: a.y, locked: locked(a.id) });
  }
  const seals = layoutSeals(groups, radius);
  seals.forEach((s, i) => {
    s.ids = groups[i].ids;
    const rings = areas.get(s.id);
    if (!rings?.length || insideRings(rings, s)) return;
    const from = { x: s.x, y: s.y };
    for (let k = 1; k <= 20; k++) {
      const t = 1 - k / 20;
      s.x = s.ax + (from.x - s.ax) * t;
      s.y = s.ay + (from.y - s.ay) * t;
      if (insideRings(rings, s)) break;
    }
  });
  return seals;
}

// The way on the country map from the hero to the place of the goal (#113: the map had no mark of
// Văn Miếu): the road or the river way of data/world/routes.json between the place nearest to the
// hero and the place nearest to the goal (of the places at the ends of the ways), from the hero to
// the goal. from, to: [lon, lat]; places: the places of data/geo/vietnam.json. Return a line of
// coordinates.
export function goalWay(routes, places, from, to) {
  const ends = new Set(routes.flatMap((r) => [r.from, r.to]));
  const list = places.filter((p) => ends.has(p.id));
  const nearest = (at) => list.reduce((best, p) => (distanceKm(p.at, at) < distanceKm(best.at, at) ? p : best), list[0])?.id;
  const a = nearest(from);
  const b = nearest(to);
  const r = routes.find((x) => (x.from === a && x.to === b) || (x.from === b && x.to === a));
  const via = r ? (r.from === a ? r.via ?? [] : [...(r.via ?? [])].reverse()) : [];
  return [from, ...via, to];
}

// The mark of the goal of the story on the country map: the real place of the place of the step of
// the goal, and the name of the nearest place of the map. world: src/world/regions.js; step: the
// step of the current goal (src/core/quests.js). Return { at, name } or null.
export function goalMark(world, places, step) {
  const p = step?.place;
  if (!p?.map) return null;
  const [x, y] = world.at(p.map, p.x, p.y);
  const at = world.geoAt(p.map, x, y);
  if (!at) return null;
  const named = places.filter((q) => q.name && q.kind !== 'islands');
  const near = named.reduce((best, q) => (distanceKm(q.at, at) < distanceKm(best.at, at) ? q : best), named[0]);
  return { at, name: near?.name ?? null };
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

// The names on the country map for a hero in the region `here` (#134): the regions with a name (an
// open region, or a locked region in the land of the era whose name is of the time: nameFrom in
// data/world/regions.json), and the story places with a name (the places of the open regions, of
// the time: chapter in data/geo/vietnam.json). In Era 1 neither Thăng Long (a name from 1010) nor
// Văn Miếu (built in 1070) has a name. { regions: [id], places: [id] }.
export function mapNames(world, geo, state, here) {
  const chapter = world.region(here)?.chapter ?? 1;
  const eraSouth = world.eraLand?.byChapter?.[chapter] ?? geo.bbox.lat0;
  const place = Object.fromEntries(geo.places.map((p) => [p.id, p]));
  const ofTime = (p) => (p?.chapter ?? 0) <= chapter;
  const named = (r) => world.isOpen(r.id, state) || ((place[r.place]?.at[1] ?? -90) >= eraSouth && (r.nameFrom ?? 0) <= chapter);
  return {
    regions: world.regions.filter(named).map((r) => r.id),
    places: world.regions.filter((r) => world.isOpen(r.id, state)).flatMap((r) => r.places ?? []).filter((id) => place[id] && ofTime(place[id])),
  };
}
