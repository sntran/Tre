// The forge: the player helps the smiths make the iron horse.
import { createCraft } from '../core/craft.js';
import { createElementRules } from '../core/elements.js';
import { takeItems, setFlag } from '../core/profile.js';
import { registerModal } from './app.js';
import { runQuiz, showMessage } from './quiz.js';
import { battleSkillFilter } from './battle.js';
import { h, img, button, wait } from './dom.js';
import { t, tg } from './i18n.js';
import { speak } from './speak.js';
import { portrait } from './dialogue.js';
import { feedbackLine } from './question.js';

registerModal('craft', async (ctx, cmd, extra) => {
  const recipe = ctx.data.crafts.crafts[cmd.id];
  const rules = createElementRules(ctx.data.elements);
  const calling = ctx.data.callings.callings.find((c) => c.id === ctx.profile.calling);
  const craft = createCraft(recipe, rules, { bonuses: calling?.bonus ?? {} });

  await new Promise((resolve) => {
    const layer = h('div', { class: 'modal-layer' });
    const panel = h('div', { class: 'panel craft' });
    const feedback = feedbackLine();
    const body = h('div', { class: 'col', style: { alignItems: 'center', width: '100%' } });
    panel.append(
      h('div', { class: 'panel-head' }, [h('h2', { text: t(recipe.nameKey) })]),
      h('div', { class: 'quiz-top' }, [portrait(ctx, recipe.speaker), body]),
      feedback.el,
    );
    layer.append(panel);
    ctx.ui.append(layer);

    const say = (key) => {
      body.prepend(h('p', { class: 'prompt', text: tg(key) }));
      speak(key);
    };

    async function show() {
      body.replaceChildren();
      const step = craft.step;
      if (!step) {
        layer.remove();
        resolve();
        return;
      }
      if (step.type === 'element') {
        say(step.textKey);
        const materialArt = craft.state.material === 'hot-iron' ? 'item/iron' : 'item/iron';
        const iron = img(materialArt, '', '');
        iron.style.height = '90px';
        if (craft.state.material === 'hot-iron') iron.style.filter = 'sepia(1) saturate(6) hue-rotate(-30deg) brightness(1.1)';
        body.append(h('div', { class: 'forge-scene' }, [img('thing/forge-fire'), iron, img('thing/anvil')]));
        const row = h('div', { class: 'battle-actions' });
        for (const el of rules.available) {
          row.append(button(t(`element.${el}`), async () => {
            const r = craft.useElement(el);
            ctx.bus.emit('sound', el);
            if (r.ok) {
              ctx.bus.emit('sound', r.rule.effect === 'harden' ? 'steam' : 'correct');
              feedback.show('good', t(r.rule.textKey), { key: r.rule.textKey });
              ctx.learner.record({ skill: 'sci.matter.materials', level: 1 }, craft.state.mistakes === 0);
              await wait(1800);
              show();
            } else if (!r.ignored) {
              ctx.bus.emit('sound', 'wrong');
              feedback.show('hint', t(r.rule.hintKey ?? 'hint.bank'), r.rule.hintKey ? { key: r.rule.hintKey } : null);
            }
          }, { cls: `btn big element-btn ${el}`, icon: `ui/${el}` }));
        }
        body.append(row);
      } else if (step.type === 'problems') {
        say(step.textKey);
        body.append(button(t('ui.next'), async () => {
          layer.hidden = true;
          await runQuiz(ctx, {
            title: t(recipe.nameKey),
            speaker: recipe.speaker,
            count: step.count,
            next: () => ctx.learner.next({ filter: battleSkillFilter(ctx.profile) }),
            similar: (p) => ctx.learner.problem(p.skill, { level: p.level }),
          });
          layer.hidden = false;
          craft.finishProblems();
          show();
        }, { cls: 'btn big red' }));
      } else if (step.type === 'assemble') {
        say(step.textKey);
        let selected = null;
        const board = h('div', { class: 'horse-board' }, [img(recipe.art, 'ghost')]);
        const tray = h('div', { class: 'parts' });
        const slotEls = {};
        for (const slot of step.slots) {
          const el = h('button', { class: 'horse-slot', type: 'button', 'aria-label': t(`craft.part.${slot.part}`), style: {
            left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%`,
          } });
          el.addEventListener('click', () => {
            if (selected === null) {
              feedback.show('hint', t('craft.pick.part'), { key: 'craft.pick.part' });
              return;
            }
            const r = craft.place(selected, slot.id);
            if (r.ok) {
              ctx.bus.emit('sound', 'pickup');
              el.classList.add('filled', 'pop');
              el.append(img(`item/horse-part-${slot.part}`));
              tray.querySelector(`[data-id="${selected}"]`)?.remove();
              selected = null;
              feedback.clear();
              if (r.complete) {
                feedback.show('good', t('craft.built'), { key: 'craft.built' });
                setTimeout(show, 1400);
              }
            } else if (r.reason === 'wrong-slot') {
              ctx.bus.emit('sound', 'wrong');
              const params = { part: { key: `craft.part.${r.part}` }, slot: { key: `craft.part.${r.slot}` } };
              feedback.show('hint', t('craft.wrong.slot', params), { key: 'craft.wrong.slot', params });
            }
          });
          slotEls[slot.id] = el;
          board.append(el);
        }
        for (const item of craft.state.tray) {
          const b = h('button', { class: 'tile-btn', type: 'button', 'data-id': String(item.id), 'aria-pressed': 'false', 'aria-label': t(`craft.part.${item.part}`) }, [img(`item/horse-part-${item.part}`)]);
          b.addEventListener('click', () => {
            selected = item.id;
            for (const x of tray.children) x.setAttribute('aria-pressed', String(x === b));
            ctx.bus.emit('sound', 'tap');
          });
          tray.append(b);
        }
        body.append(board, tray);
      }
    }
    show();
  });

  takeItems(ctx.profile, recipe.needs);
  if (!ctx.profile.machines.includes(recipe.machine)) ctx.profile.machines.push(recipe.machine);
  setFlag(ctx.profile, recipe.set);
  await ctx.save('craft');
  await showMessage(ctx, { title: t(recipe.nameKey), textKey: recipe.doneKey, art: recipe.art, speaker: recipe.speaker });
  extra.village?.refresh();
});

// The home of the hero: friends, calling, and titles.
registerModal('home', async (ctx) => {
  const { profile, data } = ctx;
  await new Promise((resolve) => {
    const layer = h('div', { class: 'modal-layer' });
    const close = () => { layer.remove(); resolve(); };
    const panel = h('div', { class: 'panel' });
    const draw = () => {
      const friendsList = h('div', { class: 'col' });
      if (!profile.friends.length) friendsList.append(h('p', { class: 'muted', text: t('home.no.friends') }));
      for (const id of profile.friends) {
        const f = data.friends.friends[id];
        const inParty = profile.party.includes(id);
        friendsList.append(h('div', { class: 'friend-card' }, [
          img(f.art),
          h('div', { class: 'col', style: { flex: '1', gap: '2px' } }, [h('strong', { text: t(f.nameKey) }), h('small', { text: tg(f.helpKey) })]),
          button(t(inParty ? 'home.party.out' : 'home.party.in'), () => {
            if (inParty) profile.party = profile.party.filter((x) => x !== id);
            else if (profile.party.length < data.game.battle.maxParty) profile.party.push(id);
            ctx.save('party');
            draw();
          }, { cls: `btn small ${inParty ? 'green' : 'paper'}` }),
        ]));
      }
      const calling = data.callings.callings.find((c) => c.id === profile.calling);
      const titles = profile.titles.map((id) => t(`title.${id}.name`)).join(', ');
      panel.replaceChildren(
        h('div', { class: 'panel-head' }, [h('h2', { text: t('home.title') }), button(null, close, { cls: 'icon-btn', icon: 'ui/close', aria: t('ui.close') })]),
        h('div', { class: 'row', style: { justifyContent: 'flex-start' } }, [portrait(ctx, 'grandma'), h('p', { class: 'prompt', style: { flex: '1', textAlign: 'left' }, text: tg('home.hello') })]),
        h('h3', { text: t('home.friends', { max: data.game.battle.maxParty }) }),
        friendsList,
        h('h3', { text: t('home.calling') }),
        calling
          ? h('div', { class: 'row', style: { justifyContent: 'flex-start' } }, [img(calling.art), h('strong', { text: t(calling.nameKey) }), button(t('home.calling.change'), () => { close(); ctx.open({ open: 'calling', change: true }); }, { cls: 'btn small paper' })])
          : h('p', { class: 'muted', text: tg('home.calling.none') }),
        h('h3', { text: t('home.titles') }),
        h('p', { text: titles || t('home.titles.none') }),
        h('div', { class: 'row' }, [button(t('home.rest'), async () => {
          await ctx.save('home');
          ctx.toast('ui.saved');
        }, { cls: 'btn' })]),
      );
      panel.querySelectorAll('.row img:not(.layer)').forEach((x) => { x.style.width = '64px'; });
    };
    draw();
    layer.append(panel);
    ctx.ui.append(layer);
    speak('home.hello');
  });
});
