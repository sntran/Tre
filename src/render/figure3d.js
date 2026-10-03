// The figures of the world in three.js. The renderer reads the world state and never changes it.
// Each entity with `position` and `look` gets a figure of parts (src/world/figures.js). All the
// parts of all the figures are one InstancedMesh (one box for each part, with its matrix and its
// color), their ink outlines are one more, and their shadows one more: three draw calls for all
// the people and animals. The motion is smooth between two steps of the world. A figure near the
// hero draws its fine version (a grid of quarter blocks, src/world/fine.js), a far one its coarse
// version, and a figure out of the view draws nothing (src/world/lod.js). Hair, cloth, and tails
// move with the walk of the figure and the wind of the world (src/world/sway.js).
import * as THREE from 'three';
import { colorIndex, toneRgb, FACE_TONES } from '../world/voxel.js';
import { figureOf } from '../world/figures.js';
import { createAnimator, animate } from '../world/animate.js';
import { detailFor, inView, lodFor } from '../world/lod.js';
import { createSway, swayStep } from '../world/sway.js';
import { C } from './palette.js';

// One unit of a fine figure is a quarter block; the coarse figures and the things keep a grid of
// half blocks (the field `grid` of a figure, in blocks).
export const FIGURE_UNIT = 0.25;
const HULL = 0.046; // the ink outline around each part, in blocks (the same for both levels)
const MAX_PARTS = 4096;
const MAX_FIGURES = 512;
const MAX_PUFFS = 64;
const WADE = 0.4; // blocks: how deep the feet go in the surf (the sea is 0.5 over the sand)
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

// One figure as meshes in its rest pose, for a portrait (src/render/portrait.js): the parts with the
// same flat tones as in the world, and their ink outline. look: a look of
// data/figures.json; facing: the turn of the figure (radians). Return { group, head (the point of
// the head in the world, or null), height, dispose }.
export function figureMeshes(look, { detail = 'fine', facing = 0 } = {}) {
  const figure = figureOf(look, detail);
  const grid = figure.grid ?? 0.5;
  const unit = figure.scale * grid;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.scale.setScalar(unit);
  const nodes = { body };
  const list = [];
  for (const p of figure.parts) {
    const node = new THREE.Group();
    node.position.set(p.at[0], p.at[1], p.at[2]);
    (nodes[p.parent] ?? body).add(node);
    nodes[p.name] = node;
    if (p.color) list.push({ node, p, rgb: toneRgb(colorIndex(p.color), 1) });
  }
  root.rotation.y = facing;
  root.updateMatrixWorld(true);
  const box = unitBox();
  const n = list.length;
  const plain = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, n)), 1);
  box.setAttribute('plain', plain);
  const parts = new THREE.InstancedMesh(box, partsMaterial(), Math.max(1, n));
  parts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 3), 3);
  const hulls = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(C.ink), side: THREE.BackSide }), Math.max(1, n));
  const hull = HULL / unit;
  const m4 = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const tmp = new THREE.Matrix4();
  const color = new THREE.Color();
  let i = 0;
  for (const { node, p, rgb } of list) {
    const [w, h, d] = p.size;
    m4.multiplyMatrices(node.matrixWorld, local.makeTranslation(0, p.pivotTop ? -h / 2 : p.pivotBottom ? h / 2 : 0, 0));
    parts.setMatrixAt(i, tmp.multiplyMatrices(m4, local.makeScale(w, h, d)));
    // A mark and a part with noInk (a nose) have no ink outline.
    hulls.setMatrixAt(i, p.mark || p.noInk ? tmp.makeScale(0, 0, 0) : tmp.multiplyMatrices(m4, local.makeScale(w + hull, h + hull, d + hull)));
    parts.setColorAt(i, color.setRGB(rgb[0], rgb[1], rgb[2]));
    plain.array[i] = p.mark ? 1 : 0;
    i += 1;
  }
  parts.count = i;
  hulls.count = i;
  const group = new THREE.Group();
  for (const m of [parts, hulls]) {
    m.frustumCulled = false;
    if (m.count) group.add(m);
  }
  const head = nodes.head ? new THREE.Vector3().setFromMatrixPosition(nodes.head.matrixWorld) : null;
  return {
    group,
    head,
    height: figure.height * unit,
    crown: (figure.crown ?? figure.height) * unit,
    dispose() {
      for (const m of [parts, hulls]) m.material.dispose();
      box.dispose();
    },
  };
}

