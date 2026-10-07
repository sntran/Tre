# The world state and the systems

The world of a map is plain data in `src/core/world/`. Small systems change it in fixed steps. The renderer only reads it. This file tells how the parts work together. `docs/DESIGN.md` stays the source of truth for the game.

## The state

`createWorldState()` in `src/core/world/state.js` makes one object for one map:

| Field | What it holds |
| --- | --- |
| `seed` | The seed of the world (from the seed of the profile). Generated things come from it. |
| `rng` | The state of the seeded random numbers (`src/core/rng.js`) between two steps. |
| `map` | The id of the map. |
| `clock` | `{ minutes }`: game minutes from the start (see `clock.js`). |
| `sky` | `{ night, rain, flood, high }`: the light of the hour (0 by day, 1 at night), the rain, the river (1: one block up), and `high` (the ford is closed). |
| `wind` | `{ x, z, strength }`: the direction that the wind blows to, and its strength (0 to 1). Until the weather of #12, a soft breeze with a slow swell. The hair, the cloth, and the tails of the figures move with it (`src/world/sway.js`). |
| `paused` | True while a dialogue or a panel is open. |
| `tick` | The number of steps. |
| `entities` | The list of entities. |
| `commands` | The input for the next step. |
| `events` | What happened in the last step. |

An **entity** is a plain object with an `id` and optional components. Components hold only data: numbers, texts, booleans, lists, and plain objects. No functions, no three.js objects, no DOM.

Positions are on the half-block grid: x to the east, z to the south (map y), y up. One map cell is 2 half blocks.

| Component | Data | Used by |
| --- | --- | --- |
| `position` | `{ x, y, z, facing }` | all systems, the renderer |
| `motion` | `{ vx, vz, speed, shallow }` | move, follow, steer, the renderer (walk cycle) |
| `control` | `true`: the player moves it | the hero |
| `intent` | `{ dx, dz, strength, run }`: the direction to walk now | input, route, move |
| `route` | `{ points, near, token, still, last }`: a walk to a tapped place | input, route |
| `follow` | `{ target, trail, idle, goal, shake }`: `goal` sends Nghé to a point (a hint, or to pull the hero out) | follow |
| `person` | `{ kind, ref }`: a person or an enemy of the map data | the story (the session of the village) |
| `solid` | `{ r }`: others keep this distance | move |
| `react` | `{ kind, radius, ... }`: what it does when the hero comes near: flee, greet, follow, break, or bend (numbers in `data/world/life.json`) | react |
| `broken` | `{ day }`: a pot that the hero broke; it is whole again the next day | react |
| `steer` | `{ speed, accel, medium, goal, flee, bias, wander, weights, ... }`: animals and people that move by themselves (numbers in `data/world/life.json`) | steer |
| `kind` | the kind of a living thing in `data/world/life.json` | populate |
| `flock` | `{ id, align, cohere, radius }` | flock |
| `range` | `{ x, z, r }`: the place of a flock (a yard, a pond) | flock |
| `look` | the key of the figure in `data/figures.json` (or `hero`) | the renderer |
| `schedule` | `{ plan, home, spot, bed, stay, way, ... }`: the day of a person or an animal (plans in `data/world/people.json` and `data/world/life.json`) | schedule |
| `hidden` | `true`: in a house, or gone (the owl by day) | schedule |
| `act` | `sit`: the pose that a plan asks for (a hen in its coop); in a raid: `walk`, `sit`, `torch`, `sword`, `stunned`, and Nghé `charge` and `horns` | schedule, raid |
| `carry` | `lantern`: a thing in the hand at night; in a raid: the `torch` of a scout, the `shield` of a soldier | schedule, raid |
| `lantern` | `{ home, always }`: the lantern at the door of a house | lights |
| `riding` | the id of the friend under the hero | input, move, follow, push |
| `pushable` | `{ r }`: the hero on the back of Nghé can push it (the cart) | push |
| `hot` | `{ r }`: Nghé steps back within this distance (the fire of the forge) | follow |
| `hands` | `{ holds, want }`: the thing in the hands, and a wish (pick, put, drop) for the place system | input, place |
| `item` | `{ kind, size, task, zone, held, set }`: a thing that the hero can carry (a plank of `size` half blocks). `task`: the zone that owns it; `zone`: where it lies now; `set`: part of a solid span | place |
| `zone` | a placement zone: `{ id, task, rule, accepts, items, ... }` (see below) | place, ground, schedule |
| `tilt` | radians: a plank that tips or wobbles turns about its near end | place, the renderer |
| `fall` | `{ t, x, z, out, ... }`: the hero falls into the water and Nghé pulls the hero out | place, move |
| `deck` | `{ zone }`: a part of the old deck of the broken bridge | place |
| `guess` | `{ zone, n, left }`: the n-th plank outline of the prediction | place |
| `why` | `{ zone }`: the marks of the empty part of a gap after a fall | place |
| `raid` | the raid now (plain data from `src/core/world/raids.js`): its enemies, stones, torches, fires, wet ground, traps, spots, and phase. On the entity `raid`, which the save does not keep | raid |
| `orders` | the orders of the child in a raid (shoot, bar, call, charge, pour, bamboo) for the raid system | input, raid |
| `raider` | `{ kind, hits, max, shield, torch }`: an enemy of a raid, for the view | raid |
| `source` | `{ id, kind }`: a source of an element in a raid (water, fire, lightning) | raid, the view |
| `raidTap` | `{ what, id }`: a thing of a raid that takes a tap (the gate bar, a spot, the bamboo) | raid, the session |
| `raidThing` | `true`: a thing of a raid; it goes away at the end of the raid | raid |
| `keep` | `true`: the save keeps this entity | save |

Helpers: `addEntity`, `removeEntity`, `getEntity`, `query(world, ...components)`, and `command(world, cmd)`. A few hundred entities do not need an index.

## The systems and their order

A system is a function `(world, dt, rng, env)` in `src/core/world/systems/`. It names the parts of the state that it changes in `WRITES` at the top of its file, and a test checks that it changes nothing else. `env` (`env.js`) gives the facts of the map that do not change in a step: the blocked cells, the ground type, and the height of the ground.

`step(world, dt, env)` in `src/core/world/step.js` runs the systems in this order, 30 times a second:

