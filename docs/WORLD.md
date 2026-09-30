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
| `act` | `sit`: the pose that a plan asks for (a hen in its coop) | schedule |
| `carry` | `lantern`: a thing in the hand at night | schedule |
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
| `keep` | `true`: the save keeps this entity | save |

Helpers: `addEntity`, `removeEntity`, `getEntity`, `query(world, ...components)`, and `command(world, cmd)`. A few hundred entities do not need an index.

## The systems and their order

A system is a function `(world, dt, rng, env)` in `src/core/world/systems/`. It names the parts of the state that it changes in `WRITES` at the top of its file, and a test checks that it changes nothing else. `env` (`env.js`) gives the facts of the map that do not change in a step: the blocked cells, the ground type, and the height of the ground.

`step(world, dt, env)` in `src/core/world/step.js` runs the systems in this order, 30 times a second:

1. **input**: the commands go into the entities before anything moves (move, walk, stop, place, face, pause, stay, pet, ride, knock, aim, pick, put, drop, guess, work).
2. **sky**: the light and the rain of this hour, and the river in the rain, so that the plans and the lanterns read them. It sends `dawn` and `dusk`. While the river is high (in the rain and until it is down, about one game hour after the rain), `sky.high` is true.
3. **ground**: the cells that open and close in play, before anything moves. The broken bridge opens its old deck, the lane where the planks lie, and all of its deck when it is solid. A high river closes the ford, but not while somebody is in it. This system writes only the collision of `env` (`env.block`), never the state.
4. **schedule**: the plan of the hour sets the goals of the people and the animals before anything moves: the spot, the well, the coop, the bank, and home (to the foot of the ladder, up, and in). The walk goes around houses and water on a path of cells. In the morning the mender (grandma) walks to each pot that the hero broke and sets a new one. 
5. **lights**: after the plans, so that a lantern lights in the step when its family goes in. A knock at a lit house makes its lantern flicker.
6. **route**: a route turns into an intent, so that movement reads one kind of input. A person in the way: the walker steps to the side of the person that is nearer to the next point, and a point of the way under a person is skipped. The end of a route sends the event `arrived`; a route that cannot go on sends `stuck`.
7. **move**: the hero walks or runs from its intent, with collision against blocked cells, cliffs, and solid people. Nothing walks while the world waits.
8. **follow**: after the hero moves, so that Nghé follows the new position without a step of lag. Nghé carries the hero who rides, steps back from a fire, is happy after a pet, and lies down beside the hero who rests at night. With a goal, Nghé walks to that point and takes a pose there (it stretches its neck toward the gap as a hint, looks at the hero beside the plank outlines, or pulls the hero out at the edge of the water). At a closed ford, Nghé stops at the edge and shakes its head.
9. **place**: after the hero and Nghé move: the hands pick up, put down, and drop, and a span (the bridge) answers where the hero stands now (see "Placement" below).
10. **work**: after the hands: the tasks of the Five Trials answer the work of the hands (a rod on the mat, a tie, the iron into the water, the basket to the healer, a chalk mark, a cut), and their timed parts go on (the glow of the iron, the tide). See `docs/TRIALS.md`.
11. **push**: after the hero moves: on the back of Nghé the hero pushes the cart out of the way.
12. **react**: after the hero moves, so that things react to where the hero is now, and before steering, so that a flight starts in the same step. Chickens flee a running hero, ducks and fish swim away, people turn, wave, and greet, the dog follows for a while, pots break and give a coin, and tall grass bends.
13. **flock**: the pull of each flock (alignment with the near neighbors, cohesion to the middle of the flock, and the range of its place) goes into `steer.bias` before the animals move.
14. **steer**: animals and people that move by themselves (seek, arrive, flee, wander, separation, avoidance).
15. **clock**: last: the time of the step passes after all that happened in it. The clock stops while the world waits.

Randomness comes only from the `rng` of the step. The same seed and the same commands give the same world.

## Placement

Placement is the core verb: the hero picks up a thing, carries it, puts it in a zone or on the ground, and picks it up again. A thing snaps to the half-block grid: its position is whole numbers, and on the ground it lies square to the grid. The rules are pure functions in `src/core/world/zones.js`; the place system (`systems/place.js`) uses them. `docs/DESIGN.md` ("Learning by doing: the rules from the evidence") gives the reasons.

A **zone** is an entity `zone:<id>` with `keep` (the save keeps it). Its kind (`task`) is in `data/world/zones.json`, and says what fits (`accepts`), how each end looks and sounds, and which skill events it sends. Two rules:

