# Stories: the use paths of the game as data

`docs/DESIGN.md` ("Stories") is the source of truth. This file tells how the parts work and how to write a story.

## The session of the village

`src/core/session.js` is the story logic of the village, with no DOM and no WebGL. It owns the profile, the world state of the map of the region (one continuous land, `docs/WORLD.md`), the live chunks, the trigger zones, the people, the walks of the taps, the talks and their effects, the edges of the world, the time limit, and what the commits at the placements give to the learner and to the learning log.

| Function | What it does |
| --- | --- |
| `start(mapId, params)` | Starts on a map (or the map of the save). `params`: `at` (the hero cell on the plane), `facing`, `after` (talks after the start), `clock` (the minute of the game clock), `practice` (a visit from a practice link: `practiceStart` in `src/core/practice.js`). |
| `startPlace(mapId, params)` | The map and the hero cell of a start, before the start (the view loads the height tiles there first). |
| `command(cmd)` | A command (see below). |
| `step()` | One step of the world (1/30 second), then the events of the step, the live chunks (they wake and sleep), the edges, and the trigger zones. |
| `events()` | The events since the last call (the view takes them). |
| `listen(fn)` | Also sends each event to `fn` (the runner of a story). |
| `opening()` | The events of the last start. |
| `snapshot()` | The state as plain data. |
| `targetAt(x, y)` | The target of a tap at a map cell, as the scene finds it under a finger. |

**Commands:** the world commands `move`, `stop`, `pet`, `ride`, `aim`, `pick`, `put`, `drop`, `guess`, and `face`; `tap { target }`; `hands` (the Space key); `talkTo { id }`; `talk { dialogue }`; `travel` (the country map); `refresh`; `next` and `choose { n }` (the open talk); `wave` (the child calls the person of the task); `jump` (the key J or the jump button; `docs/WORLD.md`, "The jump"); `closed` (the view closed a screen). In a raid: `shoot { count }` (the slingshot at the wall), `pour { source, x, y }` (an element to a map point), and `pet` (Nghé charges, when Nghé is a tool of the raid). See `docs/RAIDS.md`.

**Events:** the events of the world, and `open { screen, ... }` (a talk line, a line of text, a callout over a head, the rest, or a screen of a story effect such as `worldmap`, `vanmieu`, or `nameFriend`), `close`, `map` (the hero went to another map), `gift` (things fly to their counter), `practice` (a set of a practice is done), `mentor` (a move of the mentor of a task: key, diagnosis, move, level; `docs/MENTOR.md`), `check` and `selfFix` (a check of the child, and a change after it), `plantRow` and `planted` (a row of the planting, and the end of a planting: result, empty, extra, full; `docs/PLANTING.md`), `jump { kind }`, `land`, and `splash` (a jump of the hero), `goBack` ("go back" at the end of a practice: the view opens the village at `to`, the place before the visit, or at the start of the game; the world event `back` is a rod back on the heap), `scoop`, `eat`, and `fed` (a scoop of the pour, a duck that eats, and the end of a feeding: result, hungry, extra, full; `docs/HAMLET.md`), `fill` and `caught` (a trap that fills, and the end of a catch), `dance`, `beat`, `jump`, `miss`, and `danced` (the drum dance), `eggs` (the eggs at dawn), `feast { on }` (the feast of the new rice starts or ends), `lose` (coins that an enemy took fly from the counter to it), `raid` (a raid starts or ends), `tapfx`, `sound`, `busy`, `hud`, and `halt`.

The screens are events, not calls. The world waits while a screen is open, and the view sends `closed` when the child closes it. A talk is one `open` event for each line; the view sends `next` or `choose`.

The village scene (`src/ui/village.js`) is a thin view over the session. It finds the target of a tap under the finger, sends the commands, steps the session in its frames, draws the state, and reacts to the events.

## The story files

A story is a JSON file in `tests/stories/`. The name of the file is the name of the story.

