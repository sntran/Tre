// The screens that open over the village: practice, lessons, and more. (The Five Trials are
// work in the village: src/core/world/systems/work.js.)
import { registerModal } from './registry.js';
import { runQuiz } from './quiz.js';
import { h, img, button } from './dom.js';
import { speak } from './speak.js';
import { t, setChosenNames } from './i18n.js';
import { applyEffects } from '../core/game.js';
import { addItem, setFriendName, chosenGlossNames } from '../core/profile.js';

function similar(ctx) {
  return (p) => ctx.learner.problem(p.skill, { level: p.level });
}

// A short lesson of the mentor, with a fixed skill.
registerModal('lesson', async (ctx, cmd) => {
  await runQuiz(ctx, {
    title: t('lesson.title'),
    speaker: 'giong',
    count: cmd.count ?? 2,
    next: () => ctx.learner.problem(cmd.skill),
    similar: similar(ctx),
  });
});

// Practice with the teacher: no health loss, no end.
registerModal('practice', async (ctx) => {
  const skillId = await chooseSkill(ctx);
  if (skillId === undefined) return;
  await runQuiz(ctx, {
    title: t('practice.title'),
    speaker: 'teacher',
    count: null,
    next: () => (skillId ? ctx.learner.problem(skillId) : ctx.learner.next()),
    similar: similar(ctx),
  });
});

// Let the player pick a skill. Return null for the teacher's choice, or undefined to close.
function chooseSkill(ctx) {
  return new Promise((resolve) => {
    const layer = h('div', { class: 'modal-layer' });
    const done = (v) => { layer.remove(); resolve(v); };
    const learner = ctx.learner;
    const open = ctx.graph.all().filter((s) => learner.unlocked(s.id) && (s.grade <= ctx.profile.grade + 1));
    const practice = new Set(learner.toPractice());
    open.sort((a, b) => (practice.has(b.id) - practice.has(a.id)) || a.grade - b.grade);
    const list = h('div', { class: 'choice-grid' });
    for (const s of open.slice(0, 12)) {
      list.append(button(t(`skill.${s.id}`), () => done(s.id), { cls: `btn ${practice.has(s.id) ? '' : 'paper'}` }));
    }
    layer.append(h('div', { class: 'panel' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: t('practice.title') }), button(null, () => done(undefined), { cls: 'icon-btn', icon: 'ui/close', aria: t('ui.close') })]),
      h('p', { class: 'center', text: t('practice.note') }),
      h('p', { class: 'prompt', text: t('practice.choose') }),
      h('div', { class: 'row' }, [button(t('practice.mixed'), () => done(null), { cls: 'btn red big' })]),
      list,
    ]));
    ctx.ui.append(layer);
  });
}

// The village counts rice for Gióng: math problems at the level of the player.
registerModal('rice', async (ctx, _cmd, extra) => {
  await runQuiz(ctx, {
    title: t('rice.title'),
    speaker: 'mother',
    count: 3,
    next: () => ctx.learner.next({ filter: (s) => s.subject === 'math' }),
    similar: similar(ctx),
  });
  addItem(ctx.profile, 'rice', 3);
  applyEffects(ctx.profile, [{ set: 'giong.grown' }]);
  await ctx.save('rice');
  extra.village?.refresh();
  await extra.village?.talk('giong.grown');
});

// The player gives a name to a new friend. The usual name is ready in the box.
registerModal('nameFriend', (ctx, cmd) => new Promise((resolve) => {
  const f = ctx.data.friends.friends[cmd.id];
  const usual = ctx.profile.friendNames?.[cmd.id] ?? t(f.nameKey);
  const max = ctx.data.hero.nameMax;
  const layer = h('div', { class: 'modal-layer' });
  const input = h('input', { class: 'name-input', type: 'text', maxlength: String(max), autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', 'aria-label': t('friend.name.title') });
  input.value = usual;
  const done = async () => {
    setFriendName(ctx.profile, cmd.id, input.value || usual, max);
    setChosenNames(chosenGlossNames(ctx.profile, ctx.data.friends.friends));
    await ctx.save('friend-name');
    layer.remove();
    resolve();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
  layer.append(h('div', { class: 'panel', style: { width: 'min(520px, 100%)' } }, [
    h('div', { class: 'panel-head' }, [h('h2', { text: t('friend.name.title') })]),
    h('div', { class: 'col', style: { alignItems: 'center' } }, [
      img(f.art, 'friend-name-art'),
      h('p', { class: 'center', text: t('friend.name.note', { usual: t(f.nameKey) }) }),
      input,
      button(t('ui.ok'), done, { cls: 'btn big red' }),
    ]),
  ]));
  ctx.ui.append(layer);
  speak('friend.name.title');
  input.focus();
  input.select();
}));
