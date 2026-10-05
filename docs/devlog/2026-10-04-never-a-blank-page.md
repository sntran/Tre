# Never a blank page

*4 October 2026 · [Tiếng Việt](2026-10-04-never-a-blank-page.vi.md)*

After a child made a hero, the page was blank for some seconds before the world came. The owner of the project said that a blank page can make a child think that the game is broken. A day later he asked: "Does it take that long to load a practice?"

## What we found

- **People feel a wait in steps.** A tenth of a second feels instant; one second is "the limit for the user's flow of thought to stay uninterrupted"; ten seconds is "the limit for keeping the user's attention focused". Past ten seconds, a screen must show how far the work is ([Nielsen](https://www.nngroup.com/articles/response-times-3-important-limits/)).
- **The start made more land than the first view needs.** It waited for 5 × 5 tiles of land, but the first view needs at most 4 × 4.
- **Nothing was kept between visits.** A practice link opens at the same place each time, but the game made the same land again on each visit.
- **A bug undid the choice of language.** When a child chose "Tiếng Việt" on the title screen and then a profile that was made in English, the game came up in English.

## What we decided

- **A loading screen in the first frame after the tap:** the map of Vietnam on dó paper, drawn by the same code as the country map. The view zooms slowly toward the place of the start, a red dashed road draws to it, the hero and Nghé walk along the road, and a red seal marks the place: "On the way to Phù Đổng…".
- **The progress is real, never a timer.** The zoom and the road follow the real steps of the load, and they never go back. After ten seconds, a line says that the land is not ready yet.
- **No facts and no numbers on the loading screen.** Facts come from the people of the world.
- **The game waits only for the land of the first view.** The rest comes after the first frame, under the mist and the paper.
- **The land is kept on the device:** the 200 tiles that were used last, about 12 MB. The key of each tile has the version of the code of the land, so a change of that code makes the land again. With no storage, the game still starts.
- **The language that the child chooses right before a profile wins,** and the profile saves it. With no choice, each profile keeps its own language, so that two children of one family can play in two languages.

On our test server, which has no graphics card, the making of the land went from 6.2 seconds to 3.9 seconds on a first visit, and to nothing on a second visit. In the first measure on the owner's phone, the whole start took about 3.9 seconds. Our goal is less than 3 seconds for a second visit on a phone.