| Field | What it holds |
| --- | --- |
| `name` | The name (the name of the file). |
| `about` | `{ vi, en }`: one line in each language. |
| `profile` | `name`, `grade`, `lang`, `seed`, `flags`, `items`, `party`, `timeLimit`, `played` (minutes of play today), `skills` (P(L) of some skills at the start: `{ "math.add.20": 0.4 }`). |
| `map` | The map of the start (the map of the region of `at`, when it is not there). |
| `clock` | The game clock in minutes (day 0 starts at 0; 540 is 9:00). |
| `practice` | The id of an activity of `data/world/practice.json`: the story opens its practice link with the profile of the story. The hero starts at the place of the activity; `at` is then the place before the visit (where "go back" goes). |
| `at` | The hero cell: `[place, x, y]` (a cell in the frame of a place, as in `data/maps/<place>.json`), or `[x, y]` (a cell of the plane). With `[place, x, y]`, the cells `[x, y]` of the steps and the facts are cells of that place too; a cell of another place is `[place, x, y]`. With `[x, y]`, they are cells of the plane. Or `state`: a saved world. |
| `steps` | The steps. |

### Steps

| Step | What it does |
| --- | --- |
| `{ "do": <command> }` | Sends a command to the session. The tools of a later era are commands too: `{ "type": "fell", "id": "tree8" }` takes away an object of the map (a tree and its crown), and `{ "type": "dig", "at": [8, 29] }` takes the top block of a column (`docs/WORLD.md`, "Mining and taking apart"). `{ "type": "event", "id": "cart" }` brings a small event of the day today, at the nearest spot of its kind (`docs/WORLD.md`, "The small events of each day"). |
| `{ "wait": 2 }` | The world goes on for two seconds. |
| `{ "until": { "event": "put", "with": {...}, "timeout": 20 } }` | The world goes on until the event comes (after the last command). |
| `{ "at": { "hour": 18.5 } }` | The world goes on until the next 18:30. |
| `{ "walk": { "to": [place, x, y], "leg": 20 } }` | A walk to a far cell, as a child taps ahead again and again: the way on the tile map, and a tap each `leg` cells on it. A line of a trigger zone on the way is read. The walk fails when the hero stops before the cell. |
| `{ "tap": ... }` | A tap, as the scene sends it: `{ "cell": [x, y] }`, `{ "entity": id }`, `{ "thing": id }`, `{ "item": "rod" }` (the first thing of a kind in a heap or a pile; `"size"` and `"stray"` choose among them: a duck of another farm is a stray), `{ "plank": 4 }` (a plank of this size on a pile), `{ "guess": 3 }` (a plank outline), `{ "zone": id }` (the middle of the zone of a task, or the gap of a span), `{ "span": id }` (the last plank on a span), `{ "stem": 4 }` (a place along the stem of the woodcutter), `{ "culm": 0, "at": 5 }` (a standing culm of the bamboo clump of the staffs, at a height in half blocks), `{ "line": 8 }` (a place on the line of the fish trap), `{ "raid": "gate" }` (the gate bar, the bamboo, or a spot such as `spot:1` in a raid), `{ "post": 20 }` (a post before the first shot: the prediction), or `{ "hero": true }`. |
| `{ "shoot": { "count": 16 } }` or `{ "shoot": { "at": "first", "kind", "off", "lead", "wait" } }` | The slingshot: a pull of this count (half blocks along the road), or the count for an enemy of the raid (`first`: the nearest one to the gate; `kind`: only enemies of this kind): its distance where it will be after `lead` seconds, and `off` more. With `wait`, no enemy in reach is no failure (the world goes on for a second). |
| `{ "pour": { "from": "brazier", "at": "first" } }` | The drag of an element from a source of the raid to an enemy (or to a cell `[x, y]`). |
| `{ "repeat": 10, "steps": [...] }` | The steps, ten times. |
| `{ "read": true }` | Reads the open talk to its end (the first choice at each choice, or the choices in a list: `{ "read": [1, 0] }`). |
| `{ "reload": true }` | Saves the profile, loads it, and goes on with a new session. The loaded world must be the same. |
| `{ "restore": 1 }` | A parent goes back to the restore point 1 (the newest is 0; `docs/WORLD.md`), and the game goes on from it with a new session. |
| `{ "expect": [...] }` | Checks facts. |

### Facts

