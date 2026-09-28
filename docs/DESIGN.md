# Tre — Game Design Document

Sep 28, 2026 · @Son Tran-Nguyen

## Summary and goal

Tre is a web RPG for grades 1 to 5. An ordinary child grows into a hero of Vietnamese history and legend with the mind and the body.

- **Tagline:** Every hero starts small.
- **Name:** *tre* means bamboo. Bamboo is the most ordinary plant in a Vietnamese village. It grows fast, bends in a storm, and does not break. Thánh Gióng fought with bamboo when his iron staff broke.
- **Idea:** many Vietnamese heroes were ordinary people: a boy who did not speak, a woodcutter, a fisherman, a farmer. The player also starts as an ordinary child and becomes a hero through discovery and challenges.
- **Learning rule:** math and science are the way the player fights, builds, and explores. They are not a quiz before the fun.
- **Culture goal:** children born outside Vietnam learn Vietnamese history, legends, and language in play. The game is in Vietnamese and in English.
- **Title screen:** the hero starts as a bamboo shoot. The bamboo grows taller with each era.

## Players and audience

The game is for all students from grade 1 to grade 5 (about age 6 to 11). The first player is a 7-year-old boy in grade 1 or 2.

- A player can start at grade 1 and move up. A player can also take a Văn Miếu placement exam after the prologue to go directly to the correct level.
- Several children can have profiles on one device.
- Two players can play together on one device. They take turns in the same battle. Each player gets problems at their own level.
- Players can choose Vietnamese or English for the full game.
- The player does not need to know Vietnamese history before they play.

## World and eras

The player travels through five eras of Vietnamese legend and history. Each era is a grade band, a region of the map, and a set of skills.

| Era | Grades | Story | Math | Science and other subjects |
| --- | --- | --- | --- | --- |
| 1. Legends | 1–2 | Hùng Kings, Sơn Tinh and Thủy Tinh, Thánh Gióng, Lạc Long Quân and Âu Cơ | Count to 120, add and subtract to 20, shapes, compare | Water and weather, plants, animals, metals and fire |
| 2. Hai Bà Trưng | 2–3 | The Trưng sisters and their elephants | Place value, add and subtract to 1000, multiply as groups, measure length | Animals and habitats, forces (push and pull) |
| 3. Ngô Quyền at Bạch Đằng | 3–4 | Wooden stakes in the river and the tide | Multiply and divide, fractions, time | Tides, floating and sinking, force and motion |
| 4. Lê Lợi and Hồ Gươm | 4–5 | The farmer who became king, and the sword and the golden turtle | Multi-digit math, area and perimeter, angles | Simple machines, metals, light and sound |
| 5. Quang Trung | 5 and more | The fast march in the Tết season | Decimals, speed, distance, and time, coordinates | Energy, maps and geography, Earth and space |

The grade bands follow the US Common Core for math and NGSS for science. Each era also teaches the history and geography of its place and time.

## Core loop and session

In each era, the player goes around the same loop many times. When the player is ready, a Văn Miếu exam opens the next era.

&#91;embedded content: core loop · one era\]

A lost battle also goes back to the village, with a small loss of items. One play session is one quest or one battle. The parent sets the time limit.

## Battles

Battles are turn-based, so the player has time to think. Puzzles and travel have action parts. Each attack uses a skill.

**Battle types**

- **Number shields:** an enemy has a shield with a number, for example 12. The player has attack cards, for example 5, 4, 7, and 3. The player must make exactly 12 to break the shield. Higher levels use subtraction, multiplication, fractions ("cut the armor in half"), and decimals.
- **Element magic:** fire melts ice, water puts out fire, and water carries lightning to all wet enemies. Fire and water make a steam cloud that hides the party. This teaches states of matter and cause and effect.
- **Physics shots:** the player sets the angle and the power of a stone, an arrow, or a catapult. The shot follows real gravity.
- **Machines:** levers lift gates, pulleys lift heavy things, and ramps move rocks. The player builds them from parts.
- **Nature:** the food chain decides which creature friend helps. Magnets pull metal enemies. Plants grow with light and water.

**View:** travel and villages use a 2D top-down view. Battles and physics puzzles use a 2D side view, so that gravity goes down the screen.

**Mistakes:** a wrong answer costs health. After a mistake, the game gives a short hint, so the player learns and does not only guess.

**Defeated enemies:** soldiers retreat or surrender. Creatures become calm, and some become friends. The game shows no blood and no deaths.

**Lost battle:** the player goes back to the village and loses some small items, for example coins or materials. The player never loses a creature friend, a crafted machine, or a title. Grade 1 battles have no item loss. A parent can make losses harder in the settings.

**Two players:** the players take turns in the same battle. Each player gets problems at their own level.

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

**Titles**, based on the old exam system (thi Hương, thi Hội, thi Đình): Tú tài, Cử nhân, Tiến sĩ, Bảng nhãn, Trạng nguyên. The final title, Trạng nguyên, needs a pass in all five eras.

**No shame:** a player who does not pass keeps their level. The game shows the skills to practice, and the player can try again later.

**Văn võ song toàn:** when a player has the scholar title and the battle win of an era, the game shows *văn võ song toàn*, "complete in both learning and strength." The bamboo on the title screen grows one section.

## Hero, legends, creature friends, and crafting

**Hero:** the player makes their own hero: name, boy or girl, face, hair, and clothes of the era. The hero starts as an ordinary village child with no special power and no calling. The player chooses a calling after the first Văn Miếu exam (see Prologue and callings).

**Legends:** in each era, the player meets the legends of that time.

- First, a legend is a mentor. The legend tells their story, teaches a skill, and gives a quest. Example: Thánh Gióng teaches about iron and fire, and asks the player to help the smiths make his iron horse.
- In the final battle of the era, the legend joins the party as a companion.

**Creature friends:** calm creatures can become friends, for example a golden turtle, a Lạc bird, a water buffalo, or a small dragon. Each friend has an element and a special help, for example a hint, a shield, or a stronger element attack. The player keeps them in a collection and chooses up to 3 for each battle.

**Crafting:** the player collects materials in travel and battles: bamboo, wood, stone, iron, rope. The player builds tools and machines from parts: a raft, a lever, a pulley, a catapult, a water wheel. A machine only works if the player builds it correctly, for example the lever needs the correct place for the fulcrum.

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
- **Drawing:** Canvas 2D for maps and battles. HTML, CSS, and SVG for dialogue, menus, exams, settings, and the parent page, so that Vietnamese text is sharp and easy to translate.
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
| World | Square tile map, collision grid, A\* pathfinding | The child taps a place and the hero walks there |
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

The first version is one small, complete part of Era 1. It tests the fun and the learning before the rest of the game is built.

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
