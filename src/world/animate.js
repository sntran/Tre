// The animation of characters made of parts: a small state machine and the pose of each state.
// Pure, no WebGL. The renderer puts the pose on the parts.
//
// States: idle, walk, run, graze (four legs, after some idle time), rest (sit or lie down),
// wave (a person waves an arm), swim (a float or a serpent in the water). want 'shake': Nghé
// shakes its head (no); 'stretch': Nghé stretches its neck toward something; 'horns': Nghé
// lowers its horns; 'lift': a person lifts the right arm high.

export const GAIT = Object.freeze({ walk: 0.4, run: 5.5, graze: 1.6 });

export function createAnimator(kind) {
  return { kind, state: 'idle', phase: 0, idle: 0, rest: 0, graze: 0, wave: 0, time: 0 };
}

// input: { speed (units a second), dt, want: 'rest' | 'wave' | null, lookAt (radians, head turn) }.
// Return the pose: { state, rot: { part: [x, y, z] }, lift, lean, sink }.
export function animate(a, input) {
  const dt = input.dt ?? 0;
  const speed = input.speed ?? 0;
  a.time += dt;
  const moving = speed > GAIT.walk;
  a.idle = moving ? 0 : a.idle + dt;
  const k = (t) => Math.min(1, dt * t);
  const wantRest = input.want === 'rest' && !moving;
  const riding = input.want === 'ride';
  const happy = input.want === 'happy';
  a.rest += ((wantRest ? 1 : 0) - a.rest) * k(wantRest ? 1.5 : 4);
  a.wave += ((input.want === 'wave' && !moving ? 1 : 0) - a.wave) * k(6);
  const grazing = a.kind === 'quadruped' && !moving && a.idle > GAIT.graze && !wantRest;
  a.graze += ((grazing ? 1 : 0) - a.graze) * k(3);
  if (a.rest > 0.5) a.state = 'rest';
  else if (moving) a.state = speed > GAIT.run ? 'run' : 'walk';
  else if (a.graze > 0.5) a.state = 'graze';
  else if (a.wave > 0.5) a.state = 'wave';
  else a.state = a.kind === 'float' || a.kind === 'serpent' ? 'swim' : 'idle';
  const s = Math.min(1, speed / 4.5);
  a.phase += dt * speed * 1.9;
  const rot = {};
  let lift = 0;
  let lean = 0;
  let sink = 0;
  if (a.kind === 'biped') {
    const sw = Math.sin(a.phase) * 0.75 * s;
    // On the back of Nghé the legs go to the sides and stay still.
    rot.legL = riding ? [-0.6, 0, -0.5] : [sw - a.rest * 1.4, 0, 0];
    rot.legR = riding ? [-0.6, 0, 0.5] : [-sw - a.rest * 1.4, 0, 0];
    rot.armL = [-sw * 0.8, 0, 0];
    rot.armR = [sw * 0.8 - a.wave * 0.2, 0, -a.wave * (1.9 + Math.sin(a.time * 8) * 0.35)];
    // Lift: the arm with the staff goes up high (the general before a big blow).
    if (input.want === 'lift') rot.armR = [-2.9 + Math.sin(a.time * 6) * 0.08, 0, 0];
    lift = Math.abs(Math.cos(a.phase)) * 0.18 * s;
    lean = 0.08 * s;
    sink = a.rest * 1.2;
    const look = moving ? 0 : (input.lookAt ?? Math.sin(a.idle * 0.8) * 0.35 * Math.min(1, a.idle / 2));
    rot.head = [0, look, 0];
  } else if (a.kind === 'quadruped') {
    // Diagonal legs move together: front left with back right, front right with back left.
    const sw = Math.sin(a.phase) * 0.6 * s;
    const bend = a.rest * 1.45;
    rot.legFL = [sw + bend, 0, 0];
    rot.legBR = [sw + bend, 0, 0];
    rot.legFR = [-sw + bend, 0, 0];
    rot.legBL = [-sw + bend, 0, 0];
    rot.head = [a.graze * 0.75 + a.rest * 0.35 + Math.sin(a.time * 2.2) * 0.04, 0, 0];
    // Happy (after a pet): the tail wags fast, the head goes up, and a small hop.
    rot.tail = [0.3, 0, Math.sin(a.time * (happy ? 16 : 3.1)) * (happy ? 0.7 : 0.35)];
    if (happy) rot.head = [-0.3 + Math.sin(a.time * 8) * 0.1, 0, 0];
    if (input.want === 'shake') rot.head = [0.15, Math.sin(a.time * 14) * 0.45, 0];
    // Horns: the head goes low, the horns to the front (Nghé when the hero is hurt, and in a charge).
    if (input.want === 'horns') rot.head = [0.8, 0, 0];
    // Stretch: the neck goes long and low toward something (the gap of the bridge, as a hint).
    if (input.want === 'stretch') {
      rot.head = [0.55 + Math.sin(a.time * 3) * 0.05, 0, 0];
      lean = 0.12;
    }
    lift = Math.abs(Math.sin(a.phase)) * 0.12 * s + (happy ? Math.abs(Math.sin(a.time * 7)) * 0.3 : 0);
    sink = a.rest * 1.15;
  } else if (a.kind === 'fowl') {
    // Quick small steps; the wings flap when it runs; it pecks at the ground when it stands.
    const sw = Math.sin(a.phase * 2.2) * 0.7 * Math.min(1, speed / 2);
    rot.legL = [sw, 0, 0];
    rot.legR = [-sw, 0, 0];
    const flap = speed > 6 ? Math.sin(a.time * 40) * 0.9 : 0;
    rot.wingL = [0, 0, -0.2 - flap];
    rot.wingR = [0, 0, 0.2 + flap];
    rot.head = [moving ? 0 : Math.max(0, Math.sin(a.time * 2 + a.idle)) * 0.9, 0, 0];
    lift = speed > 6 ? Math.abs(Math.sin(a.time * 14)) * 0.8 : 0;
    sink = a.rest * 0.6;
  } else if (a.kind === 'flyer') {
    const beat = Math.sin(a.time * 12) * 0.7;
    rot.wingL = [0, 0, beat];
    rot.wingR = [0, 0, -beat];
    lift = Math.sin(a.time * 2) * 0.3;
  } else if (a.kind === 'fish') {
    rot.tail = [0, Math.sin(a.time * (moving ? 14 : 5)) * 0.5, 0];
  } else if (a.kind === 'serpent') {
    for (let i = 0; i < 5; i++) rot[`seg${i}`] = [0, Math.sin(a.time * 2 - i * 0.8) * 0.25, 0];
    rot.head = [Math.sin(a.time * 1.5) * 0.1, Math.sin(a.time * 2 + 0.8) * 0.2, 0];
    lift = Math.sin(a.time * 2) * 0.1;
  } else if (a.kind !== 'still') {
    lift = Math.sin(a.time * 2) * 0.06;
  }
  return { state: a.state, rot, lift, lean, sink };
}
