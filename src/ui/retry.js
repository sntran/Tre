// The tries of a picture that did not draw (#162: a busy renderer left most prints of the
// notebook as empty boxes after one more try). Pure: no DOM and no WebGL, so that a test runs it.
// The waits grow, and the tries go on while the picture is still wanted (alive).
export const DRAW_WAITS = Object.freeze([300, 600, 1200, 2400, 4800, 8000]);
export const DRAW_TRIES = 40; // tries of a picture that is not on the screen (about five minutes)

// attempt(): a promise of true when the picture drew. wait(ms, fn): calls fn after ms. alive(n):
// false when the picture is not wanted any more (n: the tries so far). Return a promise of the
// count of tries when the picture drew, or null when the tries stopped.
export function retryDraw(attempt, { wait = (ms, fn) => setTimeout(fn, ms), waits = DRAW_WAITS, alive = (n) => n < DRAW_TRIES } = {}) {
  return new Promise((done) => {
    let n = 0;
    const go = () => {
      n += 1;
      Promise.resolve().then(attempt).catch(() => false).then((ok) => {
        if (ok) return done(n);
        if (!alive(n)) return done(null);
        wait(waits[Math.min(n - 1, waits.length - 1)], go);
      });
    };
    go();
  });
}
