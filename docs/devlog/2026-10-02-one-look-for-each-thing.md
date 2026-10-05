# One look for each thing, and figures that you can turn by hand

*2 October 2026 · [Tiếng Việt](2026-10-02-one-look-for-each-thing.vi.md)*

A game has many pictures of the same thing: the figure in the world, the face in a talk, the hero on the screen where a child makes it, the print in the notebook, and the reference sheets for the people who make the game. If each one is drawn apart, they drift apart.

## What we found

- **Two looks for one person drift apart.** In the first builds, all the art was drawings (SVG), also the faces in a talk and the hero on the creation screen. The world of blocks then brought a second look for each person. With two looks, each change must be made two times, and one of them is easy to miss.
- **A drawn reference falls behind the code.** The owner of the project asked that the reference pages show the figures of the game itself, always up to date, and that each figure stand alone on a base, like a piece of a board game, that he can turn by hand.

We found no study for this. It is a practical choice, and we say so here.

## What we decided

- **One look for each thing.** Everything in the world, and every picture of it on a screen, comes from the same code: the faces in a talk, the hero on the creation screen, the cards of the callings, and the prints of the notebook are drawn from the figures of blocks, with a mood on the face where it matters. Drawings stay only for small icons, the logo, the paper, and the patterns of frames.
- **The reference of the figures is a board of pieces** ([figures](https://sntran.github.io/Tre/docs/reference/figures.html)). Each figure stands on a round wooden base on a square of dó paper. A tap lifts a piece; a drag turns it all the way around. Switches show it walk, in the wind, with each mood, at night, far away, and from the angle of the game camera.
- **Each view has its own address,** for example `figures.html?look=grandma&mood=happy`, so that a note can link to a figure in place of a screenshot.
- **There are no drawn reference sheets to keep up to date.** A new figure in the data shows on the board with no change to the page.
