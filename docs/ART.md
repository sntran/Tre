# Art and UI style guide

This guide is for all art and all screens of Tre. The game is for players from Pre-K to grade 12 (about age 4 to 18). The art must be clear for a 4-year-old and serious enough for a 16-year-old.

The style comes from **Đông Hồ woodblock prints**. Study the prints and follow their rules closely. Do not copy a real print. Make original art only.

All art in `art/` is a placeholder. An artist will replace it. New art must follow this guide.

## 1. Palette

Use only the colors below. They are the flat colors of natural pigments. The palette is in three files with the same values:

- `art/palette.json` (for artists and tests)
- `styles/palette.css` (CSS custom properties, for example `var(--vermilion)`)
- `src/render/palette.js` (for the Canvas code)

A test fails when an SVG file or the CSS uses a color that is not in the palette.

| Name | Value | Pigment and use |
| --- | --- | --- |
| `ink` | `#1f1b17` | Charcoal black (from burned bamboo leaves). All keylines, hair, text. |
| `ash` | `#6f685d` | Thin charcoal. Iron, stone shadows, far lines. |
| `ash-light` | `#a79f90` | Very thin charcoal. Stone, iron faces. |
| `paper` | `#efe3c8` | Warm dó paper. Backgrounds and panels. |
| `paper-deep` | `#dfcca6` | Old paper. Paths, soil, panel headers. |
| `diep` | `#f7f0df` | Điệp shell white. Highlights, clouds, the shimmer of the paper. |
| `vermilion` | `#b3412a` | Son (vermilion) red. Important marks, seals, clothes. |
| `vermilion-pale` | `#d4826a` | Thin vermilion. Flowers, fire, clothes. |
| `ochre` | `#a97835` | Earth ochre. Wood, bronze, straw. |
| `wood` | `#6e4a2c` | Dark ochre. Wood, bark, soil. |
| `yellow` | `#deae3c` | Hoa hòe (sophora) yellow. Straw, sun, fire, gold. |
| `yellow-pale` | `#ecd08a` | Thin hoa hòe. Light areas, sand. |
| `green` | `#56793f` | Leaf green. Plants, clothes. |
| `green-deep` | `#3b5a2e` | Deep leaf green. Shadows of plants, bamboo. |
| `green-pale` | `#98ad6b` | Thin leaf green. Grass, rice. |
| `indigo` | `#2f4668` | Chàm (indigo). Water, clothes, night. |
| `indigo-pale` | `#7d93ad` | Thin indigo. Water, sky, ice. |
| `skin-1` to `skin-4` | `#f0d6b0`, `#deb68a`, `#b98859`, `#8a5f3d` | Four earth tones for skin. |

Rules:

- Use flat fills only. Do not use gradients, soft shading, blur, glow, or transparency effects. Transparency is permitted only for ice, water bubbles, and steam in effects.
- Use few colors in one picture. A person has 3 or 4 colors plus ink.
- Leave areas of paper color visible, as in a print.

## 2. Line

- Draw black keylines (`ink`) like the cut lines of a woodblock.
- Line width in a 100-unit picture: 1.6 to 2.4 units. Use a small natural variation: outer contours are a little thicker (about 2.2), inner details are thinner (about 1.4 to 1.8).
- Use `stroke-linecap="round"` and `stroke-linejoin="round"`.
- Lines are firm and simple, with few details. Do not draw many small lines.
- Do not draw a second, offset outline. Do not draw soft shadows. A flat `ash` or darker color area can show a shadow side.

## 3. Paper

- The paper is dó paper: warm, with thin fibers (`art/paper.svg`).
- Điệp shimmer: a few small flecks of `diep` color on the paper. It must be subtle.
- Backgrounds and panels use the paper texture.

## 4. Patterns

Use the traditional patterns of the prints:

| Pattern | File | Use |
| --- | --- | --- |
| Water waves (sóng nước): rows of round wave scales | `art/pattern/waves.svg` | Water on the map and in battles, water borders |
| Clouds (mây): curled cloud forms | `art/pattern/clouds.svg` | Sky, steam, the top of scenes |
| Flowers (hoa): a small repeat of four-petal flowers | `art/pattern/flowers.svg` | Borders of panels and titles |

Pattern files are square tiles that repeat with no seams.

## 5. People

- Proportions: a child is about 4.5 heads tall. An adult is about 6 heads tall. Do not draw large "chibi" heads.
- Faces: small and simple features, as in the prints. Eyes are short curved or almond strokes. The nose is a small stroke. The mouth is a short line. No blush circles. No big round cartoon eyes.
- Expressions: give each person their own expression: calm, serious, surprised, happy, tired. Not all people smile.
- Dignity: the hero, the villagers, the legends, and the soldiers are people with dignity. Do not draw them as toys.
- Hands and feet: simple forms. Feet are often bare in Era 1.
- Enemy soldiers are ordinary people who follow orders. Never draw a caricature of any group. All faces use the same simple style.
- No blood. No weapons with sharp points or blades. Poles, shields, and staffs are blunt.

### Characters in the code

The code draws people from the bottom center of the picture. Keep these sizes:

| Picture | viewBox | Figure |
| --- | --- | --- |
| Child (hero, Gióng as a boy) | `0 0 100 150` | Feet at y = 146, top of head at about y = 14, about 32 units per head |
| Adult villager | `0 0 100 150` | Feet at y = 146, top of head at about y = 12, about 23 units per head |
| Tall adult (Thánh Gióng, the general) | `0 0 140 200` | Feet at y = 196, about 30 units per head |

