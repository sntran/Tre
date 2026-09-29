// The camera of the isometric world. It follows a point with a soft lag, and it has
// two zoom levels (near and far). Positions are in world screen units (see grid.js).

export function createIsoCamera({ zooms = [1, 0.62], lag = 0.22 } = {}) {
  const cam = { x: 0, y: 0, level: 0, zoom: zooms[0], base: 1, viewW: 1, viewH: 1, bounds: null };

  // The size of the view in screen pixels, and the base scale for this screen.
  cam.resize = (viewW, viewH, base = 1) => {
    cam.viewW = viewW;
    cam.viewH = viewH;
    cam.base = base;
    cam.zoom = zooms[cam.level] * base;
  };

  cam.setLevel = (level) => {
    cam.level = Math.max(0, Math.min(zooms.length - 1, level));
    cam.zoom = zooms[cam.level] * cam.base;
  };

  // Move to the target with a lag: after "lag" seconds, about 63 percent of the way.
  cam.follow = (tx, ty, dt) => {
    const k = dt > 0 ? 1 - Math.exp(-dt / lag) : 1;
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    cam.clamp();
  };

  cam.jump = (tx, ty) => {
    cam.x = tx;
    cam.y = ty;
    cam.clamp();
  };

  // Keep the view over the map when the map is larger than the view.
  cam.clamp = () => {
    const b = cam.bounds;
    if (!b) return;
    const hw = cam.viewW / cam.zoom / 2;
    const hh = cam.viewH / cam.zoom / 2;
    cam.x = b.right - b.left <= hw * 2 ? (b.left + b.right) / 2 : Math.max(b.left + hw, Math.min(b.right - hw, cam.x));
    cam.y = b.bottom - b.top <= hh * 2 ? (b.top + b.bottom) / 2 : Math.max(b.top + hh, Math.min(b.bottom - hh, cam.y));
  };

  cam.toView = (sx, sy) => ({ x: (sx - cam.x) * cam.zoom + cam.viewW / 2, y: (sy - cam.y) * cam.zoom + cam.viewH / 2 });
  cam.toWorld = (vx, vy) => ({ x: (vx - cam.viewW / 2) / cam.zoom + cam.x, y: (vy - cam.viewH / 2) / cam.zoom + cam.y });

  // The visible box in world screen units.
  cam.view = () => {
    const w = cam.viewW / cam.zoom;
    const h = cam.viewH / cam.zoom;
    return { left: cam.x - w / 2, top: cam.y - h / 2, width: w, height: h };
  };

  return cam;
}
