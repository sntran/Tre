// The exams: the adaptive exams, the first title, and the choice of a calling, with the place and the
// person of the exams of the chapter (data/titles.json, examiners, #134). In Era 1 the messenger of
// the Hùng King gives the tests at the village hall of Phù Đổng (the screen "exam" over the village);
// from chapter 7 (the Lý), Văn Miếu, the Temple of Literature, with the stone stele of the doctors on
// the turtle and the board at the gate (the scene "vanmieu").
import { doorOf } from '../core/session.js';
import { examLadder, createExam, skillsToPractice, examSkills, strengths, placedGrade } from '../core/exam.js';
import { examinerOf, vanMieuOf, lineOf } from '../core/examiners.js';
import { gradeBase } from '../core/rating.js';
import { gradeIds } from '../core/grades.js';
import { levelFor } from '../core/world/trials.js';
import { createSeen } from '../core/fresh.js';
import { checkAnswer } from '../core/solver.js';
import { giveTitle, eraComplete, setFlag } from '../core/profile.js';
import { registerScene, registerModal } from './registry.js';
import { h, button, wait } from './dom.js';
import { t, tg, has } from './i18n.js';
import { speak } from './speak.js';
import { portrait } from './dialogue.js';
import { portraitCanvas, heroLookOf } from './portraits.js';
import { renderQuestion, feedbackLine, answerText, textOf } from './question.js';
import { showMessage } from './quiz.js';

// Back to the world: the hero stands on the road just east of the door of Văn Miếu (the trigger
// "vanmieu" on its map), not in the door, so that the door does not open again at once.
function villageDoor(ctx) {
  return doorOf(ctx.data, 'vanmieu') ?? {};
}

// The ladder of an exam: the skills of the era of its title, or all skills for placement, at the
// first level of each skill (#136: the smallest numbers that still test the skill).
function ladderFor(ctx, kind) {
  const { titles } = ctx.data;
  const skills = examSkills(ctx.graph, titles.exams[kind], titles.titles);
  return examLadder(skills, ctx.data.learning.rating);
}

