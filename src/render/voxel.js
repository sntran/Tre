// The voxel world in three.js: for each chunk (src/world/chunks.js), one mesh of the ground and the
// things (half blocks, the smooth roofs, and the other smooth looks), and an ink mesh (the edges,
// and the silhouettes of the smooth looks); water with the wave pattern of the prints, paddies with
// rows of seedlings, the fade of things in front of the hero, and an orthographic camera that turns
// in steps of 90°. A change of the terrain (a dig, a felled tree) builds only its chunks again. The
// logic is in src/world/; this file only draws.
import * as THREE from 'three';
import { chunkMesh, createChunks } from '../world/chunks.js';
import { pickGround } from '../world/terrain.js';
import { C } from './palette.js';
import { night } from './figure3d.js';

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

export const VIEW = Object.freeze({ elevation: Math.atan(0.5), zooms: [26, 40], lag: 4 });

// One renderer for the game: a browser has only a few WebGL contexts.
let shared = null;
function rendererFor(canvas) {
  if (!shared || shared.domElement !== canvas) {
    shared = new THREE.WebGLRenderer({ canvas, antialias: true });
    shared.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    shared.setClearColor(new THREE.Color(C.paper));
  }
  return shared;
}

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
      attribute vec3 tone; attribute float owner;
      uniform sampler2D uFade; uniform float uFadeSize;
      varying vec3 vColor; varying float vFade;
      void main() {
        vColor = tone;
        vFade = owner > 0.5 ? texture2D(uFade, vec2((owner + 0.5) / uFadeSize, 0.5)).r : 0.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vFade;
      // A 4 x 4 ordered dither: 0 to 1 in a fixed pattern over the screen.
      float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
      float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
      void main() {
        if (vFade > 0.001 && vFade * 0.85 > bayer4(gl_FragCoord.xy)) discard;
        gl_FragColor = vec4(vColor, 1.0);
      }`,
  });
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
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(m.indices), 1));
  g.computeBoundingSphere();
  return g;
}

// The ink lines as quads that turn to the camera in the vertex shader. A group: { segs (flat list
// of [ax, ay, az, bx, by, bz] in world units), w (the width of the lines), owners, outer (one value
// for each line; see meshGrid), hull (the silhouette of a smooth look: triangles drawn in ink from
// the back only) }.
function inkGeometry(groups) {
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
      verts.forEach(([p, o, sd], k) => {
        pos.set(p, (n * 4 + k) * 3);
        other.set(o, (n * 4 + k) * 3);
        side[n * 4 + k] = sd;
        width[n * 4 + k] = w;
        owner[n * 4 + k] = who;
        outer[n * 4 + k] = out;
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
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

// The ink of a faded object goes with it: the lines inside it go, and its outline stays at about
// one third.
function inkMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    transparent: true,
    vertexShader: `
      attribute vec3 other; attribute float side; attribute float width; attribute float owner; attribute float outer; attribute float hull;
      uniform vec3 uView; uniform sampler2D uFade; uniform float uFadeSize;
      varying float vAlpha; varying float vHull;
      void main() {
        vHull = hull;
        float fade = owner > 0.5 ? texture2D(uFade, vec2((owner + 0.5) / uFadeSize, 0.5)).r : 0.0;
        vAlpha = 1.0 - fade * (outer > 0.5 ? 0.67 : 1.0);
        vec3 d = normalize(other - position);
        vec3 p = normalize(cross(d, uView)) * width * 0.5 * side;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position + p - d * width * 0.5, 1.0);
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

function nightMaterial(params) {
  return new THREE.MeshBasicMaterial(params);
}

// Build the scene of one map. terrain: from src/world/terrain.js.
export function createVoxelWorld(canvas, terrain) {
  const renderer = rendererFor(canvas);
  const scene = new THREE.Scene();
  const disposables = [];
  const track = (x) => {
    disposables.push(x);
    return x;
  };

  // The fade of each object: one value in a small texture, read in the vertex shader.
  const fadeSize = Math.max(2, terrain.objects.length + 1);
  const fadeData = new Uint8Array(fadeSize * 4);
  const fadeTex = track(new THREE.DataTexture(fadeData, fadeSize, 1, THREE.RGBAFormat));
  fadeTex.magFilter = THREE.NearestFilter;
  fadeTex.minFilter = THREE.NearestFilter;
  fadeTex.needsUpdate = true;
  const view = new THREE.Vector3();
  const uniforms = { uFade: { value: fadeTex }, uFadeSize: { value: fadeSize }, uNight: night, uView: { value: view } };
  const flatMat = track(flatMaterial(uniforms));

  // The meshes of each chunk: built at the start, and again after a change of the terrain.
  const inkMat = track(inkMaterial(uniforms));
  const thingMeshes = [];
  const chunkMeshes = new Map(); // key -> [world, ink]
  const chunks = createChunks(terrain);
  const geometry = (m) => geometryOf(m, [0, 0, 0]);
  function buildChunk(c) {
    for (const old of chunkMeshes.get(c.key) ?? []) {
      scene.remove(old);
      old.geometry.dispose();
      const i = thingMeshes.indexOf(old);
      if (i >= 0) thingMeshes.splice(i, 1);
    }
    const m = chunkMesh(terrain, c.cx, c.cz);
    const made = [];
    // The ground and the things of the chunk in one mesh.
    const all = { positions: [...m.ground.positions, ...m.things.positions], colors: [...m.ground.colors, ...m.things.colors], owners: [...m.ground.owners, ...m.things.owners], indices: [...m.ground.indices] };
    const base = m.ground.positions.length / 3;
    for (const i of m.things.indices) all.indices.push(base + i);
    if (all.indices.length) {
      const world = new THREE.Mesh(geometry(all), flatMat);
      thingMeshes.push(world);
      made.push(world);
    }
    if (m.ink.some((k) => k.segs.length || k.hull)) made.push(new THREE.Mesh(inkGeometry(m.ink), inkMat));
    for (const mesh of made) scene.add(mesh);
    chunkMeshes.set(c.key, made);
  }
  for (const c of chunks.list) buildChunk(c);

  // Water: one mesh for all the water cells, with the wave pattern.
  const waves = track(waveTexture());
  let riverMesh = null;
  if (terrain.water.length) {
    const pos = [];
    const uv = [];
    const idx = [];
    terrain.water.forEach((w, i) => {
      for (const [dx, dz] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        pos.push(w.x + dx, w.y, w.z + dz);
        uv.push((w.x + dx) / 4, (w.z + dz) / 4);
      }
      idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2);
    });
    const wg = track(new THREE.BufferGeometry());
    wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    wg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    wg.setIndex(idx);
    riverMesh = new THREE.Mesh(wg, track(nightMaterial({ map: waves })));
    scene.add(riverMesh);
  }
  // Paddies: still, pale water, with rows of seedlings.
  if (terrain.paddies.length) {
    const pos = [];
    const idx = [];
    terrain.paddies.forEach((p, i) => {
      for (const [dx, dz] of [[0, 0], [1, 0], [1, 1], [0, 1]]) pos.push(p.x + dx, p.y, p.z + dz);
      idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2);
    });
    const pg = track(new THREE.BufferGeometry());
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    pg.setIndex(idx);
    scene.add(new THREE.Mesh(pg, track(nightMaterial({ color: new THREE.Color(C.indigoPale), transparent: true, opacity: 0.72, depthWrite: false }))));
    const seed = track(new THREE.BoxGeometry(0.16, 0.8, 0.16));
    seed.translate(0, 0.25, 0);
    const seeds = new THREE.InstancedMesh(seed, track(nightMaterial({ color: new THREE.Color(C.green) })), terrain.paddies.length * 2);
    const m4 = new THREE.Matrix4();
    let k = 0;
    for (const p of terrain.paddies) {
      // Rows along x: two seedlings in each cell, on the same row.
      for (const dx of [0.25, 0.75]) {
        m4.makeRotationZ(((p.x * 7 + p.z * 13 + dx * 10) % 5) * 0.05 - 0.1);
        m4.setPosition(p.x + dx, p.y, p.z + 0.5);
        seeds.setMatrixAt(k++, m4);
      }
    }
    scene.add(seeds);
  }

  // Fireflies over the water at night: small pale boxes that blink and drift.
  const flyCount = Math.min(80, terrain.water.length);
  const flyBase = [];
  for (let i = 0; i < flyCount; i++) {
    const w = terrain.water[Math.floor(((i * 7919) % terrain.water.length))];
    flyBase.push({ x: w.x + ((i * 37) % 10) / 10, y: w.y + 0.6 + ((i * 13) % 10) / 8, z: w.z + ((i * 53) % 10) / 10, p: (i * 1.7) % 6.28 });
  }
  const flyMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(C.yellowPale), transparent: true, opacity: 0, depthWrite: false }));
  const flyGeo = track(new THREE.BoxGeometry(0.16, 0.16, 0.16));
  const fireflies = new THREE.InstancedMesh(flyGeo, flyMat, Math.max(1, flyCount));
  fireflies.frustumCulled = false;
  scene.add(fireflies);
  const m4f = new THREE.Matrix4();

  // The camera: orthographic, turns in steps of 90°, two zoom levels, a soft follow.
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 500);
  const focus = new THREE.Vector3(terrain.width / 2, 3, terrain.height / 2);
  const state = { az: Math.PI / 4, azTarget: Math.PI / 4, level: 0, width: 1, height: 1 };
  const place = () => {
    const e = VIEW.elevation;
    const dir = new THREE.Vector3(Math.cos(e) * Math.sin(state.az), Math.sin(e), Math.cos(e) * Math.cos(state.az));
    cam.position.copy(focus).addScaledVector(dir, 120);
    cam.lookAt(focus);
    view.copy(dir).negate();
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

  // The objects that fade when they are between the camera and the hero.
  const boxes = terrain.objects.map((o) => ({ who: o.who, b: terrain.boxOf(o), fade: 0 }));
  const toCam = new THREE.Vector3();
  function rayHits(b, o, d) {
    let t0 = 0.3;
    let t1 = 80;
    for (const [lo, hi, oo, dd] of [[b.x0, b.x1, o.x, d.x], [b.y0, b.y1, o.y, d.y], [b.z0, b.z1, o.z, d.z]]) {
      if (Math.abs(dd) < 1e-9) {
        if (oo < lo || oo > hi) return false;
        continue;
      }
      let a = (lo - oo) / dd;
      let c = (hi - oo) / dd;
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, c);
      if (t0 > t1) return false;
    }
    return true;
  }
  function updateFades(hero, dt) {
    toCam.copy(view).negate();
    let changed = false;
    // The feet, the head, and the two sides of the hero: a thing near the line of sight fades too.
    const rx = Math.cos(state.az) * 0.9;
    const rz = -Math.sin(state.az) * 0.9;
    const points = [
      { x: hero.x, y: hero.y + 0.4, z: hero.z },
      { x: hero.x, y: hero.y + 2.4, z: hero.z },
      { x: hero.x + rx, y: hero.y + 1.2, z: hero.z + rz },
      { x: hero.x - rx, y: hero.y + 1.2, z: hero.z - rz },
    ];
    for (const o of boxes) {
      const hit = points.some((p) => rayHits(o.b, p, toCam));
      const next = o.fade + ((hit ? 1 : 0) - o.fade) * Math.min(1, dt * 8);
      if (Math.abs(next - o.fade) > 0.004) {
        o.fade = next;
        fadeData[o.who * 4] = Math.round(next * 255);
        changed = true;
      }
    }
    if (changed) fadeTex.needsUpdate = true;
  }

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
    jump(x, y, z) {
      focus.set(x, y, z);
      place();
    },
    // One frame: turn, follow, fade, and draw.
    // sky: { night, flood } from the world state.
    render(dt, hero, t, sky = null) {
      const turning = state.az !== state.azTarget;
      state.az += (state.azTarget - state.az) * Math.min(1, dt * 7);
      if (Math.abs(state.azTarget - state.az) < 0.01) state.az = state.azTarget;
      // While the view turns, it turns around the hero, so that the hero stays in the middle.
      const k = turning ? 1 : Math.min(1, dt * VIEW.lag);
      focus.x += (hero.x - focus.x) * k;
      focus.y += (hero.y + 1.5 - focus.y) * k;
      focus.z += (hero.z - focus.z) * k;
      place();
      chunks.rebuild(buildChunk);
      updateFades(hero, dt);
      waves.offset.y = (t * 0.04) % 1;
      // In the rain the river rises one block.
      if (riverMesh) riverMesh.position.y = sky?.flood ?? 0;
      const night = sky?.night ?? 0;
      flyMat.opacity = night;
      fireflies.visible = night > 0.05;
      if (fireflies.visible) {
        for (let i = 0; i < flyCount; i++) {
          const f = flyBase[i];
          const on = Math.sin(t * 1.7 + f.p * 5) > 0.2 ? 1 : 0;
          m4f.makeScale(on, on, on).setPosition(f.x + Math.sin(t * 0.7 + f.p) * 1.2, f.y + (sky?.flood ?? 0) + Math.sin(t * 1.3 + f.p) * 0.6, f.z + Math.cos(t * 0.5 + f.p) * 1.2);
          fireflies.setMatrixAt(i, m4f);
        }
        fireflies.instanceMatrix.needsUpdate = true;
      }
      renderer.render(scene, cam);
    },
    // The map point on the ground under a screen point (px from the top left of the canvas).
    // With things: true, a prop can be the hit too; `who` is its owner (0 for the ground).
    // A prop that fades in front of the hero is not a hit.
    pick(px, py, { things = false } = {}) {
      ndc.set((px / state.width) * 2 - 1, -(py / state.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const ground = pickGround(ray.ray.origin, ray.ray.direction, terrain.topAt, terrain.width, terrain.height, terrain.maxTop);
      if (things) {
        for (const hit of ray.intersectObjects(thingMeshes, false)) {
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
    // A change of the terrain (src/world/chunks.js: dig, fell): its chunks are built again before
    // the next frame.
    edit(keys) { chunks.mark(keys); },
    get builds() { return chunks.builds; },
    // What the last frame drew (for tests of the speed on real devices).
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    // The depth of a world point along the view (larger is nearer the camera).
    nearness: (x, y, z) => -(x * view.x + y * view.y + z * view.z),
    dispose() {
      for (const d of disposables) d.dispose?.();
      for (const list of chunkMeshes.values()) for (const m of list) m.geometry.dispose();
      scene.clear();
    },
  };
  place();
  return api;
}
