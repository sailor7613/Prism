#!/bin/bash
# Double-click this file (in Finder) to run the GRAVEYARD PROBE.
#
# Question (Sailor, 2026-07-07): is the 119th graveyard — bills introduced
# and never moved, ~12,900 of them — mostly low-support noise, with a thin
# tail of broad-support bills suppressed at the gate?
#
# This samples 300 graveyard bills (seeded, reproducible) and records each
# one's cosponsor count and sponsor party from Congress.gov. ~3-4 minutes.
# Checkpointed per bill — safe to interrupt and rerun to resume.
# Output: data/graveyard_probe.json (read-only evidence; nothing merges
# into the catalog).
#
# Requires: Node, and your Congress.gov key in scripts/secrets.local.js
# First time opening: macOS may block it — right-click the file → Open → Open.

cd "$(dirname "$0")" || exit 1

echo "─────────────────────────────────────────────"
echo "  Prism · graveyard probe (300-bill sample)"
echo "─────────────────────────────────────────────"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node isn't installed. Install it from https://nodejs.org (LTS), then try again."
  echo
  read -r -p "Press Enter to close."
  exit 1
fi

node scripts/probe-graveyard-cosponsors.js || {
  echo
  echo "✗ Probe stopped (see above). Progress is saved — rerun this file to resume."
  read -r -p "Press Enter to close."
  exit 1
}

echo
echo "✓ Done. Tell Claude the probe finished — the analysis reads"
echo "  data/graveyard_probe.json."
echo
read -r -p "Press Enter to close."
