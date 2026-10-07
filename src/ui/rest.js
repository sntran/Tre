// The time limit: count the play time, warn a few minutes before the end,
// and send the hero home to rest at a calm point. Never in a raid.
import { addPlayTime, timeStatus } from '../core/timelimit.js';
import { registerScene } from './registry.js';
import { h, img, button } from './dom.js';
import { t, tg } from './i18n.js';
import { speak } from './speak.js';
import { portrait } from './dialogue.js';

const PLAY_SCENES = new Set(['village', 'vanmieu']);

export function isTimeOver(ctx) {
  const p = ctx.profile;
  return Boolean(p) && timeStatus(p.time, p.settings.timeLimit, ctx.data.game.time.warnBeforeMin, Date.now()) === 'over';
}

// A calm point. The session of the village finds its own calm point (no screen open, the hands
// empty, not on the bridge) and opens the rest; this is only for a village with no world (a
// device with no WebGL).
function calm(ctx) {
  return ctx.scene === 'village' && !ctx.activeVillage && !ctx.ui.querySelector('.modal-layer, .dialogue-layer');
}

const SAVE_TICKS = 6; // ticks of 5 seconds

export function startTimer(ctx) {
  let last = Date.now();
  let warned = false;
  let ticks = 0;
  setInterval(() => {
    const now = Date.now();
    const delta = now - last;
    last = now;
    const p = ctx.profile;
    if (!p || document.visibilityState !== 'visible' || !PLAY_SCENES.has(ctx.scene)) return;
    // A save each half minute of play: the end of the session in the learning log moves with it,
    // so that a page that goes away loses at most half a minute of the visit (#52).
    ticks += 1;
    if (ticks % SAVE_TICKS === 0) ctx.save('tick');
    // The session of the village counts the time of play in its steps.
    if (!(ctx.scene === 'village' && ctx.activeVillage)) addPlayTime(p.time, now, delta);
    const status = timeStatus(p.time, p.settings.timeLimit, ctx.data.game.time.warnBeforeMin, now);
    if (status === 'ok') warned = false;
    if (status === 'warn' && !warned) {
      warned = true;
      ctx.toast('time.warn', { n: ctx.data.game.time.warnBeforeMin });
      speak('time.warn', { n: ctx.data.game.time.warnBeforeMin });
    }
    if (status === 'over' && calm(ctx)) {
      ctx.save('time');
      ctx.go('rest');
    }
  }, 5000);
}

registerScene('rest', async (ctx) => {
  await ctx.save('rest');
  const screen = h('div', { class: 'screen' });
  const box = h('div', { class: 'vanmieu' }, [
    img('title/bamboo-shoot', 'vanmieu-gate'),
    h('div', { class: 'panel' }, [
      h('div', { class: 'row', style: { flexWrap: 'nowrap', alignItems: 'flex-end' } }, [
        portrait(ctx, 'grandma'),
        h('p', { class: 'prompt', style: { textAlign: 'left' }, text: tg('time.rest') }),
      ]),
    ]),
    button(t('ui.ok'), () => ctx.go('title'), { cls: 'btn big red' }),
  ]);
  screen.append(box, h('div', { class: 'corner' }, [
    button(null, () => ctx.openParent(), { cls: 'icon-btn', icon: 'ui/lock', aria: t('ui.parents') }),
  ]));
  ctx.ui.append(screen);
  speak('time.rest');
  return { unmount() { screen.remove(); } };
});
