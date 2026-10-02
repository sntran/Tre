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
// The framings: head (the head and the neck, for the small choice buttons of hero creation), bust
// (the head and the shoulders, for the dialogue box and the cards), and full (the whole figure).
export const FRAMINGS = Object.freeze(['head', 'bust', 'full']);
// For each framing that has a face: the share of the height of the image that the head fills (from
// the chin to the top of the hair), the turn of the figure from the front (radians), and the
// height of the camera over the eyes (radians, small: the face, not the top of the hair). A head of
// blocks shows much of its side when it turns, so a turn of 20 degrees reads as about 30.
export const FACE_FRAMES = Object.freeze({
  head: { share: 0.8, turn: (15 * Math.PI) / 180, elevation: 0.06 },
  bust: { share: 0.6, turn: (20 * Math.PI) / 180, elevation: 0.08 },
});

// The frame of a face: the middle (y) and the half height of the image, in world units. headY: the
// middle of the head; top: the top of the hair. The chin is 0.8 of the way from the top to the
// middle below the middle (a head of seven units with a cap of hair one unit thick). The head fills
// its share of the height, with a small margin over the hair; the rest is the neck and the
// shoulders down to the collarbone (bust), or only the neck (head).
export function faceFrame(framing, { headY, top }) {
  const f = FACE_FRAMES[framing] ?? FACE_FRAMES.bust;
  const r = Math.max(0.01, top - headY);
  const head = 1.8 * r;
  const height = head / f.share;
  const frameTop = top + 0.03 * height;
  return { y: frameTop - height / 2, half: height / 2, chin: headY - 0.8 * r };
}
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
