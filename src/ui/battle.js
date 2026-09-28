// The battle scene: the canvas shows the side view, and the DOM shows the hearts,
// the note, and the panel for the answer (number cards, a question, or element magic).
import { createBattle } from '../core/battle.js';
import { createElementRules } from '../core/elements.js';
import { hasCards } from '../core/generators.js';
import { feedbackFor } from '../core/learner.js';
import { checkAnswer } from '../core/solver.js';
import { lossLevel, applyLoss, eraComplete, setFlag } from '../core/profile.js';
import { applyEffects } from '../core/game.js';
import { createBattleRenderer } from '../render/battle.js';
import { h, img, button, wait } from './dom.js';
import { t, tg, lang } from './i18n.js';
import { speak } from './speak.js';
import { renderCards } from './cards.js';
import { renderQuestion, feedbackLine, textOf, answerText } from './question.js';
import { runDialogue } from './dialogue.js';
import { showMessage } from './quiz.js';
import { registerScene, registerModal } from './registry.js';
import { formatNumber } from '../core/i18n.js';

// A filter for the math skills of battles. Players of grades 1 and 2 get Era 1 skills.
// Players of higher grades get problems at their own level.
export function battleSkillFilter(profile) {
  return (s) => s.subject === 'math' && (profile.grade <= 2 ? s.era === 1 : s.grade <= profile.grade);
}

function makeShieldFactory(ctx) {
  const { learner, graph, profile } = ctx;
  return (enemy, similarTo, { extraCards = 0 } = {}) => {
    if (similarTo) {
      return learner.problem(similarTo.skill, { level: similarTo.level, cards: similarTo.kind === 'cards', extraCards });
    }
    const id = learner.pickSkill({ filter: battleSkillFilter(profile) });
    const level = learner.levelFor(id);
    const skill = graph.get(id);
    return hasCards(skill, level) ? learner.problem(id, { level, cards: true, extraCards }) : learner.problem(id, { level });
  };
}

