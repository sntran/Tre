# Map scripts

The region maps in `data/maps/` are made by these Python scripts. The scripts are the source: change a script, run it, and commit the script and the JSON files together.

```sh
python3 tools/maps/era1.py
```

| File | What it is |
| --- | --- |
| `maplib.py` | The map class (ground letters, heights, objects, people, and the other layers) and the JSON writer. |
| `era1.py` | The four maps of the region of Thánh Gióng: Phù Đổng on the Đuống, the hills of Sóc Sơn, the foot of Núi Trâu, and the road to Thăng Long. |

On every map, north is map −y (the screen up and to the right), and east is map +x. The cells of a map are the cells of its frame: the frame is at the real place of the story place (`frames` in the land file), so `world.at(place, x, y)` is the cell on the plane.

All the places of a region are on one plane (`docs/WORLD.md`, "One continuous world"): Mercator, 45 m for each cell. The script keeps only the story places of each map as stamps (`stamps`: hand-made ground and heights). The land around them comes from the rules and the seed of the world, tile by tile, when the hero comes near (`src/core/gen/tiles.js`): the coast and the rivers of `data/geo/vietnam.json`, the real hills of the fine height tiles (`data/geo/heights/`), the roads, the rice paddies, and the scattered trees, rocks, and animals (`data/world/scatter.json`). The script also writes the land of the region (`data/world/land-giong.json`): the plane (the origin, the latitude of true scale, and the meters for each cell), the frames of the places (a cell of the place and its real place; a frame with `lift` is the top of a hill under a stamp: the stamp rises to the real height there), the height tiles (all of them, and the tiles at the start), the curve of the heights, the rivers and their pins to the rivers of the stamps, the roads between the stamps (and the path to the top of Núi Trâu), and the mist at the edge of the land of the era.
