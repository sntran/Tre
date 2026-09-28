// The camera: which part of the world the screen shows.
// World units: one tile is tileSize units. zoom: screen pixels (CSS) for each world unit.

export function createCamera(tileSize) {
  const cam = { x: 0, y: 0, zoom: 1, viewW: 1, viewH: 1, worldW: 1, worldH: 1 };

  // Choose a zoom so that about 14 by 10 tiles show on the screen.
  cam.fit = (viewW, viewH, worldW, worldH) => {
    cam.viewW = viewW;
    cam.viewH = viewH;
    cam.worldW = worldW;
    cam.worldH = worldH;
    const z = Math.min(viewW / (14 * tileSize), viewH / (9.5 * tileSize));
    cam.zoom = Math.max(0.7, Math.min(2.2, z));
  };

  // Put the center of the view on a point, but keep the view inside the world.
  cam.follow = (x, y) => {
    const halfW = cam.viewW / cam.zoom / 2;
    const halfH = cam.viewH / cam.zoom / 2;
    cam.x = cam.worldW <= halfW * 2 ? cam.worldW / 2 : Math.max(halfW, Math.min(cam.worldW - halfW, x));
    cam.y = cam.worldH <= halfH * 2 ? cam.worldH / 2 : Math.max(halfH, Math.min(cam.worldH - halfH, y));
  };

  cam.toWorld = (sx, sy) => ({
    x: (sx - cam.viewW / 2) / cam.zoom + cam.x,
    y: (sy - cam.viewH / 2) / cam.zoom + cam.y,
  });

  cam.toScreen = (wx, wy) => ({
    x: (wx - cam.x) * cam.zoom + cam.viewW / 2,
    y: (wy - cam.y) * cam.zoom + cam.viewH / 2,
  });

  // The visible rectangle in world units.
  cam.view = () => {
    const w = cam.viewW / cam.zoom;
    const h = cam.viewH / cam.zoom;
    return { x: cam.x - w / 2, y: cam.y - h / 2, w, h };
  };

  return cam;
}
