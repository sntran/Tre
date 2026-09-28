// The dialogue box. It shows one line at a time, with the portrait and the name
// of the speaker, the voice, and the choices.
import { createDialogue } from '../core/dialogue.js';
import { applyEffects, conditionState } from '../core/game.js';
import { h, img, button } from './dom.js';
import { t, tg } from './i18n.js';
import { speak, stop } from './speak.js';
import { voiceOf } from '../core/voices.js';

// The data for the voice of a speaker.
function voiceData(ctx) {
  return { npcs: ctx.data.npcs.npcs, friends: ctx.data.friends.friends, voices: ctx.data.game.voices };
}

// True while the player selects text: then a tap does not go to the next line.
function selecting() {
  return String(window.getSelection?.() ?? '').length > 0;
}
import { heroLayers } from '../render/assets.js';

// The art of a speaker. "hero" uses the layers of the hero.
export function portrait(ctx, speaker) {
  const box = h('div', { class: 'portrait' });
  if (!speaker || speaker === 'narrator') return null;
  if (speaker === 'hero') {
    const hero = ctx.profile.hero;
    box.append(...heroLayers(hero).map((l) => img(l, 'layer')));
    return box;
  }
  const art = speakerArt(ctx, speaker);
  if (art) box.append(img(art, 'layer'));
  return box;
}

export function speakerArt(ctx, speaker) {
  if (speaker === 'giong') return ctx.profile.flags['giong.grown'] ? 'npc/giong-hero' : 'npc/giong-boy';
  const friend = ctx.data.friends.friends[speaker];
  if (friend) return friend.art;
  if (speaker === 'examiner') return 'npc/examiner';
  return ctx.data.npcs.npcs[speaker]?.art ?? null;
}

export function speakerName(ctx, speaker) {
  if (!speaker || speaker === 'narrator') return '';
  if (speaker === 'hero') return ctx.profile.hero.name;
  return t(`npc.${speaker}.name`);
}

// Show a dialogue. Return the list of commands ("open ...") from its effects.
export function runDialogue(ctx, id) {
  const def = ctx.data.dialogues.get(id);
  if (!def) {
    console.warn(`Unknown dialogue ${id}`);
    return Promise.resolve([]);
  }
  const state = conditionState(ctx.profile);
  const runner = createDialogue(def, state);
  const commands = [];

  return new Promise((resolve) => {
    const layer = h('div', { class: 'dialogue-layer' });
    const box = h('div', { class: 'dialogue', role: 'dialog', 'aria-live': 'polite' });
    // The tap that opened the box can also send a click to the box. Ignore that click.
    const openedAt = performance.now();
    const early = () => performance.now() - openedAt < 400;
    layer.append(box);
    ctx.ui.append(layer);

    const apply = () => {
      const { commands: cmds, changes } = applyEffects(ctx.profile, runner.takeEffects(), { maxParty: ctx.data.game.battle.maxParty });
      for (const c of cmds) {
        if (c.sound) ctx.bus.emit('sound', c.sound);
        if (c.open) commands.push(c);
      }
      if (changes.flags.length || Object.keys(changes.items).length || changes.friends.length) ctx.save('dialogue');
    };

    const finish = () => {
      stop();
      layer.remove();
      resolve(commands);
    };

    const show = (view) => {
      apply();
      if (!view) {
        finish();
        return;
      }
      box.replaceChildren();
      const params = ctx.textParams();
      const text = tg(view.textKey, params);
      const narrator = !view.speaker || view.speaker === 'narrator';
      if (runner.mark) box.append(h('div', { class: `mark mark-${runner.mark}`, text: t(`mark.${runner.mark}`) }));
      const face = portrait(ctx, view.speaker);
      if (face) box.append(face);
      const body = h('div', { class: 'dialogue-body' }, [
        narrator ? null : h('div', { class: 'speaker', text: speakerName(ctx, view.speaker) }),
        h('p', { class: narrator ? 'line narrator' : 'line', text }),
      ]);
      box.append(body);
      const tools = h('div', { class: 'dialogue-tools' }, [
        button(null, () => speak(view.textKey, params, { force: true, voice: voiceOf(view.speaker, voiceData(ctx), ctx.profile) }), { cls: 'icon-btn', icon: 'ui/speak', aria: t('ui.listen') }),
      ]);
      box.append(tools);
      if (view.choices.length) {
        const list = h('div', { class: 'choices' });
        view.choices.forEach((c, i) => {
          list.append(button(tg(c.textKey, params), () => show(runner.next(i)), { cls: 'btn choice' }));
        });
        body.append(list);
      } else {
        tools.append(button(null, () => { if (!early()) show(runner.next()); }, { cls: 'icon-btn next', icon: 'ui/back', aria: t('ui.next') }));
        box.onclick = (e) => {
          if (e.target.closest('button') || early() || selecting()) return;
          show(runner.next());
        };
      }
      speak(view.textKey, params, { voice: voiceOf(view.speaker, voiceData(ctx), ctx.profile) });
    };

    show(runner.view());
  });
}

// Show one line of text (for example from a map sign).
export function say(ctx, textKey, params = {}, speaker = 'narrator') {
  return new Promise((resolve) => {
    const layer = h('div', { class: 'dialogue-layer' });
    const box = h('div', { class: 'dialogue' });
    const all = { ...ctx.textParams(), ...params };
    const face = portrait(ctx, speaker);
    if (face) box.append(face);
    box.append(h('div', { class: 'dialogue-body' }, [
      speaker && speaker !== 'narrator' ? h('div', { class: 'speaker', text: speakerName(ctx, speaker) }) : null,
      h('p', { class: speaker === 'narrator' ? 'line narrator' : 'line', text: tg(textKey, all) }),
    ]));
    const openedAt = performance.now();
    const close = () => {
      // The tap that opened the box can also send a click to the box. Ignore that click.
      if (performance.now() - openedAt < 400) return;
      stop();
      layer.remove();
      resolve();
    };
    box.append(h('div', { class: 'dialogue-tools' }, [
      button(null, () => speak(textKey, all, { force: true, voice: voiceOf(speaker, voiceData(ctx), ctx.profile) }), { cls: 'icon-btn', icon: 'ui/speak', aria: t('ui.listen') }),
      button(null, close, { cls: 'icon-btn next', icon: 'ui/back', aria: t('ui.next') }),
    ]));
    box.onclick = (e) => { if (!e.target.closest('button') && !selecting()) close(); };
    layer.append(box);
    ctx.ui.append(layer);
    speak(textKey, all, { voice: voiceOf(speaker, voiceData(ctx), ctx.profile) });
  });
}
