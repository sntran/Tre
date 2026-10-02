// The title screen: the bamboo grows one section for each era that the player completes.
import { h, img, button } from './dom.js';
import { t, lang } from './i18n.js';
import { listProfiles } from './storage.js';
import { portraitCanvas, heroLookOf } from './portraits.js';
import { speak } from './speak.js';
import { newAdventure } from '../core/restore.js';

const LONG_PRESS = 600; // milliseconds: a long press on a profile card opens its sheet

export function bambooStack(sections) {
  const box = h('div', { class: 'bamboo-grow', 'aria-hidden': 'true' });
  if (sections <= 0) {
    box.append(img('title/bamboo-shoot', 'shoot'));
    return box;
  }
  box.append(img('title/bamboo-top'));
  for (let i = 0; i < sections; i++) box.append(img('title/bamboo-section'));
  box.append(img('title/bamboo-shoot', 'shoot'));
  return box;
}

// The number of bamboo sections: one for each era with "văn võ song toàn".
export function bambooSections(profile) {
  return Object.keys(profile?.flags ?? {}).filter((f) => /^vvst\.era\d+$/.test(f)).length;
}

// A card of a profile: the hero, the name, and where the child is (the era and the bamboo). A tap
// plays; a long press opens a small sheet (rename, export, delete), each behind the parent gate.
function profileCard(ctx, p) {
  const sections = bambooSections(p.profile);
  const card = h('button', { class: 'profile-card', type: 'button' }, [
    h('span', { class: 'mini-portrait' }, [portraitCanvas(ctx, heroLookOf(ctx, p.hero), { size: 56 })]),
    h('span', { class: 'profile-text' }, [
      h('span', { text: t('title.play', { name: p.name }) }),
      h('span', { class: 'profile-where' }, [
        h('span', { class: 'mini-bamboo', 'aria-hidden': 'true' }, Array.from({ length: sections + 1 }, (_, i) => h('i', { class: i === sections ? 'shoot' : '' }))),
        h('span', { text: t(ctx.data.world.eraOf(p.profile.world?.map)) }),
      ]),
    ]),
  ]);
  let timer = 0;
  let long = false;
  card.addEventListener('pointerdown', () => {
    long = false;
    timer = setTimeout(() => { long = true; openSheet(ctx, p); }, LONG_PRESS);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) card.addEventListener(type, () => clearTimeout(timer));
  card.addEventListener('contextmenu', (e) => e.preventDefault());
  card.addEventListener('click', () => { if (!long) ctx.playProfile(p.id); });
  return card;
}

// The sheet of a profile card. Each action is behind the parent gate.
function openSheet(ctx, p) {
  const layer = h('div', { class: 'modal-layer' });
  const close = () => layer.remove();
  const act = (action) => { close(); ctx.openParent({ tab: 'games', profile: p.id, action }); };
  layer.append(h('div', { class: 'panel sheet', style: { width: 'min(420px, 100%)' } }, [
    h('div', { class: 'panel-head' }, [h('h2', { text: p.name }), button(null, close, { cls: 'icon-btn', icon: 'ui/close', aria: t('ui.close') })]),
    h('div', { class: 'menu-list' }, [
      button(t('title.sheet.rename'), () => act('rename'), { cls: 'btn paper', icon: 'ui/lock' }),
      button(t('title.sheet.export'), () => act('export'), { cls: 'btn paper', icon: 'ui/lock' }),
      button(t('title.sheet.delete'), () => act('delete'), { cls: 'btn paper', icon: 'ui/lock' }),
    ]),
  ]));
  layer.addEventListener('click', (e) => { if (e.target === layer) close(); });
  ctx.ui.append(layer);
}

export async function mountTitle(ctx) {
  const profiles = await listProfiles();
  const good = profiles.filter((p) => !p.damaged);
  const latest = good[0]?.profile ?? null;
  const screen = h('div', { class: 'screen title-screen' });
  const wrap = h('div', { class: 'title-wrap' });
  const text = h('div', { class: 'title-text' });

  const langSwitch = h('div', { class: 'lang-switch' }, ['vi', 'en'].map((code) => {
    const b = button(t(`lang.${code}`), async () => {
      await ctx.setLanguage(code);
      ctx.go('title');
    }, { cls: 'btn small paper' });
    b.setAttribute('aria-pressed', String(lang() === code));
    return b;
  }));

  // One picture only: the bamboo, which grows with the progress of the player.
  // The seal logo is the icon of the app.
  text.append(
    h('h1', { class: 'game-name', text: t('app.name') }),
    h('p', { class: 'tagline', text: t('app.tagline') }),
  );
  text.querySelector('.tagline').addEventListener('click', () => speak('app.tagline', null, { force: true }));

  if (good.length) {
    const list = h('div', { class: 'profiles' });
    for (const p of good) list.append(profileCard(ctx, p));
    text.append(list);
  }
  // A new adventure is always there. With the profiles full, one line says so, and the parent gate
  // opens: a parent can remove one there.
  const fresh = newAdventure(good.length, ctx.data.game.maxProfiles);
  const line = h('p', { class: 'title-full', hidden: true, text: t('title.full', { max: ctx.data.game.maxProfiles }) });
  text.append(button(t('title.new'), () => {
    if (!fresh.full) {
      ctx.go('create');
      return;
    }
    line.hidden = false;
    ctx.openParent({ tab: 'games' });
  }, { cls: good.length ? 'btn' : 'btn big red' }), line);
  text.append(langSwitch);

  wrap.append(bambooStack(bambooSections(latest)), text);
  screen.append(wrap);
  screen.append(h('div', { class: 'corner' }, [
    button(null, () => ctx.openParent(), { cls: 'icon-btn', icon: 'ui/lock', aria: t('ui.parents') }),
  ]));
  ctx.ui.append(screen);
  return { unmount() { screen.remove(); } };
}
