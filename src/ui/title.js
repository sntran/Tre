// The title screen: the bamboo grows one section for each era that the player completes.
import { h, img, button } from './dom.js';
import { t, lang } from './i18n.js';
import { listProfiles } from './storage.js';
import { heroLayers } from '../render/assets.js';
import { speak } from './speak.js';

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
    for (const p of good) {
      const card = h('button', { class: 'profile-card', type: 'button' }, [
        h('span', { class: 'mini-portrait' }, heroLayers(p.hero).map((l) => img(l, 'layer'))),
        h('span', { text: t('title.play', { name: p.name }) }),
      ]);
      card.addEventListener('click', () => ctx.playProfile(p.id));
      list.append(card);
    }
    text.append(list);
  }
  // One profile in this first version. Several profiles come later.
  if (good.length < ctx.data.game.maxProfiles) {
    text.append(button(t('title.new'), () => ctx.go('create'), { cls: good.length ? 'btn' : 'btn big red' }));
  }
  text.append(langSwitch);

  wrap.append(bambooStack(bambooSections(latest)), text);
  screen.append(wrap);
  screen.append(h('div', { class: 'corner' }, [
    button(null, () => ctx.openParent(), { cls: 'icon-btn', icon: 'ui/lock', aria: t('ui.parents') }),
  ]));
  ctx.ui.append(screen);
  return { unmount() { screen.remove(); } };
}
