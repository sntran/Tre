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

## 11. The voxel world

The world is made of blocks and drawn with three.js (`src/render/voxel.js`). There are no image files for the world: every house, plant, and prop is a function in `src/world/props/` that sets blocks, with parameters and a seed. `docs/reference/voxel-village.html` shows the target look.

- **Two grids:** the ground has full blocks, one column for each map cell. Buildings, plants, props, and people use half blocks (the fine grid): 2 × 2 × 2 fine blocks fill one ground block. The top of a column is the height digit of the map + 1.
- **Map units:** one map cell is one ground block. A house of the village stands on about 6 × 6 cells. A person is about as tall as the posts of a house on stilts.
- **Three flat tones:** each block face uses the color of the block from `art/palette.json`: the top face in the full color, the faces to the front-left in the lit tone, the faces to the back-right in the dark tone (see `shades`). The bottom face is darker. No gradients and no lighting in the shader.
- **Ink:** one ink mesh for each map. A line goes only where a face meets a face of another color, where a face has an open edge, or where the surface folds. So a wall of one color has no lines between its blocks. The lines are thinner on the half blocks than on the ground.
- **Roofs:** thatch roofs are smooth slopes, not blocks. The ridge sweeps up at the ends like a boat, and ink lines show the thatch. The đình has a vermilion ridge and bird-head finials, as on the bronze drums.
- **Water:** the river has the wave pattern of the prints and moves slowly. The paddies are still, pale water with rows of seedlings.
- **One light** from the front-left. Houses, trees, and bamboo make flat shadows to the back-right on the ground; the ground under the floor of a house is in shadow too. People have a soft round shadow.
- **Paper:** grain and a soft vignette go over the whole frame.
- **Ghosting:** a thing between the camera and the hero fades as one whole object (its box), not in parts. The ink lines stay; the color goes.
- **People and animals** are figures of parts (`src/world/figures.js`): legs and arms hang from their tops and swing when the figure walks. Nghé moves its diagonal legs together. The looks of the people are in `data/figures.json`. The choices of hero creation (skin, face, hair, clothes, girl or boy) give the colors and the shapes of the parts of the hero. The pictures of section 5 stay for the portraits in the dialogues and the top bar.
- **Heights:** water is 0, the river bank and the paddies are 1, and the ground is 2. The dikes between the paddies are one step higher than the paddies. The đình stands on a mound (3). The edges of a map rise in terraces. A person can step up or down one step. A higher step is a cliff.
- **The day and the night:** a day is about 8 minutes of play. At dusk an indigo wash covers the frame (a multiply layer), the ink goes softer, and each lit lantern cuts a warm pool of light in the wash. Fireflies blink over the water at night. The doors of the houses go dark when the families are in. On some days it rains: lines of rain in the indigo of the prints fall, the light is a little grey, and the river rises one block.
- **Things to place (the planks of the bridge):** a new plank is one half block wide in units of one half block. The units are `yellow-pale` and `ochre` in turn, each with an ink outline and a small `vermilion` dot painted on top, so that the child sees the length and can count it without a number. The hero carries a plank on the right shoulder, with the same units and dots. When the bridge takes solid form, the planks turn into deck boards (`wood` and `ochre` in turn, across the whole bridge, on two beams), with a puff of dust. A plank that dips under the hero stays on its place for two seconds, and red frames over the water (the red of the dots) show each missing unit of the gap. A plank that falls into the water makes a splash of white drops. The prediction row is six plank outlines in pale bars on the sand; the chosen ones fill with pale wood. Nghé gives a hint from the bank: it stretches its neck long and low toward the gap. No number and no text is written on a thing in the world.
- **The river in the rain:** when the river is high, the stones of the ford are under the water, and the ford is closed until the river is down again (about one game hour after the rain).
- **Animals and people in motion:** animals move in short runs with stops; people walk at a steady pace; nothing slides. The numbers are in `data/world/life.json` and `data/world/people.json`, not in code.
- **Camera:** orthographic, from the front-left and above. It turns in steps of 90° (the buttons at the bottom right, or Q and E), and it has two zoom levels (pinch, or the wheel). It follows the hero with a soft lag.

## 12. The country map

The country map is drawn by the code from real map data (`data/geo/vietnam.json`, made by `tools/geo/build.mjs`), in the style of an old map on dó paper:

- **Sea:** the wave pattern (`art/pattern/waves.svg`) on `indigo-pale`.
- **Land:** the land around Vietnam is `paper-deep`. The land of Vietnam in the era of the story has the areas of the regions in `green-pale`, `yellow-pale`, `paper`, and `vermilion-pale`, with ink borders. The land to the south of the era is faint (`diep`, with `ash-light` borders), and it has no names.
- **Mountains:** three flat bands of ink at 7 % each (so 7, 14, and 21 % where they stack) for the heights above 300, 800, and 1500 m, with smooth edges, and small ink hill marks on high land. No gradients.
- **Water:** rivers are `indigo` lines (the Hồng and the Mê Kông are wider). Lakes are `indigo-pale`.
- **Islands:** each small island of Hoàng Sa and Trường Sa is a small dot with an ink line, so that it shows at every size. The names Hoàng Sa and Trường Sa are on the map.
- **Seals:** each region has a seal at its center place: the face of the hero on the region of the hero, the chapter number on an open region, and a red square seal with a lock on a region that is not open yet. Seals that are near each other move apart, and a thin ink line goes to the real place.
- **Names:** the names of the places of the open regions, in the display font, with a thin paper edge.
- **Roads and river ways of travel:** roads are dashes in `wood`, river ways are short dashes in `indigo`. The way to the chosen region is a thick `vermilion` line.
- **The hero:** a small `vermilion` diamond at the real place of the map of the hero.
- **Lines** keep the same width on the screen at every zoom.

## 13. The raids

The things of a raid are plain voxel figures (`raidThing` in `src/world/figures.js`, looks in `data/figures.json`), with flat colors of the palette:

- **Distance posts:** a `wood` pole with an `ink` cap and one to four `vermilion` bands (5, 10, 15, 20 half blocks). No numeral.
- **Traps:** a frame of `ochre` bamboo with `yellow` jaws and a `vermilion` spring; the jaws close when it snaps.
- **The gate bar:** a `yellow` bamboo bar with a `vermilion` tie, up at the side or down across the way.
- **Sources:** the jar (`ochre`, with `indigo-pale` water), the brazier (`ink`, with a `vermilion` and `yellow` flame), and the small forge (`ash`, with a rod and a `yellow` tip).
- **Fire, stones, torches, wet ground:** a torch that burns on the road, a small `ash` stone, and wet ground as a flat `indigo-pale` pool.
- **Poses and things in the hand:** a scout holds up a lit torch (the tell), a soldier raises an `indigo` shield, the general lifts his staff (no blades), an enemy on a trap sits, and Nghé lowers her horns.
- **Marks over the world:** a row of dots over each enemy (`vermilion` for a hit that it can still take, `paper` for a hit taken), red dots that pop up at a hit, the band of the slingshot in `wood` with an `ink` tick at each step and a `vermilion` band at every fifth step (the marks of the posts), and no arc before the shot. A post that waits for the prediction has a `yellow` cap. A rice ball for the river serpents is `diep` white with a `green` leaf. An element on its way is a thick line in its color (`indigo` water, `vermilion` fire, dashed `yellow` lightning).

