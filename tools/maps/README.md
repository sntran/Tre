# Map scripts

The region maps in `data/maps/` are made by these Python scripts. The scripts are the source: change a script, run it, and commit the script and the JSON files together.

```sh
python3 tools/maps/era1.py
```

| File | What it is |
| --- | --- |
| `maplib.py` | The map class (ground letters, heights, objects, people, and the other layers) and the JSON writer. |
| `era1.py` | The four maps of the region of Thánh Gióng: Phù Đổng on the Đuống, the hills of Sóc Sơn, the foot of Núi Trâu, and the road to Thăng Long. |

On every map, north is map −y (the screen up and to the right), and east is map +x. The real place of the middle of each map is in its `geo` field.

Each map is a window on one plane for its region (`window`, in cells). The windows touch at their edges, and the exits come from the edges that touch (`src/world/regions.js`). The script keeps only the story places of each map as stamps (`stamps`: hand-made ground and heights). The land around them comes from the rules and the seed of the world when the game starts a map (`src/core/gen/`): the rivers of `data/geo/vietnam.json`, the real hills of the fine height tiles (`data/geo/heights/`), the roads, the rice paddies, and the scattered trees, rocks, and animals (`data/world/scatter.json`). The script also writes the land of the region (`data/world/land-giong.json`): the anchors of the warp between the plane and the real map (an anchor with `lift` is the top of a hill under a stamp: the stamp rises to the real height there), the height tiles and the curve of the heights, the rivers, and the roads between the stamps (and the path to the top of Núi Trâu).
