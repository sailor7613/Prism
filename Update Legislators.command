#!/bin/bash
# Double-click this file (in Finder) to refresh the legislator data.
# It fetches each member's sponsored + cosponsored bills from Congress.gov,
# scores their delivery z, and regenerates the static roster the app loads.
#
# Requires: Node installed, and your Congress.gov key in scripts/secrets.local.js
# (copy scripts/secrets.local.example.js → scripts/secrets.local.js and paste it).
#
# First time opening: macOS may block it — right-click the file → Open → Open.

cd "$(dirname "$0")" || exit 1

echo "─────────────────────────────────────────────"
echo "  Prism · refreshing legislator data"
echo "  This takes ~15–20 minutes. Leave it running."
echo "─────────────────────────────────────────────"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node isn't installed. Install it from https://nodejs.org (LTS), then try again."
  echo
  read -r -p "Press Enter to close."
  exit 1
fi

echo "Step 1/2 · fetching sponsored + cosponsored bills…"
node scripts/fetch-sponsorship.js || { echo; echo "✗ Fetch failed (see the error above — usually a missing key in scripts/secrets.local.js)."; read -r -p "Press Enter to close."; exit 1; }

echo
echo "Step 2/2 · scoring delivery z + regenerating the roster…"
node scripts/score-sponsorship-z.js || { echo; echo "✗ Scoring failed (see the error above)."; read -r -p "Press Enter to close."; exit 1; }

echo
echo "✓ Done. Now hard-reload the app in your browser:  Cmd-Shift-R"
echo
read -r -p "Press Enter to close."
