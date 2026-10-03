// The board of the figures (docs/reference/figures.html): every figure of the game as a piece of a
// board game, on a round base, for the review of the owner. Pure (no DOM, no WebGL): the items of
// the board from the data, the size of the base of each piece, and the address of the page (the
// piece up close and the switches). A new look in the data is a new piece, with no change here.
import { figureOf, heroLook } from './figures.js';
import { HATS } from './fine.js';
import { MOODS } from './portraits.js';

// The kinds of look that are animals. A look with no kind is a person; the other kinds are things.
export const ANIMAL_KINDS = Object.freeze(['nghe', 'duck', 'duckling', 'chicken', 'fish', 'buffalo', 'dog', 'frog', 'kingfisher', 'owl', 'bird', 'serpent']);
// A grown-up for the hats.
const GROWN = Object.freeze({ skin: 'skin2', top: 'indigo', bottom: 'indigo', sash: 'vermilion', topKind: 'shirt', bottomKind: 'trousers', face: 1 });

// The rows of the board: [{ id, items: [{ id, key (the key in data/figures.json, or null), look }] }]:
// the hero of each gender, the people, the hair choices of hero creation, each hat on a grown-up,
// the animals, and the things. figures: data/figures.json.
export function boardRows(figures) {
  const looks = figures.figures;
  const hero = figures.hero;
  const kindOf = (look) => (!look.kind ? 'people' : ANIMAL_KINDS.includes(look.kind) ? 'animals' : 'things');
  const fromData = (row) => Object.entries(looks).filter(([, look]) => kindOf(look) === row).map(([key, look]) => ({ id: key, key, look }));
  return [
    { id: 'heroes', items: Object.keys(hero.genders).map((gender, i) => ({ id: `hero-${gender}`, key: null, look: heroLook({ gender, skin: 2 + i, face: 1 + i, hair: 2 + i * 2, clothes: 1 + i * 2 }, hero) })) },
    { id: 'people', items: fromData('people') },
    { id: 'hairs', items: hero.hairs.map((hair, i) => ({ id: `hair-${hair}`, key: null, look: heroLook({ gender: i % 2 ? 'girl' : 'boy', skin: 2, face: 1, hair: i + 1, clothes: 1 }, hero) })) },
    { id: 'hats', items: HATS.map((hat, i) => ({ id: `hat-${hat}`, key: null, look: { ...GROWN, hat, hair: hero.hairs[i % hero.hairs.length] } })) },
    { id: 'animals', items: fromData('animals') },
    { id: 'things', items: fromData('things') },
  ];
}
export const boardItems = (figures) => boardRows(figures).flatMap((r) => r.items);

// The footprint of a figure at rest (blocks, from its middle; facing 0): its parts.
export function footprint(look) {
  const f = figureOf(look, 'fine');
  const unit = f.scale * (f.grid ?? 0.5);
  const abs = {};
  const box = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const p of f.parts) {
    const base = abs[p.parent] ?? [0, 0, 0];
    const at = [base[0] + p.at[0], base[1] + p.at[1], base[2] + p.at[2]];
    abs[p.name] = at;
    if (!p.size) continue;
    box.x0 = Math.min(box.x0, (at[0] - p.size[0] / 2) * unit);
    box.x1 = Math.max(box.x1, (at[0] + p.size[0] / 2) * unit);
    box.z0 = Math.min(box.z0, (at[2] - p.size[2] / 2) * unit);
    box.z1 = Math.max(box.z1, (at[2] + p.size[2] / 2) * unit);
  }
  return box.x0 === Infinity ? { x0: -0.25, x1: 0.25, z0: -0.25, z1: 0.25 } : box;
}

// The base of a piece: a little wider than the feet (a quarter block out on each side), round for
// a figure that is about as wide as it is deep, and oval for a long one. Return { rx, rz } (blocks),
// and cx, cz: the middle of the footprint from the origin of the figure (the figure stands with
// its middle on the middle of the base).
export function baseOf(look) {
  const b = footprint(look);
  const rx = (b.x1 - b.x0) / 2 + 0.25;
  const rz = (b.z1 - b.z0) / 2 + 0.25;
  const r = Math.max(rx, rz);
  const round = Math.min(rx, rz) > r * 0.6;
  return { rx: round ? r : rx, rz: round ? r : rz, cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2 };
}

// The switches of the page, with their values (the first is the default).
export const SWITCHES = Object.freeze({
  pose: Object.freeze(['rest', 'walk']),
  wind: Object.freeze(['none', 'breeze', 'full']),
  mood: MOODS,
  time: Object.freeze(['day', 'night']),
  level: Object.freeze(['fine', 'far']),
});
const DEFAULTS = Object.freeze({ look: null, ...Object.fromEntries(Object.entries(SWITCHES).map(([k, v]) => [k, v[0]])) });

// The state of the page from its address (location.search). ids: the ids of the pieces; a look
// that is not one of them opens the board. Other parameters and bad values are not read.
export function parseAddress(search, ids) {
  const q = new URLSearchParams(search);
  const out = { ...DEFAULTS };
  const look = q.get('look');
  out.look = look && ids.includes(look) ? look : null;
  for (const [k, values] of Object.entries(SWITCHES)) if (values.includes(q.get(k))) out[k] = q.get(k);
  return out;
}

// The address of a state: only the look up close and the switches that are not at their default.
export function formatAddress(state) {
  const q = new URLSearchParams();
  if (state.look) q.set('look', state.look);
  for (const k of Object.keys(SWITCHES)) if (state[k] && state[k] !== DEFAULTS[k]) q.set(k, state[k]);
  const text = q.toString();
  return text ? `?${text}` : '';
}
