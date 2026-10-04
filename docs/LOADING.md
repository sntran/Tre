# The loading screen

From the tap that starts the game to the first frame of the world, the child sees the map of Vietnam, never a blank page (#33).

## When it shows

The screen shows in the same frame as the tap:

- after hero creation (`startProfile` in `src/ui/app.js`);
- after a tap on a profile card (`playProfile`: the screen shows before the profile loads);
- at a practice link (`startProfile` with the activity of the link);
- at the arrival of a travel on the country map, and at each other new world of the village (`ctx.go('village')` with no session).

It goes when the first frame of the world with the hero is on the screen (`src/ui/village.js`). It also goes when the device cannot draw the world, and when a scene that is not the village opens (for example the rest screen of the parent time limit).

## The look

- The map of Vietnam on dó paper: the same drawing as the country map (`drawBase` in `src/ui/worldmap.js`). A small map of the whole country is in the corner, with a red frame on the part that the big map shows.
- A red seal marks the place of the start, with its name.
- A dashed red road draws toward the seal. For a travel, it is the way of the travel. For another start, it is the way from the region of the chapter before (the hero comes from there).
- The faces of the hero and Nghé walk on the road, with a small hop in two steps like a print. A red diamond shows until the faces are ready.
- Under the map, one line: "Đang đến Phù Đổng…" / "On the way to Phù Đổng…". After ten seconds, a second line says that the land is not ready yet. The screen has no facts, no questions, and no numerals.
- At the end, the screen fades into the world.

## The progress

The length of the road is the progress of the real steps of the load, never a timer (`src/core/loading.js`, tested in `tests/loading.test.js`). The steps, in their order:

| Step | What it is |
| --- | --- |
| data | the texts of the language of the profile, the learning log, and the learner |
| heights | the height tiles of the land around the start |
| code | the drawing code (three.js and `src/render`); the land workers start before it |
| land | the land tiles around the hero (5 × 5 tiles of 64 cells), made in the workers |
| world | the session and the world state of the map |
| chunks | the meshes of the near chunks around the hero |
| figures | the shaders, and the first frame of the world with the hero |

The road never goes back, and it reaches the seal only when the world is drawn.

## The times

With `?fps` in the address, the meter in the world shows the time of each step of the last load in milliseconds, for example:

```
load: shown 109 · data 244 · heights 12 · code 988 · land 3501 · world 1189 · chunks 814 · figures 532 · total 8040 ms
```

`shown` is the time from the tap to the first frame of the loading screen.

## What makes the load shorter

- Up to three Web Workers make the land tiles at the same time (`src/ui/stream.js`), and they start before the drawing code loads. The start of the session finds the tiles ready, so that it does not make them on the main thread.
- The first save of a new hero does not stop the load (the saves go one after the other).
- The near chunks build in the frames of the loading screen, for at most 40 ms in each frame, so that the screen can draw the progress.
- The shaders compile before the first frame (`prepare` in `src/render/voxel.js`).
- The portraits of the people of the map render after the world shows.
- The road and the faces are on a layer of their own over the map, so that a step of the road does not draw the whole map again.
