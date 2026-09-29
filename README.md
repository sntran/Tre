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
| `src/render/` | Canvas code for the isometric world and the battles. |
| `src/iso/`, `src/world/` | The isometric grid, depth order, and camera; movement, regions and maps, the game clock, and travel. No DOM. |
| `src/ui/` | DOM code for dialogue, menus, exams, settings, and the parent page. |
| `tools/geo/` | The script that makes the map data of the country map from open data. |
| `tools/maps/` | The scripts that make the region maps in `data/maps/`. |
| `data/` | Skill graph, the regions of the world and their maps, enemies, items, quests, dialogue, and questions as JSON. |
| `data/config/learning.json` | All values of the learning model. |
| `i18n/` | All text by key, in Vietnamese (`vi.json`) and English (`en.json`). |
| `art/` | Original SVG art in the style of Đông Hồ woodblock prints. All art is a placeholder. |
| `fonts/` | The two fonts (Alegreya and Be Vietnam Pro), under the SIL Open Font License. |
| `audio/` | Recorded voice files by language (optional). |
| `tests/` | Unit tests. |
| `docs/` | Design, open questions, and review lists. |

## Documents

- [Game design](docs/DESIGN.md)
- [Art and UI style guide](docs/ART.md)
- [Open questions](docs/QUESTIONS.md)
- [Text and history review](docs/REVIEW.md)
- [How to contribute](CONTRIBUTING.md)

## Licenses

- Code: [AGPL-3.0](LICENSE).
- Stories, art, music, and text: [CC BY-NC-SA 4.0](content/README.md).
- Fonts: SIL Open Font License 1.1. Refer to [fonts/README.md](fonts/README.md).
- Map data: Natural Earth and NASA SRTM (public domain), and our own traced rivers and places. Refer to [data/geo/README.md](data/geo/README.md).
- The name "Tre" and its logo: reserved. Refer to [TRADEMARK.md](TRADEMARK.md).
