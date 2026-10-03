# Tre — Game Design Document

Sep 28, 2026 · @Son Tran-Nguyen

A Vietnamese version is in `DESIGN.vi.md`. This English file is the source; when the two differ, this file applies.

## Summary and goal

Tre is a web RPG from Pre-K to grade 12. The first release covers grades 1 to 5. An ordinary child grows into a hero of Vietnamese history and legend with the mind and the body.

- **Tagline:** Every hero starts small.
- **Name:** *tre* means bamboo. Bamboo is the most ordinary plant in a Vietnamese village. It grows fast, bends in a storm, and does not break. Thánh Gióng fought with bamboo when his iron staff broke.
- **Idea:** many Vietnamese heroes were ordinary people: a boy who did not speak, a woodcutter, a fisherman, a farmer. The player also starts as an ordinary child and becomes a hero through discovery and challenges.
- **Learning rule:** math and science are the way the player fights, builds, and explores. They are not a quiz before the fun.
- **Culture goal:** children born outside Vietnam learn Vietnamese history, legends, and language in play. The game is in Vietnamese and in English.
- **Title screen:** the hero starts as a bamboo shoot. The bamboo grows taller with each era.

## Players and audience

The game is for all children from Pre-K to grade 12 (about age 3 to 18). Pre-K and K play the Măng non stage. The first release covers grades 1 to 5 (about age 6 to 11). The first player is a 7-year-old boy in grade 1 or 2.

- A player can start at grade 1 and move up. A player can also take a Văn Miếu placement exam after the prologue to go directly to the correct level.
- Several children can have profiles on one device.
- Two players can play together on one device. They take turns in the same battle. Each player gets problems at their own level.
- Players can choose Vietnamese or English for the full game.
- The player does not need to know Vietnamese history before they play.

## World and story chapters

The player travels through 13 story chapters of Vietnamese legend and history, in history order. The story and the grade are separate: the problems in every chapter follow the player's own skill levels. A 2nd grader and a 10th grader can play the same chapter, and each gets problems at their own level.

| # | Chapter | Time | Ordinary person who became a hero | Science and math idea |
| --- | --- | --- | --- | --- |
| 1 | Lạc Long Quân and Âu Cơ | Legend | The hundred children | Counting, groups, sea and mountains |
| 2 | Hùng Kings | Legend | Lang Liêu (bánh chưng), Mai An Tiêm (the watermelon island), Chử Đồng Tử (a poor fisher) | Plants, food, survival on an island |
| 3 | Thánh Gióng | Legend | A boy who did not speak | Iron and fire |
| 4 | An Dương Vương and Cổ Loa | 3rd century BC, partly legend | Cao Lỗ, maker of the crossbow | The spiral citadel, crossbow force |
| 5 | Hai Bà Trưng and Bà Triệu | 40–43 and 248 AD | Two sisters, and a young woman from a village | Elephants, weight, measuring |
| 6 | Ngô Quyền and Đinh Bộ Lĩnh | 938 and 968 | Đinh Bộ Lĩnh played war games with reed flags as a buffalo boy | Tides, floating and sinking |
| 7 | Lý dynasty | 1010–1077 | Lý Công Uẩn moves the capital. Văn Miếu opens. Lý Thường Kiệt | City planning, maps, the first exams |
| 8 | Trần dynasty | 1258–1288 | Trần Quốc Toản, a teenager. Yết Kiêu, a fisher and diver | Strategy, supply, river currents |
| 9 | Hồ reforms | about 1396–1407 | Hồ Nguyên Trừng, the cannon maker | Paper money, stone citadel, early chemistry |
| 10 | Lê Lợi and Nguyễn Trãi | 1418–1427 | Lê Lợi, a farmer | Supply, persuasion, writing |
| 11 | Lê Thánh Tông | 1460–1497 | Lương Thế Vinh, a mathematician from a village | Mathematics, maps, law |
| 12 | Tây Sơn | 1771–1789 | Three brothers from a village. Bùi Thị Xuân, a woman general | Speed, distance, and time |
| 13 | Scholars and healers | 18th–19th century | Lê Quý Đôn (encyclopedia), Hải Thượng Lãn Ông (medicine) | Medicine, biology, knowledge of the world |

