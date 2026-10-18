// The raid of the river and the hopscotch (#99): the lines of a raid name the things of that raid,
// the wave is there in a raid and in a folk game, the level chooses the court, the children say
// where to start, and they stand beside the court.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { createI18n } from '../src/core/i18n.js';
import { getEntity } from '../src/core/world/state.js';

const raids = load('data/raids.json');
const vi = load('i18n/vi.json');
const i18n = createI18n(vi, 'vi');
const story = (name) => load(`tests/stories/${name}.json`);
// The words of each thing that a raid can have: a line of a raid names only the things of that raid.
const THINGS = {
  'raid.who.soldier': /\blính\b/i, 'raid.who.serpent': /thuồng luồng/i,
  'raid.ball.stone': /hòn đá/i, 'raid.ball.rice': /nắm cơm/i,
  'raid.wall.gate': /cổng/i, 'raid.wall.ford': /chỗ lội/i, 'raid.wall.cross': /ngã tư/i,
};
const paramsOf = (w) => ({ who: { key: w.who }, ball: { key: w.ball }, wall: { key: w.wall } });

test('every line that a raid says names only the things of that raid: who comes, what flies, and where the hero stands', () => {
  for (const [id, def] of Object.entries(raids.raids)) {
    const w = def.words;
    assert.ok(w?.who && w.ball && w.wall, `${id}: its words`);
    const keys = [...(def.tools ?? ['sling']).map((t) => raids.toolLines[t]?.textKey).filter(Boolean), 'raid.away', 'raid.miss.short', 'raid.miss.long', 'raid.help.nghe', 'raid.demo.look', 'raid.demo.back'];
    if ((def.tools ?? ['sling']).includes('sling')) keys.push(raids.toolLines.drag.textKey);
    for (const key of keys) {
      const text = i18n.t(key, paramsOf(w));
      assert.ok(!/\{/.test(text), `${id}: ${key} has all its words: ${text}`);
      for (const [thing, re] of Object.entries(THINGS)) {
        if (Object.values(w).includes(thing)) continue;
        // The gate of the scouts and the soldiers of the tools of the gate are things of those raids.
        if (thing === 'raid.wall.gate' && key === 'raid.tool.gate') continue;
        assert.ok(!re.test(text), `${id}: "${text}" (${key}) names ${thing}`);
      }
    }
  }
});

function run(session, seconds) {
  for (let i = 0; i < seconds / STEP; i++) {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
  }
}

test('in the raid of the river, the lines name thuồng luồng, nắm cơm, and chỗ lội; the wave is there and shows a throw, then the posts', async () => {
  const s = story('raid-river');
  s.profile = { ...s.profile, grade: 1 };
  let session = null;
  const said = [];
  const failures = await runHeadless({ ...s, steps: s.steps.slice(0, 5) }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => { if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, text: i18n.t(e.textKey, e.params ?? {}) }); });
    },
  });
  assert.deepEqual(failures, []);
  assert.ok(session.canWave, 'the wave button shows in a raid');
  // One short stone, then a walk away from the wall.
  session.command({ type: 'hands' });
  run(session, 6);
  session.command({ type: 'wave' });
  run(session, 8);
  const keys = said.map((l) => l.key);
  assert.ok(keys.includes('raid.demo.look'), `the wave: the elder shows one throw: ${keys.join(', ')}`);
  session.command({ type: 'wave' });
  run(session, 2);
  const last = said.at(-1);
  assert.equal(last.key, 'raid.tool.sling', said.map((l) => l.key).join(', '));
  assert.match(last.text, /thuồng luồng/i);
  for (const l of said) assert.ok(!/\blính\b|hòn đá|cổng làng/i.test(l.text), `"${l.text}" (${l.key})`);
  assert.ok(said.some((l) => /nắm cơm/i.test(l.text)) || said.some((l) => l.key === 'raid.river.intro'), 'the rice ball');
});

test('in a raid no star shows on the screen: each star leads away from the wall', () => {
  const src = readFileSync(new URL('../src/ui/village.js', import.meta.url), 'utf8');
  assert.match(src, /const raidNow = [^\n]*raid[^\n]*result/);
  assert.match(src, /\|\| taskHereNow \|\| raidNow \? \[\] : markers\(\)/);
  assert.match(src, /waveBtn\.hidden = busy \|\| !session\.canWave/);
});

test('the hopscotch of a child of grade 1: the court from 1, the children answer a wave, and the wave button shows', async () => {
  const s = story('practice-nhay-lo-co');
  s.profile = { ...s.profile, grade: 1 };
  let session = null;
  const said = [];
  const failures = await runHeadless({ ...s, steps: [{ until: { event: 'folkCall', timeout: 20 } }] }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => { if (e.type === 'open' && e.textKey) said.push(e.textKey); });
    },
  });
  assert.deepEqual(failures, []);
  assert.equal(session.folk().court[0], 1, 'the court from 1');
  assert.ok(session.canWave, 'the wave button shows in a folk game');
  const before = said.length;
  session.command({ type: 'wave' });
  run(session, 2);
  assert.ok(said.slice(before).some((k) => /^loco\./.test(k)), `a child answers the wave: ${said.slice(before).join(', ')}`);
});

test('the children say where to start, also on a court that does not start at 1, the start glows until the hero stands there, and the children stand away from the camera', async () => {
  const { createFolk } = await import('../src/core/folk-session.js');
  const { createWorldState, addEntity } = await import('../src/core/world/state.js');
  const data = load('data/world/folkgames.json');
  for (const [level, az] of [[1, Math.PI / 4], [2, (5 * Math.PI) / 4], [2, (3 * Math.PI) / 4]]) {
    const world = createWorldState({ seed: 1 });
    addEntity(world, { id: 'hero', position: { x: -20, y: 0, z: 0, facing: 0 } });
    const said = [];
    const folk = createFolk({
      data, profile: {}, world: () => world, env: () => ({ places: { hopscotch: { x: 0, z: 0 }, 'hopscotch-to': { x: 10, z: 0 } }, groundY: () => 0 }),
      learner: () => ({ levelFor: () => level, unlocked: () => true, isMastered: () => false }),
      seed: () => 1, emit: () => {}, callout: (k) => said.push(k), command: () => {}, goTo: () => {}, skill: () => {},
      feastOn: () => false, practice: () => null, busy: () => false, day: () => 0, view: () => az,
    });
    folk.mapStart();
    assert.ok(folk.join('loco'));
    folk.tick(3);
    const start = folk.stateOf().court[0];
    assert.equal(start === 1, level === 1, `level ${level}: the court of the level (${start})`);
    assert.ok(said.includes('loco.join'), `level ${level}: where to start: ${said.join(', ')}`);
    if (start !== 1) assert.ok(said.indexOf('loco.start') < said.indexOf('loco.join'));
    assert.ok(getEntity(world, 'folk:start'), 'the start line glows');
    // The children stand on the side of the court away from the camera.
    const toCam = { x: Math.sin(az), z: Math.cos(az) };
    for (const id of ['npc:loco-child', 'folk:child:1', 'folk:child:2']) {
      const p = getEntity(world, id).position;
      assert.ok((p.z - 0) * toCam.z <= 0, `${id} at ${p.z.toFixed(1)}: not between the camera and the court (${az.toFixed(2)})`);
    }
    // The hero comes to the start: the glow goes.
    Object.assign(getEntity(world, 'hero').position, { x: -1.6, z: -1 });
    folk.tick(0.1);
    assert.ok(!getEntity(world, 'folk:start'), 'the glow goes when the hero stands at the start');
  }
});
