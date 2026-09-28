# Tre

Tre is a web role-playing game for students in grades 1 to 5. An ordinary child grows into a hero of Vietnamese history and legend with the mind and the body.

*Every hero starts small.*

The game is in Vietnamese and in English. All data stays on the device. The game has no ads, no accounts, no cookies, and no analytics.

## Play

The game runs on GitHub Pages at <https://sntran.github.io/Tre/>.

To play from a local copy, start a static web server in the root folder. Then open the address in a browser. For example:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000/>.

## Test

The tests use the built-in Node test runner. Use Node 22 or a later version.

```sh
npm test
```

## Folders

| Folder | Contents |
| --- | --- |
| `src/core/` | All game logic. This code does not use the DOM or Canvas. |
| `src/render/` | Canvas code for the village map and the battles. |
| `src/ui/` | DOM code for dialogue, menus, exams, settings, and the parent page. |
| `data/` | Skill graph, maps, enemies, items, quests, dialogue, and questions as JSON. |
| `data/config/learning.json` | All values of the learning model. |
| `i18n/` | All text by key, in Vietnamese (`vi.json`) and English (`en.json`). |
| `art/` | Original SVG art. All art is a placeholder. |
| `audio/` | Recorded voice files by language (optional). |
| `tests/` | Unit tests. |
| `docs/` | Design, open questions, and review lists. |

## Documents

- [Game design](docs/DESIGN.md)
- [Open questions](docs/QUESTIONS.md)
- [Text and history review](docs/REVIEW.md)
- [How to contribute](CONTRIBUTING.md)

## Licenses

- Code: [AGPL-3.0](LICENSE).
- Stories, art, music, and text: [CC BY-NC-SA 4.0](content/README.md).
- The name "Tre" and its logo: reserved. Refer to [TRADEMARK.md](TRADEMARK.md).
