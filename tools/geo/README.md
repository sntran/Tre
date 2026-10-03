# The geography pipeline

`build.mjs` makes `data/geo/vietnam.json`, the data of the country map: the coast and the borders, the main rivers, the lakes, a coarse grid of heights, and the real coordinates of the story places. It also makes the fine height tiles of the land (`data/geo/heights/`): the tiles that the lands of the regions name (`tiles` in `data/world/land-<region>.json`). It uses Node only, and it runs offline. The repository keeps only the result.

## The fine height tiles

A tile is 1 × 1 degree, with a value every 0.005 degree (about 550 m): 201 × 201 values with both edges, so that a point in the tile needs no other tile. Each value is 0.6 × the highest + 0.4 × the mean of the 7 × 7 SRTM samples of its square, so that a hill smaller than the square keeps most of its height. Sea and voids are 0. The file (`<name>.bin`, about 80 KB) is the length of a JSON header (4 bytes, little-endian), the header (`tile`, `lon0`, `lat1`, `step`, `cols`, `rows`, `unit`, `filter`, `source`), and the values (16-bit, little-endian, in meters, row by row from the north). The game reads it with `fetch(...).arrayBuffer()`, the tests with `fs` (`src/core/gen/heights.js`). For a new region, add its tiles to its land file and build again. The game loads the tiles of `startTiles` (the story places) at the start, and the other tiles when the hero comes near them (`src/ui/data.js`, `src/ui/stream.js`); the land of a tile waits for its height tiles.

## Steps

1. Download the source data one time (about 150 MB), with a network:

   ```sh
   sh tools/geo/download.sh
   ```

   The script puts the files in `tools/geo/raw/` (Git does not keep this folder):

   - Natural Earth 1:10m, GeoJSON, from https://github.com/nvkelso/natural-earth-vector (folder `geojson/`):
     - `ne_10m_admin_0_countries_vnm.geojson`: the countries, from the point of view of Vietnam. Vietnam has the islands of Hoàng Sa and Trường Sa.
     - `ne_10m_rivers_lake_centerlines.geojson`: rivers.
     - `ne_10m_lakes.geojson`: lakes.
   - NASA SRTM 3 arc-second, version 2.1: the tiles `N08E101.hgt` to `N23E109.hgt` (1 × 1 degree each). A tile that is only sea does not exist. The script downloads them from a mirror that needs no login (https://srtm.kurviger.de/SRTM3/Eurasia/). The same files are on NASA Earthdata (SRTMGL3, with a free login); put the `.hgt` files in `tools/geo/raw/srtm/`.

2. Build the data, offline:

   ```sh
   node tools/geo/build.mjs
   ```

3. Run the tests: `npm test`.

## Files in this folder

| File | What it is |
| --- | --- |
| `download.sh` | Downloads the source data. |
| `build.mjs` | Reads the source data and writes `data/geo/vietnam.json` and the fine height tiles in `data/geo/heights/`. |
| `places.json` | The story places, with their real coordinates. A place with `"check": true` needs a check. |
| `rivers-extra.json` | Rivers that Natural Earth does not have at this scale (Đuống, Thái Bình, Bạch Đằng, Mã, Hương, Thu Bồn, Đồng Nai). The lines are hand-traced approximations and need a check. |

To change the map, change the settings at the top of `build.mjs` (the box, the tolerances, the grid), or the two JSON files, and build again.
