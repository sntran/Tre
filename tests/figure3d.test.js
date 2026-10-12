import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

// The drawing code imports three.js; in node, 'three' gives a stand-in (tests/three-stub.js).
register('./three-hooks.js', import.meta.url);
const { figureMeshes, createFigureLayer } = await import('../src/render/figure3d.js');

const { heroLook } = await import('../src/world/figures.js');
const { speakerLook } = await import('../src/world/portraits.js');
const figures = JSON.parse(readFileSync(new URL('../data/figures.json', import.meta.url), 'utf8'));

// The looks of the portraits of the game: the hero of hero creation, each speaker, and Nghé.
function looks() {
  const hero = heroLook({ gender: 'girl', skin: 3, face: 2, hair: 4, clothes: 2 }, figures.hero);
  const list = [hero, heroLook({ gender: 'boy', skin: 1, face: 1, hair: 1, clothes: 1 }, figures.hero), { kind: 'nghe' }];
  for (const s of Object.keys(figures.figures)) {
    const look = speakerLook(s, { figures: figures.figures, hero });
    if (look) list.push(look);
  }
  return list;
}

// #59: dispose() of the meshes of a portrait used a name of another function, so each portrait
// threw an error and the game showed an empty box in its place.
test('the meshes of each portrait are made and disposed with no error', () => {
  const list = looks();
  assert.ok(list.length > 5);
  for (const look of list) {
    for (const detail of ['fine', 'coarse']) {
      const fig = figureMeshes(look, { detail });
      assert.ok(fig.group && fig.height > 0, JSON.stringify(look));
      assert.doesNotThrow(() => fig.dispose(), JSON.stringify(look));
    }
  }
});

// #87: the counter of the outline of a covered hero had the name x, and the place of a figure in
// the loop also had the name x. Far from the origin the outline had no parts; near the origin a
// draw stopped with an error. Each frame now draws, and the outline has a counter of its own.
test('a layer with a hero near the origin and far from it draws with no error', async () => {
  const hero = heroLook({ gender: 'boy', skin: 1, face: 1, hair: 1, clothes: 1 }, figures.hero);
  const scene = { add() {}, remove() {} };
  // The stand-in of three.js is also the camera.
  const { Matrix4: camera } = await import('three');
  const layer = createFigureLayer(scene, () => hero, { camera });
  for (const x of [4, 400]) {
    layer.sync({ tick: 1, entities: [{ id: 'hero', control: true, look: 'hero', position: { x, y: 0, z: 4, facing: 0 } }] });
    assert.doesNotThrow(() => layer.draw(0.5, 1 / 30));
  }
  const src = readFileSync(new URL('../src/render/figure3d.js', import.meta.url), 'utf8');
  assert.ok(/xMask\.count = xn;/.test(src) && /xn \+= 1;/.test(src), 'the outline counts its own parts');
});
