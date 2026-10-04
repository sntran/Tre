# The tasks of the world

This file has two parts: how every task plays (the taps, the action button, and the next step), and the work of the story in Era 1.

## How a task plays

Every task in the world must be clear to a child of six. A child of this age taps well, drags less well, and misses small targets (see issue #31). So a task has one meaning for each tap, an action button for the hands, a next step that shows itself, and taps that hit what the child touched.

### The three rules

1. **A tap on a thing does the job of that thing, and only one job.** A tap never does two opposite things on the same thing. A rare undo is a drag, or a tap on the thing in its place (it comes back into the hands).
2. **The action button does the hands**, as Space does on a keyboard: it picks up the nearest thing, puts the thing in the hands, and does the finish of the task in reach.
3. **A tap on a person** talks when the person has no task for the child. During the task of the person, it asks for help: one short line, and the person shows the next step (the mentor, `docs/MENTOR.md`). It never opens the start talk again.

### The action button

- A large round button at the bottom right, next to the jump button and larger than it. It always stands in the same place.
- It shows a picture of what it does now, with no words: a hand (pick up or put), a rope (tie), a drop of water (quench), fire (blow the bellows), a basket (give), a knife (cut), a seedling (plant), the weir (open), the drum (a beat), and the jar (pour, while the button is down).
- With nothing to do, it is dim and has no picture.
- When it acts, the thing that it acted on pulses once.
- The session gives the action now (`action()` in `src/core/session.js`: the finishes in reach first, then the hands). The command `hands` (the button, or Space) does it. The view (`src/ui/village.js`) shows the picture (`art/ui/*.svg`).

### The next step shows itself

- **The first step, one time.** At the start of a task, the person shows the first step on the real things and says it (the move `first` in `src/core/mentoring.js`). The teacher puts one rod on the mat; the smith puts one lump of ore into the forge and pours one bucket into the trough; the healer puts one bunch into the basket; the fisher puts one stake on the line. A task with no heap (the woodcutter, the ducks, the drum): the person points at the place and says what to do. A task of exact rounds (the planting, the fish traps): the person only points at the heap and at the place, so that each round stays the child's. The person shows the first step one time in a visit; the later rounds of a practice start with no demonstration.
- **The cue.** When the child does nothing for six seconds in a task, the thing to touch next glows softly: a warm disc under it that breathes, and a small breath of the thing (the event `cue`; `glow()` in `src/render/figure3d.js`). Any action of the child stops it. The cue shows how to go on, never how many: it never glows on a commit that counts.
- After the cue, the mentor goes on as before (`docs/MENTOR.md`).

### Taps hit what the child touched

- During a task, the places and things of the task come before a person (`targetAt` in the session, `targetUnder` in the view).
- A place of a task answers a tap on its whole box, with a pad of two half blocks (`ZONE_PAD`).
- Next to a place of a task, the box of a person has no pad and is a little smaller (`PERSON_PAD_AT_PLACE`), so that only a tap on the body is for the person.

### The table of the tasks

| Task | The tap of each thing | The finish (the action button picture, and the tap) | The undo | The cue |
| --- | --- | --- | --- | --- |
| The teacher (rods) | A rod of the heap: it goes on the mat. | The rope: a tap on the rods on the mat or on the straw rope. | Drag a rod from the mat to the heap. | The heap, while the mat is empty. |
| The smith (forge) | Ore of the heap, then the forge: the ore goes in. A bucket, then the trough: the water goes in. | The drop of water: a tap on the glowing iron. | More ore than the forge needs rolls back to the heap. A bent iron goes back into the fire. | The ore heap while the forge needs ore; the bucket while the trough is dry; the iron while it glows. |
| The fisher (stakes) | A stake, then the line in the river: it goes on the line. | The tide comes by time. | A tap on a stake on the line (at low tide): it comes back into the hands. | The stakes, while the line is empty. |
| The healer (herbs) | A bunch, then the basket: it goes into its part. | The basket: a tap on the full basket. | A tap on a bunch in the basket: it comes back into the hands. | A heap of bunches, while the basket is empty. |
| The woodcutter (stem) | The stem: a chalk mark there. | The knife: only the action button. | A tap on a chalk mark takes it away. | The stem, before the first mark. |
| The iron horse (story) | Lumps, then the hearth. | Fire: a tap on the bellows; then the drop of water: a tap on the glowing iron. | A tap on a lump in the cold hearth: it comes back. | The heap, while the hearth is empty; the iron while it glows. |
| Rice for Gióng (story) | A tray of bowls, then the pot. | Each ten bowls in the pot: Gióng eats. | None (each tray counts). | The trays, while the pot is empty. |
| Bamboo staffs (story) | A standing culm: a slash at the height of the tap. | The pieces tie when all are cut. | Pieces that are not equal break, and the culms grow again. | None. |
| The loot (story) | A coin, then a mat. | All coins on the mats. | A tap on a coin on a mat: it comes back. | The coins, while the mats are empty. |
| The bridge | A plank of a pile, then the gap. | The gap is full. | At the edge, a tap on the last plank takes it back. | Nghé shows the gap (the mentor). |
| The small events of the day | A thing of the pile, then the place. | The hand: only the action button. A tap on the place with empty hands is a check. | Too many: the last things go back to the pile. | The pile, while the place is empty. |
| The planting | A bundle of the seedbed, then the edge of a plot; a stake of a plot (a choose round). | The seedling: only the action button. | A tap on a bundle at the edge: it comes back. | The seedbed, while the edges are empty. |
| Feeding the ducks | The jar: the hero walks to it. | The jar: hold the button (or the jar) to pour; let go at the total. | The next pour goes on from where it stopped. | The jar, before a pour. |
| The fish traps | A trap, then a stake in the stream. | The weir: a tap on the weir. | A tap on a trap in the stream takes it up. | The pile of traps, while the stream is empty. |
| The drum dance | The bronze drum: a beat. | The drum: the button is a beat too. | A miss starts again from the last good jump. | The drum, before the dance. |

### Tests and stories

- `tests/tasks.test.js`: for the five trials, the tap of each thing does its one job, the finish works with the action button, and the undo works.
- Stories: `trial-teacher-tap` (a tie with a tap on the mat; a take-back with a drag), `trial-smith-button` (the whole smith trial with the action button only, and its pictures), `trial-smith-forge-tap` (a tap on the forge right next to the smith), `trial-smith-taps` (ten taps on the smith during the task open the start talk zero times), and `trial-smith-cue` (the first step, the glow of the heap and of the iron, and the end of the glow).

## The work of the story in Era 1

After the Five Trials, the story of Gióng has four more tasks with the hands. They are work in the village, on the same system as the trials (`docs/TRIALS.md`): the things lie in the world, the child carries them or taps them, and the world answers each commit. No question, no answer field, and no numeral show. A person says a number as a word.

| Part | File |
| --- | --- |
| The numbers of each task, by level, and the skill of each level | `data/trials.json` (the entries with `"kind": "task"`) |
| The pure rules (the bowls in the pot, the lumps in the hearth, the equal pieces, the share) | `src/core/world/trials.js` |
| The things of the tasks in the world, the puts, the timed parts, and the commits | `src/core/world/systems/work.js` |
| The start from a talk (or from the end of a raid), the taps, the flag, and the done talk | `src/core/session.js` |
| The places on the map | `tools/maps/era1.py` (`rice-trays`, `giong-pot`, `horse-ore`, `staffs-clump`) |
| The loot of each raid | `loot` in `data/raids.json` |
| The figures | `workThing` in `src/world/figures.js`; the looks in `data/figures.json` |
| The stories | `tests/stories/rice-giong.json`, `forge-horse.json`, `staffs-bamboo.json`, and the share in `raid-soldiers.json` and `raid-boss.json` |

### The order in the story

1. The iron horse (the quest "The iron horse", after the child finds six pieces of iron).
2. Rice for Gióng (after the horse; Gióng grows up).
3. The loot after each soldier raid.
4. The bamboo staffs (after the two soldier raids; the general comes only after the staffs).
5. The loot after the boss, and then the farewell of Gióng.

### The four tasks

| Task | The work | The commit | The world answers | Skill by level (1, 2, 3) |
| --- | --- | --- | --- | --- |
| The iron horse (the smith) | The smith takes the six pieces of iron that the child found and puts them on a heap by the forge, with three lumps of old iron. The child carries lumps into the hearth and can take a lump out again. | A tap on the bellows. | Six lumps: the fire burns high, and the iron lies on the anvil. Too few: the fire puffs and dies. Too many: the fire chokes, and the extra lumps roll back to the heap. Then the iron glows and dims as in the trial of the smith (a sound when it turns hot); a tap drops it into the water: at the right moment it becomes the iron horse; too early or too late, it bends and goes back into the fire. | The bellows: count to 120 (levels 1, 1, 2). The water: states of matter (levels 1, 2, 2). |
| Rice for Gióng (the mother) | Trays of three bowls and of five bowls lie at the edge of the paddies. The child carries one tray at a time to the pot in front of the house of Gióng. A tray that goes into the pot comes back full to the path. | Each full ten in the pot. | Each ten bowls, Gióng eats and grows one head taller; the rest stays in the pot, and the pot shows it as bowls. The count shows on his height, not as a number. Two heads at level 1, three at level 2, four at level 3. | add to 10; add to 20; place value. Solved: the pot came to exactly ten. Efficient: with the fewest trays. |
| The bamboo staffs (the woodcutter) | A clump of standing bamboo grows by the big road in front of the đình: a culm for each staff, with a ring at each half block. The child walks to a culm and slashes it at the height of the hand (up to the reach of the hand), one culm at a time, at once: no chalk, and no taking back. The top falls away, and the piece from the ground to the cut (a staff, as long as the height of the cut) stands where the culm stood, so that the heights of the pieces stand side by side. | The last culm is cut. | Equal pieces tie into a bundle of staffs for the men of the village. If not, the pieces that are not equal to the others break, and their culms grow again. Two culms at level 1, four at level 2, six at level 3. The woodcutter's own trial (a stem on the ground, with chalk) stays as it is. | shapes (equal parts); shapes; unit fractions |
| The loot (after a won raid) | A pile of coins lies behind the wall, and three mats: the basket of the hero, Nghé, and Gióng. The child carries coins from the pile to the mats, and from a mat back. | The hands are empty, and the pile has too few coins to even out the mats. | Equal mats, with fewer coins in the pile than friends: all are happy, and the coins of the hero fly to the counter. The rest becomes a small red cloth with the coins in the hands of the hero; the child carries it to the village, to the elder at the đình, the smith, or the mother of Gióng, and that person says one line of thanks (nothing is scored; the cloth goes with the hero to other maps). If not, Nghé turns away and shakes her head until the share is fair. Seven coins after the first soldiers, ten after the second, twelve after the boss. | fair sharing, level 1; fair sharing, level 2; division, level 1 (`math.share.equal`, then `math.div.10`) |

The level comes from the grade that the player gave, as for the trials.

### Notes

- The crafting screen of the iron horse is gone: its recipe, its element rules, and its texts are removed. The forge work replaces it.
- The soldier raids and the boss give no coins as a gift now: their coins are the loot. The scouts still give iron (for the horse) and coins.
- Gióng stands at the side of the hero in the soldier raids too, so that he is there for the share.
- A share is judged only when the pile cannot even out the mats any more. So a child who fills one mat after the other (four, four, then two with two coins left) is not judged before the last coins go down.
