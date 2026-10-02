// The portraits of the people and the creatures: pure rules, no DOM and no WebGL. The renderer
// (src/render/portrait.js) draws a figure of src/world/fine.js into a small image; this file gives
// the key of an image, the cache of the images, the moods of a face, and the mesh of one prop on its
// own (for the views of the gate and the stele of Văn Miếu).
import { createGrid } from './voxel.js';
import { buildProp } from './props/index.js';
import { meshGrid } from './mesher.js';
import { roofMesh } from './roofs.js';

// The moods of a face (the brows and the mouth of the figure builder, src/world/fine.js).
export const MOODS = Object.freeze(['calm', 'happy', 'worried', 'surprised']);
// The framings: bust (the head and the shoulders, three-quarter view) and full (the whole figure).
export const FRAMINGS = Object.freeze(['bust', 'full']);
export const CACHE_SIZE = 64;

// A text for a value with the keys of each object in order, so that the same look gives the same
// key whatever the order of its keys.
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

// The key of a portrait: the look, the framing, the mood, the size (CSS pixels), the pixel ratio,
// and the turn of the figure (null: the three-quarter view of the framing).
export function portraitKey({ look, framing = 'bust', mood = 'calm', size = 96, ratio = 1, facing = null }) {
  return `${framing}|${MOODS.includes(mood) ? mood : 'calm'}|${size}|${ratio}|${facing ?? ''}|${stable(look)}`;
}

// A cache that keeps at most `max` values; the value that was used last goes out first.
export function createLru(max = CACHE_SIZE) {
  const map = new Map();
  return {
    get(key) {
      if (!map.has(key)) return undefined;
      const v = map.get(key);
      map.delete(key);
      map.set(key, v);
      return v;
    },
    has: (key) => map.has(key),
    set(key, v) {
      map.delete(key);
      map.set(key, v);
      while (map.size > max) map.delete(map.keys().next().value);
    },
    get size() { return map.size; },
    keys: () => [...map.keys()],
  };
}

// The look of a speaker of the dialogue data. figures: data/figures.json (figures); flags: the
// flags of the profile (Gióng grows); heroLook: the look of the hero of the profile. Return a look,
// or null for the narrator.
export function speakerLook(speaker, { figures, flags = {}, hero = null }) {
  if (!speaker || speaker === 'narrator') return null;
  if (speaker === 'hero') return hero;
  if (speaker === 'giong') return figures[flags['giong.grown'] ? 'giong-hero' : 'giong-boy'] ?? null;
  return figures[speaker] ?? null;
}

// The mesh of one prop of src/world/props/ on its own, on flat ground: { positions, colors, indices,
// segments } in world units (the ground at y 0, the middle of the prop at x 0 and z 0), and its
// height. prop: { kind, w, h (map cells), seed }.
export function propMesh({ kind, w = 2, h = 2, seed = 1 }) {
  const fw = w * 2;
  const fd = h * 2;
  const pad = 6;
  const fine = createGrid(fw + pad * 2, 64, fd + pad * 2, { owners: true });
  const built = buildProp({ fine, groundTop: () => 0, shadow: () => {} }, { kind, fx: pad, fz: pad, fw, fd, seed }, 1);
  const m = meshGrid(fine, { scale: 0.5 });
  const out = { positions: [...m.positions], colors: [...m.colors], indices: [...m.indices], segments: [...m.segments] };
  for (const r of built.roofs ?? []) {
    const rm = roofMesh(r);
    const base = out.positions.length / 3;
    out.positions.push(...rm.positions);
    out.colors.push(...rm.colors);
    for (const i of rm.indices) out.indices.push(base + i);
    out.segments.push(...rm.segs);
  }
  // Move the middle of the footprint to x 0, z 0.
  const cx = (pad + fw / 2) * 0.5;
  const cz = (pad + fd / 2) * 0.5;
  let top = 0;
  for (const arr of [out.positions, out.segments]) {
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] -= cx;
      arr[i + 2] -= cz;
      top = Math.max(top, arr[i + 1]);
    }
  }
  return { ...out, height: top };
}