// Run an adaptive exam. Return the result with "passed".
function runExam(ctx, kind, ex) {
  const def = ctx.data.titles.exams[kind];
  const ladder = ladderFor(ctx, kind);
  const cfg = ctx.data.learning;
  // The placement exam starts near the grade of the player. The Era 1 exam starts easy.
  const start = kind === 'placement' ? gradeBase(ctx.profile.grade, cfg.rating) + cfg.exam.placement.startOffset : null;
  const exam = createExam({ ladder, settings: cfg.exam.subject, rng: ctx.rng, scale: cfg.rating.scale, start });
  const max = cfg.exam.subject.max;
  return new Promise((resolve) => {
    const layer = h('div', { class: 'modal-layer' });
    const panel = h('div', { class: 'panel quiz exam' });
    // How many questions are left: one dot for each question, at most "max" (#136).
    const dots = h('div', { class: 'exam-dots', 'aria-label': t('exam.question', { n: 1 }) }, Array.from({ length: max }, () => h('span', { class: 'exam-dot' })));
    const slot = h('div');
    const feedback = feedbackLine();
    // The rule and the line of the button "not learned yet" show on the first question only (#136).
    const rule = h('div', { class: 'exam-rule' }, [
      h('p', { text: t(lineOf(ex, 'rule'), { max }) }),
      h('p', { text: t(lineOf(ex, 'skip.tell')) }),
    ]);
    // The title of the exam, the place, and the examiner (the messenger at the village hall in Era 1).
    const titleKey = ex.lines === 'exam' ? def.titleKey : lineOf(ex, `${kind}.title`);
    panel.append(
      h('div', { class: 'panel-head' }, [h('h2', { text: t(titleKey) })]),
      ...(ex.placeKey && ex.lines !== 'exam' ? [h('p', { class: 'muted center', text: t(ex.placeKey) })] : []),
      h('div', { class: 'quiz-top' }, [portrait(ctx, ex.speaker), h('div', { class: 'quiz-progress' }, [dots, rule])]),
      slot,
      feedback.el,
    );
    layer.append(panel);
    ctx.ui.append(layer);
    speak(lineOf(ex, 'skip.tell'), {}, { queue: true });
    let q = null;
    const seen = createSeen(ctx.seen);

    const ask = () => {
      const item = exam.next();
      // The exam item sets the skill and the level. Do not show the same question twice.
      const make = () => ctx.learner.problem(item.skill, { level: item.level, exam: true });
      const problem = seen.fresh([make], 40) ?? make();
      ctx.activeProblem = problem;
      [...dots.children].forEach((d, i) => d.classList.toggle('done', i < exam.count));
      dots.setAttribute('aria-label', t('exam.question', { n: exam.count + 1 }));
      // The rule goes after the first question, but its place stays, so that the keypad does not
      // move (#143).
      if (exam.count > 0) rule.style.visibility = 'hidden';
      feedback.clear();
      q?.destroy();
      let answered = false;
      // The answer: right, or the right answer with one short line (#136, rule 26); "not learned
      // yet" is fine, and it counts as not known, with no guess.
      const done = async (ok, skipped = false) => {
        if (answered) return;
        answered = true;
        q.lock();
        skip.disabled = true;
        // The exam item and P(L) before the answer: the check of transfer (rule 30).
        ctx.log('exam', { skill: problem.skill, correct: ok, p: ctx.learner.entry(problem.skill).p, ...(skipped ? { skipped } : {}) });
        ctx.learner.record(problem, ok, { choices: !skipped && problem.kind === 'choice' ? problem.choices?.length ?? 0 : 0 });
        ctx.bus.emit('sound', ok ? 'correct' : 'tap');
        const answer = answerText(problem);
        const explain = !ok && problem.explain ? ` ${textOf(problem.explain)}` : '';
        const key = ok ? lineOf(ex, 'right') : skipped ? lineOf(ex, 'skip.done') : lineOf(ex, 'wrong');
        feedback.show(ok ? 'good' : 'example', t(key, { answer }) + explain, { key, params: { answer } });
        exam.answer(ok, { skipped, what: problem.what ?? null });
        // A right answer goes on by itself; after the right answer of a wrong one (or of "not learned
        // yet"), the child reads it, and taps "Câu tiếp theo" when ready (#136: the answer after each
        // question, at the pace of the child).
        if (ok) await wait(1500);
        else {
          await new Promise((go) => {
            const next = button(t(lineOf(ex, 'go')), go, { cls: 'btn red exam-skip exam-next' });
            skip.replaceWith(next);
          });
        }
        if (exam.done) {
          q.destroy();
          layer.remove();
          const result = exam.result();
          result.practice = skillsToPractice(result, ladder);
          result.passed = kind === 'era1' ? result.ability >= ctx.data.learning.exam.era1.pass : true;
          result.ladder = ladder;
          resolve(result);
        } else {
          ask();
        }
      };
      q = renderQuestion(problem, { onAnswer: (response) => done(checkAnswer(problem, response)), fixedVisual: true });
      const skip = button(t(lineOf(ex, 'skip.button')), () => done(false, true), { cls: 'btn paper exam-skip' });
      slot.replaceChildren(q.el);
      // The button goes in the free row of the keypad, next to the zero; under the choices else.
      const pad = q.el.querySelector('.numpad');
      if (pad) pad.append(skip);
      else slot.append(skip);
    };
    ask();
  });
}

// The name of a skill in a line, with a small first letter ("bài bảng nhân"). what: the parts of the
// skill that the test asked; with one part, the name of that part only (#143: "there were no
// subtraction questions").
function skillWords(id, what = []) {
  const part = what.length === 1 && has(`skill.${id}.${what[0]}`) ? `skill.${id}.${what[0]}` : `skill.${id}`;
  const name = t(part);
  return name.charAt(0).toLocaleLowerCase() + name.slice(1);
}

