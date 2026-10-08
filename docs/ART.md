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
| Rocks, stones, and other things in irregular shapes: lumps of different sizes, a top off the middle | A thing of the world in the shape of a digit or of the sign of an operation (+, −, ×, ÷, =): the child reads it as math |
| Decoration that is part of the ground: small smooth flowers (a short stem and a flat head of petals, about a quarter block, no outline) in patches of three to seven | Decoration that looks like a thing that the child can carry (a block with an outline, as the stones of the cart) |

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
- **Four tiers of the look: blocks where the child counts, curves where the world flows.**
  - **Full blocks:** the ground, the dikes, the walls, the planks, the stakes: anything that is placed or counted. The grid is the math, and it stays.
  - **Half blocks:** houses, fences, furniture, and the things of the village.
  - **Quarter blocks:** the figures (section 15), and the small props that the child handles.
  - **Smooth meshes** in the flat tones of the palette, with ink at the silhouette only: everything living and round (`src/world/smooth.js`). A tree crown is three or four overlapping low blobs; a bamboo culm is a thin segmented cylinder with a dark ring at each joint and fans of narrow leaves; banana leaves are curved planes that arch out and droop; a haystack is a cone of straw in bands; a bush is two blobs; the banyan has hanging roots as curves; the roofs are smooth slopes. The tone of a smooth face comes from its normal, as the tone of a face of a block (the top lit, the sides lit or dark). Rocks stay blocky: rocks are blocky. The water is one plane (below).
