// The map of a region and the real land: a smooth warp between the cells of the region plane and
// real coordinates ([longitude, latitude]). The story places are at human scale and the land
// between them is shorter than the real distance, so one scale cannot fit. The warp goes exactly
// through its anchors (a cell and its real place) and is smooth between them: an affine fit of all
// anchors, and the rest of each anchor spread by inverse distance. Pure functions.

const KM_LAT = 110.57;

// anchors: [{ cell: [x, y], at: [lon, lat] }], at least three that are not on one line.
export function createWarp(anchors) {
  if (anchors.length < 3) throw new Error('A warp needs three anchors');
  const [lon0, lat0] = anchors[0].at;
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  // Real coordinates as km from the first anchor (x to the east, y to the south).
  const toKm = ([lon, lat]) => [(lon - lon0) * kx, (lat0 - lat) * KM_LAT];
  const fromKm = ([x, y]) => [lon0 + x / kx, lat0 - y / KM_LAT];
  const P = anchors.map((a) => toKm(a.at));
  const Q = anchors.map((a) => a.cell);
  // The affine fit: q = A p + b, by least squares (one fit for x, one for y).
  const fit = (src, dst, k) => solve3(src, dst.map((d) => d[k]));
  const fx = fit(P, Q, 0);
  const fy = fit(P, Q, 1);
  const affine = ([x, y]) => [fx[0] * x + fx[1] * y + fx[2], fy[0] * x + fy[1] * y + fy[2]];
  const det = fx[0] * fy[1] - fx[1] * fy[0];
  const inverse = ([u, v]) => {
    const a = u - fx[2];
    const b = v - fy[2];
    return [(fy[1] * a - fx[1] * b) / det, (-fy[0] * a + fx[0] * b) / det];
  };
  const restQ = Q.map((q, i) => sub(q, affine(P[i])));
  const restP = P.map((p, i) => sub(p, inverse(Q[i])));
  return {
    // The cell of a real place.
    toCell(at) {
      const p = toKm(at);
      return add(affine(p), spread(P, restQ, p));
    },
    // The real place of a cell.
    toGeo(cell) {
      return fromKm(add(inverse(cell), spread(Q, restP, cell)));
    },
  };
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];

// The rests of the anchors at a point, by inverse distance (squared). Exact at an anchor.
function spread(points, rests, p) {
  let wx = 0;
  let wy = 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const d2 = (p[0] - points[i][0]) ** 2 + (p[1] - points[i][1]) ** 2;
    if (d2 < 1e-12) return rests[i];
    const w = 1 / (d2 * d2);
    wx += rests[i][0] * w;
    wy += rests[i][1] * w;
    total += w;
  }
  return [wx / total, wy / total];
}

// Least squares for v = a x + b y + c over the points. Return [a, b, c].
function solve3(points, values) {
  const m = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  points.forEach(([x, y], i) => {
    const row = [x, y, 1];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) m[r][c] += row[r] * row[c];
      m[r][3] += row[r] * values[i];
    }
  });
  // Gauss with pivots.
  for (let c = 0; c < 3; c++) {
    let best = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[best][c])) best = r;
    [m[c], m[best]] = [m[best], m[c]];
    if (Math.abs(m[c][c]) < 1e-12) throw new Error('The anchors of a warp are on one line');
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k < 4; k++) m[r][k] -= f * m[c][k];
    }
  }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}