1. **input**: the commands go into the entities before anything moves (move, walk, stop, place, face, pause, stay, pet, ride, knock, aim, pick, put, drop, guess, work, raid, poke).
2. **sky**: the wind, the light and the rain of this hour, and the river in the rain, so that the plans and the lanterns read them. It sends `dawn` and `dusk`. While the river is high (in the rain and until it is down, about one game hour after the rain), `sky.high` is true.
3. **ground**: the cells that open and close in play, before anything moves. The broken bridge opens its old deck, the lane where the planks lie, and all of its deck when it is solid. A high river closes the ford, but not while somebody is in it. This system writes only the collision of `env` (`env.block`), never the state.
4. **schedule**: the plan of the hour sets the goals of the people and the animals before anything moves: the spot, the well, the coop, the bank, and home (to the foot of the ladder, up, and in). The walk goes around houses and water on a path of cells. In the morning the mender (grandma) walks to each pot that the hero broke and sets a new one. 
5. **lights**: after the plans, so that a lantern lights in the step when its family goes in. A knock at a lit house makes its lantern flicker.
6. **route**: a route turns into an intent, so that movement reads one kind of input. A person in the way: the walker steps to the side of the person that is nearer to the next point, and a point of the way under a person is skipped. The end of a route sends the event `arrived`; a route that cannot go on sends `stuck`.
7. **move**: the hero walks or runs from its intent, with collision against blocked cells, cliffs, and solid people. Nothing walks while the world waits.
8. **follow**: after the hero moves, so that Nghé follows the new position without a step of lag. Nghé carries the hero who rides, steps back from a fire, is happy after a pet, and lies down beside the hero who rests at night. With a goal, Nghé walks to that point and takes a pose there (it stretches its neck toward the gap as a hint, looks at the hero beside the plank outlines, or pulls the hero out at the edge of the water). At a closed ford, Nghé stops at the edge and shakes its head.
9. **ferry**: after the hero and Nghé move: a ferry comes to the landing where the hero calls it, the riders step onto its deck with a small hop, it crosses, and they step off on the other bank, Nghé behind the hero. While a rider is on the deck (`aboard`), the boat carries it and the laws of the stories do not check its ground. It sends `ferried`.
10. **place**: after the hero and Nghé move: the hands pick up, put down, and drop, and a span (the bridge) answers where the hero stands now (see "Placement" below).
11. **work**: after the hands: the tasks of the Five Trials answer the work of the hands (a rod on the mat, a tie, the iron into the water, the basket to the healer, a chalk mark, a cut), and their timed parts go on (the glow of the iron, the tide). See `docs/TRIALS.md`.
12. **raid**: after the hands and Nghé: the orders of the child go to the raid (a shot, the gate bar, a villager to a spot, the charge of Nghé, an element, the bamboo), the enemies answer the traps on the road and the hero where the hero stands now, and the raid puts its enemies, stones, torches, fires, and wet ground into the world. The raid waits while the world waits. See `docs/RAIDS.md`.
13. **push**: after the hero moves: on the back of Nghé the hero pushes the cart out of the way.
14. **react**: after the hero moves, so that things react to where the hero is now, and before steering, so that a flight starts in the same step. Chickens flee a running hero, ducks and fish swim away, people turn, wave, and greet, the dog follows for a while, the ducklings follow a hero who walks (not one who runs), a frog jumps off its lily pad, a puddle splashes, pots break and spill a few grains (they give nothing; the chickens near the pot come to peck), and tall grass bends.
15. **joys**: after the plans and Nghé: the small joys show or hide by their days and hours, the lion dances, the fisher holds up a fish over his plan, and Nghé turns its head over its walk (see "The world at rest" below).
16. **flock**: the pull of each flock (alignment with the near neighbors, cohesion to the middle of the flock, and the range of its place) goes into `steer.bias` before the animals move.
17. **steer**: animals and people that move by themselves (seek, arrive, flee, wander, separation, avoidance).
18. **clock**: last: the time of the step passes after all that happened in it. The clock stops while the world waits.

Randomness comes only from the `rng` of the step. The same seed and the same commands give the same world.

The **mentor** system (after the work) plays the moves of the mentors of the tasks: a person points, marks lie on the ground for a few seconds, the things of a demonstration on another instance come one at a time, and a person puts some parts into the place for the child (`docs/MENTOR.md`).

## Placement

Placement is the core verb: the hero picks up a thing, carries it, puts it in a zone or on the ground, and picks it up again. A thing snaps to the half-block grid: its position is whole numbers, and on the ground it lies square to the grid. The rules are pure functions in `src/core/world/zones.js`; the place system (`systems/place.js`) uses them. `docs/DESIGN.md` ("Learning by doing: the rules from the evidence") gives the reasons.

A **zone** is an entity `zone:<id>` with `keep` (the save keeps it). Its kind (`task`) is in `data/world/zones.json`, and says what fits (`accepts`), how each end looks and sounds, and which skill events it sends. Two rules:

- **pile**: things lie in rows, one row for each size (the planks on the bank).
- **span**: things go end to end across a gap, from the near end. Only the last thing can come back. To put planks and to take them back is free exploration and is never an error (rule 5). The **commit** is the step of the hero on the last plank. Then the world answers:
  - exact: the planks turn into deck, a drum sounds, and fish come (event `solid`).
  - too short: the last plank dips (`tip`), and the hero falls into the water with a splash (`fall`, no damage). The planks stay on their marks, and red marks show each missing unit of the gap (the entity `why:<zone>`, look `gap-N`) for two seconds, so that the child sees how much was missing (rule 12). Nghé comes to the edge and pulls the hero out (`pulled`). Then the plank floats back to the pile (`float`).
  - A plank that is too long answers at once, because it sticks out past the far end: it wobbles, the fisher calls out (`call`), and it slides back into the water and floats back to the pile. It is not a commit. Nothing is lost, so that the two failures cost the same.
  - **Predict, then commit** (rule 4): when the hero comes near a new gap, a row of plank outlines (entities `guess:<zone>:<n>`) lies on the bank, and Nghé goes beside them and looks at the hero. The hero walks along the row; the outline in front of the hero is the target, and the action button chooses it (command `guess`): the outlines up to n fill, with no numeral. A tap on an outline only walks there. A first plank without a guess skips the prediction, and Nghé glances once at the outlines. The first commit sends `prediction` (the guess, the planks used, and the result); the village keeps it in `profile.predictions` until the learning log exists.
  - After two failures on a gap, or after a commit with the signs of mashing, Nghé stands on the bank at the near end of the planks and stretches its neck toward the gap (`hint`). Nghé never says a number and never stands on the planks.
  - The next round opens at the next dawn, when the hero is not on the bridge: a gap of 12, then 15, then 18 with only two kinds of plank. After the last round, the rain of a later day breaks one or two planks (`crack`). The rest of the bridge stays, and the repair is a new, small task with its own pile.

Each commit sends skill events (`skill`): `math.add.20` for the sum of the planks against the gap, and `math.mul.10` when all the planks are the same size and there are at least three. An event has `solved`, `efficient` (solved with the fewest planks on the first commit on the gap; rule 19), `first`, `mashing`, `evidence`, `parts`, `target`, and `level`. **Mashing** (rule 22) comes from the attempt since the last commit: the middle time from one action to the choice of the next plank (the command `aim` marks the choice at the tap), the first choice after a failure, and a sweep of sizes at one place. A commit with these signs is no evidence and never an error. The village gives the learner only the commits with evidence (`learnerRecord`): an efficient success is correct at the level of the gap, a success with a longer plan is correct at the lowest level, and a commit that is not solved is not correct at the level of the gap. With `?debug=1` in the address, a small panel shows the events.

The broken bridge in Phù Đổng is the zone `bridge-gap` (in `tools/maps/era1.py`). The terrain leaves out the deck in the zone; the world state draws the old deck (`deck` entities), the planks, and the solid deck.

## Input and the renderer

