// The figures of the world in three.js. The renderer reads the world state and never changes it.
// Each entity with `position` and `look` gets a figure of parts (src/world/figures.js). All the
// parts of all the figures are one InstancedMesh (one box for each part, with its matrix and its
// color), their ink outlines are one more, and their shadows one more: three draw calls for all
// the people and animals. The motion is smooth between two steps of the world.
import * as THREE from 'three';
import { colorIndex, toneRgb, FACE_TONES } from '../world/voxel.js';
import { figureOf } from '../world/figures.js';
import { createAnimator, animate } from '../world/animate.js';
import { C } from './palette.js';

// One unit of a figure is one half block (a block of the fine grid).
export const FIGURE_UNIT = 0.5;
const HULL = 0.14; // the ink outline around each part, in figure units
const MAX_PARTS = 4096;
const MAX_FIGURES = 512;
const MAX_PUFFS = 64;
const RIDER = 0.35; // world units: the seat of a rider over the ground
// The night (0 to 1): the ink is softer at night. The color of the dusk is one multiply layer over
// the frame (see the village scene), not a tint in the shaders.
export const night = { value: 0 };

// A box of size 1 with the tone of each face (+x, -x, +y, -y, +z, -z) as an attribute.
function unitBox() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const tones = [FACE_TONES.px, FACE_TONES.nx, FACE_TONES.py, FACE_TONES.ny, FACE_TONES.pz, FACE_TONES.nz];
  const t = [];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) t.push(tones[f]);
  g.setAttribute('faceTone', new THREE.Float32BufferAttribute(t, 1));
  return g;
}

// The tone of a face is the color mixed with ink, as in src/world/voxel.js (toneRgb).
function partsMaterial() {
  const ink = new THREE.Color(C.ink);
  return new THREE.ShaderMaterial({
    uniforms: { uInk: { value: new THREE.Vector3(ink.r, ink.g, ink.b) } },
    vertexShader: `
      attribute float faceTone; attribute float plain;
      uniform vec3 uInk;
      varying vec3 vColor;
      void main() {
        float tone = plain > 0.5 ? 1.0 : faceTone;
        vColor = instanceColor * tone + uInk * (1.0 - tone);
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vColor;
      void main() { gl_FragColor = vec4(vColor, 1.0); }`,
  });
}

