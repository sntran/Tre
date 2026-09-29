#!/bin/sh
# Download the source data for the country map into tools/geo/raw/.
# Run this one time, with a network. The build script (build.mjs) then runs offline.
set -e
cd "$(dirname "$0")"
mkdir -p raw/srtm

# Natural Earth 1:10m (public domain), GeoJSON from the Natural Earth repository.
# The countries file is the one with the point of view of Vietnam.
NE=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
for f in ne_10m_admin_0_countries_vnm ne_10m_rivers_lake_centerlines ne_10m_lakes; do
  [ -s "raw/$f.geojson" ] || curl -fsSL -o "raw/$f.geojson" "$NE/$f.geojson"
done

# NASA SRTM 3 arc-second elevation (public domain), version 2.1 tiles of 1 x 1 degree.
# The USGS files are also on a mirror with no login. A tile that is only sea does not exist.
SRTM=https://srtm.kurviger.de/SRTM3/Eurasia
for lat in $(seq 8 23); do
  for lon in $(seq 101 109); do
    t=$(printf "N%02dE%03d" "$lat" "$lon")
    [ -s "raw/srtm/$t.hgt" ] && continue
    if curl -fsSL -o "raw/srtm/$t.hgt.zip" "$SRTM/$t.hgt.zip"; then
      unzip -oq "raw/srtm/$t.hgt.zip" -d raw/srtm && rm "raw/srtm/$t.hgt.zip"
    else
      rm -f "raw/srtm/$t.hgt.zip"
    fi
  done
done
echo "Done. Now run: node tools/geo/build.mjs"
