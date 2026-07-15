#!/bin/bash
# Double-click this file (in Finder) to refresh the Event Engine candidate pool.
# It sweeps recent roll-call votes (keyless — clerk.house.gov + senate.gov),
# then shapes candidates.js for the admin newsroom's "Scan the news cycle".
#
# Requires: Node installed. NO API key needed for this pipeline.
# First time opening: macOS may block it — right-click the file → Open → Open.

cd "$(dirname "$0")" || exit 1

echo "─────────────────────────────────────────────"
echo "  Prism · Event Engine · sourcing candidates"
echo "─────────────────────────────────────────────"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node isn't installed. Install it from https://nodejs.org (LTS), then try again."
  echo
  read -r -p "Press Enter to close."
  exit 1
fi

echo "Step 1/3 · sweeping recent roll-call votes (resumable; Ctrl-C safe)…"
node scripts/fetch-votes.js || { echo; echo "✗ Vote sweep failed (see the error above)."; read -r -p "Press Enter to close."; exit 1; }

echo
echo "Step 2/3 · shaping legislative candidates → data/candidates.js…"
node scripts/fetch-activity.js || { echo; echo "✗ Candidate shaping failed (see the error above)."; read -r -p "Press Enter to close."; exit 1; }

echo
echo "Step 3/3 · GDELT news sweep (keyless) → merging news candidates…"
# News is additive — a GDELT hiccup shouldn't kill the legislative refresh.
node scripts/fetch-news.js || { echo; echo "⚠ News sweep failed (see above) — continuing with legislative candidates only."; }

echo
echo "✓ Done. Open the admin surface and tap 📡 to triage."
echo
read -r -p "Press Enter to close."
