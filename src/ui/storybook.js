// The storybook: ?story=<name> in the address opens the game in the start state of a story
// (tests/stories/<name>.json), and with &play it plays the steps: a finger shows each tap, and
// the game waits one second at each expect and shows its result. &speed=4 plays the world four
// times faster (for a whole day). This is for the review of the owner and for screenshots.
// Nothing is saved on the device: the profile of a story lives only in this page.
import { storyProfile, storyOnPlane, playStory, STEP } from '../core/story.js';
import { serialize, deserialize } from '../core/save.js';
import { addPoint, restorePoint, whereOf } from '../core/restore.js';
import { h } from './dom.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Start a story. name: the name of the story file. play: play the steps. speed: the speed of the world.
export async function startStory(ctx, name, { play = false, speed = 1 } = {}) {
  const response = await fetch(`tests/stories/${encodeURIComponent(name)}.json`);
  if (!response.ok) throw new Error(`No story ${name}`);
  const story = storyOnPlane(await response.json(), ctx.data.world);
  ctx.storybook = { story, playing: play, speed: Math.max(1, Math.min(16, speed || 1)) };
  // Nothing of a story goes into the store of the device: the saves stay in this page, with the
  // restore points of the dawns (src/core/restore.js), as the store of the device keeps them.
  ctx.save = (reason = '') => {
    if (!ctx.profile) return Promise.resolve();
    ctx.syncWorld?.();
    const text = serialize(ctx.profile, Date.now());
    ctx.storybook.record = { ...ctx.storybook.record, text };
    if (reason === 'dawn') ctx.storybook.record = addPoint(ctx.storybook.record, { text, ...whereOf(ctx.profile), at: Date.now() });
    return Promise.resolve();
  };
  const profile = storyProfile(story, { now: Date.now() });
  ctx.storybook.record = { id: profile.id, text: '', points: [] };
  await ctx.startProfile(profile);
  if (play) await playInBrowser(ctx, story);
}

// Play the steps of a story on the village scene.
async function playInBrowser(ctx, story) {
  const book = ctx.storybook;
  const village = async () => {
    for (let i = 0; i < 200 && !ctx.activeVillage; i++) await wait(50);
    return ctx.activeVillage;
  };
  await village();
  const finger = h('div', { class: 'story-finger', hidden: true });
  const bar = h('div', { class: 'story-bar' });
  ctx.ui.append(finger, bar);
  const keep = () => {
    // A new scene of the village (after an exit or a reload) clears the layer of the interface.
    if (!finger.isConnected) ctx.ui.append(finger, bar);
  };
  const show = (text, cls = '') => {
    keep();
    bar.className = `story-bar ${cls}`;
    bar.textContent = text;
    const panel = ctx.activeVillage?.debugPanel;
    if (panel) {
      let line = panel.querySelector('.story-step');
      if (!line) {
        line = h('div', { class: 'story-step' });
        panel.prepend(line);
      }
      line.textContent = `story ${story.name} · ${text}`;
    }
  };

  const io = {
    session: () => ctx.activeVillage.session,
    learner: () => ctx.learner,
    data: ctx.data,
    onStep(i, s) {
      show(`${i + 1}/${story.steps.length} ${JSON.stringify(s)}`);
    },
    // The world runs in the frames of the scene. Wait for its steps, not for the clock of the
    // page: a slow device runs fewer steps in a second.
    async advance(seconds, until) {
      const ticks = () => ctx.activeVillage?.session.state.tick ?? 0;
      const count = Math.ceil(seconds / STEP);
      let start = ticks();
      let done = 0;
      while (done < count) {
        await wait(30);
        const now = ticks();
        // A new map starts a new world state with its own count of steps.
        done += now >= start ? now - start : now;
        start = now;
        if (until?.()) return true;
      }
      return !until;
    },
    async send(cmd, point) {
      const v = await village();
      if (point) {
        // The finger goes to the point of the tap, and taps. The world waits for the finger, so
        // that a story plays the same on a slow device and at any speed.
        book.hold = true;
        const p = v.pointOf(point.x, point.y);
        keep();
        finger.hidden = false;
        finger.style.transform = `translate(${p.x}px, ${p.y}px)`;
        await wait(450);
        finger.classList.add('down');
        await wait(150);
        finger.classList.remove('down');
      }
      v.send(cmd);
      book.hold = false;
      await wait(point ? 150 : 350);
    },
    async reload() {
      // Save and load, as the store of the device does, and open the village again.
      ctx.activeVillage.session.syncSave();
      ctx.profile = deserialize(serialize(ctx.profile, Date.now()));
      ctx.makeLearner();
      await ctx.go('village');
      await village();
      return null;
    },
    async restore(index) {
      // A parent goes back to a restore point (the parent area does the same with the store).
      await ctx.save('restore');
      const record = book.record;
      if (!record.points[index]) return `no restore point ${index}`;
      book.record = restorePoint(record, index, whereOf(ctx.profile), Date.now());
      ctx.profile = deserialize(book.record.text);
      ctx.makeLearner();
      await ctx.go('village');
      await village();
      return null;
    },
    points: () => book.record.points.map(({ day, era, at, before = false }) => ({ day, era, at, before })),
    async onExpect(i, failures, step) {
      show(failures.length ? `✗ ${failures.join(' · ')}` : `✓ ${JSON.stringify(step.expect)}`, failures.length ? 'bad' : 'good');
      await wait(1000);
    },
  };
  const failures = await playStory(story, io);
  finger.hidden = true;
  show(failures.length ? `✗ ${story.name}: ${failures.length}` : `✓ ${story.name}`, failures.length ? 'bad' : 'good');
  if (failures.length) console.warn('Story failures', failures);
  book.done = { failures };
}
