// Characters in three.js: one box for each part of a figure (src/world/figures.js), with the
// three flat tones and an ink outline, and the pose from src/world/animate.js.
import * as THREE from 'three';
import { toneRgb, colorIndex, FACE_TONES } from '../world/voxel.js';
import { C } from './palette.js';

const INK = new THREE.Color(C.ink);
// One unit of a figure is one half block (a block of the fine grid).
export const FIGURE_UNIT = 0.5;
// The order of the faces of a three.js box: +x, -x, +y, -y, +z, -z.
const TONES = [FACE_TONES.px, FACE_TONES.nx, FACE_TONES.py, FACE_TONES.ny, FACE_TONES.pz, FACE_TONES.nz];

const shadowGeometry = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
// A flat, dark disc under each figure, so that the child finds the hero in a busy frame.
const shadowMaterial = new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const hullMaterial = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
const markMaterials = new Map();
const faceMaterials = new Map();
export const night = { value: 0 };

function faceMaterial() {
  if (!faceMaterials.has('face')) {
    const m = new THREE.MeshBasicMaterial({ vertexColors: true });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = night;
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', 'uniform float uNight;\nvoid main() {')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.55, 0.6, 0.85), uNight);');
    };
    faceMaterials.set('face', m);
  }
  return faceMaterials.get('face');
}

function box(w, h, d, color, pivotTop) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (pivotTop) g.translate(0, -h / 2, 0);
  const idx = colorIndex(color);
  const cols = [];
  for (let f = 0; f < 6; f++) {
    const [r, gg, b] = toneRgb(idx, TONES[f]);
    for (let i = 0; i < 4; i++) cols.push(r, gg, b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const group = new THREE.Group();
  group.add(new THREE.Mesh(g, faceMaterial()));
  const hull = new THREE.BoxGeometry(w + 0.14, h + 0.14, d + 0.14);
  if (pivotTop) hull.translate(0, -h / 2, 0);
  group.add(new THREE.Mesh(hull, hullMaterial));
  return group;
}

function mark(w, h, d, color) {
  if (!markMaterials.has(color)) markMaterials.set(color, new THREE.MeshBasicMaterial({ color: new THREE.Color(C[color] ?? C.ink) }));
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), markMaterials.get(color));
}

// Make a figure. Return { root, body, parts, figure }.
export function buildFigure(figure) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const parts = { body };
  for (const p of figure.parts) {
    let node;
    if (!p.color) node = new THREE.Group();
    else if (p.mark) node = mark(p.size[0], p.size[1], p.size[2], p.color);
    else node = box(p.size[0], p.size[1], p.size[2], p.color, p.pivotTop);
    node.position.set(p.at[0], p.at[1], p.at[2]);
    (parts[p.parent] ?? body).add(node);
    parts[p.name] = node;
  }
  body.scale.setScalar(figure.scale * FIGURE_UNIT);
  // A soft shadow on the ground, a little to the back right (the light is at the front left).
  if (figure.shadow) {
    const disc = new THREE.Mesh(shadowGeometry, shadowMaterial);
    disc.scale.setScalar(Math.max(0.8, figure.shadow * figure.scale * FIGURE_UNIT * 1.6));
    disc.position.set(0, 0.04, 0);
    disc.renderOrder = 1;
    root.add(disc);
  }
  return { root, body, parts, figure, height: figure.height * figure.scale * FIGURE_UNIT };
}

// Put a pose on a figure.
export function applyPose(f, pose) {
  for (const [name, r] of Object.entries(pose.rot)) {
    const part = f.parts[name];
    if (part) part.rotation.set(r[0], r[1], r[2]);
  }
  const k = f.figure.scale * FIGURE_UNIT;
  f.body.position.y = (pose.lift - pose.sink) * k;
  f.body.rotation.x = pose.lean;
}

export function disposeFigure(f) {
  f.root.traverse((o) => {
    if (o.isMesh && o.geometry !== shadowGeometry) o.geometry.dispose();
  });
}
