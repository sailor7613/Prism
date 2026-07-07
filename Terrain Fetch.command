#!/bin/bash
# Double-click this file (in Finder) to run a TERRAIN FETCH.
#
# A Reading is sovereign over what it examines: this fetches EVERY 119th
# Congress bill in a CRS policy area — roll calls or not — and merges them
# into the catalog provenance-marked (terrain_fetch_v1). The survey graph
# keeps excluding them; the catalog pane and curate see them.
#
# FIRST RUN IS THE EXPENSIVE ONE: the Congress.gov list endpoint doesn't
# carry policy areas, so building data/policy_area_index.json costs one
# detail call per bill (~15-20k calls, several hours, rate-limited).
# Progress is checkpointed every 200 bills — safe to interrupt; rerunning
# resumes where it left off. Every LATER terrain fetch (any policy area)
# reads the index and finishes in minutes.
#
# Requires: Node installed, and your Congress.gov key in scripts/secrets.local.js
# First time opening: macOS may block it — right-click the file → Open → Open.

cd "$(dirname "$0")" || exit 1

echo "─────────────────────────────────────────────"
echo "  Prism · terrain fetch"
echo "─────────────────────────────────────────────"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node isn't installed. Install it from https://nodejs.org (LTS), then try again."
  echo
  read -r -p "Press Enter to close."
  exit 1
fi

read -r -p "CRS policy area [Immigration]: " AREA
AREA=${AREA:-Immigration}

if [ ! -f data/policy_area_index.json ]; then
  echo
  echo "No policy-area index yet — this first run builds it (~several hours,"
  echo "checkpointed; you can close the lid, interrupt, and rerun to resume)."
  echo
fi

node scripts/fetch-bills.js --terrain "$AREA" || {
  echo
  echo "✗ Terrain fetch stopped (see above). Progress is saved — rerun this file to resume."
  read -r -p "Press Enter to close."
  exit 1
}

echo
echo "✓ Done. Hard-reload the app in your browser:  Cmd-Shift-R"
echo
read -r -p "Press Enter to close."
