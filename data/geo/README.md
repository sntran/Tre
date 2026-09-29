# Geography data

`vietnam.json` is made by `tools/geo/build.mjs` (see `tools/geo/README.md`). Do not change it by hand.

## Sources and licenses

| Data | Source | License |
| --- | --- | --- |
| Coast, borders, rivers (Hồng, Cả, Mê Kông), lakes | [Natural Earth](https://www.naturalearthdata.com/), 1:10m, version 5 (countries from the point of view of Vietnam) | Public domain |
| Heights (the elevation grid) | NASA Shuttle Radar Topography Mission (SRTM), 3 arc-second, version 2.1 | Public domain |
| Rivers Đuống, Thái Bình, Bạch Đằng, Mã, Hương, Thu Bồn, Đồng Nai | Hand-traced by the Tre project (`tools/geo/rivers-extra.json`) | CC BY-NC-SA 4.0, as the content of Tre |
| Coordinates of the story places | From public maps, collected by the Tre project (`tools/geo/places.json`) | CC BY-NC-SA 4.0, as the content of Tre |

Natural Earth and NASA do not require credit, but we give it with thanks: "Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com." and "Elevation data: NASA SRTM."
