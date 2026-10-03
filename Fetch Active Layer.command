#!/bin/bash
# Double-click this file (in Finder) to fetch PG01's active layer — US crude
# flows by origin/destination and prices from EIA, detection volume from
# GDELT — into data/active/. Takes about a minute.
#
# Requires: Node installed, and your free EIA key in scripts/secrets.local.js
#   (EIA_API_KEY: 'your-key' — register at https://www.eia.gov/opendata/register.php)
# First time opening: macOS may block it — right-click the file → Open → Open.

cd "$(dirname "$0")" || exit 1
echo "─────────────────────────────────────────────"
echo "  Prism · PG01 · fetch the active layer"
echo "─────────────────────────────────────────────"
echo
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node isn't installed. Install it from https://nodejs.org (LTS), then try again."
  read -r -p "Press Enter to close."; exit 1
fi
node scripts/active-layer.js || { echo; echo "✗ Stopped (see above)."; read -r -p "Press Enter to close."; exit 1; }
echo
echo "✓ Done. Commit data/active in GitHub Desktop."
echo
read -r -p "Press Enter to close."
