import { test } from 'node:test';
import assert from 'node:assert/strict';
import { columnTop } from '../src/world/terrain.js';
import { inFront, hidesHero, stepFade, stippleOf, toCamera, FADE_MIN, FADE_HOLES, FADE_OUTLINE, BUILDINGS } from '../src/world/fade.js';
import { load, planeOf } from './helpers.js';

const tiles = load('data/tiles.json').types;
const { map, tileMap, terrain, at } = planeOf(1, { blocks: load('data/world/blocks.json') });
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
  const places = { start: [map.spawn.x, map.spawn.y], dinh: at('phu-dong', 31.5, 25.4) };
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

test('a building fades only when its walls or its roof hide the hero, not when the line of sight only crosses its box (#53)', () => {
  const builds = terrain.objects.filter((o) => BUILDINGS.has(o.kind));
  const hides = (o, hero, az) => inFront(terrain.boxOf(o), hero, az, ELEVATION) && hidesHero(terrain.boxOf(o), hero, az, ELEVATION, (x, y, z) => terrain.hits(o.who, x, y, z));
  // The hero behind a house (the house between the camera and the hero) is hidden; in front of it,
  // the house stays solid.
  for (const id of ['dinh', 'home', 'school']) {
    const o = terrain.objects.find((x) => x.id === id);
    const b = terrain.boxOf(o);
    const c = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 };
    const far = Math.max(b.x1 - b.x0, b.z1 - b.z0) / 2 + 1.5;
    for (let k = 0; k < 4; k++) {
      const az = Math.PI / 4 + (k * Math.PI) / 2;
      const d = toCamera(az, ELEVATION);
      const n = Math.hypot(d.x, d.z);
      const ground = (x, z) => columnTop(tileMap.heightAt(Math.floor(x), Math.floor(z)));
      const behind = { x: c.x - (d.x / n) * far, z: c.z - (d.z / n) * far };
      const front = { x: c.x + (d.x / n) * far, z: c.z + (d.z / n) * far };
      assert.ok(hides(o, { ...behind, y: ground(behind.x, behind.z) }, az), `${id}, turn ${k}: the house hides the hero behind it`);
      assert.ok(!hides(o, { ...front, y: ground(front.x, front.z) }, az), `${id}, turn ${k}: the house does not hide the hero in front of it`);
    }
  }
  // On the free cells around the đình, from the four angles: fewer buildings fade than the box
  // rule gives, and three or more at once almost never.
  const [cx, cz] = at('phu-dong', 31.5, 25.4);
  let boxes = 0;
  let blocks = 0;
  let many = 0;
  let cases = 0;
  for (let dz = -16; dz <= 16; dz += 2) {
    for (let dx = -16; dx <= 16; dx += 2) {
      const x = Math.floor(cx) + dx;
      const z = Math.floor(cz) + dz;
      if (!tileMap.walkable(x, z)) continue;
      const hero = { x: x + 0.5, y: columnTop(tileMap.heightAt(x, z)), z: z + 0.5 };
      for (let k = 0; k < 4; k++) {
        const az = Math.PI / 4 + (k * Math.PI) / 2;
        const n = builds.filter((o) => hides(o, hero, az)).length;
        boxes += builds.filter((o) => inFront(terrain.boxOf(o), hero, az, ELEVATION)).length;
        blocks += n;
        if (n >= 3) many += 1;
        cases += 1;
      }
    }
  }
  assert.ok(blocks < boxes * 0.75, `fewer buildings fade: ${blocks} against ${boxes}`);
  assert.ok(many <= cases * 0.01, `three or more buildings at once: ${many} of ${cases}`);
});

test('a full fade keeps a part of the dots and a soft outline: a see-through shape, not lines of wire (#53)', () => {
  assert.ok(FADE_HOLES > 0.3 && FADE_HOLES < 0.8, 'some dots of the faces stay');
  assert.ok(FADE_OUTLINE > 0.3 && FADE_OUTLINE < 1, 'the outline goes soft, but the shape stays');
});

// At the wall of the scouts the hero stands by the forge (#55, frame 1). From the angle where the
// road goes up and to the right, the roof of the forge hides the hero, and the view must fade it:
// the view tests the hero, not the point that it follows in a raid (a point on the road).
test('at the wall of the scouts, the roof of the forge hides the hero from one angle, and the point on the road is not hidden (#55)', () => {
  const raids = load('data/raids.json');
  const def = raids.raids.scouts;
  const forge = terrain.objects.find((o) => o.id === 'forge');
  const hides = (p, az) => inFront(terrain.boxOf(forge), p, az, ELEVATION) && hidesHero(terrain.boxOf(forge), p, az, ELEVATION, (x, y, z) => terrain.hits(forge.who, x, y, z));
  const [x, z] = at('phu-dong', def.wall[0] + 0.5, def.wall[1] + 0.5);
  const hero = { x, y: columnTop(tileMap.heightAt(Math.floor(x), Math.floor(z))), z };
  const az = Math.PI / 4 + (3 * Math.PI) / 2;
  assert.ok(hides(hero, az), 'the roof of the forge is between the camera and the hero');
  const road = { ...hero, x: hero.x + def.dir[0] * 8, z: hero.z + def.dir[1] * 8 };
  assert.ok(!hides(road, az), 'a point on the road is not behind the forge: a fade from it would keep the roof');
});