| Fact | True when |
| --- | --- |
| `{ "hero": { "in": "water", "map", "near": id, "within", "cell": [x, y], "holding", "falls", "riding", "mist" } }` | The hero is so (`mist`: in the mist of the land of a later era). |
| `{ "entity": id, "near": id, "within", "act", "look", "hidden", "keep", "gone", "in", "notIn": [...], "mist" }` | The entity is so (`gone`: it is not in the world; `in` and `notIn`: the ground under it; `mist`: in the mist). |
| `{ "event": type, "with": {...}, "not": true }` | The event came (or did not come) since the last expect. |
| `{ "flag": name, "is": false }` | The flag is set (or not). |
| `{ "item": "coin", "count": ">= 1" }` | The count of a thing. |
| `{ "learner": { "skill", "pL": ">= 0.5" } }` | P(L) of a skill. |
| `{ "clock": { "between": [18, 19] } }` | The hour of the game clock. |
| `{ "day": 2 }` | The game day (day 0 is the first). |
| `{ "practice": { "id": "bo-que", "sets": 1, "level": 2 } }` | The record of an activity of the practice links in the profile: its sets and the level of its next round. |
| `{ "points": 3, "before": 1 }` | The number of restore points, and of the points that were the current save before a restore. |
| `{ "zone": id, "state": "solid", "round", "planks", "gap" }` | A placement zone. |
| `{ "ford": "closed" }` | The fords of the map. |
| `{ "text": { "shown": key } }` | The text showed since the last expect. |
| `{ "screen": "dialogue" }` | The open screen (`null`: none). |
| `{ "count": { "entities": "chicken", "min", "max" } }` | The count of entities of a kind or a look. |
| `{ "all": { "of": "people", "plan", "home", "near": "spot", "within", "hidden" } }` | All of a group are near a place of their day. |
| `{ "raid": { "on": true, "phase": "general", "enemies": ">= 1", "losses": 0 } }` | The raid now: it goes on, its phase, the enemies that did not retreat, and the losses. |
| `{ "edits": { "chunks": 1, "felled": 1, "dug": 0 } }` | The changes of the land that the save keeps: the changed chunks, the felled things, and the digs. |

Numbers in `count`, `pL`, `planks`, `enemies`, `losses`, and `edits` can be a comparison such as `">= 3"`.

## The laws of the world

The runner checks the laws on every step of every story (`createLaws` in `src/core/story.js`):

- No `NaN`, and no entity outside the map.
- The hero and the people never stand in a blocked cell or in deep water (a river or the deep sea). A thing that falls, a thing that swims, and a person on the ladder of a house are the exceptions.
- **The rule of the world:** no text that the session shows in the village or a raid (a talk line, a choice, a line of text, a callout) has a digit, an operator (`+ − × ÷ =`), or a question mark, in Vietnamese or in English, with its values. The practice with the teacher and Văn Miếu are other screens, so the rule does not check them. The rule is about the math of the task: a fact of history (a key `history.*`, with its year) and a place name (`place.*`, `region.*`) are not checked.
- The count of the entities stays under the limit in `data/config/limits.json`, and the count of the live chunks under `liveChunks`.
- The save of the world loads back to the same world. At the end of a story, the save of the whole profile loads back to the same world.

## The storybook in the browser

- `?story=<name>` opens the game in the start state of a story. With `&play`, the story plays: a finger shows each tap, the bar at the bottom shows the step, and the game waits one second at each `expect` and shows the result. `&speed=4` plays the world faster (for the day). `&debug=1` also shows the step in the debug panel.
- Screens that are not in the village (Văn Miếu, the country map) show as a card with their name until the story closes them. A raid plays in the village.
- Nothing of a story is saved, and a story run never feeds the learning log: its logger drops every event (headless and in the browser; `?harness` in the address does the same for a scripted play).
- `docs/reference/stories.html` lists the stories with a link to each one. `tools/stories.py` makes it from the story files.

## The stories now

