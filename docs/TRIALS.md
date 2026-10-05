# The Five Trials as work in the village

The Five Trials of the prologue are work in the village, not quizzes. The child helps five people with work that has the math (or the science) inside it. The world answers each try; no question and no numeral show. `docs/DESIGN.md` ("The world and how it plays", "The Five Trials", and the rules of learning by doing) is the source of truth.

| Part | File |
| --- | --- |
| The numbers of each task, by level, and the skill of each level | `data/trials.json` |
| The pure rules (a bundle of ten, the glow, the row of stakes, the basket, the equal sticks) | `src/core/world/trials.js` |
| The things of the tasks in the world, the puts, the timed parts, and the commits | `src/core/world/systems/work.js` |
| The start from the talk, the action button, the flag, the reward, and the done line | `src/core/session.js` |
| The places of the things on the map | `tools/maps/era1.py` (`layers.places` of Phù Đổng) |
| The figures | `workThing` in `src/world/figures.js` |
| The stories | `tests/stories/trial-*.json` and `tests/stories/calling.json` |

The four tasks of the story after the trials (the iron horse, rice for Gióng, the bamboo staffs, and the loot after a raid) use the same system: see `docs/TASKS.md`.

## How a trial goes

1. The child talks to the person (after the elder starts the prologue). The talk says the work in words, with the numbers of the level as words (`num.<n>`: "ten", "four"), and it starts the task: its things lie at their places near the person. No screen opens.
2. The child walks to a thing and presses the action button (or E): one button does every step (`docs/TASKS.md`). Every try is free until the commit. The commit is one skill event for the learner (the child never sees it).
3. When the work is done, the flag of the trial is set, three goods fly from the person to the basket of the HUD (measures of rice, fish, or eggs; `data/trials.json`), and the person says the done line. It names the calling of the trial.
4. After the five trials, the elder opens the way to Văn Miếu, where the child chooses a calling (as before).

## The five tasks

| Trial | The work | The commit | The world answers | Skill by level (1, 2, 3) |
| --- | --- | --- | --- | --- |
| The teacher (Nho sinh) | The button picks up a rod at the heap and puts it on the mat; with empty hands at the mat, it takes one rod back. | The button at the teacher (the rope): the teacher ties the rods on the mat. | Ten rods tie into a bundle by the teacher. More or fewer: the band snaps, and the rods fall back on the heap. Done when fewer than ten rods are left. | count to 120; place value; place value |
| The smith (Thợ rèn) | When the child comes, the fire burns: the ore is in the forge and the water is in the trough. The smith quenches his own piece first ("Đỏ rực thì nhúng ngay!"). Then the iron of the child on the anvil glows, stays hot, dims, and stays cold, again and again. | The button at the anvil (the drop of water) drops the iron into the water. | While it glows, it hisses and becomes a hard blade. Too early or too late, it bends and goes back into the fire. | states of matter; states of matter; materials |
| The fisher (Ngư dân) | The fisher put the first two stakes; the space between them is the space of the row. The child carries stakes from the sand and puts each one on the line in the river (it snaps to the half-block grid), and can take one back. | The tide comes in (after some time, and again after each tide). | No space wider than the space of the row, and a stake at the red float: the fish stay in the trap. If not, they swim out through the widest space, and the next tide comes. | add to 20 (the number line of the bridge), at levels 1, 2, 3 |
| The healer (Thầy thuốc) | Three beds of herbs (mugwort, perilla, pennywort). The child carries bunches to the basket; each kind goes to its part of the basket. | The button at the healer (the basket): she takes the basket. | The same number of each kind: she takes the basket. If not, she gives it back, and the extra bunches fly back to their beds. | count; add to 20; multiply |
| The woodcutter (Tiều phu) | A fallen bamboo stem. The button at the stem puts a chalk mark at the ghost in front of the hero; at a mark, it takes the mark away. | The button at the woodcutter (the knife): he cuts at the marks. | Equal sticks: he ties them into a bundle, and the child carries it to the wood pile by the bridge. Not equal: the short stick breaks, and a new stem comes. | add to 20 (the number line of the bridge), at levels 1, 2, 3 |

The level comes from the grade that the player gave (`grades` in `data/trials.json`): grades Pre-K to 1 are level 1, grade 2 is level 2, and grade 3 and up are level 3. The numbers of each level are in the data (the rods, the hold of the glow, the space of the row and the time of the tide, the bunches of each kind, the length of the stem and the number of sticks).

The first commit of a trial carries the efficient mark (the fewest parts on the first try: the fewest stakes, a bundle of ten on the first tie). A later success is correct at the lowest level of the skill, as on the bridge.

## Rules of the world that the trials keep

- No question, no answer field, no multiple choice, and no numeral in the world. A person says a number as a word.
- Failure is physical and cheap: the band snaps, the iron bends, the fish swim out, the healer gives the basket back, the short stick breaks. Nothing is lost.
- A person in the way does not stop a walk: the hero steps around (the route system).
