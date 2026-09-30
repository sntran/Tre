// Văn Miếu, the Temple of Literature: the adaptive exams, the first title,
// the stone stele on the turtle, and the choice of a calling.
import { doorOf } from '../core/session.js';
import { buildLadder, createExam, skillsToPractice, examSkills } from '../core/exam.js';
import { gradeBase } from '../core/rating.js';
import { gradeIds, gradeName } from '../core/grades.js';
import { createSeen } from '../core/fresh.js';
import { checkAnswer } from '../core/solver.js';
import { giveTitle, eraComplete, setFlag } from '../core/profile.js';
import { registerScene, registerModal } from './registry.js';
import { h, img, button, wait } from './dom.js';
import { t, tg } from './i18n.js';
import { speak } from './speak.js';
import { portrait } from './dialogue.js';
import { renderQuestion, feedbackLine } from './question.js';
import { showMessage } from './quiz.js';

// Back to the world: the hero stands on the road just east of the door of Văn Miếu (the trigger
// "vanmieu" on its map), not in the door, so that the door does not open again at once.
function villageDoor(ctx) {
  return doorOf(ctx.data, 'vanmieu') ?? {};
}

// The ladder of an exam: the skills of the era of its title, or all skills for placement.
function ladderFor(ctx, kind) {
  const { titles } = ctx.data;
  const skills = examSkills(ctx.graph, titles.exams[kind], titles.titles);
  return buildLadder(skills, ctx.data.learning.rating);
}

// Run an adaptive exam. Return the result with "passed".
function runExam(ctx, kind) {
  const def = ctx.data.titles.exams[kind];
  const ladder = ladderFor(ctx, kind);
  const cfg = ctx.data.learning;
  // The placement exam starts near the grade of the player. The Era 1 exam starts easy.
  const start = kind === 'placement' ? gradeBase(ctx.profile.grade, cfg.rating) + cfg.exam.placement.startOffset : null;
  const exam = createExam({ ladder, settings: cfg.exam.subject, rng: ctx.rng, scale: cfg.rating.scale, start });
  return new Promise((resolve) => {
    const layer = h('div', { class: 'modal-layer' });
    const panel = h('div', { class: 'panel quiz' });
    const counter = h('div', { class: 'muted' });
    const slot = h('div');
    const feedback = feedbackLine();
    panel.append(
      h('div', { class: 'panel-head' }, [h('h2', { text: t(def.titleKey) })]),
      h('div', { class: 'quiz-top' }, [portrait(ctx, 'examiner'), h('div', { class: 'quiz-progress' }, [counter, h('p', { text: t('exam.rule', { min: ctx.data.learning.exam.subject.min, max: ctx.data.learning.exam.subject.max }) })])]),
      slot,
      feedback.el,
    );
    layer.append(panel);
    ctx.ui.append(layer);
    let q = null;
    const seen = createSeen(ctx.seen);

    const ask = () => {
      const item = exam.next();
      // The exam item sets the skill and the level. Do not show the same question twice.
      const make = () => ctx.learner.problem(item.skill, { level: item.level });
      const problem = seen.fresh([make], 40) ?? make();
      ctx.activeProblem = problem;
      counter.textContent = t('exam.question', { n: exam.count + 1 });
      feedback.clear();
      q?.destroy();
      q = renderQuestion(problem, {
        onAnswer: async (response) => {
          q.lock();
          const ok = checkAnswer(problem, response);
          // The exam item and P(L) before the answer: the check of transfer (rule 30).
          ctx.log('exam', { skill: problem.skill, correct: ok, p: ctx.learner.entry(problem.skill).p });
          ctx.learner.record(problem, ok);
          ctx.bus.emit('sound', ok ? 'correct' : 'tap');
          feedback.show(ok ? 'good' : 'hint', t(ok ? 'exam.right' : 'exam.next'));
          exam.answer(ok);
          await wait(900);
          if (exam.done) {
            q.destroy();
            layer.remove();
            const result = exam.result();
            result.practice = skillsToPractice(result, ladder);
            result.passed = kind === 'era1' ? result.ability >= ctx.data.learning.exam.era1.pass : true;
            resolve(result);
          } else {
            ask();
          }
        },
      });
      slot.replaceChildren(q.el);
    };
    ask();
  });
}

// The grade level of an ability: the highest grade whose base rating is at or below it.
function gradeOf(ctx, ability) {
  const ids = gradeIds(ctx.data.game.grades);
  let g = ids[0];
  for (const grade of ids) if (ability >= gradeBase(grade, ctx.data.learning.rating)) g = grade;
  return gradeName(g, ctx.data.game.grades);
}

async function afterExam(ctx, kind, result) {
  const { profile, data } = ctx;
  const def = data.titles.exams[kind];
  profile.learning.exams.push({ kind, at: Date.now(), ability: Math.round(result.ability), asked: result.asked, correct: result.correct, passed: result.passed });
  if (kind === 'placement') {
    const ids = ctx.graph.filter((s) => s.subject === 'math').map((s) => s.id);
    ctx.learner.applyPlacement(result.ability, ids, data.learning.exam.placement);
    setFlag(profile, def.flag);
    await ctx.save('exam');
    await showMessage(ctx, { speaker: 'examiner', textKey: 'exam.placement.done', params: { grade: gradeOf(ctx, result.ability), correct: result.correct, total: result.asked } });
  } else if (result.passed) {
    const title = data.titles.titles.find((x) => x.id === def.title);
    giveTitle(profile, title.id, title.era, Date.now());
    setFlag(profile, def.flag);
    if (eraComplete(profile, title.era, title.id)) setFlag(profile, `vvst.era${title.era}`);
    await ctx.save('exam');
    ctx.bus.emit('sound', 'win');
    await showMessage(ctx, { speaker: 'examiner', title: t(title.nameKey), textKey: 'exam.passed', params: { title: { key: title.nameKey } } });
    await showMessage(ctx, { textKey: 'exam.stele', art: 'thing/stele-turtle' });
    if (profile.flags[`vvst.era${title.era}`]) await showMessage(ctx, { textKey: 'exam.vanvo', art: 'title/bamboo-section' });
  } else {
    await ctx.save('exam');
    const names = result.practice.map((id) => t(`skill.${id}`)).join(t('ui.list.sep'));
    await showMessage(ctx, { speaker: 'examiner', textKey: 'exam.not.yet', params: { skills: names } });
    return;
  }
  // After the first exam, the player chooses a calling.
  if (!profile.calling) {
    await showMessage(ctx, { speaker: 'examiner', textKey: 'exam.who' });
    await chooseCalling(ctx, false);
  }
}

