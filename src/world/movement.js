// Free movement in the isometric world. Pure functions, no DOM.
// A person is a circle on the map (tile units). Blocked tiles are squares.
// The circle slides along walls, so that the child does not get stuck on a corner.

export const MOVE = Object.freeze({
  walk: 4.6, // map cells per second (one cell is one ground block)
  run: 7.4,
  shallow: 0.55, // the speed factor in shallow water (the ford)
  radius: 0.45,
  accel: 14, // how fast the speed follows the input (per second)
  runAt: 0.85, // a stick pushed this far makes the hero run
});

// Does a circle at (x, y) touch a blocked tile? isBlocked(tx, ty) says if a tile is blocked.
export function collides(x, y, r, isBlocked) {
  for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++) {
    for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
      if (!isBlocked(tx, ty)) continue;
      const cx = Math.max(tx, Math.min(x, tx + 1));
      const cy = Math.max(ty, Math.min(y, ty + 1));
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r - 1e-9) return true;
    }
  }
  return false;
}

// Move a circle by (dx, dy). Each small step tries x and y apart, so the circle slides along walls.
export function moveCircle(pos, dx, dy, r, isBlocked) {
  let { x, y } = pos;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (r * 0.5)));
  const sx = dx / steps;
  const sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    if (sx && !collides(x + sx, y, r, isBlocked)) x += sx;
    if (sy && !collides(x, y + sy, r, isBlocked)) y += sy;
  }
  return { x, y };
}

// Arrow keys and WASD as a screen direction. keys: a Set of KeyboardEvent.code values.
export function keysToScreenDir(keys) {
  let dx = 0;
  let dy = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) dy -= 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) dy += 1;
  return { dx, dy, run: keys.has('ShiftLeft') || keys.has('ShiftRight') };
}

// A stick: the finger at (dx, dy) from the center of a stick of radius R.
// Return the screen direction with a strength of 0 to 1, and "run" when pushed far.
export function stickToScreenDir(dx, dy, R) {
  const len = Math.hypot(dx, dy);
  if (len < R * 0.15) return { dx: 0, dy: 0, strength: 0, run: false };
  const strength = Math.min(1, len / R);
  return { dx: dx / len, dy: dy / len, strength, run: strength >= MOVE.runAt };
}

// A screen direction (x to the right, y down) as a map direction, for a camera that looks from
// the angle `az` (0: the camera is on the +y side of the map; π/2: on the +x side).
// Up on the screen is away from the camera.
export function screenToMap(dx, dy, az) {
  const rx = Math.cos(az);
  const ry = -Math.sin(az);
  const ux = -Math.sin(az);
  const uy = -Math.cos(az);
  const x = rx * dx - ux * dy;
  const y = ry * dx - uy * dy;
  const len = Math.hypot(x, y);
  return len ? { x: x / len, y: y / len } : { x: 0, y: 0 };
}

// The angle of a map direction, for the face of a figure (0 looks to +y, π/2 to +x).
export const faceOf = (dx, dy) => Math.atan2(dx, dy);

// One step of the hero. input: { dx, dy (map direction), strength (0..1), run }.
// world: { isBlocked(tx, ty), groundAt(tx, ty) }. The body keeps { x, y, vx, vy, facing },
// where facing is the angle of the direction of the last step.
export function stepBody(body, input, dt, world, cfg = MOVE) {
  const len = Math.hypot(input.dx ?? 0, input.dy ?? 0);
  const dir = len ? { x: input.dx / len, y: input.dy / len } : { x: 0, y: 0 };
  const strength = input.strength ?? (dir.x || dir.y ? 1 : 0);
  const shallow = world.groundAt?.(Math.floor(body.x), Math.floor(body.y)) === 'shallow';
  const speed = (input.run ? cfg.run : cfg.walk) * strength * (shallow ? cfg.shallow : 1) * (body.speedFactor ?? 1);
  const k = 1 - Math.exp(-cfg.accel * dt);
  body.vx = (body.vx ?? 0) + (dir.x * speed - (body.vx ?? 0)) * k;
  body.vy = (body.vy ?? 0) + (dir.y * speed - (body.vy ?? 0)) * k;
  if (Math.hypot(body.vx, body.vy) < 0.02) {
    body.vx = 0;
    body.vy = 0;
  }
  const next = moveCircle(body, body.vx * dt, body.vy * dt, cfg.radius, world.isBlocked);
  const moved = Math.hypot(next.x - body.x, next.y - body.y);
  if (moved > 1e-4) body.facing = faceOf(next.x - body.x, next.y - body.y);
  body.speed = moved / Math.max(dt, 1e-6);
  body.x = next.x;
  body.y = next.y;
  body.moving = moved > 1e-4;
  body.shallow = shallow;
  return body;
}

