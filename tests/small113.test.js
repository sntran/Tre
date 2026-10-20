// Small things after the play test of #95 to #104 (#113): the elder looks like an old man from each
// angle of the view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personFine } from '../src/world/fine.js';
import { person } from '../src/world/figures.js';
import { load } from './helpers.js';

const figs = load('data/figures.json').figures;

// The rectangle of a part of the head as the camera sees it from a side: from the front or the
// back, x and y; from the left or the right, z and y.
const rectOf = (p, side) => {
  const [w, h, d] = p.size;
  const [x, y, z] = p.at;
  const u = side === 'x' ? [z - d / 2, z + d / 2] : [x - w / 2, x + w / 2];
  return { u0: u[0], u1: u[1], v0: y - h / 2, v1: y + h / 2 };
};
// Does a point of the beard show out of the other parts of the head, from that side?
function beardShows(parts, side) {
  const head = parts.filter((p) => p.parent === 'head' && !/^beard/.test(p.name) && p.size[0] > 0.05);
  const beard = parts.filter((p) => /^beard/.test(p.name));
  for (const b of beard) {
    const r = rectOf(b, side);
    for (let i = 0; i <= 8; i++) {
      for (let j = 0; j <= 8; j++) {
        const u = r.u0 + ((r.u1 - r.u0) * i) / 8;
        const v = r.v0 + ((r.v1 - r.v0) * j) / 8;
        // From the front, the beard is in front of the face; from the back and the sides, it shows
        // only out of the head.
        if (side === 'front') return true;
        if (!head.some((p) => { const q = rectOf(p, side); return u > q.u0 && u < q.u1 && v > q.v0 && v < q.v1; })) return true;
      }
    }
  }
  return false;
}

test('the elder: a dark robe, a khăn, and a white beard that shows from the front, the side, and the back', () => {
  const e = figs.elder;
  assert.equal(e.hat, 'khan');
  assert.ok(['wood', 'ink', 'indigo'].includes(e.top), `a dark robe: ${e.top}`);
  assert.equal(e.beard, true);
  assert.equal(e.item, 'staff');
  for (const fig of [personFine(e), person(e)]) {
    for (const side of ['front', 'back', 'x']) assert.ok(beardShows(fig.parts, side), `${fig.grid ? 'fine' : 'coarse'}: the beard shows from the ${side === 'x' ? 'side' : side}`);
  }
});

// The hero at the đình when the envoy has come (the step of the goal is the envoy).
async function atEnvoy(cell = [34, 27], steps = [{ wait: 1 }]) {
  const { runHeadless } = await import('./story-run.js');
  const { getEntity } = await import('../src/core/world/state.js');
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true, 'prologue.done': true, 'trial.scholar.done': true, 'trial.smith.done': true, 'trial.fisher.done': true, 'trial.healer.done': true, 'trial.woodcutter.done': true } };
  let session = null;
  const failures = await runHeadless({ name: 'envoy-113', profile, clock: 600, at: ['phu-dong', ...cell], steps }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  return { session, getEntity };
}

test('with the envoy near the hero, the big button talks to the envoy, not to the elder', async () => {
  // Next to the elder, and the envoy a few steps away.
  const { session } = await atEnvoy([32, 26.5]);
  const a = session.action();
  assert.equal(a?.act, 'talk');
  assert.equal(a.target, 'npc:messenger', JSON.stringify(a));
});

test('while the envoy waits at the đình, the people of the village walk there and stand around him', async () => {
  const { session, getEntity } = await atEnvoy();
  const run = (sec) => {
    for (let i = 0; i < sec * 30; i++) {
      if (session.screen) session.command({ type: 'close' });
      session.step();
      session.events();
    }
  };
  run(60);
  const envoy = getEntity(session.state, 'npc:messenger').position;
  const near = ['elder', 'grandma', 'teacher', 'healer', 'smith'].filter((id) => {
    const e = getEntity(session.state, `npc:${id}`);
    return e && !e.hidden && Math.hypot(e.position.x - envoy.x, e.position.z - envoy.z) <= 10;
  });
  assert.ok(near.length >= 3, `people near the envoy: ${near.join(', ')}`);
});