// The layer of all figures. lookOf(key): the look of a key (see data/figures.json).
export function createFigureLayer(scene, lookOf) {
  const box = unitBox();
  const plain = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTS), 1);
  box.setAttribute('plain', plain);
  const parts = new THREE.InstancedMesh(box, partsMaterial(), MAX_PARTS);
  parts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTS * 3), 3);
  const hulls = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(C.ink), side: THREE.BackSide }), MAX_PARTS);
  const disc = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
  // A flat, dark disc under each figure, so that the child finds the hero in a busy frame.
  const shadows = new THREE.InstancedMesh(disc, new THREE.MeshBasicMaterial({
    color: new THREE.Color(C.ink), transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }), MAX_FIGURES);
  for (const m of [parts, hulls, shadows]) {
    m.frustumCulled = false;
    m.count = 0;
    scene.add(m);
  }
  shadows.renderOrder = 1;
  // Dust puffs: small pale boxes behind a running hero.
  const dust = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(C.paperDeep), transparent: true, opacity: 0.7, depthWrite: false }), MAX_PUFFS);
  dust.frustumCulled = false;
  dust.count = 0;
  scene.add(dust);
  const puffs = [];

  const figures = new Map(); // entity id -> figure
  const m4 = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const tmp = new THREE.Matrix4();
  const color = new THREE.Color();

  // A figure: a tree of plain three.js groups (no meshes) that gives the matrix of each part.
  function build(look) {
    const figure = figureOf(look);
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    body.scale.setScalar(figure.scale * FIGURE_UNIT);
    const nodes = { body };
    const list = [];
    for (const p of figure.parts) {
      const node = new THREE.Group();
      node.position.set(p.at[0], p.at[1], p.at[2]);
      (nodes[p.parent] ?? body).add(node);
      nodes[p.name] = node;
      if (!p.color) continue;
      list.push({ node, size: p.size, pivotTop: p.pivotTop, mark: p.mark, rgb: toneRgb(colorIndex(p.color), 1) });
    }
    return { figure, root, body, nodes, parts: list, anim: createAnimator(figure.kind), height: figure.height * figure.scale * FIGURE_UNIT };
  }

  const lerpAngle = (a, b, t) => {
    const d = ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    return a + d * t;
  };

  return {
    // After each step of the world: note the new place of each entity, and add or remove figures.
    sync(world) {
      const seen = new Set();
      for (const e of world.entities) {
        if (!e.position || !e.look || e.hidden) continue;
        seen.add(e.id);
        const p = e.position;
        let f = figures.get(e.id);
        const now = { x: p.x, y: p.y, z: p.z, facing: p.facing ?? 0 };
        // A new look (a pot that breaks, a lantern in the hand): a new figure at the same place.
        const key = e.carry ? `${e.look}+${e.carry}` : e.look;
        if (f && f.look !== key) {
          figures.delete(e.id);
          f = null;
        }
        if (!f) {
          f = build(lookOf(e.look, e.carry));
          f.look = key;
          f.curr = now;
          f.shownY = p.y;
          figures.set(e.id, f);
        }
        f.prev = f.curr;
        f.curr = now;
        // A jump (a ferry, a door): no smooth motion between the two places.
        if (Math.hypot(f.curr.x - f.prev.x, f.curr.z - f.prev.z) > 6) {
          f.prev = { ...f.curr };
          f.shownY = f.curr.y;
        }
        f.speed = e.riding ? 0 : (e.motion?.speed ?? 0) / 2;
        f.control = Boolean(e.control);
        f.running = (e.motion?.speed ?? 0) > 11;
        // A rider sits on the back of Nghé; a swimmer at the ford is a little lower in the water.
        f.offset = (e.riding ? RIDER : 0) - (e.motion?.shallow && !e.control ? 0.3 : 0);
        // The pose that the state asks for: riding, rest, joy, a wave, and the bend of grass.
        f.want = e.riding ? 'ride' : e.act === 'sit' || e.act === 'rest' ? 'rest' : e.act === 'happy' ? 'happy' : e.react?.waving > 0 ? 'wave' : null;
        f.bend = e.react?.bend ?? null;
      }
      for (const id of [...figures.keys()]) if (!seen.has(id)) figures.delete(id);
    },
    // Each frame: t (0 to 1) is the time between the last two steps.
    draw(t, dt) {
      let n = 0;
      let s = 0;
      for (const f of figures.values()) {
        const a = f.prev;
        const b = f.curr;
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        // A step up or down is smooth.
        f.shownY += (b.y + f.offset * 2 - f.shownY) * Math.min(1, dt * 14);
        // Dust behind a running hero.
        if (f.control && f.running) {
          f.dust = (f.dust ?? 0) - dt;
          if (f.dust <= 0) {
            f.dust = 0.07;
            puffs.push({ x: x / 2 - Math.sin(b.facing) * 0.4, y: b.y / 2, z: z / 2 - Math.cos(b.facing) * 0.4, age: 0 });
          }
        }
        f.at = { x: x / 2, y: f.shownY / 2, z: z / 2 };
        f.root.position.set(f.at.x, f.at.y, f.at.z);
        f.root.rotation.y = lerpAngle(a.facing, b.facing, t);
        const pose = animate(f.anim, { speed: f.speed, dt, want: f.want });
        for (const [name, r] of Object.entries(pose.rot)) f.nodes[name]?.rotation.set(r[0], r[1], r[2]);
        f.body.position.y = (pose.lift - pose.sink) * f.figure.scale * FIGURE_UNIT;
        f.body.rotation.x = pose.lean;
        f.body.rotation.z = 0;
        if (f.bend) {
          // Tall grass bends away from the hero (the direction is in the world; the figure turns).
          const a = f.bend.dir - f.root.rotation.y;
          f.body.rotation.x = Math.cos(a) * f.bend.amount * 0.9;
          f.body.rotation.z = -Math.sin(a) * f.bend.amount * 0.9;
        }
        f.root.updateMatrixWorld(true);
        for (const p of f.parts) {
          if (n >= MAX_PARTS) break;
          const [w, h, d] = p.size;
          m4.multiplyMatrices(p.node.matrixWorld, local.makeTranslation(0, p.pivotTop ? -h / 2 : 0, 0));
          parts.setMatrixAt(n, tmp.multiplyMatrices(m4, local.makeScale(w, h, d)));
          hulls.setMatrixAt(n, p.mark ? tmp.makeScale(0, 0, 0) : tmp.multiplyMatrices(m4, local.makeScale(w + HULL, h + HULL, d + HULL)));
          parts.setColorAt(n, color.setRGB(p.rgb[0], p.rgb[1], p.rgb[2]));
          plain.array[n] = p.mark ? 1 : 0;
          n += 1;
        }
        if (f.figure.shadow && s < MAX_FIGURES) {
          const r = Math.max(0.8, f.figure.shadow * f.figure.scale * FIGURE_UNIT * 1.6);
          shadows.setMatrixAt(s++, tmp.makeScale(r, 1, r).setPosition(f.at.x, b.y / 2 + 0.04, f.at.z));
        }
      }
      // The dust puffs rise, grow, and go.
      let q = 0;
      for (let i = puffs.length - 1; i >= 0; i--) {
        const d = puffs[i];
        d.age += dt;
        if (d.age > 0.5 || q >= MAX_PUFFS) {
          puffs.splice(i, 1);
          continue;
        }
        const k = 0.25 + d.age * 0.9;
        dust.setMatrixAt(q++, tmp.makeScale(k, k, k).setPosition(d.x, d.y + 0.15 + d.age * 0.6, d.z));
      }
      dust.count = q;
      dust.instanceMatrix.needsUpdate = true;
      parts.count = n;
      hulls.count = n;
      shadows.count = s;
      for (const m of [parts, hulls, shadows]) m.instanceMatrix.needsUpdate = true;
      parts.instanceColor.needsUpdate = true;
      plain.needsUpdate = true;
    },
    // The place of an entity as it is drawn now (world units), and its height.
    placeOf(id) {
      const f = figures.get(id);
      return f?.at ? { ...f.at, height: f.height } : null;
    },
    dispose() {
      for (const m of [parts, hulls, shadows, dust]) {
        scene.remove(m);
        m.material.dispose();
        m.dispose();
      }
      box.dispose();
      disc.dispose();
      figures.clear();
    },
  };
}
