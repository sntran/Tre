// The time limit: count the play time, warn a few minutes before the end,
// and send the hero home to rest at a calm point. Never in a battle.
import { addPlayTime, timeStatus } from '../core/timelimit.js';
import { registerScene } from './registry.js';
import { h, img, button } from './dom.js';
import { t, tg } from './i18n.js';
import { speak } from './speak.js';
import { portrait } from './dialogue.js';

const PLAY_SCENES = new Set(['village', 'battle', 'vanmieu']);

export function isTimeOver(ctx) {
  const p = ctx.profile;
  return Boolean(p) && timeStatus(p.time, p.settings.timeLimit, ctx.data.game.time.warnBeforeMin, Date.now()) === 'over';
}

// A calm point: the village with no open dialogue or panel.
function calm(ctx) {
  return ctx.scene === 'village' && !ctx.ui.querySelector('.modal-layer, .dialogue-layer');
}

export function startTimer(ctx) {
  let last = Date.now();
  let warned = false;
  setInterval(() => {
    const now = Date.now();
    const delta = now - last;
    last = now;
    const p = ctx.profile;
    if (!p || document.visibilityState !== 'visible' || !PLAY_SCENES.has(ctx.scene)) return;
    addPlayTime(p.time, now, delta);
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
  ctx.surface.canvas.hidden = true;
  await ctx.save('rest');
  const screen = h('div', { class: 'screen' });
  const box = h('div', { class: 'vanmieu' }, [
    img('map/house', 'vanmieu-gate'),
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
