// The portraits: one figure of src/world/fine.js drawn into a render target of the one renderer of
// the game (src/render/gl.js), off the screen, and copied to a small canvas. No second WebGL
// context. The same flat tones, ink outline, and light as in the world, on a clear background (the
// box around a portrait gives the paper). The key and the cache are in src/world/portraits.js.
//   head: the head and the neck (the small choice buttons of hero creation).
//   bust: the head and the shoulders down to the collarbone (the dialogue box, the HUD, the cards).
//   full: the whole figure (the callings, the notebook of #8).
// A look { prop, w, h, seed } is a prop of src/world/props/ (the gate and the stele of Văn Miếu),
// drawn whole, with its flat tones and its ink lines.
// At most one portrait renders in a frame; the others wait in a queue. pre-render the hero and the
// people of a map when the map opens, so that a dialogue never waits.
import * as THREE from 'three';
import { rendererFor } from './gl.js';
import { figureMeshes } from './figure3d.js';
import { portraitKey, createLru, propMesh, faceFrame, FACE_FRAMES, CACHE_SIZE } from '../world/portraits.js';
import { C } from './palette.js';

const SUPER = 2; // render at twice the size, and draw it smaller: soft edges with no multisampling
const ELEVATION = 0.18; // radians: the camera a little over a whole figure or a prop
const TURN = 0.4; // the three-quarter turn of a whole figure; a face has its own (FACE_FRAMES)

// The meshes of a prop on its own (src/world/portraits.js), turned by `facing`.
function propMeshes(look, facing) {
  const m = propMesh({ kind: look.prop, w: look.w, h: look.h, seed: look.seed });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(m.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(m.colors, 3));
  geometry.setIndex(m.indices);
  const lines = new THREE.BufferGeometry();
  lines.setAttribute('position', new THREE.Float32BufferAttribute(m.segments, 3));
  const group = new THREE.Group();
  const flat = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  // The ink lines: a line of one pixel, drawn again with small shifts on the screen (uOff), so that
  // it has the weight of the ink of the world.
  const color = new THREE.Color(C.ink);
  const ink = new THREE.ShaderMaterial({
    uniforms: { uOff: { value: new THREE.Vector2() }, uInk: { value: new THREE.Vector3(color.r, color.g, color.b) } },
    vertexShader: `
      uniform vec2 uOff;
      void main() {
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        p.xy += uOff * p.w;
        gl_Position = p;
      }`,
    fragmentShader: `
      uniform vec3 uInk;
      void main() { gl_FragColor = vec4(uInk, 1.0); }`,
  });
  group.add(new THREE.Mesh(geometry, flat), new THREE.LineSegments(lines, ink));
  group.rotation.y = facing;
  group.updateMatrixWorld(true);
  return {
    group,
    head: null,
    ink,
    height: m.height,
    dispose() {
      geometry.dispose();
      lines.dispose();
      flat.dispose();
      ink.dispose();
    },
  };
}

