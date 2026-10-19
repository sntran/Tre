// One question on the screen: the prompt, a picture, and the answer input
// (a number pad or choice buttons).
import { h, img, button } from './dom.js';
import { t, tg, lang, otherLang } from './i18n.js';
import { speak, speakText, stop } from './speak.js';
import { otherOnce, otherLineOn } from './dialogue.js';
import { renderVisual, shapeSvg } from './visuals.js';
import { formatNumber } from '../core/i18n.js';

// The text of a problem prompt, hint, or example.
export function textOf(part, extra = {}) {
  if (!part) return '';
  if (part.text) return part.text;
  return tg(part.key, { ...part.params, ...extra });
}

export function speakPart(part, force = false, onEnd = null) {
  if (!part) return onEnd?.();
  if (part.key) speak(part.key, part.params, { force, onEnd });
  else if (part.text) speakText(part.text, lang(), { force, onEnd });
  else onEnd?.();
}

// The text of the correct answer.
export function answerText(problem) {
  if (problem.kind === 'choice') return choiceText(problem.choices[problem.answer]);
  return formatNumber(problem.answer, lang());
}

export function choiceText(c) {
  if (!c) return '';
  if (c.value !== undefined) return formatNumber(c.value, lang());
  if (c.fraction) return `${c.fraction[0]}/${c.fraction[1]}`;
  if (c.shape) return t(`shape.${c.shape}`);
  if (c.label) return textOf(c.label);
  return '';
}

// Show a problem. onAnswer(response) gets a number (as text) or a choice index. ctx: with it, the
// button of the other language shows by the prompt, as in a talk (#112).
export function renderQuestion(problem, { onAnswer, autoSpeak = true, ctx = null } = {}) {
  // A button under the question must not keep the keyboard focus.
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  const el = h('div', { class: 'question' });
  const promptText = textOf(problem.prompt);
  const promptEl = h('p', { class: 'prompt', text: promptText });
  const other = ctx && problem.prompt?.key && otherLineOn(ctx) ? button(otherLang().toUpperCase(), () => otherOnce(ctx, promptEl, problem.prompt.key, problem.prompt.params), { cls: 'icon-btn other-lang', aria: t('ui.otherLine') }) : null;
  const promptRow = h('div', { class: 'prompt-row' }, [
    promptEl,
    button(null, () => readAll(true), { cls: 'icon-btn', icon: 'ui/speak', aria: t('ui.listen') }),
    other,
  ]);
  el.append(promptRow);
  const visual = renderVisual(problem.visual);
  if (visual) el.append(h('div', { class: 'visual' }, [visual]));
  let locked = false;
  let cleanup = () => {};

  // The prompt, and then each answer in turn while its button glows (#112: the answers were said
  // only after the choice, and a child who reads slowly chose by the shape of the text). A new
  // reading, or a choice, stops the last one.
  let reading = 0;
  let buttons = [];
  const glow = (i) => buttons.forEach((b, k) => b.classList.toggle('reading', k === i));
  function readAll(force) {
    const token = ++reading;
    const sayChoice = (i) => {
      if (token !== reading || locked || !el.isConnected || i >= buttons.length) return glow(-1);
      glow(i);
      speakText(choiceText(problem.choices[i]), lang(), { queue: true, force, onEnd: () => setTimeout(() => sayChoice(i + 1), 200) });
    };
    speakPart(problem.prompt, force, problem.kind === 'choice' ? () => sayChoice(0) : null);
  }

  if (problem.kind === 'choice') {
    const grid = h('div', { class: 'choice-grid' });
    problem.choices.forEach((c, i) => {
      const cls = c.shape ? 'btn shape' : 'btn';
      const b = h('button', { class: cls, type: 'button', 'aria-label': choiceText(c) });
      if (c.shape) b.append(shapeSvg(c.shape));
      else b.append(h('span', { text: choiceText(c) }));
      b.addEventListener('click', () => {
        if (locked) return;
        // Say the answer that the player chose. The feedback comes after it.
        reading += 1;
        glow(-1);
        stop();
        speakText(choiceText(c));
        onAnswer(i, b);
      });
      grid.append(b);
      buttons.push(b);
    });
    el.append(grid);
  } else {
    let value = '';
    const box = h('div', { class: 'answer-box', 'aria-live': 'polite', text: '?' });
    const update = () => { box.textContent = value === '' ? '?' : value; };
    const press = (k) => {
      if (locked) return;
      if (k === 'del') value = value.slice(0, -1);
      else if (k === 'ok') {
        if (value !== '') {
          speakText(value);
          onAnswer(value);
        }
        return;
      } else if (k === 'point') {
        if (!value.includes(t('quiz.point'))) value = (value || '0') + t('quiz.point');
      } else if (value.length < 7) value = value === '0' ? k : value + k;
      update();
    };
    const pad = h('div', { class: 'numpad' });
    const keys = ['7', '8', '9', 'ok', '4', '5', '6', '1', '2', '3', 'del', problem.decimals ? 'point' : null, '0'];
    for (const k of keys) {
      if (k === null) {
        pad.append(h('span'));
        continue;
      }
      if (k === 'ok') pad.append(button(null, () => press('ok'), { cls: 'btn ok', icon: 'ui/check', aria: t('quiz.ok') }));
      else if (k === 'del') pad.append(button(null, () => press('del'), { cls: 'btn paper', icon: 'ui/clear', aria: t('quiz.clear') }));
      else if (k === 'point') pad.append(button(t('quiz.point'), () => press('point'), { cls: 'btn paper' }));
      else pad.append(button(k, () => press(k), { cls: 'btn paper' }));
    }
    el.append(box, pad);
    // The keyboard of a laptop also works.
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      let handled = true;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Enter') press('ok');
      else if ((e.key === '.' || e.key === ',') && problem.decimals) press('point');
      else handled = false;
      // Stop the key from also pressing a button that has the focus.
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    cleanup = () => window.removeEventListener('keydown', onKey);
    el.clearValue = () => { value = ''; update(); };
  }

  if (autoSpeak) readAll(false);

  return {
    el,
    lock() { locked = true; },
    unlock() { locked = false; if (el.clearValue) el.clearValue(); },
    destroy() { reading += 1; cleanup(); el.remove(); },
  };
}

// The feedback line under a question.
export function feedbackLine() {
  const el = h('div', { class: 'feedback', 'aria-live': 'polite' });
  return {
    el,
    show(kind, text, speakKey = null) {
      el.className = `feedback ${kind}`;
      el.replaceChildren(img(kind === 'good' ? 'ui/star' : kind === 'example' ? 'ui/quest' : 'ui/hint'), h('span', { text }));
      // The feedback waits for the voice (for example the answer that the player chose).
      if (speakKey) speak(speakKey.key, speakKey.params, { queue: true });
    },
    clear() {
      el.className = 'feedback';
      el.replaceChildren();
    },
  };
}