- **Ink:** one ink mesh for each chunk (16 × 16 columns). A line goes only where a face meets a face of another color, where a face has an open edge, or where the surface folds. So a wall of one color has no lines between its blocks. The lines are thinner on the half blocks than on the ground. A smooth look has ink at its silhouette (a hull a little out from it, drawn from the back), and a leaf has ink at its edges. The edge lines of a leaf are inner lines: when the look fades, they fade with it, and only the hull stays as its outline (on a thin leaf, the edge lines are most of the leaf).
- **Roofs:** thatch roofs are smooth slopes, not blocks (`src/world/roofs.js`). The ridge sweeps up at the ends like a boat, and ink lines show the thatch. The đình has a vermilion ridge and bird-head finials, as on the bronze drums. Some houses of the hamlets have a round roof: a low oval shell of thatch, long along the house, about half as tall as the house is wide, with its eaves below the top of the walls (`roundShell`).
- **Water:** the river is one plane with the wave pattern of the prints, and it moves slowly. Where the water meets the bank, a narrow strip of the pale tone shows (the soft edge of a mask of the water cells; no new geometry). The paddies are still, pale water with rows of seedlings.
- **One light** from the front-left. Houses, trees, and bamboo make flat shadows to the back-right on the ground; the ground under the floor of a house is in shadow too. People have a soft round shadow.
- **Paper:** grain and a soft vignette go over the whole frame.
- **Ghosting:** a thing between the camera and the hero fades as one whole object (its box), not in parts. It fades as a stipple (an ordered dither, as the dots of a print), so that the world stays one opaque mesh for each chunk. There is no stipple under a fade of 0.3, so that a thing that only touches the line of sight gets no light scatter of dots, and a fade goes back to exactly 0 when the line leaves the thing. Its ink outline stays fully drawn, so that it still reads as a shape; the lines inside it go. The rules are in `src/world/fade.js`.
- **People and animals** are figures of parts (`src/world/fine.js`, and `src/world/figures.js` for the far level; see section 15): legs and arms hang from their tops and swing when the figure walks. Nghé moves its diagonal legs together. The looks of the people are in `data/figures.json`. The choices of hero creation (skin, face, hair, clothes, girl or boy) give the colors and the shapes of the parts of the hero. The portraits in the dialogues, the top bar, and the cards are rendered from the same figures (section 17).
- **Heights:** water is 0, the river bank and the paddies are 1, and the ground is 2. The dikes between the paddies are one step higher than the paddies. The đình stands on a mound (3). A person can step up or down one step. A higher step is a cliff. The land has no map edges: it goes on (`docs/WORLD.md`, "One continuous world").
- **The day and the night:** a day is about 8 minutes of play. At dusk an indigo wash covers the frame (a multiply layer), the ink goes softer, and each lit lantern cuts a warm pool of light in the wash. Fireflies blink over the water at night. The doors of the houses go dark when the families are in. On some days it rains: lines of rain in the indigo of the prints fall, the light is a little grey, and the river rises one block.
- **Things to place (the planks of the bridge):** a new plank is one half block wide in units of one half block. The units are `yellow-pale` and `ochre` in turn, each with an ink outline and a small `vermilion` dot painted on top, so that the child sees the length and can count it without a number. The hero carries a plank on the right shoulder, with the same units and dots. When the bridge takes solid form, the planks turn into deck boards (`wood` and `ochre` in turn, across the whole bridge, on two beams), with a puff of dust. A plank that dips under the hero stays on its place for two seconds, and red frames over the water (the red of the dots) show each missing unit of the gap. A plank that falls into the water makes a splash of white drops. The prediction row is six plank outlines in pale bars on the sand; the chosen ones fill with pale wood. Nghé gives a hint from the bank: it stretches its neck long and low toward the gap. No number and no text is written on a thing in the world.
- **The river in the rain:** when the river is high, the stones of the ford are under the water, and the ford is closed until the river is down again (about one game hour after the rain).
- **Animals and people in motion:** animals move in short runs with stops; people walk at a steady pace; nothing slides. The numbers are in `data/world/life.json` and `data/world/people.json`, not in code.
- **The generated land** (`docs/WORLD.md`, "One continuous world"): the same blocks and tones as the story places. Rice paddies in blocks of five cells with dikes; near a hamlet on a gentle slope they step down as terraces. The hills are real (SRTM): they rise in steps of one block where they are gentle, and where they are steep the higher block is a rock face of stone in two tones (`ash` and `ash-light`), so that the ink draws the cracks between them. Forest grows on the hills: trees close together, bamboo, and rocks. A path up a hill turns back and forth where a straight path is too steep. A hamlet has houses on stilts from parts (walls of woven bamboo, lime, or earth; thatch in ochre, yellow, or wood; a door of wood, indigo, or green), with firewood under the floor, corn under the eaves, or baskets on the veranda. The areca palm (cây cau) has a thin ringed trunk and a tuft of fronds. A boat can have a curved cover of woven bamboo (mui).
- **The hill forest:** the forest of the hills has clearings, and the trees have three sizes of crown (one, two, or four blobs; a taller trunk for a larger crown). A crown is at least about 2.5 times as wide as its trunk: a small crown has a trunk of one fine block, so that a small tree is not a lollipop. Bamboo grows in groves, rocks lie on the slopes, and the tops of the hills stay open, so the shape of a hill reads from far.
- **The far land and the paper:** the view draws 9 × 9 chunks around the hero. The 5 × 5 near chunks have the full look. The far chunks have a coarse look: the tops of a row of the ground merge into one quad (a step is one quad), a crown is one blob, and they have no ink and no flowers. From about 2.6 chunks out to about 4.2 chunks, the land fades into the paper (`uFar` in `src/render/voxel.js`), so the camera never shows the end of the drawn land.
- **The mist:** beyond the land of the era, the land goes to the dó paper of the panels over 12 cells, as an old map that stops where the mapmaker did not go, in three stages: first the colors go pale, then only the ink lines stay (the faces are paper), then the paper with its grain of short fibers and specks. Things in the mist go through the same stages with the ground under them, so a thing in the mist is never a solid shape.
- **The ferry:** a dugout with a bird-head prow, as the boats on the bronze drums. The ferryman stands at the stern in a nón with a long pole; while the boat moves, he pushes the pole down and back with both hands.
- **The sea:** the same wave plane as the river, over a bed that goes down in steps: the surf (three cells, to the knee) and then the deep sea. The surf and a ford are lighter than deep water. In the surf the legs of a figure go under the water line. A line of foam lies on the sand at the edge of the water and moves up and back in held steps (`foam` in `src/render/voxel.js`). The beach is sand.
- **The things of the small events:** each thing shows its units, so that its size is seen and never written: stones in a net (one, two, or five), pails of water on a carrying pole (one, two, three, or five), and bowls of rice (bát gạo, #42: a bowl of glazed clay on a small foot with a blue band, full of rice; one rice to a bowl). The goods of a seller lie on a flat tray of woven bamboo in rows of five (fish, eggs, or small clay pots), so that the child sees how many she has. The mud under a stuck cart, a small ditch, a reed mat, and a low pen of woven bamboo show where the things go.
- **Camera:** orthographic, from the front-left and above. It turns in steps of 90° (the buttons at the bottom right, or Z and C), and it has two zoom levels (pinch, or the wheel). It follows the hero with a soft lag.

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


## 14. The work of the story

The things of the four tasks of the story (`docs/TASKS.md`) are plain voxel figures too (`workThing` in `src/world/figures.js`, looks in `data/figures.json`):

- **Rice for Gióng:** a tray of three or five `diep` bowls with `yellow` rice; the pot shows the bowls in it (none to nine) beside it. Gióng as a boy grows one step for each ten (`giong-boy-1` to `giong-boy-5`, a larger scale each step). The count shows on his height, not as a number.
- **The iron horse:** the bellows (a `wood` box with an `ochre` lid, an `ink` pole and nozzle), lumps of `ash` ore in the hearth, and the iron horse on the anvil: an `ash` body, neck, and head, `ink` legs and tail, and a `vermilion` mane.
- **The bamboo staffs:** a green stem (`green` and `green-pale` parts, with a `green-deep` ring at each half block, and a pale cut end); a bundle of long `green` staffs with a `vermilion` band.
- **The loot:** a small sack of rice tied at the top (`yellowPale`, with an `ochre` tie; Era 1 has no coins, #26), and a small reed mat for each friend. The hero's mat has the basket of the hero; Gióng stands behind his mat, and Nghé walks to hers. Nghé turns away and shakes her head at an unfair share.

The SVG art of the old crafting screen and the old battle (`art/thing/anvil.svg`, `bamboo-stalk.svg`, `forge-fire.svg`, `iron-horse.svg`, `iron-staff.svg`, `iron-staff-broken.svg`) is removed.

## 15. The figures

The people and the animals are finer than the land: they are built on a grid of quarter blocks (`src/world/fine.js`, `FIGURE_UNIT` 0.25), and each keeps its size in the world. `docs/reference/figures.html` is the review of the figures, drawn by the code of the game: every figure of `data/figures.json` (and the hero of each gender, the hair choices, and each hat on a grown-up) is a piece of a board game, on a round base of quarter blocks in wood with the ink outline, on a square of dó paper, with its name under the rim (`src/world/pieces.js`, `pieceBase` in `src/world/figures.js`). A tap lifts a piece up close: a drag turns it all the way around and tilts the view from the height of the eyes to the view from above, a pinch or the wheel zooms, two taps go back to the first view, and the piece turns slowly when nobody touches it. The switches show the walk, the wind (none, a breeze, full), each mood, the night, and the far level, and two buttons put the camera at the angle and the size of the view of the game at the near and the far zoom. The address keeps the piece and the switches (`figures.html?look=grandma&mood=happy&pose=walk&wind=full`), so that an issue can link one figure. `node tools/figures-check.mjs` opens the page headless and checks that it draws with no error.

- **A head with a large flat face.** A head is a rounded box: the front of the face is about 6 units wide and 5 to 6 tall, the vertical edges are cut by half a unit, the top is round under the hair, and there are ears. There are no steps under the chin. One short neck in the next darker tone of the skin (`skin1` → `skin2` ... `skin4` → `wood`), set back a little, reads as the shadow under the chin. The torso has hips as wide as the sash, a waist over the sash, and a chest one unit narrower up to the sloping shoulders; it is 4 units deep for a child and 4.5 for a grown-up, so that the turning preview of hero creation is not a flat board from the side. Grown-ups have a wider torso than children, and about the same head (a print convention). The barrel of Nghé and the body of a chicken or a dog have their long edges cut by one unit. The horns of Nghé curve out, up, and back in three steps. The nón lá is a stepped cone.
- **Two faces by age** (`look.child`: the hero, Gióng as a boy, and the children of the hamlets are children). Both have eyes with a white, a dark dot, and a small white highlight, brows, and a mouth line. A grown-up has the eyes at the middle of the head, a jaw that is narrower at the sides, a small nose with no ink (the part flag `noInk`), the brows over the eyes, and cheeks in the pale tone of the skin. A child has the eyes lower on the head under a large forehead, larger and darker and a little wider apart; thin short brows; a small mouth close to the eyes (soft brown, or vermilion for a smile and the open mouth); a short round lower face with a soft chin; rosy cheeks (`vermilionPale`); and no nose. The four faces of `data/figures.json` keep their differences (a smile, eyes set higher, a small open mouth), and the four moods of the portraits keep their meaning.
- **Hair that differs from the front.** The hair is a cap over the top, the back, and the sides to the ears, with its front edge in front of the skull, so that no strip of scalp shows. Each style adds its own parts: `short` a fringe parted on the left, in locks of different lengths, over the brows but never over the eyes; `topknot` the hair pulled back to a knot on the crown with a red tie; `long` a part in the middle and the hair on both sides of the face, down to the shoulders and over the back; `braids` a part in the middle and two braids in front of the shoulders with red ties; `bun` the hair pulled back over the temples to a low bun with a pin; `tufts` the tuft of a child (trái đào) on a short crop. Grey hair keeps the grey color with the shape in `hairStyle` (`data/figures.json`: a bun for grandma and the healer, short for the elders with a beard; an old villager takes the shape of the body). The hats (the nón, the band, the helmet, the plume) sit on the top of each style, and a hat that covers the top hides a knot or a tuft: no hair goes through a hat.
- **Clothes.** The áo has sleeves that hang over the hands and a collar line; the sash has a tail; trousers, shorts, and skirts have a hem. Feet are bare, with two toes.
- **Hands.** A hand is a small block, and the things in the hands (a staff, a hammer, a lantern, a tray of bowls, a plank on the shoulder) hang on the hand (`src/world/parts.js`, the same list for both levels).
- **Animals.** Nghé, the buffalo, the dog, the chickens, the ducks, and the fish get the same pass: a rounded body, a head with eyes and a muzzle or a beak, and legs that bend at one joint.
- **The walk.** A knee bends while its leg swings through, the heel lifts behind, and the head bobs a little with each step (`src/world/animate.js`).
- **The ink.** The outline around each part has the same thickness in the world at both levels (`HULL` in `src/render/figure3d.js`), so the fine figures are not darker than the coarse ones. The marks of a face have no outline.
- **The far level.** A figure far from the hero draws its coarse version (`person` in `src/world/figures.js`: the same proportions, a large head with the eyes of its age, the short neck, and the outline of each hair style: long hair, braids, a topknot, a bun, a tuft), at the same height in the world, and a figure out of the view draws nothing (`src/world/lod.js`). The line follows the zoom of the camera: 30 blocks at the near zoom and 45 at the far zoom, each with a small hysteresis (one block to each side), so that nothing pops at the edge.
- **Hair, cloth, and tails move.** The parts that hang have one pivot each and a kind (`hang` in `src/world/parts.js`): a tail of hair, the braids, the tail of the sash, and the strings of the nón hang and swing; the skirt and the sleeves swing a little; the fringe lifts in the air from the front; a topknot, a bun, and tufts bob; the ears and the tail of Nghé, the tail of the dog, and the tail feathers of the rooster move too. Their angle follows the air that the figure feels (the wind of the world minus its own velocity) with a lag: a step swings them, a stop lets them settle, and a run streams them back (`src/world/sway.js`). The target snaps to a few positions and the angle eases to it, so that the motion reads as a print, with no jiggle. Until the weather of #12, the wind is a soft breeze with a slow swell (`breezeAt` in `src/core/world/systems/sky.js`). The figures page has a column "in the wind", with the breeze at full strength.
- **The portraits.** A portrait frames the head by the cap of the hair or the hat, with the lower half of a knot or a tuft, so that a tall knot does not make the face small (`crown` of a figure, `faceFrame` in `src/world/portraits.js`). The hair choices of hero creation show the head turned about 30 degrees, so that a bun and long hair show.
- **The cost.** All the parts of all the figures are one instanced mesh, their outlines one more, and their shadows one more. The part count of each kind of figure stays under a limit in `data/config/limits.json` (a person has about 50 parts, Nghé 37).


## 16. The world at rest

The world moves when the child does nothing (`docs/WORLD.md`, "The world at rest"). The motion is slow and in steps that read as a print, never smooth like a video: a sway is two or three held positions with a soft ease between them.

- **Leaves.** The crowns, the bushes, the tops of the bamboo, and the banana leaves sway in the vertex shader of the world mesh (`swayOf` in `src/render/voxel.js`), each with its own phase from its position. The weight of the sway is 0 at the foot of a look and grows to its top, so a trunk does not move. A gust is a wave: first the seedlings of the paddies bend in a row, then the hedges, then the trees, a few seconds apart.
- **Water.** The waves of the river move downstream slowly. The ford has rings around its stones, and a boat has a wake. The paddies are still, with a slow shimmer of light rows.
- **Smoke and steam.** At the meal times smoke rises from the ridge of each kitchen roof as a column of small boxes that grow, drift with the wind, and go: dark (`ash`) when young, then pale (`ash-light`). The rice pot steams in `diep`, and a thin thread of incense rises at the đình all day. All the puffs are a function of the time only, so they look the same at any frame rate (`src/render/ambient3d.js`).
- **Things in the wind.** A flag on a pole at the đình, laundry on a line by some huts, and a kite over the school on windy days. They are smooth sheets that the wind moves.
- **Sky life.** Birds cross the sky at dawn and dusk. Butterflies (`yellow-pale` and `diep`) loop over the flowers by day, a dragonfly (`indigo`) darts from paddy to paddy and hangs still, and a fish jumps at the ford now and then.
- **The small joys** are small figures of the same print: a duckling is a yellow ball on two legs; the frog is green and flat on a lily pad with one pale bud; the kingfisher is `indigo` with an `ochre` belly on a stake; the golden shoot is rings of `yellow` and `yellow-pale`; a puddle is a flat pool of `indigo-pale` with one glint; the pot of bánh chưng is a dark pot on three stones over a small fire, with square cakes in green leaves tied with pale strings; the lion of the dance has a `vermilion` head with wide eyes and a horn, a `yellow` body of cloth with red stripes, and four legs in `indigo` trousers. At Tết the trees have peach blossoms (`vermilion-pale` and `diep` dots on the crowns), and each door has two `vermilion` couplets with no writing. A shooting star is a short pale line over the top of the night frame, in steps. A firefly on the horn of Nghé blinks in two steps.
- **No text and no count.** A joy never has a label, a number, or a mark over it.

## 17. The portraits

One look for each person: the portraits are rendered from the voxel figures, not drawn. A new villager or a new creature gets its portrait from its look in `data/figures.json`, with no new art.

- **The renderer** (`src/render/portrait.js`) draws one figure (the fine level, section 15) into a render target of the one renderer of the game (`src/render/gl.js`), off the screen, and copies the image to a small canvas. No second WebGL context. The same three flat tones, the same ink outline, and the same light from the front-left as in the world, on a clear background: the box around a portrait gives the paper.
- **Framings:** `head` (the head and the neck: the head fills about 80 percent of the height; the skin, face, and hair buttons of hero creation), `bust` (the head fills about 60 percent of the height, cut at the collarbone: the dialogue box, the corner of the HUD, the cards of the title, the list of the parent area, the seal of the hero on the country map), and `full` (the whole figure: the callings, the clothes buttons and the turning hero of hero creation, the notebook). A face turns a little from the front (20 degrees for `bust`, 15 for `head`; a head of blocks shows much of its side, so this reads as about 30), and the camera is only a little over the eyes, so that the face and its mood read at small sizes. The numbers are `FACE_FRAMES` in `src/world/portraits.js`.
- **The buttons of hero creation** fit their words (#37): the choices that are pictures (skin, face, hair, clothes) are square tiles, and the choices that are words (boy or girl, the grade) are word buttons, as wide as the word needs, on one line (`.tile-btn.word` in `styles/main.css`). `node tools/fit-check.mjs` opens each screen of hero creation (a new adventure and the short creation of a practice link) at a width of 360 px, in Vietnamese and in English, and fails when a label is wider or taller than its button, a button goes past the screen, a word breaks between two lines, or a tile shows its word on two lines. At 360 × 740 and 390 × 844 it also opens Văn Miếu, the choice of a calling, and fails when the main button of a screen (`.main-btn`, or a button in `.main-actions`) is not fully on the screen (#51). The main buttons stay at the bottom edge when the screen scrolls (`position: sticky`), and the seal of a panel (Legend, History) has its own line above the text.
- **Moods:** `calm`, `happy`, `worried`, and `surprised`, made from the brows and the mouth of the face (`src/world/fine.js`). A line of the dialogue data can name a mood (`mood`); without one, the face is calm.
- **Props as views:** a prop of the world can also be a view (`views` in `data/figures.json`): the gate of Văn Miếu and the stele on its turtle are blocks, as in the world (`src/world/props/things.js`), with their ink lines drawn a little wider.
- **Cache:** the key is the look, the framing, the mood, the size, the pixel ratio, and the turn (`src/world/portraits.js`). The same key gives the same image. At most 64 images stay (the one that was used last goes out first). At most one portrait renders in a frame; the village renders the hero, Nghé, and the people of the map when the map opens, so that a dialogue never waits.
- **Hero creation:** the preview is the voxel hero, at 16 turns, that steps around slowly (a drag turns it), and each choice button shows the hero with that choice (`head` for the skin, the face, and the hair; `full` for the clothes). The choices are in `data/figures.json` (`hero`).
- **The notebook of #8** draws its prints of people, creatures, and places with this renderer (`portraitCanvas` in `src/ui/portraits.js`; a view of a place is a prop look `{ prop, w, h, seed }`). It makes no new pictures.
- **What stays SVG:** the small UI icons (`art/ui/`), the items (`art/item/`), the logo and the app icons, the paper, the patterns of frames, and the bamboo of the title screen. These are graphic design, not pictures of things in the world.

## 18. The ground

The ground is printed, not a flat color. The texture is in the shader (`GROUND_GLSL` in `src/render/voxel.js`) and costs no geometry. Each top face of the ground gets its kind and the direction of its road as attributes (`surface` and `soil`, from `surface` in `src/world/terrain.js`), and the strip of a road over it (`strip`), and a chunk gives the same values alone and in a ring.

- **The rules of the print.** All patterns are fixed on the land (world units), so they do not slide when the camera moves. They change only the flat tone of the top face: the side faces keep the three flat tones, and the patterns go to the paper with the face in the far land and in the mist. They are thin and quiet, so that the things of the world stay on top.
- **Grass:** two greens in large soft patches, darker near water and lighter on dry high land, with short printed strokes (a V of ink). A village lawn has fewer strokes, and the edge of a field has more. The forest floor is darker, with fallen leaves; a dike top has few strokes.
- **A road of the land is one smooth strip** along the smooth middle line of the road (`docs/WORLD.md`), as the water is one plane: blocks where the child counts, curves where the world flows. The strip lies on the tops of the ground at their heights: each top on or beside the road keeps the direction of the line, its distance from it, and the half width of the road, and the shader draws the road where a point is within the half width (`strip` in `src/world/terrain.js`). So a road at an angle has the same width all along and a straight edge, with no step from cell to cell. The cells under the road keep their types and their heights for movement, and have the color of the ground under the road, so that no ink line follows the cells.
- **The print of the road:** grain, small dark stones, pale specks, worn patches, two wheel ruts along the line, and a lighter line in the middle where people walk. The edge is soft: a narrow band of dots of the print where the road goes into the grass, with no ink line. The tufts along the road cover the seam.
- **The paths and the yards of a village are packed earth:** lighter and smoother than a road, swept in long soft arcs, with footprints and a few small stones. Bricks are later than the time of the Hùng Kings (the brick tombs of the Red River region are of the Han time); the brick pattern stays for a later era (`village` of the type `path` in `data/tiles.json`: `packed` or `paved`).
- **Sand:** soft ripples and a few specks. **Rock:** grain and a few short cracks.
- **Roads in the low land** run on low banks, one step over the paddies, with a shoulder of grass two cells wide on each side, so that the steps of the side of the bank (whole blocks) stand back from the strip. **Roads on dry land** lie a little lower than the grass: the strip shows a thin darker band along its edges (a shadow line). The height for movement does not change.
- **Tufts:** small smooth tufts of grass along the edges of roads and the banks of the fields, and reeds at the water (`tuft` in `src/world/smooth.js`; a tuft belongs to its ground block, so a dig takes it). Along a road, a tuft stands just out of the edge of the strip. There is no tuft on the strip of a road, on a dike top, or on water. Tufts show at the near level only.
- **The low land is not a table:** mounds (gò) of one step with a clump of bamboo or a tree stand among the paddies, and short ditches (mương) of still water run along some blocks of paddies (drawn as the water of a paddy, with no seedlings).
- **Puddles:** from the start of a rain until a game day after its end, some cells of a road have a flat puddle in a rut: pale water with one glint and a thin ink rim (`puddlesAt` in `src/core/world/ambient.js`).

## 19. The thing in the hands

A person shows the thing in the hands from the pick-up to the put-down (#43). The hands draw the thing itself: the same look and parts as on the ground (`src/world/carry.js`), at 0.8 of its size. A new thing of a task needs no new code for the hands. Only the tools of the people (a staff, a pole, a net, a torch, a lantern, a shield) have their own parts in the hand (`TOOLS` in `src/world/parts.js`).

How a person holds a thing follows its size (`carry` in `data/figures.json`), or the look says it:

- **One hand:** a small thing (a rod, a shard, a bowl of rice, a herb, a lump of ore) stands up in the right hand, a little to the front.
- **Two hands:** a thing in front of the chest, with both arms forward (a bundle of seedlings, a fish trap, stones in a net, a tray of bowls, a duck). The bigger bundle is bigger in the hands, so that the child sees the size.
- **Shoulder:** a long thing (a stake, a plank, staffs) on the right shoulder, along the way the person looks.
- **Yoke:** pails on a carrying pole (đòn gánh) across the right shoulder.

A pick-up and a put-down show the move: the thing flies in a short arc (about 0.3 seconds) from the ground to the hands, or from the hands to its place, and the person bends a little. The big button shows a small picture of the thing in its corner while the hands hold it. A law of the stories checks that the figure of the hero draws the thing at every step where the hero carries one.

## The country map on dó paper (#8)

The country map (`src/ui/worldmap.js`, `drawBase`) is drawn in the three flat tones of the regions with ink lines for the coast, the borders, the rivers, and the roads. Over the whole sheet lies the grain of the dó paper (`art/paper.svg`, a tile of 48 map units, multiplied at 0.6), so that the flat tones look printed on paper, and a soft vignette in the tone of wood darkens the edges of the sheet. The seals, the names, and the way of a travel come over the grain, so that they stay sharp. The loading screen uses the same base with the grain and no vignette.
