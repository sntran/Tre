// The long sweep of the robot child (#174): every scene of tests/stories/, by day and at night,
// with each kind of child, and a report of the findings grouped by law.
//   node tools/robot/sweep.mjs [--commands 300] [--kinds star,presser,counter,dealer] [--workers 2]
//                              [--scenes a,b] [--json out.json]
// A worker is a child process that plays a part of the plays.
import { fork } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, value) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : value;
};
const commands = Number(opt('commands', 300));
const kinds = opt('kinds', 'star,presser,counter,dealer').split(',');
const workers = Number(opt('workers', 2));
const only = opt('scenes', '') ? opt('scenes', '').split(',') : null;
const json = opt('json', null);

if (process.env.ROBOT_PART) {
  // A worker: play the plays of its part, and send the findings.
  const { playScene, scenes } = await import('./robot.mjs');
  const plays = JSON.parse(process.env.ROBOT_PART);
  const all = new Map(scenes().map((s) => [s.name, s.story]));
  for (const p of plays) {
    let out;
    try {
      out = await playScene(all.get(p.scene), { scene: p.scene, kind: p.kind, night: p.night, commands: p.commands });
    } catch (e) {
      out = { findings: [{ law: 'crash', scene: p.scene, kind: p.kind, night: p.night, command: 0, clock: 0, goal: null, act: null, lines: [], detail: String(e?.stack ?? e).slice(0, 400) }] };
    }
    process.send({ play: p, findings: out.findings });
  }
  process.exit(0);
}

const { scenes, report, LAWS } = await import('./robot.mjs');
LAWS.crash = 'a play that stopped with an error';
const list = scenes().filter((s) => !only || only.includes(s.name));
const plays = [];
for (const s of list) for (const night of [false, true]) for (const kind of kinds) plays.push({ scene: s.name, night, kind, commands });
const parts = Array.from({ length: workers }, (_, i) => plays.filter((_, k) => k % workers === i));
const findings = [];
const t0 = Date.now();
let done = 0;
await Promise.all(parts.map((part) => new Promise((resolve) => {
  const child = fork(fileURLToPath(import.meta.url), [], { env: { ...process.env, ROBOT_PART: JSON.stringify(part) } });
  child.on('message', (m) => {
    findings.push(...m.findings);
    done += 1;
    if (done % 20 === 0) process.stderr.write(`${done} of ${plays.length} plays, ${Math.round((Date.now() - t0) / 1000)} s\n`);
  });
  child.on('exit', resolve);
})));
console.log(`# The sweep of the robot child\n\n${plays.length} plays (${list.length} scenes, by day and at night, the kinds ${kinds.join(', ')}, ${commands} commands), ${Math.round((Date.now() - t0) / 1000)} s.\n`);
console.log(report(findings));
if (json) writeFileSync(json, JSON.stringify(findings, null, 1));
