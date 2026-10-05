// Hero creation: language, name, boy or girl, skin, face, hair, clothes, and grade. For a practice
// link it is short: name, look, and grade (the grade sets the first level), and then the activity,
// with no prologue. The preview is
// the voxel hero itself, turning slowly (a drag turns it too), and each choice shows a small
// rendered picture; the choices come from data/figures.json (hero).
import { h, button } from './dom.js';
import { t, lang } from './i18n.js';
import { speak } from './speak.js';
import { createProfile } from '../core/profile.js';
import { gradeIds, gradeShort } from '../core/grades.js';
import { heroLook } from '../world/figures.js';
import { portraitCanvas, portraitImage } from './portraits.js';

const TURNS = 16; // the preview turns in 16 steps, as a print
const STEP_MS = 350; // one step of the turn
const PREVIEW = 220; // the size of the preview (CSS pixels)

export async function mountCreate(ctx) {
  const opts = { ...ctx.data.figures.hero, nameMax: ctx.data.hero.nameMax };
  const genders = Object.keys(opts.genders);
  const count = (list) => list.map((_, i) => i + 1);
  const hero = { name: '', gender: 'boy', skin: 1, face: 1, hair: 1, clothes: 1 };
  const grades = ctx.data.game.grades;
  let grade = grades.default ?? gradeIds(grades)[0];
  let step = 0;
  const practice = ctx.practiceLink;
  const steps = practice ? ['name', 'look', 'grade'] : ['lang', 'name', 'look', 'grade'];
  const next = () => show(step + 1);

  const screen = h('div', { class: 'screen' });
  const preview = h('div', { class: 'hero-preview' });
  const stage = h('div', { class: 'create-stage' });
  screen.append(h('div', { class: 'create' }, [preview, stage]));
  screen.append(h('div', { class: 'corner-left' }, [
    button(null, () => (step > 0 ? show(step - 1) : ctx.go('title')), { cls: 'icon-btn', icon: 'ui/back', aria: t('ui.back') }),
  ]));
  ctx.ui.append(screen);

  // The preview: the voxel hero at 16 turns (src/ui/portraits.js renders one in each frame, the
  // turn on the screen first). It steps through the turns; a drag picks the turn.
  const turnCanvas = h('canvas', { class: 'hero-turn', 'aria-hidden': 'true' });
  turnCanvas.style.width = `${PREVIEW}px`;
  turnCanvas.style.height = `${PREVIEW}px`;
  preview.append(turnCanvas);
  const frames = new Map(); // the key of a look -> the images of its turns
  let turn = 2;
  let shown = null;
  let lookKey = '';
  let alive = true;
  let drag = null;
  let lastStep = performance.now();
  const lookNow = () => heroLook(hero, opts);
  function paint() {
    const img = frames.get(lookKey)?.[turn];
    if (!img || img === shown) return;
    shown = img;
    turnCanvas.width = img.width;
    turnCanvas.height = img.height;
    turnCanvas.getContext('2d').drawImage(img, 0, 0);
  }
  function drawPreview() {
    const look = lookNow();
    lookKey = JSON.stringify(look);
    if (frames.has(lookKey)) return paint();
    const list = new Array(TURNS).fill(null);
    frames.set(lookKey, list);
    for (let k = 0; k < TURNS; k++) {
      const i = (turn + k) % TURNS;
      portraitImage(ctx, look, { framing: 'full', size: PREVIEW, facing: (i / TURNS) * Math.PI * 2 }).then((img) => {
        list[i] = img;
        paint();
      });
    }
  }
  const loop = (now) => {
    if (!alive) return;
    if (!drag && now - lastStep > STEP_MS) {
      lastStep = now;
      turn = (turn + 1) % TURNS;
    }
    paint();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  turnCanvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, turn };
    turnCanvas.setPointerCapture?.(e.pointerId);
  });
  turnCanvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    turn = (((drag.turn + Math.round((e.clientX - drag.x) / 18)) % TURNS) + TURNS) % TURNS;
  });
  const endDrag = () => { drag = null; lastStep = performance.now(); };
  turnCanvas.addEventListener('pointerup', endDrag);
  turnCanvas.addEventListener('pointercancel', endDrag);

  function dots() {
    return h('div', { class: 'dots', 'aria-hidden': 'true' }, steps.map((_, i) => h('span', { class: i <= step ? 'on' : '' })));
  }

  // words: the choices are words (boy or girl, the grade): each button is as wide as its word
  // needs (#37); the other choices are square pictures.
  function choiceRow(values, current, render, onPick, labelKey, { words = false } = {}) {
    const row = h('div', { class: 'option-grid', role: 'group', 'aria-label': t(labelKey) });
    for (const v of values) {
      const b = h('button', { class: words ? 'tile-btn word' : 'tile-btn', type: 'button', 'aria-pressed': String(v === current()), 'aria-label': `${t(labelKey)} ${v}` }, [render(v)]);
      b.addEventListener('click', () => {
        onPick(v);
        for (const x of row.children) x.setAttribute('aria-pressed', String(x === b));
        drawPreview();
        refreshThumbs();
        ctx.bus.emit('sound', 'tap');
      });
      b.thumb = () => b.replaceChildren(render(v));
      row.append(b);
    }
    thumbRows.push(row);
    return h('div', {}, [h('p', { class: 'option-label center', text: t(labelKey) }), row]);
  }
  // The pictures of the choices show the other choices of the hero too (a face with the chosen
  // skin): draw them again after each choice.
  let thumbRows = [];
  function refreshThumbs() {
    for (const row of thumbRows) for (const b of row.children) if (b.thumbed) b.thumb();
  }

  function title(key) {
    const el = h('h2', { text: t(key) });
    el.addEventListener('click', () => speak(key, null, { force: true }));
    speak(key);
    return el;
  }

  function show(n) {
    step = n;
    thumbRows = [];
    stage.replaceChildren(dots());
    const name = steps[step];
    if (name === 'lang') {
      stage.append(title('create.lang'));
      for (const code of ['vi', 'en']) {
        const b = button(t(`lang.${code}`), async () => {
          await ctx.chooseLanguage(code);
          next();
        }, { cls: `btn big ${lang() === code ? 'red' : 'paper'}` });
        stage.append(b);
      }
    } else if (name === 'name') {
      if (practice) stage.append(h('p', { class: 'practice-note center', text: t('practiceLink.new', { title: { key: practice.titleKey } }) }));
      stage.append(title('create.name'));
      const input = h('input', { class: 'name-input', type: 'text', maxlength: String(opts.nameMax), autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', 'aria-label': t('create.name') });
      input.value = hero.name;
      stage.append(input);
      stage.append(choiceRow(genders, () => hero.gender, (g) => h('span', { text: t(`create.${g}`) }), (g) => { hero.gender = g; }, 'create.gender', { words: true }));
      const go = button(t('ui.next'), () => {
        hero.name = input.value.trim().slice(0, opts.nameMax);
        if (!hero.name) {
          input.focus();
          input.classList.add('shake');
          setTimeout(() => input.classList.remove('shake'), 400);
          speak('create.name.need', null, { force: true });
          return;
        }
        next();
      }, { cls: 'btn big red' });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
      stage.append(go);
    } else if (name === 'look') {
      stage.append(title('create.look'));
      // A small rendered picture of the hero with one choice changed: the head (skin, face, hair) or
      // the whole hero (clothes). The hair choices turn the head about 30 degrees, so that a bun or
      // long hair shows.
      const thumb = (change, framing = 'head', facing = null) => {
        const el = portraitCanvas(ctx, heroLook({ ...hero, ...change }, opts), { framing, size: 56, facing });
        return h('span', { class: 'thumb' }, [el]);
      };
      const row = (values, key, labelKey, framing, facing) => {
        const r = choiceRow(values, () => hero[key], (v) => thumb({ [key]: v }, framing, facing), (v) => { hero[key] = v; }, labelKey);
        for (const b of r.querySelector('.option-grid').children) b.thumbed = true;
        return r;
      };
      stage.append(row(count(opts.skins), 'skin', 'create.skin'));
      stage.append(row(count(opts.faces), 'face', 'create.face'));
      stage.append(row(count(opts.hairs), 'hair', 'create.hair', 'head', (30 * Math.PI) / 180));
      stage.append(row(count(opts.clothes), 'clothes', 'create.clothes', 'full'));
      stage.append(button(t('ui.next'), next, { cls: 'btn big red' }));
    } else if (name === 'grade') {
      stage.append(title('create.grade'));
      stage.append(choiceRow(gradeIds(grades), () => grade, (v) => h('span', { text: t(gradeShort(v, grades).key, gradeShort(v, grades).params) }), (v) => { grade = v; }, 'create.grade.label', { words: true }));
      stage.append(h('p', { class: 'center muted', text: t('create.grade.note') }));
      stage.append(button(t('create.start'), finish, { cls: 'btn big red' }));
    }
  }

  let started = false;
  async function finish() {
    if (started) return;
    started = true;
    const now = Date.now();
    const id = `p${now.toString(36)}`;
    const profile = createProfile({ id, ...hero, grade, lang: lang(), now, seed: now >>> 0 });
    await ctx.startProfile(profile, true);
  }

  drawPreview();
  show(0);
  return {
    unmount() {
      alive = false;
      screen.remove();
    },
  };
}
