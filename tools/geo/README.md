# The geography pipeline

`build.mjs` makes `data/geo/vietnam.json`, the data of the country map: the coast and the borders, the main rivers, the lakes, a coarse grid of heights, and the real coordinates of the story places. It uses Node only, and it runs offline. The repository keeps only the result.

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
| `build.mjs` | Reads the source data and writes `data/geo/vietnam.json`. |
| `places.json` | The story places, with their real coordinates. A place with `"check": true` needs a check. |
| `rivers-extra.json` | Rivers that Natural Earth does not have at this scale (Đuống, Thái Bình, Bạch Đằng, Mã, Hương, Thu Bồn, Đồng Nai). The lines are hand-traced approximations and need a check. |

To change the map, change the settings at the top of `build.mjs` (the box, the tolerances, the grid), or the two JSON files, and build again.
