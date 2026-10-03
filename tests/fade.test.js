import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTileMap } from '../src/core/tilemap.js';
import { buildTerrain, columnTop } from '../src/world/terrain.js';
import { inFront, stepFade, stippleOf, toCamera, FADE_MIN } from '../src/world/fade.js';
import { load, mapOf } from './helpers.js';

const tiles = load('data/tiles.json').types;
const map = mapOf('phu-dong');
const tileMap = createTileMap(map, tiles);
const terrain = buildTerrain(map, tiles, tileMap, load('data/world/blocks.json'));
const ELEVATION = Math.atan(0.5); // the camera of src/render/voxel.js (VIEW.elevation)

// Is a point of the line of sight inside the box? A sample along the line, apart from rayHits.
function crossed(b, hero, az) {
  const d = toCamera(az, ELEVATION);
  const rx = Math.cos(az) * 0.9;
  const rz = -Math.sin(az) * 0.9;
  const starts = [[0, 0.4, 0], [0, 2.4, 0], [rx, 1.2, rz], [-rx, 1.2, -rz]].map(([x, y, z]) => ({ x: hero.x + x, y: hero.y + y, z: hero.z + z }));
  for (const p of starts) {
    for (let t = 0.3; t <= 80; t += 0.02) {
      const x = p.x + d.x * t;
      const y = p.y + d.y * t;
      const z = p.z + d.z * t;
      if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1) return true;
    }
  }
  return false;
}

test('only the objects whose box the line of sight crosses fade: at the start of Phù Đổng and at the đình, at each turn', () => {
  const places = { start: [map.spawn.x, map.spawn.y], dinh: [31.5, 25.4] };
  for (const [name, [x, z]] of Object.entries(places)) {
    const hero = { x, y: columnTop(tileMap.heightAt(Math.floor(x), Math.floor(z))), z };
    for (let k = 0; k < 4; k++) {
      const az = Math.PI / 4 + (k * Math.PI) / 2;
      const fades = new Map(terrain.objects.map((o) => [o.who, 0]));
      for (let i = 0; i < 60; i++) {
        for (const o of terrain.objects) fades.set(o.who, stepFade(fades.get(o.who), inFront(terrain.boxOf(o), hero, az, ELEVATION), 1 / 30));
      }
      for (const o of terrain.objects) {
        const across = crossed(terrain.boxOf(o), hero, az);
        assert.equal(fades.get(o.who) > 0, across, `${name}, turn ${k}: ${o.id ?? o.kind} fades ${fades.get(o.who)}, the line crosses it: ${across}`);
      }
    }
  }
});

test('a fade comes back to exactly 0, and a small fade draws no dots', () => {
  let f = 0;
  for (let i = 0; i < 30; i++) f = stepFade(f, true, 1 / 30);
  assert.equal(f, 1);
  for (let i = 0; i < 30; i++) f = stepFade(f, false, 1 / 30);
  assert.equal(f, 0, 'no fade is left after the line leaves the thing');
  assert.equal(stippleOf(FADE_MIN - 0.01), 0);
  assert.equal(stippleOf(0.5), 0.5);
});