- The session of the village (`src/core/session.js`, see `docs/STORIES.md`) turns taps and the action button into commands of the world (`docs/TASKS.md`). A tap on a plank marks the choice (`aim`) and walks to it; a tap on the gap walks to the near end (with empty hands, out on the planks). The action button (or Space) picks up the plank, puts it at the gap (a ghost of the plank shows where it goes), and with empty hands at the edge takes the last plank back. A tap on a plank outline walks there; the action button chooses it (the prediction). A tap walk is a `walk` command with a token; the session keeps what to do at the end of the walk and runs it when the event `arrived` comes back. The village scene (`src/ui/village.js`) finds the target of a tap under the finger and sends it to the session.
- The renderer (`src/render/voxel.js` and `src/render/figure3d.js`) reads the state and never changes it. It keeps one figure for each entity with `position` and `look`, and it is smooth between two steps. All parts of all figures are one `InstancedMesh`, their ink outlines one more, and their shadows one more.
- The story (triggers, exits, dialogues, battles) reads the hero cell after each step.

## The jump

The hero jumps with the round button at the bottom right of the village or with the key J (the help of the keys is in the menu). The rules are pure functions in `src/core/world/jump.js`; the numbers are in `data/hero.json` (`jump`).

- **The length** is the jump of a real child of the age of the player: the typical age of the grade (`ages`: Pre-K 4, K 5, grade one six and a half, and so on), then the median standing long jump and the median height at that age (`table`: the mean of boys and girls, so that a girl and a boy of a grade jump the same). The jump in blocks is (jump ÷ height) × the height of the hero (`hero`, 2.34 blocks). With a run, the jump is longer (`run`). Each hero jumps with the grade of its own player.
- **The height** follows from the length: the top of the arc is at a quarter of the length (`arc`, a throw at 45 degrees). The hero clears a thing lower than the top (a log, a ditch, the rim of a puddle). The time in the air grows with the length (`time`).
- **What a jump does not do:** it does not climb or go down a cliff (two steps or more), and it does not cross a wall, a house, a hedge, a thing that is not low (`low` names the props a jump goes over), or deep water (also a ford that the high river closed). It never crosses a gap that a task asks the child to fill or to measure: a jump into the open part of the gap of the bridge ends in the water, the same fall as a short plank (the hero comes out at the near end, and nothing is lost); a jump into the zone of a trial is a hop. Any other jump that cannot land well is a small hop in place (`hop`).
- **The look:** a short crouch, the arc, and a puff of dust at the landing (a splash in shallow water, and the hero walks on). The hair and the cloth sway. Nghé does not jump: it walks around.
- **The world:** logs lie by the roads (`log` in `data/world/scatter.json`), puddles come after rain, and the fords have stepping stones (rock one step high; at the ford of Phù Đổng, a row across the stream).
- **No command in a talk, a screen, a raid, or a task in progress** (a thing in the hands): then the command `jump` does nothing.
- **The log:** a jump is play. It is not evidence of a skill, and it goes to neither the learner nor the learning log.

Events: `jump { kind }` (`jump`, `hop`, or `fall`), `land { at }`, `splash`, and `tip { jump: true }` at a fall into the gap.

## The world at rest

The world moves when the child does nothing, and it hides small joys for the child who looks. Nothing here teaches, counts, or gives: no reward, no count, no notebook entry, and no text. The child finds them or does not.

