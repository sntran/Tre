// The country map on dó paper: the 13 regions of the story. A region that is not open yet
// has a red seal. The hero can travel to an open region; the travel takes game hours and has
// a few road events.
import { registerModal } from './registry.js';
import { h, img, button } from './dom.js';
import { t } from './i18n.js';
import { speak } from './speak.js';
import { say } from './dialogue.js';
import { conditionState } from '../core/game.js';
import { createRng } from '../core/rng.js';
import { heroLayers } from '../render/assets.js';
import { planTravel, applyTravel } from '../world/travel.js';
import { timeOfDay } from '../world/clock.js';

const VIEW = { w: 600, h: 1000 }; // the viewBox of art/world/country.svg

let svgText = null;
async function countrySvg() {
  if (!svgText) {
    const r = await fetch('art/world/country.svg');
    svgText = r.ok ? await r.text() : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 1000"></svg>';
  }
  return svgText;
}

registerModal('worldmap', async (ctx) => {
  const { data, profile } = ctx;
  const world = data.world;
  const state = conditionState(profile);
  const here = world.regionOf(profile.place?.map) ?? world.start.region;
  const time = timeOfDay(profile.clock ?? { minutes: 0 });

  let chosen = null;
  const plan = await new Promise((resolve) => {
    const layer = h('div', { class: 'modal-layer' });
    const close = (value = null) => {
      layer.remove();
      window.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);

    const map = h('div', { class: 'country' });
    const info = h('div', { class: 'region-info' });
    const panel = h('div', { class: 'panel worldmap' }, [
      h('div', { class: 'panel-head' }, [
        h('h2', { text: t('ui.worldmap') }),
        h('span', { class: 'world-time', text: t('world.time', { day: time.day, part: t(`time.${time.part}`) }) }),
        button(null, () => close(), { cls: 'icon-btn', icon: 'ui/close', aria: t('ui.close') }),
      ]),
      h('div', { class: 'worldmap-body' }, [map, info]),
    ]);
    layer.append(panel);
    layer.addEventListener('click', (e) => { if (e.target === layer) close(); });
    ctx.ui.append(layer);

    const seals = new Map();
    function select(region) {
      chosen = region;
      for (const [id, el] of seals) el.classList.toggle('selected', id === region.id);
      map.querySelectorAll('path[id^="region-"]').forEach((p) => p.classList.toggle('selected', p.id === `region-${region.chapter}`));
      const open = world.isOpen(region.id, state);
      const lines = [
        h('div', { class: 'region-chapter', text: t('world.chapter', { n: region.chapter }) }),
        h('h3', { text: t(region.nameKey) }),
      ];
      let noteKey;
      if (region.id === here) noteKey = 'world.here';
      else if (!open) noteKey = 'world.locked';
      lines.push(noteKey ? h('p', { text: t(noteKey) }) : null);
      if (open && region.id !== here) {
        const hours = world.travelHours(here, region.id);
        lines.push(button(t('world.travel', { hours }), () => {
          const rng = createRng(`${profile.seed}:${Math.round(profile.clock.minutes)}:${region.id}`);
          const p = planTravel(world, here, region.id, state, rng, data.roadEvents.events);
          if (p.ok) close(p);
        }, { cls: 'btn big red' }));
      }
      info.replaceChildren(...lines.filter(Boolean));
      speak(region.nameKey);
    }

    countrySvg().then((text) => {
      map.innerHTML = text;
      for (const region of world.regions) {
        const open = world.isOpen(region.id, state);
        const path = map.querySelector(`#region-${region.chapter}`);
        path?.classList.add(open ? 'open' : 'locked');
        path?.addEventListener('click', () => select(region));
        if (!region.seal) continue;
        const kind = region.id === here ? 'here' : open ? 'open' : 'locked';
        const content = kind === 'here'
          ? h('span', { class: 'mini-portrait' }, heroLayers(profile.hero).map((p) => img(p, 'layer')))
          : kind === 'locked' ? img('ui/lock', 'seal-icon') : h('span', { class: 'seal-num', text: String(region.chapter) });
        const el = h('button', {
          class: `seal ${kind}`,
          type: 'button',
          'aria-label': `${t(region.nameKey)}. ${t('world.chapter', { n: region.chapter })}`,
          style: { left: `${(region.seal[0] / VIEW.w) * 100}%`, top: `${(region.seal[1] / VIEW.h) * 100}%` },
        }, [content]);
        el.addEventListener('click', () => select(region));
        seals.set(region.id, el);
        map.append(el);
      }
      select(world.region(here));
    });
  });

  if (!plan) return;
  // The travel: the road events, one after the other, then the arrival.
  for (const e of plan.events) await say(ctx, e.textKey);
  applyTravel(profile, plan);
  await ctx.save('travel');
  await say(ctx, 'world.arrive', { hours: plan.hours });
  await ctx.go('village', { map: plan.entry.map, at: { x: plan.entry.x, y: plan.entry.y }, arrive: true });
});
