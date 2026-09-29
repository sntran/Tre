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
| `sky` | `{ night, rain, flood }`: the light of the hour (0 by day, 1 at night), the rain, and the river (1: one block up). |
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
| `follow` | `{ target, trail, idle }` | follow |
| `person` | `{ kind, ref }`: a person or an enemy of the map data | the story (village scene) |
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
| `keep` | `true`: the save keeps this entity | save |

Helpers: `addEntity`, `removeEntity`, `getEntity`, `query(world, ...components)`, and `command(world, cmd)`. A few hundred entities do not need an index.

## The systems and their order

A system is a function `(world, dt, rng, env)` in `src/core/world/systems/`. It names the parts of the state that it changes in `WRITES` at the top of its file, and a test checks that it changes nothing else. `env` (`env.js`) gives the facts of the map that do not change in a step: the blocked cells, the ground type, and the height of the ground.

`step(world, dt, env)` in `src/core/world/step.js` runs the systems in this order, 30 times a second:

1. **input**: the commands go into the entities before anything moves (move, walk, stop, place, face, pause, stay).
2. **sky**: the light and the rain of this hour, and the river in the rain, so that the plans and the lanterns read them. It sends `dawn` and `dusk`.
3. **schedule**: the plan of the hour sets the goals of the people and the animals before anything moves: the spot, the well, the coop, the bank, and home (to the foot of the ladder, up, and in). The walk goes around houses and water on a path of cells.
4. **lights**: after the plans, so that a lantern lights in the step when its family goes in.
5. **route**: a route turns into an intent, so that movement reads one kind of input. The end of a route sends the event `arrived`; a route that cannot go on sends `stuck`.
6. **move**: the hero walks or runs from its intent, with collision against blocked cells, cliffs, and solid people. Nothing walks while the world waits.
7. **follow**: after the hero moves, so that Nghé follows the new position without a step of lag.
8. **react**: after the hero moves, so that things react to where the hero is now, and before steering, so that a flight starts in the same step. Chickens flee a running hero, ducks and fish swim away, people turn, wave, and greet, the dog follows for a while, pots break and give a coin, and tall grass bends.
9. **flock**: the pull of each flock (alignment with the near neighbors, cohesion to the middle of the flock, and the range of its place) goes into `steer.bias` before the animals move.
10. **steer**: animals and people that move by themselves (seek, arrive, flee, wander, separation, avoidance).
11. **clock**: last: the time of the step passes after all that happened in it. The clock stops while the world waits.

Randomness comes only from the `rng` of the step. The same seed and the same commands give the same world.

## Input and the renderer

- The village scene (`src/ui/village.js`) turns the stick, the keys, a held finger, and taps into commands. A tap walk is a `walk` command with a token; the scene keeps what to do at the end of the walk and runs it when the event `arrived` comes back.
- The renderer (`src/render/voxel.js` and `src/render/figure3d.js`) reads the state and never changes it. It keeps one figure for each entity with `position` and `look`, and it is smooth between two steps. All parts of all figures are one `InstancedMesh`, their ink outlines one more, and their shadows one more.
- The story (triggers, exits, dialogues, battles) reads the hero cell after each step.

## The save

`profile.world` (save version 6) holds the seed, the map, the clock, and the entities with `keep` (now only the hero), without their routes and intents (`src/core/world/save.js`). The people, the animals, and Nghé come again from the map data and the seed. The village puts its world into the profile before each save (`ctx.syncWorld`).