// canvas: the canvas of the world (#voxel), the canvas of the one renderer.
export function createPortraits(canvas) {
  const cache = createLru(CACHE_SIZE);
  const queue = [];
  const waiting = new Map(); // key -> [resolve]
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const clear = new THREE.Color();
  let pumping = false;
  const stats = { renders: 0, lastMs: 0 };

  // Draw one portrait now. Return a 2D canvas of size × ratio pixels.
  function render({ look, framing, mood, size, ratio, facing }) {
    const t0 = performance.now();
    const renderer = rendererFor(canvas);
    const px = Math.max(8, Math.round(size * ratio));
    const big = px * SUPER;
    const face = FACE_FRAMES[framing];
    const turn = facing ?? face?.turn ?? TURN;
    const fig = look.prop ? propMeshes(look, turn) : figureMeshes({ ...look, mood }, { facing: turn });
    scene.add(fig.group);
    // The frame: the whole figure, or the head and the shoulders around the head.
    const box = new THREE.Box3().setFromObject(fig.group);
    const center = new THREE.Vector3();
    let half;
    if (look.prop) {
      // A prop: all of it, with its footprint.
      box.getCenter(center);
      const s = box.getSize(new THREE.Vector3());
      half = Math.max(s.y, Math.hypot(s.x, s.z) * 0.8) * 0.58;
    } else if (face && fig.head) {
      // The head (and the neck, or the shoulders) fills its share of the image (src/world/portraits.js).
      const f = faceFrame(framing, { headY: fig.head.y, top: fig.crown ?? fig.height });
      center.set(fig.head.x, f.y, fig.head.z);
      half = f.half;
    } else {
      // The whole figure, from its feet (the origin) to the top of its head: the same frame at
      // every turn, so that a turning figure keeps its size.
      center.set(0, fig.height / 2, 0);
      half = Math.max(fig.height, box.max.y) * 0.56;
    }
    camera.left = -half;
    camera.right = half;
    camera.top = half;
    camera.bottom = -half;
    const elevation = face && fig.head ? face.elevation : ELEVATION;
    camera.position.set(center.x, center.y + Math.sin(elevation) * 50, center.z + Math.cos(elevation) * 50);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    const target = new THREE.WebGLRenderTarget(big, big);
    renderer.getClearColor(clear);
    const alpha = renderer.getClearAlpha();
    renderer.setRenderTarget(target);
    renderer.setClearColor(clear, 0);
    renderer.clear();
    renderer.render(scene, camera);
    if (fig.ink) {
      // The ink of a prop again, shifted by a pixel to each side.
      const auto = renderer.autoClear;
      renderer.autoClear = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        fig.ink.uniforms.uOff.value.set((dx * 3) / big, (dy * 3) / big);
        renderer.render(scene, camera);
      }
      renderer.autoClear = auto;
    }
    const pixels = new Uint8Array(big * big * 4);
    renderer.readRenderTargetPixels(target, 0, 0, big, big, pixels);
    renderer.setRenderTarget(null);
    renderer.setClearColor(clear, alpha);
    target.dispose();
    scene.remove(fig.group);
    fig.dispose();
    // The pixels come bottom row first: turn them over, then draw them at the size of the portrait.
    const raw = document.createElement('canvas');
    raw.width = big;
    raw.height = big;
    const image = new ImageData(big, big);
    const row = big * 4;
    for (let y = 0; y < big; y++) image.data.set(pixels.subarray((big - 1 - y) * row, (big - y) * row), y * row);
    raw.getContext('2d').putImageData(image, 0, 0);
    const out = document.createElement('canvas');
    out.width = px;
    out.height = px;
    const g = out.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(raw, 0, 0, px, px);
    stats.renders += 1;
    stats.lastMs = performance.now() - t0;
    return out;
  }

  // One portrait in each animation frame, until the queue is empty.
  function pump() {
    if (pumping) return;
    pumping = true;
    const tick = () => {
      const job = queue.shift();
      if (!job) {
        pumping = false;
        return;
      }
      if (!cache.has(job.key)) {
        try {
          cache.set(job.key, render(job));
        } catch (err) {
          console.warn('portrait', err);
        }
      }
      for (const resolve of waiting.get(job.key) ?? []) resolve(cache.get(job.key) ?? null);
      waiting.delete(job.key);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // The image of a portrait: a promise of a 2D canvas (from the cache, or after its turn in the queue).
  function image(look, { framing = 'bust', mood = 'calm', size = 96, ratio = Math.min(window.devicePixelRatio || 1, 2), facing = null } = {}) {
    const job = { look, framing, mood, size, ratio, facing };
    const key = portraitKey(job);
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    return new Promise((resolve) => {
      if (!waiting.has(key)) {
        waiting.set(key, []);
        queue.push({ ...job, key });
      }
      waiting.get(key).push(resolve);
      pump();
    });
  }

  return {
    image,
    // Draw these portraits soon (the hero and the people of a map that opens).
    prerender(list) {
      for (const { look, ...opts } of list) if (look) image(look, opts);
    },
    // For the tests on a device: { renders, lastMs, cached, queued }.
    stats: () => ({ ...stats, cached: cache.size, queued: queue.length }),
  };
}
