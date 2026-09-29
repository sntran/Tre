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