async function mountBattle(ctx, params) {
  const { data, profile, learner } = ctx;
  const def = data.battles.battles[params.id];
  const rules = createElementRules(data.elements);
  const friends = profile.party.map((id) => ({ id, ...data.friends.friends[id] })).filter((f) => f.art);
  const calling = data.callings.callings.find((c) => c.id === profile.calling) ?? null;
  const shieldBlocks = friends.filter((f) => f.help?.type === 'shield').reduce((a, f) => a + (f.help.amount ?? 1), 0);
  const battle = createBattle({
    def,
    enemyTypes: data.enemies.enemies,
    rules,
    config: data.game.battle,
    feedback: data.learning.feedback,
    party: { shieldBlocks, bonuses: calling?.bonus ?? {}, companion: def.companion ?? null },
    makeShield: makeShieldFactory(ctx),
    rng: ctx.rng,
  });
  const renderer = await createBattleRenderer({
    bg: def.bg,
    hero: profile.hero,
    friends,
    companion: def.companion ?? null,
    enemies: def.enemies.map((id) => data.enemies.enemies[id]),
  });
  const surface = ctx.surface;
  surface.canvas.hidden = false;
  let alive = true;
  let busy = false;

  // DOM
  const root = h('div', { class: 'battle-ui' });
  const hearts = h('div', { class: 'hearts', 'aria-live': 'polite' });
  const note = h('button', { class: 'battle-note', type: 'button' }, [
    def.mark ? h('strong', { class: 'note-mark', text: t(`mark.${def.mark}`) }) : null,
    h('span', { text: tg(def.noteKey) }),
  ]);
  note.addEventListener('click', () => speak(def.noteKey, null, { force: true }));
  const top = h('div', { class: 'battle-top' }, [hearts, note]);
  const panel = h('div', { class: 'battle-panel' });
  const feedback = feedbackLine();
  const bottom = h('div', { class: 'battle-bottom' }, [feedback.el, panel]);
  root.append(top, bottom);
  ctx.ui.append(root);
  let widget = null;

  function drawHearts() {
    const s = battle.state.hero;
    hearts.replaceChildren(...Array.from({ length: s.max }, (_, i) => img(i < s.health ? 'ui/heart' : 'ui/heart-empty')));
    hearts.setAttribute('aria-label', `${s.health}/${s.max}`);
  }

  function hintButton() {
    const n = battle.state.hints;
    return button(t('battle.hint', { n }), () => useHint(), { cls: 'btn small paper', icon: 'ui/hint', disabled: n <= 0 || busy });
  }

  function enemyName(e) {
    return t(e.type.nameKey);
  }

  // The panel for the current guard of the target.
  function renderPanel() {
    widget?.destroy?.();
    widget = null;
    panel.replaceChildren();
    if (battle.phase !== 'player') return;
    const enemy = battle.target;
    const guard = enemy.guard;
    if (guard.kind === 'element') {
      const text = t('battle.element', { name: enemyName(enemy), state: { key: `state.${guard.state}` } });
      panel.append(h('div', { class: 'prompt-row' }, [
        h('p', { class: 'prompt', text }),
        button(null, () => speak('battle.element', { name: enemyName(enemy), state: { key: `state.${guard.state}` } }, { force: true }), { cls: 'icon-btn', icon: 'ui/speak', aria: t('ui.listen') }),
      ]));
      const row = h('div', { class: 'battle-actions' });
      for (const el of rules.available) {
        row.append(button(t(`element.${el}`), () => act(() => battle.cast(el)), { cls: `btn big element-btn ${el}`, icon: `ui/${el}` }));
      }
      row.append(hintButton());
      panel.append(row);
      speak('battle.element', { name: enemyName(enemy), state: { key: `state.${guard.state}` } });
      return;
    }
    const problem = guard.problem;
    if (problem.kind === 'cards') {
      panel.append(h('div', { class: 'prompt-row' }, [
        h('p', { class: 'prompt', text: t('battle.shield', { target: problem.target }) }),
        button(null, () => speak('battle.shield', { target: problem.target }, { force: true }), { cls: 'icon-btn', icon: 'ui/speak', aria: t('ui.listen') }),
      ]));
      widget = renderCards(problem, { onSubmit: (moves) => act(() => battle.answer(moves)) });
      panel.append(widget.el, h('div', { class: 'battle-actions' }, [hintButton()]));
      speak('battle.shield', { target: problem.target });
    } else {
      widget = renderQuestion(problem, { onAnswer: (r) => act(() => battle.answer(r)) });
      panel.append(widget.el, h('div', { class: 'battle-actions' }, [hintButton()]));
    }
    ctx.activeProblem = problem;
  }

  function useHint() {
    const hint = battle.useHint();
    if (!hint) {
      feedback.show('hint', t('battle.hint.none'));
      return;
    }
    feedback.show('hint', hint.hint ? textOf(hint.hint) : t('hint.bank'), hint.hint?.key ? hint.hint : { key: 'hint.bank' });
    panel.querySelector('.battle-actions .btn.small')?.replaceWith(hintButton());
  }

  // Run an action of the player and show its events one after the other.
  async function act(fn) {
    if (busy) return;
    busy = true;
    widget?.lock?.();
    const result = fn();
    if (result.ignored) {
      busy = false;
      widget?.unlock?.();
      return;
    }
    await showEvents(result.events);
    busy = false;
    if (!alive) return;
    if (battle.phase === 'player') renderPanel();
  }

  async function showEvents(events) {
    for (const e of events) {
      if (!alive) return;
      switch (e.type) {
        case 'answer':
          if (e.first) {
            learner.record(e.problem, e.credit);
            profile.stats[e.ok ? 'correct' : 'mistakes'] += 1;
          }
          break;
        case 'cast':
          renderer.add({ kind: 'cast', dur: 0.4 });
          renderer.add({ kind: 'projectile', sprite: e.element === 'lightning' ? 'spark' : e.element, enemy: e.enemy, dur: 0.45 });
          ctx.bus.emit('sound', e.element);
          await wait(450);
          if (e.effect === 'steam') {
            renderer.add({ kind: 'steamPuff', enemy: e.enemy, dur: 1 });
            ctx.bus.emit('sound', 'steam');
          }
          if (e.textKey) feedback.show('good', t(e.textKey), { key: e.textKey });
          break;
        case 'shieldBreaks':
          renderer.add({ kind: 'break', enemy: e.enemy, dur: 0.6 });
          ctx.bus.emit('sound', 'shield');
          feedback.show('good', t(`praise.${1 + Math.floor(Math.random() * 5)}`));
          await wait(300);
          break;
        case 'hit':
          if (e.by === 'companion') {
            renderer.add({ kind: 'strike', dur: 0.5 });
            const key = battle.state.companion?.weapon === 'bamboo' ? 'battle.companion.bamboo' : 'battle.companion';
            feedback.show('good', t(key), { key });
            await wait(250);
          }
          renderer.add({ kind: 'hit', enemy: e.enemy, dur: 0.4 });
          renderer.add({ kind: 'burst', enemy: e.enemy, dur: 0.5 });
          ctx.bus.emit('sound', 'hit');
          await wait(450);
          break;
        case 'enemyDone': {
          const enemy = battle.state.enemies[e.enemy];
          const key = e.outcome === 'calm' ? 'battle.calm' : 'battle.retreat';
          if (e.outcome === 'retreat') renderer.add({ kind: 'retreat', enemy: e.enemy, dur: 1.4 });
          ctx.bus.emit('sound', 'retreat');
          feedback.show('good', t(key, { name: enemyName(enemy) }), { key, params: { name: enemyName(enemy) } });
          await wait(1200);
          break;
        }
        case 'mistake': {
          ctx.bus.emit('sound', e.damage ? 'hurt' : 'wrong');
          if (e.damage) renderer.add({ kind: 'hurt', dur: 0.5 });
          drawHearts();
          const problem = battle.target?.guard?.problem;
          if (e.blockedBy) {
            const key = e.blockedBy === 'steam' ? 'battle.blocked.steam' : friends.length ? 'battle.blocked.shield' : 'battle.blocked.calling';
            feedback.show('good', tg(key), { key });
            await wait(1400);
          }
          if (e.feedback === 'example' && problem?.example) {
            feedback.show('example', textOf(problem.example), problem.example.key ? problem.example : null);
          } else if (e.feedback !== 'similar') {
            const hint = e.hint ?? problem?.hint;
            feedback.show('hint', hint ? textOf(hint) : t('quiz.try.again'), hint?.key ? hint : null);
          }
          widget?.el?.classList.add('shake');
          await wait(400);
          break;
        }
        case 'reveal': {
          const p = e.problem;
          if (p.kind === 'element') {
            const el = rules.counter(p.state);
            feedback.show('example', t('battle.hint.element', { element: { key: `element.${el}` } }));
          } else {
            const answer = p.kind === 'cards' ? p.solution.map((m, i) => (i ? ` ${m.op === '-' ? '−' : m.op} ` : '') + formatNumber(p.cards[m.index], lang())).join('') : answerText(p);
            const explain = p.explain ? ` ${textOf(p.explain)}` : '';
            feedback.show('example', t('quiz.answer.was', { answer }) + explain, { key: 'quiz.answer.was', params: { answer } });
          }
          await wait(2200);
          break;
        }
        case 'hidden':
          break;
        case 'event':
          await storyEvent(e.id);
          break;
        case 'won':
          await win();
          return;
        case 'lost':
          await lose();
          return;
        default:
          break;
      }
    }
  }

  // The staff breaks, and the player finds bamboo.
  async function storyEvent(id) {
    const ev = def.events.find((x) => x.id === id);
    renderer.add({ kind: 'staffBreak', dur: 1.5 });
    ctx.bus.emit('sound', 'hit');
    await wait(600);
    root.hidden = true;
    if (ev.dialogue) await runDialogue(ctx, ev.dialogue);
    if (ev.puzzle === 'bamboo') await bambooPuzzle(ctx);
    if (ev.after) await runDialogue(ctx, ev.after);
    root.hidden = false;
    const r = battle.resolveEvent();
    await showEvents(r.events);
  }

  async function win() {
    ctx.bus.emit('sound', 'win');
    await wait(600);
    const rewards = def.win.give ?? {};
    applyEffects(profile, [...(def.win.set ?? []).map((f) => ({ set: f })), { give: rewards }]);
    profile.stats.battlesWon += 1;
    if (eraComplete(profile, 1, 'tu-tai')) setFlag(profile, 'vvst.era1');
    await ctx.save('battle');
    root.hidden = true;
    const calm = battle.state.enemies.every((e) => e.outcome === 'calm');
    await showMessage(ctx, { title: t('battle.won'), textKey: calm ? 'battle.won.calm' : 'battle.won.retreat', rewards });
    if (alive) ctx.go('village', { after: def.win.after ?? [] });
  }

  async function lose() {
    ctx.bus.emit('sound', 'lose');
    await wait(600);
    const level = lossLevel(profile);
    const lost = applyLoss(profile, level, data.game.loss, data.game.loss.items);
    profile.stats.battlesLost += 1;
    profile.place = { map: data.village.id, x: data.village.home.x, y: data.village.home.y };
    await ctx.save('battle');
    root.hidden = true;
    const hasLoss = Object.keys(lost).length > 0;
    await showMessage(ctx, {
      title: t('battle.lost.title'),
      textKey: 'battle.lost',
      rewards: hasLoss ? Object.fromEntries(Object.entries(lost).map(([k, v]) => [k, -v])) : null,
      rewardsKey: hasLoss ? 'battle.lost.items' : null,
      noteKey: hasLoss ? null : 'battle.lost.none',
    });
    if (alive) ctx.go('village', { at: data.village.home });
  }

  // Taps on the canvas choose the target.
  function onPointer(e) {
    if (busy || battle.phase !== 'player') return;
    const rect = surface.canvas.getBoundingClientRect();
    const i = renderer.enemyAt(e.clientX - rect.left, e.clientY - rect.top);
    if (i >= 0 && !battle.state.enemies[i].done && i !== battle.state.target) {
      battle.setTarget(i);
      ctx.bus.emit('sound', 'tap');
      renderPanel();
    }
  }
  surface.canvas.addEventListener('pointerdown', onPointer);

  let time = 0;
  let last = performance.now();
  function frame(now) {
    if (!alive) return;
    time += (now - last) / 1000;
    last = now;
    const free = surface.height - (root.hidden ? 0 : bottom.offsetHeight);
    renderer.draw(surface, { ...battle.state, friends }, time, { width: surface.width, height: Math.max(free, surface.height * 0.42) });
    requestAnimationFrame(frame);
  }

  battle.start();
  // The current battle, for automatic tests of the whole game.
  ctx.activeBattle = battle;
  drawHearts();
  requestAnimationFrame(frame);
  // The intro text, then the first guard.
  root.hidden = true;
  queueMicrotask(async () => {
    await showMessage(ctx, { title: t(data.enemies.enemies[def.enemies[0]].nameKey), textKey: def.introKey });
    root.hidden = false;
    renderPanel();
  });

  return {
    unmount() {
      alive = false;
      surface.canvas.removeEventListener('pointerdown', onPointer);
      root.remove();
      ctx.activeProblem = null;
      ctx.activeBattle = null;
    },
    battle,
  };
}

