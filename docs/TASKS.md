# The tasks of the world

This file has two parts: how every task plays (the moves, the one action button, and the next step), and the work of the story in Era 1.

## How a task plays

Every task in the world must be clear to a child of six. Young children need large touch targets, a precise drag is hard for them, and a thing in the world is only a few millimeters on a phone (see issue #34). So one rule is the same for all tasks: **a tap goes there, the button does it.**

### The controls

- **Move:** the stick, the arrow keys (or W A S D), or a tap on the ground: the hero walks there.
- **The action button** (E or Enter on a keyboard): it does every step of every task.
- **The jump** (Space, or J) and **the wave** (ask for help, `docs/MENTOR.md`).
- **The view** turns with the buttons at the bottom right, or with Z and C (`src/core/keys.js`).
- **A tap on a thing or a person** walks the hero to it and makes it the target. A tap never does a step of a task, and a tap on a person never starts a talk: the button does. Out of a task, a tap on Nghé pets her; in a task, a tap on Nghé is a tap on what is under or behind her, and Nghé never stands on a place of the work (#47).
- **What a tap hits** (`src/world/hit.js`, the same for the village and the tests): a place of a task under the finger comes before a thing that only touches the finger with its margin, and before a person who stands in front of it. A tap on water stops at its surface. A long press that does not move is a tap too.

### The target

- The target is the thing in reach that the button acts on now (`action()` in `src/core/session.js`). The thing in front of the hero comes first; a thing behind the hero comes last; the thing of the last tap comes before the others.
- **The next press never undoes the last one** (#47, #54). After the act on the target of a tap, the tap is used up. A thing comes back from a place, a plank comes back from a span, and a thing goes back on its own heap only after a tap on it (with the heap in reach or not). A chalk mark goes away only after a tap on it. With a heap of the work in reach, the finish at the person (a try) comes after a tap on the person, or when the press has no other work in the task, near or far. With no heap in reach, a press does the finish. The give of the basket of the healer always needs a tap on the healer (#63): a give is a try, and a press never knows that the basket has enough. A finish with no tap comes only after a put of the child in the task: the first step that the mentor shows is not a try.
- **The work comes first** (#54). While the task of a person is open, a talk to that person is a call for help, and it needs a tap on the person. A press with no tap does the nearest work. In a task, when no work is in reach (only a talk, a look, or Nghé), a press walks the hero to the nearest work of the task (the heap, the place for the thing in the hands, the anvil, the culms; at most 40 cells away), and the act comes at the end of the walk. An act that goes on while the button is down (a slash) does not start at the end of a walk: the button is up. The walk goes only to the work of the task whose area the hero is in (its pool of light, #65, or next to the person who gives the task), never to another task or back across the village (#66). A thing of a task in the hands flies back to its heap when the hero leaves the area of the task, and the hands are free.
- **A press during a walk does the act of the picture at the press** (#66). At the end of the walk, the press does that act on that target when it can, or the act of the button on the work of the same task (a press walked to the heap of rods, and at the mat the button puts a rod on the mat); if not, nothing, and the button pulses. It never chooses a talk or a ride in place of the work. During the walk to a tapped person, place, or thing, the button shows the act at the end of the walk at once (#68): the rope at the teacher, the basket at the healer, the pick at the plank pile. A press during that walk does that act at the end of the walk, one act for each press. When the walk ends `stuck` or that act is not there, the press does nothing and the button pulses: it never does the ride or another act.
- **A tap on a thing that the open line names goes on with the talk** (#66). Grandma says "Chạm vào Bông, rồi bấm nút lớn để cưỡi." as the last line of her first talk, and a tap on the calf closes the box and chooses the calf.
- **A walk to a person goes to where the person is** (#66). A person who walks (to the station, home) is followed to the end. On Nghé, next to a person or the enemies of an encounter, one press gets the hero down and opens the talk.
- **One press, one thing** (#61). At the mat of the teacher and the basket of the healer, when the heap and the place are both in reach, a press with empty hands takes one thing from the heap and puts it on the place in one move: a child who counts the presses counts the things. When the place is out of reach, the press only picks. A tap on any thing of a heap chooses that heap. A tap on a thing on the place still takes it back (#47). The thing of an example (the first step of a person) is the person's until the person takes it back: a press never takes it, and the example never takes a thing that the child put.
- **Things that a child can count** (#61). The rods on the mat lie in rows of five, with a space between two rods: a full row is five, and two full rows are ten. A rod is more than 4 pixels wide on a phone at the zoom of the start. The place of the mat, where the hero works, is on the far side of the mat from the camera of the start, so the hero does not hide the rods. At the start of the task of the teacher, the pips of the goal bar light up one at a time while he says how many bundles he needs ("Thầy cần hai bó."); a tied bundle flies from the mat to its pip, and the pip fills when it lands. Each bed of the healer has a small sign with a picture of its herb and no word; the healer says the name of the herb when the child takes a bunch and after a tap on a bed. The animals stay out of each place of an open task (the mat, the basket, the beds, the line, the hearth), with a margin of 2 half blocks (`taskPlaces` in `src/core/world/systems/steer.js`).
- **The button never knows the answer** (#63). A press never reads a number that the child must find: the count of each kind of the healer (`each`), the space of the row of the fisher (`space`), the count of the teacher (`bundle`), the bowls of Gióng (`heads`), the ore of the iron horse (`ore`), the parts of the stem (`parts`), the middle of a stem, the gap of the bridge, or the count of a raid. A press does the same again. The choice that carries the math comes from the child: a tap, a walk, or the count of the presses. So presses alone never finish a task that needs a number; a child who counts right still finishes with few touches.
- **The same again** (#54, #63). With empty hands, a press takes the same kind of thing as the last pick of the child (the mentor sets it only before the child's first act in the task). At the healer, a press takes the same kind with no limit, and only a tap on another bed changes the kind; when that bed is empty, a press takes nothing. At the other tasks, a press takes another kind when the heap has no more. A tap on a thing chooses it.
- **The next stake** (#63). With a stake in the hands and no tap, a press puts it at the point of the row nearest to the hero, and the ghost shows it. When that point has a stake, the stake goes at the next free point after it (one half block). A tap on a point of the row chooses that point. The heap has only a few extra stakes (`extra`), so a row that is too close does not reach the float.
- **Never on the ground** (#54). In a task, the button never puts a thing of the task on the ground: it goes to its place, or the button does nothing. A place of a done task is never a target (the forge of the smith and the hearth of the iron horse are at the same place). The button and the world measure the reach of a place to the same point: the point of its rect nearest to the hero (`nearestPoint` in `src/core/world/zones.js`).
- The point of each place of a task is the middle of its rect; the hero stands at its edge to work there. No thing of a heap lies in the rect of a place.
- A press while the hero still walks to the target of a tap comes at the end of the walk (a child presses at once).
- **A full place takes no more** (#68). At 14 rods on the mat (`MAT_MAX`, `hasRoom` in `src/core/world/systems/work.js`), the one move does not take a rod, and the button does not show the put on the mat. With a thing in the hands that no place of its task takes, the button shows the way back to its heap.
- The target has a thicker ink outline and a soft light on the ground under it (`mark()` in `src/render/figure3d.js`). The button shows the picture of the act. With no target, the button is dim and has no picture.
- **Places on a line** (a stake on the line of the fisher, a chalk mark on the stem, a plank at the gap of the bridge, a trap in the stream): a pale ghost of the thing shows at the spot in front of the hero, on the half-block grid. A press puts the thing at the ghost. A tap on the line chooses the spot.
- When the button acts, the target pulses once.
- On Nghé, the only target is the way down.

### What the button does, the same in every task

| Where the hero is | The act | The picture |
| --- | --- | --- |
| Empty hands at a thing that can be carried | Pick it up. One press, one thing. | A hand that holds a thing (`hand-pick`) |
| A thing in the hands at a place that takes it | Put it there. One press, one thing. | A hand that sets a thing down (`hand-put`) |
| Empty hands at a heap, with its place in reach (the rods and the mat, the herbs and the basket) | Take one thing and put it on the place, in one move (#61). At the healer, the line says the put: "Ngải cứu vào giỏ rồi." | A thing that goes from the heap to the place (`hand-move`, #64) |
| A thing in the hands, anywhere else | Put it down on the ground. | `hand-put` |
| Empty hands at a place with things in it | Take one back: the last thing put (on a line or in the stream, the thing in front). | `hand-pick` |
| At the person of the task, during the task | The person checks the work (the finish). | The picture of the finish (below) |
| The glowing iron on the anvil | Quench. | A drop of water (`water`) |
| The bellows, with lumps in the hearth | Blow. | Fire (`fire`) |
| A bronze drum | A beat. | The drum (`drum`) |
| The jar of feed | One scoop for each press; the pour ends one second after the last press (#55). | The jar (`jar`) |
| A standing culm of the staffs | While the button is down, the mark goes up the culm; when it goes up, the slash is at the mark. | A knife (`knife`) |
| A stake of a plot in a choose round | Choose that plot. | A tick (`check`) |
| A plank outline of the guess at the bridge (the outline in front of the hero) | Choose it: the bridge takes that many planks. | A tick (`check`) |
| The stem of the woodcutter | A chalk mark at the ghost; at a mark, the mark comes away. | Chalk (`chalk`), or the clear sign (`clear`) |
| A gift in the hands, at a person who takes the rest of the loot | Give it. | A hand that holds a thing out (`hand-give`) |
| A person with no task for the child | Talk. | The speech bubble (`talk`; the loudspeaker `speak` is only for the voice: it reads a line aloud) |
| Nghé | Get on. | `ride` |
| On Nghé | Get off. | `ride-off` |

The raised hand is only the wave button, and the jump has its own picture: no two buttons on the screen have the same picture.

### The picture is the act (#60)

A press does the act of the picture that the child saw. When the picture of the button changes for a reason that the child did not make (a person or Nghé comes into reach or goes, the hero stops at the end of a walk, the hero turns), the new act starts 0.6 seconds after the new picture shows: a child of five or six presses about half a second after the child sees a picture. In that time a press does the act of the old picture when it is still possible; if not, the press does nothing and the button pulses once. A change that comes from a press or a tap of the child is the act at once (after a pick, the next press puts).

### One act for the picture and the press (#68)

The session keeps the act of the button (`session.action()`): its kind, its target, and an id. The view draws that act and sends its id with the press (`{ type: 'hands', id }`, and `{ type: 'hold', id }`). The session does that act, or nothing (the button pulses); no other path chooses an act at the press. The act of an older picture (up to two seconds old) is done only when it is still in reach. Each press tells its act in the event `press` (`id`, `act`, `target`, `done`). Two presses in one step do two acts on two things: the second press waits one step, until the world took the first act (the first put a bunch in the basket, and the second press put the same bunch there again). The buttons of a talk box (listen, next) sit on its top edge, away from the big button, and after a talk box closes the big button takes no press for 0.6 seconds: a child taps the next arrow one more time after the box closes.

### In a task, the button is for the task (#60)

While the task of a person is open, a look or a talk is the act of a press only when the child tapped that one (a tap on a thing of the map with a text chooses it). A tap on another thing of the task (a stake of the row) never makes the look at the river the act. With no work in reach, the press walks the hero to the work (#54).

### On Nghé, one press talks (#60)

On Nghé, when a person who can talk is in reach, the button shows the talk: one press gets the hero down and opens the talk. With no person in reach, the press gets the hero down, as before.

### The ride is easy to find (#60)

A tap on Nghé (with a heart) chooses her: next to the hero, the button shows the ride, also when other things are in reach (not in a task, a raid, or a folk game). After the child names the calf, grandma says how to ride: a touch on the calf, then the big button.

### The table of the tasks

| Task | The targets, and the act at each one | The finish at the person (its picture) | The cue |
| --- | --- | --- | --- |
| The teacher (rods) | A rod of the heap: pick up; with the mat in reach too, one press puts it on the mat. The mat: put; with empty hands, take one back. The heap: put a rod back. For grade 1 and below the mat shows a frame of ten (two rows of five places, `matSlot`); a rod over ten lies in a row outside the frame (#69). The mat is solid: the hero stands beside it. Next to the mat the view comes closer (`MAT_CLOSE` in `src/ui/village.js`), so that a rod is at least 8 pixels wide on a phone. | The teacher ties the rods on the mat (`rope`). | The heap, while the mat is empty. |
| The smith (forge) | The fire burns when the child comes: the ore is in the forge and the water is in the trough. The smith quenches his own piece first, then the iron of the child comes on the anvil. The anvil while the iron glows: quench. The iron is bright red with a glow and sparks for the whole hot time (`iron-hot`, `ironLook` in `src/core/world/systems/work.js`), dark red-brown under it, and grey when cold; never yellow (#70). At the start of the work the smith stands beside the forge, and the hero walks to the side of the anvil away from the view. After a miss the smith says why: "Sắt chưa đủ nóng, nên cong." or "Sắt nguội mất rồi, nên cong." | The quench is the commit. | The iron while it glows. |
| The fisher (stakes) | A stake: pick up. The line in the river: put at the ghost (the point nearest to the hero, or the point of a tap, #63); with empty hands at a stake, take it back (at low tide). With a stake in the hands, a hint names the row ("Cắm cái cọc này lên hàng nhé."), or, while the tide is in, says to wait (#70). | The tide comes by time. | The stakes, while the line is empty. |
| The healer (herbs) | A bunch of a bed: pick up; with the basket in reach too, one press puts it in the basket. The basket: put; with empty hands, take one back. Each put has its line, also the fourth of a kind (#70). The healer stands beside her beds, never on one, and a tap on her body chooses her, also over a thing under her feet. | The healer takes the basket (`basket`), after a tap on her (#63). | A bed, while the basket is empty. |
| The woodcutter (stem) | The stem: a chalk mark at the ghost; at a mark, the mark comes away. | The woodcutter cuts at the marks (`knife`). | The stem, before the first mark. |
| The iron horse (story) | A lump: pick up. The hearth: put; with empty hands, take one back. The bellows: blow. The anvil while the iron glows: quench. | The fire and the quench are the commits. | The heap, while the hearth is empty; the iron while it glows. |
| Rice for Gióng (story) | A tray: pick up. The pot: put. | Each ten bowls in the pot: Gióng eats. | The trays, while the pot is empty. |
| Bamboo staffs (story) | A standing culm: hold the button, let go at the height. | The pieces tie when all are cut and each is as long as the sample staff at the head of the row (#54). | None. |
| The loot (story) | A sack: pick up. A mat: put; with empty hands, take one back. The rest of the loot: give it to a person. | All sacks on the mats. | The sacks, while the mats are empty. |
| The bridge | Before the first plank, a plank outline on the bank: the guess. A plank of a pile: pick up. The gap: put at the ghost; with empty hands at the edge, take the last plank back. | The gap is full. | Nghé shows the gap (the mentor). |
| The small events of the day | A thing of the pile: pick up. The place: put; with empty hands, take one back. | The person of the event checks the place (`check`). | The pile, while the place is empty. |
| The planting | A bundle of the seedbed: pick up. The edge of a plot: put; with empty hands, take one back. A stake of a plot in a choose round: choose. | The planter looks at the plots (`seedling`). | The seedbed, while the edges are empty. |
| Feeding the ducks | The jar: one press for each scoop, as many presses as the total. | The ducks eat. | The jar, before a pour. |
| The fish traps | A trap: pick up. A spot in the stream: put at the ghost; with empty hands, take the trap in front back. | The fisher uncle opens the weir (`weir`). | The pile of traps, while the stream is empty. |
| The drum dance | The bronze drum: a beat. | The dance ends. | The drum, before the dance. |

### The places of a task

- The heap and the place of a task stand close, one or two steps apart, so that the trips are short. Two targets that the child moves between (the heap and the place, two beds, the person and the place) stand at least two blocks apart, so that the target in front is never in doubt (a test in `tests/tasks.test.js`; the places are in `tools/maps/era1.py`).
- The work of each trial is in the open: from the first angle of the camera, no house or roof covers a place of a trial, and nothing at all covers the forge, the anvil, and the trough of the smith.
- The things of the trials are solid (#32): the forge and the well block their cells on the map; the trough, the anvil (with the iron on it), and each heap of a trial have a solid box (`solid.rect`), so that the hero stands next to them, never in them. The walks of the hero go around these boxes.

### The next step shows itself

- **The first step, one time.** At the start of a task, the person shows the first step on the real things and says it (the move `first` in `src/core/mentoring.js`). The teacher puts one rod on the mat, the healer puts one bunch into the basket, and the fisher puts one stake on the line; then the person says "Như thế này nhé." and takes the thing back to its heap, so that the place is empty when the child starts. The first step never leaves a part of the answer (rule 25 of `docs/DESIGN.md`). The smith shows the quench on his own piece ("Đỏ rực thì nhúng ngay!"), and the iron of the child comes on the anvil after it. A task with no heap (the woodcutter, the ducks, the drum): the person points at the place and says what to do. A task of exact rounds (the planting, the fish traps): the person only points at the heap and at the place. The person shows the first step one time in a visit; the later rounds of a practice start with no demonstration.
- **A small example first, at a station of Xóm Ruộng.** Before the first round of a visit, the person of a station does the whole work one time on a smaller instance of its own, with other numbers, and with the button picture of each act over the person; then the round of the child starts, and the example goes (`docs/HAMLET.md`, "A small example first"). The pointing of the first step comes after it, on the real things.
- **The cue.** When the child does nothing for six seconds in a task, the thing to touch next glows softly: a thin warm ring on the ground at its edge, and a small breath of the thing (the event `cue`; `glow()` in `src/render/figure3d.js`). The ring never covers the thing or the hero: the things of a heap breathe, and one rim goes around the heap; a thing at the feet of the hero has no ring (#44). Any action of the child stops it. The cue shows how to go on, never how many: it never glows on a commit that counts.
- After the cue, the mentor goes on as before (`docs/MENTOR.md`).
- **A practice is quiet (#51).** In a visit from a practice link, only the people of the practice talk: the person of the task, the person who greets at a whole place, and the people of the stations. Another person only greets the child after a tap and a press, and the button does not choose that person without a tap. No talk of the story opens, no raid starts, and no star of the story shows. The story `practice-story-quiet` checks it.

### The work in sight, and one voice at a time (#38)

- **The view turns to the work.** When a task or a small example starts, the session sends the points of the work (the event `workView`: its places, and its person when the person stands at the work; for an example, its things). The view turns in its steps of 90 degrees to the first angle where no house or roof covers these points, and where the person and the example stay on the screen, also on a phone held upright (`workTurn` in `src/world/fade.js`). When the angle now shows the work, the view stays. Each trial and each station has such an angle from each of the four angles (`tests/workview.test.js`); in Xóm Ruộng the houses of the duck girl and of the planter moved out of the stations for this. The view also counts the other tall things near the work (within ten cells, two blocks tall or more: a gate post, a wall, a tall tree, a stack, bamboo; `TALL` in `src/world/fade.js`), as they fade into large dotted shapes over the work (#42). It turns first to an angle free of all of them, else to an angle free of houses. A tall thing right at the work (within a cell and a half: the bamboo of the grove where the woodcutter works) is the place of the work and does not count. The court of nhảy lò cò and the rope of nhảy dây have an angle free of all tall things, with nothing tall on them; for this the court moved away from the east gate of Phù Đổng.
- **One person talks at a time.** A new line of a person near the hero takes away the lines of the other people over their heads, and a line in the box of a talk does too (`src/core/lines.js`). When the child starts a station while the head of the hamlet greets, the greeting ends at once, with its marks.
- **No small talk during the work.** The person of an example, a first step, a move of a mentor, the greeting of a place, or a task that goes on says only the lines of the work. While such a person is near the hero, the small talk of every person near the hero waits too (a villager who passes, another person of a station): a line of small talk never takes away a line of the work (`quietForWork` in `src/core/session.js`).
- **The picture of talk** is a speech bubble (`art/ui/talk.svg`). The loudspeaker (`speak`) only reads a line aloud.

### Tests and stories

- `tests/presses.test.js` (#54, #63): the trials of the story from the end of the talk of each mentor, with presses only, then one tap: presses alone take one kind of herb and never give the basket, presses alone put the stakes next to each other and the fish swim out, the hearth takes the ore, the smith quenches, and the staffs at the lowest ring break. A child who taps each bed and counts the presses gives the right basket, and a child who taps each point of the row at the space of the fisher keeps the fish. The laws of `playPresses` in `tests/restless.js`: no press asks for help, takes back what it just put, or puts a thing of a task on the ground. The law `blindPresses` (#63): the same presses at a different number (`each`, `space`, `parts`, `heads`, `ore`) make the same puts; a play ends sooner only when its task is done.
- `tests/button.test.js` (#68): each press with the id of the picture does that act, and at a full mat the button never shows a put that the world refuses. The plays `tools/plays/button-68-phone.json` and `button-68-night-phone.json` record the picture before each press and the act of the press in the browser; `tools/phone-play.mjs` fails when they differ.
- `tests/tasks.test.js`: for the teacher, the smith, the healer, the woodcutter, and the fisher, the act and the picture of the button at each target, one press for one thing, the take back with empty hands, and the finish at the person; a tap on a rod, the mat, the basket, the stem, or the iron only walks; Nghé on and off; the places close and apart.
- Every story of a task plays with moves and the action button only (the step `press` in `src/core/story.js`: a walk to the target, then the button); no story taps a thing of a task. A press at a place taps it through the hit test of the screen (`{ "press": { "screenOf": "mat" } }`), as a child taps.
- `tests/screen.test.js`: a tap at the middle of each place of each trial and station, on a phone held upright, from the four angles of the view, chooses that place.
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
| The loot (after a won raid) | A pile of small sacks of rice lies behind the wall (Era 1 has no coins, #26), and three mats: the basket of the hero, Nghé, and Gióng. The child carries sacks from the pile to the mats, and from a mat back. | The hands are empty, and the pile has too few sacks to even out the mats. | Equal mats, with fewer sacks in the pile than friends: all are happy, and the sacks of the hero go to the basket as bowls of rice. The rest becomes a small red cloth with the sacks in the hands of the hero; the child carries it to the village, to the elder at the đình, the smith, or the mother of Gióng, and that person says one line of thanks (nothing is scored; the cloth goes with the hero to other maps). If not, Nghé turns away and shakes her head until the share is fair. Seven sacks after the first soldiers, ten after the second, twelve after the boss. | fair sharing, level 1; fair sharing, level 2; division, level 1 (`math.share.equal`, then `math.div.10`) |

The level comes from the grade that the player gave, as for the trials.

### Notes

- The crafting screen of the iron horse is gone: its recipe, its element rules, and its texts are removed. The forge work replaces it.
- The soldier raids and the boss give no rice as a gift: their sacks are the loot. The scouts give iron (for the horse) and rice.
- Gióng stands at the side of the hero in the soldier raids too, so that he is there for the share.
- A share is judged only when the pile cannot even out the mats any more. So a child who fills one mat after the other (four, four, then two with two sacks left) is not judged before the last sacks go down.

## A finish that a child sees (#62)

At each success in a task (a tied bundle, a quench, a full basket, the row of stakes that keeps the fish, equal staffs, the rice of Gióng), the work system sends the event `success` with the place of the thing. The person of the task jumps one time, and a small burst of leaves in green, yellow, and red comes from the thing. The leaves and a warm light under them show also at night. At the end of the task, the person jumps two times and waves, and a small red seal flies from the person to the pip that the task fills on the goal bar (or to the picture of the goal bar); the pip glows when the seal lands. All this takes less than 2 seconds and has no text. The jump goes on while the done talk is open: the session moves it, not the world.
