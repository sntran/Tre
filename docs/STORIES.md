# Stories: the use paths of the game as data

`docs/DESIGN.md` ("Stories") is the source of truth. This file tells how the parts work and how to write a story.

## The session of the village

`src/core/session.js` is the story logic of the village, with no DOM and no WebGL. It owns the profile, the world state of the current map, the trigger zones, the people, the walks of the taps, the talks and their effects, the exits between maps, the time limit, and what the commits at the placements give to the learner and to the learning log.

| Function | What it does |
| --- | --- |
| `start(mapId, params)` | Starts on a map (or the map of the save). `params`: `at` (the hero cell), `facing`, `after` (talks after the start). |
| `command(cmd)` | A command (see below). |
| `step()` | One step of the world (1/30 second), then the events of the step, the exits, and the trigger zones. |
| `events()` | The events since the last call (the view takes them). |
| `listen(fn)` | Also sends each event to `fn` (the runner of a story). |
| `opening()` | The events of the last start. |
| `snapshot()` | The state as plain data. |
| `targetAt(x, y)` | The target of a tap at a map cell, as the scene finds it under a finger. |

**Commands:** the world commands `move`, `stop`, `pet`, `ride`, `aim`, `pick`, `put`, `drop`, `guess`, and `face`; `tap { target }`; `hands` (the Space key); `talkTo { id }`; `talk { dialogue }`; `travel` (the country map); `refresh`; `next` and `choose { n }` (the open talk); `closed` (the view closed a screen).

**Events:** the events of the world, and `open { screen, ... }` (a talk line, a line of text, a callout over a head, the rest, or a screen of a story effect such as `worldmap`, `confirmBattle`, `vanmieu`, or `nameFriend`), `close`, `map` (the hero went to another map), `gift` (things fly to their counter), `tapfx`, `sound`, `busy`, `hud`, and `halt`.

The screens are events, not calls. The world waits while a screen is open, and the view sends `closed` when the child closes it. A talk is one `open` event for each line; the view sends `next` or `choose`.

The village scene (`src/ui/village.js`) is a thin view over the session. It finds the target of a tap under the finger, sends the commands, steps the session in its frames, draws the state, and reacts to the events.

## The story files

A story is a JSON file in `tests/stories/`. The name of the file is the name of the story.

| Field | What it holds |
| --- | --- |
| `name` | The name (the name of the file). |
| `about` | `{ vi, en }`: one line in each language. |
| `profile` | `name`, `grade`, `lang`, `seed`, `flags`, `items`, `party`, `timeLimit`, `played` (minutes of play today). |
| `map` | The map of the start. |
| `clock` | The game clock in minutes (day 0 starts at 0; 540 is 9:00). |
| `place` | `[x, y]`: the hero cell. Or `state`: a saved world. |
| `steps` | The steps. |

### Steps

| Step | What it does |
| --- | --- |
| `{ "do": <command> }` | Sends a command to the session. |
| `{ "wait": 2 }` | The world goes on for two seconds. |
| `{ "until": { "event": "put", "with": {...}, "timeout": 20 } }` | The world goes on until the event comes (after the last command). |
| `{ "at": { "hour": 18.5 } }` | The world goes on until the next 18:30. |
| `{ "tap": ... }` | A tap, as the scene sends it: `{ "cell": [x, y] }`, `{ "entity": id }`, `{ "plank": 4 }` (a plank of this size on a pile), `{ "guess": 3 }` (a plank outline), `{ "zone": id }` (the gap of a span), `{ "span": id }` (the last plank on a span), or `{ "hero": true }`. |
| `{ "read": true }` | Reads the open talk to its end (the first choice at each choice, or the choices in a list: `{ "read": [1, 0] }`). |
| `{ "reload": true }` | Saves the profile, loads it, and goes on with a new session. The loaded world must be the same. |
| `{ "expect": [...] }` | Checks facts. |

### Facts

| Fact | True when |
| --- | --- |
| `{ "hero": { "in": "water", "map", "near": id, "within", "cell": [x, y], "holding", "falls", "riding" } }` | The hero is so. |
| `{ "entity": id, "near": id, "within", "act", "look", "hidden", "keep" }` | The entity is so. |
| `{ "event": type, "with": {...}, "not": true }` | The event came (or did not come) since the last expect. |
| `{ "flag": name, "is": false }` | The flag is set (or not). |
| `{ "item": "coin", "count": ">= 1" }` | The count of a thing. |
| `{ "learner": { "skill", "pL": ">= 0.5" } }` | P(L) of a skill. |
| `{ "clock": { "between": [18, 19] } }` | The hour of the game clock. |
| `{ "zone": id, "state": "solid", "round", "planks", "gap" }` | A placement zone. |
| `{ "ford": "closed" }` | The fords of the map. |
| `{ "text": { "shown": key } }` | The text showed since the last expect. |
| `{ "screen": "dialogue" }` | The open screen (`null`: none). |
| `{ "count": { "entities": "chicken", "min", "max" } }` | The count of entities of a kind or a look. |
| `{ "all": { "of": "people", "plan", "home", "near": "spot", "within", "hidden" } }` | All of a group are near a place of their day. |

Numbers in `count`, `pL`, and `planks` can be a comparison such as `">= 3"`.

## The laws of the world

The runner checks the laws on every step of every story (`createLaws` in `src/core/story.js`):

- No `NaN`, and no entity outside the map.
- The hero and the people never stand in a blocked cell or in deep water. A thing that falls, a thing that swims, and a person on the ladder of a house are the exceptions.
- **The rule of the world:** no text that the session shows in the village or a raid (a talk line, a choice, a line of text, a callout) has a digit, an operator (`+ − × ÷ =`), or a question mark, in Vietnamese or in English, with its values. The practice with the teacher and Văn Miếu are other screens, so the rule does not check them.
- The count of the entities stays under the limit in `data/config/limits.json`.
- The save of the world loads back to the same world. At the end of a story, the save of the whole profile loads back to the same world.

## The storybook in the browser

- `?story=<name>` opens the game in the start state of a story. With `&play`, the story plays: a finger shows each tap, the bar at the bottom shows the step, and the game waits one second at each `expect` and shows the result. `&speed=4` plays the world faster (for the day). `&debug=1` also shows the step in the debug panel.
- Screens that are not in the village (Văn Miếu, the country map, a battle) show as a card with their name until the story closes them.
- Nothing of a story is saved.
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
| `exits` | North to Sóc Sơn and back. |
| `vanmieu-gate` | The ferry over the Red River, Văn Miếu, and back out next to its gate. |
| `time-limit` | The time is over, but the rest waits until the hero leaves the bridge. |
| `reactions` | A chicken flees, a villager greets, a pot gives a coin. |
| `nghe` | Pet and ride Nghé; push the cart. |
