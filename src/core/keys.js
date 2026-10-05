// The keys of the world on a keyboard (docs/TASKS.md). Space jumps and E acts, as in the games
// that children play; J is a second key for the jump, and Enter a second key for the action. Z and
// C turn the camera. The arrows and W A S D walk, and Shift runs.
const ACTS = {
  Space: 'jump',
  KeyJ: 'jump',
  KeyE: 'act',
  Enter: 'act',
  NumpadEnter: 'act',
  KeyZ: 'turnLeft',
  KeyC: 'turnRight',
};
const MOVES = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight']);

// What a key does (by KeyboardEvent.code): 'jump', 'act', 'turnLeft', 'turnRight', 'move' (a key
// that stays down: a walk or the run), or null (the world does not use the key).
export function keyAct(code) {
  if (ACTS[code]) return ACTS[code];
  return MOVES.has(code) ? 'move' : null;
}
