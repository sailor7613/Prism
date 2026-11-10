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
# Comtrade only changes monthly, and without a key it rate-limits a second pull the same day: skip it if the file is under 3 days old.
if [ -z "$(find data/active/bilateral.json -mtime -3 2>/dev/null)" ]; then node scripts/comtrade.js; else echo "Comtrade: already pulled in the last 3 days — skipping it this time."; fi
node scripts/active-recent.js; node scripts/active-firms.js; node scripts/active-layer.js || { echo; echo "✗ Stopped (see above)."; read -r -p "Press Enter to close."; exit 1; }
# the body beyond energy (prices, groceries, wages, jobs, the mortgage, the market, the ten-year, the mood) — FRED, no key
node scripts/active-fred.js || echo "✗ the FRED fetch failed (the rest is fine)"
# the object — its body and the topic's room — rebuilt from the fresh data
python3 scripts/object-build.py || echo "✗ object-build failed (the fetch itself is fine)"
echo
echo "✓ Done. Commit data/active in GitHub Desktop."
echo
read -r -p "Press Enter to close."
