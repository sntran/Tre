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

- The map of Vietnam on dó paper: the same drawing as the country map (`drawBase` in `src/ui/worldmap.js`), with softer colors of the regions, so that the land, the rivers, the coast, and the road stand out. A small map of the whole country is in the corner, with a red frame on the part that the big map shows.
- The first view shows the whole country. The view stays on the map sheet in the west and the north (the land of the other countries ends at the edges of the sheet); past the east and the south there is only sea.
- As the load goes on, the map zooms slowly toward the place of the start (`zoomView` in `src/core/loading.js`). The width of the view shrinks by the same ratio for each part of the zoom.
- In the last part of the zoom (from 55% of the progress), a dashed red road draws toward the place. For a travel, it is the way of the travel. For another start, it is the way from the region of the chapter before (the hero comes from there).
- The faces of the hero and Nghé walk on the road, with a small hop in two steps like a print. A red diamond shows until the faces are ready.
- A red seal marks the place of the start, with its name, at the end (from 90% of the progress). When the world is drawn, the last view (the whole road and the seal) stays for half a second.
- Under the map, one line: "Đang đến Phù Đổng…" / "On the way to Phù Đổng…". After ten seconds, a second line says that the land is not ready yet. The screen has no facts, no questions, and no numerals.
- At the end, the screen fades into the world.

## The progress

The zoom and the length of the road are the progress of the real steps of the load, never a timer. The view follows the real progress softly and never goes back (`src/core/loading.js`, tested in `tests/loading.test.js`). The steps, in their order:

| Step | What it is |
| --- | --- |
| data | the texts of the language of the start, the learning log, and the learner |
| heights | the height tiles of the land around the start |
| code | the drawing code (three.js and `src/render`); it starts to load at the start of the load, at the same time as the data and the land |
| land | the land tiles of the first view around the hero (the tiles under the drawn ring of 9 × 9 chunks: at most 4 × 4 tiles of 64 cells), from the store of the device or made in the workers |
| world | the session and the world state of the map |
| chunks | the meshes of the near chunks around the hero |
| figures | the shaders, and the first frame of the world with the hero |

The zoom and the road never go back, and the road reaches the seal only when the world is drawn.

## The language of a start

The language that the child chose on the title screen (or in hero creation) right before a start wins: the game uses it, and the profile saves it (`startLanguage` in `src/core/profile.js`). With no choice, the profile keeps its own language, so that two children of one family can play in two languages.

## The times

With `?fps` in the address, the meter in the world shows the time of each step of the last load in milliseconds, for example:

```
load: shown 109 · data 244 · heights 12 · code 988 · land 3501 · world 1189 · chunks 814 · figures 532 · total 8040 ms
```

`shown` is the time from the tap to the first frame of the loading screen.

## What makes the load shorter

- The land tiles are kept on the device (#36): each made tile is saved in IndexedDB (`src/world/tilestore.js`, `src/ui/landstore.js`), and a start reads the saved tiles first. A practice link opens at the same place each time, so a second visit makes no land. The key of a tile has the version of the land code (`LAND_VERSION` in `src/core/gen/tiles.js`), the map, the seed, and a hash of the data of the map: a new version or new data makes new keys, and the old tiles go. The store keeps the 200 tiles that were used last (about 12 MB). With no IndexedDB, or a full store, the game makes the land as before.
- The first frame waits only for the land of the first view (`viewTiles` in `src/ui/stream.js`). The rest of the ring of 5 × 5 tiles comes after the first frame; the mist and the paper cover the far land until it comes.
- Up to three Web Workers make the land tiles that are not in the store, at the same time (`src/ui/stream.js`). The start of the session finds the tiles ready, so that it does not make them on the main thread.
- The drawing code loads at the same time as the data and the land, not after them.
- The first save of a new hero does not stop the load (the saves go one after the other).
- The near chunks build in the frames of the loading screen, for at most 40 ms in each frame, so that the screen can draw the progress.
- The shaders compile before the first frame (`prepare` in `src/render/voxel.js`).
- The portraits of the people of the map render after the world shows.
- The road and the faces are on a layer of their own over the map, so that a step of the road does not draw the whole map again.