Hero layers (`art/hero/`) are drawn in this order: `skin-*`, `clothes-*`, `face-*`, `hair-*`. They must line up:

- Head: center (50, 30), about 22 units wide and 30 units tall. Neck from y = 44 to y = 50.
- Shoulders at y = 52, from x = 36 to x = 64. Body from y = 50 to y = 92.
- Arms down the sides. Hands at about (33, 90) and (67, 90).
- Legs from y = 92 to y = 140. Feet from y = 140 to y = 146, at about x = 44 and x = 56.
- The `skin-*` layer has the skin of the head, the ears, the neck, the body, the arms, the hands, the legs, and the feet. Skins 1 to 4 use the colors `skin-1` to `skin-4`. The player chooses the skin tone apart from the face.
- The `face-*` layer has only the features of the face, in `ink`: brows, eyes, nose, and mouth. Faces 1 to 4 have the expressions calm, serious, surprised, and a small smile.
- The `clothes-*` layer covers the body and parts of the arms and legs. The girl clothes of Era 1 are a yếm and a long wrap skirt (váy) to the ankles.
- The `hair-*` layer covers only the top and back of the head. It must not cover the eyes (at about y = 31).

## 6. Creatures

Animals and creatures (for example the nghé buffalo calf, the thuồng luồng, birds, and fish) can be rounder and softer, as the animals of the prints are. They use the same keylines and flat colors, and simple eyes.

## 7. Time and place

Clothes, hair, buildings, boats, and tools must be correct for the time of each chapter. Era 1 is the time of the Hùng Kings and the Đông Sơn culture (the first millennium BCE):

- **Clothes:** men and boys wear a loincloth (khố) and sometimes a short sleeveless top. Women and girls wear a skirt (váy) and a short top or a yếm-like cloth. Belts and sashes. Bare feet.
- **Hair:** short hair, a top knot (búi tó), long hair tied at the back, braids around the head. Children can have small tufts.
- **Special people:** people of the court wear feather headdresses, as on Đông Sơn bronze drums.
- **Buildings:** houses on stilts (nhà sàn) with long, curved, boat-shaped roofs of thatch. The village hall is a large house on stilts. There are no tiled roofs, no đình buildings, and no village gates with tiled roofs in Era 1.
- **Boats:** long wooden boats and dugout canoes, some with a bird-head prow.
- **Tools:** bronze and stone tools, clay jars, bamboo baskets. Iron is new and rare.
- **Plants:** bamboo, banana plants, reeds, rice, lotus, banyan trees. Do not draw palm trees in the villages of the Red River delta.

Văn Miếu scenes are from later times (the Lý to Lê dynasties, 11th to 18th century): tiled roofs, stone steles on turtles, scholar robes and caps.

### Bamboo

Bamboo is the symbol of the game. Draw it correctly:

- Straight stems with clear joints (a ring at each node) at regular distances.
- Narrow, pointed leaves in small groups on thin side branches.
- A clump has several stems of different heights.

## 8. UI

- **Panels:** thin woodblock borders, like the frame of a print: an outer `ink` line of 2 px and an inner line of 1 px, with small corners (3 to 4 px). The panel has the paper texture. No soft bubbles and no soft shadows.
- **Buttons:** flat color, `ink` border of 2 px, small corners. The pressed state moves down 2 px. Primary buttons use `vermilion` with `diep` text. Other buttons use `yellow` or `paper`.
- **Seal stamps (triện):** important markers use a red seal: a `vermilion` square with a thin inner line and `diep` text. Use seals for the "Legend" and "History" labels, for titles (Tú tài and more), and for the name of the game.
- **Icons:** simple woodblock marks with `ink` lines and one or two flat colors. No round bubble behind an icon.
- **Fonts:** two fonts, both in `fonts/`, both with all Vietnamese marks:
  - Display (titles and names): **Alegreya** Bold, a serif.
  - Body (all other text): **Be Vietnam Pro**, a sans-serif made for Vietnamese.
  A test checks that the two fonts have each character of `i18n/vi.json` and `i18n/en.json`.
- **Touch targets:** 48 × 48 px or more, 56 px or more for the main actions.
- **Măng non stage (Pre-K and K):** the same art style, with larger buttons and simpler panels. Add the attribute `data-stage="mang-non"` to the `<html>` element to use the larger sizes.

## 9. Do and do not

| Do | Do not |
| --- | --- |
| Flat colors from the palette | Gradients, soft shading, glow |
| Thin keylines with a small variation | Thick, even cartoon outlines |
| People about 4.5 (child) or 6 (adult) heads tall | Big chibi heads |
| Small, simple faces with different expressions | Blush circles, big round eyes, a smile on every face |
| Clothes and buildings of the time of the chapter | Tiled roofs, đình, or khăn đóng in Era 1 |
| Straight jointed bamboo with narrow leaves | Palm trees in a Vietnamese village |
| Wave, cloud, and flower patterns | Realistic water or sky |
| Seals (triện) for important labels | Soft rounded bubble labels |
| Dignity for all people, also enemies | Toy-like people, caricatures of any group |
| Original art in the style of the prints | Copies of real Đông Hồ prints |

## 10. Files

- Keep the file names and the `viewBox` of each file. The code uses them.
- Use SVG with a `viewBox` and no `width` or `height`.
- Do not use `<text>`, `<script>`, `<image>`, links to other files, filters, or gradients.
- Keep files small (most files under 6 KB).
