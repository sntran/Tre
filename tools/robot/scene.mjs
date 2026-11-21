// A check of a save before a play test (#174): the robot child plays 40 commands of the kind
// "star" from a saved game and says where the star leads, so that a save of a play test starts at
// the scene that it is for.
//   node tools/robot/scene.mjs <save> [--commands 40] [--night]
// <save>: the text of a save of the game (src/core/save.js), or a scene of tests/stories/.
import { readFileSync } from 'node:fs';
import { deserialize } from '../../src/core/save.js';
import { playScene, report } from './robot.mjs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.log('node tools/robot/scene.mjs <save> [--commands 40] [--night]');
  process.exit(1);
}
const i = args.indexOf('--commands');
const commands = i >= 0 ? Number(args[i + 1]) : 40;
const night = args.includes('--night');
const text = readFileSync(file, 'utf8');
const json = JSON.parse(text);
// A scene of tests/stories/ has steps; a save has a profile in its own form.
const isScene = Array.isArray(json.steps);
const story = isScene ? json : { name: file, steps: [] };
const profile = isScene ? null : deserialize(text);
const out = await playScene(story, { kind: 'star', commands, night, profile, scene: file });
const show = (w) => [
  `- map ${w.map}, hero at ${w.hero.join(', ')}, goal ${w.goal ?? '-'}`,
  ...w.stars.map((m) => `- a star at ${m.at.join(', ')}${m.who ? ` (${m.who})` : ''}${m.thing ? ` (${m.thing})` : ''}${m.work ? ', the work' : ''}${m.rest ? ', the rest' : ''}${m.line ? `: "${m.line}"` : ''}`),
].join('\n');
console.log(`# The scene of ${file}\n\n## At the start\n${show(out.start)}\n\n## After ${commands} commands\n${show(out.end)}\n\n## The last lines\n${out.heard.slice(-8).map((l) => `- "${l}"`).join('\n')}\n\n## The laws\n${report(out.findings)}`);
