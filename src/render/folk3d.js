// The folk games in three.js (#30; docs/FOLKGAMES.md): the lines of the court of nhảy lò cò, drawn
// with a stick in the packed earth (no numeral on the court, but the number of the first square of a
// court that does not start at one, in chalk, #139), and the rope of nhảy dây, which turns
// between the hands of two children and touches the ground at each beat. All are thin boxes in one
// instanced mesh (one draw call). Renderer only: no state.
import * as THREE from 'three';
import { C } from './palette.js';

const MAX = 160;
const LINE = 0.1; // world units: the width of a line of the court
const HANDS = 0.75; // world units: the height of the hands that hold the rope
const SWING = 0.85; // world units: how far the middle of the rope goes from the line of the hands
const CHALK = 0.07; // world units: the width of a line of a chalk numeral
// The parts of a numeral of seven parts (a top, b top right, c bottom right, d bottom, e bottom left,
// f top left, g middle), for each digit.
const DIGIT = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abfgcd'];

export function createFolkLayer(scene) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  mesh.frustumCulled = false;
  mesh.count = 0;
  scene.add(mesh);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();
  let n = 0;
  const put = (x, y, z, sx, sy, sz, c, turn) => {
    if (n >= MAX) return;
    q.setFromAxisAngle(up, turn);
    mesh.setMatrixAt(n, m4.compose(pos.set(x, y, z), q, scl.set(sx, sy, sz)));
    mesh.setColorAt(n, color.set(C[c]));
    n += 1;
  };
  // A line on the ground from a to b (world units).
  const line = (a, b, y, c = 'ink', w = LINE) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    put((a.x + b.x) / 2, y + 0.012, (a.z + b.z) / 2, w, 0.02, len + w, c, Math.atan2(b.x - a.x, b.z - a.z));
  };
  // A number in chalk on the ground, in the middle c, read up the court (d up, s to the right).
  const numeral = (value, c, d, s, y, size) => {
    const digits = String(value);
    const w = size * 0.42;
    const gap = size * 0.2;
    const u0 = -(digits.length * w + (digits.length - 1) * gap) / 2;
    const at = (u, v) => ({ x: c.x + s.x * u + d.x * v, z: c.z + s.z * u + d.z * v });
    [...digits].forEach((ch, i) => {
      const l = u0 + i * (w + gap);
      const r = l + w;
      const top = size / 2;
      const ends = { a: [[l, top], [r, top]], b: [[r, top], [r, 0]], c: [[r, 0], [r, -top]], d: [[l, -top], [r, -top]], e: [[l, 0], [l, -top]], f: [[l, top], [l, 0]], g: [[l, 0], [r, 0]] };
      for (const part of DIGIT[Number(ch)] ?? '') line(at(...ends[part][0]), at(...ends[part][1]), y + 0.004, 'ink', CHALK);
    });
  };

  return {
    // One frame. court: { squares: [{ x, y, z, side, row }], rest, dir, size, first } (half blocks, as
    // the entity folk:court); rope: { a, b, turn, still } (half blocks), and the ground y of the rope;
    // az: the angle of the view, so that the number of the first square reads from the camera.
    draw({ court = null, rope = null, ropeY = 0, az = null }) {
      n = 0;
      if (court) {
        const d = court.dir;
        const s = { x: -d.z, z: d.x };
        const h = court.size / 4; // half a square, in world units
        court.squares.forEach((q, i) => {
          const c = { x: q.x / 2, z: q.z / 2 };
          const y = q.y / 2;
          const corner = (a, b) => ({ x: c.x + d.x * a * h + s.x * b * h, z: c.z + d.z * a * h + s.z * b * h });
          // The first square of a court that does not start at one is red, with its number (#139).
          const first = i === 0 && court.first != null;
          const ink = first ? 'vermilion' : 'ink';
          line(corner(-1, -1), corner(1, -1), y, ink);
          line(corner(1, -1), corner(1, 1), y, ink);
          line(corner(1, 1), corner(-1, 1), y, ink);
          line(corner(-1, 1), corner(-1, -1), y, ink);
          // Up on the screen is away from the camera, and the right of the screen is (cos az, -sin az)
          // (src/world/view.js).
          if (first) numeral(court.first, c, az == null ? d : { x: -Math.sin(az), z: -Math.cos(az) }, az == null ? s : { x: Math.cos(az), z: -Math.sin(az) }, y, h);
        });
        // The half circle to rest, at the top of the court.
        const top = court.squares.reduce((a, b) => (b.row > a.row ? b : a), court.squares[0]);
        // Its middle: the end of the top row, between the two sides.
        const base = { x: top.x / 2 + d.x * h - s.x * (top.side ? h : -h), z: top.z / 2 + d.z * h - s.z * (top.side ? h : -h) };
        const r = 2 * h;
        let prev = null;
        for (let k = 0; k <= 8; k++) {
          const a = -Math.PI / 2 + (k / 8) * Math.PI;
          const p = { x: base.x + d.x * Math.cos(a) * r + s.x * Math.sin(a) * r, z: base.z + d.z * Math.cos(a) * r + s.z * Math.sin(a) * r };
          if (prev) line(prev, p, top.y / 2);
          prev = p;
        }
      }
      if (rope) {
        const a = { x: rope.a.x / 2, z: rope.a.z / 2 };
        const b = { x: rope.b.x / 2, z: rope.b.z / 2 };
        const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        const side = { x: -(b.z - a.z) / len, z: (b.x - a.x) / len };
        // At a whole turn the rope is at the bottom (on the ground); between two turns it goes over.
        const ang = rope.still ? Math.PI : Math.PI + rope.turn * Math.PI * 2;
        const y0 = ropeY / 2 + HANDS;
        const parts = 14;
        for (let i = 0; i <= parts; i++) {
          const k = i / parts;
          const bow = 4 * k * (1 - k);
          const lift = Math.cos(ang) * (HANDS + 0.02) * bow;
          const swing = Math.sin(ang) * SWING * bow;
          put(a.x + (b.x - a.x) * k + side.x * swing, y0 + lift, a.z + (b.z - a.z) * k + side.z * swing, 0.07, 0.07, len / parts + 0.04, 'vermilion', Math.atan2(b.x - a.x, b.z - a.z));
        }
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
