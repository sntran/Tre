# Tre — Game Design Document

Sep 28, 2026 · @Son Tran-Nguyen

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

&#91;embedded content: core loop · one era\]

A lost battle also goes back to the village, with a small loss of items. One play session is one quest or one battle. The parent sets the time limit.

## Motivation and orientation

These four parts give the child a reason to look forward and a way to find their place. They add no questions.

- **The world map:** one map of all 13 chapters, drawn as an old Vietnamese map on dó paper, with a red seal on each chapter. Locked chapters are visible. The child sees Phù Đổng, then the mist over Cổ Loa and the river of Bạch Đằng, and wants to get there. A minimap in the corner shows the near places.
- **A thing to build near the start:** the bridge in Phù Đổng starts broken. Each of the Five Trials gives one part of it (planks from the woodcutter, rope from the fisher, and so on). The child sees the bridge grow, and crosses it to reach Văn Miếu. A concrete goal beats "meet the elder."
- **Growth on the hero:** a bamboo in the HUD grows one section for each hero level. Experience comes from battles, quests, and projects, not from questions.
- **The notebook (Sổ tay):** a collection of prints that fills in as the child plays. Each skill, legend, creature, and place gets a small Đông Hồ print when the child meets it. Skills that are mastered get a red seal. The child sees the gaps and wants to fill them. Parents can read the same notebook to see progress.

## The world and how it plays

Tre is one living isometric world. The child walks, builds, and defends in the same place. There is no separate battle screen and no question screen. The math is the input of every action, never a question. This follows Ring Fit Adventure, where the exercise is the way you move, and the game never says "now exercise."

**View:** isometric (2:1 dimetric grid) on Canvas 2D, in the Đông Hồ style: flat colors and black keylines, as in Monument Valley. Isometric makes places feel like places, shows what the child builds, and puts battles in the world. It works on every phone.

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
- **Time.** Day and night, rain, seasons, and Tết. The river rises in the rain, so the dyke matters. Some creatures come out at night.
- **A place of their own.** A plot to farm, a house to decorate, and the notebook of prints.

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

## Learning system

The game keeps a separate level for each skill. A player can be at grade 3 in math and grade 1 in science.

**Subjects:** math, physical science, life and earth science, history and geography. More subjects can come later, for example reading and Vietnamese language.

**Skill map:** each skill has an ID, a grade, a subject, and the skills that come before it. The skill map follows Common Core and NGSS. Example: "add within 20" comes before "add two-digit numbers."

**How problems are made:**

- **Generated by rules:** code makes new math and physics problems each time, from a template and the skill level. Example: a number shield of 12 with 4 cards, where at least one pair makes 12.
- **Written by hand:** facts for science, history, and geography are in data files, in Vietnamese and English.
- **Parent editor:** parents can add their own questions, for example words from school this week. A parent picks the skill, the language, and the answer type.

**Level changes:** the game moves a skill up after the player is correct many times in a row. It gives more practice when the player makes many mistakes. The exact numbers are in the open questions.

**Teachers in the village:** a player can practice a skill with a village teacher before a battle. Practice has no health loss.

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
- All art is original SVG. Do not copy real Đông Hồ paintings. Use their style only.

**Sound:** simple music from traditional instruments (đàn bầu, sáo trúc, trống). Short sound effects for hits, elements, and machines. A parent can turn music and sound off.

**Language:**

- The player chooses Vietnamese or English for the full game: text, voice, and help.
- All text is in language files with keys. There is no text in the code.
- Names of people, places, and titles stay in Vietnamese with marks in both languages, for example Thánh Gióng and Văn Miếu. English mode shows a short meaning the first time.
- Voice uses the Web Speech API first. Recorded voice files can replace it later, key by key.

## History and sensitivity rules

The game names historical armies as history books do, with a short and fair note. It speaks of rulers and armies of that time, never of peoples today.

- **Legend or history:** each story shows a clear mark: "Legend" or "History."
- **Fair notes:** each battle has a short history note with the year, the place, and what happened. Example: "In 938, Ngô Quyền stopped the Southern Han fleet on the Bạch Đằng River."
- **Focus:** the story shows clever ideas, courage, and knowledge, for example the Bạch Đằng stakes and the tide. It does not show cruelty.
- **No insults:** the game never uses insults or old hate words for any group. Many families play, including Chinese-American and other families.
- **Enemies are not evil:** enemy soldiers are people who follow orders. They retreat or surrender. Some notes show that they also wanted to go home.
- **Check the facts:** a person who knows Vietnamese history checks each history note before release.

## Profiles, saves, and parent settings

All data stays on the device. There are no accounts, no server, no ads, and no data collection.

- **Profiles:** each child has a profile with a hero, a save, and skill levels.
- **Save:** the game saves after each battle, exam, and quest step, in IndexedDB.
- **Export code:** a parent can export a profile as a file or a short text code, and import it on another device.
- **Parent gate:** the parent area opens only after a parent holds a button for 3 seconds and answers a simple adult question.
- **Parent settings:** language, time limit per day, sound and music, difficulty of losses, and the parent question editor.
- **Time limit:** when the time is over, the hero goes home to rest. The game saves and ends at a calm point, never in the middle of a battle.
- **Parent page:** shows the level of each skill, the exams passed, and the skills to practice.

## Technology

Tre is built from scratch as a static web site on GitHub Pages, with no build step and no game engine. Tre is turn-based, uses a grid, and has few objects in a scene, so a small set of our own modules is enough.

**Platform**

- **Code:** plain JavaScript with native ES modules. No framework, no bundler, no engine.
- **Drawing:** Canvas 2D for the isometric world (2:1 dimetric grid, painter's depth sort, diamond tile picking). HTML, CSS, and SVG for dialogue, menus, exams, settings, and the parent page, so that Vietnamese text is sharp and easy to translate.
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
| World | Isometric tile map, collision grid, A\* pathfinding, free movement with a stick or tap-and-hold, placement grid, day and night clock | The child walks anywhere, and puts things in the world |
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

- **Game engine (Godot, Phaser):** the hard parts of Tre (generators, mastery, exams, element rules) are custom in any engine, and an engine adds download size and iPad problems.
- **Full ECS:** a scene has only 10 to 50 objects.
- **Roaring Bitmap:** our largest sets have only a few hundred items. A plain Set or a small bitset is enough.
- **Hex grid:** a square grid teaches coordinates, area, and perimeter, and children know it from Minecraft.
- **Physics library:** the game needs only simple formulas.

**Tests:** the built-in Node test runner (node:test) for all logic modules: generators (each problem has an answer), skill graph, mastery model, exams, battle rules, element rules, pathfinding, and save and load. Logic modules do not use the DOM or Canvas.

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
