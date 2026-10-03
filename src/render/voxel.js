// The voxel world in three.js: for each chunk (src/world/chunks.js), one mesh of the ground and the
// things (half blocks, the smooth roofs, and the other smooth looks), and an ink mesh (the edges,
// and the silhouettes of the smooth looks); water with the wave pattern of the prints, paddies with
// rows of seedlings, the fade of things in front of the hero, and an orthographic camera that turns
// in steps of 90°. The chunks come and go with the hero: a ring of 9 x 9 chunks is drawn, the far
// ones with the coarse level, and a few chunks are built in each frame, the nearest first, so that
// no frame waits for them. The far land fades into the color of the paper, and so does the land of
// a later era (the mist): the camera never shows an end of the world. A change of the terrain (a
// dig, a felled tree) builds only its chunks again. The logic is in src/world/; this file only draws.
import * as THREE from 'three';
import { chunkMesh, CHUNK, chunkKey } from '../world/chunks.js';
import { pickGround } from '../world/terrain.js';
import { C } from './palette.js';
import { night } from './figure3d.js';
import { rendererFor } from './gl.js';
import { inFront, stepFade, stippleOf } from '../world/fade.js';

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

export const VIEW = Object.freeze({ elevation: Math.atan(0.5), zooms: [26, 40], lag: 4 });

// The sway of a vertex of a smooth look in the wind (renderer only: no state). sway: [weight,
// layer]; the layer reads its gust (paddy, hedge, tree: src/core/world/ambient.js). The leaves hold
// three positions with a soft ease between them, as a print, each with its own phase from its place;
// a gust pushes them downwind. A kite (layer 3) flies only on a windy day.
// The fade of an owner (a number up to 65535) from a texture of 256 x 256 values.
const FADE_GLSL = `
  uniform sampler2D uFade;
  float fadeOf(float owner) {
    if (owner < 0.5) return 0.0;
    return texture2D(uFade, vec2((mod(owner, 256.0) + 0.5) / 256.0, (floor(owner / 256.0) + 0.5) / 256.0)).r;
  }`;
// The paper over the far land and the mist: 0 near the hero, 1 far away (uFar: where the fade
// starts and ends, world units) or deep in the mist (mist: 0 to 1 for each vertex).
const PAPER_GLSL = `
  uniform vec3 uFocus; uniform vec2 uFar;
  float paperOf(vec3 world, float mist) {
    float far = smoothstep(uFar.x, uFar.y, length(world.xz - uFocus.xz));
    return max(far, mist);
  }`;

const SWAY_GLSL = `
  uniform float uTime; uniform vec3 uGust; uniform vec2 uWind; uniform float uWindy;
  vec3 swayOf(vec3 p, vec2 s) {
    if (s.x <= 0.0) return vec3(0.0);
    float g = s.y < 0.5 ? uGust.x : (s.y < 1.5 ? uGust.y : uGust.z);
    float v = sin(uTime * 0.9 + p.x * 0.41 + p.z * 0.27) + 1.0;
    float held = floor(v) + smoothstep(0.75, 1.0, fract(v));
    float k = (held - 1.0) * (0.1 + 0.12 * g) + 0.45 * g;
    vec3 d = vec3(uWind.x, 0.0, uWind.y) * s.x * k;
    if (s.y > 2.5) d = d * 3.0 + vec3(0.0, sin(uTime * 0.7 + p.x) * 0.3, 0.0) * s.x - vec3(0.0, 40.0, 0.0) * (1.0 - uWindy);
    return d;
  }`;

// The material of the blocks, the roofs, and the smooth looks: flat colors, and the fade of an
// owner. The fade is a stipple (an ordered dither, as the dots of a print), so that the world is
// opaque and the ground and the things of a chunk are one mesh.
function flatMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    side: THREE.DoubleSide,
    vertexShader: `
      attribute vec3 tone; attribute float owner; attribute vec2 sway; attribute float mist;
      varying vec3 vColor; varying float vFade; varying float vPaper;
      ${FADE_GLSL}
      ${PAPER_GLSL}
      ${SWAY_GLSL}
      void main() {
        vColor = tone;
        vFade = fadeOf(owner);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vPaper = paperOf(w.xyz, mist);
        gl_Position = projectionMatrix * viewMatrix * (w + vec4(swayOf(w.xyz, sway), 0.0));
      }`,
    fragmentShader: `
      uniform vec3 uPaper;
      varying vec3 vColor; varying float vFade; varying float vPaper;
      // A 4 x 4 ordered dither: 0 to 1 in a fixed pattern over the screen.
      float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
      float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
      void main() {
        if (vFade > 0.001 && vFade * 0.85 > bayer4(gl_FragCoord.xy)) discard;
        gl_FragColor = vec4(mix(vColor, uPaper, vPaper), 1.0);
      }`,
  });
}

