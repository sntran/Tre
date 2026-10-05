# A web page with no build step and no engine

*28 September 2026 · [Tiếng Việt](2026-09-28-a-web-page-with-no-build-step.vi.md)*

Most games are made with a game engine and a chain of build tools. In ten years, those tools will have changed many times, and an old project often does not build any more. We wanted a game that still opens from its own files.

## What we found

- **The hard parts of Tre are its own.** The problem generators, the model of what the child knows, the exams, and the rules of the world are custom in any engine. An engine does not give them to us.
- **An engine adds download size,** and the first devices of Tre are iPads and laptops in a browser.
- **Browsers now load JavaScript modules with no tools** ([MDN, modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)), and an import map lets a page use a fixed version of a library from a CDN with no bundler ([MDN, import maps](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap)).

## What we decided

- **Plain JavaScript modules:** no framework, no bundler, no engine, no build step. The only library is three.js, at a fixed version from a CDN, which draws the world. HTML and CSS draw the text, so that Vietnamese letters with their marks stay sharp and easy to translate.
- **A static site on GitHub Pages** that also works offline, with a service worker.
- **The logic has no screen code** (no DOM, no WebGL), so that Node's own test runner can test all of it, with no test libraries. There are more than 500 tests now.
- **The paths of a child are data.** Each path that a child can take through the game is a story file: a start, a list of steps, and the facts to check. The same file runs in the tests and in the browser, where a visible finger plays it. On every step of every story, the tests check the laws of the world. One law is that no text in the village or in a raid has a digit, a sign of an operation, or a question mark: the rule [math is what you do](2026-09-29-math-is-what-you-do.md), checked by a machine.
- **All text is in language files,** by key. A test fails if a key is in only one language.
- **The documents are in simple English** (ASD-STE100 Simplified Technical English): short sentences, one word for one meaning.

If a later team wants a build step for its own work, it can add one. The rule is that the game never needs one to run.
