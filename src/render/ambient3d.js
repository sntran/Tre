// The world at rest, in three.js: smoke from the kitchens at the meals, steam from the rice pot,
// a thin thread of incense at the đình, butterflies over the flowers by day, a dragonfly over the
// paddies, and a fish that jumps at the ford now and then. Renderer only: no state, and no reward.
// All of them are small boxes in one instanced mesh (one draw call), and they move in steps, as a
// print (docs/ART.md, "The world breathes").
import * as THREE from 'three';
import { C } from './palette.js';

const MAX = 160;
const STEP = 0.25; // seconds: the motes move in steps of this time

// A number from 0 to 1 for an integer (the same each time).
const hash = (n) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

// scene: the scene of the world. emit: { kitchens, pots, incense: [{ x, y, z }], flowers, paddies,
// fords } in world units (paddies and fords: the cells of src/world/terrain.js).
export function createAmbient(scene, emit) {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  mesh.frustumCulled = false;
  mesh.count = 0;
  scene.add(mesh);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const color = new THREE.Color();
  let n = 0;
  const put = (x, y, z, sx, sy, sz, c, turn = 0) => {
    if (n >= MAX) return;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn);
    mesh.setMatrixAt(n, m4.compose(pos.set(x, y, z), q, scl.set(sx, sy, sz)));
    mesh.setColorAt(n, color.set(C[c]));
    n += 1;
  };

  return {
    // One frame. now: { t (seconds), night, wind: { x, z }, meal (a meal time) }.
    draw({ t, night = 0, wind = null, meal = false }) {
      n = 0;
      const wx = wind?.x ?? 0.8;
      const wz = wind?.z ?? 0.6;
      // The puffs of a column are a function of the time only (the same at any frame rate): each one
      // rises, drifts with the wind, grows, and goes, in steps. The kitchens and the rice pot smoke at
      // the meals, the incense all the time.
      const column = (list, every, life, rise, base, colorOf) => {
        list.forEach((at, j) => {
          for (let i = 0; i * every < life; i++) {
            const age = (t + i * every + j * 0.37) % life;
            const a = Math.floor(age / STEP) * STEP;
            const k = a / life;
            const size = base * (0.6 + k * 1.2) * (k > 0.8 ? (1 - k) * 5 : 1);
            put(at.x + wx * a * 0.35, at.y + a * rise, at.z + wz * a * 0.35, size, size, size, colorOf(k));
          }
        });
      };
      if (meal) {
        column(emit.kitchens ?? [], 0.6, 3.2, 0.8, 0.45, (k) => (k < 0.4 ? 'ash' : 'ashLight'));
        column(emit.pots ?? [], 0.5, 1.8, 0.8, 0.25, () => 'diep');
      }
      column(emit.incense ?? [], 1.4, 4, 0.5, 0.12, () => 'paperDeep');
      const T = Math.floor(t / STEP) * STEP;
      if (night < 0.3) {
        // Butterflies over the flowers: each one loops over its flower, and its wings beat.
        const flowers = emit.flowers ?? [];
        for (let i = 0; i < Math.min(8, flowers.length); i++) {
          const f = flowers[Math.floor(hash(i + 1) * flowers.length)];
          const a = T * 0.8 + i * 1.7;
          const open = Math.abs(Math.sin(T * 9 + i)) > 0.5 ? 0.32 : 0.12;
          put(f.x + Math.cos(a) * 0.7, f.y + 0.5 + Math.sin(a * 1.7) * 0.15, f.z + Math.sin(a) * 0.7, open, 0.05, 0.2, i % 2 ? 'yellowPale' : 'diep', a);
        }
        // A dragonfly over the paddies: a quick dart to another paddy, then it hangs still.
        const paddies = emit.paddies ?? [];
        if (paddies.length) {
          const leg = Math.floor(t / 1.6);
          const from = paddies[Math.floor(hash(leg) * paddies.length)];
          const to = paddies[Math.floor(hash(leg + 1) * paddies.length)];
          const k = Math.min(1, (t / 1.6 - leg) / 0.2);
          const x = from.x + (to.x - from.x) * k + 0.5;
          const z = from.z + (to.z - from.z) * k + 0.5;
          put(x, from.y + 0.9, z, 0.5, 0.06, 0.08, 'indigo', Math.atan2(to.x - from.x, to.z - from.z) + Math.PI / 2);
          put(x, from.y + 0.93, z, 0.12, 0.03, 0.5, 'indigoPale', Math.atan2(to.x - from.x, to.z - from.z) + Math.PI / 2);
        }
      }
      // A fish jumps at the ford now and then: a short arc out of the water and back.
      const fords = emit.fords ?? [];
      if (fords.length) {
        const jump = Math.floor(t / 7);
        const k = (t - jump * 7) / 0.7;
        if (k < 1 && hash(jump + 99) < 0.7) {
          const f = fords[Math.floor(hash(jump) * fords.length)];
          put(f.x + 0.3 + k * 0.5, f.y + Math.sin(Math.PI * k) * 0.6, f.z + 0.5, 0.35, 0.14, 0.1, 'ashLight', 0.4);
        }
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    // The motes that the last frame drew (for the tests on a device).
    get count() { return n; },
    dispose() {
      scene.remove(mesh);
      mesh.material.dispose();
      mesh.dispose();
      box.dispose();
    },
  };
}
