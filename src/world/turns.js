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