// The mask of the faded objects: their faces again, with no color and no depth, into the stencil
// (1 where a faded object is in front). The hulls of the smooth looks are not drawn there, so that
// the holes of a faded crown show what is behind it, and its outline stays whole around it.
function maskMaterial(uniforms) {
  const m = flatMaterial(uniforms);
  m.colorWrite = false;
  m.depthWrite = false;
  m.stencilWrite = true;
  m.stencilRef = 1;
  m.stencilFunc = THREE.AlwaysStencilFunc;
  m.stencilZPass = THREE.ReplaceStencilOp;
  m.fragmentShader = `
    varying vec3 vColor; varying float vFade; varying float vPaper;
    void main() {
      if (vFade <= 0.001) discard;
      gl_FragColor = vec4(vColor, 1.0);
    }`;
  return m;
}

function geometryOf(m, offset) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(m.positions.length);
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] = m.positions[i] + offset[0];
    pos[i + 1] = m.positions[i + 1] + offset[1];
    pos[i + 2] = m.positions[i + 2] + offset[2];
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('tone', new THREE.BufferAttribute(new Float32Array(m.colors), 3));
  g.setAttribute('owner', new THREE.BufferAttribute(new Float32Array(m.owners), 1));
  g.setAttribute('sway', new THREE.BufferAttribute(new Float32Array(m.sway ?? (m.positions.length / 3) * 2), 2));
  g.setAttribute('mist', new THREE.BufferAttribute(new Float32Array(m.mist ?? m.positions.length / 3), 1));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(m.indices), 1));
  g.computeBoundingSphere();
  return g;
}

