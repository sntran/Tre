# Art

All art in this folder is a **placeholder**. An artist will replace it later.

The style guide is [docs/ART.md](../docs/ART.md). All new art must follow it.

## Style in short

The style comes from **Đông Hồ woodblock prints**. All art is original. It does not copy a real print.

- Thin black keylines like a woodblock print, with a small natural variation in weight.
- Flat colors from natural pigments only. No gradients and no soft shading.
- The palette is in `palette.json` (the same values are in `styles/palette.css` and `src/render/palette.js`). A test fails when a file uses another color.
- Dó paper with a small điệp shimmer (`paper.svg`).
- The traditional patterns: water waves, clouds, and flowers (`pattern/`).
- Children are about 4.5 heads tall, adults about 6. Small, simple faces with different expressions.
- Clothes, buildings, boats, and tools are correct for the time of the chapter. Era 1 is the time of the Hùng Kings (Đông Sơn culture).
- No text in the images. All text comes from `i18n/`.

## Rules for files

1. Use SVG with a `viewBox` and no `width` or `height`.
2. Do not use `<text>`, `<script>`, `<image>`, links, filters, or gradients.
3. Keep the file name and the `viewBox` when you replace a file. `tests/art-sizes.json` lists the sizes that the code uses.
4. Put the feet of a character at the bottom center of the `viewBox`.

## Folders

| Folder | Contents | Size |
| --- | --- | --- |
| `hero/` | Hero layers in this order: `face-*`, `clothes-*`, `hair-*` | 100 × 150 |
| `npc/` | Village people. `giong-hero` and `giong-bamboo` are 140 × 200. | 100 × 150 |
| `enemy/`, `friend/` | Soldiers, creatures, and the creature friend | various |
| `map/` | Objects on the village map (1 tile = 48 units) | various |
| `battle/` | Battle backgrounds (side view, ground at y = 430) | 960 × 540 |
| `fx/` | Effects for element magic and shields | various |
| `item/` | Items and materials | 48 × 48 |
| `thing/` | Story objects | various |
| `ui/` | Icons, and `seal.svg` (an empty seal stamp) | 48 × 48, 64 × 64 |
| `calling/` | Emblems of the five callings | 96 × 96 |
| `title/` | Parts of the bamboo on the title screen | 120 wide |
| `pattern/` | Pattern tiles: waves, clouds, flowers | 64 × 64 |
| `icon-*.png` | App icons, made from `logo.svg` | 180, 192, 512 |

## License

The art is under CC BY-NC-SA 4.0. Refer to `content/README.md`.