- **pile**: things lie in rows, one row for each size (the planks on the bank).
- **span**: things go end to end across a gap, from the near end. Only the last thing can come back. To put planks and to take them back is free exploration and is never an error (rule 5). The **commit** is the step of the hero on the last plank. Then the world answers:
  - exact: the planks turn into deck, a drum sounds, and coins come (event `solid`).
  - too short: the last plank dips (`tip`), and the hero falls into the water with a splash (`fall`, no damage). The planks stay on their marks, and red marks show each missing unit of the gap (the entity `why:<zone>`, look `gap-N`) for two seconds, so that the child sees how much was missing (rule 12). Nghé comes to the edge and pulls the hero out (`pulled`). Then the plank floats back to the pile (`float`).
  - A plank that is too long answers at once, because it sticks out past the far end: it wobbles, the fisher calls out (`call`), and it slides back into the water and floats back to the pile. It is not a commit. Nothing is lost, so that the two failures cost the same.
  - **Predict, then commit** (rule 4): when the hero comes near a new gap, a row of plank outlines (entities `guess:<zone>:<n>`) lies on the bank, and Nghé goes beside them and looks at the hero. A tap on the n-th outline (command `guess`) fills the outlines up to n, with no numeral. A first plank without a tap skips the prediction, and Nghé glances once at the outlines. The first commit sends `prediction` (the guess, the planks used, and the result); the village keeps it in `profile.predictions` until the learning log exists.
  - After two failures on a gap, or after a commit with the signs of mashing, Nghé stands on the bank at the near end of the planks and stretches its neck toward the gap (`hint`). Nghé never says a number and never stands on the planks.
  - The next round opens at the next dawn, when the hero is not on the bridge: a gap of 12, then 15, then 18 with only two kinds of plank. After the last round, the rain of a later day breaks one or two planks (`crack`). The rest of the bridge stays, and the repair is a new, small task with its own pile.

Each commit sends skill events (`skill`): `math.add.20` for the sum of the planks against the gap, and `math.mul.10` when all the planks are the same size and there are at least three. An event has `solved`, `efficient` (solved with the fewest planks on the first commit on the gap; rule 19), `first`, `mashing`, `evidence`, `parts`, `target`, and `level`. **Mashing** (rule 22) comes from the attempt since the last commit: the middle time from one action to the choice of the next plank (the command `aim` marks the choice at the tap), the first choice after a failure, and a sweep of sizes at one place. A commit with these signs is no evidence and never an error. The village gives the learner only the commits with evidence (`learnerRecord`): an efficient success is correct at the level of the gap, a success with a longer plan is correct at the lowest level, and a commit that is not solved is not correct at the level of the gap. With `?debug=1` in the address, a small panel shows the events.

The broken bridge in Phù Đổng is the zone `bridge-gap` (in `tools/maps/era1.py`). The terrain leaves out the deck in the zone; the world state draws the old deck (`deck` entities), the planks, and the solid deck.

## Input and the renderer

- The session of the village (`src/core/session.js`, see `docs/STORIES.md`) turns taps into commands of the world. A tap on a plank marks the choice (`aim`), walks to it, and picks it up; a tap on a plank outline is the prediction; a tap on the gap with a plank in the hands walks to the near end and puts it there; a tap on the gap with empty hands walks out on the planks; a tap on the hero puts the plank down. The Space key does the same near the hero. A tap walk is a `walk` command with a token; the session keeps what to do at the end of the walk and runs it when the event `arrived` comes back. The village scene (`src/ui/village.js`) finds the target of a tap under the finger and sends it to the session.
- The renderer (`src/render/voxel.js` and `src/render/figure3d.js`) reads the state and never changes it. It keeps one figure for each entity with `position` and `look`, and it is smooth between two steps. All parts of all figures are one `InstancedMesh`, their ink outlines one more, and their shadows one more.
- The story (triggers, exits, dialogues, battles) reads the hero cell after each step.

## The save

`profile.world` (save version 6) holds the seed, the map, the clock, and the entities with `keep` (the hero, the zones, the planks, and a broken pot), without their routes and intents (`src/core/world/save.js`). When the hero goes to another map, the kept entities of the old map wait in `profile.world.away` until the hero comes back. The people, the animals, and Nghé come again from the map data and the seed. The village puts its world into the profile before each save (`ctx.syncWorld`).

## The numbers in data

- `data/world/life.json`: the kinds of living things (chickens, ducks, fish, buffalo, the dog, birds, the owl, pots, tall grass, the cart, and the heat of the forge), with their steering, flocks, reactions, and plans; and the reaction and steering of the people.
- `data/world/people.json`: the plans of the day, and the house and plan of each person.
- `data/world/day.json`: dusk, dawn, and the rain.
- `data/world/zones.json`: the kinds of placement zones: the bridge (its rounds, the repair after the rain, piles, skill events, outcomes, hint, the signs of mashing, and the prediction) and the pile of planks.
- The maps (`tools/maps/era1.py`): `layers.life` (groups of living things), `layers.places` (named places for the plans, the pile, and the plank outlines of the prediction), and `layers.zones` (placement zones with a `task`).

