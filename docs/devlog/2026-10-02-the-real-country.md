# The real country, at one true scale, with no invisible walls

*2 October 2026 · [Tiếng Việt](2026-10-02-the-real-country.vi.md)*

Tre could have had a land that we made up. We chose the real Vietnam, with its coast, rivers, hills, and places, so that a child learns the shape of the country by walking it. That choice brought three questions: where does the data come from, how large is the land, and what happens at its edges?

## What we found

- **The data is open.** The coast, the borders, and the rivers come from Natural Earth, and "all versions of Natural Earth raster + vector map data … are in the public domain" ([Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/)). The heights come from SRTM, measured from the space shuttle Endeavour in February 2000 at about 30 m, and open to all ([USGS](https://www.usgs.gov/centers/eros/science/usgs-eros-archive-digital-elevation-shuttle-radar-topography-mission-srtm-1)).
- **A warped map stretches the hills.** A first version pulled the places closer together, so that one cell of land was about 55 m in one place and about 270 m in another, and not the same to the east and to the north. The ridge of Núi Trâu stretched ([question 96](https://github.com/sntran/Tre/blob/main/docs/QUESTIONS.md)).
- **A coarse grid loses the small hills.** On a coarse grid of heights, Núi Trâu and Sóc Sơn disappeared into the plain. Heights at about 550 m that keep the tops of the hills brought them back.
- **A real edge is better than a wall.** At about 18° N, the Hoành Sơn range comes down to the sea at Đèo Ngang. It is a real line in the land, and a child can see it.

## What we decided

- **One land for the whole country, at one scale in all directions:** a conformal projection (Mercator) at about 45 m of real land for each cell. Distances are shorter than in life, but things keep their size. Phù Đổng to Văn Miếu is about one minute on foot; to the top of Sóc Sơn by the road is about three minutes.
- **The heights follow a curve.** Low hills get more blocks than their true height, so that a child climbs Núi Trâu and Sóc Sơn. High mountains get fewer, so that Ba Vì and Tam Đảo stay in the view.
- **No loading inside the land.** The land comes and goes in small parts around the hero.
- **Every edge has a reason that a child can see,** never an invisible wall: the real coast (the water gets deeper, and the hero stops at the knee), mountains that are too steep, the land of a later era (it fades into mist and then into blank dó paper, as the edge of a print that is not finished; for Era 1 the edge follows the Hoành Sơn range), and places that the story has not opened yet (a deep ford, a guard). The hero turns back with a short line, and the camera never shows the end of the land.
- **The seed makes the same world each time,** so that brothers, sisters, and a parent see the same place. A place that the generator made is never shown as a place of history.
