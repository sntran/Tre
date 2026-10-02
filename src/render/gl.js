// The one WebGL renderer of the game: a browser has only a few WebGL contexts, and phones fewer.
// The voxel world draws with it on the canvas of the world, and the portraits (src/render/portrait.js)
// draw with it into a render target off the screen, so that there is never a second context.
import * as THREE from 'three';
import { C } from './palette.js';

let shared = null;

// The renderer on a canvas (the canvas of the world, #voxel). A call with another canvas makes a
// new renderer (the old one goes).
export function rendererFor(canvas) {
  if (!shared || shared.domElement !== canvas) {
    shared?.dispose();
    shared = new THREE.WebGLRenderer({ canvas, antialias: true });
    shared.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    shared.setClearColor(new THREE.Color(C.paper));
  }
  return shared;
}