async function afterExam(ctx, kind, result, ex) {
  const { profile, data } = ctx;
  const def = data.titles.exams[kind];
  // The grade of a placement goes to the parent page only, and never above the top grade that has
  // tasks (#136).
  const placed = kind === 'placement' ? placedGrade(result.ability, gradeIds(data.game.grades), data.learning.rating, data.learning.exam.placement.topGrade) : null;
  profile.learning.exams.push({ kind, at: Date.now(), ability: Math.round(result.ability), asked: result.asked, correct: result.correct, passed: result.passed, ...(placed ? { grade: placed.grade, above: placed.above } : {}) });
  if (kind === 'placement') {
    const ids = ctx.graph.filter((s) => s.subject === 'math').map((s) => s.id);
    ctx.learner.applyPlacement(result.ability, ids, data.learning.exam.placement);
    setFlag(profile, def.flag);
    await ctx.save('exam');
    // The result says what the child does well and what comes next, in words of the task, and no
    // grade (#136: "now will everything be lớp 6 hard?").
    const { good, count, what, next } = strengths(result, result.ladder ?? ladderFor(ctx, kind));
    const lines = [
      ...(good && count === null ? [{ key: lineOf(ex, 'placement.good'), params: { skill: skillWords(good, what) } }] : []),
      ...(good && count !== null ? [{ key: lineOf(ex, 'placement.count'), params: { skill: skillWords(good, what), n: { key: `num.${count}` } } }] : []),
      ...(next ? [{ key: lineOf(ex, 'placement.next'), params: { skill: skillWords(next) } }] : []),
      { key: lineOf(ex, 'placement.done'), params: {} },
    ];
    await showMessage(ctx, { speaker: ex.speaker, lines });
  } else if (result.passed) {
    const title = data.titles.titles.find((x) => x.id === def.title);
    // A title of a print (người tài in Era 1) goes into the notebook, not onto a stele (#134).
    giveTitle(profile, title.id, title.era, Date.now(), { stele: !title.print });
    setFlag(profile, def.flag);
    if (eraComplete(profile, title.era, title.id)) setFlag(profile, `vvst.era${title.era}`);
    await ctx.save('exam');
    ctx.bus.emit('sound', 'win');
    await showMessage(ctx, { speaker: ex.speaker, title: t(title.nameKey), textKey: lineOf(ex, 'passed'), params: { title: { key: title.nameKey } } });
    if (title.print) await showMessage(ctx, { textKey: lineOf(ex, 'print'), look: data.figures.figures[ex.speaker] ?? null });
    else await showMessage(ctx, { textKey: 'exam.stele', look: ctx.data.figures.views.stele });
    if (profile.flags[`vvst.era${title.era}`]) await showMessage(ctx, { textKey: 'exam.vanvo', art: 'title/bamboo-section' });
  } else {
    await ctx.save('exam');
    const names = result.practice.map((id) => t(`skill.${id}`)).join(t('ui.list.sep'));
    await showMessage(ctx, { speaker: ex.speaker, textKey: lineOf(ex, 'not.yet'), params: { skills: names } });
    return;
  }
  // After the first exam, the player chooses a calling.
  // The question is the title of the screen of the cards (#143: "Cháu muốn học với ai?" came with
  // only "Đồng ý").
  if (!profile.calling) await chooseCalling(ctx, false, ex, lineOf(ex, 'who'));
  // The title of the era ends the chapter: a short page of what the child did, and the way home.
  if (kind === 'era1' && !profile.flags['chapter1.end']) {
    await chapterEnd(ctx, data.titles.titles.find((x) => x.id === def.title));
    setFlag(profile, 'chapter1.end');
    await ctx.save('exam');
  }
}

