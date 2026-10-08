// The minimap (#8): a small round map in the corner that shows the near places, turned as the view
// is turned, so that up on the minimap is away from the camera, as up on the screen. Pure: cells in,
// minimap pixels out; the village (src/ui/village.js) draws it.

export const MINI = Object.freeze({ radius: 22, size: 76 }); // cells around the hero; pixels across

// A point near the hero (dx, dz in cells, x east and z south) on the minimap (pixels from its middle,
// x to the right and y down), for the angle az of the view (src/world/view.js: the right of the
// screen is (cos az, -sin az) on the ground, and the camera is at (sin az, cos az)).
export function toMini(dx, dz, az, scale = MINI.size / (2 * MINI.radius)) {
  return {
    x: (dx * Math.cos(az) - dz * Math.sin(az)) * scale,
    y: (dx * Math.sin(az) + dz * Math.cos(az)) * scale,
  };
}

// The colors (palette names) of the kinds of ground, flat as on a print. A solid cell that is not
// water is a house or a wall.
const KINDS = {
  water: 'indigoPale', sea: 'indigoPale', surf: 'indigoPale', shallow: 'indigoPale', ditch: 'indigoPale',
  path: 'yellowPale', yard: 'yellowPale', bridge: 'wood', dike: 'yellowPale', sand: 'yellowPale',
  field: 'green', bamboo: 'greenDeep', hedge: 'greenDeep', 'hedge-low': 'greenDeep',
  grass: 'greenPale', flowers: 'greenPale', rock: 'ash',
};
export function miniKind(type, solid = false) {
  const water = ['water', 'sea', 'surf', 'shallow', 'ditch'].includes(type);
  if (solid && !water && type !== 'bamboo' && type !== 'hedge' && type !== 'hedge-low') return 'ink';
  return KINDS[type] ?? 'paperDeep';
}

// Is a point (dx, dz in cells) on the round minimap?
export const onMini = (dx, dz, radius = MINI.radius) => dx * dx + dz * dz <= radius * radius;