// The bamboo puzzle: find the bamboo with the right number of sections.
// After a mistake: a hint, then a worked example, then the answer and a similar problem.
function bambooPuzzle(ctx) {
  const { learner, profile } = ctx;
  // Only problems with a number answer, or with number choices, fit on the bamboo.
  const numberAnswer = (s) => !['shapes', 'bank', 'fracCompare'].includes(s.generator);
  let problem = learner.next({ filter: (s) => battleSkillFilter(profile)(s) && numberAnswer(s) });
  const values = () => {
    if (problem.kind === 'choice' && problem.choices.every((c) => c.value !== undefined)) return problem.choices.map((c) => c.value);
    const a = problem.answer;
    const set = new Set([a]);
    const step = Number.isInteger(a) ? 1 : 0.1;
    for (let d = 1; set.size < 4; d++) {
      if (a - d * step > 0) set.add(Math.round((a - d * step) * 100) / 100);
      if (set.size < 4) set.add(Math.round((a + d * step) * 100) / 100);
    }
    return ctx.rng.shuffle([...set]);
  };
  return new Promise((resolve) => {
    const layer = h('div', { class: 'modal-layer' });
    const panel = h('div', { class: 'panel quiz' });
    const feedback = feedbackLine();
    let first = true;
    let mistakes = 0;
    let busy = false;
    const show = () => {
      const vals = values();
      const grid = h('div', { class: 'choice-grid' });
      vals.forEach((v) => {
        const b = h('button', { class: 'btn bamboo-choice', type: 'button' }, [img('thing/bamboo-stalk'), h('span', { text: formatNumber(v, lang()) })]);
        b.addEventListener('click', async () => {
          if (busy) return;
          const ok = problem.kind === 'choice' ? v === problem.choices[problem.answer].value : checkAnswer(problem, v);
          if (first) {
            learner.record(problem, ok);
            first = false;
          }
          if (ok) {
            busy = true;
            ctx.bus.emit('sound', 'correct');
            b.classList.add('pop');
            await wait(700);
            layer.remove();
            resolve();
            return;
          }
          ctx.bus.emit('sound', 'wrong');
          b.style.visibility = 'hidden';
          mistakes += 1;
          const step = feedbackFor(mistakes, ctx.data.learning.feedback);
          if (step === 'example' && problem.example) {
            feedback.show('example', textOf(problem.example), problem.example.key ? problem.example : null);
          } else if (step === 'similar') {
            busy = true;
            const answer = answerText(problem);
            feedback.show('example', t('quiz.answer.is', { answer }), { key: 'quiz.answer.is', params: { answer } });
            await wait(2600);
            problem = learner.problem(problem.skill, { level: problem.level });
            first = true;
            mistakes = 0;
            busy = false;
            show();
          } else {
            feedback.show('hint', textOf(problem.hint), problem.hint?.key ? problem.hint : null);
          }
        });
        grid.append(b);
      });
      panel.replaceChildren(
        h('div', { class: 'panel-head' }, [h('h2', { text: t('battle.bamboo.title') })]),
        h('p', { class: 'center', text: t('battle.bamboo.prompt') }),
        h('div', { class: 'question' }, [h('p', { class: 'prompt', text: textOf(problem.prompt) }), grid]),
        feedback.el,
      );
      ctx.activeProblem = { ...problem, bamboo: vals };
      speak('battle.bamboo.prompt');
    };
    show();
    layer.append(panel);
    ctx.ui.append(layer);
  });
}

// Ask before a battle starts.
registerModal('confirmBattle', (ctx, { id }) => new Promise((resolve) => {
  const def = ctx.data.battles.battles[id];
  const enemy = ctx.data.enemies.enemies[def.enemies[0]];
  const layer = h('div', { class: 'modal-layer' });
  const close = () => { layer.remove(); resolve(); };
  layer.append(h('div', { class: 'panel', style: { width: 'min(620px, 100%)' } }, [
    h('div', { class: 'panel-head' }, [h('h2', { text: t(enemy.nameKey) })]),
    h('div', { class: 'col', style: { alignItems: 'center' } }, [
      img(enemy.art, '', ''),
      h('p', { class: 'prompt', text: tg(def.introKey) }),
      h('div', { class: 'row' }, [
        button(t('battle.later'), close, { cls: 'btn paper' }),
        button(t('battle.fight'), () => { layer.remove(); resolve(); ctx.go('battle', { id }); }, { cls: 'btn big red' }),
      ]),
    ]),
  ]));
  layer.querySelector('img').style.height = 'min(28vmin, 180px)';
  ctx.ui.append(layer);
  speak(def.introKey);
}));

registerScene('battle', mountBattle);
