// The stars of the story (#174): the quest markers of the view, as world points { x, y (map cells),
// h (height), who, thing, key, main, rest, target }. The view (src/ui/village.js) draws them, and the
// robot child (tools/robot/) taps them, so that both use the same stars. In a practice of a whole
// place, the star of a task is over the person of each station (#37).
// ctx: { data, profile, state, session, mapData, groundY(x, y), top(id) (the top of a figure, or
// null), objectTop(id, o) (the top of a thing of the map, or null) }.
import { getEntity } from './world/state.js';
import { currentGoal, liveTargets, placeMark, starOf } from './quests.js';
import { questMark } from './clues.js';
import { conditionState } from './game.js';

export function storyStars({ data, profile, state, session, mapData, groundY, top, objectTop = () => null }) {
  const persons = () => session.persons();
  const hero = () => getEntity(state, 'hero');
  const figureTop = top;

  const stationIds = session.stations();
  if (stationIds.length) {
    return persons().filter((p) => p.kind === 'npc' && stationIds.includes(p.ref)).map((p) => ({ p, top: figureTop(p.entity) }))
      .filter((m) => m.top !== null).map(({ p, top }) => ({ x: p.x, y: p.y, h: top, id: p.entity, who: p.ref, key: 'star.go.person', main: false }));
  }
  // A practice has no star of the story (#51): the work of the practice has its own outlines.
  if (session.practice) return [];
  const goal = currentGoal(data.quests.quests, conditionState(profile));
  if (!goal) return [];
  const stepGoal = goal.step;
  const out = [];
  const flags = profile.flags;
  // The targets that are there now (#50): not a done one, and not the enemies of a won or a
  // lost raid (they come back at the next dawn).
  const raidOf = (id) => mapData.encounters.find((e) => e.id === id)?.raid ?? null;
  // With the sacks of the rest in the hands, the star is on the person who takes them, and the
  // next raid has no star until the child gives them (#141).
  // While the share after a raid goes on, no star of the story (#151: three things at once).
  const share = getEntity(state, 'zone:trial-share');
  if (share && !share.zone.done) return [];
  const gift = session.giftTo();
  // When every target waits for the dawn (a lost raid), or at night before a raid, the star is on
  // the place of rest, with the picture of a mat (#155: "I looked everywhere, there is none!").
  const rest = gift ? null : session.restNow();
  if (rest) {
    const spot = session.restSpot();
    return [{ x: spot.x, y: spot.y, h: groundY(spot.x, spot.y) + 3, who: null, thing: 'mat', key: session.restLine(), main: true, rest: true }];
  }
  const list = gift ? [{ npc: gift }] : liveTargets(stepGoal, flags, { raidOf, raids: data.raids?.raids ?? {}, minutes: state.clock.minutes });
  const here = persons();
  // A person of the quest away from the live chunks: the marker is at the place of the person on
  // the map (the arrow at the edge of the screen shows the way).
  const away = (kind, id) => {
    const item = (kind === 'npc' ? mapData.npcs : mapData.encounters).find((x) => x.id === id);
    if (item) out.push({ x: item.x, y: item.y, h: groundY(item.x, item.y) + 3 });
  };
  for (const [i, tg] of list.entries()) {
    // The face and the line of the star, and the bigger star of the next step (#62).
    const face = starOf(tg, i, data.trials?.trials ?? [], { raids: data.raids, raidOf });
    const from = out.length;
    // The farmer of the hamlet who takes the rest of the share, by the mats (#151).
    const taker = tg.npc ? here.find((x) => x.kind === 'rest' && x.ref === tg.npc) : null;
    if (taker) {
      const top = figureTop(taker.entity);
      if (top !== null) out.push({ x: taker.x, y: taker.y, h: top });
      continue;
    }
    for (const kind of ['npc', 'encounter']) {
      if (!tg[kind]) continue;
      // The star of a raid is on the place where the child stands (the wall, the crossroads), and
      // the enemies are in the field (#150: "a man in a black helmet with a gold star!").
      const wall = kind === 'encounter' ? data.raids?.raids?.[raidOf(tg[kind])]?.wall : null;
      if (wall) {
        out.push({ x: wall[0], y: wall[1], h: groundY(wall[0], wall[1]) + 3 });
        continue;
      }
      const p = here.find((x) => x.kind === kind && x.ref === tg[kind]);
      const top = p ? figureTop(p.entity) : null;
      if (top !== null) out.push({ x: p.x, y: p.y, h: top });
      else if (!p) away(kind, tg[kind]);
    }
    // The place of a trial that is open (the bamboo clump of the staffs, #56): after the talk
    // that opens it, the star is on the work, not on the person.
    if (tg.trial) {
      const z = getEntity(state, `zone:trial-${tg.trial}`);
      if (z && !z.zone.done) out.push({ x: z.position.x / 2, y: z.position.z / 2, h: groundY(z.position.x / 2, z.position.z / 2) + 3, work: true });
    }
    if (tg.object) {
      const o = mapData.layers.objects.find((x) => x.id === tg.object);
      if (o) out.push({ x: o.x + o.w / 2, y: o.y + o.h / 2, h: (objectTop(tg.object, o) ?? groundY(o.x, o.y) + 2) + 0.8 });
    }
    for (let k = from; k < out.length; k++) Object.assign(out[k], face);
  }
  if (!gift && stepGoal.place && (stepGoal.place.map ?? mapData.id) === mapData.id) out.push({ ...placeMark(stepGoal.place), h: groundY(stepGoal.place.x, stepGoal.place.y) + 3 });
  // A place that the hero did not find yet (Trâu Sơn, #27): the mark shows only the way.
  if (!data.clues || !data.world?.at) return out;
  const h = hero().position;
  // Before the find, the star is at the next person of the way, then at the end of the road (#142).
  const spotOf = (id) => {
    const e = getEntity(state, `way:${id}`);
    return e ? { x: e.position.x / 2, y: e.position.z / 2 } : null;
  };
  return out.map((m) => questMark(data.clues, data.world.at, flags, m, { x: h.x / 2, y: h.z / 2 }, spotOf));
}
