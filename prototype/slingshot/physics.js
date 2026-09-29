// The flight of a stone from the slingshot. Pure functions, no DOM.
// World units: 1 unit = 1 step on the distance markers. x goes right, y goes up.
// The slingshot is at x = 0, at the height cfg.h0 above the ground.

export const PHYSICS = Object.freeze({
  g: 20, // gravity, units per second per second
  h0: 1.1, // the height of the slingshot pouch
  vMax: 27, // the speed at a full pull
  minAngle: (5 * Math.PI) / 180,
  maxAngle: (80 * Math.PI) / 180,
  restitution: 0.35, // the part of the speed down that becomes speed up in the bounce
  friction: 0.45, // the part of the speed forward that stays after the bounce
  previewTime: 0.28, // the preview shows the first part of the arc only (seconds)
});

// A shot from a drag. (dx, dy): the vector from the pouch to the finger, in world units.
// The stone flies the other way. maxPull: the drag length for a full pull.
export function shotFromDrag(dx, dy, maxPull, cfg = PHYSICS) {
  const length = Math.hypot(dx, dy);
  const power = Math.min(1, length / maxPull);
  let angle = Math.atan2(-dy, -dx);
  // A drag to the right or up gives a steep shot, not a shot to the left or down.
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle = cfg.maxAngle;
  angle = Math.max(cfg.minAngle, Math.min(cfg.maxAngle, angle));
  return { speed: power * cfg.vMax, angle, power };
}

// The position of the stone in the first arc, at time t after the release.
export function positionAt(shot, t, cfg = PHYSICS) {
  const vx = shot.speed * Math.cos(shot.angle);
  const vy = shot.speed * Math.sin(shot.angle);
  return { x: vx * t, y: cfg.h0 + vy * t - (cfg.g * t * t) / 2 };
}

// The time when the first arc reaches the ground.
export function landingTime(shot, cfg = PHYSICS) {
  const vy = shot.speed * Math.sin(shot.angle);
  return (vy + Math.sqrt(vy * vy + 2 * cfg.g * cfg.h0)) / cfg.g;
}

// The full flight: the first arc, one bounce, and the stop.
// wall (optional): { x, height }. A stone that reaches the wall below its top stops at the wall.
// Return { landX, landT, stopX, stopT, blocked, at(t) }.
export function flight(shot, { wall = null } = {}, cfg = PHYSICS) {
  const vx = shot.speed * Math.cos(shot.angle);
  const vy = shot.speed * Math.sin(shot.angle);
  const landT = landingTime(shot, cfg);
  const landX = vx * landT;
  if (wall && vx > 0 && wall.x < landX) {
    const tw = wall.x / vx;
    const yw = positionAt(shot, tw, cfg).y;
    if (yw <= wall.height) {
      // The stone hits the wall and drops to its foot.
      const dropT = Math.sqrt((2 * Math.max(0, yw)) / cfg.g);
      const at = (t) => (t <= tw ? positionAt(shot, t, cfg)
        : { x: wall.x - 0.15, y: Math.max(0, yw - (cfg.g * (t - tw) ** 2) / 2) });
      return { landX: wall.x - 0.15, landT: tw + dropT, stopX: wall.x - 0.15, stopT: tw + dropT, blocked: true, at };
    }
  }
  // One bounce: part of the speed down turns up, and the stone slows.
  const vyLand = vy - cfg.g * landT;
  const bvx = vx * cfg.friction;
  const bvy = -vyLand * cfg.restitution;
  const bounceT = (2 * bvy) / cfg.g;
  const stopX = landX + bvx * bounceT;
  const stopT = landT + bounceT;
  const at = (t) => {
    if (t <= landT) return positionAt(shot, t, cfg);
    const s = Math.min(t, stopT) - landT;
    return { x: landX + bvx * s, y: Math.max(0, bvy * s - (cfg.g * s * s) / 2) };
  };
  return { landX, landT, stopX, stopT, blocked: false, at };
}

// The height of the first arc at the distance x (for the combo rule and the wall).
export function heightAt(shot, x, cfg = PHYSICS) {
  const vx = shot.speed * Math.cos(shot.angle);
  if (vx <= 0) return -Infinity;
  return positionAt(shot, x / vx, cfg).y;
}

// The speed that makes a stone land at a distance, at an angle. For tests and the demo player.
export function speedFor(distance, angle, cfg = PHYSICS) {
  const c = Math.cos(angle);
  const v2 = (cfg.g * distance * distance) / (2 * c * c * (cfg.h0 + distance * Math.tan(angle)));
  return Math.sqrt(v2);
}

// The first part of the arc, for the dotted preview.
export function previewPoints(shot, count = 8, cfg = PHYSICS) {
  const out = [];
  for (let i = 1; i <= count; i++) out.push(positionAt(shot, (cfg.previewTime * i) / count, cfg));
  return out;
}