function chooseCalling(ctx, change) {
  const { profile, data } = ctx;
  return new Promise((resolve) => {
    const layer = h('div', { class: 'modal-layer' });
    let picked = profile.calling;
    const grid = h('div', { class: 'calling-grid' });
    const confirm = button(t('calling.choose'), async () => {
      if (!picked) return;
      profile.calling = picked;
      setFlag(profile, 'calling.chosen');
      await ctx.save('calling');
      layer.remove();
      const c = data.callings.callings.find((x) => x.id === picked);
      await showMessage(ctx, { speaker: 'examiner', textKey: 'calling.chosen', params: { calling: { key: c.nameKey } }, art: c.art });
      resolve();
    }, { cls: 'btn big red', disabled: !picked });
    for (const c of data.callings.callings) {
      const card = h('button', { class: 'calling-card', type: 'button', 'aria-pressed': String(c.id === picked) }, [
        img(c.art), h('strong', { text: t(c.nameKey) }), h('small', { text: t(c.mentorKey) }), h('small', { text: t(c.subjectKey) }),
        h('small', { text: t(c.vanKey) }), h('small', { text: t(c.voKey) }),
      ]);
      card.addEventListener('click', () => {
        picked = c.id;
        for (const x of grid.children) x.setAttribute('aria-pressed', String(x === card));
        confirm.disabled = false;
        speak(c.nameKey);
      });
      grid.append(card);
    }
    layer.append(h('div', { class: 'panel' }, [
      h('div', { class: 'panel-head' }, [
        h('h2', { text: tg('calling.title') }),
        change ? button(null, () => { layer.remove(); resolve(); }, { cls: 'icon-btn', icon: 'ui/close', aria: t('ui.close') }) : null,
      ]),
      h('p', { class: 'center', text: tg(change ? 'calling.change.note' : 'calling.note') }),
      grid,
      h('div', { class: 'row', style: { marginTop: '12px' } }, [confirm]),
    ]));
    ctx.ui.append(layer);
    speak(change ? 'calling.change.note' : 'calling.note');
  });
}

registerModal('calling', (ctx, cmd) => chooseCalling(ctx, Boolean(cmd.change)));

async function mountVanMieu(ctx) {
  const { profile, data } = ctx;
  const screen = h('div', { class: 'screen' });
  const content = h('div', { class: 'vanmieu' });
  screen.append(content);
  screen.append(h('div', { class: 'corner-left' }, [
    button(null, () => ctx.go('village', villageDoor(ctx)), { cls: 'icon-btn', icon: 'ui/back', aria: t('ui.back') }),
  ]));
  ctx.ui.append(screen);

  const draw = () => {
    const names = profile.stele.map((s) => h('span', { text: t('vanmieu.stele.row', { name: s.name, title: { key: `title.${s.title}.name` } }) }));
    const stele = h('div', { class: 'stele' }, [img('thing/stele-turtle'), h('div', { class: 'stele-names' }, names)]);
    const actions = h('div', { class: 'row' });
    const needPlacement = profile.grade >= ctx.data.learning.exam.placement.fromGrade && !profile.flags['placement.done'];
    if (needPlacement) {
      actions.append(button(t('exam.placement.start'), async () => {
        const r = await runExam(ctx, 'placement');
        await afterExam(ctx, 'placement', r);
        draw();
      }, { cls: 'btn big red' }));
    }
    if (!profile.flags['exam.era1.passed']) {
      actions.append(button(t('exam.era1.start'), async () => {
        const r = await runExam(ctx, 'era1');
        await afterExam(ctx, 'era1', r);
        draw();
      }, { cls: `btn big ${needPlacement ? 'paper' : 'red'}` }));
    }
    actions.append(button(t('vanmieu.back'), () => ctx.go('village', villageDoor(ctx)), { cls: 'btn paper' }));
    const introKey = needPlacement ? 'vanmieu.hello.placement' : profile.flags['exam.era1.passed'] ? 'vanmieu.hello.done' : 'vanmieu.hello';
    content.replaceChildren(
      img('thing/vanmieu-gate', 'vanmieu-gate'),
      h('div', { class: 'vanmieu-row' }, [
        stele,
        h('div', { class: 'panel' }, [
          h('span', { class: 'mark mark-history', text: t('mark.history') }),
          h('div', { class: 'row', style: { flexWrap: 'nowrap', alignItems: 'flex-end' } }, [portrait(ctx, 'examiner'), h('p', { class: 'prompt', style: { textAlign: 'left' }, text: tg(introKey) })]),
          h('p', { class: 'muted', text: tg('vanmieu.note') }),
        ]),
      ]),
      actions,
    );
    speak(introKey);
  };
  draw();
  return { unmount() { screen.remove(); } };
}

registerScene('vanmieu', mountVanMieu);