// A walk toward a map point (tap and hold). Return an input for stepBody.
export function inputToward(body, target, { run = false, stop = 0.25 } = {}) {
  const mx = target.x - body.x;
  const my = target.y - body.y;
  const dist = Math.hypot(mx, my);
  if (dist < stop) return { dx: 0, dy: 0, strength: 0, run: false };
  return { dx: mx / dist, dy: my / dist, strength: Math.min(1, dist / 0.8), run };
}

// Nghé follows the hero with a soft lag, on the path that the hero walked (a trail).
export const FOLLOW = Object.freeze({ gap: 2.6, trailStep: 0.35, trailMax: 80, teleport: 18, jump: 4, speed: 1.08 });

export function createFollower(x, y) {
  return { x, y, vx: 0, vy: 0, facing: 0, speed: 0, moving: false, idle: 0, trail: [] };
}

// leader: { x, y }. The follower walks to the point on the trail about "gap" tiles behind the leader.
export function stepFollower(f, leader, dt, world, cfg = FOLLOW, move = MOVE) {
  let last = f.trail[f.trail.length - 1];
  // The leader jumped (for example through a door): start a new trail.
  if (last && Math.hypot(leader.x - last.x, leader.y - last.y) > cfg.jump) {
    f.trail.length = 0;
    last = null;
  }
  if (!last || Math.hypot(leader.x - last.x, leader.y - last.y) >= cfg.trailStep) {
    f.trail.push({ x: leader.x, y: leader.y });
    if (f.trail.length > cfg.trailMax) f.trail.shift();
  }
  // Walk back along the trail from the leader until the gap is reached.
  let target = f.trail[0] ?? leader;
  let along = 0;
  for (let i = f.trail.length - 1; i > 0; i--) {
    along += Math.hypot(f.trail[i].x - f.trail[i - 1].x, f.trail[i].y - f.trail[i - 1].y);
    if (along >= cfg.gap) {
      target = f.trail[i - 1];
      break;
    }
  }
  const toLeader = Math.hypot(leader.x - f.x, leader.y - f.y);
  if (toLeader > cfg.teleport || (f.trail.length === 1 && toLeader > cfg.jump)) {
    // Too far away (for example after a scene change): jump to the trail behind the hero.
    const back = f.trail.length > 1 ? target : { x: leader.x - 1.2 * Math.sin(leader.facing ?? 0), y: leader.y - 1.2 * Math.cos(leader.facing ?? 0) };
    const spot = world.isBlocked?.(Math.floor(back.x), Math.floor(back.y)) ? leader : back;
    f.x = spot.x;
    f.y = spot.y;
    f.vx = 0;
    f.vy = 0;
    return f;
  }
  const dx = target.x - f.x;
  const dy = target.y - f.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.15 || toLeader < cfg.gap * 0.8) {
    f.moving = false;
    f.speed = 0;
    f.idle += dt;
    f.vx = 0;
    f.vy = 0;
    return f;
  }
  f.idle = 0;
  const speed = Math.min(move.run * cfg.speed, 1.2 + dist * 3);
  const shallow = world.groundAt?.(Math.floor(f.x), Math.floor(f.y)) === 'shallow';
  const step = Math.min(dist, speed * (shallow ? move.shallow : 1) * dt);
  const next = moveCircle(f, (dx / dist) * step, (dy / dist) * step, move.radius, world.isBlocked);
  const stepLen = Math.hypot(next.x - f.x, next.y - f.y);
  if (stepLen > 1e-4) f.facing = faceOf(next.x - f.x, next.y - f.y);
  f.moving = stepLen > 1e-4;
  f.speed = stepLen / Math.max(dt, 1e-6);
  f.shallow = shallow;
  f.x = next.x;
  f.y = next.y;
  return f;
}

// The world as a body at (x, y) sees it: a tile is blocked when the tile map blocks it, or when
// it is more than one step higher or lower than the tile under the body (a cliff).
export function worldFor(tileMap, x, y) {
  const here = tileMap.heightAt?.(Math.floor(x), Math.floor(y)) ?? 0;
  return {
    isBlocked: (tx, ty) => tileMap.isBlocked(tx, ty) || Math.abs((tileMap.heightAt?.(tx, ty) ?? 0) - here) > 1,
    groundAt: tileMap.groundAt,
  };
}