test('the card of a new animal comes only while the animal is on the screen, and names the animal that pulses', async () => {
  const { runHeadless } = await import('./story-run.js');
  const { getEntity } = await import('../src/core/world/state.js');
  const { inView, viewSize } = await import('../src/world/view.js');
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
  let session = null;
  const cards = [];
  await runHeadless({ name: 'card-113', profile, clock: 600, at: ['phu-dong', 40, 60], steps: [{ wait: 0.5 }] }, {
    onSession: (s) => {
      session = s;
      s.listen((e) => { if (e.type === 'notebook' && e.from) cards.push(e); });
    },
  });
  const hero = getEntity(session.state, 'hero');
  const dog = session.state.entities.find((e) => e.kind === 'dog' && e.position);
  assert.ok(dog, 'a dog');
  const hold = (p) => {
    for (let i = 0; i < 60; i++) {
      Object.assign(dog.position, p);
      delete dog.route;
      session.step();
      session.events();
    }
  };
  // Near, but off the screen of a phone held upright.
  const scr = viewSize(390, 844, 0);
  const hp = hero.position;
  let off = null;
  for (let a = 0; a < 16 && !off; a++) {
    const p = { x: hp.x + Math.sin(a * Math.PI / 8) * 16, y: hp.y, z: hp.z + Math.cos(a * Math.PI / 8) * 16 };
    if (!inView({ x0: p.x / 2 - 0.4, x1: p.x / 2 + 0.4, y0: p.y / 2, y1: p.y / 2 + 0.8, z0: p.z / 2 - 0.4, z1: p.z / 2 + 0.4 }, { x: hp.x / 2, y: hp.y / 2, z: hp.z / 2 }, { az: Math.PI / 4, size: scr })) off = p;
  }
  assert.ok(off, 'a point off the screen');
  hold(off);
  assert.equal(cards.filter((c) => c.from === dog.id).length, 0, 'no card while the dog is off the screen');
  hold({ x: hp.x + 2, y: hp.y, z: hp.z + 2 });
  assert.ok(cards.some((c) => c.from === dog.id), 'the card when the dog is on the screen');
});

test('no greeting has a word of praise, and an old person says hello', () => {
  for (const lang of ['vi', 'en']) {
    const dict = load(`i18n/${lang}.json`);
    for (const [k, v] of Object.entries(dict)) {
      if (!/^world\.greet\./.test(k)) continue;
      assert.ok(!/ngoan|giỏi|tốt lắm|good (child|boy|girl)|well done|clever/i.test(v), `${lang} ${k}: ${v}`);
    }
  }
});

async function atGiong(flags, cell, steps) {
  const { runHeadless } = await import('./story-run.js');
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true, 'prologue.done': true, 'trial.scholar.done': true, 'trial.smith.done': true, 'trial.fisher.done': true, 'trial.healer.done': true, 'trial.woodcutter.done': true, ...flags } };
  let session = null;
  const seen = [];
  const failures = await runHeadless({ name: 'giong-113', profile, clock: 600, at: ['phu-dong', ...cell], steps }, {
    onSession: (s) => {
      session = s;
      s.listen((e) => {
        const g = s.state.entities.find((x) => x.id === 'npc:giong-boy');
        const m = s.state.entities.find((x) => x.id === 'npc:mother');
        if (e.type === 'open' && e.textKey) seen.push({ key: e.textKey, lie: Boolean(g?.lie), near: g && m ? Math.hypot(g.position.x - m.position.x, g.position.z - m.position.z) : null });
        if (e.type === 'workView') seen.push({ view: e.key });
        if (e.type === 'names') seen.push({ names: e.ids });
      });
    },
  });
  assert.deepEqual(failures, [], seen.map((x) => x.key ?? x.view).join(', '));
  return { session, seen };
}