// The ink lines as quads that turn to the camera in the vertex shader. A group: { segs (flat list
// of [ax, ay, az, bx, by, bz] in world units), w (the width of the lines), owners, outer (one value
// for each line; see meshGrid), hull (the silhouette of a smooth look: triangles drawn in ink from
// the back only) }.
function inkGeometry(groups, mistAt = () => 0) {
  let count = 0;
  let hullVerts = 0;
  let hullIdx = 0;
  for (const { segs, hull } of groups) {
    count += segs.length / 6;
    if (hull) {
      hullVerts += hull.positions.length / 3;
      hullIdx += hull.indices.length;
    }
  }
  const verts = count * 4 + hullVerts;
  const pos = new Float32Array(verts * 3);
  const other = new Float32Array(verts * 3);
  const side = new Float32Array(verts);
  const width = new Float32Array(verts);
  const owner = new Float32Array(verts);
  const outer = new Float32Array(verts);
  const isHull = new Float32Array(verts);
  const sway = new Float32Array(verts * 2);
  const swayO = new Float32Array(verts * 2);
  const mist = new Float32Array(verts);
  const idx = new Uint32Array(count * 6 + hullIdx);
  let n = 0;
  for (const g of groups) {
    const { segs, w } = g;
    for (let i = 0; i < segs.length; i += 6) {
      const a = [segs[i], segs[i + 1], segs[i + 2]];
      const b = [segs[i + 3], segs[i + 4], segs[i + 5]];
      const verts = [[a, b, 1], [a, b, -1], [b, a, 1], [b, a, -1]];
      const who = g.owners?.[i / 6] ?? 0;
      const out = g.outer?.[i / 6] ?? 1;
      const sa = g.sway ? [g.sway[(i / 6) * 4], g.sway[(i / 6) * 4 + 1]] : [0, 0];
      const sb = g.sway ? [g.sway[(i / 6) * 4 + 2], g.sway[(i / 6) * 4 + 3]] : [0, 0];
      verts.forEach(([p, o, sd], k) => {
        sway.set(k < 2 ? sa : sb, (n * 4 + k) * 2);
        swayO.set(k < 2 ? sb : sa, (n * 4 + k) * 2);
        pos.set(p, (n * 4 + k) * 3);
        other.set(o, (n * 4 + k) * 3);
        side[n * 4 + k] = sd;
        width[n * 4 + k] = w;
        owner[n * 4 + k] = who;
        outer[n * 4 + k] = out;
        mist[n * 4 + k] = mistAt(p[0], p[2]);
      });
      idx.set([n * 4, n * 4 + 1, n * 4 + 2, n * 4, n * 4 + 2, n * 4 + 3], n * 6);
      n += 1;
    }
  }
  // The hulls after the lines: no width, and `other` only to the side, so that the shader keeps them.
  let v = n * 4;
  let k = n * 6;
  for (const g of groups) {
    if (!g.hull) continue;
    const who = g.owners?.[0] ?? 0;
    const base = v;
    for (let i = 0; i < g.hull.positions.length; i += 3) {
      pos.set([g.hull.positions[i], g.hull.positions[i + 1], g.hull.positions[i + 2]], v * 3);
      other.set([g.hull.positions[i] + 1, g.hull.positions[i + 1], g.hull.positions[i + 2]], v * 3);
      owner[v] = g.who ?? who;
      outer[v] = 1;
      isHull[v] = 1;
      mist[v] = mistAt(g.hull.positions[i], g.hull.positions[i + 2]);
      if (g.hull.sway) {
        sway.set([g.hull.sway[(i / 3) * 2], g.hull.sway[(i / 3) * 2 + 1]], v * 2);
        swayO.set([g.hull.sway[(i / 3) * 2], g.hull.sway[(i / 3) * 2 + 1]], v * 2);
      }
      v += 1;
    }
    for (const i of g.hull.indices) idx[k++] = base + i;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('other', new THREE.BufferAttribute(other, 3));
  g.setAttribute('side', new THREE.BufferAttribute(side, 1));
  g.setAttribute('width', new THREE.BufferAttribute(width, 1));
  g.setAttribute('owner', new THREE.BufferAttribute(owner, 1));
  g.setAttribute('outer', new THREE.BufferAttribute(outer, 1));
  g.setAttribute('hull', new THREE.BufferAttribute(isHull, 1));
  g.setAttribute('sway', new THREE.BufferAttribute(sway, 2));
  g.setAttribute('swayO', new THREE.BufferAttribute(swayO, 2));
  g.setAttribute('mist', new THREE.BufferAttribute(mist, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

// The ink of a faded object: the lines inside it go with it, and its outline stays fully drawn, so
// that the faded object still reads as a shape. hull: the material of the hulls, which are not
// drawn over the mask of the faded objects (maskMaterial).
function inkMaterial(uniforms, hull = false) {
  return new THREE.ShaderMaterial({
    ...(hull ? { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.KeepStencilOp } : {}),
    uniforms,
    side: THREE.DoubleSide,
    transparent: true,
    vertexShader: `
      attribute float mist;
      attribute vec3 other; attribute float side; attribute float width; attribute float owner; attribute float outer; attribute float hull;
      attribute vec2 sway; attribute vec2 swayO;
      uniform vec3 uView;
      varying float vAlpha; varying float vHull;
      ${FADE_GLSL}
      ${PAPER_GLSL}
      ${SWAY_GLSL}
      void main() {
        vHull = hull;
        vec4 W = modelMatrix * vec4(position, 1.0);
        vec4 WO = modelMatrix * vec4(other, 1.0);
        vec3 P = W.xyz + swayOf(W.xyz, sway);
        vec3 O = WO.xyz + swayOf(WO.xyz, swayO);
        float fade = fadeOf(owner);
        // The ink goes with the paper: none on the far land, none in the mist.
        vAlpha = (outer > 0.5 ? 1.0 : 1.0 - fade) * (1.0 - paperOf(P, mist));
        vec3 d = normalize(O - P);
        vec3 p = normalize(cross(d, uView)) * width * 0.5 * side;
        gl_Position = projectionMatrix * viewMatrix * vec4(P + p - d * width * 0.5, 1.0);
      }`,
    fragmentShader: `
      uniform float uNight; varying float vAlpha; varying float vHull;
      void main() {
        // A hull shows only from the back: its front is behind the look, as a line around it.
        if (vAlpha < 0.02 || (vHull > 0.5 && gl_FrontFacing)) discard;
        gl_FragColor = vec4(mix(vec3(0.122, 0.106, 0.09), vec3(0.2, 0.2, 0.26), uNight * 0.5), vAlpha);
      }`,
  });
}

// The wave pattern of the prints, for the river.
function waveTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = C.indigoPale;
  g.fillRect(0, 0, 128, 128);
  g.lineWidth = 3;
  for (let row = 0; row < 5; row++) {
    for (let col = -1; col < 5; col++) {
      const cx = col * 32 + (row % 2 ? 16 : 0);
      const cy = row * 32;
      g.strokeStyle = C.indigo;
      g.beginPath();
      g.arc(cx, cy, 15, Math.PI, 0);
      g.stroke();
      g.strokeStyle = C.diep;
      g.beginPath();
      g.arc(cx, cy, 8, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

// The rings of chunks around the hero: NEAR chunks on each side with the full level, DRAW with the
// coarse level after them (9 x 9 in all). Each frame builds chunks for at most BUILD_MS.
export const RINGS = Object.freeze({ near: 2, draw: 4, buildMs: 6 });
const FADE_SIZE = 256; // the fade texture: 256 x 256 owners

// Build the scene of a map. terrain: from src/world/terrain.js. opts: { mistAt(x, z) (how deep a cell
// is in the mist, 0 to 1), waterAt(x, z) (the kind of water of a cell: 'river', 'ford', 'sea', or
// null), ready(cx, cz) (the land of a chunk is made: a chunk waits for it, so that no frame makes
// land) }.
export function createVoxelWorld(canvas, terrain, opts = {}) {
  const renderer = rendererFor(canvas);
  const scene = new THREE.Scene();
  const disposables = [];
  const track = (x) => {
    disposables.push(x);
    return x;
  };
  const mistAt = opts.mistAt ?? (() => 0);
  const waterAt = opts.waterAt ?? (() => null);
  const ready = opts.ready ?? (() => true);

  // The fade of each object: one value in a texture, read in the vertex shader.
  const fadeData = new Uint8Array(FADE_SIZE * FADE_SIZE * 4);
  const fadeTex = track(new THREE.DataTexture(fadeData, FADE_SIZE, FADE_SIZE, THREE.RGBAFormat));
  fadeTex.magFilter = THREE.NearestFilter;
  fadeTex.minFilter = THREE.NearestFilter;
  fadeTex.needsUpdate = true;
  const view = new THREE.Vector3();
  const paper = new THREE.Color(C.paper);
  // The time and the wind for the sway of the leaves, and the paper over the far land: one set of
  // uniforms for all chunks.
  const uniforms = {
    uFade: { value: fadeTex }, uNight: night, uView: { value: view },
    uTime: { value: 0 }, uGust: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2(0.8, 0.6) }, uWindy: { value: 0 },
    uFocus: { value: new THREE.Vector3() }, uFar: { value: new THREE.Vector2(CHUNK * 2.6, CHUNK * 4.2) }, uPaper: { value: new THREE.Vector3(paper.r, paper.g, paper.b) },
  };
  const flatMat = track(flatMaterial(uniforms));
  const inkMat = track(inkMaterial(uniforms));
  const hullMat = track(inkMaterial(uniforms, true));
  const maskMat = track(maskMaterial(uniforms));

  // Water: a plane over each chunk with water, with the wave pattern. A mask of the water cells (one
  // texel for each cell, with the cells around the chunk, read with a linear filter) keeps the plane
  // over the water only, also when the river rises in the rain, and its soft edge gives a narrow
  // pale strip where the water meets the bank. The sea is a plane of its own, at the level of the sea.
  const waves = track(waveTexture());
  const pale = new THREE.Color(C.paper);
  const waterMaterial = (maskTex) => new THREE.ShaderMaterial({
    uniforms: { uWaves: { value: waves }, uMask: { value: maskTex }, uPale: { value: new THREE.Vector3(pale.r, pale.g, pale.b) }, uTime: uniforms.uTime, uWavesOffset: waveOffset, uFocus: uniforms.uFocus, uFar: uniforms.uFar, uPaper: uniforms.uPaper },
    vertexShader: `
      varying vec2 vUV; varying vec3 vW;
      void main() {
        vUV = uv;
        vec4 p = modelMatrix * vec4(position, 1.0);
        vW = p.xyz;
        gl_Position = projectionMatrix * viewMatrix * p;
      }`,
    fragmentShader: `
      uniform sampler2D uWaves; uniform sampler2D uMask; uniform vec3 uPale; uniform float uTime; uniform vec2 uWavesOffset;
      ${PAPER_GLSL}
      uniform vec3 uPaper;
      varying vec2 vUV; varying vec3 vW;
      void main() {
        vec4 mk = texture2D(uMask, vUV);
        float m = mk.r;
        if (m < 0.5) discard;
        vec2 xz = mod(vW.xz, 256.0);
        vec3 c = texture2D(uWaves, xz / 4.0 + uWavesOffset).rgb;
        // The ford: rings that go out from the stones, in steps.
        float ring = fract(length(fract(xz) - 0.5) * 2.5 - floor(uTime * 2.0) / 6.0);
        if (mk.g > 0.4 && ring < 0.12) c = mix(c, uPale, 0.7);
        // By a boat: the lines of a wake that move away from it.
        float wake = fract((xz.x + xz.y) * 0.7 - uTime * 0.5);
        if (mk.b > 0.4 && wake < 0.08) c = mix(c, uPale, 0.6 * mk.b);
        // The bank: a narrow strip of the pale tone where the water ends.
        c = m < 0.8 ? mix(uPale, c, 0.45) : c;
        gl_FragColor = vec4(mix(c, uPaper, paperOf(vW, mk.a)), 1.0);
      }`,
  });
  const waveOffset = { value: new THREE.Vector2(0, 0) };
  const rivers = new Set(); // the river planes (they rise in the rain)
  // Paddies: still, pale water, with rows of seedlings.
  const paleIndigo = new THREE.Color(C.indigoPale);
  const paddyMat = track(new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uColor: { value: new THREE.Vector3(paleIndigo.r, paleIndigo.g, paleIndigo.b) }, uFocus: uniforms.uFocus, uFar: uniforms.uFar, uPaper: uniforms.uPaper },
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec3 vP; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uColor; uniform vec3 uPaper; varying vec3 vP;
      ${PAPER_GLSL}
      void main() {
        vec2 xz = mod(vP.xz, 256.0);
        float band = step(0.82, sin(xz.x * 1.3 + xz.y * 0.7 + floor(uTime * 0.8) * 1.7));
        gl_FragColor = vec4(mix(uColor * (1.0 + 0.08 * band), uPaper, paperOf(vP, 0.0)), 0.72);
      }`,
  }));
  const seedGeo = track(new THREE.BoxGeometry(0.16, 0.8, 0.16));
  seedGeo.translate(0, 0.25, 0);
  // The seedlings bend a little in the wind, and a gust crosses the paddies as a wave in them.
  const green = new THREE.Color(C.green);
  const seedMat = track(new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uColor: { value: new THREE.Vector3(green.r, green.g, green.b) } },
    vertexShader: `
      ${SWAY_GLSL}
      ${PAPER_GLSL}
      varying float vPaper;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        float k = clamp((position.y + 0.15) / 0.8, 0.0, 1.0);
        float wave = uGust.x * max(0.0, sin(w.x * 0.35 + w.z * 0.2 - uTime * 2.5));
        vec3 d = swayOf(w.xyz, vec2(0.25 * k, 0.0)) + vec3(uWind.x, -0.15, uWind.y) * k * wave * 0.5;
        vPaper = paperOf(w.xyz, 0.0);
        gl_Position = projectionMatrix * viewMatrix * (w + vec4(d, 0.0));
      }`,
    fragmentShader: `uniform vec3 uColor; uniform vec3 uPaper; varying float vPaper; void main() { gl_FragColor = vec4(mix(uColor, uPaper, vPaper), 1.0); }`,
  }));

  // The meshes of each chunk: a group at the corner of the chunk.
  const thingMeshes = new Set(); // the meshes for the picks of things
  const masks = new Set(); // the masks of the faded objects: drawn only while a thing fades
  const fades = new Map(); // who -> fade
  const chunks = new Map(); // key -> { group, level, meshes, dispose }
  const dirty = new Set();
  let builds = 0;
  let triangles = 0;
  function dropChunk(key) {
    const c = chunks.get(key);
    if (!c) return;
    scene.remove(c.group);
    for (const m of c.meshes) {
      thingMeshes.delete(m);
      masks.delete(m);
      rivers.delete(m);
      if (!m.userData.shared) m.geometry.dispose();
      if (m.userData.material) m.material.dispose();
    }
    for (const t of c.textures) t.dispose();
    triangles -= c.triangles;
    chunks.delete(key);
  }
  function buildChunk(cx, cz, level) {
    const key = chunkKey(cx, cz);
    dropChunk(key);
    const coarse = level === 'coarse';
    const m = chunkMesh(terrain, cx, cz, { coarse });
    const [ox, , oz] = m.origin;
    const group = new THREE.Group();
    group.position.set(ox, 0, oz);
    const made = [];
    const textures = [];
    const mistOf = (x, z) => mistAt(x + ox, z + oz);
    const withMist = (mesh) => {
      const mist = new Array(mesh.positions.length / 3);
      for (let i = 0; i < mist.length; i++) mist[i] = mistOf(mesh.positions[i * 3], mesh.positions[i * 3 + 2]);
      return mist;
    };
    // The ground and the things of the chunk in one mesh.
    const all = { positions: [...m.ground.positions, ...m.things.positions], colors: [...m.ground.colors, ...m.things.colors], owners: [...m.ground.owners, ...m.things.owners], indices: [...m.ground.indices], sway: [...new Array((m.ground.positions.length / 3) * 2).fill(0), ...m.things.sway] };
    const base = m.ground.positions.length / 3;
    for (const i of m.things.indices) all.indices.push(base + i);
    all.mist = withMist(all);
    if (all.indices.length) {
      const world = new THREE.Mesh(geometryOf(all, [0, 0, 0]), flatMat);
      thingMeshes.add(world);
      made.push(world);
      if (!coarse) {
        const mask = new THREE.Mesh(world.geometry, maskMat);
        mask.renderOrder = 1;
        mask.userData.shared = true;
        mask.visible = fades.size > 0;
        masks.add(mask);
        made.push(mask);
      }
    }
    // The lines, and the hulls of the smooth looks apart (they keep out of the mask).
    if (m.ink.some((k) => k.segs.length)) made.push(new THREE.Mesh(inkGeometry(m.ink.map((k) => ({ ...k, hull: null })), mistOf), inkMat));
    const hulls = m.ink.filter((k) => k.hull?.indices.length).map((k) => ({ ...k, segs: [] }));
    if (hulls.length) made.push(new THREE.Mesh(inkGeometry(hulls, mistOf), hullMat));
    // The water of the chunk: the river (and the fords) and the sea, each a plane with a mask.
    const page = terrain.page(key);
    for (const kind of ['river', 'sea']) {
      const cells = page.water.filter((w) => (kind === 'sea') === Boolean(w.sea));
      if (!cells.length) continue;
      const N = CHUNK + 2;
      const mask = new Uint8Array(N * N * 4);
      for (let z = 0; z < N; z++) {
        for (let x = 0; x < N; x++) {
          const w = waterAt(ox + x - 1, oz + z - 1);
          const i = (z * N + x) * 4;
          if (kind === 'sea' ? w === 'sea' : w === 'river' || w === 'ford') mask[i] = 255;
          if (w === 'ford') mask[i + 1] = 255;
          mask[i + 3] = Math.round(mistAt(ox + x - 1, oz + z - 1) * 255);
        }
      }
      for (const o of page.objects.filter((x) => x.kind === 'boat')) {
        const b = terrain.boxOf(o);
        for (let z = Math.floor(b.z0) - 1; z <= Math.ceil(b.z1); z++) {
          for (let x = Math.floor(b.x0) - 1; x <= Math.ceil(b.x1); x++) {
            const lx = x - ox + 1;
            const lz = z - oz + 1;
            if (lx >= 0 && lz >= 0 && lx < N && lz < N) mask[(lz * N + lx) * 4 + 2] = 255;
          }
        }
      }
      const tex = new THREE.DataTexture(mask, N, N, THREE.RGBAFormat);
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      textures.push(tex);
      // The plane covers the chunk; its uv reads the middle of the mask (the cells of the chunk).
      const geo = new THREE.PlaneGeometry(CHUNK, CHUNK).rotateX(-Math.PI / 2).translate(CHUNK / 2, cells[0].y, CHUNK / 2);
      const uv = geo.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (1 + uv.getX(i) * CHUNK) / N, (1 + (1 - uv.getY(i)) * CHUNK) / N);
      const mesh = new THREE.Mesh(geo, waterMaterial(tex));
      mesh.userData.material = true;
      if (kind === 'river') rivers.add(mesh);
      made.push(mesh);
    }
    // The paddies of the chunk, and their seedlings (not on the coarse level).
    if (page.paddies.length) {
      const pos = [];
      const idx = [];
      page.paddies.forEach((p, i) => {
        for (const [dx, dz] of [[0, 0], [1, 0], [1, 1], [0, 1]]) pos.push(p.x + dx - ox, p.y, p.z + dz - oz);
        idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2);
      });
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      pg.setIndex(idx);
      made.push(new THREE.Mesh(pg, paddyMat));
      if (!coarse) {
        const seeds = new THREE.InstancedMesh(seedGeo, seedMat, page.paddies.length * 2);
        seeds.userData.shared = true;
        const m4 = new THREE.Matrix4();
        let k = 0;
        for (const p of page.paddies) {
          // Rows along x: two seedlings in each cell, on the same row.
          for (const dx of [0.25, 0.75]) {
            m4.makeRotationZ(((p.x * 7 + p.z * 13 + dx * 10) % 5) * 0.05 - 0.1);
            m4.setPosition(p.x + dx - ox, p.y, p.z + 0.5 - oz);
            seeds.setMatrixAt(k++, m4);
          }
        }
        made.push(seeds);
      }
    }
    for (const mesh of made) group.add(mesh);
    scene.add(group);
    const tri = m.triangles + page.paddies.length * (coarse ? 2 : 26);
    chunks.set(key, { group, level, meshes: made, textures, triangles: tri });
    triangles += tri;
    builds += 1;
  }

  // The chunks to draw around a point (cells): { key, cx, cz, level, d } in the order to build.
  function wanted(x, z) {
    const hx = Math.floor(x / CHUNK);
    const hz = Math.floor(z / CHUNK);
    const out = [];
    for (let dz = -RINGS.draw; dz <= RINGS.draw; dz++) {
      for (let dx = -RINGS.draw; dx <= RINGS.draw; dx++) {
        const ring = Math.max(Math.abs(dx), Math.abs(dz));
        out.push({ key: chunkKey(hx + dx, hz + dz), cx: hx + dx, cz: hz + dz, level: ring <= RINGS.near ? 'full' : 'coarse', d: dx * dx + dz * dz });
      }
    }
    return out.sort((a, b) => a.d - b.d);
  }
  let ringAt = null;
  let ring = [];
  // Build what the ring needs: the chunks that changed first, then the missing ones, the nearest
  // first, for at most ms milliseconds (all of them when ms is Infinity).
  function update(x, z, ms = RINGS.buildMs, only = null) {
    const key = chunkKey(Math.floor(x / CHUNK), Math.floor(z / CHUNK));
    if (key !== ringAt) {
      ringAt = key;
      ring = wanted(x, z);
      const keys = new Set(ring.map((c) => c.key));
      for (const k of [...chunks.keys()]) if (!keys.has(k)) dropChunk(k);
      terrain.hold?.('view', [...keys]);
    }
    const start = performance.now();
    for (const c of ring) {
      const have = chunks.get(c.key);
      if (have && have.level === c.level && !dirty.has(c.key)) continue;
      if ((only && c.level !== only) || (!have && ms !== Infinity && !ready(c.cx, c.cz))) continue;
      // A chunk that is not drawn yet comes first; a change of level can wait for a free frame.
      if (have && !dirty.has(c.key) && performance.now() - start > ms / 2) continue;
      buildChunk(c.cx, c.cz, c.level);
      dirty.delete(c.key);
      if (performance.now() - start > ms) break;
    }
  }

  // Fireflies over the water at night: small pale boxes that blink and drift, over the water near
  // the hero (chosen again when the hero comes into another chunk).
  const FLIES = 80;
  let flyBase = [];
  let flyAt = null;
  const flyMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(C.yellowPale), transparent: true, opacity: 0, depthWrite: false }));
  const flyGeo = track(new THREE.BoxGeometry(0.16, 0.16, 0.16));
  const fireflies = new THREE.InstancedMesh(flyGeo, flyMat, FLIES);
  fireflies.frustumCulled = false;
  scene.add(fireflies);
  const m4f = new THREE.Matrix4();
  function chooseFlies(x, z) {
    const water = terrain.water.filter((w) => !w.sea && Math.abs(w.x - x) < 40 && Math.abs(w.z - z) < 40);
    flyBase = [];
    for (let i = 0; i < Math.min(FLIES, water.length); i++) {
      const w = water[Math.floor((i * 7919) % water.length)];
      flyBase.push({ x: w.x + ((i * 37) % 10) / 10, y: w.y + 0.6 + ((i * 13) % 10) / 8, z: w.z + ((i * 53) % 10) / 10, p: (i * 1.7) % 6.28 });
    }
  }

  // The camera: orthographic, turns in steps of 90°, two zoom levels, a soft follow.
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 500);
  const focus = new THREE.Vector3(0, 3, 0);
  const state = { az: Math.PI / 4, azTarget: Math.PI / 4, level: 0, width: 1, height: 1 };
  const place = () => {
    const e = VIEW.elevation;
    const dir = new THREE.Vector3(Math.cos(e) * Math.sin(state.az), Math.sin(e), Math.cos(e) * Math.cos(state.az));
    cam.position.copy(focus).addScaledVector(dir, 120);
    cam.lookAt(focus);
    view.copy(dir).negate();
    uniforms.uFocus.value.copy(focus);
  };
  const resize = (w, h) => {
    state.width = w;
    state.height = h;
    renderer.setSize(w, h, false);
    // A phone shows a little more of the world than an iPad.
    const size = VIEW.zooms[state.level] * (h < 500 ? 1.15 : 1);
    const a = w / h;
    cam.left = (-size * a) / 2;
    cam.right = (size * a) / 2;
    cam.top = size / 2;
    cam.bottom = -size / 2;
    cam.updateProjectionMatrix();
  };

  // The objects that fade when they are between the camera and the hero: the objects of the pages
  // (the list comes again when the pages change).
  let boxes = [];
  let boxVersion = -1;
  // The fade of each object follows the line of sight from the hero to the camera
  // (src/world/fade.js). The texture keeps the stipple: 0 under FADE_MIN, so that a thing that only
  // touches the line, or that was in front once, keeps no dots.
  function updateFades(hero, dt) {
    if (boxVersion !== terrain.version) {
      boxVersion = terrain.version;
      boxes = terrain.objects.map((o) => ({ who: o.who, b: terrain.boxOf(o) }));
    }
    let changed = false;
    for (const o of boxes) {
      if (Math.abs(o.b.x0 - hero.x) > 40 || Math.abs(o.b.z0 - hero.z) > 40) continue;
      const was = fades.get(o.who) ?? 0;
      const next = stepFade(was, inFront(o.b, hero, state.az, VIEW.elevation), dt);
      if (next === was) continue;
      if (next) fades.set(o.who, next);
      else fades.delete(o.who);
      const value = Math.round(stippleOf(next) * 255);
      if (fadeData[o.who * 4] !== value) {
        fadeData[o.who * 4] = value;
        changed = true;
      }
    }
    if (changed) {
      fadeTex.needsUpdate = true;
      for (const m of masks) m.visible = fades.size > 0;
    }
  }

  let drew = { calls: 0, triangles: 0 }; // what the last frame of the world drew
  // Raycasts for taps.
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const v = new THREE.Vector3();

  const api = {
    scene,
    camera: cam,
    state,
    resize,
    turn(steps) { state.azTarget += (steps * Math.PI) / 2; },
    setZoom(level) {
      state.level = Math.max(0, Math.min(VIEW.zooms.length - 1, level));
      resize(state.width, state.height);
    },
    // The angle of the camera now (for the stick and the keys).
    get angle() { return state.az; },
    // Put the camera at a point, and build the near chunks around it now (the start, a jump); the
    // far ones come in the next frames.
    jump(x, y, z) {
      focus.set(x, y, z);
      place();
      update(x, z, Infinity, 'full');
    },
    // One frame: turn, follow, build the chunks of the ring, fade, and draw.
    // sky: { night, flood } from the world state. ambient: { gusts: { paddy, hedge, tree }, wind
    // ({ x, z }), windy } for the sway (src/core/world/ambient.js).
    render(dt, hero, t, sky = null, ambient = null) {
      uniforms.uTime.value = t;
      if (ambient) {
        uniforms.uGust.value.set(ambient.gusts.paddy, ambient.gusts.hedge, ambient.gusts.tree);
        const l = Math.hypot(ambient.wind?.x ?? 0.8, ambient.wind?.z ?? 0.6) || 1;
        uniforms.uWind.value.set((ambient.wind?.x ?? 0.8) / l, (ambient.wind?.z ?? 0.6) / l);
        uniforms.uWindy.value = ambient.windy ? 1 : 0;
      }
      const turning = state.az !== state.azTarget;
      state.az += (state.azTarget - state.az) * Math.min(1, dt * 7);
      if (Math.abs(state.azTarget - state.az) < 0.01) state.az = state.azTarget;
      // While the view turns, it turns around the hero, so that the hero stays in the middle.
      const k = turning ? 1 : Math.min(1, dt * VIEW.lag);
      focus.x += (hero.x - focus.x) * k;
      focus.y += (hero.y + 1.5 - focus.y) * k;
      focus.z += (hero.z - focus.z) * k;
      place();
      update(hero.x, hero.z);
      updateFades(hero, dt);
      waveOffset.value.y = (t * 0.04) % 1;
      // In the rain the river rises one block.
      for (const r of rivers) r.position.y = sky?.flood ?? 0;
      const night = sky?.night ?? 0;
      flyMat.opacity = night;
      fireflies.visible = night > 0.05;
      if (fireflies.visible) {
        const at = chunkKey(Math.floor(hero.x / CHUNK), Math.floor(hero.z / CHUNK));
        if (at !== flyAt) {
          flyAt = at;
          chooseFlies(hero.x, hero.z);
        }
        for (let i = 0; i < FLIES; i++) {
          const f = flyBase[i];
          const on = f && Math.sin(t * 1.7 + f.p * 5) > 0.2 ? 1 : 0;
          if (f) m4f.makeScale(on, on, on).setPosition(f.x + Math.sin(t * 0.7 + f.p) * 1.2, f.y + (sky?.flood ?? 0) + Math.sin(t * 1.3 + f.p) * 0.6, f.z + Math.cos(t * 0.5 + f.p) * 1.2);
          else m4f.makeScale(0, 0, 0);
          fireflies.setMatrixAt(i, m4f);
        }
        fireflies.instanceMatrix.needsUpdate = true;
      }
      renderer.render(scene, cam);
      drew = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    },
    // The map point on the ground under a screen point (px from the top left of the canvas).
    // With things: true, a prop can be the hit too; `who` is its owner (0 for the ground).
    // A prop that fades in front of the hero is not a hit.
    pick(px, py, { things = false } = {}) {
      ndc.set((px / state.width) * 2 - 1, -(py / state.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const ground = pickGround(ray.ray.origin, ray.ray.direction, terrain.topAt, terrain.width, terrain.height, terrain.maxTop);
      if (things) {
        for (const hit of ray.intersectObjects([...thingMeshes], false)) {
          if (ground && hit.distance > ground.t) break;
          const owners = hit.object.geometry.getAttribute('owner');
          const who = owners && hit.face ? Math.round(owners.getX(hit.face.a)) : 0;
          if (!who || fadeData[who * 4] > 128) continue;
          return { x: hit.point.x, y: hit.point.z, h: hit.point.y, who };
        }
      }
      return ground ? { ...ground, who: 0 } : null;
    },
    // The screen point (px) of a world point.
    project(x, y, z) {
      v.set(x, y, z).project(cam);
      return { x: ((v.x + 1) / 2) * state.width, y: ((1 - v.y) / 2) * state.height, visible: v.z > -1 && v.z < 1 };
    },
    // The screen box of a world box, for taps on things.
    screenBox(b) {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const x of [b.x0, b.x1]) {
        for (const y of [b.y0, b.y1]) {
          for (const z of [b.z0, b.z1]) {
            const p = api.project(x, y, z);
            x0 = Math.min(x0, p.x);
            y0 = Math.min(y0, p.y);
            x1 = Math.max(x1, p.x);
            y1 = Math.max(y1, p.y);
          }
        }
      }
      return { x0, y0, x1, y1 };
    },
    // A change of the terrain (src/world/terrain.js: dig, fell): its chunks are built again before
    // the next frame.
    edit(keys) {
      for (const k of keys) if (chunks.has(k)) dirty.add(k);
    },
    get builds() { return builds; },
    // The triangles of the chunks that are drawn now (for the budget in data/config/limits.json).
    get triangles() { return triangles; },
    get drawn() { return chunks.size; },
    // What the last frame drew (for tests of the speed on real devices).
    stats: () => ({ ...drew, chunks: chunks.size, chunkTriangles: triangles }),
    // The depth of a world point along the view (larger is nearer the camera).
    nearness: (x, y, z) => -(x * view.x + y * view.y + z * view.z),
    dispose() {
      for (const k of [...chunks.keys()]) dropChunk(k);
      terrain.hold?.('view', []);
      for (const d of disposables) d.dispose?.();
      scene.clear();
    },
  };
  place();
  return api;
}
