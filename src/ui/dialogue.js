// The dialogue box. It shows one line at a time, with the portrait (with the mood of the line) and the name
// of the speaker, the voice, and the choices.
import { createDialogue } from '../core/dialogue.js';
import { applyEffects, conditionState } from '../core/game.js';
import { h, img, button } from './dom.js';
import { t, tg, regionalWords } from './i18n.js';
import { speak, stop } from './speak.js';
import { voiceOf } from '../core/voices.js';
import { personName, wayOf } from '../core/naming.js';
import { newGlosses } from '../core/speech.js';
import { capitalize } from '../core/i18n.js';

// The data for the voice of a speaker.
function voiceData(ctx) {
  return { npcs: ctx.data.npcs.npcs, friends: ctx.data.friends.friends, voices: ctx.data.game.voices };
}

// True while the player selects text: then a tap does not go to the next line.
function selecting() {
  return String(window.getSelection?.() ?? '').length > 0;
}
import { portraitCanvas, speakerLookOf } from './portraits.js';

// The portrait of a speaker: the rendered figure of its look (src/ui/portraits.js), with a mood
// (calm, happy, worried, surprised). Null for the narrator.
export function portrait(ctx, speaker, mood = 'calm') {
  const look = speakerLookOf(ctx, speaker);
  if (!look) return null;
  return h('div', { class: 'portrait' }, [portraitCanvas(ctx, look, { framing: 'bust', mood: mood ?? 'calm', size: 96 })]);
}

// The small gloss under a line of a person, the first time that the child meets a word of a region
// ("mô = đâu", #39): one time for each word (profile.seenGloss). Null when there is none.
export function glossLine(ctx, textKey) {
  const fresh = newGlosses(regionalWords(textKey), (ctx.profile.seenGloss ??= []));
  return fresh.length ? fresh.map((g) => t('speech.gloss', { local: g.local, word: g.word })).join(' · ') : null;
}

export function speakerName(ctx, speaker) {
  if (!speaker || speaker === 'narrator') return '';
  if (speaker === 'hero') return ctx.profile.hero.name;
  // A friend with a name that the player chose.
  if (ctx.profile.friendNames?.[speaker]) return ctx.profile.friendNames[speaker];
  // A person of a village: a word of kinship and the order of birth, by the way of naming of the
  // region of the map (src/core/naming.js, #38).
  const npc = ctx.data?.npcs?.npcs?.[speaker];
  if (npc?.kin && ctx.data.naming) {
    const region = ctx.activeVillage?.session?.map?.region ?? ctx.data.regions?.start?.region;
    const name = personName(npc, wayOf(ctx.data.regions, region), ctx.data.naming);
    if (name) return capitalize(t(name.key, name.params));
  }
  return t(`npc.${speaker}.name`);
}

// A dialogue box that shows the lines that come from elsewhere (the session of the village, or
// runDialogue). line: { speaker, textKey, params, choices (text keys), mark }. next(): the child
// goes on; choose(i): the child picks a choice.
export function createDialogueBox(ctx, { next, choose }) {
  const layer = h('div', { class: 'dialogue-layer' });
  const box = h('div', { class: 'dialogue', role: 'dialog', 'aria-live': 'polite' });
  layer.append(box);
  ctx.ui.append(layer);
  const openedAt = performance.now();
  // The tap that opened the box can also send a click to the box. Ignore that click.
  const early = () => performance.now() - openedAt < 400;

  function show(line) {
    box.replaceChildren();
    const params = { ...ctx.textParams(), ...(line.params ?? {}) };
    const text = tg(line.textKey, params);
    const narrator = !line.speaker || line.speaker === 'narrator';
    const voice = voiceOf(line.speaker, voiceData(ctx), ctx.profile);
    if (line.mark) box.append(h('div', { class: `mark mark-${line.mark}`, text: t(`mark.${line.mark}`) }));
    const face = portrait(ctx, line.speaker, line.mood);
    if (face) box.append(face);
    const gloss = narrator ? null : glossLine(ctx, line.textKey);
    const body = h('div', { class: 'dialogue-body' }, [
      narrator ? null : h('div', { class: 'speaker', text: speakerName(ctx, line.speaker) }),
      h('p', { class: narrator ? 'line narrator' : 'line', text }),
      gloss ? h('p', { class: 'speech-gloss', text: gloss }) : null,
    ]);
    box.append(body);
    const tools = h('div', { class: 'dialogue-tools' }, [
      button(null, () => speak(line.textKey, params, { force: true, voice }), { cls: 'icon-btn', icon: 'ui/speak', aria: t('ui.listen') }),
    ]);
    box.append(tools);
    const choices = line.choices ?? [];
    if (choices.length) {
      box.onclick = null;
      const list = h('div', { class: 'choices' });
      choices.forEach((key, i) => list.append(button(tg(key, params), () => choose(i), { cls: 'btn choice' })));
      body.append(list);
    } else {
      tools.append(button(null, () => { if (!early()) next(); }, { cls: 'icon-btn next', icon: 'ui/back', aria: t('ui.next') }));
      box.onclick = (e) => {
        if (e.target.closest('button') || early() || selecting()) return;
        next();
      };
    }
    speak(line.textKey, params, { voice });
  }

  function close() {
    stop();
    layer.remove();
  }

  return { show, close };
}

// Show a dialogue. Return the list of commands ("open ...") from its effects.
export function runDialogue(ctx, id) {
  const def = ctx.data.dialogues.get(id);
  if (!def) {
    console.warn(`Unknown dialogue ${id}`);
    return Promise.resolve([]);
  }
  const runner = createDialogue(def, conditionState(ctx.profile));
  const commands = [];

  return new Promise((resolve) => {
    const apply = () => {
      const { commands: cmds, changes } = applyEffects(ctx.profile, runner.takeEffects(), { maxParty: ctx.data.game.party.max });
      for (const c of cmds) {
        if (c.sound) ctx.bus.emit('sound', c.sound);
        if (c.open) commands.push(c);
      }
      if (changes.flags.length || Object.keys(changes.items).length || changes.friends.length) ctx.save('dialogue');
    };
    let box = null;
    const show = (view) => {
      apply();
      if (!view) {
        box?.close();
        resolve(commands);
        return;
      }
      box ??= createDialogueBox(ctx, { next: () => show(runner.next()), choose: (i) => show(runner.next(i)) });
      box.show({ speaker: view.speaker, textKey: view.textKey, choices: view.choices.map((c) => c.textKey), mark: runner.mark });
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