test('Gióng lies on a mat while the line "nằm im" shows, and stands beside his mother, in view, when he speaks', async () => {
  const silent = await atGiong({}, [19.2, 27], [{ wait: 3 }, { press: { entity: 'npc:giong-boy' } }, { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } }]);
  const s1 = silent.seen.find((x) => x.key === 'dlg.giong.silent.n1');
  assert.ok(s1, silent.seen.map((x) => x.key).join(', '));
  assert.ok(s1.lie, 'Gióng lies while the line says so');
  assert.ok(silent.session.state.entities.some((e) => e.id === 'mat:lie:giong-boy'), 'a mat under him');
  assert.ok(silent.seen.some((x) => x.names?.includes('npc:giong-boy')), 'the line names him: he glows, and the view leads to him');
  const speaks = await atGiong({ 'giong.messenger': true }, [23, 27], [{ wait: 3 }, { press: { entity: 'npc:mother' } }, { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } }]);
  const s2 = speaks.seen.find((x) => x.key === 'dlg.giong.speaks.n1');
  assert.ok(s2, speaks.seen.map((x) => x.key).join(', '));
  assert.equal(s2.lie, false, 'he stands up to speak');
  assert.ok(s2.near <= 3, `beside his mother: ${s2.near}`);
  assert.ok(speaks.seen.some((x) => x.view === 'scene-giong-boy'), 'the view shows them');
});

test('the line of the elder about the drum comes with the drum, also after a load', () => {
  const dlg = load('data/dialogue/prologue.json');
  const list = Array.isArray(dlg) ? dlg : dlg.dialogues;
  const drum = list.find((d) => d.id === 'elder.drum');
  assert.ok(Object.values(drum.nodes).some((n) => (n.effects ?? []).some((e) => e.sound === 'drum')), JSON.stringify(drum));
});

test('at the first card of con trâu, a person near says that Nghé is a young buffalo, and the print of Nghé says it too', async () => {
  const vi = load('i18n/vi.json');
  assert.match(vi['note.creature.nghe'], /trâu con/);
  assert.match(vi['note.buffalo.nghe'], /trâu con/);
  const { runHeadless } = await import('./story-run.js');
  const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
  let session = null;
  const said = [];
  await runHeadless({ name: 'buffalo-113', profile, clock: 600, at: ['phu-dong', 20, 27], steps: [{ wait: 0.5 }] }, {
    onSession: (s) => {
      session = s;
      s.listen((e) => { if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, id: e.id }); });
    },
  });
  const hero = session.state.entities.find((e) => e.id === 'hero');
  // A buffalo of the fields (the big buffaloes graze in Xóm Ruộng), next to the hero.
  const { addEntity } = await import('../src/core/world/state.js');
  const buffalo = addEntity(session.state, { id: 'life:buffalo:test', kind: 'buffalo', position: { x: hero.position.x + 2, y: hero.position.y, z: hero.position.z + 2, facing: 0 }, look: 'buffalo' });
  for (let i = 0; i < 60; i++) {
    Object.assign(buffalo.position, { x: hero.position.x + 2, z: hero.position.z + 2 });
    delete buffalo.route;
    session.step();
    session.events();
  }
  const line = said.find((l) => l.key === 'note.buffalo.nghe');
  assert.ok(line && /^npc:/.test(line.id), JSON.stringify(said));
});

