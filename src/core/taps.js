// The taps that miss (#84): a miss is a tap that chooses no person, no face, and no thing of a
// task, when a second tap less than REACH_MM away chooses one within WINDOW seconds. The view gives
// each tap of the world; the counts go into the learning log (the event taps), and the weekly page
// of the parent says when many taps miss. Never in the world: the view does not change by itself.

export const REACH_MM = 15;
export const WINDOW = 1.5; // seconds

// mmPerPoint: the millimeters of a point of the screen (src/world/view.js, mmOf).
export function createTapCount({ mmPerPoint = 0.164, reachMM = REACH_MM, window = WINDOW } = {}) {
  const reach = reachMM / mmPerPoint;
  let taps = 0;
  let misses = 0;
  let open = []; // the taps that chose nothing in the last WINDOW seconds: { t, x, y }
  return {
    // A tap at the time t (seconds) at the screen point (x, y). chose: it chose a person, a face, or
    // a thing.
    tap(t, x, y, chose) {
      taps += 1;
      open = open.filter((o) => t - o.t <= window);
      if (chose) {
        // Each tap that chose nothing near this one, a moment before, missed.
        const near = open.filter((o) => Math.hypot(o.x - x, o.y - y) < reach);
        misses += near.length;
        open = open.filter((o) => !near.includes(o));
      } else open.push({ t, x, y });
    },
    // The counts since the last take, and a new start.
    take() {
      const out = { taps, misses };
      taps = 0;
      misses = 0;
      return out;
    },
    get counts() {
      return { taps, misses };
    },
  };
}

// The line of the weekly page (#84): many taps miss when more than MISS_SHARE of the taps of the
// week are misses, with at least MIN_TAPS taps.
export const MIN_TAPS = 50;
export const MISS_SHARE = 0.2;
export const manyMisses = (taps, misses) => taps >= MIN_TAPS && misses / taps > MISS_SHARE;
