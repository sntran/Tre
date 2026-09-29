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
- Use only relative paths. The game must work at `/Tre/` on GitHub Pages and on a local static server.
- Do not send requests to other sites, except the one request for three.js. Do not add ads, analytics, cookies, or accounts.
- When you add or remove a game file, change the list `FILES` in `sw.js`. The service worker uses the list for offline play. A test fails when the list and the files are not the same.

## Art

All art in `art/` is original SVG in the style of Đông Hồ folk paintings. Do not copy real paintings. Refer to `art/README.md`.

## Tests

Use the built-in Node test runner (`node:test` and `node:assert`). Do not add test libraries.

```sh
npm test
```

Add tests for each change to `src/core/`. All tests must pass before we merge a pull request.

## How to pick up work

Work is planned in GitHub issues, grouped in milestones. To pick up work:

1. Open the current milestone. Take the open issue with the lowest number. Issues in a milestone build on each other, so do them in order.
2. Read `docs/DESIGN.md` first. It is the single source of truth. Do not edit it; put notes in `docs/QUESTIONS.md`, `docs/REVIEW.md`, or a new file in `docs/`.
3. Open the files in `docs/reference/` that the issue names. They show the target look and feel.
4. Do the work in small commits. Each commit leaves the game playable and all tests passing.
5. When the issue is done, comment on it with what changed, and add a screen recording or screenshots when the issue asks for them. Then close the issue.
6. When the issue has the label `needs-review`, stop after it. Wait for the owner before you start the next issue.

## Pull requests

1. Make a branch from `main`.
2. Make small commits. Write each commit message in Simplified Technical English.
3. Run the tests.
4. Open a pull request. Tell what you changed and why.
