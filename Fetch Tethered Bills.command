#!/bin/bash
# Double-click this file (in Finder) to fetch the bills your utterance
# Readings point at (their "tethers") that the catalog doesn't hold yet,
# then link them into those Readings. Takes about a minute.
#
# Requires: Node installed, and your Congress.gov key in scripts/secrets.local.js
# First time opening: macOS may block it — right-click the file → Open → Open.

cd "$(dirname "$0")" || exit 1
echo "─────────────────────────────────────────────"
echo "  Prism · fetch tethered bills"
echo "─────────────────────────────────────────────"
echo
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node isn't installed. Install it from https://nodejs.org (LTS), then try again."
  read -r -p "Press Enter to close."; exit 1
fi
node scripts/fetch-bills.js --tethers || { echo; echo "✗ Stopped (see above)."; read -r -p "Press Enter to close."; exit 1; }
echo
echo "✓ Done. Commit in GitHub Desktop, then hard-reload the app:  Cmd-Shift-R"
echo
read -r -p "Press Enter to close."
