# The tasks of the world

This file has two parts: how every task plays (the moves, the one action button, and the next step), and the work of the story in Era 1.

## How a task plays

Every task in the world must be clear to a child of six. Young children need large touch targets, a precise drag is hard for them, and a thing in the world is only a few millimeters on a phone (see issue #34). So one rule is the same for all tasks: **a tap goes there, the button does it.**

### The controls

- **Move:** the stick, the arrow keys (or W A S D), or a tap on the ground: the hero walks there.
- **The action button** (E or Enter on a keyboard): it does every step of every task.
- **The jump** (Space, or J) and **the wave** (ask for help, `docs/MENTOR.md`).
- **The view** turns with the buttons at the bottom right, or with Z and C (`src/core/keys.js`).
- **A tap on a thing or a person** walks the hero to it and makes it the target. A tap never does a step of a task, and a tap on a person never starts a talk: the button does. A tap on Nghé still pets her.

### The target

- The target is the thing in reach that the button acts on now (`action()` in `src/core/session.js`). The thing in front of the hero comes first; a thing behind the hero comes last; the thing of the last tap comes before the others.
- The target has a thicker ink outline and a soft light on the ground under it (`mark()` in `src/render/figure3d.js`). The button shows the picture of the act. With no target, the button is dim and has no picture.
- **Places on a line** (a stake on the line of the fisher, a chalk mark on the stem, a plank at the gap of the bridge, a trap in the stream): a pale ghost of the thing shows at the spot in front of the hero, on the half-block grid. A press puts the thing at the ghost. A tap on the line chooses the spot.
- When the button acts, the target pulses once.
- On Nghé, the only target is the way down.

### What the button does, the same in every task

| Where the hero is | The act | The picture |
| --- | --- | --- |
| Empty hands at a thing that can be carried | Pick it up. One press, one thing. | A hand that holds a thing (`hand-pick`) |
| A thing in the hands at a place that takes it | Put it there. One press, one thing. | A hand that sets a thing down (`hand-put`) |
| A thing in the hands, anywhere else | Put it down on the ground. | `hand-put` |
| Empty hands at a place with things in it | Take one back: the last thing put (on a line or in the stream, the thing in front). | `hand-pick` |
| At the person of the task, during the task | The person checks the work (the finish). | The picture of the finish (below) |
| The glowing iron on the anvil | Quench. | A drop of water (`water`) |
| The bellows, with lumps in the hearth | Blow. | Fire (`fire`) |
| A bronze drum | A beat. | The drum (`drum`) |
| The jar of feed | Pour while the button is down. | The jar (`jar`) |
| A standing culm of the staffs | While the button is down, the mark goes up the culm; when it goes up, the slash is at the mark. | A knife (`knife`) |
| A stake of a plot in a choose round | Choose that plot. | A tick (`check`) |
| A plank outline of the guess at the bridge (the outline in front of the hero) | Choose it: the bridge takes that many planks. | A tick (`check`) |
| The stem of the woodcutter | A chalk mark at the ghost; at a mark, the mark comes away. | Chalk (`chalk`), or the clear sign (`clear`) |
| A gift in the hands, at a person who takes the rest of the loot | Give it. | A hand that holds a thing out (`hand-give`) |
| A person with no task for the child | Talk. | The speech bubble (`talk`; the loudspeaker `speak` is only for the voice: it reads a line aloud) |
| Nghé | Get on. | `ride` |
| On Nghé | Get off. | `ride-off` |

The raised hand is only the wave button, and the jump has its own picture: no two buttons on the screen have the same picture.

### The table of the tasks

| Task | The targets, and the act at each one | The finish at the person (its picture) | The cue |
| --- | --- | --- | --- |
| The teacher (rods) | A rod of the heap: pick up. The mat: put; with empty hands, take one back. The heap: put a rod back. | The teacher ties the rods on the mat (`rope`). | The heap, while the mat is empty. |
| The smith (forge) | The fire burns when the child comes: the ore is in the forge and the water is in the trough. The smith quenches his own piece first, then the iron of the child comes on the anvil. The anvil while the iron glows: quench. | The quench is the commit. | The iron while it glows. |
| The fisher (stakes) | A stake: pick up. The line in the river: put at the ghost; with empty hands at a stake, take it back (at low tide). | The tide comes by time. | The stakes, while the line is empty. |
| The healer (herbs) | A bunch of a bed: pick up. The basket: put; with empty hands, take one back. | The healer takes the basket (`basket`). | A bed, while the basket is empty. |
| The woodcutter (stem) | The stem: a chalk mark at the ghost; at a mark, the mark comes away. | The woodcutter cuts at the marks (`knife`). | The stem, before the first mark. |
| The iron horse (story) | A lump: pick up. The hearth: put; with empty hands, take one back. The bellows: blow. The anvil while the iron glows: quench. | The fire and the quench are the commits. | The heap, while the hearth is empty; the iron while it glows. |
| Rice for Gióng (story) | A tray: pick up. The pot: put. | Each ten bowls in the pot: Gióng eats. | The trays, while the pot is empty. |
| Bamboo staffs (story) | A standing culm: hold the button, let go at the height. | The pieces tie when all are cut. | None. |
| The loot (story) | A coin: pick up. A mat: put; with empty hands, take one back. The rest of the loot: give it to a person. | All coins on the mats. | The coins, while the mats are empty. |
| The bridge | Before the first plank, a plank outline on the bank: the guess. A plank of a pile: pick up. The gap: put at the ghost; with empty hands at the edge, take the last plank back. | The gap is full. | Nghé shows the gap (the mentor). |
| The small events of the day | A thing of the pile: pick up. The place: put; with empty hands, take one back. | The person of the event checks the place (`check`). | The pile, while the place is empty. |
| The planting | A bundle of the seedbed: pick up. The edge of a plot: put; with empty hands, take one back. A stake of a plot in a choose round: choose. | The planter looks at the plots (`seedling`). | The seedbed, while the edges are empty. |
| Feeding the ducks | The jar: hold the button to pour; let go at the total. | The ducks eat. | The jar, before a pour. |
| The fish traps | A trap: pick up. A spot in the stream: put at the ghost; with empty hands, take the trap in front back. | The fisher uncle opens the weir (`weir`). | The pile of traps, while the stream is empty. |
| The drum dance | The bronze drum: a beat. | The dance ends. | The drum, before the dance. |

### The places of a task

- The heap and the place of a task stand close, one or two steps apart, so that the trips are short. Two targets that the child moves between (the heap and the place, two beds, the person and the place) stand at least two blocks apart, so that the target in front is never in doubt (a test in `tests/tasks.test.js`; the places are in `tools/maps/era1.py`).
- The work of each trial is in the open: from the first angle of the camera, no house or roof covers a place of a trial, and nothing at all covers the forge, the anvil, and the trough of the smith.
- The things of the trials are solid (#32): the forge and the well block their cells on the map; the trough, the anvil (with the iron on it), and each heap of a trial have a solid box (`solid.rect`), so that the hero stands next to them, never in them. The walks of the hero go around these boxes.

### The next step shows itself

- **The first step, one time.** At the start of a task, the person shows the first step on the real things and says it (the move `first` in `src/core/mentoring.js`). The teacher puts one rod on the mat, the healer puts one bunch into the basket, and the fisher puts one stake on the line; then the person says "Như thế này nhé." and takes the thing back to its heap, so that the place is empty when the child starts. The first step never leaves a part of the answer (rule 25 of `docs/DESIGN.md`). The smith shows the quench on his own piece ("Đỏ rực thì nhúng ngay!"), and the iron of the child comes on the anvil after it. A task with no heap (the woodcutter, the ducks, the drum): the person points at the place and says what to do. A task of exact rounds (the planting, the fish traps): the person only points at the heap and at the place. The person shows the first step one time in a visit; the later rounds of a practice start with no demonstration.
- **A small example first, at a station of Xóm Ruộng.** Before the first round of a visit, the person of a station does the whole work one time on a smaller instance of its own, with other numbers, and with the button picture of each act over the person; then the round of the child starts, and the example goes (`docs/HAMLET.md`, "A small example first"). The pointing of the first step comes after it, on the real things.
- **The cue.** When the child does nothing for six seconds in a task, the thing to touch next glows softly: a warm disc under it that breathes, and a small breath of the thing (the event `cue`; `glow()` in `src/render/figure3d.js`). Any action of the child stops it. The cue shows how to go on, never how many: it never glows on a commit that counts.
- After the cue, the mentor goes on as before (`docs/MENTOR.md`).

### Tests and stories

- `tests/tasks.test.js`: for the teacher, the smith, the healer, the woodcutter, and the fisher, the act and the picture of the button at each target, one press for one thing, the take back with empty hands, and the finish at the person; a tap on a rod, the mat, the basket, the stem, or the iron only walks; Nghé on and off; the places close and apart.
- Every story of a task plays with moves and the action button only (the step `press` in `src/core/story.js`: a walk to the target, then the button); no story taps a thing of a task.
- Stories: `trial-teacher-button` (pick, put, take back, and the tie at the teacher), `trial-smith-button` (the whole smith trial with the button, and its pictures), `trial-smith-taps` (taps on the smith during the task open the start talk zero times), and `trial-smith-cue` (the quench of the smith, the glow of the iron of the child, and the end of the glow).

## The work of the story in Era 1

After the Five Trials, the story of Gióng has four more tasks with the hands. They are work in the village, on the same system as the trials (`docs/TRIALS.md`): the things lie in the world, the child carries them or acts on them with the button, and the world answers each commit. No question, no answer field, and no numeral show. A person says a number as a word.

| Part | File |
| --- | --- |
| The numbers of each task, by level, and the skill of each level | `data/trials.json` (the entries with `"kind": "task"`) |
| The pure rules (the bowls in the pot, the lumps in the hearth, the equal pieces, the share) | `src/core/world/trials.js` |
| The things of the tasks in the world, the puts, the timed parts, and the commits | `src/core/world/systems/work.js` |
| The start from a talk (or from the end of a raid), the action button, the flag, and the done talk | `src/core/session.js` |
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
| The iron horse (the smith) | The smith takes the six pieces of iron that the child found and puts them on a heap by the forge, with three lumps of old iron. The child carries lumps into the hearth and can take a lump out again. | The button at the bellows. | Six lumps: the fire burns high, and the iron lies on the anvil. Too few: the fire puffs and dies. Too many: the fire chokes, and the extra lumps roll back to the heap. Then the iron glows and dims as in the trial of the smith (a sound when it turns hot); the button at the anvil drops it into the water: at the right moment it becomes the iron horse; too early or too late, it bends and goes back into the fire. | The bellows: count to 120 (levels 1, 1, 2). The water: states of matter (levels 1, 2, 2). |
| Rice for Gióng (the mother) | Trays of three bowls and of five bowls lie at the edge of the paddies. The child carries one tray at a time to the pot in front of the house of Gióng. A tray that goes into the pot comes back full to the path. | Each full ten in the pot. | Each ten bowls, Gióng eats and grows one head taller; the rest stays in the pot, and the pot shows it as bowls. The count shows on his height, not as a number. Two heads at level 1, three at level 2, four at level 3. | add to 10; add to 20; place value. Solved: the pot came to exactly ten. Efficient: with the fewest trays. |
| The bamboo staffs (the woodcutter) | A clump of standing bamboo grows by the big road in front of the đình: a culm for each staff, with a ring at each half block. The child walks to a culm and slashes it at the height of the hand (up to the reach of the hand), one culm at a time, at once: no chalk, and no taking back. The top falls away, and the piece from the ground to the cut (a staff, as long as the height of the cut) stands where the culm stood, so that the heights of the pieces stand side by side. | The last culm is cut. | Equal pieces tie into a bundle of staffs for the men of the village. If not, the pieces that are not equal to the others break, and their culms grow again. Two culms at level 1, four at level 2, six at level 3. The woodcutter's own trial (a stem on the ground, with chalk) stays as it is. | shapes (equal parts); shapes; unit fractions |
| The loot (after a won raid) | A pile of coins lies behind the wall, and three mats: the basket of the hero, Nghé, and Gióng. The child carries coins from the pile to the mats, and from a mat back. | The hands are empty, and the pile has too few coins to even out the mats. | Equal mats, with fewer coins in the pile than friends: all are happy, and the coins of the hero fly to the counter. The rest becomes a small red cloth with the coins in the hands of the hero; the child carries it to the village, to the elder at the đình, the smith, or the mother of Gióng, and that person says one line of thanks (nothing is scored; the cloth goes with the hero to other maps). If not, Nghé turns away and shakes her head until the share is fair. Seven coins after the first soldiers, ten after the second, twelve after the boss. | fair sharing, level 1; fair sharing, level 2; division, level 1 (`math.share.equal`, then `math.div.10`) |

The level comes from the grade that the player gave, as for the trials.

### Notes

- The crafting screen of the iron horse is gone: its recipe, its element rules, and its texts are removed. The forge work replaces it.
- The soldier raids and the boss give no coins as a gift now: their coins are the loot. The scouts still give iron (for the horse) and coins.
- Gióng stands at the side of the hero in the soldier raids too, so that he is there for the share.
- A share is judged only when the pile cannot even out the mats any more. So a child who fills one mat after the other (four, four, then two with two coins left) is not judged before the last coins go down.
