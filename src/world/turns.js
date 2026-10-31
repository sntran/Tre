// When the view turns by itself (#111). A turn changes the directions of the stick and of the
// screen, and a child loses the way (#77), so the view turns only:
// - one time for each work (a task, an example, a puzzle: the key of its view), at its start, and
//   not again for its lines: a line of a talk that names things leads and zooms the view, but never
//   turns it;
// - one time when the hero stands still and a building covers most of the hero (stillTurn in
//   src/world/fade.js);
// - never within HAND_KEEP of a turn of the child: the view that the child chose stays (#75);
// - never two turns by itself within TURN_GAP, and no turn for the hero in a task (#133: "The camera
//   keeps spinning by itself, it makes me dizzy.").
// No DOM.
export const HAND_KEEP = 5 * 60 * 1000; // milliseconds
export const TURN_GAP = 30 * 1000; // milliseconds between two turns of the view by itself

export function createTurns() {
  let hand = null;
  let last = null;
  const turned = new Set();
  const keeps = (now) => (hand !== null && now - hand < HAND_KEEP) || (last !== null && now - last < TURN_GAP);
  return {
    // The view turned by itself now.
    did(now) {
      last = now;
    },
    // A turn of the child.
    hand(now) {
      hand = now;
    },
    keeps,
    // The view of a work starts or goes on: may the view turn now? One turn for each key, also
    // when the view of the child keeps it (the work had its time to turn).
    work(key, now) {
      const first = !key || !turned.has(key);
      if (key) turned.add(key);
      return first && !keeps(now);
    },
    // A line of a talk that names things: never a turn.
    names() {
      return false;
    },
    // The hero stands still: may the view turn for the hero? Never in a task (task: true): the
    // task had its one turn at its start.
    still(now, task = false) {
      return !task && !keeps(now);
    },
    // The hero left the work: a new start of the same work turns again.
    away() {
      turned.clear();
    },
  };
}

// A stop of the hero (#149: the view turned between two pushes of the stick, and the next push to
// the right took a girl back the way she came). A pause between two pushes is not a stop: the turn
// for a still hero comes only after a stop that the child makes: the end of a walk from a tap
// (STILL_WAIT), or no touch on the stick for STICK_REST. Never while a finger is on the stick.
// step(dt, { moving, route, stick }): moving: the hero moves now; route: a walk from a tap goes on;
// stick: a finger is on the stick (or a key is down). Return true one time at a stop.
export const STILL_WAIT = 0.4; // seconds after the end of a walk from a tap
export const STICK_REST = 2; // seconds with no touch on the stick
export function createStill() {
  let still = 0;
  let done = false;
  let by = null; // what made the last move: 'walk' (a tap) or 'stick'
  return {
    step(dt, { moving, route, stick }) {
      if (stick) by = 'stick';
      else if (route) by = 'walk';
      if (moving || route || stick) {
        still = 0;
        done = false;
        return false;
      }
      still += dt;
      if (done || still < (by === 'stick' ? STICK_REST : STILL_WAIT)) return false;
      done = true;
      return true;
    },
    get still() {
      return still;
    },
    get done() {
      return done;
    },
  };
}

// The directions of the stick over a turn of the view (#149): while the finger is down, the stick
// keeps the angle of the view at the touch; the next touch takes the new angle. stick: { active,
// az }; Return the angle for the directions of the stick now.
export function stickAngle(stick, viewAz) {
  return stick.active && Number.isFinite(stick.az) ? stick.az : viewAz;
}
