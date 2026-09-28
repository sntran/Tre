// The lists of scenes and modal screens. Modules add their screens here.
// This module imports nothing, so that there are no import cycles.

export const scenes = {};
export const modals = {};

export function registerScene(name, mount) {
  scenes[name] = mount;
}

// A modal opens over the current scene. It returns a Promise.
export function registerModal(name, open) {
  modals[name] = open;
}
