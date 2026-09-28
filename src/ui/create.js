// Hero creation: language, name, boy or girl, face, hair, clothes, and grade.
import { h, img, button } from './dom.js';
import { t, lang } from './i18n.js';
import { speak } from './speak.js';
import { createProfile } from '../core/profile.js';

export async function mountCreate(ctx) {
  const opts = ctx.data.hero;
  const hero = { name: '', gender: 'boy', face: 1, hair: 1, clothes: 1 };
  let grade = 1;
  let step = 0;
  const steps = ['lang', 'name', 'look', 'grade'];

  const screen = h('div', { class: 'screen' });
  const preview = h('div', { class: 'hero-preview' });
  const stage = h('div', { class: 'create-stage' });
  screen.append(h('div', { class: 'create' }, [preview, stage]));
  screen.append(h('div', { class: 'corner-left' }, [
    button(null, () => (step > 0 ? show(step - 1) : ctx.go('title')), { cls: 'icon-btn', icon: 'ui/back', aria: t('ui.back') }),
  ]));
  ctx.ui.append(screen);

  function drawPreview() {
    preview.replaceChildren(
      img(`hero/face-${hero.face}`, 'layer'),
      img(`hero/clothes-${hero.gender}-${hero.clothes}`, 'layer'),
      img(`hero/hair-${hero.hair}`, 'layer'),
    );
  }

  function dots() {
    return h('div', { class: 'dots', 'aria-hidden': 'true' }, steps.map((_, i) => h('span', { class: i <= step ? 'on' : '' })));
  }

  function choiceRow(values, current, render, onPick, labelKey) {
    const row = h('div', { class: 'option-grid', role: 'group', 'aria-label': t(labelKey) });
    for (const v of values) {
      const b = h('button', { class: 'tile-btn', type: 'button', 'aria-pressed': String(v === current()), 'aria-label': `${t(labelKey)} ${v}` }, [render(v)]);
      b.addEventListener('click', () => {
        onPick(v);
        for (const x of row.children) x.setAttribute('aria-pressed', String(x === b));
        drawPreview();
        ctx.bus.emit('sound', 'tap');
      });
      row.append(b);
    }
    return h('div', {}, [h('p', { class: 'option-label center', text: t(labelKey) }), row]);
  }

  function title(key) {
    const el = h('h2', { text: t(key) });
    el.addEventListener('click', () => speak(key, null, { force: true }));
    speak(key);
    return el;
  }

  function show(n) {
    step = n;
    stage.replaceChildren(dots());
    const name = steps[step];
    if (name === 'lang') {
      stage.append(title('create.lang'));
      for (const code of ['vi', 'en']) {
        const b = button(t(`lang.${code}`), async () => {
          await ctx.setLanguage(code);
          show(1);
        }, { cls: `btn big ${lang() === code ? 'red' : 'paper'}` });
        stage.append(b);
      }
    } else if (name === 'name') {
      stage.append(title('create.name'));
      const input = h('input', { class: 'name-input', type: 'text', maxlength: String(opts.nameMax), autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', 'aria-label': t('create.name') });
      input.value = hero.name;
      stage.append(input);
      stage.append(choiceRow(opts.genders, () => hero.gender, (g) => h('span', { text: t(`create.${g}`) }), (g) => { hero.gender = g; }, 'create.gender'));
      const next = button(t('ui.next'), () => {
        hero.name = input.value.trim().slice(0, opts.nameMax);
        if (!hero.name) {
          input.focus();
          input.classList.add('shake');
          setTimeout(() => input.classList.remove('shake'), 400);
          speak('create.name.need', null, { force: true });
          return;
        }
        show(2);
      }, { cls: 'btn big red' });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') next.click(); });
      stage.append(next);
    } else if (name === 'look') {
      stage.append(title('create.look'));
      const layer = (p) => img(p);
      stage.append(choiceRow(opts.faces, () => hero.face, (v) => h('span', { class: 'stack head' }, [img(`hero/face-${v}`)]), (v) => {
        hero.face = v;
        // The hair buttons show the new face too.
        for (const el of stage.querySelectorAll('.hair-tile img:first-child')) el.src = `art/hero/face-${v}.svg`;
      }, 'create.face'));
      // Show each hair on the face that the player chose.
      const withFace = (v) => h('span', { class: 'stack head hair-tile' }, [img(`hero/face-${hero.face}`), img(`hero/hair-${v}`)]);
      stage.append(choiceRow(opts.hairs, () => hero.hair, withFace, (v) => { hero.hair = v; }, 'create.hair'));
      stage.append(choiceRow(opts.clothes, () => hero.clothes, (v) => layer(`hero/clothes-${hero.gender}-${v}`), (v) => { hero.clothes = v; }, 'create.clothes'));
      stage.append(button(t('ui.next'), () => show(3), { cls: 'btn big red' }));
    } else if (name === 'grade') {
      stage.append(title('create.grade'));
      stage.append(choiceRow([1, 2, 3, 4, 5], () => grade, (v) => h('span', { text: String(v) }), (v) => { grade = v; }, 'create.grade.label'));
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
  ctx.surface.canvas.hidden = true;
  return { unmount() { screen.remove(); } };
}
