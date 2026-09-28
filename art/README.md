# Art

All art in this folder is a **placeholder**. An artist will replace it later.

## Style

The style comes from Đông Hồ folk paintings. All art is original. It does not copy a real painting.

- Flat colors, bold black outlines, and simple round shapes.
- A small set of natural colors: red, yellow, green, indigo, black, and a warm paper white.
- A paper texture in the background (`paper.svg`), as on dó paper.
- No text in the images. All text comes from `i18n/`.
- No blood, no weapons with sharp points, and no scary faces. Enemy soldiers look like ordinary people.
- No caricature of any group of people.

## Colors

| Name | Color | Light |
| --- | --- | --- |
| Red | `#b8412c` | `#d9765f` |
| Yellow | `#e5b53a` | `#f1d27a` |
| Green | `#4f7a3a` | `#8fb069` |
| Indigo | `#2e4a7d` | `#6f8fbf` |
| Black (outline) | `#1d1a17` | |
| Paper white | `#f3e9d2` | `#e3d3b0` |
| Supporting | brown `#8a5a3b`, iron `#5f6468`, bronze `#b0823f` | |

## Rules for new art

1. Use SVG with a `viewBox` and no `width` or `height`.
2. Do not use `<text>`, `<script>`, `<image>`, external links, or filters.
3. Put the feet of a character at the bottom center of the `viewBox`.
4. Keep the same `viewBox` when you replace a file. The code uses these sizes.

## Folders

| Folder | Contents | Size |
| --- | --- | --- |
| `hero/` | Hero layers in this order: `face-*`, `clothes-*`, `hair-*` | 100 × 150 |
| `npc/` | Village people. `giong-hero` and `giong-bamboo` are 140 × 200. | 100 × 150 |
| `enemy/`, `friend/` | Enemies and the creature friend | various |
| `map/` | Objects on the village map (1 tile = 48 units) | various |
| `battle/` | Battle backgrounds (side view, ground at y = 430) | 960 × 540 |
| `fx/` | Effects for element magic and shields | various |
| `item/` | Items and materials | 48 × 48 |
| `thing/` | Story objects | various |
| `ui/` | Icons | 48 × 48 |
| `calling/` | Emblems of the five callings | 96 × 96 |
| `title/` | Parts of the bamboo on the title screen | 120 wide |
| `icon-*.png` | App icons, made from `logo.svg` | 180, 192, 512 |

## License

The art is under CC BY-NC-SA 4.0. Refer to `content/README.md`.
