# The page of the diary

The diary of the making of Tre (`docs/devlog/`) shows on the site for parents, in Vietnamese and English (#40). The owner's side writes the entries; the page shows them as they are.

- **Address:** `diary.html` shows the index (the `README` of the language), and `diary.html?entry=<name>&lang=<vi|en>` shows one entry (`<name>` is the file name with no `.md` and no `.vi`). With no `lang`, the page uses the language of the game, then the language of the browser. A parent can share the address.
- **Where it opens:** the link "Chuyện làm nên Tre" / "The making of Tre" under each tab of the parent page. It opens in a new tab, so that the game stays where it is.
- **The renderer** (`src/core/markdown.js`, no DOM): headings, paragraphs, lists in two levels, tables, links, bold, italics, and code in a line. All text is escaped. A table scrolls inside its box, not the page.
- **The links** (`src/core/diary.js`): a source (`https`, or `http` for two old sources) opens in a new tab; a link to another entry or to the index opens the page of the diary in the language of the link; a link to another file of the repository (`docs/research/`, `docs/DESIGN.md`) opens the file on GitHub in a new tab.
- **The page** (`diary.html`, `src/ui/diary.js`, `styles/diary.css`): the paper, the fonts, and the colors of the game; the link to the other language at the top; the links to the newer entry, to the list, and to the older entry at the bottom. A new entry needs no change of the page: it reads the index and the files.
- **The deploy** (`.github/workflows/pages.yml`) copies `docs/devlog/` and keeps its `.md` files.
- **Tests** (`tests/diary.test.js`): each entry in both languages and in the index of each language, newest first; the three parts of each entry; the links (absolute sources, entries that exist, in the same language); the renderer; no Markdown marks left in the HTML of each entry.
