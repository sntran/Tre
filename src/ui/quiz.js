// A sequence of questions with feedback after mistakes: first a hint,
// then a worked example, then a similar problem. It has no health loss.
// Trials, practice, lessons, and the rice counting use it.
import { h, img, button, wait } from './dom.js';
import { t, tg } from './i18n.js';
import { speak } from './speak.js';
import { renderQuestion, feedbackLine, textOf, answerText } from './question.js';
import { portrait } from './dialogue.js';
import { checkAnswer } from '../core/solver.js';
import { feedbackFor } from '../core/learner.js';

// opts: { title, speaker, count (null = no end), next(): problem, similar(problem): problem,
//         record: true, header: element, onEach(result) }
// Return a Promise of { correct, total, stopped }.
export function runQuiz(ctx, opts) {
  return new Promise((resolve) => {
    const layer = h('div', { class: 'modal-layer' });
    const panel = h('div', { class: 'panel quiz' });
    const progress = h('span', { style: { width: '0%' } });
    const counter = h('div', { class: 'muted' });
    const head = h('div', { class: 'panel-head' }, [
      h('h2', { text: opts.title }),
      opts.count === null ? button(t('quiz.stop'), () => finish(true), { cls: 'btn small paper' }) : null,
    ]);
    const top = h('div', { class: 'quiz-top' }, [
      opts.speaker ? portrait(ctx, opts.speaker) : null,
      h('div', { class: 'quiz-progress' }, [counter, opts.count ? h('div', { class: 'progress-bar' }, [progress]) : null, opts.header ?? null]),
    ]);
    const slot = h('div');
    const feedback = feedbackLine();
    panel.append(head, top, slot, feedback.el);
    layer.append(panel);
    ctx.ui.append(layer);

    let correct = 0;
    let asked = 0;
    let current = null;
    let problem = null;
    let mistakes = 0;
    let recorded = false;

    function show(p) {
      problem = p;
      // The current problem, for automatic tests of the whole game.
      ctx.activeProblem = p;
      mistakes = 0;
      recorded = false;
      feedback.clear();
      current?.destroy();
      current = renderQuestion(problem, { onAnswer });
      slot.replaceChildren(current.el);
      counter.textContent = opts.count ? t('quiz.of', { n: asked + 1, total: opts.count }) : t('practice.count', { correct });
      if (opts.count) progress.style.width = `${(asked / opts.count) * 100}%`;
    }

    function record(ok) {
      if (recorded || opts.record === false) return;
      recorded = true;
      const change = ctx.learner.record(problem, ok);
      ctx.profile.stats[ok ? 'correct' : 'mistakes'] += 1;
      opts.onEach?.({ problem, ok, change });
    }

    async function onAnswer(response, btn) {
      const ok = checkAnswer(problem, response);
      if (ok) {
        record(true);
        current.lock();
        if (mistakes === 0) correct += 1;
        asked += 1;
        ctx.bus.emit('sound', 'correct');
        btn?.classList.add('pop');
        const praise = `praise.${1 + Math.floor(Math.random() * 5)}`;
        feedback.show('good', t(praise), { key: praise });
        await wait(1100);
        next();
        return;
      }
      record(false);
      mistakes += 1;
      ctx.bus.emit('sound', 'wrong');
      current.el.classList.add('shake');
      setTimeout(() => current?.el.classList.remove('shake'), 350);
      const step = feedbackFor(mistakes, ctx.data.learning.feedback);
      if (step === 'hint') {
        feedback.show('hint', textOf(problem.hint), problem.hint.key ? problem.hint : null);
        current.unlock();
      } else if (step === 'example' && problem.example) {
        feedback.show('example', textOf(problem.example), problem.example.key ? problem.example : null);
        current.unlock();
      } else if (step === 'example') {
        feedback.show('hint', textOf(problem.hint));
        current.unlock();
      } else {
        // Show the answer, then give a similar problem.
        current.lock();
        const answer = answerText(problem);
        feedback.show('example', t('quiz.answer.is', { answer }), { key: 'quiz.answer.is', params: { answer } });
        asked += 1;
        await wait(2600);
        if (opts.count && asked >= opts.count) {
          finish(false);
          return;
        }
        asked -= 1;
        show(opts.similar ? opts.similar(problem) : opts.next());
      }
    }

    function next() {
      if (opts.count && asked >= opts.count) {
        finish(false);
        return;
      }
      show(opts.next());
    }

    function finish(stopped) {
      current?.destroy();
      layer.remove();
      ctx.save('quiz');
      resolve({ correct, total: asked, stopped });
    }

    show(opts.next());
  });
}

// A short panel that shows a message, an optional picture, and rewards.
export function showMessage(ctx, { title, textKey, params = {}, art = null, rewards = null, speaker = null }) {
  return new Promise((resolve) => {
    const layer = h('div', { class: 'modal-layer' });
    const close = () => { layer.remove(); resolve(); };
    const body = h('div', { class: 'col center', style: { alignItems: 'center' } }, [
      speaker ? portrait(ctx, speaker) : null,
      art ? img(art, '', '') : null,
      h('p', { class: 'prompt', text: tg(textKey, params) }),
      rewards && Object.keys(rewards).length ? h('div', { class: 'col', style: { alignItems: 'center' } }, [
        h('p', { text: t('trial.reward') }),
        h('div', { class: 'reward' }, Object.entries(rewards).map(([item, n]) => h('span', { class: 'count' }, [
          img(ctx.data.items.items[item]?.art ?? 'ui/star', 'count-icon'), h('span', { text: `+${n}` }),
        ]))),
      ]) : null,
      button(t('ui.ok'), close, { cls: 'btn big red' }),
    ]);
    if (art) body.querySelector('img:not(.layer)')?.setAttribute('style', 'width:min(30vmin,160px)');
    const panel = h('div', { class: 'panel', style: { width: 'min(640px, 100%)' } }, [
      title ? h('div', { class: 'panel-head' }, [h('h2', { text: title })]) : null,
      body,
    ]);
    layer.append(panel);
    ctx.ui.append(layer);
    speak(textKey, params);
  });
}