// The end of chapter one (#51): what the child did in the story, one line for each part, and the
// next goal (the teacher at home, with a star).
function chapterEnd(ctx, title) {
  const f = ctx.profile.flags;
  const trials = ctx.data.trials.trials.filter((x) => x.npc && x.calling).every((x) => f[x.flag]);
  const lines = [
    [trials, 'chapter.end.trials'],
    [f['horse.forged'], 'chapter.end.horse'],
    [f['era1.boss.won'], 'chapter.end.raids'],
    [f['giong.farewell'], 'chapter.end.farewell'],
    [true, 'chapter.end.exam'],
  ].filter(([done]) => done);
  const params = { title: { key: title.nameKey } };
  // The number of the chapter is the number of its region, as the map of the country shows it
  // (#57: the map said "Chương 3" and this page said "chương một").
  const chapter = { n: ctx.data.world.region('giong')?.chapter ?? 1 };
  return new Promise((resolve) => {
    const layer = h('div', { class: 'modal-layer' });
    const close = () => { layer.remove(); resolve(); };
    layer.append(h('div', { class: 'panel chapter-end', style: { width: 'min(640px, 100%)' } }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: t('chapter.end.title', chapter) })]),
      h('ul', { class: 'chapter-list' }, lines.map(([, key]) => h('li', { text: tg(key, params) }))),
      h('p', { class: 'prompt', text: tg('chapter.end.next') }),
      h('div', { class: 'row main-actions' }, [button(t('ui.ok'), close, { cls: 'btn big red' })]),
    ]));
    ctx.ui.append(layer);
    speak('chapter.end.title', chapter);
  });
}

function chooseCalling(ctx, change, ex = vanMieuOf(ctx.data), askKey = null) {
  const { profile, data } = ctx;
  // The note says "cháu" after the messenger, and "em" at Văn Miếu (#136).
  const noteKey = change ? 'calling.change.note' : ex.lines === 'exam' ? 'calling.note' : lineOf(ex, 'calling.note');
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
      // The child's own hero with the tool of the calling, not the mentor (#136: "Is that supposed
      // to be me? I'm a girl with long hair.").
      const tool = data.figures.figures[c.look]?.item;
      await showMessage(ctx, { speaker: ex.speaker, textKey: ex.lines === 'exam' ? 'calling.chosen' : lineOf(ex, 'calling'), params: { calling: { key: c.nameKey } }, looks: [withTool(c), ...(tool ? [{ kind: 'tool', item: tool }] : [])] });
      resolve();
    }, { cls: 'btn big red', disabled: !picked });
    const hero = heroLookOf(ctx);
    const withTool = (c) => (hero ? { ...hero, item: data.figures.figures[c.look]?.item } : data.figures.figures[c.look]);
    // The line of each card is the task of the mentor at the level of the child (#136: at grade 4 the
    // scholar shares rods among the desks, not the counting of grade 1).
    const level = levelFor(data.trials, profile.grade);
    const lineKey = (c) => c.lines?.[Math.min(level, c.lines.length - 1)] ?? c.lineKey;
    for (const c of data.callings.callings) {
      // The hero of the child next to the mentor, and who the mentor is.
      const card = h('button', { class: 'calling-card', type: 'button', 'aria-pressed': String(c.id === picked) }, [
        // The person of the village that the child met (#143: the card of bà lang showed a bald man).
        h('span', { class: 'calling-pics' }, [hero ? portraitCanvas(ctx, hero, { framing: 'full', size: 52 }) : null, portraitCanvas(ctx, data.figures.figures[c.person] ?? data.figures.figures[c.look], { framing: 'full', size: 64 })]),
        h('span', { class: 'calling-words' }, [h('strong', { text: t(c.nameKey) }), h('small', { text: t(c.guideKey) }), h('small', { text: t(lineKey(c)) })]),
      ]);
      card.addEventListener('click', () => {
        picked = c.id;
        for (const x of grid.children) x.setAttribute('aria-pressed', String(x === card));
        confirm.disabled = false;
        speak(lineKey(c));
      });
      grid.append(card);
    }
    layer.append(h('div', { class: 'panel' }, [
      h('div', { class: 'panel-head' }, [
        h('h2', { text: tg(askKey ?? 'calling.title') }),
        change ? button(null, () => { layer.remove(); resolve(); }, { cls: 'icon-btn', icon: 'ui/close', aria: t('ui.close') }) : null,
      ]),
      h('p', { class: 'center', text: tg(noteKey) }),
      grid,
      h('div', { class: 'row main-actions', style: { marginTop: '12px' } }, [confirm]),
    ]));
    ctx.ui.append(layer);
    if (askKey) speak(askKey, {}, { queue: true });
    speak(noteKey, {}, askKey ? { queue: true } : {});
  });
}

