# How to contribute

Thank you for your help. This document tells you how to contribute to Tre.

## Contributor License Agreement

Before we can accept your contribution, you must sign a Contributor License Agreement (CLA). The CLA lets the project keep or change the licenses of Tre later. You keep the copyright of your work.

1. Open a pull request.
2. The project owner sends you the CLA.
3. Sign the CLA. Then we can merge your pull request.

We cannot merge a contribution without a signed CLA.

## Language rules

Write all text in ASD-STE100 Simplified Technical English. This rule applies to documents, code comments, names in code, log text, and commit messages. The Vietnamese text in `i18n/vi.json` is not in this rule.

- Use short sentences. Use one instruction in one sentence.
- Use the active voice.
- Use one word for one meaning. Use the same term each time.
- Use simple words.

## Text in the game

- Put all text in `i18n/vi.json` and `i18n/en.json`, by key. Do not put text in code or in data files. Use only keys there.
- Add each new key to the two files. A test fails if a key is only in one file.
- Keep names of people, places, and titles in Vietnamese with marks in the two languages, for example "Thánh Gióng" and "Văn Miếu".
- Follow the section "History and sensitivity rules" in `docs/DESIGN.md`. Mark each story as "Legend" or "History". Speak of rulers and armies of that time, never of peoples today. Do not use insults. Show no blood and no deaths.
- Add each new history note and each new Vietnamese text to `docs/REVIEW.md`. A person must check them before a release.

## Code rules

- Use plain JavaScript with native ES modules. Do not add a framework, a bundler, a game engine, or a build step.
- Do not add dependencies. The `package.json` file has only the module type and the test script. The one exception is three.js, loaded at a fixed version from a CDN through the import map in `index.html`.
- Keep all game logic in `src/core/`. Code in `src/core/` must not use the DOM, Canvas, `window`, or `fetch`.
- Put DOM code in `src/ui/` and drawing code in `src/render/`.
- Put all values of the learning model in `data/config/learning.json`.
- Keep the world state as plain data in `src/core/world/`: entities are plain objects with optional components, and systems are pure functions that change the state in a fixed order (`src/core/world/step.js`). The renderer only reads the state. Do not add an ECS library.
- Use only relative paths. The game must work at `/Tre/` on GitHub Pages and on a local static server.
- Do not send requests to other sites, except the one request for three.js. Do not add ads, analytics, cookies, or accounts.
- When you add or remove a game file, change the list `FILES` in `sw.js`. The service worker uses the list for offline play. A test fails when the list and the files are not the same.

## Art

Things in the world are code, not images: the land, the buildings, the people, the animals, and their portraits on the screens are built from parts and rendered (see "One look for each thing" in `docs/DESIGN.md`). The SVG files in `art/` are only the small UI icons, the logo, the paper, and the patterns of frames, in the style of Đông Hồ folk paintings. Do not copy real paintings. Refer to `art/README.md`.

## Tests

Use the built-in Node test runner (`node:test` and `node:assert`). Do not add test libraries.

```sh
npm test
```

Add tests for each change to `src/core/`. All tests must pass before we merge a pull request.

The use paths of the game are stories in `tests/stories/`: data files with a start state, commands, and the facts to check. `tests/stories.test.js` runs them headless, and `?story=<name>&play` plays one in the browser. Every new use path (a task, a raid, a quest step, a screen) comes with its story in the same commit. The stories test the paths; the unit tests test the parts. A new kind of step or fact goes into `src/core/story.js` with a test of its own in `tests/story.test.js`. After a change to a story, run `python3 tools/stories.py` to make `docs/reference/stories.html` again. `docs/STORIES.md` tells how to write a story.

## How to pick up work

Work is planned in GitHub issues, grouped in milestones. To pick up work:

1. Open the current milestone. Its description gives the order of work, and each issue starts with a line "Order: step N". Take the first open issue in that order. The issue numbers are not the order. If a milestone gives no order, take the open issue with the lowest number.
2. Read `docs/DESIGN.md` first. It is the single source of truth. Do not edit it; put notes in `docs/QUESTIONS.md`, `docs/REVIEW.md`, or a new file in `docs/`.
3. Open the files in `docs/reference/` that the issue names. They show the target look and feel.
4. Do the work in small commits. Each commit leaves the game playable and all tests passing.
5. When the issue is done, comment on it with what changed, and add a screen recording or screenshots when the issue asks for them. Then close the issue.
6. When the issue has the label `needs-review`, stop after it. Wait for the owner before you start the next issue.
7. Before you start each issue, read the milestone description and the labels again. The owner can add an issue, change the order, or add `needs-review` while you work; the current state wins over what you read at the start of the run.

## Pull requests

1. Make a branch from `main`.
2. Make small commits. Write each commit message in Simplified Technical English.
3. Run the tests.
4. Open a pull request. Tell what you changed and why.
