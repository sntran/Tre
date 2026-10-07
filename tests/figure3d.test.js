import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

// The drawing code imports three.js; in node, 'three' gives a stand-in (tests/three-stub.js).
register('./three-hooks.js', import.meta.url);
const { figureMeshes } = await import('../src/render/figure3d.js');

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