**Modern times:** the story chapters stop at the 19th century. The colonial period and the wars of the 20th century are painful and divided memories for many families. Modern Vietnam comes into the game through service projects instead: bridges for children in the mountains, homes after a typhoon, and clean water for far villages (see Hero's path and guilds).

The skill map follows the US Common Core for math and NGSS for science. Each chapter also teaches the history and geography of its place and time. All dates and history notes need a check by a person who knows Vietnamese history.

## Core loop and session

In each era, the player goes around the same loop many times. When the player is ready, a Văn Miếu exam opens the next era.

Core loop of one era: Village (practice and crafting) → Quest and travel (puzzles and legends) → Battle (math and science skills) → Rewards (friends and materials) → back to the Village. When the player is ready: Văn Miếu exam → Next era (the bamboo grows).

A lost battle also goes back to the village, with a small loss of items. One play session is one quest or one battle. The parent sets the time limit.

## Motivation and orientation

These four parts give the child a reason to look forward and a way to find their place. They add no questions.

- **The world map:** one map of all 13 chapters, drawn as an old Vietnamese map on dó paper, with a red seal on each chapter. Locked chapters are visible. The child sees Phù Đổng, then the mist over Cổ Loa and the river of Bạch Đằng, and wants to get there. A minimap in the corner shows the near places.
- **A thing to build near the start:** the bridge in Phù Đổng starts broken. Each of the Five Trials gives one part of it (planks from the woodcutter, rope from the fisher, and so on). The child sees the bridge grow, and crosses it to reach Văn Miếu. A concrete goal beats "meet the elder."
- **Growth on the hero:** a bamboo in the HUD grows one section for each hero level. Experience comes from battles, quests, and projects, not from questions.
- **The notebook (Sổ tay):** a collection of prints that fills in as the child plays. Each skill, legend, creature, and place gets a small Đông Hồ print when the child meets it. Skills that are mastered get a red seal. The child sees the gaps and wants to fill them. Parents can read the same notebook to see progress.

## The world and how it plays

Tre is one living isometric world. The child walks, builds, and defends in the same place. There is no separate battle screen and no question screen. The math is the input of every action, never a question. This follows Ring Fit Adventure, where the exercise is the way you move, and the game never says "now exercise."

**View:** a voxel world with an isometric camera, drawn in the Đông Hồ style. The world is made of blocks, so the child can place blocks (planks, earth, stakes), the math is visible (a dike of 3 × 4 × 2 blocks is volume), and depth, height, and shadows come for free. Every house, tree, animal, and person is made in code from blocks and parts, not drawn, so the agent can make many variants and tests can check the world. The camera is orthographic and turns in 90° steps. The reference for the look and the feel is `docs/reference/voxel-village.html` in the repository.

**The voxel print style** (the rules that make blocks look like a woodblock print, not like Minecraft):

- **Blocks where the child counts, curves where the world flows.** Four tiers. Full blocks: the ground, dikes, walls, planks, stakes, anything placed or counted; the grid is the math. Half blocks: houses, fences, furniture, the things of the village. Quarter blocks: the figures and the small props the child handles. Smooth meshes in the flat tones with ink at the silhouette, as the roofs are: everything living and round (tree crowns, bamboo, banana leaves, haystacks, lotus, smoke, clouds, water). Rocks stay blocky. People are about as tall as the posts under a house.
- **Nothing is baked, and everything can come apart.** A smooth mesh is a look on an entity or a block, never a thing of its own: fell the tree and the crown goes with it. The ground keeps ore, clay, and rock as block kinds under the surface, and digging edits the grid and rebuilds one chunk. A house is a list of parts that builds in one order and dismantles in the other. Every mesh comes from a generator with a seed, so the same tree grows again from the save. Mining and dismantling come in a later era; the data allows them from the start.
- **Flat colors from the Tre palette only,** with three flat tones per color: top, left face, right face. No lighting model, no gradients.
- **Ink lines only where they mean something:** where a face meets another color, an open edge, or a fold. Never around every block. Lines are thinner on the fine blocks.
- **Roofs are smooth thatch,** not stepped blocks: sloped surfaces with the curved, boat-shaped ridge of the Đông Sơn houses, thatch lines in ink, and bird-head finials on the đình.
- **Water has the wave pattern** of the prints. Paddies are still water with seedlings in rows.
- **One light from the front-left.** Every tall thing casts a flat shadow to the back-right on the ground blocks. Houses on stilts cast a shadow under their floor.
- **A paper grain and a soft vignette** over the whole frame.
- **The hero is always visible.** Anything between the camera and the hero fades to a ghost: outlines stay, color goes. Whole objects fade, not parts.
- **Dusk** is an indigo wash over the whole scene, with warm pools of light from the lanterns and fireflies by the water. Ink lines soften a little at night.
- **Characters are made of parts** (head, body, arms, legs) that rotate, so walk cycles, grazing, waving, and sitting are animation of parts, not new sprites. A walk has legs and arms that swing in turn, a small lean, and a lift on each step. Four-legged animals walk with their diagonal legs together.
- **Figures are finer than the land.** People and animals are built on a quarter-block grid, so a person is 14 to 16 units tall: a stepped round head, a face with eyes and a mouth, hair as a volume, sleeves, hands that hold things, feet, and a walk with a knee bend. The land keeps its full and half blocks. All figure parts draw as one instanced mesh; figures outside the view are culled, and figures far from the hero draw a coarse version.

**The five rules**

1. **No question mark in the world.** A screen with a question and an answer field is a quiz. Questions live only with the teacher (practice) and at Văn Miếu (exams), where a test is part of the story.
2. **Failure is physical.** A plank is too short, a stone falls short, the ice does not melt. The world shows what happened, and the child tries again. There is no red X.
3. **The game watches, the child does not know.** Each action is a skill event for the mastery model. Three planks of 4 across a gap of 12 is a correct "multiply as groups." The model is the same; only the input changes.
4. **The hint is a helper with a body.** Nghé walks to the place, points, or stamps the ground. Villagers call out. Worked examples stay in practice with the teacher.
5. **Difficulty rises in the world.** Wider gaps, more enemies, faster floods, higher walls. The child feels a harder task, not a harder problem.

**The child is the cause**

- **Free movement and a world that reacts.** The hero walks anywhere with a stick or a tap-and-hold. Chickens scatter, villagers turn their heads, tall grass rustles, a pot breaks. The world notices the child.
- **Placement is the core verb.** The child puts things in the world, and the world answers. Planks across a gap, stakes in the river before the tide, sandbags on the dyke, torches around a camp, rice into bowls. Each placement is a math act with a visible result, and the same verb later builds bridges, dikes, and cities.
- **Stakes.** The village is the hero's home, and the child made things in it. When the scouts come, they threaten the bridge the child built.
- **Nghé has a body.** Nghé follows, can be ridden, pushes carts, swims across the river with the child on her back, and is afraid of fire. Nghé is a friend that acts, not a hint button.
- **Secrets.** A path behind the bamboo, a cave, a creature that only comes at night. Curiosity is the reason children play.
- **Time.** Day and night, rain, seasons, and Tết. The river rises in the rain, so the dyke matters. Some creatures come out at night. At dusk the village goes to sleep: villagers walk home, climb their ladders, and go in; chickens go to their coop and sit; ducks settle on the bank; Nghé lies down beside the hero. At dawn they all come out again. The child sees a village with its own life, and learns that night is for rest.
- **A place of their own.** A plot to farm, a house to decorate, and the notebook of prints.
- **The world breathes.** When the child does nothing, the world still moves: the river flows, leaves sway in a wind that crosses the paddies as a wave, smoke rises from a kitchen at meal times, birds cross at dawn and dusk, laundry and the đình flag move. Small joys wait for the child who looks: a buffalo that snores in the shade, ducklings that follow, a frog that jumps, a rainbow after the rain, a shooting star, a kingfisher one day in twenty, Tết once a year. Nothing here teaches, counts, or rewards. It is there because the child looked.

**Actions and the math inside them**

| Action | What the child does | The math inside | Grows into |
| --- | --- | --- | --- |
| Build across a gap | Places planks of 3, 4, or 5 across a gap of 12. Too short falls, too long sticks out and the plank is wasted | Add to a total, multiply as groups | Area, ratios, load |
| Stakes in the river | Plants stakes in a row before the tide comes in. When the tide goes out, the stakes show | Counting, spacing, patterns | Tides as cycles, periodic functions |
| Sandbags on the dyke | The flood comes in 3 waves. The child stacks bags where the water is highest | Compare heights, add and subtract | Volume, rate of flow |
| Slingshot and traps | Shoots at scouts near the gate, places traps on the paths. Distance posts stand along the road | Number line, estimate and correct | Angles, vectors, trajectories |
| Element flow | Drags fire from a torch onto ice. The water runs downhill into the river. Lightning into the water shocks every soldier in the wet zone | Cause and effect, states of matter | Energy, chemistry, circuits |
| Cut bamboo | Slashes a stem at a mark. A stem of 12 in 3 equal sticks gives 3 staffs | Equal parts, fractions | Ratios, measurement |
| Feed Gióng | Carries rice bowls from the field. Gióng grows one head each 10 bowls. Carries 3 bowls fast or 5 bowls slow | Counting in groups, place value | Rates, time and distance |
| Share loot | Drags 12 coins to the hero, Nghé, and Gióng. Nghé sulks at an unfair share | Division, remainders | Ratios, percent |

**Battles: defense of the village**

Battles are light real-time tactics on the village map, like a gentle tower defense. Enemies walk toward the village on visible paths. The child places traps, calls villagers to spots, raises the gate, and shoots from the wall. Nghé charges once per battle. Time is slow (enemies walk, they never run), and the child can pause by opening the map. Battles need counting, spacing, timing, and rate, with no menu and no turn.

- **Enemies act and have tells.** A scout lights a torch before he throws it. A soldier raises a wet shield after fire. The general lifts his sword before a big blow.
- **The child feels the hit.** Damage numbers pop up. A trap snaps with a sound. A wrong placement shows the enemy walking around it. Nghé lowers her horns when the hero is hurt.
- **Short, with phases.** A raid lasts 2 to 3 minutes. The boss has phases: the general sends soldiers, then fights himself, then the iron staff breaks and Gióng pulls bamboo.
- **The world changes after a win.** The scouts drop a map that shows the ore. The river opens a new path.
- **Defeated enemies** retreat or surrender. Creatures become calm, and some become friends. The game shows no blood and no deaths.
- **A lost raid:** the enemies take some coins or materials and leave. The village stands. Nothing the child built is destroyed. The player never loses a creature friend, a crafted machine, or a title. Grade 1 raids take nothing. A parent can make losses harder in the settings.
- **Two players** play at the same time on the same map, each with their own hero, each at their own level.

**First prototype:** one isometric village, free movement, Nghé who follows, the world that reacts (chickens, grass, pots), the broken bridge with the plank placement task, and one small raid of scouts at the gate with traps and the slingshot. No story text beyond one line from the elder. Play it with the first player for ten minutes and watch what he does in the first two minutes without help. The prototype tests three things: does the world feel real, does placement feel like play, and does the child want to protect what he built?

## Procedural generation

The story places are hand-built and true to history. Around them, rules make the world large and varied without hand work.

- **Land between regions:** made from the real elevation and river data, with seeded noise for detail, so travel between story regions crosses the real hills and rivers.
- **Scatter:** trees, bamboo, grass, flowers, rocks, and rice terraces placed by rules that follow the height and the water, never in a grid.
- **Variety from parts:** houses, trees, boats, and villagers built from parts with variations, so no two villages look the same.
- **Small events each day:** a cart stuck on the road, a flood on a field, a market day, a lost duck. The skill model sets the level of the math in each one.
- **Places to explore:** caves, forest paths, and small islands that differ from game to game, with a few secrets.

**Two rules:** everything is **seeded** (the same seed gives the same world, so siblings and a parent see the same place, and the save keeps only the seed and what the player changed), and generated places are **never presented as historical places**.

## Geography: the whole country, real

The world is Vietnam with its real geography: real coast, rivers, mountains, and places. The player travels it, and learns the shape of the country by walking it.

**Two scales**

- **The country map** is the real map of Vietnam, drawn as an old map on dó paper. It is made from open data: coastline, borders, and rivers from Natural Earth (public domain), and terrain from NASA SRTM elevation data (public domain). The data is simplified once with a script and kept in the repository. The player travels on it along real roads and rivers, with travel time on the game clock and events on the road.
- **The land** is one continuous world at human scale, made from the same real data and the seed, with the story places as hand-made stamps at their real places. Distances are compressed (a walk between two story places of a region takes one to three minutes); things are life size. The land is made and dropped chunk by chunk around the hero, so there is no map edge and no load inside the land.

**Era 1 is real.** Phù Đổng stands on the bank of the Đuống River. Núi Trâu (Trâu Sơn), where the legend puts the battle, is to the east in Bắc Ninh. Sóc Sơn, where Gióng rode to the sky, is to the north. Thăng Long and Văn Miếu are to the southwest, across the Đuống and the Red River.

**Later regions follow the real land:** Cổ Loa north of the Red River, the Bạch Đằng estuary and its tides near Hạ Long, the limestone karst of Ninh Bình, the mountains of Lam Sơn in Thanh Hóa, the central coast and Phú Xuân (Huế), the Tây Sơn highlands, and the Mekong delta.

**Regions:** one region for each story chapter, as a named area of the one land. The hero walks from place to place with no cut, and travels far on the country map, which is the same land seen from far away. A game day is about 8 minutes of play. The data is in `data/world/regions.json` and the land files of each region.

**The edges of the world have reasons the child can see, never an invisible wall.** The real coast (the water gets deeper and the hero stops at the knee), the real mountains (too steep to climb), the land of a later era (it fades into mist and then into blank dó paper, as the edge of a print that is not finished yet, and it fills in as the eras go on), and the places the story has not opened (a deep ford, a guard, a fallen tree). At an edge the hero turns back by himself with a short line, and the camera never shows the end of the land.

| # | Region | Place on the country map | Maps now |
| --- | --- | --- | --- |
| 1 | Mountains and sea | The high mountains of the north (Tây Bắc, Việt Bắc) | Locked |
| 2 | Văn Lang | The midlands west of the delta, Phong Châu (Phú Thọ) | Locked |
| 3 | The land of Thánh Gióng | Phù Đổng and Sóc Sơn, north-east of Hà Nội | The village of Phù Đổng; the fields and the river; the road to Văn Miếu; the foot of Trâu Sơn |
| 4 | Cổ Loa | North of Hà Nội | Locked |
| 5 | Mê Linh | North-west of Hà Nội | Locked |
| 6 | Bạch Đằng | The north-east coast: Hải Phòng and Quảng Ninh | Locked |
| 7 | Thăng Long | Hà Nội, on the Red River | Locked |
| 8 | Thiên Trường | The south of the delta: Nam Định, Thái Bình, Ninh Bình | Locked |
| 9 | Tây Đô | The coast plain of Thanh Hóa | Locked |
| 10 | Lam Sơn | The mountains west of Thanh Hóa and Nghệ An | Locked |
| 11 | Thuận Quảng | The central coast, Hà Tĩnh to Quảng Nam | Locked |
| 12 | Tây Sơn | The south-central coast and the central highlands | Locked |
| 13 | Gia Định | The south and the Mekong delta | Locked |

Some chapters happen in more than one place (for example Bà Triệu in Thanh Hóa, and Hải Thượng Lãn Ông in Hà Tĩnh); the region is the main place of the chapter. A person who knows Vietnamese history must check this table.

**The country grows with history.** The country map shows the land of each era. In the time of the Hùng Kings, Văn Lang is only the north. The land grows south chapter by chapter, and the map shows the older peoples of the center and the south, such as Champa and the Khmer, with respect, as neighbors with their own history. Today's full shape shows at the end.

**Islands.** The country map shows Hoàng Sa and Trường Sa as part of Vietnam, with their Vietnamese names. The game does not argue the dispute. It shows what happened, in the place and time where it happened, spread across chapters, quests, and side quests. It never collects these facts in one place, never sums them up, and never asks the player for a conclusion. What the player does with them is up to the player.

Facts appear where they belong:

- **Chapter 13 (18th–19th century):** Lê Quý Đôn writes about the Hoàng Sa flotilla (đội Hoàng Sa) in *Phủ biên tạp lục* (1776). Families on Lý Sơn send their sons with the flotilla. In 1836, Emperor Minh Mạng sends Phạm Hữu Nhật to the islands to set up markers.
- **Trade and ports:** in a port such as Hội An, traders from other lands carry their own maps, and the maps do not agree.
- **Modern service projects:** on Lý Sơn today, families hold the Lễ khao lề thế lính Hoàng Sa. A fishing family works in the waters near the islands. Older people remember the battle of Hoàng Sa in 1974 and the clash at Gạc Ma in 1988. A harbor office has the 2016 ruling of the international tribunal in the case of the Philippines against China, and notes that China rejects it and that Vietnam was not a party.

**Rules for these facts**

1. Each fact is true and has a primary source. A historian checks every date, number, and quote before release.
2. Facts come from people: talks between the player and people in the world, and talks that the player overhears between them. A fact can come up more than once, from different people who see it in different ways. No screen or notebook page gathers the facts, and the game never sums them up.
3. The people in the world are not only Vietnamese: a Minh Hương family of Chinese origin in Hội An, Hoa traders in Chợ Lớn, a Cham elder, a Filipino fisherman, a European mapmaker. Each speaks from their own life and their own records, in their own words.
4. People on every side are shown with dignity. Nothing is graphic. No country or people is mocked.
5. The game never scores or rewards a view about the islands.

**Landscapes teach geography:** the Red River delta, limestone karst, the central coast, the Trường Sơn mountains, the highlands, and the Mekong delta each have their own ground, plants, houses, boats, and weather.

## Learning system

The game keeps a separate level for each skill. A player can be at grade 3 in math and grade 1 in science.

**Subjects:** math, physical science, life and earth science, history and geography. More subjects can come later, for example reading and Vietnamese language.

**Skill map:** each skill has an ID, a grade, a subject, and the skills that come before it. The skill map follows Common Core and NGSS. Example: "add within 20" comes before "add two-digit numbers."

**How problems are made:**

- **Generated by rules:** code makes new math and physics problems each time, from a template and the skill level. Example: a number shield of 12 with 4 cards, where at least one pair makes 12.
- **Written by hand:** facts for science, history, and geography are in data files, in Vietnamese and English.
- **Parent editor:** parents can add their own questions, for example words from school this week. A parent picks the skill, the language, and the answer type.

**The mastery model:** for each skill the game keeps the chance that the child knows it (Bayesian Knowledge Tracing), with hand-set parameters inside the standard bounds (prior 0.1 to 0.4, learn 0.1 to 0.3, guess 0.05 to 0.15, slip at or below 0.1, mastery above 0.95). The evidence comes from actions in the world first, from the teacher's practice and the exams second. An Elo-style ability picks the next task for 75 to 85 percent success, and a forgetting term with growing intervals (1, 3, 7, 14, 30 days) brings a skill back into the quests when it is due. The rules for this are in "Learning by doing: the rules from the evidence".

**Teachers in the village:** a player can practice a skill with a village teacher before a battle. Practice has no health loss.

## Learning by doing: the rules from the evidence

The research report in `docs/research/learning-by-doing.md` collects the evidence behind the rule of the world. These rules come from it. Each rule names its strongest source in short form; the report has the full citations and the numbers.

**The task**

1. **The concept is the only route to the goal.** A task must be unsolvable without the operation. A physics engine with a goal that does not need the concept teaches nothing (Angry Birds studies). The same math as an action instead of as a quiz gave 58 percent against 41 percent on a delayed test, and children chose to play the action version seven times longer (Zombie Division).
2. **One operation, one gesture.** Drag a plank to compose a length. Deal coins to divide. Turn a gear to multiply. Every math game with a positive controlled study does this (DragonBox, Slice Fractions, Wuzzit Trouble, Motion Math).
3. **The shape of the action is the shape of the idea.** Lengths lie on a straight line with equal spacing. Groups are rows. A linear board game taught number sense to 4-year-olds; the same game on a circle did not (Siegler and Ramani).
4. **Predict, then commit.** Before the commit, the child points where the arrow will land or how many planks it will take. Then the child acts. A prediction turns a physics toy into a lesson (Angry Birds with epistemic goals; the "place your bets" pattern).
5. **A free sandbox before the scored commit.** The child can try, undo, and try again at no cost. Only the committed action ("cross the bridge") is scored. Exploration is never scored as error.
6. **Tight constraints for grades 1 to 3, wider walls with grade.** Few parts, one variable, a first success that is easy. Struggle before help works for older students and reverses for grades 2 to 5 (Sinha and Kapur; Karpicke).
7. **New content comes in a short explore-then-show cycle.** The child tries a new task for about a minute. Then Nghé or a villager demonstrates on a different instance, at counting pace. Then the child does the original (DeCaro and Rittle-Johnson; worked examples were the favorite support in Physics Playground).
8. **Fade the representation inside each skill.** Start with bowls and planks. Add tick marks and numerals beside them. End with numerals alone, with the old picture one tap away. Concreteness fading beat every other order for transfer (Fyfe, McNeil and Borjas).
9. **The content object is plain; the village is rich.** Put the Đông Hồ detail on houses and trees, not on the plank, the bowl, or the coin. Perceptually rich manipulatives lower accuracy (McNeil).
10. **The same concept lives in several devices.** The lever is in the đòn gánh, the gàu sòng, the cối giã gạo, and the cầu khỉ. Multiple embodiment is what makes a concept portable (Dienes; fluency across many levels in Physics Playground).
11. **One new part for each region.** A new device, a new plank size, or a new rule, never two at once (Baba Is You; PhET).

**Feedback and failure**

12. **The world shows the result within one second, and shows why.** The bridge shows which plank fell short. The arrow shows where it landed. Feedback about the task and the process has twice the effect of a right-or-wrong mark (Wisniewski, Zierer and Hattie); immediate feedback beats delayed feedback for novices (Shute).
13. **The world speaks, never a grader.** No "wrong", no red X, no praise, no comparison with other children. Feedback about the self made one third of feedback interventions harmful (Kluger and DeNisi).
14. **Failure is cheap, private, and instant.** Undo is free. A retry is one tap and under two seconds. Attempt counts are hidden. A defeat message names what to change, never the child (Celeste; Zoombinis).

**Difficulty, rewards, and story**

15. **Target 80 to 90 percent first-try success on skill tasks.** Let the child choose a harder version for pride; never force it. The highest success rate gave the most practice and the largest gains (Jansen); the inverted U of difficulty appears only when the player chooses (Lomas).
16. **Reward with information and surprise, never with a contract.** "You used three planks; last week you used five" is safe. A gift after the fact is safe. A star bar shown before the task is a contract, and expected rewards lower children's interest more than adults' (Deci, Koestner and Ryan).
17. **The legend poses the problem.** A story beat must need the action to resolve. Cut a legend detail the task does not use. Story the child must use helps; story the child only watches is load (Crystal Island; seductive details).
18. **Two players each get a role the task needs.** The older child makes the quantity decision; the younger counts, sorts, or taps. Hand the older child the hint to give (joint media engagement principles).

**The model**

19. **Efficient first-try success is the mastery signal.** Record "solved" and "solved with the minimum parts on the first commit". The second carries most of the evidence weight (Physics Playground's gold trophies, reliability 0.87).
20. **Design tasks so that chance success is rare.** A target that one obvious move cannot reach, several sizes on offer. Then set the guess parameter low (0.05 to 0.15) and slip at or below 0.1.
21. **Hand-set the model and check it.** Prior 0.1 to 0.4 for a new skill, learn 0.1 to 0.3, mastery at P(L) above 0.95. P(L) must rise after every clean success, and ten clean successes must reach mastery. Do not fit parameters from data (Baker, Corbett and Aleven).
22. **Mashing is no evidence, not an error.** Signs: action latency too short for counting, monotone sweeps of sizes, no pause after a failure. Do not punish it. Simplify the task or let the companion demonstrate (Baker; Aleven).
23. **Difficulty comes from design parameters; Elo updates only the child.** Gap length, number of sizes, group size, and target distance define the difficulty of a task. Pick the next task a little below the child's ability for 75 to 85 percent success. Item calibration needs crowds that Tre does not have (Brinkhuis; Pelánek).
24. **Review comes from forgetting, not from a review screen.** Decay P(L) toward the prior each day. Grow the interval after each clean success (1, 3, 7, 14, 30 days). When a skill is due, raise its weight in the quest generator so that the next task needs it (Khajah, Lindsey and Mozer; Cepeda). The interval constants are convention.
25. **Scaffolds come just in time and fade with P(L).** The ladder: an environmental cue, a ghost preview, the companion places one part, the companion demonstrates on a different instance. Never end with the answer to the same instance (Aleven; Shute).

**Questions, parents, and sessions**

26. **Questions stay with the teacher and the Văn Miếu, cued and spaced.** Ask only about skills with P(L) above 0.5. Give a partial cue for grades 1 to 3. Follow every answer with the correct answer and a one-line reason. Interleave skills (Karpicke; Rohrer; Agarwal).
27. **Report to parents by skill, in words, with an artifact.** Three states: exploring, getting there, confident. Show what the child built. Give the parent a way to nudge the level. No composite score.
28. **A session ends in the fiction, at a natural stop, by the device.** One quest, one chapter, one raid; the sun sets. Tell the child the plan up front. No countdown (Hiniker; evidence from under-6s, so treat as plausible).
29. **Many short sessions with an adult nearby.** Ten minutes three times a week was enough for measured gains (Wuzzit Trouble); gains in the meta-analyses appear with several sessions and some instruction (Wouters).
30. **Build the bridge from action to notation.** In-game mastery is not paper mastery. The teacher's practice is where the child's own action gets its symbol, after the action is habitual (DragonBox teacher materials).

## World tasks from village technology

Each task follows one template. The legend poses a need. The child predicts. The child changes one thing and commits. The world shows the result and why. The child repeats freely. The model scores only the committed action. These tasks are the source for the placement tasks of Era 1 and the later eras. The lever appears five times in five devices, and time and rate appear three times, which gives the multiple embodiment that rule 10 asks for.

| Task | Concept | The child | The world | The model observes |
| --- | --- | --- | --- | --- |
| Cầu khỉ (monkey bridge) across a gap of N | Composition of length; addition; later multiplication and division of length | Drags bamboo poles of sizes 2, 3, 5 (later others) onto a straight line with tick marks to reach the far bank exactly | A short bridge drops the hero into the water at the gap. A long pole overhangs and tips. The tick marks show the shortfall | Solved; solved with the minimum poles on the first commit; resets; latency for each placement; monotone sweep flag |
| Chia chiến lợi phẩm (sharing loot) among K villagers | Division with and without remainder; equal groups | Deals coins or rice sacks into K bowls by drag; commits with "chia xong" | A villager with less holds out an empty hand. Leftover coins stay on the mat. Equal bowls settle level | Clean equal deal on the first commit; re-deals; one-by-one or grouped dealing; remainder handled or ignored |
| Gánh nước theo nhóm (carrying in groups) | Skip counting; multiplication; grouping | Loads the baskets of a đòn gánh with bowls in equal groups to meet the total the village asks for | The pole levels when both sides match and tips when they do not. The count that the villagers speak stops where the load stops | Correct total on the first commit; group size chosen; time to commit; equal groups or ones |
| Đòn gánh (carrying pole) with unequal loads | Balance of moments; a lever with a moving fulcrum | Slides the shoulder point along the pole under two different loads | The pole tilts toward the heavy side until the shoulder point is right, then levels, and the hero walks | Distance from the correct point on the first commit; slides; direction of the first correction |
| Gàu sòng (tripod water scoop) | Class-1 lever; pendulum; trade of force and distance | Moves the rope knot along the handle; chooses where to hold; swings | The scoop lifts easily, or dips and spills, or does not rise. The water in the paddy rises with each swing | Knot position error; swings for each unit of water; time to the first full scoop |
| Gàu dai (two-person rope scoop, two players) | Period; synchronization; counting rhythm | Two players pull on a shared beat; each holds two ropes | In rhythm the scoop fills and the paddy floods. Out of rhythm it slaps the water and spills | Fraction of swings in phase; recovery after a miss; the timing error of each player |
| Cối giã gạo đạp (foot-lever rice pounder) | Lever arm; weight times distance; timing | Sets the pestle weight and the pivot position; presses on the beat | Too light and the grain stays whole. Too heavy and the beam does not rise. Right and the husks fly | Weight and pivot chosen; strokes to husk a measure; latency pattern |
| Cối giã gạo nước (water-powered pounder) | Rate; fill time; period of a self-tipping lever | Opens the bamboo channel wider or narrower; sets the trough size | The pounder strikes faster or slower. The husked rice for each canh rises | Predicted strokes for each canh against actual; changes toward the target |
| Cọn nước (bamboo water wheel) | Energy from flow; angle; volume lifted | Opens or closes a weir; tilts the tubes; adds blades | The wheel turns faster or stalls. Tubes spill early or reach the máng. The field turns green as water arrives | Tube tilt chosen; water delivered for each turn; changes before the commit |
| Thuyền thúng (basket boat) loading | Buoyancy; capacity; sealing | Loads one đấu of rice at a time; chooses to seal with dầu rái or not | The waterline rises with each đấu. One too many and the rim dips and the boat swamps. An unsealed hull fills slowly | Predicted safe load against actual; sealing chosen; loads to swamping |
| Nỏ thần Cổ Loa (crossbow) | Projectile; angle and range; energy shared among arrows | Sets the draw length and the angle; chooses one or five arrows; predicts the landing point by pointing | The arrow arcs and lands. A marker shows the landing against the prediction. Five arrows fly shorter than one | Prediction error; shots to hit; direction and size of each correction |
| Đánh trận đúng canh (timing a raid) | Time; rate; the incense and water clock | Cuts an incense stick to a length, or sets the hole of the gáo, so that the signal comes at the target canh | The stick burns down. The gáo sinks. The drum sounds early, late, or on time. The scouts arrive or are caught | Predicted length against needed; error in canh; test burns before the real raid |
| Diều sáo (kite with flutes) | Pitch and tube length; lift and angle | Shortens or lengthens a bamboo tube; moves the bridle knot | The flute plays higher or lower. The kite climbs, stalls, or dives. A chord sounds when the set is right | Tube-length order correct; bridle position error; trials to a stable climb |
| Trống đồng Đông Sơn | Pitch and size; resonance | Chooses among drums of different sizes; strikes the face or the body; sets on the ground or hangs | The tone changes with size, strike point, and mounting. Distant villages answer when the right drum sounds | Order of drums by pitch correct; strike choices; trials to the answer |
| Đong lúa (measuring rice with đấu, thưng, thúng) | Units; ratios; repeated filling; base 10 and base 16 | Fills a thúng with đấu and counts; converts cân to lạng for the market | The thúng fills to the rim at the right count. The merchant's scale balances only at the right conversion | Count on the first fill; conversion error; use of the larger unit when available |
| Đo ruộng (measuring a paddy in sào and mẫu) | Area as length times width; units | Walks the field with a thước rod; lays a grid of seedlings | The grid fills the paddy exactly, or leaves a bare strip, or runs over the dike | Rows and columns chosen; leftover area; time to commit |
| Nón lá (conical hat) rings | Circles of increasing radius; sequence; a cone from a sector | Chooses the ring spacing and count; cuts a leaf sector | Rings that do not fit bulge or gap. A wider sector gives a flatter hat that catches rain | Ring sequence correct; sector angle chosen; rebuilds |
| Ô ăn quan | Counting; modular arithmetic; planning one move ahead; value exchange | Points to the predicted landing square, then sows | The stones land where they land. A capture happens or does not | Prediction correct; captures for each game; comparison of left and right sowing before the choice |
| Bè tre và thuyền thúng (raft against basket boat) | Displacement; comparison | Loads the same cargo on a raft and on a thúng; predicts which sits lower | The two hulls settle at different waterlines side by side | Prediction correct; loads compared; both tested or not |

## Văn Miếu exams and titles

The player takes exams at Văn Miếu, the Temple of Literature, as scholars did in old Vietnam. There are two types of exam.

- **Subject exam:** moves one subject up. A new player can take it at the start to find the correct level. It is adaptive: it starts easy and gets harder until the player makes a few mistakes. It has 10 to 15 questions.
- **Era exam:** mixes all subjects of an era. A pass gives a scholar title and puts the player's name on a stone stele on a turtle in the game.

**Titles**, based on the old exam system (thi Hương, thi Hội, thi Đình): Tú tài, Cử nhân, Tiến sĩ, Bảng nhãn, Trạng nguyên. The final title, Trạng nguyên, needs a pass in all story chapters.

**No shame:** a player who does not pass keeps their level. The game shows the skills to practice, and the player can try again later.

**Văn võ song toàn:** when a player has the scholar title and the battle win of an era, the game shows *văn võ song toàn*, "complete in both learning and strength." The bamboo on the title screen grows one section.

## Hero, legends, creature friends, and crafting

**Hero:** the player makes their own hero: name, boy or girl, face, hair, and clothes of the era. The hero starts as an ordinary village child with no special power and no calling. The player chooses a calling after the first Văn Miếu exam (see Prologue and callings).

**Legends:** in each era, the player meets the legends of that time.

- First, a legend is a mentor. The legend tells their story, teaches a skill, and gives a quest. Example: Thánh Gióng teaches about iron and fire, and asks the player to help the smiths make his iron horse.
- In the final battle of the era, the legend joins the party as a companion.

**Creature friends:** calm creatures can become friends, for example a golden turtle, a Lạc bird, a water buffalo, or a small dragon. Each friend has an element and a special help, for example a hint, a shield, or a stronger element attack. The player keeps them in a collection and chooses up to 3 for each battle.

**Crafting:** the player collects materials in travel and battles: bamboo, wood, stone, iron, rope. The player builds tools and machines from parts: a raft, a lever, a pulley, a catapult, a water wheel. A machine only works if the player builds it correctly, for example the lever needs the correct place for the fulcrum.

## Măng non stage (Pre-K and K)

Children from 3 to 5 years old play Tre as *Măng non*, "young shoot." The saying *tre già măng mọc*, "old bamboo, new shoots grow," is about the young generation growing up behind the old one. The child stays in one small, safe village and learns through village life. Coi Nè stays a separate game.

**Rules for this stage:**

- No battles, no health, no timers, and no reading. A voice speaks all instructions.
- Very large touch targets. A wrong answer gets a kind "Thử lại nhé."
- The village has 6 to 8 places. The child taps a place or a person, and the child walks there.

**Activities in the village:**

| Place or person | Activity | Skill |
| --- | --- | --- |
| The painter | Color folk prints, as in the real Đông Hồ printing village | Colors, fine motor control |
| The dock and the market stall | Count boats, fish, and fruit | Counting to 10, then to 20 |
| The weaver | Weave a mat or a basket: red, blue, red, blue | Patterns |
| The builder | Make a house, a boat, or a lantern from shapes | Shapes |
| The market | Sort rice, beans, and fruit | Color, shape, and size |
| The old scholar at Tết (*ông đồ*) | Find and trace letters | First letters and sounds |
| The Trung Thu festival | Turn over lanterns to find pairs | Memory |
| The banyan tree | Ô ăn quan, Tập tầm vông, Oẳn tù tì, Chơi chuyền with village children | Counting, turns, rules |
| The fields | Fly a kite, feed the buffalo, plant rice | Wind, animals, plants |

**Nghé, the buffalo calf:** Nghé is the child's friend in the village, and it grows up with the child through all stages.

| Stage | Nghé | What Nghé does |
| --- | --- | --- |
| Măng non | A small, round calf | Follows the child, points to places, and celebrates each success |
| Village child (grades 1–5) | A young buffalo, the first creature friend | Carries items, crosses rivers, and gives hints |
| Team leader (grades 6–8) | A strong buffalo | A vehicle in battle: carries the hero, charges through gates and shields, and pulls machines |
| Builder (grades 9–12) | A great work buffalo | Pulls logs and stones, and turns mills. This teaches force, work, and energy |

**Growing up:** the Măng non skills (count to 10, shapes, colors, patterns, first letters) are the first skills in the Tre skill graph. When the child is ready, the parent or the game opens the Five Trials. The bamboo shoot on the title screen grows its first section, and the same village becomes the start of the hero's story.

**Siblings together:** a younger child in Măng non and an older sibling on quests share one village. For example, the younger child counts the boats that bring bamboo for the older child's bridge.

## Prologue and callings

All players start with the same village prologue, the Five Trials. After their first Văn Miếu exam, each player chooses a calling (*nghề*). A new player and a 4th grader go through the same moment at a different time.

**The Five Trials:** in the village of Phù Đổng, the hero helps five villagers, one for each calling. Each trial is short, and the full prologue takes about 20 minutes. The problems match the grade that the player gives at the start, so a 4th grader gets grade 4 problems.

**The first exam:**

- A new player plays Era 1 and takes the Era 1 exam.
- A player who is in a higher grade takes the placement exam right after the prologue.
- After the first exam, the Văn Miếu teacher says "Now you know who you are," and the player chooses a calling.

**Callings:**

| Calling | Mentor from history or legend | Main subject | Văn skill (mind) | Võ skill (body) |
| --- | --- | --- | --- | --- |
| Scholar (*Nho sinh*) | Chu Văn An | Math | More attack cards | Stronger number shields |
| Smith (*Thợ rèn*) | The smiths of the iron horse | Physical science | Builds machines faster | Strong metal tools |
| Fisher (*Ngư dân*) | Yết Kiêu | Water and tides | Reads the tide and the river | Water magic and diving |
| Healer (*Thầy thuốc*) | Tuệ Tĩnh | Life science | Knows plants and animals | Heals the party |
| Woodcutter (*Tiều phu*) | Thạch Sanh | Earth science and physics | Finds forest paths | Physics shots with bow and axe |

**Rules:**

- A calling never blocks a subject. It gives a bonus in one subject. Skill levels are the same for all callings.
- The player can change the calling in the village at any time, with no loss.
- In two-player mode, different callings make combo attacks. Example: the Fisher makes water, and the Smith sends lightning through it.

**Players who start in a later era:**

- All earlier eras stay open. A player can go back for the story, the legends, and the creature friends. The problems match the player's own level.
- The player gets a starter kit with the basic items and machines of the earlier eras, so crafting in the later era still works.

## Hero's path and guilds

The hero grows from a village child who fights into a builder who helps a whole region. Vietnamese has a saying for this: *lá lành đùm lá rách*, "the whole leaf wraps the torn leaf."

| Stage | Grades | Role | Main play |
| --- | --- | --- | --- |
| Village child | 1–5 | Hero | Battles, quests, and small machines |
| Team leader | 6–8 | Leads a small group | Quests that mix battle and building, for example defend the village and then repair the gate |
| Builder and planner | 9–12 | Member of a guild | Large projects: dikes, bridges, water systems, clinics, and schools |

Battles stay open at all stages. An older player can fight, build, or do both.

**Guilds:** the five callings grow into guilds (*phường*) at higher grades.

| Calling | Guild | Projects |
| --- | --- | --- |
| Scholar | The Academy (Quốc Tử Giám) | Schools, teaching younger villagers, maps and records |
| Smith | Builders' guild | Bridges, water wheels, tools, and buildings |
| Fisher | River office (Hà đê) | Dikes, canals, flood defense, and harbors. The Trần dynasty made a real office for dikes in 1248 |
| Healer | House of healing | Clinics, clean water, and herb gardens |
| Woodcutter | Mapmakers and foresters | Mountain roads, forest care, and surveys |

**Projects and what they teach:**

| Project | Math | Science |
| --- | --- | --- |
| Rebuild after a flood | Rain and water data, graphs, averages, probability | Water cycle, weather, soil |
| Dike for a village | Volume of earth, slopes, budget with equations | Water pressure, erosion |
| Bridge for mountain children | Lengths, angles, trigonometry, vectors | Forces, loads, materials |
| Water wheel and canal | Rates, ratios, functions | Energy, flow |
| Village clinic | Ratios, percentages, statistics | Biology, clean water, chemistry of filters |
| Market and trade | Percent, interest, supply and demand | — |
| School | Planning and schedules | The player writes problems for younger villagers. Teaching helps them learn |

**How a project plays:**

1. **Survey:** measure the river, count the families, and collect data.
2. **Design:** choose materials and sizes, and make the numbers work within a budget.
3. **Build:** the team works over several days. The player manages people and time.
4. **Test:** the storm or the flood comes, and the simulation shows the result.
5. **Improve:** if the design fails, people move to high ground and are safe. The player finds the reason and builds again.

**Mechanics grow with the player:**

| Mechanic | Elementary | Middle school | High school |
| --- | --- | --- | --- |
| Number shields | Add, subtract, multiply | Fractions, negative numbers, ratios | Solve for x, systems of equations, functions |
| Element magic | Fire melts ice | States of matter, energy | Reactions and balanced equations |
| Physics shots | Angle and power | Speed, force, energy | Vectors, trigonometry, projectile equations |
| Machines | Levers, ramps | Pulleys, gears, circuits | Programming machines with logic |
| Creature friends | Food chains | Habitats, cells | Genetics: traits pass on in simple patterns |
| Trade in markets | Coins and counting | Percent, profit | Supply, demand, interest |

**Siblings together:** in two-player mode, an older and a younger player share one world. The older player builds the bridge, and the younger player's hero crosses it to reach the next quest. Each player gets problems at their own level.

## Art, sound, and language

**Art:** the style comes from Đông Hồ folk paintings.

- Flat colors, bold black outlines, and simple round shapes.
- A small set of natural colors: red, yellow, green, indigo, black, and a warm paper white.
- A paper texture in the background, as on dó paper.
- All art is original. Do not copy real Đông Hồ paintings. Use their style only.
- **One look for each thing.** Everything in the world, and every picture of it on a screen, comes from the same code: portraits in the dialogue box and the HUD, the hero in hero creation, the cards of the callings, and the prints of the notebook are rendered from the voxel figures and props, with a mood on the face where it matters. SVG is only for the small UI icons, the logo, the paper, and the patterns of frames.

**Sound:** simple music from traditional instruments (đàn bầu, sáo trúc, trống). Short sound effects for hits, elements, and machines. A parent can turn music and sound off.

**Language:**

- The player chooses Vietnamese or English for the full game: text, voice, and help.
- All text is in language files with keys. There is no text in the code.
- Names of people, places, and titles stay in Vietnamese with marks in both languages, for example Thánh Gióng and Văn Miếu. English mode shows a short meaning the first time.
- Voice uses the Web Speech API first. Recorded voice files can replace it later, key by key.

## History and sensitivity rules

The game names historical armies as history books do, with a short and fair note. It speaks of rulers and armies of that time, never of peoples today.

**History is told by somebody.** To understand history, the player hears it from many sides and many people. This rule is for all of Tre, not only the islands.

- **Two kinds of text.** The narrator tells only facts that have a primary source. People in the world tell what they saw, remember, and believe. Their words are theirs, and the narrator never takes a side.
- **Many voices.** People of other origins live in the world where history put them: the Minh Hương families in Hội An, Hoa families in Chợ Lớn, Cham villages in the center, Khmer villages in the Mekong delta, traders from Japan, China, and Europe in the ports. They are neighbors, not visitors.
- **People disagree.** Two villagers can see the same event in different ways, and the player can overhear them. Neither is wrong on purpose. Each view is the strongest and most honest version of how a real person on that side would see it.
- **Examples:** the Ân soldiers who also missed home; a Cham elder who remembers when the center was Champa; a family on the side of the Nguyễn lords and a family on the side of Tây Sơn who tell the same years differently.

* **Legend or history:** each story shows a clear mark: "Legend" or "History."
* **Fair notes:** each battle has a short history note with the year, the place, and what happened. Example: "In 938, Ngô Quyền stopped the Southern Han fleet on the Bạch Đằng River."
* **Focus:** the story shows clever ideas, courage, and knowledge, for example the Bạch Đằng stakes and the tide. It does not show cruelty.
* **No insults:** the game never uses insults or old hate words for any group. Many families play, including Chinese-American and other families.
* **Enemies are not evil:** enemy soldiers are people who follow orders. They retreat or surrender. Some notes show that they also wanted to go home.
* **Check the facts:** a person who knows Vietnamese history checks each history note before release.

## Profiles, saves, and parent settings

All data stays on the device. There are no accounts, no server, no ads, and no analytics. Nothing leaves the device unless a parent exports a profile or shares a learning summary (see "Learning measurement").

- **Profiles:** each child has a profile with a hero, a save, and skill levels.
- **Save:** the game saves after each battle, exam, and quest step, in IndexedDB.
- **Export code:** a parent can export a profile as a file or a short text code, and import it on another device.
- **New adventure and restore points:** "Cuộc phiêu lưu mới" is always on the title screen; the child never sees save slots. The game keeps the save of the last three dawns of each profile as restore points, and a parent can rewind to one, rename, export, or delete a profile behind the parent gate.
- **Parent gate:** the parent area opens only after a parent holds a button for 3 seconds and answers a simple adult question.
- **Parent settings:** language, time limit per day, sound and music, difficulty of losses, and the parent question editor.
- **Time limit:** when the time is over, the hero goes home to rest. The game saves and ends at a calm point, never in the middle of a battle.
- **Parent page:** shows the level of each skill, the exams passed, and the skills to practice.

## Learning measurement: how Tre finds out what works

The rules above come from research on other games. Tre must find out whether they work in Tre, for these children, and change what does not. The measurement must follow the same rules as the game: nothing leaves the device by itself, nothing identifies a child, and nothing is scored in front of the child.

**The learning log.** The game keeps a log on the device, next to the save, in the profile. It is data that the game already has; the log only keeps it in a form that can be read later.

- *A task attempt:* the time, the map, the task, the skill, the phase (explore or commit), success, efficient success (minimum parts on the first commit), the parts used, the resets, the latency of each action, the hint level shown, P(L) before and after, and the variant of the experiment (below).
- *A session:* the start, the end, who ended it (the device at a natural stop, the parent limit, or the child), the quests done, and where the child was when it ended.
- *A review:* the skill, when it was due, and the result of the world task that carried it.
- *An exam item:* the skill, correct or not, and P(L) at that time. This is the transfer check: does mastery from actions predict answers to questions?
- *A prediction:* what the child pointed to before the commit, and what happened.

The log holds counts, times, and numbers only. No name, no free text, no picture. It is rolled up each day into small aggregates for each skill and each variant, and the raw events of the day are dropped after the roll-up, so that the log stays small.

**What "good" means.** Each rule has a measure that the log can answer:

| Question | Measure from the log |
| --- | --- |
| Does the child learn? | Time of play to mastery for each skill; first-try success rate over the last ten commits; the shape of the learning curve |
| Does it stay? | Success on a review task after 7, 14, and 30 days |
| Does it transfer? | The correlation of P(L) with the Văn Miếu exam items of the same skill (rule 30) |
| Is the difficulty right? | First-try success rate on skill tasks against the 80 to 90 percent band (rule 15); how often the child chose the harder version |
| Do predictions help? | Prediction error over trials; mastery speed with and without the prediction gesture (rule 4) |
| Do hints help or replace? | Success after each hint level; hints viewed under one second; mastery speed at each hint gating (rule 25) |
| Is the child playing or mashing? | Share of commits flagged as mashing (rule 22); what happened after the flag |
| Does the child want to come back? | Sessions each week; voluntary retries after success; sessions that the child continued after the quest ended; where sessions stop |
| Is the session length right? | Session length; who ended it; the first action of the next session |

**Experiments.** A small file `data/config/experiments.json` names the rules that can be switched, with at most one experiment active in a release. Examples: the prediction gesture on or off; the explore phase of one minute or none; hint levels three and four gated by P(L) or always available; the target success rate 80 or 85 percent; the review intervals. A profile gets its variant from its seed, so that a child stays in one variant, and the parent page shows the variant and lets the parent change it. The roll-ups are kept for each variant. With two children in one family the numbers are small, so the game compares within a child over time (before and after a switch) and across the families that choose to share.

**Sharing, only by a parent.** Nothing is sent anywhere by the game. The parent page has "Share a learning summary": it makes a small file of the roll-ups (rates, counts, and times, rounded; the grade, not the age; no name, no device information), shows it to the parent in full, and lets the parent save it or paste it into a GitHub discussion of the project. A later release may add an optional address to send the summary to, behind a parent switch that is off by default; there is still no third-party analytics and no account. The project publishes what it learns from the shared summaries in `docs/research/`.

**The researcher view.** The parent page has a plain view of the roll-ups of this device: one small chart for each question above, in words and simple bars, in Vietnamese and English. The first users of this view are the parents of the first players.

## Technology

Tre is built from scratch as a static web site on GitHub Pages, with no build step and no game engine. Tre is turn-based, uses a grid, and has few objects in a scene, so a small set of our own modules is enough.

**Platform**

- **Code:** plain JavaScript with native ES modules. No framework, no bundler, no engine.
- **Drawing:** WebGL through three.js (a fixed version from a CDN, with an import map, no build step) for the voxel world: chunked meshes with face culling, vertex colors for the three tones, one ink mesh built from the edges, an orthographic camera. HTML, CSS, and SVG for dialogue, menus, exams, settings, and the parent page, so that Vietnamese text is sharp and easy to translate. If WebGL is missing, the game shows a clear message.
- **Input:** Pointer Events, the same code for touch and mouse.
- **Sound:** Web Audio API.
- **Offline:** a web app manifest and a service worker. Saves in IndexedDB.
- **Deploy:** GitHub Actions runs the tests and then deploys to GitHub Pages.
- **Devices:** iPad and laptop browsers first.

**Core modules**

| Area | Technique | Purpose |
| --- | --- | --- |
| Game flow | State machines for scenes and battle turns | Clear flow with no strange states |
| Randomness | Seeded random numbers | Tests can repeat a problem. Two players get fair problems |
| World | Voxel grid with heights, collision grid, A\* pathfinding, free movement with a stick or tap-and-hold, placement of blocks, day and night clock with routines for villagers and animals | The child walks anywhere, and puts things in the world |
| World | Trigger zones | Doors, talks, and quest events start on a tile |
| Objects | Plain data objects with shared parts, and systems as functions | Data separate from logic, easy to test |
| Battle | Rule table for element combinations | New combinations are data, not code |
| Battle | Problem generators with a solver (for example a subset-sum check for number shields) | Each problem has an answer at the correct level |
| Physics | Small custom physics with a fixed time step: throws, floating, levers, pulleys | Only a few simple formulas are necessary |
| Story | Dialogue in our own JSON format with text keys | Writers add stories without code. Tests check that each key is in Vietnamese and English |
| Saves | Versioned save format with migrations. Export as compressed text with a checksum | Old saves work after updates. A bad code does not load |
| Events | Small event bus | Battle, quests, and sound stay separate |

**Learning model**

The learning model is chosen to help the player learn and remember, not only to measure.

- **Skill graph:** each skill has the skills that come before it. The game offers a new skill only when the skills before it are mastered.
- **Mastery:** for each skill, the game keeps the chance that the player knows it (Bayesian Knowledge Tracing). A skill is mastered at about 95 percent. The parent page shows three simple states: learning, almost, mastered.
- **Difficulty:** each player and each problem template has an Elo-style rating. The game chooses problems that the player gets right about 75 to 85 percent of the time: hard enough to learn, easy enough to stay motivated.
- **Spaced review:** mastered skills come back in battles and puzzles after longer and longer times (Leitner boxes), so the player does not forget them.
- **Mixed practice:** after a skill is learned, battles mix it with other skills, so the player learns to choose the correct method.
- **Feedback after a mistake:** first a hint, then a worked example, then a similar problem.
- **Settings:** all model values are in one configuration file, so they are easy to adjust. All data stays on the device.

**Not used, and why**

- **Game engine (Godot, Phaser):** the hard parts of Tre (generators, mastery, exams, element rules) are custom in any engine, and an engine adds download size and iPad problems. three.js is a rendering library, not an engine, and the same approach already works in Smashterpiece.
- **Full ECS:** a scene has only 10 to 50 objects.
- **Roaring Bitmap:** our largest sets have only a few hundred items. A plain Set or a small bitset is enough.
- **Hex grid:** a square grid teaches coordinates, area, and perimeter, and children know it from Minecraft.
- **Physics library:** the game needs only simple formulas.

**Tests:** the built-in Node test runner (node:test) for all logic modules: generators (each problem has an answer), skill graph, mastery model, exams, battle rules, element rules, pathfinding, and save and load. Logic modules do not use the DOM or Canvas.

**Stories:** the use paths of the game are data files in `tests/stories/`: a start state, a list of commands with waits, and the facts to check. A headless session (`src/core/session.js`) owns the profile, the world, the learner, and the story logic, and the village scene is a thin view over it. The same story file runs in `node:test` and in the browser (`?story=<name>&play`), where it plays with a visible finger for review and screenshots; `docs/reference/stories.html` lists them. On every step of every story the runner checks the laws of the world: no entity outside the map or in a blocked cell, the save loads back to the same state, and no text shown in the village or a raid contains a digit, an operator, or a question mark. Every new use path comes with its story.

## Open source, licensing, and business model

Tre is fully open source: code, stories, art, and design. The licenses let anyone learn from Tre and use it for free, but stop others from making money with a copy.

| Part | License | What it allows | What it stops |
| --- | --- | --- | --- |
| Code | AGPL-3.0 | Use, change, share, and host, also for schools and other projects | A copy that hides its source. A person who runs a changed copy, also as a web site, must publish the source under AGPL |
| Stories, art, music, and text | CC BY-NC-SA 4.0 | Use, change, and share with credit, for non-commercial use such as schools and families | Selling the content, or putting it in a paid product |
| The name "Tre" and the logo | Trademark, reserved | Talking about Tre and linking to it | A copy that uses the Tre name. A fork must use a different name |

- The owner keeps all rights and can still use the content in paid products, or give commercial licenses to partners.
- Contributors sign a simple Contributor License Agreement, so the project can keep or change these licenses later.
- The repository has LICENSE (AGPL-3.0), content/LICENSE (CC BY-NC-SA 4.0), and TRADEMARK.md.

**Business model**

- **Learning is always free.** No skill, era, or exam needs a purchase.
- **Possible income:** a family plan (sync and full parent dashboard), a classroom license (teacher dashboard and reports), extra content that is not core learning (side stories, holiday events, clothes, skins), products outside the game (printed books and cards), and support or grants.
- **Child safety:** purchases happen only behind the parent gate. No loot boxes, no timers that push a purchase, no consumable items for money, and nothing that helps in battle.

**Steps**

1. **Launch:** free public web game on GitHub Pages from a public repository. No accounts. Works offline.
2. **Parent accounts and sync:** a small open-source server. Only parents make accounts. A child profile has only a nickname and progress. Add a privacy policy and parent consent (COPPA). Check with a lawyer before this step.
3. **Paid extras:** the server keeps the list of what each family owns. The free core still works offline.

## First slice: Era 1, Thánh Gióng

The first version is one small, complete part of Era 1. It tests the fun and the learning before the rest of the game is built. This list describes the first build, which used a top-down view and question screens. The next build replaces it with the isometric world and the actions in "The world and how it plays".

1. Hero creation and one profile, in Vietnamese and English.
2. One village (Phù Đổng) with a teacher, a smith, and a home, and the Five Trials prologue.
3. The story of Thánh Gióng as mentor: the boy who did not speak grows up to help his village.
4. Three enemy types: a small river creature, an invader scout, and an invader soldier.
5. Two battle types: number shields (add and subtract to 20) and element magic (fire, water).
6. One crafting quest: help the smiths make the iron horse from iron and fire.
7. One boss battle, with Thánh Gióng as companion. When the iron staff breaks, the player finds bamboo.
8. One creature friend.
9. One subject exam for math at Văn Miếu, the first title, and the choice of a calling.
10. Save, parent gate, and time limit.

The slice is ready when the first player plays it three times in one week without help.

## Open questions

- [ ] How many correct answers in a row move a skill up, and how many mistakes give more practice?
- [ ] How much health does one mistake cost, and how many hints does a battle give?
- [ ] Which small items can a player lose, and how many?
- [ ] Which creature friends go in each era?
- [ ] Does the game use all six old exam titles (with Thám hoa and Hoàng giáp), or the simple list of five?
- [ ] Which ranks of Common Core and NGSS skills go into Era 1?
- [ ] Who checks the history notes and the Vietnamese text?
- [ ] Do we record voice for the story parts, or use the browser voice only?
- [ ] Do two players share a party, or does each player have a hero in the battle?

* [ ] Is the Măng non village the same as Phù Đổng, or a separate home village?
* [ ] Which chapters and projects go into each release after grades 1 to 5?
* [ ] How does the art style change for older players, if at all?