| Story | The use path |
| --- | --- |
| `new-profile` | A new profile to the village, the intro, a name for Nghé, and the first talk with the elder. |
| `bridge` | The prediction, then a short, a long, and an exact bridge; the flags of each commit. |
| `bridge-mashing` | Three sizes in a sweep, fast: no evidence, and Nghé shows the gap. |
| `day` | A whole day: the spots at 10:00, the well at noon, home at night, out in the morning; the chickens in the coop. |
| `rain` | The river rises, the ford closes, Nghé shakes its head, the ford opens one game hour after the rain. |
| `bridge-save` | Save in the middle of the bridge, load, and go on. |
| `vanmieu-gate` | The ferry over the Red River, Văn Miếu, and back out next to its gate. |
| `time-limit` | The time is over, but the rest waits until the hero leaves the bridge. |
| `reactions` | A chicken flees, a villager greets, a pot gives a coin. |
| `nghe` | Pet and ride Nghé; push the cart. |
| `trial-scholar` | Rods on the mat, ten tie into a bundle, nine snap the band; the reward. |
| `trial-smith` | Ore to the forge, water to the trough; the iron too early bends, while it glows it hardens. |
| `trial-fisher` | Stakes in a row; a space too wide and the fish swim out; the full row keeps them. |
| `trial-healer` | Three kinds of herbs; one too many and the basket comes back; the right number of each. |
| `trial-woodcutter` | Chalk marks off the middle break the short stick; equal sticks go to the wood pile. |
| `calling` | After the five trials, the elder opens the way to Văn Miếu. |
| `raid-scouts` | The first raid: the lines of the slingshot and the gate, a tap on the post nearest the scout, a short pull and its correction by count, and the gate bar before a torch lands (no skill event). |
| `raid-patrol` | The traps: the elder names the third post; a trap there is counting, a trap one post on is play. |
| `raid-soldiers` | The first soldiers: a villager at a straw flag, a trap at the post that the smith names, and the charge of Nghé. Then the loot: three, one, and two coins make Nghé sulk; a coin from the basket of the hero to Nghé makes it fair. |
| `raid-boss` | The forge of the smith: fire makes the soldiers raise wet shields, lightning into the wet ground shocks them; the general and his blow, the iron staff breaks, and Gióng pulls up the bamboo. The fact of history keeps its year. Then twelve coins, four on each mat, and the farewell of Gióng. |
| `raid-lost` | The map only pauses the raid, with one line; nobody stops the soldiers; at grade 1 they take nothing, and they come again at the next dawn. |
| `raid-river` | Rice balls from the same pull: two little river serpents eat two each and swim away calm; the talks of Sóng. |
| `restore-point` | A point at each dawn, only the last three; a parent goes back to yesterday morning (before the talk with the elder), and then back to where the game was. |
| `forge-horse` | The iron horse: five lumps and the fire dies, seven and one rolls back, six and the fire burns high; the child waits by the anvil for the sound of the glow, and the glowing iron in the water becomes the horse. |
| `rice-giong` | Rice for Gióng: two trays of five make a ten, and Gióng grows; three trays of three and one more make twelve: he grows again, two bowls stay in the pot. |
| `staffs-bamboo` | Bamboo staffs: slashes at three, six, and eight break the short piece, and a new stem comes; slashes at three, six, and nine make four equal staffs. |
| `fell-dig` | A tree is felled and a block is dug; after a save and a load, the tree stays felled. |
| `event-cart` | A cart stuck on the road: three stones are too few, five roll one back, four lift the cart. |
| `event-flood` | A flooded field: five pails of water to the ditch. |
| `event-market` | Market day: two strings of ten and three single coins pay the price; the coins leave the purse only then. |
| `event-duck` | Lost ducks: one is not enough; with the second, the flock is whole. |
| `walk-trau-son` | From the gate of Phù Đổng on the east road, through the generated land, to the fields of Núi Trâu, with no change of scene. |
| `walk-vanmieu` | From Phù Đổng over the ford and the west road, through the generated land, over the Red River on the ferry (the story waits for `ferried`), to Văn Miếu. |
| `climb-nui-trau` | From the yard at the foot of Núi Trâu up the path to the top of the hill (a real hill from the fine heights), past the rock faces. |
| `walk-soc-son` | From the đình of Phù Đổng on the north road to the top of the hill of Sóc Sơn, with no change of scene; Nghé comes along. The live chunks stay under the limit on the whole walk. |
| `sea-edge` | At the coast in the east: the hero wades to the knee, then stops, turns, and takes two steps back: "Biển sâu quá". Nghé stays on the sand. The line shows once in a day. |
| `mist-edge` | At the south end of the land of the era: the hero walks into the mist and slows; Nghé stops and lows; the hero turns back two steps: "Phía nam còn mù sương". |
| `save-chunks` | Fell a tree, walk four chunks away and back, save and load: the tree is still gone, and nothing else changed. |
| `ferry` | At the landing on the Red River: the boat takes the hero and Nghé across with no cut (the event `ferried`), both step onto the other bank, and the boat takes the hero back. |
| `market-crier` | On the market day of the hamlet to the east, grandma in Phù Đổng says that there is a market; the hero walks east to the yard of the hamlet, and the seller waits there. |
| `practice-bo-que` | The practice link of the bundles: the teacher at once, with no prologue; two rounds (the second one a level higher, with more rods); the teacher says thank you, the reward, and "go back" takes the hero to the place before the visit. |
| `practice-ren-sat` | The practice link of the forge at night: the night goes by, and the visit starts at seven in the morning; two rounds; go back. |
| `practice-cam-coc` | The practice link of the fish trap: two rounds; go back. |
| `practice-hai-thuoc` | The practice link of the herbs: two rounds; the child stays, and a new round starts there. |
| `practice-chat-tre` | The practice link of the bamboo: two rounds of equal sticks; go back. |
| `mentor-bridge` | A missing plank: the fisher counts the planks aloud and marks the empty part; the next try is right, and the help level goes down to only watching. |
| `mentor-cart` | All the nets of stones in the mud, as if each net is one stone; the carter shows it on another cart, counting on, stone by stone; then the cart rolls on. |
| `mentor-bored` | Three bundles in a row, fast and right; the teacher says that next time there is a bigger task, and the heap of this time stays the same. |
| `mentor-share` | Three misses in a row at the cart; the carter shares the task and puts about half of what is missing. |
| `jump-puddles` | On a day of rain at the ford of Phù Đổng: a jump on the path, then from stone to stone across the ford; when the river rises, the ford closes, and a jump at its edge is only a hop. |
| `jump-bridge-gap` | A grade twelve hero jumps at a repair of the bridge with a run: the jump ends in the water, Nghé pulls the hero out at the near end, and the planks are still the way across. |
| `walk-xom-ruong` | From the north gate of Phù Đổng on the small road to Xóm Ruộng; Nghé comes along. In the yard, each person of a station is at the station: the planter on the dike, the duck girl at the pond, the fisher uncle at the stream, and the old drummer in the đình yard. |
| `practice-xom-ruong` | The practice link of the hamlet: An starts in the yard, walks to the planter, and she starts a set of the planting. |
| `practice-cay-lua` | The practice link of the planting: one set of six plots. One plot gets too few seedlings (the empty cells stay, and An brings the rest), one gets too many (the extra lies on the dike), and the others are just right; the last one is a choose plot. The planter says thank you, and An goes back. |
| `practice-cho-vit-an` | The practice link of the ducks: one set of four troughs. One gets too little feed (the last ducks look at An, and the next pour goes on from where it stopped), one gets too much (the chickens come), and the others are just right. The duck girl says thank you, and An goes back. |
| `practice-dat-lo` | The practice link of the fish traps: one set of four catches. One has too few traps (the full traps stay, and An puts one more), one has too many (the extra fish swim on), and the others are just right. The fisher uncle says thank you, and An goes back. |
| `practice-mua-trong` | The practice link of the drum dance: one set of three dances. In one An taps one beat early: the dancers stop with a laugh, and the drummer starts again from the last good jump, slower. The other two dances have no missed beat. The drummer says thank you, and An goes back. |
| `xom-ruong-feast` | The feast of the new rice: An feeds the ducks on the first morning, and that dusk there is no feast (no eggs yet). At the next dawn the eggs come; An puts traps, plants a plot, and taps the drum; at dusk the table has eggs, fish, and new rice, the feast begins with the dance, and after it the table is empty. |
| `plant-grow` | One plot planted; the next morning it is green; after a save and a load it is still there; two days later the rice is tall. |
| `pot-far` | The hero breaks a pot and walks far away; in the night the pot is new, also while its chunk sleeps; the next morning the hero sees the new pot. |