test('no print of the notebook has an empty picture: a thing shows whole, and a figure with a head shows its bust', async () => {
  const { printFraming, figureOf } = await import('../src/world/figures.js');
  const figs = load('data/figures.json').figures;
  const nb = load('data/notebook.json');
  const looks = new Set([...nb.entries.map((e) => e.look), ...Object.values(nb.skills).flatMap((s) => [s.look, ...Object.values(s.from ?? {}).map((x) => x.look)])].filter(Boolean));
  assert.ok(looks.has('rod'));
  for (const k of looks) {
    const look = figs[k];
    assert.ok(look, `${k}: a look of data/figures.json`);
    const f = figureOf(look, 'coarse');
    const parts = (f.parts ?? []).filter((p) => p.size.every((v) => v > 0.02));
    assert.ok(parts.length > 0, `${k}: parts to draw`);
    const framing = printFraming(look);
    if (framing === 'bust') assert.ok(f.parts.some((p) => p.name === 'head' || p.name === 'skull'), `${k}: a bust needs a head`);
  }
  assert.equal(printFraming(figs.rod), 'full', 'the rods show whole');
});

test('each lock of the country map stands inside its land, at each size of the map', async () => {
  const { createProjection, regionAreas, placeSeals, insideRings } = await import('../src/world/geo.js');
  const geo = load('data/geo/vietnam.json');
  const regions = load('data/world/regions.json').regions;
  const proj = createProjection(geo.bbox);
  const place = Object.fromEntries(geo.places.map((p) => [p.id, p]));
  const vnm = geo.land.VNM.map((r) => r.map(proj.toMap));
  // The areas and the anchors as src/ui/worldmap.js makes them.
  const centers = regions.flatMap((r) => [place[r.place].at, ...(r.seeds ?? [])].map((at) => ({ id: r.id, ...proj.toMap(at) })));
  const { areas } = regionAreas(centers, vnm);
  const anchors = regions.map((r) => ({ id: r.id, ...proj.toMap(place[r.place].at) }));
  for (const radius of [0.2, 0.5, 1, 2, 4, 8]) {
    const seals = placeSeals(anchors, radius, { locked: (id) => id !== 'giong', areas });
    for (const s of seals) {
      assert.ok(insideRings(areas.get(s.id), s), `radius ${radius}: the seal of ${s.id} (${s.ids.join(', ')}) is on its land`);
    }
  }
});

test('the goal of the story has a mark on the country map, with the name of its place, and the way to it is the road of the walk', async () => {
  const { goalMark, goalWay } = await import('../src/world/geo.js');
  const { worldOf } = await import('./helpers.js');
  const world = worldOf();
  const geo = load('data/geo/vietnam.json');
  const quests = load('data/quests.json').quests;
  const step = quests.flatMap((q) => q.steps).find((st) => st.goalKey === 'quest.placement.exam');
  // The places of the quests on the plane, as src/ui/data.js makes them.
  const [x, y] = world.at(step.place.map, step.place.x, step.place.y);
  const mark = goalMark(world, geo.places, { ...step, place: { ...step.place, map: world.regionOf(step.place.map), x, y } });
  assert.ok(mark, 'a mark');
  assert.equal(mark.name, 'Văn Miếu');
  const hero = geo.places.find((p) => p.id === 'phu-dong').at;
  const way = goalWay(load('data/world/routes.json').routes, geo.places, hero, mark.at);
  const road = load('data/world/routes.json').routes.find((r) => r.from === 'phu-dong' && r.to === 'thang-long');
  assert.deepEqual(way, [hero, ...road.via, mark.at]);
});

test('when the talk of the envoy opens, the people stand around him, as its line says', async () => {
  const { runHeadless } = await import('./story-run.js');
  const { getEntity } = await import('../src/core/world/state.js');
  const s = load('tests/stories/envoy-dinh.json');
  let at = null;
  await runHeadless(s, {
    onSession: (x) => {
      x.listen((e) => {
        if (e.type === 'open' && e.textKey === 'dlg.messenger.call.n1' && !at) {
          const m = getEntity(x.state, 'npc:messenger').position;
          at = ['elder', 'grandma', 'teacher', 'healer', 'smith'].filter((id) => {
            const p = getEntity(x.state, `npc:${id}`);
            return p && !p.hidden && Math.hypot(p.position.x - m.x, p.position.z - m.z) <= 10;
          });
        }
      });
    },
  });
  assert.ok(at && at.length >= 4, `people around the envoy when the talk opens: ${at}`);
});
