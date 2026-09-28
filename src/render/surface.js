// The main canvas. It follows the size of the window and the pixel ratio of the screen.

export function createSurface(canvas) {
  const ctx = canvas.getContext('2d');
  const s = { canvas, ctx, width: 1, height: 1, dpr: 1 };

  s.resize = () => {
    // Keep the pixel ratio at 2 or less, so that the iPad draws fast.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    s.width = w;
    s.height = h;
    s.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  };

  s.clear = (color) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  };

  s.resize();
  return s;
}