- **Ambient motion** is in the renderer only, with no state (`src/render/voxel.js`, `src/render/ambient3d.js`; the look is in `docs/ART.md`). The pure rules are in `src/core/world/ambient.js`: the gusts (a gust crosses the paddies, then the hedge, then the trees), the meal times (smoke from the kitchens, steam from the rice pot), the year of the game (40 days; Tết on two of them), the rare days, the shooting star, and the windy days (a kite). All of them come from the seed and the clock, so the same seed gives the same days.
- **Small joys with state** are entities of the life layer (`data/world/life.json`, placed by `tools/maps/era1.py`):
  - The buffalo of another family sleeps in the shade at noon and snores (the plan of the buffalo). A tap on a sleeping animal (target `sleeper`, command `poke`) makes it flick an ear (`flick`), and it sleeps on.
  - The ducklings by the paddies follow a hero who walks past (react `follow` with `when: walk`), and then go back.
  - A frog on a lily pad by the sand jumps into the river when the hero comes near (`hop`, `dive`) and comes back after a while.
  - Now and then the net of the fisher comes up with a fish, and he holds it up (`haul`; `joys.catch`).
  - After the rain: puddles on the roads that splash (`splash`) while the ground is wet. (The footprints in the wet ground and the rainbow are gone: the owner took them for bugs, #32. A rainbow comes back only as a soft painted arc in the print style, after the owner sees a picture of it.)
  - The earth roads keep flat puddles in their ruts from the start of a rain until a game day after its end (`puddlesAt` in `ambient.js`; the shader of the ground draws them).
  - At night: a shooting star on about one night in five.
  - Rare things from the seed, each on about one day in twenty: a kingfisher on a stake by the ford, a golden bamboo shoot in the low hedge, and a firefly on the horn of Nghé (in the renderer).
  - Tết, two days of each year: the pot of bánh chưng steams in the yard of the đình, red couplets at the doors, peach blossoms on the trees, and at noon a lion dance with a drum (`beat`). The history review decides what stays (`docs/REVIEW.md`).
- An entity with `when` (`rare`, `tet`, `wet`, `hours`) is there only on those days and hours; out of them the joys system hides it.
- **Nghé notices** a joy near it at most once a day (`notice`): it turns its head to the joy for two seconds, so that the child learns to look where Nghé looks. The day of the last notice is `world.noticed` (not in the save: after a load, Nghé may notice once more that day).
- The stories `noon-buffalo`, `frog-pad`, and `tet-dinh` play some of them.

## Mining and taking apart

The data under every tier of the look is blocks and entities, so that a later era can mine, dig, fell, and take things apart (`docs/ART.md`, section 11). This issue makes the data and the renderer ready; the mining and the building themselves come later.

- **A smooth mesh is a look, not a thing.** A tree is a trunk of half blocks and a crown look; the crown mesh is built from the seed and the size of the tree (`src/world/smooth.js`). Each smooth look and each roof has an owner block (a trunk, a stem, the base of a culm, the pole of a haystack, a block of the house under a roof), and it draws only while that block is there. No smooth mesh exists without a block that owns it.
- **The ground is minable.** The ground keeps the kind of each full block (`data/world/blocks.json`): the surface (the color of its ground type), soil under it, then clay, rock at the bottom, and ore in some of the clay and the rock (a seeded rule). Each kind has a hardness and what a dig of one block drops.
- **Chunks.** The world draws in chunks of 16 × 16 columns (`src/world/chunks.js`): for each chunk one mesh of the ground and the things, and one ink mesh. A dig (`dig`) takes one block and builds only its chunk again (and the chunk next to it, when the column is at its edge); one chunk builds in a few milliseconds. To fell a tree (`fell`) takes the blocks of its trunk; its crown goes with them, and it drops logs.
- **Buildings come apart.** A house is the blocks of its parts on the half-block grid, with its roof as a look that its blocks own. To take a house apart takes its blocks, and the roof goes when the block under it goes. Building is the same in the other order, on the placement system of the bridge.
- **Nothing is baked.** No mesh is made by hand: every mesh comes from a generator with a seed, so that the same tree grows again from the save.
- **The frame.** `frameTriangles` in `data/config/limits.json` is the most triangles of the world in the three by three chunks around the start of each place; a test checks it at every place. `ringTriangles` is the most triangles of the whole drawn ring ("Chunks and rings", below).
- The stories and the debug tools can change the terrain now: the commands `{ "type": "fell", "id": <object> }` and `{ "type": "dig", "at": [x, z] }` send the events `felled` and `dug` with what they drop, and the view builds the chunks again (the story `fell-dig`). A felled thing opens its cells. The save keeps the changes of each chunk (`profile.maps[<map>].chunks`, "The save", below): the land comes from the seed, and the terrain does the changes again when it makes the page of a changed chunk.

## One continuous world

The world of a region is one continuous land. The hero walks from Phù Đổng to Sóc Sơn, to Núi Trâu, and to Văn Miếu with no transition, no exit, and no load in between.

### The scale

- **One plane for the whole country** (`src/core/gen/plane.js`): Mercator (a conformal projection, so the shapes of the hills and the rivers stay), true scale at 16° N, and **45 m of real land for each cell**. The cell 0, 0 is at 102° E, 23.5° N; x goes to the east and y to the south. North of 16° N, one cell is a little less than 45 m of real land (about 43.7 m at 21° N), so a real distance there takes a few more cells; south of 16° N, one cell is a little more (`metersAt`).
- A cell is one block of the voxel world (`docs/ART.md`), and the hero walks 4.6 cells in a second (`src/core/world/move.js`). The walks of Era 1 (straight lines, in cells): Phù Đổng to Văn Miếu about 290, to the highest top of the low hills of Trâu Sơn about 690 (#27; on the road to the fields at their foot, about 540), and to the top of Sóc Sơn about 660 (on the road, about 900). So a walk between two story places takes one to four minutes.
- **The places are frames on the plane** (`frames` in `data/world/land-giong.json`): each place is at its real place (the đình of Phù Đổng, the top of núi Vệ Linh, the highest top of the low hills of Trâu Sơn, the gate of Văn Miếu). The cells of a place (`data/maps/<place>.json`) are cells of its frame; `world.at(place, x, y)` gives the cell on the plane. A story, a raid, a quest, a trigger, and a person name their place and their cell in it, and the game puts them on the plane.

### The land, tile by tile

The story places are hand-made stamps; the land around them comes from rules, the real geography, and the seed of the world (`docs/DESIGN.md`, "Procedural generation"). The code is in `src/core/gen/` (pure, no DOM).

- **Tiles.** The land is made in tiles of 64 × 64 cells (`src/core/gen/tiles.js`). A tile is made from a window with 56 cells more on each side, and each fact of a cell reads only the land within 16 cells of it. So the same seed and the same tile give the same land, whatever tile was made before (a test makes one tile alone and the same tile in a ring of tiles). The roads and the rivers are lines of the whole region; they are made one time for each seed, from the data only. The land keeps the last 256 tiles.
- **Stamps.** The map files keep only the story places as stamps: hand-made ground and heights (`tools/maps/era1.py`). A height is one digit of base 36 in the height rows (0 to 9, then a to z). A stamp under a frame with `lift` rises as one piece to the height of the real land there: the stamp of Sóc Sơn stands on its hill. Next to a stamp, the land is at most one step from the stamp for each cell of distance, so the hero can walk off a stamp.
- **The hills are real.** The height of each cell comes from the fine height tiles (`src/core/gen/heights.js`; `data/geo/heights/<tile>.bin`, made by `tools/geo/build.mjs` from SRTM): a value every 0.005 degree (about 550 m), where each value is 0.6 × the highest + 0.4 × the mean of its square, so that a small hill keeps its top. A height tile has both of its edges, so a point needs only its own tile. A concave curve turns meters into steps (`relief`: k × the square root of the meters over `low`; k = 0.8 and low = 16 m): the delta stays flat, a hill of 100 m is about 8 steps, and a mountain of 1,300 m about 29. The game loads the four height tiles of the story places at the start, and the others when the hero comes near them; the land of a tile waits for its height tiles.
- **Rivers.** All the rivers of `data/geo/vietnam.json` that cross the land of Era 1 go onto the plane (`rivers` in `data/world/land-giong.json`: the Hồng, the Đuống, the Thái Bình, the Bạch Đằng, the Mã, the Cả, and the Mekong beyond the border, in the mist). Each river has a width in cells from its size (`water`: 26 for the Hồng, 10 to 14 for the others), bends a little by the seed, and meets the rivers of the stamps (`pins`). A branch begins on its main river (the Đuống begins on the Hồng, the Thái Bình on the Đuống). The arms of the delta come when the data has them.
- **Rock faces.** Where the land is steeper than one step for each cell, the higher cell is a rock face (ground `r`, the tile type `rock`). The hero cannot climb a slope of more than one step (`canStep`); at the top of a cliff the hero walks along the edge.
- **Roads.** Each road joins two points of the stamps by the cheapest way over the land (A*): near a line that winds by the seed, and a climb steeper than `road.steep` costs much more, so that on a hill the road turns back and forth. A road is never more than one step from one cell to the next. The route of cells goes in steps of eight directions, so the middle line of a road is smoothed: each point is the mean of the points near it (`SMOOTH`), never more than half a cell from its cell. A road cell is within the half width of this line, and it takes the height of the nearest cell of the route. A cell beside a road also keeps the direction of the line, its distance from it, and the half width of the road (`roadHalf`), for the strip of the road (`strip` in `src/world/terrain.js`; `docs/ART.md`, section 18). On the low land, a road runs on a low bank, one step over the paddies, with a shoulder of grass two cells wide on each side (`ROAD_BANK`, `SHOULDER`). On dry land, a road lies a little lower than the grass: the strip of the road shows a shadow line along its edges (`docs/ART.md`, section 18).
- **Crossings.** Where a road crosses a river, the width of the river chooses the crossing (`CROSSING` in `src/core/gen/tiles.js`): a river of at most 6 cells has a ford (ground `shallow`: the hero wades, slower); a river of at most 14 cells has a bamboo bridge (ground `bamboo`, at the height of the road, with a wood footstep); a wider river has a ferry (`land.ferries`): a boat that waits at a landing of one bank. When the hero comes to the landing, the boat comes, the hero and Nghé step on, and it crosses with no cut (the system `ferry`, the story `ferry`). A ferryman (a person from parts, `ferryman` in `data/figures.json`) stands at the stern and pushes his pole in time with the boat while it moves (the act `pole`). The ferry of the Red River on the road to Thăng Long is the same boat, with its own lines (`map.ferry`, `map.ferry.back`).
- **Paddies, scatter, and hamlets.** Rice paddies lie in blocks of five cells with a dike around each block, on the low, wet land, and as terraces near a hamlet. The scatter (`data/world/scatter.json`: bamboo, groves, the forest of the hills, banana plants and areca palms by the roads, haystacks, boats, tall grass, ducks, buffalo, birds) has a seeded priority for each cell and no grid. A hamlet (`hamlets.js`) is two or three houses on stilts around a yard (a boat roof or a round roof), with a hedge, a haystack, a coop, sometimes a pond, and a villager for each house (`people.js`). A hamlet has no name, no talk, and no trigger: it is never presented as a historical place. The low land is not a table: mounds (gò) of one step with a clump of bamboo or a tree stand among the paddies (`MOUND`; at least 6 cells from a road and a stamp), and short ditches (mương, the ground `ditch`) of still water run along one side of some blocks of paddies. Both come from the seed, tile by tile. Tufts of grass grow along the edges of roads and fields, and reeds at the water (`tuft` in the smooth looks of a page; a tuft belongs to its ground block).
- **The seed.** The save keeps only the seed and what the player changed. The world keeps the land of the last seeds (two in the game).

### Chunks and rings

- The world is in **chunks of 16 × 16 cells** (`src/world/chunks.js`, `src/world/terrain.js`). The terrain makes the page of a chunk (its blocks, its things, its water, and its paddies) when the page is first asked for, and drops a page that nobody holds.
- **Live chunks:** the 5 × 5 chunks around the hero (`LIVE` in `src/core/session.js`). The entities move and the systems run only there. `liveChunks` in `data/config/limits.json` is the most live chunks; the laws of the stories check it on every step (the story `walk-soc-son` walks from Phù Đổng to Sóc Sơn under it).
- **Drawn chunks:** the 9 × 9 chunks around the hero (`RINGS` in `src/render/voxel.js`): the 5 × 5 near ones at the full level, the others at the coarse level (one quad for each flat run of the ground, one blob for each crown, no ink, no flowers).
- **A chunk that wakes keeps the rules of the clock.** A thing of a chunk that slept is as the time made it: a pot that the hero broke is new after the next dawn (the mender set it, or, on a land with no mender, it is simply new), and the people stand where their day puts them at that hour. Each frame builds chunks for at most 6 ms, the nearest first. A chunk waits until the land of its tiles is made, so that no frame makes land.
- **Blocks.** The renderer draws the chunks in blocks of 2 × 2 chunks for each level (`BLOCK` in `src/render/voxel.js`): the ground, the things, and the ink of the four chunks are one mesh each, so a frame has few draw calls. A far block bakes its flat water and its paddies into its ground mesh. The water planes stay for each chunk (their masks change with the river). A block is made again when one of its chunks changes (a dig, a fell, a chunk that comes or goes).
- **Budgets** (`data/config/limits.json`): `frameTriangles` (60,000) is the most triangles of the 3 × 3 chunks around the start of every place. `viewTriangles` (240,000) and `viewCalls` (72) are the most triangles and draw calls of a frame, counted as the `?fps` line counts them: all the meshes of the blocks in the view (the ink included), at the far zoom on the screen that sees the most (`src/world/view.js`), plus `viewExtra` for the figures and the sky. A test checks them every 8 chunks on the walk from Phù Đổng to Sóc Sơn and at the densest places: the hill forest at the south edge, Tam Đảo, and Ba Vì (`tests/chunks.test.js`).
- **Generation in a worker.** The tiles of the land around the hero, and ahead of the walk, are made in a Web Worker (`src/ui/gen-worker.js`, through `src/ui/stream.js`), after their height tiles load. The generator is pure, so a tile from the worker is the same tile as a tile made at once. Without workers, one tile is made in each frame. The made tiles are kept on the device (IndexedDB, `src/world/tilestore.js`), and a tile in the store is read, not made (`docs/LOADING.md`).

### Entities belong to chunks

- An entity of the land (a villager, a flock, a lantern, a buffalo) has a home chunk (`chunk`). It comes when its chunk wakes (comes into the live chunks) and goes when its chunk sleeps, unless it has `keep`. The hero and Nghé never sleep.
- A person who comes with a chunk after the start stands where its plan of the day puts it at that hour (`placeBySchedule`).
- The story triggers, the raids, the trials, the quests, and the small events of each day are places on the plane. An event comes from the area of the hero: the nearest spot of its kind.

### The edges of the world

The camera never shows the end of the world. Where the hero cannot go, the world says so in its own way:

- **The sea.** The sea is deeper in steps: three cells of surf (to the knee; the hero wades, and the legs go under the water line), then the deep sea. The surf is lighter than the deep sea, and a line of foam lies on the sand at the edge of the water and moves up and back in held steps. At the deep sea the hero stops, turns, and takes two steps back, and says "Biển sâu quá". Nghé does not go into the surf. (Story `sea-edge`.)
- **Mountains.** A slope of more than one step for each cell cannot be climbed (above).
- **The mist.** Beyond the land of the era, the land goes to mist. In Era 1 the south edge follows the crest of the Hoành Sơn range near 18° N (`eraLand` in `data/world/regions.json`): for each column the crest is the highest land within 0.35 degree of the line, with a median over the columns near it so that it does not jump to another ridge, and the land of the era ends 6 cells before the crest. The land of another country is mist too, and near a border the mist follows the ridge tops (within 12 cells of the border). The mist comes in three stages over 12 cells (`mist.fade`), in the color of the dó paper of the panels: first the colors go pale, then only the ink lines stay, then the paper with its grain. A thing in the mist is never a solid shape. In the mist the hero walks slower. Nghé stops at the edge of the mist and lows. At 4 cells into the mist (`mist.walk`) the hero turns back two steps and says "Phía nam còn mù sương" (or, at another country, "Phía trước còn mù sương"). (Story `mist-edge`.)
- **Things of the story** (a gate that is not open yet, a river with no bridge) stay as they were.
- **The turn-back:** stop, turn, two steps back (1.5 cells, `BACK`), and the line only once for each edge in a game day. A tap walk past an edge stops at the edge, with no line.

### Tests

`tests/gen.test.js` (noise, the plane, the tiles: one tile alone is the same as the same tile in a ring; stamps, rivers, rock faces, roads, the crossings of the roads, paddies, the sea, the south edge on Hoành Sơn, and the mist at the borders), `tests/relief.test.js` (the height tiles, the height curve, Núi Trâu and Sóc Sơn over Phù Đổng), `tests/regions.test.js` (the frames, the walks from Phù Đổng to Núi Trâu, Văn Miếu, and Sóc Sơn for many seeds, the real directions), `tests/chunks.test.js` (one page alone is the same as the same page in a ring; the frame and the ring budgets), `tests/terrain.test.js` (a page made before its land was ready is made again), and the stories `walk-soc-son`, `walk-trau-son`, `walk-vanmieu`, `climb-nui-trau`, `sea-edge`, `mist-edge`, `ferry`, `pot-far`, and `save-chunks`. The tests keep the land of a seed one time for all tests of a file (`tests/helpers.js`), and the stories run in three files at the same time.

## The small events of each day

Each day, the seed of the world and the day choose some small events on each map (`data/world/events.json`, `src/core/world/days.js`): a cart stuck on the road, a flood on a field, a market day, and lost ducks. An event happens at a spot of its kind: a road on the low land, a paddy, a paddy near water, or the yard of a hamlet (`layers.spots`: the spots of the stamps, and the spots of the land tiles from `src/core/gen/tiles.js`). The events come from the area of the hero: for each kind, the nearest spot in the live chunks, so an event is within about one minute of walk. An event does not come at the same spot two days in a row (`visit.things["event.<id>.spot"]` holds the day and the spot).

- **Market days are fixed:** each hamlet (each yard) gets its day in five from the seed, so that a child can learn when its market comes (as the old markets on the days that end in 1 and 6). The market stays at the yard of its hamlet on its day. On a market day, a person in Phù Đổng says where it is ("There is a market today in the hamlet to the east", `world.market.*`), one time in a day (story `market-crier`).
- **A flood has a cause:** it comes only on the day of a rain (after the rain ends: the sky sends `dry`) or on the next day, and only on a paddy near water (at most 12 cells from the river or a pond).
- **Lost ducks:** the farmer says the size of her flock and how her ducks look (white with a green head). The pen holds the ducks at home; some lost ducks are near, and the others are farther, out of view from the pen. Two or three brown ducks of another farm stay near their own yard. A brown duck in the pen is never right: the farmer says why, and it goes back to its yard.

- A person stands at the spot (the carter, the farmer, or the seller; `data/figures.json`). The action button at the person starts the work (a tap only walks there), with one line that says the number as a word ("The hole takes seven stones").
- The work is the task `exact` of the work system: things of sizes lie on a pile (stones in a net of one, two, or five; pails on a pole; bowls of rice from the basket of the hero; a lost duck alone), and the child carries them to the place (the mud under the wheel, the ditch, the mat of the seller, the pen). Each thing shows its units, so its size is seen and never written.
- The action button at the person is the commit of the sum (the person checks the place; one skill event for the learner); the wave asks for help (`docs/TASKS.md`). Exact: done, and the reward flies to the counter. Too few: the person says so and waits. Too many: the last things go back to the pile (a thing of another owner goes back to its own place).
- The level of the work: the level of the grade, one step up when P(L) of the skill of the event is over 0.8, one step down when it is under 0.3 (`up` and `down` in the data). The levels go from counting to sums of two sizes to groups (the rates of a barter at the market).
- A market day is barter (see "Barter" below). The bowls of rice come from the basket of the hero, and leave it only when the trade is done. A child with too little rice hears one line and comes back another day.
- An event that the child did today does not come again today (`profile.maps[<map>].things["event.<id>"]` holds the day). At the next dawn, the events of the day before go, with their things.
- The stories `event-cart`, `event-flood`, `market-barter`, and `event-duck` play them; the command `{ "type": "event", "id": <id> }` brings an event today.

### Finding Trâu Sơn

The sources put Trâu Sơn in the low hills near the village of Châu Cầu (Quế Võ): the *Đại Nam nhất thống chí* says "east of the district of Quế Dương, 12 dặm; hills one after another, in a long line" (#27; question 105). Nobody knows which hill top it was. The game says so, and the child finds the hills by real clues (`data/world/clues.json`, `src/core/clues.js`):

- **The place:** the frame `trau-son` is at the highest top of the line of low hills (106.230 E, 21.140 N, 71 m). The fields of the battle are at their foot, to the west. Núi Dạm (Đại Lãm, 130 m), one tall hill that stands alone to the west, is land with no name in Era 1 (its name and its pagoda come with the Lý). No battle and no story place is on it.
- **The arrow of the quest** shows only the way toward the sunrise (east of the hero) until the hero first stands at the foot of the low hills or on them (the area of the find: the frame from x 60, the flag `trauson.found`). Then it shows the soldiers again.
- **Two clues on the way:** when the quest leads to Trâu Sơn, a person who greets the hero on the way east (east of the east gate of Phù Đổng) says the first clue ("Trâu Sơn is toward the sunrise from here."), and another person says the second ("It is not one tall hill. It is low hills, one after another, in a long line."). Each clue comes once, from another person; the flag `clue.trau-son.<n>` keeps who said it.
- **The tall hill:** an old man who gathers wood on the top of Núi Dạm (`dam-elder`) says: "This hill is tall and stands alone. The hills of Trâu go on, one after another, farther toward the sunrise." No fail, no lost goods, and no score: the world answers.
- **Sources:** each line has a `source` field (the clues in `data/world/clues.json`, the talk of the old man in `data/dialogue/giong.json`): the two clues from the *Đại Nam nhất thống chí*, and the line of the old man from the fine heights (the real shapes of the two hills).
- **The note of the battle** (the mark Legend, at the end of the battle): "The old story puts this battle at the foot of Trâu Sơn. Today, people put Trâu Sơn in the low hills near the village of Châu Cầu, in Quế Võ. Nobody knows which hill it was." No general note says that the game may not be accurate. The book of the clue is from the 19th century: it does not come into Era 1; only the narrator says the doubt.
- **The save:** version 10 moves a hero or a kept thing in the old frame (cell 9563, 6027 of the plane) to the same place of the new frame (9871, 6040).
- **Later (not now):** the clue "12 dặm east of Quế Dương" can be a task of measurement for the upper grades in chapter 13 (the scholars); the length of one dặm (444.44 m or 576 m) and the seat of Quế Dương need sources first.
- Tests: `tests/clues.test.js` and the story `find-trau-son`.

### Barter

Era 1 trades by barter, with no coins (#26; question 91). The first coins of Vietnam were the Thái Bình Hưng Bảo of the Đinh dynasty (968 to 981), and even then the common people traded mostly by barter for two more centuries ([Vietnamese cash](https://en.wikipedia.org/wiki/Vietnamese_cash)).

- **The goods** (`data/items.json`, `src/core/items.js`): rice (a bowl of rice, bát gạo: the measure that every kitchen uses, #42), rice balls, fish, eggs, and clay pots. Each item has the first year of its time (`from`); the coin is an item of the Đinh (968) and of `data/world/origins.json`, so that no item, counter, or line of text of Era 1 names it (`tests/items.test.js`, `tests/origins.test.js`).
- **The basket of the household:** the first counter of the HUD is a basket with the count of the bowls of rice. A tap opens the basket with all the goods and their counts. Goods that fly to the HUD fly to the basket.
- **Who gives what:** the trials give three goods of their work (rice, fish, or eggs; `data/trials.json`), the bridge gives fish, the cart and the flood give rice, and a lost duck gives an egg. A won raid leaves small sacks of rice to share; the sacks of the hero go to the basket as bowls of rice. An enemy at the gate takes a bowl of rice from the store. A broken pot gives nothing: a few grains spill, and the chickens near it come to peck (`spill` in `src/core/world/systems/react.js`).
- **The market day** (`barter` in `data/world/events.json`, `barterTask` in `src/core/world/days.js`): the seller has goods (fish, eggs, or clay pots) on a tray, in rows of five, and wants bowls of rice for them at the rate of the level and of the good. She trades all her goods, and says the rate and her goods as words ("Three eggs for four bowls of rice. I have nine eggs."). A dearer good takes more rice for each one: a pot more than a fish, a fish more than an egg (#42). A trade is never more than twenty bowls (`most`), and the seller who comes sells a good that the rice of the basket can pay for:

| Level | Rate | Skill of the commit |
| --- | --- | --- |
| 0 | eggs only, one egg for one bowl (three to six eggs): count | `math.count.120` |
| 1 | one good for a few bowls: an egg for two, a fish for three, a pot for four (three to seven goods): adding | `math.add.20` |
| 2 | groups: four bowls for three eggs, three for two fish, five for two pots (two to four lots) | `math.mul.10` |

  **The stall** (#42): the seller sits behind the mat of the rice, and her tray lies in front of her, beside the mat, toward the child, so that the child sees all her goods. The mat goes to the nearest cell to the spot where the mat, her seat, and her tray are free (`marketStall` in `src/core/session.js`). The stall is chosen when the seller comes, on open ground that the child can walk to (each cell of the stall has open cells all around), so that she never sits in a narrow gap between two houses; the rice of the basket lies a few steps from the mat. No place of the work and no person of an event lies where another person stands (`peopleCells`): each person of a market day has a cell of their own (`tests/market.test.js`).
  The child carries bowls of rice from the basket (a pile by the mat) to the mat, and the action button at the seller is the commit (the exact task: too few, the seller waits; too many, the last bowls go back). The rice leaves the basket only when the trade is done, and the goods go to the basket. With too little rice for the fewest lots, the seller says so, and the child comes back another day.
- **The save:** version 9 turns the coins of an old save into bowls of rice, one for one (the bowl of #42 is the same unit; only the word changed), and a market that was not done goes (`MIGRATIONS[8]` in `src/core/save.js`).

## Practice links

A parent sends a link `?practice=<id>` (the tab "Practice links" of the parent page has a copy button and a share button for each activity), and the child plays one activity of the world at once, with the own profile of the child (`data/world/practice.json`, `src/core/practice.js`).

- **The link** holds only the id of the activity: never a name, a profile, or any data of a child. Only the parameter `practice` is read. An unknown id opens the title screen with a short line.
- **The profile:** on a device with profiles, the title screen says which activity it is and asks who plays; a tap on a card goes to the activity. On a device with no profile, the hero creation is short (name, look, grade; the grade sets the first level), and the activity comes next. A practice never starts the prologue, and it does not set `intro.seen`: the intro still comes when the child plays the story later (#37).
- **A practice of a whole place** (`xom-ruong`: no `person`, a `greeter` and `stations` in `data/world/practice.json`): the greeter (the head of the hamlet) turns to the child, says in one line that each person here has work, and points at the stations one after the other, with a mark on the ground at each one. A star of a task stands over the person of each station. When the child waits, the person of the nearest station glows (the cue of `docs/TASKS.md`).
- **The visit:** the hero and Nghé stand at the place of the activity, and the person of the activity is ready: the person says the talk of the task (the same talk as in the story, with the numbers of the level), and the things of the task lie at their places. At night (or at dusk, when the people go home: out of `hours`), the night goes by and the visit starts at the first hour of the next morning. The person of the activity stays at the task while the visit goes on. The world runs as always, and the time limit of the parent holds.
- **A set:** the activity is a task of the world (now the five trials of `data/trials.json`). A round is one task, from new things to the end. The trial starts again for each round, with new things (`clearTrial` in `src/core/world/systems/work.js` takes away the things of the last round). The level of the next round comes from the commits of the last one: one level up with no fail, one level down with more fails than half of the commits (`nextLevel`). At the end of a set (`set` rounds), the person thanks the child, the reward of the trial flies to the counter, and the child chooses: stay and play on (a new set starts there), or go back.
- **Go back** takes the hero to the place before the visit, with a short fade (or to the start of the game, when the profile had no place). The position of the profile in the world does not change by a practice until the child stays: while the visit goes on, the save keeps the place before the visit.
- **What is saved:** the learner (P(L) and the ratings of each commit), the learning log (the session has the practice id: `practice` in `data/config/learnlog.json`), the reward, the changes of the world, and `profile.practice[<id>]`: the level of the next round and the count of sets. The next visit goes on from that level. The flag of the trial of the story does not change: a practice is not the story. (The notebook of prints is not in the game yet; it will save with the profile too.)
- **Stories:** each activity has a story `tests/stories/practice-<id>.json` (`"practice": "<id>"`) that opens the link with a profile and plays a set (`?story=practice-<id>&play`). `tests/practice.test.js` tests the link, the data, the night, the levels, a device with no profile, the save after "go back", and the links of the parent page.

## The names of people

A person of a village is called by a word of kinship to the child and a word after it, never by a nickname from the work (#38). The word after it follows the way of naming of the region of the map and the age of the person (#41): `naming` of each region in `data/world/regions.json`, and the ways in `data/world/naming.json`.

- **north** (the north, and all regions before the 18th century): an old person (`elder`) is called by the name of the first child ("ông Dương"; the own names of old people are not said); a grown-up (`grown`) by the order of birth, with Cả for the first child and Hai for the second ("cô Năm"); a child or a young person (`young`) by the own small name ("chị Hến"; village children have a plain small name, tên tục).
- **south** (the center and the south from the 18th century on: Tây Sơn, Gia Định): the order of birth for every age, with Hai for the first child ("ông Hai", "cô Sáu").
- **A missing field:** a person whose rule needs a field that the person does not have (an elder with no `child`, a young person with no `name`) gets the order.
- **The same name:** when two people of one place would have the same name, the rule `same` of the way names them: the south adds the name of the first child after the order ("chị Hai Tùng"), and the north uses the name of the first child (`namesOf` in `src/core/naming.js`).
- **The sources** are popular writings, not studies (the sources are in `data/world/naming.json`). Nobody wrote down how villagers spoke in the time of the Hùng Kings; all eras speak today's Vietnamese (#39), so the rule follows the customs written down for the last centuries.
- **Data, not text:** a person in `data/npcs.json` has `kin` (cô, chú, bác, ông, bà, anh, chị, cậu, dì: the keys `kin.<id>`), `order` (1, 2, ..., or `youngest`), `age` (`elder`, `grown`, or `young`), `child` (the name of the first child), and `name` (the own small name). `personName` in `src/core/naming.js` makes the name as a text parameter (`{ key: 'kin.co', params: { word: 'Năm' } }`), and the session gives the names of the region of the map to the lines that name people (`{who}`, and the four names of `hamlet.greet`). The dialogue box shows the name with a capital letter.
- **English** uses the same Vietnamese names, with a capital word of kinship ("Ông Dương"), and the lines that name a person also say the work ("Ông Dương, the old drummer"). The first time that the child talks with a person (the first line of that person in the box of a talk), a short line under the text tells the meaning of the name of the person ("Ông Dương: an old man is called by the name of his first child, Dương."; "Cô Năm: the fifth child of her family."). A line shows at most one gloss of a name: the names inside a line, and the bubbles (the greeting of the hamlet, the lines during the work), show none (#42). Each name shows its gloss one time (`seenGloss`, as the words of a region; `talkGloss` and `nameGlosses` in `src/core/naming.js`). Vietnamese has no glosses of names.
- **Xóm Ruộng** (north): Cô Năm (the planter), Chị Hến (the duck girl), Chú Tư (the fisher uncle), Ông Dương (the old drummer). In a region of the south the same people are Cô Sáu, Chị Tư, Chú Năm, and Ông Hai. The head of the hamlet is Bà trưởng xóm. The people of Phù Đổng keep their names of work and kinship ("Bác thợ rèn", "Bà lang"): a title of the work is a real way of naming too.
- `tests/naming.test.js`: every region has a way; the same person (ông, the first child) is Ông Cả in the north and Ông Hai in the south; the four people of Xóm Ruộng in the north and in the south; the order for a missing field; no two people of one place with the same name; the gloss of a name one time, in English only; the greeting of the hamlet with no gloss, the gloss of Cô Năm in the first talk with the planter, and none in the second talk; no text names a person Cấy, Vịt, Lưới, or Trống; the greeting of the hamlet in the game.

## The words of a region, and the things of a time

People speak the words of their region; the narrator, the screens, and the math speak for the whole country (#39).

- **Ways of speaking** (`data/world/speech.json`, `speech` of each region in `data/world/regions.json`): north speaks the words of the whole country (từ ngữ toàn dân), with no change; it is the way of the north and of every region before the 18th century. center (Tây Sơn) and south (Gia Định) have a table from a word of the whole country to the word of the region: center "đâu" → "mô", "gì" → "chi", "sao" → "răng", "thế" → "rứa", "kia" → "tê", "này" → "ni", "mẹ" → "mạ", "cô" → "o"; south "mẹ" → "má", "bố" → "ba", "hoa" → "bông", "lợn" → "heo", "quả" → "trái", "tôi" → "tui", "ngô" → "bắp".
- **Marks in the lines of people:** a line of a person marks a word that can change (`{w:đâu}` in `i18n/vi.json`), and the text module puts the word of the way of the region of the map (`setSpeech`; `src/core/speech.js`). Only the lines of people have marks (the keys of `people` in `data/world/speech.json`, and the dialogue lines of a person). The narrator, the screens, the menus, the parent page, the lines of the hero, and the words of the math (the numbers in a task, shapes, units) have none: the child learns one word for one idea. English has no marks. Nobody knows how people spoke in the time of the Hùng Kings, so all eras speak today's Vietnamese; the era changes the customs and the things, not the grammar.
- **The gloss:** the first time that a child meets a word of a region, a small line shows under the line of the person ("“mô” = “đâu”"), in the box of a talk and in a bubble. The profile keeps the words that the child saw (`seenGloss`), so that each gloss shows one time.
- **Things of a time** (`data/world/origins.json`, `src/core/origins.js`): a thing that came at a known time has the first year in Vietnam and its sources (maize: 1597, by the legend of Phùng Khắc Khoan; Lê Quý Đôn says 1662 to 1723). Each region has the year of its time (`year` in `data/world/regions.json`; the legend chapters have 258 BC), and its map has only the things of that time (`map.things`). A house of Era 1 has sheaves of rice or gourds under the eaves, never corn (`EXTRA_NEEDS` in `src/world/props/houses.js`). The crops of the Americas that we did not check yet (chili, sweet potato, cassava, pineapple, papaya, peanut, tobacco, pumpkin) have no year, so they do not appear until a year with a source comes.
- Tests: `tests/speech.test.js` (the ways of each region, "đâu" in the north and "mô" in the center, the marks only in lines of people and each in a table, the gloss one time) and `tests/origins.test.js` (the years and sources, no corn on the houses of Era 1, no word of a later thing in the texts).

## Xóm Ruộng and the planting

Xóm Ruộng is a quiet hand-made hamlet north of Phù Đổng (the map `xom-ruong`, a frame of the region with its own small road from the north gate). Its first activity is the planting of a paddy: the child brings just enough seedlings for a plot with row stakes and column stakes, and the planter plants them row by row. The planted plots stay as paddies that grow on the next days. See `docs/PLANTING.md`.

- A frame can be **quiet** (`quiet` in `data/world/land-giong.json`): no hamlet of the land comes within so many cells of its stamps.
- The map script can set one cell (not a tile) with its ground and height (`cells` in `tools/maps/maplib.py`): the stepping stones of the ford of Phù Đổng, and the field of the plots of Xóm Ruộng (the ground of a ditch: still water with no seedlings).
- The system `plant` (before `work`) takes the commands of the planting and plants row by row; the event `planted` ends a planting.
- The other activities of the hamlet (the ducks, the fish traps, the drum dance) and the feast of the new rice: see `docs/HAMLET.md`. The system `hamlet` (before `work`) takes their commands and plays their timed parts; the events `fed`, `caught`, and `danced` end a commit. The zone rule `spots` holds one thing at each spot (a trap at a stake in the stream).

## The save

`profile.world` (save version 8) holds the seed, the map, the clock, the hero, and a thing that travels with the hero (`src/core/world/save.js`). The rest of the world is saved by chunk: `profile.maps[<map>].chunks[<chunk>]` holds, for each chunk that the player changed, its changed cells and its kept entities (the zones, the planks, a broken pot), without their routes and intents:

- `dug`: a list of run lengths for each depth (the columns dug at least once, twice, ...), and `felled`: the run lengths of the felled things (a bitset of the 16 × 16 cells of the chunk, the first run is the cells that are not set);
- `entities`: the kept entities whose home is the chunk.

A chunk that the player did not change is not in the save: its land comes again from the seed, and its people, animals, and things come again from the map data and the seed when it wakes. The story `save-chunks` fells a tree, walks four chunks away and back, then saves and loads: the tree is still gone, and nothing else changed. The migration from version 7 puts the hero of an old save on the plane (at the same place of its old map) and drops the old fell and dig changes of the old maps. The village puts its world into the profile before each save (`ctx.syncWorld`).

### What a save holds

A profile is one record in the store of the device (IndexedDB, `src/ui/storage.js`): `{ id, name, text, updatedAt, points }`. `text` is the current save, in the versioned save format of `src/core/save.js`: the hero, the grade, the calling, the titles and the stele, the flags, the quests, the things in the bag, the friends and their names, the settings, the time of play, the learning (the skill levels, the reviews, the exams, the learning log), and the world (above). Nothing leaves the device; the export code is the only way in or out.

### The restore points

`points` is a list of the saves at the last dawns of the game, the newest first (`src/core/restore.js`). The save version stays: a point is the same text as a save.

- At each dawn of the game clock, the session saves (`save('dawn')`), and that save is also a restore point `{ text, day, map, at }` (day: the game day; map: the map of the hero; at: the real time). The profile cards and the parent area show the name of the era of the region of the map (`eraKey` in `data/world/regions.json`).
- A second save on the same game day takes the place of the first. After three, the oldest goes out (`KEEP`).
- A restore (the parent area, behind the parent gate) makes the chosen point the current save. The current save is not lost: it becomes a point in the place of the chosen one, marked `before` (it is not a dawn), so that the parent can go back to it.
- A delete of the profile deletes its record, and so its points too.
- The storybook keeps the record in the page, and the headless story runner in memory, so that the story `restore-point` plays the same rules.

## The numbers in data

- `data/world/life.json`: the kinds of living things (chickens, ducks, fish, buffalo, the dog, birds, the owl, pots, tall grass, the cart, and the heat of the forge), with their steering, flocks, reactions, and plans; and the reaction and steering of the people.
- `data/world/people.json`: the plans of the day, and the house and plan of each person.
- `data/world/day.json`: dusk, dawn, and the rain.
- `data/world/zones.json`: the kinds of placement zones: the bridge (its rounds, the repair after the rain, piles, skill events, outcomes, hint, the signs of mashing, and the prediction) and the pile of planks.
- The maps (`tools/maps/era1.py`): `layers.life` (groups of living things), `layers.places` (named places for the plans, the pile, and the plank outlines of the prediction), and `layers.zones` (placement zones with a `task`).