registerModal('calling', (ctx, cmd) => chooseCalling(ctx, Boolean(cmd.change), examinerOf(ctx.data, ctx.profile)));

// An exam over the village (#134): the messenger opens it in his talk at the village hall (the
// placement exam after the Five Trials, the exam of the era after the farewell of Gióng). An exam
// that is done does not come again.
async function examScreen(ctx, kind) {
  const def = ctx.data.titles.exams[kind];
  if (!def || ctx.profile.flags[def.flag]) return;
  const ex = examinerOf(ctx.data, ctx.profile);
  const r = await runExam(ctx, kind, ex);
  await afterExam(ctx, kind, r, ex);
}
registerModal('exam', (ctx, cmd) => examScreen(ctx, cmd.kind));

async function mountVanMieu(ctx) {
  const { profile, data } = ctx;
  const ex = vanMieuOf(data);
  const screen = h('div', { class: 'screen' });
  const content = h('div', { class: 'vanmieu' });
  screen.append(content);
  screen.append(h('div', { class: 'corner-left' }, [
    button(null, () => ctx.go('village', villageDoor(ctx)), { cls: 'icon-btn', icon: 'ui/back', aria: t('ui.back') }),
  ]));
  ctx.ui.append(screen);

  const draw = () => {
    const names = profile.stele.map((s) => h('span', { text: t('vanmieu.stele.row', { name: s.name, title: { key: `title.${s.title}.name` } }) }));
    // The stele of the doctors on its turtle, or, with the names of the titles of the player, the
    // board at the gate (only the doctors had their names on the steles, #51).
    // The board is a board of wood under a small roof, not the stele (#57).
    const board = names.length ? h('div', { class: 'stele' }, [portraitCanvas(ctx, data.figures.views['gate-board'], { framing: 'full', size: 200 }), h('div', { class: 'stele-names' }, [h('strong', { text: t('vanmieu.board') }), ...names])]) : null;
    const stele = board ?? h('div', { class: 'stele' }, [portraitCanvas(ctx, data.figures.views.stele, { framing: 'full', size: 200 })]);
    const actions = h('div', { class: 'row main-actions' });
    const needPlacement = profile.grade >= ctx.data.learning.exam.placement.fromGrade && !profile.flags['placement.done'];
    if (needPlacement) {
      actions.append(button(t('exam.placement.start'), async () => {
        const r = await runExam(ctx, 'placement', ex);
        await afterExam(ctx, 'placement', r, ex);
        draw();
      }, { cls: 'btn big red' }));
    }
    if (!profile.flags['exam.era1.passed']) {
      actions.append(button(t('exam.era1.start'), async () => {
        const r = await runExam(ctx, 'era1', ex);
        await afterExam(ctx, 'era1', r, ex);
        draw();
      }, { cls: `btn big ${needPlacement ? 'paper' : 'red'}` }));
    }
    actions.append(button(t('vanmieu.back'), () => ctx.go('village', villageDoor(ctx)), { cls: 'btn paper' }));
    const introKey = needPlacement ? 'vanmieu.hello.placement' : profile.flags['exam.era1.passed'] ? 'vanmieu.hello.done' : 'vanmieu.hello';
    content.replaceChildren(
      portraitCanvas(ctx, data.figures.views['vanmieu-gate'], { framing: 'full', size: 260, cls: 'vanmieu-gate' }),
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
