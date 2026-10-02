# Art

All art in this folder is a **placeholder**. An artist will replace it later.

The people, the creatures, and the things of the world are not pictures: the code builds them from parts and blocks (`src/world/`), and the portraits are rendered from the same figures (`src/render/portrait.js`). SVG is only for the icons of the UI, the logo, the paper, the patterns, the items, and the bamboo of the title screen.

The style guide is [docs/ART.md](../docs/ART.md). All new art must follow it.

## Style in short

The style comes from **Đông Hồ woodblock prints**. All art is original. It does not copy a real print.

- Thin black keylines like a woodblock print, with a small natural variation in weight.
- Flat colors from natural pigments only. No gradients and no soft shading.
- The palette is in `palette.json` (the same values are in `styles/palette.css` and `src/render/palette.js`). A test fails when a file uses another color.
- Dó paper with a small điệp shimmer (`paper.svg`).
- The traditional patterns: water waves, clouds, and flowers (`pattern/`).
- Clothes, buildings, boats, and tools are correct for the time of the chapter. Era 1 is the time of the Hùng Kings (Đông Sơn culture).
- No text in the images. All text comes from `i18n/`.

## Rules for files

1. Use SVG with a `viewBox` and no `width` or `height`.
2. Do not use `<text>`, `<script>`, `<image>`, links, filters, or gradients.
3. Keep the file name and the `viewBox` when you replace a file. `tests/art-sizes.json` lists the sizes that the code uses.

## Folders

| Folder | Contents | Size |
| --- | --- | --- |
| `fx/` | Effects for element magic and shields | various |
| `item/` | Items and materials | 48 × 48 |
| `ui/` | Icons, and `seal.svg` (an empty seal stamp) | 48 × 48, 64 × 64 |
| `title/` | Parts of the bamboo on the title screen | 120 wide |
| `pattern/` | Pattern tiles: waves, clouds, flowers | 64 × 64 |
| `icon-*.png` | App icons, made from `logo.svg` | 180, 192, 512 |

## License

The art is under CC BY-NC-SA 4.0. Refer to `content/README.md`.