// The layer of all figures. lookOf(key): the look of a key (see data/figures.json).
// The pose that the act of an entity asks for (a raid: an enemy on a trap sits, a stunned general
// kneels, the general lifts his staff; Nghé lowers her horns in a charge; the fisher holds up a
// fish).
const WANTS = { point: 'point', catch: 'lift', sit: 'rest', sleep: 'rest', rest: 'rest', stunned: 'rest', happy: 'happy', shake: 'shake', stretch: 'stretch', sword: 'lift', horns: 'horns', charge: 'horns', pole: 'pole' };

// camera: the camera of the view (for the culling); without it, every figure draws. detail: one
// level for all figures ('fine' or 'coarse', for the page of the figures); without it, the level
// follows the distance from the hero, and the line of that distance follows zoom() (the zoom level
// of the camera).
// The stages of the mist for a figure, as for the land (src/render/voxel.js): the colors get pale
// (all paper at 0.45), then only the ink outline stays, then nothing (mist: 0 to 1).
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const PAPER_RGB = [1, 3, 5].map((i) => parseInt(C.paper.slice(i, i + 2), 16) / 255);

export function createFigureLayer(scene, lookOf, { camera = null, detail = null, zoom = () => 0, mistAt = () => 0 } = {}) {
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
  // Drops of a splash: small white boxes that fly up and fall back into the water.
  const spray = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(C.diep) }), MAX_PUFFS);
  spray.frustumCulled = false;
  spray.count = 0;
  scene.add(spray);
  const drops = [];

  const figures = new Map(); // entity id -> figure
  const m4 = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const tmp = new THREE.Matrix4();
  const color = new THREE.Color();

  // A figure at one level of detail: a tree of plain three.js groups (no meshes) that gives the
  // matrix of each part.
  function build(look, detail) {
    const figure = figureOf(look, detail);
    const grid = figure.grid ?? 0.5;
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    body.scale.setScalar(figure.scale * grid);
    const nodes = { body };
    const list = [];
    for (const p of figure.parts) {
      const node = new THREE.Group();
      node.position.set(p.at[0], p.at[1], p.at[2]);
      (nodes[p.parent] ?? body).add(node);
      nodes[p.name] = node;
      if (!p.color) continue;
      list.push({ node, size: p.size, pivotTop: p.pivotTop, pivotBottom: p.pivotBottom, mark: p.mark, noInk: p.noInk, rgb: toneRgb(colorIndex(p.color), 1) });
    }
    // The parts that hang: the node, its kind, and its side (an ear on the left turns the other way).
    const hangs = figure.parts.filter((p) => p.hang && nodes[p.name]).map((p) => ({ name: p.name, node: nodes[p.name], kind: p.hang, up: p.pivotBottom, side: p.at[0] < 0 ? -1 : 1 }));
    const unit = figure.scale * grid;
    return { figure, root, body, nodes, parts: list, hangs, unit, hull: HULL / unit, height: figure.height * unit };
  }
  const frustum = new THREE.Frustum();
  const view = new THREE.Matrix4();
  let planes = null;

  let wind = null; // the wind of the world: { x, z, strength }
  const lerpAngle = (a, b, t) => {
    const d = ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    return a + d * t;
  };

  return {
    // After each step of the world: note the new place of each entity, and add or remove figures.
    sync(world) {
      const seen = new Set();
      wind = world.wind ?? null;
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
          f = { look: key, lookData: lookOf(e.look, e.carry), levels: {}, detail: null };
          const coarse = figureOf(f.lookData, 'coarse');
          f.anim = createAnimator(coarse.kind);
          // The lift and the sink of a pose are in the units of the coarse figure.
          f.poseUnit = coarse.scale * (coarse.grid ?? 0.5);
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
        // The velocity in blocks a second, for the parts that hang.
        f.vel = { x: (e.motion?.vx ?? 0) / 2, z: (e.motion?.vz ?? 0) / 2 };
        f.control = Boolean(e.control);
        f.running = (e.motion?.speed ?? 0) > 11;
        // A rider sits on the back of Nghé; a swimmer at the ford is a little lower in the water;
        // in the surf the feet sink into the sand, so that the water comes to the knee.
        f.offset = (e.riding ? RIDER : 0) - (e.motion?.wade ? WADE : e.motion?.shallow && !e.control ? 0.3 : 0);
        // The pose that the state asks for: riding, rest, joy, a wave, and the bend of grass.
        // A mentor that points (the gesture of a move) comes before the act of the plan.
        f.want = e.riding ? 'ride' : WANTS[e.gesture?.act ?? e.act] ?? (e.react?.waving > 0 ? 'wave' : null);
        f.bend = e.react?.bend ?? null;
        // A tap on a sleeping animal: its ear flicks (in two held positions, as a print).
        f.flick = e.flick ?? 0;
        // A plank that tips or wobbles turns about its near end.
        f.tilt = e.tilt ?? 0;
      }
      for (const id of [...figures.keys()]) if (!seen.has(id)) figures.delete(id);
    },
    // Each frame: t (0 to 1) is the time between the last two steps.
    draw(t, dt) {
      let n = 0;
      let s = 0;
      // The planes of the view, for the culling (plain numbers for src/world/lod.js).
      if (camera) {
        camera.updateMatrixWorld();
        frustum.setFromProjectionMatrix(view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        planes = frustum.planes.map((p) => ({ nx: p.normal.x, ny: p.normal.y, nz: p.normal.z, d: p.constant }));
      }
      const hero = [...figures.values()].find((f) => f.control)?.curr ?? null;
      const lod = lodFor(zoom());
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
        // A figure deep in the mist is paper: it draws nothing. The hero always draws.
        const mist = f.control ? 0 : mistAt(f.at.x, f.at.z);
        if (mist >= 0.78) continue;
        const pale = smooth(0, 0.45, mist);
        const tint = (rgb) => color.setRGB(rgb[0] + (PAPER_RGB[0] - rgb[0]) * pale, rgb[1] + (PAPER_RGB[1] - rgb[1]) * pale, rgb[2] + (PAPER_RGB[2] - rgb[2]) * pale);
        // The animation goes on for every figure, so that a figure that comes into the view is in
        // step.
        const pose = animate(f.anim, { speed: f.speed, dt, want: f.want });
        // The level of detail: fine near the hero, coarse far away (src/world/lod.js).
        const dist = hero ? Math.hypot(b.x - hero.x, b.z - hero.z) / 2 : 0;
        f.detail = detail ?? detailFor(f.detail, dist, lod);
        const L = (f.levels[f.detail] ??= build(f.lookData, f.detail));
        f.height = L.height;
        // A figure out of the view draws nothing (and casts no shadow).
        if (planes && !inView(planes, { x: f.at.x, y: f.at.y + L.height / 2, z: f.at.z }, Math.max(1, L.height))) continue;
        L.root.position.set(f.at.x, f.at.y, f.at.z);
        L.root.rotation.y = lerpAngle(a.facing, b.facing, t);
        for (const [name, r] of Object.entries(pose.rot)) L.nodes[name]?.rotation.set(r[0], r[1], r[2]);
        if (L.hangs.length) {
          // The parts that hang follow the air that the figure feels, with a lag, on top of the pose.
          const facing = L.root.rotation.y;
          const sway = swayStep((f.sway ??= createSway()), { vel: f.vel, facing, wind, phase: f.anim.phase, stride: Math.min(1, f.speed / 4.5), dt });
          for (const h of L.hangs) {
            const [rx, , rz] = sway[h.kind];
            const r = pose.rot[h.name] ?? [0, 0, 0];
            // A part that stands up turns the other way, so that its free end goes with the air too.
            // An ear goes back about the up axis.
            if (h.kind === 'ear') h.node.rotation.set(r[0] + (Math.floor(f.flick * 8) % 2 ? -0.9 : 0), r[1] + h.side * rx, r[2]);
            else if (h.up) h.node.rotation.set(r[0] - rx, r[1], r[2] - rz);
            else h.node.rotation.set(r[0] + rx, r[1], r[2] + rz);
          }
        }
        L.body.position.y = (pose.lift - pose.sink) * f.poseUnit;
        L.body.rotation.x = pose.lean + f.tilt;
        L.body.rotation.z = 0;
        if (f.bend) {
          // Tall grass bends away from the hero (the direction is in the world; the figure turns).
          const a = f.bend.dir - L.root.rotation.y;
          L.body.rotation.x = Math.cos(a) * f.bend.amount * 0.9;
          L.body.rotation.z = -Math.sin(a) * f.bend.amount * 0.9;
        }
        L.root.updateMatrixWorld(true);
        const hull = L.hull;
        for (const p of L.parts) {
          if (n >= MAX_PARTS) break;
          const [w, h, d] = p.size;
          m4.multiplyMatrices(p.node.matrixWorld, local.makeTranslation(0, p.pivotTop ? -h / 2 : p.pivotBottom ? h / 2 : 0, 0));
          parts.setMatrixAt(n, tmp.multiplyMatrices(m4, local.makeScale(w, h, d)));
          hulls.setMatrixAt(n, p.mark || p.noInk ? tmp.makeScale(0, 0, 0) : tmp.multiplyMatrices(m4, local.makeScale(w + hull, h + hull, d + hull)));
          parts.setColorAt(n, tint(p.rgb));
          plain.array[n] = p.mark ? 1 : 0;
          n += 1;
        }
        if (L.figure.shadow && s < MAX_FIGURES && mist < 0.45) {
          const r = Math.max(0.8, L.figure.shadow * L.unit * 1.6);
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
      let r = 0;
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.age += dt;
        d.vy -= 9.8 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.z += d.vz * dt;
        if (d.age > 0.9 || d.y < d.floor || r >= MAX_PUFFS) {
          drops.splice(i, 1);
          continue;
        }
        const k = d.size * (1 - d.age * 0.6);
        spray.setMatrixAt(r++, tmp.makeScale(k, k, k).setPosition(d.x, d.y, d.z));
      }
      spray.count = r;
      spray.instanceMatrix.needsUpdate = true;
      parts.count = n;
      hulls.count = n;
      shadows.count = s;
      for (const m of [parts, hulls, shadows]) m.instanceMatrix.needsUpdate = true;
      parts.instanceColor.needsUpdate = true;
      plain.needsUpdate = true;
    },
    // A burst at a point (world units): 'splash' (drops of water) or 'dust' (a puff of dust, for
    // example when the bridge takes solid form). n: how many.
    burst(x, y, z, kind = 'splash', n = 14) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        if (kind === 'splash') {
          const v = 0.8 + Math.random() * 1.2;
          drops.push({ x, y, z, vx: Math.cos(a) * v, vy: 2.5 + Math.random() * 2, vz: Math.sin(a) * v, age: 0, floor: y - 0.2, size: 0.12 + Math.random() * 0.1 });
        } else {
          puffs.push({ x: x + Math.cos(a) * 0.6, y, z: z + Math.sin(a) * 0.6, age: Math.random() * 0.2 });
        }
      }
    },
    // The place of an entity as it is drawn now (world units), and its height.
    placeOf(id) {
      const f = figures.get(id);
      return f?.at ? { ...f.at, height: f.height } : null;
    },
    dispose() {
      for (const m of [parts, hulls, shadows, dust, spray]) {
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
