// The motion of the parts that hang: hair, cloth, and tails. Pure, no WebGL: the renderer puts the
// angles on the parts that have a `hang` kind (src/world/parts.js, src/world/fine.js).
//
// A hanging part hangs from one pivot, and its angle follows a target with a lag. The target comes
// from the air that the figure feels: the wind of the world minus the velocity of the figure, in
// the frame of the figure. A step swings the part (the phase of the walk), a stop lets it settle,
// and a run streams it back. The target snaps to a few positions (NOTCH) and the angle eases to it,
// so that the motion reads as a print: a few positions with a soft ease, and no jiggle. The same
// wind and the same walk give the same angles.

// The kinds of hanging parts. max: the largest angle (radians); ref: the air speed (blocks a
// second) at half of max; step: the swing of a step; lag: the time of the ease (seconds).
export const SWAY = Object.freeze({
  hang: { max: 1, ref: 3, step: 0.4, lag: 0.3 }, // a tail of hair, braids, the tail of a sash, the strings of the nón
  cloth: { max: 0.28, ref: 4, step: 0.12, lag: 0.25 }, // the hem of a skirt, a sleeve
  lift: { max: 0.5, ref: 3, step: 0, lag: 0.2 }, // the fringe: it lifts in the air from the front
  bob: { max: 0.3, ref: 4, step: 0.15, lag: 0.15 }, // a knot, a bun, tufts: they bob with the step
  ear: { max: 0.45, ref: 3, step: 0.06, lag: 0.25 }, // the ears of Nghé
  tail: { max: 0.8, ref: 3, step: 0.3, lag: 0.3 }, // the tail of Nghé, of the dog, and of the rooster
});

export const NOTCH = 0.12; // radians: the positions of a print
export const WIND_SPEED = 6; // blocks a second: the air of a wind at full strength
const FORWARD = 0.15; // the largest angle to the front of a part that hangs (it does not go into the head)

export function createSway() {
  return { ang: {} };
}

const notch = (x) => Math.round(x / NOTCH) * NOTCH;

// The air that a figure feels, in its own frame: { af (along its facing), as (to its side, +x) }.
// vel: the velocity of the figure (blocks a second, x and z of the world); wind: { x, z, strength }.
export function airOf(vel, facing, wind) {
  const w = wind?.strength ?? 0;
  const ax = (wind?.x ?? 0) * w * WIND_SPEED - (vel?.x ?? 0);
  const az = (wind?.z ?? 0) * w * WIND_SPEED - (vel?.z ?? 0);
  // The local +z of a figure is (sin f, cos f) in the world, and its local +x is (cos f, -sin f).
  return { af: ax * Math.sin(facing) + az * Math.cos(facing), as: ax * Math.cos(facing) - az * Math.sin(facing) };
}

// The target angle [rx, rz] of a kind of hanging part. A positive rx moves the free end of a part
// that hangs down to the back, and a positive rz moves it to +x.
export function targetOf(kind, air, phase = 0, stride = 0) {
  const c = SWAY[kind];
  const mag = Math.hypot(air.af, air.as);
  if (kind === 'lift') {
    // Air from the front (it goes to the back of the figure) lifts the fringe a little.
    const a = Math.max(0, -air.af);
    return [-c.max * (a / (a + c.ref)), 0];
  }
  const stream = mag > 1e-6 ? (c.max * mag) / (mag + c.ref) : 0;
  let rx = mag > 1e-6 ? stream * (-air.af / mag) : 0;
  let rz = mag > 1e-6 ? stream * (air.as / mag) : 0;
  if (kind === 'bob') rx += c.step * Math.sin(phase * 2) * stride;
  else rz += c.step * Math.sin(phase) * stride;
  rx = Math.max(-FORWARD, Math.min(c.max, rx));
  return [rx, rz];
}

// One frame: input { vel, facing, wind, phase (of the walk), stride (0 at rest to 1), dt }.
// Return { [kind]: [rx, 0, rz] } for each kind of SWAY.
export function swayStep(s, { vel = null, facing = 0, wind = null, phase = 0, stride = 0, dt = 0 } = {}) {
  const air = airOf(vel, facing, wind);
  const out = {};
  for (const kind of Object.keys(SWAY)) {
    const [tx, tz] = targetOf(kind, air, phase, stride).map(notch);
    const a = (s.ang[kind] ??= [0, 0]);
    const k = 1 - Math.exp(-dt / SWAY[kind].lag);
    a[0] += (tx - a[0]) * k;
    a[1] += (tz - a[1]) * k;
    out[kind] = [a[0], 0, a[1]];
  }
  return out;
}
